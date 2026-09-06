#!/usr/bin/env bash
# ProjectBase — first-boot wrapper for PocketBase (fresh deployments only).
#
# WORKAROUND for PocketBase 0.39.x: on the very first boot of an empty data
# directory, migrations create the collections and seed rows, but the running
# server's records API cannot see them (API rules evaluate as if the request
# were anonymous; list/by-id return 0 rows / 404 until the process restarts).
# Verified reproducible with a minimal two-migration case; a restart rebuilds
# the collection registry from the DB and everything becomes visible.
#
# This wrapper detects a fresh data dir (no `.first-boot-done` marker next to
# data.db), runs the real serve once to apply migrations, stops that first
# process, then exec's the real serve again. The second boot rebuilds the
# collection registry from the DB and everything is served fully visible.
# Every subsequent boot short-circuits straight to the plain serve command.
#
# Usage: serve-firstboot.sh <marker-dir> <pb-binary> [serve args...]
#   marker-dir: directory that contains (or will contain) the data dir
#   pb-binary:  path to the pocketbase binary
#   remaining:   full serve command arguments

set -u

MARKER_DIR="$1"; shift
PB_BIN="$1"; shift
DATA_DIR_MARKER="$MARKER_DIR/.first-boot-done"

if [ -f "$DATA_DIR_MARKER" ]; then
    exec "$PB_BIN" "$@"
fi

echo "[serve-firstboot] fresh data dir detected - applying migrations, then restarting once"
"$PB_BIN" "$@" &
PB_PID=$!

# Wait until the first boot has applied migrations: PB starts the listener
# after migrations in the boot sequence, so once /api/health responds, wait a
# fixed dwell to let WAL writes settle, bounded to ~60s total.
for _ in $(seq 1 60); do
    if ! kill -0 "$PB_PID" 2>/dev/null; then
        echo "[serve-firstboot] pocketbase exited early during first boot" >&2
        exit 1
    fi
    if curl -fsS "http://127.0.0.1:${PROJECTBASE_PORT:-8120}/api/health" >/dev/null 2>&1; then
        sleep 5
        break
    fi
    sleep 1
done

kill "$PB_PID" 2>/dev/null
wait "$PB_PID" 2>/dev/null

# Give the killed process a moment to flush/checkpoint its WAL before the
# second boot opens the DB, otherwise boot2 can race the checkpoint.
sleep 2

touch "$DATA_DIR_MARKER"
echo "[serve-firstboot] first boot complete - restarting pocketbase"

"$PB_BIN" "$@" &
PB_PID=$!
trap 'kill "$PB_PID" 2>/dev/null' TERM INT
wait "$PB_PID"
exit $?