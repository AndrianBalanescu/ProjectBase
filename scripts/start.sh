#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PORT="${PROJECTBASE_PORT:-8120}"
HOST="${PROJECTBASE_HOST:-0.0.0.0}"

echo ">>> Starting ProjectBase on ${HOST}:${PORT}..."
cd "$DIR/app"
exec "$DIR/pocketbase" --dir pb_data serve --publicDir pb_public --hooksDir pb_hooks --migrationsDir pb_migrations --http "${HOST}:${PORT}"
