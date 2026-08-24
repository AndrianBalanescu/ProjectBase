// pb_hooks/31_bulk_actions.pb.js
// Bulk issue actions for the zero-friction multi-select workflow.
//
// The frontend board/list multi-select emits one request per bulk action
// instead of N per-record PATCH calls. Each record is saved through
// app.save()/app.delete() so the standard onRecordUpdate hooks (activity
// audit) and realtime SSE broadcasts fire per record, keeping every client
// in sync without extra plumbing.
//
// NOTE (PB JSVM scoping): routerAdd callbacks are invoked from Go in a fresh
// scope, so helpers are inlined per handler instead of relying on top-level
// declarations (see 32_issue_relations.pb.js).

routerAdd("POST", "/api/projectbase/issues/bulk-update", (e) => {
    const EDITABLE_FIELDS = {
        status: 1,
        priority: 1,
        cycle: 1,
        milestone: 1,
        estimate: 1,
        start_date: 1,
        due_date: 1,
        labels: 1,
        order: 1
    }
    const STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]
    const PRIORITIES = ["urgent", "high", "medium", "low", "none"]
    const isRecordId = (value) => typeof value === "string" && /^[a-zA-Z0-9]{10,20}$/.test(value)

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

        if (!Array.isArray(body.ids) || body.ids.length === 0) {
            return e.json(400, { error: "Missing or empty 'ids' array" })
        }
        if (body.ids.length > 500) {
            return e.json(400, { error: "'ids' must contain at most 500 records" })
        }
        if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
            return e.json(400, { error: "'data' must be an object of field updates" })
        }

        const updates = {}
        let customFieldUpdates = null
        for (const key of Object.keys(body.data)) {
            if (EDITABLE_FIELDS[key]) {
                updates[key] = body.data[key]
            } else if (key === "custom_fields") {
                customFieldUpdates = body.data[key]
            } else {
                return e.json(400, { error: `Field '${key}' is not allowed in bulk updates` })
            }
        }
        if (Object.keys(updates).length === 0 && customFieldUpdates === null) {
            return e.json(400, { error: "No editable fields provided in 'data'" })
        }

        // Field-level validation (mirrors the drawer + importer constraints)
        if (updates.status !== undefined && !STATUSES.includes(updates.status)) {
            return e.json(400, { error: "Invalid 'status' value" })
        }
        if (updates.priority !== undefined && !PRIORITIES.includes(updates.priority)) {
            return e.json(400, { error: "Invalid 'priority' value" })
        }
        if (updates.cycle !== undefined && updates.cycle !== null && updates.cycle !== "") {
            if (!isRecordId(updates.cycle)) {
                return e.json(400, { error: "Invalid 'cycle' id" })
            }
            try {
                e.app.findRecordById("cycles", updates.cycle)
            } catch (cErr) {
                return e.json(400, { error: "Cycle not found" })
            }
        }
        if (updates.milestone !== undefined && updates.milestone !== null && updates.milestone !== "") {
            if (!isRecordId(updates.milestone)) {
                return e.json(400, { error: "Invalid 'milestone' id" })
            }
            try {
                e.app.findRecordById("milestones", updates.milestone)
            } catch (mErr) {
                return e.json(400, { error: "Milestone not found" })
            }
        }
        if (updates.estimate !== undefined) {
            const n = Number(updates.estimate)
            if (!Number.isFinite(n) || n < 0 || n > 9999) {
                return e.json(400, { error: "Invalid 'estimate' value" })
            }
            updates.estimate = n
        }
        if (updates.start_date !== undefined && updates.start_date !== null && updates.start_date !== "") {
            if (typeof updates.start_date !== "string" || isNaN(Date.parse(updates.start_date))) {
                return e.json(400, { error: "Invalid 'start_date' value" })
            }
        }
        if (updates.due_date !== undefined && updates.due_date !== null && updates.due_date !== "") {
            if (typeof updates.due_date !== "string" || isNaN(Date.parse(updates.due_date))) {
                return e.json(400, { error: "Invalid 'due_date' value" })
            }
        }
        if (updates.labels !== undefined) {
            if (!Array.isArray(updates.labels)) {
                return e.json(400, { error: "'labels' must be an array" })
            }
            for (const l of updates.labels) {
                if (typeof l !== "string" || l.length === 0 || l.length > 64) {
                    return e.json(400, { error: "'labels' entries must be non-empty strings up to 64 chars" })
                }
            }
        }
        if (customFieldUpdates !== null) {
            if (typeof customFieldUpdates !== "object" || customFieldUpdates === null || Array.isArray(customFieldUpdates)) {
                return e.json(400, { error: "'custom_fields' must be an object of field value updates" })
            }
            for (const cfk of Object.keys(customFieldUpdates)) {
                if (!cfk || cfk.length > 64) {
                    return e.json(400, { error: "Invalid custom field key" })
                }
            }
        }

        let updated = 0
        let missing = 0
        for (const id of body.ids) {
            if (!isRecordId(id)) {
                missing++
                continue
            }
            let rec
            try {
                rec = e.app.findRecordById("issues", id)
            } catch (rErr) {
                missing++
                continue
            }
            for (const [k, v] of Object.entries(updates)) rec.set(k, v)
            if (customFieldUpdates !== null) {
                // Merge a partial object into the existing custom_fields JSON so
                // unrelated custom values are preserved. A key explicitly set to
                // null removes that single key.
                let existing = rec.get("custom_fields")
                if (Array.isArray(existing) && existing.length && typeof existing[0] === "number") {
                    existing = String.fromCharCode.apply(null, existing)
                }
                if (typeof existing === "string") { try { existing = JSON.parse(existing) } catch (err) { existing = {} } }
                if (!existing || typeof existing !== "object" || Array.isArray(existing)) existing = {}
                const merged = Object.assign({}, existing)
                for (const cfk of Object.keys(customFieldUpdates)) {
                    const cfv = customFieldUpdates[cfk]
                    if (cfv === null || cfv === undefined || cfv === "") {
                        delete merged[cfk]
                    } else {
                        merged[cfk] = cfv
                    }
                }
                rec.set("custom_fields", merged)
            }
            e.app.save(rec)
            updated++
        }

        return e.json(200, { updated: updated, missing: missing, total: body.ids.length })
    } catch (err) {
        console.log(">>> [ProjectBase] bulk-update error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})

routerAdd("POST", "/api/projectbase/issues/bulk-delete", (e) => {
    const isRecordId = (value) => typeof value === "string" && /^[a-zA-Z0-9]{10,20}$/.test(value)

    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        // Mirror the issues deleteRule: only admin/manager may delete. A
        // superuser has no `role` field (see 15_signup_security.pb.js) and is
        // always allowed.
        const isSuperuser = e.auth.collection && e.auth.collection().name === "_superusers"
        const role = e.auth.get("role")
        if (!isSuperuser && role !== "admin" && role !== "manager") {
            return e.forbiddenError("Insufficient role: admin or manager required")
        }

        let body
        try {
            body = e.requestInfo().body || {}
        } catch (bErr) {
            return e.json(400, { error: "Invalid JSON body" })
        }

        if (!Array.isArray(body.ids) || body.ids.length === 0) {
            return e.json(400, { error: "Missing or empty 'ids' array" })
        }
        if (body.ids.length > 500) {
            return e.json(400, { error: "'ids' must contain at most 500 records" })
        }

        let deleted = 0
        let missing = 0
        for (const id of body.ids) {
            if (!isRecordId(id)) {
                missing++
                continue
            }
            let rec
            try {
                rec = e.app.findRecordById("issues", id)
            } catch (rErr) {
                missing++
                continue
            }
            e.app.delete(rec)
            deleted++
        }

        return e.json(200, { deleted: deleted, missing: missing, total: body.ids.length })
    } catch (err) {
        console.log(">>> [ProjectBase] bulk-delete error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})
