// pb_hooks/20_issue_hooks.pb.js
// Auto-assigns issue_number, identifier (e.g. PB-1), and logs activity

onRecordCreate((e) => {
    try {
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
        if (!e.record.get("subtasks")) {
            e.record.set("subtasks", [])
        }
    } catch (err) {
        console.error(">>> Error in onRecordCreate(issues):", err)
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
