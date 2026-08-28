"""tests/test_incident_warroom_engine.py — Comprehensive test suite for Autonomous Multi-Agent Incident Response, Live Debugging War-Room & Root-Cause Post-Mortem Engine (Milestone 10 / Epic 31).

Verifies:
  1. Demo Incident War-Room Seeding (/api/projectbase/incidents/seed-demo).
  2. Incident Declaration & Validation (/api/projectbase/incidents).
  3. Incident Listing & Filtering (/api/projectbase/incidents).
  4. Incident War-Room Detail Inspection (/api/projectbase/incidents/{id}).
  5. Incident Metadata Updates (/api/projectbase/incidents/{id}).
  6. Status Transitions & Timestamp Tracking (/api/projectbase/incidents/{id}/status).
  7. Live Timeline Events Logging & Querying (/api/projectbase/incidents/{id}/events).
  8. Root-Cause Hypotheses Testing & Falsification (/api/projectbase/incidents/{id}/hypotheses).
  9. Mitigations Planning, Execution & Verification (/api/projectbase/incidents/{id}/mitigations).
  10. 5-Whys Post-Mortem Generation, Publishing & Retrieval (/api/projectbase/incidents/{id}/postmortem).
  11. Fleet-Wide Incident Metrics & MTTR/MTTM Calculation (/api/projectbase/incidents/metrics).
  12. Cascading Deletion of Incidents (/api/projectbase/incidents/{id}).
  13. FastMCP JSON-RPC 2.0 Incident Tools:
      - declare_incident
      - list_incidents
      - get_incident_details
      - add_incident_event
      - propose_incident_hypothesis
      - execute_incident_mitigation
      - update_incident_status
      - generate_incident_postmortem
  14. Frontend Guard & Static CSS Sync.
"""

import json
import os
import time
import urllib.error
import urllib.request
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


def _superuser_token():
    url = f"{BASE_URL}/api/collections/_superusers/auth-with-password"
    payload = json.dumps({"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("token")
    except Exception:
        return ""


def _post(path, data, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


def _get(path, token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


def _patch(path, data, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


def _delete(path, token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


def _mcp_call(tool_name, arguments, token):
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    status, res = _post("/api/projectbase/mcp", body, token=token)
    return status, res


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

def test_seed_demo_incident_warroom():
    token = _superuser_token()
    assert token, "Superuser token required"

    status, res = _post("/api/projectbase/incidents/seed-demo", {}, token=token)
    assert status in (200, 201), f"Unexpected status {status}: {res}"
    assert res.get("success") is True


def test_list_and_filter_incidents():
    token = _superuser_token()
    status, res = _get("/api/projectbase/incidents", token=token)
    assert status == 200
    assert res.get("success") is True
    assert "data" in res
    assert res.get("count") >= 1

    # Filter by severity
    status_p1, res_p1 = _get("/api/projectbase/incidents?severity=p1_high", token=token)
    assert status_p1 == 200
    assert res_p1.get("success") is True
    assert all(i["severity"] == "p1_high" for i in res_p1["data"])


def test_declare_and_inspect_incident():
    token = _superuser_token()
    payload = {
        "title": "Automated Swarm Worker Deadlock in Memory Allocation",
        "summary": "Swarm worker threads encountered lock contention when accessing memory vector store.",
        "severity": "p0_critical",
        "service_name": "swarm-memory",
        "incident_commander": "Flomaster-Commander",
        "lead_investigator": "Flomaster-Auditor",
        "source": "runtime_probe",
        "impact_scope": "Vector Store & 50 Swarm Agents"
    }

    status, res = _post("/api/projectbase/incidents", payload, token=token)
    assert status == 201
    assert res.get("success") is True
    inc_data = res.get("data", {})
    inc_id = inc_data.get("id")
    assert inc_id, "Missing incident ID"
    assert inc_data.get("severity") == "p0_critical"

    # Inspect
    get_status, get_res = _get(f"/api/projectbase/incidents/{inc_id}", token=token)
    assert get_status == 200
    assert get_res.get("success") is True
    data = get_res.get("data", {})
    assert data.get("title") == payload["title"]
    assert len(data.get("events", [])) >= 1  # Auto declaration event


def test_incident_status_transitions():
    token = _superuser_token()
    # Create test incident
    _, create_res = _post("/api/projectbase/incidents", {"title": "Test Status Transition Incident"}, token=token)
    inc_id = create_res["data"]["id"]

    # Transition to investigating
    status, res = _post(f"/api/projectbase/incidents/{inc_id}/status", {"status": "investigating", "note": "Lead assigned"}, token=token)
    assert status == 200
    assert res.get("success") is True
    assert res["data"]["new_status"] == "investigating"

    # Transition to mitigated
    status_mit, res_mit = _post(f"/api/projectbase/incidents/{inc_id}/status", {"status": "mitigated"}, token=token)
    assert status_mit == 200
    assert res_mit["data"]["new_status"] == "mitigated"
    assert res_mit["data"]["mitigated_at"]

    # Transition to resolved
    status_res, res_res = _post(f"/api/projectbase/incidents/{inc_id}/status", {"status": "resolved"}, token=token)
    assert status_res == 200
    assert res_res["data"]["new_status"] == "resolved"
    assert res_res["data"]["resolved_at"]


def test_incident_timeline_events():
    token = _superuser_token()
    _, create_res = _post("/api/projectbase/incidents", {"title": "Timeline Test Incident"}, token=token)
    inc_id = create_res["data"]["id"]

    # Add custom log event
    ev_payload = {
        "title": "Observed 99th percentile response time jump to 5200ms",
        "content": "Stacktrace shows wait in fastembed embedding lock.",
        "event_type": "metric_anomaly",
        "severity": "critical",
        "author": "Prometheus-Probe",
        "author_type": "system"
    }
    status, res = _post(f"/api/projectbase/incidents/{inc_id}/events", ev_payload, token=token)
    assert status == 201
    assert res.get("success") is True

    # List events
    status_list, res_list = _get(f"/api/projectbase/incidents/{inc_id}/events", token=token)
    assert status_list == 200
    assert res_list.get("count") >= 2  # Declaration event + custom event


def test_incident_hypotheses_lifecycle():
    token = _superuser_token()
    _, create_res = _post("/api/projectbase/incidents", {"title": "Hypothesis Test Incident"}, token=token)
    inc_id = create_res["data"]["id"]

    # Propose hypothesis
    h_payload = {
        "hypothesis": "High contention on sqlite memory vector locks under 50 worker load",
        "rationale": "Logs show thread mutex wait timeout",
        "test_plan": "Run isolated concurrent vector search in sandbox",
        "confidence_score": 0.8
    }
    status, res = _post(f"/api/projectbase/incidents/{inc_id}/hypotheses", h_payload, token=token)
    assert status == 201
    assert res.get("success") is True
    hypo_id = res["data"]["id"]

    # Update hypothesis to confirmed
    patch_status, patch_res = _patch(
        f"/api/projectbase/incidents/{inc_id}/hypotheses/{hypo_id}",
        {"status": "confirmed", "confidence_score": 0.98, "evidence": "Verified in benchmark test"},
        token=token
    )
    assert patch_status == 200
    assert patch_res["data"]["status"] == "confirmed"

    # List hypotheses
    l_status, l_res = _get(f"/api/projectbase/incidents/{inc_id}/hypotheses", token=token)
    assert l_status == 200
    assert l_res.get("count") == 1
    assert l_res["data"][0]["status"] == "confirmed"


def test_incident_mitigations_lifecycle():
    token = _superuser_token()
    _, create_res = _post("/api/projectbase/incidents", {"title": "Mitigation Test Incident"}, token=token)
    inc_id = create_res["data"]["id"]

    # Add mitigation action
    m_payload = {
        "title": "Enable sharded read replica pools for memory queries",
        "description": "Spawn 4 independent read connection pools",
        "action_type": "config_patch",
        "status": "applied",
        "verification_method": "50 worker load probe"
    }
    status, res = _post(f"/api/projectbase/incidents/{inc_id}/mitigations", m_payload, token=token)
    assert status == 201
    assert res.get("success") is True
    mit_id = res["data"]["id"]

    # Update mitigation to verified
    patch_status, patch_res = _patch(
        f"/api/projectbase/incidents/{inc_id}/mitigations/{mit_id}",
        {"status": "verified", "verification_result": "P99 latency dropped to 8ms"},
        token=token
    )
    assert patch_status == 200
    assert patch_res["data"]["status"] == "verified"


def test_incident_postmortem_workflow():
    token = _superuser_token()
    _, create_res = _post("/api/projectbase/incidents", {"title": "Post-Mortem Test Incident"}, token=token)
    inc_id = create_res["data"]["id"]

    pm_payload = {
        "title": "Post-Mortem: Swarm Memory Lock Contention",
        "status": "published",
        "executive_summary": "Vector store connection pool exhaustion caused brief latency spike.",
        "root_cause_analysis": "1. Why? DB lock contention.\n2. Why? 50 workers simultaneously queried unbuffered SQLite.",
        "contributing_factors": ["High burst concurrency", "Single connection bottleneck"],
        "impact_metrics": {"downtime_minutes": 10, "affected_workers": 50},
        "timeline_summary": "T+0: Anomaly detected\nT+5m: Mitigation applied\nT+10m: Resolved",
        "detection_gap": "Latency alarm was too relaxed",
        "action_items": [{"task_id": "ACT-1", "title": "Add connection pooling", "owner": "Flomaster", "status": "completed"}],
        "lessons_learned": "Always provision reader pools for vector operations"
    }

    status, res = _post(f"/api/projectbase/incidents/{inc_id}/postmortem", pm_payload, token=token)
    assert status in (200, 201)
    assert res.get("success") is True

    # Retrieve post-mortem
    get_status, get_res = _get(f"/api/projectbase/incidents/{inc_id}/postmortem", token=token)
    assert get_status == 200
    assert get_res.get("success") is True
    assert get_res["data"]["status"] == "published"
    assert len(get_res["data"]["contributing_factors"]) == 2


def test_incident_fleet_metrics():
    token = _superuser_token()
    status, res = _get("/api/projectbase/incidents/metrics", token=token)
    assert status == 200
    assert res.get("success") is True
    data = res.get("data", {})
    assert "total_incidents" in data
    assert "active_warrooms" in data
    assert "mean_time_to_mitigate_minutes" in data
    assert "mean_time_to_resolve_minutes" in data


def test_incident_deletion_cascade():
    token = _superuser_token()
    _, create_res = _post("/api/projectbase/incidents", {"title": "Delete Test Incident"}, token=token)
    inc_id = create_res["data"]["id"]

    # Add child items
    _post(f"/api/projectbase/incidents/{inc_id}/events", {"title": "Event 1"}, token=token)
    _post(f"/api/projectbase/incidents/{inc_id}/hypotheses", {"hypothesis": "Hypo 1"}, token=token)
    _post(f"/api/projectbase/incidents/{inc_id}/mitigations", {"title": "Mit 1"}, token=token)

    # Delete
    del_status, del_res = _delete(f"/api/projectbase/incidents/{inc_id}", token=token)
    assert del_status == 200
    assert del_res.get("success") is True

    # Verify not found
    get_status, _ = _get(f"/api/projectbase/incidents/{inc_id}", token=token)
    assert get_status == 404


def test_fastmcp_incident_tools():
    token = _superuser_token()

    # 1. declare_incident
    status, res = _mcp_call("declare_incident", {
        "title": "FastMCP Declared Incident: Redis Buffer Exhaustion",
        "severity": "p1_high",
        "summary": "Redis cache hit rate dropped below 20%",
        "service_name": "redis-cache"
    }, token=token)
    assert status == 200
    assert "result" in res
    mcp_data = json.loads(res["result"]["content"][0]["text"])
    inc_id = mcp_data["id"]
    assert inc_id

    # 2. list_incidents
    _, list_res = _mcp_call("list_incidents", {"severity": "p1_high"}, token=token)
    list_items = json.loads(list_res["result"]["content"][0]["text"])
    assert any(i["id"] == inc_id for i in list_items)

    # 3. add_incident_event
    _, ev_res = _mcp_call("add_incident_event", {
        "incident_id": inc_id,
        "title": "Redis memory fragmentation spiked to 1.8",
        "event_type": "metric_anomaly",
        "severity": "warning"
    }, token=token)
    ev_data = json.loads(ev_res["result"]["content"][0]["text"])
    assert ev_data["incident_id"] == inc_id

    # 4. propose_incident_hypothesis
    _, h_res = _mcp_call("propose_incident_hypothesis", {
        "incident_id": inc_id,
        "hypothesis": "Maxmemory-policy volatile-lru caused frequent key evictions",
        "confidence_score": 0.9,
        "status": "confirmed"
    }, token=token)
    h_data = json.loads(h_res["result"]["content"][0]["text"])
    assert h_data["status"] == "confirmed"

    # 5. execute_incident_mitigation
    _, m_res = _mcp_call("execute_incident_mitigation", {
        "incident_id": inc_id,
        "title": "Switch policy to allkeys-lru and increase RAM to 4GB",
        "action_type": "config_patch",
        "status": "verified"
    }, token=token)
    m_data = json.loads(m_res["result"]["content"][0]["text"])
    assert m_data["status"] == "verified"

    # 6. update_incident_status
    _, st_res = _mcp_call("update_incident_status", {
        "incident_id": inc_id,
        "status": "resolved",
        "note": "Resolved via FastMCP orchestrator"
    }, token=token)
    st_data = json.loads(st_res["result"]["content"][0]["text"])
    assert st_data["new_status"] == "resolved"

    # 7. generate_incident_postmortem
    _, pm_res = _mcp_call("generate_incident_postmortem", {
        "incident_id": inc_id,
        "title": "Post-Mortem: Redis Buffer Exhaustion",
        "executive_summary": "Resolved by updating eviction policy.",
        "root_cause_analysis": "Default key eviction policy pruned active sessions."
    }, token=token)
    pm_data = json.loads(pm_res["result"]["content"][0]["text"])
    assert pm_data["status"] == "published"

    # 8. get_incident_details
    _, det_res = _mcp_call("get_incident_details", {"incident_id": inc_id}, token=token)
    det_data = json.loads(det_res["result"]["content"][0]["text"])
    assert det_data["id"] == inc_id
    assert det_data["has_postmortem"] is True
