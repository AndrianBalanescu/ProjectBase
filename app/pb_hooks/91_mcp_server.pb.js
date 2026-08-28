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
        },
        {
            name: "search_workspace_knowledge",
            description: "Deep semantic & full-text workspace knowledge search across issues, comments, agent telemetry traces, and validation checkpoints.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query or keyword" },
                    project_id: { type: "string", description: "Filter by project ID" },
                    types: {
                        type: "array",
                        description: "Entity types to search (issues, comments, telemetry, checkpoints)",
                        items: { type: "string" }
                    },
                    limit: { type: "integer", description: "Maximum number of results to return (default: 20)" }
                },
                required: ["query"]
            }
        },
        {
            name: "detect_workspace_blockers",
            description: "Detect cross-project blockers, dependency bottlenecks, circular deadlock cycles, and critical path issues across workspace.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project ID filter" },
                    include_cross_project: { type: "boolean", description: "Whether to include cross-project dependencies (default: true)" }
                }
            }
        },
        {
            name: "generate_sprint_retrospective",
            description: "Generate automated sprint/cycle retrospective with velocity metrics, agent productivity breakdown, quality gates, and actionable recommendations.",
            inputSchema: {
                type: "object",
                properties: {
                    cycle_id: { type: "string", description: "Optional cycle ID filter" },
                    project_id: { type: "string", description: "Optional project ID filter" }
                }
            }
        },
        {
            name: "export_federation_bundle",
            description: "Export project or workspace federation bundle with data integrity checksum for multi-host replication.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project ID or identifier (default: all projects in workspace)" },
                    include_telemetry: { type: "boolean", description: "Include agent telemetry logs (default: true)" },
                    include_checkpoints: { type: "boolean", description: "Include validation checkpoints (default: true)" }
                }
            }
        },
        {
            name: "import_federation_bundle",
            description: "Import federation bundle with configurable conflict resolution strategy (merge, overwrite, skip_existing).",
            inputSchema: {
                type: "object",
                properties: {
                    bundle: { type: "object", description: "Federation bundle JSON payload" },
                    conflict_strategy: { type: "string", description: "merge|overwrite|skip_existing (default: merge)" },
                    target_project_id: { type: "string", description: "Optional override target project ID" }
                },
                required: ["bundle"]
            }
        },
        {
            name: "get_agent_analytics",
            description: "Get real-time agent throughput, MTTC (mean time to complete), checkpoint pass rates, and persona workload metrics.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project filter" },
                    time_window_hours: { type: "integer", description: "Analytics time window in hours (default: 168)" }
                }
            }
        },
        {
            name: "detect_workflow_anomalies",
            description: "Scan for dead agent leases, rapid failure loops, starved issues, circular locks, with optional auto_heal repair.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project filter" },
                    auto_heal: { type: "boolean", description: "Automatically revoke dead leases and repair starved issues (default: false)" }
                }
            }
        },
        {
            name: "link_git_commit",
            description: "Link a git commit SHA, message, author, and diff stats to an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue ID or identifier (e.g. PB-12)" },
                    commit_sha: { type: "string", description: "Commit SHA" },
                    message: { type: "string", description: "Commit message" },
                    author: { type: "string", description: "Author name or email" },
                    url: { type: "string", description: "Optional web URL to commit" },
                    files_changed: { type: "integer", description: "Number of files changed" },
                    additions: { type: "integer", description: "Lines added" },
                    deletions: { type: "integer", description: "Lines deleted" }
                },
                required: ["issue_id", "commit_sha"]
            }
        },
        {
            name: "link_git_pr",
            description: "Link a Pull Request to an issue and update issue PR status and stage.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue ID or identifier (e.g. PB-12)" },
                    pr_number: { type: "string", description: "PR number e.g. #42 or 42" },
                    pr_url: { type: "string", description: "Pull request URL" },
                    title: { type: "string", description: "PR title" },
                    status: { type: "string", description: "open|merged|closed (default: open)" },
                    branch: { type: "string", description: "PR source branch" },
                    author: { type: "string", description: "PR author" }
                },
                required: ["issue_id", "pr_url"]
            }
        },
        {
            name: "get_issue_git_artifacts",
            description: "Get all linked branches, commits, pull requests, CI runs, and staged patches for an issue.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue ID or identifier (e.g. PB-12)" }
                },
                required: ["issue_id"]
            }
        },
        {
            name: "stage_code_patch",
            description: "Stage a unified diff or patch directly on an issue for review and autonomous verification.",
            inputSchema: {
                type: "object",
                properties: {
                    issue_id: { type: "string", description: "Issue ID or identifier (e.g. PB-12)" },
                    patch_content: { type: "string", description: "Raw unified diff / patch string" },
                    title: { type: "string", description: "Patch summary or title" },
                    author: { type: "string", description: "Author / agent persona name" }
                },
                required: ["issue_id", "patch_content"]
            }
        },
        {
            name: "process_git_webhook",
            description: "Process a GitHub/GitLab webhook payload for automated issue triage, status advance, and commit linking.",
            inputSchema: {
                type: "object",
                properties: {
                    event_type: { type: "string", description: "push|pull_request|workflow_run" },
                    payload: { type: "object", description: "Webhook event payload JSON" }
                },
                required: ["event_type", "payload"]
            }
        },
        {
            name: "get_project_git_status",
            description: "Get aggregated git workspace metrics: active branches, open/merged PRs, staged patches, and CI pass rate.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project ID or identifier" }
                }
            }
        },
        {
            name: "get_agent_workload_status",
            description: "Get real-time agent queue saturation, persona backlogs, active leases, capacity, and estimated clearance time.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project ID or identifier" }
                }
            }
        },
        {
            name: "calculate_autoscale_recommendations",
            description: "Calculate optimal autonomous agent worker pool allocations per persona based on backlog pressure and queue depth.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project ID or identifier" },
                    min_workers: { type: "integer", description: "Minimum total worker capacity (default 1)" },
                    max_workers: { type: "integer", description: "Maximum total worker capacity (default 10)" },
                    target_saturation_pct: { type: "integer", description: "Target saturation percentage (default 70)" },
                    apply: { type: "boolean", description: "Apply scaling allocations to agent_workloads collection" }
                }
            }
        },
        {
            name: "reserve_agent_capacity",
            description: "Reserve worker slot concurrency capacity with TTL expiration.",
            inputSchema: {
                type: "object",
                properties: {
                    persona: { type: "string", description: "Persona name (e.g. backend, frontend, qa, review)" },
                    worker_id: { type: "string", description: "Worker identifier" },
                    slots: { type: "integer", description: "Number of slots to reserve (default 1)" },
                    ttl_seconds: { type: "integer", description: "TTL in seconds (default 1800)" },
                    project_id: { type: "string", description: "Optional project ID" }
                },
                required: ["persona", "worker_id"]
            }
        },
        {
            name: "release_agent_capacity",
            description: "Release an active agent worker capacity reservation.",
            inputSchema: {
                type: "object",
                properties: {
                    reservation_id: { type: "string", description: "Reservation ID (e.g. RES-ABC)" },
                    worker_id: { type: "string", description: "Worker identifier" },
                    persona: { type: "string", description: "Optional persona filter" }
                }
            }
        },
        {
            name: "run_workflow_self_heal",
            description: "Autonomous self-healing scan to detect and auto-repair expired leases, orphaned DAG subtasks, and stalled statuses.",
            inputSchema: {
                type: "object",
                properties: {
                    project_id: { type: "string", description: "Optional project ID or identifier" },
                    auto_fix: { type: "boolean", description: "Whether to apply repairs (default true)" },
                    trigger: { type: "string", description: "Trigger name (default 'fastmcp')" }
                }
            }
        },
        {
            name: "get_live_benchmarks",
            description: "Execute live SQLite query latency probes, concurrency health metrics, and throughput ratings.",
            inputSchema: {
                type: "object",
                properties: {
                    iterations: { type: "integer", description: "Number of latency probe iterations (default 10, max 50)" }
                }
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

    const searchWorkspaceKnowledge = (args) => {
        let queryStr = (args.query || args.q || "").trim()
        if (!queryStr) { throw new Error("query is required") }
        let limit = parseInt(args.limit || "20", 10)
        if (isNaN(limit) || limit < 1) limit = 20
        if (limit > 100) limit = 100

        let targetTypes = ["issues", "comments", "telemetry", "checkpoints"]
        if (args.types) {
            if (Array.isArray(args.types)) targetTypes = args.types.map(t => String(t).toLowerCase().trim())
            else if (typeof args.types === "string") targetTypes = args.types.split(",").map(t => t.toLowerCase().trim()).filter(Boolean)
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
            if (idx === -1 && qTerms.length > 0) idx = str.toLowerCase().indexOf(qTerms[0])
            if (idx === -1) return str.substring(0, maxLen - 3) + "..."
            let start = Math.max(0, idx - 40)
            let end = Math.min(str.length, start + maxLen)
            let snippet = str.substring(start, end)
            if (start > 0) snippet = "..." + snippet
            if (end < str.length) snippet = snippet + "..."
            return snippet
        }

        let allResults = []

        if (targetTypes.indexOf("issues") !== -1) {
            let filter = "1=1"
            if (args.project_id) filter += " && project = '" + args.project_id + "'"
            let issues = e.app.findRecordsByFilter("issues", filter, "-created", 300, 0)
            for (let i = 0; i < issues.length; i++) {
                let iss = issues[i]
                let title = iss.getString("title") || ""
                let desc = iss.getString("description") || ""
                let ident = iss.getString("identifier") || ""
                let persona = iss.getString("task_persona") || ""
                let assignee = iss.getString("assignee") || ""
                let status = iss.getString("status") || "todo"

                let titleLower = title.toLowerCase()
                let descLower = desc.toLowerCase()
                let identLower = ident.toLowerCase()

                let score = 0
                if (identLower === qLower) score += 120
                else if (identLower.indexOf(qLower) !== -1) score += 80
                if (titleLower === qLower) score += 90
                else if (titleLower.indexOf(qLower) !== -1) score += 50
                if (descLower.indexOf(qLower) !== -1) score += 30
                if (persona.toLowerCase().indexOf(qLower) !== -1) score += 20
                if (assignee.toLowerCase().indexOf(qLower) !== -1) score += 15

                for (let t = 0; t < qTerms.length; t++) {
                    let term = qTerms[t]
                    if (titleLower.indexOf(term) !== -1) score += 15
                    if (descLower.indexOf(term) !== -1) score += 8
                }

                if (score > 0) {
                    allResults.push({
                        type: "issue",
                        id: iss.id,
                        identifier: ident,
                        title: title,
                        snippet: descLower.indexOf(qLower) !== -1 ? makeSnippet(desc) : makeSnippet(title),
                        score: score,
                        status: status,
                        priority: iss.getString("priority"),
                        assignee: assignee,
                        task_persona: persona,
                        created: iss.getString("created")
                    })
                }
            }
        }

        if (targetTypes.indexOf("comments") !== -1) {
            let comments = e.app.findRecordsByFilter("comments", "1=1", "-created", 200, 0)
            for (let i = 0; i < comments.length; i++) {
                let com = comments[i]
                let content = com.getString("content") || com.getString("body") || ""
                let contentLower = content.toLowerCase()
                let score = 0
                if (contentLower.indexOf(qLower) !== -1) score += 40
                for (let t = 0; t < qTerms.length; t++) {
                    if (contentLower.indexOf(qTerms[t]) !== -1) score += 10
                }
                if (score > 0) {
                    allResults.push({
                        type: "comment",
                        id: com.id,
                        issue_id: com.getString("issue"),
                        snippet: makeSnippet(content),
                        score: score,
                        created: com.getString("created")
                    })
                }
            }
        }

        if (targetTypes.indexOf("telemetry") !== -1) {
            try {
                let telList = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 200, 0)
                for (let i = 0; i < telList.length; i++) {
                    let tel = telList[i]
                    let summary = tel.getString("summary") || ""
                    let agentName = tel.getString("agent_name") || ""
                    let eventType = tel.getString("event_type") || ""
                    let text = (summary + " " + agentName + " " + eventType).toLowerCase()
                    let score = 0
                    if (summary.toLowerCase().indexOf(qLower) !== -1) score += 35
                    if (text.indexOf(qLower) !== -1) score += 20
                    if (score > 0) {
                        allResults.push({
                            type: "telemetry",
                            id: tel.id,
                            agent_name: agentName,
                            event_type: eventType,
                            summary: summary,
                            snippet: makeSnippet(summary),
                            score: score,
                            created: tel.getString("created")
                        })
                    }
                }
            } catch (x) {}
        }

        if (targetTypes.indexOf("checkpoints") !== -1) {
            try {
                let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 200, 0)
                for (let i = 0; i < cpList.length; i++) {
                    let cp = cpList[i]
                    let notes = cp.getString("notes") || ""
                    let agentName = cp.getString("agent_name") || ""
                    let persona = cp.getString("persona") || ""
                    let cpType = cp.getString("checkpoint_type") || ""
                    let text = (notes + " " + agentName + " " + persona + " " + cpType).toLowerCase()
                    let score = 0
                    if (notes.toLowerCase().indexOf(qLower) !== -1) score += 35
                    if (text.indexOf(qLower) !== -1) score += 20
                    if (score > 0) {
                        allResults.push({
                            type: "checkpoint",
                            id: cp.id,
                            issue_id: cp.getString("issue"),
                            checkpoint_type: cpType,
                            status: cp.getString("status"),
                            reviewer: agentName,
                            persona: persona,
                            snippet: makeSnippet(notes || cpType),
                            score: score,
                            created: cp.getString("created")
                        })
                    }
                }
            } catch (x) {}
        }

        allResults.sort((a, b) => b.score - a.score)
        let trimmed = allResults.slice(0, limit)

        return {
            query: queryStr,
            count: trimmed.length,
            total_matches: allResults.length,
            types_searched: targetTypes,
            results: trimmed
        }
    }

    const detectWorkspaceBlockers = (args) => {
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

        let projectFilter = (args.project_id || "").trim()
        let includeCrossProject = args.include_cross_project !== false

        let issues = e.app.findRecordsByFilter("issues", "1=1", "-created", 1000, 0)
        let issueMap = {}
        for (let i = 0; i < issues.length; i++) { issueMap[issues[i].id] = issues[i] }

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

            let parentId = iss.getString("parent_issue")
            if (parentId && issueMap[parentId] && iss.getString("status") !== "done" && iss.getString("status") !== "cancelled") {
                if (!blockersMap[issId]) blockersMap[issId] = []
                if (blockersMap[issId].indexOf(parentId) === -1) blockersMap[issId].push(parentId)
                if (!blockedByMap[parentId]) blockedByMap[parentId] = []
                if (blockedByMap[parentId].indexOf(issId) === -1) blockedByMap[parentId].push(issId)
            }
        }

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
            if (!visited[allNodeIds[i]]) findCycles(allNodeIds[i], [])
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
        let crossProjectCount = 0

        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let issId = iss.id
            let status = iss.getString("status")
            let isOpen = (status !== "done" && status !== "cancelled")
            let projId = iss.getString("project")

            if (projectFilter && projId !== projectFilter && !includeCrossProject) continue

            let downstreamIds = blockersMap[issId] || []
            if (isOpen && downstreamIds.length > 0) {
                let blockedItems = []
                let isCross = false
                for (let d = 0; d < downstreamIds.length; d++) {
                    let downIss = issueMap[downstreamIds[d]]
                    if (downIss) {
                        if (downIss.getString("project") !== projId) isCross = true
                        blockedItems.push({
                            id: downIss.id,
                            identifier: downIss.getString("identifier"),
                            title: downIss.getString("title"),
                            status: downIss.getString("status")
                        })
                    }
                }
                if (blockedItems.length > 0) {
                    if (isCross) crossProjectCount++
                    directBlockersList.push({
                        issue: {
                            id: iss.id,
                            identifier: iss.getString("identifier"),
                            title: iss.getString("title"),
                            status: status,
                            priority: iss.getString("priority"),
                            assignee: iss.getString("assignee"),
                            task_persona: iss.getString("task_persona")
                        },
                        blocked_issues: blockedItems,
                        blocked_count: blockedItems.length,
                        impact_score: computeImpact(issId),
                        is_cross_project: isCross
                    })
                }
            }

            let upstreamIds = blockedByMap[issId] || []
            if (isOpen && upstreamIds.length > 0) {
                let activeUpstream = []
                for (let u = 0; u < upstreamIds.length; u++) {
                    let upIss = issueMap[upstreamIds[u]]
                    if (upIss && upIss.getString("status") !== "done" && upIss.getString("status") !== "cancelled") {
                        activeUpstream.push({
                            id: upIss.id,
                            identifier: upIss.getString("identifier"),
                            title: upIss.getString("title"),
                            status: upIss.getString("status"),
                            assignee: upIss.getString("assignee")
                        })
                    }
                }
                if (activeUpstream.length > 0) {
                    blockedIssuesList.push({
                        issue: {
                            id: iss.id,
                            identifier: iss.getString("identifier"),
                            title: iss.getString("title"),
                            status: status
                        },
                        unresolved_blockers: activeUpstream,
                        unresolved_blockers_count: activeUpstream.length
                    })
                }
            }
        }

        directBlockersList.sort((a, b) => b.impact_score - a.impact_score)

        return {
            summary: {
                total_active_blockers: directBlockersList.length,
                total_blocked_issues: blockedIssuesList.length,
                cross_project_blockers_count: crossProjectCount,
                critical_path_count: Math.min(5, directBlockersList.length),
                circular_cycles_detected: circularCycles.length
            },
            critical_path: directBlockersList.slice(0, 5),
            direct_blockers: directBlockersList,
            blocked_issues: blockedIssuesList,
            circular_warnings: circularCycles
        }
    }

    const generateSprintRetrospective = (args) => {
        let cycleFilter = (args.cycle_id || "").trim()
        let projectFilter = (args.project_id || "").trim()

        let filter = "1=1"
        if (projectFilter) filter += " && project = '" + projectFilter + "'"
        if (cycleFilter) filter += " && cycle = '" + cycleFilter + "'"

        let issues = e.app.findRecordsByFilter("issues", filter, "-created", 1000, 0)
        let totalIssues = issues.length
        let completedIssues = 0
        let totalEstimate = 0
        let completedEstimate = 0

        let statusCounts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0 }
        let priorityCounts = { low: 0, medium: 0, high: 0, urgent: 0 }
        let completedRecords = []
        let agentStats = {}

        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let s = iss.getString("status") || "todo"
            let p = iss.getString("priority") || "medium"
            let est = iss.getInt("estimate") || 0
            let assignee = iss.getString("assignee") || "Unassigned"

            if (statusCounts[s] !== undefined) statusCounts[s]++
            if (priorityCounts[p] !== undefined) priorityCounts[p]++
            totalEstimate += est

            if (!agentStats[assignee]) {
                agentStats[assignee] = { agent_name: assignee, total_assigned: 0, completed_tasks: 0, in_progress_tasks: 0, estimate_delivered: 0 }
            }
            agentStats[assignee].total_assigned++

            if (s === "done") {
                completedIssues++
                completedEstimate += est
                agentStats[assignee].completed_tasks++
                agentStats[assignee].estimate_delivered += est
                completedRecords.push(iss)
            } else if (s === "in_progress") {
                agentStats[assignee].in_progress_tasks++
            }
        }

        let completionRate = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0

        let totalCheckpoints = 0
        let passedCheckpoints = 0
        let failedCheckpoints = 0
        try {
            let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
            totalCheckpoints = cpList.length
            for (let c = 0; c < cpList.length; c++) {
                let st = cpList[c].getString("status")
                if (st === "passed") passedCheckpoints++
                else if (st === "failed" || st === "changes_requested") failedCheckpoints++
            }
        } catch (x) {}

        let qualityGatePassRate = totalCheckpoints > 0 ? Math.round((passedCheckpoints / totalCheckpoints) * 100) : 100

        let highlights = []
        let bottlenecks = []
        let recommendations = []

        if (completedIssues > 0) highlights.push("Successfully completed " + completedIssues + " issues (" + completedEstimate + " points delivered).")
        if (completedRecords.length > 0) {
            let sample = completedRecords.slice(0, 3).map(r => r.getString("identifier") + ": " + r.getString("title"))
            highlights.push("Key deliverables: " + sample.join("; "))
        }
        if (statusCounts.in_review > 3) bottlenecks.push("Review queue backlog: " + statusCounts.in_review + " issues in 'in_review'.")
        if (failedCheckpoints > 0) bottlenecks.push("Quality gate failures: " + failedCheckpoints + " failed checkpoints.")
        if (recommendations.length === 0) recommendations.push("Sprint velocity and quality gates are optimal.")

        return {
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
            agent_productivity: Object.values(agentStats),
            retrospective_synthesis: {
                highlights: highlights,
                bottlenecks: bottlenecks,
                recommendations: recommendations
            }
        }
    }

    const exportFederationBundle = (args) => {
        let projectId = (args.project_id || "").trim()
        let includeTelemetry = args.include_telemetry !== undefined ? !!args.include_telemetry : true
        let includeCheckpoints = args.include_checkpoints !== undefined ? !!args.include_checkpoints : true

        let projectFilter = projectId ? ("id = '" + projectId + "' || identifier = '" + projectId + "'") : "1=1"
        let projectRecords = e.app.findRecordsByFilter("projects", projectFilter, "name", 100, 0)
        let projectIds = projectRecords.map(p => p.id)
        let exportedProjects = projectRecords.map(p => ({
            id: p.id, name: p.getString("name"), identifier: p.getString("identifier"),
            description: p.getString("description"), color: p.getString("color"), icon: p.getString("icon")
        }))

        let exportedCycles = []
        try {
            let cycleRecords = e.app.findRecordsByFilter("cycles", "1=1", "start_date", 500, 0)
            for (let i = 0; i < cycleRecords.length; i++) {
                let c = cycleRecords[i]
                if (projectIds.length === 0 || projectIds.indexOf(c.getString("project")) !== -1) {
                    exportedCycles.push({ id: c.id, project: c.getString("project"), name: c.getString("name"), number: c.getInt("number"), status: c.getString("status") })
                }
            }
        } catch (x) {}

        let exportedMilestones = []
        try {
            let msRecords = e.app.findRecordsByFilter("milestones", "1=1", "target_date", 500, 0)
            for (let i = 0; i < msRecords.length; i++) {
                let m = msRecords[i]
                if (projectIds.length === 0 || projectIds.indexOf(m.getString("project")) !== -1) {
                    exportedMilestones.push({ id: m.id, project: m.getString("project"), name: m.getString("name"), status: m.getString("status") })
                }
            }
        } catch (x) {}

        let exportedIssues = []
        let issueIds = []
        let issueFilter = projectId && projectRecords.length > 0 ? ("project = '" + projectRecords[0].id + "'") : "1=1"
        let issueRecords = e.app.findRecordsByFilter("issues", issueFilter, "-created", 1000, 0)
        for (let i = 0; i < issueRecords.length; i++) {
            let iss = issueRecords[i]
            if (projectIds.length === 0 || projectIds.indexOf(iss.getString("project")) !== -1) {
                issueIds.push(iss.id)
                exportedIssues.push({
                    id: iss.id, identifier: iss.getString("identifier"), project: iss.getString("project"),
                    title: iss.getString("title"), description: iss.getString("description"), status: iss.getString("status"),
                    priority: iss.getString("priority"), estimate: iss.getInt("estimate"), assignee: iss.getString("assignee"),
                    task_persona: iss.getString("task_persona"), parent_issue: iss.getString("parent_issue")
                })
            }
        }

        let exportedCheckpoints = []
        if (includeCheckpoints && issueIds.length > 0) {
            try {
                let cpRecords = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
                for (let i = 0; i < cpRecords.length; i++) {
                    if (issueIds.indexOf(cpRecords[i].getString("issue")) !== -1) {
                        exportedCheckpoints.push({
                            id: cpRecords[i].id, issue: cpRecords[i].getString("issue"),
                            reviewer_persona: cpRecords[i].getString("reviewer_persona"),
                            status: cpRecords[i].getString("status"), quality_score: cpRecords[i].getInt("quality_score")
                        })
                    }
                }
            } catch (x) {}
        }

        let exportedTelemetry = []
        if (includeTelemetry && issueIds.length > 0) {
            try {
                let telRecords = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 500, 0)
                for (let i = 0; i < telRecords.length; i++) {
                    if (issueIds.indexOf(telRecords[i].getString("issue")) !== -1) {
                        exportedTelemetry.push({
                            id: telRecords[i].id, issue: telRecords[i].getString("issue"),
                            agent_name: telRecords[i].getString("agent_name"), event_type: telRecords[i].getString("event_type"),
                            summary: telRecords[i].getString("summary")
                        })
                    }
                }
            } catch (x) {}
        }

        let data = {
            projects: exportedProjects,
            cycles: exportedCycles,
            milestones: exportedMilestones,
            issues: exportedIssues,
            checkpoints: exportedCheckpoints,
            telemetry: exportedTelemetry
        }

        return {
            format: "projectbase_federation_bundle",
            version: "1.0.0",
            exported_at: new Date().toISOString(),
            scope: projectId ? "project" : "workspace",
            manifest: {
                projects_count: exportedProjects.length,
                cycles_count: exportedCycles.length,
                milestones_count: exportedMilestones.length,
                issues_count: exportedIssues.length,
                checkpoints_count: exportedCheckpoints.length,
                telemetry_count: exportedTelemetry.length
            },
            data: data,
            checksum: "ck_" + String(exportedIssues.length) + "_" + String(exportedProjects.length)
        }
    }

    const importFederationBundle = (args) => {
        let rawBundle = args.bundle
        if (!rawBundle || typeof rawBundle !== "object" || !rawBundle.data) {
            throw new Error("Invalid federation bundle: missing 'data' payload")
        }
        let conflictStrategy = (args.conflict_strategy || "merge").toLowerCase().trim()
        let targetProjectId = (args.target_project_id || "").trim()
        let data = rawBundle.data
        let incomingProjects = data.projects || []
        let incomingIssues = data.issues || []

        let projectsCol = e.app.findCollectionByNameOrId("projects")
        let issuesCol = e.app.findCollectionByNameOrId("issues")

        let projectMap = {}
        let stats = { projects_created: 0, issues_created: 0, issues_updated: 0, issues_skipped: 0 }

        if (targetProjectId) {
            let targetProjRec = e.app.findRecordById("projects", targetProjectId)
            for (let i = 0; i < incomingProjects.length; i++) { projectMap[incomingProjects[i].id] = targetProjRec.id }
        } else {
            for (let i = 0; i < incomingProjects.length; i++) {
                let p = incomingProjects[i]
                let existing = null
                try {
                    let recs = e.app.findRecordsByFilter("projects", "identifier = '" + p.identifier + "' || name = '" + p.name.replace(/'/g, "\\'") + "'", "-created", 1, 0)
                    if (recs.length > 0) existing = recs[0]
                } catch (x) {}
                if (existing) {
                    projectMap[p.id] = existing.id
                } else {
                    let newProj = new Record(projectsCol)
                    newProj.set("name", p.name)
                    newProj.set("identifier", p.identifier || p.name.substring(0, 4).toUpperCase())
                    newProj.set("description", p.description || "")
                    newProj.set("color", p.color || "#6366f1")
                    newProj.set("icon", p.icon || "folder")
                    e.app.save(newProj)
                    projectMap[p.id] = newProj.id
                    stats.projects_created++
                }
            }
        }

        for (let i = 0; i < incomingIssues.length; i++) {
            let iss = incomingIssues[i]
            let targetProj = projectMap[iss.project] || targetProjectId
            if (!targetProj) {
                try {
                    let fallbackProj = e.app.findRecordsByFilter("projects", "1=1", "name", 1, 0)
                    if (fallbackProj.length > 0) targetProj = fallbackProj[0].id
                } catch (x) {}
            }
            if (!targetProj) continue

            let existing = null
            try {
                if (iss.identifier) {
                    let recs = e.app.findRecordsByFilter("issues", "identifier = '" + iss.identifier + "'", "-created", 1, 0)
                    if (recs.length > 0) existing = recs[0]
                }
            } catch (x) {}

            if (existing) {
                if (conflictStrategy === "skip_existing") {
                    stats.issues_skipped++
                    continue
                }
                existing.set("title", iss.title)
                existing.set("description", iss.description || "")
                existing.set("status", iss.status || "todo")
                existing.set("priority", iss.priority || "medium")
                e.app.save(existing)
                stats.issues_updated++
            } else {
                let newIss = new Record(issuesCol)
                newIss.set("project", targetProj)
                newIss.set("title", iss.title)
                newIss.set("description", iss.description || "")
                newIss.set("status", iss.status || "todo")
                newIss.set("priority", iss.priority || "medium")
                newIss.set("estimate", iss.estimate || 0)
                if (iss.assignee) newIss.set("assignee", iss.assignee)
                if (iss.task_persona) newIss.set("task_persona", iss.task_persona)
                e.app.save(newIss)
                stats.issues_created++
            }
        }

        return {
            success: true,
            conflict_strategy: conflictStrategy,
            stats: stats
        }
    }

    const getAgentAnalytics = (args) => {
        let projectId = (args.project_id || "").trim()
        let timeWindowHours = parseInt(args.time_window_hours || "168", 10)
        if (isNaN(timeWindowHours) || timeWindowHours < 1) timeWindowHours = 168

        let filter = "1=1"
        if (projectId) filter += " && project = '" + projectId.replace(/'/g, "") + "'"

        let issues = e.app.findRecordsByFilter("issues", filter, "-created", 1000, 0)
        let personaStats = {
            architect: { persona: "architect", total: 0, completed: 0 },
            coder: { persona: "coder", total: 0, completed: 0 },
            reviewer: { persona: "reviewer", total: 0, completed: 0 },
            tester: { persona: "tester", total: 0, completed: 0 },
            general: { persona: "general", total: 0, completed: 0 }
        }

        let completedTotal = 0
        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let pName = (iss.getString("task_persona") || "general").toLowerCase().trim()
            if (!personaStats[pName]) personaStats[pName] = { persona: pName, total: 0, completed: 0 }
            personaStats[pName].total++
            if (iss.getString("status") === "done") {
                completedTotal++
                personaStats[pName].completed++
            }
        }

        let totalCheckpoints = 0
        let passedCheckpoints = 0
        try {
            let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
            totalCheckpoints = cpList.length
            for (let c = 0; c < cpList.length; c++) {
                if (cpList[c].getString("status") === "passed") passedCheckpoints++
            }
        } catch (x) {}

        return {
            time_window_hours: timeWindowHours,
            total_issues: issues.length,
            total_completed: completedTotal,
            completion_rate_percent: issues.length > 0 ? Math.round((completedTotal / issues.length) * 100) : 0,
            checkpoints_pass_rate_percent: totalCheckpoints > 0 ? Math.round((passedCheckpoints / totalCheckpoints) * 100) : 100,
            persona_breakdown: Object.values(personaStats)
        }
    }

    const detectWorkflowAnomalies = (args) => {
        let projectId = (args.project_id || "").trim()
        let autoHeal = !!args.auto_heal

        let nowMs = new Date().getTime()
        let anomalies = []
        let healedActions = []

        try {
            let leases = e.app.findRecordsByFilter("task_leases", "1=1", "-created", 500, 0)
            for (let i = 0; i < leases.length; i++) {
                let lease = leases[i]
                let expStr = lease.getString("expires_at")
                if (expStr && new Date(expStr).getTime() < nowMs) {
                    anomalies.push({
                        type: "stale_agent_lease",
                        severity: "critical",
                        lease_id: lease.id,
                        agent_name: lease.getString("agent_name"),
                        reason: "Task lease expired"
                    })
                    if (autoHeal) {
                        try {
                            e.app.delete(lease)
                            healedActions.push({ action: "revoked_stale_lease", lease_id: lease.id })
                        } catch (x) {}
                    }
                }
            }
        } catch (x) {}

        let criticalCount = 0
        let warningCount = 0
        for (let i = 0; i < anomalies.length; i++) {
            if (anomalies[i].severity === "critical") criticalCount++
            else warningCount++
        }

        return {
            total_anomalies: anomalies.length,
            critical_count: criticalCount,
            warning_count: warningCount,
            anomalies: anomalies,
            auto_healed: autoHeal,
            healed_count: healedActions.length,
            healed_actions: healedActions
        }
    }

    const linkGitCommit = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let commitSha = (args.commit_sha || "").trim()
        if (!commitSha) throw new Error("commit_sha is required")
        let col = e.app.findCollectionByNameOrId("git_artifacts")
        let rec = new Record(col)
        rec.set("project", issue.getString("project"))
        rec.set("issue", issue.id)
        rec.set("artifact_type", "commit")
        rec.set("identifier", commitSha.length > 8 ? commitSha.substring(0, 8) : commitSha)
        rec.set("title", (args.message || "").trim())
        rec.set("author", (args.author || "agent").trim())
        rec.set("url", (args.url || "").trim())
        rec.set("status", "committed")
        rec.set("diff_stats", {
            files_changed: Number(args.files_changed) || 1,
            additions: Number(args.additions) || 0,
            deletions: Number(args.deletions) || 0
        })
        e.app.save(rec)
        return {
            success: true,
            artifact_id: rec.id,
            issue_id: issue.id,
            commit_sha: commitSha
        }
    }

    const linkGitPr = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let prUrl = (args.pr_url || "").trim()
        if (!prUrl) throw new Error("pr_url is required")
        let status = (args.status || "open").toLowerCase().trim()
        let prNum = (args.pr_number || "").trim()
        if (!prNum && prUrl) {
            let segs = prUrl.split("/")
            prNum = "#" + segs[segs.length - 1]
        }
        let col = e.app.findCollectionByNameOrId("git_artifacts")
        let rec = new Record(col)
        rec.set("project", issue.getString("project"))
        rec.set("issue", issue.id)
        rec.set("artifact_type", "pull_request")
        rec.set("identifier", prNum || "#PR")
        rec.set("title", (args.title || "").trim())
        rec.set("url", prUrl)
        rec.set("status", status)
        rec.set("author", (args.author || "agent").trim())
        e.app.save(rec)

        issue.set("pr_url", prUrl)
        issue.set("pr_status", status)
        if (args.branch) issue.set("git_branch", (args.branch || "").trim())
        if (status === "merged") {
            issue.set("status", "done")
        } else if (status === "open" && issue.getString("status") !== "done") {
            issue.set("status", "in_review")
        }
        e.app.save(issue)

        return {
            success: true,
            artifact_id: rec.id,
            issue_id: issue.id,
            pr_status: status,
            issue_status: issue.getString("status")
        }
    }

    const getIssueGitArtifacts = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let records = []
        try {
            records = e.app.findRecordsByFilter("git_artifacts", "issue = '" + issue.id + "'", "-created", 100, 0)
        } catch (x) {}
        let out = []
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                artifact_type: r.getString("artifact_type"),
                identifier: r.getString("identifier"),
                title: r.getString("title"),
                url: r.getString("url"),
                status: r.getString("status"),
                author: r.getString("author"),
                diff_stats: r.get("diff_stats") || {},
                created: r.getString("created")
            })
        }
        return {
            issue_id: issue.id,
            git_branch: issue.getString("git_branch"),
            pr_url: issue.getString("pr_url"),
            pr_status: issue.getString("pr_status"),
            artifacts: out,
            total: out.length
        }
    }

    const stageCodePatch = (args) => {
        let issue = resolveIssueRecord(args.issue_id)
        let patchContent = (args.patch_content || "").trim()
        if (!patchContent) throw new Error("patch_content is required")
        let col = e.app.findCollectionByNameOrId("git_artifacts")
        let rec = new Record(col)
        let patchId = "patch-" + String(Date.now()).slice(-8)
        rec.set("project", issue.getString("project"))
        rec.set("issue", issue.id)
        rec.set("artifact_type", "patch")
        rec.set("identifier", patchId)
        rec.set("title", (args.title || "Autonomous agent staged patch").trim())
        rec.set("author", (args.author || "agent").trim())
        rec.set("status", "staged")
        rec.set("patch_content", patchContent)
        
        let lines = patchContent.split("\n")
        let adds = 0, dels = 0, files = 0
        for (let l = 0; l < lines.length; l++) {
            let line = lines[l]
            if (line.indexOf("+++ b/") === 0) files++
            else if (line.indexOf("+") === 0 && line.indexOf("+++") !== 0) adds++
            else if (line.indexOf("-") === 0 && line.indexOf("---") !== 0) dels++
        }
        if (files === 0) files = 1
        rec.set("diff_stats", { files_changed: files, additions: adds, deletions: dels })
        e.app.save(rec)

        return {
            success: true,
            patch_id: rec.id,
            identifier: patchId,
            diff_stats: { files_changed: files, additions: adds, deletions: dels },
            issue_id: issue.id
        }
    }

    const processGitWebhook = (args) => {
        let eventType = (args.event_type || "push").toLowerCase().trim()
        let payload = args.payload || {}
        let triaged = []

        const extractKeys = (txt) => {
            if (!txt || typeof txt !== "string") return []
            let tokens = []
            let curr = ""
            for (let i = 0; i < txt.length; i++) {
                let ch = txt[i]
                let isA = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
                let isD = ch >= '0' && ch <= '9'
                if (isA || isD || ch === '-') curr += ch
                else { if (curr.length > 0) { tokens.push(curr); curr = "" } }
            }
            if (curr.length > 0) tokens.push(curr)
            let out = []
            for (let t of tokens) {
                let parts = t.split('-')
                for (let p = 0; p < parts.length - 1; p++) {
                    let prefix = parts[p].toUpperCase()
                    let suffix = parts[p + 1]
                    let validPrefix = prefix.length >= 1 && prefix.length <= 10
                    for (let c = 0; c < prefix.length; c++) {
                        let code = prefix.charCodeAt(c)
                        let isAlnum = (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 95
                        if (!isAlnum) { validPrefix = false; break }
                    }
                    let validSuffix = suffix.length >= 1 && suffix.length <= 8
                    for (let c = 0; c < suffix.length; c++) {
                        let code = suffix.charCodeAt(c)
                        if (code < 48 || code > 57) { validSuffix = false; break }
                    }
                    if (validPrefix && validSuffix) {
                        let id = prefix + "-" + suffix
                        if (out.indexOf(id) === -1) out.push(id)
                    }
                }
            }
            return out
        }

        if (eventType === "push") {
            let commits = payload.commits || []
            for (let c of commits) {
                let keys = extractKeys(c.message || "")
                for (let k of keys) {
                    try {
                        let isRec = resolveIssueRecord(k)
                        let col = e.app.findCollectionByNameOrId("git_artifacts")
                        let rec = new Record(col)
                        rec.set("project", isRec.getString("project"))
                        rec.set("issue", isRec.id)
                        rec.set("artifact_type", "commit")
                        rec.set("identifier", (c.id || c.sha || "sha").substring(0, 8))
                        rec.set("title", c.message || "")
                        rec.set("author", (c.author ? (c.author.name || c.author.username) : "git"))
                        rec.set("status", "committed")
                        e.app.save(rec)

                        if (isRec.getString("status") === "backlog" || isRec.getString("status") === "todo") {
                            isRec.set("status", "in_progress")
                            e.app.save(isRec)
                        }
                        triaged.push({ key: k, type: "commit", status: isRec.getString("status") })
                    } catch (x) {}
                }
            }
        } else if (eventType === "pull_request") {
            let pr = payload.pull_request || payload
            let keys = extractKeys((pr.title || "") + " " + (pr.body || ""))
            let merged = pr.merged === true || payload.action === "closed" && pr.merged
            let state = merged ? "merged" : (pr.state || "open")
            for (let k of keys) {
                try {
                    let isRec = resolveIssueRecord(k)
                    let col = e.app.findCollectionByNameOrId("git_artifacts")
                    let rec = new Record(col)
                    rec.set("project", isRec.getString("project"))
                    rec.set("issue", isRec.id)
                    rec.set("artifact_type", "pull_request")
                    rec.set("identifier", "#" + String(pr.number || "PR"))
                    rec.set("title", pr.title || "")
                    rec.set("url", pr.html_url || pr.url || "")
                    rec.set("status", state)
                    e.app.save(rec)

                    isRec.set("pr_url", pr.html_url || pr.url || "")
                    isRec.set("pr_status", state)
                    if (state === "merged") isRec.set("status", "done")
                    else if (state === "open" && isRec.getString("status") !== "done") isRec.set("status", "in_review")
                    e.app.save(isRec)

                    triaged.push({ key: k, type: "pull_request", state: state, status: isRec.getString("status") })
                } catch (x) {}
            }
        }

        return {
            success: true,
            event_type: eventType,
            triaged_count: triaged.length,
            triaged: triaged
        }
    }

    const getProjectGitStatus = (args) => {
        let filter = args.project_id ? ("project = '" + args.project_id + "'") : "1=1"
        let recs = []
        try { recs = e.app.findRecordsByFilter("git_artifacts", filter, "-created", 500, 0) } catch (x) {}
        let branches = 0, commits = 0, prOpen = 0, prMerged = 0, patches = 0, ciRuns = 0, ciPassed = 0
        for (let i = 0; i < recs.length; i++) {
            let t = recs[i].getString("artifact_type")
            let st = recs[i].getString("status")
            if (t === "branch") branches++
            else if (t === "commit") commits++
            else if (t === "pull_request") {
                if (st === "open") prOpen++
                else if (st === "merged") prMerged++
            } else if (t === "patch") patches++
            else if (t === "ci_run") {
                ciRuns++
                if (st === "success" || st === "passed" || st === "completed") ciPassed++
            }
        }
        let passRate = ciRuns > 0 ? Math.round((ciPassed / ciRuns) * 100) : 100
        return {
            total_artifacts: recs.length,
            branches_tracked: branches,
            commits_recorded: commits,
            pull_requests: { open: prOpen, merged: prMerged, total: prOpen + prMerged },
            staged_patches: patches,
            ci_pass_rate_percent: passRate
        }
    }

    const getAgentWorkloadStatus = (args) => {
        let filter = args.project_id ? ("project = '" + args.project_id + "'") : ""
        let issues = []
        try { issues = e.app.findRecordsByFilter("issues", filter, "-created", 1000, 0) } catch (x) {}
        let statusCounts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0 }
        let personaQueues = { backend: 0, frontend: 0, qa: 0, review: 0, architect: 0, docs: 0, general: 0 }
        for (let i = 0; i < issues.length; i++) {
            let st = issues[i].getString("status") || "backlog"
            if (statusCounts[st] !== undefined) statusCounts[st]++
            if (st === "todo" || st === "in_progress" || st === "backlog") {
                let p = (issues[i].getString("task_persona") || "").toLowerCase()
                let title = (issues[i].getString("title") || "").toLowerCase()
                if (p && personaQueues[p] !== undefined) personaQueues[p]++
                else if (title.indexOf("api") !== -1 || title.indexOf("backend") !== -1) personaQueues.backend++
                else if (title.indexOf("ui") !== -1 || title.indexOf("frontend") !== -1) personaQueues.frontend++
                else if (title.indexOf("test") !== -1 || title.indexOf("qa") !== -1) personaQueues.qa++
                else if (title.indexOf("review") !== -1 || st === "in_review") personaQueues.review++
                else personaQueues.general++
            }
        }
        let activeLeases = 0
        try {
            let nowIso = new Date().toISOString().replace("T", " ").substring(0, 19) + "Z"
            let leases = e.app.findRecordsByFilter("task_leases", "expires_at > '" + nowIso + "'", "", 200, 0)
            activeLeases = leases.length
        } catch (x) {}
        let pending = statusCounts.todo + statusCounts.in_progress + statusCounts.backlog
        let cap = Math.max(activeLeases, 2)
        return {
            total_issues: issues.length,
            status_distribution: statusCounts,
            persona_queue_depth: personaQueues,
            active_leases_count: activeLeases,
            pending_backlog_count: pending,
            saturation_percent: Math.min(100, Math.round((pending / cap) * 20)),
            estimated_clearance_minutes: Math.round(pending * 4.5)
        }
    }

    const calculateAutoscaleRecommendations = (args) => {
        let minW = parseInt(args.min_workers || "1", 10)
        let maxW = parseInt(args.max_workers || "10", 10)
        let targetSat = parseInt(args.target_saturation_pct || "70", 10)
        let wStatus = getAgentWorkloadStatus(args)
        let pq = wStatus.persona_queue_depth
        let alloc = {}
        let total = 0
        for (let p of Object.keys(pq)) {
            let cnt = pq[p] > 0 ? Math.max(1, Math.min(4, Math.ceil(pq[p] / 3))) : 0
            alloc[p] = cnt
            total += cnt
        }
        total = Math.max(minW, Math.min(maxW, total))
        let decision = total > 4 ? "scale_up" : (wStatus.pending_backlog_count === 0 ? "scale_down" : "maintain")
        return {
            decision: decision,
            total_recommended_workers: total,
            target_saturation_percent: targetSat,
            persona_allocations: alloc,
            pending_backlog_count: wStatus.pending_backlog_count
        }
    }

    const reserveAgentCapacity = (args) => {
        let persona = (args.persona || "general").toLowerCase()
        let workerId = args.worker_id || ("worker-" + Math.random().toString(36).substring(2, 7))
        let slots = parseInt(args.slots || "1", 10)
        let ttl = parseInt(args.ttl_seconds || "1800", 10)
        let resId = "RES-" + Math.random().toString(36).substring(2, 9).toUpperCase()
        let exp = new Date(Date.now() + ttl * 1000).toISOString()
        try {
            let col = e.app.findCollectionByNameOrId("agent_reservations")
            let rec = new Record(col)
            rec.set("reservation_id", resId)
            rec.set("persona", persona)
            rec.set("worker_id", workerId)
            rec.set("slots", slots)
            rec.set("expires_at", exp)
            rec.set("status", "active")
            if (args.project_id) rec.set("project", args.project_id)
            e.app.save(rec)
        } catch (x) {}
        return { success: true, reservation_id: resId, persona: persona, worker_id: workerId, slots: slots, expires_at: exp }
    }

    const releaseAgentCapacity = (args) => {
        let filter = ""
        if (args.reservation_id) filter = "reservation_id = '" + args.reservation_id + "'"
        else if (args.worker_id) filter = "worker_id = '" + args.worker_id + "'"
        else return { error: "reservation_id or worker_id is required" }
        let count = 0
        try {
            let recs = e.app.findRecordsByFilter("agent_reservations", filter, "", 50, 0)
            for (let i = 0; i < recs.length; i++) {
                recs[i].set("status", "released")
                e.app.save(recs[i])
                count++
            }
        } catch (x) {}
        return { success: true, released_count: count }
    }

    const runWorkflowSelfHeal = (args) => {
        let autoFix = args.auto_fix !== false
        let anomalies = []
        let repairs = []
        let nowIso = new Date().toISOString().replace("T", " ").substring(0, 19) + "Z"
        try {
            let expired = e.app.findRecordsByFilter("task_leases", "expires_at < '" + nowIso + "'", "", 100, 0)
            for (let i = 0; i < expired.length; i++) {
                anomalies.push({ type: "expired_task_lease", id: expired[i].id })
                if (autoFix) {
                    try { e.app.delete(expired[i]); repairs.push({ type: "deleted_expired_lease", id: expired[i].id }) } catch (dx) {}
                }
            }
        } catch (x) {}
        return { success: true, auto_fix: autoFix, anomalies_detected: anomalies.length, repairs_applied: repairs.length, anomalies: anomalies, repairs: repairs }
    }

    const getLiveBenchmarks = (args) => {
        let iters = parseInt(args.iterations || "10", 10)
        if (iters < 1) iters = 1
        if (iters > 50) iters = 50
        let lat = []
        let t00 = Date.now()
        for (let i = 0; i < iters; i++) {
            let t0 = Date.now()
            try { e.app.findRecordsByFilter("issues", "", "-created", 10, 0) } catch (x) {}
            lat.push(Date.now() - t0)
        }
        lat.sort(function(a, b) { return a - b })
        let sum = 0
        for (let l of lat) sum += l
        let avg = Math.round((sum / lat.length) * 100) / 100
        return { success: true, iterations: iters, avg_latency_ms: avg, p50_ms: lat[Math.floor(lat.length * 0.5)], p95_ms: lat[Math.floor(lat.length * 0.95)], total_time_ms: Date.now() - t00, rating: avg < 10 ? "ultra_fast" : "good" }
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
        else if (toolName === "search_workspace_knowledge") { result = searchWorkspaceKnowledge(args) }
        else if (toolName === "detect_workspace_blockers") { result = detectWorkspaceBlockers(args) }
        else if (toolName === "generate_sprint_retrospective") { result = generateSprintRetrospective(args) }
        else if (toolName === "export_federation_bundle") { result = exportFederationBundle(args) }
        else if (toolName === "import_federation_bundle") { result = importFederationBundle(args) }
        else if (toolName === "get_agent_analytics") { result = getAgentAnalytics(args) }
        else if (toolName === "detect_workflow_anomalies") { result = detectWorkflowAnomalies(args) }
        else if (toolName === "link_git_commit") { result = linkGitCommit(args) }
        else if (toolName === "link_git_pr") { result = linkGitPr(args) }
        else if (toolName === "get_issue_git_artifacts") { result = getIssueGitArtifacts(args) }
        else if (toolName === "stage_code_patch") { result = stageCodePatch(args) }
        else if (toolName === "process_git_webhook") { result = processGitWebhook(args) }
        else if (toolName === "get_project_git_status") { result = getProjectGitStatus(args) }
        else if (toolName === "get_agent_workload_status") { result = getAgentWorkloadStatus(args) }
        else if (toolName === "calculate_autoscale_recommendations") { result = calculateAutoscaleRecommendations(args) }
        else if (toolName === "reserve_agent_capacity") { result = reserveAgentCapacity(args) }
        else if (toolName === "release_agent_capacity") { result = releaseAgentCapacity(args) }
        else if (toolName === "run_workflow_self_heal") { result = runWorkflowSelfHeal(args) }
        else if (toolName === "get_live_benchmarks") { result = getLiveBenchmarks(args) }
        else { return fail(-32602, "Unknown tool: " + toolName) }
        return ok({ content: [{ type: "text", text: JSON.stringify(result) }] })
    } catch (toolErr) {
        return fail(-32000, toolErr.message || String(toolErr))
    }
})
