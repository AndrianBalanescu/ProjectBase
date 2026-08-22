# Scout manifest — cycle 2

| Scout | Output |
|---|---|
| multi-source-research | archive/raw/raw-multi-source-research-cycle-2.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-2.md |
| github trending (daily) | archive/raw/raw-github-trending-cycle-2.md |
| proven sources (HN + PH) | archive/raw/raw-proven-sources-cycle-2.md |
| ask-llm sonar | archive/raw/raw-ask-llm-sonar-cycle-2.md |
| ask-llm research | archive/raw/raw-ask-llm-research-cycle-2.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-2.md |
| sonar dual | archive/sonar/sonar-track-*-cycle-2.md |

Queries:
- social: Linear Plane GitHub issue importer CSV JSON migration user workflows what format
- competitive: open source issue tracker importer competitor features Linear Plane Height import export
- docs: PocketBase custom route file upload parse CSV JSON pb_hooks reference architecture

Notes:
- ask-llm timeouts: sonar-fast≈90s, sonar≈180s, research≈300s (was 30s — that killed deep scouts under parallel load)
- ask-llm skipped when sonar-fast OK (same Perplexity/OmniRoute path)
- GitHub trending refreshes once per UTC day (FLOW_GH_TRENDING_FORCE=1 to force)
- Proven sources (HN Show + Product Hunt feed) are mandatory input for the slate
