// ProjectBase Hook 110 — Live Step-by-Step Trajectory Stream, Tool Execution Telemetry & Autonomous Swarm Choreography Engine (Milestone 5 / Epic 26).
//
// Exposes high-performance REST APIs for trajectory tracking, tool profiling, and multi-agent swarm cluster orchestration:
// 1.  POST /api/projectbase/sessions/{id}/trajectories         - Record single trajectory step (thought, tool_call, tool_result, error, etc.)
// 2.  POST /api/projectbase/sessions/trajectories             - Ingest trajectory step with session_id in payload
// 3.  POST /api/projectbase/sessions/trajectories/bulk        - Batch ingest multiple trajectory steps
// 4.  GET  /api/projectbase/sessions/{id}/trajectories         - Retrieve full chronological trajectory timeline with filtering
// 5.  GET  /api/projectbase/sessions/{id}/trajectories/summary - Retrieve trajectory profiling metrics (steps, tools, duration, tokens, cost)
// 6.  POST /api/projectbase/swarm/clusters                    - Initialize a multi-agent swarm cluster (hierarchical, fanout, pipeline, adversarial)
// 7.  GET  /api/projectbase/swarm/clusters                    - List swarm clusters with status and aggregated metrics
// 8.  GET  /api/projectbase/swarm/clusters/{id}               - Get single cluster with all worker sessions and topology
// 9.  POST /api/projectbase/swarm/clusters/{id}/workers       - Add worker session(s) to swarm cluster
// 10. POST /api/projectbase/swarm/clusters/{id}/status        - Update cluster lifecycle state (pause, resume, abort, complete)
// 11. GET  /api/projectbase/swarm/clusters/{id}/metrics       - Aggregate cluster performance metrics across all workers

// 1. POST /api/projectbase/sessions/{id}/trajectories
routerAdd("POST", "/api/projectbase/sessions/{id}/trajectories", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        const sessionId = (id || body.session_id || "").trim();

        if (!sessionId) {
            return e.json(400, { error: "session_id is required" });
        }

        let trajectoryCol = null;
        try { trajectoryCol = e.app.findCollectionByNameOrId("session_trajectories"); } catch (x) {}
        if (!trajectoryCol) return e.json(500, { error: "session_trajectories collection not found" });

        let sessionRecord = null;
        try {
            sessionRecord = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: sessionId });
        } catch (x) {}

        let nextStepNumber = 1;
        if (typeof body.step_number === "number") {
            nextStepNumber = body.step_number;
        } else {
            try {
                const lastSteps = e.app.findRecordsByFilter("session_trajectories", "session_id = {:sid}", "-step_number", 1, 0, { sid: sessionId });
                if (lastSteps && lastSteps.length > 0) {
                    nextStepNumber = (lastSteps[0].getInt("step_number") || 0) + 1;
                }
            } catch (x) {}
        }

        const stepType = body.step_type || "thought";
        const toolName = body.tool_name || "";
        const durationMs = typeof body.duration_ms === "number" ? body.duration_ms : 0;
        const tokensPrompt = typeof body.tokens_prompt === "number" ? body.tokens_prompt : 0;
        const tokensCompletion = typeof body.tokens_completion === "number" ? body.tokens_completion : 0;
        const tokensReasoning = typeof body.tokens_reasoning === "number" ? body.tokens_reasoning : 0;
        const stepCost = typeof body.cost_usd === "number" ? body.cost_usd : 0.0;
        const stepStatus = body.status || "success";

        const rec = new Record(trajectoryCol);
        rec.set("session_id", sessionId);
        if (sessionRecord) rec.set("session", sessionRecord.getString("id"));
        rec.set("step_number", nextStepNumber);
        rec.set("step_type", stepType);
        rec.set("tool_name", toolName);
        rec.set("tool_input", body.tool_input || {});
        rec.set("tool_output", body.tool_output || {});
        rec.set("thought_text", body.thought_text || "");
        rec.set("duration_ms", durationMs);
        rec.set("tokens_prompt", tokensPrompt);
        rec.set("tokens_completion", tokensCompletion);
        rec.set("tokens_reasoning", tokensReasoning);
        rec.set("cost_usd", stepCost);
        rec.set("status", stepStatus);
        rec.set("error_message", body.error_message || "");
        rec.set("files_touched", body.files_touched || []);
        rec.set("metadata", body.metadata || {});
        e.app.save(rec);

        if (sessionRecord) {
            const curSteps = sessionRecord.getInt("total_steps") || 0;
            const curTokens = sessionRecord.getInt("total_tokens") || 0;
            const curCost = sessionRecord.getFloat("total_cost_usd") || 0.0;
            const totalStepTokens = tokensPrompt + tokensCompletion + tokensReasoning;

            sessionRecord.set("total_steps", curSteps + 1);
            sessionRecord.set("total_tokens", curTokens + totalStepTokens);
            sessionRecord.set("total_cost_usd", parseFloat((curCost + stepCost).toFixed(6)));
            sessionRecord.set("current_step_type", stepType);
            if (toolName) sessionRecord.set("active_tool", toolName);
            if (body.thought_text && (!sessionRecord.getString("trajectory_summary") || curSteps % 5 === 0)) {
                sessionRecord.set("trajectory_summary", (body.thought_text).substring(0, 240));
            }
            try { e.app.save(sessionRecord); } catch (x) {}
        }

        return e.json(201, {
            success: true,
            id: rec.getString("id"),
            session_id: sessionId,
            step_number: nextStepNumber,
            step_type: stepType,
            tool_name: toolName,
            status: stepStatus,
            duration_ms: durationMs,
            tokens: tokensPrompt + tokensCompletion + tokensReasoning,
            cost_usd: stepCost,
            created: rec.getString("created")
        });
    } catch (err) {
        return e.json(500, { error: "Failed to record trajectory step: " + err.message });
    }
});

// 2. POST /api/projectbase/sessions/trajectories
routerAdd("POST", "/api/projectbase/sessions/trajectories", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const body = e.requestInfo().body || {};
        const sessionId = (body.session_id || "").trim();

        if (!sessionId) {
            return e.json(400, { error: "session_id is required" });
        }

        let trajectoryCol = null;
        try { trajectoryCol = e.app.findCollectionByNameOrId("session_trajectories"); } catch (x) {}
        if (!trajectoryCol) return e.json(500, { error: "session_trajectories collection not found" });

        let sessionRecord = null;
        try {
            sessionRecord = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: sessionId });
        } catch (x) {}

        let nextStepNumber = 1;
        if (typeof body.step_number === "number") {
            nextStepNumber = body.step_number;
        } else {
            try {
                const lastSteps = e.app.findRecordsByFilter("session_trajectories", "session_id = {:sid}", "-step_number", 1, 0, { sid: sessionId });
                if (lastSteps && lastSteps.length > 0) {
                    nextStepNumber = (lastSteps[0].getInt("step_number") || 0) + 1;
                }
            } catch (x) {}
        }

        const stepType = body.step_type || "thought";
        const toolName = body.tool_name || "";
        const durationMs = typeof body.duration_ms === "number" ? body.duration_ms : 0;
        const tokensPrompt = typeof body.tokens_prompt === "number" ? body.tokens_prompt : 0;
        const tokensCompletion = typeof body.tokens_completion === "number" ? body.tokens_completion : 0;
        const tokensReasoning = typeof body.tokens_reasoning === "number" ? body.tokens_reasoning : 0;
        const stepCost = typeof body.cost_usd === "number" ? body.cost_usd : 0.0;
        const stepStatus = body.status || "success";

        const rec = new Record(trajectoryCol);
        rec.set("session_id", sessionId);
        if (sessionRecord) rec.set("session", sessionRecord.getString("id"));
        rec.set("step_number", nextStepNumber);
        rec.set("step_type", stepType);
        rec.set("tool_name", toolName);
        rec.set("tool_input", body.tool_input || {});
        rec.set("tool_output", body.tool_output || {});
        rec.set("thought_text", body.thought_text || "");
        rec.set("duration_ms", durationMs);
        rec.set("tokens_prompt", tokensPrompt);
        rec.set("tokens_completion", tokensCompletion);
        rec.set("tokens_reasoning", tokensReasoning);
        rec.set("cost_usd", stepCost);
        rec.set("status", stepStatus);
        rec.set("error_message", body.error_message || "");
        rec.set("files_touched", body.files_touched || []);
        rec.set("metadata", body.metadata || {});
        e.app.save(rec);

        if (sessionRecord) {
            const curSteps = sessionRecord.getInt("total_steps") || 0;
            const curTokens = sessionRecord.getInt("total_tokens") || 0;
            const curCost = sessionRecord.getFloat("total_cost_usd") || 0.0;
            const totalStepTokens = tokensPrompt + tokensCompletion + tokensReasoning;

            sessionRecord.set("total_steps", curSteps + 1);
            sessionRecord.set("total_tokens", curTokens + totalStepTokens);
            sessionRecord.set("total_cost_usd", parseFloat((curCost + stepCost).toFixed(6)));
            sessionRecord.set("current_step_type", stepType);
            if (toolName) sessionRecord.set("active_tool", toolName);
            if (body.thought_text && (!sessionRecord.getString("trajectory_summary") || curSteps % 5 === 0)) {
                sessionRecord.set("trajectory_summary", (body.thought_text).substring(0, 240));
            }
            try { e.app.save(sessionRecord); } catch (x) {}
        }

        return e.json(201, {
            success: true,
            id: rec.getString("id"),
            session_id: sessionId,
            step_number: nextStepNumber,
            step_type: stepType,
            tool_name: toolName,
            status: stepStatus,
            duration_ms: durationMs,
            tokens: tokensPrompt + tokensCompletion + tokensReasoning,
            cost_usd: stepCost,
            created: rec.getString("created")
        });
    } catch (err) {
        return e.json(500, { error: "Failed to record trajectory step: " + err.message });
    }
});

// 3. POST /api/projectbase/sessions/trajectories/bulk
routerAdd("POST", "/api/projectbase/sessions/trajectories/bulk", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const info = e.requestInfo();
        const body = info.body || {};
        const steps = Array.isArray(body.steps) ? body.steps : (Array.isArray(body) ? body : []);
        if (steps.length === 0) {
            return e.json(400, { error: "steps array is required and cannot be empty" });
        }

        let trajectoryCol = null;
        try { trajectoryCol = e.app.findCollectionByNameOrId("session_trajectories"); } catch (x) {}
        if (!trajectoryCol) return e.json(500, { error: "session_trajectories collection not found" });

        let sessionCol = null;
        try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}

        let createdCount = 0;
        let sessionUpdates = {};

        steps.forEach(step => {
            const sid = (step.session_id || body.session_id || "").trim();
            if (!sid) return;

            let sessionRecord = null;
            if (sessionCol) {
                try {
                    sessionRecord = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: sid });
                } catch (x) {}
            }

            const rec = new Record(trajectoryCol);
            rec.set("session_id", sid);
            if (sessionRecord) rec.set("session", sessionRecord.getString("id"));
            rec.set("step_number", typeof step.step_number === "number" ? step.step_number : 1);
            rec.set("step_type", step.step_type || "thought");
            rec.set("tool_name", step.tool_name || "");
            rec.set("tool_input", step.tool_input || {});
            rec.set("tool_output", step.tool_output || {});
            rec.set("thought_text", step.thought_text || "");
            rec.set("duration_ms", typeof step.duration_ms === "number" ? step.duration_ms : 0);
            rec.set("tokens_prompt", typeof step.tokens_prompt === "number" ? step.tokens_prompt : 0);
            rec.set("tokens_completion", typeof step.tokens_completion === "number" ? step.tokens_completion : 0);
            rec.set("tokens_reasoning", typeof step.tokens_reasoning === "number" ? step.tokens_reasoning : 0);
            rec.set("cost_usd", typeof step.cost_usd === "number" ? step.cost_usd : 0);
            rec.set("status", step.status || "success");
            rec.set("error_message", step.error_message || "");
            rec.set("files_touched", step.files_touched || []);
            rec.set("metadata", step.metadata || {});
            e.app.save(rec);
            createdCount++;

            if (sessionRecord) {
                const sRecId = sessionRecord.getString("id");
                if (!sessionUpdates[sRecId]) {
                    sessionUpdates[sRecId] = {
                        rec: sessionRecord,
                        stepsAdded: 0,
                        tokensAdded: 0,
                        costAdded: 0,
                        lastStepType: step.step_type || "thought",
                        lastTool: step.tool_name || ""
                    };
                }
                const totTok = (step.tokens_prompt || 0) + (step.tokens_completion || 0) + (step.tokens_reasoning || 0);
                sessionUpdates[sRecId].stepsAdded += 1;
                sessionUpdates[sRecId].tokensAdded += totTok;
                sessionUpdates[sRecId].costAdded += (step.cost_usd || 0);
                sessionUpdates[sRecId].lastStepType = step.step_type || sessionUpdates[sRecId].lastStepType;
                if (step.tool_name) sessionUpdates[sRecId].lastTool = step.tool_name;
            }
        });

        Object.keys(sessionUpdates).forEach(sRecId => {
            const upd = sessionUpdates[sRecId];
            const s = upd.rec;
            const curSteps = s.getInt("total_steps") || 0;
            const curTokens = s.getInt("total_tokens") || 0;
            const curCost = s.getFloat("total_cost_usd") || 0.0;

            s.set("total_steps", curSteps + upd.stepsAdded);
            s.set("total_tokens", curTokens + upd.tokensAdded);
            s.set("total_cost_usd", parseFloat((curCost + upd.costAdded).toFixed(6)));
            s.set("current_step_type", upd.lastStepType);
            if (upd.lastTool) s.set("active_tool", upd.lastTool);
            try { e.app.save(s); } catch (x) {}
        });

        return e.json(201, {
            success: true,
            created_count: createdCount,
            message: "Successfully ingested " + createdCount + " trajectory steps"
        });
    } catch (err) {
        return e.json(500, { error: "Bulk trajectory ingestion failed: " + err.message });
    }
});

// 4. GET /api/projectbase/sessions/{id}/trajectories
routerAdd("GET", "/api/projectbase/sessions/{id}/trajectories", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const query = e.requestInfo().query || {};
        const stepType = query.step_type || "";
        const toolName = query.tool_name || "";
        const status = query.status || "";
        const limit = Math.min(parseInt(query.limit) || 200, 1000);
        const offset = parseInt(query.offset) || 0;

        let conditions = ["(session_id = {:sid} || session = {:sid})"];
        let params = { sid: id };

        try {
            const sRec = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: id });
            if (sRec) {
                params.sid = sRec.getString("session_id") || id;
                params.recid = sRec.getString("id");
                conditions = ["(session_id = {:sid} || session = {:recid} || session_id = {:recid})"];
            }
        } catch (x) {}

        if (stepType) {
            conditions.push("step_type = {:step_type}");
            params.step_type = stepType;
        }
        if (toolName) {
            conditions.push("tool_name = {:tool_name}");
            params.tool_name = toolName;
        }
        if (status) {
            conditions.push("status = {:status}");
            params.status = status;
        }

        const filter = conditions.join(" && ");
        const records = e.app.findRecordsByFilter("session_trajectories", filter, "step_number", limit, offset, params);

        const trajectories = records.map(r => ({
            id: r.getString("id"),
            session_id: r.getString("session_id"),
            step_number: r.getInt("step_number"),
            step_type: r.getString("step_type"),
            tool_name: r.getString("tool_name"),
            tool_input: r.get("tool_input"),
            tool_output: r.get("tool_output"),
            thought_text: r.getString("thought_text"),
            duration_ms: r.getInt("duration_ms"),
            tokens_prompt: r.getInt("tokens_prompt"),
            tokens_completion: r.getInt("tokens_completion"),
            tokens_reasoning: r.getInt("tokens_reasoning"),
            tokens_total: (r.getInt("tokens_prompt") || 0) + (r.getInt("tokens_completion") || 0) + (r.getInt("tokens_reasoning") || 0),
            cost_usd: r.getFloat("cost_usd"),
            status: r.getString("status"),
            error_message: r.getString("error_message"),
            files_touched: r.get("files_touched"),
            metadata: r.get("metadata"),
            created: r.getString("created")
        }));

        return e.json(200, {
            session_id: id,
            count: trajectories.length,
            trajectories: trajectories
        });
    } catch (err) {
        return e.json(500, { error: "Failed to fetch trajectories: " + err.message });
    }
});

// 5. GET /api/projectbase/sessions/{id}/trajectories/summary
routerAdd("GET", "/api/projectbase/sessions/{id}/trajectories/summary", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";

        let conditions = ["(session_id = {:sid} || session = {:sid})"];
        let params = { sid: id };

        try {
            const sRec = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: id });
            if (sRec) {
                params.sid = sRec.getString("session_id") || id;
                params.recid = sRec.getString("id");
                conditions = ["(session_id = {:sid} || session = {:recid} || session_id = {:recid})"];
            }
        } catch (x) {}

        const filter = conditions.join(" && ");
        const records = e.app.findRecordsByFilter("session_trajectories", filter, "step_number", 1000, 0, params);

        let totalDuration = 0;
        let totalTokens = 0;
        let totalCost = 0.0;
        let stepTypeCounts = {};
        let toolCounts = {};
        let toolDurations = {};
        let failureCount = 0;
        let filesSet = new Set();

        records.forEach(r => {
            const st = r.getString("step_type") || "thought";
            const tool = r.getString("tool_name");
            const dur = r.getInt("duration_ms") || 0;
            const promptTok = r.getInt("tokens_prompt") || 0;
            const compTok = r.getInt("tokens_completion") || 0;
            const reasTok = r.getInt("tokens_reasoning") || 0;
            const cost = r.getFloat("cost_usd") || 0.0;
            const status = r.getString("status") || "success";

            totalDuration += dur;
            totalTokens += (promptTok + compTok + reasTok);
            totalCost += cost;

            stepTypeCounts[st] = (stepTypeCounts[st] || 0) + 1;
            if (tool) {
                toolCounts[tool] = (toolCounts[tool] || 0) + 1;
                toolDurations[tool] = (toolDurations[tool] || 0) + dur;
            }

            if (status === "failed" || r.getString("error_message")) {
                failureCount += 1;
            }

            let touched = r.get("files_touched");
            if (touched) {
                if (typeof touched === "string") {
                    try { touched = JSON.parse(touched); } catch (x) {}
                } else if (Array.isArray(touched) && touched.length > 0 && typeof touched[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < touched.length; i++) { s += String.fromCharCode(touched[i]); }
                        touched = JSON.parse(s);
                    } catch (x) {}
                }
                if (Array.isArray(touched)) {
                    touched.forEach(f => { if (f && typeof f === "string") filesSet.add(f); });
                }
            }
        });

        let toolProfiling = [];
        Object.keys(toolCounts).forEach(t => {
            const c = toolCounts[t];
            const d = toolDurations[t] || 0;
            toolProfiling.push({
                tool_name: t,
                call_count: c,
                total_duration_ms: d,
                avg_duration_ms: c > 0 ? Math.round(d / c) : 0
            });
        });
        toolProfiling.sort((a, b) => b.call_count - a.call_count);

        return e.json(200, {
            session_id: id,
            total_steps: records.length,
            total_duration_ms: totalDuration,
            total_tokens: totalTokens,
            total_cost_usd: parseFloat(totalCost.toFixed(6)),
            failure_count: failureCount,
            success_rate: records.length > 0 ? parseFloat((((records.length - failureCount) / records.length) * 100).toFixed(1)) : 100.0,
            step_type_breakdown: stepTypeCounts,
            tool_profiling: toolProfiling,
            files_touched_count: filesSet.size,
            files_touched: Array.from(filesSet)
        });
    } catch (err) {
        return e.json(500, { error: "Failed to generate trajectory summary: " + err.message });
    }
});

// Swarm Clusters Orchestration Endpoints

// 6. POST /api/projectbase/swarm/clusters
routerAdd("POST", "/api/projectbase/swarm/clusters", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const info = e.requestInfo();
        const body = info.body || {};

        let clusterCol = null;
        try { clusterCol = e.app.findCollectionByNameOrId("swarm_clusters"); } catch (x) {}
        if (!clusterCol) return e.json(500, { error: "swarm_clusters collection not found" });

        const clusterId = (body.cluster_id || ("cluster_" + Math.random().toString(36).substring(2, 10))).trim();
        const name = (body.name || ("Swarm Cluster " + clusterId.substring(8))).trim();
        const objective = (body.objective || "").trim();
        const topology = body.topology || "hierarchical";
        const maxConcurrency = typeof body.max_concurrency === "number" ? body.max_concurrency : 4;
        let coordinatorSid = (body.coordinator_session_id || "").trim();

        let projectRecord = null;
        if (body.project_id) {
            try {
                projectRecord = e.app.findFirstRecordByFilter("projects", "id = {:p} || slug = {:p} || name = {:p}", { p: body.project_id });
            } catch (x) {}
        }

        const clusterRec = new Record(clusterCol);
        clusterRec.set("cluster_id", clusterId);
        clusterRec.set("name", name);
        clusterRec.set("objective", objective);
        if (projectRecord) clusterRec.set("project", projectRecord.getString("id"));
        clusterRec.set("coordinator_session_id", coordinatorSid);
        clusterRec.set("topology", topology);
        clusterRec.set("status", "running");
        clusterRec.set("max_concurrency", maxConcurrency);
        clusterRec.set("total_workers", 0);
        clusterRec.set("total_steps", 0);
        clusterRec.set("total_tokens", 0);
        clusterRec.set("total_cost_usd", 0.0);
        clusterRec.set("metadata", body.metadata || {});
        e.app.save(clusterRec);

        let initialWorkers = [];
        if (Array.isArray(body.workers) && body.workers.length > 0) {
            let sessionCol = null;
            try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}

            if (sessionCol) {
                body.workers.forEach((w, idx) => {
                    const wSid = (w.session_id || ("sess_worker_" + Math.random().toString(36).substring(2, 10))).trim();
                    const wRole = w.swarm_role || w.role || "implementer";
                    const wName = w.agent_name || ("Worker-" + (idx + 1) + " [" + wRole + "]");

                    const wRec = new Record(sessionCol);
                    wRec.set("session_id", wSid);
                    wRec.set("agent_name", wName);
                    wRec.set("role", wRole);
                    wRec.set("swarm_role", wRole);
                    wRec.set("swarm_cluster_id", clusterId);
                    wRec.set("swarm_parent_id", coordinatorSid);
                    wRec.set("status", "running");
                    wRec.set("is_active", true);
                    wRec.set("model", w.model || "gpt-5.5");
                    wRec.set("prompt", w.prompt || objective);
                    if (projectRecord) wRec.set("project", projectRecord.getString("id"));
                    if (w.issue_id) wRec.set("issue", w.issue_id);
                    e.app.save(wRec);

                    initialWorkers.push({
                        session_id: wSid,
                        agent_name: wName,
                        swarm_role: wRole,
                        model: w.model || "gpt-5.5"
                    });
                });

                clusterRec.set("total_workers", initialWorkers.length);
                e.app.save(clusterRec);
            }
        }

        return e.json(201, {
            success: true,
            cluster_id: clusterId,
            id: clusterRec.getString("id"),
            name: name,
            objective: objective,
            topology: topology,
            status: "running",
            max_concurrency: maxConcurrency,
            total_workers: initialWorkers.length,
            workers: initialWorkers,
            created: clusterRec.getString("created")
        });
    } catch (err) {
        return e.json(500, { error: "Failed to initialize swarm cluster: " + err.message });
    }
});

// 7. GET /api/projectbase/swarm/clusters
routerAdd("GET", "/api/projectbase/swarm/clusters", (e) => {
    try {
        const query = e.requestInfo().query || {};
        let status = query.status || "";
        let projectId = query.project || "";

        let conditions = ["1=1"];
        let params = {};
        if (status) {
            conditions.push("status = {:status}");
            params.status = status;
        }
        if (projectId) {
            try {
                const prec = e.app.findFirstRecordByFilter("projects", "id = {:p} || slug = {:p} || name = {:p}", { p: projectId });
                if (prec) projectId = prec.getString("id");
            } catch (x) {}
            conditions.push("project = {:p}");
            params.p = projectId;
        }

        const filter = conditions.join(" && ");
        let records = [];
        try {
            records = e.app.findRecordsByFilter("swarm_clusters", filter, "-created", 100, 0, params);
        } catch (x) {
            try {
                records = e.app.findRecordsByFilter("swarm_clusters", filter, "", 100, 0, params);
            } catch (y) {
                records = [];
            }
        }

        const clusters = records.map(r => ({
            id: r.getString("id"),
            cluster_id: r.getString("cluster_id"),
            name: r.getString("name"),
            objective: r.getString("objective"),
            project: r.getString("project"),
            coordinator_session_id: r.getString("coordinator_session_id"),
            topology: r.getString("topology"),
            status: r.getString("status"),
            max_concurrency: r.getInt("max_concurrency"),
            total_workers: r.getInt("total_workers"),
            total_steps: r.getInt("total_steps"),
            total_tokens: r.getInt("total_tokens"),
            total_cost_usd: r.getFloat("total_cost_usd"),
            metadata: r.get("metadata"),
            created: r.getString("created"),
            updated: r.getString("updated")
        }));

        return e.json(200, {
            count: clusters.length,
            clusters: clusters
        });
    } catch (err) {
        return e.json(500, { error: "Failed to list swarm clusters: " + err.message });
    }
});

// 8. GET /api/projectbase/swarm/clusters/{id}
routerAdd("GET", "/api/projectbase/swarm/clusters/{id}", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let cluster = null;
        try {
            cluster = e.app.findFirstRecordByFilter("swarm_clusters", "id = {:id} || cluster_id = {:id}", { id: id });
        } catch (x) {}
        if (!cluster) return e.json(404, { error: "Swarm cluster not found: " + id });

        const clusterId = cluster.getString("cluster_id");
        const workerSessions = e.app.findRecordsByFilter("agent_sessions", "swarm_cluster_id = {:cid}", "-created", 200, 0, { cid: clusterId });

        let workers = workerSessions.map(w => ({
            id: w.getString("id"),
            session_id: w.getString("session_id"),
            agent_name: w.getString("agent_name"),
            role: w.getString("role"),
            swarm_role: w.getString("swarm_role") || w.getString("role"),
            status: w.getString("status"),
            is_active: w.getBool("is_active"),
            model: w.getString("model"),
            total_steps: w.getInt("total_steps") || 0,
            total_tokens: w.getInt("total_tokens") || 0,
            total_cost_usd: w.getFloat("total_cost_usd") || 0.0,
            current_step_type: w.getString("current_step_type") || "",
            active_tool: w.getString("active_tool") || "",
            prompt: w.getString("prompt"),
            created: w.getString("created")
        }));

        return e.json(200, {
            id: cluster.getString("id"),
            cluster_id: clusterId,
            name: cluster.getString("name"),
            objective: cluster.getString("objective"),
            project: cluster.getString("project"),
            coordinator_session_id: cluster.getString("coordinator_session_id"),
            topology: cluster.getString("topology"),
            status: cluster.getString("status"),
            max_concurrency: cluster.getInt("max_concurrency"),
            total_workers: workers.length,
            workers: workers,
            total_steps: cluster.getInt("total_steps"),
            total_tokens: cluster.getInt("total_tokens"),
            total_cost_usd: cluster.getFloat("total_cost_usd"),
            metadata: cluster.get("metadata"),
            created: cluster.getString("created"),
            updated: cluster.getString("updated")
        });
    } catch (err) {
        return e.json(500, { error: "Failed to get cluster details: " + err.message });
    }
});

// 9. POST /api/projectbase/swarm/clusters/{id}/workers
routerAdd("POST", "/api/projectbase/swarm/clusters/{id}/workers", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let cluster = null;
        try {
            cluster = e.app.findFirstRecordByFilter("swarm_clusters", "id = {:id} || cluster_id = {:id}", { id: id });
        } catch (x) {}
        if (!cluster) return e.json(404, { error: "Swarm cluster not found: " + id });

        const clusterId = cluster.getString("cluster_id");
        const info = e.requestInfo();
        const body = info.body || {};
        const workers = Array.isArray(body.workers) ? body.workers : [body];

        let sessionCol = null;
        try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}
        if (!sessionCol) return e.json(500, { error: "agent_sessions collection not found" });

        let addedWorkers = [];
        workers.forEach((w, idx) => {
            const sid = (w.session_id || ("sess_worker_" + Math.random().toString(36).substring(2, 10))).trim();
            const wRole = w.swarm_role || w.role || "implementer";
            const wName = w.agent_name || ("Worker-" + (cluster.getInt("total_workers") + idx + 1) + " [" + wRole + "]");

            let existing = null;
            try {
                existing = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: sid });
            } catch (x) {}

            if (existing) {
                existing.set("swarm_cluster_id", clusterId);
                existing.set("swarm_role", wRole);
                if (w.swarm_parent_id || cluster.getString("coordinator_session_id")) {
                    existing.set("swarm_parent_id", w.swarm_parent_id || cluster.getString("coordinator_session_id"));
                }
                e.app.save(existing);
                addedWorkers.push({ session_id: sid, agent_name: existing.getString("agent_name"), swarm_role: wRole });
            } else {
                const rec = new Record(sessionCol);
                rec.set("session_id", sid);
                rec.set("agent_name", wName);
                rec.set("role", wRole);
                rec.set("swarm_role", wRole);
                rec.set("swarm_cluster_id", clusterId);
                rec.set("swarm_parent_id", w.swarm_parent_id || cluster.getString("coordinator_session_id"));
                rec.set("status", "running");
                rec.set("is_active", true);
                rec.set("model", w.model || "gpt-5.5");
                rec.set("prompt", w.prompt || cluster.getString("objective"));
                if (cluster.getString("project")) rec.set("project", cluster.getString("project"));
                if (w.issue_id) rec.set("issue", w.issue_id);
                e.app.save(rec);
                addedWorkers.push({ session_id: sid, agent_name: wName, swarm_role: wRole });
            }
        });

        const allWorkers = e.app.findRecordsByFilter("agent_sessions", "swarm_cluster_id = {:cid}", "-created", 500, 0, { cid: clusterId });
        cluster.set("total_workers", allWorkers.length);
        e.app.save(cluster);

        return e.json(201, {
            success: true,
            cluster_id: clusterId,
            added_count: addedWorkers.length,
            total_workers: allWorkers.length,
            workers: addedWorkers
        });
    } catch (err) {
        return e.json(500, { error: "Failed to add workers to cluster: " + err.message });
    }
});

// 10. POST /api/projectbase/swarm/clusters/{id}/status
routerAdd("POST", "/api/projectbase/swarm/clusters/{id}/status", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let cluster = null;
        try {
            cluster = e.app.findFirstRecordByFilter("swarm_clusters", "id = {:id} || cluster_id = {:id}", { id: id });
        } catch (x) {}
        if (!cluster) return e.json(404, { error: "Swarm cluster not found: " + id });

        const clusterId = cluster.getString("cluster_id");
        const info = e.requestInfo();
        const body = info.body || {};
        const targetStatus = body.status; // running | paused | completed | failed | aborted

        if (!["running", "paused", "completed", "failed", "aborted"].includes(targetStatus)) {
            return e.json(400, { error: "Invalid status. Allowed: running, paused, completed, failed, aborted" });
        }

        cluster.set("status", targetStatus);
        e.app.save(cluster);

        if (body.cascade !== false) {
            const workers = e.app.findRecordsByFilter("agent_sessions", "swarm_cluster_id = {:cid}", "-created", 500, 0, { cid: clusterId });
            workers.forEach(w => {
                if (targetStatus === "paused") {
                    w.set("is_paused", true);
                } else if (targetStatus === "running") {
                    w.set("is_paused", false);
                    w.set("status", "running");
                    w.set("is_active", true);
                } else if (targetStatus === "completed") {
                    w.set("status", "completed");
                    w.set("is_active", false);
                } else if (targetStatus === "aborted" || targetStatus === "failed") {
                    w.set("status", targetStatus === "aborted" ? "cancelled" : "failed");
                    w.set("is_active", false);
                }
                try { e.app.save(w); } catch (x) {}
            });
        }

        return e.json(200, {
            success: true,
            cluster_id: clusterId,
            status: targetStatus,
            message: "Cluster state updated to " + targetStatus
        });
    } catch (err) {
        return e.json(500, { error: "Failed to update cluster status: " + err.message });
    }
});

// 11. GET /api/projectbase/swarm/clusters/{id}/metrics
routerAdd("GET", "/api/projectbase/swarm/clusters/{id}/metrics", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let cluster = null;
        try {
            cluster = e.app.findFirstRecordByFilter("swarm_clusters", "id = {:id} || cluster_id = {:id}", { id: id });
        } catch (x) {}
        if (!cluster) return e.json(404, { error: "Swarm cluster not found: " + id });

        const clusterId = cluster.getString("cluster_id");
        const workers = e.app.findRecordsByFilter("agent_sessions", "swarm_cluster_id = {:cid}", "-created", 500, 0, { cid: clusterId });

        let totalSteps = 0;
        let totalTokens = 0;
        let totalCost = 0.0;
        let activeWorkers = 0;
        let pausedWorkers = 0;
        let completedWorkers = 0;
        let failedWorkers = 0;
        let roleBreakdown = {};
        let modelBreakdown = {};

        workers.forEach(w => {
            const steps = w.getInt("total_steps") || 0;
            const tokens = w.getInt("total_tokens") || 0;
            const cost = w.getFloat("total_cost_usd") || 0.0;
            const st = w.getString("status");
            const role = w.getString("swarm_role") || w.getString("role") || "worker";
            const model = w.getString("model") || "unknown";

            totalSteps += steps;
            totalTokens += tokens;
            totalCost += cost;

            if (w.getBool("is_paused")) pausedWorkers += 1;
            if (st === "running" || w.getBool("is_active")) activeWorkers += 1;
            else if (st === "completed") completedWorkers += 1;
            else if (st === "failed" || st === "cancelled") failedWorkers += 1;

            roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
            modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
        });

        cluster.set("total_workers", workers.length);
        cluster.set("total_steps", totalSteps);
        cluster.set("total_tokens", totalTokens);
        cluster.set("total_cost_usd", parseFloat(totalCost.toFixed(6)));
        try { e.app.save(cluster); } catch (x) {}

        return e.json(200, {
            cluster_id: clusterId,
            name: cluster.getString("name"),
            topology: cluster.getString("topology"),
            status: cluster.getString("status"),
            total_workers: workers.length,
            active_workers: activeWorkers,
            paused_workers: pausedWorkers,
            completed_workers: completedWorkers,
            failed_workers: failedWorkers,
            total_steps: totalSteps,
            total_tokens: totalTokens,
            total_cost_usd: parseFloat(totalCost.toFixed(6)),
            role_breakdown: roleBreakdown,
            model_breakdown: modelBreakdown
        });
    } catch (err) {
        return e.json(500, { error: "Failed to compute cluster metrics: " + err.message });
    }
});
