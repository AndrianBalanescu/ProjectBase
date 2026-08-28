// ProjectBase migration 44 — Autonomous Agent Knowledge Graph, Architectural Memory Index & Codebase Semantic Retrieval Engine (Milestone 11 / Epic 32).
//
// Introduces structured architectural memory, codebase symbol indexing, dependency/governance relation graphs,
// automated invariant compliance validation, and architectural decision records (ADR) for multi-agent fleets:
//   - knowledge_nodes:
//       - `title`               — Node title or symbol name
//       - `slug`                — Unique slug identifier
//       - `kind`                — invariant | adr | convention | subsystem | symbol | runbook | antipattern
//       - `summary`             — High-level summary
//       - `content_markdown`    — Comprehensive markdown specification / rationale / code
//       - `project_id`          — Scoped project ID
//       - `file_path`           — Associated source code path
//       - `symbol_name`         — Specific symbol or function identifier
//       - `status`              — active | proposed | accepted | deprecated | superseded | violated
//       - `confidence_score`    — Float confidence score 0.0 - 1.0
//       - `author_agent`        — Declaring agent or user
//       - `mcp_session_id`      — Associated agent session ID
//       - `tags_json`           — Tags JSON array
//       - `metadata_json`       — Extensible metadata dictionary
//   - knowledge_relations:
//       - `source_node_id`      — Originating knowledge node ID
//       - `target_node_id`      — Target knowledge node ID
//       - `relation_type`       — depends_on | implements | modifies | violates | supersedes | verifies | governs | related_to
//       - `weight`              — Relation strength weight (default 1.0)
//       - `description`         — Contextual explanation
//       - `metadata_json`       — Extensible metadata dictionary
//   - architectural_invariants:
//       - `node_id`             — Linked knowledge node ID
//       - `rule_name`           — Human-readable rule name
//       - `rule_type`           — path_pattern | dependency_constraint | naming_convention | security_policy | test_coverage_gate
//       - `pattern_expression`  — Matching regex, glob pattern, or rule criteria
//       - `severity`            — p0_blocking | p1_warning | p2_advisory
//       - `enforcement_action`  — block_merge | warn_agent | log_audit
//       - `is_active`           — Boolean toggle for active evaluation
//       - `metadata_json`       — Extensible metadata dictionary
//   - invariant_verifications:
//       - `project_id`          — Scoped project ID
//       - `mcp_session_id`      — Evaluated agent session ID
//       - `agent_name`          — Triggering agent or engineer
//       - `target_files_json`   — Array of touched or inspected file paths
//       - `diff_summary`        — Summary of proposed changes or code diff
//       - `verdict`             — passed | violations_detected | warnings_only | skipped
//       - `violations_json`     — Detailed violations array
//       - `passed_rules_json`   — Array of passed invariant checks
//       - `execution_ms`        — Evaluation duration in milliseconds
//       - `metadata_json`       — Extensible metadata dictionary

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

    // 1. knowledge_nodes
    ensureCollection("knowledge_nodes", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("title", { required: true }),
        text("slug"),
        select("kind", ["invariant", "adr", "convention", "subsystem", "symbol", "runbook", "antipattern"]),
        text("summary"),
        text("content_markdown"),
        text("project_id"),
        text("file_path"),
        text("symbol_name"),
        select("status", ["active", "proposed", "accepted", "deprecated", "superseded", "violated"]),
        number("confidence_score"),
        text("author_agent"),
        text("mcp_session_id"),
        json("tags_json"),
        json("metadata_json")
    ])

    // 2. knowledge_relations
    ensureCollection("knowledge_relations", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("source_node_id", { required: true }),
        text("target_node_id", { required: true }),
        select("relation_type", ["depends_on", "implements", "modifies", "violates", "supersedes", "verifies", "governs", "related_to"]),
        number("weight"),
        text("description"),
        json("metadata_json")
    ])

    // 3. architectural_invariants
    ensureCollection("architectural_invariants", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("node_id"),
        text("rule_name", { required: true }),
        select("rule_type", ["path_pattern", "dependency_constraint", "naming_convention", "security_policy", "test_coverage_gate"]),
        text("pattern_expression", { required: true }),
        select("severity", ["p0_blocking", "p1_warning", "p2_advisory"]),
        select("enforcement_action", ["block_merge", "warn_agent", "log_audit"]),
        bool("is_active"),
        json("metadata_json")
    ])

    // 4. invariant_verifications
    ensureCollection("invariant_verifications", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("project_id"),
        text("mcp_session_id"),
        text("agent_name"),
        json("target_files_json"),
        text("diff_summary"),
        select("verdict", ["passed", "violations_detected", "warnings_only", "skipped"]),
        json("violations_json"),
        json("passed_rules_json"),
        number("execution_ms"),
        json("metadata_json")
    ])
}, (app) => {
    try {
        const v = app.findCollectionByNameOrId("invariant_verifications");
        if (v) app.delete(v);
    } catch (_) {}
    try {
        const i = app.findCollectionByNameOrId("architectural_invariants");
        if (i) app.delete(i);
    } catch (_) {}
    try {
        const r = app.findCollectionByNameOrId("knowledge_relations");
        if (r) app.delete(r);
    } catch (_) {}
    try {
        const n = app.findCollectionByNameOrId("knowledge_nodes");
        if (n) app.delete(n);
    } catch (_) {}
})
