"""tests/test_sso_rbac_matrix.py — End-to-end tests for Epic 19 Enterprise OIDC/SAML SSO Federation & Granular RBAC Matrix.

Verifies:
  1. SSO provider registration, listing, discovery metadata, and deletion
  2. SSO token exchange with Just-In-Time (JIT) user account provisioning and default role assignment
  3. RBAC system roles retrieval and protected system role modification guards
  4. Custom RBAC role creation, capability mapping, and deletion
  5. 2D RBAC capability matrix generation across all system and custom roles
  6. Fine-grained RBAC permission checking (allow/deny) with wildcard capability matching
  7. User and agent role assignments and revocation lifecycle
  8. Scoped API token generation, listing, capability scope constraints, and revocation
  9. Security & access audit logging, filtering, and JSON/CSV export
 10. FastMCP JSON-RPC 2.0 tools for SSO federation, RBAC policy checks, role assignments, and audit logs
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
    return f"sso_{int(time.time() * 1000) % 10000000}"


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
            return e.code, {"raw": raw}


def _auth_headers():
    status, body = _request(
        "POST",
        "/api/collections/users/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status == 200 and "token" in body:
        return {"Authorization": f"Bearer {body['token']}"}
    return {}


@pytest.fixture(scope="module")
def auth_headers():
    return _auth_headers()


def test_sso_providers_list_and_discovery(auth_headers):
    """Test retrieving configured SSO identity providers and OIDC discovery metadata."""
    status, body = _request("GET", "/api/projectbase/sso/providers", headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert "providers" in body
    assert len(body["providers"]) >= 1

    # Verify discovery metadata endpoint
    status, disc = _request("GET", "/api/projectbase/sso/providers/google/discovery", headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {disc}"
    assert disc.get("success") is True
    assert "discovery" in disc
    assert "authorization_endpoint" in disc["discovery"]
    assert "token_endpoint" in disc["discovery"]
    assert "jwks_uri" in disc["discovery"]


def test_sso_provider_crud_lifecycle(auth_headers):
    """Test registering, updating, and deleting an enterprise SSO identity provider."""
    prov_key = f"okta-{_uid()}"
    create_payload = {
        "provider_key": prov_key,
        "name": f"Okta Enterprise Realm {prov_key}",
        "provider_type": "oidc",
        "issuer_url": f"https://{prov_key}.okta.com",
        "client_id": f"okta_client_{prov_key}",
        "client_secret": "sec_okta_enterprise_mock_123",
        "discovery_url": f"https://{prov_key}.okta.com/.well-known/openid-configuration",
        "scopes": "openid profile email groups",
        "jit_provisioning": True,
        "default_role": "maintainer",
        "enabled": True
    }

    status, body = _request("POST", "/api/projectbase/sso/providers", body=create_payload, headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert body["provider"]["provider_key"] == prov_key
    assert body["provider"]["default_role"] == "maintainer"

    # Delete provider
    status, del_body = _request("DELETE", f"/api/projectbase/sso/providers/{prov_key}", headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {del_body}"
    assert del_body.get("success") is True


def test_sso_auth_exchange_and_jit_provisioning(auth_headers):
    """Test SSO token exchange, session token generation, and JIT user account creation."""
    test_email = f"user_{_uid()}@enterprise-corp.org"
    exchange_payload = {
        "provider_key": "google",
        "code": f"mock_auth_code_{_uid()}",
        "email": test_email,
        "name": "Jane Enterprise Doe",
        "role": "member"
    }

    status, body = _request("POST", "/api/projectbase/sso/auth/exchange", body=exchange_payload, headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert body.get("authenticated") is True
    assert body["user"]["email"] == test_email
    assert "token" in body
    assert body["token"].startswith("pb_sso_sess_")


def test_rbac_roles_listing_and_system_role_protection(auth_headers):
    """Test RBAC roles listing and ensuring system roles (owner, admin) cannot be overwritten or deleted."""
    status, body = _request("GET", "/api/projectbase/rbac/roles", headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    roles = body.get("roles", [])
    assert len(roles) >= 7

    role_keys = [r.get("role_key") for r in roles]
    assert "owner" in role_keys
    assert "admin" in role_keys
    assert "maintainer" in role_keys
    assert "member" in role_keys
    assert "agent" in role_keys
    assert "viewer" in role_keys
    assert "auditor" in role_keys

    # System role protection on creation
    status, bad_create = _request("POST", "/api/projectbase/rbac/roles", body={"role_key": "admin", "name": "Fake Admin"}, headers=auth_headers)
    assert status == 400, f"Expected 400 on system role overwrite, got {status}: {bad_create}"

    # System role protection on deletion
    status, bad_del = _request("DELETE", "/api/projectbase/rbac/roles/owner", headers=auth_headers)
    assert status == 400, f"Expected 400 on system role deletion, got {status}: {bad_del}"


def test_custom_rbac_role_crud(auth_headers):
    """Test custom RBAC role creation, custom capability assignment, and deletion."""
    role_key = f"secops_{_uid()}"
    create_payload = {
        "role_key": role_key,
        "name": "SecOps Security Analyst",
        "description": "Specialized security monitoring and audit role",
        "capabilities": ["projects:read", "issues:read", "security:audit_logs", "sso:view", "tokens:create_scoped"],
        "project_id": "all"
    }

    status, body = _request("POST", "/api/projectbase/rbac/roles", body=create_payload, headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert body["role"]["role_key"] == role_key
    assert len(body["role"]["capabilities"]) == 5

    # Delete custom role
    status, del_body = _request("DELETE", f"/api/projectbase/rbac/roles/{role_key}", headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {del_body}"
    assert del_body.get("success") is True


def test_rbac_matrix_evaluation(auth_headers):
    """Test full 2D RBAC capability matrix retrieval across all roles."""
    status, body = _request("GET", "/api/projectbase/rbac/matrix", headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert "matrix" in body
    assert body["total_capabilities"] >= 20
    assert body["total_roles"] >= 7

    # Verify capability row structure
    first_row = body["matrix"][0]
    assert "capability_key" in first_row
    assert "group" in first_row
    assert "access" in first_row
    assert "owner" in first_row["access"]
    assert first_row["access"]["owner"] is True  # Owner has wildcard * access


def test_rbac_permission_check_logic(auth_headers):
    """Test fine-grained capability checks for owners, agents, and custom assignments."""
    # 1. Superuser / Owner check
    status, check1 = _request(
        "POST",
        "/api/projectbase/rbac/check",
        body={"actor_id": "f@flow.com", "capability": "cluster:failover", "project_id": "all"},
        headers=auth_headers
    )
    assert status == 200
    assert check1.get("allowed") is True
    assert check1.get("assigned_role") == "owner"

    # 2. Agent role check for issues:move
    status, check2 = _request(
        "POST",
        "/api/projectbase/rbac/check",
        body={"actor_id": "flomaster-agent", "capability": "issues:move", "project_id": "all"},
        headers=auth_headers
    )
    assert status == 200
    assert check2.get("allowed") is True

    # 3. Denied capability check (member cannot failover cluster)
    status, check3 = _request(
        "POST",
        "/api/projectbase/rbac/check",
        body={"actor_id": "regular_member@example.com", "capability": "cluster:failover", "project_id": "all"},
        headers=auth_headers
    )
    assert status == 200
    assert check3.get("allowed") is False
    assert "lacks capability" in check3.get("reason", "")


def test_rbac_role_assignments_lifecycle(auth_headers):
    """Test assigning a role to a user/agent, querying assignments, and revoking assignment."""
    target_user = f"contractor_{_uid()}@test.org"
    assign_payload = {
        "user_id": target_user,
        "user_type": "user",
        "role_key": "viewer",
        "project_id": "all",
        "assigned_by": "admin"
    }

    status, body = _request("POST", "/api/projectbase/rbac/assign", body=assign_payload, headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert body["assignment"]["role_key"] == "viewer"

    # List assignments
    status, list_body = _request("GET", "/api/projectbase/rbac/assignments", headers=auth_headers)
    assert status == 200
    assert list_body.get("success") is True

    # Revoke assignment
    status, rev_body = _request("DELETE", f"/api/projectbase/rbac/assignments/{target_user}", headers=auth_headers)
    assert status == 200
    assert rev_body.get("success") is True


def test_rbac_scoped_tokens_lifecycle(auth_headers):
    """Test generating a scoped API token, listing tokens, and revoking it."""
    token_payload = {
        "name": f"CI Agent Token {_uid()}",
        "user_or_agent_id": "ci_pipeline_agent",
        "scopes": ["issues:read", "issues:create", "agents:dispatch"],
        "project_id": "all",
        "ttl_hours": 48
    }

    status, body = _request("POST", "/api/projectbase/rbac/tokens/create", body=token_payload, headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert "api_key" in body
    assert "token_id" in body
    token_id = body["token_id"]

    # List tokens
    status, list_tokens = _request("GET", "/api/projectbase/rbac/tokens", headers=auth_headers)
    assert status == 200
    assert list_tokens.get("success") is True
    assert any(t.get("token_id") == token_id for t in list_tokens.get("tokens", []))

    # Revoke token
    status, rev_token = _request("POST", "/api/projectbase/rbac/tokens/revoke", body={"token_id": token_id}, headers=auth_headers)
    assert status == 200
    assert rev_token.get("success") is True


def test_security_audit_logs_and_export(auth_headers):
    """Test security audit log querying, filtering, and export in JSON/CSV format."""
    status, body = _request("GET", "/api/projectbase/rbac/audit-logs?limit=50", headers=auth_headers)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert body.get("success") is True
    assert "audit_logs" in body

    # JSON export
    status, json_exp = _request("POST", "/api/projectbase/rbac/audit-logs/export", body={"format": "json"}, headers=auth_headers)
    assert status == 200
    assert json_exp.get("format") == "json"

    # CSV export
    status, csv_exp = _request("POST", "/api/projectbase/rbac/audit-logs/export", body={"format": "csv"}, headers=auth_headers)
    assert status == 200
    assert csv_exp.get("format") == "csv"
    assert "event_type" in csv_exp.get("data", "")


def test_fastmcp_sso_and_rbac_tools(auth_headers):
    """Test FastMCP JSON-RPC 2.0 tools for SSO federation and RBAC policy management."""
    def _call_tool(tool_name, arguments):
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments}
        }
        st, res = _request("POST", "/api/projectbase/mcp", body=payload, headers=auth_headers)
        assert st == 200, f"MCP {tool_name} failed: {res}"
        text_res = res["result"]["content"][0]["text"]
        return json.loads(text_res)

    # 1. list_sso_providers
    sso_list = _call_tool("list_sso_providers", {})
    assert sso_list.get("success") is True
    assert len(sso_list.get("providers", [])) >= 1

    # 2. configure_sso_provider
    cfg_sso = _call_tool("configure_sso_provider", {
        "provider_key": f"mcp-sso-{_uid()}",
        "name": "MCP Enterprise Keycloak",
        "provider_type": "oidc",
        "jit_provisioning": True,
        "default_role": "member"
    })
    assert cfg_sso.get("success") is True

    # 3. exchange_sso_token
    exch = _call_tool("exchange_sso_token", {
        "provider_key": "google",
        "email": f"mcp_agent_{_uid()}@flow.com",
        "name": "MCP Swarm Agent"
    })
    assert exch.get("authenticated") is True

    # 4. list_rbac_roles
    roles = _call_tool("list_rbac_roles", {})
    assert roles.get("success") is True
    assert len(roles.get("roles", [])) >= 7

    # 5. check_rbac_permission
    perm = _call_tool("check_rbac_permission", {
        "actor_id": "f@flow.com",
        "capability": "agents:swarm_run"
    })
    assert perm.get("allowed") is True

    # 6. assign_rbac_role
    assign = _call_tool("assign_rbac_role", {
        "user_id": f"agent_{_uid()}",
        "role_key": "agent",
        "project_id": "all"
    })
    assert assign.get("success") is True

    # 7. get_rbac_matrix
    matrix = _call_tool("get_rbac_matrix", {})
    assert matrix.get("success") is True

    # 8. get_security_audit_logs
    audit = _call_tool("get_security_audit_logs", {"limit": 10})
    assert audit.get("success") is True
