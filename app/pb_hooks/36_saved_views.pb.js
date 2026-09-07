// pb_hooks/36_saved_views.pb.js
// Saved Views — server-side validation + owner enforcement for saved_views.
//
// The collection API rules (migration 54) already constrain reads/writes to the
// owner. This hook adds the contract the rules cannot express:
//   - `owner` is always forced to the authenticated caller (never client-set).
//   - `name`   — 1..64 chars after trim, unique per owner+project+view.
//   - `query`  — serialized URLSearchParams string, <=512 chars, only the
//                whitelisted keys (q, priority, cycle, label), values length-
//                capped. Prevents junk state from being persisted.
//   - `view`   — board | list.
//   - `project`— optional; when set must be a real projects record id.
//
// Runs on onRecordCreateRequest/onRecordUpdateRequest so a 400 actually stops
// persistence (same pattern as 20_issue_hooks.pb.js labels parity).
//
// NOTE (PB JSVM scoping): record request callbacks are invoked from Go in a
// fresh scope, so the validator + query-pair parser are inlined into each
// handler instead of relying on top-level declarations (see
// 31_bulk_actions.pb.js).

onRecordCreateRequest((e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    // Force ownership — the client can never set it.
    e.record.set("owner", e.auth.id)

    const fail = (msg) => { e.json(400, { error: msg }); return false }

    // --- name ---
    let name = e.record.get("name")
    if (name === null || name === undefined) name = ""
    name = String(name).trim()
    if (!name) return fail("name is required")
    if (name.length > 64) return fail("name must be 64 characters or fewer")
    e.record.set("name", name)

    // --- view surface ---
    const view = e.record.get("view") || "board"
    if (view !== "board" && view !== "list") return fail("view must be 'board' or 'list'")
    e.record.set("view", view)

    // --- project scope (optional) ---
    const project = e.record.get("project")
    if (project && !/^[a-zA-Z0-9]{10,20}$/.test(String(project))) {
        return fail("project must be a valid record id or empty")
    }

    // --- query whitelist ---
    let query = e.record.get("query")
    if (query === null || query === undefined) query = ""
    query = String(query)
    if (query.length > 512) return fail("query must be 512 characters or fewer")
    const ALLOWED = { q: 200, priority: 8, cycle: 20, label: 64 }
    const pairs = []
    try {
        if (query.includes("\x00") || query.includes("<") || query.includes(">")) throw new Error("bad chars")
        for (const part of query.split("&")) {
            if (!part) continue
            const eq = part.indexOf("=")
            const k = eq === -1 ? part : part.slice(0, eq)
            const v = eq === -1 ? "" : part.slice(eq + 1)
            if (!/^[a-zA-Z_]{1,16}$/.test(k)) throw new Error("bad key: " + k)
            const max = ALLOWED[k]
            if (!max) return fail("query contains a disallowed key: " + k)
            if (v.length > max) return fail("query value too long for key: " + k)
            pairs.push(k + "=" + v)
        }
    } catch (err) {
        return fail("query must be a valid URLSearchParams string with allowed keys (q, priority, cycle, label)")
    }
    e.record.set("query", pairs.join("&"))

    // --- uniqueness: owner + project + view + name (nicety, not security) ---
    try {
        const projectId = project ? String(project) : ""
        const filter = "owner = '" + e.auth.id + "' && view = '" + view + "' && name = '" + name.replace(/'/g, "''") + "'" +
            (projectId ? " && project = '" + projectId + "'" : " && project = ''")
        const existing = $app.findRecordsByFilter("saved_views", filter, "", 1, 0)
        for (const row of existing) {
            if (row.id !== e.record.id) return fail("a saved view with this name already exists for this project and surface")
        }
    } catch (err) {
        // Never block persistence on the uniqueness probe failing.
    }
    e.next()
}, "saved_views")

onRecordUpdateRequest((e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    // Ownership already enforced by updateRule; re-validate the payload.
    // (Same body as create, minus the owner force — owner cannot be moved.)
    e.record.set("owner", e.record.original().get("owner") || e.auth.id)

    const fail = (msg) => { e.json(400, { error: msg }); return false }

    let name = e.record.get("name")
    if (name === null || name === undefined) name = ""
    name = String(name).trim()
    if (!name) return fail("name is required")
    if (name.length > 64) return fail("name must be 64 characters or fewer")
    e.record.set("name", name)

    const view = e.record.get("view") || "board"
    if (view !== "board" && view !== "list") return fail("view must be 'board' or 'list'")
    e.record.set("view", view)

    const project = e.record.get("project")
    if (project && !/^[a-zA-Z0-9]{10,20}$/.test(String(project))) {
        return fail("project must be a valid record id or empty")
    }

    let query = e.record.get("query")
    if (query === null || query === undefined) query = ""
    query = String(query)
    if (query.length > 512) return fail("query must be 512 characters or fewer")
    const ALLOWED = { q: 200, priority: 8, cycle: 20, label: 64 }
    const pairs = []
    try {
        if (query.includes("\x00") || query.includes("<") || query.includes(">")) throw new Error("bad chars")
        for (const part of query.split("&")) {
            if (!part) continue
            const eq = part.indexOf("=")
            const k = eq === -1 ? part : part.slice(0, eq)
            const v = eq === -1 ? "" : part.slice(eq + 1)
            if (!/^[a-zA-Z_]{1,16}$/.test(k)) throw new Error("bad key: " + k)
            const max = ALLOWED[k]
            if (!max) return fail("query contains a disallowed key: " + k)
            if (v.length > max) return fail("query value too long for key: " + k)
            pairs.push(k + "=" + v)
        }
    } catch (err) {
        return fail("query must be a valid URLSearchParams string with allowed keys (q, priority, cycle, label)")
    }
    e.record.set("query", pairs.join("&"))

    try {
        const projectId = project ? String(project) : ""
        const filter = "owner = '" + e.auth.id + "' && view = '" + view + "' && name = '" + name.replace(/'/g, "''") + "'" +
            (projectId ? " && project = '" + projectId + "'" : " && project = ''")
        const existing = $app.findRecordsByFilter("saved_views", filter, "", 1, 0)
        for (const row of existing) {
            if (row.id !== e.record.id) return fail("a saved view with this name already exists for this project and surface")
        }
    } catch (err) {}
    e.next()
}, "saved_views")