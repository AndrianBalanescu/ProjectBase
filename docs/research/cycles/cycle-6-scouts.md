# Scout manifest — cycle 6

| Scout | Output |
|---|---|
| multi-source-research | archive/raw/raw-multi-source-research-cycle-6.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-6.md |
| github trending (daily) | archive/raw/raw-github-trending-cycle-6.md |
| proven sources (HN + PH) | archive/raw/raw-proven-sources-cycle-6.md |
| ask-llm sonar | archive/raw/raw-ask-llm-sonar-cycle-6.md |
| ask-llm research | archive/raw/raw-ask-llm-research-cycle-6.md |
| ask-llm sonar-fast | archive/raw/raw-ask-llm-sonar-fast-cycle-6.md |
| sonar dual | archive/sonar/sonar-track-*-cycle-6.md |

Queries:
- social: PocketBase self-host demo deployment 2026 best practices reverse proxy TLS docker compose single VPS small RAM
- competitive: Linear Plane demo sandbox public trial deployment strategy self-hosted project management 2026
- docs: PocketBase docker healthcheck migrations superuser env PB_SUPERUSER_EMAIL production compose example

Notes:
- ask-llm timeouts: sonar-fast≈90s, sonar≈180s, research≈300s (was 30s — that killed deep scouts under parallel load)
- ask-llm skipped when sonar-fast OK (same Perplexity/OmniRoute path)
- GitHub trending refreshes once per UTC day (FLOW_GH_TRENDING_FORCE=1 to force)
- Proven sources (HN Show + Product Hunt feed) are mandatory input for the slate
