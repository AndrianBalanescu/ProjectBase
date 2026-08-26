# ProjectBase — Agentic-Native Plan (agents show up on the board)

> Status: **v1 draft — kickoff 2026-08-26**
> Compass: become "agents that show up on the board" the way **Multica** does
> (47.7k★, Apache-2.0+restrictions), but stay **MIT / single-binary / lightweight
> (~50MB, SQLite, zero-build Vue)**. We already have both halves (ProjectBase = PM,
> Flomaster = agent runtime) as two projects; this plan merges them so agents are
> first-class board members.

## 1. Why / the reference

- **Multica** = workspace where AI coding agents are teammates: pick up issues,
  comment as they work, report blockers, hand back for review. Go server + Next web
  + desktop + iOS + daemon. Heavy monorepo, Apache-2.0 + Part-I restrictions.
- **Our read:** the hard part is NOT PM logic (we match Linear/Plane already). It is
  giving each agent an **identity on the board** + a **status feed** + **review gate**.
- Every agent already leaves discoverable config + session data on the user's machine
  (`.flomaster/`, `.claude/`, `.codex/`, `.cursor/`, `.agents/`, `.hermes/`, `.pi/`…).
  Detecting them is a **scanner + mapper**, not rocket science.

## 2. Core idea (simple version)

> For each discovered agent on a user's machine, auto-create a **user/record with
> `role=agent`** (name, provider, runtime, avatar). That agent then shows up on the
> Kanban assignee list like a human, can be assigned an issue, reports status, and
> hands work back for review.

**Detection matrix (v1):**

| Path | Detect via | Reads session | Notes |
|---|---|---|---|
| `~/.flomaster` | `config.toml` / `config.json`, `auth.json`, `last_focused_client_session` | `memrize.db` (SQLite) | **first agent to integrate** |
| `~/.agents` | symlink → agents-hub; `AGENTS.md`, `mcp.json`, `flow.conf` | skills/ | hub that aggregates |
| `~/.claude` | `~/.claude.json` / `.credentials.json`, dir | `*.jsonl` history | symlink on this box |
| `~/.codex` | `config.toml`, `auth.json` | `sessions/`, `log/` | thin on this box (only `tmp/`) |
| `~/.cursor` | `cli-config.json`, `agent-cli-state.json`, `agents/` | `chats/`, `projects/` | rich |
| `~/.hermes` | `.env`, `.hermes_history` | `.hermes_history` | huge dir |
| `~/.pi` | config | session files | present |

Each needs a small per-agent **reader adapter** because session storage differs
(SQLite vs JSONL vs JSON dirs vs flat history). That's the only real fragment:
it's per-format, not hard.

## 3. Effort honest breakdown

| Capability | Effort |
|---|---|
| Agent scanner (`.agents`/`.flomaster`/`.claude`/`.codex`/`.cursor`) → name+provider+runtime | **hours** |
| `users`/`agents` collection + `role=agent`, auto-create + custom config | **hours** |
| Agent as assignee on board + live status | **days** |
| Execution log (replay tool calls) | heavier |
| Token/cost per issue | heavier |
| Per-agent session-history reader | per-format (fragmented, not hard) |

## 4. Milestones

- **M1 — First agent integration (Flomaster):**
  - Backend: new `agents` collection (or `users` w/ `role=agent`); hook that
    auto-creates the `flomaster` agent record on a user's behalf.
  - Endpoint `/api/projectbase/agents/discover` → scans local agent dirs, returns
    detected team.
  - Endpoint `/api/projectbase/agents/<name>` → read flomaster's `config.toml`
    + `memrize.db` session summary.
  - Map the discovered agent to a `users[role=agent]` row so it appears as assignee.
- **M2:** agent as assignee + status live on Kanban (pick-up, in_progress, in_review, done).
- **M3:** execution log + review gate.
- **M4:** session-history readers for the other agent formats (`.claude`, `.codex`, `.cursor`, `.hermes`).
- **M5:** cost/token per issue + autopilots (cron standups/audits) — stretch.

## 5. Open decisions (need human)

1. **Agent identity in DB:** dedicated `agents` collection vs `users` with `role=agent`
   (affects auth + assignee drop-down + permissions). Lean: **`agents` collection**,
   keep `users` human-only, assignee is polymorphic or a new `assignee_agent` field.
2. **Execution log scope:** how much of flomaster's session to expose in v1
   (comments only vs replay tool calls).
3. **Review gate behavior:** should agent-assigned work default to `in_review`
   (never `done` without human)? Recommend yes.
4. **Local-only discovery vs network:** M1 scans **this machine**. Multi-user /
   multi-machine discovery is a later, separate feature (remote runtime/daemon).

## How it fits AGENTS.md §6 (dogfooding)
Flomaster is ProjectBase's dogfood agent. This plan makes it also a **first-class
board member**, so agent work is tracked in the `issues` collection the same way a
human's is — closing the loop in §6.1–6.4.

## 6. Goal (pipeline-flow charter)

> **Goal:** Become the agentic-native PM tool that shows AI agents on the board
> (Multica model) — **lighter, faster, better**: MIT, single-binary, ~50MB,
> SQLite, zero-build Vue, no hosted-agent lock-in, no token exfiltration.

**Why:** Multica (47.7k★) proved the positioning (agents as teammates). Its weak
points — heavy monorepo, Apache+restrictions, token-handling, Postgres/Redis,
desktop+iOS sprawl — are where ProjectBase wins by being **lighter** (single
binary ~50MB), **faster** (SQLite, zero-build), **better** (MIT, self-host,
multi-host agent-bridge, no vendor lock-in).

**Definition of done (board-visible):** any user on any host sees their full agent
team on the ProjectBase Kanban — with identity (name/avatar/host), live status,
per-issue execution log, and review gates — via a per-host agent-bridge daemon that
reads only sanitized metadata, never tokens.

## 7. Milestones (pipeline)

| Milestone | Scope | Dogfooded via | Gate |
|---|---|---|---|
| **M1 — Detect & register agents** | `agents` collection + discovery scanner + auto-create agent record per user; agent appears as assignee | Ticket PB-4394, `90_agents.pb.js`, migration 20 | Scan returns real team; record saved; UI lists agent |
| **M2 — Board identity + live status** | agent chip with avatar/host/status on Kanban; assign; pick-up→in_progress→in_review | status transitions logged to `activity` + notifications | Drag/assign flomaster; status live on board |
| **M3 — Execution log + review gate** | per-issue agent run log (replay tool calls), never `done` without human | comments + `activity` + PB-4394 evidence | run visible; review gate enforced |
| **M4 — Multi-host agent-bridge** | per-host daemon → sanitized JSON → PB; remote (Hostinger) agents on same board | install script + docs | host tag on board; remote agent registers |
| **M5 — Light/clean vs Multica** | single-binary, ~60MB, no Postgres, no daemon-in-PM | tests + benchmark | size/RAM/health evidence |

Each milestone ships as a ProjectBase issue with a **human-readable comment
(pytest count + iBrowse QA)** before `done` (AGENTS.md §6.3).

## 8. Architecture recap (side inspector / agent-bridge)

A per-machine **agent-bridge (sidecar daemon)** — runs **as the machine's user**,
scans local agent dirs (`~/.flomaster`, `~/.claude`, `~/.codex`, `~/.cursor`,
`~/.agents`, `~/.hermes`, `~/.pi`) for name/provider/runtime/status, and writes
**sanitized metadata JSON** that the ProjectBase server reads. It never forwards
tokens (auth.json, memrize.db stay local). Same bridge installs on a remote box
(Hostinger/VPS) and reports the same agents to the same board, tagged by host.

```
~user/.flomaster ─┐
~user/.claude   ──┼─► agent-bridge (runs as user) ─► sanitized JSON ─► PB :8120 ─► board
~user/.codex    ──┘     ▲ host=local
~user@hostinger/.claude ─► agent-bridge (on hostinger) ─► sanitized JSON ─► same board
```

**Security:** PM server stays under its own system user; it reads only the
sanitized JSON, never user-token files. Access granted at install (sidecar gets
user's permissions), not by widening the server's home.
