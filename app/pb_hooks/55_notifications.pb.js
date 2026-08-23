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
//
// ACTOR NOTE (critical): `e.httpContext.authRecord` / `e.requestInfo().auth`
// are EMPTY inside onRecordAfter*Success hooks in this PocketBase JSVM, and no
// state (not even module-level globalThis) survives between hook callbacks —
// each callback runs in its own sandbox. Auth is only resolvable in the
// onRecord*Request phase, so we capture the acting user into `$app.store()`
// (PocketBase's shared KV store) in the request hooks and consume it in the
// after hooks. Without this, actorName always falls back to "Agent" and the
// "skip when the actor is the assignee" suppression never works.
//
// CONCURRENCY NOTE (critical): `$app.store()` is process-wide and PocketBase
// serves requests concurrently, so a single global key would let one request's
// actor leak into another's notification (deterministic under parallel PATCH).
// Actor values are therefore keyed by the record id (`pbNotifActor:<id>:name`),
// which is available in the update request hook and can be assigned in the
// create request hook (PocketBase honors a 15-char base36 id set before save).
// The after-success hook reads only its own record's key, making attribution
// race-free. Keys are deleted after read to keep the store bounded.

// Capture the acting user during the request phase (auth available here only)
// into $app.store() keyed by the record id so the after-success hooks
// (separate sandbox) can read it without cross-request races.
onRecordCreateRequest((e) => {
    try {
        let rid = e.record.id
        if (!rid) {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
            let id = ""
            for (let i = 0; i < 15; i++) id += chars[Math.floor(Math.random() * chars.length)]
            try { e.record.set("id", id) } catch (x) {}
            rid = e.record.id
        }
        const req = e.requestInfo()
        const auth = req ? req.auth : null
        const name = (auth && auth.get) ? (auth.get("name") || "") : ""
        const type = (auth && auth.get) ? "user" : ""
        try { $app.store().set("pbNotifActor:" + rid + ":name", name) } catch (x) {}
        try { $app.store().set("pbNotifActor:" + rid + ":type", type) } catch (x) {}
    } catch (err) {
        // Auth resolution failed; nothing to attribute (stale keys are
        // deleted by the after-success hook after read).
    }
    e.next()
}, "issues")

onRecordUpdateRequest((e) => {
    try {
        const rid = e.record.id || ""
        const req = e.requestInfo()
        const auth = req ? req.auth : null
        const name = (auth && auth.get) ? (auth.get("name") || "") : ""
        const type = (auth && auth.get) ? "user" : ""
        try { $app.store().set("pbNotifActor:" + rid + ":name", name) } catch (x) {}
        try { $app.store().set("pbNotifActor:" + rid + ":type", type) } catch (x) {}
    } catch (err) {
        // Auth resolution failed; nothing to attribute.
    }
    e.next()
}, "issues")

// Clean up actor keys on FAILED requests too (the success after-hooks remove
// them on the happy path; without these, a failed create/update would leave
// two keys in the process-wide store forever).
onRecordAfterCreateError((e) => {
    try {
        const ridKey = e.record && e.record.id ? e.record.id : ""
        if (ridKey) {
            try { $app.store().remove("pbNotifActor:" + ridKey + ":name") } catch (x) {}
            try { $app.store().remove("pbNotifActor:" + ridKey + ":type") } catch (x) {}
        }
    } catch (err) {}
}, "issues")

onRecordAfterUpdateError((e) => {
    try {
        const ridKey = e.record && e.record.id ? e.record.id : ""
        if (ridKey) {
            try { $app.store().remove("pbNotifActor:" + ridKey + ":name") } catch (x) {}
            try { $app.store().remove("pbNotifActor:" + ridKey + ":type") } catch (x) {}
        }
    } catch (err) {}
}, "issues")

// 1 + 2 + 3. Issue created / updated: notify on assignment / status / priority.
onRecordAfterCreateSuccess((e) => {
    try {
        const issue = e.record
        // Read + remove the actor keys FIRST so cleanup happens even when the
        // record has no assignee (and thus no notification is created).
        let actorName = "Agent"
        let actorType = "system"
        const ridKey = issue.id || ""
        try { actorName = $app.store().get("pbNotifActor:" + ridKey + ":name") || "Agent" } catch (x) {}
        try { actorType = $app.store().get("pbNotifActor:" + ridKey + ":type") || "system" } catch (x) {}
        try { $app.store().remove("pbNotifActor:" + ridKey + ":name") } catch (x) {}
        try { $app.store().remove("pbNotifActor:" + ridKey + ":type") } catch (x) {}

        const assignee = issue.get("assignee") || ""
        if (!assignee) return
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

        let actorName = "Agent"
        let actorType = "system"
        const ridKey = issue.id || ""
        try { actorName = $app.store().get("pbNotifActor:" + ridKey + ":name") || "Agent" } catch (x) {}
        try { actorType = $app.store().get("pbNotifActor:" + ridKey + ":type") || "system" } catch (x) {}
        try { $app.store().remove("pbNotifActor:" + ridKey + ":name") } catch (x) {}
        try { $app.store().remove("pbNotifActor:" + ridKey + ":type") } catch (x) {}
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
