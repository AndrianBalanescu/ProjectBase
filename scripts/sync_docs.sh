#!/usr/bin/env bash
# scripts/sync_docs.sh
# Copy the repository's curated markdown into app/pb_public/docs-files/ and
# emit a manifest the Docs view reads.
#
# WHY A COPY instead of a runtime file read:
#   PocketBase's $os.readFile has no path-traversal guard (verified on 0.39.11:
#   "<root>/../../etc/hostname" reads successfully). Any route that reads a
#   caller-influenced path would let an authenticated user read arbitrary
#   server files (pb_data/*.db, ~/.memrize/.env, SSH keys). Copying at build
#   time removes that entire class of bug: the viewer only ever fetches static
#   assets that already live inside the public dir. Mirrors scripts/build_css.sh.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

OUT_DIR="app/pb_public/docs-files"
MANIFEST="app/pb_public/docs-files/manifest.json"

# Curated, ordered allowlist. No globs, no dynamic discovery: every entry is
# an intentional decision about what becomes publicly readable. Add a file
# here to publish it; nothing is published implicitly.
SOURCES=(
  "README.md"
  "CHANGELOG.md"
  "CONTRIBUTING.md"
  "SECURITY.md"
  "SUPPORT.md"
  "GOVERNANCE.md"
  "CHARTER.md"
  "CODE_OF_CONDUCT.md"
  "AGENTS.md"
  "docs/ROADMAP.md"
  "docs/TODO.md"
  "docs/BENCHMARKS.md"
  "docs/RESTORING_VIEWS.md"
  "docs/architecture-audit-and-competitive-landscape.md"
)

# Friendly titles; fall back to the file's own first H1, then the path.
title_for() {
  local rel="$1"
  case "$rel" in
    README.md) echo "README" ;;
    CHANGELOG.md) echo "Changelog" ;;
    AGENTS.md) echo "Agent Guide (AGENTS.md)" ;;
    docs/ROADMAP.md) echo "Roadmap" ;;
    docs/TODO.md) echo "Task Queue & Stabilization" ;;
    docs/BENCHMARKS.md) echo "Benchmarks" ;;
    docs/RESTORING_VIEWS.md) echo "Restoring Views" ;;
    docs/architecture-audit-and-competitive-landscape.md) echo "Architecture & Landscape" ;;
    *) echo "$rel" ;;
  esac
}

group_for() {
  case "$1" in
    docs/*) echo "Docs" ;;
    *) echo "Project" ;;
  esac
}

mkdir -p "$OUT_DIR"

entries=""
count=0
skipped=0
for rel in "${SOURCES[@]}"; do
  if [ ! -f "$rel" ]; then
    echo "   skip (missing): $rel"
    skipped=$((skipped + 1))
    continue
  fi
  safe="$(printf '%s' "$rel" | tr '/' '__')"
  cp "$rel" "$OUT_DIR/$safe"
  bytes="$(wc -c < "$rel")"
  title="$(title_for "$rel")"
  group="$(group_for "$rel")"
  # JSON-escape the few fields that come from file paths/titles.
  j() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
  entries="$entries${entries:+,}
    {\"file\": \"$(j "$safe")\", \"title\": \"$(j "$title")\", \"group\": \"$(j "$group")\", \"source\": \"$(j "$rel")\", \"bytes\": $bytes}"
  count=$((count + 1))
done

{
  printf '{\n'
  printf '  "generated_by": "scripts/sync_docs.sh",\n'
  printf '  "note": "Read-only mirror of curated repository markdown. Do not edit here; run the script.",\n'
  printf '  "count": %d,\n' "$count"
  printf '  "files": [%s\n  ]\n' "$entries"
  printf '}\n'
} > "$MANIFEST"

# Validate the manifest is real JSON before declaring success.
if command -v python3 >/dev/null 2>&1; then
  python3 -c "import json,sys; d=json.load(open('$MANIFEST')); assert d['count']==len(d['files']), 'count mismatch'; print('   manifest OK:', d['count'], 'files')"
fi

echo "✓ Synced $count markdown file(s) into $OUT_DIR ($(du -sh "$OUT_DIR" | cut -f1))${skipped:+, skipped $skipped missing}"
