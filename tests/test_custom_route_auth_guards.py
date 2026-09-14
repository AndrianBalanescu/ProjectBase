"""Custom-route auth guards.

Every mutating custom route (POST/PUT/PATCH/DELETE under /api/projectbase/*)
must reject anonymous callers with 401 and accept an authenticated superuser.
This file pins that contract so future hooks cannot silently regress.

Intentionally public routes (documented in the hooks):
  - GET  /api/projectbase/health (30_custom_routes)
  - POST /api/projectbase/health (30_custom_routes: liveness, no data access)
  - GET  /api/projectbase/version, /stats is authed, docs/openapi are public

Intentionally NOT in the guarded list:
  - POST /api/projectbase/webhooks/git (45_github_importer CI receiver):
    auth = e.auth OR valid X-Hub-Signature-256 HMAC over the raw body keyed
    by PROJECTBASE_GIT_WEBHOOK_SECRET env (fail-closed when unset).
    Contract E2E: tests/test_git_webhook_hmac.py.
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
            return resp.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw
    except urllib.error.URLError as e:
        pytest.fail(f"Request to {method} {path} failed: {e.reason}")

def _super_token():
    status, res = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200 or "token" not in res:
        pytest.fail(f"Superuser authentication failed ({status}): {res}")
    return res["token"]


# One representative mutating route per surviving hook file. The guard pattern
# is identical across hooks; these samples catch regressions per file.
# Engine hooks (91-111) were stripped to the engine-experiments branch; their
# route samples were removed with them. If an engine returns, re-add a sample.
GUARDED_ROUTE_SAMPLES = [
    # 30_custom_routes.pb.js
    ("POST", "/api/projectbase/quick-task", {"title": "guard-probe"}),
    ("PUT", "/api/projectbase/notification-settings", {"telegram_chat_id": "x"}),
    # 31_bulk_actions.pb.js
    ("POST", "/api/projectbase/issues/bulk-update", {"ids": ["x"], "data": {}}),
    ("POST", "/api/projectbase/issues/bulk-delete", {"ids": ["x"]}),
    # 32_issue_relations.pb.js
    ("POST", "/api/projectbase/issues/nonexistent74/relations", {"type": "blocks", "target": "x"}),
    ("DELETE", "/api/projectbase/issues/nonexistent74/relations", {"type": "blocks", "target": "x"}),
    # 40_importers.pb.js
    ("POST", "/api/projectbase/import/csv", {"content": "a,b\n1,2", "project": "x"}),
    # 70_ai_assist.pb.js
    ("POST", "/api/projectbase/ai-assist", {"action": "x"}),
    # 80_agent_triggers.pb.js
    ("POST", "/api/projectbase/dispatch-agent", {"issue": "x"}),
    # 90_agents.pb.js
    ("POST", "/api/projectbase/agents/sync", {}),
    # 55_notifications.pb.js
    ("POST", "/api/projectbase/notifications/read-all", {}),
]


@pytest.mark.parametrize("method,path,body", GUARDED_ROUTE_SAMPLES)
def test_mutating_route_rejects_anonymous(method, path, body):
    """Anonymous callers must be denied (401/403) on every guarded route sample."""
    status, resp = _request(method, path, body)
    assert status in (401, 403), (
        f"{method} {path} accepted an anonymous write (got {status}: {str(resp)[:120]})"
    )


@pytest.mark.parametrize("method,path,body", GUARDED_ROUTE_SAMPLES)
def test_mutating_route_accepts_authenticated(method, path, body):
    """With a superuser token the same routes reach business logic (not 401/403).

    Nonexistent IDs must yield a NOT-FOUND (or validation 400) rather than an
    auth failure: proves the guard ran before handler logic.
    """
    token = _super_token()
    status, resp = _request(method, path, body, headers={"Authorization": token})
    assert status not in (401, 403), (
        f"{method} {path} rejected an authenticated superuser: {status} {str(resp)[:120]}"
    )


def test_public_health_stays_open():
    """Liveness probes must remain reachable without auth."""
    status, body = _request("GET", "/api/projectbase/health")
    assert status == 200
    assert body.get("status") == "healthy"
    status, body = _request("POST", "/api/projectbase/health", {})
    assert status == 200
    assert body.get("status") == "healthy"


def test_stats_requires_auth():
    """Stats aggregates user data; anonymous access must be denied."""
    status, _ = _request("GET", "/api/projectbase/stats")
    assert status == 401


def test_version_and_docs_stay_public():
    """Version and developer docs must remain reachable without auth."""
    for path in ("/api/projectbase/version", "/api/openapi.json"):
        status, _ = _request("GET", path)
        assert status == 200, f"public route {path} returned {status}"
