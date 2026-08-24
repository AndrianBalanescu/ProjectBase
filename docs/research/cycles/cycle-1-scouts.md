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
- social: Reddit HN X discussions last 30 days: frustrations with Linear and Plane.app pricing lock-in, self-hosted Jira alternatives, what users wish existed in lightweight issue trackers
- competitive: Linear vs Plane vs Height vs Focalboard vs Taiga vs Ledgity 2026 pricing tiers feature limits comparison PM tool market
- docs: PocketBase SSE realtime performance patterns zero-build Vue 3 kanban drag-drop Sortable.js architecture best practices

Notes:
- ask-llm timeouts: sonar-fast≈90s, sonar≈180s, research≈300s (was 30s — that killed deep scouts under parallel load)
- ask-llm skipped when sonar-fast OK (same Perplexity/OmniRoute path)
- GitHub trending refreshes once per UTC day (FLOW_GH_TRENDING_FORCE=1 to force)
- Proven sources (HN Show + Product Hunt feed) are mandatory input for the slate
