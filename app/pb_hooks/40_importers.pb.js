// pb_hooks/40_importers.pb.js
// Flat-file CSV importer for ProjectBase (cycle 2).
// POST /api/projectbase/import/csv
//   body: { project_id: string, rows: [{ title, description?, status?, priority?,
//          assignee?, due_date?, estimate?, labels?, source_key? }] }
// Behavior:
//   - Requires an authenticated user.
//   - Duplicate-safe: if an issue with the same (project, title) already exists
//     (or was imported from the same source_key), it is skipped, not duplicated.
//   - Sets source_metadata = { importer: "csv", source_key, source_type, imported_at } for provenance.
//   - Returns { imported, skipped, total, errors: [...] }.
// Malformed rows are collected into `errors` and skipped, so one bad row cannot
// abort the whole batch; valid rows still commit.
//
// NOTE: All helpers are inlined inside the routerAdd callback because PocketBase
// Goja runs the callback in an isolated execution context — module-level `const`
// and `function` declarations are NOT visible to the callback.

routerAdd("POST", "/api/projectbase/import/csv", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (bErr) { return e.json(400, { error: "Invalid JSON body" }) }
        let projectId = body.project_id
        let rows = Array.isArray(body.rows) ? body.rows : []

        if (!projectId) {
            return e.badRequestError("Missing required 'project_id'")
        }
        if (rows.length === 0) {
            return e.badRequestError("Missing or empty 'rows' array")
        }
        if (rows.length > 5000) {
            return e.badRequestError("Too many rows (max 5000)")
        }

        let project
        try {
            project = e.app.findRecordById("projects", projectId)
        } catch (err) {
            return e.notFoundError("Project not found")
        }

        const STATUS = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]
        const PRIORITY = ["urgent", "high", "medium", "low", "none"]
        const statusLookup = {}
        for (const s of STATUS) statusLookup[s] = s
        const priorityLookup = {}
        for (const p of PRIORITY) priorityLookup[p] = p

        function normStatus(v) {
            const s = String(v || "").trim().toLowerCase().replace(/[_\s]+/g, "_")
            if (statusLookup[s]) return s
            if (s.includes("progress") || s.includes("doing") || s.includes("active")) return "in_progress"
            if (s.includes("review")) return "in_review"
            if (s.includes("done") || s.includes("closed") || s.includes("complete") || s.includes("resolved")) return "done"
            if (s.includes("cancel") || s.includes("wontfix")) return "cancelled"
            return "todo"
        }

        function normPriority(v) {
            const p = String(v || "").trim().toLowerCase()
            if (priorityLookup[p]) return p
            if (p.includes("urgent") || p === "p0" || p.includes("critical")) return "urgent"
            if (p.includes("high") || p === "p1") return "high"
            if (p.includes("medium") || p === "p2") return "medium"
            if (p.includes("low") || p === "p3") return "low"
            return "none"
        }

        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let imported = 0
        let skipped = 0
        let errors = []

        const safeProjectId = projectId.replace(/'/g, "\\'")
        const seenTitles = {}
        const seenKeys = {}
        const existingRecords = e.app.findRecordsByFilter("issues", `project = '${safeProjectId}'`, "-created", 5000, 0)
        for (const rec of existingRecords) {
            const t = (rec.get("title") || "").trim().toLowerCase()
            if (t) seenTitles[t] = true
            // source_metadata may come back as a parsed object, a raw JSON string,
            // OR (common in PB 0.39 Goja) a byte array holding the JSON text.
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

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            try {
                if (!row || typeof row !== "object") {
                    errors.push({ row: i + 1, error: "row is not an object" })
                    continue
                }
                const title = String(row.title || "").trim()
                if (!title) {
                    errors.push({ row: i + 1, error: "missing title" })
                    continue
                }
                const key = row.source_key != null ? String(row.source_key) : ""
                const titleKey = title.toLowerCase()

                if (seenTitles[titleKey]) { skipped++; continue }
                if (key && seenKeys[key]) { skipped++; continue }

                const rec = new Record(issuesCol)
                rec.set("project", projectId)
                rec.set("title", title)
                rec.set("description", row.description != null ? String(row.description) : "")
                rec.set("status", normStatus(row.status))
                rec.set("priority", normPriority(row.priority))
                rec.set("assignee", row.assignee ? String(row.assignee) : "")
                if (row.start_date) rec.set("start_date", String(row.start_date))
                if (row.due_date) rec.set("due_date", String(row.due_date))
                if (row.estimate != null && row.estimate !== "") rec.set("estimate", Number(row.estimate) || 0)
                if (Array.isArray(row.labels)) rec.set("labels", row.labels.map(String))
                rec.set("order", Date.now() + imported * 1000 + i)

                const sm = { importer: "csv", source_key: key, imported_at: new Date().toISOString() }
                if (row.source_type) sm.source_type = String(row.source_type)
                rec.set("source_metadata", sm)

                e.app.save(rec)
                seenTitles[titleKey] = true
                if (key) seenKeys[key] = true
                imported++
            } catch (err) {
                errors.push({ row: i + 1, error: String((err && err.message) || err) })
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
        console.log(">>> [ProjectBase] import error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})
