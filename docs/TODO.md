# TODO

Refreshed 2026-08-24 (flow cycle 2). Items 1-4 audited against the codebase — all shipped; kept below with pointers, then open items.

## Shipped (verified in code)

1. ~~Resizable drawer~~ — ✅ shipped: drag handle + clamped width (420-1600px), localStorage persistence, double-click reset (commit 7175170). Fullscreen expansion not built; see open item A.
2. ~~URL routing~~ — ✅ shipped: hash router `#/PB/board|list|cycles|...` + issue deep links `#/PB/board/issue/<id>` with stale-drawer protection (`app.js applyRoute`). Filter/tab URL state not covered; see open item B.
3. ~~Clickable project cards~~ — ✅ shipped: whole card is `role="button"`, click + Enter opens board, star/delete stop propagation (`ProjectsView.js`).
4. ~~Multiselect component~~ — ✅ shipped: `js/components/Multiselect.js` (labels, assignees, custom select fields).

## Open

- A. Fullscreen / expanded description editing mode (drawer max-width is 1600px; a true focus mode is still missing).
- B. URL state for filters, active tab, drawer width (deep links cover project/view/issue only).
- C. v1.0 direction: stabilization vs feature release — in paid 4-model debate (flow cycle 2), verdict will land in ROADMAP.md.
