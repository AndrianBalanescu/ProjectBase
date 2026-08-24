# Scout manifest — cycle 20

| Scout | Output |
|---|---|
| multi-source-research | archive/raw/raw-multi-source-research-cycle-20.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-20.md |
| github trending (daily) | archive/raw/raw-github-trending-cycle-20.md |
| proven sources (HN + PH) | archive/raw/raw-proven-sources-cycle-20.md |
| ask-llm sonar | archive/raw/raw-ask-llm-sonar-cycle-20.md |
| ask-llm research | archive/raw/raw-ask-llm-research-cycle-20.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-20.md |
| sonar dual | archive/sonar/sonar-track-*-cycle-20.md |

Queries:
- social: portfolio roadmap progress tracking cross-project analytics product managers reddit 2026
- competitive: Linear Plane portfolio view project progress velocity analytics feature
- docs: Vue 3 zero-build cross-project dashboard progress velocity implementation pattern

Notes:
- ask-llm timeouts: sonar-fast≈90s, sonar≈180s, research≈300s (was 30s — that killed deep scouts under parallel load)
- ask-llm skipped when sonar-fast OK (same Perplexity/OmniRoute path)
- GitHub trending refreshes once per UTC day (FLOW_GH_TRENDING_FORCE=1 to force)
- Proven sources (HN Show + Product Hunt feed) are mandatory input for the slate
