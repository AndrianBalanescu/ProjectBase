// pb_hooks/42_plane_importer.pb.js
// Plane issues importer for ProjectBase (cycle 37).
// POST /api/projectbase/import/plane
//   body: { project_id: string, rows?: Array<object>, csv?: string }
//   - `rows` accepts an array of row objects whose keys map to Plane's issue
//     export CSV columns (e.g. { Name, Description, State, Priority, Labels,
//     Assignees, "Start Date", "Target Date", ... }).
//   - `csv` accepts the raw Plane workspace CSV export text (Workspace Settings >
//     Exports > select project > Export). It is parsed here so a caller can paste
//     the whole export without pre-processing.
//   Accepting either form keeps the route useful for both the UI (which parses
//   the CSV client-side and sends `rows`) and direct agent/script callers.
//
// Plane issue export columns (the set we consume is intentionally tolerant of
// Plane version drift — exports carry a subset of these under slightly
// different names across 0.x releases):
//   Name / Title, Description, State / State Group / Status, Priority,
//   Labels (a single comma-separated string or "Labels (names)"),
//   Assignees / Assignee (comma-separated member names),
//   Start Date, Target Date (the due date),
//   Estimate / Estimate Point, Cycle / Sprint, ID / Issue ID / Sequence ID,
//   Created At, Updated At, Completed At, Canceled At
//
// Mapping (mirrors the Linear importer):
//   - Status:  "Todo"->todo, "In Progress"->in_progress, "Backlog"->backlog,
//              "Done"->done, "Cancelled"/"Canceled"->cancelled,
//              "In Review"->in_review (and tolerant English variants)
//   - Priority:"Urgent"->urgent, "High"->high, "Medium"->medium, "Low"->low,
//              else none
//   - Labels:  Plane exports a comma+space separated "Labels" string.
//   - Start Date / Target Date (ISO yyyy-mm-dd) -> issues.start_date / due_date.
//   - Estimate: numeric -> issues.estimate.
//
// Duplicate safety (matches the CSV/GitHub/Linear importers):
//   - Dedupes by source_metadata.source_key = "plane:{ID}" (Plane issue ID /
//     identifier) when an ID column is present, else falls back to title-only
//     dedup within the target project.
//
// NOTE: As with 40_importers.pb.js, 41_linear_importer.pb.js and
// 45_github_importer.pb.js, helpers are inlined inside the routerAdd callback
// because PocketBase Goja runs each callback in an isolated execution context —
// module-level declarations are NOT visible to the callback.

routerAdd("POST", "/api/projectbase/import/plane", (e) => {
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
        // Normalize a Plane status string to a ProjectBase status. Tolerant of
        // Plane's state-group names (Todo / In Progress / Done / Cancelled /
        // Backlog) and English variants.
        const normStatus = (v) => {
            const s = String(v == null ? "" : v).trim().toLowerCase()
            if (!s || s === "no status" || s === "untriaged") return "todo"
            if (s.includes("backlog") || s === "icebox") return "backlog"
            if (s.includes("in progress") || s.includes("started") || s.includes("in-progress") || s.includes("doing")) return "in_progress"
            if (s.includes("in review") || s.includes("in-review") || s.includes("review") || s.includes("paused")) return "in_review"
            if (s.includes("done") || s.includes("complete")) return "done"
            if (s.includes("cancel") || s.includes("won't do") || s.includes("wontfix")) return "cancelled"
            if (s.includes("todo") || s === "default") return "todo"
            return "todo"
        }

        const normPriority = (v) => {
            const p = String(v == null ? "" : v).trim().toLowerCase()
            if (!p || p === "no priority" || p === "none" || p === "0") return "none"
            if (p.includes("urgent") || p === "p0" || p === "critical") return "urgent"
            if (p.includes("high") || p === "p1") return "high"
            if (p.includes("medium") || p === "p2" || p === "moderate") return "medium"
            if (p.includes("low") || p === "p3") return "low"
            return "none"
        }

        // A tiny RFC-4180-ish CSV parser adequate for Plane exports: handles
        // quoted fields and commas/quotes inside quotes. First row = header.
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
                    if (row.some((x) => String(x).trim() !== "")) rowsOut.push(row)
                    row = []
                } else if (c !== "\r") {
                    field += c
                }
            }
            // flush last field / row
            if (field !== "" || row.length > 0) {
                row.push(field)
                if (row.some((x) => String(x).trim() !== "")) rowsOut.push(row)
            }
            if (rowsOut.length === 0) return []
            const header = rowsOut[0].map((h) => String(h).trim())
            const out = []
            for (let r = 1; r < rowsOut.length; r++) {
                const obj = {}
                const cells = rowsOut[r]
                for (let c = 0; c < header.length; c++) {
                    if (!header[c]) continue
                    obj[header[c]] = c < cells.length ? cells[c] : ""
                }
                out.push(obj)
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
            try {
                const row = rows[i]
                if (!row || typeof row !== "object") { errors.push({ row: i + 1, error: "non-object row" }); continue }

                // Plane rows: accept both the canonical mixed-case export keys
                // (Name, State, Priority, ...) and the normalized lowercase keys
                // produced by parseCsv. The frontend sends `rows` keyed by the
                // Plane column names, so normalize once here.
                const g = (k) => {
                    if (row[k] != null) return row[k]
                    if (row[k.toLowerCase()] != null) return row[k.toLowerCase()]
                    return ""
                }
                const title = String(g("Name") || g("Title") || g("title") || g("name") || "").trim()
                if (!title) {
                    errors.push({ row: i + 1, error: "missing title" })
                    continue
                }

                // Plane issue ID / identifier column (idempotency key). Accept
                // several plausible names. Falls back to a title-only key.
                const idRaw = String(g("ID") || g("Identifier") || g("Issue ID") || g("Issue Id") || "").trim()
                const key = idRaw ? "plane:" + idRaw : ""
                const titleKey = title.toLowerCase()

                if (key && seenKeys[key]) { skipped++; continue }
                if (!key && seenTitles[titleKey]) { skipped++; continue }

                const rec = new Record(issuesCol)
                rec.set("project", projectId)
                rec.set("title", title)

                const description = String(g("Description") || g("description") || "").trim()
                rec.set("description", description)

                rec.set("status", normStatus(g("State") || g("Status") || g("State Group")))
                rec.set("priority", normPriority(g("Priority") || g("priority")))

                // Assignees: Plane exports a comma-separated list of member names
                // in one cell (may be quoted). Take the first name.
                const assigneesRaw = String(g("Assignees") || g("Assignee") || g("assignee") || g("assignees") || "").trim()
                if (assigneesRaw) {
                    const first = assigneesRaw.split(",")[0].replace(/^"|"$/g, "").trim()
                    if (first) rec.set("assignee", first)
                }

                // Labels: Plane exports a single comma-separated string cell
                // (sometimes "Labels (names)"). Split on commas outside quotes.
                const labelsRaw = String(g("Labels") || g("Label") || g("Labels (names)") || g("labels") || "").trim()
                if (labelsRaw) {
                    const list = []
                    let cur = ""
                    let inQ = false
                    for (let ci = 0; ci < labelsRaw.length; ci++) {
                        const ch = labelsRaw[ci]
                        if (ch === '"') { inQ = !inQ; continue }
                        if (ch === "," && !inQ) { if (cur.trim()) list.push(cur.trim()); cur = ""; continue }
                        cur += ch
                    }
                    if (cur.trim()) list.push(cur.trim())
                    if (list.length) rec.set("labels", list)
                }

                // Dates: "Start Date" -> start_date, "Target Date" / "Due Date"
                // -> due_date. Plane exports ISO yyyy-mm-dd.
                const startRaw = String(g("Start Date") || g("start_date") || "").trim()
                if (startRaw) rec.set("start_date", startRaw.slice(0, 10))
                const dueRaw = String(g("Target Date") || g("Due Date") || g("due_date") || "").trim()
                if (dueRaw) rec.set("due_date", dueRaw.slice(0, 10))

                // Estimate: numeric.
                const estimateRaw = g("Estimate") || g("estimate")
                if (estimateRaw != null && String(estimateRaw).trim() !== "") {
                    const n = Number(String(estimateRaw).replace(/[^0-9.]/g, ""))
                    if (!isNaN(n)) rec.set("estimate", n)
                }

                rec.set("order", Date.now() + imported * 1000 + i)

                const sm = { importer: "plane", source_key: key, imported_at: new Date().toISOString() }
                const parentId = String(g("Parent") || g("Parent issue") || g("parent_issue") || "").trim()
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
        console.log(">>> [ProjectBase] plane import error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})
