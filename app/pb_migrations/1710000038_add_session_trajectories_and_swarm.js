// ProjectBase migration 38 — Live Step-by-Step Trajectory Stream, Tool Execution Telemetry & Autonomous Swarm Choreography Hub (Milestone 5 / Epic 26).
//
// Adds step-by-step trajectory tracking, discrete tool execution metrics, token cost rollups,
// and hierarchical multi-agent swarm cluster coordination:
//   - agent_sessions (extended):
//       - `total_steps`        — total discrete reasoning and tool execution steps
//       - `total_tokens`       — cumulative token usage across prompt/completion/reasoning
//       - `total_cost_usd`     — calculated model execution cost
//       - `current_step_type`  — thought | tool_call | tool_result | diff | checkpoint | error | user_intervention | gate_event
//       - `active_tool`        — current executing tool name (e.g. bash, edit, websearch)
//       - `swarm_role`         — coordinator | researcher | implementer | auditor | tester | reviewer | arbiter
//       - `swarm_parent_id`    — session ID of the coordinator or parent agent in swarm
//       - `swarm_cluster_id`   — cluster ID grouping the swarm execution
//       - `trajectory_summary` — high-level summary of session reasoning milestones
//   - session_trajectories:
//       - discrete timeline steps with tool inputs, outputs, thoughts, duration_ms, token breakdown, and statuses
//   - swarm_clusters:
//       - cluster lifecycle management, topologies, concurrency, and aggregated metrics

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })

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

    // 1. Extend agent_sessions with trajectory and swarm fields
    let sessionCol = null
    try { sessionCol = app.findCollectionByNameOrId("agent_sessions") } catch (err) {}
    if (sessionCol) {
        let sessionFields = [
            number("total_steps"),
            number("total_tokens"),
            number("total_cost_usd"),
            text("current_step_type"),
            text("active_tool"),
            select("swarm_role", ["coordinator", "researcher", "implementer", "auditor", "tester", "reviewer", "arbiter"]),
            text("swarm_parent_id"),
            text("swarm_cluster_id"),
            text("trajectory_summary")
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

    // 2. Create session_trajectories collection
    ensureCollection("session_trajectories", "@request.auth.id != ''", "@request.auth.id != ''", [
        sessionsId ? relation("session", sessionsId, { maxSelect: 1 }) : text("session"),
        text("session_id"),
        number("step_number"),
        select("step_type", ["thought", "tool_call", "tool_result", "diff", "checkpoint", "error", "user_intervention", "gate_event", "state_transition"]),
        text("tool_name"),
        json("tool_input"),
        json("tool_output"),
        text("thought_text"),
        number("duration_ms"),
        number("tokens_prompt"),
        number("tokens_completion"),
        number("tokens_reasoning"),
        number("cost_usd"),
        select("status", ["in_progress", "success", "failed", "cancelled"]),
        text("error_message"),
        json("files_touched"),
        json("metadata")
    ])

    // 3. Create swarm_clusters collection
    ensureCollection("swarm_clusters", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("cluster_id"),
        text("name"),
        text("objective"),
        projectsId ? relation("project", projectsId, { maxSelect: 1 }) : text("project"),
        text("coordinator_session_id"),
        select("topology", ["hierarchical", "flat_fanout", "pipeline_linear", "adversarial_critique"]),
        select("status", ["initializing", "running", "paused", "completed", "failed", "aborted"]),
        number("max_concurrency"),
        number("total_workers"),
        number("total_steps"),
        number("total_tokens"),
        number("total_cost_usd"),
        json("metadata")
    ])
}, (app) => {
    // Rollback hook
})
