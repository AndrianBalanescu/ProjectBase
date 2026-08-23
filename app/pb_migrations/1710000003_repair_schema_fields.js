// Repairs installs created between the durable-migrations refactor and the
// fields.add() fix: on PocketBase 0.39 the Collection constructor silently
// dropped field class instances, producing collections with only `id`.
// This migration backfills every expected field idempotently.
migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const date = (name) => new DateField({ name })
    const number = (name) => new NumberField({ name })
    const bool = (name) => new BoolField({ name })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values, maxSelect: 1 })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const file = (name, maxSelect, thumbs = []) => new FileField({ name, maxSelect, maxSize: 10485760, thumbs })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const collectionIdOf = (name) => {
        try { return app.findCollectionByNameOrId(name).id } catch (err) { return null }
    }

    const defs = {
        projects: (id) => [
            text("name", { required: true }), text("identifier", { required: true }),
            text("description"), text("icon"), text("color"), text("repo_url"),
            text("lead"), bool("is_favorite"), json("settings"),
            auto("created", true, false), auto("updated", true, true),
        ],
        cycles: (id) => [
            relation("project", id.projects, { required: true, cascadeDelete: true }), text("name", { required: true }),
            text("description"), date("start_date"), date("end_date"), select("status", ["upcoming", "active", "completed"]),
            auto("created", true, false), auto("updated", true, true),
        ],
        milestones: (id) => [
            relation("project", id.projects, { required: true, cascadeDelete: true }), text("name", { required: true }),
            text("description"), date("target_date"), select("status", ["planned", "in_progress", "achieved"]),
            auto("created", true, false), auto("updated", true, true),
        ],
        labels: (id) => [
            relation("project", id.projects), text("name", { required: true }), text("color", { required: true }), text("description"),
            auto("created", true, false), auto("updated", true, true),
        ],
        issues: (id) => [
            relation("project", id.projects, { required: true, cascadeDelete: true }), text("identifier", { required: true }), number("issue_number"),
            text("title", { required: true }), text("description"), select("status", ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]),
            select("priority", ["urgent", "high", "medium", "low", "none"]), text("assignee"), date("due_date"), number("estimate"),
            json("labels"), json("subtasks"), file("attachments", 10, ["100x100", "400x300"]),
            relation("cycle", id.cycles), relation("milestone", id.milestones), number("order"),
            auto("created", true, false), auto("updated", true, true),
        ],
        comments: (id) => [
            relation("issue", id.issues, { required: true, cascadeDelete: true }), relation("author", id.users),
            text("body", { required: true }),
            auto("created", true, false), auto("updated", true, true),
        ],
        activity: (id) => [
            relation("project", id.projects, { cascadeDelete: true }), relation("issue", id.issues, { cascadeDelete: true }),
            text("actor", { required: true }), select("actor_type", ["user", "agent", "system"]), text("action", { required: true }), json("details"),
            auto("created", true, false), auto("updated", true, true),
        ],
    }

    const ids = {}
    for (const name of Object.keys(defs)) {
        ids[name] = collectionIdOf(name)
    }
    ids.users = collectionIdOf("users")

    let repaired = []
    for (const [name, buildFields] of Object.entries(defs)) {
        let collection
        try { collection = app.findCollectionByNameOrId(name) } catch (err) { continue }

                const hasField = (col, fieldName) => {
            // getByName returns falsy (does not throw) when the field is absent.
            const found = col.fields.getByName(fieldName)
            return !!(found && found.name)
        }

        let added = false
        for (const field of buildFields(ids)) {
            if (!hasField(collection, field.name)) {
                collection.fields.add(field)
                added = true
            }
        }
        if (added) {
            app.save(collection)
            repaired.push(name)
        }
    }

    if (repaired.length > 0) {
        console.log(">>> [Migration] Repaired schema fields for: " + repaired.join(", "))
    }
}, (app) => {
    // Data-preserving downgrade: removed fields are an explicit operator action.
})
