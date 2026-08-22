#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PORT="${PROJECTBASE_PORT:-8120}"
HOST="${PROJECTBASE_HOST:-0.0.0.0}"

echo ">>> Starting ProjectBase on ${HOST}:${PORT}..."
exec ./pocketbase serve --dir "$DIR/pb_data" --publicDir "$DIR/pb_public" --hooksDir "$DIR/pb_hooks" --http "${HOST}:${PORT}"
