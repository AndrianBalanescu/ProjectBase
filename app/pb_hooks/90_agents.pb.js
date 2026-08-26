// pb_hooks/90_agents.pb.js
// Agentic-native: discover local AI agents and surface them as board members.
//
// Doc: docs/research/AGENTIC_NATIVE_PLAN.md · Ticket: PB-4394
//
// First step toward "agents that show up on the board" (Multica model). Scans
// well-known agent config dirs under the real home, surfaces the team, reads a
// flomaster summary, and upserts `agents` records.
//
// IMPORTANT (PocketBase JSVM): top-level helper functions/consts are NOT reliably
// visible inside routerAdd handlers. So each handler inlines the tiny helpers and
// the agent-dir table it needs.

// List the "team" of detected agents for the current user (raw, non-persisted).
// Reads the sanitized bridge output first (the bridge runs as the machine user and
// publishes world-readable JSON, since the PB server runs under a locked-down user).
routerAdd("GET", "/api/projectbase/agents", (e) => {
    const BRIDGE_PATHS = ["/run/projectbase/agents.json", "/tmp/projectbase/agents.json"]
    const exists = (p) => { try { $os.stat(p); return true } catch (x) { return false } }
    // Decode a UTF-8 byte Array into a JS string (goja lacks TextDecoder).
    // IMPORTANT: build the result with an array + single join(), NOT `out +=`
    // string concatenation. In the Goja JSVM, `+=` on a growing string is O(n^2)
    // and a 140KB file saturates the CPU (this was the runaway root cause).
    const decodeUtf8 = (bytes) => {
        const out = []
        let i = 0
        while (i < bytes.length) {
            let c = bytes[i]
            if (c < 0x80) { out.push(String.fromCharCode(c)); i++ }
            else if (c < 0xE0) { out.push(String.fromCharCode(((c & 0x1F) << 6) | (bytes[i+1] & 0x3F))); i += 2 }
            else if (c < 0xF0) { out.push(String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i+1] & 0x3F) << 6) | (bytes[i+2] & 0x3F))); i += 3 }
            else { const cp = ((c & 0x07) << 18) | ((bytes[i+1] & 0x3F) << 12) | ((bytes[i+2] & 0x3F) << 6) | (bytes[i+3] & 0x3F); out.push(String.fromCodePoint(cp)); i += 4 }
        }
        return out.join('')
    }
    const homeOf = () => {
        const cands = []
        try { const h = $os.getenv("HOME"); if (h) cands.push(h) } catch (x) {}
        try { const u = $os.getenv("USERPROFILE"); if (u) cands.push(u) } catch (x) {}
        cands.push("/home/ubuntu", "/home/admin", "/root")
        for (const c of cands) { try { $os.stat(c + "/.flomaster"); return c } catch (x) {} }
        return cands[0] || "/home/ubuntu"
    }
    try {
        if (!e.auth || !e.auth.id) return e.json(200, { home: "", source: "unauthed", agents: [], sessions: [] })
        const home = homeOf()
        // Prefer the bridge JSON (sanitized, machine-user scanned).
        // TTL cache: the byte-by-byte UTF-8 decode below is O(n^2) in the JSVM
        // and saturates the CPU on a 300KB file when polled every few seconds.
        // Cache the parsed result for 3s so the decode runs at most ~20x/min.
        const CACHE_KEY = "pbAgentsBridgeCache"
        const CACHE_TTL_MS = 3000
        let cached = null
        try { cached = $app.store().get(CACHE_KEY) } catch (x) {}
        if (cached && cached.at && (Date.now() - cached.at) < CACHE_TTL_MS) {
            return e.json(200, cached.payload)
        }
        for (const bp of BRIDGE_PATHS) {
            if (!exists(bp)) continue
            try {
                let raw = $os.readFile(bp)
                // PocketBase JSVM returns a byte Array (UTF-8) for readFile.
                if (typeof raw !== "string") raw = decodeUtf8(raw)
                const parsed = JSON.parse(raw)
                const agents = (parsed.agents || []).map((a) => ({
                    name: a.name, provider: a.provider, runtime: a.runtime, avatar: a.avatar,
                    source_dir: a.source_dir || "~/" + a.dir, found: !!a.found, core: !!a.core,
                    status: a.status || "offline", session_count: a.session_count || 0,
                }))
                const payload = { home, source: "bridge", host: parsed.host || null, scanned_at: parsed.scanned_at || null, agents, sessions: parsed.sessions || [] }
                try { $app.store().set(CACHE_KEY, { at: Date.now(), payload }) } catch (x) {}
                return e.json(200, payload)
            } catch (err) {
                const msg = err && err.message ? err.message : JSON.stringify(err)
                console.log(">>> [Agents] bridge parse error:", msg)
            }
        }
        // Fallback: direct home scan (local/dev where PB can read ~ubuntu).
        const AGENTS = [
            { dir: ".flomaster", name: "flomaster", provider: "openai-api", runtime: "flomaster", avatar: "🧠" },
            { dir: ".hermes",    name: "hermes",     provider: "openrouter", runtime: "hermes",    avatar: "🐦" },
            { dir: ".agents",    name: "agents-hub", provider: "mixed",      runtime: "hub",       avatar: "🧰" },
            { dir: ".cursor",    name: "cursor",     provider: "openai",     runtime: "cursor",    avatar: "🖱️" },
            { dir: ".pi",        name: "pi",         provider: "inflection", runtime: "pi",        avatar: "🥧" },
        ]
        const ex = (base, rel) => { try { $os.stat(base + "/" + rel); return true } catch (x) { return false } }
        const team = AGENTS.filter((k) => ex(home, k.dir)).map((k) => ({
            name: k.name, provider: k.provider, runtime: k.runtime, avatar: k.avatar,
            source_dir: "$HOME/" + k.dir, found: true,
        }))
        return e.json(200, { home, source: "direct", agents: team })
    } catch (err) {
        const msg = err && err.message ? err.message : JSON.stringify(err)
        console.log(">>> [Agents] scan error:", msg)
        return e.json(500, { error: "Agent scan failed", detail: msg })
    }
})

// Read a flomaster agent's session summary (config + last session + counts).
routerAdd("GET", "/api/projectbase/agents/flomaster", (e) => {
    const homeOf = () => {
        const cands = []
        try { const h = $os.getenv("HOME"); if (h) cands.push(h) } catch (x) {}
        try { const u = $os.getenv("USERPROFILE"); if (u) cands.push(u) } catch (x) {}
        cands.push("/home/ubuntu", "/home/admin", "/root")
        for (const c of cands) { try { $os.stat(c + "/.flomaster"); return c } catch (x) {} }
        return cands[0] || "/home/ubuntu"
    }
    const read = (base, rel) => { try { const r = $os.readFile(base + "/" + rel); return typeof r === "string" ? r : "" } catch (x) { return "" } }
    const exists = (base, rel) => { try { $os.stat(base + "/" + rel); return true } catch (x) { return false } }
    try {
        if (!e.auth || !e.auth.id) return e.unauthorizedError("Authentication required")
        const home = homeOf()
        const cfgToml = read(home, ".flomaster/config.toml")
        const cfgJson = read(home, ".flomaster/config.json")
        let provider = ""
        let model = ""
        try {
            if (cfgJson) {
                const parsed = JSON.parse(cfgJson)
                provider = (parsed.provider && parsed.provider.default_provider) || ""
                model = (parsed.provider && parsed.provider.default_model) || ""
            }
        } catch (x) {}
        return e.json(200, {
            name: "flomaster",
            cfg_toml_present: !!cfgToml,
            cfg_json_present: !!cfgJson,
            provider,
            model,
            last_session: read(home, ".flomaster/last_focused_client_session"),
            has_memrize_db: exists(home, ".flomaster/memrize.db"),
        })
    } catch (err) {
        const msg = err && err.message ? err.message : JSON.stringify(err)
        console.log(">>> [Agents] flomaster error:", msg)
        return e.json(500, { error: "Flomaster summary failed", detail: msg })
    }
})

// Persist the detected team into the `agents` collection (upsert by name+owner).
routerAdd("POST", "/api/projectbase/agents/sync", (e) => {
    const AGENTS = [
        { dir: ".flomaster", name: "flomaster", provider: "openai-api", runtime: "flomaster", avatar: "🧠" },
        { dir: ".hermes",    name: "hermes",     provider: "openrouter", runtime: "hermes",    avatar: "🐦" },
        { dir: ".agents",    name: "agents-hub", provider: "mixed",      runtime: "hub",       avatar: "🧰" },
        { dir: ".cursor",    name: "cursor",     provider: "openai",     runtime: "cursor",    avatar: "🖱️" },
        { dir: ".pi",        name: "pi",         provider: "inflection", runtime: "pi",        avatar: "🥧" },
    ]
    const homeOf = () => {
        const cands = []
        try { const h = $os.getenv("HOME"); if (h) cands.push(h) } catch (x) {}
        try { const u = $os.getenv("USERPROFILE"); if (u) cands.push(u) } catch (x) {}
        cands.push("/home/ubuntu", "/home/admin", "/root")
        for (const c of cands) { try { $os.stat(c + "/.flomaster"); return c } catch (x) {} }
        return cands[0] || "/home/ubuntu"
    }
    const BRIDGE_PATHS = ["/run/projectbase/agents.json", "/tmp/projectbase/agents.json"]
    const decodeUtf8 = (bytes) => {
        // Array + single join() — `out +=` is O(n^2) in Goja (CPU runaway bug).
        const out = []
        let i = 0
        while (i < bytes.length) {
            let c = bytes[i]
            if (c < 0x80) { out.push(String.fromCharCode(c)); i++ }
            else if (c < 0xE0) { out.push(String.fromCharCode(((c & 0x1F) << 6) | (bytes[i+1] & 0x3F))); i += 2 }
            else if (c < 0xF0) { out.push(String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i+1] & 0x3F) << 6) | (bytes[i+2] & 0x3F))); i += 3 }
            else { const cp = ((c & 0x07) << 18) | ((bytes[i+1] & 0x3F) << 12) | ((bytes[i+2] & 0x3F) << 6) | (bytes[i+3] & 0x3F); out.push(String.fromCodePoint(cp)); i += 4 }
        }
        return out.join('')
    }
    const exists = (base, rel) => { try { $os.stat(base + "/" + rel); return true } catch (x) { return false } }
    try {
        if (!e.auth || !e.auth.id) return e.unauthorizedError("Authentication required")
        const home = homeOf()
        // Prefer the bridge JSON (sanitized, machine-user scanned).
        let detected = null
        for (const bp of BRIDGE_PATHS) {
            let present = false
            try { $os.stat(bp); present = true } catch (x) {}
            if (!present) continue
            try {
                let raw = $os.readFile(bp)
                if (typeof raw !== "string") raw = decodeUtf8(raw)
                const parsed = JSON.parse(raw)
                detected = (parsed.agents || []).filter((a) => a.found).map((a) => ({
                    name: a.name, provider: a.provider, runtime: a.runtime, avatar: a.avatar,
                    dir: (a.source_dir || "").replace("~/", ".").replace("$HOME/", "."),
                }))
                break
            } catch (x) {}
        }
        if (!detected) detected = AGENTS.filter((d) => exists(home, d.dir))
        const agentsCol = e.app.findCollectionByNameOrId("agents")
        const isSuperuser = e.auth.collection && e.auth.collection().name === "_superusers"
        const ownerId = isSuperuser ? "" : (e.auth.id || "")
        const results = []
        for (const known of detected) {
            let rec = null
            try {
                if (ownerId) {
                    rec = e.app.findFirstRecordByFilter("agents", "name = {:name} && owner = {:owner}", {
                        name: known.name, owner: ownerId,
                    })
                } else {
                    rec = e.app.findFirstRecordByFilter("agents", "name = {:name} && owner = ''", {
                        name: known.name,
                    })
                }
            } catch (x) {}
            if (rec) {
                rec.set("provider", known.provider)
                rec.set("runtime", known.runtime)
                rec.set("avatar", known.avatar)
                rec.set("source_dir", "$HOME/" + known.dir)
                e.app.save(rec)
            } else {
                rec = new Record(agentsCol)
                rec.set("name", known.name)
                rec.set("provider", known.provider)
                rec.set("runtime", known.runtime)
                rec.set("avatar", known.avatar)
                rec.set("source_dir", "$HOME/" + known.dir)
                rec.set("status", "offline")
                rec.set("enabled", true)
                rec.set("discovered", true)
                if (ownerId) rec.set("owner", ownerId)
                e.app.save(rec)
            }
            results.push({ name: known.name, id: rec.id, synced: true })
        }
        return e.json(200, { synced: results.length, agents: results })
    } catch (err) {
        const msg = err && err.message ? err.message : JSON.stringify(err)
        console.log(">>> [Agents] sync error:", msg)
        return e.json(500, { error: "Agent sync failed", detail: msg })
    }
})
