// ProjectBase migration 43 — Autonomous Multi-Agent Incident Response, Live Debugging War-Room & Root-Cause Post-Mortem Engine (Milestone 10 / Epic 31).
//
// Introduces structured incident management, collaborative live debugging event timelines, hypothesis testing & falsification,
// mitigation action tracking, and automated 5-Whys post-mortem generation for autonomous AI agent fleets:
//   - incidents:
//       - `title`                 — Incident summary title
//       - `slug`                  — Unique slug identifier (e.g. "inc-2026-08-28-01")
//       - `summary`               — Initial triage description
//       - `project_id`            — Scoped project ID
//       - `severity`              — p0_critical | p1_high | p2_medium | p3_low
//       - `status`                — declared | triage | investigating | mitigated | resolved | postmortem_published
//       - `incident_commander`    — Assigned commander agent or user
//       - `lead_investigator`     — Assigned technical lead investigator
//       - `source`                — ci_pipeline | sentry_error | runtime_probe | user_report | agent_eval | manual
//       - `impact_scope`          — Affected service or blast radius description
//       - `service_name`          — Target component or service name
//       - `started_at`            — Incident onset timestamp
//       - `detected_at`           — Alert detection timestamp
//       - `mitigated_at`          — Mitigation timestamp
//       - `resolved_at`           — Resolution timestamp
//       - `mcp_session_id`        — Active agent session in war-room
//       - `sandbox_id`            — Optional reproduction dev sandbox ID
//       - `tags_json`             — Tags JSON array
//       - `metadata_json`         — Arbitrary contextual metadata JSON
//       - `postmortem_id`         — Associated post-mortem record ID
//   - incident_events:
//       - `incident_id`           — Reference to incidents collection
//       - `event_type`            — status_change | hypothesis_tested | mitigation_executed | metric_anomaly | log_entry | agent_action | communication
//       - `author`                — Agent name or user
//       - `author_type`           — agent | human | system | ci
//       - `title`                 — Event headline
//       - `content`               — Detailed event narrative or log body
//       - `payload_json`          — Structured diagnostic payload
//       - `severity`              — info | warning | error | critical
//       - `timestamp`             — ISO timestamp
//   - incident_hypotheses:
//       - `incident_id`           — Reference to incidents collection
//       - `proposed_by`           — Agent or user proposing hypothesis
//       - `hypothesis`            — Diagnostic hypothesis statement
//       - `rationale`             — Supporting clues or context
//       - `status`                — proposed | investigating | confirmed | falsified | inconclusive
//       - `test_plan`             — Probe or verification steps
//       - `evidence`              — Resulting findings and observations
//       - `confidence_score`      — Float confidence 0.0 - 1.0
//       - `tested_by`             — Agent that verified or falsified
//       - `tested_at`             — Timestamp when tested
//       - `artifact_url`          — Link or path to log/trace/sandbox artifact
//   - incident_mitigations:
//       - `incident_id`           — Reference to incidents collection
//       - `title`                 — Mitigation action name
//       - `description`           — Implementation details
//       - `action_type`           — rollback | feature_flag | config_patch | traffic_shedding | sandbox_isolation | code_fix
//       - `status`                — planned | in_progress | applied | verified | rolled_back | failed
//       - `executed_by`           — Agent or user executing mitigation
//       - `executed_at`           — Execution timestamp
//       - `verification_method`   — How mitigation effectiveness was checked
//       - `verification_result`   — Outcome / verification observations
//       - `rollback_plan`         — Safe rollback instructions if mitigation fails
//   - incident_postmortems:
//       - `incident_id`           — Reference to incidents collection
//       - `title`                 — Post-mortem document title
//       - `slug`                  — Unique post-mortem slug
//       - `status`                — draft | review | published | archived
//       - `executive_summary`     — High-level leadership overview
//       - `root_cause_analysis`   — 5 Whys & technical root-cause breakdown
//       - `contributing_factors_json` — JSON array of contributing factors
//       - `impact_metrics_json`   — JSON object with impact metrics (downtime, affected users, error peak)
//       - `timeline_summary`      — Reconstructed chronological narrative
//       - `detection_gap`         — Why monitoring didn't catch earlier
//       - `action_items_json`     — Preventative tasks JSON array [ { task_id, title, owner, priority, status } ]
//       - `lessons_learned`       — Key systemic takeaways
//       - `author`                — Lead author agent/user
//       - `published_at`          — Publication timestamp

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

    // 1. incidents
    ensureCollection("incidents", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("title", { required: true }),
        text("slug"),
        text("summary"),
        text("project_id"),
        select("severity", ["p0_critical", "p1_high", "p2_medium", "p3_low"]),
        select("status", ["declared", "triage", "investigating", "mitigated", "resolved", "postmortem_published"]),
        text("incident_commander"),
        text("lead_investigator"),
        select("source", ["ci_pipeline", "sentry_error", "runtime_probe", "user_report", "agent_eval", "manual"]),
        text("impact_scope"),
        text("service_name"),
        text("started_at"),
        text("detected_at"),
        text("mitigated_at"),
        text("resolved_at"),
        text("mcp_session_id"),
        text("sandbox_id"),
        json("tags_json"),
        json("metadata_json"),
        text("postmortem_id")
    ])

    // 2. incident_events
    ensureCollection("incident_events", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("incident_id", { required: true }),
        select("event_type", ["status_change", "hypothesis_tested", "mitigation_executed", "metric_anomaly", "log_entry", "agent_action", "communication"]),
        text("author"),
        select("author_type", ["agent", "human", "system", "ci"]),
        text("title", { required: true }),
        text("content"),
        json("payload_json"),
        select("severity", ["info", "warning", "error", "critical"]),
        text("timestamp")
    ])

    // 3. incident_hypotheses
    ensureCollection("incident_hypotheses", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("incident_id", { required: true }),
        text("proposed_by"),
        text("hypothesis", { required: true }),
        text("rationale"),
        select("status", ["proposed", "investigating", "confirmed", "falsified", "inconclusive"]),
        text("test_plan"),
        text("evidence"),
        number("confidence_score"),
        text("tested_by"),
        text("tested_at"),
        text("artifact_url")
    ])

    // 4. incident_mitigations
    ensureCollection("incident_mitigations", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("incident_id", { required: true }),
        text("title", { required: true }),
        text("description"),
        select("action_type", ["rollback", "feature_flag", "config_patch", "traffic_shedding", "sandbox_isolation", "code_fix"]),
        select("status", ["planned", "in_progress", "applied", "verified", "rolled_back", "failed"]),
        text("executed_by"),
        text("executed_at"),
        text("verification_method"),
        text("verification_result"),
        text("rollback_plan")
    ])

    // 5. incident_postmortems
    ensureCollection("incident_postmortems", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("incident_id", { required: true }),
        text("title", { required: true }),
        text("slug"),
        select("status", ["draft", "review", "published", "archived"]),
        text("executive_summary"),
        text("root_cause_analysis"),
        json("contributing_factors_json"),
        json("impact_metrics_json"),
        text("timeline_summary"),
        text("detection_gap"),
        json("action_items_json"),
        text("lessons_learned"),
        text("author"),
        text("published_at")
    ])
}, (app) => {
    // Reversible rollback
    const drop = (name) => {
        try {
            const col = app.findCollectionByNameOrId(name)
            if (col) app.delete(col)
        } catch (e) {}
    }
    drop("incident_postmortems")
    drop("incident_mitigations")
    drop("incident_hypotheses")
    drop("incident_events")
    drop("incidents")
})
