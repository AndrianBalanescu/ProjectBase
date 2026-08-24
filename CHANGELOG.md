# Changelog

All notable changes to **ProjectBase** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

ProjectBase is **100% free and open-source (MIT)**. It never adds monetization,
subscriptions, Stripe, or paid tiers.

## [Unreleased]

### Added
- **Secret / hardcoded-credential regression guard**: new `tests/test_secret_scan.py`
  scans every git-tracked source file for live-secret patterns (API keys,
  auth tokens, private keys, hardcoded credentials) and fails CI if any is
  found. This is the regression guard that would have caught the cycle-12 P1
  credential leak (a hardcoded iBrowse `sk_live_` key in the QA scripts) before
  it ever reached `origin/main`. Vendored bundles and raw archived research
  dumps are excluded. No whitelist: the documented seeded demo superuser
  (`superdev123`) is deliberately not exempted, because it matches none of the
  secret patterns on its own and an exemption could mask a real key co-located
  with the demo credential on one line. Includes a mutation-proven check that
  the two QA scripts read `IBROWSE_API_KEY` from the environment rather than a
  literal.
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
