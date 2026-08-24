# TODO

Refreshed 2026-08-24 (flow cycle 4). Items 1-4 audited against the codebase — all shipped; kept below with pointers, then open items.

## v1.0 direction (decided)

- C. ~~v1.0 direction: stabilization vs feature release~~ — ✅ **decided**: stabilization (paid 4-model debate, valid verdict, confidence 0.62). Build order + flip conditions in `docs/ROADMAP.md` § "v1.0 direction decided". Timeline/Gantt and portfolio dashboard defer to v1.1+; **batch multi-select shipped (cycle 16)**.

## Shipped (verified in code)

1. ~~Resizable drawer~~ — ✅ shipped: drag handle + clamped width (420-1600px), localStorage persistence, double-click reset (commit 7175170). Fullscreen expansion not built; see open item A.
2. ~~URL routing~~ — ✅ shipped: hash router `#/PB/board|list|cycles|...` + issue deep links `#/PB/board/issue/<id>` with stale-drawer protection (`app.js applyRoute`).
3. ~~Clickable project cards~~ — ✅ shipped: whole card is `role="button"`, click + Enter opens board, star/delete stop propagation (`ProjectsView.js`).
4. ~~Multiselect component~~ — ✅ shipped: `js/components/Multiselect.js` (labels, assignees, custom select fields).

## Shipped in cycle 4 (2026-08-24)

- B. ~~URL state for filters, active tab, drawer width~~ — ✅ shipped: `?q=` / `?priority=` / `?cycle=` / `?w=` hash params round-trip through the router (shareable, reload-safe); 8 regression assertions in `scripts/qa/render_dom_check.js`. See `docs/ROADMAP.md` § "Cycle-4 shipped".

## Open (v1.0 stabilization order)

- A. ~~Fullscreen / expanded description editing mode~~ — ✅ **shipped (cycle 5)**: distraction-free focus mode. A "Focus" button in the drawer's Description header opens a fullscreen overlay (z-60) with a centered max-w-3xl editor, Rich/Raw/Preview tabs, AI Enhance PRD, and a Done button; Esc saves & exits. Verified via headless render QA (button shown, overlay opens, editor renders, Esc closes). See `docs/ROADMAP.md` § "Cycle-5 shipped".
- D. ~~Published benchmarks: RAM, cold start, 10k-issue query vs Plane CE.~~ — ✅ **shipped (cycle 6)**: reproducible stdlib harness `scripts/bench/bench.py` + published results in `docs/BENCHMARKS.md`. See `docs/ROADMAP.md` § "Cycle-6 status".
- E. ~~Security pass + CHANGELOG + versioned release packaging~~ — ✅ **shipped (cycle 7)**: `CHANGELOG.md` created (Keep-a-Changelog + SemVer), stale `v0.8.0` header badge fixed to `v0.9.0`, `bump_version.sh` now keeps header badge + custom-routes version in sync, security pass verified (anon no-leak, member no-escalation, cross-tenant isolation). See `docs/ROADMAP.md` § "Cycle-7 shipped".
- F. ~~Batch multi-select + bulk actions (v1.1 feature 1)~~ — ✅ **shipped (cycle 16)**: board/list checkboxes, select-all, Esc clear, floating status/priority/cycle bar, admin/manager bulk delete (REST). See `docs/ROADMAP.md` § "Cycle-16 shipped".
- G. ~~Shift+click range selection (v1.1 feature 2)~~ — ✅ **shipped (cycle 17)**: Linear-style anchor→target range on board (column order) and list (sort order), both directions, union with current selection, anchor reset on Esc/project switch/realtime delete. 15-assertion render-QA range suite incl. cross-column span + range→bulk-apply E2E (create 3, select, move to todo, verify, cleanup-verify). See `docs/ROADMAP.md` § "Cycle-17 shipped".
- H. ~~Bulk custom-field editing (v1.1 feature 3)~~ — ✅ **shipped (cycle 18)**: bulk-bar Custom picker (per-project defs; text/number/select/checkbox/date) + backend fix where custom-field bulk updates were silent no-ops (`custom_*` phantom columns) or wholesale-replaced the `custom_fields` object. Now merges a partial object per record (null/'' clears one key); optimistic local apply mirrors the merge. 2 new pytest cases + render-QA E2E proving unrelated custom values survive. See `docs/ROADMAP.md` § "Cycle-18 shipped".
