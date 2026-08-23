# Cycle 19 — Self-hosting: systemd service + backup/restore toolchain

**Date:** 2026-08-23 · **Milestone:** deploy / self-host · **Tests:** 82 passed (15 new)

## Why

The "100% self-hostable, MIT" promise had no lifecycle story. The app ran under a
hand-started process or Docker with no dedicated service unit, no backup, and no restore
path. Cycle 18 closed the last feature-matrix gap (offline-first); cycle 19 shipped the
operational half so a real user can self-host reliably and recover data.

## What shipped

| Artifact | Purpose |
|---|---|
| `deploy/projectbase.service` | Hardened systemd unit template (placeholders) |
| `scripts/install-systemd.sh` | Idempotent one-command systemd install (`sudo`) |
| `scripts/backup.sh` | Live full backup via the PocketBase backups API |
| `scripts/restore.sh` | Online (native restore) + offline (`pb_data` swap) restore |
| `tests/test_selfhosting.py` | 15-test suite covering all of the above |

### systemd unit hardening
`NoNewPrivileges=true`, `ProtectSystem=full`, `ProtectHome=read-only`,
`PrivateTmp=true`, `RestrictSUIDSGID`, `LockPersonality`, `RestrictRealtime`,
`ReadWritePaths` scoped to `pb_data` + `pb_migrations`, `Restart=on-failure`, runs as the
dedicated non-login `projectbase` user. The installer refuses the reserved gateway ports
(8080/8090) and offers `--print-unit` / `--dry-run` for review before any root action.

### backup.sh flow
`superuser auth` → `POST /api/backups` (server snapshot) → poll `/api/backups` until a
new key appears → short-lived `POST /api/files/token` → `GET /api/backups/{key}?token=`
download → `unzip -t` + `data.db` check → `--keep` local retention → delete the
server-side copy. Safe to run live; verified non-destructive against the running app.

### restore.sh
- **Online** (default): health check → upload via `POST /api/backups/upload` (204, named
  by filename) → `POST /api/backups/{key}/restore` → poll `/api/health` through the
  restart. Verified end-to-end: a post-snapshot mutation disappears after restore.
- **Offline** (`--offline [--no-service]`): stop service (or assume externally managed
  with `--no-service`), move `pb_data` to a timestamped rollback copy, extract the archive,
  start + health check, auto-rollback on failure, prune old rollbacks. `--app-dir`
  regression test guards that the data path resolves only after argument parsing.

## P1 security fix in the signup guard

`app/pb_hooks/15_signup_security.pb.js`'s privilege check was silently dead:

1. A module-scope helper `_isPrivileged(req)` is **not resolvable inside Goja hook
   callbacks** — every call threw `ReferenceError: _isPrivileged is not defined`. The
   catch then forced `member` unconditionally.
2. The update handler tested `!req.admin`, but a superuser authenticates with
   `auth.collection().name === "_superusers"` and carries **no `role` field**, so the
   superuser was never treated as privileged.

Fix: inlined the check (no module-scope helper) and detect superusers via
`auth.collection().name === "_superusers"`. Confirmed behavior: member self-promote
blocked, superuser PATCH promotes to manager, anon/superuser create coerced to member
(per the documented security model), journal clean.

## Homelab cutover

Replaced an ad-hoc `systemd --user` unit that was serving a **stale `pb_data` root copy**
(empty projects list) with the hardened `projectbase.service` on `:8120` pointing at the
real `app/pb_data` (31 issues / 6 projects intact, verified via API + sqlite). The
conflicting user-level unit was removed; the app now survives reboots via the enabled
system service.
