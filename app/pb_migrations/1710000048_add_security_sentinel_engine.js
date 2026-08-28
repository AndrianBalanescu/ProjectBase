// ProjectBase migration 48 — Autonomous Agent Security Red-Team, Secret Leak Sentinel, AST Vulnerability Probing & Automated Remediation Hardening Engine (Milestone 14 / Epic 35 / v1.34.0).
//
// Introduces multi-tier security scan pipelines, AST vulnerability detection, real-time entropy & secret leak
// sentinels, automated security patch remediation, and fleet-wide security posture governance:

migrate((app) => {
    function text(name, opts = {}) {
        return new Field({
            name,
            type: "text",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function bool(name, opts = {}) {
        return new Field({
            name,
            type: "bool",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function number(name, opts = {}) {
        return new Field({
            name,
            type: "number",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function select(name, values, opts = {}) {
        return new Field({
            name,
            type: "select",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false,
            values: values || [],
            maxSelect: opts.maxSelect || 1
        })
    }

    function json(name, opts = {}) {
        return new Field({
            name,
            type: "json",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function ensureCollection(name, listRule = "", viewRule = "", fields = []) {
        let col
        try {
            col = app.findCollectionByNameOrId(name)
        } catch (_) {
            col = new Collection({
                name,
                type: "base",
                listRule: listRule !== undefined ? listRule : "",
                viewRule: viewRule !== undefined ? viewRule : "",
                createRule: "",
                updateRule: "",
                deleteRule: ""
            })
            fields.forEach(f => col.fields.add(f))
            try {
                col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }))
                col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))
            } catch (_) {}
            app.save(col)
            return col
        }

        let updated = false
        if (listRule !== undefined && col.listRule !== listRule) {
            col.listRule = listRule
            updated = true
        }
        if (viewRule !== undefined && col.viewRule !== viewRule) {
            col.viewRule = viewRule
            updated = true
        }
        fields.forEach(f => {
            if (!col.fields.getByName(f.name)) {
                col.fields.add(f)
                updated = true
            }
        })
        try {
            if (!col.fields.getByName("created")) {
                col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }))
                updated = true
            }
            if (!col.fields.getByName("updated")) {
                col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))
                updated = true
            }
        } catch (_) {}
        if (updated) {
            app.save(col)
        }
        return col
    }

    // 1. security_scans
    ensureCollection("security_scans", "", "", [
        text("name", { required: true }),
        text("project_id"),
        select("scan_type", ["ast_vulnerability", "secret_leak", "prompt_injection", "dependency_cve", "rbac_permissions", "full_audit"]),
        select("status", ["pending", "running", "passed", "flagged", "failed", "cancelled"]),
        select("target_type", ["codebase", "session_trajectory", "issue_description", "environment_blob", "mcp_tool_schema", "raw_content"]),
        text("target_ref"),
        number("risk_score"),
        number("critical_count"),
        number("high_count"),
        number("medium_count"),
        number("low_count"),
        json("findings_json"),
        json("remediation_plan_json"),
        text("scanned_by"),
        number("duration_ms"),
        json("metadata_json")
    ])

    // 2. secret_findings
    ensureCollection("secret_findings", "", "", [
        text("scan_id"),
        text("project_id"),
        select("secret_type", ["anthropic_api_key", "openai_api_key", "github_pat", "aws_secret_key", "slack_token", "database_uri", "jwt_token", "private_key", "generic_high_entropy"]),
        select("severity", ["critical", "high", "medium", "low"]),
        text("location_ref"),
        text("masked_preview"),
        text("raw_fingerprint"),
        number("entropy_score"),
        bool("is_quarantined"),
        text("quarantined_at"),
        select("remediation_status", ["detected", "quarantined", "rotated", "dismissed", "whitelisted"]),
        json("metadata_json")
    ])

    // 3. security_policies
    ensureCollection("security_policies", "", "", [
        text("name", { required: true }),
        text("project_id"),
        bool("enforce_zero_critical"),
        number("max_allowed_cvss"),
        bool("auto_quarantine_leaks"),
        bool("block_unverified_mcp_tools"),
        bool("require_sandbox_isolation"),
        json("rules_json"),
        bool("is_active"),
        json("metadata_json")
    ])

    // 4. security_remediations
    ensureCollection("security_remediations", "", "", [
        text("scan_id"),
        text("finding_ref"),
        select("remediation_type", ["patch_diff", "secret_quarantine", "config_hardening", "dependency_bump"]),
        select("status", ["proposed", "applied", "verified", "reverted", "failed"]),
        text("diff_content"),
        text("applied_by"),
        text("applied_at"),
        text("verified_at"),
        json("metadata_json")
    ])
})
