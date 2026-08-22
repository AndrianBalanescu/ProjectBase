#!/usr/bin/env bash
set -uo pipefail
cd "/home/ubuntu/flow"
export FLOW_HOME="/home/ubuntu/flow"
export DEBATE_TIMEOUT_SEC="900"
set +e
bash /home/ubuntu/flow/scripts/debate/flow-debate-run.sh /data/projects/projectbase 1 "For ProjectBase cycles 2-4, build order should be A) importers for Linear/Plane/GitHub migrants first, B) keyboard command palette UX first, C) custom fields first; and the current PocketBase schema needs no rework yet" --paid --context-file /tmp/flow-debate-context-cycle-1.md
rc=$?
echo "$rc" > "/data/projects/projectbase/docs/research/jobs/debate-cycle-1-20260822-142908/exit.code"
exit "$rc"
