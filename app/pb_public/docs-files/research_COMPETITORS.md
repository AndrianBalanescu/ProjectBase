# Competitive Teardown — Workspace Synthesis

## Linear

- **Strengths:** polished issue/project/cycle workflow, explicit project dependencies, timeline visibility, and strong search/discovery.
- **Pricing signal:** a free tier with limits, paid per-user tiers, and enterprise controls. ProjectBase remains MIT/FOSS and does not copy paid-tier monetization.
- **Critical weakness for this charter:** closed cloud-first product and AI features concentrated in higher tiers. Self-hosted teams need an inspectable local source of truth.

## Plane

- **Strengths:** open-source/self-hostable project management, project blockers, modules, cycles, and extensibility.
- **Pricing signal:** cloud and enterprise offerings surround the open-source core. ProjectBase keeps its core fully free and MIT-licensed.
- **Critical weakness for this charter:** heavier deployment/runtime footprint and more operational complexity than a single PocketBase binary.

## GitHub Projects / Jira-style alternatives

- **Strengths:** broad integrations and mature workflows.
- **Critical weaknesses:** fragmented project knowledge, heavyweight setup, or dependence on external services. Cross-project dependency context and agent telemetry are commonly difficult to search together.

## ProjectBase opportunity

ProjectBase can win a narrow workflow: a lightweight, self-hosted workspace where human issues, comments, agent traces, validation checkpoints, and dependency blockers are queryable in one local SQLite index. FTS5 must be a real implementation rather than a claim. Source collections remain authoritative, while an incremental/rebuildable index provides fast retrieval and transparent repair behavior.

## Sources

- https://linear.app/docs/project-dependencies
- https://linear.app/pricing
- https://plane.so/open-source
- https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them
- https://pocketbase.io/docs/js-overview/
- https://github.com/pocketbase/pocketbase
