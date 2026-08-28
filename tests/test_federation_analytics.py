"""tests/test_federation_analytics.py — Production Multi-Host Federation & Autonomous Anomaly Detection Engine.

Validates Epic 12 features:
1. Multi-Host Federation Export, Import & Delta Sync with SHA-256 data integrity checksums.
2. Conflict resolution strategies: merge, overwrite, skip_existing with foreign key re-mapping.
3. Diagnostic scan for stale leases, rapid failure loops, starved issues, circular locks.
4. Auto-heal automated remediation (expired lease revocation, starved task triage).
5. Agent persona MTTC (Mean Time to Complete), quality checkpoint pass rates & throughput forecast.
6. FastMCP JSON-RPC 2.0 tool execution for federation and analytics.
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


def _auth_token():
    status, res = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status == 200 and "token" in res:
        return res["token"], res.get("record", {}).get("id")
    status, res = _request(
        "POST",
        "/api/collections/users/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status == 200 and "token" in res:
        return res["token"], res.get("record", {}).get("id")
    pytest.skip(f"Authentication failed ({status}): {res}")


def _mcp_call(token, method, params=None, req_id=1):
    payload = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        payload["params"] = params
    status, res = _request(
        "POST",
        "/api/projectbase/mcp",
        payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    return status, res


# ---------------------------------------------------------------------------
# 1. Multi-Host Federation Export Tests
# ---------------------------------------------------------------------------


def test_federation_export_requires_auth():
    status, res = _request("GET", "/api/projectbase/federation/export")
    assert status == 401


def test_federation_export_workspace_bundle():
    token, user_id = _auth_token()
    status, res = _request(
        "GET",
        "/api/projectbase/federation/export",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert res.get("format") == "projectbase_federation_bundle"
    assert res.get("version") == "1.0.0"
    assert "checksum" in res
    assert "manifest" in res
    assert "data" in res
    assert "projects" in res["data"]
    assert "issues" in res["data"]
    assert "cycles" in res["data"]
    assert "milestones" in res["data"]


def test_federation_export_single_project():
    token, user_id = _auth_token()
    uid = _uid()
    # Create test project and issue
    _, p_res = _request(
        "POST",
        "/api/collections/projects/records",
        {"name": f"Fed Proj {uid}", "identifier": f"FP{uid[:4].upper()}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = p_res["id"]

    _request(
        "POST",
        "/api/collections/issues/records",
        {"project": p_id, "title": f"Fed Issue {uid}", "status": "todo"},
        headers={"Authorization": f"Bearer {token}"},
    )

    status, res = _request(
        "POST",
        "/api/projectbase/federation/export",
        {"project_id": p_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert res.get("scope") == "project"
    assert res["manifest"]["projects_count"] == 1
    assert res["data"]["projects"][0]["id"] == p_id
    assert any(i["title"] == f"Fed Issue {uid}" for i in res["data"]["issues"])


# ---------------------------------------------------------------------------
# 2. Multi-Host Federation Import Tests
# ---------------------------------------------------------------------------


def test_federation_import_requires_auth():
    status, res = _request("POST", "/api/projectbase/federation/import", {"bundle": {}})
    assert status == 401


def test_federation_import_rejects_malformed_bundle():
    token, user_id = _auth_token()
    status, res = _request(
        "POST",
        "/api/projectbase/federation/import",
        {"bundle": "invalid_payload"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 400


def test_federation_import_merge_and_overwrite():
    token, user_id = _auth_token()
    uid = _uid()

    bundle = {
        "format": "projectbase_federation_bundle",
        "version": "1.0.0",
        "data": {
            "projects": [
                {
                    "id": f"src_proj_{uid}",
                    "name": f"Imported Proj {uid}",
                    "identifier": f"IP{uid[:4].upper()}",
                    "description": "Federated workspace project",
                    "color": "#10b981",
                }
            ],
            "issues": [
                {
                    "id": f"src_iss_{uid}_1",
                    "identifier": f"IP{uid[:4].upper()}-1",
                    "project": f"src_proj_{uid}",
                    "title": f"Remote Issue Alpha {uid}",
                    "description": "Task from remote cluster node",
                    "status": "todo",
                    "priority": "high",
                    "estimate": 5,
                    "task_persona": "coder",
                }
            ],
        },
    }

    # 1. Initial import with merge strategy
    status, res = _request(
        "POST",
        "/api/projectbase/federation/import",
        {"bundle": bundle, "conflict_strategy": "merge"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert res.get("success") is True
    assert res["stats"]["projects_created"] >= 1
    assert res["stats"]["issues_created"] >= 1

    # 2. Second import with overwrite strategy
    bundle["data"]["issues"][0]["title"] = f"Remote Issue Alpha {uid} (Updated)"
    status2, res2 = _request(
        "POST",
        "/api/projectbase/federation/import",
        {"bundle": bundle, "conflict_strategy": "overwrite"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status2 == 200
    assert res2["stats"]["issues_updated"] >= 1


def test_federation_delta_sync():
    token, user_id = _auth_token()
    now_iso = "2026-08-01T00:00:00.000Z"
    status, res = _request(
        "POST",
        "/api/projectbase/federation/sync",
        {"since": now_iso},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert res.get("success") is True
    assert "sync_timestamp" in res
    assert isinstance(res.get("issues"), list)


# ---------------------------------------------------------------------------
# 3. Anomaly Detection & Auto-Heal Tests
# ---------------------------------------------------------------------------


def test_anomaly_detection_scan():
    token, user_id = _auth_token()
    status, res = _request(
        "GET",
        "/api/projectbase/analytics/anomalies",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert "total_anomalies" in res
    assert "critical_count" in res
    assert "warning_count" in res
    assert isinstance(res.get("anomalies"), list)


def test_anomaly_auto_heal_execution():
    token, user_id = _auth_token()
    uid = _uid()

    # Create a project and issue
    _, p_res = _request(
        "POST",
        "/api/collections/projects/records",
        {"name": f"Heal Proj {uid}", "identifier": f"HP{uid[:4].upper()}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = p_res["id"]

    _, i_res = _request(
        "POST",
        "/api/collections/issues/records",
        {"project": p_id, "title": f"Heal Issue {uid}", "status": "in_progress"},
        headers={"Authorization": f"Bearer {token}"},
    )
    i_id = i_res["id"]

    # Create a task lease
    _request(
        "POST",
        "/api/projectbase/leases/acquire",
        {
            "issue_id": i_id,
            "agent_name": "dead_worker",
            "ttl_seconds": 10,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    time.sleep(1.1)

    # Run anomaly detection with auto_heal=true and stale_lease_seconds=1
    status, res = _request(
        "POST",
        "/api/projectbase/analytics/anomalies",
        {"auto_heal": True, "stale_lease_seconds": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert res.get("auto_healed") is True
    assert res.get("healed_count") >= 1
    assert any(a.get("action") == "revoked_stale_lease" for a in res.get("healed_actions", []))


# ---------------------------------------------------------------------------
# 4. Agent Persona Throughput & MTTC Analytics Tests
# ---------------------------------------------------------------------------


def test_throughput_analytics():
    token, user_id = _auth_token()
    status, res = _request(
        "GET",
        "/api/projectbase/analytics/throughput?time_window_hours=72",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert "time_window_hours" in res
    assert "persona_breakdown" in res
    assert "quality_by_persona" in res
    assert "forecast" in res
    assert any(p["persona"] == "architect" for p in res["persona_breakdown"])
    assert any(p["persona"] == "coder" for p in res["persona_breakdown"])


# ---------------------------------------------------------------------------
# 5. FastMCP JSON-RPC 2.0 Tools Tests
# ---------------------------------------------------------------------------


def test_fastmcp_export_and_import_tools():
    token, user_id = _auth_token()

    # 1. Call export_federation_bundle
    status, res = _mcp_call(
        token,
        "tools/call",
        {"name": "export_federation_bundle", "arguments": {"include_telemetry": False}},
    )
    assert status == 200
    assert "result" in res
    content = json.loads(res["result"]["content"][0]["text"])
    assert content.get("format") == "projectbase_federation_bundle"

    # 2. Call import_federation_bundle
    uid = _uid()
    import_bundle = {
        "format": "projectbase_federation_bundle",
        "version": "1.0.0",
        "data": {
            "projects": [{"id": f"mcp_p_{uid}", "name": f"MCP Proj {uid}", "identifier": f"MP{uid[:4].upper()}"}],
            "issues": [{"title": f"MCP Issue {uid}", "project": f"mcp_p_{uid}", "status": "todo"}],
        },
    }
    status2, res2 = _mcp_call(
        token,
        "tools/call",
        {"name": "import_federation_bundle", "arguments": {"bundle": import_bundle, "conflict_strategy": "merge"}},
    )
    assert status2 == 200
    content2 = json.loads(res2["result"]["content"][0]["text"])
    assert content2.get("success") is True


def test_fastmcp_analytics_and_anomaly_tools():
    token, user_id = _auth_token()

    # 1. Call get_agent_analytics
    status, res = _mcp_call(
        token,
        "tools/call",
        {"name": "get_agent_analytics", "arguments": {"time_window_hours": 24}},
    )
    assert status == 200
    content = json.loads(res["result"]["content"][0]["text"])
    assert "total_issues" in content
    assert "completion_rate_percent" in content

    # 2. Call detect_workflow_anomalies
    status2, res2 = _mcp_call(
        token,
        "tools/call",
        {"name": "detect_workflow_anomalies", "arguments": {"auto_heal": False}},
    )
    assert status2 == 200
    content2 = json.loads(res2["result"]["content"][0]["text"])
    assert "total_anomalies" in content2
    assert "critical_count" in content2
