#!/usr/bin/env bash
# scripts/typegen.sh
# Dev-only: generates TypeScript types from the live PocketBase schema so your
# editor/agent gets IntelliSense + type checking. This is NOT a build step and
# the generated file is never shipped to the browser — the zero-build frontend
# stays untouched. Run it after changing any collection schema/migration.
#
# Usage:
#   scripts/typegen.sh            # generate types from pb_data/data.db
#   scripts/typegen.sh --watch    # regenerate on schema changes
#
# Output: pocketbase-types.ts (gitignored, editor-only)
#
# Uses pocketbase-typegen (https://github.com/patmood/pocketbase-typegen),
# a small dev-only CLI that reads the sqlite DB and emits typed records.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

DB="${DB:-pb_data/data.db}"
OUT="${OUT:-pocketbase-types.ts}"

if [ ! -f "$DB" ]; then
    echo "✗ No PocketBase db at $DB. Start the server once (scripts/start.sh) to create it." >&2
    exit 1
fi

echo "⚡ Generating TypeScript types from $DB → $OUT ..."
# npx resolves locally first, then falls back to a scratch install — never a
# project node_modules (this repo has none, and we want to keep it that way).
if ! npx --yes pocketbase-typegen --db "$DB" --out "$OUT"; then
    echo "✗ pocketbase-typegen failed. Ensure node + npx are on PATH." >&2
    exit 1
fi

if [ ! -s "$OUT" ]; then
    echo "✗ generated $OUT is empty — check the DB schema." >&2
    exit 1
fi

echo "✓ Types generated at $OUT ($(wc -l < "$OUT") lines). Editor-only; not shipped."
