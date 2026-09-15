# Feature Matrix — Epic 11 Workspace Synthesis

| Capability | Table stakes / Must-Have | Differentiator / Moat | ProjectBase acceptance |
|---|---:|---:|---|
| Issue, comment, agent trace search | Yes |  | One authenticated search endpoint and MCP tool return typed, ranked results |
| Real SQLite FTS5 index | Yes | Yes for this charter | Migration creates an FTS5 virtual table and metadata table; source data remains authoritative |
| Incremental index maintenance |  | Yes | Record hooks update/delete indexed rows; rebuild route repairs missed historical data |
| FTS query safety | Yes |  | Tokenized/quoted query handling prevents syntax errors and injection; max length enforced |
| Project-scoped retrieval | Yes |  | Search and rebuild honor project scope; results do not leak unrelated project context |
| Cross-project blocker graph | Yes | Yes | Dependency edges produce direct blockers, blocked work, impact/critical-path ordering, and cross-project counts |
| Circular dependency warning |  | Yes | DFS detects imported/direct cyclic graphs without crashing |
| Sprint retrospective | Yes | Yes | Cycle/project filters compute velocity, status/priority, quality gates, agent productivity, and recommendations |
| Agent/MCP access |  | Yes | FastMCP `tools/list` and `tools/call` expose all Epic 11 capabilities |
| Self-hosting and FOSS | Yes |  | No paid tier, external vector service, or build-time dependency |
| Operational repairability |  | Yes | Index status/rebuild endpoint reports counts and repairs stale/missing records |

## Explicit non-goals

- No embeddings, vector database, or hosted search dependency.
- No monetization or closed cloud-only features.
- No frontend load-only claim. Any UI surface must be tested through real user flows with iBrowse.
