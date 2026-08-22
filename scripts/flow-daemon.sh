#!/usr/bin/env bash
# scripts/flow-daemon.sh
# ProjectBase Continuous Autonomous Flow Daemon

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PROJECT="${1:-PB}"
INTERVAL="${2:-120}"

echo ">>> Starting Autonomous Flow Daemon for project [$PROJECT] (Interval: ${INTERVAL}s)..."
exec python3 "$DIR/scripts/flow_runner.py" --project "$PROJECT" --interval "$INTERVAL"
