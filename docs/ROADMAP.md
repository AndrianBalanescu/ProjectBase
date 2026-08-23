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
