# ProjectBase – Candidate Roadmap (Epics)

**Current Cycle:** 10
**Focus:** Autonomous Agent Swarm Choreography, Task Graph DAG Execution, Persona Roles & Validation Checkpoints

## Epic 0 – Core CRUD (✅ Done)
- Projects, issues, cycles, users
- Basic auth and roles
- Schema migrations

## Epic 1 – Fluid Kanban & List Views (✅ Done)
- SortableJS drag-and-drop
- Real-time SSE updates
- List view with sorting/filtering

## Epic 2 – Markdown Drawer & Subtasks (✅ Done)
- Full markdown descriptions
- Subtask checklist
- Attachments

## Epic 3 – Custom Fields (✅ Done)
- Text, number, select, date fields
- Per-project configuration

## Epic 4 – AI Agent Integration (✅ Done)
- [x] FastMCP server (`app/pb_hooks/91_mcp_server.pb.js`): `list_projects`, `list_issues`, `get_issue`, `create_issue`, `update_issue`, `move_issue`, `add_comment`, `list_cycles`, `list_milestones`, `search_issues`, `dispatch_agent`, `get_stats`
- [x] AgentsView UI component (`pb_public/js/components/AgentsView.js`)
- [x] Agent dispatch endpoint (`app/pb_hooks/80_agent_triggers.pb.js`)
- [x] Agent discovery bridge (`app/pb_hooks/90_agents.pb.js`)

## Epic 5 – Import/Export (✅ Done)
- Linear, Plane, GitHub importers
- CSV/JSON export

## Epic 6 – Notifications (✅ Done)
- In-app notifications
- Email (optional)

## Epic 7 – Performance & Polish (✅ Done)
- [x] Performance indexes (migrations `1710000008` + `1710000021`)
- [x] Frontend keyboard shortcuts (`n`/`c` new issue, `e` export, `i` import, `1`-`8` views, `Esc` close)
- [x] OpenAPI drift repair & FastMCP HTTP JSON-RPC 2.0 specification (`/projectbase/mcp`)
- [x] Frontend render & data cache hardening (`loadAllData` project instance synchronization)
- [x] Headless render DOM QA validation (0 failures, 100% pass)

## Epic 8 – Production Benchmarking & Multi-Host Packaging (✅ Done)
- [x] FastMCP server expanded with `get_issue`, `add_comment`, `list_cycles`, `list_milestones`, `search_issues`, `dispatch_agent`, and full Kanban status support (`backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled`)
- [x] Cold-start & memory load benchmarking (warm cold start 51.8 ms, idle RSS 53.9 MB, loaded RSS 56.4 MB)
- [x] Automated agent workflow benchmark harness (`scripts/bench/agent_workflow_bench.py`) & CI test (`tests/test_benchmarks.py`)
- [x] Verified FastMCP JSON-RPC 2.0 endpoint suite (`tests/test_api.py`)

## Epic 9 – Real-Time Multi-Agent Collaboration & SSE Stream Telemetry (✅ Done)
- [x] Multi-agent task lease/lock mutual exclusion to prevent collision on concurrent issue execution (`/api/projectbase/leases/acquire`, `renew`, `release`, `task_leases` collection with TTL expiration)
- [x] FastMCP collaboration tools (`acquire_task_lease`, `release_task_lease`, `renew_task_lease`, `get_task_lease`, `log_agent_telemetry`, `register_webhook`, `list_webhooks`, `delete_webhook`)
- [x] Real-time agent activity & reasoning trace telemetry ingestion (`/api/projectbase/telemetry`)
- [x] Outbound event webhooks subscription engine & HTTP event dispatcher for external orchestrators (Hermes, Windmill, Flomaster swarm coordinator)
- [x] 238/238 automated tests passing across 13 test suites

## Epic 10 – Autonomous Agent Swarm Choreography & Task Graph Decomposition (✅ Done)
- [x] Multi-step parent/child issue task graph DAG execution with Kahn's algorithm cycle rejection (`/api/projectbase/dag/decompose`, `/api/projectbase/dag/status`, `/api/projectbase/dag/step`)
- [x] Dynamic subtask splitting and assignment across specialized agent personas (`/api/projectbase/tasks/split`, `task_persona` and `parent_issue` fields)
- [x] Automated peer-review and validation checkpoints before issue completion (`/api/projectbase/checkpoints/submit`, `/api/projectbase/checkpoints`, `task_checkpoints` collection)
- [x] FastMCP JSON-RPC 2.0 & Python client tools (`decompose_task_graph`, `get_dag_status`, `execute_dag_step`, `split_subtasks`, `submit_validation_checkpoint`, `get_validation_checkpoints`)
- [x] 245/245 automated tests passing across 14 test suites with warm cold-start at 51.8 ms

## Epic 11 – Autonomous Workspace Synthesis & Cross-Project Knowledge Retrieval (✅ Done)
- [x] Vector-free SQLite FTS5 / tokenized semantic workspace indexing across issues, comments, checkpoints, and telemetry (`/api/projectbase/workspace/search`)
- [x] Dynamic cross-project blocker detection, circular deadlock warnings, and critical path analysis (`/api/projectbase/workspace/blockers`)
- [x] Automated sprint/cycle retrospective generation and agent productivity metrics (`/api/projectbase/workspace/retrospective`)
- [x] FastMCP collaboration tools (`workspace_search`, `get_workspace_blockers`, `generate_retrospective`)
- [x] 258/258 automated tests passing across 15 test suites with 100% headless DOM QA pass

---

## Epic 12 – Advanced Multi-Host Federation, Real-Time Agent Stream UI & Autonomous Anomaly Detection Engine (✅ Done)
- [x] Multi-instance / cross-workspace project sync & federation bridge with SHA-256 data integrity checksums (`/api/projectbase/federation/export`, `/api/projectbase/federation/import`, `/api/projectbase/federation/sync`)
- [x] Resilient conflict resolution strategies (`merge`, `overwrite`, `skip_existing`) with foreign-key re-mapping for distributed nodes
- [x] Diagnostic anomaly detection engine scanning for dead agent leases, rapid failure loops, circular deadlocks, and starvation (`/api/projectbase/analytics/anomalies`)
- [x] One-click and automated remediation (`auto_heal=true`) to revoke expired locks and escalate stalled items
- [x] Real-time agent persona throughput analytics (MTTC in minutes, checkpoint pass rates %, velocity forecast) (`/api/projectbase/analytics/throughput`)
- [x] FastMCP JSON-RPC 2.0 tools (`export_federation_bundle`, `import_federation_bundle`, `get_agent_analytics`, `detect_workflow_anomalies`)
- [x] Frontend AgentsView tabs for live chat, workflow health diagnostics, persona throughput metrics, and federation sync
- [x] 270/270 automated tests passing across 16 test suites with 100% frontend guard

---

## Epic 13 – Autonomous Agent Code Sandbox, Git Artifact Workspace Engine & Webhook Auto-Triage (✅ Done)
- [x] Git Artifacts Tracking Engine (`/api/projectbase/git/artifacts`, `/api/projectbase/git/status`) for branches, commit SHAs, PR states, CI workflow runs, and unified diff patches
- [x] Autonomous Kanban Stage Transitions: active branch -> `in_progress`, open PR -> `in_review`, merged PR -> `done` with auto-sync
- [x] Staged Code Patch Sandbox (`POST /api/projectbase/git/patch`, `GET /api/projectbase/git/patch/{id}`) for unified diff inspection and syntax-styled metrics
- [x] Universal Git Webhook Receiver (`POST /api/projectbase/webhooks/git`) with case-insensitive GitHub/GitLab headers and regex-free issue token triage
- [x] FastMCP JSON-RPC 2.0 tools (`link_git_commit`, `link_git_pr`, `get_issue_git_artifacts`, `stage_code_patch`, `process_git_webhook`, `get_project_git_status`)
- [x] Frontend IssueDrawer **🌿 Git & Code** panel with 1-click copy `git checkout`, PR status chips, commit diff stats, and visual branch/PR indicators in Kanban/List
- [x] 283/283 automated tests passing across 17 test suites with 100% headless DOM QA and frontend guard pass verification

---

## Epic 14 – Autonomous Agent Autoscaling, Dynamic Workload Orchestration & Self-Healing Engine (✅ Done)
- [x] Real-time workload analytics and queue saturation engine (`/api/projectbase/agents/workload`) calculating persona queue depths, active leases, capacity, and estimated backlog clearance time
- [x] Dynamic persona autoscaler (`/api/projectbase/agents/autoscale`) generating horizontal worker allocation plans and concurrency scaling strategies
- [x] Worker slot capacity reservation engine (`/api/projectbase/agents/capacity/reserve`, `/api/projectbase/agents/capacity/release`) with TTL auto-expiration
- [x] Autonomous workflow self-healing engine (`/api/projectbase/workflow/self-heal`) detecting and auto-reconciling expired leases, orphaned DAG subtasks, and stalled statuses
- [x] Continuous live database latency benchmarking and WAL contention telemetry (`/api/projectbase/benchmarks/live`, `/api/projectbase/benchmarks/run`)
- [x] FastMCP JSON-RPC 2.0 tools (`get_agent_workload_status`, `calculate_autoscale_recommendations`, `reserve_agent_capacity`, `release_agent_capacity`, `run_workflow_self_heal`, `get_live_benchmarks`)
- [x] Frontend AgentsView **⚡ Workload & Autoscaler** dashboard with live saturation meters, persona breakdown, 1-click Auto-Heal, dynamic autoscaler optimizer, and live latency metrics
- [x] 299/299 automated tests passing across 18 test suites with 100% frontend guard verification

---

## Epic 15 – Distributed Cross-Cluster Replication, High-Availability Failover & Edge SQLite Sync (✅ Done)
- [x] Cluster peer node registration, discovery, role management (primary/replica/edge/witness), and live heartbeat telemetry (`/api/projectbase/cluster/nodes/register`, `GET /api/projectbase/cluster/nodes`, `POST /api/projectbase/cluster/nodes/heartbeat`, `DELETE /api/projectbase/cluster/nodes/{id}`)
- [x] Delta replication log stream pulling and vector clock checkpointing (`GET /api/projectbase/cluster/sync/pull`)
- [x] Delta mutation push engine with Lamport/vector clock conflict resolution and split-brain fencing barrier enforcement (`POST /api/projectbase/cluster/sync/push`)
- [x] Point-in-time state snapshot export bundle with SHA-256 integrity checksums for cold-start edge bootstrapping (`POST /api/projectbase/cluster/sync/snapshot`)
- [x] High-availability quorum health status and leader election monitor (`GET /api/projectbase/cluster/failover/status`)
- [x] Replica failover promotion with quorum consensus and fencing token generation (`POST /api/projectbase/cluster/failover/promote`)
- [x] Split-brain fencing token validation and barrier verification (`POST /api/projectbase/cluster/failover/fencing`)
- [x] Two-way offline-first SQLite edge reconciliation and unified vector clock synchronization (`POST /api/projectbase/cluster/edge/reconcile`)
- [x] FastMCP JSON-RPC 2.0 tools (`register_cluster_node`, `list_cluster_nodes`, `pull_cluster_deltas`, `push_cluster_deltas`, `get_cluster_failover_status`, `trigger_cluster_failover`, `reconcile_edge_sync`)
- [x] Frontend AgentsView **🌐 Cluster & Edge Replication** dashboard tab with quorum health meters, node fleet management, 1-click failover promotion, and delta sync
- [x] 312/312 automated tests passing across 19 test suites with 100% frontend guard and headless render QA verification

---

## Next Milestone (Cycle 17)
**Epic 16 – Webhook Automation Engine & Outbound Webhook Security Gateway (✅ Done)**
- [x] Cryptographic HMAC-SHA256 signature verification and replay prevention for external agent webhooks (`POST /api/projectbase/webhooks/verify`)
- [x] Declarative event filtering rules and dynamic payload transforms for Slack, Discord, Telegram, Agent, and custom integrations (`POST /api/projectbase/webhooks/dispatch`, `GET /api/projectbase/webhooks/transforms/preview`)
- [x] Real-time dead-letter queue (DLQ) retry backoff with exponential jitter and failure diagnostics (`GET /api/projectbase/webhooks/dlq`, `POST /api/projectbase/webhooks/dlq/retry`)
- [x] Endpoint fleet management, delivery audit history, 7 FastMCP tools, AgentsView Webhook Gateway & DLQ dashboard
- [x] 321/321 automated tests passing across 20 test suites with 100% frontend guard verification

---

## Milestone (Cycle 18)
**Epic 17 – OpenAPI Agent SDK Generation, Interactive Documentation & Webhook Observability (✅ Done)**
- [x] Turnkey client SDK code generator (`POST /api/projectbase/sdk/generate`, `GET /api/projectbase/sdk/languages`, `GET /api/projectbase/sdk/templates/{lang}`) producing production-ready typed client snippets for Python (`ProjectBaseClient`), TypeScript (`ProjectBaseClient`), JavaScript ESM, cURL CLI, and Agent Tool JSON Schemas
- [x] Real-time webhook & agent API observability telemetry engine (`GET /api/projectbase/observability/metrics`) tracking p50/p90/p95/p99 delivery latencies, throughput (req/min), error rate %, and latency bucket distributions
- [x] Automated observability alert threshold manager & evaluation engine (`GET/POST/DELETE /api/projectbase/observability/alerts*`) with configurable SLA violation triggers, multi-channel dispatch, and event breach recording
- [x] Interactive agent integration recipes and unified API specification (`GET /api/projectbase/docs/recipes`, `GET /api/projectbase/docs/spec`)
- [x] 7 FastMCP JSON-RPC 2.0 tools (`generate_agent_sdk`, `list_sdk_languages`, `get_api_schema_spec`, `get_webhook_observability_metrics`, `configure_alert_thresholds`, `get_observability_alerts`, `get_integration_recipes`)
- [x] Frontend AgentsView **📚 SDK & Observability** dashboard with interactive code generator, live KPI meters, SLA alert rule manager, and agent recipes explorer
- [x] 334/334 automated tests passing across 21 test suites with 100% frontend guard verification

---

## Milestone (Cycle 19)
**Epic 18 – Autonomous Multi-Model Consensus & Peer Review Gate Engine (✅ Done)**
- [x] Native multi-model AI consensus verification for critical issue merges, PRs, and releases (`/api/projectbase/consensus/gates*`, `consensus_gates` and `consensus_ballots` collections)
- [x] Cryptographically signed model peer-review ballots with deterministic SHA-256 signatures, quorum calculation, and divergence scoring (`/api/projectbase/consensus/ballots/submit`, `/api/projectbase/consensus/gates/evaluate`)
- [x] Automated 1-Click Multi-Model Debate orchestration engine (`/api/projectbase/consensus/debate/start`) with specialized persona lenses (SecurityAuditor, ArchitecturePragmatist, QASRE, BenchmarkAnalyst)
- [x] Workspace-wide consensus metrics & model participation analytics (`GET /api/projectbase/consensus/metrics`)
- [x] 7 FastMCP JSON-RPC 2.0 tools (`create_consensus_gate`, `submit_consensus_ballot`, `evaluate_consensus_gate`, `list_consensus_gates`, `get_consensus_gate_details`, `start_consensus_debate`, `get_consensus_metrics`)
- [x] Frontend AgentsView **⚖️ Consensus & Gates** dashboard with interactive gate creation, live quorum progress, verifiable ballot inspector, and 1-click multi-model debate
- [x] 343/343 automated tests passing across 22 test suites with 100% frontend guard verification

---

## Milestone (Cycle 20)
**Epic 19 – Enterprise OIDC / SAML SSO Federation & Granular Workspace RBAC Matrix (✅ Done)**
- [x] Enterprise SSO provider federation (Google Workspace, GitHub Enterprise, Okta, Keycloak) with OIDC discovery and Just-In-Time (JIT) user account provisioning (`GET /api/projectbase/sso/providers*`, `POST /api/projectbase/sso/auth/exchange`, `sso_providers` collection)
- [x] Granular role-based access control matrix with 7 system roles (owner, admin, maintainer, member, agent, viewer, auditor), custom role creation, and capability wildcards (`/api/projectbase/rbac/roles*`, `/api/projectbase/rbac/matrix`, `rbac_roles` collection)
- [x] User and agent role assignments, permission evaluator, and scoped API access tokens (`POST /api/projectbase/rbac/check`, `POST /api/projectbase/rbac/assign`, `POST /api/projectbase/rbac/tokens/create`, `rbac_assignments` and `rbac_scoped_tokens` collections)
- [x] Immutable security & access audit logging with filtering and JSON/CSV export (`GET /api/projectbase/rbac/audit-logs`, `POST /api/projectbase/rbac/audit-logs/export`, `security_audit_logs` collection)
- [x] 8 FastMCP JSON-RPC 2.0 tools (`list_sso_providers`, `configure_sso_provider`, `exchange_sso_token`, `check_rbac_permission`, `list_rbac_roles`, `assign_rbac_role`, `get_rbac_matrix`, `get_security_audit_logs`)
- [x] Frontend AgentsView **🛡️ Identity & RBAC** dashboard tab with live KPI meters, interactive SSO exchange simulator, 2D RBAC permissions matrix, live permission evaluator, and security audit log export
- [x] 354/354 automated tests passing across 23 test suites with 100% frontend guard and headless render QA verification

---

## Milestone (Cycle 21)
**Epic 20 – Native End-to-End Workflow Automations & AI Agent Trigger Pipelines (✅ Done)**
- [x] Event-driven workflow automation triggers on issue lifecycle events (status transition, priority change, label add, cycle lifecycle, manual) (`workflow_rules`, `workflow_runs`, `workflow_triggers_audit` collections)
- [x] Conditional action DAG execution (webhook dispatch, agent task assignment, notifications, subtask generation, comment posting, issue field updates) (`/api/projectbase/automations/*`)
- [x] Starter blueprint templates library and live execution test simulator
- [x] 8 FastMCP JSON-RPC 2.0 tools (`list_automation_rules`, `create_automation_rule`, `trigger_automation_pipeline`, `list_automation_runs`, `get_automation_run_details`, `retry_automation_run`, `get_automation_metrics`, `list_automation_templates`)
- [x] Frontend AgentsView **⚡ Automations & Pipelines** dashboard tab with live KPI meters, 1-click blueprint template applicator, interactive rule designer, live trigger simulator, and step trace execution history table
- [x] 362/362 automated tests passing across 24 test suites with 100% frontend guard and headless render QA verification

---

## Milestone (Cycle 22)
**Epic 21 – Native Cross-Workspace Multi-Tenant Tenant Isolation & Granular Resource Quotas (✅ Done)**
- [x] Multi-tenant workspace isolation boundaries, plan tiers (Free, Pro, Enterprise), and resource quota limits (`tenants`, `tenant_quotas`, `tenant_memberships` collections)
- [x] Dynamic tenant switcher, real-time resource usage metering, and quota enforcement gate engine (`/api/projectbase/tenants/*`)
- [x] 8 FastMCP JSON-RPC 2.0 tools (`list_tenants`, `create_tenant`, `get_tenant_details`, `configure_tenant_quotas`, `get_tenant_usage`, `check_tenant_quota`, `switch_tenant_context`, `get_tenant_metrics`)
- [x] Frontend AgentsView **🏢 Multi-Tenant & Quotas** dashboard tab with live KPI meters, interactive workspace provisioner, real-time quota gauges with visual utilization progress bars, dynamic quota enforcement gate simulator, and tenant memberships roster
- [x] 370/370 automated tests passing across 25 test suites with 100% frontend guard and headless render QA verification

---

## Milestone (Cycle 23)
**Epic 22 – Autonomous AI Agent Auto-Healing & Self-Remediation Workflow Pipeline (✅ Done)**
- [x] Self-remediating error correction triggers and automatic crash recovery (`auto_heal_policies`, `auto_heal_incidents`, `auto_heal_health_checks` collections)
- [x] Anomaly escalation policies, dynamic self-healing action scripts, and blueprint recipes library (`/api/projectbase/auto-heal/*`)
- [x] 8 FastMCP JSON-RPC 2.0 tools (`list_auto_heal_policies`, `create_auto_heal_policy`, `list_auto_heal_incidents`, `get_auto_heal_incident_details`, `trigger_auto_healing`, `resolve_auto_heal_incident`, `run_crash_recovery_sweep`, `get_auto_heal_metrics`)
- [x] Frontend AgentsView **🩺 Auto-Heal & Remediation** dashboard tab with live KPI meters, fleet diagnostics matrix, interactive incident log, 1-click blueprint recipe applicator, and custom policy builder
- [x] 381/381 automated tests passing across 26 test suites with 100% frontend guard and headless render QA verification

---

## Next Milestone (Cycle 24)
**Epic 23 – Autonomous Fine-Tuned Agent Prompt Synthesizer & Memory Distillation Engine**
- Agent episodic memory distillation into compressed semantic vectors and durable markdown cards
- Context-aware automated system prompt generation and continuous persona refinement
- FastMCP prompt compilation tools and AgentsView memory synthesis dashboard panel
