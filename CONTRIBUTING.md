# Contributing to ProjectBase

Thanks for helping keep ProjectBase small, dependable, and pleasant to use.

## What we welcome

- Bug fixes with a reproducible test
- Accessibility, responsive-layout, and interaction polish
- Performance and data-integrity improvements
- Improvements to the existing Board, List, Cycles, Roadmap, Projects, issue
  drawer, import/export, and Sessions workflows
- Documentation, translations, and self-hosting fixes

ProjectBase favors simplification over surface-area growth. Before proposing a
new capability, explain why the existing workflows cannot solve the problem and
what can be removed or reused to keep the product lean.

## Development setup

```bash
git clone https://github.com/AndrianBalanescu/ProjectBase.git
cd ProjectBase
./scripts/bootstrap.sh
```

Open `http://localhost:8120`. The Vue frontend is served directly, so JavaScript
changes require only a refresh. PocketBase hooks reload during development.

If you change Tailwind classes or templates, regenerate static CSS:

```bash
bash scripts/build_css.sh
```

Do not add a runtime Tailwind CDN, package manager, or frontend build system.

## Required checks

```bash
uv run --with pytest pytest tests/
bash scripts/build_css.sh
git diff --check
docker compose config
```

UI changes must also pass the project browser QA at desktop, tablet, and mobile
sizes with no console exceptions or horizontal overflow.

## Pull requests

1. Keep one pull request focused on one functional change.
2. Include the reason for the change, not just an implementation summary.
3. Add or update tests for changed public behavior.
4. Include screenshots for visible UI changes.
5. Report commands run and their exact results.
6. Update OpenAPI and agent-facing docs when an API contract changes.

Do not commit `pb_data/`, database files, backups, credentials, generated local
screenshots, or a downloaded PocketBase binary.

## Product boundary

ProjectBase is an issue tracker for small technical teams and local coding-agent
sessions. It is not a billing system, marketplace, AI copilot, agent
orchestrator, incident war room, analytics warehouse, or enterprise control
plane. See [the roadmap](docs/ROADMAP.md) and [governance](GOVERNANCE.md).

By contributing, you agree that your contribution is licensed under the
project's [MIT License](LICENSE).
