# ProjectBase Agent Rules

- **Mission:** MIT, 100% free/self-hostable ProjectBase. Never add monetization.
- **Layout:** `app/pb_public` (zero-build Vue), `app/pb_hooks`, `app/pb_migrations`, `app/pb_data` (runtime, never commit), `docs`, `scripts`, `tests`, `deploy`.
- **Before editing:** inspect `git status`; read relevant README/docs; preserve unrelated work.
- **Frontend:** keep zero-build PocketBase serving; vendor browser-ready FOSS bundles under `app/pb_public/vendor/`; preserve Markdown descriptions.
- **Backend:** enforce validation/authorization in PocketBase hooks and migrations. Never commit secrets or local data.
- **Validate:** run `pytest -v tests/`, run iBrowse QA for UI/frontend changes (`bash /home/ubuntu/flow/scripts/qa/flow-ibrowse.sh http://127.0.0.1:8120/`), verify zero console errors, check health at `http://127.0.0.1:8120`, then inspect diff/status/root layout.
- **Docs:** research and plans go in `docs/`; no loose root artifacts.
- **Kanban & MCP:** use ProjectBase MCP (`mcp__projectbase__*`) or API (`:8120`) to pick active issues, move to `in_progress`, and mark `done` with audit comments.
- **Commit:** ONE commit per work session, consolidating code + tests + docs + .gitignore together. Never open a new commit for a follow-up tweak, wording fix, or doc note — fold it into the in-progress commit. If you notice you already made several small commits, `git reset --soft` back to the last clean commit and re-commit as one. Do not push unless explicitly asked.
- **No doc-only churn:** NEVER create a commit containing only docs, roadmap/TODO/feature-matrix markers, or .gitignore edits. Docs describing delivered work must be committed together with that work, in the same commit. A commit that adds no code and no test is a mistake — fold it in or drop it.
- **Done:** report implementation, tests, security impact, documentation, and known limitations honestly.
