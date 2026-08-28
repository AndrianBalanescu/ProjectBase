// ProjectBase migration 22 — Task Leases, Multi-Agent Collaboration, Webhooks & Telemetry.
//
// Adds collections for real-time multi-agent coordination (Epic 9):
//   1. task_leases: Prevents agent collisions via lease acquisition, TTL expiration, and heartbeat renewal.
//   2. webhooks: Outbound event dispatch for external agent orchestrators (Hermes, Windmill, Flomaster, CI).
//   3. agent_telemetry: Real-time agent activity logs, tool calls, reasoning traces, and collision alerts.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const bool = (name) => new BoolField({ name })
    const number = (name) => new NumberField({ name })
    const json = (name) => new JSONField({ name })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const collectionIdOf = (name) => {
        try { return app.findCollectionByNameOrId(name).id } catch (err) { return null }
    }
    const issuesId = collectionIdOf("issues")
    const projectsId = collectionIdOf("projects")

    const ensureCollection = (name, listRule, viewRule, fields) => {
        let col = null
        try { col = app.findCollectionByNameOrId(name) } catch (err) {}
        if (!col) {
            col = new Collection({
                name,
                type: "base",
                listRule,
                viewRule,
                createRule: null,
                updateRule: null,
                deleteRule: null,
            })
        }
        const hasField = (c, fieldName) => {
            const found = c.fields.getByName(fieldName)
            return !!(found && found.name)
        }
        let modified = false
        for (const field of fields) {
            if (!hasField(col, field.name)) {
                col.fields.add(field)
                modified = true
            }
        }
        if (!hasField(col, "created")) {
            col.fields.add(auto("created", true, false))
            modified = true
        }
        if (!hasField(col, "updated")) {
            col.fields.add(auto("updated", true, true))
            modified = true
        }
        app.save(col)
        return col
    }

    // 1. Task Leases
    ensureCollection("task_leases", "@request.auth.id != ''", "@request.auth.id != ''", [
        relation("issue", issuesId, { required: true, cascadeDelete: true }),
        text("agent_name", { required: true }),
        text("agent_id"),
        text("reason"),
        text("expires_at", { required: true }),
        text("acquired_at", { required: true }),
        text("heartbeat"),
        json("metadata")
    ])

    // 2. Webhooks
    ensureCollection("webhooks", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        text("url", { required: true }),
        json("events"),
        text("secret"),
        relation("project", projectsId, { cascadeDelete: true }),
        bool("enabled"),
        text("last_triggered_at"),
        number("last_status"),
        number("failure_count")
    ])

    // 3. Agent Telemetry
    ensureCollection("agent_telemetry", "@request.auth.id != ''", "@request.auth.id != ''", [
        relation("issue", issuesId, { cascadeDelete: true }),
        text("agent_name", { required: true }),
        text("event_type", { required: true }),
        number("step"),
        text("summary"),
        json("payload"),
        text("timestamp")
    ])

    // Ensure helpful composite indexes
    try {
        app.db().newQuery("CREATE INDEX IF NOT EXISTS `idx_task_leases_issue` ON `task_leases` (`issue`, `expires_at`)").execute()
        app.db().newQuery("CREATE INDEX IF NOT EXISTS `idx_telemetry_issue` ON `agent_telemetry` (`issue`, `created`)").execute()
        app.db().newQuery("CREATE INDEX IF NOT EXISTS `idx_telemetry_agent` ON `agent_telemetry` (`agent_name`, `created`)").execute()
        app.db().newQuery("CREATE INDEX IF NOT EXISTS `idx_webhooks_enabled` ON `webhooks` (`enabled`)").execute()
    } catch (e) {
        console.log(">>> [Migration 22] Index creation note: " + e)
    }

    console.log(">>> [Migration 22] task_leases, webhooks, and agent_telemetry collections ready")
}, (app) => {
    for (const name of ["task_leases", "webhooks", "agent_telemetry"]) {
        try {
            const col = app.findCollectionByNameOrId(name)
            if (col) { app.delete(col) }
        } catch (e) {}
    }
})
