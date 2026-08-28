// pb_hooks/94_workspace_synthesis.pb.js
// Autonomous Workspace Synthesis & Cross-Project Knowledge Retrieval (Epic 11).
//
// Endpoints:
// 1. GET/POST /api/projectbase/workspace/search        - Deep semantic & full-text workspace knowledge search across issues, comments, telemetry & checkpoints
// 2. GET      /api/projectbase/workspace/blockers      - Cross-project blocker detection, dependency alerting, circular deadlock warnings & critical path
// 3. GET/POST /api/projectbase/workspace/retrospective - Automated sprint/cycle retrospective generation, velocity metrics, agent productivity & synthesis

// 1. GET /api/projectbase/workspace/search
routerAdd("GET", "/api/projectbase/workspace/search", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let b = {}
        try { b = req.body || {} } catch (bErr) { b = {} }

        let queryStr = (b.query || b.q || q.query || q.q || "").trim()
        let projectFilter = (b.project_id || b.project || q.project_id || q.project || "").trim()
        let typesParam = b.types || q.types || null
        let limitParam = parseInt(b.limit || q.limit || "20", 10)

        if (!queryStr) {
            return e.json(200, {
                query: "",
                count: 0,
                total_matches: 0,
                types_searched: [],
                results: []
            })
        }
        if (queryStr.length > 256) {
            return e.badRequestError("Search query too long (max 256 chars)")
        }

        let limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(limitParam, 100)
        let targetTypes = ["issues", "comments", "telemetry", "checkpoints"]
        if (typesParam) {
            if (Array.isArray(typesParam)) {
                targetTypes = typesParam.map(t => String(t).toLowerCase().trim())
            } else if (typeof typesParam === "string") {
                targetTypes = typesParam.split(",").map(t => t.toLowerCase().trim()).filter(Boolean)
            }
        }

        let projectCache = {}
        let getProjectInfo = (projId) => {
            if (!projId) return null
            if (projectCache[projId]) return projectCache[projId]
            try {
                let rec = e.app.findRecordById("projects", projId)
                let info = {
                    id: rec.id,
                    name: rec.getString("name") || "",
                    identifier: rec.getString("identifier") || "",
                    color: rec.getString("color") || ""
                }
                projectCache[projId] = info
                return info
            } catch (err) {
                return null
            }
        }

        let issueCache = {}
        let getIssueInfo = (issueId) => {
            if (!issueId) return null
            if (issueCache[issueId]) return issueCache[issueId]
            try {
                let rec = e.app.findRecordById("issues", issueId)
                let info = {
                    id: rec.id,
                    identifier: rec.getString("identifier") || "",
                    title: rec.getString("title") || "",
                    project: rec.getString("project") || ""
                }
                issueCache[issueId] = info
                return info
            } catch (err) {
                return null
            }
        }

        let qLower = queryStr.toLowerCase()
        let qTerms = qLower.split(/\s+/).filter(t => t.length > 1)
        if (qTerms.length === 0) qTerms.push(qLower)

        let makeSnippet = (text, maxLength) => {
            if (!text) return ""
            let maxLen = maxLength || 160
            let str = String(text).replace(/[\r\n]+/g, " ").trim()
            if (str.length <= maxLen) return str
            let idx = str.toLowerCase().indexOf(qLower)
            if (idx === -1 && qTerms.length > 0) {
                idx = str.toLowerCase().indexOf(qTerms[0])
            }
            if (idx === -1) {
                return str.substring(0, maxLen - 3) + "..."
            }
            let start = Math.max(0, idx - 40)
            let end = Math.min(str.length, start + maxLen)
            let snippet = str.substring(start, end)
            if (start > 0) snippet = "..." + snippet
            if (end < str.length) snippet = snippet + "..."
            return snippet
        }

        let allResults = []

        // Search Issues
        if (targetTypes.indexOf("issues") !== -1) {
            let filter = "1=1"
            if (projectFilter) {
                filter += " && project = '" + projectFilter + "'"
            }
            let issues = e.app.findRecordsByFilter("issues", filter, "-created", 300, 0)
            for (let i = 0; i < issues.length; i++) {
                let iss = issues[i]
                let title = iss.getString("title") || ""
                let desc = iss.getString("description") || ""
                let ident = iss.getString("identifier") || ""
                let persona = iss.getString("task_persona") || ""
                let assignee = iss.getString("assignee") || ""
                let status = iss.getString("status") || "todo"
                let priority = iss.getString("priority") || "medium"
                let projectId = iss.getString("project") || ""

                let titleLower = title.toLowerCase()
                let descLower = desc.toLowerCase()
                let identLower = ident.toLowerCase()
                let personaLower = persona.toLowerCase()

                let score = 0
                if (identLower === qLower) score += 120
                else if (identLower.indexOf(qLower) !== -1) score += 80

                if (titleLower === qLower) score += 90
                else if (titleLower.indexOf(qLower) !== -1) score += 50

                if (descLower.indexOf(qLower) !== -1) score += 30
                if (personaLower.indexOf(qLower) !== -1) score += 20
                if (assignee.toLowerCase().indexOf(qLower) !== -1) score += 15

                for (let t = 0; t < qTerms.length; t++) {
                    let term = qTerms[t]
                    if (titleLower.indexOf(term) !== -1) score += 15
                    if (descLower.indexOf(term) !== -1) score += 8
                }

                if (score > 0) {
                    if (status === "in_progress") score += 5
                    let projInfo = getProjectInfo(projectId)
                    let snippet = descLower.indexOf(qLower) !== -1 ? makeSnippet(desc) : makeSnippet(title)
                    allResults.push({
                        type: "issue",
                        id: iss.id,
                        identifier: ident,
                        title: title,
                        snippet: snippet,
                        score: score,
                        status: status,
                        priority: priority,
                        assignee: assignee,
                        task_persona: persona,
                        created: iss.getString("created"),
                        updated: iss.getString("updated"),
                        project: projInfo
                    })
                }
            }
        }

        // Search Comments
        if (targetTypes.indexOf("comments") !== -1) {
            let filter = "1=1"
            let comments = e.app.findRecordsByFilter("comments", filter, "-created", 300, 0)
            for (let i = 0; i < comments.length; i++) {
                let com = comments[i]
                let content = com.getString("content") || com.getString("body") || ""
                let contentLower = content.toLowerCase()
                let issueId = com.getString("issue") || ""

                let score = 0
                if (contentLower.indexOf(qLower) !== -1) score += 40
                for (let t = 0; t < qTerms.length; t++) {
                    if (contentLower.indexOf(qTerms[t]) !== -1) score += 10
                }

                if (score > 0) {
                    let issueInfo = getIssueInfo(issueId)
                    if (projectFilter && issueInfo && issueInfo.project !== projectFilter) {
                        continue
                    }
                    let projInfo = issueInfo ? getProjectInfo(issueInfo.project) : null
                    let rawAuthor = com.getString("author") || com.getString("user") || ""
                    let authorName = rawAuthor || "User"
                    if (rawAuthor && /^[a-z0-9]{15}$/i.test(rawAuthor)) {
                        try {
                            let u = e.app.findRecordById("users", rawAuthor)
                            authorName = u.getString("name") || u.getString("email") || rawAuthor
                        } catch (uErr) {}
                    }

                    allResults.push({
                        type: "comment",
                        id: com.id,
                        issue_id: issueId,
                        issue_identifier: issueInfo ? issueInfo.identifier : "",
                        issue_title: issueInfo ? issueInfo.title : "",
                        author: authorName,
                        snippet: makeSnippet(content),
                        score: score,
                        created: com.getString("created"),
                        project: projInfo
                    })
                }
            }
        }

        // Search Telemetry
        if (targetTypes.indexOf("telemetry") !== -1) {
            try {
                let telemetryCol = e.app.findCollectionByNameOrId("agent_telemetry")
                if (telemetryCol) {
                    let telList = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 200, 0)
                    for (let i = 0; i < telList.length; i++) {
                        let tel = telList[i]
                        let summary = tel.getString("summary") || ""
                        let agentName = tel.getString("agent_name") || ""
                        let eventType = tel.getString("event_type") || ""
                        let payload = JSON.stringify(tel.get("payload") || "")
                        let issueId = tel.getString("issue") || ""

                        let text = (summary + " " + agentName + " " + eventType + " " + payload).toLowerCase()
                        let score = 0
                        if (summary.toLowerCase().indexOf(qLower) !== -1) score += 35
                        if (text.indexOf(qLower) !== -1) score += 20
                        for (let t = 0; t < qTerms.length; t++) {
                            if (text.indexOf(qTerms[t]) !== -1) score += 8
                        }

                        if (score > 0) {
                            let issueInfo = getIssueInfo(issueId)
                            if (projectFilter && issueInfo && issueInfo.project !== projectFilter) {
                                continue
                            }
                            let projInfo = issueInfo ? getProjectInfo(issueInfo.project) : null
                            allResults.push({
                                type: "telemetry",
                                id: tel.id,
                                agent_name: agentName,
                                event_type: eventType,
                                summary: summary,
                                issue_id: issueId,
                                issue_identifier: issueInfo ? issueInfo.identifier : "",
                                snippet: makeSnippet(summary || payload),
                                score: score,
                                timestamp: tel.getString("timestamp") || tel.getString("created"),
                                created: tel.getString("created"),
                                project: projInfo
                            })
                        }
                    }
                }
            } catch (tErr) {}
        }

        // Search Checkpoints
        if (targetTypes.indexOf("checkpoints") !== -1) {
            try {
                let cpCol = e.app.findCollectionByNameOrId("task_checkpoints")
                if (cpCol) {
                    let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 200, 0)
                    for (let i = 0; i < cpList.length; i++) {
                        let cp = cpList[i]
                        let notes = cp.getString("notes") || ""
                        let agentName = cp.getString("agent_name") || ""
                        let persona = cp.getString("persona") || ""
                        let cpType = cp.getString("checkpoint_type") || ""
                        let status = cp.getString("status") || ""
                        let issueId = cp.getString("issue") || ""

                        let text = (notes + " " + agentName + " " + persona + " " + cpType + " " + status).toLowerCase()
                        let score = 0
                        if (notes.toLowerCase().indexOf(qLower) !== -1) score += 35
                        if (text.indexOf(qLower) !== -1) score += 20
                        for (let t = 0; t < qTerms.length; t++) {
                            if (text.indexOf(qTerms[t]) !== -1) score += 8
                        }

                        if (score > 0) {
                            let issueInfo = getIssueInfo(issueId)
                            if (projectFilter && issueInfo && issueInfo.project !== projectFilter) {
                                continue
                            }
                            let projInfo = issueInfo ? getProjectInfo(issueInfo.project) : null
                            allResults.push({
                                type: "checkpoint",
                                id: cp.id,
                                issue_id: issueId,
                                issue_identifier: issueInfo ? issueInfo.identifier : "",
                                checkpoint_type: cpType,
                                status: status,
                                reviewer: agentName,
                                persona: persona,
                                snippet: makeSnippet(notes || (cpType + " " + status)),
                                score: score,
                                created: cp.getString("created"),
                                project: projInfo
                            })
                        }
                    }
                }
            } catch (cErr) {}
        }

        allResults.sort((a, b) => b.score - a.score)
        let trimmed = allResults.slice(0, limit)

        return e.json(200, {
            query: queryStr,
            count: trimmed.length,
            total_matches: allResults.length,
            types_searched: targetTypes,
            results: trimmed
        })
    } catch (err) {
        return e.json(500, { error: "Failed to perform workspace search: " + err })
    }
})

// POST alias for /api/projectbase/workspace/search
routerAdd("POST", "/api/projectbase/workspace/search", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let b = {}
        try { b = req.body || {} } catch (bErr) { b = {} }

        let queryStr = (b.query || b.q || q.query || q.q || "").trim()
        let projectFilter = (b.project_id || b.project || q.project_id || q.project || "").trim()
        let typesParam = b.types || q.types || null
        let limitParam = parseInt(b.limit || q.limit || "20", 10)

        if (!queryStr) {
            return e.json(200, {
                query: "",
                count: 0,
                total_matches: 0,
                types_searched: [],
                results: []
            })
        }
        if (queryStr.length > 256) {
            return e.badRequestError("Search query too long (max 256 chars)")
        }

        let limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(limitParam, 100)
        let targetTypes = ["issues", "comments", "telemetry", "checkpoints"]
        if (typesParam) {
            if (Array.isArray(typesParam)) {
                targetTypes = typesParam.map(t => String(t).toLowerCase().trim())
            } else if (typeof typesParam === "string") {
                targetTypes = typesParam.split(",").map(t => t.toLowerCase().trim()).filter(Boolean)
            }
        }

        let projectCache = {}
        let getProjectInfo = (projId) => {
            if (!projId) return null
            if (projectCache[projId]) return projectCache[projId]
            try {
                let rec = e.app.findRecordById("projects", projId)
                let info = {
                    id: rec.id,
                    name: rec.getString("name") || "",
                    identifier: rec.getString("identifier") || "",
                    color: rec.getString("color") || ""
                }
                projectCache[projId] = info
                return info
            } catch (err) {
                return null
            }
        }

        let issueCache = {}
        let getIssueInfo = (issueId) => {
            if (!issueId) return null
            if (issueCache[issueId]) return issueCache[issueId]
            try {
                let rec = e.app.findRecordById("issues", issueId)
                let info = {
                    id: rec.id,
                    identifier: rec.getString("identifier") || "",
                    title: rec.getString("title") || "",
                    project: rec.getString("project") || ""
                }
                issueCache[issueId] = info
                return info
            } catch (err) {
                return null
            }
        }

        let qLower = queryStr.toLowerCase()
        let qTerms = qLower.split(/\s+/).filter(t => t.length > 1)
        if (qTerms.length === 0) qTerms.push(qLower)

        let makeSnippet = (text, maxLength) => {
            if (!text) return ""
            let maxLen = maxLength || 160
            let str = String(text).replace(/[\r\n]+/g, " ").trim()
            if (str.length <= maxLen) return str
            let idx = str.toLowerCase().indexOf(qLower)
            if (idx === -1 && qTerms.length > 0) {
                idx = str.toLowerCase().indexOf(qTerms[0])
            }
            if (idx === -1) {
                return str.substring(0, maxLen - 3) + "..."
            }
            let start = Math.max(0, idx - 40)
            let end = Math.min(str.length, start + maxLen)
            let snippet = str.substring(start, end)
            if (start > 0) snippet = "..." + snippet
            if (end < str.length) snippet = snippet + "..."
            return snippet
        }

        let allResults = []

        // Search Issues
        if (targetTypes.indexOf("issues") !== -1) {
            let filter = "1=1"
            if (projectFilter) {
                filter += " && project = '" + projectFilter + "'"
            }
            let issues = e.app.findRecordsByFilter("issues", filter, "-created", 300, 0)
            for (let i = 0; i < issues.length; i++) {
                let iss = issues[i]
                let title = iss.getString("title") || ""
                let desc = iss.getString("description") || ""
                let ident = iss.getString("identifier") || ""
                let persona = iss.getString("task_persona") || ""
                let assignee = iss.getString("assignee") || ""
                let status = iss.getString("status") || "todo"
                let priority = iss.getString("priority") || "medium"
                let projectId = iss.getString("project") || ""

                let titleLower = title.toLowerCase()
                let descLower = desc.toLowerCase()
                let identLower = ident.toLowerCase()
                let personaLower = persona.toLowerCase()

                let score = 0
                if (identLower === qLower) score += 120
                else if (identLower.indexOf(qLower) !== -1) score += 80

                if (titleLower === qLower) score += 90
                else if (titleLower.indexOf(qLower) !== -1) score += 50

                if (descLower.indexOf(qLower) !== -1) score += 30
                if (personaLower.indexOf(qLower) !== -1) score += 20
                if (assignee.toLowerCase().indexOf(qLower) !== -1) score += 15

                for (let t = 0; t < qTerms.length; t++) {
                    let term = qTerms[t]
                    if (titleLower.indexOf(term) !== -1) score += 15
                    if (descLower.indexOf(term) !== -1) score += 8
                }

                if (score > 0) {
                    if (status === "in_progress") score += 5
                    let projInfo = getProjectInfo(projectId)
                    let snippet = descLower.indexOf(qLower) !== -1 ? makeSnippet(desc) : makeSnippet(title)
                    allResults.push({
                        type: "issue",
                        id: iss.id,
                        identifier: ident,
                        title: title,
                        snippet: snippet,
                        score: score,
                        status: status,
                        priority: priority,
                        assignee: assignee,
                        task_persona: persona,
                        created: iss.getString("created"),
                        updated: iss.getString("updated"),
                        project: projInfo
                    })
                }
            }
        }

        // Search Comments
        if (targetTypes.indexOf("comments") !== -1) {
            let filter = "1=1"
            let comments = e.app.findRecordsByFilter("comments", filter, "-created", 300, 0)
            for (let i = 0; i < comments.length; i++) {
                let com = comments[i]
                let content = com.getString("content") || com.getString("body") || ""
                let contentLower = content.toLowerCase()
                let issueId = com.getString("issue") || ""

                let score = 0
                if (contentLower.indexOf(qLower) !== -1) score += 40
                for (let t = 0; t < qTerms.length; t++) {
                    if (contentLower.indexOf(qTerms[t]) !== -1) score += 10
                }

                if (score > 0) {
                    let issueInfo = getIssueInfo(issueId)
                    if (projectFilter && issueInfo && issueInfo.project !== projectFilter) {
                        continue
                    }
                    let projInfo = issueInfo ? getProjectInfo(issueInfo.project) : null
                    let rawAuthor = com.getString("author") || com.getString("user") || ""
                    let authorName = rawAuthor || "User"
                    if (rawAuthor && /^[a-z0-9]{15}$/i.test(rawAuthor)) {
                        try {
                            let u = e.app.findRecordById("users", rawAuthor)
                            authorName = u.getString("name") || u.getString("email") || rawAuthor
                        } catch (uErr) {}
                    }

                    allResults.push({
                        type: "comment",
                        id: com.id,
                        issue_id: issueId,
                        issue_identifier: issueInfo ? issueInfo.identifier : "",
                        issue_title: issueInfo ? issueInfo.title : "",
                        author: authorName,
                        snippet: makeSnippet(content),
                        score: score,
                        created: com.getString("created"),
                        project: projInfo
                    })
                }
            }
        }

        // Search Telemetry
        if (targetTypes.indexOf("telemetry") !== -1) {
            try {
                let telemetryCol = e.app.findCollectionByNameOrId("agent_telemetry")
                if (telemetryCol) {
                    let telList = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 200, 0)
                    for (let i = 0; i < telList.length; i++) {
                        let tel = telList[i]
                        let summary = tel.getString("summary") || ""
                        let agentName = tel.getString("agent_name") || ""
                        let eventType = tel.getString("event_type") || ""
                        let payload = JSON.stringify(tel.get("payload") || "")
                        let issueId = tel.getString("issue") || ""

                        let text = (summary + " " + agentName + " " + eventType + " " + payload).toLowerCase()
                        let score = 0
                        if (summary.toLowerCase().indexOf(qLower) !== -1) score += 35
                        if (text.indexOf(qLower) !== -1) score += 20
                        for (let t = 0; t < qTerms.length; t++) {
                            if (text.indexOf(qTerms[t]) !== -1) score += 8
                        }

                        if (score > 0) {
                            let issueInfo = getIssueInfo(issueId)
                            if (projectFilter && issueInfo && issueInfo.project !== projectFilter) {
                                continue
                            }
                            let projInfo = issueInfo ? getProjectInfo(issueInfo.project) : null
                            allResults.push({
                                type: "telemetry",
                                id: tel.id,
                                agent_name: agentName,
                                event_type: eventType,
                                summary: summary,
                                issue_id: issueId,
                                issue_identifier: issueInfo ? issueInfo.identifier : "",
                                snippet: makeSnippet(summary || payload),
                                score: score,
                                timestamp: tel.getString("timestamp") || tel.getString("created"),
                                created: tel.getString("created"),
                                project: projInfo
                            })
                        }
                    }
                }
            } catch (tErr) {}
        }

        // Search Checkpoints
        if (targetTypes.indexOf("checkpoints") !== -1) {
            try {
                let cpCol = e.app.findCollectionByNameOrId("task_checkpoints")
                if (cpCol) {
                    let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 200, 0)
                    for (let i = 0; i < cpList.length; i++) {
                        let cp = cpList[i]
                        let notes = cp.getString("notes") || ""
                        let agentName = cp.getString("agent_name") || ""
                        let persona = cp.getString("persona") || ""
                        let cpType = cp.getString("checkpoint_type") || ""
                        let status = cp.getString("status") || ""
                        let issueId = cp.getString("issue") || ""

                        let text = (notes + " " + agentName + " " + persona + " " + cpType + " " + status).toLowerCase()
                        let score = 0
                        if (notes.toLowerCase().indexOf(qLower) !== -1) score += 35
                        if (text.indexOf(qLower) !== -1) score += 20
                        for (let t = 0; t < qTerms.length; t++) {
                            if (text.indexOf(qTerms[t]) !== -1) score += 8
                        }

                        if (score > 0) {
                            let issueInfo = getIssueInfo(issueId)
                            if (projectFilter && issueInfo && issueInfo.project !== projectFilter) {
                                continue
                            }
                            let projInfo = issueInfo ? getProjectInfo(issueInfo.project) : null
                            allResults.push({
                                type: "checkpoint",
                                id: cp.id,
                                issue_id: issueId,
                                issue_identifier: issueInfo ? issueInfo.identifier : "",
                                checkpoint_type: cpType,
                                status: status,
                                reviewer: agentName,
                                persona: persona,
                                snippet: makeSnippet(notes || (cpType + " " + status)),
                                score: score,
                                created: cp.getString("created"),
                                project: projInfo
                            })
                        }
                    }
                }
            } catch (cErr) {}
        }

        allResults.sort((a, b) => b.score - a.score)
        let trimmed = allResults.slice(0, limit)

        return e.json(200, {
            query: queryStr,
            count: trimmed.length,
            total_matches: allResults.length,
            types_searched: targetTypes,
            results: trimmed
        })
    } catch (err) {
        return e.json(500, { error: "Failed to perform workspace search: " + err })
    }
})

// 2. GET /api/projectbase/workspace/blockers
routerAdd("GET", "/api/projectbase/workspace/blockers", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let projectFilter = (q.project_id || q.project || "").trim()
        let includeCrossProject = q.include_cross_project !== "false"

        // Load all active issues
        let issues = e.app.findRecordsByFilter("issues", "1=1", "-created", 1000, 0)
        let issueMap = {}
        let projectCache = {}

        for (let i = 0; i < issues.length; i++) {
            issueMap[issues[i].id] = issues[i]
        }

        let getProjectInfo = (projId) => {
            if (!projId) return null
            if (projectCache[projId]) return projectCache[projId]
            try {
                let rec = e.app.findRecordById("projects", projId)
                let info = {
                    id: rec.id,
                    name: rec.getString("name") || "",
                    identifier: rec.getString("identifier") || "",
                    color: rec.getString("color") || ""
                }
                projectCache[projId] = info
                return info
            } catch (err) {
                return null
            }
        }

        let toArr = (value) => {
            if (!value) return []
            if (Array.isArray(value)) {
                if (value.length === 0) return []
                if (typeof value[0] === "object" && value[0] !== null) return value
                try { let a = JSON.parse(String(value)); if (Array.isArray(a)) return a } catch (err) {}
            } else if (typeof value === "string") {
                try { let a = JSON.parse(value); if (Array.isArray(a)) return a } catch (err) {}
            } else {
                try { let a = JSON.parse(String(value)); if (Array.isArray(a)) return a } catch (err) {}
            }
            return []
        }

        let blockersMap = {}
        let blockedByMap = {}

        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let issId = iss.id
            if (!blockersMap[issId]) blockersMap[issId] = []
            if (!blockedByMap[issId]) blockedByMap[issId] = []

            let rels = toArr(iss.get("relations"))

            for (let r = 0; r < rels.length; r++) {
                let rel = rels[r]
                let targetId = rel.issue
                if (!targetId || !issueMap[targetId]) continue

                if (rel.type === "blocks") {
                    if (blockersMap[issId].indexOf(targetId) === -1) blockersMap[issId].push(targetId)
                    if (!blockedByMap[targetId]) blockedByMap[targetId] = []
                    if (blockedByMap[targetId].indexOf(issId) === -1) blockedByMap[targetId].push(issId)
                } else if (rel.type === "blocked_by") {
                    if (blockedByMap[issId].indexOf(targetId) === -1) blockedByMap[issId].push(targetId)
                    if (!blockersMap[targetId]) blockersMap[targetId] = []
                    if (blockersMap[targetId].indexOf(issId) === -1) blockersMap[targetId].push(issId)
                }
            }

            // DAG parent/child relationship
            let parentId = iss.getString("parent_issue")
            if (parentId && issueMap[parentId] && iss.getString("status") !== "done" && iss.getString("status") !== "cancelled") {
                if (!blockersMap[issId]) blockersMap[issId] = []
                if (blockersMap[issId].indexOf(parentId) === -1) blockersMap[issId].push(parentId)
                if (!blockedByMap[parentId]) blockedByMap[parentId] = []
                if (blockedByMap[parentId].indexOf(issId) === -1) blockedByMap[parentId].push(issId)
            }
        }

        // Circular dependency detection via DFS
        let circularCycles = []
        let visited = {}
        let recStack = {}

        let findCycles = (node, path) => {
            visited[node] = true
            recStack[node] = true
            path.push(node)

            let neighbors = blockersMap[node] || []
            for (let n = 0; n < neighbors.length; n++) {
                let neighbor = neighbors[n]
                if (!visited[neighbor]) {
                    findCycles(neighbor, path)
                } else if (recStack[neighbor]) {
                    let cyclePath = path.slice(path.indexOf(neighbor)).concat(neighbor)
                    let cycleIdents = cyclePath.map(id => issueMap[id] ? issueMap[id].getString("identifier") : id)
                    circularCycles.push({
                        cycle_ids: cyclePath,
                        cycle_identifiers: cycleIdents,
                        warning: "Circular dependency detected: " + cycleIdents.join(" -> ")
                    })
                }
            }

            recStack[node] = false
            path.pop()
        }

        let allNodeIds = Object.keys(issueMap)
        for (let i = 0; i < allNodeIds.length; i++) {
            let nId = allNodeIds[i]
            if (!visited[nId]) {
                findCycles(nId, [])
            }
        }

        let computeImpact = (startNode) => {
            let seen = {}
            let queue = (blockersMap[startNode] || []).slice()
            let count = 0
            while (queue.length > 0) {
                let curr = queue.shift()
                if (!seen[curr]) {
                    seen[curr] = true
                    count++
                    let next = blockersMap[curr] || []
                    for (let x = 0; x < next.length; x++) {
                        if (!seen[next[x]]) queue.push(next[x])
                    }
                }
            }
            return count
        }

        let directBlockersList = []
        let blockedIssuesList = []
        let crossProjectBlockersCount = 0

        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let issId = iss.id
            let status = iss.getString("status")
            let isOpen = (status !== "done" && status !== "cancelled")
            let projId = iss.getString("project")

            if (projectFilter && projId !== projectFilter && !includeCrossProject) {
                continue
            }

            let downstreamIds = blockersMap[issId] || []
            if (isOpen && downstreamIds.length > 0) {
                let blockedItems = []
                let isCrossProject = false

                for (let d = 0; d < downstreamIds.length; d++) {
                    let downId = downstreamIds[d]
                    let downIss = issueMap[downId]
                    if (downIss) {
                        let downProj = downIss.getString("project")
                        if (downProj !== projId) {
                            isCrossProject = true
                        }
                        blockedItems.push({
                            id: downIss.id,
                            identifier: downIss.getString("identifier"),
                            title: downIss.getString("title"),
                            status: downIss.getString("status"),
                            project: getProjectInfo(downProj)
                        })
                    }
                }

                if (blockedItems.length > 0) {
                    if (isCrossProject) crossProjectBlockersCount++
                    let impact = computeImpact(issId)
                    let isStale = (!iss.getString("assignee") && (status === "todo" || status === "backlog"))

                    directBlockersList.push({
                        issue: {
                            id: iss.id,
                            identifier: iss.getString("identifier"),
                            title: iss.getString("title"),
                            status: status,
                            priority: iss.getString("priority"),
                            assignee: iss.getString("assignee"),
                            task_persona: iss.getString("task_persona"),
                            project: getProjectInfo(projId)
                        },
                        blocked_issues: blockedItems,
                        blocked_count: blockedItems.length,
                        impact_score: impact,
                        is_cross_project: isCrossProject,
                        is_stale_warning: isStale,
                        recommendation: isStale
                            ? "Unassigned blocking task. Assign an agent persona or engineer immediately."
                            : (isCrossProject
                                ? "Cross-project blocker impacting external teams. Prioritize resolution."
                                : "Active blocker on critical path.")
                    })
                }
            }

            let upstreamIds = blockedByMap[issId] || []
            if (isOpen && upstreamIds.length > 0) {
                let activeUpstream = []
                for (let u = 0; u < upstreamIds.length; u++) {
                    let upId = upstreamIds[u]
                    let upIss = issueMap[upId]
                    if (upIss) {
                        let upStatus = upIss.getString("status")
                        if (upStatus !== "done" && upStatus !== "cancelled") {
                            activeUpstream.push({
                                id: upIss.id,
                                identifier: upIss.getString("identifier"),
                                title: upIss.getString("title"),
                                status: upStatus,
                                assignee: upIss.getString("assignee"),
                                project: getProjectInfo(upIss.getString("project"))
                            })
                        }
                    }
                }

                if (activeUpstream.length > 0) {
                    blockedIssuesList.push({
                        issue: {
                            id: iss.id,
                            identifier: iss.getString("identifier"),
                            title: iss.getString("title"),
                            status: status,
                            priority: iss.getString("priority"),
                            assignee: iss.getString("assignee"),
                            project: getProjectInfo(projId)
                        },
                        unresolved_blockers: activeUpstream,
                        unresolved_blockers_count: activeUpstream.length
                    })
                }
            }
        }

        directBlockersList.sort((a, b) => b.impact_score - a.impact_score)
        let criticalPath = directBlockersList.slice(0, 5)

        return e.json(200, {
            summary: {
                total_active_blockers: directBlockersList.length,
                total_blocked_issues: blockedIssuesList.length,
                cross_project_blockers_count: crossProjectBlockersCount,
                critical_path_count: criticalPath.length,
                circular_cycles_detected: circularCycles.length
            },
            critical_path: criticalPath,
            direct_blockers: directBlockersList,
            blocked_issues: blockedIssuesList,
            circular_warnings: circularCycles
        })
    } catch (err) {
        return e.json(500, { error: "Failed to analyze workspace blockers: " + err })
    }
})

// 3. GET /api/projectbase/workspace/retrospective
routerAdd("GET", "/api/projectbase/workspace/retrospective", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let b = {}
        try { b = req.body || {} } catch (bErr) { b = {} }

        let cycleFilter = (b.cycle_id || b.cycle || q.cycle_id || q.cycle || "").trim()
        let projectFilter = (b.project_id || b.project || q.project_id || q.project || "").trim()

        let filter = "1=1"
        if (projectFilter) {
            filter += " && project = '" + projectFilter + "'"
        }
        if (cycleFilter) {
            filter += " && cycle = '" + cycleFilter + "'"
        }

        let issues = e.app.findRecordsByFilter("issues", filter, "-created", 1000, 0)
        let totalIssues = issues.length
        let completedIssues = 0
        let totalEstimate = 0
        let completedEstimate = 0

        let statusCounts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0 }
        let priorityCounts = { low: 0, medium: 0, high: 0, urgent: 0 }

        let completedRecords = []
        let agentStats = {}

        let getAgentEntry = (name) => {
            let key = (name || "unassigned").trim()
            if (!agentStats[key]) {
                agentStats[key] = {
                    agent_name: key,
                    total_assigned: 0,
                    completed_tasks: 0,
                    in_progress_tasks: 0,
                    estimate_delivered: 0,
                    personas: {}
                }
            }
            return agentStats[key]
        }

        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let s = iss.getString("status") || "todo"
            let p = iss.getString("priority") || "medium"
            let est = iss.getInt("estimate") || 0
            let assignee = iss.getString("assignee") || "Unassigned"
            let persona = iss.getString("task_persona") || "general"

            if (statusCounts[s] !== undefined) statusCounts[s]++
            if (priorityCounts[p] !== undefined) priorityCounts[p]++

            totalEstimate += est

            let agent = getAgentEntry(assignee)
            agent.total_assigned++
            if (!agent.personas[persona]) agent.personas[persona] = 0
            agent.personas[persona]++

            if (s === "done") {
                completedIssues++
                completedEstimate += est
                agent.completed_tasks++
                agent.estimate_delivered += est
                completedRecords.push(iss)
            } else if (s === "in_progress") {
                agent.in_progress_tasks++
            }
        }

        let completionRate = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0

        // Ingest telemetry counts for agent productivity
        try {
            let telCol = e.app.findCollectionByNameOrId("agent_telemetry")
            if (telCol) {
                let telList = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 500, 0)
                for (let t = 0; t < telList.length; t++) {
                    let aName = telList[t].getString("agent_name") || "agent"
                    if (agentStats[aName]) {
                        if (!agentStats[aName].telemetry_events) agentStats[aName].telemetry_events = 0
                        agentStats[aName].telemetry_events++
                    }
                }
            }
        } catch (tErr) {}

        // Ingest quality gate validation checkpoints
        let totalCheckpoints = 0
        let passedCheckpoints = 0
        let failedCheckpoints = 0
        try {
            let cpCol = e.app.findCollectionByNameOrId("task_checkpoints")
            if (cpCol) {
                let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
                totalCheckpoints = cpList.length
                for (let c = 0; c < cpList.length; c++) {
                    let st = cpList[c].getString("status")
                    let reviewer = cpList[c].getString("agent_name") || "reviewer"
                    if (st === "passed") passedCheckpoints++
                    else if (st === "failed" || st === "changes_requested") failedCheckpoints++

                    if (agentStats[reviewer]) {
                        if (!agentStats[reviewer].checkpoints_conducted) agentStats[reviewer].checkpoints_conducted = 0
                        agentStats[reviewer].checkpoints_conducted++
                    }
                }
            }
        } catch (cErr) {}

        let qualityGatePassRate = totalCheckpoints > 0 ? Math.round((passedCheckpoints / totalCheckpoints) * 100) : 100

        // Generate synthesis highlights, bottlenecks & recommendations
        let highlights = []
        let bottlenecks = []
        let recommendations = []

        if (completedIssues > 0) {
            highlights.push("Successfully completed " + completedIssues + " issues (" + completedEstimate + " points delivered).")
        }
        if (completedRecords.length > 0) {
            let sample = completedRecords.slice(0, 3).map(r => r.getString("identifier") + ": " + r.getString("title"))
            highlights.push("Key deliverables: " + sample.join("; "))
        }
        if (qualityGatePassRate >= 90 && totalCheckpoints > 0) {
            highlights.push("High quality assurance rate: " + qualityGatePassRate + "% verification pass rate across " + totalCheckpoints + " checkpoints.")
        }

        if (statusCounts.in_review > 3) {
            bottlenecks.push("Review backlog: " + statusCounts.in_review + " issues are currently waiting in 'in_review'.")
            recommendations.push("Dispatch automated peer-review and QA verification agents to clear the in_review queue.")
        }
        if (failedCheckpoints > 0) {
            bottlenecks.push("Quality gate failures: " + failedCheckpoints + " checkpoints failed or requested changes.")
            recommendations.push("Prioritize resolving test failures and review feedback before advancing to next cycle.")
        }
        if (statusCounts.todo > statusCounts.done * 2 && statusCounts.todo > 5) {
            recommendations.push("Decompose large backlog items into subtask DAGs with specialized agent personas to increase parallelism.")
        }
        if (recommendations.length === 0) {
            recommendations.push("Sprint velocity and quality gates are optimal. Continue advancing next roadmap milestones.")
        }

        let agentBreakdown = Object.values(agentStats)

        return e.json(200, {
            period: {
                cycle_id: cycleFilter || null,
                project_id: projectFilter || null,
                generated_at: new Date().toISOString()
            },
            velocity: {
                total_issues: totalIssues,
                completed_issues: completedIssues,
                completion_rate_percent: completionRate,
                total_points_estimated: totalEstimate,
                points_delivered: completedEstimate
            },
            status_breakdown: statusCounts,
            priority_breakdown: priorityCounts,
            quality_metrics: {
                total_checkpoints: totalCheckpoints,
                passed_checkpoints: passedCheckpoints,
                failed_checkpoints: failedCheckpoints,
                pass_rate_percent: qualityGatePassRate
            },
            agent_productivity: agentBreakdown,
            retrospective_synthesis: {
                highlights: highlights,
                bottlenecks: bottlenecks,
                recommendations: recommendations
            }
        })
    } catch (err) {
        return e.json(500, { error: "Failed to generate sprint retrospective: " + err })
    }
})

// POST alias for /api/projectbase/workspace/retrospective
routerAdd("POST", "/api/projectbase/workspace/retrospective", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let b = {}
        try { b = req.body || {} } catch (bErr) { b = {} }

        let cycleFilter = (b.cycle_id || b.cycle || q.cycle_id || q.cycle || "").trim()
        let projectFilter = (b.project_id || b.project || q.project_id || q.project || "").trim()

        let filter = "1=1"
        if (projectFilter) {
            filter += " && project = '" + projectFilter + "'"
        }
        if (cycleFilter) {
            filter += " && cycle = '" + cycleFilter + "'"
        }

        let issues = e.app.findRecordsByFilter("issues", filter, "-created", 1000, 0)
        let totalIssues = issues.length
        let completedIssues = 0
        let totalEstimate = 0
        let completedEstimate = 0

        let statusCounts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0 }
        let priorityCounts = { low: 0, medium: 0, high: 0, urgent: 0 }

        let completedRecords = []
        let agentStats = {}

        let getAgentEntry = (name) => {
            let key = (name || "unassigned").trim()
            if (!agentStats[key]) {
                agentStats[key] = {
                    agent_name: key,
                    total_assigned: 0,
                    completed_tasks: 0,
                    in_progress_tasks: 0,
                    estimate_delivered: 0,
                    personas: {}
                }
            }
            return agentStats[key]
        }

        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let s = iss.getString("status") || "todo"
            let p = iss.getString("priority") || "medium"
            let est = iss.getInt("estimate") || 0
            let assignee = iss.getString("assignee") || "Unassigned"
            let persona = iss.getString("task_persona") || "general"

            if (statusCounts[s] !== undefined) statusCounts[s]++
            if (priorityCounts[p] !== undefined) priorityCounts[p]++

            totalEstimate += est

            let agent = getAgentEntry(assignee)
            agent.total_assigned++
            if (!agent.personas[persona]) agent.personas[persona] = 0
            agent.personas[persona]++

            if (s === "done") {
                completedIssues++
                completedEstimate += est
                agent.completed_tasks++
                agent.estimate_delivered += est
                completedRecords.push(iss)
            } else if (s === "in_progress") {
                agent.in_progress_tasks++
            }
        }

        let completionRate = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0

        // Ingest telemetry counts for agent productivity
        try {
            let telCol = e.app.findCollectionByNameOrId("agent_telemetry")
            if (telCol) {
                let telList = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 500, 0)
                for (let t = 0; t < telList.length; t++) {
                    let aName = telList[t].getString("agent_name") || "agent"
                    if (agentStats[aName]) {
                        if (!agentStats[aName].telemetry_events) agentStats[aName].telemetry_events = 0
                        agentStats[aName].telemetry_events++
                    }
                }
            }
        } catch (tErr) {}

        // Ingest quality gate validation checkpoints
        let totalCheckpoints = 0
        let passedCheckpoints = 0
        let failedCheckpoints = 0
        try {
            let cpCol = e.app.findCollectionByNameOrId("task_checkpoints")
            if (cpCol) {
                let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
                totalCheckpoints = cpList.length
                for (let c = 0; c < cpList.length; c++) {
                    let st = cpList[c].getString("status")
                    let reviewer = cpList[c].getString("agent_name") || "reviewer"
                    if (st === "passed") passedCheckpoints++
                    else if (st === "failed" || st === "changes_requested") failedCheckpoints++

                    if (agentStats[reviewer]) {
                        if (!agentStats[reviewer].checkpoints_conducted) agentStats[reviewer].checkpoints_conducted = 0
                        agentStats[reviewer].checkpoints_conducted++
                    }
                }
            }
        } catch (cErr) {}

        let qualityGatePassRate = totalCheckpoints > 0 ? Math.round((passedCheckpoints / totalCheckpoints) * 100) : 100

        // Generate synthesis highlights, bottlenecks & recommendations
        let highlights = []
        let bottlenecks = []
        let recommendations = []

        if (completedIssues > 0) {
            highlights.push("Successfully completed " + completedIssues + " issues (" + completedEstimate + " points delivered).")
        }
        if (completedRecords.length > 0) {
            let sample = completedRecords.slice(0, 3).map(r => r.getString("identifier") + ": " + r.getString("title"))
            highlights.push("Key deliverables: " + sample.join("; "))
        }
        if (qualityGatePassRate >= 90 && totalCheckpoints > 0) {
            highlights.push("High quality assurance rate: " + qualityGatePassRate + "% verification pass rate across " + totalCheckpoints + " checkpoints.")
        }

        if (statusCounts.in_review > 3) {
            bottlenecks.push("Review backlog: " + statusCounts.in_review + " issues are currently waiting in 'in_review'.")
            recommendations.push("Dispatch automated peer-review and QA verification agents to clear the in_review queue.")
        }
        if (failedCheckpoints > 0) {
            bottlenecks.push("Quality gate failures: " + failedCheckpoints + " checkpoints failed or requested changes.")
            recommendations.push("Prioritize resolving test failures and review feedback before advancing to next cycle.")
        }
        if (statusCounts.todo > statusCounts.done * 2 && statusCounts.todo > 5) {
            recommendations.push("Decompose large backlog items into subtask DAGs with specialized agent personas to increase parallelism.")
        }
        if (recommendations.length === 0) {
            recommendations.push("Sprint velocity and quality gates are optimal. Continue advancing next roadmap milestones.")
        }

        let agentBreakdown = Object.values(agentStats)

        return e.json(200, {
            period: {
                cycle_id: cycleFilter || null,
                project_id: projectFilter || null,
                generated_at: new Date().toISOString()
            },
            velocity: {
                total_issues: totalIssues,
                completed_issues: completedIssues,
                completion_rate_percent: completionRate,
                total_points_estimated: totalEstimate,
                points_delivered: completedEstimate
            },
            status_breakdown: statusCounts,
            priority_breakdown: priorityCounts,
            quality_metrics: {
                total_checkpoints: totalCheckpoints,
                passed_checkpoints: passedCheckpoints,
                failed_checkpoints: failedCheckpoints,
                pass_rate_percent: qualityGatePassRate
            },
            agent_productivity: agentBreakdown,
            retrospective_synthesis: {
                highlights: highlights,
                bottlenecks: bottlenecks,
                recommendations: recommendations
            }
        })
    } catch (err) {
        return e.json(500, { error: "Failed to generate sprint retrospective: " + err })
    }
})
