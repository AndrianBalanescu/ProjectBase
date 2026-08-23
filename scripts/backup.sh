#!/usr/bin/env bash
# ProjectBase — create and download a full backup via the PocketBase backups API.
#
# Produces backups/projectbase-<UTC timestamp>.zip containing data.db,
# auxiliary.db and the file storage tree. Safe to run while the app is live.
#
# Usage:
#   ./scripts/backup.sh [--url http://127.0.0.1:8120] [--email f@flow.com]
#                       [--password superdev123] [--out backups] [--keep 14]
#                       [--timeout 120]
#
# Environment overrides: PROJECTBASE_URL, PB_SUPERUSER_EMAIL,
#                        PB_SUPERUSER_PASSWORD, PROJECTBASE_BACKUP_DIR.
#
# Flow: superuser auth -> POST /api/backups (snapshot) -> wait until the new
# key appears in the list -> POST /api/files/token -> download the zip ->
# verify with unzip -t -> prune local copies to --keep -> delete the
# server-side copy we just downloaded (your data, your disk).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BASE_URL="${PROJECTBASE_URL:-http://127.0.0.1:8120}"
EMAIL="${PB_SUPERUSER_EMAIL:-f@flow.com}"
PASSWORD="${PB_SUPERUSER_PASSWORD:-superdev123}"
OUT_DIR="${PROJECTBASE_BACKUP_DIR:-$DIR/backups}"
KEEP=14
TIMEOUT=120

log()  { echo ">>> [backup] $*"; }
die()  { echo "!!! [backup] $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)      BASE_URL="$2"; shift 2 ;;
    --email)    EMAIL="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --out)      OUT_DIR="$2"; shift 2 ;;
    --keep)     KEEP="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    -h|--help)  sed -n '2,18p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

command -v curl >/dev/null || die "curl is required"
command -v unzip >/dev/null || die "unzip is required"
[[ "$KEEP" =~ ^[0-9]+$ ]] || die "--keep must be numeric"
[[ "$TIMEOUT" =~ ^[0-9]+$ ]] || die "--timeout must be numeric (seconds)"

mkdir -p "$OUT_DIR"

# 1. Superuser auth token.
log "authenticating as ${EMAIL} against ${BASE_URL}"
TOKEN=$(curl -sf -X POST "$BASE_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  --max-time 30 | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])') \
  || die "authentication failed (check --email/--password or that the app is running)"

# 2. Trigger a fresh server-side snapshot.
BEFORE=$(curl -sf "$BASE_URL/api/backups" -H "Authorization: $TOKEN" --max-time 30 \
  | python3 -c 'import json,sys; print(" ".join(i["key"] for i in json.load(sys.stdin)))') || BEFORE=""
log "requesting new backup snapshot"
curl -sf -X POST "$BASE_URL/api/backups" -H "Authorization: $TOKEN" --max-time 30 >/dev/null \
  || die "backup creation request failed"

# 3. Wait until a new key appears (large databases take a moment).
KEY=""
DEADLINE=$(( $(date +%s) + TIMEOUT ))
while [[ -z "$KEY" && $(date +%s) -lt $DEADLINE ]]; do
  NEW=$(curl -sf "$BASE_URL/api/backups" -H "Authorization: $TOKEN" --max-time 30 \
    | python3 -c 'import json,sys; print(" ".join(i["key"] for i in json.load(sys.stdin)))' 2>/dev/null) || NEW=""
  for k in $NEW; do
    if [[ " $BEFORE " != *" $k "* ]]; then KEY="$k"; break; fi
  done
  [[ -n "$KEY" ]] || sleep 2
done
[[ -n "$KEY" ]] || die "timed out waiting for the backup to appear in /api/backups"
log "snapshot created: ${KEY}"

# 4. Short-lived file token + download.
FILE_TOKEN=$(curl -sf -X POST "$BASE_URL/api/files/token" -H "Authorization: $TOKEN" --max-time 30 \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])') \
  || die "could not obtain a file download token"

# Millisecond precision: two backups in the same second must not collide on
# the same filename (the second would silently overwrite the first).
STAMP="$(date -u +%Y%m%d-%H%M%S-%3N)"
DEST="$OUT_DIR/projectbase-${STAMP}.zip"
log "downloading to ${DEST}"
if ! curl -sf "$BASE_URL/api/backups/$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=''))" "$KEY")?token=${FILE_TOKEN}" \
  -o "$DEST" --max-time "$TIMEOUT"; then
  rm -f "$DEST"
  # Do not leak the server-side snapshot we created.
  curl -sf -X DELETE "$BASE_URL/api/backups/$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=''))" "$KEY")" \
    -H "Authorization: $TOKEN" --max-time 30 >/dev/null 2>&1 || true
  die "download failed (partial file removed; server-side snapshot ${KEY} cleaned up)"
fi

# 5. Verify the archive is a sound zip that actually contains the database.
unzip -t "$DEST" >/dev/null || { rm -f "$DEST"; die "downloaded archive failed unzip -t (removed)"; }
# grep -q closes the pipe on first match, SIGPIPEs unzip, and under
# `set -o pipefail` that surfaces as 141 — which would falsely trigger the
# `|| { rm; die; }` below and delete a VALID backup. Test a captured variable.
if [[ -z "$(unzip -l "$DEST" 2>/dev/null | grep 'data\.db')" ]]; then
  rm -f "$DEST"
  die "archive does not contain data.db (removed)"
fi

# 6. Local retention.
if [[ "$KEEP" -gt 0 ]]; then
  ls -1t "$OUT_DIR"/projectbase-*.zip 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    log "pruning old local backup: $(basename "$old")"
    rm -f "$old"
  done
fi

# 7. Remove the server-side copy we just downloaded.
curl -sf -X DELETE "$BASE_URL/api/backups/$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=''))" "$KEY")" \
  -H "Authorization: $TOKEN" --max-time 30 >/dev/null || log "warning: could not delete server-side copy ${KEY}"

log "✓ backup complete: ${DEST} ($(du -h "$DEST" | cut -f1))"
