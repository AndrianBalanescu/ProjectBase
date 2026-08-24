# TODO

Refreshed 2026-08-24 (flow cycle 4). Items 1-4 audited against the codebase — all shipped; kept below with pointers, then open items.

## v1.0 direction (decided)

- C. ~~v1.0 direction: stabilization vs feature release~~ — ✅ **decided**: stabilization (paid 4-model debate, valid verdict, confidence 0.62). Build order + flip conditions in `docs/ROADMAP.md` § "v1.0 direction decided". Features (timeline/Gantt, portfolio dashboard, batch multi-select) defer to v1.1+.

## Shipped (verified in code)

1. ~~Resizable drawer~~ — ✅ shipped: drag handle + clamped width (420-1600px), localStorage persistence, double-click reset (commit 7175170). Fullscreen expansion not built; see open item A.
2. ~~URL routing~~ — ✅ shipped: hash router `#/PB/board|list|cycles|...` + issue deep links `#/PB/board/issue/<id>` with stale-drawer protection (`app.js applyRoute`).
3. ~~Clickable project cards~~ — ✅ shipped: whole card is `role="button"`, click + Enter opens board, star/delete stop propagation (`ProjectsView.js`).
4. ~~Multiselect component~~ — ✅ shipped: `js/components/Multiselect.js` (labels, assignees, custom select fields).

## Shipped in cycle 4 (2026-08-24)

- B. ~~URL state for filters, active tab, drawer width~~ — ✅ shipped: `?q=` / `?priority=` / `?cycle=` / `?w=` hash params round-trip through the router (shareable, reload-safe); 8 regression assertions in `scripts/qa/render_dom_check.js`. See `docs/ROADMAP.md` § "Cycle-4 shipped".

## Open (v1.0 stabilization order)

- A. Fullscreen / expanded description editing mode (drawer max-width is 1600px; a true focus mode is still missing) — next v1.0 item.
- D. Published benchmarks: RAM, cold start, 10k-issue query vs Plane CE.
- E. Security pass + CHANGELOG + versioned release packaging (CHANGELOG is absent today).
