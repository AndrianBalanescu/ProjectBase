// pb_hooks/20_issue_hooks.pb.js
// Auto-assigns issue_number, identifier (e.g. PB-1), and logs activity

onRecordCreate((e) => {
    let projectId = e.record.get("project")
    if (projectId) {
        let project = e.app.findRecordById("projects", projectId)
        let prefix = (project.get("identifier") || "TASK").toUpperCase()

        if (!e.record.get("issue_number")) {
            let records = e.app.findRecordsByFilter("issues", `project = '${projectId}'`, "-issue_number", 1, 0)
            let nextNum = 1
            if (records && records.length > 0) {
                nextNum = (Number(records[0].get("issue_number")) || 0) + 1
            }
            e.record.set("issue_number", nextNum)
            e.record.set("identifier", `${prefix}-${nextNum}`)
        }
    }

    if (!e.record.get("order")) {
        e.record.set("order", Date.now())
    }
    if (!e.record.get("status")) {
        e.record.set("status", "backlog")
    }
    if (!e.record.get("priority")) {
        e.record.set("priority", "none")
    }
    if (!e.record.get("labels")) {
        e.record.set("labels", [])
    }
    // Labels parity with bulk-update (31_bulk_actions.pb.js): array of
    // non-empty strings up to 64 chars. Thrown OUTSIDE the non-fatal try/catch
    // so a 400 actually stops persistence (same pattern as onRecordUpdate below).
    // PB 0.39 jsvm: a json field read from the record can arrive as a raw JSON
    // string (the request value is coerced before persistence), so normalize
    // exactly like 32_issue_relations.pb.js does for the relations field.
    let labelsVal = e.record.get("labels")
    let labelsNormalized = false
    if (typeof labelsVal === "string") {
        try { labelsVal = JSON.parse(labelsVal); labelsNormalized = true } catch (err) { labelsVal = null }
    } else if (Array.isArray(labelsVal) && labelsVal.length > 0 && typeof labelsVal[0] === "number") {
        // PB 0.39 jsvm quirk: a json field can be surfaced to record hooks as an
        // array of UTF-8 char codes (e.g. [91,34,98,117,103,34,93] = '["bug"]').
        // Decode manually: Function.apply() is unreliable on Goja array proxies.
        let s = ""
        for (const c of labelsVal) { s += String.fromCharCode(c) }
        try { labelsVal = JSON.parse(s); labelsNormalized = true } catch (err) { labelsVal = null }
    }
    if (labelsVal !== undefined && labelsVal !== null) {
        if (!Array.isArray(labelsVal)) {
            throw new BadRequestError("labels must be an array")
        }
        for (const l of labelsVal) {
            if (typeof l !== "string" || l.length === 0 || l.length > 64) {
                throw new BadRequestError("labels entries must be non-empty strings up to 64 chars")
            }
        }
        if (labelsNormalized) {
            e.record.set("labels", labelsVal)
        }
    }
    if (!e.record.get("subtasks")) {
        e.record.set("subtasks", [])
    }
    e.next()
}, "issues")

// Activity audit logging — issue creation must be in the trail too.
// Runs after successful persist so the issue relation points at a real record.
onRecordAfterCreateSuccess((e) => {
    try {
        let activityCol = e.app.findCollectionByNameOrId("activity")
        if (activityCol) {
            let act = new Record(activityCol)
            act.set("project", e.record.get("project"))
            act.set("issue", e.record.id)
            act.set("actor", "Agent/User")
            act.set("actor_type", "system")
            act.set("action", "created")
            act.set("details", {
                status: e.record.get("status"),
                priority: e.record.get("priority"),
                title: e.record.get("title")
            })
            e.app.save(act)
        }
    } catch (err) {
        // Non-fatal activity log failure — issue creation must not break
        console.error(">>> Error logging issue-created activity:", err)
    }
    e.next()
}, "issues")

onRecordUpdate((e) => {
    // Labels parity with bulk-update (31_bulk_actions.pb.js): array of
    // non-empty strings up to 64 chars on every direct REST update. Thrown
    // OUTSIDE the non-fatal try/catch so a 400 actually stops persistence.
    // PB 0.39 jsvm: a json field read from the record can arrive as a raw JSON
    // string (the request value is coerced before persistence), so normalize
    // exactly like 32_issue_relations.pb.js does for the relations field.
    let labelsVal = e.record.get("labels")
    let labelsNormalized = false
    if (typeof labelsVal === "string") {
        try { labelsVal = JSON.parse(labelsVal); labelsNormalized = true } catch (err) { labelsVal = null }
    } else if (Array.isArray(labelsVal) && labelsVal.length > 0 && typeof labelsVal[0] === "number") {
        // PB 0.39 jsvm quirk: a json field can be surfaced to record hooks as an
        // array of UTF-8 char codes (e.g. [91,34,98,117,103,34,93] = '["bug"]').
        // Decode manually: Function.apply() is unreliable on Goja array proxies.
        let s = ""
        for (const c of labelsVal) { s += String.fromCharCode(c) }
        try { labelsVal = JSON.parse(s); labelsNormalized = true } catch (err) { labelsVal = null }
    }
    if (labelsVal !== undefined && labelsVal !== null) {
        if (!Array.isArray(labelsVal)) {
            throw new BadRequestError("labels must be an array")
        }
        for (const l of labelsVal) {
            if (typeof l !== "string" || l.length === 0 || l.length > 64) {
                throw new BadRequestError("labels entries must be non-empty strings up to 64 chars")
            }
        }
        if (labelsNormalized) {
            e.record.set("labels", labelsVal)
        }
    }

    try {
        // Activity audit logging
        let activityCol = e.app.findCollectionByNameOrId("activity")
        if (activityCol) {
            let act = new Record(activityCol)
            act.set("project", e.record.get("project"))
            act.set("issue", e.record.id)
            act.set("actor", "Agent/User")
            act.set("actor_type", "system")
            act.set("action", "updated")
            act.set("details", {
                status: e.record.get("status"),
                priority: e.record.get("priority"),
                title: e.record.get("title")
            })
            e.app.save(act)
        }
    } catch (err) {
        // Non-fatal activity log failure
    }
    e.next()
}, "issues")
