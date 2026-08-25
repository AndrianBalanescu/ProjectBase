#!/usr/bin/env bash
# scripts/bump_version.sh
# Increments ProjectBase version (semver: patch, minor, major)

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$DIR/VERSION"
OPENAPI_FILE="$DIR/app/pb_public/openapi.json"

if [ ! -f "$VERSION_FILE" ]; then
    echo "0.8.0" > "$VERSION_FILE"
fi

CURRENT="$(cat "$VERSION_FILE" | tr -d '[:space:]')"
MODE="${1:-patch}"

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
MAJOR="${MAJOR:-0}"
MINOR="${MINOR:-8}"
PATCH="${PATCH:-0}"

case "$MODE" in
    patch)
        PATCH=$((PATCH + 1))
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    show)
        echo "v$CURRENT"
        exit 0
        ;;
    *)
        # If user passed an explicit version like 0.8.1
        if [[ "$MODE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            NEW_VERSION="$MODE"
        else
            echo "Usage: $0 [patch|minor|major|show|<version>]"
            exit 1
        fi
        ;;
esac

NEW_VERSION="${NEW_VERSION:-$MAJOR.$MINOR.$PATCH}"
echo "$NEW_VERSION" > "$VERSION_FILE"

# Update openapi.json if present
if [ -f "$OPENAPI_FILE" ]; then
    python3 -c "
import json, re
with open('$OPENAPI_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)
if 'info' in data:
    data['info']['version'] = '$NEW_VERSION'

# Keep the /projectbase/version response schema example in sync too, so the
# spec never drifts from VERSION (drift-guard: bump must update every ref).
def _walk(o):
    if isinstance(o, dict):
        if isinstance(o.get('example'), str) and re.fullmatch(r'\d+\.\d+\.\d+', o['example']):
            o['example'] = '$NEW_VERSION'
        for v in o.values():
            _walk(v)
    elif isinstance(o, list):
        for v in o:
            _walk(v)
_walk(data)

with open('$OPENAPI_FILE', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
"
fi

# Update the Header.js version badge (vX.Y.Z) so the UI stays in sync.
HEADER_FILE="$DIR/app/pb_public/js/components/Header.js"
if [ -f "$HEADER_FILE" ]; then
    sed -i -E "s/v[0-9]+\.[0-9]+\.[0-9]+/v$NEW_VERSION/g" "$HEADER_FILE"
fi

# Update the hardcoded version in the custom routes hook (health + version endpoints).
ROUTES_FILE="$DIR/app/pb_hooks/30_custom_routes.pb.js"
if [ -f "$ROUTES_FILE" ]; then
    sed -i -E "s/version: \"[0-9]+\.[0-9]+\.[0-9]+\"/version: \"$NEW_VERSION\"/g" "$ROUTES_FILE"
fi

echo "🚀 Bumped ProjectBase version: v$CURRENT -> v$NEW_VERSION"
