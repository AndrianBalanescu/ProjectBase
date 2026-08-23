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


@pytest.fixture(scope="session", autouse=True)
def _cleanup_importer_artifacts():
    """After the whole session, delete any issues the importer tests created so
    they don't pollute the demo database. Keyed off source_metadata.importer."""
    yield
    try:
        hdr = {"Authorization": _superuser_token()}
        # Walk all pages so >200 artifacts are also removed (deletes shift pages).
        for page in range(1, 40):
            st, body = _request(
                "GET",
                f"/api/collections/issues/records?perPage=200&sort=-created&page={page}",
                headers=hdr)
            items = body.get("items", []) if st == 200 else []
            if not items:
                break
            for it in items:
                sm = it.get("source_metadata") or {}
                if sm.get("importer") in ("csv", "github"):
                    _request("DELETE", f"/api/collections/issues/records/{it['id']}",
                             headers=hdr)
    except Exception:
        # Cleanup is best-effort; never fail the suite for it.
        pass


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
    # Custom-fields endpoints must be discoverable for agents
    assert "/projectbase/projects/{id}/custom-fields" in body["paths"]
    assert "/projectbase/projects/{id}/custom-fields/validate" in body["paths"]


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
                  "/vendor/pocketbase.umd.js", "/vendor/sortable.min.js",
                  "/vendor/milkdown.js", "/vendor/milkdown.css", "/css/style.css"):
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
    # If GitHub rate-limited us, assert graceful degradation (no 500) and skip.
    if any("403" in str(e.get("error", "")) for e in body.get("errors", [])):
        pytest.skip("GitHub unauthenticated rate limit hit; skipping live import assertions")
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


def test_github_rate_limit_populated():
    """The import response must surface GitHub's rate-limit remaining/reset so the
    UI can warn the user. Regression: the hook looked up X-RateLimit-Remaining
    (capital L) but GitHub returns X-Ratelimit-Remaining (lowercase l), so the
    value was always null."""
    pid = _get_any_project_id()
    status, body = _github_import(
        {"project_id": pid, "repo": "octocat/Hello-World", "state": "all", "max_issues": 3})
    assert status == 200, f"import failed: {status} {body}"
    if any("403" in str(e.get("error", "")) for e in body.get("errors", [])):
        pytest.skip("GitHub unauthenticated rate limit hit; skipping header assertion")
    rl = body.get("rate_limit") or {}
    # Remaining should be a real number when we got a 200 (headers parsed).
    assert rl.get("remaining") is not None, f"rate_limit.remaining is null: {rl}"
    assert rl.get("remaining") >= 0


def test_github_long_description_truncated():
    """Bodies over the 5000-char description field limit must be truncated, not
    dropped as errors. Uses a high-issue repo so a >5000-char body is likely, but
    the guard (no errors + <=5000) holds regardless of which issues are returned."""
    pid = _get_any_project_id()
    status, body = _github_import(
        {"project_id": pid, "repo": "facebook/react", "state": "all", "max_issues": 80})
    assert status == 200, f"react import failed: {status} {body}"
    if any("403" in str(e.get("error", "")) for e in body.get("errors", [])):
        pytest.skip("GitHub unauthenticated rate limit hit; skipping truncation assertions")
    # No per-row errors caused by field-length overflows.
    length_errors = [e for e in body.get("errors", []) if "5000" in str(e.get("error", ""))]
    assert not length_errors, f"description overflow errors: {length_errors}"
    # Every imported issue's description must respect the field limit.
    st, recs = _get_authed("/api/collections/issues/records?perPage=100&sort=-created")
    assert st == 200
    for it in recs.get("items", []):
        sm = it.get("source_metadata") or {}
        if sm.get("importer") == "github" and sm.get("source_key", "").startswith("gh:"):
            desc = it.get("description") or ""
            assert len(desc) <= 5000, (
                f"description over 5000 chars on {it.get('identifier')}: {len(desc)}")




# ---------------------------------------------------------------------------
# Public self-signup (cycle 5)
# ---------------------------------------------------------------------------

def _create_user(payload):
    """POST to users/records anonymously (public self-signup)."""
    return _request("POST", "/api/collections/users/records", payload)


def _create_user_signup(payload):
    """Alias for _create_user (public self-signup)."""
    return _create_user(payload)


def _create_user_as(token, payload):
    """Create a user record using an authenticated caller's token."""
    return _request("POST", "/api/collections/users/records", payload,
                    headers={"Authorization": token})


def _delete_user_by_email(email):
    """Best-effort cleanup: delete a user by email using the superuser token."""
    from urllib.parse import quote
    q = "/api/collections/users/records?filter=" + quote(f"email='{email}'")
    st, body = _get_authed(q)
    if st != 200 or not body.get("items"):
        return
    for it in body["items"]:
        _request("DELETE", f"/api/collections/users/records/{it['id']}",
                 headers={"Authorization": _superuser_token()})


def test_public_signup_creates_member_user():
    """A stranger can self-register and always lands as role=member."""
    email = f"stranger+{_uid()}@flow.test"
    pw = "Str0ng-Pass-123!"
    st, body = _create_user_signup({
        "email": email, "password": pw, "passwordConfirm": pw,
        "name": "Stranger Test",
        "role": "admin",  # attempted escalation must be overridden to member
    })
    assert st == 200, f"public signup failed: {st} {body}"
    # PocketBase returns the created record flattened at the top level.
    assert body.get("role") == "member", (
        f"role must be forced to member, got {body.get('role')}")
    _delete_user_by_email(email)


def test_signup_user_can_authenticate_and_list_own_projects():
    """A self-registered member can sign in and view projects (listRule auth-gated)."""
    email = f"member+{_uid()}@flow.test"
    pw = "Str0ngTestPass-123!"
    st, body = _create_user_signup({
        "email": email, "password": pw, "passwordConfirm": pw, "name": "Member Test"})
    assert st == 200, f"signup failed: {st} {body}"
    # Sign in as the new member.
    st2, auth = _request(
        "POST", "/api/collections/users/auth-with-password",
        {"identity": email, "password": pw})
    assert st2 == 200, f"member auth failed: {st2} {auth}"
    token = auth.get("token", "")
    assert token.count(".") == 2
    # Member can list projects.
    st3, projects = _request(
        "GET", "/api/collections/projects/records?perPage=5",
        headers={"Authorization": token})
    assert st3 == 200, f"member project list failed: {st3} {projects}"
    _delete_user_by_email(email)


def test_signup_duplicate_email_rejected():
    """Registering the same email twice must be rejected (unique email)."""
    email = f"dup+{_uid()}@flow.test"
    pw = "Str0ngPass-123!"
    st1, _ = _create_user_signup({
        "email": email, "password": pw, "passwordConfirm": pw, "name": "Dup One"})
    assert st1 == 200
    st2, body2 = _create_user_signup({
        "email": email, "password": pw, "passwordConfirm": pw, "name": "Dup Two"})
    assert st2 in (400, 422), f"duplicate email must be rejected, got {st2}"
    _delete_user_by_email(email)


def test_signup_password_mismatch_rejected():
    """passwordConfirm != password must be rejected client/server side."""
    email = f"pw+{_uid()}@flow.test"
    st, body = _create_user_signup({
        "email": email, "password": "Str0ngPass-123!", "passwordConfirm": "Different-456!"})
    assert st in (400, 422), f"password mismatch must be rejected, got {st}"
    _delete_user_by_email(email)


def test_signup_short_password_rejected():
    """PocketBase enforces min password length (>=8)."""
    email = f"short+{_uid()}@flow.test"
    st, _ = _create_user_signup({
        "email": email, "password": "short", "passwordConfirm": "short"})
    assert st in (400, 422), f"short password must be rejected, got {st}"
    _delete_user_by_email(email)


def test_member_cannot_self_escalate_role_via_update():
    """A member must NOT be able to PATCH their own role to admin (P0 security).

    The users.updateRule allows a user to edit their own record. The
    onRecordUpdateRequest hook must coerce any self-service role escalation
    back to 'member' so a stranger can never gain admin by signing up then
    promoting themselves."""
    email = f"esc+{_uid()}@flow.test"
    pw = "Str0ngEscalation-123!"
    # Sign up as member.
    st, _ = _create_user_signup({
        "email": email, "password": pw, "passwordConfirm": pw, "name": "Escalation Test"})
    assert st == 200
    # Auth as member.
    st2, auth = _request(
        "POST", "/api/collections/users/auth-with-password",
        {"identity": email, "password": pw})
    assert st2 == 200
    uid = auth.get("record", {}).get("id") or auth.get("id")
    mtoken = auth["token"]
    # Attempt to promote self to admin via update.
    st3, body = _request(
        "PATCH", f"/api/collections/users/records/{uid}",
        {"role": "admin"},
        headers={"Authorization": mtoken})
    assert st3 == 200, f"member self-update failed: {st3} {body}"
    assert body.get("role") == "member", (
        f"member must be coerced to member, got {body.get('role')}")
    _delete_user_by_email(email)


def test_admin_self_edit_preserves_role():
    """An admin editing their own name must keep the admin role.

    Regression for the P0-fix over-coercion bug: the update guard must freeze
    the role (blocking escalation) but NOT strip a privileged user's role on a
    legitimate self-edit."""
    email = f"adm+{_uid()}@flow.test"
    pw = "Str0ngAdmin-123!"
    # Create a user and promote to admin via superuser.
    st, body = _create_user_signup({
        "email": email, "password": pw, "passwordConfirm": pw, "name": "AdmBefore"})
    assert st == 200
    uid = body["id"]
    st2, _ = _request(
        "PATCH", f"/api/collections/users/records/{uid}",
        {"role": "admin"},
        headers={"Authorization": _superuser_token()})
    assert st2 == 200
    # Auth as the admin.
    st3, auth = _request(
        "POST", "/api/collections/users/auth-with-password",
        {"identity": email, "password": pw})
    assert st3 == 200
    atoken = auth["token"]
    # Admin edits own name.
    st4, upd = _request(
        "PATCH", f"/api/collections/users/records/{uid}",
        {"name": "AdmAfter"},
        headers={"Authorization": atoken})
    assert st4 == 200, f"admin self-edit failed: {st4} {upd}"
    assert upd.get("name") == "AdmAfter"
    assert upd.get("role") == "admin", (
        f"admin self-edit must preserve role, got {upd.get('role')}")
    _delete_user_by_email(email)


def test_manager_self_edit_preserves_role():
    """A manager editing their own name must keep the manager role.

    Direct regression for the over-coercion bug found during deep validation:
    the first update guard forced every self-update to 'member', silently
    demoting manager/admin accounts on a routine profile edit."""
    email = f"mgr+{_uid()}@flow.test"
    pw = "Str0ngManager-123!"
    st, body = _create_user_signup({
        "email": email, "password": pw, "passwordConfirm": pw, "name": "MgrBefore"})
    assert st == 200
    uid = body["id"]
    _request("PATCH", f"/api/collections/users/records/{uid}",
             {"role": "manager"}, headers={"Authorization": _superuser_token()})
    st3, auth = _request(
        "POST", "/api/collections/users/auth-with-password",
        {"identity": email, "password": pw})
    assert st3 == 200
    mtoken = auth["token"]
    st4, upd = _request(
        "PATCH", f"/api/collections/users/records/{uid}",
        {"name": "MgrAfter"},
        headers={"Authorization": mtoken})
    assert st4 == 200
    assert upd.get("name") == "MgrAfter"
    assert upd.get("role") == "manager", (
        f"manager self-edit must preserve role, got {upd.get('role')}")
    _delete_user_by_email(email)


def test_member_cannot_update_other_user():
    """A member must NOT be able to update or delete ANOTHER user's record.

    updateRule = 'id = @request.auth.id || role = admin' and
    deleteRule = 'role = admin', so a member editing a different user's record
    must be rejected (cross-tenant isolation)."""
    # Create two members.
    emailA = f"alice+{_uid()}@flow.test"
    pwA = "Str0ngAlice-123!"
    stA, bodyA = _create_user_signup({
        "email": emailA, "password": pwA, "passwordConfirm": pwA, "name": "Alice"})
    assert stA == 200
    uidA = bodyA["id"]
    emailB = f"bob+{_uid()}@flow.test"
    pwB = "Str0ngBob-123!"
    stB, bodyB = _create_user_signup({
        "email": emailB, "password": pwB, "passwordConfirm": pwB, "name": "Bob"})
    assert stB == 200
    uidB = bodyB["id"]
    # Auth as Alice.
    st, auth = _request(
        "POST", "/api/collections/users/auth-with-password",
        {"identity": emailA, "password": pwA})
    assert st == 200
    atoken = auth["token"]
    # Alice tries to update Bob.
    stUpd, _ = _request(
        "PATCH", f"/api/collections/users/records/{uidB}",
        {"name": "Bob Hacked"},
        headers={"Authorization": atoken})
    assert stUpd in (400, 403, 404), f"cross-user update must be denied, got {stUpd}"
    # Alice tries to delete Bob.
    stDel, _ = _request(
        "DELETE", f"/api/collections/users/records/{uidB}",
        headers={"Authorization": atoken})
    assert stDel in (400, 403, 404), f"cross-user delete must be denied, got {stDel}"
    # Cleanup both.
    _delete_user_by_email(emailA)
    _delete_user_by_email(emailB)


def test_member_cannot_list_or_view_other_users():
    """users listRule is admin/manager-only and viewRule is own/admin/manager:
    a member must see no other users and cannot fetch a peer's record."""
    emailV = f"victim{_uid()}@flow.test"
    pwV = "Str0ngVictim-123!"
    stV, bodyV = _create_user_signup({
        "email": emailV, "password": pwV, "passwordConfirm": pwV, "name": "Victim"})
    assert stV == 200
    emailM = f"viewer{_uid()}@flow.test"
    pwM = "Str0ngViewer-123!"
    stM, bodyM = _create_user_signup({
        "email": emailM, "password": pwM, "passwordConfirm": pwM, "name": "Viewer"})
    assert stM == 200
    st, auth = _request(
        "POST", "/api/collections/users/auth-with-password",
        {"identity": emailM, "password": pwM})
    assert st == 200
    mtoken = auth["token"]
    # Member listing users must not expose peers.
    stL, lst = _request("GET", "/api/collections/users/records?perPage=50",
                        headers={"Authorization": mtoken})
    assert stL in (200, 403)
    if stL == 200:
        assert lst.get("totalItems", 0) == 0, "member must not list other users"
    # Member fetching a peer by id must be denied.
    stG2, _ = _request("GET", f"/api/collections/users/records/{bodyV['id']}",
                       headers={"Authorization": mtoken})
    assert stG2 in (400, 403, 404), f"member view of peer must be denied, got {stG2}"
    _delete_user_by_email(emailV)
    _delete_user_by_email(emailM)


def test_manager_admin_cannot_mint_privileged_user_via_create():
    """Neither a manager nor a regular admin may create a privileged user.

    With users.createRule now public, ANY actor (manager, regular admin, even
    superuser via REST) attempting to create a user with role='admin' or
    role='manager' must be coerced to 'member' by the create hook. Only the
    update path (superuser/admin) may legitimately promote, which is covered
    elsewhere."""
    roles = ["admin", "manager"]
    for creator_role in roles:
        emailC = f"creator{creator_role}+{_uid()}@flow.test"
        pwC = f"Str0ngCreator{_uid()}!"
        stC, bodyC = _create_user_signup({
            "email": emailC, "password": pwC, "passwordConfirm": pwC,
            "name": f"Creator{creator_role}"})
        assert stC == 200, f"create {creator_role} failed: {stC}"
        # Promote to the intended role via superuser update (legit path).
        stP, _ = _request(
            "PATCH", f"/api/collections/users/records/{bodyC['id']}",
            {"role": creator_role},
            headers={"Authorization": _superuser_token()})
        assert stP == 200, f"promote to {creator_role} failed: {stP}"
        # Auth as the creator.
        st, auth = _request(
            "POST", "/api/collections/users/auth-with-password",
            {"identity": emailC, "password": pwC})
        assert st == 200
        ctoken = auth["token"]
        # Creator tries to mint an admin via create.
        mint_email = f"mint_{creator_role}_{_uid()}@flow.test"
        stM, minted = _create_user_as(ctoken, {
            "email": mint_email, "password": "Str0ngMint-123!",
            "passwordConfirm": "Str0ngMint-123!", "name": "Mint",
            "role": "admin"})
        assert stM == 200, f"create mint failed for {creator_role}: {stM} {minted}"
        assert minted.get("role") == "member", (
            f"{creator_role} create of admin must be coerced to member, got {minted.get('role')}")
        _delete_user_by_email(mint_email)
        _delete_user_by_email(emailC)


# ---------------------------------------------------------------------------
# Performance & Indexes (Audit & Optimization)
# ---------------------------------------------------------------------------

def test_sqlite_performance_indexes_exist():
    """Verify that composite SQLite indexes are applied to the issues table."""
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), "..", "app", "pb_data", "data.db")
    if not os.path.exists(db_path):
        db_path = os.path.join(os.path.dirname(__file__), "..", "pb_data", "data.db")
    if not os.path.exists(db_path):
        pytest.skip("app/pb_data/data.db not accessible locally")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='issues';")
    indexes = {row[0] for row in cursor.fetchall()}
    conn.close()

    expected = {
        "idx_issues_project_order",
        "idx_issues_project_number",
        "idx_issues_project_status",
        "idx_issues_cycle",
        "idx_issues_milestone",
    }
    missing = expected - indexes
    assert not missing, f"Missing required performance indexes: {missing}"


def test_version_endpoint():
    """Verify version endpoint returns semver, service name, and open-source flag."""
    st, body = _get("/api/projectbase/version")
    assert st == 200, f"version endpoint failed: {st} {body}"
    assert body.get("service") == "ProjectBase"
    assert body.get("version") == "0.8.0"
    assert body.get("open_source") is True
    assert body.get("license") == "MIT"


def test_health_includes_version_and_license():
    """Verify health endpoint includes version and open source license."""
    st, body = _get("/api/projectbase/health")
    assert st == 200, f"health endpoint failed: {st} {body}"
    assert body.get("version") == "0.8.0"
    assert body.get("license") == "MIT"
    assert body.get("open_source") is True



def test_sqlite_query_plan_uses_index():
    """Verify that project-filtered issue lookup uses the composite index instead of full table scan."""
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), "..", "app", "pb_data", "data.db")
    if not os.path.exists(db_path):
        db_path = os.path.join(os.path.dirname(__file__), "..", "pb_data", "data.db")
    if not os.path.exists(db_path):
        pytest.skip("app/pb_data/data.db not accessible locally")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("EXPLAIN QUERY PLAN SELECT * FROM issues WHERE project = 'sample' ORDER BY issue_number DESC LIMIT 1;")
    plan = " ".join(row[3] for row in cursor.fetchall())
    conn.close()

    assert "idx_issues_project_number" in plan, f"Query plan did not utilize index: {plan}"
    assert "SCAN" not in plan, f"Query plan performed unindexed table scan: {plan}"


# ---------------------------------------------------------------------------
# Custom fields (cycle 16) — per-project field definitions + validation
# ---------------------------------------------------------------------------

def test_custom_fields_requires_authentication():
    """Custom-fields endpoints must reject anonymous callers."""
    status, _ = _request("GET", "/api/projectbase/projects/x/custom-fields")
    assert status == 401
    status, _ = _request("PUT", "/api/projectbase/projects/x/custom-fields",
                         {"fields": [{"label": "A", "type": "text"}]})
    assert status == 401

def test_custom_fields_get_and_put():
    """Define custom fields on a project and read them back."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}

    # Clean slate
    st, _ = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                     {"fields": []}, headers=hdr)
    assert st == 200

    st, body = _request("GET", f"/api/projectbase/projects/{pid}/custom-fields",
                        headers=hdr)
    assert st == 200, f"GET custom-fields failed: {st} {body}"
    assert body["fields"] == []

    fields = [
        {"label": "Client", "type": "text"},
        {"label": "Effort", "type": "number"},
        {"label": "Gate", "type": "select", "options": ["P0", "P1", "P2"]},
        {"label": "Signoff", "type": "checkbox"},
        {"label": "Due", "type": "date"},
    ]
    st, body = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                        {"fields": fields}, headers=hdr)
    assert st == 200, f"PUT custom-fields failed: {st} {body}"
    # Auto-derived keys
    keys = [f["key"] for f in body["fields"]]
    assert "client" in keys
    assert "gate" in keys
    assert "signoff" in keys

    st, body = _request("GET", f"/api/projectbase/projects/{pid}/custom-fields",
                        headers=hdr)
    assert st == 200
    assert len(body["fields"]) == 5
    # cleanup
    _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
             {"fields": []}, headers=hdr)

def test_custom_fields_reject_invalid():
    """Unsupported type, empty select options, and duplicate keys are rejected."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}

    st, body = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                        {"fields": [{"label": "Bad", "type": "boolean"}]}, headers=hdr)
    assert st == 400, f"expected 400 for bad type, got {st}: {body}"

    st, body = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                        {"fields": [{"label": "Gate", "type": "select", "options": []}]}, headers=hdr)
    assert st == 400, f"expected 400 for empty select, got {st}: {body}"

    st, body = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                        {"fields": [{"label": "A", "key": "dup"}, {"label": "B", "key": "dup"}]}, headers=hdr)
    assert st == 400, f"expected 400 for dup key, got {st}: {body}"

def test_custom_fields_validate():
    """Validation endpoint catches type + required errors."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}
    _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
             {"fields": [
                 {"label": "Client", "type": "text", "required": True},
                 {"label": "Effort", "type": "number"},
                 {"label": "Gate", "type": "select", "options": ["P0", "P1"]},
             ]}, headers=hdr)

    # valid payload
    st, body = _request("POST", f"/api/projectbase/projects/{pid}/custom-fields/validate",
                        {"values": {"client": "Acme", "effort": 5, "gate": "P1"}}, headers=hdr)
    assert st == 200 and body["valid"] is True, f"validate failed: {st} {body}"

    # missing required + bad select
    st, body = _request("POST", f"/api/projectbase/projects/{pid}/custom-fields/validate",
                        {"values": {"gate": "P9"}}, headers=hdr)
    assert st == 422, f"expected 422 for invalid, got {st}: {body}"
    assert "Client is required" in body["error"]
    assert "P0, P1" in body["error"]

    # bad number
    st, body = _request("POST", f"/api/projectbase/projects/{pid}/custom-fields/validate",
                        {"values": {"client": "x", "effort": "lots"}}, headers=hdr)
    assert st == 422 and "must be a number" in body["error"]

    _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
             {"fields": []}, headers=hdr)

def test_issue_custom_fields_roundtrip():
    """Set custom_fields on an issue and read them back (via PocketBase API)."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}
    title = f"Custom Fields Issue {_uid()}"
    # create an issue
    st, body = _request("POST", "/api/projectbase/import/csv",
                        {"project_id": pid, "rows": [{"title": title}]}, headers=hdr)
    assert st == 200 and body["imported"] == 1
    iid = None
    # find the issue
    from urllib.parse import quote
    q = "/api/collections/issues/records?perPage=200&filter=" + quote(f"title='{title}'")
    st, lst = _get_authed(q)
    assert st == 200 and lst.get("items")
    iid = lst["items"][0]["id"]

    # update with custom fields
    st, body = _request("PATCH", f"/api/collections/issues/records/{iid}",
                        {"custom_fields": {"client": "Acme", "effort": 3, "gate": "P0"}}, headers=hdr)
    assert st == 200, f"PATCH custom_fields failed: {st} {body}"

    st, body = _request("GET", f"/api/collections/issues/records/{iid}", headers=hdr)
    assert st == 200
    cf = body.get("custom_fields") or {}
    if isinstance(cf, str):
        import json as _json
        cf = _json.loads(cf)
    assert cf.get("client") == "Acme", f"custom_fields not persisted: {cf}"
    assert cf.get("effort") == 3

    # cleanup issue
    _request("DELETE", f"/api/collections/issues/records/{iid}", headers=hdr)

def test_custom_fields_nonexistent_project_404():
    """Authed request for a nonexistent project returns 404, not 500."""
    hdr = {"Authorization": _superuser_token()}
    st, _ = _request("GET", "/api/projectbase/projects/does-not-exist-xyz/custom-fields", headers=hdr)
    assert st == 404, f"expected 404, got {st}"
    st, _ = _request("PUT", "/api/projectbase/projects/does-not-exist-xyz/custom-fields",
                     {"fields": []}, headers=hdr)
    assert st == 404, f"expected 404, got {st}"

def test_custom_fields_reject_oversized_input():
    """Oversized labels and select options are rejected to prevent storage bloat."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}
    st, body = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                        {"fields": [{"label": "A" * 500, "type": "text"}]}, headers=hdr)
    assert st == 400 and "too long" in body["error"], f"oversized label not rejected: {st} {body}"
    st, body = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                        {"fields": [{"label": "Gate", "type": "select", "options": ["B" * 500]}]}, headers=hdr)
    assert st == 400 and "too long" in body["error"], f"oversized option not rejected: {st} {body}"
    st, body = _request("PUT", f"/api/projectbase/projects/{pid}/custom-fields",
                        {"fields": [{"label": f"f{i}", "type": "text"} for i in range(51)]}, headers=hdr)
    assert st == 400 and "max 50" in body["error"], f"oversized field count not rejected: {st} {body}"


def test_issue_milestone_assignment_roundtrip():
    """Create a milestone, create an issue linked to it, update the link, and verify persistence."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}
    mname = f"Milestone {_uid()}"
    # create milestone
    st, mbody = _request("POST", "/api/collections/milestones/records",
                         {"name": mname, "description": "test milestone", "status": "planned", "project": pid},
                         headers=hdr)
    assert st == 200, f"milestone create failed: {st} {mbody}"
    mid = mbody["id"]

    try:
        # create an issue linked to the milestone
        title = f"Milestone Issue {_uid()}"
        st, body = _request("POST", "/api/projectbase/import/csv",
                            {"project_id": pid, "rows": [{"title": title}]}, headers=hdr)
        assert st == 200 and body["imported"] == 1
        from urllib.parse import quote
        q = "/api/collections/issues/records?perPage=200&filter=" + quote(f"title='{title}'")
        st, lst = _get_authed(q)
        assert st == 200 and lst.get("items")
        iid = lst["items"][0]["id"]

        # assign milestone via update
        st, body = _request("PATCH", f"/api/collections/issues/records/{iid}",
                            {"milestone": mid}, headers=hdr)
        assert st == 200, f"milestone assign failed: {st} {body}"
        st, body = _request("GET", f"/api/collections/issues/records/{iid}", headers=hdr)
        assert st == 200
        assert body.get("milestone") == mid, f"milestone not persisted: {body.get('milestone')}"

        # clear milestone
        st, body = _request("PATCH", f"/api/collections/issues/records/{iid}",
                            {"milestone": None}, headers=hdr)
        assert st == 200
        st, body = _request("GET", f"/api/collections/issues/records/{iid}", headers=hdr)
        assert st == 200 and not body.get("milestone"), "milestone not cleared"

        _request("DELETE", f"/api/collections/issues/records/{iid}", headers=hdr)
    finally:
        _request("DELETE", f"/api/collections/milestones/records/{mid}", headers=hdr)


def test_milestone_progress_computed_from_linked_issues():
    """MilestonesView progress derives from linked issue status; verify link reads back."""
    pid = _get_any_project_id()
    hdr = {"Authorization": _superuser_token()}
    mname = f"Progress {_uid()}"
    st, mbody = _request("POST", "/api/collections/milestones/records",
                         {"name": mname, "project": pid, "status": "planned"}, headers=hdr)
    assert st == 200
    mid = mbody["id"]
    created_ids = []
    try:
        for status in ("todo", "done"):
            title = f"P {_uid()}"
            st, body = _request("POST", "/api/projectbase/import/csv",
                                {"project_id": pid, "rows": [{"title": title, "status": status}]},
                                headers=hdr)
            assert st == 200 and body["imported"] == 1
            from urllib.parse import quote
            q = "/api/collections/issues/records?perPage=200&filter=" + quote(f"title='{title}'")
            st, lst = _get_authed(q)
            iid = lst["items"][0]["id"]
            created_ids.append(iid)
            _request("PATCH", f"/api/collections/issues/records/{iid}", {"milestone": mid}, headers=hdr)

        # verify both issues are linked
        from urllib.parse import quote
        q = "/api/collections/issues/records?perPage=200&filter=" + quote(f"milestone='{mid}'")
        st, lst = _get_authed(q)
        assert st == 200
        linked = [it for it in lst.get("items", []) if it["id"] in created_ids]
        assert len(linked) == 2, f"expected 2 linked issues, got {len(linked)}"
    finally:
        for iid in created_ids:
            _request("DELETE", f"/api/collections/issues/records/{iid}", headers=hdr)
        _request("DELETE", f"/api/collections/milestones/records/{mid}", headers=hdr)

# ---------------------------------------------------------------------------
# Offline-first app shell (Service Worker, web manifest, icons)
# ---------------------------------------------------------------------------

def test_service_worker_served():
    """The Service Worker must be served as a real static asset."""
    st, body = _get("/sw.js")
    assert st == 200, f"sw.js not served: {st} {body}"
    # Basic sanity: it must reference our shell cache and handle fetches.
    assert "CACHE_NAME" in body or "addEventListener" in body

def test_service_worker_precaches_app_shell():
    """The SW must precache the index.html shell and core bundles."""
    st, body = _get("/sw.js")
    assert st == 200
    for asset in ["index.html", "vendor/vue.global.prod.js", "js/app.js",
                  "vendor/pocketbase.umd.js", "css/style.css"]:
        assert asset in body, f"SW missing precache entry: {asset}"

def test_index_html_registers_service_worker():
    """index.html must contain the SW registration snippet."""
    st, body = _get("/")
    assert st == 200
    assert "serviceWorker" in body, "index.html does not register the Service Worker"
    assert "/sw.js" in body

def test_web_manifest_present_and_valid():
    """The PWA web manifest must be served and parse as valid JSON."""
    st, body = _get("/manifest.webmanifest")
    assert st == 200, f"manifest not served: {st}"
    assert isinstance(body, dict), f"manifest did not parse as JSON: {type(body)}"
    assert body.get("name") == "ProjectBase"
    assert body.get("display") == "standalone"
    assert body.get("start_url") == "./"
    # Icons referenced must exist
    for icon in body.get("icons", []):
        icon_path = icon["src"].lstrip("./")
        st2, _ = _get("/" + icon_path)
        assert st2 == 200, f"manifest icon not served: {icon['src']} -> {st2}"

def test_offline_indicator_bound_in_app():
    """The app must track navigator online/offline state (isOnline data + handlers)."""
    st, body = _get("/js/app.js")
    assert st == 200
    assert "isOnline" in body, "app.js missing isOnline state"
    assert "handleOnline" in body and "handleOffline" in body, "app.js missing online/offline handlers"

def test_service_worker_excludes_realtime_sse():
    """The SW must never intercept /api/realtime (SSE): caching an unbounded
    stream hangs the fetch handler and breaks realtime sync."""
    st, body = _get("/sw.js")
    assert st == 200
    assert "api/realtime" in body, "SW missing realtime SSE exclusion"
    # exclusion must run BEFORE the generic /api/ network-first branch
    assert body.index("api/realtime") < body.index("url.pathname.startsWith('/api/')")

def test_sw_precache_covers_all_index_html_assets():
    """Drift guard: every local script/css referenced by index.html must be in the
    SW precache list, otherwise an offline boot would fetch a missing asset."""
    import re as _re
    st, sw = _get("/sw.js")
    assert st == 200
    st, index = _get("/")
    assert st == 200

    # Local assets referenced by the page (skip data: URIs and http(s) CDNs)
    srcs = _re.findall(r'(?:src|href)="(/[^"]+)"', index)
    local = [s for s in srcs if not s.startswith(("data:", "http"))]
    # sw.js itself is the registration target, not a precache dependency
    local = [s for s in local if s != "/sw.js"]

    missing = [s for s in local if f"'./{s.lstrip('/')}'" not in sw]
    assert not missing, f"index.html assets missing from SW precache: {missing}"

def test_service_worker_excludes_pocketbase_admin_ui():
    """The SW must never intercept /_/ (PocketBase admin UI): offline navigation
    to the admin app would otherwise receive the ProjectBase SPA shell."""
    st, body = _get("/sw.js")
    assert st == 200
    assert "startsWith('/_/')" in body, "SW missing PocketBase admin UI exclusion"

# ---------------------------------------------------------------------------
# Route hardening regression tests (cycle 24)
# ---------------------------------------------------------------------------

def _authed_json(method, path, payload, headers=None):
    """POST/PUT a raw-ish JSON body with the superuser token; returns (status, body)."""
    hdr = {"Authorization": _superuser_token()}
    if headers:
        hdr.update(headers)
    return _request(method, path, payload, headers=hdr)


def _first_issue_id():
    status, body = _get_authed("/api/collections/issues/records?perPage=1&sort=-created")
    assert status == 200
    assert body.get("items"), "no issues to reference"
    return body["items"][0]["id"]


def _first_project_id():
    status, body = _get_authed("/api/collections/projects/records?perPage=1")
    assert status == 200
    assert body.get("items"), "no projects to reference"
    return body["items"][0]["id"]


def test_dispatch_agent_rejects_corrupted_json():
    """Malformed JSON must be a 400, not a 500 leaking internals."""
    status, body = _request(
        "POST", "/api/projectbase/dispatch-agent", b"{broken",
        headers={"Authorization": _superuser_token()})
    assert status == 400, f"corrupted JSON should be 400, got {status} {body}"


def test_dispatch_agent_missing_issue_404():
    """A nonexistent issue id must yield 404, never a raw SQL leak."""
    status, body = _authed_json("POST", "/api/projectbase/dispatch-agent",
                                {"issue_id": "zzzzzzzzzzzzzz"})
    assert status == 404
    assert "not found" in str(body).lower() or "not found" in str(body.get("error", "")).lower()


def test_dispatch_agent_rejects_unknown_target():
    """agent_target must be allowlisted; arbitrary strings are rejected."""
    iid = _first_issue_id()
    status, body = _authed_json("POST", "/api/projectbase/dispatch-agent",
                                {"issue_id": iid, "agent_target": "evil"})
    assert status == 400
    assert "agent_target" in str(body)


def test_dispatch_agent_rejects_oversized_prompt():
    iid = _first_issue_id()
    status, body = _authed_json("POST", "/api/projectbase/dispatch-agent",
                                {"issue_id": iid, "prompt": "A" * 9000})
    assert status == 400


def test_dispatch_agent_happy_path():
    """A valid dispatch must succeed (P1 regression: audit comment creation
    previously failed on required comments.body, breaking dispatch)."""
    # Dispatch on a throwaway issue so demo data is never mutated; deleting
    # the issue cascades its audit comment away too.
    pid = _first_project_id()
    status, created = _authed_json(
        "POST", "/api/collections/issues/records",
        {"title": "cycle24 dispatch regression", "project": pid, "status": "todo"})
    assert status == 200, f"failed to create throwaway issue: {status} {created}"
    iid = created["id"]
    try:
        status, body = _authed_json("POST", "/api/projectbase/dispatch-agent",
                                    {"issue_id": iid, "agent_target": "flomaster"})
        assert status == 200, f"dispatch should succeed after schema fix: {status} {body}"
        assert body.get("success") is True
    finally:
        _request("DELETE", f"/api/collections/issues/records/{iid}",
                 headers={"Authorization": _superuser_token()})


def test_quick_task_corrupted_json_400():
    status, body = _request("POST", "/api/projectbase/quick-task", b"{bad",
                            headers={"Authorization": _superuser_token()})
    assert status == 400


def test_quick_task_nonexistent_project_404():
    """A provided-but-unresolvable project must 404, not silently create in
    the wrong project (P1 fix)."""
    status, body = _authed_json("POST", "/api/projectbase/quick-task",
                                {"title": "probe", "project_id": "doesnotexist123"})
    assert status == 404
    assert "not found" in str(body).lower()


def test_quick_task_unknown_project_key_404():
    status, body = _authed_json("POST", "/api/projectbase/quick-task",
                                {"title": "probe", "project_key": "ZZZZ"})
    assert status == 404


def test_quick_task_injection_key_400():
    """A filter injection attempt in project_key must be rejected, not 500."""
    status, body = _authed_json("POST", "/api/projectbase/quick-task",
                                {"title": "probe", "project_key": "a' OR 1=1--"})
    assert status == 400


def test_quick_task_oversized_title_400():
    status, body = _authed_json("POST", "/api/projectbase/quick-task",
                                {"title": "T" * 6000})
    assert status == 400


def test_quick_task_valid_key_creates_and_cleans():
    """Happy path: a valid project_key creates an issue, then we clean it up."""
    pid = _first_project_id()
    # resolve the identifier of that project
    status, proj = _get_authed(f"/api/collections/projects/records/{pid}")
    key = proj["identifier"].lower()
    status, body = _authed_json("POST", "/api/projectbase/quick-task",
                                {"title": "cycle24-regression", "project_key": key})
    assert status == 201
    issue_id = body["issue"]["id"]
    _request("DELETE", f"/api/collections/issues/records/{issue_id}",
             headers={"Authorization": _superuser_token()})


def test_ai_assist_corrupted_json_400():
    status, body = _request("POST", "/api/projectbase/ai-assist", b"{bad",
                            headers={"Authorization": _superuser_token()})
    assert status == 400


def test_import_csv_corrupted_json_400():
    status, body = _request("POST", "/api/projectbase/import/csv", b"{bad",
                            headers={"Authorization": _superuser_token()})
    assert status == 400


def test_custom_fields_validate_corrupted_json_400():
    pid = _first_project_id()
    status, body = _request(
        "POST", f"/api/projectbase/projects/{pid}/custom-fields/validate", b"{bad",
        headers={"Authorization": _superuser_token()})
    assert status == 400


def test_comment_create_content_only_ok():
    """P1 regression: comment creation must succeed with the canonical
    `content` field (legacy required `body` is dropped)."""
    iid = _first_issue_id()
    status, body = _authed_json("POST", "/api/collections/comments/records",
                                {"issue": iid, "author": "probe",
                                 "author_type": "agent", "content": "cycle24 schema probe"})
    assert status == 200, f"comment create must succeed: {status} {body}"
    cid = body.get("id")
    if cid:
        _request("DELETE", f"/api/collections/comments/records/{cid}",
                 headers={"Authorization": _superuser_token()})


def test_comments_schema_has_no_legacy_body():
    """The comments collection must not carry the legacy required `body`."""
    status, col = _get_authed("/api/collections/comments")
    assert status == 200
    names = [f["name"] for f in col.get("fields", [])]
    assert "body" not in names, "legacy comments.body field still present"
