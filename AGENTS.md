# ProjectBase — Agent Rules & Technical Map

ProjectBase = ultra-lightweight open-source Plane/Linear alternative. High-performance task manager & workspace for humans and autonomous AI agents. **MIT, 100% FOSS, self-hostable. Never add monetization, subscriptions, Stripe, or paid tiers.** ~50 MB RAM, single binary, zero-build frontend, real-time SSE, SQLite. Live app: `http://127.0.0.1:8120` (v0.2.0).

## 🛑 STRICT PRODUCT BOUNDARIES (NO FEATURE CREEP)
- **What ProjectBase IS:** A clean, fast, beautiful Linear/Plane alternative — Kanban Board, List View, Cycles (sprints), Milestones (roadmap), Projects, and resizable Markdown Issue Drawer. Real local agent sessions are ingested cleanly as execution runs without forcing agents into secretarial ticket updates.
- **What ProjectBase is NOT:** No fake cloud billing (no USD calculators), no AST security red-team scanners, no incident 5-Whys war rooms, no benchmark leaderboards. Keep the codebase clean, lean, and grounded in real homelab infrastructure.

## Technical stack & how to run

- **Backend:** PocketBase **0.39.11** single binary `./pocketbase` at repo root. Serve with `./pocketbase serve --dir pb_data --hooksDir app/pb_hooks --migrationsDir app/pb_migrations --http 127.0.0.1:8120`. Note: PB data dir is `pb_data/` at root for local run, but Docker mounts `./app/pb_data` — keep both consistent.
- **Frontend:** Zero-build **Vue 3 UMD** + static Tailwind. All served straight from `app/pb_public/`. No `node_modules`, no bundler.
- **Styling:** Tailwind is **compiled to static CSS** via `scripts/build_css.sh` → `app/pb_public/css/style.css`. After editing templates/classes, rerun it. Do NOT add a runtime Tailwind CDN.
- **Tests:** `pytest tests/` (run via `uv run --with pytest pytest tests/` or a user-local pytest install (e.g. `~/.local/bin/pytest` via `pip install --user pytest`)). Tests run against the live instance (default `PROJECTBASE_URL=http://127.0.0.1:8120`, superuser `f@flow.com` / `superdev123`). 315 tests across 26 files.
- **Docker:** `docker compose up` — builds `Dockerfile`, mounts `app/` subdirs, exposes 8120.
- **Deploy:** `deploy/projectbase.service` (systemd) + `deploy/Caddyfile`. Helper scripts: `scripts/install-systemd.sh`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/deploy-demo.sh`, `scripts/reset-demo.sh`.

## Directory map (everything you need, no searching)

```
app/
  pb_public/            <- frontend (zero-build, served as-is)
    index.html          <- app shell; registers SW + manifest, has hash router
    sw.js               <- Service Worker: pre-caches static shell, offline-first, never intercept /_/ admin
    manifest.webmanifest, vendor/icon-{192,512}.png  <- PWA
    css/style.css       <- compiled Tailwind (regenerate via build_css.sh)
    js/api.js           <- API client (PocketBase + custom routes + realtime)
    js/app.js           <- root Vue instance: auth gate, hash router, loadAllData, realtime, keyboard
    js/components/      <- Vue components: KanbanBoard, ListView, IssueDrawer, Header, NewIssueModal,
                           TimelineView (Gantt), DocsView (read-only repo markdown viewer),
                           ProjectsView, CyclesView, MilestonesView, AgentsView,
                           MilkdownEditor (WYSIWYG), SearchableSelect, Multiselect, CommandPalette,
                           CustomFieldsModal, ImportModal, ProjectModal, CycleModal
    vendor/             <- vendored FOSS bundles: vue.global.prod.js, tailwindcss.js, pocketbase.umd.js,
                           sortable.min.js, lucide.js, marked.min.js, purify.min.js, milkdown(.css),
                           confetti.min.js
    docs/               <- Scalar UI + openapi.json, llms.txt, llms-full.txt (agent-facing docs)
    openapi.json, manifest.webmanifest, sw.js
  pb_hooks/             <- PocketBase backend logic (onRecordCreate/Update, routerAdd)
    15_signup_security.pb.js   <- signup hardening
    20_issue_hooks.pb.js       <- auto issue_number/identifier + activity audit
    30_custom_routes.pb.js     <- /api/projectbase/* custom routes (health, version, stats, quick-task)
    31_bulk_actions.pb.js      <- /api/projectbase/issues/bulk-update + bulk-delete (multi-select)
    32_issue_relations.pb.js   <- /api/projectbase/issues/{id}/relations (blocks/blocked_by/related)
    35_custom_fields.pb.js     <- per-project custom field validation
    40_importers.pb.js / 41_linear_importer.pb.js / 42_plane_importer.pb.js / 45_github_importer.pb.js  <- CSV + Linear + Plane + GitHub importers
    50_cron_automation.pb.js   <- scheduled automations
    55_notifications.pb.js / 60_notifications.pb.js  <- Telegram/Discord/webhook + in-app inbox
    90_agents.pb.js            <- agent sessions listing + sync
    82_session_chat.pb.js      <- per-run session detail + operator chat route (Sessions console chat box)
    (engine hooks 91-111 stripped; preserved on the engine-experiments branch + archive/* tags)
  pb_migrations/       <- numbered schema + seed migrations (17100000xx). Add NEW number for changes.
  pb_data/             <- runtime SQLite data. NEVER commit.
docs/                  <- research, ROADMAP, TODO, architecture, COMPETITORS, FEATURE_MATRIX, RESTORING_VIEWS.md
scripts/               <- start.sh, build_css.sh, backup.sh, restore.sh, install-systemd.sh, deploy-demo.sh,
                          reset-demo.sh, bump_version.sh, typegen.sh, flow-cli (CLI wrapper), pb-cli,
                          mcp_server.py, pb_autonomous_runner.py, pb-autonomous-daemon.sh, install.sh, qa/, bench/, sync_docs.sh
tests/                 <- 315 tests across 26 files (test_agents_drift_guard.py, test_api.py, test_autonomous_runner_sync.py, test_benchmarks.py, test_bulk_actions.py, test_css_sync.py, test_custom_route_auth_guards.py, test_deploy_consistency.py, test_docs_mirror.py, test_export_ics.py, test_fixture_hygiene.py, test_foss_schema.py, test_git_webhook_hmac.py, test_issue_relations.py, test_kanban_touch_dnd.py, test_labels_ui.py, test_listview_sort_logic.py, test_openapi_drift.py, test_public_seed.py, test_saved_views.py, test_secret_scan.py, test_selfhosting.py, test_session_attachments.py, test_session_chat.py, test_shell_consistency.py, test_supply_chain.py)
deploy/                <- projectbase.service, Caddyfile
.github/workflows/ci.yml  <- CI (seeds superuser, runs tests)
```

## 3. Data model (PocketBase collections)

`users` (auth) · `projects` (multi-project, `custom_field_defs`) · `issues` (status, priority, estimate, project rel, assignee, subtasks JSON, milestone) · `cycles` (sprints + burndown) · `milestones` (North Star roadmap) · `labels` · `comments` · `activity` (audit log) · `notifications` (in-app inbox) · `workflow_rules` · `workflow_runs` · `tenants` · `tenant_quotas` · `semantic_embeddings` · `semantic_admission_policies` · `semantic_review_audit` · `agent_sessions` · `session_attachments` · `session_audits` · `session_interventions` · `session_trajectories` · `swarm_clusters` · `session_merges` · `merge_conflicts`.

## 4. Custom API & MCP

- Core custom routes live in `app/pb_hooks/30_custom_routes.pb.js` and the focused import/export, relations, notification, saved-view, and session hooks. Public discovery endpoints include `/api/projectbase/health`, `/version`, `/docs`, and `/openapi.json`.
- **Route auth contract:** every mutating `/api/projectbase/*` custom route requires an authenticated principal, except `POST /api/projectbase/health` (public liveness), public SDK/doc reads, and `POST /api/projectbase/webhooks/git` (CI receiver: auth OR `X-Hub-Signature-256` HMAC over the raw body keyed by `PROJECTBASE_GIT_WEBHOOK_SECRET`, fail-closed when unset). Pinned by `tests/test_custom_route_auth_guards.py` + `tests/test_git_webhook_hmac.py`.
- **FastMCP server:** `scripts/mcp_server.py` (optional tools for projectbase programmatic queries).
- API docs: `app/pb_public/openapi.json` + `docs/` (Scalar UI at `app/pb_public/docs/`).

## 5. Client routing (hash-based)

`app/pb_public/js/app.js` `applyRoute()` parses `#/pb/board`, `#/pb/list`, `#/pb/cycles`, `#/pb/projects/.../issue/<id>` etc. It sets `currentProject`/`currentView` and reloads project-scoped issues on project change.

## 6. Execution-Native Architecture: Session-as-a-Card

ProjectBase operates on the **Session-as-a-Card** principle:
- **No Secretarial Overhead:** Autonomous coding agents do NOT waste context or tokens managing Kanban columns, subtasks, or synthetic status comments.
- **The Session IS the Execution Run:** Every active agent session (Flomaster / Flow Builder / Hermes) is automatically captured, displaying real-time PID state, touched files, git diffs, and test results.
- **Ground Truth Over Text Stories:** Completion is proven by **git commits + passing test suites + sceptic audit**, not synthetic descriptions.

### 6.1 Coding & Verification Cycle

1. **Pick Objective:** Identify the target milestone or epic from `docs/ROADMAP.md` or high-level project Intent.
2. **Execute Cleanly:** Write clean code, migrations, or frontend templates.
3. **Verify Mechanically (Mandatory Dual-Gate):**
   - **Backend API:** `uv run --with pytest pytest tests/` (or `/home/ubuntu/.local/bin/pytest`) — all tests must pass 100%.
   - **Frontend UI/UX Sceptic Audit:** Execute `/ibrowse-test` via `scripts/qa/qa-render.sh 8120` or homelab iBrowse.
     - **0 Console Errors** & **0 Page Exceptions**.
     - **0 px Horizontal Overflow** across Desktop (1440px), Tablet (768px), and Mobile (375px).
     - Full interactive verification: drag-and-drop Kanban, resizable drawers, fullscreen editors, command palette (`Cmd+K`), dark/light themes, and real-time live run updates.
     - Keyboard shortcuts guide has a dedicated E2E: `NODE_PATH=/home/ubuntu/.hermes/hermes-agent/node_modules node scripts/qa/verify_shortcuts_modal.js` (opens via real `?` key, all close/reopen paths, C-guard while open).
     - **iBrowse URL pitfall (cycle 67):** iBrowse runs containerized, so never pass `http://127.0.0.1:<port>` to `flow-ibrowse.sh` — that is the container's loopback (connection refused). Use the host LAN IP `http://192.168.1.161:8120/` (proven reachable from the ibrowse container) or `http://172.17.0.1:8120/` (docker0).
     - Capture concrete numerical evidence and visual proof.
4. **Commit & Push:** Make ONE consolidated, descriptive commit per functional unit and push to `origin main`.
5. **Session Ingestion:** The daemon and hooks automatically attach the git commit, test verdict, and iBrowse audit report to the ProjectBase board.

## 7. Working rules

- **Before editing:** inspect `git status`; read relevant README/docs; preserve unrelated work.
- **Frontend:** keep `pb_public` zero-build; vendor browser-ready FOSS builds under `app/pb_public/vendor/`; rerun `build_css.sh` after template/class edits.
- **Backend:** enforce validation/authorization in hooks/migrations. Additive migrations only. Never commit secrets or local data (`pb_data/`).
- **One Clean Session Commit:** Consolidate code + tests + docs into a single clean commit. Never push broken or unverified code.
