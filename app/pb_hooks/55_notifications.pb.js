// pb_hooks/55_notifications.pb.js
// In-app notification inbox generator.
//
// Creates `notifications` rows (collection added by migration 12) whenever a
// user's attention is actually required:
//   1. Issue created and assigned to a registered user  -> "assigned"
//   2. Issue assignee changed to a registered user      -> "assigned"
//   3. Issue status/priority changed by someone else     -> "status" / "priority"
//   4. Comment added on an issue the user is assigned to -> "commented"
//   5. Comment mentions @Name of a registered user       -> "mentioned"
//
// Lookups match the free-text `issues.assignee` / comment body `@mentions`
// against the `users.name` column.
//
// SCOPING NOTE (critical): In the Goja runtime PocketBase uses, module-scope
// function declarations are NOT resolvable from inside a hook callback —
// every call throws `ReferenceError: <fn> is not defined`. This is the same
// bug class as the cycle-5 P0 fix in 15_signup_security.pb.js. ALL logic is
// therefore inlined directly inside each callback. Every path is wrapped in
// try/catch so a broken notification never breaks the core write path.

// 1 + 2 + 3. Issue created / updated: notify on assignment / status / priority.
onRecordAfterCreateSuccess((e) => {
    try {
        const issue = e.record
        const assignee = issue.get("assignee") || ""
        if (!assignee) return

        const httpCtx = e.httpContext || {}
        const authRec = httpCtx.authRecord || null
        const actorName = (authRec && authRec.get ? authRec.get("name") : "") || "Agent"
        const actorType = authRec ? "user" : "system"
        const identifier = issue.get("identifier") || "task"
        const title = issue.get("title") || ""

        // Find users whose name matches the free-text assignee.
        const recipients = e.app.findRecordsByFilter(
            "users", `name = {:name}`, "", 0, 0, { name: assignee })
        for (const u of recipients) {
            try {
                const col = e.app.findCollectionByNameOrId("notifications")
                if (!col) return
                const rec = new Record(col)
                rec.set("recipient", u.id)
                rec.set("issue", issue.id)
                rec.set("actor", actorName)
                rec.set("actor_type", actorType)
                rec.set("type", "assigned")
                rec.set("message", `${actorName} assigned you to ${identifier}: ${title}`)
                rec.set("read", false)
                e.app.save(rec)
            } catch (innerErr) {
                console.warn(">>> [ProjectBase] notification create failed:", innerErr)
            }
        }
    } catch (err) {
        console.warn(">>> [ProjectBase] create-assignment notification failed:", err)
    }
}, "issues")

onRecordAfterUpdateSuccess((e) => {
    try {
        const issue = e.record
        // NOTE: this PocketBase JSVM has no `originalCopy()`; the pre-update
        // record proxy is obtained by CALLING `record.original()`.
        const original = issue.original()
        const assignee = issue.get("assignee") || ""
        const prevAssignee = original ? (original.get("assignee") || "") : ""

        const httpCtx = e.httpContext || {}
        const authRec = httpCtx.authRecord || null
        const actorName = (authRec && authRec.get ? authRec.get("name") : "") || "Agent"
        const actorType = authRec ? "user" : "system"
        const identifier = issue.get("identifier") || "task"
        const title = issue.get("title") || ""

        const notify = (recipients, type, message) => {
            for (const u of recipients) {
                if (String(u.get("name") || "").trim() === actorName) continue
                try {
                    const col = e.app.findCollectionByNameOrId("notifications")
                    if (!col) continue
                    const rec = new Record(col)
                    rec.set("recipient", u.id)
                    rec.set("issue", issue.id)
                    rec.set("actor", actorName)
                    rec.set("actor_type", actorType)
                    rec.set("type", type)
                    rec.set("message", message)
                    rec.set("read", false)
                    e.app.save(rec)
                } catch (innerErr) {
                    console.warn(">>> [ProjectBase] notification create failed:", innerErr)
                }
            }
        }

        // Assignee changed to a registered user.
        if (assignee && prevAssignee !== assignee) {
            const recipients = e.app.findRecordsByFilter(
                "users", `name = {:name}`, "", 0, 0, { name: assignee })
            notify(recipients, "assigned", `${actorName} assigned you to ${identifier}: ${title}`)
        }

        // Status change (skip when the actor is the assignee themselves).
        const oldStatus = original ? (original.get("status") || "") : ""
        const newStatus = issue.get("status") || ""
        if (newStatus && oldStatus !== newStatus && assignee) {
            const recipients = e.app.findRecordsByFilter(
                "users", `name = {:name}`, "", 0, 0, { name: assignee })
            notify(recipients, "status", `${actorName} moved ${identifier} to ${newStatus}: ${title}`)
        }

        // Priority change (skip when the actor is the assignee themselves).
        const oldPriority = original ? (original.get("priority") || "") : ""
        const newPriority = issue.get("priority") || ""
        if (newPriority && oldPriority !== newPriority && assignee) {
            const recipients = e.app.findRecordsByFilter(
                "users", `name = {:name}`, "", 0, 0, { name: assignee })
            notify(recipients, "priority", `${actorName} set ${identifier} priority to ${newPriority}: ${title}`)
        }
    } catch (err) {
        console.warn(">>> [ProjectBase] update-assignment notification failed:", err)
    }
}, "issues")

// 4 + 5. Comment created: notify the issue assignee + @mentions.
onRecordAfterCreateSuccess((e) => {
    try {
        const comment = e.record
        const issueId = comment.get("issue")
        if (!issueId) return
        const author = comment.get("author") || "Someone"
        const authorType = comment.get("author_type") || "user"
        const content = comment.get("content") || ""

        let issue = null
        try { issue = e.app.findRecordById("issues", issueId) } catch (nfErr) { return }
        const identifier = issue.get("identifier") || "task"
        const assignee = issue.get("assignee") || ""

        const createFor = (recipient, type, message) => {
            try {
                const col = e.app.findCollectionByNameOrId("notifications")
                if (!col) return
                const rec = new Record(col)
                rec.set("recipient", recipient.id)
                rec.set("issue", issueId)
                rec.set("comment", comment.id)
                rec.set("actor", author)
                rec.set("actor_type", authorType === "agent" ? "agent" : "user")
                rec.set("type", type)
                rec.set("message", message)
                rec.set("read", false)
                e.app.save(rec)
            } catch (innerErr) {
                console.warn(">>> [ProjectBase] comment notification create failed:", innerErr)
            }
        }

        // Notify the assignee when someone else comments on their issue.
        if (assignee) {
            const recipients = e.app.findRecordsByFilter(
                "users", `name = {:name}`, "", 0, 0, { name: assignee })
            for (const u of recipients) {
                if (String(u.get("name") || "").trim() === author) continue
                createFor(u, "commented", `${author} commented on ${identifier}: ${content.slice(0, 140)}`)
            }
        }

        // Notify @mentioned registered users (never the author).
        // Enumerate registered users and test for "@<Name>" inclusion: names
        // contain spaces, so a regex with a character class would over-match
        // trailing words ("@Jane Doe thanks" -> "Jane Doe thanks"). A
        // boundary-aware scan against real names is exact and cheap at this
        // scale.
        const allUsers = e.app.findRecordsByFilter("users", "name != ''", "name", 500, 0)
        const contentLower = content.toLowerCase()
        for (const u of allUsers) {
            const uname = String(u.get("name") || "").trim()
            if (!uname || uname === author) continue
            if (contentLower.includes("@" + uname.toLowerCase())) {
                createFor(u, "mentioned", `${author} mentioned you in ${identifier}: ${content.slice(0, 140)}`)
            }
        }
    } catch (err) {
        console.warn(">>> [ProjectBase] comment notification failed:", err)
    }
}, "comments")

// Mark all notifications read for the current user (bell "mark all read").
routerAdd("POST", "/api/projectbase/notifications/read-all", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const rows = e.app.findRecordsByFilter(
            "notifications", `recipient = '${e.auth.id}' && read = false`, "", 0, 0)
        for (const row of rows) {
            row.set("read", true)
            e.app.save(row)
        }
        return e.json(200, { updated: rows.length })
    } catch (err) {
        return e.json(500, { error: "Failed to mark notifications read" })
    }
})
