// ProjectBase migration 37 — One-Click Session Branching, Re-Tasking & Human Intervention Gate (Milestone 4 / Epic 25).
//
// Adds session DAG lineage, pause/resume, human instruction injection, intervention gates,
// worktree isolation paths, conflict arbitration state, and the dedicated session_interventions collection:
//   - agent_sessions (extended):
//       - `parent_session_id`     — upstream parent session identifier for DAG ancestry
//       - `branch_name`           — human-readable branch/fork name (e.g., 'fix-auth-race-condition', 'swarm-worker-1')
//       - `branch_type`           — fork | continuation | retry | repair | swarm_worker | critique
//       - `generation`            — DAG generation depth (0 = root, 1 = direct branch, etc.)
//       - `is_paused`             — boolean flag indicating if agent process execution is paused
//       - `intervention_gate`     — none | pending_human_review | human_approved | human_rejected | auto_passed
//       - `injected_instructions` — structured JSON array of injected human steerings & constraints
//       - `worktree_path`         — isolated git worktree / sandbox directory path
//       - `conflict_status`       — clean | conflict_detected | resolved | arbitrated
//   - session_interventions:
//       - audit log of human injections, steering prompts, pause/resumes, gate approvals/rejections, and conflict resolutions

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values, maxSelect: 1 })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
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

    // 1. Extend agent_sessions collection with branching, DAG, and intervention fields
    let sessionCol = null
    try { sessionCol = app.findCollectionByNameOrId("agent_sessions") } catch (err) {}
    if (sessionCol) {
        let sessionFields = [
            text("parent_session_id"),
            text("branch_name"),
            select("branch_type", ["fork", "continuation", "retry", "repair", "swarm_worker", "critique"]),
            number("generation"),
            bool("is_paused"),
            select("intervention_gate", ["none", "pending_human_review", "human_approved", "human_rejected", "auto_passed"]),
            json("injected_instructions"),
            text("worktree_path"),
            select("conflict_status", ["clean", "conflict_detected", "resolved", "arbitrated"]),
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

    // 2. session_interventions: Human-in-the-loop interventions, steerings, and arbitration events
    ensureCollection(
        "session_interventions",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        [
            text("session_id", { required: true }),
            relation("session", sessionsId, { cascadeDelete: false }),
            relation("project", projectsId, { cascadeDelete: false }),
            select("action_type", [
                "instruction_injected",
                "paused",
                "resumed",
                "gate_approved",
                "gate_rejected",
                "branch_forked",
                "conflict_arbitrated",
                "swarm_dispatched"
            ]),
            text("instruction"),
            text("author"),
            text("status"),
            json("payload"),
            auto("created", true, false),
            auto("updated", true, true),
        ]
    )
})
