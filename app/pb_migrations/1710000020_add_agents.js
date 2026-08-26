// ProjectBase migration 20 — first-class agents collection.
//
// Goal (docs/research/AGENTIC_NATIVE_PLAN.md, ticket PB-4394): make agents show up
// on the board as teammates the way Multica does, while staying MIT / single-binary.
//
// Adds an `agents` collection that models each discovered AI agent as a first-class
// board member:
//   - `name`      — display name, e.g. "flomaster" (unique, required)
//   - `provider`   — model/provider the agent uses, e.g. openai-api
//   - `runtime`    — runtime/CLI the agent runs under, e.g. flomaster | claude | codex
//   - `source_dir` — local config dir the agent was detected from, e.g. ~/.flomaster
//   - `avatar`     — short avatar token (emoji or color) for the board chip
//   - `status`     — idle | working | blocked | offline (live board state)
//   - `enabled`    — whether this agent accepts assignments (default true)
//   - `discovered` — true if auto-detected from the machine, false if user-created
//   - `owner`      — the users record that owns/registered this agent
//   - auto created/updated
//
// Rules:
//   - A user can only see/list their own agents unless admin/manager.
//   - createRule null: rows are created by pb_hooks (scanner) or admin, not by
//     arbitrary API callers.
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

    let collection = null
    try { collection = app.findCollectionByNameOrId("agents") } catch (err) {}

    if (!collection) {
        // PocketBase 0.39: createRule kept null so only app-level (hook) saves
        // can create agent records. owner-relative rules gate reads/updates.
        collection = new Collection({
            name: "agents",
            type: "base",
            listRule: "owner = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'manager'",
            viewRule: "owner = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'manager'",
            createRule: null,
            updateRule: "owner = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'manager'",
            deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'",
        })
    }

    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }
    let added = false
    for (const field of [
        text("name", { required: true, max: 64 }),
        text("provider"),
        text("runtime"),
        text("source_dir"),
        text("avatar", { max: 8 }),
        select("status", ["offline", "active", "working", "blocked"]),
        bool("enabled"),
        bool("discovered"),
        ...(usersId ? [relation("owner", usersId, { cascadeDelete: true })] : []),
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
    console.log(">>> [Migration] agents collection ensured")
})
