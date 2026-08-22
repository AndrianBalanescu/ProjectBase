# Scout manifest — cycle 3

| Scout | Output |
|---|---|
| multi-source-research | archive/raw/raw-multi-source-research-cycle-3.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-3.md |
| github trending (daily) | archive/raw/raw-github-trending-cycle-3.md |
| proven sources (HN + PH) | archive/raw/raw-proven-sources-cycle-3.md |
| ask-llm sonar | archive/raw/raw-ask-llm-sonar-cycle-3.md |
| ask-llm research | archive/raw/raw-ask-llm-research-cycle-3.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-3.md |
| sonar dual | archive/sonar/sonar-track-*-cycle-3.md |

Queries:
- social: GitHub REST API import issues automation python pocketbase 2026 latest best practices pagination
- competitive: GitHub API rate limiting webhooks fine-grained tokens best practices 2026
- docs: PocketBase Goja pb_hooks outgoing HTTP fetch request external API javascript

Notes:
- ask-llm timeouts: sonar-fast≈90s, sonar≈180s, research≈300s (was 30s — that killed deep scouts under parallel load)
- ask-llm skipped when sonar-fast OK (same Perplexity/OmniRoute path)
- GitHub trending refreshes once per UTC day (FLOW_GH_TRENDING_FORCE=1 to force)
- Proven sources (HN Show + Product Hunt feed) are mandatory input for the slate
