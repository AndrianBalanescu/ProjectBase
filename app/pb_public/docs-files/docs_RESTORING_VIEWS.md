# Restoring an archived view

The de-bloat pass (`9db8b89`, `2d98052`) removed four views. Their components
still live on the archive tags, and their data model never left. This runbook
restores one mechanically. `TimelineView` was restored this way in `c2b30e8`
and is the worked example.

## What is available

| View | Archive file | API methods needed | Status on `main` |
|------|--------------|--------------------|------------------|
| TimelineView (Gantt) | `app/pb_public/js/components/TimelineView.js` (281 L) | **none** (pure props) | **restored** in `c2b30e8` |
| PortfolioView | `.../PortfolioView.js` (282 L) | `getIssues`, `getMilestones`, `getProjects` | removed; all 3 methods still in `api.js` |
| StatsView | `.../StatsView.js` (173 L) | `getStats`, `getActivity` | removed; both methods still in `api.js` |
| DocsView | `.../DocsView.js` (366 L) | **none** (static + runtime origin) | removed; `/docs` Scalar route is the replacement |

Source of truth for the files: tag **`archive/feature-creep-full`**
(`b9ee336`). The maximal agents UI is on `archive/maximal-agents-ui`.

Confirm the methods still exist before starting:

```bash
for m in getIssues getMilestones getProjects getStats getActivity; do
  printf '%-14s %s\n' "$m" \
    "$(grep -cE "^  async $m\(|^  $m\(" app/pb_public/js/api.js)"
done
```

## The wiring contract

`tests/test_shell_consistency.py` is the checklist. A view id must be wired in
**eight** surfaces, and the test names each one you missed:

1. **Component file** under `app/pb_public/js/components/<Name>.js`
2. **Script include** in `index.html` (next to the sibling views)
3. **Render branch** in `index.html` (`v-else-if="currentView === '<id>'"`)
4. **Vue registration** in `app.js` `components` (`'<id>-view': <Name>Component`)
5. **`applyRoute()` viewMap** in `app.js` (`<id>: '<id>'`), and drop any
   `legacyViewMap` remap that pointed it somewhere else
6. **Keyboard handler** in `app.js` (a digit in nav order) **and** the
   `ShortcutsModal` "Switch Views" list (same digit, same order)
7. **CommandPalette** action (`change-view', '<id>'`) and the **Header** tab
   strip (`{ id: '<id>', label: ..., icon: ... }`)
8. **Service Worker** precache list in `sw.js` **and** bump `CACHE_NAME`
   (`projectbase-shell-v<N>` → `v<N+1>`) so installed shells re-fetch

Then move the id from "removed" to "live" in the tests that pin the debloat:

- `tests/test_shell_consistency.py`: add to `VIEWS` and `KEYBOARD_VIEWS`
  (and the expected ShortcutsModal labels), in navigation order
- `tests/test_css_sync.py`: remove it from the `Portfolio/Stats/Docs`
  absent-loop, add the positive "fully wired" assertions
- `tests/test_api.py::test_removed_views_redirect_without_shipping_duplicate_assets`
- `tests/test_bulk_actions.py` (only the schedule-fields test touches views)

## Verify

```bash
bash scripts/build_css.sh                      # new classes -> static CSS
~/.local/bin/pytest tests/test_shell_consistency.py tests/test_css_sync.py -q
~/.local/bin/pytest tests/ -q                  # full suite
NODE_PATH=/home/ubuntu/.hermes/hermes-agent/node_modules \
  node scripts/qa/probe_deeplinks.js           # every route renders non-blank
NODE_PATH=... node scripts/qa/probe_view_keys.js   # digit map + bars
```

Update the `N tests across M files` count in `AGENTS.md` if you added tests
(`tests/test_agents_drift_guard.py` fails otherwise).

## Product boundary

Restoring is cheap, but only restore a view that fits ProjectBase's scope
(Kanban, List, Cycles, Timeline, Milestones, Projects, Sessions). **Portfolio
and Stats are dashboards**; they were removed for feature creep, not for cost.
Treat a restore as a product decision, and prefer the smallest change that
delivers the user value over reviving the archived implementation wholesale.
