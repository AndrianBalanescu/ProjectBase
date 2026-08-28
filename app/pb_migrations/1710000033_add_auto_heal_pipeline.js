// ProjectBase migration 33 — Autonomous AI Agent Auto-Healing & Self-Remediation Workflow Pipeline (Epic 22).
//
// Adds collections for Agent Self-Healing, Auto-Remediation Incidents & Diagnostic Health Checks:
//   1. auto_heal_policies: Active self-healing triggers, action strategies, thresholds & cool-downs.
//   2. auto_heal_incidents: Incident lifecycle records, error logs, root cause traces & remediation history.
//   3. auto_heal_health_checks: Fleet diagnostics, heartbeat telemetry, crash rates & health scores.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

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
            fields.forEach(f => col.fields.add(f))
            app.save(col)
        } else {
            let changed = false
            fields.forEach(f => {
                if (!hasField(col, f.name)) {
                    col.fields.add(f)
                    changed = true
                }
            })
            if (changed) {
                app.save(col)
            }
        }
        return col
    }

    // 1. auto_heal_policies collection
    ensureCollection("auto_heal_policies", "", "", [
        text("name", { required: true, max: 200 }),
        text("slug", { max: 100 }),
        text("trigger_type", { required: true, max: 100 }), // crash_loop, lease_timeout, stuck_task, error_rate_spike, token_overflow, validation_failure
        text("action_strategy", { required: true, max: 100 }), // restart_agent, release_lease, reassign_task, revert_git_worktree, retry_subtask, escalate_to_human, quarantine_agent
        text("severity", { max: 50 }), // low, medium, high, critical
        number("max_retries", { min: 0, max: 20 }),
        number("cool_down_seconds", { min: 0, max: 86400 }),
        bool("is_active"),
        text("description", { max: 1000 }),
        json("parameters"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 2. auto_heal_incidents collection
    ensureCollection("auto_heal_incidents", "", "", [
        text("incident_code", { max: 50 }),
        text("agent", { max: 100 }),
        text("issue", { max: 100 }),
        text("trigger_type", { max: 100 }),
        text("severity", { max: 50 }), // low, medium, high, critical
        text("status", { max: 50 }), // detected, remediating, resolved, escalated, quarantined
        text("error_message", { max: 2000 }),
        text("stack_trace", { max: 5000 }),
        text("root_cause", { max: 1000 }),
        text("remediation_action", { max: 100 }),
        json("execution_log"),
        text("recovered_at", { max: 50 }),
        text("resolved_by", { max: 100 }),
        number("duration_ms", { min: 0 }),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 3. auto_heal_health_checks collection
    ensureCollection("auto_heal_health_checks", "", "", [
        text("agent", { required: true, max: 100 }),
        text("health_score", { max: 50 }), // healthy, degraded, unhealthy, crashed
        text("lease_status", { max: 50 }), // free, active, expired, stuck
        number("error_count", { min: 0 }),
        number("crash_count", { min: 0 }),
        text("last_heartbeat", { max: 50 }),
        json("diagnostics"),
        auto("created", true, false),
        auto("updated", true, true),
    ])
}, (app) => {
    try {
        const pCol = app.findCollectionByNameOrId("auto_heal_policies")
        if (pCol) app.delete(pCol)
    } catch (err) {}
    try {
        const iCol = app.findCollectionByNameOrId("auto_heal_incidents")
        if (iCol) app.delete(iCol)
    } catch (err) {}
    try {
        const hCol = app.findCollectionByNameOrId("auto_heal_health_checks")
        if (hCol) app.delete(hCol)
    } catch (err) {}
})
