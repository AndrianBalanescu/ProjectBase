// ProjectBase migration 40 — Agent Fleet Budget & Cost Attribution, Token Quota Enforcement & Financial Governance Hub (Milestone 7 / Epic 28).
//
// Adds multi-agent cost allocation, budget policy enforcement, pre-flight token quota reservations,
// and real-time transaction ledger tracking across models, providers, and personas:
//   - budget_policies:
//       - `name`                — Policy title (e.g. "Global Daily Limit", "Coder Persona Cap")
//       - `scope_type`          — global | project | persona | session | tenant
//       - `scope_id`            — Target ID (project ID, persona name, session ID, tenant ID)
//       - `max_budget_usd`      — Hard cap in USD (e.g. 50.00)
//       - `max_tokens`          — Token cap (e.g. 10000000)
//       - `period`              — hourly | daily | weekly | monthly | per_cycle | total
//       - `soft_limit_pct`      — Threshold % (default 80) for warning alert
//       - `hard_limit_action`   — block | throttle | notify_only | require_human_gate
//       - `current_spend_usd`   — Aggregate spend in current window
//       - `current_tokens`      — Aggregate tokens in current window
//       - `status`              — active | paused | exceeded | overridden
//       - `last_reset_at`       — ISO timestamp of last window reset
//   - token_quotas:
//       - `scope_type`          — session | agent | project
//       - `scope_id`            — Target ID
//       - `allocated_tokens`    — Total token capacity
//       - `consumed_prompt`     — Input prompt tokens
//       - `consumed_completion` — Output generated tokens
//       - `consumed_cached`     — Prompt cache read tokens
//       - `consumed_reasoning`  — Thinking / reasoning tokens
//       - `reserved_tokens`     — Currently reserved in-flight tokens
//       - `total_cost_usd`      — Total cost accumulated
//       - `circuit_breaker`     — Boolean flag: true if hard limit reached
//   - cost_ledger_entries:
//       - `session_id`          — Associated session ID (optional)
//       - `issue_id`            — Associated issue ID (optional)
//       - `project_id`          — Associated project ID (optional)
//       - `persona`             — Agent persona (coder, reviewer, architect, security, etc.)
//       - `model`               — LLM Model string (claude-3-5-sonnet, gpt-4o, deepseek-r1, etc.)
//       - `provider`            — Model provider (anthropic, openai, deepseek, omniroute, local)
//       - `prompt_tokens`       — Prompt tokens count
//       - `completion_tokens`   — Completion tokens count
//       - `cached_tokens`       — Cached tokens count
//       - `reasoning_tokens`    — Reasoning tokens count
//       - `total_tokens`        — Combined token count
//       - `cost_usd`            — Cost in USD
//       - `latency_ms`          — Execution time in milliseconds
//       - `request_kind`        — inference | tool_call | embedding | eval | debate
//       - `metadata`            — JSON execution context
//   - budget_overrides:
//       - `policy_id`           — Target budget policy ID
//       - `granted_by`          — Administrator or system authority
//       - `additional_budget`   — Extra USD granted
//       - `additional_tokens`   — Extra tokens granted
//       - `expires_at`          — Expiration timestamp
//       - `reason`              — Justification rationale
//       - `status`              — active | expired | revoked

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const hasField = (col, name) => {
        try {
            return col.fields.getByName(name) !== null
        } catch (e) {
            return false
        }
    }

    const ensureCollection = (name, listRule, viewRule, fields) => {
        let col = null
        try {
            col = app.findCollectionByNameOrId(name)
        } catch (e) {
            col = new Collection({
                name: name,
                type: "base",
                listRule: listRule,
                viewRule: viewRule,
                createRule: "@request.auth.id != ''",
                updateRule: "@request.auth.id != ''",
                deleteRule: "@request.auth.id != ''",
            })
            fields.forEach(f => col.fields.add(f))
            col.fields.add(auto("created", true, false))
            col.fields.add(auto("updated", true, true))
            app.save(col)
            return col
        }

        let updated = false
        fields.forEach(f => {
            if (!hasField(col, f.name)) {
                col.fields.add(f)
                updated = true
            }
        })
        if (updated) {
            app.save(col)
        }
        return col
    }

    // 1. budget_policies
    ensureCollection("budget_policies", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        select("scope_type", ["global", "project", "persona", "session", "tenant"]),
        text("scope_id"),
        number("max_budget_usd"),
        number("max_tokens"),
        select("period", ["hourly", "daily", "weekly", "monthly", "per_cycle", "total"]),
        number("soft_limit_pct"),
        select("hard_limit_action", ["block", "throttle", "notify_only", "require_human_gate"]),
        number("current_spend_usd"),
        number("current_tokens"),
        select("status", ["active", "paused", "exceeded", "overridden"]),
        text("last_reset_at")
    ])

    // 2. token_quotas
    ensureCollection("token_quotas", "@request.auth.id != ''", "@request.auth.id != ''", [
        select("scope_type", ["session", "agent", "project", "global"]),
        text("scope_id"),
        number("allocated_tokens"),
        number("consumed_prompt"),
        number("consumed_completion"),
        number("consumed_cached"),
        number("consumed_reasoning"),
        number("reserved_tokens"),
        number("total_cost_usd"),
        bool("circuit_breaker")
    ])

    // 3. cost_ledger_entries
    ensureCollection("cost_ledger_entries", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("session_id"),
        text("issue_id"),
        text("project_id"),
        text("persona"),
        text("model"),
        text("provider"),
        number("prompt_tokens"),
        number("completion_tokens"),
        number("cached_tokens"),
        number("reasoning_tokens"),
        number("total_tokens"),
        number("cost_usd"),
        number("latency_ms"),
        text("request_kind"),
        json("metadata")
    ])

    // 4. budget_overrides
    ensureCollection("budget_overrides", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("policy_id", { required: true }),
        text("granted_by"),
        number("additional_budget"),
        number("additional_tokens"),
        text("expires_at"),
        text("reason"),
        select("status", ["active", "expired", "revoked"])
    ])
})
