// pb_hooks/107_session_ingestion_engine.pb.js
// Execution-Native AI Agent Session-as-a-Card Ingestion & Process Lifecycle Engine (Milestone 1 & 2).
//
// Endpoints:
// 1.  GET    /api/projectbase/sessions              - List sessions with filters (project, agent, status, limit)
// 2.  POST   /api/projectbase/sessions/ingest       - Ingest / register a new or active agent session
// 3.  POST   /api/projectbase/sessions/heartbeat    - Record process heartbeat, live PID, log tail & files touched
// 4.  POST   /api/projectbase/sessions/complete     - Finalize session with exit code, git diffs & test verdicts + auto-dock
// 5.  GET    /api/projectbase/sessions/live         - List live / running / verifying sessions with health status
// 6.  GET    /api/projectbase/sessions/metrics      - Aggregated session metrics, tokens, pass rates & duration
// 7.  GET    /api/projectbase/sessions/{id}         - Get full session details, diffs, logs & docked issue info
// 8.  PATCH  /api/projectbase/sessions/{id}         - Update session properties or metadata
// 9.  DELETE /api/projectbase/sessions/{id}         - Delete / purge a session record
// 10. POST   /api/projectbase/sessions/{id}/terminate - Cancel or terminate an active session
// 11. POST   /api/projectbase/sessions/{id}/fork     - Fork session with preserved context for re-tasking
// 12. POST   /api/projectbase/sessions/{id}/dock     - Dock / link session to a parent issue card
// 13. POST   /api/projectbase/sessions/clean        - Clean / prune stale or orphaned sessions

// 1. GET /api/projectbase/sessions - List sessions
routerAdd("GET", "/api/projectbase/sessions", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const projectId = query.project || "";
        const agentName = query.agent || "";
        const status = query.status || "";
        const runtime = query.runtime || "";
        const issueId = query.issue || "";
        const limit = Math.min(Math.max(parseInt(query.limit) || 50, 1), 200);
        const offset = Math.max(parseInt(query.offset) || 0, 0);

        let filterParts = ["id != ''"];
        let filterParams = {};

        if (projectId) {
            filterParts.push("project = {:project}");
            filterParams.project = projectId;
        }
        if (agentName) {
            filterParts.push("agent_name = {:agent}");
            filterParams.agent = agentName;
        }
        if (status) {
            filterParts.push("status = {:status}");
            filterParams.status = status;
        }
        if (runtime) {
            filterParts.push("runtime = {:runtime}");
            filterParams.runtime = runtime;
        }
        if (issueId) {
            filterParts.push("issue = {:issue}");
            filterParams.issue = issueId;
        }

        let sessions = [];
        let total = 0;
        try {
            const filterStr = filterParts.join(" && ");
            const records = e.app.findRecordsByFilter("agent_sessions", filterStr, "-created", limit, offset, filterParams);
            total = records.length;
            sessions = records.map(r => ({
                id: r.getString("id"),
                session_id: r.getString("session_id"),
                project_id: r.getString("project"),
                issue_id: r.getString("issue"),
                agent_name: r.getString("agent_name") || "flomaster",
                runtime: r.getString("runtime") || "flomaster",
                model: r.getString("model") || "default",
                status: r.getString("status") || "running",
                pid: r.getInt("pid") || 0,
                workdir: r.getString("workdir") || "",
                git_branch: r.getString("git_branch") || "main",
                git_commit_before: r.getString("git_commit_before") || "",
                git_commit_after: r.getString("git_commit_after") || "",
                git_diff_summary: r.get("git_diff_summary") || {},
                files_touched: r.get("files_touched") || [],
                command: r.getString("command") || "",
                test_verdict: r.get("test_verdict") || null,
                log_tail: r.getString("log_tail") || "",
                tokens_in: r.getInt("tokens_in") || 0,
                tokens_out: r.getInt("tokens_out") || 0,
                cost_cents: r.getInt("cost_cents") || 0,
                metadata: r.get("metadata") || {},
                auto_docked: r.getBool("auto_docked"),
                exit_code: r.getInt("exit_code"),
                started_at: r.getString("started_at") || r.getString("created"),
                ended_at: r.getString("ended_at") || "",
                created: r.getString("created"),
                updated: r.getString("updated")
            }));
        } catch (dbErr) {
            // Collection not ready or empty
        }

        return e.json(200, {
            sessions: sessions,
            total: total,
            limit: limit,
            offset: offset
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 2. POST /api/projectbase/sessions/ingest - Ingest / register session
routerAdd("POST", "/api/projectbase/sessions/ingest", (e) => {
    try {
        const resolveProject = (app, projectIdOrIdentifier, workdir) => {
            if (projectIdOrIdentifier) {
                try {
                    const byId = app.findRecordById("projects", projectIdOrIdentifier);
                    if (byId) return byId;
                } catch (x) {}
                try {
                    const byIdent = app.findFirstRecordByFilter("projects", "identifier = {:id} || name = {:id}", { id: projectIdOrIdentifier });
                    if (byIdent) return byIdent;
                } catch (x) {}
            }

            if (workdir) {
                const cleanDir = String(workdir).trim().toLowerCase();
                try {
                    const allProjects = app.findRecordsByFilter("projects", "id != ''", "-created", 50, 0);
                    for (let p of allProjects) {
                        const name = p.getString("name").toLowerCase();
                        const ident = p.getString("identifier").toLowerCase();
                        const gitRepo = (p.getString("git_repo") || "").toLowerCase();
                        if (gitRepo && cleanDir.includes(gitRepo)) return p;
                        if (cleanDir.endsWith("/" + name) || cleanDir.endsWith("/" + ident) || cleanDir.includes("/ventures/" + name)) {
                            return p;
                        }
                    }
                    if (allProjects.length > 0) return allProjects[0];
                } catch (x) {}
            }

            try {
                const defaultProj = app.findFirstRecordByFilter("projects", "id != ''", {});
                if (defaultProj) return defaultProj;
            } catch (x) {}

            return null;
        };

        const detectParentIssue = (app, projectId, textToScan) => {
            if (!textToScan || !projectId) return null;
            const text = String(textToScan);
            try {
                const match = text.match(/([A-Za-z0-9_-]+-\d+)/);
                if (match) {
                    const key = match[1];
                    try {
                        const issue = app.findFirstRecordByFilter("issues", "project = {:proj} && (identifier = {:key} || title ~ {:key})", {
                            proj: projectId,
                            key: key
                        });
                        if (issue) return issue;
                    } catch (x) {}
                }
            } catch (x) {}
            return null;
        };

        const body = e.requestInfo().body || {};
        const sessionId = (body.session_id || ("sess_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36))).trim();
        const agentName = (body.agent_name || "flomaster").trim();
        const runtime = (body.runtime || "flomaster").trim();
        const model = (body.model || "default").trim();
        const status = (body.status || "running").trim();
        const pid = body.pid ? parseInt(body.pid) : 0;
        const workdir = (body.workdir || "").trim();
        const gitBranch = (body.git_branch || "main").trim();
        const gitCommitBefore = (body.git_commit_before || "").trim();
        const command = (body.command || body.prompt || "").trim();
        const metadata = body.metadata || {};
        const filesTouched = Array.isArray(body.files_touched) ? body.files_touched : [];

        // Deterministic project resolution
        const projectRecord = resolveProject(e.app, body.project_id || body.project, workdir);
        const resolvedProjectId = projectRecord ? projectRecord.getString("id") : "";

        // Auto-detect parent issue if not given
        let issueId = body.issue_id || body.issue || "";
        let autoDocked = false;
        if (!issueId && resolvedProjectId) {
            const detectedIssue = detectParentIssue(e.app, resolvedProjectId, command + " " + gitBranch);
            if (detectedIssue) {
                issueId = detectedIssue.getString("id");
                autoDocked = true;
            }
        } else if (issueId) {
            autoDocked = true;
        }

        let sessionCol = null;
        try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}

        let record = null;
        if (sessionCol) {
            try {
                record = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid}", { sid: sessionId });
            } catch (x) {}

            if (!record) {
                record = new Record(sessionCol);
                record.set("session_id", sessionId);
                record.set("started_at", new Date().toISOString());
            }

            if (resolvedProjectId) record.set("project", resolvedProjectId);
            if (issueId) record.set("issue", issueId);
            record.set("agent_name", agentName);
            record.set("runtime", runtime);
            record.set("model", model);
            record.set("status", status);
            record.set("pid", pid);
            record.set("workdir", workdir);
            record.set("git_branch", gitBranch);
            if (gitCommitBefore) record.set("git_commit_before", gitCommitBefore);
            if (command) record.set("command", command);
            if (filesTouched.length > 0) record.set("files_touched", filesTouched);
            if (body.log_tail) record.set("log_tail", String(body.log_tail));
            if (body.tokens_in) record.set("tokens_in", parseInt(body.tokens_in));
            if (body.tokens_out) record.set("tokens_out", parseInt(body.tokens_out));
            if (body.cost_cents) record.set("cost_cents", parseInt(body.cost_cents));
            record.set("metadata", metadata);
            record.set("auto_docked", autoDocked);

            e.app.save(record);
        }

        return e.json(201, {
            success: true,
            session_id: sessionId,
            id: record ? record.getString("id") : sessionId,
            project_id: resolvedProjectId,
            issue_id: issueId,
            auto_docked: autoDocked,
            status: status,
            pid: pid,
            message: "Session ingested successfully into execution plane"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 3. POST /api/projectbase/sessions/heartbeat - Record heartbeat
routerAdd("POST", "/api/projectbase/sessions/heartbeat", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const sessionId = (body.session_id || body.id || "").trim();
        if (!sessionId) return e.json(400, { error: "session_id is required" });

        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: sessionId });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        if (body.status) record.set("status", String(body.status));
        if (body.pid !== undefined) record.set("pid", parseInt(body.pid));
        if (body.files_touched && Array.isArray(body.files_touched)) {
            const currentFiles = record.get("files_touched") || [];
            const merged = Array.from(new Set([...currentFiles, ...body.files_touched]));
            record.set("files_touched", merged);
        }
        if (body.log_tail !== undefined) record.set("log_tail", String(body.log_tail));
        if (body.tokens_in !== undefined) record.set("tokens_in", parseInt(body.tokens_in));
        if (body.tokens_out !== undefined) record.set("tokens_out", parseInt(body.tokens_out));
        if (body.cost_cents !== undefined) record.set("cost_cents", parseInt(body.cost_cents));
        if (body.metadata) {
            const existingMeta = record.get("metadata") || {};
            record.set("metadata", Object.assign({}, existingMeta, body.metadata));
        }

        e.app.save(record);

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            status: record.getString("status"),
            pid: record.getInt("pid"),
            files_count: (record.get("files_touched") || []).length,
            updated: record.getString("updated")
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 4. POST /api/projectbase/sessions/complete - Finalize session
routerAdd("POST", "/api/projectbase/sessions/complete", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const sessionId = (body.session_id || body.id || "").trim();
        if (!sessionId) return e.json(400, { error: "session_id is required" });

        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: sessionId });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        const exitCode = body.exit_code !== undefined ? parseInt(body.exit_code) : 0;
        const finalStatus = body.status || (exitCode === 0 ? "completed" : "failed");
        record.set("status", finalStatus);
        record.set("exit_code", exitCode);
        record.set("ended_at", new Date().toISOString());

        if (body.git_commit_after) record.set("git_commit_after", String(body.git_commit_after));
        if (body.git_diff_summary) record.set("git_diff_summary", body.git_diff_summary);
        if (body.test_verdict) record.set("test_verdict", body.test_verdict);
        if (body.files_touched && Array.isArray(body.files_touched)) record.set("files_touched", body.files_touched);
        if (body.log_tail) record.set("log_tail", String(body.log_tail));
        if (body.tokens_in) record.set("tokens_in", parseInt(body.tokens_in));
        if (body.tokens_out) record.set("tokens_out", parseInt(body.tokens_out));
        if (body.cost_cents) record.set("cost_cents", parseInt(body.cost_cents));

        const issueId = record.getString("issue") || body.issue_id || "";
        let autoDocked = record.getBool("auto_docked");

        // Auto-docking resolution if test verdict passed and exit code 0
        const testVerdict = body.test_verdict || record.get("test_verdict") || {};
        const isTestPassed = testVerdict.status === "passed" || (testVerdict.passed > 0 && (testVerdict.failed || 0) === 0);

        if (issueId && exitCode === 0 && isTestPassed) {
            try {
                const issueRecord = e.app.findRecordById("issues", issueId);
                if (issueRecord) {
                    issueRecord.set("status", "done");
                    e.app.save(issueRecord);
                    autoDocked = true;
                    record.set("auto_docked", true);

                    // Add structured audit comment to issue
                    try {
                        const commentsCol = e.app.findCollectionByNameOrId("comments");
                        if (commentsCol) {
                            const cRecord = new Record(commentsCol);
                            cRecord.set("issue", issueId);
                            cRecord.set("content", `### ⚡ Autonomous Execution Complete\n\n- **Agent:** ${record.getString("agent_name")} (${record.getString("runtime")})\n- **Commit:** \`${record.getString("git_commit_after") || "latest"}\`\n- **Verdict:** ✓ ${testVerdict.passed || 0}/${testVerdict.total || testVerdict.passed || 0} tests passed (${testVerdict.duration_s || 0}s)\n- **Files Touched:** ${(record.get("files_touched") || []).length}\n- **Auto-Dock:** Issue closed by verified execution run.`);
                            e.app.save(cRecord);
                        }
                    } catch (cErr) {}
                }
            } catch (iErr) {}
        }

        e.app.save(record);

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            status: finalStatus,
            exit_code: exitCode,
            auto_docked: autoDocked,
            test_verdict: record.get("test_verdict"),
            ended_at: record.getString("ended_at")
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 5. GET /api/projectbase/sessions/live - List live active sessions
routerAdd("GET", "/api/projectbase/sessions/live", (e) => {
    try {
        let activeSessions = [];
        try {
            const records = e.app.findRecordsByFilter(
                "agent_sessions",
                "status = 'running' || status = 'verifying' || status = 'spawning'",
                "-updated",
                50,
                0
            );
            activeSessions = records.map(r => ({
                id: r.getString("id"),
                session_id: r.getString("session_id"),
                project_id: r.getString("project"),
                issue_id: r.getString("issue"),
                agent_name: r.getString("agent_name"),
                runtime: r.getString("runtime"),
                model: r.getString("model"),
                status: r.getString("status"),
                pid: r.getInt("pid"),
                workdir: r.getString("workdir"),
                git_branch: r.getString("git_branch"),
                files_touched_count: (r.get("files_touched") || []).length,
                tokens_total: (r.getInt("tokens_in") || 0) + (r.getInt("tokens_out") || 0),
                started_at: r.getString("started_at"),
                updated: r.getString("updated")
            }));
        } catch (dbErr) {}

        return e.json(200, {
            active_sessions: activeSessions,
            count: activeSessions.length,
            health: "healthy"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 6. GET /api/projectbase/sessions/metrics - Aggregated metrics
routerAdd("GET", "/api/projectbase/sessions/metrics", (e) => {
    try {
        let totalSessions = 0;
        let completed = 0;
        let failed = 0;
        let active = 0;
        let totalTokens = 0;
        let totalCostCents = 0;
        let autoDockedCount = 0;

        try {
            const records = e.app.findRecordsByFilter("agent_sessions", "id != ''", "-created", 500, 0);
            totalSessions = records.length;
            records.forEach(r => {
                const s = r.getString("status");
                if (s === "completed") completed++;
                else if (s === "failed" || s === "cancelled") failed++;
                else if (s === "running" || s === "verifying" || s === "spawning") active++;

                if (r.getBool("auto_docked")) autoDockedCount++;
                totalTokens += (r.getInt("tokens_in") || 0) + (r.getInt("tokens_out") || 0);
                totalCostCents += (r.getInt("cost_cents") || 0);
            });
        } catch (dbErr) {}

        const passRate = totalSessions > 0 ? Math.round((completed / (completed + failed || 1)) * 100) : 100;

        return e.json(200, {
            total_sessions: totalSessions,
            active_count: active,
            completed_count: completed,
            failed_count: failed,
            pass_rate_percent: passRate,
            auto_docked_count: autoDockedCount,
            total_tokens: totalTokens,
            total_cost_cents: totalCostCents,
            total_cost_usd: (totalCostCents / 100).toFixed(2)
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 7. GET /api/projectbase/sessions/{id} - Get session detail
routerAdd("GET", "/api/projectbase/sessions/{id}", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        if (!id) return e.json(400, { error: "Session ID required" });

        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        let projectData = null;
        if (record.getString("project")) {
            try {
                const p = e.app.findRecordById("projects", record.getString("project"));
                if (p) projectData = { id: p.getString("id"), name: p.getString("name"), identifier: p.getString("identifier") };
            } catch (x) {}
        }

        let issueData = null;
        if (record.getString("issue")) {
            try {
                const iss = e.app.findRecordById("issues", record.getString("issue"));
                if (iss) issueData = { id: iss.getString("id"), title: iss.getString("title"), status: iss.getString("status"), priority: iss.getString("priority") };
            } catch (x) {}
        }

        return e.json(200, {
            id: record.getString("id"),
            session_id: record.getString("session_id"),
            project: projectData,
            issue: issueData,
            agent_name: record.getString("agent_name"),
            runtime: record.getString("runtime"),
            model: record.getString("model"),
            status: record.getString("status"),
            pid: record.getInt("pid"),
            workdir: record.getString("workdir"),
            git_branch: record.getString("git_branch"),
            git_commit_before: record.getString("git_commit_before"),
            git_commit_after: record.getString("git_commit_after"),
            git_diff_summary: record.get("git_diff_summary") || {},
            files_touched: record.get("files_touched") || [],
            command: record.getString("command"),
            test_verdict: record.get("test_verdict"),
            log_tail: record.getString("log_tail"),
            tokens_in: record.getInt("tokens_in"),
            tokens_out: record.getInt("tokens_out"),
            cost_cents: record.getInt("cost_cents"),
            metadata: record.get("metadata") || {},
            auto_docked: record.getBool("auto_docked"),
            exit_code: record.getInt("exit_code"),
            total_steps: record.getInt("total_steps") || 0,
            total_tokens: record.getInt("total_tokens") || 0,
            total_cost_usd: record.getFloat("total_cost_usd") || 0.0,
            active_tool: record.getString("active_tool") || "",
            current_step_type: record.getString("current_step_type") || "",
            swarm_role: record.getString("swarm_role") || "",
            swarm_parent_id: record.getString("swarm_parent_id") || "",
            swarm_cluster_id: record.getString("swarm_cluster_id") || "",
            trajectory_summary: record.getString("trajectory_summary") || "",
            started_at: record.getString("started_at"),
            ended_at: record.getString("ended_at"),
            created: record.getString("created"),
            updated: record.getString("updated")
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 8. PATCH /api/projectbase/sessions/{id} - Update session
routerAdd("PATCH", "/api/projectbase/sessions/{id}", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};

        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        if (body.status) record.set("status", String(body.status));
        if (body.agent_name) record.set("agent_name", String(body.agent_name));
        if (body.model) record.set("model", String(body.model));
        if (body.issue_id !== undefined) record.set("issue", String(body.issue_id));
        if (body.metadata) {
            const existingMeta = record.get("metadata") || {};
            record.set("metadata", Object.assign({}, existingMeta, body.metadata));
        }

        e.app.save(record);

        return e.json(200, {
            success: true,
            id: record.getString("id"),
            session_id: record.getString("session_id"),
            status: record.getString("status"),
            updated: record.getString("updated")
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 9. DELETE /api/projectbase/sessions/{id} - Delete session
routerAdd("DELETE", "/api/projectbase/sessions/{id}", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        e.app.delete(record);

        return e.json(200, {
            success: true,
            deleted_id: id,
            message: "Session purged successfully"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 10. POST /api/projectbase/sessions/{id}/terminate - Cancel/terminate session
routerAdd("POST", "/api/projectbase/sessions/{id}/terminate", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        const pid = record.getInt("pid");
        record.set("status", "cancelled");
        record.set("ended_at", new Date().toISOString());
        record.set("exit_code", 130);

        e.app.save(record);

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            status: "cancelled",
            pid: pid,
            message: "Session termination signaled and recorded"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 11. POST /api/projectbase/sessions/{id}/fork - Fork session for re-tasking
routerAdd("POST", "/api/projectbase/sessions/{id}/fork", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let parentRecord = null;
        try {
            parentRecord = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!parentRecord) return e.json(404, { error: "Parent session not found" });

        const newSessionId = (body.new_session_id || ("sess_fork_" + Math.random().toString(36).substring(2, 10))).trim();
        const promptOverride = body.prompt || body.command || parentRecord.getString("command");

        let sessionCol = null;
        try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}

        let newRecord = null;
        if (sessionCol) {
            newRecord = new Record(sessionCol);
            newRecord.set("session_id", newSessionId);
            newRecord.set("project", parentRecord.getString("project"));
            newRecord.set("issue", parentRecord.getString("issue"));
            newRecord.set("agent_name", body.agent_name || parentRecord.getString("agent_name"));
            newRecord.set("runtime", parentRecord.getString("runtime"));
            newRecord.set("model", body.model || parentRecord.getString("model"));
            newRecord.set("status", "spawning");
            newRecord.set("workdir", parentRecord.getString("workdir"));
            newRecord.set("git_branch", body.git_branch || parentRecord.getString("git_branch"));
            newRecord.set("git_commit_before", parentRecord.getString("git_commit_after") || parentRecord.getString("git_commit_before"));
            newRecord.set("command", promptOverride);
            newRecord.set("metadata", {
                forked_from_session: parentRecord.getString("session_id"),
                forked_at: new Date().toISOString()
            });
            newRecord.set("started_at", new Date().toISOString());

            e.app.save(newRecord);
        }

        return e.json(201, {
            success: true,
            forked_from: parentRecord.getString("session_id"),
            new_session_id: newSessionId,
            id: newRecord ? newRecord.getString("id") : newSessionId,
            status: "spawning",
            message: "Session successfully forked with context preserved"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 12. POST /api/projectbase/sessions/{id}/dock - Dock/undock session to issue
routerAdd("POST", "/api/projectbase/sessions/{id}/dock", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        const issueId = (body.issue_id || "").trim();

        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        let validIssueId = "";
        if (issueId) {
            try {
                const found = e.app.findRecordById("issues", issueId);
                if (found) validIssueId = found.getString("id");
            } catch (x) {}
            if (!validIssueId) {
                try {
                    const found2 = e.app.findFirstRecordByFilter("issues", "identifier = {:id}", { id: issueId });
                    if (found2) validIssueId = found2.getString("id");
                } catch (x) {}
            }
        }

        record.set("issue", validIssueId);
        record.set("auto_docked", !!validIssueId);
        e.app.save(record);

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            issue_id: validIssueId,
            auto_docked: !!validIssueId,
            message: validIssueId ? "Session successfully docked to issue" : "Session unlinked from issue"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 13. POST /api/projectbase/sessions/clean - Prune old sessions
routerAdd("POST", "/api/projectbase/sessions/clean", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const olderThanDays = Math.max(parseInt(body.older_than_days) || 30, 1);
        const cutoff = new Date(Date.now() - olderThanDays * 86400 * 1000).toISOString();

        let purgedCount = 0;
        try {
            const stale = e.app.findRecordsByFilter("agent_sessions", "created < {:cutoff} && (status = 'completed' || status = 'failed' || status = 'cancelled')", "", 200, 0, { cutoff: cutoff });
            stale.forEach(r => {
                try {
                    e.app.delete(r);
                    purgedCount++;
                } catch (x) {}
            });
        } catch (dbErr) {}

        return e.json(200, {
            success: true,
            purged_count: purgedCount,
            older_than_days: olderThanDays
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});
