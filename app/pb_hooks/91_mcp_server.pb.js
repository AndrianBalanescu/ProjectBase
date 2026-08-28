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
// Tools:     list_projects, list_issues, get_issue, create_issue, update_issue, move_issue, add_comment,
//            list_cycles, list_milestones, search_issues, dispatch_agent, get_stats,
//            acquire_task_lease, release_task_lease, renew_task_lease, get_task_lease,
//            log_agent_telemetry, register_webhook, list_webhooks, delete_webhook

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
            name: "search_issues",
            description: "Search issues across all projects by title, identifier, status, or priority.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query string" },
                    limit: { type: "integer", description: "Max results (default: 20, max: 50)" }
                },
                required: ["query"]
            }
        },
        {
            name: "dispatch_agent",
            description: "Dispatch an autonomous agent to claim and execute an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" },
                    agent_target: { type: "string", description: "Target agent harness: flomaster|hermes|windmill|custom (default: flomaster)" },
                    prompt: { type: "string", description: "Custom instructions/prompt for the agent" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "get_stats",
            description: "Get high-level workspace statistics, counts, and completion rates.",
            inputSchema: {
                type: "object",
                properties: {}
            }
        },
        {
            name: "acquire_task_lease",
            description: "Acquire an exclusive execution lease/lock on an issue to avoid multi-agent collision.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" },
                    agent_name: { type: "string", description: "Name of the agent claiming the task (default: agent)" },
                    ttl_seconds: { type: "integer", description: "Lease duration in seconds (default: 900)" },
                    reason: { type: "string", description: "Intended execution work/reason" },
                    force: { type: "boolean", description: "Force override existing lease" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "release_task_lease",
            description: "Release an active execution lease on an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" },
                    agent_name: { type: "string", description: "Agent name (optional if force=true)" },
                    force: { type: "boolean", description: "Force release regardless of holder" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "renew_task_lease",
            description: "Renew heartbeat and expiration TTL for an existing task lease.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" },
                    agent_name: { type: "string", description: "Agent name" },
                    ttl_seconds: { type: "integer", description: "Lease extension in seconds (default: 900)" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "get_task_lease",
            description: "Get active lease information for an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier (e.g. PB-42)" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "log_agent_telemetry",
            description: "Log agent reasoning, tool invocations, checkpoints, or collision events.",
            inputSchema: {
                type: "object",
                properties: {
                    agent_name: { type: "string", description: "Agent name" },
                    event_type: { type: "string", description: "reasoning|tool_call|checkpoint|collision|status" },
                    issue_id: { type: "string", description: "Issue record ID or identifier (optional)" },
                    step: { type: "integer", description: "Workflow step number" },
                    summary: { type: "string", description: "High-level summary of action or reasoning" },
                    payload: { type: "object", description: "Detailed payload (arguments, output, logs)" }
                },
                required: ["agent_name", "event_type"]
            }
        },
        {
            name: "register_webhook",
            description: "Register an outbound webhook endpoint for orchestrator notifications.",
            inputSchema: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Webhook subscription name" },
                    url: { type: "string", description: "HTTP or HTTPS webhook target URL" },
                    events: { type: "array", items: { type: "string" }, description: "Subscribed events (e.g. ['issue.created', 'issue.moved', '*'])" },
                    secret: { type: "string", description: "HMAC secret token for signature verification" },
                    project_id: { type: "string", description: "Optional project scope filter" }
                },
                required: ["url"]
            }
        },
        {
            name: "list_webhooks",
            description: "List registered webhook subscriptions.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Filter by project ID" }
                }
            }
        },
        {
            name: "delete_webhook",
            description: "Delete a registered webhook subscription.",
            inputSchema: {
                type: "object",
                properties: {
                    webhook_id: { type: "string", description: "Webhook record ID" }
                },
                required: ["webhook_id"]
            }
        },
        {
            name: "decompose_task_graph",
            description: "Decompose a parent issue into a DAG of child tasks with personas and dependency edges.",
            inputSchema: {
                type: "object",
                properties: {
                    parent_issue: { type: "string", description: "Parent issue record ID or identifier (e.g. PB-42)" },
                    nodes: {
                        type: "array",
                        description: "List of task nodes: [{ key, title, description, persona, priority, estimate, depends_on: [] }]",
                        items: { type: "object" }
                    }
                },
                required: ["parent_issue", "nodes"]
            }
        },
        {
            name: "get_dag_status",
            description: "Retrieve DAG execution status, topological states, ready/blocked nodes, and active leases.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Parent or child issue record ID or identifier" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "execute_dag_step",
            description: "Advance DAG execution by selecting the next ready unblocked task and claiming a lease for an agent persona.",
            inputSchema: {
                type: "object",
                properties: {
                    parent_issue: { type: "string", description: "Parent issue record ID or identifier" },
                    agent_name: { type: "string", description: "Name of executing agent (default: Swarm Worker)" },
                    persona: { type: "string", description: "Filter candidate ready node by persona (e.g. coder, reviewer, qa, architect)" }
                },
                required: ["parent_issue"]
            }
        },
        {
            name: "split_subtasks",
            description: "Dynamically split an issue's subtask checklist with persona assignments and story points.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier" },
                    subtasks: {
                        type: "array",
                        description: "Array of subtasks: [{ title, persona, estimate, done }]",
                        items: { type: "object" }
                    }
                },
                required: ["issue_id", "subtasks"]
            }
        },
        {
            name: "submit_validation_checkpoint",
            description: "Submit a peer-review verdict, QA verification, or test checkpoint for an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier" },
                    agent_name: { type: "string", description: "Agent name performing review/verification" },
                    persona: { type: "string", description: "Reviewer persona (e.g. reviewer, qa, security, architect)" },
                    checkpoint_type: { type: "string", description: "peer_review|unit_test|qa_e2e|security_scan|schema_validation|acceptance" },
                    status: { type: "string", description: "passed|failed|changes_requested|pending" },
                    notes: { type: "string", description: "Detailed review comments or verification logs" },
                    artifacts: { type: "object", description: "Optional structured artifacts (diffs, reports, logs)" }
                },
                required: ["issue_id", "agent_name", "checkpoint_type", "status"]
            }
        },
        {
            name: "get_validation_checkpoints",
            description: "Get all validation checkpoints and quality gate status for an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue record ID or identifier" }
                },
                required: ["issue_id"]
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

        let conditions = ["project = '" + projectId + "'"]
        if (args.status) {
            if (VALID_STATUS.indexOf(args.status) === -1) { throw new Error("invalid status: " + args.status) }
            conditions.push("status = '" + args.status + "'")
        }
        if (args.cycle_id) { conditions.push("cycle = '" + args.cycle_id + "'") }

        let filter = conditions.join(" && ")
        let limit = Math.min(Number(args.limit) || 100, 500)
        let records = e.app.findRecordsByFilter("issues", filter, "order", limit, 0)

        let out = []
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                identifier: r.getString("identifier"),
                title: r.getString("title"),
                status: r.getString("status"),
                priority: r.getString("priority"),
                order: r.getInt("order"),
                cycle_id: r.getString("cycle"),
                assignee_id: r.getString("assignee"),
                created: r.getString("created")
            })
        }
        return out
    }

    const getIssue = (args) => {
        let record = resolveIssueRecord(args.issue_id)
        let comments = []
        try {
            let cRecords = e.app.findRecordsByFilter("comments", "issue = '" + record.id + "'", "created", 100, 0)
            for (let i = 0; i < cRecords.length; i++) {
                let c = cRecords[i]
                comments.push({
                    id: c.id,
                    author: c.getString("author"),
                    author_type: c.getString("author_type"),
                    content: c.getString("content"),
                    created: c.getString("created")
                })
            }
        } catch (cErr) {}

        // Check active task lease
        let leaseInfo = null
        try {
            let leases = e.app.findRecordsByFilter("task_leases", "issue = '" + record.id + "'", "-created", 1, 0)
            if (leases.length > 0) {
                let l = leases[0]
                let now = new Date()
                let exp = l.getString("expires_at")
                let isExpired = exp && new Date(exp) <= now
                if (!isExpired) {
                    leaseInfo = {
                        agent_name: l.getString("agent_name"),
                        reason: l.getString("reason"),
                        expires_at: exp,
                        seconds_remaining: Math.max(0, Math.floor((new Date(exp).getTime() - now.getTime()) / 1000))
                    }
                }
            }
        } catch (lErr) {}

        return {
            id: record.id,
            identifier: record.getString("identifier"),
            title: record.getString("title"),
            description: record.getString("description"),
            status: record.getString("status"),
            priority: record.getString("priority"),
            project_id: record.getString("project"),
            cycle_id: record.getString("cycle"),
            assignee: record.getString("assignee"),
            created: record.getString("created"),
            updated: record.getString("updated"),
            comments: comments,
            active_lease: leaseInfo
        }
    }

    const createIssue = (args) => {
        let projectId = args.project_id || ""
        let title = args.title || ""
        if (projectId === "" || title === "") { throw new Error("project_id and title are required") }

        let proj = e.app.findRecordById("projects", projectId)
        let prefix = proj.getString("identifier") || "ISSUE"

        let maxNum = 0
        let lastIssues = e.app.findRecordsByFilter("issues", "project = '" + projectId + "'", "-created", 1, 0)
        if (lastIssues.length > 0) {
            let lastIdent = lastIssues[0].getString("identifier")
            let match = lastIdent.match(/-(\d+)$/)
            if (match) { maxNum = parseInt(match[1], 10) }
        }
        let identifier = prefix + "-" + (maxNum + 1)

        let status = args.status || "todo"
        if (VALID_STATUS.indexOf(status) === -1) { throw new Error("invalid status: " + status) }
        let priority = args.priority || "medium"
        if (VALID_PRIORITY.indexOf(priority) === -1) { throw new Error("invalid priority: " + priority) }

        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let record = new Record(issuesCol)
        record.set("project", projectId)
        record.set("identifier", identifier)
        record.set("title", title)
        record.set("description", args.description || "")
        record.set("status", status)
        record.set("priority", priority)
        if (args.assignee_id) { record.set("assignee", args.assignee_id) }
        if (args.cycle_id) { record.set("cycle", args.cycle_id) }

        let order = Date.now()
        if (order > MAX_ORDER) { order = MAX_ORDER }
        record.set("order", order)

        e.app.save(record)
        return {
            id: record.id,
            identifier: record.getString("identifier") || identifier,
            title: title,
            status: status,
            priority: priority,
            project_id: projectId
        }
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
        return { id: record.id, identifier: record.getString("identifier"), status: newStatus, order: order }
    }

    const addComment = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let content = args.content || ""
        if (content === "") { throw new Error("content is required") }

        let commentsCol = e.app.findCollectionByNameOrId("comments")
        let record = new Record(commentsCol)
        record.set("issue", issue.id)
        record.set("content", content)
        record.set("author", args.author || "FastMCP Agent")
        record.set("author_type", args.author_type || "agent")

        e.app.save(record)
        return {
            id: record.id,
            issue: issue.id,
            issue_id: issue.id,
            identifier: issue.getString("identifier"),
            author: record.getString("author"),
            author_type: record.getString("author_type"),
            content: content,
            created: record.getString("created")
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
        let projects = e.app.findRecordsByFilter("projects", "", "", 500, 0)
        let issues = e.app.findRecordsByFilter("issues", "", "", 2000, 0)
        let cycles = e.app.findRecordsByFilter("cycles", "", "", 500, 0)
        let milestones = e.app.findRecordsByFilter("milestones", "", "", 500, 0)

        let statusCounts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0 }
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

    const searchIssues = (args) => {
        let q = String(args.query || "").trim()
        if (!q) { return [] }
        if (q.length > 128) { q = q.substring(0, 128) }
        let limit = Math.min(Number(args.limit) || 20, 50)
        let safe = q.replace(/'/g, "\\'")
        let filter = "(title ~ '" + safe + "' || identifier ~ '" + safe + "' || status ~ '" + safe + "' || priority ~ '" + safe + "')"
        let issues = e.app.findRecordsByFilter("issues", filter, "-created", limit, 0)
        let results = []
        let projectCache = {}
        for (let i = 0; i < issues.length; i++) {
            let rec = issues[i]
            let projectId = rec.getString("project")
            let projectName = ""
            let projectIdentifier = ""
            let projectColor = ""
            if (projectId) {
                if (projectCache[projectId]) {
                    projectName = projectCache[projectId].name
                    projectIdentifier = projectCache[projectId].identifier
                    projectColor = projectCache[projectId].color
                } else {
                    try {
                        let proj = e.app.findRecordById("projects", projectId)
                        projectName = proj.getString("name")
                        projectIdentifier = proj.getString("identifier")
                        projectColor = proj.getString("color")
                        projectCache[projectId] = { name: projectName, identifier: projectIdentifier, color: projectColor }
                    } catch (pErr) {}
                }
            }
            results.push({
                id: rec.id,
                identifier: rec.getString("identifier"),
                title: rec.getString("title"),
                status: rec.getString("status"),
                priority: rec.getString("priority"),
                project_id: projectId,
                project_name: projectName,
                project_identifier: projectIdentifier,
                project_color: projectColor,
                created: rec.getString("created")
            })
        }
        return results
    }

    const dispatchAgent = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let agentTarget = args.agent_target || "flomaster"
        let customPrompt = args.prompt || ""
        let allowedTargets = ["flomaster", "hermes", "windmill", "custom"]
        if (allowedTargets.indexOf(agentTarget) === -1) { agentTarget = "flomaster" }

        let identifier = issue.getString("identifier")

        issue.set("status", "in_progress")
        let agentName = {
            flomaster: "Flomaster Agent",
            hermes: "Hermes Agent",
            windmill: "Windmill Agent",
            custom: "Custom Agent"
        }[agentTarget] || "Flomaster Agent"
        issue.set("assignee", agentName)
        e.app.save(issue)

        let commentsCol = e.app.findCollectionByNameOrId("comments")
        let comment = new Record(commentsCol)
        comment.set("issue", issue.id)
        comment.set("author", agentName)
        comment.set("author_type", "agent")
        comment.set("content", "🤖 **Autonomous Task Claimed**\nAgent **" + agentName + "** has claimed task `" + identifier + "` for execution." + (customPrompt ? "\n> Instructions: " + customPrompt : ""))
        e.app.save(comment)

        return {
            success: true,
            issue_id: issue.id,
            identifier: identifier,
            status: "in_progress",
            agent: agentTarget,
            assigned_to: agentName
        }
    }

    const acquireTaskLease = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let agentName = (args.agent_name || "agent").trim()
        let reason = (args.reason || "").trim()
        let ttlSeconds = Math.max(10, Math.min(Number(args.ttl_seconds) || 900, 86400))
        let now = new Date()
        let nowIso = now.toISOString()
        let expiresAt = new Date(now.getTime() + (ttlSeconds * 1000)).toISOString()

        let existing = e.app.findRecordsByFilter("task_leases", "issue = '" + issue.id + "'", "-created", 1, 0)
        let leaseCol = e.app.findCollectionByNameOrId("task_leases")

        if (existing.length > 0) {
            let current = existing[0]
            let currentExp = current.getString("expires_at")
            let isExpired = currentExp && new Date(currentExp) <= now
            let currentHolder = current.getString("agent_name")

            if (!isExpired && currentHolder !== agentName && !args.force) {
                return {
                    acquired: false,
                    conflict: true,
                    message: "Task is actively leased by another agent",
                    current_lease: {
                        id: current.id,
                        agent_name: currentHolder,
                        reason: current.getString("reason"),
                        expires_at: currentExp,
                        seconds_remaining: Math.max(0, Math.floor((new Date(currentExp).getTime() - now.getTime()) / 1000))
                    }
                }
            }

            current.set("agent_name", agentName)
            if (reason) { current.set("reason", reason) }
            current.set("acquired_at", nowIso)
            current.set("expires_at", expiresAt)
            current.set("heartbeat", nowIso)
            e.app.save(current)

            return {
                acquired: true,
                status: "renewed",
                lease: {
                    id: current.id,
                    issue_id: issue.id,
                    identifier: issue.getString("identifier"),
                    agent_name: agentName,
                    expires_at: expiresAt,
                    ttl_seconds: ttlSeconds,
                    reason: reason
                }
            }
        }

        let record = new Record(leaseCol)
        record.set("issue", issue.id)
        record.set("agent_name", agentName)
        record.set("reason", reason)
        record.set("acquired_at", nowIso)
        record.set("expires_at", expiresAt)
        record.set("heartbeat", nowIso)
        e.app.save(record)

        return {
            acquired: true,
            status: "created",
            lease: {
                id: record.id,
                issue_id: issue.id,
                identifier: issue.getString("identifier"),
                agent_name: agentName,
                expires_at: expiresAt,
                ttl_seconds: ttlSeconds,
                reason: reason
            }
        }
    }

    const releaseTaskLease = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let agentName = (args.agent_name || "").trim()
        let force = !!args.force

        let existing = e.app.findRecordsByFilter("task_leases", "issue = '" + issue.id + "'", "-created", 10, 0)
        let deleted = 0
        for (let i = 0; i < existing.length; i++) {
            let rec = existing[i]
            if (force || !agentName || rec.getString("agent_name") === agentName) {
                e.app.delete(rec)
                deleted++
            }
        }
        return { released: true, count: deleted, issue_id: issue.id, identifier: issue.getString("identifier") }
    }

    const renewTaskLease = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let agentName = (args.agent_name || "").trim()
        let ttlSeconds = Math.max(10, Math.min(Number(args.ttl_seconds) || 900, 86400))

        let existing = e.app.findRecordsByFilter("task_leases", "issue = '" + issue.id + "'", "-created", 1, 0)
        if (existing.length === 0) {
            throw new Error("No active lease found for issue " + issue.getString("identifier"))
        }

        let current = existing[0]
        let holder = current.getString("agent_name")
        if (agentName && holder !== agentName) {
            throw new Error("Cannot renew lease held by another agent (" + holder + ")")
        }

        let now = new Date()
        let expiresAt = new Date(now.getTime() + (ttlSeconds * 1000)).toISOString()
        current.set("heartbeat", now.toISOString())
        current.set("expires_at", expiresAt)
        e.app.save(current)

        return {
            renewed: true,
            issue_id: issue.id,
            identifier: issue.getString("identifier"),
            agent_name: holder,
            expires_at: expiresAt,
            ttl_seconds: ttlSeconds
        }
    }

    const getTaskLease = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let now = new Date()
        let existing = e.app.findRecordsByFilter("task_leases", "issue = '" + issue.id + "'", "-created", 1, 0)
        if (existing.length === 0) {
            return { active: false, lease: null }
        }
        let current = existing[0]
        let exp = current.getString("expires_at")
        let isExpired = exp && new Date(exp) <= now
        return {
            active: !isExpired,
            is_expired: isExpired,
            lease: {
                id: current.id,
                issue_id: issue.id,
                identifier: issue.getString("identifier"),
                agent_name: current.getString("agent_name"),
                reason: current.getString("reason"),
                acquired_at: current.getString("acquired_at"),
                expires_at: exp,
                seconds_remaining: isExpired ? 0 : Math.max(0, Math.floor((new Date(exp).getTime() - now.getTime()) / 1000))
            }
        }
    }

    const logAgentTelemetry = (args) => {
        let agentName = (args.agent_name || "agent").trim()
        let eventType = (args.event_type || "status").trim()
        let summary = (args.summary || "").trim()
        let step = Number(args.step) || 0

        let col = e.app.findCollectionByNameOrId("agent_telemetry")
        let rec = new Record(col)
        rec.set("agent_name", agentName)
        rec.set("event_type", eventType)
        rec.set("summary", summary)
        rec.set("step", step)
        rec.set("timestamp", new Date().toISOString())

        if (args.issue_id) {
            try {
                let iss = resolveIssueRecord(args.issue_id)
                rec.set("issue", iss.id)
            } catch (x) {}
        }
        if (args.payload) { rec.set("payload", args.payload) }

        e.app.save(rec)
        return {
            success: true,
            telemetry_id: rec.id,
            agent_name: agentName,
            event_type: eventType,
            summary: summary,
            timestamp: rec.getString("timestamp")
        }
    }

    const registerWebhook = (args) => {
        let url = (args.url || "").trim()
        if (!url || !url.startsWith("http")) { throw new Error("Valid HTTP/HTTPS 'url' is required") }
        let name = (args.name || "External Orchestrator").trim()
        let events = args.events || ["issue.created", "issue.updated", "issue.moved", "agent.dispatched", "*"]
        let secret = (args.secret || "").trim()
        let projectId = (args.project_id || "").trim()

        let col = e.app.findCollectionByNameOrId("webhooks")
        let rec = new Record(col)
        rec.set("name", name)
        rec.set("url", url)
        rec.set("events", typeof events === "string" ? JSON.parse(events) : events)
        if (secret) { rec.set("secret", secret) }
        if (projectId) { rec.set("project", projectId) }
        rec.set("enabled", true)
        rec.set("failure_count", 0)

        e.app.save(rec)
        return {
            success: true,
            webhook_id: rec.id,
            name: name,
            url: url,
            events: rec.get("events"),
            enabled: true,
            project_id: projectId || null
        }
    }

    const listWebhooks = (args) => {
        let filter = ""
        if (args && args.project_id) {
            let pid = (args.project_id + "").replace(/'/g, "\\'")
            filter = "project = '" + pid + "' || project = ''"
        }
        let records = e.app.findRecordsByFilter("webhooks", filter, "-created", 100, 0)
        let out = []
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                name: r.getString("name"),
                url: r.getString("url"),
                events: r.get("events"),
                enabled: r.getBool("enabled"),
                project_id: r.getString("project") || null,
                last_triggered_at: r.getString("last_triggered_at") || null,
                failure_count: r.getInt("failure_count")
            })
        }
        return out
    }

    const deleteWebhook = (args) => {
        let id = (args.webhook_id || "").trim()
        if (!id) { throw new Error("webhook_id is required") }
        let rec = e.app.findRecordById("webhooks", id)
        e.app.delete(rec)
        return { success: true, webhook_id: id }
    }

    const decomposeTaskGraph = (args) => {
        let parentRef = (args.parent_issue || "").trim()
        if (!parentRef) { throw new Error("parent_issue is required") }
        let parent = resolveIssueRecord(parentRef)
        let nodes = args.nodes || []
        if (!Array.isArray(nodes) || nodes.length === 0) { throw new Error("nodes list is required") }

        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let projectId = parent.get("project")
        let cycleId = parent.get("cycle")
        let milestoneId = parent.get("milestone")

        let createdMap = {}
        let createdList = []

        for (let i = 0; i < nodes.length; i++) {
            let n = nodes[i]
            let key = n.key || ("node_" + (i + 1))
            let rec = new Record(issuesCol)
            rec.set("project", projectId)
            rec.set("title", n.title || ("Task " + key))
            rec.set("description", n.description || "")
            rec.set("status", "todo")
            rec.set("priority", n.priority || "medium")
            rec.set("task_persona", n.persona || "coder")
            rec.set("parent_issue", parent.id)
            if (n.estimate) { rec.set("estimate", parseInt(n.estimate, 10) || 0) }
            if (cycleId) { rec.set("cycle", cycleId) }
            if (milestoneId) { rec.set("milestone", milestoneId) }
            rec.set("relations", [])
            rec.set("subtasks", [])

            e.app.save(rec)
            rec = e.app.findRecordById("issues", rec.id)
            createdMap[key] = rec
            createdList.push({
                key: key,
                id: rec.id,
                identifier: rec.getString("identifier"),
                title: rec.getString("title"),
                persona: rec.getString("task_persona"),
                depends_on: n.depends_on || []
            })
        }

        // Setup relations for DAG edges
        for (let i = 0; i < nodes.length; i++) {
            let n = nodes[i]
            let key = n.key || ("node_" + (i + 1))
            let bRec = createdMap[key]
            let deps = n.depends_on || []
            for (let j = 0; j < deps.length; j++) {
                let depKey = deps[j]
                let aRec = createdMap[depKey]
                if (!aRec) continue

                let bRels = []
                try { bRels = JSON.parse(String(bRec.get("relations") || "[]")) } catch (e) { bRels = [] }
                bRels.push({ issue: aRec.id, type: "blocked_by" })
                bRec.set("relations", bRels)
                e.app.save(bRec)

                let aRels = []
                try { aRels = JSON.parse(String(aRec.get("relations") || "[]")) } catch (e) { aRels = [] }
                aRels.push({ issue: bRec.id, type: "blocks" })
                aRec.set("relations", aRels)
                e.app.save(aRec)
            }
        }

        return {
            success: true,
            parent_id: parent.id,
            parent_identifier: parent.getString("identifier"),
            total_nodes: createdList.length,
            nodes: createdList
        }
    }

    const getDagStatus = (args) => {
        let issueRef = (args.issue_id || "").trim()
        if (!issueRef) { throw new Error("issue_id is required") }
        let issue = resolveIssueRecord(issueRef)
        let parentId = issue.getString("parent_issue") || issue.id
        let parent = (parentId === issue.id) ? issue : resolveIssueRecord(parentId)

        let children = e.app.findRecordsByFilter("issues", "parent_issue = '" + parent.id + "'", "created", 200, 0)
        let totalNodes = children.length
        let completedNodes = 0
        let inProgressNodes = 0
        let readyNodes = []
        let blockedNodes = []

        let childMap = {}
        for (let i = 0; i < children.length; i++) { childMap[children[i].id] = children[i] }

        let nodesSummary = []
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            let st = child.getString("status")
            let ident = child.getString("identifier")
            let rels = []
            try { rels = JSON.parse(String(child.get("relations") || "[]")) } catch (e) { rels = [] }

            let isBlocked = false
            for (let r = 0; r < rels.length; r++) {
                if (rels[r].type === "blocked_by") {
                    let depRec = childMap[rels[r].issue]
                    if (!depRec) {
                        try { depRec = e.app.findRecordById("issues", rels[r].issue) } catch (dErr) {}
                    }
                    if (depRec && depRec.getString("status") !== "done") {
                        isBlocked = true
                        break
                    }
                }
            }

            if (st === "done") completedNodes++
            else if (st === "in_progress") inProgressNodes++

            let isReady = (st !== "done" && st !== "cancelled" && !isBlocked)
            if (isReady) readyNodes.push(ident)
            else if (isBlocked && st !== "done" && st !== "cancelled") blockedNodes.push(ident)

            nodesSummary.push({
                id: child.id,
                identifier: ident,
                title: child.getString("title"),
                status: st,
                persona: child.getString("task_persona"),
                is_ready: isReady,
                is_blocked: isBlocked
            })
        }

        return {
            success: true,
            parent_id: parent.id,
            parent_identifier: parent.getString("identifier"),
            total_nodes: totalNodes,
            completed_nodes: completedNodes,
            in_progress_nodes: inProgressNodes,
            progress_percent: totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0,
            is_dag_completed: totalNodes > 0 && completedNodes === totalNodes,
            ready_to_execute: readyNodes,
            blocked: blockedNodes,
            nodes: nodesSummary
        }
    }

    const executeDagStep = (args) => {
        let parentRef = (args.parent_issue || "").trim()
        if (!parentRef) { throw new Error("parent_issue is required") }
        let parent = resolveIssueRecord(parentRef)
        let agentName = (args.agent_name || "Swarm Worker").trim()
        let targetPersona = (args.persona || "").trim()

        let parentId = parent.getString("parent_issue") || parent.id
        let children = e.app.findRecordsByFilter("issues", "parent_issue = '" + parentId + "'", "created", 200, 0)
        let nowIso = new Date().toISOString()

        let childMap = {}
        for (let i = 0; i < children.length; i++) { childMap[children[i].id] = children[i] }

        let readyCandidates = []
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            let status = child.getString("status")
            if (status === "done" || status === "cancelled" || status === "in_progress") continue

            let rels = []
            try { rels = JSON.parse(String(child.get("relations") || "[]")) } catch (e) { rels = [] }
            let isBlocked = false
            for (let r = 0; r < rels.length; r++) {
                if (rels[r].type === "blocked_by") {
                    let depRec = childMap[rels[r].issue]
                    if (!depRec) { try { depRec = e.app.findRecordById("issues", rels[r].issue) } catch (dErr) {} }
                    if (depRec && depRec.getString("status") !== "done") { isBlocked = true; break }
                }
            }

            if (!isBlocked) {
                let activeLeases = e.app.findRecordsByFilter("task_leases", "issue = '" + child.id + "' && expires_at > '" + nowIso + "'", "", 1, 0)
                if (activeLeases.length === 0) { readyCandidates.push(child) }
            }
        }

        if (readyCandidates.length === 0) {
            return { success: true, message: "No ready unblocked and unleased nodes available", node: null, remaining_ready: 0 }
        }

        let selectedNode = null
        if (targetPersona) {
            for (let i = 0; i < readyCandidates.length; i++) {
                if (readyCandidates[i].getString("task_persona").toLowerCase() === targetPersona.toLowerCase()) {
                    selectedNode = readyCandidates[i]
                    break
                }
            }
        }
        if (!selectedNode) { selectedNode = readyCandidates[0] }

        selectedNode.set("status", "in_progress")
        if (agentName) { selectedNode.set("assignee", agentName) }
        e.app.save(selectedNode)

        let leaseCol = e.app.findCollectionByNameOrId("task_leases")
        let leaseRec = new Record(leaseCol)
        let ttl = 900
        let expiresAt = new Date(Date.now() + (ttl * 1000)).toISOString()

        leaseRec.set("issue", selectedNode.id)
        leaseRec.set("agent_name", agentName)
        leaseRec.set("acquired_at", nowIso)
        leaseRec.set("expires_at", expiresAt)
        leaseRec.set("reason", "DAG step execution by " + agentName + " (" + selectedNode.getString("task_persona") + ")")
        e.app.save(leaseRec)

        return {
            success: true,
            node: {
                id: selectedNode.id,
                identifier: selectedNode.getString("identifier"),
                title: selectedNode.getString("title"),
                status: selectedNode.getString("status"),
                persona: selectedNode.getString("task_persona"),
                assignee: selectedNode.getString("assignee")
            },
            lease_expires_at: expiresAt,
            remaining_ready: readyCandidates.length - 1
        }
    }

    const splitSubtasks = (args) => {
        let issueRef = (args.issue_id || "").trim()
        if (!issueRef) { throw new Error("issue_id is required") }
        let issue = resolveIssueRecord(issueRef)
        let subtasks = args.subtasks || []
        if (!Array.isArray(subtasks)) { throw new Error("subtasks must be an array") }

        let formatted = []
        for (let i = 0; i < subtasks.length; i++) {
            let st = subtasks[i]
            let title = (typeof st === "string") ? st : (st.title || "")
            if (!title) continue
            formatted.push({
                id: st.id || ("st_" + (i + 1)),
                title: title,
                persona: st.persona || "coder",
                estimate: parseInt(st.estimate || "0", 10) || 0,
                done: !!st.done,
                order: i + 1
            })
        }
        issue.set("subtasks", formatted)
        e.app.save(issue)

        return {
            success: true,
            issue_id: issue.id,
            identifier: issue.getString("identifier"),
            subtasks_count: formatted.length,
            subtasks: formatted
        }
    }

    const submitValidationCheckpoint = (args) => {
        let issueRef = (args.issue_id || "").trim()
        if (!issueRef) { throw new Error("issue_id is required") }
        let issue = resolveIssueRecord(issueRef)
        let agentName = (args.agent_name || "Verifier").trim()
        let persona = (args.persona || "reviewer").trim()
        let checkpointType = (args.checkpoint_type || "peer_review").trim()
        let status = (args.status || "passed").trim().toLowerCase()
        let notes = (args.notes || "").trim()
        let artifacts = args.artifacts || {}

        let cpCol = e.app.findCollectionByNameOrId("task_checkpoints")
        let cpRec = new Record(cpCol)
        cpRec.set("issue", issue.id)
        cpRec.set("agent_name", agentName)
        cpRec.set("persona", persona)
        cpRec.set("checkpoint_type", checkpointType)
        cpRec.set("status", status)
        cpRec.set("notes", notes)
        cpRec.set("artifacts", artifacts)
        e.app.save(cpRec)

        return {
            success: true,
            checkpoint: {
                id: cpRec.id,
                issue_id: issue.id,
                identifier: issue.getString("identifier"),
                agent_name: agentName,
                persona: persona,
                checkpoint_type: checkpointType,
                status: status,
                notes: notes,
                created: cpRec.getString("created")
            },
            gate_passed: (status === "passed")
        }
    }

    const getValidationCheckpoints = (args) => {
        let issueRef = (args.issue_id || "").trim()
        if (!issueRef) { throw new Error("issue_id is required") }
        let issue = resolveIssueRecord(issueRef)
        let cpList = e.app.findRecordsByFilter("task_checkpoints", "issue = '" + issue.id + "'", "-created", 100, 0)
        let results = []
        let failedCount = 0
        let passedCount = 0
        for (let i = 0; i < cpList.length; i++) {
            let cp = cpList[i]
            let st = cp.getString("status")
            if (st === "passed") passedCount++
            else if (st === "failed" || st === "changes_requested") failedCount++
            results.push({
                id: cp.id,
                agent_name: cp.getString("agent_name"),
                persona: cp.getString("persona"),
                checkpoint_type: cp.getString("checkpoint_type"),
                status: st,
                notes: cp.getString("notes"),
                created: cp.getString("created")
            })
        }
        return {
            success: true,
            issue_id: issue.id,
            identifier: issue.getString("identifier"),
            total_checkpoints: results.length,
            all_passed: results.length > 0 && failedCount === 0,
            passed_count: passedCount,
            failed_count: failedCount,
            checkpoints: results
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
        else if (toolName === "search_issues") { result = searchIssues(args) }
        else if (toolName === "dispatch_agent") { result = dispatchAgent(args) }
        else if (toolName === "get_stats") { result = getStats() }
        else if (toolName === "acquire_task_lease") { result = acquireTaskLease(args) }
        else if (toolName === "release_task_lease") { result = releaseTaskLease(args) }
        else if (toolName === "renew_task_lease") { result = renewTaskLease(args) }
        else if (toolName === "get_task_lease") { result = getTaskLease(args) }
        else if (toolName === "log_agent_telemetry") { result = logAgentTelemetry(args) }
        else if (toolName === "register_webhook") { result = registerWebhook(args) }
        else if (toolName === "list_webhooks") { result = listWebhooks(args) }
        else if (toolName === "delete_webhook") { result = deleteWebhook(args) }
        else if (toolName === "decompose_task_graph") { result = decomposeTaskGraph(args) }
        else if (toolName === "get_dag_status") { result = getDagStatus(args) }
        else if (toolName === "execute_dag_step") { result = executeDagStep(args) }
        else if (toolName === "split_subtasks") { result = splitSubtasks(args) }
        else if (toolName === "submit_validation_checkpoint") { result = submitValidationCheckpoint(args) }
        else if (toolName === "get_validation_checkpoints") { result = getValidationCheckpoints(args) }
        else { return fail(-32602, "Unknown tool: " + toolName) }
        return ok({ content: [{ type: "text", text: JSON.stringify(result) }] })
    } catch (toolErr) {
        return fail(-32000, toolErr.message || String(toolErr))
    }
})
