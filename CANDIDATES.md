# ProjectBase – Candidate Roadmap (Epics)

**Current Cycle:** 9
**Focus:** Real-Time Multi-Agent Collaboration, Task Leases, Collision Avoidance, Webhooks & Telemetry

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

---

## Next Milestone (Cycle 10)
**Epic 10 – Autonomous Agent Swarm Choreography & Task Graph Decomposition**
- Multi-step parent/child issue task graph DAG execution
- Dynamic subtask splitting and assignment across specialized agent personas
- Automated peer-review and validation checkpoints before issue completion
