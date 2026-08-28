# ProjectBase — Product Roadmap & Focus

## 🌟 Core Identity
**ProjectBase is the fastest, cleanest open-source Linear & Plane alternative.**
Focus: Ultra-fluid Kanban drag-and-drop, high-density List view, sprint Cycles, Milestone roadmaps, and instant Markdown issue drawers. Single binary PocketBase + Zero-build Vue 3, sub-50MB RAM.

---

## 🎯 Active Strategic Priority: De-bloat, Stabilization & Core Polish

### Phase 1: De-bloat & Consolidation (Immediate)
- **Refactor `AgentsView.js`:** Strip the 8,000-line bloated component down to a clean sub-800 line console (Live Sessions Stream + Simple Direct Prompt Bar).
- **Clean Balast Hooks (112-119):** Safely remove or simplify synthetic mock endpoints (fake USD billing, war rooms, AST scanners).
- **Align AI Stack:** Standardize 100% on real Homelab OmniRoute models (`omniroute/premium`, `omniroute/fast`, `vram/BAAI/bge-m3`).

### Phase 2: Core Task & Board Perfection
- **Kanban Board:** Fluid drag-and-drop, instant column status transitions, keyboard shortcuts (`Cmd+K`, `C` for create, `I` for import).
- **List View:** Multi-select shift+click range selection, instant bulk updates, column sorting.
- **Cycles & Milestones:** Precise burndown calculations, sprint velocity tracking.
- **Mobile Ergonomics:** 0px horizontal overflow across all viewports (Mobile 375px, Tablet 768px, Desktop 1440px).

### Phase 3: Sceptic Quality Verification
- 100% test coverage across core endpoints.
- Continuous real-browser iBrowse validation (0 console errors, 0 unhandled exceptions).
