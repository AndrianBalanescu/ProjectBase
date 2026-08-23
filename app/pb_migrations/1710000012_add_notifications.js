// ProjectBase migration 12 — in-app notification inbox.
//
// Adds a `notifications` collection that powers the header bell / inbox:
//   - `recipient` — the users record that owns the notification (cascade delete)
//   - `issue`     — the work item the notification is about (optional)
//   - `comment`   — the comment that triggered it (optional)
//   - `actor`     — display name of the actor that caused it
//   - `actor_type` — user | agent | system
//   - `type`      — assigned | mentioned | commented | status | priority | system
//   - `message`   — rendered human-readable text (kept short; UI truncates)
//   - `read`      — read/unread flag for the unread badge
//
// Rules:
//   - A user can only ever see / list / update / delete their OWN notifications.
//   - createRule is null: rows are created exclusively by pb_hooks (app-level
//     saves bypass API rules), so strangers cannot forge notifications.
//
// Purely additive + idempotent: safe on existing and fresh installs.
migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const bool = (name) => new BoolField({ name })
    const select = (name, values) => new SelectField({ name, values, maxSelect: 1 })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const collectionIdOf = (name) => {
        try { return app.findCollectionByNameOrId(name).id } catch (err) { return null }
    }

    const usersId = collectionIdOf("users")
    const issuesId = collectionIdOf("issues")
    const commentsId = collectionIdOf("comments")
    if (!usersId || !issuesId || !commentsId) {
        console.log(">>> [Migration] Skipped notifications collection (missing users/issues/comments)")
        return
    }

    const name = "notifications"
    let collection = null
    try { collection = app.findCollectionByNameOrId(name) } catch (err) {}
    if (!collection) {
        collection = new Collection({
            name,
            type: "base",
            listRule: "recipient = @request.auth.id",
            viewRule: "recipient = @request.auth.id",
            createRule: null,
            updateRule: "recipient = @request.auth.id",
            deleteRule: "recipient = @request.auth.id || @request.auth.role = 'admin'",
        })
    }

    // PocketBase 0.39 Collection constructor drops field instances; attach via fields.add().
    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }
    let added = false
    for (const field of [
        relation("recipient", usersId, { required: true, cascadeDelete: true }),
        relation("issue", issuesId, { cascadeDelete: true }),
        relation("comment", commentsId, { cascadeDelete: true }),
        text("actor"),
        select("actor_type", ["user", "agent", "system"]),
        select("type", ["assigned", "mentioned", "commented", "status", "priority", "system"]),
        text("message", { required: true }),
        bool("read"),
        auto("created", true, false),
        auto("updated", true, true),
    ]) {
        if (!hasField(collection, field.name)) {
            collection.fields.add(field)
            added = true
        }
    }
    if (!collection || added) {
        app.save(collection)
    }
    console.log(">>> [Migration] notifications collection ensured")
})
