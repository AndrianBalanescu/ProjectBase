# Cycle 26 — In-app notifications inbox

**Date:** 2026-08-23
**Status:** shipped, 118 tests passing

## Goal

Close the last visible table-stakes gap in the feature matrix: in-app
notifications. ProjectBase already dispatched external-channel notifications
(Discord / Telegram / webhook), but a Linear/Plane-class product needs a header
bell + inbox so users see "someone assigned you", "@mentioned you", or
"commented on your issue" without leaving the app. The inbox also gives
autonomous agents a native channel to surface attention items.

## What shipped

### Schema (migration 12 — `app/pb_migrations/1710000012_add_notifications.js`)
Additive, idempotent `notifications` collection:

| Field | Type | Notes |
|---|---|---|
| recipient | relation → users | required, cascade delete |
| issue | relation → issues | optional |
| comment | relation → comments | optional |
| actor | text | display name of whoever caused it |
| actor_type | select | user \| agent \| system |
| type | select | assigned \| mentioned \| commented \| status \| priority \| system |
| message | text | human-readable summary |
| read | bool | unread badge driver |

Rules are recipient-scoped: `recipient = @request.auth.id` on list/view/update;
`createRule` null (only pb_hooks write rows); delete for recipient or admin.
Purely additive: safe on existing and fresh installs.

### Hooks (`app/pb_hooks/55_notifications.pb.js`)
- **Issue created** with assignee matching a registered `users.name` → `assigned`.
- **Assignee changed** to a registered user → `assigned`.
- **Status / priority changed** → `status` / `priority` for the assignee
  (skipped when the actor is the assignee themselves).
- **Comment** on an assigned issue → `commented` for the assignee.
- **`@Name` mention** in a comment → `mentioned` for the mentioned user(s).
- `POST /api/projectbase/notifications/read-all` — bell "mark all read".

**Critical fix during build:** module-scope helper functions are not resolvable
from inside Goja hook callbacks (`ReferenceError: <fn> is not defined`) — the
same bug class as the cycle-5 P0 fix in `15_signup_security.pb.js`. The first
version of this hook used module-scope helpers and silently failed every
`onRecordAfterCreateSuccess` (the record saved, but the request returned 400).
Rewrote with ALL logic inlined in callbacks; every path is try/catch so a
broken notification can never break the core issue/comment write path.

### Frontend
- **Header bell** with live unread badge (cap display at 99+) and dropdown
  inbox; click-outside closes it; empty state; relative timestamps; per-type
  lucide icons.
- **app.js** — `notifications` state, `unreadNotifications` computed, realtime
  SSE refresh on `notifications` events, click → mark read + jump to the issue
  (including project switch when the issue lives in another project).
- **api.js** — `getNotifications()` (recipient-filtered, `expand=issue,
  issue.project,comment`), `markNotificationRead()`,
  `markAllNotificationsRead()`.

### Agent surface
- 3 new FastMCP tools: `list_notifications`, `mark_notification_read`,
  `mark_all_notifications_read`.
- `llms.txt` and `llms-full.txt` document the collection, fields, and curl
  snippets.

### Tests (9 new, `tests/test_api.py`)
1. assigned notification generated on issue create with assignee
2. unassigned issue creates no notification and does not break the hook
3. comment notifies the assignee (not the author)
4. `@mention` notifies the mentioned registered user
5. recipient isolation — user B never sees user A's notifications
6. anonymous list returns empty (no leak) and forge create is rejected
7. mark-read (single) + read-all route work
8. cross-user PATCH on someone else's notification is blocked (404/403/400)
9. read-all route requires auth (401/403)

Full suite: **118 passed** (was 109).

## Validation

- `uv run pytest -v tests/` → 118 passed.
- `python3 -m flow.frontend_guard` → clean.
- `node --check` on all changed JS → clean.
- Migration applied live on the homelab `projectbase.service`; issue/comment
  create verified 200 with the hook active; read-all route verified (401
  anonymous, 200 authed).
- iBrowse remote QA (:3000) timed out twice at the infra level — no result
  captured; local API-driven checks + frontend guard + node checks cover the
  surface.

## Known limitations

- Notifications are generated on a best-effort basis; a hook failure degrades
  to "no notification" without affecting the underlying write.
- No per-notification delete UI in the bell yet (API + rules allow it; the
  inbox keeps the last 50 via `perPage=50`).
- Email notifications are still external-channel only (no SMTP sender);
  in-app inbox is the primary surface.
- Mention matching uses case-insensitive `@Name` inclusion against registered
  users; quoted/decorated mentions in markdown may match loosely.
