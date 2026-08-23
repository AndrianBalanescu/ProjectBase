"""ProjectBase issue relationships API suite (blocks / blocked_by / related).

Runs against a live ProjectBase instance (default http://127.0.0.1:8120).
Override with PROJECTBASE_URL env var. Covers:
  - Custom routes: GET /api/projectbase/issues/{id}/relations,
    POST /api/projectbase/issues/{id}/relations,
    DELETE /api/projectbase/issues/{id}/relations
  - Reciprocal mirroring (A blocks B <=> B blocked_by A)
  - Validation (self-reference, bad target, bad type, duplicates)
  - Direct records-PATCH normalization of the relations JSON field

Usage:
    uv run --with pytest pytest tests/test_issue_relations.py -v
"""

import json
import os
import uuid
import urllib.request

import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")

_TOKEN_CACHE = {}


def _uid():
    return uuid.uuid4().hex[:10]


def _request(method: str, path: str, body=None, headers=None, timeout=15):
    url = f"{BASE_URL}{path}"
    data = None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw.decode(errors="replace")
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            return err.code, json.loads(raw)
        except Exception:
            return err.code, raw.decode(errors="replace")


def _superuser_token():
    if "token" not in _TOKEN_CACHE:
        status, body = _request(
            "POST", "/api/collections/_superusers/auth-with-password",
            {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
        assert status == 200, f"superuser auth failed: {status} {body}"
        _TOKEN_CACHE["token"] = body["token"]
    return _TOKEN_CACHE["token"]


def _hdr():
    return {"Authorization": _superuser_token()}


def _get_any_project_id():
    status, body = _request("GET", "/api/collections/projects/records?perPage=1", headers=_hdr())
    assert status == 200 and body.get("items"), "no projects seeded"
    return body["items"][0]["id"]


@pytest.fixture(scope="module")
def project_id():
    return _get_any_project_id()


@pytest.fixture(scope="module")
def issues(project_id):
    """Create three issues (A, B, C); yield their ids; delete on teardown."""
    created = []
    for label in ("REL-A", "REL-B", "REL-C"):
        status, body = _request(
            "POST", "/api/collections/issues/records",
            {"project": project_id, "title": f"Relations {label} {_uid()}", "status": "todo"},
            headers=_hdr())
        assert status == 200, f"issue create failed: {status} {body}"
        created.append(body["id"])
    yield {"a": created[0], "b": created[1], "c": created[2]}
    for iid in created:
        _request("DELETE", f"/api/collections/issues/records/{iid}", headers=_hdr())


def _relations_of(iid):
    status, body = _request("GET", f"/api/projectbase/issues/{iid}/relations", headers=_hdr())
    assert status == 200, f"GET relations failed: {status} {body}"
    return body


def _raw_relations(iid):
    status, body = _request("GET", f"/api/collections/issues/records/{iid}", headers=_hdr())
    assert status == 200
    return body.get("relations")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def test_relations_require_authentication(issues):
    for method, path in (
        ("GET", f"/api/projectbase/issues/{issues['a']}/relations"),
        ("POST", f"/api/projectbase/issues/{issues['a']}/relations"),
        ("DELETE", f"/api/projectbase/issues/{issues['a']}/relations"),
    ):
        body = {"issue": issues["b"], "type": "blocks"} if method != "GET" else None
        status, _ = _request(method, path, body)
        assert status == 401, f"{method} should require auth, got {status}"


# ---------------------------------------------------------------------------
# Add + mirror
# ---------------------------------------------------------------------------

def test_add_blocks_mirrors_blocked_by(issues):
    status, body = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["b"], "type": "blocks"}, headers=_hdr())
    assert status == 200, f"add blocks failed: {status} {body}"
    assert body.get("mirrored") is True

    # A blocks B (outgoing)
    ra = _raw_relations(issues["a"])
    assert {"issue": issues["b"], "type": "blocks"} in ra
    # B blocked_by A (mirror)
    rb = _raw_relations(issues["b"])
    assert {"issue": issues["a"], "type": "blocked_by"} in rb

    # GET resolves titles/identifiers both ways
    got_a = _relations_of(issues["a"])
    assert any(o["issue"] == issues["b"] and o["type"] == "blocks" and o["target"]["title"] for o in got_a["outgoing"])
    got_b = _relations_of(issues["b"])
    assert any(o["issue"] == issues["a"] and o["type"] == "blocked_by" for o in got_b["outgoing"])


def test_add_related_mirrors_related(issues):
    status, body = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["c"], "type": "related"}, headers=_hdr())
    assert status == 200, f"add related failed: {status} {body}"
    assert body.get("mirrored") is True

    ra = _raw_relations(issues["a"])
    assert {"issue": issues["c"], "type": "related"} in ra
    rc = _raw_relations(issues["c"])
    assert {"issue": issues["a"], "type": "related"} in rc


def test_add_duplicate_is_idempotent(issues):
    status1, body1 = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["b"], "type": "blocks"}, headers=_hdr())
    status2, body2 = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["b"], "type": "blocks"}, headers=_hdr())
    assert status1 == 200 and status2 == 200
    assert body2.get("already") is True
    count = sum(1 for r in _raw_relations(issues["a"]) if r.get("issue") == issues["b"] and r.get("type") == "blocks")
    assert count == 1, f"duplicate edges stored: {_raw_relations(issues['a'])}"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def test_add_self_relation_rejected(issues):
    status, body = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["a"], "type": "blocks"}, headers=_hdr())
    assert status == 400


def test_add_nonexistent_target_404(issues):
    status, _ = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": "zzzzzzzzzzzzzzz", "type": "blocks"}, headers=_hdr())
    assert status == 404


def test_add_invalid_type_rejected(issues):
    status, _ = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["b"], "type": "depends_on"}, headers=_hdr())
    assert status == 400


def test_add_invalid_body_rejected(issues):
    status, _ = _request(
        "POST", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["b"]}, headers=_hdr())
    assert status == 400


# ---------------------------------------------------------------------------
# Delete + unmirror
# ---------------------------------------------------------------------------

def test_delete_removes_and_unmirrors(issues):
    status, body = _request(
        "DELETE", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["c"], "type": "related"}, headers=_hdr())
    assert status == 200
    assert body.get("removed") is True and body.get("unmirrored") is True

    assert {"issue": issues["c"], "type": "related"} not in _raw_relations(issues["a"])
    assert {"issue": issues["a"], "type": "related"} not in _raw_relations(issues["c"])


def test_delete_unknown_relation_noop(issues):
    status, body = _request(
        "DELETE", f"/api/projectbase/issues/{issues['a']}/relations",
        {"issue": issues["c"], "type": "blocks"}, headers=_hdr())
    assert status == 200
    assert body.get("removed") is False


# ---------------------------------------------------------------------------
# Direct records-PATCH normalization
# ---------------------------------------------------------------------------

def test_patch_normalizes_relations_field(issues):
    # Mixed garbage: invalid id, invalid type, duplicates, non-objects.
    payload = [
        {"issue": "bad-id", "type": "blocks"},
        {"issue": issues["b"], "type": "blocks"},
        {"issue": issues["b"], "type": "blocks"},
        {"issue": issues["b"], "type": "nonsense"},
        None,
        42,
        {"issue": issues["b"], "type": "related"},
    ]
    status, body = _request(
        "PATCH", f"/api/collections/issues/records/{issues['a']}",
        {"relations": payload}, headers=_hdr())
    assert status == 200, f"PATCH failed: {status} {body}"
    rel = _raw_relations(issues["a"])
    # Garbage stripped, duplicates collapsed, valid entries kept.
    assert {"issue": issues["b"], "type": "blocks"} in rel
    assert {"issue": issues["b"], "type": "related"} in rel
    assert sum(1 for r in rel if r.get("issue") == issues["b"]) == 2


def test_patch_empty_relations_ok(issues):
    status, _ = _request(
        "PATCH", f"/api/collections/issues/records/{issues['a']}",
        {"relations": []}, headers=_hdr())
    assert status == 200


def test_incoming_lists_blocking_issues(issues):
    """B blocks A => A's GET must list B as an incoming 'blocks' edge."""
    _request("POST", f"/api/projectbase/issues/{issues['b']}/relations",
             {"issue": issues["a"], "type": "blocks"}, headers=_hdr())
    got_a = _relations_of(issues["a"])
    assert any(i["issue"] == issues["b"] and i["type"] == "blocks" for i in got_a["incoming"])
    # Cleanup so other tests aren't affected.
    _request("DELETE", f"/api/projectbase/issues/{issues['b']}/relations",
             {"issue": issues["a"], "type": "blocks"}, headers=_hdr())
