#!/usr/bin/env bash
# scripts/agent_bridge/build.sh
# Builds the Go agent-bridge into a single static binary at bin/agent_bridge.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$DIR/scripts/agent_bridge"
echo "⚡ Building static agent-bridge..."
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$DIR/bin/agent_bridge" .
echo "✓ bin/agent_bridge ($(du -h "$DIR/bin/agent_bridge" | cut -f1))"
