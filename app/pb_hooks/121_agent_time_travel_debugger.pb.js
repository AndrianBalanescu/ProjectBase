// ProjectBase Hook 121 — Autonomous Agent Time-Travel Debugger, Execution Trace Replay, Breakpoint Watchpoints & State Snapshot Engine (Milestone 16 / Epic 37 / v1.36.0).
//
// Exposes high-performance REST APIs for fine-grained execution trace frame ingestion,
// time-travel step scrubbing, conditional breakpoint watchpoints, memory/state snapshot comparison,
// interactive replay simulation, and workspace debugging telemetry.

// 1. GET /api/projectbase/debug/sessions
routerAdd("GET", "/api/projectbase/debug/sessions", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const projectId = query.project_id || "";
        const issueId = query.issue_id || "";
        const status = query.status || "";
        const agentId = query.agent_id || "";
        const search = query.search || "";
        const limit = parseInt(query.limit || "100", 10);
        const offset = parseInt(query.offset || "0", 10);

        let filterParts = [];
        if (projectId) filterParts.push(`project_id = '${projectId}'`);
        if (issueId) filterParts.push(`issue_id = '${issueId}'`);
        if (status) filterParts.push(`status = '${status}'`);
        if (agentId) filterParts.push(`agent_id = '${agentId}'`);
        if (search) filterParts.push(`(name ~ '${search}' || target_model ~ '${search}' || entrypoint ~ '${search}' || created_by ~ '${search}')`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter(
            "debug_sessions",
            filterExpr,
            "-created",
            limit,
            offset
        );

        let total = records.length;
        try {
            const all = e.app.findRecordsByFilter("debug_sessions", filterExpr, "", 0, 0);
            total = all.length;
        } catch (_) {}

        return e.json(200, {
            items: records,
            total: total,
            limit: limit,
            offset: offset
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 2. POST /api/projectbase/debug/sessions
routerAdd("POST", "/api/projectbase/debug/sessions", (e) => {
    try {
        const body = e.requestInfo().body || {};
        if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
            return e.json(400, { error: "Session name is required." });
        }

        const col = e.app.findCollectionByNameOrId("debug_sessions");
        const record = new Record(col);

        record.set("name", body.name.trim());
        record.set("session_id", body.session_id || "");
        record.set("project_id", body.project_id || "");
        record.set("issue_id", body.issue_id || "");
        record.set("agent_id", body.agent_id || "flomaster");
        record.set("status", body.status || "active");
        record.set("total_steps", parseInt(body.total_steps || "0", 10));
        record.set("current_step_index", parseInt(body.current_step_index || "0", 10));
        record.set("target_model", body.target_model || "claude-fable-5");
        record.set("entrypoint", body.entrypoint || "main");
        record.set("tags", body.tags || "");
        record.set("metadata_json", body.metadata_json || {});
        record.set("created_by", body.created_by || "agent");
        record.set("last_active_at", new Date().toISOString());

        e.app.save(record);

        return e.json(201, {
            success: true,
            session: record
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 3. GET /api/projectbase/debug/sessions/:id
routerAdd("GET", "/api/projectbase/debug/sessions/{id}", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const record = e.app.findRecordById("debug_sessions", id);

        // Fetch recent frames
        let recentFrames = [];
        try {
            recentFrames = e.app.findRecordsByFilter(
                "debug_trace_frames",
                `debug_session_id = '${id}'`,
                "-step_index",
                10,
                0
            );
        } catch (_) {}

        // Fetch breakpoints
        let breakpoints = [];
        try {
            breakpoints = e.app.findRecordsByFilter(
                "debug_breakpoints",
                `debug_session_id = '${id}'`,
                "-created",
                50,
                0
            );
        } catch (_) {}

        // Fetch snapshots
        let snapshots = [];
        try {
            snapshots = e.app.findRecordsByFilter(
                "debug_state_snapshots",
                `debug_session_id = '${id}'`,
                "-step_index",
                20,
                0
            );
        } catch (_) {}

        return e.json(200, {
            session: record,
            recent_frames: recentFrames,
            breakpoints: breakpoints,
            snapshots: snapshots
        });
    } catch (err) {
        return e.json(404, { error: "Debug session not found: " + (err.message || String(err)) });
    }
});

// 4. PATCH /api/projectbase/debug/sessions/:id
routerAdd("PATCH", "/api/projectbase/debug/sessions/{id}", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const body = e.requestInfo().body || {};
        const record = e.app.findRecordById("debug_sessions", id);

        if (body.name !== undefined) record.set("name", String(body.name).trim());
        if (body.status !== undefined) record.set("status", body.status);
        if (body.current_step_index !== undefined) record.set("current_step_index", parseInt(body.current_step_index, 10));
        if (body.total_steps !== undefined) record.set("total_steps", parseInt(body.total_steps, 10));
        if (body.target_model !== undefined) record.set("target_model", body.target_model);
        if (body.entrypoint !== undefined) record.set("entrypoint", body.entrypoint);
        if (body.tags !== undefined) record.set("tags", body.tags);
        if (body.metadata_json !== undefined) record.set("metadata_json", body.metadata_json);
        record.set("last_active_at", new Date().toISOString());

        e.app.save(record);

        return e.json(200, {
            success: true,
            session: record
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 5. POST /api/projectbase/debug/sessions/:id/step
routerAdd("POST", "/api/projectbase/debug/sessions/{id}/step", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const body = e.requestInfo().body || {};
        const session = e.app.findRecordById("debug_sessions", id);

        const direction = body.direction || "next"; // next, prev, first, last, goto
        const steps = parseInt(body.steps || "1", 10);
        let targetIndex = session.getInt("current_step_index");
        const totalSteps = session.getInt("total_steps");

        if (direction === "next") {
            targetIndex = Math.min(targetIndex + steps, totalSteps);
        } else if (direction === "prev") {
            targetIndex = Math.max(targetIndex - steps, 0);
        } else if (direction === "first") {
            targetIndex = 0;
        } else if (direction === "last") {
            targetIndex = totalSteps;
        } else if (direction === "goto") {
            if (body.target_step !== undefined) {
                targetIndex = Math.max(0, Math.min(parseInt(body.target_step, 10), totalSteps));
            }
        }

        session.set("current_step_index", targetIndex);
        session.set("status", "stepping");
        session.set("last_active_at", new Date().toISOString());
        e.app.save(session);

        // Fetch the frame at this step index
        let currentFrame = null;
        try {
            const frames = e.app.findRecordsByFilter(
                "debug_trace_frames",
                `debug_session_id = '${id}' && step_index = ${targetIndex}`,
                "",
                1,
                0
            );
            if (frames.length > 0) {
                currentFrame = frames[0];
            }
        } catch (_) {}

        return e.json(200, {
            success: true,
            current_step_index: targetIndex,
            total_steps: totalSteps,
            session: session,
            current_frame: currentFrame
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 6. POST /api/projectbase/debug/sessions/:id/pause
routerAdd("POST", "/api/projectbase/debug/sessions/{id}/pause", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const session = e.app.findRecordById("debug_sessions", id);

        session.set("status", "paused");
        session.set("last_active_at", new Date().toISOString());
        e.app.save(session);

        return e.json(200, {
            success: true,
            status: "paused",
            session: session
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 7. POST /api/projectbase/debug/sessions/:id/resume
routerAdd("POST", "/api/projectbase/debug/sessions/{id}/resume", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const session = e.app.findRecordById("debug_sessions", id);

        session.set("status", "active");
        session.set("last_active_at", new Date().toISOString());
        e.app.save(session);

        return e.json(200, {
            success: true,
            status: "active",
            session: session
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 8. GET /api/projectbase/debug/sessions/:id/frames
routerAdd("GET", "/api/projectbase/debug/sessions/{id}/frames", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const query = e.requestInfo().query || {};
        const eventType = query.event_type || "";
        const minStep = query.min_step !== undefined ? parseInt(query.min_step, 10) : null;
        const maxStep = query.max_step !== undefined ? parseInt(query.max_step, 10) : null;
        const limit = parseInt(query.limit || "100", 10);
        const offset = parseInt(query.offset || "0", 10);

        let filterParts = [`debug_session_id = '${id}'`];
        if (eventType) filterParts.push(`event_type = '${eventType}'`);
        if (minStep !== null && !isNaN(minStep)) filterParts.push(`step_index >= ${minStep}`);
        if (maxStep !== null && !isNaN(maxStep)) filterParts.push(`step_index <= ${maxStep}`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter(
            "debug_trace_frames",
            filterExpr,
            "step_index",
            limit,
            offset
        );

        let total = records.length;
        try {
            const all = e.app.findRecordsByFilter("debug_trace_frames", filterExpr, "", 0, 0);
            total = all.length;
        } catch (_) {}

        return e.json(200, {
            items: records,
            total: total,
            limit: limit,
            offset: offset
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 9. POST /api/projectbase/debug/sessions/:id/frames
routerAdd("POST", "/api/projectbase/debug/sessions/{id}/frames", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const body = e.requestInfo().body || {};
        const session = e.app.findRecordById("debug_sessions", id);

        if (!body.action_name || typeof body.action_name !== "string") {
            return e.json(400, { error: "action_name is required for trace frame." });
        }

        let stepIndex = parseInt(body.step_index, 10);
        if (isNaN(stepIndex)) {
            stepIndex = session.getInt("total_steps") + 1;
        }

        const col = e.app.findCollectionByNameOrId("debug_trace_frames");
        const frame = new Record(col);

        const eventType = body.event_type || "tool_call";
        const actionName = body.action_name.trim();
        const errorMessage = body.error_message || "";

        frame.set("debug_session_id", id);
        frame.set("step_index", stepIndex);
        frame.set("timestamp", body.timestamp || new Date().toISOString());
        frame.set("event_type", eventType);
        frame.set("action_name", actionName);
        frame.set("caller", body.caller || "agent_coordinator");
        frame.set("input_payload_json", body.input_payload_json || {});
        frame.set("output_payload_json", body.output_payload_json || {});
        frame.set("variable_state_json", body.variable_state_json || {});
        frame.set("stack_depth", parseInt(body.stack_depth || "1", 10));
        frame.set("duration_ms", parseInt(body.duration_ms || "0", 10));
        frame.set("memory_usage_mb", parseFloat(body.memory_usage_mb || "0"));
        frame.set("error_message", errorMessage);
        frame.set("is_breakpoint", !!body.is_breakpoint);

        // Check active breakpoints
        let triggeredBreakpoint = null;
        let shouldPause = false;
        try {
            const breakpoints = e.app.findRecordsByFilter(
                "debug_breakpoints",
                `debug_session_id = '${id}' && enabled = true`,
                "",
                100,
                0
            );

            for (let i = 0; i < breakpoints.length; i++) {
                const bp = breakpoints[i];
                const condType = bp.getString("condition_type");
                const condExpr = bp.getString("condition_expr");
                let matched = false;

                if (condType === "always") {
                    matched = true;
                } else if (condType === "on_error") {
                    if (errorMessage || eventType === "error") {
                        matched = true;
                    }
                } else if (condType === "on_tool") {
                    if (!condExpr || actionName.toLowerCase().indexOf(condExpr.toLowerCase()) !== -1) {
                        matched = true;
                    }
                } else if (condType === "on_file") {
                    const inputStr = JSON.stringify(body.input_payload_json || {});
                    if (condExpr && (inputStr.toLowerCase().indexOf(condExpr.toLowerCase()) !== -1 || actionName.toLowerCase().indexOf(condExpr.toLowerCase()) !== -1)) {
                        matched = true;
                    }
                } else if (condType === "expression") {
                    const inputStr = JSON.stringify(body.input_payload_json || {});
                    const outputStr = JSON.stringify(body.output_payload_json || {});
                    if (condExpr && (inputStr.indexOf(condExpr) !== -1 || outputStr.indexOf(condExpr) !== -1)) {
                        matched = true;
                    }
                }

                if (matched) {
                    bp.set("hit_count", bp.getInt("hit_count") + 1);
                    bp.set("last_hit_at", new Date().toISOString());
                    e.app.save(bp);

                    frame.set("is_breakpoint", true);
                    triggeredBreakpoint = bp;

                    if (bp.getString("action") === "pause") {
                        shouldPause = true;
                    }
                    break;
                }
            }
        } catch (_) {}

        e.app.save(frame);

        // Update session
        const currentTotal = session.getInt("total_steps");
        if (stepIndex > currentTotal) {
            session.set("total_steps", stepIndex);
        }
        session.set("current_step_index", stepIndex);
        if (shouldPause) {
            session.set("status", "paused");
        }
        session.set("last_active_at", new Date().toISOString());
        e.app.save(session);

        return e.json(201, {
            success: true,
            frame: frame,
            breakpoint_triggered: triggeredBreakpoint,
            session_paused: shouldPause
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 10. GET /api/projectbase/debug/sessions/:id/frames/:frameId
routerAdd("GET", "/api/projectbase/debug/sessions/{id}/frames/{frameId}", (e) => {
    try {
        let frameId = "";
        try { frameId = e.request.pathValue("frameId"); } catch (_) {}
        if (!frameId) { try { frameId = e.requestInfo().pathParams.frameId; } catch (_) {} }
        const frame = e.app.findRecordById("debug_trace_frames", frameId);
        return e.json(200, { frame: frame });
    } catch (err) {
        return e.json(404, { error: "Frame not found: " + (err.message || String(err)) });
    }
});

// 11. GET /api/projectbase/debug/sessions/:id/breakpoints
routerAdd("GET", "/api/projectbase/debug/sessions/{id}/breakpoints", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const records = e.app.findRecordsByFilter(
            "debug_breakpoints",
            `debug_session_id = '${id}'`,
            "-created",
            100,
            0
        );
        return e.json(200, { items: records, total: records.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 12. POST /api/projectbase/debug/sessions/:id/breakpoints
routerAdd("POST", "/api/projectbase/debug/sessions/{id}/breakpoints", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const body = e.requestInfo().body || {};

        if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
            return e.json(400, { error: "Breakpoint name is required." });
        }

        const col = e.app.findCollectionByNameOrId("debug_breakpoints");
        const bp = new Record(col);

        bp.set("debug_session_id", id);
        bp.set("name", body.name.trim());
        bp.set("condition_type", body.condition_type || "always");
        bp.set("condition_expr", body.condition_expr || "");
        bp.set("hit_count", 0);
        bp.set("enabled", body.enabled !== undefined ? !!body.enabled : true);
        bp.set("action", body.action || "pause");
        bp.set("last_hit_at", "");

        e.app.save(bp);

        return e.json(201, {
            success: true,
            breakpoint: bp
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 13. PATCH /api/projectbase/debug/breakpoints/:id
routerAdd("PATCH", "/api/projectbase/debug/breakpoints/{id}", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const body = e.requestInfo().body || {};
        const bp = e.app.findRecordById("debug_breakpoints", id);

        if (body.name !== undefined) bp.set("name", String(body.name).trim());
        if (body.condition_type !== undefined) bp.set("condition_type", body.condition_type);
        if (body.condition_expr !== undefined) bp.set("condition_expr", body.condition_expr);
        if (body.enabled !== undefined) bp.set("enabled", !!body.enabled);
        if (body.action !== undefined) bp.set("action", body.action);

        e.app.save(bp);

        return e.json(200, {
            success: true,
            breakpoint: bp
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 14. DELETE /api/projectbase/debug/breakpoints/:id
routerAdd("DELETE", "/api/projectbase/debug/breakpoints/{id}", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const bp = e.app.findRecordById("debug_breakpoints", id);
        e.app.delete(bp);
        return e.json(200, { success: true, deleted_id: id });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 15. GET /api/projectbase/debug/sessions/:id/snapshots
routerAdd("GET", "/api/projectbase/debug/sessions/{id}/snapshots", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const records = e.app.findRecordsByFilter(
            "debug_state_snapshots",
            `debug_session_id = '${id}'`,
            "-step_index",
            100,
            0
        );
        return e.json(200, { items: records, total: records.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 16. POST /api/projectbase/debug/sessions/:id/snapshots
routerAdd("POST", "/api/projectbase/debug/sessions/{id}/snapshots", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const body = e.requestInfo().body || {};
        const session = e.app.findRecordById("debug_sessions", id);

        if (!body.label || typeof body.label !== "string" || !body.label.trim()) {
            return e.json(400, { error: "Snapshot label is required." });
        }

        const col = e.app.findCollectionByNameOrId("debug_state_snapshots");
        const snap = new Record(col);

        snap.set("debug_session_id", id);
        snap.set("frame_id", body.frame_id || "");
        snap.set("step_index", body.step_index !== undefined ? parseInt(body.step_index, 10) : session.getInt("current_step_index"));
        snap.set("label", body.label.trim());
        snap.set("snapshot_type", body.snapshot_type || "manual");
        snap.set("memory_snapshot_json", body.memory_snapshot_json || {});
        snap.set("env_snapshot_json", body.env_snapshot_json || {});
        snap.set("fs_diff", body.fs_diff || "");
        snap.set("tokens_consumed", parseInt(body.tokens_consumed || "0", 10));
        snap.set("captured_by", body.captured_by || "agent");

        e.app.save(snap);

        return e.json(201, {
            success: true,
            snapshot: snap
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 17. POST /api/projectbase/debug/sessions/:id/replay
routerAdd("POST", "/api/projectbase/debug/sessions/{id}/replay", (e) => {
    try {
        let id = "";
        try { id = e.request.pathValue("id"); } catch (_) {}
        if (!id) { try { id = e.requestInfo().pathParams.id; } catch (_) {} }
        const body = e.requestInfo().body || {};
        const session = e.app.findRecordById("debug_sessions", id);

        const fromStep = parseInt(body.from_step || "0", 10);
        const toStep = parseInt(body.to_step || String(session.getInt("total_steps")), 10);

        const filterExpr = `debug_session_id = '${id}' && step_index >= ${fromStep} && step_index <= ${toStep}`;
        const frames = e.app.findRecordsByFilter(
            "debug_trace_frames",
            filterExpr,
            "step_index",
            500,
            0
        );

        let errorCount = 0;
        let breakpointHitCount = 0;
        let cumulativeDurationMs = 0;
        const timeline = [];

        frames.forEach((f) => {
            const hasError = !!f.getString("error_message") || f.getString("event_type") === "error";
            const isBp = f.getBool("is_breakpoint");
            const duration = f.getInt("duration_ms");

            if (hasError) errorCount++;
            if (isBp) breakpointHitCount++;
            cumulativeDurationMs += duration;

            timeline.push({
                step_index: f.getInt("step_index"),
                event_type: f.getString("event_type"),
                action_name: f.getString("action_name"),
                caller: f.getString("caller"),
                has_error: hasError,
                error_message: f.getString("error_message"),
                is_breakpoint: isBp,
                duration_ms: duration,
                memory_usage_mb: f.getFloat("memory_usage_mb")
            });
        });

        return e.json(200, {
            session_id: id,
            session_name: session.getString("name"),
            from_step: fromStep,
            to_step: toStep,
            frame_count: frames.length,
            error_count: errorCount,
            breakpoint_hit_count: breakpointHitCount,
            cumulative_duration_ms: cumulativeDurationMs,
            replay_timeline: timeline
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 18. GET /api/projectbase/debug/metrics
routerAdd("GET", "/api/projectbase/debug/metrics", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const projectId = query.project_id || "";

        let sessionFilter = projectId ? `project_id = '${projectId}'` : "";
        const allSessions = e.app.findRecordsByFilter("debug_sessions", sessionFilter, "", 1000, 0);

        let activeSessions = 0;
        let pausedSessions = 0;
        let completedSessions = 0;
        let totalStepsSum = 0;

        allSessions.forEach((s) => {
            const st = s.getString("status");
            if (st === "active") activeSessions++;
            else if (st === "paused" || st === "stepping") pausedSessions++;
            else if (st === "completed") completedSessions++;
            totalStepsSum += s.getInt("total_steps");
        });

        const allFrames = e.app.findRecordsByFilter("debug_trace_frames", "", "", 2000, 0);
        let errorFrames = 0;
        let breakpointFrames = 0;
        let totalDuration = 0;
        let totalMemory = 0;

        allFrames.forEach((f) => {
            if (f.getString("error_message") || f.getString("event_type") === "error") errorFrames++;
            if (f.getBool("is_breakpoint")) breakpointFrames++;
            totalDuration += f.getInt("duration_ms");
            totalMemory += f.getFloat("memory_usage_mb");
        });

        const allBreakpoints = e.app.findRecordsByFilter("debug_breakpoints", "", "", 1000, 0);
        let totalBpActive = 0;
        let totalBpHits = 0;
        allBreakpoints.forEach((bp) => {
            if (bp.getBool("enabled")) totalBpActive++;
            totalBpHits += bp.getInt("hit_count");
        });

        const allSnapshots = e.app.findRecordsByFilter("debug_state_snapshots", "", "", 1000, 0);

        const avgDuration = allFrames.length > 0 ? Math.round(totalDuration / allFrames.length) : 0;
        const avgMemory = allFrames.length > 0 ? parseFloat((totalMemory / allFrames.length).toFixed(2)) : 0;
        const errorInterceptionRate = allFrames.length > 0 ? parseFloat(((errorFrames / allFrames.length) * 100).toFixed(1)) : 0;

        return e.json(200, {
            total_sessions: allSessions.length,
            active_sessions: activeSessions,
            paused_sessions: pausedSessions,
            completed_sessions: completedSessions,
            total_trace_frames: allFrames.length,
            total_breakpoints: allBreakpoints.length,
            active_breakpoints: totalBpActive,
            total_breakpoint_hits: totalBpHits,
            total_state_snapshots: allSnapshots.length,
            error_frames_count: errorFrames,
            error_interception_rate_pct: errorInterceptionRate,
            avg_step_duration_ms: avgDuration,
            avg_memory_usage_mb: avgMemory
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});
