#!/usr/bin/env bash
set -uo pipefail
cd "/home/ubuntu/flow"
export FLOW_HOME="/home/ubuntu/flow"
export DEBATE_TIMEOUT_SEC="900"
set +e
bash /home/ubuntu/flow/scripts/research/flow-research-run.sh /data/projects/projectbase 6 "PocketBase self-host demo deployment 2026 best practices reverse proxy TLS docker compose single VPS small RAM" "Linear Plane demo sandbox public trial deployment strategy self-hosted project management 2026" "PocketBase docker healthcheck migrations superuser env PB_SUPERUSER_EMAIL production compose example"
rc=$?
echo "$rc" > "/data/projects/projectbase/docs/research/jobs/research-cycle-6-20260822-191806/exit.code"
exit "$rc"
