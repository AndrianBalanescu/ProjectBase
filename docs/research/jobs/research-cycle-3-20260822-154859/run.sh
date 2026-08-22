#!/usr/bin/env bash
set -uo pipefail
cd "/home/ubuntu/flow"
export FLOW_HOME="/home/ubuntu/flow"
export DEBATE_TIMEOUT_SEC="900"
set +e
bash /home/ubuntu/flow/scripts/research/flow-research-run.sh /data/projects/projectbase 3 "GitHub REST API import issues automation python pocketbase 2026 latest best practices pagination" "GitHub API rate limiting webhooks fine-grained tokens best practices 2026" "PocketBase Goja pb_hooks outgoing HTTP fetch request external API javascript"
rc=$?
echo "$rc" > "/data/projects/projectbase/docs/research/jobs/research-cycle-3-20260822-154859/exit.code"
exit "$rc"
