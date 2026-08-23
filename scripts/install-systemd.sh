#!/usr/bin/env bash
# ProjectBase — install/refresh a hardened systemd service on a unique port.
#
# Idempotent: re-running refreshes the unit file and restarts the service.
#
# Usage:
#   sudo ./scripts/install-systemd.sh [--port 8120] [--host 0.0.0.0]
#        [--user projectbase] [--app-dir /path/to/repo] [--unit-name projectbase]
#        [--print-unit] [--dry-run]
#
#   --print-unit  render the resolved unit to stdout and exit (no root needed)
#   --dry-run     show what would be done, change nothing
#
# Environment overrides: PROJECTBASE_PORT, PROJECTBASE_HOST, PB_SERVICE_USER.
#
# What it does:
#   1. Creates a dedicated system user/group (no login, no password).
#   2. Grants that user ownership of app/pb_data (live database + uploads)
#      and app/pb_migrations (admin-created migrations).
#   3. Renders deploy/projectbase.service with resolved paths/port.
#   4. Installs to /etc/systemd/system/, daemon-reload, enable --now.
#   5. Waits for /api/health on the configured port.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PORT="${PROJECTBASE_PORT:-8120}"
HOST="${PROJECTBASE_HOST:-0.0.0.0}"
SERVICE_USER="${PB_SERVICE_USER:-projectbase}"
APP_DIR="$DIR"
UNIT_NAME="projectbase"
DRY_RUN=0
PRINT_UNIT=0

log()  { echo ">>> [install-systemd] $*"; }
die()  { echo "!!! [install-systemd] $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)      PORT="$2"; shift 2 ;;
    --host)      HOST="$2"; shift 2 ;;
    --user)      SERVICE_USER="$2"; shift 2 ;;
    --app-dir)   APP_DIR="$2"; shift 2 ;;
    --unit-name) UNIT_NAME="$2"; shift 2 ;;
    --print-unit) PRINT_UNIT=1; shift ;;
    --dry-run)   DRY_RUN=1; shift ;;
    -h|--help)   sed -n '2,20p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ "$PORT" =~ ^[0-9]+$ ]] || die "--port must be numeric"
# Binding the gateway/default ports is forbidden by pipeline policy.
[[ "$PORT" != "8080" && "$PORT" != "8090" ]] || die "refusing port $PORT: reserved for system use (pick a unique venture port, e.g. 8120)"

APP_DIR="$(cd "$APP_DIR" && pwd)"
APP_SUBDIR="$APP_DIR/app"
[[ -d "$APP_SUBDIR" && -f "$APP_DIR/pocketbase" ]] || die "$APP_DIR does not look like a ProjectBase checkout (missing app/ or pocketbase binary)"
[[ -f "$APP_DIR/deploy/projectbase.service" ]] || die "missing deploy/projectbase.service template"

render_unit() {
  sed -e "s|__PB_USER__|${SERVICE_USER}|g" \
      -e "s|__PB_GROUP__|${SERVICE_USER}|g" \
      -e "s|__APP_DIR__|${APP_SUBDIR}|g" \
      -e "s|__PB_BIN__|${APP_DIR}/pocketbase|g" \
      -e "s|__PB_HOST__|${HOST}|g" \
      -e "s|__PB_PORT__|${PORT}|g" \
      "$APP_DIR/deploy/projectbase.service"
}

if [[ "$PRINT_UNIT" == "1" ]]; then
  render_unit
  exit 0
fi

UNIT_PATH="/etc/systemd/system/${UNIT_NAME}.service"

if [[ "$DRY_RUN" == "1" ]]; then
  log "dry-run: would create user '${SERVICE_USER}' if missing"
  log "dry-run: would chown '${APP_SUBDIR}/pb_data' + '${APP_SUBDIR}/pb_migrations' to '${SERVICE_USER}'"
  log "dry-run: would install unit to ${UNIT_PATH}:"
  render_unit | sed 's/^/    /'
  log "dry-run: would run: systemctl daemon-reload && systemctl enable --now ${UNIT_NAME}"
  exit 0
fi

[[ "$(id -u)" == "0" ]] || die "must run as root (sudo) to install a systemd unit; try --print-unit or --dry-run first"

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  log "creating dedicated system user '${SERVICE_USER}'"
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
else
  log "user '${SERVICE_USER}' already exists"
fi

# pb_data holds the live SQLite DB + uploaded files; pb_migrations may receive
# admin-created migration files from the PocketBase superuser UI.
for owned in pb_data pb_migrations; do
  target="$APP_SUBDIR/$owned"
  if [[ -d "$target" ]]; then
    chown -R "$SERVICE_USER:$SERVICE_USER" "$target"
  else
    install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$target"
  fi
done
# Read access to the rest of the app tree (public dir, hooks, vendor bundles).
chmod -R a+rX "$APP_SUBDIR"

render_unit > "$UNIT_PATH"
chmod 644 "$UNIT_PATH"
log "installed ${UNIT_PATH}"

if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze verify "$UNIT_PATH" || die "systemd-analyze rejected the unit"
  log "systemd-analyze verify: OK"
fi

systemctl daemon-reload
systemctl enable --now "$UNIT_NAME"
log "service enabled and started; waiting for health on 127.0.0.1:${PORT}..."

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    log "✓ ProjectBase healthy at http://127.0.0.1:${PORT}/ (service: ${UNIT_NAME})"
    exit 0
  fi
  sleep 1
done

journalctl -u "$UNIT_NAME" -n 30 --no-pager || true
die "service did not become healthy within 30s; inspect journalctl -u ${UNIT_NAME}"
