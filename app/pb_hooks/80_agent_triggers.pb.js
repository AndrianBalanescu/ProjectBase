// pb_hooks/80_agent_triggers.pb.js
// Autonomous Agent Dispatcher & Job Trigger Engine

routerAdd("POST", "/api/projectbase/dispatch-agent", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try {
            body = e.requestInfo().body || {}
        } catch (bErr) {
            return e.json(400, { error: "Invalid JSON body" })
        }
        let issueId = body.issue_id
        let agentTarget = body.agent_target || "flomaster" // 'flomaster', 'hermes', 'windmill', 'custom'
        let customPrompt = body.prompt || ""

        const allowedTargets = ["flomaster", "hermes", "windmill", "custom"]
        if (typeof issueId !== "string" || !/^[a-zA-Z0-9]{10,20}$/.test(issueId)) {
            return e.json(400, { error: "Missing or invalid 'issue_id'" })
        }
        if (typeof agentTarget !== "string" || !allowedTargets.includes(agentTarget)) {
            return e.json(400, { error: "Invalid 'agent_target' (expected one of: " + allowedTargets.join(", ") + ")" })
        }
        if (typeof customPrompt !== "string" || customPrompt.length > 8000) {
            return e.json(400, { error: "Invalid 'prompt' (must be a string of at most 8000 characters)" })
        }

        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let commentsCol = e.app.findCollectionByNameOrId("comments")
        let issue
        try {
            issue = e.app.findRecordById("issues", issueId)
        } catch (nfErr) {
            return e.json(404, { error: "Issue not found" })
        }

        let identifier = issue.get("identifier")
        let title = issue.get("title") || ""
        let desc = issue.get("description") || ""

        // 1. Update task to in_progress and assign to agent
        issue.set("status", "in_progress")
        let agentName = {
            flomaster: "Flomaster Agent",
            hermes: "Hermes Agent",
            windmill: "Windmill Agent",
            custom: "Custom Agent"
        }[agentTarget] || "Flomaster Agent"
        issue.set("assignee", agentName)
        e.app.save(issue)

        // 2. Add audit comment
        let comment = new Record(commentsCol)
        comment.set("issue", issue.id)
        comment.set("author", agentName)
        comment.set("author_type", "agent")
        comment.set("content", `🤖 **Autonomous Task Claimed**\nAgent **${agentName}** has claimed task \`${identifier}\` for execution.\n${customPrompt ? '> Instructions: ' + customPrompt : ''}`)
        e.app.save(comment)

        // 3. Dispatch to Windmill / Webhook / Hermes if configured
        let windmillUrl = $os.getenv("WINDMILL_WEBHOOK_URL")
        let agentWebhook = $os.getenv("AGENT_TRIGGER_WEBHOOK")

        let dispatchedExternal = false

        if (windmillUrl) {
            try {
                $http.send({
                    url: windmillUrl,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        task_id: identifier,
                        title: title,
                        description: desc,
                        agent: agentTarget,
                        prompt: customPrompt
                    }),
                    timeout: 5
                })
                dispatchedExternal = true
            } catch (wErr) {}
        } else if (agentWebhook) {
            try {
                $http.send({
                    url: agentWebhook,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        event: "agent.trigger",
                        agent: agentTarget,
                        issue: {
                            id: issue.id,
                            identifier: identifier,
                            title: title,
                            description: desc
                        },
                        prompt: customPrompt
                    }),
                    timeout: 5
                })
                dispatchedExternal = true
            } catch (aErr) {}
        }

        console.log(`>>> [ProjectBase Agent] Dispatched task ${identifier} to ${agentName}`)

        return e.json(200, {
            success: true,
            message: `Dispatched ${identifier} to ${agentName}`,
            issue: {
                id: issue.id,
                identifier: identifier,
                status: "in_progress",
                assignee: agentName
            },
            dispatched_external: dispatchedExternal
        })
    } catch (err) {
        console.log(">>> [ProjectBase Agent] dispatch-agent error:", JSON.stringify(err && err.message ? err.message : err))
        return e.json(500, { error: "Internal server error" })
    }
})
