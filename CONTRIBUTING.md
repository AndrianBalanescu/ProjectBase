# Contributing to ProjectBase

Thanks for helping make ProjectBase the leanest agent-first project management platform!

## What We Welcome

- New Vue 3 components and UI improvements
- PocketBase JS hooks and native integrations
- Community plugins for the Marketplace
- FastMCP tools and agent workflows
- Documentation, examples, and translations
- Bug reports and reproducible QA tests

## Development Setup

```bash
git clone https://github.com/AndrianBalanescu/ProjectBase.git
cd ProjectBase
./scripts/bootstrap.sh
```

Then open `http://localhost:8120`. The frontend is zero-build, so edit `pb_public/` files and refresh the browser. PocketBase JS hooks in `pb_hooks/` reload automatically in development.

## Plugin Development

A plugin is intentionally simple. It can contain:

```text
my-plugin/
├── plugin.json             # manifest
├── pb_hooks/               # optional PocketBase JS hooks
│   └── my-plugin.pb.js
├── pb_public/js/           # optional Vue components
│   └── my-plugin.js
├── README.md
└── LICENSE
```

### Minimal `plugin.json`

```json
{
  "id": "community.example-plugin",
  "name": "Example Plugin",
  "version": "1.0.0",
  "description": "A useful ProjectBase extension.",
  "author": "Your Name",
  "license": "MIT",
  "projectbase": ">=0.1.0",
  "category": "integration",
  "entrypoints": {
    "hooks": ["pb_hooks/my-plugin.pb.js"],
    "frontend": ["pb_public/js/my-plugin.js"]
  },
  "permissions": ["issues:read", "issues:write"]
}
```

### Plugin Safety

- Never commit secrets, tokens, private URLs, or local database files.
- Declare required permissions in `plugin.json`.
- Keep outbound network calls explicit and documented.
- Validate all external input in hooks and UI code.
- Do not ship destructive database operations without confirmation.
- Include a local test or reproducible verification steps.

## Pull Request Checklist

- [ ] The change is focused and documented.
- [ ] No secrets or `pb_data` files are included.
- [ ] `./scripts/install.sh` and `./scripts/start.sh` still work.
- [ ] Health and API endpoints respond successfully.
- [ ] UI changes were tested in a real browser.
- [ ] New plugin behavior includes a clear README and license.
- [ ] Existing tests and GitHub Actions pass.

## Community Marketplace

To propose a plugin for the curated Marketplace:

1. Publish the plugin in a public GitHub repository.
2. Add a valid `plugin.json` manifest and README.
3. Open a pull request adding the plugin to the Marketplace catalog.
4. Explain permissions, outbound integrations, and testing evidence.

Marketplace inclusion is curated for safety and compatibility. Users can also install a plugin directly from a Git URL after reviewing its source.

## Code of Conduct

Be respectful, constructive, and transparent about security, permissions, and external services.
