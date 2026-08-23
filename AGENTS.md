# ProjectBase Agent Rules

- **Mission:** MIT, 100% free/self-hostable ProjectBase. Never add monetization.
- **Layout:** `app/pb_public` (zero-build Vue), `app/pb_hooks`, `app/pb_migrations`, `app/pb_data` (runtime, never commit), `docs`, `scripts`, `tests`, `deploy`.
- **Before editing:** inspect `git status`; read relevant README/docs; preserve unrelated work.
- **Frontend:** keep zero-build PocketBase serving; vendor browser-ready FOSS bundles under `app/pb_public/vendor/`; preserve Markdown descriptions.
- **Backend:** enforce validation/authorization in PocketBase hooks and migrations. Never commit secrets or local data.
- **Validate:** run `pytest -v tests/`, run iBrowse QA for UI/frontend changes (`bash /home/ubuntu/flow/scripts/qa/flow-ibrowse.sh http://127.0.0.1:8120/`), verify zero console errors, check health at `http://127.0.0.1:8120`, then inspect diff/status/root layout.
- **Docs:** research and plans go in `docs/`; no loose root artifacts.
- **Commit:** small coherent commits; do not push unless explicitly requested. Stop before destructive data changes, credentials, external publishing, or ambiguous product decisions.
- **Done:** report implementation, tests, security impact, documentation, and known limitations honestly.
