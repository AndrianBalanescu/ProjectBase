// ProjectBase migration 27 — Webhook Automation Engine & Outbound Webhook Security Gateway.
//
// Adds collections for Webhook Management, Delivery Telemetry & DLQ (Epic 16):
//   1. webhook_endpoints: Outbound webhook endpoints, platforms (slack/discord/telegram/agent/custom), HMAC secrets, event filters.
//   2. webhook_deliveries: Real-time delivery logs, latencies, signatures, response codes.
//   3. webhook_dlq: Dead-Letter Queue with retry backoff, exponential jitter, and failure diagnostics.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
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

    // 1. webhook_endpoints
    ensureCollection("webhook_endpoints", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        text("url", { required: true }),
        text("platform", { required: true }), // slack, discord, telegram, agent, custom
        json("events"),                       // e.g. ["issue.*", "agent.dispatched", "*"]
        text("secret", { required: false }),  // HMAC-SHA256 signing secret
        text("active", { required: false }),  // "true" / "false"
        json("retry_policy"),                 // { max_retries, backoff_base_ms, max_backoff_ms, jitter }
        json("headers"),                      // Custom HTTP headers
        text("template", { required: false }),
        json("stats"),                        // { total_dispatched, successful, failed, dlq_count, last_status, last_delivery_at }
        auto("created", true, false),
        auto("updated", true, true)
    ])

    // 2. webhook_deliveries
    ensureCollection("webhook_deliveries", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("delivery_id", { required: true }),
        text("endpoint_id", { required: false }),
        text("endpoint_name", { required: false }),
        text("platform", { required: false }),
        text("event", { required: true }),
        text("status", { required: true }), // delivered, failed, dead_letter, filtered_out
        text("signature", { required: false }),
        number("timestamp", { required: false }),
        number("status_code", { required: false }),
        number("latency_ms", { required: false }),
        json("payload"),
        text("error_message", { required: false }),
        number("retry_count", { required: false }),
        auto("created", true, false),
        auto("updated", true, true)
    ])

    // 3. webhook_dlq
    ensureCollection("webhook_dlq", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("delivery_id", { required: true }),
        text("endpoint_id", { required: true }),
        text("endpoint_name", { required: false }),
        text("platform", { required: false }),
        text("event", { required: true }),
        json("payload"),
        text("error_message", { required: false }),
        number("retry_count", { required: false }),
        number("max_retries", { required: false }),
        text("next_retry_at", { required: false }),
        text("status", { required: true }), // pending, retrying, exhausted, resolved
        auto("created", true, false),
        auto("updated", true, true)
    ])
}, (app) => {
    try {
        const c1 = app.findCollectionByNameOrId("webhook_endpoints")
        if (c1) app.delete(c1)
        const c2 = app.findCollectionByNameOrId("webhook_deliveries")
        if (c2) app.delete(c2)
        const c3 = app.findCollectionByNameOrId("webhook_dlq")
        if (c3) app.delete(c3)
    } catch (err) {}
})
