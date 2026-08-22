# ProjectBase — Roadmap (synthesized from cycle-1 debate verdict)

> Source: `docs/research/debates/debate-verdict-cycle-1.md` (flow-debate-v1, paid).
> **Caveat:** only 1 of 4 models completed rounds (quorum R1=1/3) — verdict is
> INCONCLUSIVE at confidence 0.52. Direction aligns with the cycle-1 teardown
> (`research/COMPETITORS.md`), so we proceed, but re-validate in cycle 2 with a
> rerun debate or the falsifiable test below.

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
