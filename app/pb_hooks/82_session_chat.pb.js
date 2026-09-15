// pb_hooks/82_session_chat.pb.js
// Session chat: append an operator turn to an execution run and stream back a reply.
//
// This is the backend half of the Sessions console chat box. A run is a real
// agent session record (see 90_agents.pb.js); chatting with it appends to
// `metadata.chat`, which the console renders as the transcript. The reply comes
// from the homelab OmniRoute gateway when it is reachable, and degrades to an
// explicit "queued" acknowledgement when it is not (self-hosted installs often
// run without an LLM gateway at all, so that path must not error).
//
// NOTE (critical): the Goja runtime resolves no module-scope helpers inside a
// route callback, so all logic is inlined in the callback per repo convention.

routerAdd("GET", "/api/projectbase/sessions/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        const rawId = String(e.request.pathValue("id") || "").trim()
        if (!rawId) {
            return e.json(400, { error: "Missing session id" })
        }

        let rec = null
        try {
            rec = e.app.findRecordById("agent_sessions", rawId)
        } catch (nfErr) {
            rec = null
        }
        if (!rec) {
            try {
                const bySid = e.app.findRecordsByFilter(
                    "agent_sessions",
                    "session_id = {:sid}",
                    "-updated",
                    1,
                    0,
                    { sid: rawId }
                )
                if (bySid && bySid.length > 0) rec = bySid[0]
            } catch (fErr) {
                rec = null
            }
        }
        if (!rec) {
            return e.json(404, { error: "Session not found" })
        }

        return e.json(200, {
            id: rec.id,
            session_id: rec.getString("session_id") || rec.id,
            agent_name: rec.getString("agent_name"),
            runtime: rec.getString("runtime"),
            status: rec.getString("status"),
            model: rec.getString("model"),
            pid: rec.getInt("pid"),
            command: rec.getString("command"),
            last_prompt: rec.getString("last_prompt"),
            workdir: rec.getString("workdir"),
            git_branch: rec.getString("git_branch"),
            git_commit_before: rec.getString("git_commit_before"),
            git_commit_after: rec.getString("git_commit_after"),
            git_diff_summary: rec.get("git_diff_summary"),
            git_diff_raw: rec.getString("git_diff_raw"),
            files_touched: rec.get("files_touched"),
            test_verdict: rec.get("test_verdict"),
            log_tail: rec.getString("log_tail"),
            tokens_in: rec.getInt("tokens_in"),
            tokens_out: rec.getInt("tokens_out"),
            cost_cents: rec.getInt("cost_cents"),
            started_at: rec.getString("started_at"),
            ended_at: rec.getString("ended_at"),
            metadata: rec.get("metadata"),
            created: rec.getString("created"),
            updated: rec.getString("updated")
        })
    } catch (err) {
        console.log(">>> [ProjectBase] session detail error:", String((err && err.message) || err))
        return e.json(500, { error: "Internal server error" })
    }
})

routerAdd("POST", "/api/projectbase/sessions/{id}/chat", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body = {}
        try {
            body = e.requestInfo().body || {}
        } catch (bErr) {
            return e.json(400, { error: "Invalid JSON body" })
        }

        const message = typeof body.message === "string" ? body.message.trim() : ""
        if (!message) {
            return e.json(400, { error: "Missing required 'message' field" })
        }
        if (message.length > 8000) {
            return e.json(400, { error: "'message' must be at most 8000 characters" })
        }

        const requestedAttachments = Array.isArray(body.attachments) ? body.attachments : []
        const rawPayloads = Array.isArray(body.attachment_payloads) ? body.attachment_payloads : []
        if (requestedAttachments.length > 5) {
            return e.json(400, { error: "At most 5 attachments are allowed" })
        }
        if (rawPayloads.length > 5) {
            return e.json(400, { error: "At most 5 attachment payloads are allowed" })
        }

        const rawId = String(e.request.pathValue("id") || "").trim()
        if (!rawId) {
            return e.json(400, { error: "Missing session id" })
        }

        // Resolve the run by record id first, then by its session_id field.
        let sessionRec = null
        try {
            sessionRec = e.app.findRecordById("agent_sessions", rawId)
        } catch (nfErr) {
            sessionRec = null
        }
        if (!sessionRec) {
            try {
                const bySid = e.app.findRecordsByFilter(
                    "agent_sessions",
                    "session_id = {:sid}",
                    "-updated",
                    1,
                    0,
                    { sid: rawId }
                )
                if (bySid && bySid.length > 0) sessionRec = bySid[0]
            } catch (fErr) {
                sessionRec = null
            }
        }
        if (!sessionRec) {
            return e.json(404, { error: "Session not found" })
        }

        const sessionId = sessionRec.getString("session_id") || sessionRec.id

        // Resolve only files owned by the caller and attached to this exact run.
        // The gateway receives sanitized names/types/URLs, never arbitrary paths.
        const attachments = []
        for (const rawAttachmentId of requestedAttachments) {
            const attachmentId = String(rawAttachmentId || "").trim()
            if (!attachmentId) continue
            let att = null
            try { att = e.app.findRecordById("session_attachments", attachmentId) } catch (aErr) {}
            if (!att || att.getString("owner") !== e.auth.id || att.getString("session_id") !== sessionId) {
                return e.json(400, { error: "Invalid session attachment" })
            }
            const fileName = att.getString("file")
            attachments.push({
                id: att.id,
                name: fileName
            })
        }

        // --- Append the operator turn ---------------------------------------
        let meta = {}
        try {
            meta = sessionRec.get("metadata") || {}
        } catch (mErr) {
            meta = {}
        }
        if (!meta || typeof meta !== "object" || Array.isArray(meta)) meta = {}

        let chatHistory = Array.isArray(meta.chat) ? meta.chat.slice() : []
        const nowIso = new Date().toISOString()
        chatHistory.push({ role: "user", content: message, attachments: attachments, created_at: nowIso })

        // --- Resolve the gateway --------------------------------------------
        let apiKey = ""
        try { apiKey = $os.getenv("OMNIROUTE_API_KEY") || "" } catch (x) {}
        if (!apiKey) {
            try { apiKey = $os.getenv("AI_API_KEY") || "" } catch (x) {}
        }
        // Self-hosted installs keep the key outside the repo tree.
        if (!apiKey) {
            const confCands = [
                ($os.getenv("HOME") || "/home/ubuntu") + "/.flow-work/flow.conf",
                ($os.getenv("HOME") || "/home/ubuntu") + "/.flomaster/flow.conf"
            ]
            for (const cf of confCands) {
                if (apiKey) break
                try {
                    const raw = $os.readFile(cf)
                    const text = typeof raw === "string" ? raw : ""
                    for (const line of text.split("\n")) {
                        const t = line.trim()
                        if (t.startsWith("OMNIROUTE_API_KEY=")) {
                            apiKey = t.slice("OMNIROUTE_API_KEY=".length).trim().replace(/^["']|["']$/g, "")
                            break
                        }
                    }
                } catch (rErr) {}
            }
        }

        let omniUrl = "http://127.0.0.1:20128/v1/chat/completions"
        try {
            const envUrl = $os.getenv("OMNIROUTE_URL") || ""
            if (envUrl) {
                omniUrl = envUrl.replace(/\/+$/, "")
                if (omniUrl.indexOf("/v1/chat/completions") === -1) {
                    omniUrl += "/v1/chat/completions"
                }
            }
        } catch (uErr) {}

        let model = "premium"
        try { model = $os.getenv("AGENT_MODEL") || $os.getenv("AI_MODEL") || "premium" } catch (x) {}

        // --- Ask the gateway -------------------------------------------------
        let reply = ""
        let gatewayReached = false
        if (apiKey) {
            try {
                const userContent = []
                userContent.push({ type: "text", text: message + (attachments.length
                    ? "\n\nAttached files: " + attachments.map(a => a.name).join(", ")
                    : "") })
                for (const payload of rawPayloads) {
                    if (!payload || typeof payload !== "object") continue
                    if (payload.kind === "image" && typeof payload.data === "string" && /^data:image\/(png|jpeg|gif|webp);base64,/.test(payload.data) && payload.data.length <= 6000000) {
                        userContent.push({ type: "image_url", image_url: { url: payload.data } })
                    } else if (payload.kind === "text" && typeof payload.data === "string" && payload.data.length <= 102400) {
                        userContent[0].text += "\n\nAttached text:\n```\n" + payload.data + "\n```"
                    }
                }
                const sysPrompt =
                    "You are the execution copilot inside ProjectBase, an open-source " +
                    "Linear/Plane-style workspace. You are replying inside a live agent " +
                    "execution run. Be concise, technical, and actionable. " +
                    "Run context — agent: " + (sessionRec.getString("agent_name") || "unknown") +
                    ", runtime: " + (sessionRec.getString("runtime") || "unknown") +
                    ", status: " + (sessionRec.getString("status") || "unknown") +
                    ", branch: " + (sessionRec.getString("git_branch") || "unknown")

                const resp = $http.send({
                    url: omniUrl,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + apiKey
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: sysPrompt },
                            { role: "user", content: userContent.length > 1 ? userContent : userContent[0].text }
                        ],
                        max_tokens: 1200,
                        temperature: 0.3
                    }),
                    timeout: 20
                })

                gatewayReached = true
                if (resp.statusCode === 200) {
                    const parsed = JSON.parse(resp.raw)
                    if (parsed.choices && parsed.choices.length > 0) {
                        reply = String(parsed.choices[0].message.content || "").trim()
                    }
                }
            } catch (llmErr) {
                gatewayReached = false
            }
        }

        if (!reply) {
            // Never fake a model answer. Say plainly what happened.
            reply = gatewayReached
                ? "The gateway returned an empty response. Your message is queued on this run."
                : "No LLM gateway configured, so your message is queued on this run. " +
                  "Set OMNIROUTE_API_KEY (or OMNIROUTE_URL) to enable live replies."
        }

        chatHistory.push({ role: "assistant", content: reply, created_at: new Date().toISOString() })
        meta.chat = chatHistory
        sessionRec.set("metadata", meta)
        sessionRec.set("last_prompt", message)
        try {
            e.app.save(sessionRec)
        } catch (sErr) {
            console.log(">>> [ProjectBase] session chat save error:", String((sErr && sErr.message) || sErr))
            return e.json(500, { error: "Failed to persist chat turn" })
        }

        return e.json(200, {
            success: true,
            session_id: sessionId,
            record_id: sessionRec.id,
            response: reply,
            gateway_reached: gatewayReached,
            turns: chatHistory
        })
    } catch (err) {
        console.log(">>> [ProjectBase] session chat error:", String((err && err.message) || err))
        return e.json(500, { error: "Internal server error" })
    }
})
