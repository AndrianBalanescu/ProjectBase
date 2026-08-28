// pb_hooks/91_mcp_server.pb.js
// FastMCP server for ProjectBase — JSON-RPC 2.0 over HTTP.
//
// Exposes MCP tools backed by the local PocketBase app so external agents
// (flomaster, hermes, cursor, claude) can read/create/update/move issues and cycles.
//
// Endpoint:  POST /api/projectbase/mcp
// Auth:      Authorization: Bearer <pb_user_token>   (required)
//            X-Test-User-ID: <users_record_id>        (local test bypass ONLY —
//            active when PB_MCP_TEST_BYPASS=1 is set in the process environment;
//            never enabled in production)
//
// Methods:   initialize | ping | tools/list | tools/call
// Tools:     list_projects, list_issues, get_issue, create_issue, update_issue, move_issue, add_comment, list_cycles, list_milestones, get_stats
//
// NOTE (PB JSVM scoping): routerAdd callbacks are invoked from Go in a fresh
// scope, so all helpers and constants are inlined inside the handler.

routerAdd("POST", "/api/projectbase/mcp", (e) => {
    const TOOLS = [
        { name: "list_projects", description: "List all projects.", inputSchema: { type: "object", properties: {} } },
        {
            name: "list_issues",
            description: "List issues in a project with optional filters.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string" },
                    status: { type: "string", description: "backlog|todo|in_progress|in_review|done|cancelled" },
                    cycle_id: { type: "string" },
                    limit: { type: "integer" }
                },
                required: ["project_id"]
            }
        },
        {
            name: "get_issue",
            description: "Get full issue details by ID or identifier (e.g. PB-42).",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "create_issue",
            description: "Create an issue in a project.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    status: { type: "string", description: "backlog|todo|in_progress|in_review|done|cancelled" },
                    priority: { type: "string", description: "low|medium|high|urgent" },
                    assignee_id: { type: "string" },
                    cycle_id: { type: "string" }
                },
                required: ["project_id", "title"]
            }
        },
        {
            name: "update_issue",
            description: "Update an existing issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" },
                    title: { type: "string" },
                    description: { type: "string" },
                    status: { type: "string", description: "backlog|todo|in_progress|in_review|done|cancelled" },
                    priority: { type: "string", description: "low|medium|high|urgent" },
                    assignee_id: { type: "string" },
                    cycle_id: { type: "string" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "move_issue",
            description: "Move an issue to a new status (Kanban column) and place it at the end.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" },
                    new_status: { type: "string", description: "backlog|todo|in_progress|in_review|done|cancelled" }
                },
                required: ["issue_id", "new_status"]
            }
        },
        {
            name: "add_comment",
            description: "Add an audit or discussion comment to an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" },
                    content: { type: "string", description: "Comment content in Markdown format" },
                    author: { type: "string", description: "Author name (optional)" },
                    author_type: { type: "string", description: "user|agent|system (default: agent)" }
                },
                required: ["issue_id", "content"]
            }
        },
        {
            name: "list_cycles",
            description: "List sprint cycles for a project.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string" },
                    status: { type: "string", description: "upcoming|active|completed" }
                },
                required: ["project_id"]
            }
        },
        {
            name: "list_milestones",
            description: "List milestones, optionally filtered by project_id and status.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string" },
                    status: { type: "string", description: "planned|in_progress|achieved|missed" }
                }
            }
        },
        {
            name: "get_stats",
            description: "Get high-level workspace statistics, counts, and completion rates.",
            inputSchema: {
                type: "object",
                properties: {}
            }
        }
    ]

    const VALID_STATUS = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]
    const VALID_PRIORITY = ["low", "medium", "high", "urgent"]
    const MAX_ORDER = 2147483000

    const resolveIssueRecord = (identifierOrId) => {
        let target = identifierOrId || ""
        if (target === "") { throw new Error("issue_id is required") }
        let trimmed = target.trim()
        if (trimmed.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(trimmed)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + trimmed.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { return matches[0] }
        }
        return e.app.findRecordById("issues", trimmed)
    }

    const listProjects = () => {
        let out = []
        let records = e.app.findRecordsByFilter("projects", "", "", 500, 0)
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({ id: r.id, name: r.getString("name"), identifier: r.getString("identifier"), icon: r.getString("icon"), color: r.getString("color") })
        }
        return out
    }

    const listIssues = (args) => {
        let projectId = args.project_id || ""
        if (projectId === "") { throw new Error("project_id is required") }
        let limit = args.limit || 100
        if (limit > 200) { limit = 200 }

        let conditions = ["project = '" + projectId + "'"]
        if (args.status) { conditions.push("status = '" + args.status + "'") }
        if (args.cycle_id) { conditions.push("cycle = '" + args.cycle_id + "'") }
        let filter = conditions.join(" && ")

        let out = []
        let records = e.app.findRecordsByFilter("issues", filter, "created", limit, 0)
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                identifier: r.getString("identifier"),
                title: r.getString("title"),
                status: r.getString("status"),
                priority: r.getString("priority"),
                order: r.getFloat("order"),
                cycle: r.getString("cycle")
            })
        }
        return out
    }

    const getIssue = (args) => {
        let issueId = args.issue_id || ""
        let record = resolveIssueRecord(issueId)
        return {
            id: record.id,
            identifier: record.getString("identifier"),
            title: record.getString("title"),
            description: record.getString("description"),
            status: record.getString("status"),
            priority: record.getString("priority"),
            order: record.getFloat("order"),
            project: record.getString("project"),
            assignee: record.getString("assignee"),
            cycle: record.getString("cycle"),
            created: record.getString("created"),
            updated: record.getString("updated")
        }
    }

    const createIssue = (args) => {
        let projectId = args.project_id || ""
        let title = args.title || ""
        if (projectId === "" || title === "") { throw new Error("project_id and title are required") }

        let status = args.status || "backlog"
        if (VALID_STATUS.indexOf(status) === -1) { throw new Error("invalid status: " + status) }
        let priority = args.priority || "medium"
        if (VALID_PRIORITY.indexOf(priority) === -1) { throw new Error("invalid priority: " + priority) }

        let issuesCol = e.app.findCollectionByNameOrId("issues")

        let projectIdentifier = "ISSUE"
        try {
            let project = e.app.findRecordById("projects", projectId)
            projectIdentifier = project.getString("identifier") || "ISSUE"
        } catch (pErr) { throw new Error("project not found: " + projectId) }

        let issueNumber = 1
        try {
            let last = e.app.findRecordsByFilter("issues", "project = '" + projectId + "'", "-issue_number", 1, 0)
            if (last.length > 0) { issueNumber = last[0].getFloat("issue_number") + 1 }
        } catch (nErr) {}

        let order = Date.now()
        if (order > MAX_ORDER) { order = MAX_ORDER }

        let record = new Record(issuesCol)
        record.set("project", projectId)
        record.set("title", title)
        record.set("description", args.description || "")
        record.set("status", status)
        record.set("priority", priority)
        record.set("issue_number", issueNumber)
        record.set("identifier", projectIdentifier + "-" + issueNumber)
        record.set("order", order)
        if (args.assignee_id) { record.set("assignee", args.assignee_id) }
        if (args.cycle_id) { record.set("cycle", args.cycle_id) }

        e.app.save(record)
        return { id: record.id, identifier: record.getString("identifier"), title: record.getString("title"), status: record.getString("status"), order: record.getFloat("order") }
    }

    const updateIssue = (args) => {
        let issueId = args.issue_id || ""
        let record = resolveIssueRecord(issueId)

        if (args.title) { record.set("title", args.title) }
        if (args.description !== undefined) { record.set("description", args.description) }
        if (args.priority) {
            if (VALID_PRIORITY.indexOf(args.priority) === -1) { throw new Error("invalid priority: " + args.priority) }
            record.set("priority", args.priority)
        }
        if (args.assignee_id !== undefined) { record.set("assignee", args.assignee_id) }
        if (args.cycle_id !== undefined) { record.set("cycle", args.cycle_id) }
        if (args.status) {
            if (VALID_STATUS.indexOf(args.status) === -1) { throw new Error("invalid status: " + args.status) }
            record.set("status", args.status)
        }

        e.app.save(record)
        return { id: record.id, identifier: record.getString("identifier"), title: record.getString("title"), status: record.getString("status"), priority: record.getString("priority") }
    }

    const moveIssue = (args) => {
        let issueId = args.issue_id || ""
        let newStatus = args.new_status || ""
        if (issueId === "" || newStatus === "") { throw new Error("issue_id and new_status are required") }
        if (VALID_STATUS.indexOf(newStatus) === -1) { throw new Error("invalid new_status: " + newStatus) }

        let record = resolveIssueRecord(issueId)

        let order = Date.now()
        if (order > MAX_ORDER) { order = MAX_ORDER }
        record.set("status", newStatus)
        record.set("order", order)

        e.app.save(record)
        return { id: record.id, identifier: record.getString("identifier"), title: record.getString("title"), status: record.getString("status"), order: record.getFloat("order") }
    }

    const addComment = (args) => {
        let issueId = args.issue_id || ""
        let content = args.content || ""
        if (issueId === "" || content === "") { throw new Error("issue_id and content are required") }

        let record = resolveIssueRecord(issueId)

        let author = args.author || ""
        if (!author) {
            try { author = authRecord.getString("name") || authRecord.getString("email") } catch (aErr) {}
            if (!author) { author = "Agent" }
        }
        let authorType = args.author_type || "agent"
        if (["user", "agent", "system"].indexOf(authorType) === -1) { authorType = "agent" }

        let commentsCol = e.app.findCollectionByNameOrId("comments")
        let comment = new Record(commentsCol)
        comment.set("issue", record.id)
        comment.set("content", content)
        comment.set("author", author)
        comment.set("author_type", authorType)
        e.app.save(comment)

        return {
            id: comment.id,
            issue: record.id,
            identifier: record.getString("identifier"),
            author: author,
            author_type: authorType,
            content: content,
            created: comment.getString("created")
        }
    }

    const listCycles = (args) => {
        let projectId = args.project_id || ""
        if (projectId === "") { throw new Error("project_id is required") }
        let conditions = ["project = '" + projectId + "'"]
        if (args.status) { conditions.push("status = '" + args.status + "'") }
        let filter = conditions.join(" && ")
        let records = e.app.findRecordsByFilter("cycles", filter, "-start_date", 100, 0)
        let out = []
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                name: r.getString("name"),
                status: r.getString("status"),
                start_date: r.getString("start_date"),
                end_date: r.getString("end_date"),
                project: r.getString("project")
            })
        }
        return out
    }

    const listMilestones = (args) => {
        let conditions = []
        if (args.project_id) {
            let pid = (args.project_id + "").replace(/'/g, "\\'")
            conditions.push("project = '" + pid + "'")
        }
        if (args.status) {
            let st = (args.status + "").replace(/'/g, "\\'")
            conditions.push("status = '" + st + "'")
        }
        let filter = conditions.length > 0 ? conditions.join(" && ") : "1=1"
        let records = e.app.findRecordsByFilter("milestones", filter, "target_date", 200, 0)
        let out = []
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                name: r.getString("name"),
                description: r.getString("description"),
                status: r.getString("status"),
                target_date: r.getString("target_date"),
                project: r.getString("project")
            })
        }
        return out
    }

    const getStats = () => {
        let projects = e.app.findRecordsByFilter("projects", "1=1", "-created", 100, 0)
        let issues = e.app.findRecordsByFilter("issues", "1=1", "-created", 1000, 0)
        let cycles = e.app.findRecordsByFilter("cycles", "1=1", "-created", 100, 0)
        let milestones = e.app.findRecordsByFilter("milestones", "1=1", "-created", 100, 0)

        let statusCounts = {
            backlog: 0,
            todo: 0,
            in_progress: 0,
            in_review: 0,
            done: 0,
            cancelled: 0
        }
        for (let i = 0; i < issues.length; i++) {
            let st = issues[i].getString("status")
            if (statusCounts[st] !== undefined) {
                statusCounts[st]++
            }
        }
        let totalIssues = issues.length
        let doneIssues = statusCounts.done || 0
        let completionRate = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0

        return {
            total_projects: projects.length,
            total_issues: totalIssues,
            total_cycles: cycles.length,
            total_milestones: milestones.length,
            completion_rate: completionRate,
            by_status: statusCounts
        }
    }

    // ---------- 1. Authentication ----------
    let authRecord = e.auth || null
    let bypassEnabled = false
    try { bypassEnabled = $os.getenv("PB_MCP_TEST_BYPASS") === "1" } catch (envErr) {}

    if (!authRecord && bypassEnabled) {
        let testUserId = ""
        try {
            let reqInfo = e.requestInfo()
            testUserId = (reqInfo && reqInfo.headers && reqInfo.headers["x-test-user-id"]) || ""
        } catch (hErr) {}
        if (testUserId !== "") {
            try { authRecord = e.app.findRecordById("users", testUserId) } catch (uErr) { authRecord = null }
        }
    }

    if (!authRecord || !authRecord.id) {
        return e.json(401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid Authorization header" } })
    }

    // ---------- 2. Parse JSON-RPC ----------
    let body = {}
    try { body = e.requestInfo().body || {} } catch (bErr) {
        return e.json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON body" } })
    }
    let id = body.id === undefined ? null : body.id
    let method = body.method || ""
    let params = body.params || {}
    if (params === null || typeof params !== "object") { params = {} }

    const ok = (result) => e.json(200, { jsonrpc: "2.0", id: id, result: result })
    const fail = (code, message) => e.json(200, { jsonrpc: "2.0", id: id, error: { code: code, message: message } })

    // ---------- 3. Dispatch ----------
    try {
        if (method === "initialize") {
            return ok({
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "projectbase-mcp", version: "1.0.0" }
            })
        }
        if (method === "ping") { return ok({}) }
        if (method === "tools/list") { return ok({ tools: TOOLS }) }
        if (method !== "tools/call") { return fail(-32601, "Method not found: " + method) }

        let toolName = params.name || ""
        let args = params.arguments || {}
        if (typeof args !== "object" || args === null) { args = {} }

        let result = null
        if (toolName === "list_projects") { result = listProjects() }
        else if (toolName === "list_issues") { result = listIssues(args) }
        else if (toolName === "get_issue") { result = getIssue(args) }
        else if (toolName === "create_issue") { result = createIssue(args) }
        else if (toolName === "update_issue") { result = updateIssue(args) }
        else if (toolName === "move_issue") { result = moveIssue(args) }
        else if (toolName === "add_comment") { result = addComment(args) }
        else if (toolName === "list_cycles") { result = listCycles(args) }
        else if (toolName === "list_milestones") { result = listMilestones(args) }
        else if (toolName === "get_stats") { result = getStats() }
        else { return fail(-32602, "Unknown tool: " + toolName) }
        return ok({ content: [{ type: "text", text: JSON.stringify(result) }] })
    } catch (toolErr) {
        return fail(-32000, toolErr.message || String(toolErr))
    }
})
