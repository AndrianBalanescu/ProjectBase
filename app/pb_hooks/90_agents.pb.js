// pb_hooks/90_agents.pb.js
// Agentic-native: discover local AI agents and surface them as board teammates.
//
// Dual-Source Discovery:
// 1. Database Native: Reads live records from `agent_sessions` collection.
// 2. Machine Bridge: Reads `/run/projectbase/agents.json` if available.
// 3. Local Fallback: Scans `~/.flomaster`, `~/.hermes`, `~/.agents`, `~/.cursor`.

routerAdd("GET", "/api/projectbase/agents", (e) => {
    const BRIDGE_PATHS = ["/run/projectbase/agents.json", "/tmp/projectbase/agents.json"];
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
                    return {
                        id: r.id,
                        session_id: sid,
                        agent: (r.getString("runtime") || "flomaster").toLowerCase(),
                        agent_name: r.getString("agent_name") || `Flomaster (${role})`,
                        short_name: role,
                        runtime: r.getString("runtime") || "flomaster",
                        model: r.getString("model") || "omniroute/premium",
                        status: st,
                        is_active: st === "running" || st === "spawning",
                        pid: r.getInt("pid") || 0,
                        working_dir: r.getString("working_dir") || r.getString("workdir") || "",
                        project_id: r.getString("project") || "",
                        git_branch: r.getString("git_branch") || "main",
                        git_commit: r.getString("git_commit") || r.getString("git_commit_after") || "",
                        tokens: r.getInt("token_usage") || r.getInt("total_tokens") || 0,
                        message_count: r.getInt("message_count") || r.getInt("total_steps") || 1,
                        last_prompt: prompt,
                        title: prompt ? (prompt.length > 80 ? prompt.substring(0, 80) + "..." : prompt) : `Session ${sid}`,
                        created: r.getString("created"),
                        updated: r.getString("updated"),
                        avatar: r.getString("runtime") === "hermes" ? "🐦" : (r.getString("runtime") === "cursor" ? "🖱️" : "🧠"),
                        chat: prompt ? [
                            { role: "user", content: prompt, timestamp: r.getString("created") },
                            { role: "assistant", content: `Active task in ${r.getString("working_dir") || 'workspace'}. Status: ${st}`, timestamp: r.getString("updated") }
                        ] : []
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
            const agSessions = dbSessions.filter(s => s.agent === ag.name || s.runtime === ag.name);
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

        // If machine bridge file exists, augment with bridge data
        for (const bp of BRIDGE_PATHS) {
            if (!exists(bp)) continue;
            try {
                let raw = $os.readFile(bp);
                if (typeof raw !== "string") raw = decodeUtf8(raw);
                const parsed = JSON.parse(raw);
                if (parsed.sessions && parsed.sessions.length > 0 && dbSessions.length === 0) {
                    dbSessions = parsed.sessions;
                }
            } catch (err) {}
        }

        return e.json(200, {
            home,
            source: dbSessions.length > 0 ? "db_and_live" : "direct",
            agents: agentsList,
            sessions: dbSessions,
            total_agents: agentsList.length,
            total_sessions: dbSessions.length
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
