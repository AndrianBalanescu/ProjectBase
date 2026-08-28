# ProjectBase — Execution-Native Architecture & Roadmap

## 🌟 Grand North Star Mission
Build **ProjectBase** into the world's fastest, zero-friction, **execution-native AI agent orchestration and software engineering workspace** — where **agent sessions ARE live cards**, code diffs and test verdicts **ARE ground truth**, and human intent seamlessly compiles into multi-agent autonomous delivery with zero bureaucratic overhead.

---

## 🏛️ Fundamental Architecture: "Session-as-a-Card"
ProjectBase eliminates the "agent secretarial tax" (where coding agents waste 40% of their tokens and context managing tickets, columns, and synthetic status comments). Instead, ProjectBase establishes a clean two-layer architecture:

1. **Strategic Intent Plane:** High-level goals, epics, milestones, and architectural specs authored by humans or strategic orchestrators.
2. **Execution Plane (Session-as-a-Card):** Every active Flomaster, Hermes, Cursor, or Flow agent process is automatically ingested and displayed as a live execution run with real-time PID state, file touched streams, git diffs, and test verdicts.

---

## 🎯 Active Strategic Milestones (Cycle 21+)

### 🏁 Milestone 1: Autonomous Session Ingestion & Process Lifecycle
- Ingest all agent sessions automatically from `~/.flomaster/sessions/` and system process tables.
- Hierarchical deterministic project mapping:
  1. Git working directory (`git rev-parse --show-toplevel`)
  2. Git remote origin URL (`git config --get remote.origin.url`)
  3. Session metadata / project tags (`meta.json`)
  4. Global supervisor fallback (`flow.conf`)
- Live process state machine: `spawning` → `running` (PID alive) → `verifying` → `completed` (exit 0) / `failed` (nonzero/error).
- Zero agent tax: Agents write code, run tests, and make git commits; the daemon and hooks handle all board updates.

### 🏁 Milestone 2: Dual-Plane Workspace UI (Intent vs. Live Runs)
- **Intent View:** Fast Kanban / List / Cycle sprint board for North Star objectives and user stories.
- **Live Runs Stream:** Dedicated real-time view showing active agent sessions across all projects, active files, live log tails, and git hashes.
- Automatic docking: Running sessions automatically attach to their parent Intent tickets and mark them complete upon verified test suites.

### 🏁 Milestone 3: Deep Observability & Ground Truth Verification Hub
- In-browser visual Git Diff, commit logs, and syntax-highlighted patches for every session card.
- Test verdict parsing: Pytest, Playwright, and iBrowse test logs parsed into structured visual badges (Pass/Fail count, duration, coverage).
- Automated sceptic audit reports (Flow Inspect) linked directly to the session run.

### 🏁 Milestone 4: One-Click Re-Tasking, Branching & Session Forking
- One-click "Fork / Continue Session" from any completed or failed run with full preserved context and diffs.
- Human intervention gate: pause live runs, edit intent/constraints, and resume without losing session memory.

### 🏁 Milestone 5: Multi-Engine Swarm Choreography & DAG Workspaces
- Visual Task DAGs for orchestrating concurrent multi-agent tracks (e.g. Backend Migration + Frontend Zero-Build + Playwright QA).
- Autonomous capacity reservation, worktree isolation, and conflict prevention.
- Neural BGE-M3 + Cross-Encoder admission brain safeguarding the intent board against duplication.

### 🏁 Milestone 6: High-Performance FOSS Zero-Build Ecosystem
- Single binary PocketBase + Zero-build Vue 3 UMD + compiled Tailwind CSS.
- Sub-50MB RAM footprint, instant SQLite performance, real-time SSE.
- 100% Free & Open-Source (MIT). Strictly no monetization, subscriptions, or paywalls.

---

## 📜 Shipped Historical Milestones (Cycles 1-20)
- **Cycle 20 (Epic 23):** Autonomous Semantic Review, Dual-Engine BM25 + Dense RRF & Neural BGE-M3 / BGE-Reranker-v2-m3 Admission Brain.
- **Cycle 19 (Epic 22):** Autonomous Agent Auto-Healing, Self-Remediation & Diagnostic Playbook Pipeline.
- **Cycle 18 (Epic 21):** Multi-Tenant Workspace Isolation, Resource Quotas & Organization Billing Engine.
- **Cycle 17 (Epic 20):** Workflow Automations & AI Agent Trigger Pipelines.
- **Cycle 16 (Epic 19):** Enterprise OIDC / SAML SSO Federation & Granular Workspace RBAC Matrix.
- **Cycles 1-15:** FastMCP, Importers, Burndown Cycles, Milestones, Swarm DAGs, Cluster Edge Replication, and Real-time SSE.
