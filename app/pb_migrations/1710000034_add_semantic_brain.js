// ProjectBase migration 34 — Semantic Review, Embeddings & Reranker Board Brain Engine (Epic 23).
//
// Adds collections for Semantic Board Governance, Neural Admission Gates & Reranking:
//   1. semantic_embeddings: Dense vector representations, content hashes, and semantic indexes for issues.
//   2. semantic_admission_policies: Per-project / global admission rules, similarity thresholds & clutter controls.
//   3. semantic_review_audit: Real-time logs of blocked duplicates, subtask auto-attaches, and gate evaluations.

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

    // 1. semantic_embeddings collection
    ensureCollection("semantic_embeddings", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("issue_id", { required: true }),
        text("project_id", { required: false }),
        text("vector_model", { required: true }),
        json("embedding_vector"),
        text("content_hash", { required: true }),
        text("raw_tokens", { required: false }),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 2. semantic_admission_policies collection
    ensureCollection("semantic_admission_policies", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("project_id", { required: false }),
        text("policy_name", { required: true }),
        text("policy_mode", { required: true }), // strict, advisory, auto_merge, auto_subtask
        number("duplicate_threshold"), // e.g. 0.70
        number("related_threshold"),   // e.g. 0.45
        bool("require_acceptance_criteria"),
        bool("enable_cross_encoder_rerank"),
        bool("auto_link_related"),
        bool("is_active"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 3. semantic_review_audit collection
    ensureCollection("semantic_review_audit", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("project_id", { required: false }),
        text("candidate_title", { required: true }),
        text("candidate_description", { required: false }),
        text("decision", { required: true }), // ALLOWED, REJECTED_DUPLICATE, ATTACHED_SUBTASK, AUTO_LINKED, REJECTED_VAGUE
        number("similarity_score"),
        text("matched_issue_id", { required: false }),
        text("matched_identifier", { required: false }),
        json("reranker_details"),
        text("created_by_agent", { required: false }),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // Seed default global semantic admission policy if none exists
    try {
        const policiesCol = app.findCollectionByNameOrId("semantic_admission_policies")
        const existing = app.findRecordsByFilter("semantic_admission_policies", "policy_name = 'Global Zero-Clutter Admission Gate'", "-created", 1, 0)
        if (!existing || existing.length === 0) {
            const defaultPolicy = new Record(policiesCol)
            defaultPolicy.set("project_id", "")
            defaultPolicy.set("policy_name", "Global Zero-Clutter Admission Gate")
            defaultPolicy.set("policy_mode", "strict")
            defaultPolicy.set("duplicate_threshold", 0.75)
            defaultPolicy.set("related_threshold", 0.45)
            defaultPolicy.set("require_acceptance_criteria", false)
            defaultPolicy.set("enable_cross_encoder_rerank", true)
            defaultPolicy.set("auto_link_related", true)
            defaultPolicy.set("is_active", true)
            app.save(defaultPolicy)
        }
    } catch (err) {
        console.error("Failed to seed default semantic admission policy:", err)
    }

}, (app) => {
    // Optional rollback
    try {
        const c1 = app.findCollectionByNameOrId("semantic_embeddings")
        if (c1) app.delete(c1)
        const c2 = app.findCollectionByNameOrId("semantic_admission_policies")
        if (c2) app.delete(c2)
        const c3 = app.findCollectionByNameOrId("semantic_review_audit")
        if (c3) app.delete(c3)
    } catch (err) {}
})
