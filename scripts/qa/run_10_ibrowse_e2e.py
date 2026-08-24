#!/usr/bin/env python3
"""ProjectBase 10 E2E Test Suite via iBrowse Homelab.
Submits 10 tests, polls for completion, and writes full structured report.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

HOST = "http://127.0.0.1:3000"
KEY = "sk_live_REDACTED_IBROWSE"
BASE = "http://127.0.0.1:8120"
LOGIN = f"Log in to ProjectBase at {BASE} with email f@flow.com and password superdev123 first if the login screen is visible."

TESTS = [
    {
        "id": 1,
        "name": "01_kanban_board",
        "goal": f"{LOGIN} Verify the Kanban board loads properly. Count and report the column lanes (Backlog, Todo, In Progress, In Review, Done). Confirm issue cards are rendered in lanes. Report any console errors or visual glitches.",
    },
    {
        "id": 2,
        "name": "02_list_view",
        "goal": f"{LOGIN} Switch to the List view using the header navigation. Verify the table renders with columns for title, status, priority, and assignee. Report the total issue count displayed and any errors.",
    },
    {
        "id": 3,
        "name": "03_cycles_view",
        "goal": f"{LOGIN} Switch to the Cycles view from the header. Verify the active/upcoming cycles list renders with sprint metadata and burndown progress indicators. Report findings and any errors.",
    },
    {
        "id": 4,
        "name": "04_projects_view",
        "goal": f"{LOGIN} Switch to the Projects view. Verify all projects render with their identifier badges, icons, and metadata. Report the list of visible projects and any errors.",
    },
    {
        "id": 5,
        "name": "05_stats_view",
        "goal": f"{LOGIN} Switch to the Stats view. Verify completion rates, issue status breakdowns, and workspace statistics cards render with non-zero values. Report key stats.",
    },
    {
        "id": 6,
        "name": "06_docs_view",
        "goal": f"{LOGIN} Switch to the Docs view. Verify the Scalar API documentation UI renders and the OpenAPI specification loads properly. Report if the interactive API docs are functional.",
    },
    {
        "id": 7,
        "name": "07_milestones_view",
        "goal": f"{LOGIN} Switch to the Milestones view. Verify the roadmap milestones list renders with target dates, progress bars, and linked issues. Report the milestones shown.",
    },
    {
        "id": 8,
        "name": "08_issue_drawer",
        "goal": f"{LOGIN} On the Kanban board, click on any visible issue card to open the Issue Drawer. Verify the slide-out drawer displays title, description, status dropdown, priority dropdown, assignee, and comments section. Report drawer contents.",
    },
    {
        "id": 9,
        "name": "09_new_issue_modal",
        "goal": f"{LOGIN} Click the '+ New Issue' button in the top bar. Verify the creation modal opens with inputs for Title, Description, Priority, Assignee, and Project selector. Do NOT submit. Close or dismiss the modal. Report form fields.",
    },
    {
        "id": 10,
        "name": "10_header_and_command_palette",
        "goal": f"{LOGIN} Inspect the top header bar: verify brand logo/name, project selector dropdown, search bar, all view buttons (Board, List, Cycles, Projects, Stats, Docs, Milestones), and user avatar are visible. Press Ctrl+K (or Cmd+K) to open the Command Palette. Report findings.",
    },
]

def req(path, method="GET", data=None):
    url = f"{HOST}{path}"
    headers = {"Authorization": f"Bearer {KEY}"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

def main():
    print(f"=== ProjectBase 10 E2E iBrowse Test Suite ===")
    print(f"Target: {BASE} | iBrowse: {HOST}")
    print(f"Submitting {len(TESTS)} tests...\n")

    print("\nRunning tests SEQUENTIALLY (one at a time to avoid browser race conditions)...")
    results = []
    start = time.time()

    for s in TESTS:
        payload = {
            "goal": s["goal"],
            "url": f"{BASE}/",
            "priority": 5,
            "timeout_seconds": 300,
        }
        res = req("/v1/runs", method="POST", data=payload)
        jid = res.get("job_id")
        print(f"[{s['id']}/10] {s['name']}: {jid} ({res.get('status', 'unknown')})")
        if not jid:
            results.append({**s, "job_id": None, "status": "submit_failed"})
            continue

        print(f"  Polling...")
        waited = 0
        final_data = None
        while waited < 300:
            p = req(f"/v1/runs/{jid}")
            st = p.get("status", "unknown")
            if st in ("succeeded", "failed", "blocked", "cancelled", "timeout"):
                final_data = p
                break
            time.sleep(6)
            waited += 6
            print(f"  ... {waited}s [{st}]", end="\r", flush=True)

        if not final_data:
            final_data = req(f"/v1/runs/{jid}")

        st = final_data.get("status", "unknown")
        res_info = final_data.get("result", {})
        res_status = res_info.get("status") if isinstance(res_info, dict) else "unknown"
        steps = res_info.get("steps", 0) if isinstance(res_info, dict) else 0
        dur = res_info.get("durationMs", 0) if isinstance(res_info, dict) else 0
        msg = res_info.get("message", "") if isinstance(res_info, dict) else ""
        err = res_info.get("error", "") if isinstance(res_info, dict) else ""

        print(f"  Result: {st} / {res_status} | {steps} steps | {dur}ms")
        if err:
            print(f"  Error: {err[:200]}")
        if msg:
            first_line = msg.strip().split("\n")[0][:120]
            print(f"  Summary: {first_line}")

        results.append({
            "id": s["id"],
            "name": s["name"],
            "job_id": jid,
            "status": st,
            "result_status": res_status,
            "steps": steps,
            "duration_ms": dur,
            "message": msg,
            "error": err,
        })

    elapsed = int(time.time() - start)
    out_file = "/data/projects/projectbase/docs/qa-ibrowse-10-results.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n=================================================")
    print(f" SUITE FINISHED in {elapsed}s")
    print(f" Report saved: {out_file}")
    print(f"=================================================")
    passed = sum(1 for r in results if r.get("status") == "succeeded" and r.get("result_status") == "done")
    print(f" Passed: {passed}/{len(results)}")

if __name__ == "__main__":
    main()
