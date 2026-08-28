# ProjectBase – Candidate Roadmap (Epics)

**Current Cycle:** 8
**Focus:** Production Benchmarking & FastMCP Tool Parity

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

---

## Next Milestone (Cycle 9)
**Epic 9 – Real-Time Multi-Agent Collaboration & SSE Stream Telemetry**
- Live agent reasoning & tool invocation streaming in Kanban cards
- Multi-agent collision avoidance on shared tasks
- Webhook subscriptions for external orchestrator triggers
