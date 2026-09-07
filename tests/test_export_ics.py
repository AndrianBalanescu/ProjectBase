"""tests/test_export_ics.py — ICS calendar feed (cycle 81, PB-10533).

GET /api/projectbase/export/ics?project=<id> returns an RFC 5545 text/calendar
document with one VEVENT per dated item: issues with a due_date (all-day),
cycles spanning start_date..end_date, and milestones with a target_date
(all-day). UIDs are stable so calendar clients dedupe across refreshes.

Runs against the live instance (PROJECTBASE_URL override, same convention as
tests/test_api.py). Pure HTTP + format assertions — no server spawn.
"""

import os
import re
import json
import unittest
import urllib.request
import urllib.error

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOOK = os.path.join(ROOT, "app", "pb_hooks", "43_export_ics.pb.js")

_TOKEN_CACHE = {}


def _superuser_token() -> str:
    if "token" not in _TOKEN_CACHE:
        status, body, _ = _request(
            "POST", "/api/collections/_superusers/auth-with-password",
            {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
        assert status == 200, f"superuser auth failed: {status} {body}"
        _TOKEN_CACHE["token"] = body["token"]
    return _TOKEN_CACHE["token"]


def _request(method, path, body=None, headers=None, timeout=15):
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
            resp_headers = dict(resp.headers)
    except urllib.error.HTTPError as err:
        raw = err.read().decode(errors="replace")
        status = err.code
        resp_headers = dict(err.headers)
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        parsed = raw
    return status, parsed, resp_headers


def _ics_get(path):
    return _request("GET", path, headers={"Authorization": _superuser_token()})


def _uid():
    import uuid
    return uuid.uuid4().hex[:10]


def _get_any_project_id():
    status, body, _ = _request(
        "GET", "/api/collections/projects/records?perPage=1&sort=created",
        headers={"Authorization": _superuser_token()})
    assert status == 200, f"projects list failed: {status}"
    items = body.get("items", []) if isinstance(body, dict) else []
    assert items, "no projects exist; create one before running the suite"
    return items[0]["id"]


def _mk_issue(pid, title, due_date, status="todo"):
    status_code, body, _ = _request(
        "POST", "/api/collections/issues/records",
        {"project": pid, "title": title, "status": status,
         "priority": "medium", "due_date": due_date, "task_persona": "agent"},
        headers={"Authorization": _superuser_token()})
    assert status_code == 200, f"fixture issue create failed: {status_code} {body}"
    return body["id"]

class TestIcsFormat(unittest.TestCase):
    """Static hook checks — no server needed (mirrors test_openapi_drift.py style)."""

    def test_hook_registers_ics_route(self):
        src = open(HOOK, encoding="utf-8").read()
        self.assertIn('routerAdd("GET", "/api/projectbase/export/ics"', src)

    def test_hook_requires_auth(self):
        src = open(HOOK, encoding="utf-8").read()
        self.assertIn("unauthorizedError", src)

    def test_hook_uid_prefixes(self):
        src = open(HOOK, encoding="utf-8").read()
        for kind in ("issue-", "cycle-", "milestone-"):
            self.assertIn(f'uid: "{kind}" + rec.id + "@projectbase"', src)

    def test_openapi_documents_ics(self):
        spec = json.load(open(os.path.join(ROOT, "app", "pb_public", "openapi.json")))
        self.assertIn("/projectbase/export/ics", spec["paths"])
        self.assertIn("get", spec["paths"]["/projectbase/export/ics"])

    def test_llms_txt_documents_ics(self):
        txt = open(os.path.join(ROOT, "app", "pb_public", "llms.txt"), encoding="utf-8").read()
        self.assertIn("/api/projectbase/export/ics", txt)


class TestIcsEndpoint(unittest.TestCase):
    """Live endpoint tests against PROJECTBASE_URL."""

    @classmethod
    def setUpClass(cls):
        cls.pid = _get_any_project_id()
        # Deterministic fixtures: one dated issue (unique title token), one
        # undated issue. Cleaned up in tearDownClass.
        cls.token = _superuser_token()
        cls.fixture_ids = []
        cls.dated_title = f"ICS Fixture {_uid()}"
        cls.dated_id = _mk_issue(cls.pid, cls.dated_title, "2031-01-15")
        cls.fixture_ids.append(cls.dated_id)
        cls.undated_id = _mk_issue(cls.pid, f"ICS Undated {_uid()}", "")
        cls.fixture_ids.append(cls.undated_id)

    @classmethod
    def tearDownClass(cls):
        for iid in cls.fixture_ids:
            try:
                _request("DELETE", f"/api/collections/issues/records/{iid}",
                         headers={"Authorization": cls.token})
            except Exception:
                pass

    def test_requires_authentication(self):
        status, _, _ = _request("GET", f"/api/projectbase/export/ics?project={self.pid}")
        self.assertEqual(status, 401)

    def test_missing_project_param_400(self):
        status, _, _ = _ics_get("/api/projectbase/export/ics")
        self.assertTrue(400 <= status < 500)

    def test_unknown_project_404(self):
        status, _, _ = _ics_get(f"/api/projectbase/export/ics?project={'x' * 15}")
        self.assertEqual(status, 404)

    def test_content_type_and_crlf(self):
        status, raw, headers = _ics_get(f"/api/projectbase/export/ics?project={self.pid}")
        self.assertEqual(status, 200)
        ctype = headers.get("Content-Type", "")
        self.assertIn("text/calendar", ctype)
        self.assertIn("BEGIN:VCALENDAR", raw)
        self.assertIn("END:VCALENDAR", raw)
        # RFC 5545 requires CRLF line endings (at least one present).
        self.assertIn("\r\n", raw)
        self.assertIn("VERSION:2.0", raw)
        self.assertIn("PRODID:", raw)

    def test_dated_issue_becomes_all_day_vevent(self):
        status, raw, _ = _ics_get(f"/api/projectbase/export/ics?project={self.pid}")
        self.assertEqual(status, 200)
        self.assertIn(self.dated_title, raw)
        # Find the VEVENT containing the fixture title and assert all-day form.
        events = re.findall(r"BEGIN:VEVENT\r\n(.*?)END:VEVENT", raw, re.S)
        target = [e for e in events if self.dated_title in e]
        self.assertTrue(target, "fixture issue missing a VEVENT")
        ev = target[0]
        self.assertIn("DTSTART;VALUE=DATE:20310115", ev)
        self.assertIn("@projectbase", ev)
        self.assertIn("UID:issue-", ev)

    def test_undated_issue_absent(self):
        status, raw, _ = _ics_get(f"/api/projectbase/export/ics?project={self.pid}")
        events = re.findall(r"BEGIN:VEVENT\r\n(.*?)\r\nEND:VEVENT", raw, re.S)
        undated_titles = [e for e in events if "ICS Undated" in e]
        self.assertEqual(undated_titles, [], "undated issue must not emit a VEVENT")

    def test_uids_unique_and_stable(self):
        s1, raw1, _ = _ics_get(f"/api/projectbase/export/ics?project={self.pid}")
        s2, raw2, _ = _ics_get(f"/api/projectbase/export/ics?project={self.pid}")
        self.assertEqual(s1, 200)
        self.assertEqual(s2, 200)
        uids1 = re.findall(r"^UID:(.+)$", raw1, re.M)
        uids2 = re.findall(r"^UID:(.+)$", raw2, re.M)
        self.assertEqual(len(uids1), len(set(uids1)), "duplicate UIDs in one feed")
        self.assertEqual(uids1, uids2, "UIDs must be stable across refreshes")

    def test_events_have_dtstamp_and_summary(self):
        status, raw, _ = _ics_get(f"/api/projectbase/export/ics?project={self.pid}")
        events = re.findall(r"BEGIN:VEVENT\r\n(.*?)\r\nEND:VEVENT", raw, re.S)
        self.assertGreater(len(events), 0, "no VEVENTs emitted")
        for ev in events:
            self.assertIn("DTSTAMP:", ev)
            self.assertIn("SUMMARY:", ev)
            self.assertIn("UID:", ev)

    def test_summary_escaping(self):
        """RFC 5545 TEXT escaping: comma/semicolon/newline in titles."""
        title = f"ICS Esc, Semi; Check {_uid()}"
        iid = _mk_issue(self.pid, title, "2031-02-20")
        try:
            status, raw, _ = _ics_get(f"/api/projectbase/export/ics?project={self.pid}")
            self.assertEqual(status, 200)
            self.assertIn("ICS Esc\\, Semi\\; Check", raw)
        finally:
            _request("DELETE", f"/api/collections/issues/records/{iid}",
                     headers={"Authorization": self.token})


if __name__ == "__main__":
    unittest.main()