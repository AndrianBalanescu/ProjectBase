// pb_hooks/35_custom_fields.pb.js
// ProjectBase custom fields — define per-project field schemas and validate
// issue values against them. Purely additive (uses the custom_field_defs and
// custom_fields JSON columns from migration 9).
//
// Design:
//   - Definitions live on projects.custom_field_defs (a JSON array).
//   - Values live on issues.custom_fields (a JSON object keyed by field key).
//   - GET    /api/projectbase/projects/{id}/custom-fields
//   - PUT    /api/projectbase/projects/{id}/custom-fields  (replace defs)
//   - POST   /api/projectbase/projects/{id}/custom-fields/validate
//            (validate a proposed custom_fields payload against the defs)
//
// Field types: text, number, select, checkbox, date.
//
// Implementation note: PocketBase's JSVM does NOT reliably register top-level
// const/function declarations (verified empirically on 0.39.x). Every helper is
// therefore defined as a local const inside the handler that needs it.

routerAdd("GET", "/api/projectbase/projects/{id}/custom-fields", (e) => {
    const readDefs = (project) => {
        // PocketBase JSVM may expose a JSON column as a raw byte array in some
        // request contexts; decode it back to text before parsing.
        let defs = project.get("custom_field_defs")
        if (Array.isArray(defs) && defs.length && typeof defs[0] === "number") {
            defs = String.fromCharCode.apply(null, defs)
        }
        if (typeof defs === "string") { try { defs = JSON.parse(defs) } catch (err) { defs = [] } }
        if (!Array.isArray(defs)) defs = []
        return defs
    }
    try {
        if (!e.auth || !e.auth.id) return e.unauthorizedError("Authentication required")
        let project = e.app.findRecordById("projects", e.request.pathValue("id"))
        if (!project) return e.notFoundError("Project not found")
        return e.json(200, { fields: readDefs(project) })
    } catch (err) {
        return e.json(500, { error: err.message })
    }
})

routerAdd("PUT", "/api/projectbase/projects/{id}/custom-fields", (e) => {
    const TYPES = ["text", "number", "select", "checkbox", "date"]
    const slugify = (label) => String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40)
    try {
        if (!e.auth || !e.auth.id) return e.unauthorizedError("Authentication required")
        const project = e.app.findRecordById("projects", e.request.pathValue("id"))
        if (!project) return e.notFoundError("Project not found")
        const body = e.requestInfo().body || {}
        const fields = body.fields
        if (!Array.isArray(fields)) return e.json(400, { error: "Expected body { fields: [...] }" })
        if (fields.length > 50) return e.json(400, { error: "Too many custom fields (max 50)" })

        const seenKeys = {}
        const normalized = []
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i]
            if (f === null || typeof f !== "object" || Array.isArray(f)) {
                return e.json(400, { error: "Each field must be an object" })
            }
            const label = String(f.label || "").trim()
            if (!label) return e.json(400, { error: "Each field needs a label" })
            const type = String(f.type || "text").toLowerCase()
            if (TYPES.indexOf(type) === -1) {
                return e.json(400, { error: "Unsupported type '" + type + "'. Allowed: " + TYPES.join(", ") })
            }
            const key = String(f.key || slugify(label)).trim()
            if (!key) return e.json(400, { error: "Could not derive a key for a field" })
            if (seenKeys[key]) return e.json(400, { error: "Duplicate field key '" + key + "'" })
            seenKeys[key] = true
            const options = Array.isArray(f.options) ? f.options.map((o) => String(o)).slice(0, 100) : []
            if (type === "select" && options.length === 0) {
                return e.json(400, { error: "Select field '" + label + "' needs at least one option" })
            }
            normalized.push({ key: key, label: label, type: type, required: !!f.required, options: options })
        }

        project.set("custom_field_defs", normalized)
        e.app.save(project)
        return e.json(200, { success: true, fields: normalized })
    } catch (err) {
        return e.json(500, { error: err.message })
    }
})

routerAdd("POST", "/api/projectbase/projects/{id}/custom-fields/validate", (e) => {
    const readDefs = (project) => {
        let defs = project.get("custom_field_defs")
        if (Array.isArray(defs) && defs.length && typeof defs[0] === "number") {
            defs = String.fromCharCode.apply(null, defs)
        }
        if (typeof defs === "string") { try { defs = JSON.parse(defs) } catch (err) { defs = [] } }
        if (!Array.isArray(defs)) defs = []
        return defs
    }
    try {
        if (!e.auth || !e.auth.id) return e.unauthorizedError("Authentication required")
        const project = e.app.findRecordById("projects", e.request.pathValue("id"))
        if (!project) return e.notFoundError("Project not found")
        const body = e.requestInfo().body || {}
        const defs = readDefs(project)
        const values = (body.values !== null && typeof body.values === "object" && !Array.isArray(body.values)) ? body.values : {}
        const errors = []
        for (let i = 0; i < defs.length; i++) {
            const f = defs[i]
            const key = f.key
            const has = Object.prototype.hasOwnProperty.call(values, key)
            const v = values[key]
            if (f.required && (!has || v === null || v === undefined || v === "")) {
                errors.push(f.label + " is required")
                continue
            }
            if (!has || v === null || v === undefined || v === "") continue
            if (f.type === "number" && (typeof v !== "number" || isNaN(v))) {
                errors.push(f.label + " must be a number")
            } else if (f.type === "checkbox" && typeof v !== "boolean") {
                errors.push(f.label + " must be a boolean")
            } else if (f.type === "date") {
                const d = new Date(v)
                if (isNaN(d.getTime())) errors.push(f.label + " must be a valid date")
            } else if (f.type === "select" && f.options.indexOf(String(v)) === -1) {
                errors.push(f.label + " must be one of: " + f.options.join(", "))
            }
        }
        if (errors.length) return e.json(422, { error: errors.join("; ") })
        return e.json(200, { valid: true })
    } catch (err) {
        return e.json(500, { error: err.message })
    }
})
