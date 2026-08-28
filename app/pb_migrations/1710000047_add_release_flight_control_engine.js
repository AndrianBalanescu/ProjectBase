// ProjectBase migration 47 — Autonomous Agent Release Flight Control, Deployment Canary Gates, Production Health Probes & Self-Healing Rollback Engine (Milestone 13 / Epic 34 / v1.33.0).
//
// Introduces multi-stage canary release pipelines, automated health probes, error-budget breach detection,
// automated instant rollbacks, and release flight control telemetry for multi-agent fleets:
//   - releases:
//       - `name`                  — Release title / descriptor (e.g. "v1.33.0 - Release Flight Control")
//       - `version`               — Semantic version identifier (e.g. "1.33.0")
//       - `project_id`            — Scoped project ID
//       - `status`                — draft | canary | promoted | rolled_back | failed | aborted
//       - `target_environment`    — staging | canary | production | edge
//       - `strategy`              — canary_percentage | blue_green | rolling | immediate
//       - `traffic_weight`        — Current traffic percentage allocated to canary (0 - 100)
//       - `commit_sha`            — Git commit SHA
//       - `branch`                — Branch name
//       - `artifacts_json`        — Build artifacts, docker digests, binary hashes
//       - `canary_config_json`    — Step duration, error rate threshold, p95 latency threshold, min requests
//       - `health_status`         — healthy | degraded | failing | unknown
//       - `rollback_target`       — Previous stable version or commit SHA
//       - `promoted_at`           — ISO timestamp of promotion
//       - `rolled_back_at`        — ISO timestamp of rollback
//       - `metadata_json`         — Extensible metadata dictionary
//   - deployment_stages:
//       - `release_id`            — Parent releases record ID
//       - `stage_name`            — Name (e.g. "canary_10pct", "canary_50pct", "full_promotion")
//       - `order`                 — Execution sequence order
//       - `status`                — pending | running | passed | failed | skipped | rolled_back
//       - `traffic_percentage`    — Traffic percent at this stage (0 - 100)
//       - `duration_seconds`      — Duration spent or target duration
//       - `started_at`            — ISO start timestamp
//       - `completed_at`          — ISO completion timestamp
//       - `metrics_snapshot_json` — Snapshot of error_rate, latency_p95, requests, cpu
//       - `verification_verdict`  — pass | warn | fail | pending
//       - `logs`                  — Execution and verification log text
//   - health_probes:
//       - `release_id`            — Parent releases record ID
//       - `probe_name`            — Descriptive probe identifier (e.g. "api_latency_p95", "5xx_error_rate")
//       - `probe_type`            — http_endpoint | metric_threshold | synthetic_canary | log_anomaly
//       - `target_url`            — Target URL or metric key
//       - `expected_status`       — Expected HTTP status code or comparison baseline
//       - `threshold_value`       — Maximum allowable threshold (e.g. 200 ms or 1.0% error)
//       - `actual_value`          — Current measured value
//       - `status`                — passing | degraded | failing | stale
//       - `consecutive_failures`  — Number of sequential probe failures
//       - `last_checked_at`       — ISO timestamp of last probe execution
//       - `check_history_json`    — JSON array of recent sample evaluations
//   - rollback_events:
//       - `release_id`            — Parent releases record ID
//       - `trigger_reason`        — automated_probe_failure | error_budget_breach | latency_spike | sceptic_veto | manual_operator_override
//       - `trigger_details_json`  — JSON object with trigger telemetry, failing probes, and threshold deltas
//       - `from_version`          — Version being rolled back
//       - `to_version`            — Safe fallback version restored
//       - `rollback_duration_ms`  — Time taken to divert 100% traffic back to stable baseline
//       - `restored_traffic_percentage` — Traffic percentage restored to stable target (typically 100)
//       - `recovery_status`       — in_progress | completed | failed
//       - `executed_by`           — Agent, operator, or automated watchdog identifier
//       - `post_rollback_health`  — healthy | degraded | unresolved

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

    // 1. releases
    ensureCollection("releases", "", "", [
        text("name", { required: true }),
        text("version", { required: true }),
        text("project_id"),
        select("status", ["draft", "canary", "promoted", "rolled_back", "failed", "aborted"]),
        select("target_environment", ["staging", "canary", "production", "edge"]),
        select("strategy", ["canary_percentage", "blue_green", "rolling", "immediate"]),
        number("traffic_weight"),
        text("commit_sha"),
        text("branch"),
        json("artifacts_json"),
        json("canary_config_json"),
        select("health_status", ["healthy", "degraded", "failing", "unknown"]),
        text("rollback_target"),
        text("promoted_at"),
        text("rolled_back_at"),
        json("metadata_json")
    ])

    // 2. deployment_stages
    ensureCollection("deployment_stages", "", "", [
        text("release_id", { required: true }),
        text("stage_name", { required: true }),
        number("order"),
        select("status", ["pending", "running", "passed", "failed", "skipped", "rolled_back"]),
        number("traffic_percentage"),
        number("duration_seconds"),
        text("started_at"),
        text("completed_at"),
        json("metrics_snapshot_json"),
        select("verification_verdict", ["pass", "warn", "fail", "pending"]),
        text("logs")
    ])

    // 3. health_probes
    ensureCollection("health_probes", "", "", [
        text("release_id", { required: true }),
        text("probe_name", { required: true }),
        select("probe_type", ["http_endpoint", "metric_threshold", "synthetic_canary", "log_anomaly"]),
        text("target_url"),
        number("expected_status"),
        number("threshold_value"),
        number("actual_value"),
        select("status", ["passing", "degraded", "failing", "stale"]),
        number("consecutive_failures"),
        text("last_checked_at"),
        json("check_history_json")
    ])

    // 4. rollback_events
    ensureCollection("rollback_events", "", "", [
        text("release_id", { required: true }),
        select("trigger_reason", ["automated_probe_failure", "error_budget_breach", "latency_spike", "sceptic_veto", "manual_operator_override"]),
        json("trigger_details_json"),
        text("from_version"),
        text("to_version"),
        number("rollback_duration_ms"),
        number("restored_traffic_percentage"),
        select("recovery_status", ["in_progress", "completed", "failed"]),
        text("executed_by"),
        select("post_rollback_health", ["healthy", "degraded", "unresolved"])
    ])
})
