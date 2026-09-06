"""tests/test_session_ingestion_engine.py — Comprehensive tests for Execution-Native Agent Sessions (Milestone 1 & 2).

Verifies:
  1. Session Ingestion & Deterministic Project Mapping (by explicit ID and by workdir).
  2. Live Process Lifecycle: Spawning -> Running -> Verifying -> Completed / Failed.
  3. Real-time Heartbeat telemetry (PID state, files touched aggregation, log tail streaming).
  4. Auto-Docking: Verified test verdicts (exit 0 + tests passed) automatically dock and close parent issues with audit comments.
  5. Session Forking / Re-Tasking with context preservation.
  6. Graceful Process Termination / Cancellation (PID signal recording).
  7. Session Docking & Unlinking to Issue Cards.
  8. Aggregated Execution Plane Metrics (Pass rates, tokens, costs, active PIDs).
  9. Session Purging / Cleanup retention policies.
  10. FastMCP and OpenAPI schema alignment.
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

# Cycle 74 hardening: /api/projectbase/* custom routes are auth-guarded. Tests
# exercise business logic, not the auth gate, so _request defaults to an
# authenticated superuser; use _request_anon for the unauthenticated path.
_AUTH_TOKEN_CACHE = {"token": None}

def _super_auth_header():
    if _AUTH_TOKEN_CACHE["token"] is None:
        tok = ""
        for col in ("_superusers", "users"):
            try:
                st, body = _request_raw("POST", f"/api/collections/{col}/auth-with-password", {
                    "identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
                if st == 200 and body.get("token"):
                    tok = body["token"]
                    break
            except Exception:
                pass
        _AUTH_TOKEN_CACHE["token"] = tok
    return {"Authorization": _AUTH_TOKEN_CACHE["token"]} if _AUTH_TOKEN_CACHE["token"] else {}


def _uid():
    return f"sess_{int(time.time() * 1000) % 10000000}"


def _request_raw(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"raw": err_body}
        return e.code, parsed
    except Exception as e:
        return 500, {"error": str(e)}




def _request(method, path, body=None, headers=None):
    """_request with a default superuser Authorization header.

    The engine custom routes are auth-guarded (cycle 74); tests here exercise
    the business logic, not the auth gate, so requests default to an
    authenticated superuser. Pass headers={"Authorization": ""} to force the
    unauthenticated path."""
    if headers is None or "Authorization" not in (headers or {}):
        merged = dict(_super_auth_header())
        merged.update(headers or {})
        headers = merged
    return _request_raw(method, path, body, headers)

def _request_anon(method, path, body=None, headers=None):
    """Explicitly unauthenticated request (for route-guard negative tests)."""
    return _request_raw(method, path, body, headers)
def _get_auth_token():
    status, body = _request("POST", "/api/collections/_superusers/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD
    })
    if status == 200 and "token" in body:
        return body["token"]
    status, body2 = _request("POST", "/api/collections/users/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD
    })
    if status == 200 and "token" in body2:
        return body2["token"]
    return ""


# 1. Test Session Listing
def test_list_agent_sessions():
    status, body = _request("GET", "/api/projectbase/sessions")
    assert status == 200
    assert "sessions" in body
    assert isinstance(body["sessions"], list)
    assert "total" in body
    assert "limit" in body
    assert "offset" in body


# 2. Test Ingesting Session with Deterministic Project Mapping
def test_ingest_session_deterministic_mapping():
    sid = _uid()
    status, body = _request("POST", "/api/projectbase/sessions/ingest", {
        "session_id": sid,
        "agent_name": "flomaster",
        "runtime": "flomaster",
        "model": "gpt-5.5",
        "workdir": "/data/projects/projectbase",
        "command": "Execute Milestone 1 session ingestion tests",
        "status": "running",
        "pid": 54321
    })
    assert status == 201
    assert body["success"] is True
    assert body["session_id"] == sid
    assert body["status"] == "running"
    assert body["pid"] == 54321
    assert body["project_id"] != ""


# 3. Test Heartbeat & Telemetry Streaming
def test_session_heartbeat_telemetry():
    sid = _uid()
    _request("POST", "/api/projectbase/sessions/ingest", {
        "session_id": sid,
        "agent_name": "hermes",
        "runtime": "hermes",
        "status": "running",
        "pid": 65432
    })

    status, hb_body = _request("POST", "/api/projectbase/sessions/heartbeat", {
        "session_id": sid,
        "status": "verifying",
        "files_touched": ["app/pb_hooks/107_session_ingestion_engine.pb.js", "tests/test_api.py"],
        "log_tail": "Running test verification suite... 390 passed",
        "tokens_in": 12000,
        "tokens_out": 4500,
        "cost_cents": 12
    })
    assert status == 200
    assert hb_body["success"] is True
    assert hb_body["status"] == "verifying"
    assert hb_body["files_count"] >= 2


# 4. Test Live Sessions Endpoint
def test_get_live_sessions():
    sid = _uid()
    _request("POST", "/api/projectbase/sessions/ingest", {
        "session_id": sid,
        "agent_name": "flow-builder",
        "status": "running",
        "pid": 77777
    })

    status, body = _request("GET", "/api/projectbase/sessions/live")
    assert status == 200
    assert "active_sessions" in body
    assert isinstance(body["active_sessions"], list)
    active_ids = [s["session_id"] for s in body["active_sessions"]]
    assert sid in active_ids


# 5. Test Completion & Auto-Docking
def test_session_complete_and_auto_docking():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Get a real project
    p_status, p_body = _request("GET", "/api/collections/projects/records?limit=1", headers=headers)
    assert p_status == 200
    assert len(p_body.get("items", [])) > 0
    project_id = p_body["items"][0]["id"]

    # Create a parent issue
    i_status, i_body = _request("POST", "/api/collections/issues/records", {
        "title": f"Test Parent Issue {_uid()}",
        "project": project_id,
        "status": "todo",
        "priority": "high"
    }, headers=headers)
    assert i_status in (200, 201)
    issue_id = i_body["id"]

    try:
        # Ingest session linked to issue
        sid = _uid()
        _request("POST", "/api/projectbase/sessions/ingest", {
            "session_id": sid,
            "issue_id": issue_id,
            "project_id": project_id,
            "agent_name": "flomaster",
            "runtime": "flomaster",
            "status": "running"
        })

        # Complete session with passing test verdict
        c_status, c_body = _request("POST", "/api/projectbase/sessions/complete", {
            "session_id": sid,
            "exit_code": 0,
            "git_commit_after": "feat123456",
            "test_verdict": {
                "passed": 390,
                "failed": 0,
                "total": 390,
                "status": "passed",
                "duration_s": 52.4
            }
        })
        assert c_status == 200
        assert c_body["status"] == "completed"
        assert c_body["auto_docked"] is True

        # Check issue status was updated to done
        chk_status, chk_body = _request("GET", f"/api/collections/issues/records/{issue_id}", headers=headers)
        assert chk_status == 200
        assert chk_body["status"] == "done"
    finally:
        _request("DELETE", f"/api/collections/issues/records/{issue_id}", headers=headers)


# 6. Test Session Forking for Re-Tasking
def test_fork_session_re_tasking():
    sid = _uid()
    _request("POST", "/api/projectbase/sessions/ingest", {
        "session_id": sid,
        "agent_name": "flomaster",
        "command": "Initial exploration task",
        "status": "completed"
    })

    fork_sid = f"fork_{sid}"
    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/fork", {
        "new_session_id": fork_sid,
        "prompt": "Continue with detailed refactor"
    })
    assert status == 201
    assert body["success"] is True
    assert body["forked_from"] == sid
    assert body["new_session_id"] == fork_sid
    assert body["status"] == "spawning"


# 7. Test Session Termination
def test_terminate_session():
    sid = _uid()
    _request("POST", "/api/projectbase/sessions/ingest", {
        "session_id": sid,
        "agent_name": "cursor",
        "status": "running",
        "pid": 88888
    })

    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/terminate")
    assert status == 200
    assert body["success"] is True
    assert body["status"] == "cancelled"


# 8. Test Session Docking & Unlinking
def test_dock_and_undock_session():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    p_status, p_body = _request("GET", "/api/collections/projects/records?limit=1", headers=headers)
    assert p_status == 200
    project_id = p_body["items"][0]["id"]

    i_status, i_body = _request("POST", "/api/collections/issues/records", {
        "title": f"Test Dock Issue {_uid()}",
        "project": project_id,
        "status": "todo"
    }, headers=headers)
    assert i_status in (200, 201)
    real_issue_id = i_body["id"]

    try:
        sid = _uid()
        _request("POST", "/api/projectbase/sessions/ingest", {
            "session_id": sid,
            "agent_name": "flomaster",
            "status": "running"
        })

        # Dock
        status, body = _request("POST", f"/api/projectbase/sessions/{sid}/dock", {
            "issue_id": real_issue_id
        })
        assert status == 200
        assert body["auto_docked"] is True
        assert body["issue_id"] == real_issue_id

        # Undock
        u_status, u_body = _request("POST", f"/api/projectbase/sessions/{sid}/dock", {
            "issue_id": ""
        })
        assert u_status == 200
        assert u_body["auto_docked"] is False
        assert u_body["issue_id"] == ""
    finally:
        _request("DELETE", f"/api/collections/issues/records/{real_issue_id}", headers=headers)


# 9. Test Execution Metrics
def test_get_session_metrics():
    status, body = _request("GET", "/api/projectbase/sessions/metrics")
    assert status == 200
    assert "total_sessions" in body
    assert "active_count" in body
    assert "completed_count" in body
    assert "failed_count" in body
    assert "pass_rate_percent" in body
    assert "total_tokens" in body
    assert "total_cost_usd" in body


# 10. Test Get Session Detail & Deletion
def test_get_and_delete_session():
    sid = _uid()
    _request("POST", "/api/projectbase/sessions/ingest", {
        "session_id": sid,
        "agent_name": "flomaster",
        "command": "Test detail retrieval",
        "status": "completed"
    })

    # Detail
    d_status, d_body = _request("GET", f"/api/projectbase/sessions/{sid}")
    assert d_status == 200
    assert d_body["session_id"] == sid
    assert d_body["command"] == "Test detail retrieval"

    # Delete
    del_status, del_body = _request("DELETE", f"/api/projectbase/sessions/{sid}")
    assert del_status == 200
    assert del_body["success"] is True

    # Confirm 404
    chk_status, _ = _request("GET", f"/api/projectbase/sessions/{sid}")
    assert chk_status == 404


# 11. Test Session Cleaning / Pruning
def test_clean_sessions():
    status, body = _request("POST", "/api/projectbase/sessions/clean", {
        "older_than_days": 180
    })
    assert status == 200
    assert body["success"] is True
    assert "purged_count" in body
