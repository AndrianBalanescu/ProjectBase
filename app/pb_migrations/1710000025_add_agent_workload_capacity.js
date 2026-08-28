// ProjectBase migration 25 — Autonomous Agent Autoscaling, Dynamic Workload Orchestration & Self-Healing Engine.
//
// Adds collections for Workload Orchestration (Epic 14):
//   1. agent_workloads: dynamic persona pools, active allocations, max capacity slots, autoscaling rules.
//   2. workflow_heals: records automated self-healing repairs, expired lock releases, broken DAG reconciliations.
//   3. agent_reservations: worker slot capacity leases with TTL auto-expiration.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const collectionIdOf = (name) => {
        try { return app.findCollectionByNameOrId(name).id } catch (err) { return null }
    }
    const projectsId = collectionIdOf("projects")

    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }

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
        let modified = false
        for (const field of fields) {
            if (!hasField(col, field.name)) {
                col.fields.add(field)
                modified = true
            }
        }
        if (!col.id || modified) {
            app.save(col)
        }
        return col
    }

    // 1. agent_workloads collection
    try {
        ensureCollection("agent_workloads", "@request.auth.id != ''", "@request.auth.id != ''", [
            text("persona", { required: true }),
            relation("project", projectsId, { required: false }),
            number("allocated_slots"),
            number("max_slots"),
            number("active_workers"),
            number("target_saturation_pct"),
            text("autoscale_policy"), // 'dynamic', 'fixed', 'conservative', 'aggressive'
            json("metadata"),
            auto("created", true, false),
            auto("updated", true, true)
        ])
    } catch (e) {
        console.log(">>> [Migration 25] agent_workloads collection note: " + e)
    }

    // 2. workflow_heals collection
    try {
        ensureCollection("workflow_heals", "@request.auth.id != ''", "@request.auth.id != ''", [
            text("trigger", { required: true }), // 'manual', 'autonomous_cron', 'api', 'fastmcp'
            relation("project", projectsId, { required: false }),
            number("anomalies_detected"),
            number("repairs_applied"),
            json("repaired_entities"),
            text("diagnosis"),
            text("status"), // 'completed', 'partial', 'failed'
            auto("created", true, false),
            auto("updated", true, true)
        ])
    } catch (e) {
        console.log(">>> [Migration 25] workflow_heals collection note: " + e)
    }

    // 3. agent_reservations collection
    try {
        ensureCollection("agent_reservations", "@request.auth.id != ''", "@request.auth.id != ''", [
            text("reservation_id", { required: true }),
            text("persona", { required: true }),
            text("worker_id", { required: true }),
            relation("project", projectsId, { required: false }),
            number("slots"),
            text("expires_at"),
            text("status"), // 'active', 'released', 'expired'
            json("metadata"),
            auto("created", true, false),
            auto("updated", true, true)
        ])
    } catch (e) {
        console.log(">>> [Migration 25] agent_reservations collection note: " + e)
    }
})
