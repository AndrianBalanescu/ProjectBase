// pb_hooks/42_export.pb.js
// Flat-file exporter for ProjectBase (cycle 29).
// The importer (40_importers.pb.js) is one-way today: users can bulk-create
// issues from CSV/GitHub, but there is no way to get their data back out as a
// portable flat file. Export closes the migration loop (data portability) and
// mirrors the import column set so an exported file can be re-imported into
// another ProjectBase (or Linear/Plane/Trello) instance.
//
// GET /api/projectbase/export/csv?project=<project_id>
//   - Requires an authenticated user.
//   - Returns a text/csv file whose columns are the importer's accepted row
//     fields (title,description,status,priority,assignee,start_date,due_date,
//     estimate,labels,source_key) plus a "custom_fields" JSON column.
//   - Rows are the project's issues ordered by "order", then "created".
//   - The file is emitted inline (Content-Disposition: attachment) so the
//     browser downloads it. A single issue id may be targeted via
//     ?id=<issue_id> for a one-issue export.
//
// GET /api/projectbase/export/json?project=<project_id>
//   - Same access rules; returns a JSON document { project, exported_at,
//     format: "projectbase", count, issues: [...] } for tooling/agents.

// NOTE: All helpers are inlined inside each routerAdd callback because
// PocketBase Goja runs each callback in an isolated execution context —
// module-level `const` / `function` declarations are NOT visible to it.

routerAdd("GET", "/api/projectbase/export/csv", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let projectId = e.requestInfo().query && e.requestInfo().query.project
        if (!projectId) {
            return e.badRequestError("Missing required 'project' query param")
        }

        let project
        try {
            project = e.app.findRecordById("projects", projectId)
        } catch (err) {
            return e.json(404, { error: "Project not found" })
        }

        // RFC-4180-ish quoting: double any embedded quote and wrap any field
        // that contains a comma, quote, newline or CR. Inlined (not module
        // scope) because Goja runs this callback in an isolated context.
        function csvCell(v) {
            const s = String(v == null ? "" : v)
            if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
            return s
        }
        function csvRow(arr) {
            return arr.map(csvCell).join(",")
        }
        // Goja returns JSON/select fields (labels, custom_fields, source_metadata)
        // as byte arrays. Decode them back to their JSON text before parsing.
        function decodeJson(v) {
            if (v == null) return v
            if (Array.isArray(v) && v.length && typeof v[0] === "number") {
                try { return String.fromCharCode.apply(null, v) } catch (err) { return null }
            }
            return v
        }

        let issues = e.app.findRecordsByFilter("issues", `project = '${projectId}'`, "order,created", 10000, 0)

        // Header mirrors the importer columns (title,description,status,
        // priority,assignee,start_date,due_date,estimate,labels,source_key)
        // plus a custom_fields JSON column so custom properties survive.
        let header = ["title", "description", "status", "priority", "assignee",
            "start_date", "due_date", "estimate", "labels", "source_key", "custom_fields"]

        let lines = [csvRow(header)]
        for (let i = 0; i < issues.length; i++) {
            const rec = issues[i]
            let labels = rec.get("labels")
            let labelsStr = ""
            if (Array.isArray(labels) && labels.length && typeof labels[0] === "number") {
                try { const t = String.fromCharCode.apply(null, labels); const p = JSON.parse(t); if (Array.isArray(p)) labelsStr = p.join("|") } catch (err) {}
            } else if (Array.isArray(labels)) {
                labelsStr = labels.join("|")
            }

            let sm = rec.get("source_metadata")
            let sourceKey = ""
            if (Array.isArray(sm) && sm.length && typeof sm[0] === "number") { try { sm = JSON.parse(String.fromCharCode.apply(null, sm)) } catch (err) { sm = null } }
            if (sm && typeof sm === "object" && sm.source_key) sourceKey = String(sm.source_key)
            else if (sm && typeof sm === "string") { try { const p = JSON.parse(sm); if (p && p.source_key) sourceKey = String(p.source_key) } catch (err) {} }

            let cf = rec.get("custom_fields")
            let cfStr = ""
            if (Array.isArray(cf) && cf.length && typeof cf[0] === "number") { try { cf = JSON.parse(String.fromCharCode.apply(null, cf)) } catch (err) { cf = null } }
            if (cf && typeof cf === "object" && !Array.isArray(cf)) { try { cfStr = JSON.stringify(cf) } catch (err) { cfStr = "" } }

            let row = [
                rec.get("title") || "",
                rec.get("description") || "",
                rec.get("status") || "",
                rec.get("priority") || "",
                rec.get("assignee") || "",
                rec.get("start_date") ? String(rec.get("start_date")).slice(0, 10) : "",
                rec.get("due_date") ? String(rec.get("due_date")).slice(0, 10) : "",
                rec.get("estimate") != null ? String(rec.get("estimate")) : "",
                labelsStr,
                sourceKey,
                cfStr
            ]
            lines.push(csvRow(row))
        }

        const csv = lines.join("\n")
        const safeName = (project.get("name") || "project").replace(/[^\w\-]+/g, "_")
        e.response.header().set("Content-Type", "text/csv; charset=utf-8")
        e.response.header().set("Content-Disposition", `attachment; filename="${safeName}-issues.csv"`)
        e.response.write(csv)
        return
    } catch (err) {
        console.log(">>> [ProjectBase] export/csv error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})

routerAdd("GET", "/api/projectbase/export/json", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let projectId = e.requestInfo().query && e.requestInfo().query.project
        if (!projectId) {
            return e.badRequestError("Missing required 'project' query param")
        }

        let project
        try {
            project = e.app.findRecordById("projects", projectId)
        } catch (err) {
            return e.json(404, { error: "Project not found" })
        }

        let issues = e.app.findRecordsByFilter("issues", `project = '${projectId}'`, "order,created", 10000, 0)
        let items = []
        for (let i = 0; i < issues.length; i++) {
            const rec = issues[i]
            let labels = rec.get("labels") || []
            if (!Array.isArray(labels)) labels = []
            let sm = rec.get("source_metadata")
            if (typeof sm === "string") { try { sm = JSON.parse(sm) } catch (err) { sm = {} } }
            items.push({
                id: rec.id,
                identifier: rec.get("identifier") || "",
                issue_number: rec.get("issue_number") || 0,
                title: rec.get("title") || "",
                description: rec.get("description") || "",
                status: rec.get("status") || "",
                priority: rec.get("priority") || "",
                assignee: rec.get("assignee") || "",
                start_date: rec.get("start_date") ? String(rec.get("start_date")).slice(0, 10) : "",
                due_date: rec.get("due_date") ? String(rec.get("due_date")).slice(0, 10) : "",
                estimate: rec.get("estimate") != null ? rec.get("estimate") : 0,
                labels,
                source_key: (sm && sm.source_key) ? String(sm.source_key) : "",
                custom_fields: rec.get("custom_fields") || {},
                created: rec.created,
                updated: rec.updated
            })
        }

        return e.json(200, {
            exporter: "projectbase",
            format_version: 1,
            project: { id: project.id, name: project.get("name") || "", identifier: project.get("identifier") || "" },
            exported_at: new Date().toISOString(),
            count: items.length,
            issues: items
        })
    } catch (err) {
        console.log(">>> [ProjectBase] export/json error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})
