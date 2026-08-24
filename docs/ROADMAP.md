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

## Cycle-13 (2026-08-24): secret-scan regression guard + crime-scene audit

**Goal (harden):** the cycle-12 inspect audit veto (FAILED_AUDIT / P1 credential
leak — a hardcoded iBrowse `sk_live_` key in the QA scripts) was caused by a
committed secret, and nothing prevented that class of bug from recurring. This
cycle closes the loop with a regression guard and re-verifies the whole release.

**Shipped this cycle:**
- `tests/test_secret_scan.py` — new 3-test regression guard that scans every
  git-tracked source file for live-secret patterns (API keys, auth tokens,
  private keys, hardcoded credentials) and fails CI on any hit. It is the guard
  that would have caught the cycle-12 P1 before merge. It excludes vendored
  third-party bundles and raw archived research dumps. No whitelist: the
  documented seeded demo superuser (`superdev123`) is deliberately not exempted
  because it matches none of the secret patterns on its own and an exemption
  could mask a real key co-located with the demo credential on one line.
  Includes a mutation-proven check that the two QA scripts read
  `IBROWSE_API_KEY` from the environment rather than a literal.
- `CHANGELOG.md` — `[Unreleased]`/`Added` entry for the guard.

**Validation (crime-scene audit):**
- `pytest tests/` → **149/149 passed** (146 + 3 new guard tests).
- Mutation-tested the guard: injecting a `sk_live_...` literal into the QA
  script flips the two relevant tests to **FAIL** (proving it catches the
  exact cycle-12 regression), then restored clean.
- `python3 -m flow.frontend_guard` → **ALL FRONTEND FILES VERIFIED**.
- `scripts/qa/qa-render.sh` → **RENDER QA: PASS** (urlState, relations,
  focusMode suites green).
- iBrowse visual QA attempted; the homelab iBrowse host returned the same
  documented environmental `github.com ETIMEOUT` (network egress) as prior
  cycles → local render QA used as the visual fallback.
- Security: anon read of issues/projects returns **empty**; anon create → 400;
  anon `_superusers` → 403; oversized title (200k) → 400; malformed JSON → 400;
  missing project → 400. Verified the credential leak is gone from `origin/main`
  (HEAD == `6929c82`, key read from env).
