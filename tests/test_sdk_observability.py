"""tests/test_sdk_observability.py — End-to-end tests for Epic 17 OpenAPI SDK Generator & Observability.

Verifies:
  1. SDK generator languages catalogue (Python, TypeScript, JavaScript, cURL, Agent Tool)
  2. SDK code snippet generation for REST endpoints (Python / requests / httpx)
  3. SDK code snippet generation for FastMCP tools (TypeScript)
  4. SDK code snippet generation for cURL shell commands
  5. SDK code snippet generation for Agent Tool JSON Schemas
  6. SDK code snippet generation for JavaScript ESM clients
  7. Standalone client SDK starter templates (Python / TypeScript)
  8. Real-time webhook & API observability telemetry (p95 latency, throughput, success rate)
  9. Observability alert threshold configuration and evaluation lifecycle
  10. Observability alert rule breach evaluation and recording
  11. Interactive integration recipes and unified API & MCP specification
  12. FastMCP JSON-RPC 2.0 tools for SDK generation, languages, and API spec
  13. FastMCP JSON-RPC 2.0 tools for observability metrics, alert rules, and recipes
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
    return f"sdk_{int(time.time() * 1000) % 10000000}"


def _request_raw(method, path, body=None, headers=None):
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
def _auth_token():
    status, res = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200 or "token" not in res:
        pytest.fail(f"Superuser authentication failed ({status}): {res}")
    return res["token"]


def test_sdk_languages_list():
    status, data = _request("GET", "/api/projectbase/sdk/languages")
    assert status == 200
    assert data["status"] == "ok"
    assert data["total"] >= 5
    lang_ids = [l["id"] for l in data["languages"]]
    assert "python" in lang_ids
    assert "typescript" in lang_ids
    assert "curl" in lang_ids


def test_sdk_generate_python():
    token = _auth_token()
    payload = {
        "language": "python",
        "target_endpoint": "/api/collections/issues/records",
        "auth_token": "test-token-xyz",
        "base_url": BASE_URL,
    }
    status, data = _request("POST", "/api/projectbase/sdk/generate", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    assert data["status"] == "ok"
    assert data["language"] == "python"
    assert "import requests" in data["code"] or "import httpx" in data["code"]
    assert "test-token-xyz" in data["code"]
    assert data["metadata"]["lines"] > 5


def test_sdk_generate_typescript_tool():
    token = _auth_token()
    payload = {
        "language": "typescript",
        "target_tool": "decompose_task_graph",
        "auth_token": "test-token-xyz",
        "base_url": BASE_URL,
    }
    status, data = _request("POST", "/api/projectbase/sdk/generate", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    assert data["status"] == "ok"
    assert data["language"] == "typescript"
    assert "call_decompose_task_graph" in data["code"]
    assert "projectbase/mcp" in data["code"]


def test_sdk_generate_curl_snippet():
    token = _auth_token()
    payload = {
        "language": "curl",
        "target_endpoint": "/api/projectbase/dag/status",
        "auth_token": "test-token-xyz",
        "base_url": BASE_URL,
    }
    status, data = _request("POST", "/api/projectbase/sdk/generate", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    assert data["status"] == "ok"
    assert "curl -s -X GET" in data["code"]
    assert "/api/projectbase/dag/status" in data["code"]


def test_sdk_generate_agent_tool_schema():
    token = _auth_token()
    payload = {
        "language": "agent_tool",
        "target_tool": "acquire_task_lease",
        "base_url": BASE_URL,
    }
    status, data = _request("POST", "/api/projectbase/sdk/generate", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    assert data["status"] == "ok"
    assert data["syntax"] == "json"
    schema = json.loads(data["code"])
    assert schema["type"] == "function"
    assert schema["function"]["name"] == "acquire_task_lease"


def test_sdk_generate_javascript_client():
    token = _auth_token()
    payload = {
        "language": "javascript",
        "target_endpoint": "/api/projectbase/observability/metrics",
        "auth_token": "test-jwt-token",
        "base_url": BASE_URL,
    }
    status, data = _request("POST", "/api/projectbase/sdk/generate", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    assert data["status"] == "ok"
    assert "export async function fetch_" in data["code"]
    assert "test-jwt-token" in data["code"]


def test_sdk_template_retrieval():
    status_py, data_py = _request("GET", "/api/projectbase/sdk/templates/python")
    assert status_py == 200
    assert data_py["status"] == "ok"
    assert "class ProjectBaseClient" in data_py["template"]

    status_ts, data_ts = _request("GET", "/api/projectbase/sdk/templates/typescript")
    assert status_ts == 200
    assert data_ts["status"] == "ok"
    assert "export class ProjectBaseClient" in data_ts["template"]


def test_observability_metrics():
    status, data = _request("GET", "/api/projectbase/observability/metrics")
    assert status == 200
    assert data["status"] == "ok"
    assert "summary" in data
    assert "latency" in data
    assert "p95_ms" in data["latency"]
    assert "success_rate_pct" in data["summary"]
    assert data["health_status"] in ["healthy", "degraded", "critical"]


def test_observability_alerts_lifecycle():
    token = _auth_token()
    rule_payload = {
        "name": f"E2E Test Alert {_uid()}",
        "metric_name": "error_rate_pct",
        "comparison_operator": "gt",
        "threshold_value": 4.5,
        "alert_channel": "agent-lead-e2e",
        "channel_type": "agent",
    }
    status, create_res = _request(
        "POST",
        "/api/projectbase/observability/alerts/configure",
        rule_payload,
        {"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    created_rule = create_res.get("alert_config")
    rule_id = created_rule.get("id")
    assert rule_id is not None

    status_get, alerts_data = _request(
        "GET",
        "/api/projectbase/observability/alerts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_get == 200
    assert alerts_data["status"] == "ok"
    assert any(r.get("metric_name") == "error_rate_pct" for r in alerts_data["configs"])

    status_eval, eval_data = _request(
        "POST",
        "/api/projectbase/observability/alerts/evaluate",
        {},
        {"Authorization": f"Bearer {token}"},
    )
    assert status_eval == 200
    assert eval_data["status"] == "ok"
    assert "total_rules_evaluated" in eval_data

    status_del, del_data = _request(
        "DELETE",
        f"/api/projectbase/observability/alerts/{rule_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_del == 200


def test_observability_alert_breach_detection():
    token = _auth_token()
    # Configure low threshold to guarantee breach trigger
    rule_payload = {
        "name": f"Breach Trigger {_uid()}",
        "metric_name": "error_rate_pct",
        "comparison_operator": "gt",
        "threshold_value": 0.1,
        "alert_channel": "agent-test-breach",
        "channel_type": "webhook",
    }
    status_c, create_res = _request(
        "POST",
        "/api/projectbase/observability/alerts/configure",
        rule_payload,
        {"Authorization": f"Bearer {token}"},
    )
    assert status_c == 200
    rule_id = create_res.get("alert_config", {}).get("id")

    status_e, eval_res = _request(
        "POST",
        "/api/projectbase/observability/alerts/evaluate",
        {},
        {"Authorization": f"Bearer {token}"},
    )
    assert status_e == 200
    assert eval_res["breaches_detected"] >= 1

    if rule_id:
        _request("DELETE", f"/api/projectbase/observability/alerts/{rule_id}", headers={"Authorization": f"Bearer {token}"})


def test_integration_recipes_and_spec():
    status_rec, rec_data = _request("GET", "/api/projectbase/docs/recipes")
    assert status_rec == 200
    assert rec_data["status"] == "ok"
    assert rec_data["total"] >= 4
    recipe_ids = [r["id"] for r in rec_data["recipes"]]
    assert "mcp-agent-dispatch" in recipe_ids
    assert "git-webhook-triage" in recipe_ids

    status_spec, spec_data = _request("GET", "/api/projectbase/docs/spec")
    assert status_spec == 200
    assert spec_data["status"] == "ok"
    assert spec_data["fastmcp_tools_endpoint"] == "/projectbase/mcp"
    assert "supported_sdk_languages" in spec_data


def test_fastmcp_sdk_and_observability_tools():
    token = _auth_token()
    mcp_payload_1 = {
        "jsonrpc": "2.0",
        "id": "test-sdk-mcp-1",
        "method": "tools/call",
        "params": {
            "name": "list_sdk_languages",
            "arguments": {},
        },
    }
    status_1, data_1 = _request(
        "POST",
        "/api/projectbase/mcp",
        mcp_payload_1,
        {"Authorization": f"Bearer {token}"},
    )
    assert status_1 == 200
    assert "result" in data_1
    text_1 = data_1["result"]["content"][0]["text"]
    parsed_1 = json.loads(text_1)
    assert len(parsed_1["languages"]) >= 4

    mcp_payload_2 = {
        "jsonrpc": "2.0",
        "id": "test-sdk-mcp-2",
        "method": "tools/call",
        "params": {
            "name": "get_webhook_observability_metrics",
            "arguments": {"time_window": "24h"},
        },
    }
    status_2, data_2 = _request(
        "POST",
        "/api/projectbase/mcp",
        mcp_payload_2,
        {"Authorization": f"Bearer {token}"},
    )
    assert status_2 == 200
    assert "result" in data_2
    parsed_2 = json.loads(data_2["result"]["content"][0]["text"])
    assert "p95_latency_ms" in parsed_2
    assert "health_status" in parsed_2

    mcp_payload_3 = {
        "jsonrpc": "2.0",
        "id": "test-sdk-mcp-3",
        "method": "tools/call",
        "params": {
            "name": "generate_agent_sdk",
            "arguments": {"language": "python", "target_endpoint": "/api/projectbase/dag/status"},
        },
    }
    status_3, data_3 = _request(
        "POST",
        "/api/projectbase/mcp",
        mcp_payload_3,
        {"Authorization": f"Bearer {token}"},
    )
    assert status_3 == 200
    parsed_3 = json.loads(data_3["result"]["content"][0]["text"])
    assert "code" in parsed_3
    assert parsed_3["language"] == "python"


def test_fastmcp_observability_alert_and_recipe_tools():
    token = _auth_token()
    mcp_alert_cfg = {
        "jsonrpc": "2.0",
        "id": "test-sdk-mcp-4",
        "method": "tools/call",
        "params": {
            "name": "configure_alert_thresholds",
            "arguments": {
                "name": "FastMCP Test Alert",
                "metric_name": "p95_latency_ms",
                "threshold_value": 150.0,
                "alert_channel": "agent-ops"
            },
        },
    }
    status_4, data_4 = _request(
        "POST",
        "/api/projectbase/mcp",
        mcp_alert_cfg,
        {"Authorization": f"Bearer {token}"},
    )
    assert status_4 == 200
    parsed_4 = json.loads(data_4["result"]["content"][0]["text"])
    assert parsed_4["status"] == "configured"

    mcp_recipes = {
        "jsonrpc": "2.0",
        "id": "test-sdk-mcp-5",
        "method": "tools/call",
        "params": {
            "name": "get_integration_recipes",
            "arguments": {},
        },
    }
    status_5, data_5 = _request(
        "POST",
        "/api/projectbase/mcp",
        mcp_recipes,
        {"Authorization": f"Bearer {token}"},
    )
    assert status_5 == 200
    parsed_5 = json.loads(data_5["result"]["content"][0]["text"])
    assert len(parsed_5["recipes"]) >= 4
