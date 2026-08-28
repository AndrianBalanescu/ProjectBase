"""tests/test_multi_tenant_quotas.py — End-to-end tests for Epic 21 Multi-Tenant Tenant Isolation & Granular Resource Quotas.

Verifies:
  1. Multi-tenant workspace provisioning, retrieval, patching, and deletion.
  2. Automatic quota initialization with plan tiers (free, pro, enterprise).
  3. Quota customization and enforcement policy updates.
  4. Real-time resource usage calculation and meter aggregation.
  5. Dynamic quota enforcement gate check (hard block vs soft warn).
  6. Workspace context switching for user/agent sessions.
  7. Tenant membership and agent roster management.
  8. Cross-workspace metrics and quota threshold alert reporting.
  9. FastMCP JSON-RPC 2.0 tools for multi-tenant management.
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


def _uid():
    return f"tenant_{int(time.time() * 1000) % 10000000}"


def _request(method, path, body=None, headers=None):
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
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"error": err_body}


def _get_auth_token():
    status, res = _request(
        "POST",
        "/api/collections/users/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD}
    )
    if status == 200 and "token" in res:
        return res["token"]
    status, res = _request(
        "POST",
        "/api/admins/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD}
    )
    if status == 200 and "token" in res:
        return res["token"]
    return None


@pytest.fixture(scope="module")
def auth_headers():
    token = _get_auth_token()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def test_tenant_crud_and_defaults(auth_headers):
    uid = _uid()
    tenant_name = f"Workspace {uid}"
    slug = f"ws-{uid}"

    # 1. Create tenant
    status, res = _request(
        "POST",
        "/api/projectbase/tenants",
        {
            "name": tenant_name,
            "slug": slug,
            "description": "Test autonomous tenant workspace",
            "plan_tier": "free",
            "owner": "admin_test"
        },
        headers=auth_headers
    )
    assert status == 201
    assert res.get("success") is True
    tenant_id = res["tenant"]["id"]
    assert res["tenant"]["name"] == tenant_name
    assert res["tenant"]["slug"] == slug
    assert res["tenant"]["plan_tier"] == "free"

    # 2. List tenants
    status, list_res = _request("GET", "/api/projectbase/tenants", headers=auth_headers)
    assert status == 200
    tenants = list_res.get("tenants", [])
    found = [t for t in tenants if t["id"] == tenant_id]
    assert len(found) == 1
    assert found[0]["quotas"]["max_projects"] == 5
    assert found[0]["quotas"]["max_issues"] == 250

    # 3. Get tenant details
    status, get_res = _request("GET", f"/api/projectbase/tenants/{tenant_id}", headers=auth_headers)
    assert status == 200
    assert get_res["tenant"]["name"] == tenant_name

    # 4. Patch tenant
    status, patch_res = _request(
        "PATCH",
        f"/api/projectbase/tenants/{tenant_id}",
        {"description": "Updated description", "plan_tier": "pro"},
        headers=auth_headers
    )
    assert status == 200
    assert patch_res["tenant"]["plan_tier"] == "pro"

    # 5. Cleanup / Delete
    status, del_res = _request("DELETE", f"/api/projectbase/tenants/{tenant_id}", headers=auth_headers)
    assert status == 200
    assert del_res["success"] is True


def test_tenant_quota_configuration(auth_headers):
    uid = _uid()
    status, res = _request(
        "POST",
        "/api/projectbase/tenants",
        {"name": f"Quota Test {uid}", "plan_tier": "pro"},
        headers=auth_headers
    )
    assert status == 201
    tenant_id = res["tenant"]["id"]

    try:
        # Get quotas
        status, q_res = _request("GET", f"/api/projectbase/tenants/{tenant_id}/quotas", headers=auth_headers)
        assert status == 200
        assert q_res["quotas"]["max_projects"] == 25
        assert q_res["quotas"]["max_issues"] == 2500

        # Update quotas
        status, put_res = _request(
            "PUT",
            f"/api/projectbase/tenants/{tenant_id}/quotas",
            {
                "max_projects": 50,
                "max_issues": 5000,
                "max_agents": 20,
                "max_storage_mb": 10000,
                "enforcement_mode": "hard"
            },
            headers=auth_headers
        )
        assert status == 200
        assert put_res["success"] is True
        assert put_res["quotas"]["max_projects"] == 50
        assert put_res["quotas"]["max_issues"] == 5000
        assert put_res["quotas"]["enforcement_mode"] == "hard"
    finally:
        _request("DELETE", f"/api/projectbase/tenants/{tenant_id}", headers=auth_headers)


def test_tenant_usage_metering(auth_headers):
    uid = _uid()
    status, res = _request(
        "POST",
        "/api/projectbase/tenants",
        {"name": f"Usage Test {uid}", "plan_tier": "enterprise"},
        headers=auth_headers
    )
    assert status == 201
    tenant_id = res["tenant"]["id"]

    try:
        status, u_res = _request("GET", f"/api/projectbase/tenants/{tenant_id}/usage", headers=auth_headers)
        assert status == 200
        assert "meters" in u_res
        assert len(u_res["meters"]) >= 4
        resources = [m["resource"] for m in u_res["meters"]]
        assert "projects" in resources
        assert "issues" in resources
        assert "agents" in resources
        assert "storage_mb" in resources
    finally:
        _request("DELETE", f"/api/projectbase/tenants/{tenant_id}", headers=auth_headers)


def test_dynamic_quota_enforcement_gate(auth_headers):
    uid = _uid()
    status, res = _request(
        "POST",
        "/api/projectbase/tenants",
        {"name": f"Gate Test {uid}", "plan_tier": "free"},
        headers=auth_headers
    )
    assert status == 201
    tenant_id = res["tenant"]["id"]

    try:
        # Check within quota
        status, check_res = _request(
            "POST",
            f"/api/projectbase/tenants/{tenant_id}/check-quota",
            {"resource_type": "issues", "units": 10},
            headers=auth_headers
        )
        assert status == 200
        assert check_res["allowed"] is True

        # Restrict quota to 2 and hard enforcement
        _request(
            "PUT",
            f"/api/projectbase/tenants/{tenant_id}/quotas",
            {"max_issues": 2, "enforcement_mode": "hard"},
            headers=auth_headers
        )

        # Check exceeding quota
        status, check_res2 = _request(
            "POST",
            f"/api/projectbase/tenants/{tenant_id}/check-quota",
            {"resource_type": "issues", "units": 500},
            headers=auth_headers
        )
        assert status == 200
        assert check_res2["allowed"] is False
        assert "Quota exceeded" in check_res2["reason"]

        # Switch to soft enforcement
        _request(
            "PUT",
            f"/api/projectbase/tenants/{tenant_id}/quotas",
            {"enforcement_mode": "soft"},
            headers=auth_headers
        )
        status, check_res3 = _request(
            "POST",
            f"/api/projectbase/tenants/{tenant_id}/check-quota",
            {"resource_type": "issues", "units": 500},
            headers=auth_headers
        )
        assert status == 200
        assert check_res3["allowed"] is True
        assert "Soft quota warning" in check_res3["reason"]
    finally:
        _request("DELETE", f"/api/projectbase/tenants/{tenant_id}", headers=auth_headers)


def test_tenant_context_switching(auth_headers):
    uid = _uid()
    status, res = _request(
        "POST",
        "/api/projectbase/tenants",
        {"name": f"Switch Test {uid}"},
        headers=auth_headers
    )
    assert status == 201
    tenant_id = res["tenant"]["id"]

    try:
        status, sw_res = _request(
            "POST",
            f"/api/projectbase/tenants/{tenant_id}/switch",
            {"user_id": "test_agent_1"},
            headers=auth_headers
        )
        assert status == 200
        assert sw_res["success"] is True
        assert sw_res["active_tenant_id"] == tenant_id
        assert sw_res["user_id"] == "test_agent_1"
    finally:
        _request("DELETE", f"/api/projectbase/tenants/{tenant_id}", headers=auth_headers)


def test_tenant_membership_management(auth_headers):
    uid = _uid()
    status, res = _request(
        "POST",
        "/api/projectbase/tenants",
        {"name": f"Members Test {uid}", "owner": "primary_owner"},
        headers=auth_headers
    )
    assert status == 201
    tenant_id = res["tenant"]["id"]

    try:
        # Add new member
        status, add_res = _request(
            "POST",
            f"/api/projectbase/tenants/{tenant_id}/members",
            {"user": "dev_collaborator", "role": "admin"},
            headers=auth_headers
        )
        assert status == 201
        assert add_res["success"] is True
        membership_id = add_res["membership"]["id"]

        # List members
        status, list_res = _request("GET", f"/api/projectbase/tenants/{tenant_id}/members", headers=auth_headers)
        assert status == 200
        assert list_res["total"] >= 2

        # Delete member
        status, del_res = _request("DELETE", f"/api/projectbase/tenants/{tenant_id}/members/{membership_id}", headers=auth_headers)
        assert status == 200
        assert del_res["success"] is True
    finally:
        _request("DELETE", f"/api/projectbase/tenants/{tenant_id}", headers=auth_headers)


def test_cross_tenant_metrics_analytics(auth_headers):
    status, m_res = _request("GET", "/api/projectbase/tenants/metrics", headers=auth_headers)
    assert status == 200
    assert "total_tenants" in m_res
    assert "tier_breakdown" in m_res
    assert "aggregate_resources" in m_res
    assert "alerts" in m_res


def test_fastmcp_multi_tenant_tools(auth_headers):
    def _call_mcp(tool_name, args):
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": args}
        }
        status, res = _request("POST", "/api/projectbase/mcp", payload, headers=auth_headers)
        assert status == 200
        assert "result" in res
        text = res["result"]["content"][0]["text"]
        return json.loads(text)

    # 1. create_tenant
    uid = _uid()
    c_res = _call_mcp("create_tenant", {"name": f"MCP Tenant {uid}", "plan_tier": "pro"})
    assert c_res.get("success") is True
    t_id = c_res["tenant"]["id"]

    try:
        # 2. list_tenants
        l_res = _call_mcp("list_tenants", {})
        assert l_res.get("success") is True
        assert any(t["id"] == t_id for t in l_res.get("tenants", []))

        # 3. get_tenant_details
        d_res = _call_mcp("get_tenant_details", {"tenant_id": t_id})
        assert d_res.get("success") is True
        assert d_res["tenant"]["id"] == t_id

        # 4. configure_tenant_quotas
        q_res = _call_mcp("configure_tenant_quotas", {"tenant_id": t_id, "max_projects": 30, "max_issues": 3000})
        assert q_res.get("success") is True
        assert q_res["quotas"]["max_projects"] == 30

        # 5. get_tenant_usage
        u_res = _call_mcp("get_tenant_usage", {"tenant_id": t_id})
        assert u_res.get("success") is True
        assert "usage" in u_res

        # 6. check_tenant_quota
        ch_res = _call_mcp("check_tenant_quota", {"tenant_id": t_id, "resource_type": "project", "units": 2})
        assert ch_res.get("success") is True
        assert ch_res["allowed"] is True

        # 7. switch_tenant_context
        sw_res = _call_mcp("switch_tenant_context", {"tenant_id": t_id, "user_id": "mcp_agent"})
        assert sw_res.get("success") is True
        assert sw_res["active_tenant_id"] == t_id

        # 8. get_tenant_metrics
        met_res = _call_mcp("get_tenant_metrics", {})
        assert met_res.get("success") is True
        assert "total_tenants" in met_res
    finally:
        _request("DELETE", f"/api/projectbase/tenants/{t_id}", headers=auth_headers)
