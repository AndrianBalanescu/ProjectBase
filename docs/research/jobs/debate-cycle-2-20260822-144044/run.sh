#!/usr/bin/env bash
set -uo pipefail
cd "/home/ubuntu/flow"
export FLOW_HOME="/home/ubuntu/flow"
export DEBATE_TIMEOUT_SEC="900"
set +e
bash /home/ubuntu/flow/scripts/debate/flow-debate-run.sh /data/projects/projectbase 2 "For ProjectBase cycle 2, should we ship flat-file importers (Linear CSV/JSON) and the keyboard command palette in parallel, defer GitHub API importer to cycle 3, defer custom fields, and keep the current PocketBase schema with only an additive source_metadata JSON field" --paid --context-file /tmp/flow-debate-context-cycle-2.md
rc=$?
echo "$rc" > "/data/projects/projectbase/docs/research/jobs/debate-cycle-2-20260822-144044/exit.code"
exit "$rc"
