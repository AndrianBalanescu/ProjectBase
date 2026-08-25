// pb_hooks/41_linear_importer.pb.js
// Linear issues importer for ProjectBase (cycle 36).
// POST /api/projectbase/import/linear
//   body: { project_id: string, rows?: Array<object>, csv?: string }
//   - `rows` accepts an array of row objects whose keys map to Linear's workspace
//     export CSV columns (e.g. { ID, Title, Status, Priority, Labels, Assignee,
//     "Due Date", "Parent issue", ... }).
//   - `csv` accepts the raw Linear workspace CSV export text (Settings >
//     Administration > Import/Export > Export data). It is parsed here so a
//     caller can paste the whole export without pre-processing.
//   Accepting either form keeps the route useful for both the UI (which parses
//   the CSV client-side and sends `rows`) and direct agent/script callers.
//
// Linear workspace export columns (subset we consume):
//   ID, Title, Description, Status, Estimate, Priority, Assignee, Labels,
//   Cycle Name, Project, Due Date, Parent issue, Created, Updated, Started,
//   Completed, Canceled, Archived
//
// Mapping:
//   - Status:  "Todo"/"Unstarted"->todo, "In Progress"/"Started"->in_progress,
//              "Done"/"Completed" ->done, "Canceled"/"Cancelled" ->cancelled,
//              "Backlog" ->backlog, "In Review" ->in_review
//   - Priority:"Urgent"->urgent, "High"->high, "Medium"->medium, "Low"->low,
//              else none
//   - Labels:  Linear export has a comma+space separated "Labels" string.
//   - Due date: "Due Date" column (ISO yyyy-mm-dd) -> issues.due_date.
//   - Parent:  "Parent issue" Linear ID -> source_metadata.parent_issue (kept for
//             provenance; ProjectBase subtasks are stored separately and the CSV
//             export does not carry enough structure to rebuild the tree safely).
//
// Duplicate safety (matches the CSV/GitHub importers):
//   - Dedupes by source_metadata.source_key = "linear:{ID}" (Linear issue UUID),
//     so re-importing the same export is idempotent.
//   - Also dedupes by (project, normalized title) for safety.
//   - Sets source_metadata = { importer: "linear", source_key, imported_at }.
//
// Returns { imported, skipped, total, errors: [...] }. Malformed rows are
// collected in `errors` and skipped; valid rows still commit.
//
// NOTE: As with 40_importers.pb.js and 45_github_importer.pb.js, helpers are
// inlined inside the routerAdd callback because PocketBase Goja runs each
// callback in an isolated execution context — module-level declarations are NOT
// visible to the callback.

routerAdd("POST", "/api/projectbase/import/linear", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (bErr) { return e.json(400, { error: "Invalid JSON body" }) }
        const projectId = body.project_id

        if (!projectId) {
            return e.badRequestError("Missing required 'project_id'")
        }

        // Resolve the target project (must exist).
        let project
        try {
            project = e.app.findRecordById("projects", projectId)
        } catch (err) {
            return e.notFoundError("Project not found")
        }

        // ---- helpers (inlined; see header note) -----------------------------
        // Normalize a Linear status string to a ProjectBase status.
        const normStatus = (v) => {
            const s = String(v == null ? "" : v).trim().toLowerCase()
            if (!s || s === "no status") return "todo"
            if (s.includes("backlog") || s === "icebox") return "backlog"
            if (s.includes("todo") || s.includes("unstarted") || s.includes("untriaged") || s.includes("triage")) return "todo"
            if (s.includes("in progress") || s.includes("started") || s.includes("in-progress")) return "in_progress"
            if (s.includes("in review") || s.includes("in-review") || s.includes("review")) return "in_review"
            if (s.includes("done") || s.includes("complete") || s === "completed") return "done"
            if (s.includes("cancel") || s.includes("won't do") || s.includes("wontfix")) return "cancelled"
            return "todo"
        }

        const normPriority = (v) => {
            const p = String(v == null ? "" : v).trim().toLowerCase()
            if (!p || p === "no priority" || p === "none" || p === "0") return "none"
            if (p.includes("urgent") || p === "p0" || p === "critical") return "urgent"
            if (p.includes("high") || p === "p1") return "high"
            if (p.includes("medium") || p === "p2") return "medium"
            if (p.includes("low") || p === "p3") return "low"
            return "none"
        }

        // Split a string on commas that are NOT inside quoted spans. Linear's
        // Labels / Parent columns can contain commas inside quotes.
        const splitComma = (val) => {
            if (val == null) return []
            const parts = []
            let cur = ""
            let inQuote = false
            const s = String(val)
            for (let i = 0; i < s.length; i++) {
                const ch = s[i]
                if (ch === '"') { inQuote = !inQuote; continue }
                if (ch === "," && !inQuote) { parts.push(cur.trim()); cur = ""; continue }
                cur += ch
            }
            parts.push(cur.trim())
            return parts.filter(Boolean)
        }

        // A tiny RFC-4180-ish CSV parser adequate for Linear exports: handles
        // quoted fields and commas/quotess inside quotes. First row = header.
        const parseCsv = (text) => {
            const rowsOut = []
            let row = []
            let field = ""
            let inQ = false
            const t = String(text)
            for (let i = 0; i < t.length; i++) {
                const c = t[i]
                if (inQ) {
                    if (c === '"') {
                        if (t[i + 1] === '"') { field += '"'; i++ }
                        else inQ = false
                    } else field += c
                } else if (c === '"') {
                    inQ = true
                } else if (c === ",") {
                    row.push(field); field = ""
                } else if (c === "\n") {
                    row.push(field); field = ""
                    if (row.some(x => String(x).trim() !== "")) rowsOut.push(row)
                    row = []
                } else if (c !== "\r") {
                    field += c
                }
            }
            row.push(field)
            if (row.some(x => String(x).trim() !== "")) rowsOut.push(row)

            if (rowsOut.length < 2) return []
            const header = rowsOut[0].map(h => String(h).trim())
            const out = []
            for (let r = 1; r < rowsOut.length; r++) {
                const rec = {}
                header.forEach((h, idx) => {
                    const raw = rowsOut[r][idx]
                    const key = String(h).toLowerCase()
                    rec[key] = raw != null ? String(raw).replace(/""/g, '"') : ""
                })
                out.push(rec)
            }
            return out
        }

        // ---- build the row list from either `rows` or `csv` -----------------
        let rows = []
        if (Array.isArray(body.rows)) {
            rows = body.rows
        } else if (typeof body.csv === "string" && body.csv.trim()) {
            rows = parseCsv(body.csv)
        }
        if (rows.length === 0) {
            return e.badRequestError("Missing or empty 'rows' array / 'csv' text")
        }
        if (rows.length > 5000) {
            return e.badRequestError("Too many rows (max 5000)")
        }

        // ---- duplicate pre-load ---------------------------------------------
        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let imported = 0
        let skipped = 0
        let errors = []

        const safeProjectId = projectId.replace(/'/g, "\\'")
        const seenKeys = {}
        const seenTitles = {}
        const existingRecords = e.app.findRecordsByFilter("issues", `project = '${safeProjectId}'`, "-created", 5000, 0)
        for (const rec of existingRecords) {
            const t = (rec.get("title") || "").trim().toLowerCase()
            if (t) seenTitles[t] = true
            let sm = rec.get("source_metadata")
            if (typeof sm === "string") {
                try { sm = JSON.parse(sm) } catch (err) { sm = null }
            } else if (sm && typeof sm === "object" && Array.isArray(sm)) {
                try { sm = JSON.parse(String(sm)) } catch (err) { sm = null }
            } else if (sm && typeof sm === "object" && !sm.source_key && String(sm).charAt(0) === "{") {
                try { sm = JSON.parse(String(sm)) } catch (err) { sm = null }
            }
            if (sm && sm.source_key) seenKeys[String(sm.source_key)] = true
        }

        // ---- import loop ------------------------------------------------------
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            try {
                if (!row || typeof row !== "object") {
                    errors.push({ row: i + 1, error: "row is not an object" })
                    continue
                }
                // Linear rows: accept both the canonical mixed-case export keys
                // (ID, Title, Status, ...) and the normalized lowercase keys
                // produced by parseCsv above. The frontend sends `rows` keyed by
                // the Linear column names, so normalize once here.
                const g = (k) => {
                    if (row[k] != null) return row[k]
                    if (row[k.toLowerCase()] != null) return row[k.toLowerCase()]
                    return ""
                }
                const title = String(g("Title") || g("title") || "").trim()
                if (!title) {
                    errors.push({ row: i + 1, error: "missing title" })
                    continue
                }

                // Linear issue ID column (a UUID). This is the idempotency key.
                const linId = String(g("ID") || "").trim()
                const key = linId ? "linear:" + linId : ""
                const titleKey = title.toLowerCase()

                if (key && seenKeys[key]) { skipped++; continue }
                if (!key && seenTitles[titleKey]) { skipped++; continue }

                const rec = new Record(issuesCol)
                rec.set("project", projectId)
                rec.set("title", title)

                const description = String(g("Description") || g("description") || "").trim()
                rec.set("description", description)

                rec.set("status", normStatus(g("Status") || g("status")))
                rec.set("priority", normPriority(g("Priority") || g("priority")))

                const assignee = String(g("Assignee") || g("assignee") || "").trim()
                if (assignee) rec.set("assignee", assignee)

                // Labels: Linear exports a comma-separated list in one cell.
                const labelsRaw = String(g("Labels") || g("labels") || "").trim()
                const labels = splitComma(labelsRaw)
                if (labels.length) rec.set("labels", labels)

                const due = String(g("Due Date") || g("due_date") || g("duedate") || "").trim()
                if (due) rec.set("due_date", due.slice(0, 10))

                const estimateRaw = g("Estimate") || g("estimate")
                if (estimateRaw != null && String(estimateRaw).trim() !== "") {
                    const n = Number(estimateRaw)
                    if (!isNaN(n)) rec.set("estimate", n)
                }

                rec.set("order", Date.now() + imported * 1000 + i)

                const sm = { importer: "linear", source_key: key, imported_at: new Date().toISOString() }
                const parentId = String(g("Parent issue") || g("parent_issue") || "").trim()
                if (parentId) sm.parent_issue_id = parentId
                rec.set("source_metadata", sm)

                e.app.save(rec)
                imported++
                if (key) seenKeys[key] = true
                seenTitles[titleKey] = true
            } catch (rowErr) {
                errors.push({ row: i + 1, error: String((rowErr && rowErr.message) || rowErr) })
            }
        }

        return e.json(200, {
            imported,
            skipped,
            total: rows.length,
            errors: errors.slice(0, 100),
            project: { id: project.id, name: project.get("name") }
        })
    } catch (err) {
        console.log(">>> [ProjectBase] linear import error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})
