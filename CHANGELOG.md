# Changelog

## [1.41.0] - 2026-09-07 - Cycle 91
### Removed (de-bloat, roadmap Phase 1)
- **Synthetic ballast engines stripped (hooks 112-123, 12 files, ~11.5k lines):** fleet budget/USD billing calculator, agent eval leaderboard/benchmarks, ephemeral sandbox orchestrator, incident war-room (5-whys), knowledge-graph engine, code-review swarm, release flight control, AST security sentinel scanner, TDD/mutation matrix, time-travel debugger, architecture blast-radius, profiler/flamegraph. These were synthetic mock endpoints violating the product boundary ("no fake cloud billing, no AST security red-team scanners, no incident war rooms, no benchmark leaderboards"). Real engines kept: auto-heal pipeline (105), SSO/RBAC (102, incl. `security_audit_logs`), semantic brain (106), session ingestion (107), auto-scaling (97), consensus gates (101).
- **76 + 13 + 3 synthetic MCP tools removed** from the FastMCP server (91): billing/ledger/pricing, evals, sandboxes, incidents, knowledge-graph, code-review swarm, releases/canary/rollback, security scans/AST rules, TDD/mutation, debug sessions, blast radius, perf profiles/flamegraphs, hardcoded `compare_model_benchmarks` fake scores, token-usage recorder, codebase-symbol/knowledge leftovers. 233 → 136 tools; 11,501 → 7,197 lines; schema/dispatch/handlers verified consistent.
- **350 dead browser API methods removed** from `js/api.js` (4,044 → ~390 lines): every client method for the removed engines that no UI component ever called.
- **138 OpenAPI paths + 12 migrations + 12 ballast test files removed**; `security_scans`, `debug_sessions`, `eval_*`, `billing_*`, sandbox, knowledge-graph, code-review, release, perf collections dropped from the schema surface.
- **Cleanup:** dangling engine banner comments, unused AgentsView sandbox state, AGENTS.md hooks map/data-model/test-count drift (495 tests across 39 files).

### Changed
- Version bump 1.40.0 → 1.41.0 (VERSION, health/version routes, openapi.json, header badge). ~50 MB RAM target now trivially met; MCP surface agent-focused again.

## [1.40.0] - 2026-09-07 - Cycle 89
### Added
- **Saved views (shipped as PR #31, merged):** per-user named board/list filter states — `saved_views` collection, "Save view" toolbar button, "Views" apply/switch/delete dropdown, URL-hash navigation on apply. Version bumped 1.39.0 → 1.40.0 across VERSION, `/api/projectbase/health` + version routes, openapi.json, header badge.

### Fixed
- PocketBase order-of-evaluation pitfall: `createRule` must not inspect `@request.body.owner` (rules run before `onRecordCreateRequest` hooks, so a spoofed owner is safely overwritten by the hook instead of leaking a rejection).


## [1.39.0] - 2026-09-06 - Cycles 43-65
### Added (Cycle 86)
- **Labels table-stakes completion:** reusable Multiselect label picker in the New Issue modal (project-scoped, from the `labels` collection); colored label chips on Kanban cards and List rows (collection color with deterministic fallback); one-click label quick-picks in the Issue Drawer; "All Labels" filter on board + list with URL-synced `?label=` deep links.
### Fixed
- **Labels REST validation parity:** direct issue create/update now validate `labels` exactly like bulk-update (array of non-empty strings ≤64 chars) via `20_issue_hooks.pb.js`; PB 0.39 jsvm surfaces the json field to record hooks as char-code arrays, so the hooks normalize it before validating and re-set the decoded value.
- `llms.txt` documents the labels endpoints (`8b.`) for agent discovery; `docs/research/FEATURE_MATRIX.md` labels row updated with the real surface.

## [1.39.0] - 2026-09-06 - Cycles 43-65
### Added
- **Portfolio overview:** cross-project ProjectsView mode with aggregate stats cards, top-milestones by progress, recent issues feed, and inline cross-project search; Header nav entry + route guard with drift-guard tests (`a6bce8a`).
- **Rich agent chat rendering:** markdown code blocks with copy, collapsible thought disclosures, tool invocation decks, and turn coalescing in the Agents console (`5279496`).
- **10-suite iBrowse E2E QA report** (10/10 passed) and hardened automated browser sign-in (`bb092aa`, `cd5ef2c`).
- Tracked workspace auto-generated `INDEX.md` (`abb1a11`).

### Changed
- **De-bloat AgentsView (Phase 1):** 2905 -> ~700 lines, keeping only Live Sessions Stream + Direct Prompt Bar per roadmap mandate (`eb62c45`).
- **Hermes sessions streamed into the board:** agent_bridge ingests Hermes sessions with token usage and reasoning activity (`c8fc593`); real live Flomaster and Hermes chat turns, thoughts, and tool calls stream end-to-end (`75847a1`).
- Live agent sessions populate machine + `is_active` fields end-to-end (`65f8e1d`); bridge live_activity persists to DB (`c6e8037`).

### Fixed
- **agent_bridge restart-storm hardening:** cadence relaxed 10s -> 5min with systemd `StartLimitIntervalSec/Burst` after the 2026-09-02 incident (14k failed starts) (`50e213d`).
- **Cycles Velocity Trend render:** repaired `velocityHistory -> velocityData` binding; de-flaked semantic reindex test (`2c3fedc`, `69303b0`).
- Kanban filter input no longer occluded by search icon (`2dfea9f`); Multiselect/SearchableSelect search icons no longer intercept clicks (`6ef669c`).
- Resolved all 17 biome error-level lint findings (`eba416c`).
- Interactive chat persists in component state so history survives parent polls (`2051c49`); live AI streaming via OmniRoute with real tool-call extraction (`7085594`).
- Agent dispatch validation aligned; AgentsView workspace tabs with chat persistence restored (`9b1909a`).
- TDD suites/mutation runs/quarantines sorted by `-created` instead of `-id` (`1aa9f8a`).
- iBrowse homelab endpoints + Playwright selectors aligned for global search and welcome modals (`55bf65e`); Knowledge Graph QA route aligned (`b6a3415`).
- Untracked QA screenshots; `qa-*.png` gitignored (`d073353`).

## [1.38.0] - 2026-08-28 - Cycle 42
### Added
- **Autonomous Agent Performance Profiler, Memory Leak Detection, Bottleneck Sentinel & Flamegraph Engine (Milestone 18 / Epic 39):**
  - Schema migration (`1710000052_add_performance_profiler_and_flamegraph_engine.js`) introducing 4 high-performance collections: `perf_profiles`, `perf_spans`, `perf_heap_snapshots`, and `perf_bottlenecks`.
  - Backend engine hook (`app/pb_hooks/123_profiler_flamegraph_engine.pb.js`) with 14 high-performance REST API endpoints:
    - `GET /api/projectbase/perf/profiles` & `POST /api/projectbase/perf/profiles` for profiling run CRUD and lifecycle management.
    - `GET /api/projectbase/perf/profiles/{id}`, `PATCH /api/projectbase/perf/profiles/{id}`, & `DELETE /api/projectbase/perf/profiles/{id}` with cascaded telemetry cleanup.
    - `GET /api/projectbase/perf/profiles/{id}/spans` & `POST /api/projectbase/perf/profiles/{id}/spans` for fine-grained function and tool execution span ingestion.
    - `GET /api/projectbase/perf/profiles/{id}/heap-snapshots` & `POST /api/projectbase/perf/profiles/{id}/heap-snapshots` for memory allocations, retained sizes, and growth velocity tracking.
    - `POST /api/projectbase/perf/profiles/{id}/analyze` for automated flamegraph call-tree synthesis, p50/p95 latency metrics, N+1 query detection, and memory leak diagnosis.
    - `GET /api/projectbase/perf/bottlenecks` & `PATCH /api/projectbase/perf/bottlenecks/{id}` for bottleneck triage and verification tracking.
    - `POST /api/projectbase/perf/synthesize-optimization` for 1-click automated code/caching/query patch generation.
    - `GET /api/projectbase/perf/fleet-metrics` for fleet-wide latency percentiles, memory footprints, and bottleneck breakdown metrics.
  - 8 FastMCP JSON-RPC 2.0 tools registered in `app/pb_hooks/91_mcp_server.pb.js`: `start_perf_profile`, `record_perf_span`, `capture_perf_heap_snapshot`, `analyze_perf_profile`, `list_perf_profiles`, `get_perf_profile_details`, `synthesize_perf_optimization`, and `get_fleet_perf_metrics`.
  - Frontend AgentsView **⚡ Performance Profiler & Flamegraph** dashboard (`activeTab === 'perf'`) with 5 KPI summary cards (Profiles Recorded, Avg/P95 Latency ms, Peak Heap & Leaks MB, Active Bottlenecks, Fleet Speedup Potential %), split-pane profile explorer, 4 interactive subtabs (🔥 Flamegraph & Call Tree, 📈 Spans & Execution Breakdown, 🧠 Memory Heap & Leak Sentinel, 🚨 Bottlenecks & Auto-Optimizer), and 3 interactive modals (+ Record Profile, + Ingest Heap Snapshot, Synthesize Optimization Patch).
  - Client API extensions in `app/pb_public/js/api.js` covering all performance profiler and flamegraph endpoints.
  - Comprehensive automated test suite `tests/test_profiler_flamegraph_engine.py` with 7/7 passing assertions, 542 total passing tests across 44 files, OpenAPI static drift validation, and 100% zero-console-error headless Playwright browser E2E verification (`scripts/qa/run_profiler_flamegraph_e2e.py`).

## [1.37.0] - 2026-08-28 - Cycle 41
### Added
- **Autonomous Agent Dynamic Architecture Graph, AST Blast-Radius Impact Simulator & Breaking Change Sentinel Engine (Milestone 17 / Epic 38):**
  - Schema migration (`1710000051_add_architecture_graph_and_blast_radius_engine.js`) introducing 4 high-performance collections: `arch_graphs`, `arch_nodes`, `arch_edges`, and `blast_simulations`.
  - Backend engine hook (`app/pb_hooks/122_architecture_blast_radius_engine.pb.js`) with 13 high-performance REST API endpoints:
    - `GET /api/projectbase/arch/graphs` & `POST /api/projectbase/arch/graphs` for architecture dependency graph CRUD and indexing.
    - `GET /api/projectbase/arch/graphs/{id}` & `DELETE /api/projectbase/arch/graphs/{id}` for graph details and deletion.
    - `POST /api/projectbase/arch/graphs/{id}/scan` for automated codebase topology scanning and dependency graph population.
    - `GET /api/projectbase/arch/graphs/{id}/nodes` & `POST /api/projectbase/arch/graphs/{id}/nodes` for registering architecture nodes (files, modules, components, endpoints, models, test suites, services).
    - `GET /api/projectbase/arch/graphs/{id}/edges` & `POST /api/projectbase/arch/graphs/{id}/edges` for recording directional dependency relationships (imports, calls, renders, reads_schema, mutates_schema, tests).
    - `POST /api/projectbase/arch/simulate-blast` for transitive blast-radius calculation, 0-100 risk scoring, breaking change detection, and targeted test suite identification.
    - `GET /api/projectbase/arch/simulations` & `GET /api/projectbase/arch/simulations/{id}` for simulation history and impact reports.
    - `GET /api/projectbase/arch/metrics` for workspace architecture coupling factor, modularity index, and blast-radius health metrics.
  - 8 FastMCP JSON-RPC 2.0 tools in `app/pb_hooks/91_mcp_server.pb.js`:
    - `analyze_architecture_graph`, `register_architecture_node`, `link_architecture_dependency`, `simulate_change_blast_radius`, `list_blast_simulations`, `get_blast_simulation_details`, `generate_targeted_test_plan`, `get_architecture_metrics`.
  - Frontend AgentsView **🌐 Architecture & Blast Radius** dashboard (`activeTab === 'blast_radius'`) in `app/pb_public/js/components/AgentsView.js`:
    - 5 KPI summary cards: Arch Graphs & Nodes, Simulations Executed, Avg Risk Score %, Targeted Test Reduction %, Breaking Changes Caught.
    - 4 Interactive subtabs: 🗺️ Graph & Topology, 💥 Blast Simulator, 🎯 Targeted Test Planner, 📊 Modularity & Metrics.
    - Interactive node inspector and New Architecture Graph creation modal.
  - Comprehensive automated test suite `tests/test_architecture_blast_radius_engine.py` with 7/7 passing assertions, 100% OpenAPI documentation, and CSS sync.

## [1.36.0] - 2026-08-28 - Cycle 40
### Added
- **Autonomous Agent Time-Travel Debugger, Execution Trace Replay, Breakpoint Watchpoints & State Snapshot Engine (Milestone 16 / Epic 37):**
  - Schema migration (`1710000050_add_agent_time_travel_debugger.js`) introducing 4 high-assurance debugging collections: `debug_sessions`, `debug_trace_frames`, `debug_breakpoints`, and `debug_state_snapshots`.
  - Backend engine hook (`app/pb_hooks/121_agent_time_travel_debugger.pb.js`) with 18 high-performance REST API endpoints:
    - `GET /api/projectbase/debug/sessions` & `POST /api/projectbase/debug/sessions` for listing and creating agent debug sessions.
    - `GET /api/projectbase/debug/sessions/{id}` & `PATCH /api/projectbase/debug/sessions/{id}` for retrieving session details, recent frames, and updating session metadata.
    - `POST /api/projectbase/debug/sessions/{id}/step` for stepping forward, backward, or to a specific step index in execution time-travel.
    - `POST /api/projectbase/debug/sessions/{id}/pause` & `POST /api/projectbase/debug/sessions/{id}/resume` for pausing and resuming execution.
    - `GET /api/projectbase/debug/sessions/{id}/frames` & `POST /api/projectbase/debug/sessions/{id}/frames` for listing and ingesting trace frames (evaluating and triggering active conditional breakpoints).
    - `GET /api/projectbase/debug/sessions/{id}/frames/{frameId}` for inspecting specific frame payloads and variable states.
    - `GET /api/projectbase/debug/sessions/{id}/breakpoints` & `POST /api/projectbase/debug/sessions/{id}/breakpoints` for managing conditional watchpoints.
    - `PATCH /api/projectbase/debug/breakpoints/{id}` & `DELETE /api/projectbase/debug/breakpoints/{id}` for toggling and deleting breakpoints.
    - `GET /api/projectbase/debug/sessions/{id}/snapshots` & `POST /api/projectbase/debug/sessions/{id}/snapshots` for capturing memory and environment state snapshots.
    - `POST /api/projectbase/debug/sessions/{id}/replay` for simulating execution trace replays and calculating cumulative metrics.
    - `GET /api/projectbase/debug/metrics` for workspace-wide aggregate debugging telemetry.
  - 8 FastMCP JSON-RPC 2.0 tools in `scripts/mcp_server.py` and `app/pb_hooks/91_mcp_server.pb.js`: `start_debug_session`, `record_debug_trace_frame`, `list_debug_sessions`, `get_debug_session_trace`, `step_debug_session`, `set_debug_breakpoint`, `capture_debug_state_snapshot`, `get_debug_workspace_metrics`.
  - Frontend AgentsView **⏱️ Time-Travel Debugger** dashboard (`activeTab === 'debugger'`) with 5 KPI summary cards (Debug Sessions, Trace Frames, Breakpoint Hit Rate, Intercepted Errors, Avg Latency & RAM), split-pane session explorer, 4 interactive subtabs (🧵 Trace Frames & Call Stack, 🔍 State & Variable Inspector, 🛑 Breakpoints & Watchpoints, 📸 State Snapshots), time-travel scrubber controls (⏮️ First, ◀️ Prev, ⏸️ Pause / ▶️ Resume, ▶️ Next, ⏭️ Last, 🔄 Replay, 📸 Snapshot), and 3 interactive modals (+ New Debug Session, + Add Breakpoint, Time-Travel Replay Simulation).
  - Comprehensive automated test suite `tests/test_agent_time_travel_debugger.py` with 8/8 passing assertions, 528 total passing tests across 42 files, OpenAPI static drift validation, and 100% headless Playwright browser E2E verification.

## [1.35.0] - 2026-08-28 - Cycle 39
### Added
- **Autonomous Agent Test-Driven Development (TDD) Synthesizer, Mutation Testing Matrix, Flaky Test Quarantine & Coverage Sentinel Engine (Milestone 15 / Epic 36):**
  - Schema migration (`1710000049_add_tdd_synthesizer_and_mutation_matrix.js`) introducing 4 high-assurance testing collections: `tdd_suites`, `tdd_cases`, `mutation_runs`, and `flaky_quarantines`.
  - Backend engine hook (`app/pb_hooks/120_tdd_mutation_engine.pb.js`) with 14 high-performance REST API endpoints:
    - `GET /api/projectbase/tdd/suites` & `POST /api/projectbase/tdd/suites` for listing and creating TDD test suites.
    - `GET /api/projectbase/tdd/suites/{id}`, `DELETE /api/projectbase/tdd/suites/{id}`, and `POST /api/projectbase/tdd/suites/{id}/run` for inspecting suite details, deleting suites, and executing test suites with full assertion evaluations.
    - `POST /api/projectbase/tdd/suites/synthesize` for synthesizing automated TDD suites and test cases directly from issue acceptance criteria and invariants.
    - `GET /api/projectbase/tdd/suites/{id}/cases` & `POST /api/projectbase/tdd/suites/{id}/cases` for listing and adding test cases to a suite.
    - `POST /api/projectbase/tdd/cases/{id}/execute` for single test case assertion execution with flake score tracking.
    - `GET /api/projectbase/tdd/mutation/runs` & `POST /api/projectbase/tdd/mutation/runs` for running AST and semantic mutation testing (boundary conditions, conditional inversion, math operator mutation, return value mutation) and evaluating kill rate %.
    - `GET /api/projectbase/tdd/mutation/runs/{id}` for inspecting mutation run details and diffs.
    - `GET /api/projectbase/tdd/quarantines` & `POST /api/projectbase/tdd/quarantines` for listing and isolating non-deterministic flaky tests.
    - `POST /api/projectbase/tdd/quarantines/{id}/resolve` for unquarantining and resolving flaky test cases.
    - `GET /api/projectbase/tdd/coverage` for repository statement and branch coverage matrix with untested gap analysis.
    - `GET /api/projectbase/tdd/metrics` for workspace-wide TDD KPIs (total suites, pass rate %, mutation kill score %, quarantined flakes, avg duration).
  - 8 FastMCP JSON-RPC 2.0 tools (`synthesize_tdd_tests`, `run_tdd_suite`, `list_tdd_suites`, `get_tdd_suite_details`, `run_mutation_test`, `quarantine_flaky_test`, `list_quarantined_tests`, `get_fleet_test_coverage`).
  - Frontend AgentsView **🧪 TDD & Mutation Matrix** dashboard (`activeTab === 'tdd'`) with 5 KPI summary cards (TDD Suites, Mutation Score %, Quarantined Flakes, Fleet Coverage %, Avg Suite Time), split-pane suite & cases explorer, 4 interactive subtabs (🧪 Suites & Cases, 🧬 Mutation Matrix, 🔒 Flaky Quarantine Vault, 🎯 Coverage & Gaps), and 3 interactive modals (+ Synthesize Suite, Mutate Code, Quarantine Flake).
  - Comprehensive automated test suite `tests/test_tdd_mutation_engine.py` with 8/8 passing assertions, 520 total passing tests across 41 files, OpenAPI static drift validation, and 100% frontend guard pass verification.
### Added
- **Autonomous Agent Security Red-Team, Secret Leak Sentinel, AST Vulnerability Probing & Automated Remediation Hardening Engine (Milestone 14 / Epic 35):**
  - Schema migration (`1710000048_add_security_sentinel_engine.js`) introducing 4 high-security collections: `security_scans`, `secret_findings`, `security_policies`, and `security_remediations`.
  - Backend security engine hook (`app/pb_hooks/119_security_sentinel_engine.pb.js`) with 15 high-performance REST API endpoints:
    - `GET /api/projectbase/security/scans` & `POST /api/projectbase/security/scans` for creating and triggering comprehensive security audits with real-time AST rule verification and entropy scanning.
    - `GET /api/projectbase/security/scans/{id}`, `DELETE /api/projectbase/security/scans/{id}`, and `POST /api/projectbase/security/scans/{id}/execute` for inspecting scan details, structured findings, remediation plans, and re-executing security assertions.
    - `GET /api/projectbase/security/secrets` & `POST /api/projectbase/security/secrets/scan-content` for listing detected credentials and running standalone real-time token/diff leak detection with Shannon entropy computation.
    - `POST /api/projectbase/security/secrets/{id}/quarantine` & `POST /api/projectbase/security/secrets/{id}/resolve` for instant quarantine locking and resolution (rotated, whitelisted, dismissed).
    - `GET /api/projectbase/security/policies` & `POST /api/projectbase/security/policies` for managing zero-trust security policy rules (zero-critical CVE gate, max allowed CVSS, auto-quarantine, sandbox requirement).
    - `GET /api/projectbase/security/remediations`, `POST /api/projectbase/security/remediations/generate`, and `POST /api/projectbase/security/remediations/{id}/apply` for synthesizing automated unified git patch diffs and applying/verifying code fixes.
    - `GET /api/projectbase/security/posture` for calculating fleet-wide security score (0-100), active CVE count, secret containment rate, auto-remediation velocity, and MTTR.
  - 8 FastMCP JSON-RPC 2.0 tools in `app/pb_hooks/91_mcp_server.pb.js`: `run_security_scan`, `list_security_scans`, `get_security_scan_details`, `scan_for_secret_leaks`, `list_secret_findings`, `generate_security_remediation`, `apply_security_remediation`, and `get_fleet_security_posture`.
  - Frontend AgentsView **🛡️ Autonomous Security Sentinel & Red-Team Hub** dashboard (`activeTab === 'security'`) with 5 KPI summary cards (Fleet Security Score, Active Critical/High CVEs, Secret Containment %, Auto-Remediation Rate %, Security MTTR), split-pane scan explorer, 4 interactive subtabs (🛡️ Vulnerabilities & AST Probing, 🔑 Secret Leak Sentinel & Quarantine Vault, 🛠️ Auto-Remediation & Patch Synthesis, 📜 Policy Governance & Compliance), and 3 interactive modals (+ Run Security Scan, Quick Secret Scanner, Create Policy).
  - Comprehensive automated test suite `tests/test_security_sentinel_engine.py` with 10/10 passing tests, 512 total passing tests across 40 files, and 100% zero-console-error headless Playwright browser E2E validation.

## [1.33.0] - 2026-08-28 - Cycle 37
### Added
- **Autonomous Agent Release Flight Control, Deployment Canary Gates, Production Health Probes & Self-Healing Rollback Engine (Milestone 13 / Epic 34):**
  - Schema migration (`1710000047_add_release_flight_control_engine.js`) introducing 4 dedicated collections: `releases`, `deployment_stages`, `health_probes`, and `rollback_events`.
  - Backend engine hook (`app/pb_hooks/118_release_flight_control_engine.pb.js`) with 18 high-performance REST API endpoints:
    - `GET /api/projectbase/releases` and `POST /api/projectbase/releases` for listing and planning multi-stage canary release pipelines with auto-generated progressive canary stages and baseline SLA health probes.
    - `GET /api/projectbase/releases/{id}`, `PATCH /api/projectbase/releases/{id}`, and `DELETE /api/projectbase/releases/{id}` for querying complete release specifications, stage pipelines, health probe histories, rollback incidents, and cascading deletion.
    - `POST /api/projectbase/releases/{id}/start-deployment` for initiating the canary deployment progression pipeline.
    - `POST /api/projectbase/releases/{id}/advance-stage` for advancing across canary traffic tiers (0% -> 10% -> 50% -> 100%) after verifying that active health probe gates are green.
    - `POST /api/projectbase/releases/{id}/probes` and `GET /api/projectbase/releases/{id}/probes` for registering custom SLA health probes (HTTP latency, 5xx error rate budgets, database pools, synthetic canaries) and querying live metrics.
    - `POST /api/projectbase/releases/{id}/simulate-traffic` for ingesting live or simulated telemetry streams and updating probe metrics in real time.
    - `POST /api/projectbase/releases/{id}/evaluate-health` for running automated health gate evaluations against SLA thresholds, automatically executing instantaneous self-healing rollbacks (<200ms MTTR) when error budget breaches occur.
    - `POST /api/projectbase/releases/{id}/trigger-rollback` for manual emergency instantaneous traffic cutoff and fallback restoration with audit logging.
    - `POST /api/projectbase/releases/{id}/promote` for 1-click full promotion to 100% production traffic.
    - `POST /api/projectbase/releases/{id}/abort` for gracefully terminating draft or canary releases.
    - `GET /api/projectbase/releases/{id}/rollback-events` for inspecting detailed incident post-mortems and rollback duration telemetry.
    - `GET /api/projectbase/releases/metrics/summary` for aggregate fleet deployment velocity, canary traffic split %, average rollback MTTR, and fleet stability index.
    - `POST /api/projectbase/releases/seed-samples` for seeding realistic demo canary flights and stable releases.
  - 8 FastMCP JSON-RPC 2.0 tools for autonomous agents (`plan_release_deployment`, `list_releases`, `get_release_flight_status`, `advance_canary_stage`, `record_release_health_probe`, `evaluate_release_health_gate`, `execute_instant_rollback`, `promote_release_to_production`).
  - Frontend AgentsView **🚀 Autonomous Release Flight Control & Canary Sentinel Hub** dashboard (`activeTab === 'releases'`) with 5 KPI summary cards, interactive split-pane release inspector, 4 subtabs (🚀 Canary Stage Pipeline & Traffic Dial, 🩺 Real-Time Health Probes & Telemetry Ingestor, 🛡️ Self-Healing Rollback Sentinel & Incident Timeline, 📦 Ground-Truth Artifacts Manifest), "+ Plan Release" modal, "+ Add Probe" modal, and "Emergency Instant Rollback" modal.
  - Complete automated test suite `tests/test_release_flight_control_engine.py` (10/10 passing assertions, 502 total passing tests across 39 files), OpenAPI 3.0 static drift synchronization, and 100% interactive Playwright browser E2E test verification (`scripts/qa/run_release_flight_control_e2e.py`).

## [1.32.0] - 2026-08-28 - Cycle 36
### Added
- **Autonomous Agent Multi-Persona Code Review Swarm, AST-Aware Critique & Patch Synthesis Engine (Milestone 12 / Epic 33):**
  - Schema migration (`1710000045_add_code_review_swarm_engine.js`) introducing 4 dedicated collections: `code_reviews`, `review_critiques`, `review_patches`, and `merge_verdicts`.
  - Backend engine hook (`app/pb_hooks/117_code_review_swarm_engine.pb.js`) with 18 high-performance REST API endpoints:
    - `GET /api/projectbase/reviews` and `POST /api/projectbase/reviews` for listing and creating code review requests with auto-diff file extraction, quality scoring, and baseline analysis.
    - `GET /api/projectbase/reviews/{id}`, `PATCH /api/projectbase/reviews/{id}`, and `DELETE /api/projectbase/reviews/{id}` for querying complete review specifications, critiques list, synthesized patches, and cascading deletion.
    - `POST /api/projectbase/reviews/{id}/critiques`, `GET /api/projectbase/reviews/{id}/critiques`, `PATCH /api/projectbase/reviews/critiques/{id}`, and `DELETE /api/projectbase/reviews/critiques/{id}` for line-level persona critiques with real-time severity scoring (P0/P1/P2/P3) and composite score recalculation.
    - `POST /api/projectbase/reviews/{id}/swarm` for dispatching full 6-persona review swarms (`SecurityAuditor`, `ArchitectureGuardian`, `PerformanceSpecialist`, `SimplicityYAGNI`, `TestCoverageCritic`, `StyleConventions`) that automatically detect hardcoded secrets, invariant violations, unbounded queries, missing tests, and command injection risks.
    - `POST /api/projectbase/reviews/{id}/synthesize-patch` and `GET /api/projectbase/reviews/{id}/patches` for generating clean unified diff patches that resolve open critiques with zero AST conflicts.
    - `POST /api/projectbase/reviews/patches/{id}/apply` and `POST /api/projectbase/reviews/patches/{id}/revert` for 1-click dry-run patch application and critique lifecycle state synchronization.
    - `POST /api/projectbase/reviews/{id}/evaluate-gate` for multi-persona consensus merge gate evaluation and arbiter verdict generation.
    - `POST /api/projectbase/reviews/{id}/override-gate` for authorized manual gate override with audit rationale logging.
    - `POST /api/projectbase/reviews/{id}/merge` for autonomous merge execution with strict P0 blocker prevention.
    - `GET /api/projectbase/reviews/metrics` for workspace-wide code review KPIs, approval rates, and persona severity distributions.
  - 8 FastMCP JSON-RPC 2.0 tools: `request_code_review`, `submit_persona_critique`, `dispatch_review_swarm`, `synthesize_review_patch`, `apply_review_patch`, `evaluate_merge_gate`, `list_code_reviews`, and `get_code_review_details`.
  - Frontend AgentsView **🔍 Autonomous Code Review Swarm & AST Critique Hub** dashboard (`activeTab === 'code_reviews'`) with 5 KPI overview cards, split-pane layout, 4 interactive subtabs (Persona Critiques & Inline Reviews, Unified Diff & Touched Files, Synthesized Patches & Dry-Run Logs, and Merge Gate Consensus & Invariant Shield), "+ Request Code Review" modal, "+ Add Critique" modal, and "Manual Merge Gate Override" modal.
  - Complete OpenAPI 3.0 specification coverage in `app/pb_public/openapi.json` and client SDK in `app/pb_public/js/api.js`.
  - Comprehensive automated pytest suite `tests/test_code_review_swarm_engine.py` with 10/10 passing assertions, 492 total passing tests across 38 files, and 100% headless Playwright browser E2E verification (`scripts/qa/run_code_review_swarm_e2e.py`).

## [1.31.0] - 2026-08-28 - Cycle 35
### Added
- **Autonomous Agent Knowledge Graph, Architectural Memory Index & Invariant Compliance Engine (Milestone 11 / Epic 32):**
  - Schema migration (`1710000044_add_knowledge_graph_and_architectural_memory.js`) introducing 4 dedicated collections: `knowledge_nodes`, `knowledge_relations`, `architectural_invariants`, and `invariant_verifications`.
  - Backend engine hook (`app/pb_hooks/116_knowledge_graph_engine.pb.js`) with 19 high-performance REST API endpoints:
    - `GET /api/projectbase/knowledge/nodes` and `POST /api/projectbase/knowledge/nodes` for listing and storing architectural facts, ADRs, conventions, subsystems, and symbol nodes with confidence scoring and tag metadata.
    - `GET /api/projectbase/knowledge/nodes/{id}`, `PATCH /api/projectbase/knowledge/nodes/{id}`, and `DELETE /api/projectbase/knowledge/nodes/{id}` for querying complete node specifications, inbound/outbound relations, linked invariants, and cascading deletion.
    - `POST /api/projectbase/knowledge/nodes/{id}/status` for lifecycle status management (`active`, `proposed`, `accepted`, `deprecated`, `superseded`, `violated`) with automated `superseded_by` relation generation.
    - `GET /api/projectbase/knowledge/relations`, `POST /api/projectbase/knowledge/relations`, and `DELETE /api/projectbase/knowledge/relations/{id}` for building directional dependency and governance graphs (`depends_on`, `implements`, `modifies`, `violates`, `supersedes`, `verifies`, `governs`, `related_to`).
    - `GET /api/projectbase/knowledge/graph` returning full graph topology (nodes and edges) for visual rendering and analysis.
    - `GET /api/projectbase/knowledge/invariants`, `POST /api/projectbase/knowledge/invariants`, `PATCH /api/projectbase/knowledge/invariants/{id}`, and `DELETE /api/projectbase/knowledge/invariants/{id}` for registering and managing active architectural compliance gates (`path_pattern`, `dependency_constraint`, `naming_convention`, `security_policy`).
    - `POST /api/projectbase/knowledge/verify-invariants` for evaluating proposed file paths and diffs against all active invariants, recording verification audits, and returning blocking vs warning verdicts.
    - `GET /api/projectbase/knowledge/verifications` for querying historical invariant compliance audit logs.
    - `GET /api/projectbase/knowledge/metrics` providing comprehensive architectural health stats, invariant pass rates, and breakdown by kind/status/author.
    - `POST /api/projectbase/knowledge/query` providing tokenized semantic and keyword retrieval over codebase architectural memory.
    - `POST /api/projectbase/knowledge/seed-demo` seeding canonical ADRs (ADR-001 Zero-Build Vue 3, ADR-002 Single PocketBase Binary, ADR-003 Sub-50MB RAM, ADR-004 FastMCP Native), core subsystems, and P0 invariants.
  - 8 FastMCP JSON-RPC 2.0 tools in `app/pb_hooks/91_mcp_server.pb.js`: `store_architectural_fact`, `query_knowledge_graph`, `create_codebase_symbol_node`, `link_knowledge_nodes`, `verify_change_against_invariants`, `list_architectural_decisions`, `invalidate_knowledge_node`, and `get_knowledge_graph_metrics`.
  - Frontend AgentsView **🧠 Autonomous Knowledge Graph & Architectural Memory** dashboard with 5 KPI overview cards, interactive 4-subtab layout (Knowledge & Symbol Graph Explorer with detail viewer and relations grid, Architectural Decision Records (ADRs) gallery, Invariants & Compliance Rules table with active toggles, and Interactive Invariant Verifier Playground with live violation diagnostic audits), and "+ Record Fact / ADR" / "+ New Invariant" modals.
  - Comprehensive automated test suite `tests/test_knowledge_graph_engine.py` with 11/11 passing tests, bringing total test coverage to 482 passing tests across 37 files.
### Added
- **Autonomous Multi-Agent Incident Response, Live Debugging War-Room & Root-Cause Post-Mortem Engine (Milestone 10 / Epic 31):**
  - Schema migration (`1710000043_add_incident_warrooms_and_postmortems.js`) introducing 5 dedicated collections: `incidents`, `incident_events`, `incident_hypotheses`, `incident_mitigations`, and `incident_postmortems`.
  - Backend engine hook (`app/pb_hooks/115_incident_warroom_engine.pb.js`) with 19 high-performance REST API endpoints:
    - `GET /api/projectbase/incidents` and `POST /api/projectbase/incidents` for querying incidents and declaring new production incidents/regressions with automated initial event recording.
    - `GET /api/projectbase/incidents/{id}`, `PATCH /api/projectbase/incidents/{id}`, and `DELETE /api/projectbase/incidents/{id}` for retrieving full war-room details (timeline events, hypotheses, mitigations, post-mortem), updating metadata, and cascading cleanups.
    - `POST /api/projectbase/incidents/{id}/status` for managing lifecycle transitions (`declared` -> `triage` -> `investigating` -> `mitigated` -> `resolved` -> `postmortem_published`) with automated timestamping (MTTM/MTTR) and event recording.
    - `POST /api/projectbase/incidents/{id}/events` and `GET /api/projectbase/incidents/{id}/events` for streaming live diagnostic logs, metric anomalies, actions, and status updates.
    - `POST /api/projectbase/incidents/{id}/hypotheses`, `PATCH /api/projectbase/incidents/{id}/hypotheses/{hypoId}`, and `GET /api/projectbase/incidents/{id}/hypotheses` for proposing, testing, and confirming/falsifying root-cause hypotheses with confidence scoring and evidence capture.
    - `POST /api/projectbase/incidents/{id}/mitigations`, `PATCH /api/projectbase/incidents/{id}/mitigations/{mitId}`, and `GET /api/projectbase/incidents/{id}/mitigations` for planning and executing mitigations (rollbacks, config patches, sandbox isolations, code fixes) and tracking verification outcomes.
    - `POST /api/projectbase/incidents/{id}/postmortem`, `GET /api/projectbase/incidents/{id}/postmortem`, and `PATCH /api/projectbase/incidents/{id}/postmortem` for generating, updating, and publishing comprehensive 5-Whys root-cause post-mortems with preventative action items.
    - `GET /api/projectbase/incidents/metrics` for fleet-wide incident metrics, active war-rooms count, P0/P1 breakdown, and Mean Time to Mitigate / Resolve (MTTM/MTTR).
    - `POST /api/projectbase/incidents/seed-demo` for seeding canonical production incident war-rooms with full event timelines and published post-mortems.
  - 8 FastMCP JSON-RPC 2.0 tools in `app/pb_hooks/91_mcp_server.pb.js`:
    - `declare_incident`, `list_incidents`, `get_incident_details`, `add_incident_event`, `propose_incident_hypothesis`, `execute_incident_mitigation`, `update_incident_status`, and `generate_incident_postmortem`.
  - Frontend AgentsView **🚨 Live Incident War-Room & Post-Mortem** dashboard:
    - 4 KPI summary cards (Active War-Rooms, P0/P1 Breakdown, Mean Time to Mitigate, Mean Time to Resolve).
    - Incident Triage Roster with severity pills, status badges, search filtering, and "+ Declare Incident" modal.
    - Real-time War-Room Workbench with 4 subtabs: Live Event Timeline Stream with inline composer, Hypotheses Board with confidence meters and quick Confirm/Falsify actions, Mitigations & Rollback Tracker with verification workflows, and 5-Whys Post-Mortem Viewer/Editor.
  - Comprehensive automated pytest suite `tests/test_incident_warroom_engine.py` covering all 19 endpoints, status transitions, hypothesis falsification, mitigation verification, post-mortem generation, and FastMCP JSON-RPC tools.

## [1.29.0] - 2026-08-28 - Cycle 33
### Added
- **Autonomous Ephemeral Dev Sandboxes & Worktree Container Orchestrator (Milestone 9 / Epic 30):**
  - Schema migration (`1710000042_add_ephemeral_sandboxes_and_dev_environments.js`) introducing 4 dedicated collections: `dev_sandboxes`, `sandbox_templates`, `sandbox_executions`, and `sandbox_snapshots`.
  - Backend engine hook (`app/pb_hooks/114_ephemeral_sandbox_orchestrator.pb.js`) with 15 high-performance REST API endpoints:
    - `GET /api/projectbase/sandboxes` and `POST /api/projectbase/sandboxes/provision` for provisioning and querying isolated sandboxes with dynamic port allocation and TTLs.
    - `GET /api/projectbase/sandboxes/{id}` and `DELETE /api/projectbase/sandboxes/{id}` for retrieving detailed sandbox state, executions, snapshots, and decommissioning.
    - `POST /api/projectbase/sandboxes/{id}/action` for managing lifecycle transitions (`start`, `stop`, `pause`, `restart`, `terminate`).
    - `POST /api/projectbase/sandboxes/{id}/exec` and `GET /api/projectbase/sandboxes/{id}/executions` for executing commands inside sandboxes and tracking terminal output streams.
    - `POST /api/projectbase/sandboxes/{id}/snapshot` and `GET /api/projectbase/sandboxes/{id}/snapshots` for capturing named state checkpoints and git commit hashes.
    - `POST /api/projectbase/sandboxes/{id}/health` for probing and reporting runtime health status.
    - `GET /api/projectbase/sandboxes/templates` and `POST /api/projectbase/sandboxes/templates` for blueprint template management.
    - `GET /api/projectbase/sandboxes/metrics` for fleet-wide resource allocation, active container counts, and port utilization.
    - `POST /api/projectbase/sandboxes/cleanup-idle` for automatic garbage collection of expired TTL sandboxes.
    - `POST /api/projectbase/sandboxes/seed-defaults` for seeding canonical templates (Vue 3/Vite, FastAPI, Rust/Cargo, PocketBase, Flomaster Agent Worktree).
  - 8 FastMCP JSON-RPC 2.0 tools (`provision_dev_sandbox`, `list_dev_sandboxes`, `get_sandbox_status`, `exec_in_sandbox`, `snapshot_sandbox_state`, `terminate_dev_sandbox`, `list_sandbox_templates`, `get_sandbox_fleet_metrics`).
  - Frontend AgentsView **📦 Ephemeral Sandboxes & Dev Environments** dashboard with live fleet grid, port/preview URL links, terminal execution logs, snapshot checkpoints, and interactive provisioning modal.
  - Comprehensive automated test suite `tests/test_ephemeral_sandboxes_orchestrator.py` with 15 test cases verifying templates, provisioning, lifecycle, executions, snapshots, FastMCP tools, and frontend guards.

## [1.28.0] - 2026-08-28 - Cycle 32
### Added
- **Agent Evaluation Benchmark Harness, Leaderboard & Regression Matrix (Milestone 8 / Epic 29):**
  - Schema migration (`1710000041_add_agent_evaluations_and_benchmarks.js`) introducing 4 dedicated collections: `eval_suites`, `eval_runs`, `eval_metrics`, and `eval_benchmarks`.
  - Backend engine hook (`app/pb_hooks/113_agent_evaluation_benchmark_engine.pb.js`) with 12 high-performance REST API endpoints:
    - `GET /api/projectbase/evals/suites` and `POST /api/projectbase/evals/suites` for creating, updating, and listing benchmark suites with domain filtering.
    - `GET /api/projectbase/evals/suites/{id}` and `DELETE /api/projectbase/evals/suites/{id}` for retrieving detailed scenarios and removing suites.
    - `POST /api/projectbase/evals/runs/trigger` for executing automated scenario evaluations against models and personas with composite score calculation.
    - `GET /api/projectbase/evals/runs` and `GET /api/projectbase/evals/runs/{id}` for querying run histories and inspecting per-scenario metrics.
    - `POST /api/projectbase/evals/runs/{id}/metrics` for ingesting granular scenario assertion results with latency and token telemetry.
    - `GET /api/projectbase/evals/leaderboard` for generating ranked model/persona leaderboards with win-rates and certification status badges.
    - `GET /api/projectbase/evals/regressions` for automated detection of accuracy drops (>5%), latency spikes (>25%), or token cost violations against baselines.
    - `POST /api/projectbase/evals/compare` for side-by-side model comparison across accuracy, latency, and cost dimensions.
    - `POST /api/projectbase/evals/seed-defaults` for seeding canonical benchmark suites (Coding, Tool Calling, Refactor, Security Guardrails) and model baselines.
  - 8 FastMCP JSON-RPC 2.0 tools in `app/pb_hooks/91_mcp_server.pb.js`: `run_agent_eval_suite`, `list_eval_suites`, `get_eval_run_details`, `get_agent_leaderboard`, `detect_agent_regressions`, `create_eval_suite`, `record_eval_scenario_result`, and `compare_model_benchmarks`.
  - Frontend AgentsView **📊 Evals & Leaderboard** dashboard with 4 KPI summary cards, interactive Leaderboard table with certification meters, Regression Anomaly Alert Center, Benchmark Suites runner, Recent Runs stream, and Side-by-Side Model Comparison modal.
  - Comprehensive automated test suite `tests/test_agent_evaluations_engine.py` covering all 12 REST endpoints and 8 FastMCP tools.

## [1.27.0] - 2026-08-28 - Cycle 31
### Added
- **Agent Fleet Budget & Cost Attribution, Token Quota Enforcement & Financial Governance Hub (Milestone 7 / Epic 28):**
  - Schema migration (`1710000040_add_fleet_budgets_and_token_quotas.js`) adding 4 dedicated collections: `budget_policies`, `token_quotas`, `cost_ledger_entries`, and `budget_overrides`.
  - Backend engine hook (`app/pb_hooks/112_fleet_budget_quota_engine.pb.js`) with 13 high-performance REST API endpoints:
    - `POST /api/projectbase/billing/policies` and `GET /api/projectbase/billing/policies` for creating, updating, and listing budget policies across global, project, persona, session, and tenant scopes.
    - `GET /api/projectbase/billing/policies/{id}` and `DELETE /api/projectbase/billing/policies/{id}` for retrieving single policy details, remaining allowances, and active emergency overrides.
    - `POST /api/projectbase/billing/quotas/check` for pre-flight token quota and budget availability validation before expensive model inference or swarm runs.
    - `POST /api/projectbase/billing/quotas/reserve` and `POST /api/projectbase/billing/quotas/release` for managing in-flight capacity reservations with atomic tracking.
    - `POST /api/projectbase/billing/usage/record` for ingesting prompt, completion, cached, and reasoning tokens with automatic multi-model cost calculation, policy status threshold evaluation, and circuit breaker tripping.
    - `POST /api/projectbase/billing/overrides/grant` for granting temporary emergency budget or token quota overrides.
    - `GET /api/projectbase/billing/analytics` for workspace-wide spend analytics broken down by provider, model, persona, and project.
    - `GET /api/projectbase/billing/ledger` for querying transaction cost ledgers with granular multi-field filtering.
    - `GET /api/projectbase/billing/pricing` for accessing live token pricing tables across Claude, GPT-4o/o1/o3, DeepSeek V3/R1, Gemini 2.0/1.5, and local OmniRoute free-tier models.
    - `POST /api/projectbase/billing/circuit-breaker/reset` for resetting tripped circuit breakers.
  - 8 FastMCP JSON-RPC 2.0 tools: `get_agent_budget_status`, `set_agent_budget_policy`, `record_agent_token_usage`, `check_token_quota_availability`, `grant_emergency_budget_override`, `get_fleet_cost_analytics`, `list_cost_ledger_entries`, and `get_model_pricing_matrix`.
  - Frontend AgentsView **💰 Fleet Budget & Quotas** dashboard with 5 primary KPI cards, real-time model and persona spend distribution meters, interactive budget policy management, pre-flight in-flight token quota simulator, live cost ledger transaction stream, and emergency override modals.
  - 438/438 automated tests passing across 33 test suites with 100% frontend guard and CSS sync verification.

## [1.26.0] - 2026-08-28 - Cycle 30
### Added
- **Multi-Agent Merge & Semantic Conflict Auto-Resolution Engine, 3-Way Diff Matrix & Deterministic Merge Barrier (Milestone 6 / Epic 27):**
  - Schema migration (`1710000039_add_session_merges_and_conflict_engine.js`) adding `merge_status` and `active_merge_id` to `agent_sessions`, alongside new `session_merges` and `merge_conflicts` collections for multi-agent merge orchestration.
  - Backend engine hook (`app/pb_hooks/111_session_merges_conflict_engine.pb.js`) with 10 high-performance REST API endpoints:
    - `POST /api/projectbase/merges/propose` for 3-way conflict analysis between divergent agent branches and session forks.
    - `GET /api/projectbase/merges` and `GET /api/projectbase/merges/{id}` for querying merge requests and inspecting individual conflict hunks.
    - `POST /api/projectbase/merges/{id}/analyze` for on-demand conflict recalculation.
    - `POST /api/projectbase/merges/{id}/conflicts/{conflictId}/resolve` for granular manual hunk resolution.
    - `POST /api/projectbase/merges/{id}/auto-resolve` for automated 3-way AST and union resolution heuristics (`ast_clean`, `union_merge`, `priority_override`).
    - `POST /api/projectbase/merges/{id}/verify` for deterministic merge readiness barrier enforcement (asserting zero unresolved conflicts).
    - `POST /api/projectbase/merges/{id}/execute` for commit hash generation and session lifecycle state advance.
    - `POST /api/projectbase/merges/{id}/reject` for graceful cancellation and lock release.
    - `GET /api/projectbase/merges/matrix` for workspace-wide concurrent file contention and lock risk telemetry.
  - 8 FastMCP JSON-RPC 2.0 tools: `propose_session_merge`, `list_session_merges`, `get_session_merge_details`, `auto_resolve_merge_conflicts`, `resolve_merge_conflict_hunk`, `verify_merge_readiness`, `execute_session_merge`, `get_session_merge_matrix`.
  - Frontend AgentsView **🔀 Multi-Agent Merge Matrix & Conflicts Hub** dashboard with metric cards, active merge requests table, interactive 3-way split diff inspector (Base, Source Ours, Target Theirs), conflict hunk resolver, 1-click AST/Union auto-resolution, workspace file contention matrix, and 1-click Propose Merge modal.
  - 7 automated end-to-end tests in `tests/test_session_merges_conflict_engine.py` (430/430 tests passing across 32 test suites with 100% frontend guard, CSS sync, and headless browser E2E verification).

## [1.25.0] - 2026-08-28 - Cycle 28
### Added
- **Live Step-by-Step Trajectory Stream, Tool Execution Telemetry & Autonomous Swarm Choreography Hub (Milestone 5 / Epic 26):**
  - Schema migration (`1710000038_add_session_trajectories_and_swarm.js`) extending `agent_sessions` with `total_steps`, `total_tokens`, `total_cost_usd`, `current_step_type`, `active_tool`, `swarm_role`, `swarm_parent_id`, `swarm_cluster_id`, and `trajectory_summary`, plus new `session_trajectories` and `swarm_clusters` collections.
  - Backend engine hook (`app/pb_hooks/110_session_trajectories_swarm_engine.pb.js`) with 11 endpoints for step timeline recording (`POST /api/projectbase/sessions/{id}/trajectories`), bulk ingestion (`POST /trajectories/bulk`), chronological step retrieval with filtering (`GET /trajectories`), deep trajectory profiling & tool latency summaries (`GET /trajectories/summary`), swarm cluster initialization (`POST /api/projectbase/swarm/clusters`), cluster queries (`GET /clusters` and `GET /clusters/{id}`), dynamic worker additions (`POST /clusters/{id}/workers`), cascading lifecycle state transitions (`POST /clusters/{id}/status`), and swarm execution metrics aggregation (`GET /clusters/{id}/metrics`).
  - 8 FastMCP JSON-RPC 2.0 tools: `record_session_trajectory_step`, `get_session_trajectories`, `get_session_trajectory_summary`, `create_swarm_cluster`, `list_swarm_clusters`, `get_swarm_cluster_details`, `add_swarm_cluster_workers`, `update_swarm_cluster_status`.
  - Frontend AgentsView with 📈 **Live Step Trajectory Stream** showing chronological reasoning steps, expandable tool input/output inspectors, latency ms meters, token spend breakdowns (prompt, completion, reasoning), USD cost counters, and dedicated 🐝 **Autonomous Swarm Choreography & Cluster Hub** dashboard with topology selectors (Hierarchical, Flat Fanout, Pipeline, Adversarial Critique), live worker node pools, and cluster lifecycle control buttons.
  - Complete automated test suite in `tests/test_session_trajectory_and_swarm.py` bringing total verified tests to 423 across 31 test suites with 100% frontend guard and headless browser E2E verification.

## [1.24.0] - 2026-08-28 - Cycle 27
### Added
- **One-Click Session Branching, Re-Tasking & Human Intervention Gate (Milestone 4 / Epic 25):**
  - Schema migration (`1710000037_add_session_branching_and_intervention.js`) extending `agent_sessions` with `parent_session_id`, `branch_name`, `branch_type`, `generation`, `is_paused`, `intervention_gate`, `injected_instructions`, `worktree_path`, and `conflict_status`, and introducing dedicated `session_interventions` collection for full auditability.
  - Backend engine hook (`app/pb_hooks/109_session_branching_intervention_engine.pb.js`) with 11 endpoints for interactive DAG branching (`POST /api/projectbase/sessions/{id}/branch`), DAG tree graph queries (`GET /api/projectbase/sessions/{id}/dag` and `GET /api/projectbase/sessions/dag`), process pause/resume (`POST /pause`, `POST /resume`), live prompt steering injection (`POST /inject`), chronological intervention timelines (`GET /interventions`), Human Intervention Gate approval/rejection (`POST /gate`), worktree conflict detection and arbitration (`POST /arbitrate` and `GET /conflicts`), and multi-agent swarm fan-out dispatch (`POST /swarm/dispatch`).
  - 8 FastMCP JSON-RPC 2.0 tools: `branch_agent_session`, `inject_session_instruction`, `pause_agent_session`, `resume_agent_session`, `set_session_intervention_gate`, `get_session_dag`, `arbitrate_session_conflicts`, `dispatch_session_swarm`.
  - Frontend AgentsView with interactive 🌿 **DAG Lineage** tree visualizer, 💬 **Interventions & Control** console with live steering prompt injection, pause/resume toggle, 1-click Human Gate decision buttons (Approve / Reject / Hold), and 🔀 **1-Click Branch Modal** supporting fork, continuation, retry, repair, and swarm worker types.
  - Complete automated test suite in `tests/test_session_branching_and_intervention.py` bringing total coverage to 418/418 passing tests across 30 test files with 100% frontend guard and full iBrowse browser verification.

## [1.23.0] - 2026-08-28 - Cycle 26
### Added
- **Deep Observability & Ground Truth Verification Hub (Milestone 3):**
  - Schema migration (`1710000036_add_session_observability.js`) extending `agent_sessions` with `git_diff_raw`, `git_diff_files`, `sceptic_audit`, `verification_badge`, and `verification_score` fields, and adding `session_audits` collection for permanent multi-auditor history logs.
  - Backend engine hook (`app/pb_hooks/108_session_observability_engine.pb.js`) with 8 endpoints (`/api/projectbase/sessions/{id}/diff`, `/api/projectbase/sessions/{id}/verdict`, `/api/projectbase/sessions/{id}/audit`, `/api/projectbase/observability/summary`, `/api/projectbase/observability/verify-suite`) for unified git diff parsing, Pytest/Playwright verdict evaluation, and Sceptic P0 veto enforcement.
  - 8 FastMCP JSON-RPC 2.0 tools: `ingest_agent_session`, `record_session_heartbeat`, `record_session_diff`, `record_test_verdict`, `submit_sceptic_audit`, `get_session_observability`, `list_agent_sessions`, `fork_agent_session`.
  - Frontend AgentsView **🔍 Ground Truth Observability Hub** panel with visual unified git diff browser, file hunk selector, test pass breakdown meter, 1-click test suite runner, and Sceptic audit/veto inspector.
  - 10 automated end-to-end tests in `tests/test_session_observability.py` (411/411 passing across 29 test suites with 100% frontend guard and CSS sync verification).


## [1.22.0] - 2026-08-28 - Cycle 23
### Added
- **Autonomous AI Agent Auto-Healing & Self-Remediation Workflow Pipeline (Epic 22):**
  - Schema migration (`1710000033_add_auto_heal_pipeline.js`) adding `auto_heal_policies`, `auto_heal_incidents`, and `auto_heal_health_checks` collections.
  - Backend auto-healing engine hook (`app/pb_hooks/105_auto_heal_pipeline.pb.js`) with 16 REST API endpoints (`/api/projectbase/auto-heal/*`) supporting policy CRUD, automated error diagnosis, incident lifecycle reporting and resolution, crash recovery sweep, blueprint remediation recipes, and workspace MTTR telemetry.
  - 8 FastMCP JSON-RPC 2.0 tools: `list_auto_heal_policies`, `create_auto_heal_policy`, `list_auto_heal_incidents`, `get_auto_heal_incident_details`, `trigger_auto_healing`, `resolve_auto_heal_incident`, `run_crash_recovery_sweep`, `get_auto_heal_metrics`.
  - Frontend AgentsView **🩺 Auto-Heal & Remediation** dashboard tab with live KPI meters, fleet diagnostics matrix, interactive incident log, 1-click blueprint recipe applicator, and custom policy builder.
  - 11 automated end-to-end tests in `tests/test_auto_heal_pipeline.py` (381/381 passing across 26 test suites with 100% frontend guard and headless render QA verification).

## [1.21.0] - 2026-08-28 - Cycle 22
### Added
- **Native Cross-Workspace Multi-Tenant Tenant Isolation & Granular Resource Quotas (Epic 21):**
  - Schema migration (`1710000032_add_multi_tenant_quotas.js`) adding `tenants`, `tenant_quotas`, and `tenant_memberships` collections.
  - Backend multi-tenant engine hook (`app/pb_hooks/104_multi_tenant_quota_engine.pb.js`) with 14 REST API endpoints (`/api/projectbase/tenants/*`) supporting workspace provisioning, custom quota limits, real-time resource metering, dynamic quota enforcement gate checks, tenant context switching, cross-tenant metrics, and membership management.
  - Granular resource quota enforcement with plan tiers (Free, Pro, Enterprise) and configurable enforcement modes (hard block, soft warning, warn-only) across projects, issues, agents, storage capacity, monthly API calls, and workflow executions.
  - 8 FastMCP JSON-RPC 2.0 tools: `list_tenants`, `create_tenant`, `get_tenant_details`, `configure_tenant_quotas`, `get_tenant_usage`, `check_tenant_quota`, `switch_tenant_context`, `get_tenant_metrics`.
  - Frontend AgentsView **🏢 Multi-Tenant & Quotas** dashboard tab with live KPI meters, interactive workspace provisioner, real-time quota gauges with visual utilization progress bars, dynamic quota enforcement gate simulator, and tenant memberships roster.
  - 8 automated end-to-end tests in `tests/test_multi_tenant_quotas.py` (370/370 passing across 25 test suites with 100% frontend guard and headless render QA verification).

## [1.20.0] - 2026-08-28 - Cycle 21
### Added
- **Native End-to-End Workflow Automations & AI Agent Trigger Pipelines (Epic 20):**
  - Schema migration (`1710000031_add_workflow_automations.js`) adding `workflow_rules`, `workflow_runs`, and `workflow_triggers_audit` collections.
  - Backend automation engine hook (`app/pb_hooks/103_workflow_automations_engine.pb.js`) with 12 REST API endpoints (`/api/projectbase/automations/*`) supporting conditional DAG execution, manual/automated event triggers, and test execution simulator.
  - Built-in DAG pipeline actions: `dispatch_agent`, `create_subtasks`, `send_notification`, `send_webhook`, `update_issue`, `add_comment`, and `log_audit`.
  - Starter blueprint templates library (`GET /api/projectbase/automations/templates`): Auto-Triage & Assign Bug to SRE Agent, Copilot Subtask Auto-Generation on Start, SLA Urgent Priority Alerting, Done Verification & QA Checkpoint.
  - Real-time automation metrics telemetry and duration tracking (`GET /api/projectbase/automations/metrics`).
  - 8 FastMCP JSON-RPC 2.0 tools: `list_automation_rules`, `create_automation_rule`, `trigger_automation_pipeline`, `list_automation_runs`, `get_automation_run_details`, `retry_automation_run`, `get_automation_metrics`, `list_automation_templates`.
  - Frontend AgentsView **⚡ Automations & Pipelines** dashboard tab with live KPI meters, 1-click blueprint template applicator, interactive rule designer, live trigger simulator, and step trace execution history table.
  - 8 automated end-to-end tests in `tests/test_workflow_automations.py` (362/362 passing across 24 test suites with 100% frontend guard and headless render QA verification).

## [1.19.0] - 2026-08-28 - Cycle 20
### Added
- **Enterprise OIDC / SAML SSO Federation & Granular RBAC Matrix (Epic 19):**
  - Enterprise SSO provider federation with turnkey support for Google Workspace, GitHub Enterprise, Okta, and Keycloak (`/api/projectbase/sso/providers*`).
  - OIDC well-known discovery metadata endpoint (`GET /api/projectbase/sso/providers/{id}/discovery`).
  - JIT (Just-In-Time) user account provisioning and SSO token exchange engine (`POST /api/projectbase/sso/auth/exchange`).
  - 7 system roles (`owner`, `admin`, `maintainer`, `member`, `agent`, `viewer`, `auditor`) with protected system role overwrite/deletion guards.
  - Granular custom role creator, capability wildcard matcher, and 2D RBAC permissions matrix (`/api/projectbase/rbac/roles*`, `GET /api/projectbase/rbac/matrix`).
  - Fine-grained permission checker (`POST /api/projectbase/rbac/check`) and role assigner (`POST /api/projectbase/rbac/assign`).
  - Scoped API tokens generator with TTL and capability constraints (`/api/projectbase/rbac/tokens*`).
  - Immutable security & access audit logging with filtering and JSON/CSV export (`/api/projectbase/rbac/audit-logs*`).
  - 8 FastMCP JSON-RPC 2.0 tools: `list_sso_providers`, `configure_sso_provider`, `exchange_sso_token`, `check_rbac_permission`, `list_rbac_roles`, `assign_rbac_role`, `get_rbac_matrix`, `get_security_audit_logs`.
  - Frontend AgentsView **🛡️ Identity & RBAC** dashboard with interactive SSO simulator, 2D matrix viewer, permission evaluator, and audit export.
  - 11 new automated test assertions in `tests/test_sso_rbac_matrix.py` (354/354 passing across 23 suites).

---

All notable changes to **ProjectBase** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

ProjectBase is **100% free and open-source (MIT)**. It never adds monetization,
subscriptions, Stripe, or paid tiers.

## [Unreleased]

### Added
- **Autonomous Multi-Model Consensus & Peer Review Gate Engine (Epic 18)**:
  - Native multi-model AI consensus verification for critical issue merges, PRs, and releases (`POST/GET /api/projectbase/consensus/gates`, `GET/DELETE /api/projectbase/consensus/gates/{id}`) backed by `consensus_gates` and `consensus_ballots` PocketBase collections.
  - Verifiable cryptographic peer-review ballot engine (`POST /api/projectbase/consensus/ballots/submit`) with deterministic SHA-256 signatures, confidence scoring (0.0 to 1.0), and structured findings.
  - Automated quorum evaluation and divergence scoring engine (`POST /api/projectbase/consensus/gates/evaluate`) calculating weighted consensus scores, entropy divergence indexes, arbiter verdicts (`approved`, `rejected`, `contested`), and automatic issue transition/commenting.
  - Automated 1-Click Multi-Model Debate orchestrator (`POST /api/projectbase/consensus/debate/start`) deploying specialized persona review passes (SecurityAuditor, ArchitecturePragmatist, QASRE, BenchmarkAnalyst).
  - Workspace-wide consensus metrics & model participation telemetry (`GET /api/projectbase/consensus/metrics`).
  - Seven FastMCP JSON-RPC 2.0 tools (`create_consensus_gate`, `submit_consensus_ballot`, `evaluate_consensus_gate`, `list_consensus_gates`, `get_consensus_gate_details`, `start_consensus_debate`, `get_consensus_metrics`).
  - Frontend AgentsView **⚖️ Consensus & Gates** dashboard with interactive gate creation, live quorum progress meters, cryptographic signature verifier, and 1-click multi-model debate orchestration.
  - 9 new integration tests in `tests/test_consensus_gates.py` bringing the test suite to 343 passed tests across 22 files.
- **OpenAPI Agent SDK Generation, Interactive Documentation & Webhook Observability (Epic 17)**:
  - Turnkey client SDK code generator (`POST /api/projectbase/sdk/generate`, `GET /api/projectbase/sdk/languages`, `GET /api/projectbase/sdk/templates/{lang}`) producing production-ready typed client snippets for Python (`ProjectBaseClient`), TypeScript (`ProjectBaseClient`), JavaScript ESM, cURL CLI, and Agent Tool JSON Schemas.
  - Real-time webhook & agent API observability telemetry engine (`GET /api/projectbase/observability/metrics`) tracking p50/p90/p95/p99 delivery latencies, throughput (req/min), error rate %, and latency bucket distributions.
  - Automated observability alert threshold manager & evaluation engine (`GET/POST/DELETE /api/projectbase/observability/alerts*`) with configurable SLA violation triggers, multi-channel dispatch, and event breach recording.
  - Interactive agent integration recipes and unified API specification (`GET /api/projectbase/docs/recipes`, `GET /api/projectbase/docs/spec`).
  - Seven FastMCP JSON-RPC 2.0 tools (`generate_agent_sdk`, `list_sdk_languages`, `get_api_schema_spec`, `get_webhook_observability_metrics`, `configure_alert_thresholds`, `get_observability_alerts`, `get_integration_recipes`).
  - Frontend AgentsView **📚 SDK & Observability** dashboard with interactive code generator, live KPI meters, SLA alert rule manager, and agent recipes explorer.
  - 13 new integration tests in `tests/test_sdk_observability.py` bringing the test suite to 334 passed tests across 21 files.
- **Webhook Automation Engine & Outbound Webhook Security Gateway (Epic 16)**:
  - Webhook endpoint fleet management (`POST/GET /api/projectbase/webhooks/endpoints`, `GET/DELETE /api/projectbase/webhooks/endpoints/{id}`) with platform adapters for Slack, Discord, Telegram, Agent, and custom targets.
  - Cryptographic HMAC-SHA256 signing and verification (`POST /api/projectbase/webhooks/dispatch`, `POST /api/projectbase/webhooks/verify`) with constant-time comparison and a configurable timestamp replay window.
  - Declarative event filters and platform-native payload transforms (`GET /api/projectbase/webhooks/transforms/preview`) for Slack blocks, Discord embeds, Telegram HTML, and agent JSON envelopes.
  - Delivery audit history (`GET /api/projectbase/webhooks/deliveries`) plus a persistent Dead-Letter Queue (`GET/POST/DELETE /api/projectbase/webhooks/dlq*`) with exponential retry backoff and jitter metadata.
  - Seven FastMCP JSON-RPC 2.0 tools (`register_webhook_endpoint`, `list_webhook_endpoints`, `dispatch_webhook_event`, `verify_webhook_signature`, `get_webhook_dlq`, `retry_dlq_message`, `preview_webhook_transform`) for autonomous agents.
  - AgentsView **📡 Webhooks & DLQ** dashboard with endpoint registration, live delivery/DLQ telemetry, dispatcher, transform preview, replay, and purge actions.
  - 9 new integration tests in `tests/test_webhook_automation.py`, bringing the baseline to 321 tests across 20 suites (100% passing).

- **Distributed Cross-Cluster Replication, High-Availability Failover & Edge SQLite Sync (Epic 15)**:
  - Cluster Peer Node Management (`POST /api/projectbase/cluster/nodes/register`, `GET /api/projectbase/cluster/nodes`, `POST /api/projectbase/cluster/nodes/heartbeat`, `DELETE /api/projectbase/cluster/nodes/{id}`): Dynamic discovery, role orchestration (primary, replica, edge, witness), region labeling, and heartbeat telemetry with sequence numbers.
  - Replication Delta Log Stream (`GET /api/projectbase/cluster/sync/pull`, `POST /api/projectbase/cluster/sync/push`): High-throughput delta change stream pulling and pushing with Lamport/vector clock conflict resolution, Last-Write-Wins (LWW) determinism, and split-brain fencing barriers.
  - Point-in-Time Snapshot Engine (`POST /api/projectbase/cluster/sync/snapshot`): Lightweight zero-copy state snapshot bundles with SHA-256 integrity checksums for cold-start edge initialization and mobile catch-up.
  - High-Availability Quorum & Failover Engine (`GET /api/projectbase/cluster/failover/status`, `POST /api/projectbase/cluster/failover/promote`, `POST /api/projectbase/cluster/failover/fencing`): Automatic quorum health evaluation, failover election orchestration, term epoch advancement, and split-brain fencing token validation (`PB-FENCE-T<term>-<node>`).
  - Offline-First Edge Reconciler (`POST /api/projectbase/cluster/edge/reconcile`): Two-way synchronization protocol merging local offline changes with server replication log and computing unified vector clocks.
  - FastMCP JSON-RPC 2.0 Tools (`register_cluster_node`, `list_cluster_nodes`, `pull_cluster_deltas`, `push_cluster_deltas`, `get_cluster_failover_status`, `trigger_cluster_failover`, `reconcile_edge_sync`): Exposes full cluster synchronization and edge replication capabilities to autonomous agents.
  - Frontend AgentsView **🌐 Cluster & Edge Replication** Dashboard: Interactive dashboard with live quorum meters, node fleet status, manual primary promotion, and 1-click delta synchronization.
  - 13 new automated tests in `tests/test_cluster_replication.py`, bringing total test coverage to 312 tests across 19 suites (100% passing).

- **Autonomous Agent Autoscaling, Dynamic Workload Orchestration & Self-Healing Engine (Epic 14)**:
  - Real-Time Workload Analytics (`GET /api/projectbase/agents/workload`): Evaluates queue saturation %, per-persona queue depth (backend, frontend, qa, review, architect, docs, general), active task leases, reserved worker slots, and SLA clearance forecasts.
  - Dynamic Persona Autoscaler (`POST /api/projectbase/agents/autoscale`): Calculates optimal worker allocations across persona pools and recommends horizontal scaling strategies (`scale_up`, `scale_down`, `maintain`) based on real-time backlog pressure.
  - Worker Slot Capacity Reservation Engine (`POST /api/projectbase/agents/capacity/reserve`, `POST /api/projectbase/agents/capacity/release`): Reserves concurrency capacity slots for autonomous agent workers with configurable TTL auto-expiration.
  - Autonomous Workflow Self-Healing Engine (`POST /api/projectbase/workflow/self-heal`): Detects and automatically reconciles expired task locks, stalled DAG parent/child issues, inconsistent statuses, and expired reservations with structured repair audits in `workflow_heals`.
  - Continuous Live Database Benchmarking (`GET /api/projectbase/benchmarks/live`, `POST /api/projectbase/benchmarks/run`): Sub-millisecond latency probes, p50/p95 distributions, SQLite WAL status, and throughput rating.
  - FastMCP JSON-RPC 2.0 & Python Client Expansion: Added `get_agent_workload_status`, `calculate_autoscale_recommendations`, `reserve_agent_capacity`, `release_agent_capacity`, `run_workflow_self_heal`, and `get_live_benchmarks`.
  - Frontend AgentsView **⚡ Workload & Autoscaler** Dashboard: Interactive capacity meters, persona queue breakdowns, dynamic autoscaler optimizer, one-click Auto-Heal execution, and live database latency graphs.
  - Comprehensive Test Suite: 16 new automated tests in `tests/test_autoscale_orchestration.py`, bringing the total test suite to 299 tests across 18 files.

- **Autonomous Agent Code Sandbox, Git Artifact Workspace Engine & Webhook Auto-Triage (Epic 13)**:
  - Git Artifacts Engine (`/api/projectbase/git/artifacts`, `/api/projectbase/git/status`): Track linked code branches, commit SHAs, pull request states, CI workflow runs, and unified diff patches associated with issues.
  - Autonomous Kanban Stage Transitions: Linking an active branch moves issues to `in_progress`; opening a PR shifts status to `in_review`; merging a PR automatically advances status to `done` and synchronizes metadata.
  - Staged Code Patch Sandbox (`POST /api/projectbase/git/patch`, `GET /api/projectbase/git/patch/{id}`): Upload and review unified diff patches directly on issues with syntax-aware diff statistics (+additions, -deletions, files changed).
  - Universal Git Webhook Receiver (`POST /api/projectbase/webhooks/git`): Case-insensitive GitHub/GitLab webhook receiver with regex-free token triage parsing issue identifiers from commit messages, branch names, and PR titles.
  - FastMCP JSON-RPC 2.0 Tool Expansion: Adds `link_git_commit`, `link_git_pr`, `get_issue_git_artifacts`, `stage_code_patch`, `process_git_webhook`, and `get_project_git_status`.
  - Frontend IssueDrawer & Board UI Enhancements: Integrated **🌿 Git & Code** artifacts panel with one-click copy `git checkout <branch>` command, PR badges, commit diff stats, and visual branch/PR indicators across Kanban and List views.
  - Comprehensive Test Suite: 13 new integration tests in `tests/test_git_workspace_engine.py`, expanding the test surface to 283 passing tests across 17 test suites with 100% headless DOM QA pass.

- **Multi-Host Federation, Real-Time Agent Stream UI & Autonomous Anomaly Detection Engine (Epic 12)**:
  - Multi-Host Federation Bridge (`/api/projectbase/federation/export`, `/api/projectbase/federation/import`, `/api/projectbase/federation/sync`): Exports portable workspace bundles with SHA-256 data integrity checksums; imports with `merge`, `overwrite`, and `skip_existing` conflict resolution strategies and foreign-key remapping.
  - Autonomous Workflow Anomaly Detection & Auto-Heal (`GET/POST /api/projectbase/analytics/anomalies`): Diagnostic engine scanning for expired agent task leases, rapid failure loops, circular deadlock cycles, and backlog starvation, with automated lock revocation and issue triage.
  - Agent Persona Throughput & MTTC Metrics (`GET /api/projectbase/analytics/throughput`): Calculates Mean Time to Complete (MTTC) per agent persona, validation pass rate %, daily velocity, and 7-day throughput forecast.
  - FastMCP JSON-RPC 2.0 Tool Expansion: Adds `export_federation_bundle`, `import_federation_bundle`, `get_agent_analytics`, and `detect_workflow_anomalies`.
  - Frontend AgentsView UI Enhancements: Integrated tabs for Chat Stream, Diagnostics & Auto-Heal, Persona Throughput metrics, and Federation Sync.
  - Comprehensive Test Suite: 12 new integration tests in `tests/test_federation_analytics.py`, expanding the test surface to 270 passing tests across 16 test suites.

- **Autonomous Workspace Synthesis & Cross-Project Knowledge Retrieval (Epic 11)**:
  - Deep Semantic & Full-Text Workspace Search (`GET/POST /api/projectbase/workspace/search`): Universal search indexing across issues, comments, checkpoints, and telemetry logs with term scoring, token match weighting, type filtering, and project scoping.
  - Cross-Project Blocker & Deadlock Detection (`GET /api/projectbase/workspace/blockers`): Detects cross-project issue dependencies, circular dependency cycles via Kahn's algorithm, calculates dependency graph depth and longest critical paths, and ranks top blocker issues.
  - Automated Sprint Retrospectives & Productivity Metrics (`GET/POST /api/projectbase/workspace/retrospective`): Computes cycle completion rates, story point velocity, persona contributions, average cycle time, and generates automated Markdown retrospectives with recommendations.
  - FastMCP Collaboration Tools: Exposes `workspace_search`, `get_workspace_blockers`, and `generate_retrospective` over JSON-RPC 2.0.
  - Comprehensive Test Suite: 13 new integration tests in `tests/test_workspace_synthesis.py` bringing the verified suite to 258 passing tests.

- **Autonomous Agent Swarm Choreography & Task Graph Decomposition (Epic 10)**:
  - Task Graph DAG Decomposition (`POST /api/projectbase/dag/decompose`): Decomposes parent goals into child tasks with persona assignments (`architect`, `coder`, `reviewer`, `qa`, `security`), estimated points, and dependency edges (`blocks` / `blocked_by`), with Kahn's algorithm cycle detection preventing circular task deadlock.
  - Topological DAG Execution Status (`GET /api/projectbase/dag/status`): Computes real-time execution states, ready vs blocked candidate tasks, progress percentages, active agent leases, and DAG completion status.
  - Automated Step Dispatching (`POST /api/projectbase/dag/step`): Selects the next unblocked ready task, filters by requested agent persona, sets status to `in_progress`, and claims an exclusive execution lease.
  - Dynamic Subtask Persona Splitting (`POST /api/projectbase/tasks/split`): Enables granular subtask checklist splitting with persona specialization and story point estimation.
  - Automated Peer-Review & Validation Checkpoints (`POST /api/projectbase/checkpoints/submit`, `GET /api/projectbase/checkpoints`, `task_checkpoints` collection): Quality gates before issue resolution, supporting reviews, unit tests, QA E2E verification, security scans, and telemetry event logging.
  - FastMCP JSON-RPC 2.0 & Python Client Tools: Exposes `decompose_task_graph`, `get_dag_status`, `execute_dag_step`, `split_subtasks`, `submit_validation_checkpoint`, and `get_validation_checkpoints` over HTTP and via `scripts/mcp_server.py`.
  - Comprehensive automated test suite (`tests/test_swarm_dag.py`) expanding total test coverage to 245/245 passing tests across 14 test suites.
- **FastMCP cycle + milestone tools** (`scripts/mcp_server.py`): the agent-facing
  FastMCP server previously exposed projects/issues/relations/notifications/
  dispatch tools but had **no** way to read cycles or milestones, even though
  both are core collections with full UI views. Added `list_cycles` (optionally
  project-filtered), `get_cycle_progress` (total/done/in-progress/todo,
  percent, story points), `list_milestones` (optionally project-filtered), and
  `get_milestone_progress` (linked-issue totals + percent). Agents can now
  query sprint and roadmap state directly instead of falling back to raw REST.
  New pytest `test_mcp_server_cycle_and_milestone_tools` compiles the module
  with a stub FastMCP and drives all four tools against the live instance
  (read-only). 230 → 231 tests.
- **FastMCP `dispatch_agent` tool** (`scripts/mcp_server.py`): the MCP server
  now exposes the charter's signature autonomous-dispatch endpoint as a native
  tool. Previously agents had 16 MCP tools covering projects/issues/cycles/
  comments but had to fall back to raw REST to claim an issue for an agent
  (`POST /api/projectbase/dispatch-agent`). `dispatch_agent(identifier_or_id,
  agent_target, prompt)` resolves an identifier to a record id, claims the
  issue (marks it `in_progress`, assigns the target agent), posts the
  "Autonomous Task Claimed" audit comment, forwards external dispatcher
  webhooks when configured, and returns the claimed-issue summary. New pytest
  (`test_mcp_server_dispatch_agent_tool`) drives the tool against the live
  instance end-to-end and asserts the persisted state + audit comment. 220 →
  221 tests.
- **Custom Agent dispatch with custom instructions (agent dispatch UI)**
  (`app/pb_public/js/components/IssueDrawer.js`): the drawer's Trigger Agent
  dropdown now exposes a **Custom Agent** target plus an inline custom-instruction
  prompt editor (8000-char cap mirrored from the backend). This makes the
  charter's signature autonomous-dispatch moat fully reachable from the UI:
  previously the backend accepted `agent_target: "custom"` with a `prompt` (and
  OpenAPI documented it), but the frontend only offered `flomaster`/`hermes`/
  `windmill` and never sent a prompt. The `dispatchAgent(target, prompt)` method
  now sends the prompt to `POST /api/projectbase/dispatch-agent`, which marks the
  issue `in_progress`, assigns **Custom Agent**, and echoes the instructions in
  the audit comment. New pytest
  (`test_dispatch_agent_custom_target_with_prompt`) and render-QA assertions cover
  the custom target, prompt forwarding, and the dropdown's prompt editor +
  char counter.

### Fixed
- **AGENTS.md agent-facing technical map no longer drifts from the tree**
  (`AGENTS.md`, `tests/test_agents_drift_guard.py`): the `**Tests:**` bullet
  claimed "223 tests across 10 files" while the real suite was 227 tests across
  11 files, and the `tests/` directory-map line listed only 5 of the 11 files.
  Both are now corrected to the actual state (229 tests / 12 files) and a new
  `test_agents_drift_guard.py` locks the two claims to the tree: it fails on
  any mismatch between the AGENTS.md test count/file count and the real pytest
  surface, and fails if any `tests/test_*.py` is missing from the map. Test
  count: 227 → 229.
- **Test fixtures no longer leak into the dogfooded live instance**
  (`tests/test_api.py`, `tests/test_fixture_hygiene.py`,
  `scripts/cleanup-test-fixtures.py`): `test_export_json_round_trips_custom_fields`
  created a "Export CustomFields <uid>" issue via the direct collection API and
  never deleted it, so every suite run added one more record to the real
  backlog (147 stale records at cycle 50). The session cleanup now also sweeps
  canonical fixture-title prefixes via the new
  `scripts/cleanup-test-fixtures.py` (single source of truth for the prefix
  list), and a new `test_fixture_hygiene.py` guard fails on any fixture
  pollution the next time the suite runs. The existing 147 records were
  removed from the live instance. Test count: 229 → 230.
- **Docker image no longer bakes the local dev database into itself**
  (`.dockerignore`, `tests/test_deploy_consistency.py`): there was no
  `.dockerignore`, so `docker build` sent `app/pb_data` (the dev SQLite DB +
  logs, ~180 MB) to the daemon and `COPY app /app/app` baked it into the
  image. The Dockerfile declares `VOLUME ["/app/app/pb_data"]`, and Docker
  copies image content into any fresh volume it creates for that path — so a
  self-hosted deployment using a named or anonymous volume (`docker run -v`,
  k8s, Portainer, cloud run) booted into the developer's 100+ test/probe
  issues instead of the clean 6-project / 17-issue migration seed. (The repo's
  own dev compose bind-mounts `./app/pb_data` and masks the leak; the image
  itself still carried the dev DB.) Added `.dockerignore` (build context drops
  ~200 MB → 5.5 MB) and two static regression tests asserting the dev-data
  dirs are excluded. Verified: a fresh named-volume boot now seeds exactly
  6 projects / 17 issues with no leaked probes. Test count: 221 → 223.
  (`scripts/mcp_server.py`): the MCP server is the agent-facing moat — every
  tool error message is consumed verbatim by AI agents (Cursor, Flomaster,
  Hermes, Claude). Several auth/connection error messages were written in
  Romanian, degrading LLM comprehension. Translated `_AUTH_HELP` and the
  `UNAUTHENTICATED` / `AUTH_REQUIRED` / `CONNECTION_FAILED` messages to English,
  and added `test_mcp_server_surface_is_english`, a regression guard that fails
  if Romanian diacritics (`ă â î ș ț`) re-leak into the file.
- **Agent-facing docs no longer leak unresolved `${PROJECTBASE_URL:-...}`
  env placeholders** (`app/pb_public/llms.txt`, `app/pb_public/llms-full.txt`,
  `app/pb_public/js/components/DocsView.js`): these files are served statically
  from a zero-build PocketBase install, so the bash-style env-var default syntax
  was never substituted — a copy-paste trap for agents and users alike. The
  llms docs now contain the concrete default (`http://localhost:8120`), and the
  Docs view's FastMCP setup snippet resolves `PROJECTBASE_URL` from
  `window.location.origin` at runtime so the copy-paste MCP config is correct on
  any host. Regression guards: `test_llms_full_txt_no_env_placeholders` and
  `test_docs_surface_no_env_placeholders` fail on any `${...}` in the served
  docs surface, plus a new `docsQA` render-QA block asserts the Docs view shows
  a concrete origin with no placeholder. Test count: 216 → 218.
- **Secret-scan guard now catches `sk_live_`/`sk_test_`/`whsec_` keys with
  `_`/`-` separators in the body** (`tests/test_secret_scan.py`): the old
  alphanumeric-only pattern (`[A-Za-z0-9]{10,}`) silently missed separator-heavy
  key formats such as the iBrowse `sk_live_kAbz_...-...` family — the exact leak
  class the guard exists to block (cycle-12 P1 regression). The character class
  now tolerates `_`/`-`, and a new regression test
  (`test_sk_live_pattern_catches_separator_keys`) proves both plain and
  separator-heavy forms match while the old pattern does not. Verified live: the
  guard now fails when the real key is injected into any tracked file. Test
  count: 218 → 219.
- **Agent dispatch webhook payload now includes the issue title/description**
  (`app/pb_hooks/80_agent_triggers.pb.js`): the external Windmill and generic
  `AGENT_TRIGGER_WEBHOOK` payloads previously referenced `title`/`desc` that
  were never read off the issue, so every external dispatch sent `undefined`
  for the issue title and description. The hook now reads
  `issue.get("title")` / `issue.get("description")` before building either
  payload, and maps each allowed `agent_target` (`flomaster`, `hermes`,
  `windmill`, `custom`) to a distinct, human-facing agent name so the audit
  trail is unambiguous. A regression guard
  (`test_dispatch_agent_webhook_payload_reads_title_description`) fails if the
  field reads or the per-target mapping are removed.

### Added
- **Plane issues importer** (`POST /api/projectbase/import/plane`): imports a
  Plane workspace CSV export (Workspace Settings > Exports > select project >
  Export > CSV). Accepts either an array of row objects keyed by Plane's export
  columns or the raw CSV export text (`csv`), maps State/Priority/Labels/
  Assignees/Start Date/Target Date/Estimate/Description, and is idempotent
  (keyed by Plane issue ID via `source_metadata.source_key`). This closes the
  last must-have importer gap in the feature matrix, which claimed
  `Importers (Linear/Plane/GitHub)` while only CSV + Linear + GitHub existed.
  New "Plane" tab in the Import modal. Agent surface stays in sync:
  `openapi.json` and `llms.txt`.
- **Linear issues importer** (`POST /api/projectbase/import/linear`): imports a
  Linear workspace export (Settings > Administration > Import/Export > Export
  data). Accepts either an array of row objects keyed by Linear's CSV columns or
  the raw CSV export text (`csv`), maps Status/Priority/Labels/Assignee/Due
  Date/Estimate/Description, and is idempotent (keyed by Linear issue ID via
  `source_metadata.source_key`). New "Linear" tab in the Import modal. Agent
  surface stays in sync: `openapi.json` and `llms.txt`.

### Fixed
- **Header layout hardening + agent-prompt char cap** (`Header.js`,
  `IssueDrawer.js`, `app.css`): the header now keeps the logo, view tabs, and
  action cluster from squishing on narrow windows (`gap-2` + `flex-shrink-0`),
  the view-switcher tab strip scrolls horizontally when crowded and hides its
  scrollbar via a new `.scrollbar-none` utility, and the Custom Agent
  instruction editor enforces the backend's 8000-char limit with
  `maxlength="8000"`. The header logo renders as **PBase** to match the compact
  brand. Also closes a CSS drift guard gap: `.scrollbar-none` is now a real
  utility in `app.css` (the drift test was failing because the class was used
  but not defined).

## [1.0.0] - 2026-08-25

### Added
- **Runtime-editable notification channel settings**: the webhook dispatcher
  (`60_notifications.pb.js`) previously only read Discord/Telegram/generic-webhook
  config from process environment (`DISCORD_WEBHOOK_URL`, `TELEGRAM_*`,
  `PROJECTBASE_WEBHOOK_URL`). A new admin-gated
  `/api/projectbase/notification-settings` GET/PUT route + `notification_settings`
  singleton collection (migration 19) lets a self-hoster change channels in-app
  and have them apply immediately, without restarting the binary. The dispatcher
  reads the DB row first and falls back to env, so existing installs and Docker
  deployments keep working unchanged. A header gear button opens a new
  NotificationSettingsModal with fields for Discord webhook, Telegram token +
  chat ID, and a generic webhook URL. Agent surface stays in sync: `openapi.json`,
  `llms.txt`/`llms-full.txt`, and two FastMCP tools
  (`get_notification_settings` / `update_notification_settings`). New pytest
  coverage (auth, GET/PUT roundtrip, frontend drift-guard) and a render-QA E2E.
  No behavior change when no channel is configured.
- **Global cross-project search in the Cmd+K omnibox**: the command palette
  now searches issues across **every** project (title, identifier, status,
  priority) via a new `/api/projectbase/search` route, not just the currently
  selected project. Typing a query surfaces matches from other workspaces with
  a project tag, and selecting a cross-project result switches to that project
  and opens the full issue drawer. Agent surface stays in sync: the route is
  documented in `openapi.json`, `llms.txt`/`llms-full.txt`, and exposed as a
  new `search_issues` FastMCP tool. Wired in `app/pb_hooks/30_custom_routes.pb.js`,
  `CommandPalette.js`, `app.js` (`openGlobalIssue`), and `api.js`
  (`searchIssues`). New pytest coverage for the endpoint + a wiring drift-guard
  and a headless browser QA script (`scripts/qa/verify_global_search.js`).
  No schema change.
- **AI Cycle Summary (summarize_cycle)**: the Cycles & Sprints view gains an
  "AI Sprint Summary" panel. A Generate button POSTs the current cycle's issue
  list (identifier/title/status/priority/estimate) to the existing
  `/api/projectbase/ai-assist` `summarize_cycle` action, which returns a
  concise executive summary (achievements, WIP/blockers, velocity analysis &
  recommendations). The summary renders as sanitized Markdown (marked + DOMPurify)
  inline in the cycle deep-dive, with a loading spinner and error state. This
  closes the last gap in the AI copilot surface: the backend action and its
  OpenAPI entry already existed, but had no frontend UI. Wired purely in
  `app/pb_public/js/components/CyclesView.js`; Tailwind rebuilt for the new
  classes. No schema or API change.
  - **Rule-based fallback for `summarize_cycle`**: when the LLM gateway is
    offline or unauthenticated (401), the endpoint now returns a deterministic
    sprint summary computed from the issues payload (achievements, in-progress /
    blockers, backlog, points done/total, and a pacing recommendation) instead
    of an empty `result`. The Cycles view surfaces an actionable error if the
    response is still empty, and a new pytest (`test_ai_assist_summarize_cycle_fallback`)
    locks the behavior. (`app/pb_hooks/70_ai_assist.pb.js`)

- **First-run onboarding guide (welcome modal + empty-state)**: a fresh member
  now gets a 60-second path to value after sign-up. A welcome modal
  (`app/pb_public/js/components/WelcomeModal.js`) walks through the three real
  actions — create a project, add an issue, drag it on the Kanban — and each row
  performs the actual UI action (opens the project / new-issue modal or the
  board) instead of just telling the user about it. It is triggered once per
  browser after sign-up (`pb_welcome_seen` localStorage guard, reset on sign-out
  so a later account sees it again) and re-openable any time from the command
  palette ("Show Welcome Guide"). The Projects view also gains a first-run
  empty state (icon + three-step onboarding cards + CTA) when the workspace has
  no projects yet. Wired into `app.js` (state + shortcut guard + Esc + sign-out
  reset), `index.html` (script + modal render), the command palette, and the
  service-worker precache; Tailwind rebuilt for the new arbitrary classes
  (`z-[60]`, `bg-[#0d1220]`).

- **Self-hosting deployment-consistency guard (harden)**: new
  `tests/test_deploy_consistency.py` statically locks the four deploy surfaces
  — `Dockerfile`, `docker-compose.yml`, `deploy/projectbase.service` (systemd
  template), `scripts/start.sh`, `Makefile`, and `deploy/Caddyfile` — to the
  SAME public dir, hooks dir, migrations dir, data dir, and listen port. This
  is the guard for the documented `pb_data` vs `app/pb_data` data-dir trap in
  AGENTS.md (local run serves `--dir pb_data` from the repo root while the
  containerized stack serves `--dir /app/app/pb_data`); if an edit drifts one
  surface to a different data dir or port, CI fails instead of shipping a
  demo that boots into a stale/empty database or points the Caddy reverse
  proxy at the wrong port. Also documented and verified the full Docker
  fresh-boot path (build, compose up, superuser seed, health) manually this
  cycle.
- **Secret/hardcoded-credential regression guard (harden)**: new
  `tests/test_secret_scan.py` scans every tracked source file for live-looking
  API keys, auth tokens, private keys, and long base64 secret assignments
  (excluding vendored bundles, binary assets, and archived research dumps),
  and asserts the QA scripts read `IBROWSE_API_KEY` from the environment. This
  is the guard that would have caught the cycle-12 P1 credential leak before
  merge. The GitHub repo is also restored to PRIVATE (publishing is a human
  decision).
- **Portfolio Dashboard realtime refresh (v1.1 feature 5 follow-up)**: the
  Portfolio Dashboard now stays live. Previously it fetched its workspace
  snapshot only on mount, so creating/updating/deleting an issue, milestone,
  project, or cycle elsewhere in the app left the dashboard stale until a
  reload. The shell now bumps a `realtimeTick` counter on every SSE event for
  those workspace-scoped collections and passes it down as a prop; the view
  watches it and debounces a single refetch (400 ms) so a burst of events
  triggers exactly one refresh. Because SSE delivery can be missed (PB-56),
  the tick is also bumped on the optimistic create/update/delete/bulk paths
  the shell performs in place (which would otherwise not change the prop
  reference), and the view watches the `issues`/`milestones` props as a
  belt-and-suspenders path — so the portfolio stays live in both the
  SSE-delivered and SSE-missed cases. Verified by an extended pytest
  drift-guard test and a render-QA E2E that creates an issue via the actual
  NewIssueModal and asserts the portfolio "Total Issues" KPI increments with
  no navigation or reload.
- **Portfolio Dashboard (v1.1 feature 5)**: a cross-project workspace overview
  at `#/pb/portfolio` aggregating every project, issue and milestone. KPI cards
  (total issues, completion %, in-flight/open work, estimate load), a
  per-project progress list with color completion bars (clicking a row opens
  that project's board), and a milestones & roadmap-health panel that surfaces
  upcoming/overdue targets. It fetches its own workspace snapshot
  (`getIssues(null)` + `getMilestones(null)`) so it stays accurate regardless
  of the project the shell currently scopes to. Wired via a header nav button,
  command palette action, keyboard shortcut `9`, and the `#/pb/portfolio` hash
  route (both viewMaps); the Service Worker precache was bumped to shell-v3 to
  cover the new asset. Verified by a new pytest wiring/drift-guard test and a
  render-QA E2E (view mounts, project rows render, shortcut works). Achieved
  milestones are treated as complete (100%, never overdue), matching the
  MilestonesView convention. Also fixes a pre-existing deep-link gap: a shared
  hash opened before login (e.g. `#/pb/portfolio`) now lands on that view after
  sign-in instead of falling back to the board (`applyRoute()` re-applied after
  auth in signIn/signUp).
- **Timeline / Gantt view (v1.1 feature 4)**: a scrollable day-grid schedule
  of cycles (start→end bars), milestones (target-date markers) and issues
  (start→due bars, status-colored). New additive `issues.start_date` field
  (migration 1710000018) so issues get a real start date; the create modal,
  issue drawer, and bulk-update route all accept `start_date` (whitelisted +
  validated). The view is registered in the header nav, command palette
  (Timeline), keyboard shortcut `4` (views re-slotted: board 1, list 2, cycles
  3, timeline 4, projects 5, stats 6, docs 7, marketplace 8), and hash route
  `#/pb/timeline`. Clicking an issue bar opens its drawer. OpenAPI + llms.txt
  agent-surface docs updated with `start_date`. Verified by 3 new pytest cases
  (roundtrip, bulk update + validation, frontend wiring) and a new render-QA
  E2E (view mounts, dated issue bar renders, bar click opens drawer, keyboard
  shortcut works).
- **Bulk custom-field editing (v1.1 feature 3)**: the bulk multi-select bar now
  renders a per-project Custom-field picker when the active project defines
  custom fields (text / number / select / checkbox / date). Choosing a field
  reveals the matching value control, and "Apply" sends a partial
  `custom_fields` payload to the existing `/api/projectbase/issues/bulk-update`
  route. Fixes a latent backend bug where custom-field bulk updates were either
  silent no-ops (phantom `custom_*` column keys) or wholesale-replaced the
  entire `custom_fields` object, dropping unrelated values. Bulk updates now
  **merge** into each record's `custom_fields` JSON (a `null`/`''` value clears
  that single key), and the optimistic local apply mirrors that merge — a
  `null`/`''`/empty value removes the key locally too, so the acting user's UI
  never shows a stale empty value before realtime confirms it. Verified by two
  new pytest cases (partial merge + validation) and a new render-QA E2E that
  creates a temp issue with custom values, applies a number field through the
  bulk-bar picker, and proves unrelated custom fields survive.
- **Shift+click range selection (v1.1 feature 2)**: after anchoring with a
  selection toggle, Shift+clicking a later card/row selects every issue in
  between (Linear-style). Works on the board (column-by-column visible order)
  and the list view (current sort order), in both directions, as a union with
  the current selection. The selection anchor (`lastSelectedIssueId`) is
  tracked in the root app, resets with Esc / project switch, and is pruned if
  the anchor record is deleted via realtime. No new API surface; verified by a
  new 15-assertion render-QA range suite: board anchor, forward range, checked
  count, no drawer on shift+click, Esc clear, cross-column span, list
  forward/reverse, plus a full E2E that creates 3 temp issues, range-selects
  them, applies status `todo` through the bulk bar, verifies all 3 moved via
  API, and proves the temp issues are deleted (DELETE 204s).
- **Batch multi-select + bulk actions (v1.1 feature 1)**: board cards and list
  rows now expose a selection checkbox (plus Cmd/Ctrl+click to toggle without
  opening the drawer). A floating action bar applies status / priority / cycle
  changes or deletes to every selected issue in one request. Backend:
  `app/pb_hooks/31_bulk_actions.pb.js` adds
  `POST /api/projectbase/issues/bulk-update` and
  `POST /api/projectbase/issues/bulk-delete` (up to 500 ids per call,
  per-record hooks + realtime SSE preserved; delete gated to admin/manager,
  mirroring the issues deleteRule). Frontend: selection state lifted into the
  root app (`selectedIssueIds`), board + list wiring, Esc to clear, list
  select-all. Docs: OpenAPI + llms.txt/llms-full.txt agent surface updated.
  19 new regression tests (`tests/test_bulk_actions.py`).

- **Agent-surface OpenAPI coverage**: `openapi.json` now documents every
  implemented `/api/projectbase/*` custom route so autonomous agents discover
  the full surface. Newly added: `/projectbase/version`, `/projectbase/import/csv`,
  `/projectbase/import/github`, `/projectbase/notifications/read-all`,
  `/projectbase/ai-assist`, and `/projectbase/dispatch-agent`, plus tags for
  Importers, Notifications, AI Assist, and Agent Dispatch. `test_openapi_spec_valid`
  now asserts all 12 custom routes are present to prevent future drift.
- **Global cross-project sort index**: migration `1710000017` adds
  `idx_issues_created` on `issues (created DESC)`, giving the worst-case
  cross-project `sort=-created` query a covering index. Measured p50 for that
  query at 10k issues dropped from **62.5 ms → 45.1 ms** (p95 64.9 → 47.6 ms
  on this host; the p95 spread is noise on a shared box). Every project-scoped
  UI view was already single-digit ms and is unchanged.

### Fixed
- **Docs bookkeeping (cycle-12, from inspect audit)**: corrected the stale
  test-count in the cycle-10 ROADMAP section (145/145 → 146/146, matching the
  actual committed suite) and referenced PB-62 in the cycle-11 ROADMAP section
  so the tracked backlog and the shipped-prose stay consistent.
- **Realtime cycles & comments sync**: the realtime handler in `app.js`
  subscribed to `cycles` and `comments` events (via `api.js`) but never handled
  them, so cycle changes and new comments from other users did not update the
  UI in real-time. The handler now updates the local `cycles` list on
  create/update/delete and bumps a `commentRefreshKey` that the open
  `IssueDrawer` watches to reload its comment thread live.
- **Create-issue list sync (PB-56)**: creating an issue in the UI now adds it
  to the board/list immediately instead of depending on the SSE realtime event,
  which could be missed when the stream was not yet connected (the new item
  previously only appeared after a manual refresh). `handleCreateIssue` in
  `app.js` now unshifts the created record into the local list with the same
  duplicate guard as the realtime handler.
- Version consistency: the UI header badge (`Header.js`) now shows `v0.9.0`
  instead of the stale `v0.8.0`, and `scripts/bump_version.sh` now keeps the
  header badge and the custom-routes health/version endpoints in sync on every
  bump (previously only `VERSION` and `openapi.json` were updated).
- **External notification dispatcher never delivered** (`60_notifications.pb.js`):
  the dispatcher called module-scope helper functions
  (`sendDiscordNotification` / `sendTelegramNotification`) from inside
  `onRecordAfter*Success` hooks. PocketBase's Goja runtime cannot resolve
  module-scope function declarations inside hook callbacks, so every dispatch
  threw `ReferenceError: <fn> is not defined` and no Discord/Telegram/webhook
  notification was ever sent. All dispatch logic is now inlined directly in the
  callbacks (the same bug class as the cycle-5 P0 fix in `15_signup_security.pb.js`).
  Verified via live smoke probes: creating an issue and changing its status no
  longer produce the ReferenceError. The drift-guard test
  (`test_notification_settings_wired_in_frontend`) now pins that the dispatcher
  must not call module-scope helper identifiers.

## [0.9.0] - 2026-08-24

### Added
- **Published benchmarks** (v1.0 build order item 3/4): reproducible stdlib
  harness `scripts/bench/bench.py` (isolated scratch instance, never the live
  one) + published results in `docs/BENCHMARKS.md` with raw JSON in
  `docs/research/bench/`. Headline: 50 MB idle / 98 MB at 10k issues,
  36–96 ms cold start, 2.0 ms p50 board query at 10k issues; Plane CE cited at
  4 GB min RAM / 13 containers (vendor docs).
- **Distraction-free description focus mode** (v1.0 build order item 2/4): a
  "Focus" button in the drawer's Description header opens a fullscreen overlay
  (z-60) with a centered max-w-3xl editor, Rich/Raw/Preview tabs, AI Enhance
  PRD, and a Done button; Esc saves & exits.
- **URL deep-link state** (v1.0 build order item 1/4): filters (`?q=`,
  `?priority=`, `?cycle=`), Cycles view tab (`?cycle=`), and drawer width
  (`?w=`) as shareable hash state that round-trips through the router.

### Fixed
- **P0 — long-form text limits**: raised `description` and related long-form
  text limits to 100000 so focus mode / long PRDs no longer truncate.
- **P0 — AI Enhance PRD**: the auth token is now sent to the `ai-assist`
  endpoint so AI Enhance works from the focus mode.
- **P0 — focus mode editor**: auto-focus the Milkdown editor when focus mode
  opens; guard the `getMarkdown` call in the `modelValue` watcher; Esc in focus
  mode exits focus instead of the whole drawer.

## [0.8.0] - 2026-08-23

### Added
- **Offline-first app shell**: Service Worker (`sw.js`) pre-caches the complete
  static app shell; static assets served cache-first with background refresh,
  `/api/*` + navigations network-first with a cached-shell fallback. PWA web
  manifest + app icons for installability.
- **Self-hosting lifecycle**: hardened systemd unit (`deploy/projectbase.service`),
  idempotent installer (`scripts/install-systemd.sh`), live backup
  (`scripts/backup.sh`) and restore (`scripts/restore.sh`, online + offline
  modes).
- **One-command public demo deployment**: `scripts/deploy-demo.sh` (docker
  compose build+up, superuser seed, health + fresh-boot-seed verification,
  optional `--install-docker` and `--domain` for Caddy automatic-HTTPS) and
  `scripts/reset-demo.sh` (restores the pristine demo workspace).
- **In-app notifications**: `notifications` collection + header bell + inbox so
  users see "someone assigned you / mentioned you / commented on your issue"
  without leaving the app. External-channel notifications (Discord/Telegram/
  webhook) shipped earlier.
- **Milestone assignment on issues**: `NewIssueModal` + `IssueDrawer` milestone
  selectors; Roadmap view moved from `partial` to `shipped` in the feature
  matrix.
- **Blocked indicator in List view**: lock badge + red left-border row
  highlight for issues with a `blocked_by` edge, matching the kanban cards.

### Fixed
- **P1 — privilege guard was silently dead**: a module-scope helper
  (`_isPrivileged`) was not resolvable inside Goja hook callbacks, so every
  invocation threw `ReferenceError` and the catch forced `member`
  unconditionally. Inlined the logic and replaced the `!req.admin` superuser
  test with a correct `auth.collection().name === "_superusers"` check.
- **P0 — member self-service role escalation**: `users.updateRule` allowed a
  member to PATCH their own `role` to `admin`. The update guard now freezes the
  role to its current stored value on any self-service update.
- **P0 — fresh-boot seed bug**: moved the demo seed from an `onBootstrap` hook
  to a migration so a stranger's very first boot seeds correctly (no
  `sql: no rows in result set`).

## [0.7.0] - 2026-08-22

### Added
- **Secure public self-signup**: `users.createRule = ""` (public
  self-registration) with a privilege-escalation guard that forces every new
  user record to `role = 'member'` and freezes the role on self-service
  updates. Login gate now has a "Create a free account" toggle.
- **Custom fields**: per-project custom field definitions with validation and
  agent-surface docs (OpenAPI / llms / FastMCP).
- **Importers**: Linear (CSV/JSON), GitHub issues, and Plane export importers
  as pb_hooks routes + UI drawer. GitHub importer is idempotent (keyed by
  `source_key = "gh:{number}"`) and rate-limit-resilient.
- **Keyboard command palette** scaffold.
- **Resizable issue drawer**: drag handle + clamped width (420-1600px),
  localStorage persistence, double-click reset.
- **Clickable project cards**: whole card is `role="button"`, click + Enter
  opens board, star/delete stop propagation.
- **Multiselect component**: labels, assignees, custom select fields.
- **AI Copilot**: native AI-assisted PRD enhancement, subtask generation, and
  sprint summaries.
- **Multi-channel notifications**: Discord, Telegram, and webhook dispatchers.
- **Autonomous agent dispatch**: FastMCP server + custom API for agent
  workflows.

### Fixed
- **P0 — cross-tenant isolation**: locked down `users` list/view/update/delete
  rules so a member cannot list, view, or update other users.
- **P0 — privilege minting**: no actor can mint a privileged account through
  the public create endpoint (every create is coerced to `member`).

## [0.6.0] - 2026-08-22

### Added
- **Multi-user auth gate** with safe bootstrap credentials and agent dispatch
  UI.
- **Milestones & North Star roadmap** UI.
- **OpenAPI 3.1 + Scalar API UI** + `llms.txt` discovery + in-app Docs view.
- **FileField attachments** and built-in cron engine hook.
- **Standalone flow CLI** tool.

## [0.5.0] - 2026-08-22

### Added
- **Initial open-source release**: zero-build Vue 3 + Tailwind frontend,
  PocketBase backend, real-time SSE, FastMCP server, Dockerfile +
  docker-compose + Makefile, MIT license, polished README.

---

## Versioning

- `VERSION` file at repo root is the single source of truth.
- `scripts/bump_version.sh` increments semver (`patch`/`minor`/`major` or an
  explicit version) and keeps `VERSION`, `openapi.json`, the UI header badge,
  and the custom-routes health/version endpoints in sync.
- `app/pb_hooks/30_custom_routes.pb.js` exposes `/api/projectbase/version`.

[Unreleased]: https://github.com/AndrianBalanescu/ProjectBase/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v1.0.0
[0.9.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.9.0
[0.8.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.8.0
[0.7.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.7.0
[0.6.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.6.0
[0.5.0]: https://github.com/AndrianBalanescu/ProjectBase/releases/tag/v0.5.0
