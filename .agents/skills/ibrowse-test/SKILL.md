---
name: ibrowse-test
description: "Sceptic browser auditor and E2E visual QA engine. Tests all ProjectBase UI/UX, layouts, live interactions, modals, drawers, dark/light themes, drag-and-drop, and responsive viewports via iBrowse / Playwright. Enforces 0 console errors, 0 overflow px, and generates concrete audit reports with visual proof."
---

# `ibrowse-test` — ProjectBase Sceptic Browser Auditor & E2E Visual QA

This skill turns iBrowse / Headless Chromium into an **uncompromising, sceptic QA auditor** for ProjectBase (`http://127.0.0.1:8120` or `http://homelab:8120`).

---

## 🔑 Authentication & Environment Credentials

The skill has pre-configured access to ProjectBase authentication:

- **Target App URL:** `http://127.0.0.1:8120/` (or `http://homelab:8120/`)
- **Superuser Email:** `f@flow.com`
- **Superuser Password:** `superdev123`
- **iBrowse Service URL:** `http://127.0.0.1:3000` (or `http://homelab:3000`)
- **iBrowse API Key:** `$IBROWSE_API_KEY` (auto-read from environment)
- **Local Storage Auth Keys:** `pb_auth` and `pocketbase_auth` (stores `{"token": "...", "record": {...}}`)

When driving the browser, iBrowse will automatically log in if the login modal or `/login` screen is presented, or inject the valid auth token directly into `localStorage`.

---

## 🎯 Mandatory Audit Checklist (Zero Compromise)

Whenever UI, CSS, Vue templates, or user interactions are modified or audited, this skill verifies:

1. **Console & Runtime Errors:**
   - Strict requirement: **`console_errors === 0`** and **`page_errors === 0`**.
   - No unhandled promise rejections, No 404/500 asset or API requests.
2. **Layout & Overflow Integrity:**
   - Strict requirement: **`document.documentElement.scrollWidth <= window.innerWidth`** (Horizontal overflow = **0 px**).
   - No clipped modals, broken flexbox wrappers, or overlapping z-index elements.
3. **Responsive Breakpoints:**
   - **Mobile (375x667):** Drawer collapses cleanly, navigation remains touch-accessible.
   - **Tablet (768x1024):** Sidebar collapses or adapts, Kanban columns scroll gracefully.
   - **Desktop (1440x900):** Multi-column board layout, full drawer split-view, resizable drag-handles work smoothly.
4. **Interactive Logic & Workflows:**
   - **Kanban Board:** Drag-and-drop between columns (Backlog → Todo → In Progress → Done).
   - **Issue Drawer:** Open issue, inline edit title/description, resize drawer, fullscreen focus mode.
   - **Command Palette (`Cmd+K` / `Ctrl+K`):** Search issues, jump to views, trigger quick task modal.
   - **Live Runs Stream (`#/pb/runs`):** Live PID badges, git diff view, test verdict badges.
   - **Milestones & Cycles:** Burndown charts, progress percentages, milestone achieving workflows.
   - **Theme & Styles:** Dark mode and Light mode visual contrast and font clarity.

---

## 🛠️ How to Execute the Sceptic Audit

### Option 1: Automated Sceptic Audit Runner (Instant Local Playwright)
```bash
# Run the complete headless sceptic audit suite with computed style & DOM checks
bash scripts/qa/qa-render.sh 8120

# Run full interactive 10-scenario E2E audit with login & assertion verification
bash scripts/qa/run_10_ibrowse_e2e.sh
```

### Option 2: Live Homelab iBrowse Agent Automation
```bash
# Trigger iBrowse container on homelab (:3000)
bash /home/ubuntu/flow/scripts/qa/flow-ibrowse.sh http://127.0.0.1:8120/
```

---

## 📊 Generating the Sceptic Audit Report

Every run produces a structured audit report with numerical evidence:

```markdown
### 🛡️ iBrowse Sceptic Audit Report
- **Target URL:** `http://127.0.0.1:8120/#/pb/board`
- **Auth Used:** `f@flow.com` (Superuser Admin)
- **Result:** ✅ PASS / ❌ VETO
- **Console Errors:** 0
- **Page / Unhandled Errors:** 0
- **Horizontal Overflow:** 0 px
- **Vue App Mounted:** Yes (Root container ready)
- **CSS Utility Match:** Yes (`box-sizing: border-box`, correct theme tokens)
- **Tested Views:**
  - `#/pb/board` (Kanban drag-and-drop: PASS)
  - `#/pb/list` (Multi-select bulk actions: PASS)
  - `#/pb/cycles` (Sprint burndown rendering: PASS)
  - `#/pb/milestones` (North Star roadmap: PASS)
  - `#/pb/runs` (Live session stream: PASS)
  - `#/pb/board/issue/:id` (Drawer resizer & focus editor: PASS)
- **Visual Evidence:** Screenshots saved to `docs/qa/ibrowse-audit-<timestamp>.png`
```

---

## 🚫 Veto Triggers (Immediate Rejection)
- Any red console error or unhandled JS exception.
- Horizontal page overflow causing sideways scroll on standard screens.
- Broken Vue reactive binding displaying unrendered `{{ mustache }}` tags.
- Modals or dropdowns cut off by parent `overflow: hidden`.
