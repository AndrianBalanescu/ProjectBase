# ProjectBase — Agent Rules & Technical Map

ProjectBase = execution-native AI agent orchestration and software engineering workspace. Ultra-lightweight open-source Plane/Linear alternative. **MIT, 100% FOSS, self-hostable. Never add monetization, subscriptions, Stripe, or paid tiers.** ~50 MB RAM, single binary, zero-build frontend, real-time SSE, SQLite. Live app: `http://127.0.0.1:8120` (v1.0.0).

## Technical stack & how to run

- **Backend:** PocketBase **0.39.11** single binary `./pocketbase` at repo root. Serve with `./pocketbase serve --dir pb_data --hooksDir app/pb_hooks --migrationsDir app/pb_migrations --http 127.0.0.1:8120`. Note: PB data dir is `pb_data/` at root for local run, but Docker mounts `./app/pb_data` — keep both consistent.
- **Frontend:** Zero-build **Vue 3 UMD** + static Tailwind. All served straight from `app/pb_public/`. No `node_modules`, no bundler.
- **Styling:** Tailwind is **compiled to static CSS** via `scripts/build_css.sh` → `app/pb_public/css/style.css`. After editing templates/classes, rerun it. Do NOT add a runtime Tailwind CDN.
- **Tests:** `pytest tests/` (run via `uv run --with pytest pytest tests/` or the pytest binary at `/home/ubuntu/.local/bin/pytest`). Tests run against the live instance (default `PROJECTBASE_URL=http://127.0.0.1:8120`, superuser `f@flow.com` / `superdev123`). 401 tests across 28 files.
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
    32_issue_relations.pb.js   <- /api/projectbase/issues/{id}/relations (blocks/blocked_by/related)
    35_custom_fields.pb.js     <- per-project custom field validation
    40_importers.pb.js / 41_linear_importer.pb.js / 42_plane_importer.pb.js / 45_github_importer.pb.js  <- CSV + Linear + Plane + GitHub importers
    50_cron_automation.pb.js   <- scheduled automations
    55_notifications.pb.js / 60_notifications.pb.js  <- Telegram/Discord/webhook + in-app inbox
    70_ai_assist.pb.js / 80_agent_triggers.pb.js      <- AI-assisted actions + agent dispatch
    90_agents.pb.js / 91_mcp_server.pb.js / 92_agent_collaboration.pb.js / 93_swarm_choreography_dag.pb.js / 94_workspace_synthesis.pb.js / 95_federation_analytics.pb.js / 96_git_workspace_engine.pb.js / 97_autoscale_workload_engine.pb.js / 98_cluster_replication_engine.pb.js / 99_webhook_automation_engine.pb.js / 100_sdk_observability_engine.pb.js / 101_consensus_gate_engine.pb.js / 102_sso_rbac_engine.pb.js / 103_workflow_automations_engine.pb.js / 104_multi_tenant_quota_engine.pb.js / 105_auto_heal_pipeline.pb.js / 106_semantic_brain_engine.pb.js / 107_session_ingestion_engine.pb.js
  pb_migrations/       <- numbered schema + seed migrations (17100000xx). Add NEW number for changes.
  pb_data/             <- runtime SQLite data. NEVER commit.
docs/                  <- research, ROADMAP, TODO, architecture, COMPETITORS, FEATURE_MATRIX
scripts/               <- start.sh, build_css.sh, backup.sh, restore.sh, install-systemd.sh, deploy-demo.sh,
                          reset-demo.sh, bump_version.sh, typegen.sh, flow-cli (CLI wrapper), pb-cli,
                          mcp_server.py, pb_autonomous_runner.py, pb-autonomous-daemon.sh, install.sh, qa/, bench/
tests/                 <- 401 tests across 28 files (test_agents_drift_guard.py, test_api.py, test_auto_heal_pipeline.py, test_autonomous_runner_sync.py, test_autoscale_orchestration.py, test_benchmarks.py, test_bulk_actions.py, test_cluster_replication.py, test_consensus_gates.py, test_css_sync.py, test_deploy_consistency.py, test_federation_analytics.py, test_fixture_hygiene.py, test_foss_schema.py, test_git_workspace_engine.py, test_issue_relations.py, test_multi_tenant_quotas.py, test_openapi_drift.py, test_sdk_observability.py, test_secret_scan.py, test_selfhosting.py, test_semantic_brain.py, test_session_ingestion_engine.py, test_sso_rbac_matrix.py, test_swarm_dag.py, test_webhook_automation.py, test_workflow_automations.py, test_workspace_synthesis.py)
deploy/                <- projectbase.service, Caddyfile
.github/workflows/ci.yml  <- CI (seeds superuser, runs tests)
```

## 3. Data model (PocketBase collections)

`users` (auth) · `projects` (multi-project, `custom_field_defs`) · `issues` (status, priority, estimate, project rel, assignee, subtasks JSON, milestone) · `cycles` (sprints + burndown) · `milestones` (North Star roadmap) · `labels` · `comments` · `activity` (audit log) · `notifications` (in-app inbox) · `workflow_rules` · `workflow_runs` · `tenants` · `tenant_quotas` · `semantic_embeddings` · `semantic_admission_policies` · `semantic_review_audit`.

## 4. Custom API & MCP

- Custom routes in `app/pb_hooks/30_custom_routes.pb.js`, `103_workflow_automations_engine.pb.js`, `104_multi_tenant_quota_engine.pb.js`, `106_semantic_brain_engine.pb.js`: `/api/projectbase/health`, `/version`, `/stats`, `/semantic/review`, `/semantic/rerank`, `/semantic/metrics`, `/semantic/embeddings/reindex`.
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
3. **Verify Mechanically:**
   - Backend: `uv run --with pytest pytest tests/` — all tests must pass.
   - Frontend/UI: `scripts/qa/qa-render.sh` (or `flow-ibrowse.sh`) with 0 console errors and 0 DOM overflow.
4. **Commit & Push:** Make ONE consolidated, descriptive commit per functional unit and push to `origin main`.
5. **Session Ingestion:** The daemon and hooks automatically attach the git commit and test verdict to the ProjectBase board.

## 7. Working rules

- **Before editing:** inspect `git status`; read relevant README/docs; preserve unrelated work.
- **Frontend:** keep `pb_public` zero-build; vendor browser-ready FOSS builds under `app/pb_public/vendor/`; rerun `build_css.sh` after template/class edits.
- **Backend:** enforce validation/authorization in hooks/migrations. Additive migrations only. Never commit secrets or local data (`pb_data/`).
- **One Clean Session Commit:** Consolidate code + tests + docs into a single clean commit. Never push broken or unverified code.
