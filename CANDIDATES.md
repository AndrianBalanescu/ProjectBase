# ProjectBase – Candidate Roadmap (Epics)

**Current Cycle:** 10
**Focus:** Autonomous Agent Swarm Choreography, Task Graph DAG Execution, Persona Roles & Validation Checkpoints

## Epic 0 – Core CRUD (✅ Done)
- Projects, issues, cycles, users
- Basic auth and roles
- Schema migrations

## Epic 1 – Fluid Kanban & List Views (✅ Done)
- SortableJS drag-and-drop
- Real-time SSE updates
- List view with sorting/filtering

## Epic 2 – Markdown Drawer & Subtasks (✅ Done)
- Full markdown descriptions
- Subtask checklist
- Attachments

## Epic 3 – Custom Fields (✅ Done)
- Text, number, select, date fields
- Per-project configuration

## Epic 4 – AI Agent Integration (✅ Done)
- [x] FastMCP server (`app/pb_hooks/91_mcp_server.pb.js`): `list_projects`, `list_issues`, `get_issue`, `create_issue`, `update_issue`, `move_issue`, `add_comment`, `list_cycles`, `list_milestones`, `search_issues`, `dispatch_agent`, `get_stats`
- [x] AgentsView UI component (`pb_public/js/components/AgentsView.js`)
- [x] Agent dispatch endpoint (`app/pb_hooks/80_agent_triggers.pb.js`)
- [x] Agent discovery bridge (`app/pb_hooks/90_agents.pb.js`)

## Epic 5 – Import/Export (✅ Done)
- Linear, Plane, GitHub importers
- CSV/JSON export

## Epic 6 – Notifications (✅ Done)
- In-app notifications
- Email (optional)

## Epic 7 – Performance & Polish (✅ Done)
- [x] Performance indexes (migrations `1710000008` + `1710000021`)
- [x] Frontend keyboard shortcuts (`n`/`c` new issue, `e` export, `i` import, `1`-`8` views, `Esc` close)
- [x] OpenAPI drift repair & FastMCP HTTP JSON-RPC 2.0 specification (`/projectbase/mcp`)
- [x] Frontend render & data cache hardening (`loadAllData` project instance synchronization)
- [x] Headless render DOM QA validation (0 failures, 100% pass)

## Epic 8 – Production Benchmarking & Multi-Host Packaging (✅ Done)
- [x] FastMCP server expanded with `get_issue`, `add_comment`, `list_cycles`, `list_milestones`, `search_issues`, `dispatch_agent`, and full Kanban status support (`backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled`)
- [x] Cold-start & memory load benchmarking (warm cold start 51.8 ms, idle RSS 53.9 MB, loaded RSS 56.4 MB)
- [x] Automated agent workflow benchmark harness (`scripts/bench/agent_workflow_bench.py`) & CI test (`tests/test_benchmarks.py`)
- [x] Verified FastMCP JSON-RPC 2.0 endpoint suite (`tests/test_api.py`)

## Epic 9 – Real-Time Multi-Agent Collaboration & SSE Stream Telemetry (✅ Done)
- [x] Multi-agent task lease/lock mutual exclusion to prevent collision on concurrent issue execution (`/api/projectbase/leases/acquire`, `renew`, `release`, `task_leases` collection with TTL expiration)
- [x] FastMCP collaboration tools (`acquire_task_lease`, `release_task_lease`, `renew_task_lease`, `get_task_lease`, `log_agent_telemetry`, `register_webhook`, `list_webhooks`, `delete_webhook`)
- [x] Real-time agent activity & reasoning trace telemetry ingestion (`/api/projectbase/telemetry`)
- [x] Outbound event webhooks subscription engine & HTTP event dispatcher for external orchestrators (Hermes, Windmill, Flomaster swarm coordinator)
- [x] 238/238 automated tests passing across 13 test suites

## Epic 10 – Autonomous Agent Swarm Choreography & Task Graph Decomposition (✅ Done)
- [x] Multi-step parent/child issue task graph DAG execution with Kahn's algorithm cycle rejection (`/api/projectbase/dag/decompose`, `/api/projectbase/dag/status`, `/api/projectbase/dag/step`)
- [x] Dynamic subtask splitting and assignment across specialized agent personas (`/api/projectbase/tasks/split`, `task_persona` and `parent_issue` fields)
- [x] Automated peer-review and validation checkpoints before issue completion (`/api/projectbase/checkpoints/submit`, `/api/projectbase/checkpoints`, `task_checkpoints` collection)
- [x] FastMCP JSON-RPC 2.0 & Python client tools (`decompose_task_graph`, `get_dag_status`, `execute_dag_step`, `split_subtasks`, `submit_validation_checkpoint`, `get_validation_checkpoints`)
- [x] 245/245 automated tests passing across 14 test suites with warm cold-start at 51.8 ms

## Epic 11 – Autonomous Workspace Synthesis & Cross-Project Knowledge Retrieval (✅ Done)
- [x] Vector-free SQLite FTS5 / tokenized semantic workspace indexing across issues, comments, checkpoints, and telemetry (`/api/projectbase/workspace/search`)
- [x] Dynamic cross-project blocker detection, circular deadlock warnings, and critical path analysis (`/api/projectbase/workspace/blockers`)
- [x] Automated sprint/cycle retrospective generation and agent productivity metrics (`/api/projectbase/workspace/retrospective`)
- [x] FastMCP collaboration tools (`workspace_search`, `get_workspace_blockers`, `generate_retrospective`)
- [x] 258/258 automated tests passing across 15 test suites with 100% headless DOM QA pass

---

## Epic 12 – Advanced Multi-Host Federation, Real-Time Agent Stream UI & Autonomous Anomaly Detection Engine (✅ Done)
- [x] Multi-instance / cross-workspace project sync & federation bridge with SHA-256 data integrity checksums (`/api/projectbase/federation/export`, `/api/projectbase/federation/import`, `/api/projectbase/federation/sync`)
- [x] Resilient conflict resolution strategies (`merge`, `overwrite`, `skip_existing`) with foreign-key re-mapping for distributed nodes
- [x] Diagnostic anomaly detection engine scanning for dead agent leases, rapid failure loops, circular deadlocks, and starvation (`/api/projectbase/analytics/anomalies`)
- [x] One-click and automated remediation (`auto_heal=true`) to revoke expired locks and escalate stalled items
- [x] Real-time agent persona throughput analytics (MTTC in minutes, checkpoint pass rates %, velocity forecast) (`/api/projectbase/analytics/throughput`)
- [x] FastMCP JSON-RPC 2.0 tools (`export_federation_bundle`, `import_federation_bundle`, `get_agent_analytics`, `detect_workflow_anomalies`)
- [x] Frontend AgentsView tabs for live chat, workflow health diagnostics, persona throughput metrics, and federation sync
- [x] 270/270 automated tests passing across 16 test suites with 100% frontend guard

---

## Epic 13 – Autonomous Agent Code Sandbox, Git Artifact Workspace Engine & Webhook Auto-Triage (✅ Done)
- [x] Git Artifacts Tracking Engine (`/api/projectbase/git/artifacts`, `/api/projectbase/git/status`) for branches, commit SHAs, PR states, CI workflow runs, and unified diff patches
- [x] Autonomous Kanban Stage Transitions: active branch -> `in_progress`, open PR -> `in_review`, merged PR -> `done` with auto-sync
- [x] Staged Code Patch Sandbox (`POST /api/projectbase/git/patch`, `GET /api/projectbase/git/patch/{id}`) for unified diff inspection and syntax-styled metrics
- [x] Universal Git Webhook Receiver (`POST /api/projectbase/webhooks/git`) with case-insensitive GitHub/GitLab headers and regex-free issue token triage
- [x] FastMCP JSON-RPC 2.0 tools (`link_git_commit`, `link_git_pr`, `get_issue_git_artifacts`, `stage_code_patch`, `process_git_webhook`, `get_project_git_status`)
- [x] Frontend IssueDrawer **🌿 Git & Code** panel with 1-click copy `git checkout`, PR status chips, commit diff stats, and visual branch/PR indicators in Kanban/List
- [x] 283/283 automated tests passing across 17 test suites with 100% headless DOM QA and frontend guard pass
 verification

---

## Next Milestone (Cycle 14)
**Epic 13 – Autonomous Continuous Benchmarking & High-Concurrency Multi-Tenant Federation**
- High-concurrency load testing & SQLite WAL contention mitigation under multi-agent pressure
- Dynamic agent autoscaling triggers based on real-time backlog depth and throughput velocity
- Automated schema migration verification across federated peer nodes
