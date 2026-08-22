"""ProjectBase API mechanical proof suite.

Runs against a live ProjectBase instance (default http://127.0.0.1:8120).
Override with PROJECTBASE_URL env var. Covers:
  - Core service endpoints (health, stats, openapi, llms.txt, docs)
  - PocketBase API rule enforcement (anonymous access must not leak/create)
  - Superuser bootstrap (protocol credential f@flow.com)
  - Adversarial fuzzing (malformed JSON, missing fields, oversized strings)

Usage:
    uv run --with pytest pytest -v tests/
"""

import json
import os
import urllib.error
import urllib.request

import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")

_TOKEN_CACHE = {}


def _superuser_token() -> str:
    """Authenticate as the protocol-seeded superuser, cached per session."""
    if "token" not in _TOKEN_CACHE:
        status, body = _request(
            "POST", "/api/collections/_superusers/auth-with-password",
            {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
        assert status == 200, f"superuser auth failed: {status} {body}"
        _TOKEN_CACHE["token"] = body["token"]
    return _TOKEN_CACHE["token"]


def _request(method: str, path: str, body=None, headers=None, timeout=15):
    """Perform an HTTP request, returning (status, parsed_json_or_text)."""
    url = f"{BASE_URL}{path}"
    data = None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode(errors="replace")
            status = resp.status
    except urllib.error.HTTPError as err:
        raw = err.read().decode(errors="replace")
        status = err.code
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


def _get(path):
    return _request("GET", path)


def _get_authed(path):
    return _request("GET", path, headers={"Authorization": _superuser_token()})


# ---------------------------------------------------------------------------
# Core service endpoints
# ---------------------------------------------------------------------------

def test_health_endpoint():
    status, body = _get("/api/projectbase/health")
    assert status == 200
    assert body["status"] == "healthy"
    assert body["service"] == "ProjectBase"


def test_stats_endpoint():
    status, body = _get_authed("/api/projectbase/stats")
    assert status == 200, f"stats requires auth (seeded superuser): {status} {body}"
    assert "total_projects" in body


def test_openapi_spec_valid():
    status, body = _get("/openapi.json")
    assert status == 200
    assert isinstance(body, dict)
    assert body.get("openapi", "").startswith("3.")
    assert "paths" in body


def test_llms_txt_served():
    status, body = _get("/llms.txt")
    assert status == 200
    assert "ProjectBase" in body


def test_docs_page_served():
    status, body = _get("/docs/")
    assert status == 200
    assert "Scalar" in body or "api-reference" in body


def test_index_served():
    status, body = _get("/")
    assert status == 200
    assert "ProjectBase" in body


def test_vendor_assets_local():
    """Zero-build frontend must serve vendored bundles offline."""
    for asset in ("/vendor/vue.global.prod.js", "/vendor/tailwindcss.js",
                  "/vendor/pocketbase.umd.js", "/vendor/sortable.min.js"):
        status, body = _request("GET", asset)
        assert status == 200, f"{asset} missing"
        assert len(body) > 1000, f"{asset} suspiciously small"


# ---------------------------------------------------------------------------
# Security: API rule enforcement
# ---------------------------------------------------------------------------

def test_anonymous_issue_create_rejected():
    status, body = _request("POST", "/api/collections/issues/records",
                            {"title": "anon-pwn-attempt"})
    assert 400 <= status < 500, f"anon create must be rejected, got {status}"
    assert status != 200


def test_anonymous_user_list_no_leak():
    """users listRule is admin/manager-only: anon must see zero records."""
    status, body = _get("/api/collections/users/records")
    assert status in (200, 403)
    if status == 200:
        assert body.get("items", []) == [], "anonymous user leak!"
        assert body.get("totalItems", 0) == 0


def test_anonymous_issue_list_no_leak():
    status, body = _get("/api/collections/issues/records")
    assert status in (200, 403)
    if status == 200:
        assert body.get("items", []) == [], "anonymous issue leak!"
        assert body.get("totalItems", 0) == 0


def test_superusers_collection_hidden_from_anon():
    status, _ = _get("/api/collections/_superusers/records")
    assert status in (400, 403, 404), "superusers collection must not be listable"


def test_superuser_bootstrap_credential():
    """The Flow protocol superuser must be seeded and able to authenticate."""
    status, body = _request(
        "POST", "/api/collections/_superusers/auth-with-password",
        {"identity": "f@flow.com", "password": "superdev123"})
    assert status == 200, f"protocol superuser auth failed: {status} {body}"
    assert body.get("token", "").count(".") == 2  # JWT shape


# ---------------------------------------------------------------------------
# Adversarial fuzzing
# ---------------------------------------------------------------------------

def test_fuzz_ai_assist_malformed_json():
    status, body = _request("POST", "/api/projectbase/ai-assist",
                            b"{not valid json!!")
    assert status != 500, f"malformed JSON crashed endpoint: {status} {body}"
    assert 400 <= status < 500


def test_fuzz_ai_assist_missing_fields():
    status, body = _request("POST", "/api/projectbase/ai-assist", {})
    assert status != 500, f"empty payload crashed endpoint: {status} {body}"


def test_fuzz_ai_assist_oversized_title():
    status, body = _request(
        "POST", "/api/projectbase/ai-assist",
        {"action": "generate_subtasks", "title": "A" * 200_000},
        timeout=30)
    assert status != 500, f"oversized title crashed endpoint: {status} {body}"


def test_fuzz_unknown_collection_404():
    status, _ = _request("POST", "/api/collections/nonexistent_xyz/records",
                         {"title": "x"})
    assert 400 <= status < 500


def test_fuzz_health_trailing_garbage_path():
    status, _ = _get("/api/projectbase/health/../../etc/passwd")
    assert status != 500


# ---------------------------------------------------------------------------
# AI copilot happy path (requires OmniRoute gateway on :20128, as in CI)
# ---------------------------------------------------------------------------

def test_stats_requires_authentication():
    """Custom routes must reject anonymous access (auth hardening)."""
    status, _ = _get("/api/projectbase/stats")
    assert status == 401


def test_ai_assist_requires_authentication():
    status, _ = _request("POST", "/api/projectbase/ai-assist",
                         {"action": "generate_subtasks", "title": "x"})
    assert status == 401


def test_ai_assist_generate_subtasks():
    status, body = _request(
        "POST", "/api/projectbase/ai-assist",
        {"action": "generate_subtasks", "title": "Test CI Task"},
        headers={"Authorization": _superuser_token()}, timeout=60)
    assert status == 200
    assert body.get("success") is True
