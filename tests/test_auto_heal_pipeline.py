"""tests/test_auto_heal_pipeline.py — End-to-end tests for Epic 22 Autonomous AI Agent Auto-Healing & Self-Remediation Workflow Pipeline.

Verifies:
  1. Policy CRUD lifecycle (create, get, patch, list, delete).
  2. Auto-remediation incident reporting, error logs, and execution traces.
  3. Manual and automated incident resolution and escalation.
  4. Live agent fleet health check diagnostics and heartbeat telemetry.
  5. Dynamic auto-healing trigger evaluator and action execution.
  6. Workspace-wide crash recovery sweep (clearing dead leases, resetting stuck tasks).
  7. Blueprint remediation recipes library and 1-click policy application.
  8. Aggregated auto-healing metrics, MTTR, and recovery success rate.
  9. FastMCP JSON-RPC 2.0 tools for auto-healing and self-remediation.
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
    return f"autoheal_{int(time.time() * 1000) % 10000000}"


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


# 1. Test Policy Listing
def test_list_auto_heal_policies():
    status, body = _request("GET", "/api/projectbase/auto-heal/policies")
    assert status == 200
    assert "policies" in body
    assert isinstance(body["policies"], list)
    assert len(body["policies"]) >= 1
    assert "total" in body
    assert "active_count" in body


# 2. Test Policy Creation, Update, and Deletion
def test_create_and_delete_auto_heal_policy():
    uid = _uid()
    policy_name = f"Test Crash Policy {uid}"
    status, create_body = _request("POST", "/api/projectbase/auto-heal/policies", {
        "name": policy_name,
        "trigger_type": "crash_loop",
        "action_strategy": "restart_agent",
        "severity": "high",
        "max_retries": 4,
        "cool_down_seconds": 90,
        "description": "Auto-restart crashed agent sandbox"
    })
    assert status == 201
    assert create_body.get("policy", {}).get("name") == policy_name
    policy_id = create_body["policy"]["id"]

    # Read back
    status, get_body = _request("GET", f"/api/projectbase/auto-heal/policies/{policy_id}")
    assert status == 200
    assert get_body.get("policy", {}).get("id") == policy_id
    assert get_body["policy"]["trigger_type"] == "crash_loop"

    # Patch
    status, patch_body = _request("PATCH", f"/api/projectbase/auto-heal/policies/{policy_id}", {
        "max_retries": 6,
        "severity": "critical"
    })
    assert status == 200
    assert patch_body.get("policy", {}).get("max_retries") == 6
    assert patch_body.get("policy", {}).get("severity") == "critical"

    # Delete
    status, del_body = _request("DELETE", f"/api/projectbase/auto-heal/policies/{policy_id}")
    assert status == 200
    assert del_body.get("id") == policy_id


# 3. Test Incidents List and Filter
def test_list_and_filter_incidents():
    status, body = _request("GET", "/api/projectbase/auto-heal/incidents")
    assert status == 200
    assert "incidents" in body
    assert "total" in body
    assert "active_count" in body
    assert "resolved_count" in body

    # Filter by status
    status, resolved_body = _request("GET", "/api/projectbase/auto-heal/incidents?status=resolved")
    assert status == 200
    for inc in resolved_body.get("incidents", []):
        assert inc.get("status") == "resolved"


# 4. Test Incident Report and Auto-Remediation Lifecycle
def test_report_and_auto_remediate_incident():
    uid = _uid()
    agent_name = f"Worker_{uid}"
    status, body = _request("POST", "/api/projectbase/auto-heal/incidents", {
        "agent": agent_name,
        "issue": "PB-9999",
        "trigger_type": "lease_timeout",
        "severity": "medium",
        "error_message": "Worker lease expired unexpectedly during test execution",
        "stack_trace": "TimeoutError: lease expired at worker.py:44",
        "auto_remediate": True
    })
    assert status == 201
    assert "incident" in body
    inc = body["incident"]
    assert inc.get("agent") == agent_name
    assert inc.get("status") == "resolved"
    assert inc.get("remediation_action") == "release_lease"
    assert len(inc.get("execution_log", [])) >= 2
    assert inc.get("recovered_at") != ""
    inc_id = inc.get("id")

    # Read incident details
    status, get_body = _request("GET", f"/api/projectbase/auto-heal/incidents/{inc_id}")
    assert status == 200
    assert get_body.get("incident", {}).get("id") == inc_id


# 5. Test Incident Manual Resolution and Escalation
def test_resolve_and_escalate_incident():
    uid = _uid()
    agent_name = f"StuckWorker_{uid}"
    status, body = _request("POST", "/api/projectbase/auto-heal/incidents", {
        "agent": agent_name,
        "issue": "PB-8888",
        "trigger_type": "validation_failure",
        "severity": "high",
        "error_message": "Consensus divergence on patch verification",
        "auto_remediate": False
    })
    assert status == 201
    inc_id = body["incident"]["id"]
    assert body["incident"]["status"] == "detected"

    # Escalate
    status, esc_body = _request("POST", f"/api/projectbase/auto-heal/incidents/{inc_id}/escalate", {
        "reason": "Exceeded retry threshold during automated merge"
    })
    assert status == 200
    assert esc_body.get("incident", {}).get("status") == "escalated"
    assert esc_body.get("incident", {}).get("severity") == "critical"

    # Resolve
    status, res_body = _request("POST", f"/api/projectbase/auto-heal/incidents/{inc_id}/resolve", {
        "resolution_notes": "Conflict resolved manually by senior reviewer",
        "resolved_by": "SeniorDev"
    })
    assert status == 200
    assert res_body.get("incident", {}).get("status") == "resolved"


# 6. Test Live Fleet Health Diagnostics
def test_live_fleet_health_checks():
    status, body = _request("GET", "/api/projectbase/auto-heal/health-checks")
    assert status == 200
    assert "fleet_health" in body
    assert "fleet_health_score_pct" in body
    assert "total_agents" in body
    assert "healthy_agents" in body
    assert isinstance(body["fleet_health"], list)
    for ag in body["fleet_health"]:
        assert "agent_id" in ag
        assert "name" in ag
        assert "health_score" in ag
        assert ag["health_score"] in ["healthy", "degraded", "unhealthy", "crashed"]


# 7. Test Trigger Dynamic Auto-Healing
def test_trigger_dynamic_auto_healing():
    status, body = _request("POST", "/api/projectbase/auto-heal/trigger", {
        "agent": "FlomasterAgent",
        "issue": "PB-104",
        "trigger_type": "crash_loop",
        "action_strategy": "restart_agent"
    })
    assert status == 200
    assert body.get("action_executed") == "restart_agent"
    assert body.get("remediation_status") == "recovered"
    assert "incident" in body
    assert len(body.get("steps", [])) >= 3


# 8. Test Crash Recovery Sweep
def test_crash_recovery_sweep():
    status, body = _request("POST", "/api/projectbase/auto-heal/crash-recovery")
    assert status == 200
    assert body.get("healthy_state_restored") is True
    assert "metrics" in body
    metrics = body["metrics"]
    assert "expired_leases_released" in metrics
    assert "dead_tasks_recovered" in metrics


# 9. Test Blueprint Recipes and Apply
def test_blueprint_recipes_and_apply():
    status, body = _request("GET", "/api/projectbase/auto-heal/recipes")
    assert status == 200
    assert "recipes" in body
    assert len(body["recipes"]) >= 3
    recipe_id = body["recipes"][0]["id"]

    # Apply recipe
    status, apply_body = _request("POST", f"/api/projectbase/auto-heal/recipes/{recipe_id}/apply")
    assert status == 201
    assert "policy" in apply_body
    assert apply_body.get("policy", {}).get("is_active") is True


# 10. Test Aggregated Metrics and MTTR
def test_auto_heal_metrics():
    status, body = _request("GET", "/api/projectbase/auto-heal/metrics")
    assert status == 200
    assert "total_incidents" in body
    assert "recovery_success_rate_pct" in body
    assert "mttr_seconds" in body
    assert "active_policies_count" in body
    assert "failure_categories" in body


# 11. Test FastMCP JSON-RPC 2.0 Auto-Heal Tools
def test_fastmcp_auto_heal_tools():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Call list_auto_heal_policies via FastMCP
    rpc_payload = {
        "jsonrpc": "2.0",
        "id": "test-rpc-1",
        "method": "tools/call",
        "params": {
            "name": "list_auto_heal_policies",
            "arguments": {}
        }
    }
    status, body = _request("POST", "/api/projectbase/mcp", rpc_payload, headers=headers)
    assert status == 200
    assert "result" in body
    assert "content" in body["result"]
    content_text = body["result"]["content"][0]["text"]
    parsed = json.loads(content_text)
    assert parsed.get("success") is True
    assert "policies" in parsed

    # Call get_auto_heal_metrics via FastMCP
    rpc_payload2 = {
        "jsonrpc": "2.0",
        "id": "test-rpc-2",
        "method": "tools/call",
        "params": {
            "name": "get_auto_heal_metrics",
            "arguments": {}
        }
    }
    status, body2 = _request("POST", "/api/projectbase/mcp", rpc_payload2, headers=headers)
    assert status == 200
    parsed2 = json.loads(body2["result"]["content"][0]["text"])
    assert parsed2.get("success") is True
    assert "recovery_success_rate_pct" in parsed2

    # Call run_crash_recovery_sweep via FastMCP
    rpc_payload3 = {
        "jsonrpc": "2.0",
        "id": "test-rpc-3",
        "method": "tools/call",
        "params": {
            "name": "run_crash_recovery_sweep",
            "arguments": {}
        }
    }
    status, body3 = _request("POST", "/api/projectbase/mcp", rpc_payload3, headers=headers)
    assert status == 200
    parsed3 = json.loads(body3["result"]["content"][0]["text"])
    assert parsed3.get("success") is True
    assert parsed3.get("healthy_state_restored") is True
