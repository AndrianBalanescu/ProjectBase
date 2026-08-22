# Scout manifest — cycle 1

| Scout | Output |
|---|---|
| multi-source-research | archive/raw/raw-multi-source-research-cycle-1.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-1.md |
| github trending (daily) | archive/raw/raw-github-trending-cycle-1.md |
| proven sources (HN + PH) | archive/raw/raw-proven-sources-cycle-1.md |
| ask-llm sonar | archive/raw/raw-ask-llm-sonar-cycle-1.md |
| ask-llm research | archive/raw/raw-ask-llm-research-cycle-1.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-1.md |
| sonar dual | archive/sonar/sonar-track-*-cycle-1.md |

Queries:
- social: What do self-hosters and small teams complain about with Linear, Plane, Taiga, Focalboard, and Height on Reddit, HN, G2 in the last 12 months? Seat pricing anger, migration pain, missing offline/self-host, slow Electron apps, missing features
- competitive: Full feature and pricing teardown of Linear vs Plane CE vs Height vs Taiga vs Focalboard 2025-2026: pricing per seat, kanban, sprints/cycles, roadmaps, custom fields, API limits, AI features, self-host licensing
- docs: Open-source Linear alternative architecture: PocketBase + SQLite + zero-build Vue 3 kanban with real-time SSE, SortableJS drag-drop persistence patterns, and REST API schema design for issues, projects, sprints, labels, subtasks

Notes:
- ask-llm timeouts: sonar-fast≈90s, sonar≈180s, research≈300s (was 30s — that killed deep scouts under parallel load)
- ask-llm skipped when sonar-fast OK (same Perplexity/OmniRoute path)
- GitHub trending refreshes once per UTC day (FLOW_GH_TRENDING_FORCE=1 to force)
- Proven sources (HN Show + Product Hunt feed) are mandatory input for the slate
