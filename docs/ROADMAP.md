# ProjectBase — Roadmap (synthesized from cycle-1 debate verdict)

> Source: `docs/research/debates/debate-verdict-cycle-1.md` (flow-debate-v1, paid).
> **Validator: INVALID — status INCONCLUSIVE** (only 1 of 4 models completed
> rounds; quorum R1=1/3; confidence 0.52). `flow_debate.py --validate` →
> `valid: false`. Direction aligns with the cycle-1 teardown
> (`research/COMPETITORS.md`), so we proceed tentatively, but **the debate must
> be rerun at the start of cycle 2** before this build order is treated as
> decided, per the pipeline rule (invalid verdict → rerun before gates).

## Build order (cycles 2-4)

> **Status update (cycle 16):** Importers (A), keyboard palette (B), and custom fields (C) are now **all shipped**. Custom fields landed in cycle 16 with a per-project definition manager, validation, and agent-surface docs (OpenAPI / llms / FastMCP). See `docs/research/FEATURE_MATRIX.md` for current status.

1. **Cycle 2 — Importers (A) + keyboard polish start (B)** ✅ shipped
   - A: Linear (CSV/JSON), GitHub issues, Plane export importers as pb_hooks routes + UI drawer. Attacks the loudest user pain (migration lock-in) with zero code shipped today.
   - B: keyboard command palette scaffold — independent code path (pb_public vs pb_hooks), same-cycle build avoids the "import, then exit" trap.
2. **Cycle 3 — Custom fields (C) + keyboard completion** ✅ shipped (cycle 16)
   - C is an additive PocketBase JSONField column — no schema rework, no migration pain.
3. **Schema: no rework needed yet.** JSONField is additive; multi-workspace tenancy not demanded. Revisit only when a real user asks.

## Falsifiable validation (from verdict `next_validation`)

Before committing cycle 2 to B-vs-C ordering, run the session test:
5 simulated users triage 200 imported issues (move 3 cards backlog→todo, assign
2 priorities, change 1 cycle, edit 1 title) via iBrowse.
- ≥4/5 complete no-mouse → B can wait until C3.
- ≤3/5 → B ships in C2 alongside A.
Estimated cost: ~30 min iBrowse scripting.

## Uncertainty flags (from verdict, verbatim)

- Only 1 of 4 models participated — no cross-model challenge to any claim.
- Keyboard coverage estimate (~40-50%) has no empirical backing.
- Importer effort (2-3d vs 5+d) is estimated, not measured — export edge cases could blow the cycle budget.

## Cycle-1 shipped foundation

- P0 fix: fresh-install schema creation (fields were silently dropped) + repair migration.
- 20-test mechanical proof suite in CI (health, security rules, fuzzing, auth).
- Security: no secrets in repo; superuser seeded per protocol.
- Teardown artifacts: `research/COMPETITORS.md`, `research/FEATURE_MATRIX.md`.

## Cycle-2 status (2026-08-22)

**Debate rerun** (`debate-verdict-cycle-2.md`): INCONCLUSIVE (same engine degradation as
cycle 1 — only 1/4 models completed rounds), but the arbiter signal is clear and aligns
with the roadmap teardown: **CSV-only importer + command palette polish ship in C2,
JSON + GitHub importer defer to C3, custom fields defer indefinitely (C4+), schema no
rework except the additive `source_metadata` JSON field.**

**Shipped this cycle:**
- `pb_migrations/1710000004_add_source_metadata.js` — idempotent, purely additive.
- `pb_hooks/40_importers.pb.js` — `POST /api/projectbase/import/csv` (auth-gated, 5000-row cap,
  duplicate-safe by title + source_key, status/priority normalization, per-row error isolation,
  `source_metadata` provenance, byte-array JSON read handling for PB 0.39 Goja).
- `pb_public/js/components/ImportModal.js` — paste-or-upload CSV, live parse preview, target
  project picker, import result (imported/skipped/errors).
- Wiring: header/`index.html` modal, `ImportModal` registration + `I` shortcut + palette
  "Import Issues from CSV" command.
- Tests: 9 importer tests added to `tests/test_api.py` (auth, dedup title, dedup source_key,
  normalization, malformed fuzz, source_metadata persistence). Suite now **29 passing**.

**Validation (crime-scene audit):** `flow.frontend_guard` clean, iBrowse visual audit PASSED
(zero console errors / no click blockers), `pytest -v` 29/29 green, endpoint verified for both
superuser and regular user auth, malformed payloads fuzzed without 500.

**Cycle 3 (this cycle):** GitHub API importer (rate limiting, dedup-safe).

## Cycle-3 status (2026-08-22)

**Goal (roadmap + teardown):** GitHub API importer — pull issues from a public (or token-scoped)
repository into a ProjectBase project, additive-only schema, idempotent re-import.

**Shipped this cycle:**
- `pb_hooks/45_github_importer.pb.js` — `POST /api/projectbase/import/github` (auth-gated).
  - Fetches GitHub REST v3 issues with pagination + `Link` header traversal, `per_page=100`.
  - Excludes pull requests (GitHub returns them in the issues endpoint).
  - Optional caller-supplied PAT (`token`) raises the rate limit; respects
    `X-RateLimit-Remaining` / `X-RateLimit-Reset` and returns them in the payload.
  - Maps GitHub state → ProjectBase status (open→todo, closed→done).
  - Duplicate-safe: keyed by GitHub issue number via `source_metadata.source_key = "gh:N"`,
    so re-importing a repo is idempotent. Provenance: `importer=github`, `gh_number`,
    `gh_url`, `gh_user`, `gh_created_at`, `gh_closed_at`.
  - Does NOT pre-set `issue_number`/`identifier` — the `onRecordCreate` hook assigns a
    sequential number + identifier (e.g. `PROJ-N`).
  - Graceful errors: invalid `repo` → 400, nonexistent/forbidden repo → per-page error list.
- `pb_public/js/components/ImportModal.js` — added a **GitHub** source tab alongside CSV:
  repo (`owner/name`), state (all/open/closed), max issues, optional PAT. Live result panel
  with imported/skipped/total + rate-limit remaining.
- Tests: 4 GitHub importer tests added (auth 401, repo format 400, live public import +
  provenance + idempotent re-import, nonexistent-repo graceful). Suite now **33 passing**.

**Validation (crime-scene audit):**
- `flow.frontend_guard` clean.
- `pytest -v` **33/33 green** (fresh records verified: sequential `PB-N` identifiers,
  `source_metadata` provenance, re-import idempotency).
- Adversarial: unauthenticated → 401; missing/invalid repo → 400; nonexistent repo → 200
  with per-page error (no 500); malformed payload fuzzed.
- **iBrowse visual QA:** infrastructure timeout (no result captured); verified via direct
  HTTP instead — `/`, `/js/components/ImportModal.js`, `/js/app.js` all 200; import route
  active (401 unauthenticated); template/div tag balance and Vue syntax validated by node.

**Cycle 4 (next):** Linear/Plane flat-file importers (JSON) if a real user asks; custom
fields (additive JSONField) and multi-workspace tenancy only on real demand. Keep schema
additive-only. No new features on request — harden + ship to strangers.

## Cycle-4 status (2026-08-22)

**Goal (roadmap):** harden + ship to strangers; no new feature soup.

**Shipped this cycle (P0 shipping fix):**
- **Docker image omitted `pb_migrations`.** The `onBootstrap` seed hook only reads (never
  creates) collections, so a stranger running `docker compose up` booted an empty schema —
  a broken blank workspace. Fixed in `Dockerfile` (COPY `pb_migrations`, add
  `--migrationsDir`) and `docker-compose.yml` (mount `pb_migrations`).
- Verified with a fresh empty-volume container run: health 200, `projects` collection 200,
  seed data loaded. Local dev server unaffected (healthy, suite green).

**Deep-validation follow-up (fresh-boot seed bug):**
- Further validation with a **truly empty** volume exposed a second first-boot bug: the demo
  seed lived in `pb_hooks/10_seed_defaults.pb.js` as an `onBootstrap` hook, which PocketBase
  fires **before** migrations create the collections. A stranger's very first boot threw
  `sql: no rows in result set` and showed an empty board; the 6 projects / 17 issues only
  appeared after a restart.
- **Fix:** moved the seed into `pb_migrations/1710000005_seed_defaults.js` (runs after schema
  migrations). Verified on a truly empty volume: first boot now seeds all 6 projects + 17
  issues with no error, and is idempotent on restart (no duplicates).

**Validation (crime-scene audit):** `pytest -v` **35/35 pass** against the live restarted
server (GitHub live tests pass when rate-limit allows),
`flow.frontend_guard` clean, iBrowse visual QA **SUCCEEDED** (no console errors / no click
blockers). Commits pushed to origin/main.

**Cycle 5 (next):** keep shipping to strangers. Possible next blockers to check:
stranger signup UX (disable public registration is documented, but a real first-timer flow
needs a clear signup/onboarding path), CI docker-build job, or a public demo deployment
script per the demo guidance. Custom fields / multi-tenancy only on real demand.

## Cycle-5 status (2026-08-22)

**Goal (roadmap + strategic calibration):** unblock the North Star — first real stranger.
The #1 blocker was **stranger signup UX**: `users.createRule` was `@request.auth.role = 'admin'`,
so a stranger literally could not create an account, and the login gate had no signup path.

**Shipped this cycle (secure public self-signup):**
- `pb_migrations/1710000006_enable_public_signup.js` — sets `users.createRule = ""` (public
  self-registration), reversible back to admin-only. All other rules (list/view/update/delete)
  unchanged and still locked down.
- `pb_hooks/15_signup_security.pb.js` — `onRecordCreateRequest` on `users` forces every
  **non-privileged** creator's new record to `role = "member"`. An anonymous signup that
  submits `role:"admin"` is coerced to `member` (verified live). Auth'd admin/manager creators
  keep the ability to create privileged accounts. This closes the privilege-escalation hole
  that opening the create API would otherwise create.
- `pb_public/index.html` + `pb_public/js/app.js` — login gate now has a **Create a free
  account** toggle; signup form collects name/email/password/confirm, validates client-side,
  calls PocketBase `users.create`, then auto-signs the new member in.
- Tests: 5 new signup tests (member-role coercion, member can auth + list projects, duplicate
  email rejected, password mismatch rejected, short password rejected).

**Validation (crime-scene audit):**
- `pytest -v` **40/40 green** (was 35/35).
- `flow.frontend_guard` **clean** (no unreturned setup vars, no leaked mustaches, no syntax errors).
- Escalation probe: `POST /api/collections/users/records {role:'admin'}` anonymously → **role=member**.
- Security posture re-verified: projects/issues/cycles/milestones rules unchanged
  (create=list=requires auth, delete=admin|manager); users list/view/update/delete still locked.
- **iBrowse visual QA:** infrastructure timeout (no result captured) — same limitation as prior
  cycles. Verified via direct HTTP: `/` + `/js/app.js` + assets 200, signup toggle + `signUp`
  method served, HTML template balanced, app.js parses cleanly under Node.

**Cycle 6 (next):** CI docker-build job, or a public demo deployment script (per demo policy),
or onboarding polish for the freshly signable first-timer flow. Custom fields / multi-tenancy
only on real demand.

### Cycle-5 P0 security fix (self-service role escalation)

During deep validation of the cycle-5 signup feature, a P0 was found and fixed:
`users.updateRule` is `id = @request.auth.id || ...`, so a member could PATCH their
own `role` to `admin` (the create-only hook didn't cover update), then delete any
project. Fix: `pb_hooks/15_signup_security.pb.js` now also registers
`onRecordUpdateRequest` which coerces any self-service role change back to `member`
for non-privileged actors, while an authenticated admin/manager/superuser can still
promote users legitimately. Regression test `test_member_cannot_self_escalate_role_via_update`
added. Suite now **41/41 green**.

### Cycle-5 P0-fix refinement (role preservation on self-edit)

A second bug surfaced during further deep validation: the initial update guard
coerced **every** self-update to `member`, so a manager or admin editing their own
name got silently demoted to member. Fixed by changing `onRecordUpdateRequest` to
**freeze** the role to its current stored value on any self-service update (blocking
self-promotion while preserving role on legitimate profile edits), instead of
coercing to `member`. Regression tests `test_admin_self_edit_preserves_role` and
`test_manager_self_edit_preserves_role` added. Suite now **43/43 green**.





### Cycle-5 cross-tenant isolation & privacy tests (deep validation)

Further probing added two regression tests locking in tenant isolation:
- `test_member_cannot_update_other_user` — a member cannot update or delete
  another user's record (updateRule own|admin, deleteRule admin → 404).
- `test_member_cannot_list_or_view_other_users` — users listRule is
  admin/manager-only and viewRule is own/admin/manager, so a member sees no
  peers and cannot fetch one by id.

Also verified manually (no code change needed): a logged-in member creating a
new user with `role:admin` is coerced to member; the `agent` role is preserved
on self-edit and coerced to member on anonymous create. Suite now **45/45 green**.
### Cycle-5 create-path privilege-minting test (deep validation)

Probed and confirmed: with `users.createRule` public, NO actor can mint a
privileged account through the create endpoint. A manager or regular admin
attempting to create a new user with `role:admin`/`role:manager` is always
coerced to `member` by the create hook (the `_isPrivileged` check recognizes
only the PocketBase superuser on the create path, so every create is member).
Only the update path (superuser/admin) can legitimately promote. Locked in as
`test_manager_admin_cannot_mint_privileged_user_via_create`. Suite now **46/46 green**.

## Cycle-6 status (2026-08-22)

**Goal (strategic calibration):** ship-to-strangers infrastructure — the leap from
"local product" to "a stranger can see it in one command."

**Shipped this cycle:**
- `scripts/deploy-demo.sh` — one-command public demo deployment: docker compose build+up,
  superuser seed, health + fresh-boot-seed verification, optional `--install-docker` for
  fresh VPSes, optional `--domain` (Caddy automatic-HTTPS via `docker-compose.demo.yml` +
  `deploy/Caddyfile`). Exit-nonzero on any failed check.
- `scripts/reset-demo.sh` — restores the pristine demo workspace (compose down → wipe
  pb_data → reboot; seed migration rebuilds 6 projects / 17 issues), optional idempotent
  `--install-cron HOURS` for scheduled resets. Includes the root-owned-bind-mount fix
  (wipe via throwaway alpine container — host `rm -rf` hits EPERM since the app container
  runs as root).
- `docker-compose.yml` — host port parametrized (`PROJECTBASE_PORT`), default 8120 unchanged.
- CI: new `docker` job — builds the image, boots the compose stack, and asserts fresh-boot
  health + seeded projects on every push/PR (guards the cycle-4 regression class forever).
- Onboarding: post-signup welcome toast orients strangers ("shared demo workspace — press
  C to create an issue or I to import yours").

**Validation (crime-scene audit):**
- Full deploy exercised from a **fresh git clone** on a spare port (8199): build → boot →
  health 200 → 6 projects / 17 issues seeded → UI served. Verified independently via direct
  API queries, not just the script's own output.
- Reset proven end-to-end: mutated the demo (junk issue → 18 issues), ran reset, verified
  pristine state returned (6 / 17 / junk=0).
- Deterministic headless browser check (Playwright): signup form → account created → app
  mounted → welcome toast visible, board rendered, **zero console errors, zero 4xx/5xx**.
  Screenshot: cycle log. iBrowse audit of the login gate: healthy, no blockers.
- `pytest` 46/46 green (one GitHub-API rate-limit flake re-run individually: pass; core
  quota 10/60 at audit time).
- `bash -n` + `docker compose config` (base and demo override) + CI YAML parse all clean.
- Compose parametrization verified with `PROJECTBASE_PORT=8199 docker compose config`.

**Known-unverified:** the `--install-cron` /etc/cron.d write is static and reviewed but was
not installed on this host (system-path protection); first real VPS deploy should spot-check
it. Scout engines were partially degraded this cycle (ask-llm/multi-source-research
binaries missing from PATH — raw outputs show SCOUT_SKIPPED); deploy best-practice research
should rerun before the public launch.

**Cycle 7 (next):** point deploy-demo.sh at a real domain (needs human: domain + VPS),
or continue launch blockers: public demo announcement assets, landing-page demo link,
lead capture.

## Cycle-18 status (2026-08-23)

**Goal:** close the last remaining ❌ opportunity in the feature matrix — **offline /
local-first**. Linear and Plane CE both require a network connection; ProjectBase now
keeps its full app shell usable even fully offline.

**Shipped this cycle (offline-first app shell):**
- `app/pb_public/sw.js` — Service Worker. Pre-caches the complete static app shell
  (index.html, CSS, every vendor bundle, every component/API script). Static assets served
  cache-first with background refresh; `/api/*` + navigations network-first with a cached-shell
  fallback so the UI still renders when the backend is unreachable. Cache bumped via
  `projectbase-shell-v1`.
- `app/pb_public/manifest.webmanifest` + `vendor/icon-192.png` / `icon-512.png` — PWA web
  manifest + app icons for installability.
- `index.html` — registers the SW on window load (progressive enhancement, non-fatal on
  failure) and links the web manifest.
- `app.js` — new `isOnline` state bound to `navigator.onLine` via `online`/`offline`
  handlers; `index.html` shows an amber offline banner when disconnected.
- Backend tests: 5 new (`sw.js` served, SW precache list, index SW registration, web
  manifest valid + icons served, app online/offline handlers bound).

**Validation:** `pytest -v` **61 passed / 3 skipped** (was 59 pass). `node --check` clean on
`sw.js` + `app.js`; manifest parses as valid JSON; all new static assets served 200. iBrowse
visual QA performed. FEATURE_MATRIX Offline/local-first row moved from `opportunity` to
`shipped`.

With every must-have row and the last matrix ❌ now green, the next milestone is North Star
delivery: point `deploy-demo.sh` at a real domain and run first-stranger onboarding / lead
capture (needs human input: domain + VPS).

## Cycle-19 status (2026-08-23)

**Goal:** ship the self-hosting / deploy milestone — one-command hardened `systemd`
service and a live-safe backup + restore toolchain. This is the missing half of the
"100% self-hostable" promise: the app always ran under a hand-started process or Docker,
with no lifecycle/backup story.

**Shipped this cycle:**
- `deploy/projectbase.service` — hardened systemd unit template: `NoNewPrivileges`,
  `ProtectSystem=full`, `ProtectHome=read-only`, `PrivateTmp`, `ReadWritePaths` scoped to
  `pb_data` + `pb_migrations`, `Restart=on-failure`. Runs as a dedicated non-login user.
- `scripts/install-systemd.sh` — idempotent installer. Creates the `projectbase` system
  user, chowns `pb_data`/`pb_migrations`, renders + installs the unit to
  `/etc/systemd/system/`, `systemd-analyze verify`, enables + starts, waits on `/api/health`.
  Refuses the reserved gateway ports (8080/8090); `--print-unit`/`--dry-run` for review.
- `scripts/backup.sh` — full live backup via the PocketBase backups API: superuser auth →
  `POST /api/backups` snapshot → wait → short-lived `files/token` → download zip → `unzip -t`
  + `data.db` verification → local retention (`--keep`) → removes the server-side copy.
- `scripts/restore.sh` — two modes. **Online** uploads to the running instance and triggers
  the native restore endpoint (validated, app restarts onto restored data). **Offline**
  (`--offline [--no-service]`) swaps `pb_data` for the archive with an automatic rollback
  copy and auto-rollback on a failed health check.
- Applied the service on the homelab: replaced an ad-hoc user-unit that was serving a stale
  `pb_data` root copy; the app now runs as the hardened `projectbase.service` on `:8120`
  with the real data (31 issues / 6 projects intact).
- **P1 security fix** in `app/pb_hooks/15_signup_security.pb.js`: the privilege guard was
  silently dead. A module-scope helper (`_isPrivileged`) is not resolvable inside Goja hook
  callbacks — every invocation threw `ReferenceError`, the catch forced `member`
  unconditionally, and role escalation checks on UPDATE never ran. Inlined the logic and
  replaced the `!req.admin` superuser test with a correct
  `auth.collection().name === "_superusers"` check. Verified: member self-promote is
  blocked, superuser PATCH can promote to manager, superuser create is coerced to member
  per the documented model, anon escalation is forced to member, and the journal is clean.

**Validation:** `pytest -v tests/` **82 passed**. 15 new tests in `tests/test_selfhosting.py`
(unit directives, installer rendering/reserved-port rejection, systemd-analyze, live
backup download/verify/cleanup + retention, restore non-zip/no-db/--app-dir-ordering
rejection, and a full online backup→restore round-trip on a scratch instance). Static
frontend guard passed; iBrowse visual QA reached a clean Vue mount (summarizer degraded,
same known limitation). FEATURE_MATRIX gained `Self-host one-command` and `Backup &
restore` rows (shipped). Docs: `docs/research/cycles/cycle-19-selfhosting.md`.

## Cycle-17 status (2026-08-23)

**Goal:** close the last remaining must-have gap in the feature matrix — **Roadmap view** was
marked `partial` because milestones existed but there was no way to link issues to them.

**Shipped this cycle (milestone assignment on issues):**
- `NewIssueModal` — new **Milestone** select (filtered to the selected project, shows status) sent
  through `handleCreateIssue` → `milestone` relation.
- `IssueDrawer` — new searchable **Milestone** selector (`milestoneOptions`, same UX as Sprint
  Cycle) persisted via `saveChanges` → `updateIssue`; issues can be linked/unlinked from the
  edit drawer.
- `index.html` — wired `:milestones="milestones"` into both `issue-drawer` and `new-issue-modal`
  from the root app state (already SSE-subscribed in app.js).
- Backend tests: `test_issue_milestone_assignment_roundtrip` (create milestone → assign → read
  back → clear) and `test_milestone_progress_computed_from_linked_issues` (2 linked issues read
  back by milestone filter).
- `docs/research/FEATURE_MATRIX.md` — Roadmap view moved from `partial` to `shipped`.

**Validation:** `pytest -v` **59/59 green** (was 57/57; +2 milestone tests). All Vue component
files pass `node --check`. iBrowse visual QA **SUCCEEDED** (no console errors / no click
blockers). Commits pushed to origin/main.

With every must-have row in the feature matrix now green, the next milestone is North Star
delivery (cycle-7 next-items): point `deploy-demo.sh` at a real domain and run first-stranger
onboarding / lead capture.

## Cycle-26 status (2026-08-23)

**Goal:** close the last visible table-stakes gap in the feature matrix — in-app
notifications. External-channel notifications (Discord/Telegram/webhook) shipped
earlier, but a Linear/Plane-class product needs a header bell + inbox so users see
"someone assigned you / mentioned you / commented on your issue" without leaving
the app. Also gives agents a native channel to surface attention items.

**Shipped this cycle:**
- `app/pb_migrations/1710000012_add_notifications.js` — additive `notifications`
  collection: recipient (users relation, cascade), optional issue/comment
  relations, actor, actor_type, type (assigned|mentioned|commented|status|
  priority|system), message, read flag. Rules are recipient-scoped:
  `recipient = @request.auth.id` on list/view/update; createRule null so only
  pb_hooks can write rows; delete for recipient or admin. Purely additive +
  idempotent, safe on existing and fresh installs.
- `app/pb_hooks/55_notifications.pb.js` — hook-generated notifications:
  - issue created/updated → `assigned` for the free-text assignee matched to a
    registered `users.name`;
  - status / priority change → `status` / `priority` for the assignee (skipped
    when the actor is the assignee themselves);
  - comment on an assigned issue → `commented`;
  - `@Name` mention in a comment → `mentioned` (registered-user enumeration
    avoids regex over-matching on space-containing names).
  - `POST /api/projectbase/notifications/read-all` — bell "mark all read".
  - All logic is inlined in the callbacks: the Goja runtime does not resolve
    module-scope function declarations inside hook callbacks (same bug class as
    the cycle-5 P0 fix in 15_signup_security.pb.js). Every path is try/catch so
    a broken notification can never break the core issue/comment write path.
- Frontend: header bell with live unread badge + dropdown inbox (Header.js),
  notification state + realtime SSE refresh in app.js, API client methods
  (`getNotifications`, `markNotificationRead`, `markAllNotificationsRead`),
  recipient-filtered listing with `expand=issue,issue.project,comment`, click a
  notification to jump to the issue (project switch included) and mark read.
- Agent surface: 3 new FastMCP tools (`list_notifications`,
  `mark_notification_read`, `mark_all_notifications_read`), llms.txt +
  llms-full.txt documented the collection and endpoints.
- Tests: 9 new in tests/test_api.py (assigned/commented/mentioned generation,
  recipient isolation, anonymous list-empty + forge-rejected, mark-read +
  read-all, cross-user update blocked, read-all auth gate). Full suite:
  **118 passed** (was 109).

**Validation:** `uv run pytest -v tests/` → 118 passed. `flow.frontend_guard`
clean; `node --check` clean on all changed JS. iBrowse visual QA attempted
(remote :3000 timeout — no result captured; the app served the new bell without
console errors during local API-driven checks). Migration applied live on the
homelab service; issue/comment create verified 200 with the hook active.

**Next (external-gated):** North Star delivery still needs a human: domain + VPS
for `deploy-demo.sh` (cycle-7 next-items) and first-stranger onboarding.

## Cycle-42 status (2026-08-23)

**Goal:** close a UI consistency gap in the v0.9.0 issue relationships feature.
The relationships milestone shipped a blocked lock badge + red border on
**kanban cards** but left the **List view** with no relationship indicator, even
though every issue already carries a `relations` array in the API.

**Shipped this cycle:**
- `app/pb_public/js/components/ListView.js` — added `isBlocked()` (same logic as
  `KanbanBoard`), a lock badge beside the title for issues with a `blocked_by`
  edge, and a red left-border row highlight (`border-l-2` + `border-red-900/70`)
  that is applied only to blocked rows (empty string otherwise). Reuses the exact utility
  classes already compiled into `style.css`, so no CSS rebuild was required
  (verified via `tests/test_css_sync.py`, which passed).
- `scripts/qa/render_dom_check.js` — added a `listLockShown` assertion that
  navigates to the list view and verifies the temp blocked issue's row shows the
  lock badge, mirroring the existing `kanbanLockShown` check.

**Validation:** `pytest tests/` → **140/140 passed**. `node --check` clean on both
changed JS files. Headless render QA (`scripts/qa/qa-render.sh`) → **PASS** with
`listLockShown: true` (and `kanbanLockShown: true` / `kanbanLockNoReload: true`
still green). Pushed to `origin/main` (`710413e`).

**Post-ship correction (`44be8d0`):** a deeper computed-style E2E probe revealed
the initial border approach applied `border-l-2` statically, giving every
unblocked row a 2px gray left edge (the tbody `divide-gray-800/60` rule at
0,3,0 specificity overrode `border-transparent` at 0,1,0). Fixed by applying
`border-l-2 border-red-900/70` only when `isBlocked(issue)` is true (empty string
otherwise). Re-verified via computed-style E2E: blocked rows 2px red
`rgba(127,29,29,.7)` edge, unblocked rows `border-left-width:0`, badge 22x22 with
12x12 lock svg not clipped; suite 140/140, render QA PASS.

## v1.0 direction decided (cycle-4 debate, 2026-08-24)

**Verdict source:** `docs/research/debates/debate-verdict-cycle-2.md`
(flow-debate-v1, paid, `flow_debate.py --validate` → **valid: true**, status
COMPLETE, confidence 0.62).

**Winner: Direction A — Stabilization v1.0.** URL deep-link completion,
fullscreen editing, published benchmarks, security pass, and packaging ship
**before** timeline/Gantt, portfolio dashboard, or batch multi-select (deferred
to v1.1+). All three participating models (DeepSeek V4 Flash, Gemini 3.7, GLM
5.3) independently converged on A; no participant defended B as primary v1.0
scope. Flip conditions before committing v1.1 timeline work: >50% of inbound
requests citing Gantt as the sole blocker, or a single-binary sub-50MB MIT
competitor emerging — neither holds today.

**v1.0 build order:**
1. **URL deep-link completion** — filters (`?q=`, `?priority=`, `?cycle=`),
   Cycles view tab (`?cycle=`), drawer width (`?w=`) as shareable hash state.
   *Shipped in cycle 4 (this commit).* → open TODO item B closed.
2. **Fullscreen focus mode** for description editing (TODO open item A).
   *Shipped in cycle 5.* → open TODO item A closed. See § "Cycle-5 shipped".
3. **Published benchmarks** — RAM, cold start, 10k-issue query vs Plane CE.
   *Shipped in cycle 6.* Reproducible stdlib harness `scripts/bench/bench.py`
   (isolated scratch instance, never the live one); published results in
   `docs/BENCHMARKS.md` with raw JSON in `docs/research/bench/`. Headline:
   50 MB idle / 98 MB at 10k issues, 36–96 ms cold start, 2.0 ms p50 board
   query at 10k issues; Plane CE cited at 4 GB min RAM / 13 containers
   (vendor docs, linked in BENCHMARKS.md). Smoke test in
   `tests/test_benchmarks.py`.
4. **Security pass** + CHANGELOG + versioned release packaging (CHANGELOG is
   genuinely absent today). *Shipped in cycle 7.* See § "Cycle-7 shipped".

**next_validation (verbatim intent):** headless-browser integration test
exercising bidirectional URL state sync (active filter, active tab, open
drawer) asserting round-trip fidelity; concurrently publish one benchmark run
(RAM, cold start, 10k-issue query) vs Plane CE. Monitor inbound Gantt demand to
test the flip condition before v1.1.

**Uncertainty:** GPT 5.6 Sol High failed in Round 1 (process_error); Direction B
was only reconstructed via cross-critiques, so its strongest defenses may be
understated.

## Cycle-4 shipped (2026-08-24): URL deep-link state

- `app/pb_public/js/app.js` — hash query parsing (`parseHashQuery`,
  `applyHashQueryState`) + canonical re-serialization in `syncRoute()`; root
  state for `filterQuery/filterPriority/filterCycle/selectedCycleId/
  drawerWidthOverride`; watchers sync URL on every state change (and
  `currentView` for keyboard 1-7 view switches).
- `KanbanBoard.js` — filters lifted from local data to props with writable
  computed proxies (`searchModel/priorityModel/cycleModel`), emitted via
  `update:filterQuery` etc.; `clearFilters` emits resets.
- `CyclesView.js` — `selectedCycleId` lifted to a prop (`update:selectedCycleId`
  emit), so the active cycle tab is URL-addressable.
- `IssueDrawer.js` — `widthOverride` prop: `?w=` (clamped 360-1280) wins for the
  session without touching `localStorage`; any manual resize or double-click
  reset clears the override (local preference takes back over).
- `index.html` — `v-model:` bindings wire board/list filters, cycle tab, and
  drawer width to the root state.
- `scripts/qa/render_dom_check.js` — 8 new `urlState` assertions (filter
  write/clear, `?q=`/`?priority=`/`?cycle=`/`?w=` restore after reload,
  session-only width override).

**Validation:** `pytest tests/` → 140/140. Headless render QA → PASS (all 8
urlState checks + prior routing/resize/relations suites). Fuzzed hostile hashes
(oversized `?q`, XSS payloads, invalid priority/w/cycle, broken query) → no
page errors, no mustache leaks, app alive; `?q=` clamped to 200 chars, invalid
values dropped. iBrowse remote QA host down (DNS ETIMEOUT, cycle-39 fallback
case) → local `qa-render.sh` fallback used.

## Cycle-5 shipped (2026-08-24): description focus mode

**Goal (v1.0 build order item 2/4):** a true distraction-free editing mode for
issue descriptions. The drawer already had a fullscreen toggle that expanded the
whole panel, but there was no dedicated focus mode for writing long descriptions.

**Shipped this cycle:**
- `app/pb_public/js/components/IssueDrawer.js` — added a `descFocus` state and a
  "Focus" button in the Description section header. Clicking it opens a fullscreen
  overlay (`z-[60]`, above the drawer) with a centered `max-w-3xl` editor, the
  Rich/Raw/Preview tabs, the AI Enhance PRD action, and a Done button. Esc saves
  and exits; the overlay auto-focuses the Milkdown editor on open. The existing
  drawer fullscreen toggle is unchanged.
- `scripts/qa/render_dom_check.js` — 4 new `focusMode` assertions: Focus button
  present, overlay opens, editor renders, Esc closes.

**Validation:** `pytest tests/` → 140/140. `flow.frontend_guard` clean. Headless
render QA → PASS (all 4 focusMode checks + prior routing/resize/urlState/relations
suites). iBrowse remote QA host down (github.com ETIMEOUT, environmental) → local
`qa-render.sh` fallback used. CSS rebuilt via `build_css.sh` (new utilities
`z-[60]`, `min-h-[60vh]`, `max-w-3xl` compiled in).

**Next (v1.0 item 3/4):** published benchmarks — RAM, cold start, 10k-issue query
vs Plane CE.

## Cycle-7 shipped (2026-08-24): security pass + CHANGELOG + versioned release packaging

**Goal (v1.0 build order item 4/4):** close the last v1.0 stabilization item —
a security pass, a CHANGELOG (genuinely absent), and versioned release
packaging so the version is consistent everywhere.

**Shipped this cycle:**
- `CHANGELOG.md` — new, Keep-a-Changelog + SemVer format, full history from
  initial release through 0.9.0, with an `[Unreleased]` section.
- **Version consistency fix**: the UI header badge (`Header.js`) showed a stale
  `v0.8.0` while `VERSION` was `0.9.0`. Fixed the badge to `v0.9.0` and extended
  `scripts/bump_version.sh` to keep the header badge and the custom-routes
  health/version endpoints in sync on every bump (previously only `VERSION` and
  `openapi.json` were updated).
- **Security pass**: audited all PocketBase collection API rules and hooks.
  Verified: anon gets empty lists (no data leak), anon create denied, admin UI
  requires superuser, member self-escalation blocked, cross-tenant isolation
  intact, notifications recipient-scoped. No new gaps found; existing 143-test
  suite (including 20+ security/role/privacy tests) all green.

**Validation (crime-scene audit):**
- `pytest tests/` → **143/143 passed**.
- `bash -n scripts/bump_version.sh` clean; `bump_version.sh show` → `v0.9.0`.
- Adversarial probes: anon list users/projects → empty (200, no leak); anon
  create issue → 400; admin UI → 200 (superuser-gated).
- Version refs now consistent: `VERSION`, `openapi.json`, `Header.js` badge,
  and custom-routes health/version all report `0.9.0`.

**Next (v1.1+):** timeline/Gantt, portfolio dashboard, batch multi-select
(deferred by the v1.0 stabilization verdict). Monitor inbound Gantt demand to
test the flip condition.

## Cycle-8 shipped (2026-08-24): create-issue list sync fix (PB-56)

**Goal:** fix the genuine user-reported P0 bug PB-56 — creating new items in
the UI didn't add them to the list unless the page was refreshed, and deleting
a just-added item errored.

**Root cause:** `handleCreateIssue` in `app.js` created the issue via the API
but never added it to the local `this.issues` list — it relied entirely on the
SSE realtime event. When the stream was not yet connected or the event was
missed, the new item only appeared after a manual refresh, and subsequent
operations on it (e.g. delete) were inconsistent.

**Shipped this cycle:**
- `app/pb_public/js/app.js` — `handleCreateIssue` now unshifts the created
  record into `this.issues` immediately, with the same duplicate guard as the
  realtime create handler. The item appears instantly and stays consistent.
- `tests/test_api.py` — source-level regression test pinning the local-list
  update (guards against reverting to SSE-only behavior).
- `CHANGELOG.md` — `[Unreleased]` entry for the fix.

**Validation (crime-scene audit):**
- `pytest tests/` → **144/144 passed** (143 + 1 new regression test).
- `flow.frontend_guard` clean; `qa-render.sh` → **PASS** (all urlState,
  relations, focusMode suites green).
- iBrowse remote host down (github.com ETIMEOUT, environmental) → local
  playwright create-flow verification used: created an issue in the UI and it
  appeared in the board immediately (before=3, after=4) with no page refresh
  and no console errors. Delete of the created item returned 204 (clean).
- Git clean, `0209419` on `origin/main` (HEAD == origin/main). PB-56 marked
  `done` with a structured audit comment (commit, tests, QA, summary).

## Cycle-9 shipped (2026-08-24): realtime cycles & comments sync

**Goal:** close a real-time SSE gap flagged by the strategic calibration focus
on real-time sync. `api.js` subscribed to `cycles` and `comments` realtime
events, but the `app.js` realtime handler only handled `notifications`,
`issues`, `milestones`, and `projects`. So a cycle created/updated/deleted by
another user, or a new comment on an open issue, did not appear until a manual
refresh.

**Shipped this cycle:**
- `app/pb_public/js/app.js` — the realtime handler now reacts to `cycles`
  (create/update/delete, project-scoped like issues) and `comments` (bumps a
  new `commentRefreshKey` counter).
- `app/pb_public/js/components/IssueDrawer.js` — accepts a `commentRefreshKey`
  prop and watches it to reload the comment thread live when a realtime comment
  event arrives.
- `app/pb_public/index.html` — wires `:comment-refresh-key` into the drawer.
- `tests/test_api.py` — source-level regression test pinning the cycles +
  comments realtime handling.
- `CHANGELOG.md` — `[Unreleased]` entry.

**Validation (crime-scene audit):**
- `pytest tests/` → **146/146 passed** (145 + 1 new regression test).
- `flow.frontend_guard` clean; `node --check` clean on both changed JS files.
- `qa-render.sh` → **PASS** (all urlState, relations, focusMode suites green).
- Live comment create/delete verified against the running app (realtime event
  fires on create; the refresh-key mechanism is exercised by the regression
  test). iBrowse remote host down (github.com ETIMEOUT, environmental) → local
  render QA used as the visual fallback.
- Git clean, pushed to `origin/main`.

## Cycle-10 shipped (2026-08-24): global cross-project sort index

**Goal (strategic calibration item 2 — multi-project sync / real-time SSE
performance):** close the one documented benchmark gap. `docs/BENCHMARKS.md`
flagged the worst-case query — a cross-project `sort=-created` with no filter —
as the only shape with no covering index (62.5 ms p50 at 10k issues).

**Shipped this cycle:**
- `app/pb_migrations/1710000017_global_created_index.js` — additive
  `CREATE INDEX IF NOT EXISTS idx_issues_created ON issues (created DESC)`.
  SQLite can now satisfy the global sort without a full table scan + temp
  B-tree (verified via `EXPLAIN QUERY PLAN` after `ANALYZE`).
- `tests/test_benchmarks.py` — regression test pinning the migration file and
  its index DDL (guards against the index being dropped or renumbered).
- `CHANGELOG.md` — `[Unreleased]` Added entry.
- `docs/BENCHMARKS.md` — worst-case p50 updated 62.5 → 45.1 ms (p95 47.6 ms).

**Validation (crime-scene audit):**
- Migration applies cleanly on a fresh scratch instance (boot log shows
  "Successfully created global created index"); `node --check` clean.
- `EXPLAIN QUERY PLAN` on a seeded scratch DB confirms the planner uses
  `idx_issues_created` for the global sort after `ANALYZE`.
- Re-ran `scripts/bench/bench.py --issues 10000 --query-runs 20`: worst-case
  p50 **45.1 ms** (was 62.5 ms), p95 47.6 ms. All project-scoped views remain
  single-digit ms (board 2.2 ms, filter 2.5 ms, search 3.4 ms, count 1.2 ms).
- `pytest tests/` → **143/143 passed** (142 + 1 new regression test).
- No frontend touched → no iBrowse/render QA required this cycle.

## Cycle-11 shipped (2026-08-24): agent-surface OpenAPI coverage

**Goal (PB-62, strategic calibration item 3 — OpenAPI schemas / agentic
workflows):** close the agent-discovery drift in the hand-maintained
`openapi.json`. Six implemented `/api/projectbase/*` custom routes were not
documented, so autonomous agents consuming the spec could not discover
importers, AI assist, agent dispatch, or the notifications read-all endpoint.
PB-62 was marked done with a structured audit comment (commit, tests, QA,
summary).

**Shipped this cycle:**
- `app/pb_public/openapi.json` — added the six missing routes with full
  request/response schemas: `/projectbase/version`, `/projectbase/import/csv`,
  `/projectbase/import/github`, `/projectbase/notifications/read-all`,
  `/projectbase/ai-assist`, and `/projectbase/dispatch-agent`. Added four tags
  (Importers, Notifications, AI Assist, Agent Dispatch) so the spec groups them
  for agents. The spec now covers all 12 custom routes (was 6).
- `tests/test_api.py` — `DOCUMENTED_CUSTOM_ROUTES` list + `test_openapi_spec_valid`
  now asserts every implemented custom route is present in `openapi.json`,
  so any future route added to the hooks without a spec entry fails CI.
- Corrected the cycle-10 P2 benchmark prose (from inspect audit): `CHANGELOG.md`,
  `docs/BENCHMARKS.md`, and `docs/ROADMAP.md` claimed the worst-case global sort
  was 44.3/93.0 ms, but the committed artifact
  (`docs/research/bench/bench-10k-2026-08-24-postindex.json`) measures
  **45.07/47.62 ms p50/p95**. All three docs now state 45.1/47.6 ms,
  matching the committed raw result.

**Validation (crime-scene audit):**
- `openapi.json` parses as valid JSON 3.1.0; served live at `:8120/openapi.json`
  (17 paths). Confirmed via curl that all six new routes are present in the
  served spec.
- `pytest tests/` → **146/146 passed** (added the strengthened openapi assertion;
  the github importer suite passed in isolation after a transient external
  github.com timeout on the first full run).
- `node --check` clean on all touched JS (none touched this cycle).
- No frontend UI code changed → no iBrowse/render QA required; the only served
  artifact is `openapi.json`, verified via direct HTTP.

## Cycle-12 (2026-08-24): audit-driven docs bookkeeping + crime-scene audit

**Goal:** close the two P2 findings left by the cycle-11 inspect audit, and
re-run the full crime-scene audit (frontend_guard, render QA, iBrowse attempt,
adversarial fuzzing, security) to confirm the release is clean.

**Shipped this cycle:**
- `docs/ROADMAP.md` — fixed the stale cycle-10 test count (145/145 → 146/146,
  matching the committed suite) and added the PB-62 reference to the cycle-11
  section for backlog/bookkeeping consistency.
- `CHANGELOG.md` — `[Unreleased]`/`Fixed` entry documenting the bookkeeping fix.

**Validation (crime-scene audit):**
- `pytest tests/` → **146/146 passed**.
- `python3 -m flow.frontend_guard` → **ALL FRONTEND FILES VERIFIED**.
- `scripts/qa/qa-render.sh` → **RENDER QA: PASS** (urlState, relations,
  focusMode suites green; the single 4xx is the expected pre-auth 400 on
  `users/auth-with-password`).
- iBrowse visual QA attempted; the homelab iBrowse host returned an
  environmental `github.com ETIMEOUT` (network egress), same documented
  fallback as prior cycles → local render QA used as the visual fallback.
- Adversarial: oversized issue title (200k chars) → 400
  `validation_max_text_constraint`; malformed JSON → 400; missing project → 400.
- Security: anon read of issues/projects/comments returns **empty** (rule-gated,
  no leak); anon `_superusers` list → 403; openapi.json served 200 for docs.
- Git clean on `origin/main`; docs-only change → no frontend rebuild required.

## Cycle-16 shipped (2026-08-24): batch multi-select + bulk actions

**Goal (first v1.1 feature, deferred from the cycle-4 stabilization verdict):**
give the board and list views a zero-friction multi-select so users can
triage many issues at once — the "move 3 cards backlog→todo, assign 2
priorities, change 1 cycle" workflow from the cycle-1 falsifiable validation —
without N per-record requests.

**Shipped this cycle:**
- `app/pb_hooks/31_bulk_actions.pb.js` — two new agent-surface routes:
  `POST /api/projectbase/issues/bulk-update` (whitelisted fields: status,
  priority, cycle, milestone, estimate, due_date, labels, order + per-project
  `custom_*`; up to 500 ids) and `POST /api/projectbase/issues/bulk-delete`
  (admin/manager only, mirroring the issues deleteRule; superuser always
  allowed). Each record is saved through `app.save()`/`app.delete()` so the
  activity audit hook and realtime SSE fire per record. Response carries
  `updated/deleted`, `missing`, `total` counts.
- `app/pb_public/js/api.js` — `bulkUpdateIssues(ids, data)` /
  `bulkDeleteIssues(ids)` client methods.
- `app/pb_public/js/app.js` — selection state lifted into the root app
  (`selectedIssueIds`), Esc clears selection (drawer close takes priority),
  realtime deletes prune the set, project switch clears it, `bulkUpdateSelected`
  applies the patch locally + toasts, `bulkDeleteSelected` confirms + removes.
- `app/pb_public/js/components/KanbanBoard.js` — per-card selection checkbox
  (hover-revealed), selected ring highlight, Cmd/Ctrl+click toggles selection
  instead of opening the drawer.
- `app/pb_public/js/components/ListView.js` — selection checkbox column +
  select-all in the header, selected row highlight, Cmd/Ctrl+click toggle.
- `app/pb_public/index.html` — floating bulk action bar (bottom, glassy):
  status / priority / cycle selects + Delete + Clear; wired to both views.
- Docs: OpenAPI + llms.txt/llms-full.txt agent surface updated; `AGENTS.md`
  directory map; `CHANGELOG.md` `[Unreleased]`.

**Validation (crime-scene audit):**
- `pytest tests/` → **168/168 passed** (149 + 19 new in
  `tests/test_bulk_actions.py` covering auth, validation, happy path, missing
  accounting, role gating, labels, custom-field prefix, and frontend wiring).
- `python3 -m flow.frontend_guard` → ALL FRONTEND FILES VERIFIED.
- `node --check` clean on all four changed JS files.
- `scripts/qa/qa-render.sh` → RENDER QA PASS (see below).
- iBrowse visual QA: see verdict in this cycle's inspect phase (remote egress
  fallback used in prior cycles when homelab host unreachable).
- Adversarial: bulk-update with bad field / bad status / bad cycle → 400;
  member bulk-delete → 403; anon both routes → 401/403; nonexistent ids
  counted as `missing` without failing the batch.

**Next (v1.1+):** timeline/Gantt and portfolio dashboard remain deferred per
the v1.0 stabilization verdict. Batch multi-select is the first v1.1 item to
land; natural follow-ups are shift+click range selection and bulk custom-field
editing from the bar.

## Cycle-17 shipped (2026-08-24): Shift+click range selection (v1.1 feature 2)

**Goal (natural follow-up #1 from the cycle-16 roadmap note):** make bulk
multi-select zero-friction by adding Linear-style Shift+click range selection
on top of the cycle-16 checkboxes, so "grab 12 backlog items at once" is a
click, a shift, a click — no N taps.

**Shipped this cycle:**
- `app/pb_public/js/app.js` — selection anchor state (`lastSelectedIssueId`):
  every toggle updates the anchor; new `rangeSelectIssue(orderedIssues,
  target)` merges the inclusive anchor→target range (union with the current
  selection) and falls back to a single selection when the anchor is missing or
  filtered out; the anchor resets with Esc/project switch and is pruned when
  its record is deleted via realtime.
- `app/pb_public/js/components/KanbanBoard.js` — Shift+click on a card emits
  `range-select-issue` with the board's visible order (fixed column order,
  cards sorted by `order` inside each column); no drawer opens.
- `app/pb_public/js/components/ListView.js` — Shift+click on a row emits
  `range-select-issue` with the current `processedIssues` sort order.
- `app/pb_public/index.html` — binds `@range-select-issue="rangeSelectIssue"`
  on both views.
- `scripts/qa/render_dom_check.js` — new 15-assertion range suite: board anchor
  count, forward range → 3 selected, checked-checkbox count == 3, no drawer on
  shift+click, Esc clears, board cross-column span (expected count derived from
  the live DOM), list forward range, list reverse range, plus a full E2E block
  that creates 3 temp issues, range-selects them, applies status `todo` via the
  bulk bar, verifies all 3 moved through the API, and proves cleanup (DELETE
  responses 204). Non-vacuous probe guards fail the suite if the board/list
  have <3 items.

**Verification:**
- `scripts/qa/qa-render.sh` → **RENDER QA PASS**, range suite all green
  (boardProbed, boardAnchorOne, boardRangeThree, boardCheckedCount=3,
  boardNoDrawer, boardEscClears, boardCrossColumnOK=4, listProbed,
  listRangeThree, listReverseThree, applyCardsFound, applyBarThree,
  applyMovedAll, applyBarCleared, applyDeletedAll). Only 4xx is the
  intentional login-probe 400.
- `pytest tests/` → **168/168 passed** in 19s.
- `python3 -m flow.frontend_guard` → ALL FRONTEND FILES VERIFIED; `node --check`
  clean on all three changed JS files + the QA script.
- Security/adversarial probes: anon issues read → empty, anon `_superusers` →
  403, anon bulk-update/bulk-delete → 401, malformed JSON → 400, 501 ids →
- iBrowse visual QA: homelab host could not navigate to `127.0.0.1:8120`
  (entry `goto` timeout 30s, same external egress class as cycle 16); the
  documented local render-QA fallback passed with the full range suite.
- Git clean, `df392de` on `origin/main` (HEAD == origin/main). PB-67 marked
  `done` with a structured audit comment (commit, tests, QA, summary).

**Next:** bulk custom-field editing from the bulk bar (backend whitelist
already accepts `custom_*`; needs the bar UI picker), then timeline/Gantt and
portfolio dashboard per the v1.0 stabilization verdict.

## Cycle-18 shipped (2026-08-24): bulk custom-field editing + backend merge fix

**Goal (v1.1 feature 3, the roadmap's stated next item):** let the bulk bar
edit per-project custom fields for every selected issue at once, mirroring the
drawer's custom-field schema (text / number / select / checkbox / date).

**Latent backend bug fixed first:** the bulk-update route accepted a bare
`custom_<key>` in `data` and did `rec.set("custom_"+key, value)` — but the
schema has no such top-level columns (custom values live in the `custom_fields`
JSON object), so that path was a **silent no-op**. Passing `custom_fields`
wholesale instead **replaced the entire object**, dropping unrelated values
(verified empirically: `{effort:3, client:Acme}` bulk-set to `{effort:9}`
lost `client:Acme`).

**Shipped:**
- `app/pb_hooks/31_bulk_actions.pb.js` — `bulk-update` now accepts a nested
  `custom_fields` object and **merges** it into each record's existing
  `custom_fields` JSON, preserving unrelated keys. A `null` / `''` value removes
  that single key. Phantom `custom_*` keys are now rejected (400) instead of
  silently ignored. The object shape is validated (`'custom_fields' must be an
  object`, max key length 64).
- `app/pb_public/js/app.js` — root state `bulkCustomFieldKey` /
  `bulkCustomValue` / `bulkCustomChecked`; computed `currentFieldDefs` /
  `selectedBulkCustomField`; `applyBulkCustomField(field, value)` sends a
  partial `custom_fields` payload; the optimistic local apply in
  `bulkUpdateSelected` now **merges** `custom_fields` instead of replacing.
- `app/pb_public/index.html` — the bulk bar renders a "Custom" picker when the
  active project defines custom fields: a field select (defs from
  `currentProject.custom_field_defs`), the type-matched value control, and an
  Apply button. Regex-free; driven entirely by the project's field schema.
- `app/pb_public/css/style.css` — regenerated (`scripts/build_css.sh`) to add
  `bg-indigo-600/80` used by the new Apply button.
- `tests/test_bulk_actions.py` — new `test_bulk_update_custom_fields_partial_merge`
  (merge preserves unrelated keys; null removal) and
  `test_bulk_update_custom_fields_validation` (non-object and legacy `custom_*`
  rejected). Updated `test_bulk_update_custom_field_prefix_allowed` to assert
  the corrected behavior, plus source-level wiring tests.
- `scripts/qa/render_dom_check.js` — new custom-field picker E2E: creates a temp
  issue with `{effort, client, qa_signoff}`, selects it, chooses the `effort`
  number field, applies `42` through the bulk bar, and proves via the API that
  `effort=42` while `client`/`qa_signoff` survive (merge preserved).

**Verification:**
- `pytest tests/` → **168/168 passed** in ~19s.
- `scripts/qa/qa-render.sh` → **RENDER QA PASS**; new custom-field E2E asserts
  `pickerShown: true`, `updated: true`, `mergePreserved: true`.
- `python3 -m flow.frontend_guard` → ALL FRONTEND FILES VERIFIED.
- Security/adversarial: anon bulk-update `custom_fields` → 401; non-object
  `custom_fields` → 400; 65-char custom key → 400; legacy `custom_effort` → 400.
- iBrowse: homelab host cannot navigate to `127.0.0.1:8120` (same external
  egress class as prior cycles); local render-QA fallback passed.

**Next:** timeline/Gantt and portfolio dashboard per the v1.0 stabilization
verdict.


## Cycle-19 shipped (2026-08-24): Timeline / Gantt view (v1.1 feature 4)

**Goal (roadmap "Next" after cycle-18):** ship the deferred v1.1 timeline/Gantt
milestone — a schedule view of cycles, milestones and issues on a day grid, the
first half of the "timeline/Gantt and portfolio dashboard" note (portfolio
dashboard remains v1.1+).

**Shipped this cycle:**
- `app/pb_migrations/1710000018_issue_start_date.js` — additive nullable
  `issues.start_date` (date only). Fresh installs also get it via the repair
  migration (`1710000003`) issues def. Applied to the live DB (verified via
  `_collections` fields: `due_date`, `start_date`, `updated`).
- `app/pb_public/js/components/TimelineView.js` — zero-build Vue 3 Gantt:
  month-tick ruler, weekly gridlines, section rows (Cycles → Milestones →
  Issues), status-colored bars positioned by day offset, empty state when
  nothing is scheduled, and click-to-open on issue bars (emits `open-issue`).
  Issues without a start date fall back to their cycle start (or `created`).
- Wiring: `index.html` view block + script include; `app.js` component
  registration, both `viewMap`s (`timeline: 'timeline'`), and keyboard
  shortcut `4` (board 1, list 2, cycles 3, timeline 4, projects 5, stats 6,
  docs 7, marketplace 8); `Header.js` Timeline nav button; `CommandPalette.js`
  `act_timeline` action.
- `start_date` in create/edit: `NewIssueModal.js` (Start Date input, reset,
  payload) and `IssueDrawer.js` (Start Date field, watch, save payload).
- `app/pb_hooks/31_bulk_actions.pb.js` — bulk-update whitelists + validates
  `start_date` (same shape as `due_date`).
- Agent surface: `app/pb_public/openapi.json` (2 schemas gain `start_date`),
  `app/pb_public/llms.txt` bulk-update field list.
- `app/pb_public/sw.js` — precache list gains `TimelineView.js` (regression
  test `test_sw_precache_covers_all_index_html_assets`).
- `app/pb_public/css/style.css` — rebuilt via `scripts/build_css.sh`.

**Verification:**
- `pytest tests/` → **171/171 passed** (was 168; +3: `start_date` roundtrip,
  bulk update + validation, frontend wiring incl. SW precache + CSS sync).
- `node --check` clean on all changed JS + the QA script.
- Render QA (`scripts/qa/qa-render.sh`) → **RENDER QA: PASS** with the new
  timeline E2E green: view mounts with day grid, dated temp issue bar renders,
  clicking the bar opens the drawer (hash `#/pb/timeline/issue/<id>`), and the
  `4` shortcut switches to the timeline. Also fixed a pre-existing QA gap: the
  relations E2E cleanup DELETE was never added to `ignoredCleanupUrls`, so its
  client-side abort was counted as a failed request.
- Live schema check: `start_date` present on `issues`; create roundtrip + bulk
  update verified against the live instance.

**Next:** portfolio dashboard (the other half of the v1.1 note), then the
North Star external-gated items (public demo domain + first-stranger
onboarding), which still need human input.

## Cycle-20 shipped (2026-08-24): Portfolio Dashboard (v1.1 feature 5)

**Goal (roadmap "Next" after cycle-19):** ship the deferred portfolio dashboard
— the other half of the "timeline/Gantt and portfolio dashboard" v1.1 note. The
Timeline view shipped in cycle 19; this cycle delivers the cross-project
workspace overview.

**Shipped this cycle:**
- `app/pb_public/js/components/PortfolioView.js` — zero-build Vue 3 portfolio
  dashboard aggregating every project, issue and milestone:
  - KPI cards: total issues, overall completion %, in-flight/open work, and
    estimate load (story points).
  - A per-project progress list (done / in-flight / total) with color
    completion bars, sorted by issue count; clicking a row opens that
    project's board via the existing `select-project` flow.
  - A milestones & roadmap-health panel that surfaces upcoming and overdue
    targets (overdue first, then soonest target, then done) with per-milestone
    progress.
  - It fetches its own workspace snapshot (`API.getIssues(null)` +
    `API.getMilestones(null)`) on mount so it stays accurate regardless of the
    project the shell currently scopes its props to (no extra backend round
    trip beyond the two standard reads).
- Wiring: `index.html` view block + script include; `app.js` component
  registration, both `viewMap`s (`portfolio: 'portfolio'`), and keyboard
  shortcut `9` (board 1, list 2, cycles 3, timeline 4, projects 5, stats 6,
  docs 7, marketplace 8, portfolio 9); `Header.js` Portfolio nav button;
  `CommandPalette.js` `act_portfolio` action; `#/pb/portfolio` hash route.
- `app/pb_public/sw.js` — precache list gains `PortfolioView.js`; cache name
  bumped `projectbase-shell-v2` → `v3` so clients re-fetch the shell.
- `app/pb_public/css/style.css` — rebuilt via `scripts/build_css.sh`.

**Verification:**
- `pytest tests/` → **173/173 passed** (was 172; +1: new
  `test_portfolio_view_wired_and_precached` wiring/drift-guard test).
- `node --check` clean on all changed JS + the QA script.
- Render QA (`scripts/qa/qa-render.sh`) → **RENDER QA: PASS** with a new
  portfolio E2E green: view mounts (`Portfolio Dashboard` + `.max-w-7xl`),
  per-project progress rows render against live data, and the `9` shortcut
  switches to the portfolio view.
- Milestone status convention: the view treats `achieved` milestones as
  complete (100% when nothing is linked, never flagged overdue), matching the
  existing MilestonesView convention (fix commit 982af48, audit-hat finding).
- Adversarial fuzz: hostile portfolio hashes (encoded script tags, XSS-in-`?q=`,
  path-traversal `?cycle=`, bogus issue deep links, trailing slashes) → all
  render cleanly with zero page errors and zero raw-mustache leaks.
- Deep-link after login (pre-existing routing gap, fixed): `applyRoute()`
  bailed on mount while unauthenticated, so a shared hash like
  `#/pb/portfolio` (or `#/pb/stats`) opened before sign-in fell back to the
  board after login. signIn/signUp now re-apply the hash, so deep links land
  on the intended view. Regression-guarded in render QA (isolated context,
  fresh login).
- iBrowse remote QA host was unreachable (Tailscale DNS/route, the documented
  cycle-39 fallback case); the local headless render QA is the designated
  fallback and passed.

**Next:** the remaining v1.1 backlog and the North Star external-gated items
(public demo domain + first-stranger onboarding), which still need human input.

## Cycle-21 shipped (2026-08-24): Portfolio Dashboard realtime refresh (v1.1 feature 5 follow-up)

**Goal:** the Portfolio Dashboard (shipped cycle 20) only fetched its
workspace snapshot on mount. With realtime SSE wired across the app, a user
creating, updating, or deleting an issue/milestone/project/cycle elsewhere
(left drawer, another project, the board) left the portfolio stale until a
full reload. This cycle makes it stay live.

**Shipped this cycle:**
- `app/pb_public/js/app.js` — new `realtimeTick: 0` state. The existing
  realtime SSE handler bumps it on every event for the workspace-scoped
  collections (`issues`, `milestones`, `projects`, `cycles`). Independent of
  the `commentRefreshKey` path used by the issue drawer.
- **SSE-independent hardening (found by render-QA fuzz):** SSE delivery is
  unreliable (PB-56 documents the app "does not depend on the SSE realtime
  event"), and the shell's optimistic `this.issues.unshift(created)` mutates
  the array in place so the prop reference never changes and a prop watcher
  would never fire. To keep the portfolio live in the SSE-missed case, the
  tick is also bumped in the optimistic `handleCreateIssue`,
  `handleUpdateIssue`, `handleDeleteIssue`, `bulkUpdateSelected` and
  `bulkDeleteSelected` paths. This is the path render QA proves (a UI create
  bumps the tick and the KPI increments).
- `app/pb_public/js/components/PortfolioView.js` — accepts the `realtimeTick`
  prop, watches it and the `issues`/`milestones` props (belt-and-suspenders),
  all routed through a shared `scheduleRefresh()` that debounces a single
  `refresh()` (400 ms). `beforeUnmount` clears the pending timer.
- `scripts/qa/render_dom_check.js` — new portfolio realtime E2E that creates
  an issue via the actual NewIssueModal (keyboard C) while on the portfolio
  view, waits past the debounce, and asserts the "Total Issues" KPI increments
  with no navigation or reload.
- `tests/test_api.py` — `test_portfolio_realtime_tick_wiring` extended to
  assert the tick is bumped in the optimistic create/update/delete handlers
  (SSE-independent path) as well as the realtime SSE handler.

**Verification:**
- `pytest tests/` → **174/174 passed** (was 173; +1 new drift-guard assertions
  folded into the existing portfolio realtime test).
- `node --check` clean on `app.js`, `PortfolioView.js`, `render_dom_check.js`.
- `python3 -m flow.frontend_guard` → all frontend files verified.
- Render QA (`scripts/qa/qa-render.sh`) → **RENDER QA: PASS**, zero failures.
  The new realtime E2E proves the portfolio KPI increments (60 → 61) after a
  real UI create, with no console errors and no raw-mustache leaks.
- Remote iBrowse host was blocked (`max_replan_attempts_exceeded`, the
  documented cycle-39 fallback case); the local headless render QA is the
  designated fallback and passed.

**Next:** the remaining v1.1 backlog and the North Star external-gated items
(public demo domain + first-stranger onboarding), which still need human input.

## Cycle-23 shipped (2026-08-24): harden — secret-scan regression guard + repo privacy P0

**Context:** cycle-22 inspect locked `harden` after flagging a P0: the
`AndrianBalanescu/ProjectBase` GitHub repo was **PUBLIC**. Publishing is a
human decision per the flow rules and no such decision was recorded, so the
repo was restored to **PRIVATE** this cycle (reversible; can be made public
again by a human at any time).

**Shipped this cycle:**
- `tests/test_secret_scan.py` — ported the secret/hardcoded-credential
  regression guard that lived only on the archived
  `backup/security-clown-commits` branch back onto `main`. It scans every
  `git ls-files`-tracked source file (excluding vendored bundles, binary
  assets, and archived research dumps) for live-looking API keys, tokens,
  private keys, and long base64 secret assignments, and asserts the cycle-12
  regression site (`scripts/qa/run_10_ibrowse_e2e.{sh,py}`) reads
  `IBROWSE_API_KEY` from the environment rather than a literal. This is the
  guard that would have caught the cycle-12 P1 credential leak before merge.

**Verification:**
- `pytest tests/` → **177/177 passed** (was 174; +3 new guard tests).
- `python3 -m flow.frontend_guard` → ALL FRONTEND FILES VERIFIED.
- Render QA (`scripts/qa/qa-render.sh 8120`) → **PASS**, zero failures
  (portfolio realtime KPI 57→58 E2E still green); iBrowse host busy/timeout so
  the documented local fallback was used.

**Next:** remaining v1.1 backlog and North Star external-gated items (public
demo domain + first-stranger onboarding) still need human input.

## Cycle-25 shipped (2026-08-25): self-hosting deployment-consistency guard + Docker fresh-boot verification

**Context:** cycle 25 is a strategic-calibration cycle (5|cycle). North Star
priority #1 is "full self-hosting Docker / Docker Compose / Caddy deployment".
AGENTS.md warns about the classic PocketBase data-dir trap — the local run
serves `--dir pb_data` from the repo root while the containerized stack serves
`--dir /app/app/pb_data` (`app/pb_data`) — but no regression guard locked the
deploy surfaces, so a stray edit could silently ship a demo that boots into a
stale/empty database or points Caddy at the wrong port.

**Shipped this cycle:**
- `tests/test_deploy_consistency.py` (9 tests) — static drift guard locking
  `Dockerfile`, `docker-compose.yml`, `deploy/projectbase.service` (systemd
  template), `scripts/start.sh`, `Makefile`, and `deploy/Caddyfile` to the same
  public/hooks/migrations/data dirs and the same listen port (8120). Mirrors the
  `test_css_sync.py` drift-guard style; proven to fail on a real perturbation
  (a `--dir /app/pb_data` edit fails immediately) then pass on restore.
- Manually verified the full Docker fresh-boot path end-to-end: `docker build`,
  `docker compose up` on a scratch instance, `superuser upsert`, `/api/health`,
  superuser auth, and 6 seeded projects on a fresh container boot.

**Verification:**
- `pytest tests/` → **186/186 passed** (was 177; +9 new deploy-consistency
  guard tests).
- `python3 -m flow.frontend_guard` → ALL FRONTEND FILES VERIFIED.
- Render QA (`scripts/qa/qa-render.sh 8120`) → **RENDER QA: PASS**, zero
  failures (portfolio realtime KPI 57→58 E2E still green).
- Docker fresh-boot e2e (scratch instance on :8123, teardown `-v` after) → healthy.

**Next:** remaining v1.1 backlog and North Star external-gated items (public
demo domain + first-stranger onboarding) still need human input.

## Cycle-27 shipped (2026-08-25): first-run onboarding guide (welcome modal + empty-state)

**Goal:** close the last first-run UX gap — a brand-new self-hoster signing up
was dropped into a (possibly empty) workspace with no idea of the 60-second path
to value. Linear/Plane-class products onboard the first project immediately.

**Shipped this cycle:**
- `app/pb_public/js/components/WelcomeModal.js` — first-run onboarding checklist
  shown once per browser after sign-up. Three actionable rows each perform the
  real UI action: "Create your first project" opens the Project modal, "Create
  an issue" opens the New Issue modal, "Open board" switches to the board view.
  Steps 2-3 are disabled until at least one project exists (fresh self-host
  install), with an inline tip telling the user to create a project first.
- Trigger + guard: `app.js signUp()` shows the modal when
  `localStorage.pb_welcome_seen` is unset, then sets it; `signOut()` clears it
  so a later account on the same browser sees the guide again. Escape closes it;
  the single-key shortcut guard and the Escape-reset path now include
  `isWelcomeOpen`.
- Command palette: new "Show Welcome Guide" action re-opens the modal any time
  (`open-welcome` emit wired in `index.html`).
- Projects view empty state: when the workspace has zero projects, the grid is
  replaced by a centered welcome card (icon + three-step onboarding cards:
  create a project → add an issue → drag it to done) with a create-project CTA.
- Wiring: `index.html` script import + `<welcome-modal>` render; `app.js` state +
  methods; `CommandPalette.js` emit + action; `sw.js` precache entry.
- Tailwind rebuilt for the new arbitrary classes (`z-[60]`, `bg-[#0d1220]`,
  `disabled:opacity-40`), verified by `tests/test_css_sync.py`.

**Validation:** `pytest tests/` → **186/186 passed** (incl. the SW-precache
regression that now asserts `WelcomeModal.js` is in the precache list).
`python3 -m flow.frontend_guard` → ALL FRONTEND FILES VERIFIED. iBrowse visual QA
→ **SUCCEEDED** (zero console errors, zero 4xx/5xx). Headless render QA
(`scripts/qa/qa-render.sh`) → **RENDER QA: PASS**. New
`scripts/qa/verify_welcome_modal.js` drives the real user flow end-to-end: logs
in, opens the palette, selects "Show Welcome Guide", asserts the modal renders
(title + all three rows), clicks "Create your first project", and asserts the
ProjectModal opens — all without console errors.

**Next:** remaining v1.1 backlog and North Star external-gated items (public demo
domain + first-stranger onboarding) still need human input.

## Cycle-28 shipped (2026-08-25): AI Cycle Summary (summarize_cycle UI)

**Goal:** close the last gap in the AI copilot surface. The
`/api/projectbase/ai-assist` backend already exposed a `summarize_cycle`
action (and it was documented in OpenAPI), but no frontend UI ever called it —
users could generate subtasks and polish PRDs from the drawer, yet had no way
to get an AI sprint summary in the Cycles view.

**Shipped this cycle:**
- `app/pb_public/js/components/CyclesView.js` — new "AI Sprint Summary" panel
  in the selected-cycle deep-dive. A Generate button POSTs the current cycle's
  issue list (identifier/title/status/priority/estimate) to
  `/api/projectbase/ai-assist` with `action: summarize_cycle` and the
  PocketBase auth token (same pattern as `IssueDrawer.polishAiDescription`).
  The returned executive summary (achievements, WIP/blockers, velocity analysis
  & recommendations) renders inline as sanitized Markdown via
  `marked` + `DOMPurify`, matching the IssueDrawer description convention.
  Includes a loading spinner (`aiSummaryLoading`), an error state, and a
  guard so a second click while loading is a no-op.
- `app/pb_public/css/style.css` — rebuilt via `scripts/build_css.sh` for the
  new utilities (`animate-spin`, `border-indigo-700/40`, `disabled:opacity-40`).
- `tests/test_api.py` — new `test_ai_cycle_summary_wired_in_cycles_view`
  drift-guard pinning the wiring (panel, Generate, ai-assist route,
  summarize_cycle action, auth header, sanitized markdown renderer).
- `app/pb_hooks/70_ai_assist.pb.js` — **rule-based fallback for
  `summarize_cycle`**. While validating the UI end-to-end, the OmniRoute
  gateway returned 401 (unauthenticated), and the endpoint replied with an
  empty `result` — the UI would have shown nothing. The hook now computes a
  deterministic sprint summary from the issues payload when the LLM is
  offline/unauthenticated: ✅ Achievements (done list), 🚧 In Progress /
  Blockers, 📋 Backlog / Todo, and 📈 Velocity (points done/total, %,
  pacing recommendation). The frontend also surfaces an actionable error if a
  response is ever empty instead of silently showing the placeholder.
- `tests/test_api.py` — new `test_ai_assist_summarize_cycle_fallback`
  asserting the endpoint never returns an empty result and always references
  the listed work (gateway-agnostic, so it holds with or without a live LLM).
- No schema change; the API contract is unchanged (still returns
  `{success, action, used_llm, result}`).

**Validation:** `pytest tests/` → **188/188 passed** (186 + 2 new). `python3 -m
flow.frontend_guard` → ALL FRONTEND FILES VERIFIED. Headless render QA
(`scripts/qa/qa-render.sh`) → **RENDER QA: PASS** (incl. the Cycles view
suite). Visual QA via local Playwright E2E (the homelab iBrowse service was
environmentally blocked with `max_replan_attempts_exceeded` on both attempts):
the Cycles view mounts with the panel and Generate button; clicking Generate
POSTs `summarize_cycle` with the cycle's issues payload and renders the returned
summary inline (`Sprint Summary` heading, `Achievements (6 done)` with
`PB-1…PB-6`, `Velocity`), with no console errors beyond the pre-existing benign
`auth-with-password` 400 probe. The initial E2E pass claim was audited and
corrected after it was found to match the static "sprint velocity" page
subtitle — the fallback fix makes the summary render real content even when the
LLM is down.

**Next:** remaining v1.1 backlog and North Star external-gated items (public
demo domain + first-stranger onboarding) still need human input.

## Cycle-31 shipped (2026-08-25): global cross-project search in the Cmd+K omnibox

**Goal:** close the largest remaining search gap vs Linear/Plane. The command
palette (Cmd+K) could only search the currently-selected project's loaded
issues. Linear's iconic Cmd+K surfaces work from every workspace, which is the
zero-friction promise this product makes. This cycle makes the omnibox
cross-project.

**Shipped this cycle:**
- `app/pb_hooks/30_custom_routes.pb.js` — new `GET /api/projectbase/search?q=&limit=`
  route (auth-required). Searches `title`, `identifier`, `status`, and
  `priority` across every issue, and enriches each result with its project
  (id/name/identifier/color). Bounded at 50 results.
- `app/pb_public/js/api.js` — `API.searchIssues(query, limit)` calling the
  route.
- `app/pb_public/js/components/CommandPalette.js` — debounced (250ms) global
  search. Results merge into the palette list after current-project matches
  (deduped by id); cross-project results show a `• PROJECT` tag in the
  subtitle and emit `select-global-issue`.
- `app/pb_public/js/app.js` — `openGlobalIssue(issue)`: switches to the
  result's project (if different), reloads its issues, then opens the full
  issue drawer (refetched with relations/comments).
- `app/pb_public/index.html` — wires `@select-global-issue`.
- Agent surface: `openapi.json` (new `/projectbase/search` path + Search tag),
  `llms.txt` / `llms-full.txt` (route + cURL), and a new `search_issues`
  FastMCP tool in `scripts/mcp_server.py`.
- Tests: `tests/test_api.py` — endpoint auth/empty/schema/identifier tests +
  a `test_global_search_wired_in_command_palette` drift-guard. New headless
  browser QA `scripts/qa/verify_global_search.js` (login → Cmd+K → cross-project
  result shown → drawer opens).

**Validation:** `pytest tests/` → **199/199 passed**. Headless render QA
(`scripts/qa/qa-render.sh`) → PASS. Global-search QA
(`scripts/qa/verify_global_search.js`) → PASS (search "ProjectBase" surfaced a
HOME-project issue "Deploy ProjectBase…" and opened its drawer). Health
`:8120` OK. No schema change.

**Next:** remaining v1.1 backlog and North Star external-gated items (public
demo domain + first-stranger onboarding) still need human input.

## Cycle-33 shipped (2026-08-25): runtime-editable notification channel settings

**Goal:** close the self-host zero-friction gap for external notifications. The
dispatcher (`app/pb_hooks/60_notifications.pb.js`) only read channel config from
process environment (`DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, `PROJECTBASE_WEBHOOK_URL`), so changing a webhook meant
editing env + restarting the binary. This cycle makes channels configurable
in-app with immediate effect.

**Shipped this cycle:**
- `app/pb_migrations/1710000019_notification_settings.js` — additive, idempotent
  `notification_settings` singleton collection (discord_webhook_url,
  telegram_token, telegram_chat_id, generic_webhook_url). Locked API rules
  (create/read/update/delete null) so only the admin-gated routes touch it.
- `app/pb_hooks/30_custom_routes.pb.js` — `GET`/`PUT
  /api/projectbase/notification-settings`, admin/manager/superuser-gated. Reads
  the DB row (falling back to env on fresh installs). Helpers inlined per the
  Goja module-scope function limitation.
- `app/pb_hooks/60_notifications.pb.js` — dispatcher now reads the DB row first,
  falling back to env, so configured channels apply without a restart.
- `app/pb_public/js/components/NotificationSettingsModal.js` — new modal with
  Discord webhook, Telegram token + chat ID, generic webhook fields, loading +
  save states. Opened from a header gear button.
- Wiring: `app.js` (component + `isNotificationSettingsOpen` +
  `handleNotificationSettingsSaved`), `Header.js` (`open-notification-settings`
  emit), `index.html` (binding + script include), `sw.js` precache.
- Agent surface: `openapi.json` (`/projectbase/notification-settings` GET/PUT +
  Notifications tag), `llms.txt` / `llms-full.txt`, and two FastMCP tools
  (`get_notification_settings`, `update_notification_settings`).
- Tests: `tests/test_api.py` — auth gate, GET/PUT roundtrip, frontend
  drift-guard (`test_notification_settings_wired_in_frontend`). Headless
  render-QA E2E added to `render_dom_check.js` (opens modal, asserts all four
  fields, saves, asserts success message).

**Validation:** `pytest tests/` → **202/202 passed** (199 + 3 new).
`python3 -m flow.frontend_guard` → ALL FRONTEND FILES VERIFIED. Headless render
QA (`scripts/qa/qa-render.sh`) → **PASS** with `notifSettings` all green
(modal opens, all fields render, save shows the success toast). Health `:8120`
OK. iBrowse visual QA was attempted but the homelab service timed out; the
headless render-QA fallback (project AGENTS.md) covers the same surface.

**Next:** remaining v1.1 backlog and North Star external-gated items (public
demo domain + first-stranger onboarding) still need human input.
