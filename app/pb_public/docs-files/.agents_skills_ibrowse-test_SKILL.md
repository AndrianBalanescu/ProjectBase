---
name: ibrowse-test
description: "Sceptic browser auditor and E2E visual QA engine. Tests all ProjectBase UI/UX, layouts, live interactions, modals, drawers, dark/light themes, drag-and-drop, and responsive viewports via iBrowse / Playwright. Enforces 0 console errors, 0 overflow px, and generates concrete audit reports with visual proof."
---

# `ibrowse-test` — ProjectBase Sceptic Browser Auditor & E2E Visual QA

This skill turns iBrowse into an **uncompromising, real-browser sceptic QA auditor** for ProjectBase (`http://127.0.0.1:8120/` or `http://homelab:8120/`).

---

## 🔑 Real Browser Login Sequence & Selectors

When iBrowse navigates to ProjectBase, it must perform the real UI login flow if the authentication gate is displayed.

### Login Credentials
- **Superuser Email:** `f@flow.com`
- **Superuser Password:** `superdev123`
- **Target URL:** `http://127.0.0.1:8120/` (or `http://homelab:8120/`)

### Exact UI Selectors for Browser Interaction
```js
// 1. Check if the login form is present
if (await page.isVisible('#login-email') || await page.isVisible('input[name="email"]')) {
  // If the form is in "Sign up" mode, switch to "Sign in"
  const signinToggle = page.locator("text='Sign in instead'");
  if (await signinToggle.isVisible()) {
    await signinToggle.click();
  }

  // 2. Fill credentials into real input fields
  await page.fill('#login-email', 'f@flow.com');
  await page.fill('#login-password', 'superdev123');

  // 3. Click the Submit button
  await page.click('#login-submit-button'); // or [data-testid="login-submit"]

  // 4. Wait for workspace to mount and auth gate to disappear
  await page.waitForSelector('header', { timeout: 10000 });
  await page.waitForSelector('#app', { timeout: 10000 });
}
```

---

## 🎯 Mandatory Sceptic Audit Checklist (Zero Compromise)

Whenever UI, CSS, Vue templates, or user interactions are modified or audited, iBrowse verifies:

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
   - **Real Browser Login:** Input typing, validation error rendering, session persistence.
   - **Kanban Board (`#/pb/board`):** Drag-and-drop between columns (Backlog → Todo → In Progress → In Review → Done).
   - **Issue Drawer (`#/pb/board/issue/:id`):** Open issue, inline edit title/description, resize drawer, fullscreen focus editor.
   - **Command Palette (`Cmd+K` / `Ctrl+K`):** Search issues, jump to views, trigger quick task modal.
   - **Live Runs Stream (`#/pb/runs`):** Live PID badges, git diff view, test verdict badges.
   - **Milestones & Cycles (`#/pb/milestones`, `#/pb/cycles`):** Burndown charts, sprint progress indicators.
   - **Theme & Styles:** Dark mode and Light mode visual contrast and font clarity.

---

## 🛠️ How to Execute the Sceptic Audit

### Option 1: Live Homelab iBrowse Agent Automation (Real Browser)
```bash
# Trigger iBrowse on homelab (:3000)
bash /home/ubuntu/flow/scripts/qa/flow-ibrowse.sh http://127.0.0.1:8120/
```

### Option 2: Automated 10-Scenario Interactive E2E Suite
```bash
# Run full 10-scenario suite with real browser interactions & login
bash scripts/qa/run_10_ibrowse_e2e.sh
```

### Option 3: Headless Playwright DOM & Geometry Check
```bash
# Run DOM probe, computed styles, and geometry validation
bash scripts/qa/qa-render.sh 8120
```

---

## 📊 Generating the Sceptic Audit Report

Every run produces a structured audit report with numerical evidence:

```markdown
### 🛡️ iBrowse Sceptic Audit Report
- **Target URL:** `http://127.0.0.1:8120/#/pb/board`
- **Real Browser Login:** ✅ SUCCESS (`#login-email` + `#login-password` -> `#login-submit-button`)
- **Result:** ✅ PASS / ❌ VETO
- **Console Errors:** 0
- **Page / Unhandled Errors:** 0
- **Horizontal Overflow:** 0 px
- **Vue App Mounted:** Yes (Root container ready)
- **CSS Utility Match:** Yes (`box-sizing: border-box`, correct theme tokens)
- **Tested Views & Workflows:**
  - `#/pb/board` (Kanban drag-and-drop: PASS)
  - `#/pb/list` (Multi-select bulk actions: PASS)
  - `#/pb/cycles` (Sprint burndown rendering: PASS)
  - `#/pb/milestones` (North Star roadmap: PASS)
  - `#/pb/runs` (Live session stream: PASS)
  - `#/pb/board/issue/:id` (Drawer resizer & focus editor: PASS)
- **Visual Proof:** Screenshot captured and linked
```

---

## 🚫 Veto Triggers (Immediate Rejection)
- Login fails or gets stuck on "Loading session...".
- Any red console error or unhandled JS exception.
- Horizontal page overflow causing sideways scroll on standard screens.
- Broken Vue reactive binding displaying unrendered `{{ mustache }}` tags.
- Modals or dropdowns cut off by parent `overflow: hidden`.
