# ProjectBase Charter

**Mission:** Build the world's fastest, zero-friction open-source Linear & Plane alternative — powered by PocketBase, SQLite, a zero-build Vue 3 frontend, Sortable drag-and-drop Kanban, and autonomous AI agent dispatch.

**Why:** Existing tools are either too heavy (Plane CE > 2.7 GB RAM), too slow to start, or closed. ProjectBase runs as a single binary on ~50 MB RAM, cold-starts in under 100 ms, and treats AI agents as first-class board members.

**For Whom:** Solo developers, small teams, and AI-first workflows that want Linear-grade speed, fully self-hosted, with no node_modules and no build step.

**How We Win:**
- **Simplicity** — one binary, zero build frontend, instant SQLite.
- **Performance** — cold start < 100 ms, ~50 MB RAM idle.
- **AI-Native** — a built-in MCP server plus agent dispatch hooks; agents create, move, and query issues like any teammate.
- **Fluid UX** — drag-and-drop, inline editing, real-time SSE updates.
- **Open Source** — MIT, contributions welcome.

**Success Criteria:**
- [x] MCP server exposing `list_projects`, `list_issues`, `create_issue`, `update_issue`, `move_issue`
- [x] Agent dispatch endpoint (`/api/projectbase/dispatch-agent`) and native chat view (`AgentsView`)
- [ ] Documented end-to-end agent run: create issue → move across columns via MCP
- [ ] Cold start < 100 ms and < 100 MB RAM under load
- [ ] Self-hosting + agent-integration docs
