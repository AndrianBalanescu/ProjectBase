#!/usr/bin/env bash
set -uo pipefail
cd "/home/ubuntu/flow"
export FLOW_HOME="/home/ubuntu/flow"
export DEBATE_TIMEOUT_SEC="900"
set +e
bash /home/ubuntu/flow/scripts/research/flow-research-run.sh /data/projects/projectbase 2 "Linear Plane GitHub issue importer CSV JSON migration user workflows what format" "open source issue tracker importer competitor features Linear Plane Height import export" "PocketBase custom route file upload parse CSV JSON pb_hooks reference architecture"
rc=$?
echo "$rc" > "/data/projects/projectbase/docs/research/jobs/research-cycle-2-20260822-144043/exit.code"
exit "$rc"
