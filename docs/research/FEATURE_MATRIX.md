# ProjectBase — Feature Matrix (Cycle 1)

Must-Have = table stakes vs Linear/Plane. Moat = differentiators nobody in the leader set ships. Status grounded in the repo at commit `c2d3b08` + cycle-1 audit.

## Must-Have (table stakes)

| Feature | Linear | Plane CE | ProjectBase | Status |
|---|---|---|---|---|
| Kanban drag-drop | ✅ | ✅ | ✅ SortableJS + SSE sync | ✅ shipped |
| List view | ✅ | ✅ | ✅ | ✅ shipped |
| Multi-project workspaces | ✅ | ✅ | ✅ (LOAD/IBR/PB/HOME seeded) | ✅ shipped |
| Sprints / cycles | ✅ | ✅ | ✅ cycles + burndown | ✅ shipped |
| Subtasks / relationships | ✅ | ✅ | ✅ subtasks + markdown drawer + blocks/blocked_by/related (reciprocal mirroring, kanban blocked badges, REST + FastMCP) | ✅ shipped (cycle 40) |
| Labels & priorities | ✅ | ✅ | ✅ | ✅ shipped |
| Multi-user auth + roles | ✅ | ✅ | ✅ auth gate, admin/manager roles, hardened rules | ✅ shipped (cycle-1 audit: rules verified) |
| Real-time updates | ✅ | ✅ | ✅ SSE | ✅ shipped |
| File attachments | ✅ | ✅ | ✅ FileField | ✅ shipped |
| REST API | ✅ | ✅ | ✅ auto REST + OpenAPI 3.1/Scalar | ✅ shipped |
| Keyboard-first UX | ✅ | ⚠️ partial | ✅ CommandPalette + shortcuts | ✅ shipped |
| Batch multi-select + bulk actions | ✅ | ⚠️ partial | ✅ board + list checkboxes, select-all, Esc clear, **Shift+click range selection (board column order + list sort order)**, floating status/priority/cycle bar + bulk delete (REST, admin/manager-gated delete) | ✅ shipped (cycle 16 + 17) |
| Importers (Linear/Plane/GitHub) | export only | partial | ✅ CSV + GitHub API importers | ✅ shipped |
| Notifications | ✅ | ✅ | ✅ Discord/Telegram/webhook + in-app inbox (assigned/mention/comment/status/priority), unread badge, mark-read, recipient-scoped rules | ✅ shipped |
| Roadmap view | ✅ | ✅ | ✅ milestones + North Star + progress, assign issues to milestones in create/edit drawer | ✅ shipped |
| Timeline / Gantt | ✅ | ✅ | ✅ day-grid schedule of cycles, milestones & issues (`issues.start_date` + due dates), status-colored bars, click-to-open, header/palette/keyboard/route wiring | ✅ shipped (cycle 19) |
| Custom fields | ✅ | paid tier | ✅ text/number/select/checkbox/date, per-project, validation, MCP/OpenAPI/llms docs | ✅ shipped |
| Offline / local-first | ❌ | ❌ | ✅ Service Worker app shell: pre-cached static shell, network-first API w/ cache fallback, PWA manifest, online/offline banner | ✅ shipped (cycle 18) |
| Self-host one-command | ❌ | Docker compose | ✅ `systemd` unit + `scripts/install-systemd.sh`, hardened (NoNewPrivileges, ProtectSystem/Home, PrivateTmp) | ✅ shipped (cycle 19) |
| Backup & restore | partial | Docker volumes | ✅ `scripts/backup.sh` + `scripts/restore.sh` (online via PB backups API; offline w/ auto-rollback) | ✅ shipped (cycle 19) |

## Moat (differentiators)

| Moat feature | Status | Why it wins |
|---|---|---|
| Single binary, ~16 MB RAM | ✅ shipped | Plane CE needs ~2.7 GB + Docker matrix; ProjectBase runs on a Raspberry Pi |
| MIT license | ✅ shipped | Plane/Taiga AGPL blocks commercial embedding |
| Zero-build, CDN-independent frontend | ✅ shipped (vendored bundles, verified by tests) | Air-gapped/self-host friendly; instant deploys |
| `llms.txt` + OpenAPI for agents | ✅ shipped | Agent-discoverable API — unique in the set |
| FastMCP server | ✅ shipped | Claude/agent-native task ops; Linear has no MCP |
| AI copilot (subtasks, PRD enhance) | ✅ shipped | Bring-your-own-gateway (OmniRoute/OpenAI-compatible) |
| Autonomous flow daemon + agent dispatch | ✅ shipped | Self-driving sprint execution |
| Built-in cron automation hooks | ✅ shipped | No external scheduler needed |

## Cycle-1 verdict

Table-stakes coverage is unusually high for a young project; the three real gaps are
**keyboard UX, importers, custom fields**. The moat (footprint, license, agent surface)
is already defensible. Next cycles: close importer gap first (it converts angry Linear
migrants — the loudest audience), then keyboard command palette.
