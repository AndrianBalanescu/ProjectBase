#!/usr/bin/env bash
set -uo pipefail
cd "/home/ubuntu/flow"
export FLOW_HOME="/home/ubuntu/flow"
export DEBATE_TIMEOUT_SEC="900"
set +e
bash /home/ubuntu/flow/scripts/research/flow-research-run.sh /data/projects/projectbase 1 "What do self-hosters and small teams complain about with Linear, Plane, Taiga, Focalboard, and Height on Reddit, HN, G2 in the last 12 months? Seat pricing anger, migration pain, missing offline/self-host, slow Electron apps, missing features" "Full feature and pricing teardown of Linear vs Plane CE vs Height vs Taiga vs Focalboard 2025-2026: pricing per seat, kanban, sprints/cycles, roadmaps, custom fields, API limits, AI features, self-host licensing" "Open-source Linear alternative architecture: PocketBase + SQLite + zero-build Vue 3 kanban with real-time SSE, SortableJS drag-drop persistence patterns, and REST API schema design for issues, projects, sprints, labels, subtasks"
rc=$?
echo "$rc" > "/data/projects/projectbase/docs/research/jobs/research-cycle-1-20260822-140231/exit.code"
exit "$rc"
