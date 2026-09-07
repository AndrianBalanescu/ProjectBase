"""tests/test_saved_views.py — Saved Views surface (collection + hook + UI wiring).

Cycle 87: Linear/Plane table stakes. Users cannot persist a named filtered
board/list state. This suite locks the completed surface:

  1. Live API: saved_views CRUD with per-owner isolation (owner filled
     server-side when omitted; a spoofed owner is rejected 400 by the
     createRule), query whitelist (only q/priority/
     cycle/label keys, length caps), view enum (board|list), name caps,
     duplicate-name rejection per owner+project+view, unauth rejection.
  2. Static wiring: Save-view button on board + list toolbars (gated on active
     filters), saved-views dropdown with apply/delete, SavedViewModal mount,
     api.js helpers, app.js state (savedViews loaded in loadAllData, apply is
     a hash navigation).

Live tests run against PROJECTBASE_URL (default http://127.0.0.1:8120).
"""

import json
import os
import re
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
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def _superuser_token():
    if "su" not in _TOKEN_CACHE:
        st, body = _request(
            "POST", "/api/collections/_superusers/auth-with-password",
            {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
        assert st == 200, f"superuser auth failed: {st} {body}"
        _TOKEN_CACHE["su"] = body["token"]
    return _TOKEN_CACHE["su"]


def _hdr():
    return {"Authorization": _superuser_token()}


_USER_CACHE = {}


def _make_user(label):
    """Create a throwaway auth user, return (id, token)."""
    if label in _USER_CACHE:
        return _USER_CACHE[label]
    email = f"sv-{label}-{_uid()}@flow-test.invalid"
    st, body = _request(
        "POST", "/api/collections/users/records",
        {"email": email, "password": "svtest12345", "passwordConfirm": "svtest12345",
         "name": f"SV {label}"},
        headers=_hdr())
    assert st == 200, f"user create failed: {st} {body}"
    uid = body["id"]
    st2, tok = _request(
        "POST", "/api/collections/users/auth-with-password",
        {"identity": email, "password": "svtest12345"})
    assert st2 == 200, f"user auth failed: {st2} {tok}"
    _USER_CACHE[label] = (uid, tok["token"])
    return _USER_CACHE[label]


def _uhdr(token):
    return {"Authorization": token}


# --- Live API: CRUD + ownership + validation --------------------------------

def test_saved_views_collection_exists():
    st, body = _request("GET", "/api/collections/saved_views/records", headers=_hdr())
    assert st == 200, f"saved_views collection missing: {st} {body}"


def test_create_requires_auth():
    st, body = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"NoAuth {_uid()}", "query": "priority=high", "view": "board"})
    assert st in (400, 401), f"unauth create must be rejected, got {st} {body}"


def test_create_forces_owner_to_caller():
    """Owner is always the authenticated caller: omitting owner is filled
    server-side by the hook; a spoofed owner is REJECTED 400 by the createRule
    (rules evaluate @request.body.owner before hooks run). Rejection is the
    stronger guarantee — a spoofed owner can never land, even if hooks die."""
    uid, tok = _make_user("force")
    st, body = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"Force {_uid()}", "query": "priority=high", "view": "board",
         "owner": "k133d29762uevyx"},
        headers={"Authorization": tok})
    assert st == 400, f"spoofed owner must be rejected, got {st} {body}"
    # The legitimate path (owner omitted) still works and lands as the caller.
    st2, created = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"Force {_uid()}", "query": "priority=high", "view": "board"},
        headers={"Authorization": tok})
    assert st2 == 200, f"create with omitted owner failed: {st2} {created}"
    assert created.get("owner") == uid, f"owner must be forced to caller: {created}"
    # cleanup
    _request("DELETE", f"/api/collections/saved_views/records/{created['id']}", headers=_hdr())


def test_list_is_scoped_to_owner():
    a_uid, a_tok = _make_user("iso-a")
    b_uid, b_tok = _make_user("iso-b")
    st, view_a = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"OnlyA {_uid()}", "query": "priority=urgent", "view": "list"},
        headers={"Authorization": a_tok})
    assert st == 200, f"create A failed: {st} {view_a}"
    st, la = _request("GET", "/api/collections/saved_views/records",
                      headers={"Authorization": a_tok})
    assert st == 200 and la.get("totalItems", 0) >= 1, f"A cannot list own views: {st} {la}"
    ids_a = {i["id"] for i in la.get("items", [])}
    assert view_a["id"] in ids_a
    st, lb = _request("GET", "/api/collections/saved_views/records",
                      headers={"Authorization": b_tok})
    assert st == 200 and lb.get("totalItems", 0) == 0, f"B must not see A's views: {st} {lb}"
    # B cannot update or delete A's view (404 from rule filtering).
    st_u, _ = _request("PATCH", f"/api/collections/saved_views/records/{view_a['id']}",
                       {"name": "Hijacked"}, headers={"Authorization": b_tok})
    assert st_u == 404, f"cross-owner update must fail, got {st_u}"
    st_d, _ = _request("DELETE", f"/api/collections/saved_views/records/{view_a['id']}",
                       headers={"Authorization": b_tok})
    assert st_d == 404, f"cross-owner delete must fail, got {st_d}"
    _request("DELETE", f"/api/collections/saved_views/records/{view_a['id']}", headers=_hdr())


def test_duplicate_name_rejected_per_surface():
    uid, tok = _make_user("dup")
    name = f"Dup {_uid()}"
    st, first = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": name, "query": "priority=high", "view": "board"},
        headers={"Authorization": tok})
    assert st == 200, f"first create failed: {st} {first}"
    st2, dup = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": name, "query": "priority=low", "view": "board"},
        headers={"Authorization": tok})
    assert st2 == 400, f"duplicate must 400, got {st2} {dup}"
    assert "already exists" in str(dup), f"error should mention duplicate: {dup}"
    # Same name on the other surface is fine.
    st3, other_surface = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": name, "query": "priority=high", "view": "list"},
        headers={"Authorization": tok})
    assert st3 == 200, f"same name other surface must pass: {st3} {other_surface}"
    _request("DELETE", f"/api/collections/saved_views/records/{first['id']}", headers=_hdr())
    _request("DELETE", f"/api/collections/saved_views/records/{other_surface['id']}", headers=_hdr())


def test_query_whitelist_rejects_disallowed_keys():
    uid, tok = _make_user("wl")
    st, body = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"WL {_uid()}", "query": "priority=high&evil=1", "view": "board"},
        headers={"Authorization": tok})
    assert st == 400, f"disallowed key must 400, got {st} {body}"
    assert "disallowed" in str(body), f"error should mention the key: {body}"


def test_query_length_caps():
    uid, tok = _make_user("len")
    st, body = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"Len {_uid()}", "query": "q=" + ("x" * 201), "view": "board"},
        headers={"Authorization": tok})
    assert st == 400, f">200-char q value must 400, got {st} {body}"


def test_name_caps():
    uid, tok = _make_user("namecap")
    st, body = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": "x" * 65, "query": "q=x", "view": "board"},
        headers={"Authorization": tok})
    assert st == 400, f">64-char name must 400, got {st} {body}"


def test_view_enum():
    uid, tok = _make_user("enum")
    st, body = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"Enum {_uid()}", "query": "q=x", "view": "kanban"},
        headers={"Authorization": tok})
    assert st == 400, f"bad view enum must 400, got {st} {body}"
    assert "board" in str(body) and "list" in str(body), f"error should name valid values: {body}"


def test_update_own_view_roundtrip():
    uid, tok = _make_user("upd")
    st, view = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"Upd {_uid()}", "query": "priority=high", "view": "board"},
        headers={"Authorization": tok})
    assert st == 200, f"create failed: {st} {view}"
    st2, upd = _request(
        "PATCH", f"/api/collections/saved_views/records/{view['id']}",
        {"query": "priority=urgent&label=bug"}, headers={"Authorization": tok})
    assert st2 == 200 and upd.get("query") == "priority=urgent&label=bug", \
        f"update failed: {st2} {upd}"
    _request("DELETE", f"/api/collections/saved_views/records/{view['id']}", headers=_hdr())


def test_delete_own_view():
    uid, tok = _make_user("del")
    st, view = _request(
        "POST", "/api/collections/saved_views/records",
        {"name": f"Del {_uid()}", "query": "q=z", "view": "board"},
        headers={"Authorization": tok})
    assert st == 200
    st2, _ = _request("DELETE", f"/api/collections/saved_views/records/{view['id']}",
                      headers={"Authorization": tok})
    assert st2 in (200, 204), f"owner delete failed: {st2}"
    st3, _ = _request("GET", f"/api/collections/saved_views/records/{view['id']}",
                      headers={"Authorization": tok})
    assert st3 == 404, f"view should be gone, got {st3}"


# --- Static wiring -----------------------------------------------------------

def _read(*parts):
    with open(os.path.join(REPO_ROOT, *parts)) as f:
        return f.read()


def test_static_save_view_buttons_wired():
    """Both board and list toolbars expose Save view + Views dropdown wiring."""
    board = _read("app", "pb_public", "js", "components", "KanbanBoard.js")
    lst = _read("app", "pb_public", "js", "components", "ListView.js")
    for src, name in [(board, "KanbanBoard"), (lst, "ListView")]:
        assert "$emit('save-view')" in src, f"{name}: save-view emit missing"
        assert "saved-views" in src.lower() or "savedViews" in src, \
            f"{name}: savedViews prop missing"
        assert "apply-saved-view" in src, f"{name}: apply emit missing"
        assert "delete-saved-view" in src, f"{name}: delete emit missing"


def test_static_app_wiring():
    """app.js holds savedViews state, save modal flow, hash-navigation apply."""
    app = _read("app", "pb_public", "js", "app.js")
    assert "savedViews: []" in app
    assert "API.getSavedViews()" in app
    assert "confirmSaveViewFromModal" in app
    assert "currentFilterQueryState" in app


def test_static_apply_saved_view_uses_hash_navigation():
    app = _read("app", "pb_public", "js", "app.js")
    m = re.search(r"applySavedView\(sv\) \{([\s\S]*?)\n    \},", app)
    assert m, "applySavedView method not found"
    body = m.group(1)
    assert "window.location.hash" in body, f"apply must navigate the hash: {body}"
    assert "sv.query" in body and "sv.view" in body, f"apply must use saved query+view: {body}"


def test_static_modal_mounted_and_registered():
    idx = _read("app", "pb_public", "index.html")
    assert "<saved-view-modal" in idx
    assert ":is-open=\"isSaveViewOpen\"" in idx
    assert "@confirm=\"confirmSaveViewFromModal\"" in idx
    assert "/js/components/SavedViewModal.js" in idx
    app = _read("app", "pb_public", "js", "app.js")
    assert "'saved-view-modal': SavedViewModalComponent" in app
    modal = _read("app", "pb_public", "js", "components", "SavedViewModal.js")
    assert "save-view-name-input" in modal, "modal input id used by tests/e2e missing"


def test_static_api_helpers():
    api = _read("app", "pb_public", "js", "api.js")
    assert "getSavedViews" in api and "createSavedView" in api
    assert "updateSavedView" in api and "deleteSavedView" in api


def test_llms_txt_documents_saved_views():
    llms = _read("app", "pb_public", "llms.txt")
    assert "saved" in llms.lower(), "llms.txt should document saved views endpoints"


def test_load_all_data_populates_saved_views():
    app = _read("app", "pb_public", "js", "app.js")
    assert "API.getSavedViews().catch(() => [])" in app
    assert re.search(r"savedViews\] = await Promise\.all", app) or \
        re.search(r", savedViews\] = await Promise", app), \
        "loadAllData must destructure savedViews"