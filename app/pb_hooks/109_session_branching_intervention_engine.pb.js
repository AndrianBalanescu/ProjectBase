// pb_hooks/109_session_branching_intervention_engine.pb.js
// One-Click Session Branching, Re-Tasking, DAG Continuation & Human Intervention Gate (Milestone 4 / Epic 25).
//
// Endpoints:
// 1.  POST /api/projectbase/sessions/{id}/branch       - Create a branched/forked child session in DAG
// 2.  GET  /api/projectbase/sessions/{id}/dag          - Retrieve full lineage & downstream DAG tree for session
// 3.  GET  /api/projectbase/sessions/dag               - Retrieve workspace or project-wide session DAG graphs
// 4.  POST /api/projectbase/sessions/{id}/pause        - Pause agent session execution
// 5.  POST /api/projectbase/sessions/{id}/resume       - Resume paused agent session execution
// 6.  POST /api/projectbase/sessions/{id}/inject       - Inject steering instructions/constraints into live context
// 7.  GET  /api/projectbase/sessions/{id}/interventions - List all interventions & human inputs for session
// 8.  POST /api/projectbase/sessions/{id}/gate         - Set / resolve Human Intervention Gate status (approve/reject/pending)
// 9.  POST /api/projectbase/sessions/{id}/arbitrate    - Arbitrate worktree and file collision conflicts with other sessions
// 10. GET  /api/projectbase/sessions/conflicts         - Detect concurrent active sessions with colliding files_touched
// 11. POST /api/projectbase/sessions/swarm/dispatch    - Dispatch multi-agent fan-out swarm child sessions

// 1. POST /api/projectbase/sessions/{id}/branch - Create a branched/forked child session
routerAdd("POST", "/api/projectbase/sessions/{id}/branch", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const parseJson = (val, fallback) => {
            if (val === null || val === undefined || val === "") return fallback;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (x) { return fallback; }
            }
            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < val.length; i++) { s += String.fromCharCode(val[i]); }
                        return JSON.parse(s);
                    } catch (x) { return fallback; }
                }
                return val;
            }
            if (typeof val === "object") {
                try {
                    let str = JSON.stringify(val);
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
                        let s = "";
                        for (let i = 0; i < parsed.length; i++) { s += String.fromCharCode(parsed[i]); }
                        return JSON.parse(s);
                    }
                    return parsed;
                } catch (x) { return val; }
            }
            return fallback;
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let parent = null;
        try {
            parent = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!parent) return e.json(404, { error: "Parent session not found" });

        const parentSessionId = parent.getString("session_id") || parent.getString("id");
        const branchType = body.branch_type || "fork";
        const branchName = (body.branch_name || ("branch-" + Math.random().toString(36).substring(2, 8))).trim();
        const newSessionId = (body.new_session_id || ("sess_" + branchType + "_" + Math.random().toString(36).substring(2, 10))).trim();
        const promptOverride = body.prompt || body.command || parent.getString("command") || "";
        const parentGeneration = parent.getInt("generation") || 0;
        const generation = parentGeneration + 1;
        const worktreePath = body.worktree_path || (parent.getString("workdir") ? parent.getString("workdir") + "/.worktrees/" + branchName : "");

        let sessionCol = null;
        try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}
        if (!sessionCol) return e.json(500, { error: "agent_sessions collection not found" });

        const newRecord = new Record(sessionCol);
        newRecord.set("session_id", newSessionId);
        newRecord.set("parent_session_id", parentSessionId);
        newRecord.set("branch_name", branchName);
        newRecord.set("branch_type", branchType);
        newRecord.set("generation", generation);
        newRecord.set("project", parent.getString("project"));
        newRecord.set("issue", body.issue || parent.getString("issue"));
        newRecord.set("agent_name", body.agent_name || parent.getString("agent_name"));
        newRecord.set("runtime", body.runtime || parent.getString("runtime"));
        newRecord.set("model", body.model || parent.getString("model"));
        newRecord.set("status", body.status || "spawning");
        newRecord.set("workdir", body.workdir || parent.getString("workdir"));
        newRecord.set("worktree_path", worktreePath);
        newRecord.set("git_branch", body.git_branch || branchName);
        newRecord.set("git_commit_before", parent.getString("git_commit_after") || parent.getString("git_commit_before"));
        newRecord.set("command", promptOverride);
        newRecord.set("is_paused", false);
        newRecord.set("intervention_gate", "none");
        newRecord.set("conflict_status", "clean");
        newRecord.set("started_at", new Date().toISOString());

        let metadata = parseJson(parent.get("metadata"), {});
        if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) metadata = {};
        metadata.forked_from_session = parentSessionId;
        metadata.branch_type = branchType;
        metadata.branch_name = branchName;
        metadata.branch_created_at = new Date().toISOString();
        if (body.metadata && typeof body.metadata === "object") {
            Object.assign(metadata, body.metadata);
        }
        newRecord.set("metadata", JSON.stringify(metadata));

        e.app.save(newRecord);

        // Record intervention audit entry
        try {
            let interventionCol = e.app.findCollectionByNameOrId("session_interventions");
            if (interventionCol) {
                const intRec = new Record(interventionCol);
                intRec.set("session_id", newSessionId);
                intRec.set("session", newRecord.getString("id"));
                intRec.set("project", newRecord.getString("project"));
                intRec.set("action_type", "branch_forked");
                intRec.set("instruction", `Branched from ${parentSessionId} (${branchType}: ${branchName})`);
                intRec.set("author", (e.auth && e.auth.getString("email")) || "system");
                intRec.set("status", "success");
                intRec.set("payload", JSON.stringify({
                    parent_session_id: parentSessionId,
                    branch_name: branchName,
                    branch_type: branchType,
                    generation: generation
                }));
                e.app.save(intRec);
            }
        } catch (x) {}

        return e.json(201, {
            success: true,
            message: `Child session branched successfully (${branchType})`,
            id: newRecord.getString("id"),
            session_id: newSessionId,
            parent_session_id: parentSessionId,
            branch_name: branchName,
            branch_type: branchType,
            generation: generation,
            worktree_path: worktreePath,
            status: "spawning"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 2. GET /api/projectbase/sessions/{id}/dag - Retrieve full DAG tree for session
routerAdd("GET", "/api/projectbase/sessions/{id}/dag", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let target = null;
        try {
            target = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!target) return e.json(404, { error: "Session not found" });

        const projectId = target.getString("project");
        let filter = "1=1";
        let params = {};
        if (projectId) {
            filter = "project = {:p}";
            params = { p: projectId };
        }
        const allSessions = e.app.findRecordsByFilter("agent_sessions", filter, "-created", 5000, 0, params);

        let sessionMap = {};
        allSessions.forEach(s => {
            const sid = s.getString("session_id") || s.getString("id");
            sessionMap[sid] = s;
            sessionMap[s.getString("id")] = s;
            if (s.getString("session_id")) sessionMap[s.getString("session_id")] = s;
        });
        sessionMap[target.getString("id")] = target;
        if (target.getString("session_id")) sessionMap[target.getString("session_id")] = target;

        let current = target;
        let root = target;
        let visited = new Set();
        while (current) {
            const sid = current.getString("session_id") || current.getString("id");
            if (visited.has(sid)) break;
            visited.add(sid);
            root = current;
            const parentSid = current.getString("parent_session_id");
            if (!parentSid) break;
            let pRec = sessionMap[parentSid];
            if (!pRec) {
                try {
                    pRec = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: parentSid });
                    if (pRec) {
                        sessionMap[pRec.getString("id")] = pRec;
                        if (pRec.getString("session_id")) sessionMap[pRec.getString("session_id")] = pRec;
                    }
                } catch (x) {}
            }
            if (!pRec) break;
            current = pRec;
        }

        const rootSid = root.getString("session_id") || root.getString("id");
        let dagNodeIds = new Set();
        dagNodeIds.add(rootSid);

        let expanded = true;
        while (expanded) {
            expanded = false;
            allSessions.forEach(s => {
                const sid = s.getString("session_id") || s.getString("id");
                const psid = s.getString("parent_session_id");
                if (psid && dagNodeIds.has(psid) && !dagNodeIds.has(sid)) {
                    dagNodeIds.add(sid);
                    expanded = true;
                }
            });
        }

        let nodes = [];
        let edges = [];

        dagNodeIds.forEach(sid => {
            const s = sessionMap[sid];
            if (!s) return;
            nodes.push({
                id: s.getString("id"),
                session_id: sid,
                agent_name: s.getString("agent_name"),
                model: s.getString("model"),
                status: s.getString("status"),
                branch_name: s.getString("branch_name") || "main",
                branch_type: s.getString("branch_type") || (sid === rootSid ? "root" : "fork"),
                generation: s.getInt("generation") || 0,
                is_paused: s.getBool("is_paused"),
                intervention_gate: s.getString("intervention_gate") || "none",
                verification_badge: s.getString("verification_badge") || "unverified",
                verification_score: s.getInt("verification_score") || 0,
                parent_session_id: s.getString("parent_session_id") || null,
                is_target: sid === (target.getString("session_id") || target.getString("id")),
                is_root: sid === rootSid,
                created: s.getString("created")
            });

            const psid = s.getString("parent_session_id");
            if (psid && dagNodeIds.has(psid)) {
                edges.push({
                    from: psid,
                    to: sid,
                    branch_type: s.getString("branch_type") || "fork",
                    branch_name: s.getString("branch_name") || ""
                });
            }
        });

        let maxGeneration = 0;
        nodes.forEach(n => {
            if (n.generation > maxGeneration) maxGeneration = n.generation;
        });

        return e.json(200, {
            target_session_id: target.getString("session_id") || target.getString("id"),
            root_session_id: rootSid,
            total_nodes: nodes.length,
            total_edges: edges.length,
            max_generation: maxGeneration,
            nodes: nodes,
            edges: edges
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 3. GET /api/projectbase/sessions/dag - Retrieve all DAGs across project or workspace
routerAdd("GET", "/api/projectbase/sessions/dag", (e) => {
    try {
        const query = e.requestInfo().query || {};
        let projectId = query.project || "";
        if (projectId) {
            try {
                const prec = e.app.findFirstRecordByFilter("projects", "id = {:p} || slug = {:p} || name = {:p}", { p: projectId });
                if (prec) projectId = prec.getString("id");
            } catch (x) {}
        }

        let filter = "1=1";
        let params = {};
        if (projectId) {
            filter = "project = {:p}";
            params = { p: projectId };
        }
        const sessions = e.app.findRecordsByFilter("agent_sessions", filter, "-created", 200, 0, params);

        let nodes = [];
        let edges = [];
        let rootSessions = [];

        sessions.forEach(s => {
            const sid = s.getString("session_id") || s.getString("id");
            const psid = s.getString("parent_session_id");
            if (!psid) {
                rootSessions.push(sid);
            } else {
                edges.push({
                    from: psid,
                    to: sid,
                    branch_type: s.getString("branch_type") || "fork",
                    branch_name: s.getString("branch_name") || ""
                });
            }
            nodes.push({
                id: s.getString("id"),
                session_id: sid,
                agent_name: s.getString("agent_name"),
                model: s.getString("model"),
                status: s.getString("status"),
                branch_name: s.getString("branch_name") || "main",
                branch_type: s.getString("branch_type") || (psid ? "fork" : "root"),
                generation: s.getInt("generation") || 0,
                is_paused: s.getBool("is_paused"),
                intervention_gate: s.getString("intervention_gate") || "none",
                parent_session_id: psid || null
            });
        });

        return e.json(200, {
            total_sessions: nodes.length,
            root_count: rootSessions.length,
            nodes: nodes,
            edges: edges
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 4. POST /api/projectbase/sessions/{id}/pause - Pause session
routerAdd("POST", "/api/projectbase/sessions/{id}/pause", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let session = null;
        try {
            session = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!session) return e.json(404, { error: "Session not found" });

        const reason = body.reason || "Manual human pause requested";
        session.set("is_paused", true);
        e.app.save(session);

        // Record intervention
        try {
            let intCol = e.app.findCollectionByNameOrId("session_interventions");
            if (intCol) {
                const intRec = new Record(intCol);
                intRec.set("session_id", session.getString("session_id") || session.getString("id"));
                intRec.set("session", session.getString("id"));
                intRec.set("project", session.getString("project"));
                intRec.set("action_type", "paused");
                intRec.set("instruction", reason);
                intRec.set("author", (e.auth && e.auth.getString("email")) || "human_operator");
                intRec.set("status", "paused");
                intRec.set("payload", JSON.stringify({ reason: reason, paused_at: new Date().toISOString() }));
                e.app.save(intRec);
            }
        } catch (x) {}

        return e.json(200, {
            success: true,
            session_id: session.getString("session_id") || session.getString("id"),
            is_paused: true,
            status: session.getString("status"),
            message: "Session successfully paused"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 5. POST /api/projectbase/sessions/{id}/resume - Resume session
routerAdd("POST", "/api/projectbase/sessions/{id}/resume", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let session = null;
        try {
            session = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!session) return e.json(404, { error: "Session not found" });

        session.set("is_paused", false);
        e.app.save(session);

        // Record intervention
        try {
            let intCol = e.app.findCollectionByNameOrId("session_interventions");
            if (intCol) {
                const intRec = new Record(intCol);
                intRec.set("session_id", session.getString("session_id") || session.getString("id"));
                intRec.set("session", session.getString("id"));
                intRec.set("project", session.getString("project"));
                intRec.set("action_type", "resumed");
                intRec.set("instruction", body.reason || "Execution resumed by operator");
                intRec.set("author", (e.auth && e.auth.getString("email")) || "human_operator");
                intRec.set("status", "running");
                intRec.set("payload", JSON.stringify({ resumed_at: new Date().toISOString() }));
                e.app.save(intRec);
            }
        } catch (x) {}

        return e.json(200, {
            success: true,
            session_id: session.getString("session_id") || session.getString("id"),
            is_paused: false,
            status: session.getString("status"),
            message: "Session successfully resumed"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 6. POST /api/projectbase/sessions/{id}/inject - Inject human steerings/constraints into live context
routerAdd("POST", "/api/projectbase/sessions/{id}/inject", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const parseJson = (val, fallback) => {
            if (val === null || val === undefined || val === "") return fallback;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (x) { return fallback; }
            }
            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < val.length; i++) { s += String.fromCharCode(val[i]); }
                        return JSON.parse(s);
                    } catch (x) { return fallback; }
                }
                return val;
            }
            if (typeof val === "object") {
                try {
                    let str = JSON.stringify(val);
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
                        let s = "";
                        for (let i = 0; i < parsed.length; i++) { s += String.fromCharCode(parsed[i]); }
                        return JSON.parse(s);
                    }
                    return parsed;
                } catch (x) { return val; }
            }
            return fallback;
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let session = null;
        try {
            session = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!session) return e.json(404, { error: "Session not found" });

        const instructionText = (body.instruction || body.prompt || body.message || "").trim();
        if (!instructionText) return e.json(400, { error: "Instruction content is required" });

        const author = body.author || (e.auth && e.auth.getString("email")) || "human_operator";
        const instructionId = "inj_" + Math.random().toString(36).substring(2, 9);

        let instructions = parseJson(session.get("injected_instructions"), []);
        if (!Array.isArray(instructions)) instructions = [];

        const newInstruction = {
            id: instructionId,
            instruction: instructionText,
            author: author,
            priority: body.priority || "high",
            injected_at: new Date().toISOString(),
            applied: false
        };
        instructions.push(newInstruction);
        session.set("injected_instructions", JSON.stringify(instructions));
        e.app.save(session);

        // Record in session_interventions
        let interventionId = "";
        try {
            let intCol = e.app.findCollectionByNameOrId("session_interventions");
            if (intCol) {
                const intRec = new Record(intCol);
                intRec.set("session_id", session.getString("session_id") || session.getString("id"));
                intRec.set("session", session.getString("id"));
                intRec.set("project", session.getString("project"));
                intRec.set("action_type", "instruction_injected");
                intRec.set("instruction", instructionText);
                intRec.set("author", author);
                intRec.set("status", "pending_pickup");
                intRec.set("payload", JSON.stringify(newInstruction));
                e.app.save(intRec);
                interventionId = intRec.getString("id");
            }
        } catch (x) {}

        return e.json(201, {
            success: true,
            session_id: session.getString("session_id") || session.getString("id"),
            instruction_id: instructionId,
            intervention_id: interventionId,
            total_injected: instructions.length,
            instruction: newInstruction,
            message: "Instruction successfully injected into agent session context"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 7. GET /api/projectbase/sessions/{id}/interventions - List all interventions for session
routerAdd("GET", "/api/projectbase/sessions/{id}/interventions", (e) => {
    try {
        const parseJson = (val, fallback) => {
            if (val === null || val === undefined || val === "") return fallback;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (x) { return fallback; }
            }
            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < val.length; i++) { s += String.fromCharCode(val[i]); }
                        return JSON.parse(s);
                    } catch (x) { return fallback; }
                }
                return val;
            }
            if (typeof val === "object") {
                try {
                    let str = JSON.stringify(val);
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
                        let s = "";
                        for (let i = 0; i < parsed.length; i++) { s += String.fromCharCode(parsed[i]); }
                        return JSON.parse(s);
                    }
                    return parsed;
                } catch (x) { return val; }
            }
            return fallback;
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let session = null;
        try {
            session = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!session) return e.json(404, { error: "Session not found" });

        const sid = session.getString("session_id") || session.getString("id");
        let interventions = [];
        try {
            interventions = e.app.findRecordsByFilter("session_interventions", "session_id = {:sid} || session = {:srec}", "-created", 100, 0, {
                sid: sid,
                srec: session.getString("id")
            });
        } catch (x) {}

        let list = interventions.map(rec => {
            let payload = parseJson(rec.get("payload"), {});
            return {
                id: rec.getString("id"),
                session_id: rec.getString("session_id"),
                action_type: rec.getString("action_type"),
                instruction: rec.getString("instruction"),
                author: rec.getString("author"),
                status: rec.getString("status"),
                payload: payload,
                created: rec.getString("created")
            };
        });

        let injectedQueue = [];
        list.forEach(item => {
            if (item.action_type === "instruction_injected") {
                injectedQueue.push(item.payload && typeof item.payload === "object" && item.payload.instruction ? item.payload : {
                    id: item.id,
                    instruction: item.instruction,
                    author: item.author,
                    priority: "high",
                    injected_at: item.created,
                    applied: item.status === "applied"
                });
            }
        });
        if (injectedQueue.length === 0) {
            injectedQueue = parseJson(session.get("injected_instructions"), []);
        }
        if (!Array.isArray(injectedQueue)) injectedQueue = [];

        return e.json(200, {
            session_id: sid,
            is_paused: session.getBool("is_paused"),
            intervention_gate: session.getString("intervention_gate") || "none",
            total_interventions: list.length,
            injected_instructions_queue: injectedQueue,
            interventions: list
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 8. POST /api/projectbase/sessions/{id}/gate - Set / resolve Human Intervention Gate status
routerAdd("POST", "/api/projectbase/sessions/{id}/gate", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let session = null;
        try {
            session = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!session) return e.json(404, { error: "Session not found" });

        const action = (body.action || body.gate_status || body.status || "").toLowerCase().trim();
        const comment = body.comment || body.reason || "";
        const reviewer = body.reviewer || (e.auth && e.auth.getString("email")) || "human_reviewer";

        let newGateState = "none";
        let actionType = "gate_approved";

        if (action === "approve" || action === "human_approved" || action === "approved") {
            newGateState = "human_approved";
            actionType = "gate_approved";
            if (session.getString("status") === "verifying" || session.getString("status") === "spawning") {
                session.set("status", "completed");
            }
        } else if (action === "reject" || action === "human_rejected" || action === "rejected") {
            newGateState = "human_rejected";
            actionType = "gate_rejected";
            session.set("status", "failed");
        } else if (action === "require_review" || action === "pending_human_review" || action === "pending") {
            newGateState = "pending_human_review";
            actionType = "instruction_injected";
        } else if (action === "auto_pass" || action === "auto_passed") {
            newGateState = "auto_passed";
            actionType = "gate_approved";
        } else {
            return e.json(400, { error: "Invalid gate action. Must be 'approve', 'reject', 'require_review', or 'auto_pass'" });
        }

        session.set("intervention_gate", newGateState);
        e.app.save(session);

        // Record in session_interventions
        try {
            let intCol = e.app.findCollectionByNameOrId("session_interventions");
            if (intCol) {
                const intRec = new Record(intCol);
                intRec.set("session_id", session.getString("session_id") || session.getString("id"));
                intRec.set("session", session.getString("id"));
                intRec.set("project", session.getString("project"));
                intRec.set("action_type", actionType);
                intRec.set("instruction", `Gate ${newGateState}: ${comment}`);
                intRec.set("author", reviewer);
                intRec.set("status", newGateState);
                intRec.set("payload", JSON.stringify({
                    gate_status: newGateState,
                    reviewer: reviewer,
                    comment: comment,
                    decided_at: new Date().toISOString()
                }));
                e.app.save(intRec);
            }
        } catch (x) {}

        return e.json(200, {
            success: true,
            session_id: session.getString("session_id") || session.getString("id"),
            intervention_gate: newGateState,
            status: session.getString("status"),
            reviewer: reviewer,
            comment: comment,
            message: `Human intervention gate set to ${newGateState}`
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 9. POST /api/projectbase/sessions/{id}/arbitrate - Arbitrate worktree and file collisions
routerAdd("POST", "/api/projectbase/sessions/{id}/arbitrate", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const parseJson = (val, fallback) => {
            if (val === null || val === undefined || val === "") return fallback;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (x) { return fallback; }
            }
            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < val.length; i++) { s += String.fromCharCode(val[i]); }
                        return JSON.parse(s);
                    } catch (x) { return fallback; }
                }
                return val;
            }
            if (typeof val === "object") {
                try {
                    let str = JSON.stringify(val);
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
                        let s = "";
                        for (let i = 0; i < parsed.length; i++) { s += String.fromCharCode(parsed[i]); }
                        return JSON.parse(s);
                    }
                    return parsed;
                } catch (x) { return val; }
            }
            return fallback;
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let session = null;
        try {
            session = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}
        if (!session) return e.json(404, { error: "Session not found" });

        const sid = session.getString("session_id") || session.getString("id");
        const projectId = session.getString("project");

        let filesTouched = parseJson(session.get("files_touched"), []);
        if (!Array.isArray(filesTouched)) filesTouched = [];

        // Check against other active sessions in the same project
        let otherActive = [];
        try {
            let filter = "id != {:id} && session_id != {:sid} && (status = 'running' || status = 'verifying' || status = 'spawning')";
            let params = { id: session.getString("id"), sid: sid };
            if (projectId) {
                filter = "project = {:p} && " + filter;
                params.p = projectId;
            }
            otherActive = e.app.findRecordsByFilter("agent_sessions", filter, "-created", 50, 0, params);
        } catch (x) {}

        let conflicts = [];
        otherActive.forEach(other => {
            const otherSid = other.getString("session_id") || other.getString("id");
            let otherFiles = parseJson(other.get("files_touched"), []);
            if (!Array.isArray(otherFiles)) otherFiles = [];

            const overlappingFiles = filesTouched.filter(f => otherFiles.indexOf(f) !== -1);
            if (overlappingFiles.length > 0) {
                conflicts.push({
                    conflicting_session_id: otherSid,
                    conflicting_agent: other.getString("agent_name"),
                    conflicting_status: other.getString("status"),
                    overlapping_files: overlappingFiles
                });
            }
        });

        const resolutionStrategy = body.strategy || (conflicts.length > 0 ? "isolated_worktree_rebase" : "direct_merge");
        const conflictStatus = conflicts.length > 0 ? (body.resolve ? "resolved" : "conflict_detected") : "clean";

        session.set("conflict_status", conflictStatus);
        e.app.save(session);

        // Record arbitration intervention
        if (conflicts.length > 0 || body.resolve) {
            try {
                let intCol = e.app.findCollectionByNameOrId("session_interventions");
                if (intCol) {
                    const intRec = new Record(intCol);
                    intRec.set("session_id", sid);
                    intRec.set("session", session.getString("id"));
                    intRec.set("project", session.getString("project"));
                    intRec.set("action_type", "conflict_arbitrated");
                    intRec.set("instruction", `Arbitration (${conflictStatus}): ${resolutionStrategy}`);
                    intRec.set("author", (e.auth && e.auth.getString("email")) || "arbitration_engine");
                    intRec.set("status", conflictStatus);
                    intRec.set("payload", JSON.stringify({
                        conflicts: conflicts,
                        strategy: resolutionStrategy,
                        resolved: conflictStatus === "resolved"
                    }));
                    e.app.save(intRec);
                }
            } catch (x) {}
        }

        return e.json(200, {
            success: true,
            session_id: sid,
            conflict_status: conflictStatus,
            has_conflicts: conflicts.length > 0,
            conflict_count: conflicts.length,
            conflicts: conflicts,
            recommended_strategy: resolutionStrategy,
            files_touched: filesTouched,
            message: conflicts.length > 0 ? `Found ${conflicts.length} session file collision(s)` : "No worktree file collisions detected"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 10. GET /api/projectbase/sessions/conflicts - Detect concurrent session file collisions
routerAdd("GET", "/api/projectbase/sessions/conflicts", (e) => {
    try {
        const parseJson = (val, fallback) => {
            if (val === null || val === undefined || val === "") return fallback;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (x) { return fallback; }
            }
            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < val.length; i++) { s += String.fromCharCode(val[i]); }
                        return JSON.parse(s);
                    } catch (x) { return fallback; }
                }
                return val;
            }
            if (typeof val === "object") {
                try {
                    let str = JSON.stringify(val);
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
                        let s = "";
                        for (let i = 0; i < parsed.length; i++) { s += String.fromCharCode(parsed[i]); }
                        return JSON.parse(s);
                    }
                    return parsed;
                } catch (x) { return val; }
            }
            return fallback;
        };

        const query = e.requestInfo().query || {};
        let projectId = query.project || "";
        if (projectId) {
            try {
                const prec = e.app.findFirstRecordByFilter("projects", "id = {:p} || slug = {:p} || name = {:p}", { p: projectId });
                if (prec) projectId = prec.getString("id");
            } catch (x) {}
        }

        let filter = "(status = 'running' || status = 'verifying' || status = 'spawning')";
        let params = {};
        if (projectId) {
            filter += " && project = {:p}";
            params = { p: projectId };
        }
        const activeSessions = e.app.findRecordsByFilter("agent_sessions", filter, "-created", 100, 0, params);

        let fileMap = {};
        let conflictPairs = [];

        activeSessions.forEach(s => {
            const sid = s.getString("session_id") || s.getString("id");
            let files = parseJson(s.get("files_touched"), []);
            if (Array.isArray(files)) {
                files.forEach(f => {
                    if (!fileMap[f]) fileMap[f] = [];
                    fileMap[f].push({
                        session_id: sid,
                        agent_name: s.getString("agent_name"),
                        status: s.getString("status"),
                        branch_name: s.getString("branch_name") || "main"
                    });
                });
            }
        });

        Object.keys(fileMap).forEach(filePath => {
            const touchingSessions = fileMap[filePath];
            if (touchingSessions.length > 1) {
                conflictPairs.push({
                    file: filePath,
                    sessions: touchingSessions
                });
            }
        });

        return e.json(200, {
            active_sessions_checked: activeSessions.length,
            conflicting_files_count: conflictPairs.length,
            conflicts: conflictPairs,
            has_conflicts: conflictPairs.length > 0
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 11. POST /api/projectbase/sessions/swarm/dispatch - Dispatch multi-agent swarm child sessions
routerAdd("POST", "/api/projectbase/sessions/swarm/dispatch", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const body = e.requestInfo().body || {};
        const rootSessionId = body.root_session_id || body.parent_session_id || "";
        let parentRecord = null;
        if (rootSessionId) {
            try {
                parentRecord = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: rootSessionId });
            } catch (x) {}
        }

        const workers = body.workers || [
            { role: "researcher", agent_name: "ResearchScout", model: "rc/perplexity-sonar-reasoning-pro", prompt: "Conduct multi-source analysis and technical validation" },
            { role: "implementer", agent_name: "FlomasterBuilder", model: "claude-api:claude-fable-5", prompt: "Implement architecture and core algorithms" },
            { role: "auditor", agent_name: "ScepticAuditor", model: "deepseek/deepseek-r1-distill-llama-70b", prompt: "Perform adversarial inspection and vulnerability verification" }
        ];

        let sessionCol = null;
        try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}
        if (!sessionCol) return e.json(500, { error: "agent_sessions collection not found" });

        let projectId = (parentRecord && parentRecord.getString("project")) || body.project || "";
        if (projectId) {
            try {
                const prec = e.app.findFirstRecordByFilter("projects", "id = {:p} || slug = {:p} || name = {:p}", { p: projectId });
                if (prec) projectId = prec.getString("id");
            } catch (x) {}
        }
        const issueId = (parentRecord && parentRecord.getString("issue")) || body.issue || "";
        const workdir = (parentRecord && parentRecord.getString("workdir")) || body.workdir || "";
        const baseGeneration = (parentRecord ? parentRecord.getInt("generation") : 0) + 1;

        let spawnedSessions = [];

        workers.forEach((w, idx) => {
            const workerSessionId = "sess_swarm_" + (w.role || "worker") + "_" + Math.random().toString(36).substring(2, 8);
            const branchName = "swarm/" + (w.role || "worker-" + (idx + 1));

            const rec = new Record(sessionCol);
            rec.set("session_id", workerSessionId);
            if (parentRecord) {
                rec.set("parent_session_id", parentRecord.getString("session_id") || parentRecord.getString("id"));
            }
            rec.set("branch_name", branchName);
            rec.set("branch_type", "swarm_worker");
            rec.set("generation", baseGeneration);
            rec.set("project", projectId);
            rec.set("issue", issueId);
            rec.set("agent_name", w.agent_name || ("Worker-" + (w.role || idx)));
            rec.set("runtime", w.runtime || (parentRecord ? parentRecord.getString("runtime") : "flomaster"));
            rec.set("model", w.model || (parentRecord ? parentRecord.getString("model") : "default"));
            rec.set("status", "spawning");
            rec.set("workdir", workdir);
            rec.set("worktree_path", workdir ? `${workdir}/.worktrees/${branchName}` : "");
            rec.set("git_branch", branchName);
            rec.set("command", w.prompt || `Autonomous task for ${w.role}`);
            rec.set("is_paused", false);
            rec.set("intervention_gate", "none");
            rec.set("conflict_status", "clean");
            rec.set("started_at", new Date().toISOString());
            rec.set("metadata", JSON.stringify({
                swarm_dispatch: true,
                role: w.role || "worker",
                root_session_id: rootSessionId,
                dispatched_at: new Date().toISOString()
            }));

            e.app.save(rec);

            spawnedSessions.push({
                session_id: workerSessionId,
                id: rec.getString("id"),
                role: w.role,
                agent_name: rec.getString("agent_name"),
                model: rec.getString("model"),
                branch_name: branchName,
                status: "spawning"
            });
        });

        // Record swarm dispatch intervention
        try {
            let intCol = e.app.findCollectionByNameOrId("session_interventions");
            if (intCol && parentRecord) {
                const intRec = new Record(intCol);
                intRec.set("session_id", parentRecord.getString("session_id") || parentRecord.getString("id"));
                intRec.set("session", parentRecord.getString("id"));
                intRec.set("project", projectId);
                intRec.set("action_type", "swarm_dispatched");
                intRec.set("instruction", `Dispatched swarm of ${spawnedSessions.length} parallel workers`);
                intRec.set("author", (e.auth && e.auth.getString("email")) || "swarm_coordinator");
                intRec.set("status", "dispatched");
                intRec.set("payload", JSON.stringify({ workers: spawnedSessions }));
                e.app.save(intRec);
            }
        } catch (x) {}

        return e.json(201, {
            success: true,
            root_session_id: rootSessionId,
            workers_count: spawnedSessions.length,
            workers: spawnedSessions,
            message: `Dispatched ${spawnedSessions.length} swarm child sessions`
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});
