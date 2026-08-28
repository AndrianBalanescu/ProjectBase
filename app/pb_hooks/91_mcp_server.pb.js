// pb_hooks/91_mcp_server.pb.js
// FastMCP server for ProjectBase — JSON-RPC 2.0 over HTTP.
//
// Exposes MCP tools backed by the local PocketBase app so external agents
// (flomaster, hermes, etc.) can read/create/update/move issues.
//
// Endpoint:  POST /api/projectbase/mcp
// Auth:      Authorization: Bearer <pb_user_token>   (required)
//            X-Test-User-ID: <users_record_id>        (local test bypass ONLY —
//            active when PB_MCP_TEST_BYPASS=1 is set in the process environment;
//            never enabled in production)
//
// Methods:   initialize | ping | tools/list | tools/call
// Tools:     list_projects, list_issues, create_issue, update_issue, move_issue
//
// PocketBase JSVM note: helpers are declared top-level and called from the
// handler; TOOLS is a top-level const. All findRecordsByFilter usage follows
// the existing hooks' patterns in this repo.

const TOOLS = [
    { name: "list_projects", description: "List all projects.", inputSchema: { type: "object", properties: {} } },
    {
        name: "list_issues",
        description: "List issues in a project with optional filters.",
        inputSchema: {
            type: "object",
            properties: {
                project_id: { type: "string" },
                status: { type: "string", description: "backlog|todo|in_progress|done" },
                cycle_id: { type: "string" },
                limit: { type: "integer" }
            },
            required: ["project_id"]
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
                status: { type: "string" },
                priority: { type: "string" },
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
                issue_id: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                status: { type: "string" },
                priority: { type: "string" },
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
                issue_id: { type: "string" },
                new_status: { type: "string" }
            },
            required: ["issue_id", "new_status"]
        }
    }
]

const VALID_STATUS = ["backlog", "todo", "in_progress", "done"]
const VALID_PRIORITY = ["low", "medium", "high", "urgent"]
const MAX_ORDER = 2147483000

function listProjects(e) {
    let out = []
    let records = e.app.findRecordsByFilter("projects", "", "", 500, 0)
    for (let i = 0; i < records.length; i++) {
        let r = records[i]
        out.push({ id: r.id, name: r.getString("name"), identifier: r.getString("identifier"), icon: r.getString("icon"), color: r.getString("color") })
    }
    return out
}

function listIssues(e, args) {
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

function createIssue(e, args) {
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

function updateIssue(e, args) {
    let issueId = args.issue_id || ""
    if (issueId === "") { throw new Error("issue_id is required") }
    let record = e.app.findRecordById("issues", issueId)

    if (args.title) { record.set("title", args.title) }
    if (args.description) { record.set("description", args.description) }
    if (args.priority) {
        if (VALID_PRIORITY.indexOf(args.priority) === -1) { throw new Error("invalid priority: " + args.priority) }
        record.set("priority", args.priority)
    }
    if (args.assignee_id) { record.set("assignee", args.assignee_id) }
    if (args.cycle_id) { record.set("cycle", args.cycle_id) }
    if (args.status) {
        if (VALID_STATUS.indexOf(args.status) === -1) { throw new Error("invalid status: " + args.status) }
        record.set("status", args.status)
    }

    e.app.save(record)
    return { id: record.id, identifier: record.getString("identifier"), title: record.getString("title"), status: record.getString("status"), priority: record.getString("priority") }
}

function moveIssue(e, args) {
    let issueId = args.issue_id || ""
    let newStatus = args.new_status || ""
    if (issueId === "" || newStatus === "") { throw new Error("issue_id and new_status are required") }
    if (VALID_STATUS.indexOf(newStatus) === -1) { throw new Error("invalid new_status: " + newStatus) }

    let record = e.app.findRecordById("issues", issueId)

    let order = Date.now()
    if (order > MAX_ORDER) { order = MAX_ORDER }
    record.set("status", newStatus)
    record.set("order", order)

    e.app.save(record)
    return { id: record.id, identifier: record.getString("identifier"), title: record.getString("title"), status: record.getString("status"), order: record.getFloat("order") }
}

routerAdd("POST", "/api/projectbase/mcp", (e) => {
    // ---------- 1. Authentication ----------
    let authRecord = null
    let bypassEnabled = false
    try { bypassEnabled = $os.getenv("PB_MCP_TEST_BYPASS") === "1" } catch (envErr) {}

    if (bypassEnabled) {
        let testUserId = ""
        try { testUserId = e.request.header("X-Test-User-ID") || "" } catch (hErr) {}
        if (testUserId !== "") {
            try { authRecord = e.app.findRecordById("users", testUserId) } catch (uErr) { authRecord = null }
        }
    }

    if (!authRecord) {
        let token = ""
        try { token = e.request.header("Authorization") || "" } catch (h2Err) {}
        if (token.startsWith("Bearer ")) { token = token.substring(7).trim() }
        if (token === "") {
            return e.json(401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing Authorization header" } })
        }
        try { authRecord = e.app.findAuthRecordByToken(token) } catch (tErr) { authRecord = null }
        if (!authRecord) {
            return e.json(401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or expired token" } })
        }
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

    try {
        let result = null
        if (toolName === "list_projects") { result = listProjects(e) }
        else if (toolName === "list_issues") { result = listIssues(e, args) }
        else if (toolName === "create_issue") { result = createIssue(e, args) }
        else if (toolName === "update_issue") { result = updateIssue(e, args) }
        else if (toolName === "move_issue") { result = moveIssue(e, args) }
        else { return fail(-32602, "Unknown tool: " + toolName) }
        return ok({ content: [{ type: "text", text: JSON.stringify(result) }] })
    } catch (toolErr) {
        return fail(-32000, toolErr.message || "Tool execution failed")
    }
})
