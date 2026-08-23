#!/usr/bin/env bash
# ProjectBase — reset the shared demo workspace to a pristine state.
#
# Stops the stack, wipes pb_data, and reboots. The seed migration
# (pb_migrations/1710000005_seed_defaults.js) rebuilds the 6 demo projects +
# 17 issues on first boot. Verified idempotent (no duplicates on restart).
#
# Usage:
#   ./scripts/reset-demo.sh [--yes] [--install-cron HOURS]
#
# --install-cron installs an idempotent /etc/cron.d entry that resets the demo
# every HOURS hours (e.g. 6). Requires root (sudo).

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PORT="${PROJECTBASE_PORT:-8120}"
EMAIL="${PB_SUPERUSER_EMAIL:-f@flow.com}"
PASSWORD="${PB_SUPERUSER_PASSWORD:-superdev123}"
ASSUME_YES=0
INSTALL_CRON=""

log() { echo ">>> [reset-demo] $*"; }
die() { echo "!!! [reset-demo] $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)      ASSUME_YES=1; shift ;;
    --install-cron) INSTALL_CRON="$2"; shift 2 ;;
    -h|--help)     sed -n '2,13p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

command -v docker >/dev/null 2>&1 || die "docker not found"

if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "This DELETES all data in $(pwd)/pb_data and reseeds the demo. Continue? [y/N] " ans
  [[ "${ans,,}" == "y" ]] || die "aborted by user"
fi

[[ -d pb_data ]] || die "no pb_data here — run from a ProjectBase checkout"

log "Stopping stack ..."
docker compose down || true

log "Wiping pb_data ..."
# The container runs as root and owns pb_data files on the bind mount, so a
# plain host `rm -rf` fails with permission denied for non-root deploy users.
# Wipe via a throwaway root container over the bind mount instead.
docker run --rm -v "$(pwd)/pb_data:/data" alpine:latest sh -c 'find /data -mindepth 1 -delete' \
  || die "failed to wipe pb_data (is the docker daemon reachable?)"

log "Rebooting (seed migration will rebuild the demo workspace) ..."
export PROJECTBASE_PORT="$PORT"
docker compose up -d

log "Seeding superuser (${EMAIL}) ..."
docker compose exec -T projectbase /app/pocketbase superuser upsert "$EMAIL" "$PASSWORD" --dir /app/pb_data

log "Waiting for health ..."
HEALTH_OK=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then HEALTH_OK=1; break; fi
  sleep 2
done
[[ "$HEALTH_OK" -eq 1 ]] || { docker compose logs --tail 50 projectbase; die "health check failed after 120s"; }

TOKEN=$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])') \
  || die "superuser authentication failed"
PROJECTS=$(curl -fsS "http://127.0.0.1:${PORT}/api/collections/projects/records?perPage=1" \
  -H "Authorization: ${TOKEN}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["totalItems"])') \
  || die "projects collection not readable"
[[ "$PROJECTS" -ge 1 ]] || die "demo workspace did not reseed"
log "Demo reset complete — ${PROJECTS} project(s) restored."

if [[ -n "$INSTALL_CRON" ]]; then
  [[ "$INSTALL_CRON" =~ ^[0-9]+$ ]] || die "--install-cron expects an hour interval"
  [[ "$(id -u)" -eq 0 ]] || die "--install-cron requires root (rerun with sudo)"
  CRON_FILE=/etc/cron.d/projectbase-demo-reset
  cat > "$CRON_FILE" <<EOF
# Managed by ProjectBase scripts/reset-demo.sh — safe to delete.
0 */${INSTALL_CRON} * * * root cd ${DIR} && ./scripts/reset-demo.sh --yes >> ${DIR}/reset-demo.log 2>&1
EOF
  chmod 644 "$CRON_FILE"
  log "Installed ${CRON_FILE} (resets every ${INSTALL_CRON}h)."
fi
