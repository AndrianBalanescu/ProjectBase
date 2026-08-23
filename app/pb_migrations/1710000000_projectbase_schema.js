// ProjectBase schema v1.
// Durable schema belongs in pb_migrations, not onBootstrap hooks.
migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const date = (name) => new DateField({ name })
    const number = (name) => new NumberField({ name })
    const bool = (name) => new BoolField({ name })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values, maxSelect: 1 })
    const multiSelect = (name, values) => new SelectField({ name, values, maxSelect: values.length })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const file = (name, maxSelect, thumbs = []) => new FileField({ name, maxSelect, maxSize: 10485760, thumbs })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const ensure = (name, type, fields, rules = {}) => {
        let collection
        let existed = true
        try { collection = app.findCollectionByNameOrId(name) } catch (err) {}
        if (!collection) {
            existed = false
            collection = new Collection({
                name,
                type,
                listRule: rules.listRule ?? null,
                viewRule: rules.viewRule ?? null,
                createRule: rules.createRule ?? null,
                updateRule: rules.updateRule ?? null,
                deleteRule: rules.deleteRule ?? null,
            })
        }
        // NOTE: the Collection constructor silently drops field class instances
        // on PocketBase 0.39 — fields must be attached via fields.add().
        // The backfill below also repairs installs created before this fix.
                const hasField = (col, fieldName) => {
            // getByName returns falsy (does not throw) when the field is absent.
            const found = col.fields.getByName(fieldName)
            return !!(found && found.name)
        }
        let added = false
        for (const field of fields) {
            if (!hasField(collection, field.name)) {
                collection.fields.add(field)
                added = true
            }
        }
        if (!existed || added) {
            app.save(collection)
        }
        return collection
    }

    const projects = ensure("projects", "base", [
        text("name", { required: true }), text("identifier", { required: true }),
        text("description"), text("icon"), text("color"), text("repo_url"),
        text("lead"), bool("is_favorite"), json("settings"),
        auto("created", true, false), auto("updated", true, true),
    ], { listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'" })

    const cycles = ensure("cycles", "base", [
        relation("project", projects.id, { required: true, cascadeDelete: true }), text("name", { required: true }),
        text("description"), date("start_date"), date("end_date"), select("status", ["upcoming", "active", "completed"]),
        auto("created", true, false), auto("updated", true, true),
    ], { listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'" })

    const milestones = ensure("milestones", "base", [
        relation("project", projects.id, { required: true, cascadeDelete: true }), text("name", { required: true }),
        text("description"), date("target_date"), select("status", ["planned", "in_progress", "achieved"]),
        auto("created", true, false), auto("updated", true, true),
    ])

    const labels = ensure("labels", "base", [
        relation("project", projects.id), text("name", { required: true }), text("color", { required: true }), text("description"),
        auto("created", true, false), auto("updated", true, true),
    ])

    const issues = ensure("issues", "base", [
        relation("project", projects.id, { required: true, cascadeDelete: true }), text("identifier", { required: true }), number("issue_number"),
        text("title", { required: true }), text("description"), select("status", ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]),
        select("priority", ["urgent", "high", "medium", "low", "none"]), text("assignee"), date("due_date"), number("estimate"),
        json("labels"), json("subtasks"), file("attachments", 10, ["100x100", "400x300"]),
        relation("cycle", cycles.id), relation("milestone", milestones.id), number("order"),
        auto("created", true, false), auto("updated", true, true),
    ], { listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'" })

    ensure("comments", "base", [
        relation("issue", issues.id, { required: true, cascadeDelete: true }), text("author", { required: true }),
        select("author_type", ["user", "agent", "system"]), text("content", { required: true }), file("attachments", 5, ["100x100"]),
        auto("created", true, false), auto("updated", true, true),
    ], { listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'" })

    ensure("activity", "base", [
        relation("project", projects.id, { cascadeDelete: true }), relation("issue", issues.id, { cascadeDelete: true }),
        text("actor", { required: true }), select("actor_type", ["user", "agent", "system"]), text("action", { required: true }), json("details"),
        auto("created", true, false), auto("updated", true, true),
    ])

    ensure("users", "auth", [
        text("name"), select("role", ["admin", "manager", "member", "agent"]), file("avatar", 1, ["100x100"]),
    ], { listRule: "@request.auth.role = 'admin'", viewRule: "id = @request.auth.id || @request.auth.role = 'admin'", updateRule: "id = @request.auth.id || @request.auth.role = 'admin'", deleteRule: "@request.auth.role = 'admin'" })
}, (app) => {
    // Data-preserving downgrade. Destructive removal is an explicit operator action.
})
