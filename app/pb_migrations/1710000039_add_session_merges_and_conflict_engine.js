// ProjectBase migration 39 — Multi-Agent Merge & Semantic Conflict Auto-Resolution Engine, 3-Way Diff Matrix & Deterministic Merge Barrier (Milestone 6 / Epic 27).
//
// Adds multi-agent code merge orchestration, 3-way semantic diff analysis, conflict hunk detection,
// automated AST/union resolution heuristics, and deterministic commit verification barriers:
//   - agent_sessions (extended):
//       - `merge_status`     — none | pending_merge | clean | conflicted | merged | rejected
//       - `active_merge_id`  — ID of active merge request involving this session
//   - session_merges:
//       - Multi-agent merge requests tracking source/target sessions, branches, diff stats, conflict counts, and merge commits
//   - merge_conflicts:
//       - Fine-grained conflict hunks (base, source, target) with auto/manual resolution tracking and unified patches

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
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
        try { col = app.findCollectionByNameOrId(name) } catch (err) {}
        if (!col) {
            col = new Collection({
                name,
                type: "base",
                listRule,
                viewRule,
                createRule: "@request.auth.id != ''",
                updateRule: "@request.auth.id != ''",
                deleteRule: "@request.auth.id != ''",
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

    let projectsId = ""
    try { projectsId = app.findCollectionByNameOrId("projects").id } catch (err) {}
    let sessionsId = ""
    try { sessionsId = app.findCollectionByNameOrId("agent_sessions").id } catch (err) {}

    // 1. Extend agent_sessions with merge fields
    let sessionCol = null
    try { sessionCol = app.findCollectionByNameOrId("agent_sessions") } catch (err) {}
    if (sessionCol) {
        let sessionFields = [
            select("merge_status", ["none", "pending_merge", "clean", "conflicted", "merged", "rejected"]),
            text("active_merge_id")
        ]
        let changed = false
        sessionFields.forEach(f => {
            if (!hasField(sessionCol, f.name)) {
                sessionCol.fields.add(f)
                changed = true
            }
        })
        if (changed) {
            app.save(sessionCol)
        }
    }

    // 2. Create session_merges collection
    const mergesCol = ensureCollection("session_merges", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("merge_id"),
        text("title"),
        projectsId ? relation("project", projectsId, { maxSelect: 1 }) : text("project"),
        text("source_session_id"),
        text("target_session_id"),
        text("base_commit"),
        text("source_branch"),
        text("target_branch"),
        select("status", ["pending", "analyzing", "clean", "conflicted", "resolved", "merged", "rejected"]),
        number("conflict_count"),
        number("resolved_count"),
        json("files_changed"),
        json("diff_summary"),
        select("auto_resolution_strategy", ["ast_clean", "priority_override", "manual_hunk", "union_merge", "none"]),
        text("merge_commit"),
        text("resolution_notes"),
        text("verified_at"),
        json("metadata"),
        auto("created", true, false),
        auto("updated", true, true)
    ])

    let mergesId = ""
    try { mergesId = mergesCol.id } catch (err) {}

    // 3. Create merge_conflicts collection
    ensureCollection("merge_conflicts", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("merge_id"),
        mergesId ? relation("merge", mergesId, { maxSelect: 1 }) : text("merge"),
        text("file_path"),
        select("conflict_type", ["content", "delete_modify", "file_rename", "binary", "import_collision"]),
        text("base_hunk"),
        text("source_hunk"),
        text("target_hunk"),
        select("resolution_status", ["unresolved", "auto_resolved", "manual_resolved"]),
        text("resolved_content"),
        text("resolved_by"),
        text("resolution_notes"),
        json("metadata"),
        auto("created", true, false),
        auto("updated", true, true)
    ])
}, (app) => {
    // Rollback hook
})
