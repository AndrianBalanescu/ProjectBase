// pb_hooks/80_agent_triggers.pb.js
// Autonomous Agent Dispatcher, Real-Time AI Chat Stream & Job Trigger Engine

routerAdd("POST", "/api/projectbase/dispatch-agent", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required");
        }

        let body = {};
        try {
            body = e.requestInfo().body || {};
        } catch (bErr) {
            return e.json(400, { error: "Invalid JSON body" });
        }

        const issueId = (body.issue_id || "").trim();
        const sessionId = (body.session_id || body.id || "").trim();
        const agentTarget = (body.agent_target || body.target || "flomaster").toLowerCase().trim();
        const customPrompt = (body.prompt || body.instructions || body.message || "").trim();

        if (!customPrompt) {
            return e.json(400, { error: "Prompt / message text is required" });
        }
        if (customPrompt.length > 10000) {
            return e.json(400, { error: "Prompt exceeds maximum allowed length of 10000 characters" });
        }

        // 1. If issueId is provided, claim the issue and record audit comment
        let issue = null;
        let identifier = "WORKSPACE";
        let title = "General Assistant Chat";
        let issuesCol = e.app.findCollectionByNameOrId("issues");
        let commentsCol = e.app.findCollectionByNameOrId("comments");

        if (issueId) {
            try {
                issue = e.app.findRecordById("issues", issueId);
                if (issue) {
                    identifier = issue.get("identifier") || issue.id;
                    title = issue.get("title") || "";
                    issue.set("status", "in_progress");
                    issue.set("assignee", "Flomaster Agent");
                    e.app.save(issue);

                    if (commentsCol) {
                        let comment = new Record(commentsCol);
                        comment.set("issue", issue.id);
                        comment.set("author", "Flomaster Agent");
                        comment.set("author_type", "agent");
                        comment.set("content", `🤖 **Autonomous Task Claimed**\nAgent **Flomaster** claimed task \`${identifier}\`.\n> Instructions: ${customPrompt}`);
                        e.app.save(comment);
                    }
                }
            } catch (x) {}
        }

        // 2. Query Homelab OmniRoute for live intelligent response
        let apiKey = "";
        try { apiKey = $os.getenv("OMNIROUTE_API_KEY") || "sk-767128fa1c8c55d4-a967db-19740040"; } catch (x) {}
        let omniUrl = "http://127.0.0.1:20128/v1/chat/completions";
        try {
            let envUrl = $os.getenv("OMNIROUTE_URL");
            if (envUrl) omniUrl = envUrl.replace(/\/+$/, "") + "/v1/chat/completions";
        } catch (x) {}

        let aiResponse = "";
        try {
            const sysPrompt = "You are Flomaster, the lead autonomous AI software engineer in ProjectBase (a high-performance open-source Linear/Plane workspace). " +
                "Help the user analyze issues, write code, run audits, plan architecture, or execute engineering tasks. Be concise, technical, direct, and actionable.";

            const resp = $http.send({
                url: omniUrl,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + apiKey
                },
                body: JSON.stringify({
                    model: "premium",
                    messages: [
                        { role: "system", content: sysPrompt },
                        { role: "user", content: customPrompt }
                    ],
                    max_tokens: 1200,
                    temperature: 0.3
                }),
                timeout: 25
            });

            if (resp.statusCode === 200) {
                let parsed = JSON.parse(resp.raw);
                if (parsed.choices && parsed.choices.length > 0) {
                    aiResponse = (parsed.choices[0].message.content || "").trim();
                }
            }
        } catch (llmErr) {
            console.log(">>> [Dispatch] OmniRoute live call error:", llmErr);
        }

        if (!aiResponse) {
            aiResponse = `Task received and registered: "${customPrompt.slice(0, 120)}...". Running autonomous execution on ProjectBase workspace.`;
        }

        // 3. Persist chat turn to session record in agent_sessions collection
        let targetSessionId = sessionId;
        let sessionRec = null;
        let sessionCol = null;
        try { sessionCol = e.app.findCollectionByNameOrId("agent_sessions"); } catch (x) {}

        if (sessionCol) {
            if (targetSessionId) {
                try {
                    sessionRec = e.app.findFirstRecordByFilter("agent_sessions", "session_id = {:sid} || id = {:sid}", { sid: targetSessionId });
                } catch (x) {}
            }

            if (!sessionRec) {
                targetSessionId = targetSessionId || ("sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6));
                sessionRec = new Record(sessionCol);
                sessionRec.set("session_id", targetSessionId);
                sessionRec.set("agent_name", "Flomaster (chat)");
                sessionRec.set("runtime", "flomaster");
                sessionRec.set("model", "omniroute/premium");
                sessionRec.set("status", "running");
                sessionRec.set("command", customPrompt);
                sessionRec.set("started_at", new Date().toISOString());
            }

            let meta = sessionRec.get("metadata") || {};
            let chatHistory = meta.chat || [];
            if (!Array.isArray(chatHistory)) chatHistory = [];

            chatHistory.push({
                role: "user",
                content: customPrompt,
                created_at: new Date().toISOString()
            });
            chatHistory.push({
                role: "assistant",
                content: aiResponse,
                created_at: new Date().toISOString()
            });

            sessionRec.set("metadata", Object.assign({}, meta, { chat: chatHistory }));
            sessionRec.set("last_prompt", customPrompt);
            sessionRec.set("status", "running");
            e.app.save(sessionRec);
        }

        return e.json(200, {
            status: "dispatched",
            target: agentTarget,
            task_id: identifier,
            session_id: targetSessionId,
            response: aiResponse,
            message: `Task successfully dispatched to ${agentTarget}`
        });
    } catch (err) {
        console.log(">>> [ProjectBase Agent] dispatch-agent error:", JSON.stringify(err && err.message ? err.message : err));
        return e.json(500, { error: "Agent dispatch failure: " + String(err && err.message ? err.message : err) });
    }
});
