"""ProjectBase bulk-actions mechanical proof suite (board/list multi-select).

Runs against a live ProjectBase instance (default http://127.0.0.1:8120).
Override with PROJECTBASE_URL env var. Covers:
  - Bulk update: auth, validation, happy path, missing-id accounting, cycles
  - Bulk delete: role gating (admin/manager only), happy path
  - Frontend wiring regression: API client methods + UI hooks present
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
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_TOKEN_CACHE = {}


def _uid():
    return uuid.uuid4().hex[:10]


def _request(method, path, body=None, headers=None, timeout=15):
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
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as err:
        raw = err.read().decode()
        try:
            return err.code, json.loads(raw)
        except json.JSONDecodeError:
            return err.code, raw


def _superuser_token():
    if "token" not in _TOKEN_CACHE:
        st, body = _request(
            "POST", "/api/collections/_superusers/auth-with-password",
            {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
        assert st == 200, f"superuser auth failed: {st} {body}"
        _TOKEN_CACHE["token"] = body["token"]
    return _TOKEN_CACHE["token"]


def _hdr(token=None):
    return {"Authorization": token or _superuser_token()}


def _get_any_project_id():
    st, body = _request(
        "GET", "/api/collections/projects/records?perPage=1", headers=_hdr())
    assert st == 200, f"could not list projects: {st} {body}"
    items = body.get("items", [])
    assert items, "no seeded projects found"
    return items[0]["id"]


def _get_any_cycle_id(project_id):
    st, body = _request(
        "GET",
        f"/api/collections/cycles/records?perPage=1&filter=(project='{project_id}')",
        headers=_hdr())
    if st != 200:
        return None
    items = body.get("items", [])
    return items[0]["id"] if items else None


def _create_issue(project_id, title, extra=None):
    payload = {"project": project_id, "title": title}
    if extra:
        payload.update(extra)
    st, body = _request(
        "POST", "/api/collections/issues/records", payload, headers=_hdr())
    assert st == 200, f"create issue failed: {st} {body}"
    return body


def _delete_issue(issue_id):
    _request("DELETE", f"/api/collections/issues/records/{issue_id}", headers=_hdr())


def _create_member_token():
    """Sign up a fresh member and return their auth token."""
    email = f"bulk+{_uid()}@flow.test"
    pw = f"Str0ngBulk-{_uid()}!"
    st, body = _request("POST", "/api/collections/users/records", {
        "email": email, "password": pw, "passwordConfirm": pw, "name": "Bulk Member"})
    assert st == 200, f"signup failed: {st} {body}"
    st2, auth = _request("POST", "/api/collections/users/auth-with-password",
                         {"identity": email, "password": pw})
    assert st2 == 200
    # Best-effort cleanup at test end is the caller's job via _delete_user_by_email.
    return auth["token"], email


def _delete_user_by_email(email):
    from urllib.parse import quote
    q = "/api/collections/users/records?filter=" + quote(f"email='{email}'")
    st, body = _request("GET", q, headers=_hdr())
    if st != 200 or not body.get("items"):
        return
    for it in body["items"]:
        _request("DELETE", f"/api/collections/users/records/{it['id']}", headers=_hdr())


# ---------------------------------------------------------------------------
# Bulk update
# ---------------------------------------------------------------------------

def test_bulk_update_requires_authentication():
    st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                        {"ids": ["x"], "data": {"status": "todo"}})
    assert st in (401, 403), f"anon bulk-update must be denied, got {st} {body}"


def test_bulk_update_missing_ids_rejected():
    st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                        {"data": {"status": "todo"}}, headers=_hdr())
    assert st == 400 and "ids" in str(body.get("error", ""))


def test_bulk_update_empty_data_rejected():
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Empty {_uid()}")
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {}}, headers=_hdr())
        assert st == 400 and "data" in str(body.get("error", ""))
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_invalid_field_rejected():
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Field {_uid()}")
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {"project": "other"}},
                            headers=_hdr())
        assert st == 400 and "not allowed" in str(body.get("error", ""))
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_invalid_status_rejected():
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Status {_uid()}")
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {"status": "warp"}},
                            headers=_hdr())
        assert st == 400 and "status" in str(body.get("error", ""))
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_invalid_cycle_rejected():
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Cycle {_uid()}")
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {"cycle": "boguscycleid1"}},
                            headers=_hdr())
        assert st == 400 and ("cycle" in str(body.get("error", "")).lower())
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_happy_path_status_priority_cycle():
    pid = _get_any_project_id()
    cycle_id = _get_any_cycle_id(pid)
    created = [
        _create_issue(pid, f"Bulk Happy A {_uid()}", {"status": "backlog"}),
        _create_issue(pid, f"Bulk Happy B {_uid()}", {"status": "todo"}),
        _create_issue(pid, f"Bulk Happy C {_uid()}", {"status": "backlog"}),
    ]
    ids = [i["id"] for i in created]
    try:
        patch = {"status": "in_progress", "priority": "high"}
        if cycle_id:
            patch["cycle"] = cycle_id
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": ids, "data": patch}, headers=_hdr())
        assert st == 200, f"bulk update failed: {st} {body}"
        assert body["updated"] == 3 and body["missing"] == 0 and body["total"] == 3

        # Verify persistence at the record level.
        for cid in ids:
            st2, rec = _request("GET", f"/api/collections/issues/records/{cid}",
                                headers=_hdr())
            assert st2 == 200
            assert rec["status"] == "in_progress"
            assert rec["priority"] == "high"
            if cycle_id:
                assert rec["cycle"] == cycle_id
    finally:
        for cid in ids:
            _delete_issue(cid)


def test_bulk_update_counts_missing_ids():
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Missing {_uid()}")
    ghost = "a" * 15  # valid format, no record
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"], ghost], "data": {"priority": "low"}},
                            headers=_hdr())
        assert st == 200
        assert body["updated"] == 1 and body["missing"] == 1 and body["total"] == 2
        st2, rec = _request("GET", f"/api/collections/issues/records/{issue['id']}",
                            headers=_hdr())
        assert rec["priority"] == "low"
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_labels_array():
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Labels {_uid()}")
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {"labels": ["bulk", "ui"]}},
                            headers=_hdr())
        assert st == 200 and body["updated"] == 1
        st2, rec = _request("GET", f"/api/collections/issues/records/{issue['id']}",
                            headers=_hdr())
        assert rec["labels"] == ["bulk", "ui"]

        st3, body3 = _request("POST", "/api/projectbase/issues/bulk-update",
                              {"ids": [issue["id"]], "data": {"labels": "not-an-array"}},
                              headers=_hdr())
        assert st3 == 400 and "labels" in str(body3.get("error", ""))
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_custom_fields_partial_merge():
    """Bulk custom-field updates must MERGE into each record's custom_fields
    JSON (preserving unrelated keys), not wholesale-replace or write phantom
    custom_* columns. A null/'' value clears that single key."""
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk CF Merge {_uid()}",
                          {"custom_fields": {"effort": 3, "client": "Acme", "qa": True}})
    try:
        # 1. Partial update: only 'effort' changes, others survive.
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {"custom_fields": {"effort": 9}}},
                            headers=_hdr())
        assert st == 200, f"custom_fields bulk update failed: {st} {body}"
        st2, rec = _request("GET", f"/api/collections/issues/records/{issue['id']}",
                            headers=_hdr())
        assert rec["custom_fields"] == {"effort": 9, "client": "Acme", "qa": True}

        # 2. Remove one key via null; others survive.
        st3, body3 = _request("POST", "/api/projectbase/issues/bulk-update",
                              {"ids": [issue["id"]], "data": {"custom_fields": {"client": None}}},
                              headers=_hdr())
        assert st3 == 200, f"custom_fields null removal failed: {st3} {body3}"
        st4, rec2 = _request("GET", f"/api/collections/issues/records/{issue['id']}",
                             headers=_hdr())
        assert rec2["custom_fields"] == {"effort": 9, "qa": True}
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_custom_fields_validation():
    pid = _get_any_project_id()
    issue = _create_issue(pid, "Bulk CF Valid {_uid()}")
    try:
        # Non-object custom_fields must be rejected.
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {"custom_fields": ["x", "y"]}},
                            headers=_hdr())
        assert st == 400 and "custom_fields" in str(body.get("error", ""))

        # Legacy phantom custom_<key> columns are no longer accepted.
        st2, body2 = _request("POST", "/api/projectbase/issues/bulk-update",
                              {"ids": [issue["id"]], "data": {"custom_effort": 5}},
                              headers=_hdr())
        assert st2 == 400 and "custom_effort" in str(body2.get("error", ""))
    finally:
        _delete_issue(issue["id"])


def test_bulk_update_custom_field_prefix_allowed():
    # Legacy phantom custom_* column keys were silently accepted but never
    # persisted (they targeted non-existent top-level columns). Since cycle 18
    # the correct payload is a nested custom_fields object (see
    # test_bulk_update_custom_fields_partial_merge); a bare custom_* key is now
    # rejected so callers cannot silently lose data.
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Custom {_uid()}")
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-update",
                            {"ids": [issue["id"]], "data": {"custom_gate": "P1"}},
                            headers=_hdr())
        assert st == 400 and "custom_gate" in str(body.get("error", ""))
    finally:
        _delete_issue(issue["id"])


# ---------------------------------------------------------------------------
# Bulk delete (admin/manager only — mirrors issues.deleteRule)
# ---------------------------------------------------------------------------

def test_bulk_delete_requires_authentication():
    st, _ = _request("POST", "/api/projectbase/issues/bulk-delete", {"ids": ["x"]})
    assert st in (401, 403)


def test_bulk_delete_member_denied():
    mtoken, email = _create_member_token()
    try:
        st, body = _request("POST", "/api/projectbase/issues/bulk-delete",
                            {"ids": ["a" * 15]}, headers=_hdr(mtoken))
        assert st == 403, f"member bulk-delete must be forbidden, got {st} {body}"
    finally:
        _delete_user_by_email(email)


def test_bulk_delete_happy_path():
    pid = _get_any_project_id()
    created = [
        _create_issue(pid, f"Bulk Del A {_uid()}"),
        _create_issue(pid, f"Bulk Del B {_uid()}"),
    ]
    ids = [i["id"] for i in created]
    st, body = _request("POST", "/api/projectbase/issues/bulk-delete",
                        {"ids": ids}, headers=_hdr())
    assert st == 200, f"bulk delete failed: {st} {body}"
    assert body["deleted"] == 2 and body["missing"] == 0
    for cid in ids:
        st2, _ = _request("GET", f"/api/collections/issues/records/{cid}",
                          headers=_hdr())
        assert st2 == 404, f"deleted issue {cid} still present ({st2})"


def test_bulk_delete_missing_counted():
    pid = _get_any_project_id()
    issue = _create_issue(pid, f"Bulk Del Ghost {_uid()}")
    st, body = _request("POST", "/api/projectbase/issues/bulk-delete",
                        {"ids": [issue["id"], "b" * 15]}, headers=_hdr())
    assert st == 200
    assert body["deleted"] == 1 and body["missing"] == 1


# ---------------------------------------------------------------------------
# Frontend wiring regression (source-level, mirrors existing UI tests)
# ---------------------------------------------------------------------------

def _read(rel):
    with open(os.path.join(REPO_ROOT, rel), encoding="utf-8") as fh:
        return fh.read()


def test_api_client_exposes_bulk_methods():
    src = _read("app/pb_public/js/api.js")
    assert "bulkUpdateIssues(ids, data)" in src
    assert "bulkDeleteIssues(ids)" in src
    assert "/api/projectbase/issues/bulk-update" in src
    assert "/api/projectbase/issues/bulk-delete" in src


def test_root_app_has_selection_state_and_handlers():
    src = _read("app/pb_public/js/app.js")
    assert "selectedIssueIds: new Set()" in src
    assert "async bulkUpdateSelected(patch)" in src
    assert "async bulkDeleteSelected()" in src
    assert "clearIssueSelection()" in src
    assert "selectAllVisibleIssues(issues)" in src


def test_board_and_list_wire_selection_events():
    board = _read("app/pb_public/js/components/KanbanBoard.js")
    assert "toggle-issue-selection" in board
    assert "handleCardClick" in board
    assert "isSelected(issue)" in board

    lst = _read("app/pb_public/js/components/ListView.js")
    assert "toggle-issue-selection" in lst
    assert "select-all-visible" in lst
    assert "handleRowClick" in lst


def test_index_renders_bulk_actions_bar_and_wiring():
    src = _read("app/pb_public/index.html")
    assert "selectedIssueIds.size > 0" in src
    assert "bulkDeleteSelected" in src
    assert "applyBulkField('status'" in src
    assert "applyBulkField('priority'" in src
    assert ":selected-issue-ids=\"selectedIssueIds\"" in src
    assert "@toggle-issue-selection=\"toggleIssueSelection\"" in src

    # Bulk custom-field picker (per-project schemas).
    assert "currentFieldDefs" in src
    assert "applyBulkCustomField" in src
    assert "bulkCustomFieldKey" in src


def test_root_app_wires_bulk_custom_field_state_and_merge():
    src = _read("app/pb_public/js/app.js")
    assert "bulkCustomFieldKey: ''" in src
    assert "async applyBulkCustomField(field, value)" in src
    # Optimistic local apply must merge custom_fields (mirroring the backend's
    # partial-update + key-removal semantics), not replace the whole object.
    assert "key === 'custom_fields'" in src
    assert "delete merged[cfk]" in src


def test_bulk_hook_registered_and_validated():
    src = _read("app/pb_hooks/31_bulk_actions.pb.js")
    assert "/api/projectbase/issues/bulk-update" in src
    assert "/api/projectbase/issues/bulk-delete" in src
    assert "EDITABLE_FIELDS" in src
    assert "Insufficient role: admin or manager required" in src
