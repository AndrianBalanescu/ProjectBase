# ProjectBase Task Brain — Execution-Native Milestones

## 🌟 Grand North Star
Transform ProjectBase into an Execution-Native AI Agent Workspace ("Session-as-a-Card").

## 🎯 Active Milestone Backlog

- [x] #P0 todo **Milestone 1: Session-Native Ingestion & Process Lifecycle**
  - Implement PocketBase collection `agent_sessions` and hook/daemon to ingest Flomaster/Hermes/Flow runs.
  - Track live PID state (spawning, running, verifying, completed, failed) and map deterministically via git root / remote origin / session meta.
  - Zero-tax execution: agents write code and run tests without manual Kanban MCP tool calls.

- [x] #P0 todo **Milestone 2: Dual-Plane Workspace UI (Intent Board vs. Live Execution Runs)**
  - Fast Vue 3 zero-build UI view: Intent View (Milestones/Epics) vs. Live Runs Stream (Live PID, files touched, logs).
  - Auto-docking: Completed sessions automatically resolve parent Intent tickets upon passing test verification.

- [ ] #P1 todo **Milestone 3: Deep Observability & Ground Truth Verification Hub**
  - In-browser visual Git Diff viewer, commit telemetry, and test verdict parser (Pytest / Playwright badges).
  - Sceptic audit reports (Flow Inspect) attached directly to the session run.

- [ ] #P1 todo **Milestone 4: One-Click Re-Tasking, Branching & Session Forking**
  - One-click "Fork / Continue Session" from any completed or failed run with preserved context and diffs.
  - Human intervention gate: pause, inject instructions, and resume without loss of session memory.

- [ ] #P2 todo **Milestone 5: Multi-Engine Swarm Choreography & Task DAGs**
  - Visual Task DAGs for coordinating multi-session tracks (Backend + Frontend + QA).
  - Dynamic capacity reservation, worktree isolation, and conflict prevention.

- [ ] #P2 todo **Milestone 6: High-Performance FOSS Zero-Build Ecosystem**
  - Single-binary PocketBase + Zero-build Vue 3 UMD + compiled Tailwind CSS.
  - Sub-50MB RAM footprint, instant SQLite performance, real-time SSE.
