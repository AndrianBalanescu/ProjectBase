# ProjectBase — Roadmap (synthesized from cycle-1 debate verdict)

> Source: `docs/research/debates/debate-verdict-cycle-1.md` (flow-debate-v1, paid).
> **Validator: INVALID — status INCONCLUSIVE** (only 1 of 4 models completed
> rounds; quorum R1=1/3; confidence 0.52). `flow_debate.py --validate` →
> `valid: false`. Direction aligns with the cycle-1 teardown
> (`research/COMPETITORS.md`), so we proceed tentatively, but **the debate must
> be rerun at the start of cycle 2** before this build order is treated as
> decided, per the pipeline rule (invalid verdict → rerun before gates).

## Build order (cycles 2-4)

1. **Cycle 2 — Importers (A) + keyboard polish start (B)**
   - A: Linear (CSV/JSON), GitHub issues, Plane export importers as pb_hooks routes + UI drawer. Attacks the loudest user pain (migration lock-in) with zero code shipped today.
   - B: keyboard command palette scaffold — independent code path (pb_public vs pb_hooks), same-cycle build avoids the "import, then exit" trap.
2. **Cycle 3 — Custom fields (C) + keyboard completion**
   - C is an additive PocketBase JSONField column — no schema rework, no migration pain, safe to defer.
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

**Validation (crime-scene audit):** `pytest -v` **34 passed / 1 skipped**,
`flow.frontend_guard` clean, iBrowse visual QA **SUCCEEDED** (no console errors / no click
blockers). Commits pushed to origin/main.

**Cycle 5 (next):** keep shipping to strangers. Possible next blockers to check:
stranger signup UX (disable public registration is documented, but a real first-timer flow
needs a clear signup/onboarding path), CI docker-build job, or a public demo deployment
script per the demo guidance. Custom fields / multi-tenancy only on real demand.


