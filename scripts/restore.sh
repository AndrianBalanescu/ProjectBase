#!/usr/bin/env bash
# ProjectBase — restore a backup zip produced by scripts/backup.sh.
#
# Two modes:
#   online (default): uploads the zip to the running instance and invokes the
#     native PocketBase restore endpoint, which validates the archive and
#     restarts the app onto the restored data. No downtime beyond the restart.
#   offline (--offline): stops the service, swaps app/pb_data for the archive
#     contents (keeping a rollback copy), starts the service again, and rolls
#     back automatically if health checks fail.
#
# Usage:
#   ./scripts/restore.sh <backup.zip> [--url http://127.0.0.1:8120]
#        [--email f@flow.com] [--password superdev123]
#        [--service projectbase] [--port 8120] [--offline] [--no-service]
#        [--timeout 120]
#
# Environment overrides: PROJECTBASE_URL, PB_SUPERUSER_EMAIL,
#                        PB_SUPERUSER_PASSWORD.
#
# The offline mode is DESTRUCTIVE to current data: it always keeps a rollback
# copy at app/pb_data.pre-restore-<timestamp> and prunes rollback copies older
# than --keep-rollback (default 3).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BASE_URL="${PROJECTBASE_URL:-http://127.0.0.1:8120}"
EMAIL="${PB_SUPERUSER_EMAIL:-f@flow.com}"
PASSWORD="${PB_SUPERUSER_PASSWORD:-superdev123}"
SERVICE="projectbase"
PORT="8120"
OFFLINE=0
NO_SERVICE=0
TIMEOUT=120
KEEP_ROLLBACK=3
APP_DIR="${PROJECTBASE_APP_DIR:-$DIR/app}"

log()  { echo ">>> [restore] $*"; }
die()  { echo "!!! [restore] $*" >&2; exit 1; }

# Scan for a help flag before treating the first positional as the backup zip.
for a in "$@"; do
  case "$a" in
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
  esac
done

[[ $# -ge 1 ]] || { sed -n '2,24p' "$0"; exit 1; }
ZIP="$1"; shift
[[ -f "$ZIP" ]] || die "backup file not found: $ZIP"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)           BASE_URL="$2"; shift 2 ;;
    --email)         EMAIL="$2"; shift 2 ;;
    --password)      PASSWORD="$2"; shift 2 ;;
    --service)       SERVICE="$2"; shift 2 ;;
    --port)          PORT="$2"; shift 2 ;;
    --app-dir)       APP_DIR="$2"; shift 2 ;;
    --offline)       OFFLINE=1; shift ;;
    --no-service)    NO_SERVICE=1; shift ;;
    --timeout)       TIMEOUT="$2"; shift 2 ;;
    --keep-rollback) KEEP_ROLLBACK="$2"; shift 2 ;;
    -h|--help)       sed -n '2,24p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

# Resolve data paths ONLY after argument parsing so --app-dir takes effect.
APP_DIR="$(cd "$APP_DIR" && pwd)" || die "--app-dir not found: $APP_DIR"
PB_DATA="$APP_DIR/pb_data"

unzip -t "$ZIP" >/dev/null || die "archive failed unzip -t — refusing to restore"
# grep -q in a pipe SIGPIPEs unzip under `set -o pipefail` (141) and would
# falsely reject a valid backup; test a captured variable instead.
if [[ -z "$(unzip -l "$ZIP" 2>/dev/null | grep 'data\.db')" ]]; then
  die "archive does not contain data.db — not a ProjectBase backup"
fi

auth_token() {
  curl -sf -X POST "$BASE_URL/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" --max-time 30 \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

wait_healthy() {
  local deadline=$(( $(date +%s) + TIMEOUT ))
  while [[ "$(date +%s)" -lt "$deadline" ]]; do
    if curl -sf "$BASE_URL/api/health" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

port_listening() {
  # Captured check (not `ss | grep -q` in a pipe) to avoid the SIGPIPE-under-
  # pipefail false-negative that would hide an existing listener.
  [[ -n "$(ss -ltn 2>/dev/null | grep ":$PORT ")" ]]
}

if [[ "$OFFLINE" == "0" ]]; then
  # ------------------------------------------------------------------ online
  command -v curl >/dev/null || die "curl is required"
  curl -sf "$BASE_URL/api/health" >/dev/null 2>&1 || die "app is not reachable at $BASE_URL (use --offline for a stopped instance)"
  TOKEN="$(auth_token)" || die "authentication failed"
  log "uploading $(basename "$ZIP") to the running instance"
  UP_NAME="$(basename "$ZIP")"
  UP_CODE="$(curl -s -o /tmp/projectbase-restore-upload.out -w '%{http_code}' -X POST "$BASE_URL/api/backups/upload" \
    -H "Authorization: $TOKEN" \
    -F "file=@${ZIP};filename=${UP_NAME}" --max-time "$TIMEOUT")" || die "upload request failed"
  # PocketBase names the uploaded backup after the multipart filename and
  # replies 204 with an empty body on success (400 if the name already exists,
  # which is fine — the existing copy is the same archive).
  if [[ "$UP_CODE" == 2* || "$UP_CODE" == "400" ]]; then
    KEY="$UP_NAME"
  else
    die "upload failed (HTTP ${UP_CODE}): $(head -c 300 /tmp/projectbase-restore-upload.out)"
  fi
  log "uploaded as ${KEY}; triggering native restore (app will restart)"
  curl -s -X POST "$BASE_URL/api/backups/$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=''))" "$KEY")/restore" \
    -H "Authorization: $TOKEN" --max-time 30 >/dev/null
  # The restore endpoint returns before the restart; poll through it.
  sleep 3
  if wait_healthy; then
    log "✓ online restore complete — app is healthy at ${BASE_URL}"
    exit 0
  fi
  die "app did not return healthy within ${TIMEOUT}s after restore; check the app logs"
fi

# ------------------------------------------------------------------ offline
[[ -d "$PB_DATA" ]] || die "no pb_data directory at $PB_DATA"

HAD_SERVICE=0
if [[ "$NO_SERVICE" != "1" ]]; then
  command -v systemctl >/dev/null || die "--offline with service management requires systemctl (pass --no-service for externally managed instances)"
  # grep -q closes the pipe as soon as it matches, SIGPIPEs systemctl, and
  # under set -o pipefail that surfaces as a nonzero (141) status — which made
  # the in-pipeline test below always "fail". Test a captured variable instead.
  if [[ -n "$(systemctl list-unit-files 2>/dev/null | grep '^'"${SERVICE}"'\.service')" ]]; then
    if [[ "$(id -u)" != "0" ]]; then
      die "stopping the ${SERVICE}.service unit requires root — re-run as: sudo ./scripts/restore.sh ... --offline --service ${SERVICE} (or use --no-service)"
    fi
    HAD_SERVICE=1
    log "stopping ${SERVICE}.service"
    systemctl stop "$SERVICE" || die "could not stop ${SERVICE}.service"
  elif port_listening; then
    die "something is listening on :${PORT} but it is not ${SERVICE}.service — stop it manually and rerun (or pass --no-service)"
  fi
elif port_listening; then
  die "--no-service used but something is listening on :${PORT} — stop your instance first"
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)"
ROLLBACK="$PB_DATA.pre-restore-$STAMP"
log "moving current data aside: ${ROLLBACK}"
mv "$PB_DATA" "$ROLLBACK"
mkdir -p "$PB_DATA"
if ! unzip -o "$ZIP" -d "$PB_DATA" >/dev/null; then
  log "extraction failed — rolling back"
  rm -rf "$PB_DATA"; mv "$ROLLBACK" "$PB_DATA"
  [[ "$HAD_SERVICE" == "1" ]] && systemctl start "$SERVICE"
  die "extraction failed; original data restored"
fi

# Match ownership to the service user when one exists.
if [[ "$HAD_SERVICE" == "1" ]]; then
  SVC_USER="$(systemctl show -p User --value "$SERVICE" 2>/dev/null || true)"
  [[ -n "${SVC_USER:-}" && "$SVC_USER" != "root" ]] && chown -R "$SVC_USER:$SVC_USER" "$PB_DATA"
  log "restarting ${SERVICE}.service"
  systemctl start "$SERVICE"
fi

prune_rollbacks() {
  ls -1dt "$APP_DIR"/pb_data.pre-restore-* 2>/dev/null | tail -n +$((KEEP_ROLLBACK + 1)) | while read -r old; do
    log "pruning old rollback: $(basename "$old")"
    rm -rf "$old"
  done
}

if [[ "$HAD_SERVICE" == "1" ]]; then
  if wait_healthy; then
    log "✓ offline restore complete — healthy on port ${PORT}"
    log "rollback copy kept at ${ROLLBACK}"
    prune_rollbacks
    exit 0
  fi
  log "health check failed — rolling back to ${ROLLBACK}"
  systemctl stop "$SERVICE" || true
  if [[ -d "$PB_DATA" ]]; then rm -rf "$PB_DATA.unhealthy-$STAMP"; mv "$PB_DATA" "$PB_DATA.unhealthy-$STAMP"; fi
  mv "$ROLLBACK" "$PB_DATA"
  systemctl start "$SERVICE" || true
  die "restore did not become healthy; rolled back (unhealthy attempt kept at $PB_DATA.unhealthy-$STAMP)"
fi

log "✓ offline restore complete — data extracted to ${PB_DATA}"
log "rollback copy kept at ${ROLLBACK}"
log "start your instance (e.g. docker compose up -d) and verify health on :${PORT}"
prune_rollbacks
exit 0
