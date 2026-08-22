// pb_hooks/70_ai_assist.pb.js
// Native AI copilot endpoints for smart subtask generation, description polish, and sprint summaries

routerAdd("POST", "/api/projectbase/ai-assist", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body = e.requestInfo().body || {}
        let action = body.action || "generate_subtasks"
        let title = body.title || ""
        let description = body.description || ""

        if (!title && !description) {
            return e.badRequestError("Title or description required for AI assistance")
        }

        let aiEndpoint = $os.getenv("AI_API_BASE") || "http://127.0.0.1:20128/v1/chat/completions"
        let aiKey = $os.getenv("AI_API_KEY") || "omniroute"
        let aiModel = $os.getenv("AI_MODEL") || "rc/claude-sonnet-4-5"

        let systemPrompt = "You are an expert technical product manager and engineering lead. You provide crisp, concise, high-impact project management assistance."
        let userPrompt = ""

        if (action === "generate_subtasks") {
            userPrompt = `Given the task title: "${title}" and description: "${description}", generate 4 to 6 concrete, sequential, actionable checklist subtasks. Return ONLY a JSON array of strings, e.g. ["Step 1: ...", "Step 2: ..."]. No markdown formatting, no commentary.`
        } else if (action === "polish_description") {
            userPrompt = `Given the task title: "${title}" and current draft: "${description}", write a professional, well-structured markdown description containing:
## 🎯 Objective
## 📋 Acceptance Criteria (checklist format)
## 🛠️ Technical Considerations
## 🧪 Verification Plan

Be direct, technical, concise.`
        } else if (action === "summarize_cycle") {
            let issuesJson = JSON.stringify(body.issues || [])
            userPrompt = `Given the sprint cycle issues: ${issuesJson}, provide a concise executive summary with:
1. Key achievements and completed scope
2. Work in progress & blockers
3. Velocity analysis & recommendations`
        }

        let resultText = ""
        let usedLlm = false

        // Attempt LLM call
        try {
            let llmRes = $http.send({
                url: aiEndpoint,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + aiKey
                },
                body: JSON.stringify({
                    model: aiModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                }),
                timeout: 8
            })

            if (llmRes.statusCode === 200) {
                let parsed = JSON.parse(llmRes.raw)
                if (parsed.choices && parsed.choices.length > 0) {
                    resultText = parsed.choices[0].message.content.trim()
                    usedLlm = true
                }
            }
        } catch (llmErr) {
            // Fallback to intelligent rule-based generation
        }

        // Intelligent Fallback if LLM is offline or unauthenticated
        if (!resultText) {
            if (action === "generate_subtasks") {
                let subtasks = [
                    `Research and architectural design for ${title}`,
                    `Implement core logic and schema updates for ${title}`,
                    `Write unit and integration tests covering edge cases`,
                    `Perform E2E validation and security checks`,
                    `Document API endpoints and deploy to environment`
                ]
                return e.json(200, {
                    success: true,
                    action: action,
                    used_llm: false,
                    subtasks: subtasks
                })
            } else if (action === "polish_description") {
                let polished = `## 🎯 Objective\nImplement and deliver **${title}** with full verification.\n\n## 📋 Acceptance Criteria\n- [ ] Core functionality implemented according to specifications\n- [ ] Unit & integration test suites passing\n- [ ] Zero console errors and clean log outputs\n- [ ] Documentation updated\n\n## 🛠️ Technical Considerations\n${description ? description : 'Ensure high performance, minimal memory footprint, and real-time synchronization.'}\n\n## 🧪 Verification Plan\nRun automated test suite and perform live end-to-end audit.`
                return e.json(200, {
                    success: true,
                    action: action,
                    used_llm: false,
                    description: polished
                })
            }
        }

        // Parse JSON subtasks if returned by LLM
        if (action === "generate_subtasks") {
            let parsedSubtasks = []
            try {
                // Clean potential markdown code blocks ```json ... ```
                let cleaned = resultText.replace(/```json/g, "").replace(/```/g, "").trim()
                parsedSubtasks = JSON.parse(cleaned)
            } catch (pErr) {
                parsedSubtasks = resultText.split("\n")
                    .map(s => s.replace(/^[-*0-9.)\s]+/, "").trim())
                    .filter(s => s.length > 0)
            }
            return e.json(200, {
                success: true,
                action: action,
                used_llm: usedLlm,
                subtasks: parsedSubtasks
            })
        }

        return e.json(200, {
            success: true,
            action: action,
            used_llm: usedLlm,
            result: resultText
        })
    } catch (err) {
        return e.json(500, { error: err.message })
    }
})
