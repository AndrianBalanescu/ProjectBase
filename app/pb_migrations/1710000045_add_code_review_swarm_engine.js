// ProjectBase migration 45 — Autonomous Agent Multi-Persona Code Review Swarm, AST-Aware Critique & Patch Synthesis Engine (Milestone 12 / Epic 33 / v1.32.0).
//
// Introduces multi-persona automated code review swarms, line-anchored critique tracking,
// automated patch synthesis and application, and consensus merge gate evaluations:
//   - code_reviews:
//       - `title`                 — Review title or pull request summary
//       - `summary`               — High-level overview of the change
//       - `project_id`            — Scoped project ID
//       - `source_branch`         — Source branch or worktree identifier
//       - `target_branch`         — Target merge branch (default 'main')
//       - `diff_content`          — Full unified diff content to review
//       - `files_touched_json`    — Array of touched file paths
//       - `author_agent`          — Authoring agent or user
//       - `mcp_session_id`        — Ingested agent session ID
//       - `issue_id`              — Linked issue ID
//       - `sandbox_id`            — Linked ephemeral sandbox ID
//       - `status`                — pending | reviewing | changes_requested | approved | blocked | merged | rejected
//       - `merge_strategy`        — squash | rebase | merge | fast_forward
//       - `overall_score`         — Aggregated code quality score (0 - 100)
//       - `p0_count`              — Count of P0 Blocker critiques
//       - `p1_count`              — Count of P1 Warning critiques
//       - `p2_count`              — Count of P2 Suggestion critiques
//       - `p3_count`              — Count of P3 Nit critiques
//       - `verdict`               — pending | approved | changes_requested | blocked | overridden
//       - `override_reason`       — Human or lead agent override rationale
//       - `overridden_by`         — Overriding identity
//       - `metadata_json`         — Extensible metadata dictionary
//   - review_critiques:
//       - `review_id`             — Parent code_reviews record ID
//       - `persona`               — security_auditor | architecture_guardian | performance_specialist | simplicity_yagni | test_coverage_critic | style_conventions
//       - `reviewer_agent`        — Persona agent identifier
//       - `file_path`             — Targeted file path
//       - `line_start`            — Starting line number in diff
//       - `line_end`              — Ending line number in diff
//       - `severity`              — p0_blocker | p1_warning | p2_suggestion | p3_nit
//       - `title`                 — Critique concise heading
//       - `critique_markdown`     — Detailed rationale and explanation
//       - `suggested_diff`        — Concrete code replacement suggestion
//       - `confidence_score`      — Confidence level (0.0 - 1.0)
//       - `rule_or_invariant_id`  — Linked architectural invariant or security rule
//       - `status`                — open | addressed | dismissed | patched
//       - `metadata_json`         — Extensible metadata dictionary
//   - review_patches:
//       - `review_id`             — Parent code_reviews record ID
//       - `title`                 — Patch title
//       - `patch_unified_diff`    — Unified diff content of synthesized patch
//       - `author_agent`          — Patch author / synthesizing agent
//       - `status`                — draft | applied | rejected | reverted
//       - `critiques_resolved_json`— JSON array of resolved critique IDs
//       - `files_touched_json`    — JSON array of affected file paths
//       - `dry_run_success`       — Whether patch applies cleanly
//       - `dry_run_output`        — Dry-run execution logs / verification notes
//       - `metadata_json`         — Extensible metadata dictionary
//   - merge_verdicts:
//       - `review_id`             — Parent code_reviews record ID
//       - `verdict`               — approved | changes_requested | blocked | overridden
//       - `score`                 — Aggregate consensus score (0 - 100)
//       - `summary_markdown`      — Consensus summary and rationale
//       - `blocking_issues_json`  — JSON array of blocking issues preventing merge
//       - `persona_scores_json`   — JSON object with individual persona scores
//       - `deciding_agent`        — Lead arbiter agent or gate keeper
//       - `enforced_rules_json`   — JSON array of evaluated gate rules
//       - `metadata_json`         — Extensible metadata dictionary

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

    // 1. code_reviews
    ensureCollection("code_reviews", "", "", [
        text("title", { required: true }),
        text("summary"),
        text("project_id"),
        text("source_branch"),
        text("target_branch"),
        text("diff_content"),
        json("files_touched_json"),
        text("author_agent"),
        text("mcp_session_id"),
        text("issue_id"),
        text("sandbox_id"),
        select("status", ["pending", "reviewing", "changes_requested", "approved", "blocked", "merged", "rejected"]),
        select("merge_strategy", ["squash", "rebase", "merge", "fast_forward"]),
        number("overall_score"),
        number("p0_count"),
        number("p1_count"),
        number("p2_count"),
        number("p3_count"),
        select("verdict", ["pending", "approved", "changes_requested", "blocked", "overridden"]),
        text("override_reason"),
        text("overridden_by"),
        json("metadata_json")
    ])

    // 2. review_critiques
    ensureCollection("review_critiques", "", "", [
        text("review_id", { required: true }),
        select("persona", ["security_auditor", "architecture_guardian", "performance_specialist", "simplicity_yagni", "test_coverage_critic", "style_conventions"]),
        text("reviewer_agent"),
        text("file_path"),
        number("line_start"),
        number("line_end"),
        select("severity", ["p0_blocker", "p1_warning", "p2_suggestion", "p3_nit"]),
        text("title", { required: true }),
        text("critique_markdown"),
        text("suggested_diff"),
        number("confidence_score"),
        text("rule_or_invariant_id"),
        select("status", ["open", "addressed", "dismissed", "patched"]),
        json("metadata_json")
    ])

    // 3. review_patches
    ensureCollection("review_patches", "", "", [
        text("review_id", { required: true }),
        text("title", { required: true }),
        text("patch_unified_diff", { required: true }),
        text("author_agent"),
        select("status", ["draft", "applied", "rejected", "reverted"]),
        json("critiques_resolved_json"),
        json("files_touched_json"),
        bool("dry_run_success"),
        text("dry_run_output"),
        json("metadata_json")
    ])

    // 4. merge_verdicts
    ensureCollection("merge_verdicts", "", "", [
        text("review_id", { required: true }),
        select("verdict", ["approved", "changes_requested", "blocked", "overridden"]),
        number("score"),
        text("summary_markdown"),
        json("blocking_issues_json"),
        json("persona_scores_json"),
        text("deciding_agent"),
        json("enforced_rules_json"),
        json("metadata_json")
    ])
}, (app) => {
    // Revert logic
    const dropCollection = (name) => {
        try {
            const col = app.findCollectionByNameOrId(name)
            if (col) {
                app.delete(col)
            }
        } catch (e) {
            // ignore if not found
        }
    }

    dropCollection("merge_verdicts")
    dropCollection("review_patches")
    dropCollection("review_critiques")
    dropCollection("code_reviews")
})
