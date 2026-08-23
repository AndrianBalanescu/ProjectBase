#!/usr/bin/env bash
# scripts/qa/qa-render.sh — headless render QA for the live ProjectBase UI.
#
# Purpose: proves the app actually renders (Vue mounts, zero console/page
# errors, zero failed same-origin requests, no raw mustache leakage) and that
# the compiled Tailwind CSS + hand-written app.css utilities apply (verified
# via computed styles on a probe element). This is the local fallback when the
# shared iBrowse QA host is unreachable (cycle-39: its DNS timed out).
#
# Usage:
#   scripts/qa/qa-render.sh [port]        # default 8120
#
# Requirements:
#   - node + a playwright module somewhere (auto-detected, NODE_PATH overridable)
#   - a chromium build under ~/.cache/ms-playwright (auto-detected)
set -euo pipefail

PORT="${1:-8120}"
BASE="http://127.0.0.1:${PORT}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Locate a playwright module (prefer local, then known shared installs).
if node -e "require('playwright')" >/dev/null 2>&1; then
  NODE_PATH="${NODE_PATH:-}"
elif [ -d "/home/ubuntu/.hermes/hermes-agent/node_modules/playwright" ]; then
  NODE_PATH="/home/ubuntu/.hermes/hermes-agent/node_modules${NODE_PATH:+:$NODE_PATH}"
else
  echo "✗ playwright module not found (set NODE_PATH)" >&2
  exit 2
fi
export NODE_PATH

# Locate a chromium executable.
CHROME="${QA_CHROME:-$(find "${HOME}/.cache/ms-playwright" -path '*chrome-linux*/chrome' -type f 2>/dev/null | sort -V | tail -1 || true)}"
if [ -z "${CHROME}" ] || [ ! -x "${CHROME}" ]; then
  echo "✗ chromium not found under ~/.cache/ms-playwright (set QA_CHROME)" >&2
  exit 2
fi
export QA_CHROME="${CHROME}"

echo "🌐 Render QA: ${BASE} (chrome: ${CHROME})"
QA_BASE="${BASE}" node "${DIR}/qa/render_dom_check.js"
