# ProjectBase – Candidate Roadmap (Epics)

**Current Cycle:** 4
**Focus:** Build-First Verification

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
- [x] MCP server (`app/pb_hooks/91_mcp_server.pb.js`): `list_projects`, `list_issues`, `create_issue`, `update_issue`, `move_issue`
- [x] AgentsView UI component (`pb_public/js/components/AgentsView.js`)
- [x] Agent dispatch endpoint (`app/pb_hooks/80_agent_triggers.pb.js`)
- [x] Agent discovery bridge (`app/pb_hooks/90_agents.pb.js`)

## Epic 5 – Import/Export (✅ Done)
- Linear, Plane, GitHub importers
- CSV/JSON export

## Epic 6 – Notifications (✅ Done)
- In-app notifications
- Email (optional)

## Epic 7 – Performance & Polish (🔨 In Progress)
- [x] Performance indexes (migrations `1710000008` + `1710000021`)
- [ ] Frontend keyboard shortcuts
- [ ] UI polish (dark/light theme consistency, responsive)
- [ ] Load benchmarking (cold start, memory under load)

---

## Next Milestone (Cycle 5)
**Complete Epic 7 – Performance & Polish**

- Frontend keyboard shortcuts (`n` new issue, `e` edit, `d` delete, `Esc` close drawer)
- UI polish (dark/light theme consistency, responsive)
- Load benchmarking (cold start < 100 ms, < 100 MB RAM)
