#!/usr/bin/env bash
# ProjectBase — one-command public demo deployment (Docker).
#
# Provisions a fresh Ubuntu/Debian VPS with the ProjectBase demo:
#   docker compose up + superuser seed + health/seed verification.
#
# Usage:
#   ./scripts/deploy-demo.sh [--port 8120] [--email f@flow.com] [--password superdev123]
#                            [--domain demo.example.com] [--install-docker] [--yes]
#
# Environment overrides: PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD, PROJECTBASE_PORT.
#
# With --domain, an additional Caddy container terminates TLS (Let's Encrypt) on
# 80/443 and reverse-proxies to the app (docker-compose.demo.yml override).

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PORT="${PROJECTBASE_PORT:-8120}"
EMAIL="${PB_SUPERUSER_EMAIL:-f@flow.com}"
PASSWORD="${PB_SUPERUSER_PASSWORD:-superdev123}"
DOMAIN=""
INSTALL_DOCKER=0
ASSUME_YES=0

log()  { echo ">>> [deploy-demo] $*"; }
die()  { echo "!!! [deploy-demo] $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)           PORT="$2"; shift 2 ;;
    --email)          EMAIL="$2"; shift 2 ;;
    --password)       PASSWORD="$2"; shift 2 ;;
    --domain)         DOMAIN="$2"; shift 2 ;;
    --install-docker) INSTALL_DOCKER=1; shift ;;
    --yes|-y)         ASSUME_YES=1; shift ;;
    -h|--help)        sed -n '2,15p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ "$PORT" =~ ^[0-9]+$ ]] || die "--port must be numeric"
[[ -f docker-compose.yml ]] || die "run from a ProjectBase checkout (docker-compose.yml missing)"

# --- Preflight -------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  if [[ "$INSTALL_DOCKER" -eq 1 ]]; then
    log "Docker not found — installing via get.docker.com"
    curl -fsSL https://get.docker.com | sh
  else
    die "docker not found. Re-run with --install-docker or install Docker first."
  fi
fi
if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin not available. Install the docker-compose-plugin package."
fi
if docker compose ps -q projectbase >/dev/null 2>&1 && [[ -n "$(docker compose ps -q projectbase)" ]]; then
  if [[ "$ASSUME_YES" -ne 1 ]]; then
    read -r -p "A ProjectBase stack is already running in $(pwd). Redeploy over it? [y/N] " ans
    [[ "${ans,,}" == "y" ]] || die "aborted by user"
  fi
fi

# --- Build & boot ----------------------------------------------------------
export PROJECTBASE_PORT="$PORT"
log "Building + starting ProjectBase on host port ${PORT} ..."
if [[ -n "$DOMAIN" ]]; then
  DEMO_DOMAIN="$DOMAIN" docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
else
  docker compose up -d --build
fi

# --- Superuser -------------------------------------------------------------
log "Seeding superuser (${EMAIL}) ..."
# The container serves --dir /app/app/pb_data (see Dockerfile). Seed into the
# SAME data dir the app reads so superuser auth succeeds post-deploy.
docker compose exec -T projectbase /app/pocketbase superuser upsert "$EMAIL" "$PASSWORD" --dir /app/app/pb_data

# --- Health + seed verification --------------------------------------------
log "Waiting for /api/health ..."
HEALTH_OK=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then HEALTH_OK=1; break; fi
  sleep 2
done
[[ "$HEALTH_OK" -eq 1 ]] || { docker compose logs --tail 50 projectbase; die "health check failed after 120s"; }

log "Verifying migrations ran and demo workspace is seeded ..."
TOKEN=$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])') \
  || die "superuser authentication failed"
PROJECTS=$(curl -fsS "http://127.0.0.1:${PORT}/api/collections/projects/records?perPage=1" \
  -H "Authorization: ${TOKEN}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["totalItems"])') \
  || die "projects collection not readable — migrations may have failed"
[[ "$PROJECTS" -ge 1 ]] || die "no projects seeded — fresh-boot seed migration failed"

log "Demo deployed and verified."
echo
echo "    App:      http://<this-host>:${PORT}/"
[[ -n "$DOMAIN" ]] && echo "    TLS:      https://${DOMAIN}/"
echo "    Admin:    http://<this-host>:${PORT}/_/ (superuser: ${EMAIL})"
echo "    Reset:    ./scripts/reset-demo.sh   (restores pristine demo workspace)"
[[ -n "$DOMAIN" ]] && echo "    Auto TLS: Caddy is terminating HTTPS for ${DOMAIN} (ports 80/443)"
echo
