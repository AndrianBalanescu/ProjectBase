# ProjectBase — Competitive Teardown (refreshed 2026-08-24, flow cycle 2)

> **Live-verified 2026-08-24** (linear.app/pricing + plane.so/pricing fetched directly, GitHub API):
> Linear Free = 250 issues / 2 teams / unlimited members incl. Agent platform + MCP;
> Basic **$10/user/mo**, Business **$16/user/mo** (yearly), Enterprise custom.
> Plane Free = 12 users + 500 AI credits; Pro **$6/seat/mo yearly** ($8 monthly),
> Business ~$13/seat/mo; self-hosted + air-gapped editions. GitHub stars (API):
> Plane **57.6k** (pushed 2026-08-23), Wekan 21.1k (active), Focalboard 26.4k
> (maintenance mode, last push 2026-05), Kanboard 9.8k (active), Taiga upstream
> dead since 2023-12. The OSS field is consolidating: Plane + lightweights survive;
> Focalboard/Taiga are effectively exits — the lightweight-self-host niche is open.

> Sources: Perplexity Sonar scouts 2026-08-22 (`docs/research/archive/raw/raw-sonar-competitors-cycle-1.md`, `raw-sonar-painpoints-cycle-1.md`), GitHub trending + proven-sources scouts. Grounded in cited threads; verify pricing before publishing marketing claims.

## Market leaders

| Tool | Pricing | Free tier | Self-host license | Critical weakness |
|---|---|---|---|---|
| **Linear** | Free tier; paid per seat (~$8–14 range commonly cited); teams report $750+/mo invoices at 20 seats | 250 issues, 2 teams, unlimited members | **None** (cloud only) | No self-host, tight free cap, rigid opinionated workflow, CSV-only export lock-in |
| **Plane CE** | CE free self-hosted; cloud/Pro ~$6/seat/mo | Cloud free: 12 users/workspace | AGPL-3.0 (Docker/K8s) | Ops burden (heavy stack, backups on you), advanced features paywalled, smaller ecosystem, ~2.7 GB RAM footprint |
| **Height** | Per-seat SaaS (mid-tier) | Limited free | None | Closed cloud, smaller integration ecosystem, workflow automation less flexible than Linear |
| **Taiga** | Free self-hosted; Taiga.io cloud paid plans | Full features self-hosted | AGPL-3.0 | Dated UX vs Linear, migration partial, weaker API/AI story |
| **Focalboard** | Free, open source (Mattermost) | Full | MIT (boards) | Maintenance concerns, no cycles/sprints parity, less polish, weak multi-project rollup |

## Recurring user pain (Reddit / HN / G2, last 12 months)

1. **Per-seat pricing anger** — Linear "fine solo, steep at 3–4 people, real budget item at 20" (r/Linear $750 invoice thread).
2. **No real self-host for Linear** — blocks privacy/regulated/infra-conscious teams entirely.
3. **Export/migration lock-in** — CSV exports lose relationships and workspace structure; Linear→Plane migrations leave workflows and cycles unmapped.
4. **Heavy self-hosted stacks** — Plane CE's Docker matrix and RAM appetite turn "free" into an ops job.
5. **Missing offline/local-first** — flaky-network and mobile users suffer; nobody in the leader set is local-first.

## Where ProjectBase wins (positioning)

- **Single binary + ~16 MB RAM** vs Plane CE ~2.7 GB — self-hosting stops being an ops project.
- **MIT license** (vs AGPL Plane/Taiga) — embeddable in commercial products without license anxiety.
- **Zero-build frontend** (vendored Vue 3 + Tailwind, offline-capable) — no CDN dependency, no npm pipeline.
- **Native agent surface**: OpenAPI 3.1 + Scalar UI, `llms.txt`, FastMCP server — AI agents get first-class API access none of the five offer out of the box.
- **No per-seat ceiling by design** (self-hosted MIT) — attacks pain #1 and #2 directly.

## Where ProjectBase must not fall behind (table stakes)

- Linear-grade keyboard UX and latency feel.
- Cycles/sprints + roadmap views (have: cycles; roadmap partial).
- Importers (Linear/Plane/GitHub CSV/JSON) to attack migration pain #3 — currently missing.
- Real-time multi-user SSE (have) must stay correct under drag-drop races.

---

## Debate engine note (cycle 1)

Paid 4-model debate (`flow-debate-run.sh --paid`) is currently degraded:
3 of 4 default models — `antigravity/gemini-3.6-flash-high`,
`codex/gpt-5.6-sol-high`, `glm/glm-5.2` — fail with
`[ERROR: Hermes model call failed ... transient]` (exit 1, ~5s), so quorum is
never met and verdicts are INCONCLUSIVE/invalid. Only `deepseek/deepseek-v4-flash`
resolves on the Hermes→OmniRoute backend. The build-order recommendation in
ROADMAP.md is therefore TENTATIVE (grounded in the teardown, not a valid verdict).
Next action for the engine owner: fix Hermes routing for those 3 models or swap
the paid profile to reachable providers before treating any gate verdict as binding.
