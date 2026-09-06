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
