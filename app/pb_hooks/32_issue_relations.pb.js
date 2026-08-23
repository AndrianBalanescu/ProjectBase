// pb_hooks/32_issue_relations.pb.js
// ProjectBase issue relationships — blocks / blocked_by / related.
//
// Data model: every issue carries a JSON array in `issues.relations`:
//   [ { "issue": "<record id>", "type": "blocks" | "blocked_by" | "related" }, ... ]
//
// Reciprocal edges are maintained by the custom routes below (never by direct
// record writes):
//   - A blocks B  <=>  B blocked_by A
//   - A blocked_by B <=> B blocks A
//   - A related B <=> B related A
//
// The drawer UI (and agents) use these routes exclusively, so the graph stays
// mirrored. Direct PATCHes to /api/collections/issues/records/{id} with a
// `relations` field are shape-normalized here but do NOT create mirrors.
//
// NOTE (PB JSVM scoping): routerAdd callbacks are invoked from Go in a fresh
// scope, so helpers are inlined per handler instead of relying on top-level
// declarations.

const RELATION_TYPES = ["blocks", "blocked_by", "related"]

// --- Defaults + shape normalization on persisted records --------------------
// (onRecord* handlers run inside the script scope, so RELATION_TYPES is safe.)

onRecordCreate((e) => {
    let v = e.record.get("relations")
    if (Array.isArray(v) && v.length > 0 && typeof v[0] !== "object") {
        try { v = JSON.parse(String(v)) } catch (err) { v = [] }
    } else if (typeof v === "string") {
        try { v = JSON.parse(v) } catch (err) { v = [] }
    }
    if (v === null || v === undefined || v === "") {
        e.record.set("relations", [])
    } else {
        e.record.set("relations", v)
    }
    e.next()
}, "issues")

onRecordCreateRequest((e) => {
    let v = e.record.get("relations")
    if (Array.isArray(v) && v.length > 0 && typeof v[0] !== "object") {
        try { v = JSON.parse(String(v)) } catch (err) { v = [] }
    } else if (typeof v === "string") {
        try { v = JSON.parse(v) } catch (err) { v = [] }
    }
    if (v === null || v === undefined || v === "") {
        e.record.set("relations", [])
    } else {
        e.record.set("relations", v)
    }
    e.next()
}, "issues")

onRecordUpdateRequest((e) => {
    try {
    const TYPES = ["blocks", "blocked_by", "related"]
    let value = e.record.get("relations")
    if (Array.isArray(value) && value.length > 0 && typeof value[0] !== "object") {
        try { value = JSON.parse(String(value)) } catch (err) { value = [] }
    } else if (typeof value === "string") {
        try { value = JSON.parse(value) } catch (err) { value = [] }
    }
    if (value !== undefined) {
        let normalized = []
        if (Array.isArray(value)) {
            const seen = new Set()
            for (const r of value) {
                if (!r || typeof r !== "object") continue
                const issue = typeof r.issue === "string" ? r.issue.trim() : ""
                const type = typeof r.type === "string" ? r.type.trim() : ""
                if (!/^[a-zA-Z0-9]{10,20}$/.test(issue)) continue
                if (!TYPES.includes(type)) continue
                const key = `${issue}::${type}`
                if (seen.has(key)) continue
                seen.add(key)
                normalized.push({ issue, type })
            }
        }
        e.record.set("relations", normalized)
    }
    e.next()
    } catch (err) {
        console.error(">>> onRecordUpdateRequest relations error:", String((err && err.message) || err), "value:", JSON.stringify(e.record.get("relations")))
        throw err
    }
}, "issues")

// --- Custom routes ----------------------------------------------------------

// GET /api/projectbase/issues/{id}/relations
// Returns the resolved outgoing relations plus every incoming mirror edge.
routerAdd("GET", "/api/projectbase/issues/{id}/relations", (e) => {
    const TYPES = ["blocks", "blocked_by", "related"]
    // PB 0.39 Goja returns JSON fields as: parsed array (after set()), raw JSON
    // string, or a byte array whose String() decodes to JSON text.
    const toArr = (value) => {
        let arr = null
        if (Array.isArray(value)) {
            if (value.length === 0) return []
            if (typeof value[0] === "object" && value[0] !== null) return value
            try { arr = JSON.parse(String(value)) } catch (err) { return [] }
        } else if (typeof value === "string") {
            try { arr = JSON.parse(value) } catch (err) { return [] }
        } else if (value !== null && value !== undefined) {
            try { arr = JSON.parse(String(value)) } catch (err) { return [] }
        }
        return Array.isArray(arr) ? arr : []
    }
    const normalize = (value) => {
        const arr = toArr(value)
        const seen = new Set()
        const out = []
        for (const r of arr) {
            if (!r || typeof r !== "object") continue
            const issue = typeof r.issue === "string" ? r.issue.trim() : ""
            const type = typeof r.type === "string" ? r.type.trim() : ""
            if (!/^[a-zA-Z0-9]{10,20}$/.test(issue)) continue
            if (!TYPES.includes(type)) continue
            const key = `${issue}::${type}`
            if (seen.has(key)) continue
            seen.add(key)
            out.push({ issue, type })
        }
        return out
    }
    const resolve = (id) => {
        try { return e.app.findRecordById("issues", id) } catch (err) { return null }
    }
    const payload = (rec) => ({
        id: rec.id,
        identifier: rec.get("identifier") || rec.id,
        title: rec.get("title") || "",
        status: rec.get("status") || "backlog",
        project: rec.get("project") || ""
    })
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const issue = resolve(e.request.pathValue("id"))
        if (!issue) {
            return e.notFoundError("Issue not found")
        }

        const outgoing = normalize(issue.get("relations")).map((r) => {
            const target = resolve(r.issue)
            return {
                issue: r.issue,
                type: r.type,
                target: target ? payload(target) : { id: r.issue, identifier: "UNKNOWN", title: "Unknown issue", status: "", project: "" }
            }
        })

        const incoming = []
        const refs = e.app.findRecordsByFilter("issues", `relations ~ '${issue.id}'`, "", 500, 0)
        for (const rec of refs || []) {
            if (rec.id === issue.id) continue
            for (const r of normalize(rec.get("relations"))) {
                if (r.issue === issue.id) {
                    incoming.push({ issue: rec.id, type: r.type, target: payload(rec) })
                }
            }
        }

        return e.json(200, { outgoing, incoming })
    } catch (err) {
        console.error(">>> Error GET /issues/relations:", String((err && err.message) || err))
        return e.json(500, { error: "Failed to load relations" })
    }
})

// POST /api/projectbase/issues/{id}/relations
// Body: { "issue": "<target id>", "type": "blocks" | "blocked_by" | "related" }
// Adds the edge AND its reciprocal mirror on the target issue.
routerAdd("POST", "/api/projectbase/issues/{id}/relations", (e) => {
    const TYPES = ["blocks", "blocked_by", "related"]
    // PB 0.39 Goja returns JSON fields as: parsed array (after set()), raw JSON
    // string, or a byte array whose String() decodes to JSON text.
    const toArr = (value) => {
        let arr = null
        if (Array.isArray(value)) {
            if (value.length === 0) return []
            if (typeof value[0] === "object" && value[0] !== null) return value
            try { arr = JSON.parse(String(value)) } catch (err) { return [] }
        } else if (typeof value === "string") {
            try { arr = JSON.parse(value) } catch (err) { return [] }
        } else if (value !== null && value !== undefined) {
            try { arr = JSON.parse(String(value)) } catch (err) { return [] }
        }
        return Array.isArray(arr) ? arr : []
    }
    const mirrorType = (type) => (type === "blocks" ? "blocked_by" : type === "blocked_by" ? "blocks" : "related")
    const normalize = (value) => {
        const arr = toArr(value)
        const seen = new Set()
        const out = []
        for (const r of arr) {
            if (!r || typeof r !== "object") continue
            const issue = typeof r.issue === "string" ? r.issue.trim() : ""
            const type = typeof r.type === "string" ? r.type.trim() : ""
            if (!/^[a-zA-Z0-9]{10,20}$/.test(issue)) continue
            if (!TYPES.includes(type)) continue
            const key = `${issue}::${type}`
            if (seen.has(key)) continue
            seen.add(key)
            out.push({ issue, type })
        }
        return out
    }
    const has = (rec, id, type) => normalize(rec.get("relations")).some((r) => r.issue === id && r.type === type)
    const append = (rec, id, type) => {
        const list = normalize(rec.get("relations"))
        if (!list.some((r) => r.issue === id && r.type === type)) {
            list.push({ issue: id, type })
            rec.set("relations", list)
            return true
        }
        return false
    }
    const resolve = (id) => {
        try { return e.app.findRecordById("issues", id) } catch (err) { return null }
    }
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body
        try {
            body = e.requestInfo().body || {}
        } catch (bErr) {
            return e.json(400, { error: "Invalid JSON body" })
        }
        const type = typeof body.type === "string" ? body.type.trim() : ""
        if (!TYPES.includes(type)) {
            return e.json(400, { error: `'type' must be one of: ${TYPES.join(", ")}` })
        }
        const targetId = typeof body.issue === "string" ? body.issue.trim() : ""
        if (!/^[a-zA-Z0-9]{10,20}$/.test(targetId)) {
            return e.json(400, { error: "Invalid 'issue' id format" })
        }
        const issue = resolve(e.request.pathValue("id"))
        if (!issue) {
            return e.notFoundError("Issue not found")
        }
        if (issue.id === targetId) {
            return e.json(400, { error: "An issue cannot relate to itself" })
        }
        const target = resolve(targetId)
        if (!target) {
            return e.notFoundError("Target issue not found")
        }

        const changed = append(issue, targetId, type)
        const mirrorChanged = append(target, issue.id, mirrorType(type))
        if (changed) {
            e.app.save(issue)
        }
        if (mirrorChanged) {
            e.app.save(target)
        }

        return e.json(200, {
            relations: normalize(issue.get("relations")),
            mirrored: mirrorChanged,
            already: !changed
        })
    } catch (err) {
        console.error(">>> Error POST /issues/relations:", String((err && err.message) || err))
        return e.json(500, { error: "Failed to add relation" })
    }
})

// DELETE /api/projectbase/issues/{id}/relations
// Body: { "issue": "<target id>", "type": "blocks" | "blocked_by" | "related" }
// Removes the edge AND its reciprocal mirror on the target issue.
routerAdd("DELETE", "/api/projectbase/issues/{id}/relations", (e) => {
    const TYPES = ["blocks", "blocked_by", "related"]
    // PB 0.39 Goja returns JSON fields as: parsed array (after set()), raw JSON
    // string, or a byte array whose String() decodes to JSON text.
    const toArr = (value) => {
        let arr = null
        if (Array.isArray(value)) {
            if (value.length === 0) return []
            if (typeof value[0] === "object" && value[0] !== null) return value
            try { arr = JSON.parse(String(value)) } catch (err) { return [] }
        } else if (typeof value === "string") {
            try { arr = JSON.parse(value) } catch (err) { return [] }
        } else if (value !== null && value !== undefined) {
            try { arr = JSON.parse(String(value)) } catch (err) { return [] }
        }
        return Array.isArray(arr) ? arr : []
    }
    const mirrorType = (type) => (type === "blocks" ? "blocked_by" : type === "blocked_by" ? "blocks" : "related")
    const normalize = (value) => {
        const arr = toArr(value)
        const seen = new Set()
        const out = []
        for (const r of arr) {
            if (!r || typeof r !== "object") continue
            const issue = typeof r.issue === "string" ? r.issue.trim() : ""
            const type = typeof r.type === "string" ? r.type.trim() : ""
            if (!/^[a-zA-Z0-9]{10,20}$/.test(issue)) continue
            if (!TYPES.includes(type)) continue
            const key = `${issue}::${type}`
            if (seen.has(key)) continue
            seen.add(key)
            out.push({ issue, type })
        }
        return out
    }
    const remove = (rec, id, type) => {
        const list = normalize(rec.get("relations"))
        const next = list.filter((r) => !(r.issue === id && r.type === type))
        if (next.length !== list.length) {
            rec.set("relations", next)
            return true
        }
        return false
    }
    const resolve = (id) => {
        try { return e.app.findRecordById("issues", id) } catch (err) { return null }
    }
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body
        try {
            body = e.requestInfo().body || {}
        } catch (bErr) {
            return e.json(400, { error: "Invalid JSON body" })
        }
        const type = typeof body.type === "string" ? body.type.trim() : ""
        if (!TYPES.includes(type)) {
            return e.json(400, { error: `'type' must be one of: ${TYPES.join(", ")}` })
        }
        const targetId = typeof body.issue === "string" ? body.issue.trim() : ""
        if (!/^[a-zA-Z0-9]{10,20}$/.test(targetId)) {
            return e.json(400, { error: "Invalid 'issue' id format" })
        }
        const issue = resolve(e.request.pathValue("id"))
        if (!issue) {
            return e.notFoundError("Issue not found")
        }
        const target = resolve(targetId)
        if (!target) {
            return e.notFoundError("Target issue not found")
        }

        const changed = remove(issue, targetId, type)
        const mirrorChanged = remove(target, issue.id, mirrorType(type))
        if (changed) {
            e.app.save(issue)
        }
        if (mirrorChanged) {
            e.app.save(target)
        }

        return e.json(200, {
            relations: normalize(issue.get("relations")),
            unmirrored: mirrorChanged,
            removed: changed
        })
    } catch (err) {
        console.error(">>> Error DELETE /issues/relations:", String((err && err.message) || err))
        return e.json(500, { error: "Failed to remove relation" })
    }
})
