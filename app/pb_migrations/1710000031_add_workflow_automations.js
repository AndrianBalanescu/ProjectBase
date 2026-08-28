// ProjectBase migration 31 — Native End-to-End Workflow Automations & AI Agent Trigger Pipelines.
//
// Adds collections for Workflow Automations, Execution Runs & Trigger Audit Trails (Epic 20):
//   1. workflow_rules: User and agent-defined event triggers, condition filters, and DAG action pipelines.
//   2. workflow_runs: Immutable trace records of workflow executions, step durations, and payload results.
//   3. workflow_triggers_audit: Event evaluation audit log capturing matched criteria and fired rules.

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
        return app.findCollectionByNameOrId(name)
    }

    // 1. workflow_rules
    ensureCollection("workflow_rules", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        text("description"),
        text("project"), // optional project id or blank for workspace-wide
        text("event_type", { required: true }), // issue.created, issue.status_changed, issue.priority_changed, issue.assigned, issue.label_added, cycle.started, cycle.completed, manual
        json("trigger_conditions"), // { status_to: "done", priority: "urgent", labels: ["bug"] }
        json("action_pipeline"), // [ { id: "step_1", action: "dispatch_agent", params: {...}, on_success: ["step_2"] }, ... ]
        bool("is_active"),
        text("execution_mode"), // sequential, dag_parallel, fire_and_forget
        number("concurrency_limit"),
        number("timeout_seconds"),
        text("created_by"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 2. workflow_runs
    ensureCollection("workflow_runs", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("rule_id", { required: true }),
        text("rule_name"),
        text("trigger_event"),
        text("entity_id"),
        text("entity_type"), // issue, cycle, project, manual
        text("status"), // pending, running, completed, failed, cancelled
        json("trigger_payload"),
        json("step_results"), // [ { step_id: "step_1", action: "dispatch_agent", status: "success", duration_ms: 120, output: {...} } ]
        text("started_at"),
        text("completed_at"),
        number("duration_ms"),
        text("error_message"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 3. workflow_triggers_audit
    ensureCollection("workflow_triggers_audit", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("event_id"),
        text("event_type"),
        text("rule_id"),
        bool("matched"),
        json("evaluated_conditions"),
        text("run_id"),
        text("timestamp"),
        auto("created", true, false),
        auto("updated", true, true),
    ])
})
