# ProjectBase — Task Queue & Stabilization Checklist

## 🛑 STRICT RULES
- No more new epics. No fake enterprise SaaS modules.
- Focus on de-bloating `AgentsView.js` and perfecting the core Linear/Plane task management workflow.

## 🎯 Active Tasks

- [x] #P0 todo **De-bloat `AgentsView.js` to a Clean, Fast Console (<800 lines)**
  - Keep only: 1) Real Live Sessions Stream with PID/git diff, and 2) Direct Prompt Bar.
  - Remove all fake USD token billing, incident war rooms, AST scanners, and benchmark leaderboards.

- [x] #P0 todo **Safely Clean and Neutralize Balast Backend Hooks (112-119)**
  - Ensure all active API endpoints reflect real homelab infrastructure.
  - Maintain 100% test suite pass rate.

- [x] #P1 todo **Fix Mobile Viewport Horizontal Overflow (207px -> 0px)**
  - Ensure 0px horizontal scroll across all screens.

- [x] #P1 todo **Full Sceptic iBrowse & Pytest Verification**
  - Verify complete application health: 0 console errors, 0 page exceptions, fast load.

## ✅ Cycle 66-67 (keyboard shortcuts guide + QA hardening)

- [x] #P1 done **Keyboard shortcuts guide shipped & verified (cycle 66, PR #24)**
  - `?` key / toolbar (?) button / palette entry; ShortcutsModal with grouped bindings.
  - Dedicated E2E `scripts/qa/verify_shortcuts_modal.js` (cycle 67): PASS x5, iBrowse-harness limitation documented.

- [x] #P1 done **Local CI parity proven despite GitHub Actions billing block (cycle 67)**
  - `docker build` + fresh-container boot + `/api/health` all pass locally (image `projectbase:ci-check`).
  - Fixed local-only blocker: `pb_data/` mode 750 (projectbase:projectbase) made the legacy docker builder fail to stat the context; now 755.

- [x] #P2 done **Normalize QA credential env vars (QA_PASS vs QA_PASSWORD)** (cycle 70)
  - `QA_PASSWORD` is now the canonical var (accepting `QA_PASS` as fallback for one release) across `render_dom_check.js`, `verify_shortcuts_modal.js`, `verify_welcome_modal.js`, `verify_export_modal.js`, `verify_global_search.js`.

## ✅ Cycle 73 (harden: veto housekeeping + dual-gate re-verification)

- [x] #P1 done **Cycle-72 FAILED_AUDIT veto proven false and cleared**
  - Inspect-72 session hit the 3600s timeout mid-verification and never wrote `/tmp/flow-inspect-result.json`; the supervisor log-fallback then matched 3 echoed `FAILED_AUDIT` tokens from the auditor reading the stale cycle-70 veto file (housekeeping `cat`), not a real verdict.
  - Ground truth re-established this cycle: `uv run --with pytest pytest tests/` = 546 passed / 0 failed (181s); `scripts/qa/qa-render.sh` = RENDER QA: PASS (0 console/page errors, 0 failed requests, 0 4xx, no header/page overflow at 1440px; routing, resize, bulk, range, deep-link, export/import, dispatch, docs checks all green).
  - Repo clean and synced: main == origin/main (10bbc16), zero uncommitted product changes at veto time.
- [x] #P2 done **NEXT_DEV_TASK "Fix the idle-kill observer lie" closed**
  - Referent (1) flomaster idle-kill contract: PR #7 merged (confirmed by cycle-68 inspect notes).
  - Referent (2) iBrowse false-negative observer: worker/audio capture traps (iBrowse 2d7a0f1) + inspector settle window (cf915ef); `bun test src/__tests__/health-trap-observer.test.ts` = 7 pass / 0 fail; iBrowse main == origin/main.
- [x] #P2 note **Broken `~/.local/bin/pytest` symlink (achiles deprecation debris)** — points to removed `/home/ubuntu/dev/achiles/.venv/bin/pytest`; use `uv run --with pytest pytest tests/` (AGENTS.md-canonical) until relinked.
