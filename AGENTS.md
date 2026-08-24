# ProjectBase — Agent Rules & Technical Map

ProjectBase = ultra-lightweight open-source Plane/Linear alternative. **MIT, 100% FOSS, self-hostable. Never add monetization, subscriptions, Stripe, or paid tiers.** ~16 MB RAM, single binary, zero-build frontend, real-time SSE, SQLite. Live app: `http://127.0.0.1:8120` (v0.9.0).

## Technical stack & how to run

- **Backend:** PocketBase **0.39.11** single binary `./pocketbase` at repo root. Serve with `./pocketbase serve --dir pb_data --hooksDir app/pb_hooks --migrationsDir app/pb_migrations --http 127.0.0.1:8120`. Note: PB data dir is `pb_data/` at root for local run, but Docker mounts `./app/pb_data` — keep both consistent.
- **Frontend:** Zero-build **Vue 3 UMD** + static Tailwind. All served straight from `app/pb_public/`. No `node_modules`, no bundler.
- **Styling:** Tailwind is **compiled to static CSS** via `scripts/build_css.sh` → `app/pb_public/css/style.css`. After editing templates/classes, rerun it. Do NOT add a runtime Tailwind CDN.
- **Tests:** `pytest tests/` (pytest binary at `~/.local/bin/pytest`; NOT in repo venv). Tests run against the live instance (default `PROJECTBASE_URL=http://127.0.0.1:8120`, superuser `f@flow.com` / `superdev123`). 125 tests across 5 files.
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
                           ProjectsView, CyclesView, MilestonesView, StatsView, DocsView, MarketplaceView,
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
    35_custom_fields.pb.js     <- per-project custom field validation
    40_importers.pb.js / 45_github_importer.pb.js  <- CSV + GitHub importers
    50_cron_automation.pb.js   <- scheduled automations
    55_notifications.pb.js / 60_notifications.pb.js  <- Telegram/Discord/webhook + in-app inbox
    70_ai_assist.pb.js / 80_agent_triggers.pb.js      <- AI-assisted actions + agent dispatch
  pb_migrations/       <- numbered schema + seed migrations (17100000xx). Add NEW number for changes.
  pb_data/             <- runtime SQLite data. NEVER commit.
docs/                  <- research, ROADMAP, TODO, architecture, COMPETITORS, FEATURE_MATRIX
scripts/               <- start.sh, build_css.sh, backup.sh, restore.sh, install-systemd.sh, deploy-demo.sh,
                          reset-demo.sh, bump_version.sh, flow-cli (CLI wrapper), pb-cli, mcp_server.py,
                          pb_autonomous_runner.py, pb-autonomous-daemon.sh, flow-cli, install.sh
tests/                 <- test_api.py, test_selfhosting.py, test_autonomous_runner_sync.py, test_foss_schema.py, test_css_sync.py (CSS/template drift guard)
deploy/                <- projectbase.service, Caddyfile
.github/workflows/ci.yml  <- CI (seeds superuser, runs tests)
```

## 3. Data model (PocketBase collections)

`users` (auth) · `projects` (multi-project, `custom_field_defs`) · `issues` (status, priority, estimate, project rel, assignee, subtasks JSON, milestone) · `cycles` (sprints + burndown) · `milestones` (North Star roadmap) · `labels` · `comments` · `activity` (audit log) · `notifications` (in-app inbox: recipient, issue, type, read).

## 4. Custom API & MCP

- Custom routes in `app/pb_hooks/30_custom_routes.pb.js`: `/api/projectbase/health`, `/version`, `/stats`, `/quick-task`.
- **FastMCP server:** `scripts/mcp_server.py` (tools for projectbase issues/projects). Use `mcp__projectbase__*` tools to pick/move/mark issues.
- API docs: `app/pb_public/openapi.json` + `docs/` (Scalar UI at `app/pb_public/docs/`).

## 5. Client routing (hash-based)

`app/pb_public/js/app.js` `applyRoute()` parses `#/pb/board`, `#/pb/list`, `#/pb/cycles`, `#/pb/projects/.../issue/<id>` etc. It sets `currentProject`/`currentView` and **reloads project-scoped issues on project change** (a hard refresh on `#/pb/board` must show that project's tasks, not the all-projects snapshot).

## 6. Working rules

- **Before editing:** inspect `git status`; read relevant README/docs; preserve unrelated work.
- **Frontend:** keep zero-build PocketBase serving; vendor browser-ready FOSS bundles under `app/pb_public/vendor/`; preserve Markdown descriptions; rerun `build_css.sh` after template/class edits.
- **Backend:** enforce validation/authorization in hooks/migrations. Additive migrations only. Never commit secrets or local data (`pb_data/`).
- **Validate:** run `python ~/.local/bin/pytest tests/` (or `uv run --with pytest pytest tests/`), run iBrowse QA for UI/frontend changes (`bash /home/ubuntu/flow/scripts/qa/flow-ibrowse.sh http://127.0.0.1:8120/`); if the iBrowse host is unreachable, fall back to `scripts/qa/qa-render.sh` (headless render + computed-style assertions), verify zero console errors, check health `http://127.0.0.1:8120`, inspect diff/status/root layout.
- **Docs:** research and plans in `docs/`; no loose root artifacts.
- **Kanban & MCP:** use `mcp__projectbase__*` or API (`:8120`) to pick active issues, move to `in_progress`, mark `done` with audit comments.
- **Commit & push:** ONE commit per work session, consolidating code + tests + docs + .gitignore together. Never open a new commit for a follow-up tweak/wording fix/doc note — fold it into the in-progress commit. If you already made several small commits, `git reset --soft` back and re-commit as one. **Push to origin at the end of the cycle when the work is real** (added/changed code or tests) and all checks pass. Do NOT push if the cycle produced only doc/roadmap/TODO/feature-matrix/.gitignore churn — fold that in with real work or leave it uncommitted. Never push broken/red work.
- **No doc-only churn:** NEVER create a commit containing only docs/roadmap/TODO/feature-matrix markers or .gitignore edits. A commit that adds no code and no test is a mistake — fold it in or drop it.
- **Done:** report what shipped, test count, and anything requiring human decision.
