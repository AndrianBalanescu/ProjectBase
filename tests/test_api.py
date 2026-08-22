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
import uuid
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


# ---------------------------------------------------------------------------
# CSV importer (cycle 2)
# ---------------------------------------------------------------------------

def test_importer_requires_authentication():
    status, _ = _request("POST", "/api/projectbase/import/csv",
                         {"project_id": "x", "rows": [{"title": "y"}]})
    assert status == 401


def test_importer_missing_project():
    status, _ = _request("POST", "/api/projectbase/import/csv",
                         {"rows": [{"title": "y"}]},
                         headers={"Authorization": _superuser_token()})
    assert 400 <= status < 500


def _get_any_project_id():
    status, body = _get_authed("/api/collections/projects/records?perPage=1")
    assert status == 200, f"could not list projects: {status} {body}"
    items = body.get("items", [])
    assert items, "no seeded projects found for importer test"
    return items[0]["id"]


def _uid():
    return uuid.uuid4().hex[:10]


def test_importer_creates_issue():
    pid = _get_any_project_id()
    status, body = _request(
        "POST", "/api/projectbase/import/csv",
        {"project_id": pid, "rows": [{"title": f"Importer Test Issue {_uid()}",
                                      "description": "created by pytest",
                                      "status": "todo", "priority": "high"}]},
        headers={"Authorization": _superuser_token()})
    assert status == 200, f"import failed: {status} {body}"
    assert body["imported"] == 1
    assert body["skipped"] == 0


def test_importer_dedup_title_skips():
    """Same (project, title) imported twice => second is skipped."""
    pid = _get_any_project_id()
    title = f"Importer Dedup Title {_uid()}"
    payload = {"project_id": pid, "rows": [{"title": title}]}
    hdr = {"Authorization": _superuser_token()}
    status, body = _request("POST", "/api/projectbase/import/csv", payload, headers=hdr)
    assert status == 200 and body["imported"] == 1
    # second import: same title, must be skipped
    status2, body2 = _request("POST", "/api/projectbase/import/csv", payload, headers=hdr)
    assert status2 == 200
    assert body2["imported"] == 0
    assert body2["skipped"] == 1


def test_importer_source_key_dedup_cross_request():
    """A source_key seen in a prior import skips even if the title changes."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}
    key = f"k-{_uid()}"
    payload1 = {"project_id": pid, "rows": [{"title": f"Keyed A {_uid()}", "source_key": key}]}
    status, body = _request("POST", "/api/projectbase/import/csv", payload1, headers=hdr)
    assert status == 200 and body["imported"] == 1
    # different title, same source_key => skipped
    payload2 = {"project_id": pid, "rows": [{"title": f"Keyed B {_uid()}", "source_key": key}]}
    status2, body2 = _request("POST", "/api/projectbase/import/csv", payload2, headers=hdr)
    assert status2 == 200
    assert body2["imported"] == 0
    assert body2["skipped"] == 1


def test_importer_normalizes_status_and_priority():
    pid = _get_any_project_id()
    status, body = _request(
        "POST", "/api/projectbase/import/csv",
        {"project_id": pid, "rows": [{"title": f"Norm Check {_uid()}",
                                           "status": "In Progress", "priority": "P1"}]},
        headers={"Authorization": _superuser_token()})
    assert status == 200 and body["imported"] == 1


def test_importer_missing_title_reports_error():
    pid = _get_any_project_id()
    status, body = _request(
        "POST", "/api/projectbase/import/csv",
        {"project_id": pid, "rows": [{"title": " "}]},
        headers={"Authorization": _superuser_token()})
    assert status == 200
    assert body["imported"] == 0
    assert body["errors"]


def test_importer_fuzz_malformed_rows():
    pid = _get_any_project_id()
    # mixed: valid + malformed should not 500; valid row commits
    status, body = _request(
        "POST", "/api/projectbase/import/csv",
        {"project_id": pid, "rows": [{"title": f"Fuzz Good {_uid()}"},
                                          "not-an-object",
                                          {"no_title": 1}]},
        headers={"Authorization": _superuser_token()})
    assert status == 200, f"importer fuzz crashed: {status} {body}"
    assert body["imported"] == 1


def test_importer_source_metadata_persisted():
    """Imported issues must carry source_metadata provenance JSON."""
    pid = _get_any_project_id()
    title = f"Importer Metadata Check {_uid()}"
    key = f"md-{_uid()}"
    status, _ = _request(
        "POST", "/api/projectbase/import/csv",
        {"project_id": pid, "rows": [{"title": title, "source_key": key}]},
        headers={"Authorization": _superuser_token()})
    assert status == 200
    # fetch the record back and assert source_metadata
    from urllib.parse import quote
    q = "/api/collections/issues/records?filter=" + quote(f"(title='{title}')") + "&perPage=5"
    st, recs = _get_authed(q)
    assert st == 200
    assert recs.get("items"), "imported issue not found"
    sm = recs["items"][0].get("source_metadata")
    assert sm, "source_metadata not persisted"
    assert sm.get("importer") == "csv"
    assert sm.get("source_key") == key



# ---------------------------------------------------------------------------
# GitHub importer (cycle 3)
# ---------------------------------------------------------------------------

def _github_import(payload, token=None):
    return _request(
        "POST", "/api/projectbase/import/github", payload,
        headers={"Authorization": token or _superuser_token()})


def test_github_requires_authentication():
    status, _ = _request("POST", "/api/projectbase/import/github",
                         {"project_id": "x", "repo": "octocat/Hello-World"})
    assert status == 401


def test_github_requires_repo_format():
    pid = _get_any_project_id()
    status, _ = _github_import({"project_id": pid, "repo": "no-slash"})
    assert 400 <= status < 500


def test_github_imports_public_issues():
    """Imports a small public repo and verifies provenance + idempotent re-import."""
    pid = _get_any_project_id()
    payload = {"project_id": pid, "repo": "octocat/Hello-World", "state": "all", "max_issues": 3}
    status, body = _github_import(payload)
    assert status == 200, f"github import failed: {status} {body}"
    assert body.get("repo") == "octocat/Hello-World"
    # At least one issue is present (imported now or already-imported from a
    # prior run — Hello-World has non-PR issues, so imported+skipped > 0).
    assert body["imported"] + body["skipped"] > 0

    # Re-import: everything already there by source_key is skipped, nothing errors.
    status2, second = _github_import(payload)
    assert status2 == 200, f"reimport failed: {status2} {second}"
    assert second.get("imported") == 0, f"reimport should not duplicate: {second}"
    assert not second.get("errors"), f"reimport had errors: {second}"

    # Provenance must be persisted as importer=github with a gh_number.
    from urllib.parse import quote
    st, recs = _get_authed("/api/collections/issues/records?perPage=50&sort=-created")
    assert st == 200
    found = None
    for it in recs.get("items", []):
        sm = it.get("source_metadata") or {}
        if sm.get("importer") == "github" and str(sm.get("source_key", "")).startswith("gh:"):
            found = it
            break
    assert found, "no GitHub-imported issue found"
    sm = found.get("source_metadata")
    assert sm.get("importer") == "github"
    assert sm.get("gh_number") is not None


def test_github_nonexistent_repo_graceful():
    pid = _get_any_project_id()
    status, body = _github_import({"project_id": pid, "repo": "definitely/not-a-real-repo-xyz"})
    assert status == 200, f"should degrade gracefully: {status} {body}"
    assert body.get("imported") == 0
    assert body.get("errors"), "expected an error for a missing repo"

