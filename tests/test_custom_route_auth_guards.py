"""Cycle 74 hardening — custom-route auth guards.

Every mutating custom route (POST/PUT/PATCH/DELETE under /api/projectbase/*)
must reject anonymous callers with 401 and accept an authenticated superuser.
This file pins that contract so future engine hooks cannot silently regress.

Intentionally public routes (documented in the hooks):
  - GET  /api/projectbase/health (30_custom_routes)
  - POST /api/projectbase/health (30_custom_routes: liveness, no data access)
  - GET  /api/projectbase/sdk/languages, /sdk/templates/{lang}, /docs/recipes,
         /docs/spec (100_sdk_observability_engine: public developer docs)

Intentionally NOT in the guarded list:
  - POST /api/projectbase/webhooks/git (96_git_workspace_engine): universal
    CI/GitHub/GitLab receiver. Auth = e.auth OR valid X-Hub-Signature-256
    HMAC over the raw body keyed by PROJECTBASE_GIT_WEBHOOK_SECRET env
    (fail-closed when unset). Contract E2E: tests/test_git_webhook_hmac.py.
"""

import json
import os
import urllib.request
import urllib.error

import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


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


def _super_token():
    status, res = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200 or "token" not in res:
        pytest.fail(f"Superuser authentication failed ({status}): {res}")
    return res["token"]


# One representative mutating route per engine hook. The guard pattern is
# identical across hooks; these samples catch regressions per file.
GUARDED_ROUTE_SAMPLES = [
    ("POST", "/api/projectbase/tenants", {"name": "guard-probe-74"}),
    ("POST", "/api/projectbase/tenants/nonexistent74/members", {"user": "x", "role": "admin"}),
    ("PATCH", "/api/projectbase/tenants/nonexistent74", {"name": "x"}),
    ("DELETE", "/api/projectbase/tenants/nonexistent74/members/x", None),
    ("POST", "/api/projectbase/observability/alerts/configure", {"metric_name": "x"}),
    ("DELETE", "/api/projectbase/observability/alerts/nonexistent74", None),
    ("POST", "/api/projectbase/auto-heal/policies", {"name": "x"}),
    ("POST", "/api/projectbase/auto-heal/trigger", {}),
    ("POST", "/api/projectbase/sessions/ingest", {"agent_name": "x"}),
    ("POST", "/api/projectbase/sessions/heartbeat", {"pid": 1}),
    ("POST", "/api/projectbase/sessions/complete", {"status": "done"}),
    ("POST", "/api/projectbase/merges/propose", {"issue": "x"}),
    ("POST", "/api/projectbase/billing/policies", {"name": "x"}),
    ("POST", "/api/projectbase/evals/suites", {"name": "x"}),
    ("POST", "/api/projectbase/sandboxes/provision", {"name": "x"}),
    ("POST", "/api/projectbase/incidents", {"title": "x"}),
    ("POST", "/api/projectbase/knowledge/nodes", {"title": "x"}),
    ("POST", "/api/projectbase/knowledge/verify-invariants", {}),
    ("POST", "/api/projectbase/reviews", {"name": "x"}),
    ("POST", "/api/projectbase/releases", {"name": "x"}),
    ("POST", "/api/projectbase/security/scans", {"name": "x"}),
    ("POST", "/api/projectbase/tdd/suites", {"name": "x"}),
    ("POST", "/api/projectbase/debug/sessions", {"name": "x"}),
    ("POST", "/api/projectbase/arch/graphs", {"name": "x"}),
    ("POST", "/api/projectbase/perf/profiles", {"name": "x"}),
    ("POST", "/api/projectbase/dag/decompose", {"issue": "x"}),
    ("POST", "/api/projectbase/agents/sync", {}),
    ("POST", "/api/projectbase/mcp", {"jsonrpc": "2.0", "method": "tools/list", "id": 1}),
    ("POST", "/api/projectbase/webhooks/endpoints", {"name": "x"}),
    ("POST", "/api/projectbase/webhooks/dispatch", {"event": "x"}),
    ("POST", "/api/projectbase/cluster/nodes/register", {"node_id": "x"}),
    ("POST", "/api/projectbase/agents/autoscale", {"name": "x"}),
    ("POST", "/api/projectbase/git/artifacts", {"name": "x"}),
    ("POST", "/api/projectbase/semantic/review", {"title": "x"}),
    ("POST", "/api/projectbase/sessions/nonexistent74/branch", {"name": "x"}),
    ("POST", "/api/projectbase/consensus/gates", {"name": "x"}),
    ("POST", "/api/projectbase/automations/rules", {"name": "x"}),
    ("POST", "/api/projectbase/leases/acquire", {"issue_id": "x"}),
    ("POST", "/api/projectbase/semantic/policies", {"name": "x"}),
    ("POST", "/api/projectbase/sso/providers", {"name": "x"}),
    ("POST", "/api/projectbase/rbac/roles", {"name": "x"}),
    ("POST", "/api/projectbase/rbac/assign", {"role": "x"}),
    ("POST", "/api/projectbase/rbac/tokens/create", {"name": "x"}),
    ("POST", "/api/projectbase/automations/trigger", {"event": "x"}),
]


@pytest.mark.parametrize("method,path,body", GUARDED_ROUTE_SAMPLES)
def test_mutating_route_rejects_anonymous(method, path, body):
    """Anonymous callers must be denied (401/403) on every guarded route sample."""
    status, resp = _request(method, path, body)
    assert status in (401, 403), (
        f"{method} {path} accepted an anonymous write (got {status}: {str(resp)[:120]})"
    )


@pytest.mark.parametrize("method,path,body", GUARDED_ROUTE_SAMPLES[:8])
def test_mutating_route_accepts_authenticated(method, path, body):
    """With a superuser token the same routes reach business logic (not 401/403)."""
    token = _super_token()
    status, resp = _request(method, path, body, headers={"Authorization": token})
    assert status not in (401, 403), (
        f"{method} {path} rejected an authenticated superuser: {status} {str(resp)[:120]}"
    )


def test_public_developer_docs_stay_open():
    """Documented public reads (SDK/docs) must remain reachable without auth."""
    for path in ("/api/projectbase/sdk/languages", "/api/projectbase/docs/recipes", "/api/projectbase/docs/spec"):
        status, _ = _request("GET", path)
        assert status == 200, f"public docs route {path} returned {status}"


def test_health_endpoint_stays_public():
    status, body = _request("POST", "/api/projectbase/health", {})
    assert status == 200
    assert body.get("status") == "healthy"


def test_session_syncer_contract_authed_ingest():
    """The session syncer's ingest call must succeed with credentials (syncer
    authenticates via PROJECTBASE_TOKEN / PROJECTBASE_EMAIL+PASSWORD)."""
    token = _super_token()
    payload = {
        "agent_name": "guard-regression-74",
        "machine": "pytest",
        "session_key": "guard-regression-74-1",
        "status": "completed",
        "message": "auth contract probe",
    }
    status, body = _request("POST", "/api/projectbase/sessions/ingest", payload,
                            headers={"Authorization": token})
    assert status in (200, 201), f"authed ingest failed: {status} {str(body)[:150]}"