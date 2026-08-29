// ProjectBase migration 50 — Autonomous Agent Time-Travel Debugger, Execution Trace Replay, Breakpoint Watchpoints & State Snapshot Engine (Milestone 16 / Epic 37 / v1.36.0).
//
// Introduces fine-grained execution trace frame ingestion, time-travel step scrubbing,
// conditional breakpoint watchpoints, memory/state snapshot comparison, and interactive replay simulation.

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
            maxSelect: 1
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
        if (updated) {
            app.save(col)
        }
        return col
    }

    // 1. debug_sessions
    ensureCollection("debug_sessions", "", "", [
        text("name", { required: true, presentable: true }),
        text("session_id"),
        text("project_id"),
        text("issue_id"),
        text("agent_id"),
        select("status", ["active", "paused", "completed", "failed", "aborted", "stepping"]),
        number("total_steps"),
        number("current_step_index"),
        text("target_model"),
        text("entrypoint"),
        text("tags"),
        json("metadata_json"),
        text("created_by"),
        text("last_active_at")
    ])

    // 2. debug_trace_frames
    ensureCollection("debug_trace_frames", "", "", [
        text("debug_session_id", { required: true }),
        number("step_index", { required: true }),
        text("timestamp"),
        select("event_type", ["tool_call", "tool_return", "thought", "file_read", "file_write", "command_exec", "state_change", "breakpoint_hit", "error"]),
        text("action_name", { required: true }),
        text("caller"),
        json("input_payload_json"),
        json("output_payload_json"),
        json("variable_state_json"),
        number("stack_depth"),
        number("duration_ms"),
        number("memory_usage_mb"),
        text("error_message"),
        bool("is_breakpoint")
    ])

    // 3. debug_breakpoints
    ensureCollection("debug_breakpoints", "", "", [
        text("debug_session_id", { required: true }),
        text("name", { required: true, presentable: true }),
        select("condition_type", ["always", "on_error", "on_tool", "on_file", "expression"]),
        text("condition_expr"),
        number("hit_count"),
        bool("enabled"),
        select("action", ["pause", "log", "snapshot", "alert"]),
        text("last_hit_at")
    ])

    // 4. debug_state_snapshots
    ensureCollection("debug_state_snapshots", "", "", [
        text("debug_session_id", { required: true }),
        text("frame_id"),
        number("step_index"),
        text("label", { required: true, presentable: true }),
        select("snapshot_type", ["manual", "breakpoint", "error", "auto"]),
        json("memory_snapshot_json"),
        json("env_snapshot_json"),
        text("fs_diff"),
        number("tokens_consumed"),
        text("captured_by")
    ])
})
