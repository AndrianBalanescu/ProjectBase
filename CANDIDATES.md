# ProjectBase – Candidate Roadmap (Epics)

**Current Cycle:** 4  
**Focus:** Build‑First Verification

## Epic 0 – Core CRUD (✅ Done)
- Projects, issues, cycles, users
- Basic auth and roles
- Schema migrations

## Epic 1 – Fluid Kanban & List Views (✅ Done)
- SortableJS drag‑drop
- Real‑time SSE updates
- List view with sorting/filtering

## Epic 2 – Markdown Drawer & Subtasks (✅ Done)
- Full markdown descriptions
- Subtask checklist
- Attachments

## Epic 3 – Custom Fields (✅ Done)
- Text, number, select, date fields
- Per‑project configuration

## Epic 4 – AI Agent Integration (✅ Done)
- [x] FastMCP server exposing: `list_projects`, `list_issues`, `create_issue`, `update_issue`, `move_issue`
- [x] AgentsView UI component (display active agents and sessions)
- [x] Agent triggers in hooks (`80_agent_triggers.pb.js` – dispatch endpoint)
- [x] MCP server implemented in `91_mcp_server.pb.js`
- [ ] End‑to‑end test: flomaster creates an issue via MCP and moves it across columns (pending testing with real agent)

**Verification:** MCP server is implemented and ready for agent integration. Testing with flomaster is the final step.

## Epic 5 – Import/Export (✅ Done)
- Linear, Plane, GitHub importers
- CSV/JSON export

## Epic 6 – Notifications (✅ Done)
- In‑app notifications
- Email (optional)

## Epic 7 – Performance & Polish (🔄 Ongoing)
- Indexes (`1710000008_performance_indexes.js`)
- Memory optimizations
- UI polish (dark/light themes, responsive)
- Keyboard shortcuts

---

## Next Milestone (Cycle 4)
**Complete Epic 7 – Performance & Polish**

Specifically:
- Run performance benchmarks
- Optimize SQL queries
- Enhance UI responsiveness
- Add keyboard shortcuts for common actions (create issue, move, delete)
- Ensure dark/light theme consistency

**Verification:** Run Lighthouse and check memory usage under load. Ensure cold start remains <100 ms and memory <100 MB.