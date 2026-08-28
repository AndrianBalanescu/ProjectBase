"""tests/test_fleet_budget_quotas.py — Comprehensive test suite for Agent Fleet Budget & Cost Attribution, Token Quota Enforcement & Financial Governance Hub (Milestone 7 / Epic 28).

Verifies:
  1. Budget Policy CRUD (/api/projectbase/billing/policies).
  2. Pre-Flight Token & Budget Availability Checks (/api/projectbase/billing/quotas/check).
  3. In-Flight Token Capacity Reservation & Release (/api/projectbase/billing/quotas/reserve, release).
  4. Token Usage Ingestion & Multi-Model Cost Calculation (/api/projectbase/billing/usage/record).
  5. Circuit Breaker Tripping & Status Threshold Alerts.
  6. Emergency Budget & Token Quota Overrides (/api/projectbase/billing/overrides/grant).
  7. Fleet-Wide Spending Analytics Breakdown (/api/projectbase/billing/analytics).
  8. Transaction Cost Ledger Querying & Filtering (/api/projectbase/billing/ledger).
  9. Model Pricing Matrix Reference Endpoint (/api/projectbase/billing/pricing).
 10. Circuit Breaker Reset Engine (/api/projectbase/billing/circuit-breaker/reset).
 11. FastMCP JSON-RPC 2.0 Tools (8 tools):
     - get_agent_budget_status
     - set_agent_budget_policy
     - record_agent_token_usage
     - check_token_quota_availability
     - grant_emergency_budget_override
     - get_fleet_cost_analytics
     - list_cost_ledger_entries
     - get_model_pricing_matrix
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
    payload = json.dumps({"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/collections/_superusers/auth-with-password",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["token"]


def _request(method, path, body=None, token=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if token:
        req_headers["Authorization"] = token
    if headers:
        req_headers.update(headers)

    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8") if isinstance(body, dict) else body.encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, {"error": content}


def test_model_pricing_matrix_endpoint():
    """Verify GET /api/projectbase/billing/pricing returns supported models with non-negative rates."""
    st, res = _request("GET", "/api/projectbase/billing/pricing")
    assert st == 200
    assert "pricing" in res
    pricing = res["pricing"]
    assert "claude-3-5-sonnet" in pricing
    assert "gpt-4o" in pricing
    assert "deepseek-v3" in pricing
    assert "omniroute/premium" in pricing

    sonnet = pricing["claude-3-5-sonnet"]
    assert sonnet["prompt"] > 0
    assert sonnet["completion"] > 0
    assert sonnet["provider"] == "anthropic"

    omniroute = pricing["omniroute/premium"]
    assert omniroute["prompt"] == 0.0
    assert omniroute["completion"] == 0.0


def test_budget_policies_crud():
    """Verify creating, listing, retrieving, and deleting budget policies."""
    token = _superuser_token()

    # 1. Create global policy
    policy_name = f"Test Global Cap {int(time.time())}"
    st, res = _request("POST", "/api/projectbase/billing/policies", {
        "name": policy_name,
        "scope_type": "global",
        "max_budget_usd": 150.0,
        "max_tokens": 20000000,
        "period": "daily",
        "soft_limit_pct": 75,
        "hard_limit_action": "block"
    }, token=token)
    assert st == 200
    assert res.get("success") is True
    policy = res.get("policy", {})
    assert policy["name"] == policy_name
    assert policy["max_budget_usd"] == 150.0
    assert policy["status"] == "active"
    policy_id = policy["id"]

    # 2. List policies
    st, list_res = _request("GET", "/api/projectbase/billing/policies", token=token)
    assert st == 200
    assert "policies" in list_res
    matching = [p for p in list_res["policies"] if p["id"] == policy_id]
    assert len(matching) == 1
    assert matching[0]["name"] == policy_name

    # 3. Get single policy
    st, get_res = _request("GET", f"/api/projectbase/billing/policies/{policy_id}", token=token)
    assert st == 200
    assert get_res["id"] == policy_id
    assert get_res["effective_budget_usd"] == 150.0
    assert get_res["remaining_budget_usd"] == 150.0

    # 4. Delete policy
    st, del_res = _request("DELETE", f"/api/projectbase/billing/policies/{policy_id}", token=token)
    assert st == 200
    assert del_res.get("success") is True


def test_pre_flight_quota_check():
    """Verify POST /api/projectbase/billing/quotas/check performs pre-flight cost and quota validation."""
    token = _superuser_token()

    # Create low-budget persona policy
    st, p_res = _request("POST", "/api/projectbase/billing/policies", {
        "name": "Strict Security Persona Cap",
        "scope_type": "persona",
        "scope_id": "security_test",
        "max_budget_usd": 0.05,
        "max_tokens": 100000,
        "soft_limit_pct": 50,
        "hard_limit_action": "throttle"
    }, token=token)
    assert st == 200
    policy_id = p_res["policy"]["id"]

    try:
        # Pre-check small request -> should be allowed
        st, check_res = _request("POST", "/api/projectbase/billing/quotas/check", {
            "persona": "security_test",
            "model": "deepseek-v3",
            "estimated_prompt_tokens": 1000,
            "estimated_completion_tokens": 500
        }, token=token)
        assert st == 200
        assert check_res["allowed"] is True
        assert check_res["action"] == "allow"
        assert check_res["estimated_cost_usd"] > 0

        # Pre-check oversized request -> should exceed hard cap
        st, over_res = _request("POST", "/api/projectbase/billing/quotas/check", {
            "persona": "security_test",
            "model": "claude-3-opus",
            "estimated_prompt_tokens": 50000,
            "estimated_completion_tokens": 20000
        }, token=token)
        assert st == 200
        assert over_res["allowed"] is False
        assert over_res["action"] == "throttle"
        assert len(over_res["warnings"]) > 0
    finally:
        _request("DELETE", f"/api/projectbase/billing/policies/{policy_id}", token=token)


def test_token_reservation_and_release():
    """Verify POST /api/projectbase/billing/quotas/reserve and release for in-flight capacity."""
    token = _superuser_token()
    session_id = f"sess_res_{int(time.time())}"

    # 1. Reserve 50k tokens
    st, res_res = _request("POST", "/api/projectbase/billing/quotas/reserve", {
        "scope_type": "session",
        "scope_id": session_id,
        "tokens": 50000
    }, token=token)
    assert st == 200
    assert res_res["success"] is True
    assert res_res["reserved_tokens"] == 50000
    assert res_res["total_reserved"] >= 50000
    assert "reservation_id" in res_res

    # 2. Release 30k tokens
    st, rel_res = _request("POST", "/api/projectbase/billing/quotas/release", {
        "scope_type": "session",
        "scope_id": session_id,
        "tokens": 30000
    }, token=token)
    assert st == 200
    assert rel_res["success"] is True
    assert rel_res["released_tokens"] == 30000
    assert rel_res["remaining_reserved"] == 20000


def test_record_token_usage_and_ledger():
    """Verify POST /api/projectbase/billing/usage/record and GET /api/projectbase/billing/ledger."""
    token = _superuser_token()
    session_id = f"sess_usage_{int(time.time())}"
    issue_id = "PB-999"

    # Record token usage for Claude 3.5 Sonnet
    st, rec_res = _request("POST", "/api/projectbase/billing/usage/record", {
        "session_id": session_id,
        "issue_id": issue_id,
        "persona": "architect",
        "model": "claude-3-5-sonnet",
        "prompt_tokens": 10000,
        "completion_tokens": 4000,
        "cached_tokens": 2000,
        "reasoning_tokens": 0,
        "latency_ms": 1450,
        "request_kind": "inference"
    }, token=token)
    assert st == 200
    assert rec_res["success"] is True
    assert rec_res["total_tokens"] == 16000
    # Prompt: 10k * $3/1M = $0.03, Completion: 4k * $15/1M = $0.06, Cache: 2k * $0.3/1M = $0.0006 -> ~$0.0906
    assert rec_res["cost_usd"] > 0.08 and rec_res["cost_usd"] < 0.10
    ledger_id = rec_res["ledger_id"]

    # Verify transaction appeared in ledger
    st, leg_res = _request("GET", f"/api/projectbase/billing/ledger?session_id={session_id}", token=token)
    assert st == 200
    assert leg_res["count"] >= 1
    entry = leg_res["entries"][0]
    assert entry["id"] == ledger_id
    assert entry["persona"] == "architect"
    assert entry["model"] == "claude-3-5-sonnet"
    assert entry["total_tokens"] == 16000


def test_circuit_breaker_tripping_and_override():
    """Verify hard limit trips circuit breaker and emergency override unblocks it."""
    token = _superuser_token()
    policy_name = f"Micro Cap Policy {int(time.time())}"

    # 1. Create very small $0.01 policy
    st, p_res = _request("POST", "/api/projectbase/billing/policies", {
        "name": policy_name,
        "scope_type": "persona",
        "scope_id": "test_breaker_persona",
        "max_budget_usd": 0.01,
        "max_tokens": 5000,
        "soft_limit_pct": 50,
        "hard_limit_action": "block"
    }, token=token)
    assert st == 200
    policy_id = p_res["policy"]["id"]

    try:
        # 2. Record usage that exceeds $0.01
        st, rec_res = _request("POST", "/api/projectbase/billing/usage/record", {
            "persona": "test_breaker_persona",
            "model": "gpt-4o",
            "prompt_tokens": 10000,
            "completion_tokens": 5000
        }, token=token)
        assert st == 200
        assert rec_res["circuit_breaker_tripped"] is True

        # Verify policy status is now "exceeded"
        st, get_res = _request("GET", f"/api/projectbase/billing/policies/{policy_id}", token=token)
        assert st == 200
        assert get_res["status"] == "exceeded"

        # 3. Grant emergency budget override
        st, ov_res = _request("POST", "/api/projectbase/billing/overrides/grant", {
            "policy_id": policy_id,
            "additional_budget": 10.0,
            "additional_tokens": 1000000,
            "expires_in_minutes": 60,
            "reason": "Test emergency unblock",
            "granted_by": "qa_lead"
        }, token=token)
        assert st == 200
        assert ov_res["success"] is True
        assert ov_res["additional_budget"] == 10.0
        assert ov_res["new_policy_status"] == "overridden"

        # 4. Reset circuit breakers
        st, rst_res = _request("POST", "/api/projectbase/billing/circuit-breaker/reset", {
            "policy_id": policy_id
        }, token=token)
        assert st == 200
        assert rst_res["success"] is True
    finally:
        _request("DELETE", f"/api/projectbase/billing/policies/{policy_id}", token=token)


def test_fleet_spending_analytics():
    """Verify GET /api/projectbase/billing/analytics aggregates metrics across providers and personas."""
    token = _superuser_token()

    st, res = _request("GET", "/api/projectbase/billing/analytics", token=token)
    assert st == 200
    assert "total_spend_usd" in res
    assert "total_tokens" in res
    assert "spend_by_provider" in res
    assert "spend_by_model" in res
    assert "spend_by_persona" in res
    assert "token_breakdown" in res
    assert res["total_spend_usd"] >= 0


def test_fastmcp_fleet_budget_tools():
    """Verify all 8 FastMCP JSON-RPC 2.0 fleet budget & quota tools via /api/projectbase/mcp."""
    token = _superuser_token()
    headers = {"Authorization": token, "Content-Type": "application/json"}

    # 1. tools/list includes all 8 budget tools
    st, res = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "method": "tools/list",
        "id": 100
    }, headers=headers)
    assert st == 200
    tool_names = [t["name"] for t in res.get("result", {}).get("tools", [])]

    expected_tools = [
        "get_agent_budget_status",
        "set_agent_budget_policy",
        "record_agent_token_usage",
        "check_token_quota_availability",
        "grant_emergency_budget_override",
        "get_fleet_cost_analytics",
        "list_cost_ledger_entries",
        "get_model_pricing_matrix"
    ]
    for et in expected_tools:
        assert et in tool_names, f"Missing FastMCP tool {et} in tools/list"

    # 2. get_model_pricing_matrix tool
    st, res = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "get_model_pricing_matrix", "arguments": {}},
        "id": 101
    }, headers=headers)
    assert st == 200
    data = json.loads(res["result"]["content"][0]["text"])
    assert "pricing" in data

    # 3. set_agent_budget_policy tool
    st, res = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "set_agent_budget_policy",
            "arguments": {
                "name": "MCP Swarm Cap",
                "scope_type": "global",
                "max_budget_usd": 200.0,
                "max_tokens": 50000000
            }
        },
        "id": 102
    }, headers=headers)
    assert st == 200
    policy_data = json.loads(res["result"]["content"][0]["text"])
    assert policy_data.get("success") is True
    policy_id = policy_data["policy_id"]

    try:
        # 4. get_agent_budget_status tool
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": "get_agent_budget_status", "arguments": {}},
            "id": 103
        }, headers=headers)
        assert st == 200
        status_data = json.loads(res["result"]["content"][0]["text"])
        assert "policies" in status_data

        # 5. record_agent_token_usage tool
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "record_agent_token_usage",
                "arguments": {
                    "persona": "coder",
                    "model": "deepseek-r1",
                    "prompt_tokens": 5000,
                    "completion_tokens": 1000
                }
            },
            "id": 104
        }, headers=headers)
        assert st == 200
        rec_data = json.loads(res["result"]["content"][0]["text"])
        assert rec_data.get("success") is True
        assert rec_data.get("total_tokens") == 6000

        # 6. check_token_quota_availability tool
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "check_token_quota_availability",
                "arguments": {
                    "model": "gpt-4o",
                    "estimated_prompt_tokens": 2000,
                    "estimated_completion_tokens": 1000
                }
            },
            "id": 105
        }, headers=headers)
        assert st == 200
        chk_data = json.loads(res["result"]["content"][0]["text"])
        assert "allowed" in chk_data

        # 7. grant_emergency_budget_override tool
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "grant_emergency_budget_override",
                "arguments": {
                    "policy_id": policy_id,
                    "additional_budget": 50.0,
                    "reason": "FastMCP test override"
                }
            },
            "id": 106
        }, headers=headers)
        assert st == 200
        ov_data = json.loads(res["result"]["content"][0]["text"])
        assert ov_data.get("success") is True

        # 8. get_fleet_cost_analytics tool
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": "get_fleet_cost_analytics", "arguments": {}},
            "id": 107
        }, headers=headers)
        assert st == 200
        analytics_data = json.loads(res["result"]["content"][0]["text"])
        assert "total_spend_usd" in analytics_data

        # 9. list_cost_ledger_entries tool
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": "list_cost_ledger_entries", "arguments": {"limit": 10}},
            "id": 108
        }, headers=headers)
        assert st == 200
        ledger_data = json.loads(res["result"]["content"][0]["text"])
        assert "entries" in ledger_data
    finally:
        _request("DELETE", f"/api/projectbase/billing/policies/{policy_id}", token=token)
