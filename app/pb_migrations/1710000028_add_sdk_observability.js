// ProjectBase migration 28 — OpenAPI Agent SDK Generation, Interactive Documentation & Webhook Observability.
//
// Adds collections for Observability Alerts, Telemetry Tracking & Metrics (Epic 17):
//   1. observability_alert_configs: Alert threshold configurations (error rates, p95 latency, alert channels).
//   2. observability_alert_events: Recorded alert trigger history and delivery status.
//   3. sdk_generation_logs: Audit logs of client SDK code generation requests.

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
            if (changed) app.save(col)
        }
        return col
    }

    // 1. observability_alert_configs
    ensureCollection("observability_alert_configs", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true, max: 200 }),
        text("metric_name", { required: true, max: 100 }), // error_rate_pct, p95_latency_ms, failure_count
        text("comparison_operator", { required: true, max: 10 }), // gt, gte, lt, lte, eq
        number("threshold_value", { required: true }),
        text("alert_channel", { max: 200 }), // webhook URL, email, or agent channel
        text("channel_type", { max: 50 }), // webhook, agent, slack, discord
        bool("is_active"),
        number("cooldown_minutes", { min: 1, max: 1440 }),
        text("last_triggered_at", { max: 50 }),
        text("created_by", { max: 100 }),
        auto("created", true, false),
        auto("updated", true, true)
    ])

    // 2. observability_alert_events
    ensureCollection("observability_alert_events", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("config_id", { required: true, max: 50 }),
        text("metric_name", { required: true, max: 100 }),
        number("current_value"),
        number("threshold_value"),
        text("status", { required: true, max: 50 }), // triggered, resolved, silenced
        text("message", { max: 1000 }),
        text("channel_type", { max: 50 }),
        text("channel_target", { max: 200 }),
        text("delivery_status", { max: 50 }), // sent, failed, simulated
        json("context_data"),
        auto("created", true, false),
        auto("updated", true, true)
    ])

    // 3. sdk_generation_logs
    ensureCollection("sdk_generation_logs", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("language", { required: true, max: 50 }),
        text("target_type", { max: 50 }), // endpoint, tool, full_client
        text("target_name", { max: 200 }),
        text("requested_by", { max: 100 }),
        number("code_bytes"),
        auto("created", true, false),
        auto("updated", true, true)
    ])
}, (app) => {
    // Revert logic
    const dropCollection = (name) => {
        try {
            const col = app.findCollectionByNameOrId(name)
            if (col) app.delete(col)
        } catch (err) {}
    }
    dropCollection("sdk_generation_logs")
    dropCollection("observability_alert_events")
    dropCollection("observability_alert_configs")
})
