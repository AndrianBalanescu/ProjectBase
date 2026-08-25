# Changelog

All notable changes to **ProjectBase** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

ProjectBase is **100% free and open-source (MIT)**. It never adds monetization,
subscriptions, Stripe, or paid tiers.

## [Unreleased]

### Added
- **Self-hosting deployment-consistency guard (harden)**: new
  `tests/test_deploy_consistency.py` statically locks the four deploy surfaces
  — `Dockerfile`, `docker-compose.yml`, `deploy/projectbase.service` (systemd
  template), `scripts/start.sh`, `Makefile`, and `deploy/Caddyfile` — to the
  SAME public dir, hooks dir, migrations dir, data dir, and listen port. This
  is the guard for the documented `pb_data` vs `app/pb_data` data-dir trap in
  AGENTS.md (local run serves `--dir pb_data` from the repo root while the
  containerized stack serves `--dir /app/app/pb_data`); if an edit drifts one
  surface to a different data dir or port, CI fails instead of shipping a
  demo that boots into a stale/empty database or points the Caddy reverse
  proxy at the wrong port. Also documented and verified the full Docker
  fresh-boot path (build, compose up, superuser seed, health) manually this
  cycle.
- **Secret/hardcoded-credential regression guard (harden)**: new
  `tests/test_secret_scan.py` scans every tracked source file for live-looking
  API keys, auth tokens, private keys, and long base64 secret assignments
  (excluding vendored bundles, binary assets, and archived research dumps),
  and asserts the QA scripts read `IBROWSE_API_KEY` from the environment. This
  is the guard that would have caught the cycle-12 P1 credential leak before
  merge. The GitHub repo is also restored to PRIVATE (publishing is a human
  decision).
- **Portfolio Dashboard realtime refresh (v1.1 feature 5 follow-up)**: the
  Portfolio Dashboard now stays live. Previously it fetched its workspace
  snapshot only on mount, so creating/updating/deleting an issue, milestone,
  project, or cycle elsewhere in the app left the dashboard stale until a
  reload. The shell now bumps a `realtimeTick` counter on every SSE event for
  those workspace-scoped collections and passes it down as a prop; the view
  watches it and debounces a single refetch (400 ms) so a burst of events
  triggers exactly one refresh. Because SSE delivery can be missed (PB-56),
  the tick is also bumped on the optimistic create/update/delete/bulk paths
  the shell performs in place (which would otherwise not change the prop
  reference), and the view watches the `issues`/`milestones` props as a
  belt-and-suspenders path — so the portfolio stays live in both the
  SSE-delivered and SSE-missed cases. Verified by an extended pytest
  drift-guard test and a render-QA E2E that creates an issue via the actual
  NewIssueModal and asserts the portfolio "Total Issues" KPI increments with
  no navigation or reload.
- **Portfolio Dashboard (v1.1 feature 5)**: a cross-project workspace overview
  at `#/pb/portfolio` aggregating every project, issue and milestone. KPI cards
  (total issues, completion %, in-flight/open work, estimate load), a
  per-project progress list with color completion bars (clicking a row opens
  that project's board), and a milestones & roadmap-health panel that surfaces
  upcoming/overdue targets. It fetches its own workspace snapshot
  (`getIssues(null)` + `getMilestones(null)`) so it stays accurate regardless
  of the project the shell currently scopes to. Wired via a header nav button,
  command palette action, keyboard shortcut `9`, and the `#/pb/portfolio` hash
  route (both viewMaps); the Service Worker precache was bumped to shell-v3 to
  cover the new asset. Verified by a new pytest wiring/drift-guard test and a
  render-QA E2E (view mounts, project rows render, shortcut works). Achieved
  milestones are treated as complete (100%, never overdue), matching the
  MilestonesView convention. Also fixes a pre-existing deep-link gap: a shared
  hash opened before login (e.g. `#/pb/portfolio`) now lands on that view after
  sign-in instead of falling back to the board (`applyRoute()` re-applied after
  auth in signIn/signUp).
- **Timeline / Gantt view (v1.1 feature 4)**: a scrollable day-grid schedule
  of cycles (start→end bars), milestones (target-date markers) and issues
  (start→due bars, status-colored). New additive `issues.start_date` field
  (migration 1710000018) so issues get a real start date; the create modal,
  issue drawer, and bulk-update route all accept `start_date` (whitelisted +
  validated). The view is registered in the header nav, command palette
  (Timeline), keyboard shortcut `4` (views re-slotted: board 1, list 2, cycles
  3, timeline 4, projects 5, stats 6, docs 7, marketplace 8), and hash route
  `#/pb/timeline`. Clicking an issue bar opens its drawer. OpenAPI + llms.txt
  agent-surface docs updated with `start_date`. Verified by 3 new pytest cases
  (roundtrip, bulk update + validation, frontend wiring) and a new render-QA
  E2E (view mounts, dated issue bar renders, bar click opens drawer, keyboard
  shortcut works).
- **Bulk custom-field editing (v1.1 feature 3)**: the bulk multi-select bar now
  renders a per-project Custom-field picker when the active project defines
  custom fields (text / number / select / checkbox / date). Choosing a field
  reveals the matching value control, and "Apply" sends a partial
  `custom_fields` payload to the existing `/api/projectbase/issues/bulk-update`
  route. Fixes a latent backend bug where custom-field bulk updates were either
  silent no-ops (phantom `custom_*` column keys) or wholesale-replaced the
  entire `custom_fields` object, dropping unrelated values. Bulk updates now
  **merge** into each record's `custom_fields` JSON (a `null`/`''` value clears
  that single key), and the optimistic local apply mirrors that merge — a
  `null`/`''`/empty value removes the key locally too, so the acting user's UI
  never shows a stale empty value before realtime confirms it. Verified by two
  new pytest cases (partial merge + validation) and a new render-QA E2E that
  creates a temp issue with custom values, applies a number field through the
  bulk-bar picker, and proves unrelated custom fields survive.
- **Shift+click range selection (v1.1 feature 2)**: after anchoring with a
  selection toggle, Shift+clicking a later card/row selects every issue in
  between (Linear-style). Works on the board (column-by-column visible order)
  and the list view (current sort order), in both directions, as a union with
  the current selection. The selection anchor (`lastSelectedIssueId`) is
  tracked in the root app, resets with Esc / project switch, and is pruned if
  the anchor record is deleted via realtime. No new API surface; verified by a
  new 15-assertion render-QA range suite: board anchor, forward range, checked
  count, no drawer on shift+click, Esc clear, cross-column span, list
  forward/reverse, plus a full E2E that creates 3 temp issues, range-selects
  them, applies status `todo` through the bulk bar, verifies all 3 moved via
  API, and proves the temp issues are deleted (DELETE 204s).
- **Batch multi-select + bulk actions (v1.1 feature 1)**: board cards and list
  rows now expose a selection checkbox (plus Cmd/Ctrl+click to toggle without
  opening the drawer). A floating action bar applies status / priority / cycle
  changes or deletes to every selected issue in one request. Backend:
  `app/pb_hooks/31_bulk_actions.pb.js` adds
  `POST /api/projectbase/issues/bulk-update` and
  `POST /api/projectbase/issues/bulk-delete` (up to 500 ids per call,
  per-record hooks + realtime SSE preserved; delete gated to admin/manager,
  mirroring the issues deleteRule). Frontend: selection state lifted into the
  root app (`selectedIssueIds`), board + list wiring, Esc to clear, list
  select-all. Docs: OpenAPI + llms.txt/llms-full.txt agent surface updated.
  19 new regression tests (`tests/test_bulk_actions.py`).

- **Agent-surface OpenAPI coverage**: `openapi.json` now documents every
  implemented `/api/projectbase/*` custom route so autonomous agents discover
  the full surface. Newly added: `/projectbase/version`, `/projectbase/import/csv`,
  `/projectbase/import/github`, `/projectbase/notifications/read-all`,
  `/projectbase/ai-assist`, and `/projectbase/dispatch-agent`, plus tags for
  Importers, Notifications, AI Assist, and Agent Dispatch. `test_openapi_spec_valid`
  now asserts all 12 custom routes are present to prevent future drift.
- **Global cross-project sort index**: migration `1710000017` adds
  `idx_issues_created` on `issues (created DESC)`, giving the worst-case
  cross-project `sort=-created` query a covering index. Measured p50 for that
  query at 10k issues dropped from **62.5 ms → 45.1 ms** (p95 64.9 → 47.6 ms
  on this host; the p95 spread is noise on a shared box). Every project-scoped
  UI view was already single-digit ms and is unchanged.

### Fixed
- **Docs bookkeeping (cycle-12, from inspect audit)**: corrected the stale
  test-count in the cycle-10 ROADMAP section (145/145 → 146/146, matching the
  actual committed suite) and referenced PB-62 in the cycle-11 ROADMAP section
  so the tracked backlog and the shipped-prose stay consistent.
- **Realtime cycles & comments sync**: the realtime handler in `app.js`
  subscribed to `cycles` and `comments` events (via `api.js`) but never handled
  them, so cycle changes and new comments from other users did not update the
  UI in real-time. The handler now updates the local `cycles` list on
  create/update/delete and bumps a `commentRefreshKey` that the open
  `IssueDrawer` watches to reload its comment thread live.
- **Create-issue list sync (PB-56)**: creating an issue in the UI now adds it
  to the board/list immediately instead of depending on the SSE realtime event,
  which could be missed when the stream was not yet connected (the new item
  previously only appeared after a manual refresh). `handleCreateIssue` in
  `app.js` now unshifts the created record into the local list with the same
  duplicate guard as the realtime handler.
- Version consistency: the UI header badge (`Header.js`) now shows `v0.9.0`
  instead of the stale `v0.8.0`, and `scripts/bump_version.sh` now keeps the
  header badge and the custom-routes health/version endpoints in sync on every
  bump (previously only `VERSION` and `openapi.json` were updated).

## [0.9.0] - 2026-08-24

### Added
- **Published benchmarks** (v1.0 build order item 3/4): reproducible stdlib
  harness `scripts/bench/bench.py` (isolated scratch instance, never the live
  one) + published results in `docs/BENCHMARKS.md` with raw JSON in
  `docs/research/bench/`. Headline: 50 MB idle / 98 MB at 10k issues,
  36–96 ms cold start, 2.0 ms p50 board query at 10k issues; Plane CE cited at
  4 GB min RAM / 13 containers (vendor docs).
- **Distraction-free description focus mode** (v1.0 build order item 2/4): a
  "Focus" button in the drawer's Description header opens a fullscreen overlay
  (z-60) with a centered max-w-3xl editor, Rich/Raw/Preview tabs, AI Enhance
  PRD, and a Done button; Esc saves & exits.
- **URL deep-link state** (v1.0 build order item 1/4): filters (`?q=`,
  `?priority=`, `?cycle=`), Cycles view tab (`?cycle=`), and drawer width
  (`?w=`) as shareable hash state that round-trips through the router.

### Fixed
- **P0 — long-form text limits**: raised `description` and related long-form
  text limits to 100000 so focus mode / long PRDs no longer truncate.
- **P0 — AI Enhance PRD**: the auth token is now sent to the `ai-assist`
  endpoint so AI Enhance works from the focus mode.
- **P0 — focus mode editor**: auto-focus the Milkdown editor when focus mode
  opens; guard the `getMarkdown` call in the `modelValue` watcher; Esc in focus
  mode exits focus instead of the whole drawer.

## [0.8.0] - 2026-08-23

### Added
- **Offline-first app shell**: Service Worker (`sw.js`) pre-caches the complete
  static app shell; static assets served cache-first with background refresh,
  `/api/*` + navigations network-first with a cached-shell fallback. PWA web
  manifest + app icons for installability.
- **Self-hosting lifecycle**: hardened systemd unit (`deploy/projectbase.service`),
  idempotent installer (`scripts/install-systemd.sh`), live backup
  (`scripts/backup.sh`) and restore (`scripts/restore.sh`, online + offline
  modes).
- **One-command public demo deployment**: `scripts/deploy-demo.sh` (docker
  compose build+up, superuser seed, health + fresh-boot-seed verification,
  optional `--install-docker` and `--domain` for Caddy automatic-HTTPS) and
  `scripts/reset-demo.sh` (restores the pristine demo workspace).
- **In-app notifications**: `notifications` collection + header bell + inbox so
  users see "someone assigned you / mentioned you / commented on your issue"
  without leaving the app. External-channel notifications (Discord/Telegram/
  webhook) shipped earlier.
- **Milestone assignment on issues**: `NewIssueModal` + `IssueDrawer` milestone
  selectors; Roadmap view moved from `partial` to `shipped` in the feature
  matrix.
- **Blocked indicator in List view**: lock badge + red left-border row
  highlight for issues with a `blocked_by` edge, matching the kanban cards.

### Fixed
- **P1 — privilege guard was silently dead**: a module-scope helper
  (`_isPrivileged`) was not resolvable inside Goja hook callbacks, so every
  invocation threw `ReferenceError` and the catch forced `member`
  unconditionally. Inlined the logic and replaced the `!req.admin` superuser
  test with a correct `auth.collection().name === "_superusers"` check.
- **P0 — member self-service role escalation**: `users.updateRule` allowed a
  member to PATCH their own `role` to `admin`. The update guard now freezes the
  role to its current stored value on any self-service update.
- **P0 — fresh-boot seed bug**: moved the demo seed from an `onBootstrap` hook
  to a migration so a stranger's very first boot seeds correctly (no
  `sql: no rows in result set`).

## [0.7.0] - 2026-08-22

### Added
- **Secure public self-signup**: `users.createRule = ""` (public
  self-registration) with a privilege-escalation guard that forces every new
  user record to `role = 'member'` and freezes the role on self-service
  updates. Login gate now has a "Create a free account" toggle.
- **Custom fields**: per-project custom field definitions with validation and
  agent-surface docs (OpenAPI / llms / FastMCP).
- **Importers**: Linear (CSV/JSON), GitHub issues, and Plane export importers
  as pb_hooks routes + UI drawer. GitHub importer is idempotent (keyed by
  `source_key = "gh:{number}"`) and rate-limit-resilient.
- **Keyboard command palette** scaffold.
- **Resizable issue drawer**: drag handle + clamped width (420-1600px),
  localStorage persistence, double-click reset.
- **Clickable project cards**: whole card is `role="button"`, click + Enter
  opens board, star/delete stop propagation.
- **Multiselect component**: labels, assignees, custom select fields.
- **AI Copilot**: native AI-assisted PRD enhancement, subtask generation, and
  sprint summaries.
- **Multi-channel notifications**: Discord, Telegram, and webhook dispatchers.
- **Autonomous agent dispatch**: FastMCP server + custom API for agent
  workflows.

### Fixed
- **P0 — cross-tenant isolation**: locked down `users` list/view/update/delete
  rules so a member cannot list, view, or update other users.
- **P0 — privilege minting**: no actor can mint a privileged account through
  the public create endpoint (every create is coerced to `member`).

## [0.6.0] - 2026-08-22

### Added
- **Multi-user auth gate** with safe bootstrap credentials and agent dispatch
  UI.
- **Milestones & North Star roadmap** UI.
- **OpenAPI 3.1 + Scalar API UI** + `llms.txt` discovery + in-app Docs view.
- **FileField attachments** and built-in cron engine hook.
- **Standalone flow CLI** tool.

## [0.5.0] - 2026-08-22

### Added
- **Initial open-source release**: zero-build Vue 3 + Tailwind frontend,
  PocketBase backend, real-time SSE, FastMCP server, Dockerfile +
  docker-compose + Makefile, MIT license, polished README.

---

## Versioning

- `VERSION` file at repo root is the single source of truth.
- `scripts/bump_version.sh` increments semver (`patch`/`minor`/`major` or an
  explicit version) and keeps `VERSION`, `openapi.json`, the UI header badge,
  and the custom-routes health/version endpoints in sync.
- `app/pb_hooks/30_custom_routes.pb.js` exposes `/api/projectbase/version`.

[Unreleased]: https://github.com/AndrianBalanescu/ProjectBase/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.9.0
[0.8.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.8.0
[0.7.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.7.0
[0.6.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.6.0
[0.5.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.5.0
