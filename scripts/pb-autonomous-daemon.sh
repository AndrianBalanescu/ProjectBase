#!/usr/bin/env bash
# scripts/pb-autonomous-daemon.sh
# ProjectBase Continuous Autonomous Daemon

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PROJECT="${1:-PB}"
INTERVAL="${2:-120}"

echo ">>> Starting Autonomous Daemon for project [$PROJECT] (Interval: ${INTERVAL}s)..."
exec python3 "$DIR/scripts/pb_autonomous_runner.py" --project "$PROJECT" --interval "$INTERVAL"
