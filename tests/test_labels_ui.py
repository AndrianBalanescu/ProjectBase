"""tests/test_labels_ui.py — labels table-stakes surface (UI + hook parity).

Cycle 86: the "Labels & priorities shipped" claim was only half true. The
labels collection existed with seeded colored rows, but the only UI writing
labels was the drawer's free-text input; NewIssueModal had a selectedLabels
data prop that no template element ever set (dead state), and no view could
filter by label.

This suite locks the completed label surface:
  1. Live-API parity: direct REST create/update validate labels exactly like
     bulk-update (array of non-empty strings <= 64 chars) via the 20_issue_hooks
     guards.
  2. Static wiring: NewIssueModal picker, drawer quick-picks + colored chips,
     board/list label filters + colored chips, URL-synced ?label= param.
  3. llms.txt documents the labels endpoints for agents.

Live tests run against PROJECTBASE_URL (default http://127.0.0.1:8120).
"""

import json
import os
import urllib.error
import urllib.request

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_TOKEN_CACHE = {}


def _uid():
    import uuid
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


def _hdr():
    return {"Authorization": _superuser_token()}


def _get_any_project_id():
    st, body = _request(
        "GET", "/api/collections/projects/records?perPage=1", headers=_hdr())
    assert st == 200, f"could not list projects: {st} {body}"
    items = body.get("items", [])
    assert items, "no seeded projects found"
    return items[0]["id"]


def _delete_issue(issue_id):
    _request("DELETE", f"/api/collections/issues/records/{issue_id}", headers=_hdr())


# --- Live API: hook validation parity --------------------------------------

def test_direct_create_rejects_non_array_labels():
    """Direct REST create must 400 on labels:'string' (same as bulk-update)."""
    pid = _get_any_project_id()
    st, body = _request(
        "POST", "/api/collections/issues/records",
        {"project": pid, "title": f"BadLabels {_uid()}", "labels": "not-an-array"},
        headers=_hdr())
    assert st == 400, f"expected 400 for non-array labels, got {st} {body}"
    assert "labels" in str(body.get("message", "")).lower() or \
        "labels" in str(body.get("data", "")), f"error should mention labels: {body}"


def test_direct_create_rejects_oversized_label():
    """Direct REST create must 400 on a >64-char label entry."""
    pid = _get_any_project_id()
    st, body = _request(
        "POST", "/api/collections/issues/records",
        {"project": pid, "title": f"LongLabel {_uid()}",
         "labels": ["x" * 65]},
        headers=_hdr())
    assert st == 400, f"expected 400 for >64-char label, got {st} {body}"


def test_direct_create_accepts_valid_labels():
    """Direct REST create accepts a valid labels array."""
    pid = _get_any_project_id()
    title = f"GoodLabels {_uid()}"
    st, body = _request(
        "POST", "/api/collections/issues/records",
        {"project": pid, "title": title, "labels": ["hookcheck", "valid"]},
        headers=_hdr())
    assert st == 200, f"valid labels create failed: {st} {body}"
    try:
        assert body["labels"] == ["hookcheck", "valid"]
    finally:
        _request("DELETE", f"/api/collections/issues/records/{body['id']}", headers=_hdr())


def test_direct_update_rejects_non_array_labels():
    """Direct REST PATCH must 400 on labels:'string'."""
    pid = _get_any_project_id()
    st, issue = _request(
        "POST", "/api/collections/issues/records",
        {"project": pid, "title": f"UpdLabels {_uid()}"},
        headers=_hdr())
    assert st == 200, f"seed issue failed: {st} {issue}"
    try:
        st2, body2 = _request(
            "PATCH", f"/api/collections/issues/records/{issue['id']}",
            {"labels": "oops"},
            headers=_hdr())
        assert st2 == 400, f"expected 400 on non-array labels update, got {st2} {body2}"
        # The record keeps its previous (empty) labels — PB returns None for a
        # never-set json field and [] once the create hook defaulted it.
        st3, rec = _request(
            "GET", f"/api/collections/issues/records/{issue['id']}", headers=_hdr())
        assert st3 == 200, f"readback failed: {st3} {rec}"
        assert rec["labels"] in ([], None), f"labels must stay unset, got {rec['labels']!r}"
    finally:
        _delete_issue(issue["id"])


def test_labels_collection_crud_shape():
    """labels collection: name+color required; project optional."""
    st, body = _request(
        "POST", "/api/collections/labels/records",
        {"name": f"zz-hook {_uid()}"}, headers=_hdr())
    assert st == 400 and "color" in json.dumps(body), \
        f"color required: {st} {body}"
    name = f"zz-hook {_uid()}"
    st2, body2 = _request(
        "POST", "/api/collections/labels/records",
        {"name": name, "color": "#334455"}, headers=_hdr())
    assert st2 == 200, f"label create failed: {st2} {body2}"
    st3, _ = _request("DELETE", f"/api/collections/labels/records/{body2['id']}", headers=_hdr())
    assert st3 == 204, f"label delete failed: {st3}"


# --- Static wiring: the UI surface ------------------------------------------

def _read(rel):
    with open(os.path.join(REPO_ROOT, rel), encoding="utf-8") as fh:
        return fh.read()


class TestLabelsStaticWiring:
    """Locks the label UI surface so it cannot silently regress."""

    def test_new_issue_modal_has_label_picker(self):
        src = _read("app/pb_public/js/components/NewIssueModal.js")
        assert "labelOptions()" in src, "modal must expose label options from the labels collection"
        assert "<multiselect" in src, "modal must render the reusable multiselect picker"
        assert "v-model=\"selectedLabels\"" in src
        assert "labels: this.selectedLabels" in src, "create payload must include selected labels"

    def test_drawer_has_quick_picks_and_colored_chips(self):
        src = _read("app/pb_public/js/components/IssueDrawer.js")
        assert "labelQuickPicks()" in src
        assert "labelColor(name)" in src
        assert "fallbackLabelColor(name)" in src
        assert "@click=\"addLabel(l.name)\"" in src

    def test_board_has_label_filter_and_colored_chips(self):
        src = _read("app/pb_public/js/components/KanbanBoard.js")
        assert "filterLabel" in src
        assert "update:filterLabel" in src
        assert "All Labels" in src
        assert "labelColor(lbl)" in src

    def test_list_has_label_filter_and_colored_chips(self):
        src = _read("app/pb_public/js/components/ListView.js")
        assert "filterLabel" in src
        assert "update:filterLabel" in src
        assert "All Labels" in src
        assert "labelColor(lbl)" in src

    def test_app_url_syncs_label_param(self):
        src = _read("app/pb_public/js/app.js")
        assert "filterLabel: ''" in src
        assert "params.get('label')" in src
        assert "params.set('label', this.filterLabel)" in src
        assert "filterLabel() { this.syncRoute(); }" in src

    def test_index_passes_filter_label_binding(self):
        src = _read("app/pb_public/index.html")
        assert src.count("v-model:filter-label=\"filterLabel\"") == 2, \
            "both board and list views must bind filter-label"

    def test_llms_txt_documents_labels(self):
        txt = _read("app/pb_public/llms.txt")
        assert "8b. Labels" in txt
        assert "/api/collections/labels/records" in txt

    def test_hook_source_has_label_guards(self):
        src = _read("app/pb_hooks/20_issue_hooks.pb.js")
        assert src.count("labels must be an array") == 2, \
            "both create and update hooks must guard labels"
        assert src.count("labels entries must be non-empty strings up to 64 chars") == 2