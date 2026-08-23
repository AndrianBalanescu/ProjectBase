# Cycle 20 — Bidirectional Kanban sync for the autonomous Flow daemon

**Date:** 2026-08-23 · **Milestone:** agent / mcp / core · **Tests:** 87 passed (2 new)

## Why

The "autonomous Flow pipeline + FastMCP bidirectional Kanban sync" milestone
(PB-43) had been open since the agent-dispatch work shipped. The MCP server
already gave agents read/write access to the Kanban, but the autonomous daemon
(`scripts/flow_runner.py`) was **read-only**: it read issues via direct SQLite,
never authenticated to the API, never claimed a task, never posted audit
comments, and never wrote status back. So agents could see and drive the board,
but the autonomous pipeline could not reflect its own work on it. This cycle
closed that one-way gap.

## What shipped

| Change | Detail |
|---|---|
| `scripts/flow_runner.py` auth | Authenticates against the API via the protocol superuser (`f@flow.com`/`superdev123`, overridable via `PB_SUPERUSER_EMAIL`/`PB_SUPERUSER_PASSWORD`), falling back to a `users` account, then to read-only SQLite if unreachable. |
| `scripts/flow_runner.py` read path | `get_milestones` / `get_active_issues` now read through the **same authenticated API** it writes to (single source of truth), so a task it just claimed is visible on the next read. SQLite remains a fallback when the API is down. |
| `scripts/flow_runner.py` write-back | On each cycle the daemon **claims** a backlog/todo task to `in_progress` and posts an **agent audit comment** (`🔄 Flow daemon picked up ...`). `--dry-run` reports but never writes. |
| `scripts/flow_runner.py` URL encoding | Filter queries in the API reads are now URL-encoded, fixing a `URL can't contain control characters` error from the un-encoded `project = '...'` filter. |
| `scripts/mcp_server.py` `add_comment` | **Bug fix:** the comments schema requires BOTH `content` and `body` (repair migration 0003 added `body` as a required text field). The tool sent only `content`, so every agent audit comment POST failed with a 400. Now mirrors both. |
| Tests | New `tests/test_flow_runner_sync.py` drives `flow_runner.py --once` against a scratch PocketBase instance and asserts auth, claim→`in_progress`, agent comment persistence, and that `--dry-run` never writes. |

## Verification

- `pytest -v tests/` → **87 passed / 3 skipped** (was 85 passed; +2 new sync tests).
- `flow_runner.py --project PB --once` against the live instance authenticated
  and correctly resolved PB-43 as the active task.
- MCP `add_comment` verified end-to-end against the live server: the comment now
  persists (both `content` and `body` populated); probe comment cleaned up.
- `FEATURE_MATRIX.md` `Autonomous flow daemon + agent dispatch` row remains
  **shipped**; this cycle hardened it from read-only to genuinely bidirectional.
