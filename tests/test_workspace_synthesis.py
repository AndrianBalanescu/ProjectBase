"""tests/test_workspace_synthesis.py — Autonomous Workspace Synthesis & Knowledge Retrieval.

Validates Epic 11 features:
1. Unified semantic & full-text workspace knowledge search across issues, comments, telemetry traces, and validation checkpoints.
2. Cross-project blocker detection, dependency alerting, circular deadlock warnings, and critical path analysis.
3. Automated sprint/cycle retrospective generation with velocity metrics, agent productivity breakdown, quality gates, and AI recommendations.
4. FastMCP JSON-RPC 2.0 tool execution for workspace synthesis and knowledge retrieval.
"""

import json
import os
import time
import urllib.parse
import urllib.request
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


def _uid():
    return f"t{int(time.time() * 1000) % 10000000}"


def _request(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw}


def _superuser_token():
    status, res = _request("POST", "/api/collections/_superusers/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    if status == 200 and "token" in res:
        return res["token"]
    status, res = _request("POST", "/api/collections/users/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    assert status == 200, f"Failed superuser login: {res}"
    return res["token"]


def _mcp_call(token, tool_name, arguments=None):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments or {}
        }
    }
    status, body = _request(
        "POST",
        "/api/projectbase/mcp",
        payload,
        {"Authorization": token}
    )
    return status, body


def _create_project(token, name, identifier):
    status, body = _request(
        "POST",
        "/api/collections/projects/records",
        {"name": name, "identifier": identifier.upper(), "color": "#6366f1"},
        {"Authorization": token}
    )
    assert status == 200, f"Project creation failed: {body}"
    return body


def _create_issue(token, project_id, title, description="", status="todo", priority="medium", estimate=1, assignee="", persona=""):
    payload = {
        "project": project_id,
        "title": title,
        "description": description,
        "status": status,
        "priority": priority,
        "estimate": estimate,
        "assignee": assignee,
        "task_persona": persona,
        "relations": []
    }
    status_code, body = _request(
        "POST",
        "/api/collections/issues/records",
        payload,
        {"Authorization": token}
    )
    assert status_code == 200, f"Issue creation failed: {body}"
    return body


def _add_relation(token, issue_id, related_id, rel_type):
    status, body = _request(
        "POST",
        f"/api/projectbase/issues/{issue_id}/relations",
        {"issue": related_id, "type": rel_type},
        {"Authorization": token}
    )
    assert status in (200, 201), f"Relation failed: {body}"
    return body


def _add_comment(token, issue_id, content, author="agent"):
    status, body = _request(
        "POST",
        "/api/collections/comments/records",
        {"issue": issue_id, "content": content, "author": author, "author_type": "agent"},
        {"Authorization": token}
    )
    assert status == 200, f"Comment failed: {body}"
    return body


def _log_telemetry(token, agent_name, event_type, summary, issue_id=None, payload=None):
    body = {
        "agent_name": agent_name,
        "event_type": event_type,
        "summary": summary,
        "issue_id": issue_id,
        "payload": payload or {}
    }
    status, res = _request(
        "POST",
        "/api/projectbase/telemetry",
        body,
        {"Authorization": token}
    )
    assert status in (200, 201), f"Telemetry failed: {res}"
    return res


def _submit_checkpoint(token, issue_id, agent_name, persona, checkpoint_type, status_val, notes):
    body = {
        "issue_id": issue_id,
        "agent_name": agent_name,
        "persona": persona,
        "checkpoint_type": checkpoint_type,
        "status": status_val,
        "notes": notes
    }
    status, res = _request(
        "POST",
        "/api/projectbase/checkpoints/submit",
        body,
        {"Authorization": token}
    )
    assert status in (200, 201), f"Checkpoint failed: {res}"
    return res


# ==============================================================================
# 1. WORKSPACE KNOWLEDGE SEARCH TESTS
# ==============================================================================

def test_workspace_search_requires_auth():
    status, body = _request("GET", "/api/projectbase/workspace/search?q=test")
    assert status == 401


def test_workspace_search_empty_query():
    token = _superuser_token()
    status, body = _request(
        "GET",
        "/api/projectbase/workspace/search?q=",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert status == 200
    assert body["count"] == 0
    assert body["results"] == []


def test_workspace_search_cross_collection():
    token = _superuser_token()
    tag = _uid()
    proj = _create_project(token, f"SearchProj_{tag}", f"SP{tag[:3]}")

    issue = _create_issue(
        token, proj["id"],
        title=f"FTS Index Engine {tag}",
        description=f"High performance vector-free workspace synthesis token_{tag}",
        persona="search_architect"
    )

    _add_comment(token, issue["id"], f"Architectural review note for token_{tag} indexing")
    _log_telemetry(token, f"agent_fts_{tag}", "synthesis_run", f"Executed knowledge synthesis run for token_{tag}", issue_id=issue["id"])
    _submit_checkpoint(token, issue["id"], f"reviewer_{tag}", "qa", "schema_validation", "passed", f"Verified token_{tag} storage layout")

    status, body = _request(
        "GET",
        f"/api/projectbase/workspace/search?q=token_{tag}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert status == 200
    assert body["count"] >= 4
    types = [r["type"] for r in body["results"]]
    assert "issue" in types
    assert "comment" in types
    assert "telemetry" in types
    assert "checkpoint" in types

    issue_hit = next(r for r in body["results"] if r["type"] == "issue")
    assert issue_hit["id"] == issue["id"]
    assert "token_" in issue_hit["snippet"]
    assert issue_hit["score"] > 0


def test_workspace_search_type_filter():
    token = _superuser_token()
    tag = _uid()
    proj = _create_project(token, f"FilterProj_{tag}", f"FP{tag[:3]}")
    issue = _create_issue(token, proj["id"], title=f"FilterTarget_{tag}", description=f"Content filter_{tag}")
    _add_comment(token, issue["id"], f"Comment filter_{tag}")

    status, body = _request(
        "GET",
        f"/api/projectbase/workspace/search?q=filter_{tag}&types=issues",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert status == 200
    assert all(r["type"] == "issue" for r in body["results"])


# ==============================================================================
# 2. CROSS-PROJECT BLOCKER DETECTION & DEPENDENCY ALERTING TESTS
# ==============================================================================

def test_workspace_blockers_requires_auth():
    status, body = _request("GET", "/api/projectbase/workspace/blockers")
    assert status == 401


def test_workspace_blockers_detection_and_cross_project():
    token = _superuser_token()
    tag = _uid()
    proj_a = _create_project(token, f"ProjA_{tag}", f"PA{tag[:3]}")
    proj_b = _create_project(token, f"ProjB_{tag}", f"PB{tag[:3]}")

    # Issue 1 in Proj A blocks Issue 2 in Proj B (cross-project blocker)
    iss1 = _create_issue(token, proj_a["id"], title=f"Core API Provider {tag}", status="in_progress", priority="urgent")
    iss2 = _create_issue(token, proj_b["id"], title=f"Client Consumer {tag}", status="todo", priority="high")
    iss3 = _create_issue(token, proj_b["id"], title=f"UI View {tag}", status="todo", priority="medium")

    _add_relation(token, iss1["id"], iss2["id"], "blocks")
    _add_relation(token, iss2["id"], iss3["id"], "blocks")

    status, body = _request(
        "GET",
        "/api/projectbase/workspace/blockers",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert status == 200
    summary = body["summary"]
    assert summary["total_active_blockers"] >= 2
    assert summary["total_blocked_issues"] >= 2

    direct_blockers = body["direct_blockers"]
    blocker_1 = next((b for b in direct_blockers if b["issue"]["id"] == iss1["id"]), None)
    assert blocker_1 is not None
    assert blocker_1["is_cross_project"] is True
    assert blocker_1["impact_score"] >= 2
    assert len(blocker_1["blocked_issues"]) >= 1

    blocked_issues = body["blocked_issues"]
    blocked_3 = next((b for b in blocked_issues if b["issue"]["id"] == iss3["id"]), None)
    assert blocked_3 is not None
    assert len(blocked_3["unresolved_blockers"]) >= 1


def test_workspace_blockers_circular_cycle_warning():
    token = _superuser_token()
    tag = _uid()
    proj = _create_project(token, f"CycleProj_{tag}", f"CP{tag[:3]}")

    iss_x = _create_issue(token, proj["id"], title=f"Task X {tag}", status="todo")
    iss_y = _create_issue(token, proj["id"], title=f"Task Y {tag}", status="todo")

    # X blocks Y via relation route
    _add_relation(token, iss_x["id"], iss_y["id"], "blocks")

    # Directly patch Y to block X (simulating imported/migrated external cyclic graph)
    _request(
        "PATCH",
        f"/api/collections/issues/records/{iss_y['id']}",
        {"relations": [{"issue": iss_x["id"], "type": "blocks"}]},
        {"Authorization": token}
    )

    status, body = _request(
        "GET",
        "/api/projectbase/workspace/blockers",
        headers={"Authorization": token}
    )
    assert status == 200
    warnings = body.get("circular_warnings", [])
    assert len(warnings) >= 1
    found_cycle = any(iss_x["id"] in w["cycle_ids"] and iss_y["id"] in w["cycle_ids"] for w in warnings)
    assert found_cycle is True


# ==============================================================================
# 3. SPRINT RETROSPECTIVE GENERATION TESTS
# ==============================================================================

def test_workspace_retrospective_requires_auth():
    status, body = _request("GET", "/api/projectbase/workspace/retrospective")
    assert status == 401


def test_workspace_retrospective_metrics_and_synthesis():
    token = _superuser_token()
    tag = _uid()
    proj = _create_project(token, f"RetroProj_{tag}", f"RP{tag[:3]}")

    # Create mixed issues
    _create_issue(token, proj["id"], title=f"Done Issue 1 {tag}", status="done", estimate=5, assignee=f"agent_alpha_{tag}", persona="backend")
    _create_issue(token, proj["id"], title=f"Done Issue 2 {tag}", status="done", estimate=3, assignee=f"agent_alpha_{tag}", persona="backend")
    iss3 = _create_issue(token, proj["id"], title=f"Progress Issue {tag}", status="in_progress", estimate=2, assignee=f"agent_beta_{tag}", persona="frontend")
    _create_issue(token, proj["id"], title=f"Review Issue {tag}", status="in_review", estimate=1, assignee=f"agent_beta_{tag}", persona="frontend")

    _log_telemetry(token, f"agent_alpha_{tag}", "commit", "Delivered core module", issue_id=iss3["id"])
    _submit_checkpoint(token, iss3["id"], f"agent_alpha_{tag}", "reviewer", "peer_review", "passed", "Code quality looks solid")

    status, body = _request(
        "GET",
        f"/api/projectbase/workspace/retrospective?project_id={proj['id']}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert status == 200
    velocity = body["velocity"]
    assert velocity["total_issues"] == 4
    assert velocity["completed_issues"] == 2
    assert velocity["completion_rate_percent"] == 50
    assert velocity["points_delivered"] == 8

    breakdown = body["status_breakdown"]
    assert breakdown["done"] == 2
    assert breakdown["in_progress"] == 1
    assert breakdown["in_review"] == 1

    synth = body["retrospective_synthesis"]
    assert len(synth["highlights"]) > 0
    assert len(synth["recommendations"]) > 0

    agent_stats = body["agent_productivity"]
    alpha_stat = next((a for a in agent_stats if a["agent_name"] == f"agent_alpha_{tag}"), None)
    assert alpha_stat is not None
    assert alpha_stat["completed_tasks"] == 2
    assert alpha_stat["estimate_delivered"] == 8


# ==============================================================================
# 4. FASTMCP JSON-RPC 2.0 TOOLS TESTS
# ==============================================================================

def test_fastmcp_tools_list_contains_workspace_synthesis():
    token = _superuser_token()
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
    status, body = _request("POST", "/api/projectbase/mcp", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    tool_names = [t["name"] for t in body["result"]["tools"]]
    assert "search_workspace_knowledge" in tool_names
    assert "detect_workspace_blockers" in tool_names
    assert "generate_sprint_retrospective" in tool_names


def test_fastmcp_search_workspace_knowledge():
    token = _superuser_token()
    tag = _uid()
    proj = _create_project(token, f"MCPProj_{tag}", f"MP{tag[:3]}")
    _create_issue(token, proj["id"], title=f"MCP Search Topic {tag}", description=f"FastMCP deep search item_{tag}")

    status, body = _mcp_call(token, "search_workspace_knowledge", {"query": f"item_{tag}"})
    assert status == 200
    assert "result" in body
    res_data = json.loads(body["result"]["content"][0]["text"])
    assert res_data["count"] >= 1
    assert res_data["results"][0]["title"] == f"MCP Search Topic {tag}"


def test_fastmcp_detect_workspace_blockers():
    token = _superuser_token()
    status, body = _mcp_call(token, "detect_workspace_blockers", {"include_cross_project": True})
    assert status == 200
    assert "result" in body
    res_data = json.loads(body["result"]["content"][0]["text"])
    assert "summary" in res_data
    assert "direct_blockers" in res_data
    assert "critical_path" in res_data


def test_fastmcp_generate_sprint_retrospective():
    token = _superuser_token()
    status, body = _mcp_call(token, "generate_sprint_retrospective", {})
    assert status == 200
    assert "result" in body
    res_data = json.loads(body["result"]["content"][0]["text"])
    assert "velocity" in res_data
    assert "quality_metrics" in res_data
    assert "retrospective_synthesis" in res_data
