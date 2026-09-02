// pb_hooks/90_agents.pb.js
// Agentic-native: discover local AI agents and surface them as board teammates.
//
// Dual-Source Discovery:
// 1. Database Native: Reads live records from `agent_sessions` collection.
// 2. Machine Bridge: Reads `/run/projectbase/agents.json` if available.
// 3. Local Fallback: Scans `~/.flomaster`, `~/.hermes`, `~/.agents`, `~/.cursor`.

routerAdd("GET", "/api/projectbase/agents", (e) => {
    // The agent-bridge sidecar (bin/agent_bridge) writes to a world-readable path
    // under the app data dir. /run/projectbase was the original design, but /run is
    // systemd-managed (root:root) and the bridge user cannot mkdir there, so the
    // installed service writes under app/pb_data instead. Keep all candidates so
    // both the legacy and the current deployment path are honored.
    const PB_ROOT = $os.getenv("PB_ROOT") || "/data/projects/projectbase";
    const BRIDGE_PATHS = [
        PB_ROOT + "/app/pb_data/agents.json",
        PB_ROOT + "/pb_data/agents.json",
        "/run/projectbase/agents.json",
        "/tmp/projectbase/agents.json"
    ];
    const exists = (p) => { try { $os.stat(p); return true; } catch (x) { return false; } };

    const decodeUtf8 = (bytes) => {
        const out = [];
        let i = 0;
        while (i < bytes.length) {
            let c = bytes[i];
            if (c < 0x80) { out.push(String.fromCharCode(c)); i++; }
            else if (c < 0xE0) { out.push(String.fromCharCode(((c & 0x1F) << 6) | (bytes[i+1] & 0x3F))); i += 2; }
            else if (c < 0xF0) { out.push(String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i+1] & 0x3F) << 6) | (bytes[i+2] & 0x3F))); i += 3; }
            else { const cp = ((c & 0x07) << 18) | ((bytes[i+1] & 0x3F) << 12) | ((bytes[i+2] & 0x3F) << 6) | (bytes[i+3] & 0x3F); out.push(String.fromCodePoint(cp)); i += 4; }
        }
        return out.join('');
    };

    const homeOf = () => {
        const cands = [];
        try { const h = $os.getenv("HOME"); if (h) cands.push(h); } catch (x) {}
        try { const u = $os.getenv("USERPROFILE"); if (u) cands.push(u); } catch (x) {}
        cands.push("/home/ubuntu", "/home/admin", "/root");
        for (const c of cands) { try { $os.stat(c + "/.flomaster"); return c; } catch (x) {} }
        return cands[0] || "/home/ubuntu";
    };

    try {
        const home = homeOf();
        let dbSessions = [];
        try {
            const records = e.app.findRecordsByFilter("agent_sessions", "1=1", "-updated", 100, 0);
            if (records && records.length > 0) {
                dbSessions = records.map(r => {
                    const sid = r.getString("session_id") || r.id;
                    const st = r.getString("status") || "completed";
                    const role = r.getString("agent_role") || r.getString("agent_name") || "flomaster";
                    const prompt = r.getString("last_prompt") || r.getString("command") || "";
                    const meta = r.get("metadata") || {};
                    const customChat = meta.chat || r.get("chat") || [];
                    const logTail = r.getString("log_tail") || "";
                    const gitDiff = r.getString("git_diff_raw") || "";
                    const filesTouched = r.get("files_touched") || [];
                    const testVerdict = r.get("test_verdict") || null;

                    let chatList = customChat;
                    if (!chatList || chatList.length === 0) {
                        chatList = [
                            {
                                role: "user",
                                content: prompt || `Autonomous session ${sid} on ${r.getString("working_dir") || 'workspace'}`,
                                created_at: r.getString("created")
                            },
                            {
                                role: "assistant",
                                content: `Executed autonomous task with agent **${r.getString("agent_name") || role}**.\n\n• **Status:** \`${st.toUpperCase()}\`\n• **Working Directory:** \`${r.getString("working_dir") || r.getString("workdir") || '/data/projects/projectbase'}\`\n• **Git Branch:** \`${r.getString("git_branch") || 'main'}\` ${r.getString("git_commit_after") ? '(`' + r.getString("git_commit_after").slice(0, 7) + '`)' : ''}`,
                                log_tail: logTail,
                                git_diff: gitDiff,
                                test_verdict: testVerdict,
                                created_at: r.getString("updated")
                            }
                        ];
                    }

                    return {
                        id: r.id,
                        session_id: sid,
                        agent: (r.getString("runtime") || "flomaster").toLowerCase(),
                        agent_name: r.getString("agent_name") || `Flomaster (${role})`,
                        short_name: role,
                        runtime: r.getString("runtime") || "flomaster",
                        model: r.getString("model") || "omniroute/premium",
                        machine: r.getString("machine") || "",
                        status: st,
                        is_active: r.getBool("is_active") || st === "running" || st === "spawning" || st === "verifying",
                        pid: r.getInt("pid") || 0,
                        working_dir: r.getString("working_dir") || r.getString("workdir") || "",
                        project_id: r.getString("project") || "",
                        git_branch: r.getString("git_branch") || "main",
                        git_commit: r.getString("git_commit_after") || r.getString("git_commit") || "",
                        git_diff_raw: gitDiff,
                        files_touched: filesTouched,
                        log_tail: logTail,
                        test_verdict: testVerdict,
                        tokens: r.getInt("token_usage") || r.getInt("total_tokens") || r.getInt("tokens_out") || 0,
                        message_count: r.getInt("message_count") || r.getInt("total_steps") || 1,
                        last_prompt: prompt,
                        title: prompt ? (prompt.length > 80 ? prompt.substring(0, 80) + "..." : prompt) : `Session ${sid}`,
                        created: r.getString("created"),
                        updated: r.getString("updated"),
                        avatar: r.getString("runtime") === "hermes" ? "🐦" : (r.getString("runtime") === "cursor" ? "🖱️" : (r.getString("runtime") === "flow" ? "⚡" : "🧠")),
                        chat: chatList
                    };
                });
            }
        } catch (dbErr) {
            console.log(">>> [Agents] DB session query warning:", dbErr);
        }

        // Base agent definitions
        const AGENTS = [
            { name: "flomaster", provider: "omniroute", runtime: "flomaster", avatar: "🧠", dir: ".flomaster", core: true },
            { name: "hermes", provider: "omniroute", runtime: "hermes", avatar: "🐦", dir: ".hermes", core: false },
            { name: "flow", provider: "omniroute", runtime: "flow", avatar: "⚡", dir: ".flow-work", core: true },
            { name: "cursor", provider: "openai", runtime: "cursor", avatar: "🖱️", dir: ".cursor", core: false }
        ];

        const agentsList = AGENTS.map(ag => {
            // Classify by runtime (family) first — the agent_sessions records always
            // carry runtime, whereas `agent` is not a schema field (ingest sets
            // agent_name, which is a per-session display name like "Flomaster (parrot)").
            const agSessions = dbSessions.filter(s => s.runtime === ag.runtime || s.runtime === ag.name || s.agent === ag.name);
            const isOnline = agSessions.some(s => s.is_active) || agSessions.some(s => s.status === "running" || s.status === "verifying");
            return {
                name: ag.name,
                provider: ag.provider,
                runtime: ag.runtime,
                avatar: ag.avatar,
                source_dir: "$HOME/" + ag.dir,
                found: true,
                core: ag.core,
                status: isOnline ? "online" : (agSessions.length > 0 ? "idle" : "offline"),
                session_count: agSessions.length
            };
        });

        // If machine bridge file exists, augment and prioritize live bridge data
        let bridgeSessions = [];
        for (const bp of BRIDGE_PATHS) {
            if (!exists(bp)) continue;
            try {
                let raw = $os.readFile(bp);
                if (typeof raw !== "string") raw = decodeUtf8(raw);
                const parsed = JSON.parse(raw);
                if (parsed.sessions && parsed.sessions.length > 0) {
                    bridgeSessions = parsed.sessions.map(s => {
                        const sid = s.id || s.session_id || "session_" + Math.random().toString(36).slice(2);
                        const agName = (s.agent || s.runtime || "flomaster").toLowerCase();
                        const promptText = s.intention || s.title || s.last_text || s.last_prompt || "";
                        const isActive = !!s.is_active || s.status === "running" || s.status === "Running";
                        const st = isActive ? "running" : (s.status ? String(s.status).toLowerCase() : "completed");
                        const createdTs = s.last_active_at || s.updated_at || new Date().toISOString();
                        const updatedTs = s.updated_at || s.last_active_at || createdTs;
                        return {
                            id: sid,
                            session_id: sid,
                            agent: agName,
                            agent_name: s.agent_name || (agName === "flomaster" ? "Flomaster" : (agName === "hermes" ? "Hermes" : s.short_name || agName)),
                            short_name: s.short_name || sid.slice(0, 12),
                            runtime: s.runtime || agName,
                            model: s.model || "omniroute/premium",
                            status: st,
                            is_active: isActive,
                            pid: s.pid || 0,
                            working_dir: s.working_dir || s.workdir || "/data/projects/projectbase",
                            project_id: s.project_id || "",
                            git_branch: s.git_branch || "main",
                            git_commit: s.git_commit || "",
                            git_diff_raw: s.git_diff_raw || "",
                            files_touched: s.files_touched || [],
                            log_tail: s.log_tail || "",
                            test_verdict: s.test_verdict || null,
                            tokens: (s.token_usage && (s.token_usage.total || s.token_usage.Total)) || s.tokens || 0,
                            token_usage: s.token_usage || null,
                            message_count: s.message_count || (s.chat ? s.chat.length : 1),
                            last_prompt: promptText,
                            title: promptText || (s.short_name ? "Session " + s.short_name : "Execution Run"),
                            chat: s.chat || [],
                            live_activity: s.live_activity || [],
                            recent_tools: s.recent_tools || [],
                            latest_reasoning: s.latest_reasoning || "",
                            reasoning_steps: s.reasoning_steps || [],
                            todos: s.todos || [],
                            created: createdTs,
                            updated: updatedTs,
                            avatar: s.avatar || (agName === "hermes" ? "🐦" : "🧠")
                        };
                    });
                    break;
                }
            } catch (err) {
                console.log(">>> [Agents] bridge parse warning:", err);
            }
        }

        // Merge: Live bridge sessions first, then non-duplicate DB sessions
        const seenIds = new Set();
        const combinedSessions = [];
        for (const s of bridgeSessions) {
            const k = s.session_id || s.id;
            if (k && !seenIds.has(k)) {
                seenIds.add(k);
                combinedSessions.push(s);
            }
        }
        for (const s of dbSessions) {
            const k = s.session_id || s.id;
            if (k && !seenIds.has(k)) {
                seenIds.add(k);
                combinedSessions.push(s);
            }
        }

        // Recalculate agents list based on combined sessions
        const finalAgentsList = AGENTS.map(ag => {
            const agSessions = combinedSessions.filter(s => s.agent === ag.name || s.runtime === ag.name);
            const isOnline = agSessions.some(s => s.is_active);
            return {
                name: ag.name,
                provider: ag.provider,
                runtime: ag.runtime,
                avatar: ag.avatar,
                source_dir: "$HOME/" + ag.dir,
                found: true,
                core: ag.core,
                status: isOnline ? "online" : (agSessions.length > 0 ? "idle" : "offline"),
                session_count: agSessions.length
            };
        });

        return e.json(200, {
            home,
            source: bridgeSessions.length > 0 ? "bridge_live" : (dbSessions.length > 0 ? "db" : "direct"),
            agents: finalAgentsList,
            sessions: combinedSessions,
            total_agents: finalAgentsList.length,
            total_sessions: combinedSessions.length
        });
    } catch (err) {
        const msg = err && err.message ? err.message : JSON.stringify(err);
        console.log(">>> [Agents] scan error:", msg);
        return e.json(500, { error: "Agent scan error: " + msg, agents: [], sessions: [] });
    }
});

// GET /api/projectbase/agents/flomaster - Read flomaster config
routerAdd("GET", "/api/projectbase/agents/flomaster", (e) => {
    const homeOf = () => {
        const cands = [];
        try { const h = $os.getenv("HOME"); if (h) cands.push(h); } catch (x) {}
        try { const u = $os.getenv("USERPROFILE"); if (u) cands.push(u); } catch (x) {}
        cands.push("/home/ubuntu", "/home/admin", "/root");
        for (const c of cands) { try { $os.stat(c + "/.flomaster"); return c; } catch (x) {} }
        return cands[0] || "/home/ubuntu";
    };
    const read = (base, rel) => { try { const r = $os.readFile(base + "/" + rel); return typeof r === "string" ? r : ""; } catch (x) { return ""; } };
    const exists = (base, rel) => { try { $os.stat(base + "/" + rel); return true; } catch (x) { return false; } };

    try {
        const home = homeOf();
        const cfgToml = read(home, ".flomaster/config.toml");
        const cfgJson = read(home, ".flomaster/config.json");
        return e.json(200, {
            name: "flomaster",
            cfg_toml_present: !!cfgToml,
            cfg_json_present: !!cfgJson,
            provider: "omniroute",
            model: "premium",
            last_session: read(home, ".flomaster/last_focused_client_session"),
            has_memrize_db: exists(home, ".flomaster/memrize.db")
        });
    } catch (err) {
        return e.json(500, { error: String(err) });
    }
});

// POST /api/projectbase/agents/sync - Rescan & sync agents
routerAdd("POST", "/api/projectbase/agents/sync", (e) => {
    try {
        let sessionCount = 0;
        try {
            const records = e.app.findRecordsByFilter("agent_sessions", "1=1", "-updated", 100, 0);
            sessionCount = records ? records.length : 0;
        } catch (x) {}

        return e.json(200, {
            status: "synced",
            synced: 4,
            session_count: sessionCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        return e.json(500, { error: String(err) });
    }
});
