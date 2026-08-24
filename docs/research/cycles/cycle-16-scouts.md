# Scout manifest — cycle 16

| Scout | Output |
|---|---|
| multi-source-research | archive/raw/raw-multi-source-research-cycle-16.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-16.md |
| github trending (daily) | archive/raw/raw-github-trending-cycle-16.md |
| proven sources (HN + PH) | archive/raw/raw-proven-sources-cycle-16.md |
| ask-llm sonar | archive/raw/raw-ask-llm-sonar-cycle-16.md |
| ask-llm research | archive/raw/raw-ask-llm-research-cycle-16.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-16.md |
| sonar dual | archive/sonar/sonar-track-*-cycle-16.md |

Queries:
- social: Linear Plane batch multi-select bulk edit issues project management 2026 user complaints reddit
- competitive: Linear bulk actions batch edit priority assignee status power users g2
- docs: PocketBase bulk update transaction custom route API best practice example

Notes:
- ask-llm timeouts: sonar-fast≈90s, sonar≈180s, research≈300s (was 30s — that killed deep scouts under parallel load)
- ask-llm skipped when sonar-fast OK (same Perplexity/OmniRoute path)
- GitHub trending refreshes once per UTC day (FLOW_GH_TRENDING_FORCE=1 to force)
- Proven sources (HN Show + Product Hunt feed) are mandatory input for the slate
