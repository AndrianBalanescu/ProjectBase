#!/bin/bash
# ProjectBase 10 E2E Test Suite via iBrowse Homelab
# Runs each test via iBrowse API, waits for completion, and collects findings.

KEY="${IBROWSE_API_KEY:-}"
HOST="${IBROWSE_HOST:-http://homelab:3000}"
BASE="${TARGET_BASE_URL:-http://192.168.1.161:8120}"
LOGIN="Log in to ProjectBase at $BASE with email f@flow.com and password superdev123 first if the login screen is visible."

declare -a NAMES=(
  "01_kanban_board"
  "02_list_view"
  "03_cycles_view"
  "04_projects_view"
  "05_stats_view"
  "06_docs_view"
  "07_milestones_view"
  "08_issue_drawer"
  "09_new_issue_modal"
  "10_header_and_command_palette"
)

declare -a GOALS=(
  "$LOGIN Verify the Kanban board loads properly. Count and report the column lanes (Backlog, Todo, In Progress, In Review, Done). Confirm issue cards are rendered in lanes. Report any console errors or visual glitches."
  "$LOGIN Switch to the List view using the header navigation. Verify the table renders with columns for title, status, priority, and assignee. Report the total issue count displayed and any errors."
  "$LOGIN Switch to the Cycles view from the header. Verify the active/upcoming cycles list renders with sprint metadata and burndown progress indicators. Report findings and any errors."
  "$LOGIN Switch to the Projects view. Verify all projects render with their identifier badges, icons, and metadata. Report the list of visible projects and any errors."
  "$LOGIN Switch to the Stats view. Verify completion rates, issue status breakdowns, and workspace statistics cards render with non-zero values. Report key stats."
  "$LOGIN Switch to the Docs view. Verify the Scalar API documentation UI renders and the OpenAPI specification loads properly. Report if the interactive API docs are functional."
  "$LOGIN Switch to the Milestones view. Verify the roadmap milestones list renders with target dates, progress bars, and linked issues. Report the milestones shown."
  "$LOGIN On the Kanban board, click on any visible issue card to open the Issue Drawer. Verify the slide-out drawer displays title, description, status dropdown, priority dropdown, assignee, and comments section. Report drawer contents."
  "$LOGIN Click the '+ New Issue' button in the top bar. Verify the creation modal opens with inputs for Title, Description, Priority, Assignee, and Project selector. Do NOT submit. Close or dismiss the modal. Report form fields."
  "$LOGIN Inspect the top header bar: verify brand logo/name, project selector dropdown, search bar, all view buttons (Board, List, Cycles, Projects, Stats, Docs, Milestones), and user avatar are visible. Press Ctrl+K (or Cmd+K) to open the Command Palette. Report findings."
)

RESULTS_FILE="/tmp/ibrowse_e2e_results.json"
echo "[]" > "$RESULTS_FILE"

echo "================================================================="
echo " Starting ProjectBase 10 E2E iBrowse Test Suite"
echo " Target: $BASE | iBrowse: $HOST"
echo "================================================================="

for i in "${!NAMES[@]}"; do
  idx=$((i+1))
  name="${NAMES[$i]}"
  goal="${GOALS[$i]}"

  echo ""
  echo "[$idx/10] Starting: $name..."

  body=$(jq -Rn --arg g "$goal" --arg u "$BASE/" '{goal:$g, url:$u, priority:5, timeout_seconds:300}')
  resp=$(curl -s -X POST "$HOST/v1/runs" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "$body")

  jid=$(echo "$resp" | jq -r '.job_id // empty')
  if [ -z "$jid" ]; then
    echo "  FAILED to submit job: $resp"
    continue
  fi

  echo "  Job ID: $jid (waiting for completion)..."

  # Poll until terminal
  waited=0
  status="queued"
  while [[ "$status" == "queued" || "$status" == "running" ]]; do
    sleep 8
    waited=$((waited+8))
    poll=$(curl -s "$HOST/v1/runs/$jid" -H "Authorization: Bearer $KEY")
    status=$(echo "$poll" | jq -r '.status // "unknown"')
    printf "  ... %ds [%s]\r" "$waited" "$status"
    if [ $waited -ge 240 ]; then
      echo "  TIMEOUT after 240s"
      break
    fi
  done
  echo ""

  result_status=$(echo "$poll" | jq -r '.result.status // "none"')
  msg=$(echo "$poll" | jq -r '.result.message // ""')
  err=$(echo "$poll" | jq -r '.result.error // ""')
  steps=$(echo "$poll" | jq -r '.result.steps // 0')
  duration=$(echo "$poll" | jq -r '.result.durationMs // 0')

  echo "  Outcome: status=$status | result=$result_status | steps=$steps | duration=${duration}ms"
  if [ -n "$err" ] && [ "$err" != "null" ]; then
    echo "  Error: $err"
  fi

  # Append result
  entry=$(jq -n \
    --arg idx "$idx" \
    --arg name "$name" \
    --arg jid "$jid" \
    --arg status "$status" \
    --arg result "$result_status" \
    --arg steps "$steps" \
    --arg dur "$duration" \
    --arg msg "$msg" \
    --arg err "$err" \
    '{index: ($idx|tonumber), name: $name, job_id: $jid, status: $status, result: $result, steps: ($steps|tonumber), duration_ms: ($dur|tonumber), message: $msg, error: $err}')

  tmp=$(mktemp)
  jq --argjson e "$entry" '. += [$e]' "$RESULTS_FILE" > "$tmp" && mv "$tmp" "$RESULTS_FILE"
done

echo ""
echo "================================================================="
echo " E2E SUITE FINISHED"
echo "================================================================="
cat "$RESULTS_FILE" | jq -r '.[] | "Test \(.index) [\(.name)]: \(.status) / \(.result) (\(.duration_ms)ms)"'
