#!/usr/bin/env python3
"""Sweep test-fixture issues and ephemeral test projects out of a ProjectBase instance.

The dogfooded ProjectBase instance doubles as the pytest target (see
AGENTS.md). Fixture records that tests create and forget to delete pollute
the backlog. This utility finds non-authentic test projects and test-fixture
records matching canonical test patterns and (optionally) deletes them, so a
human reading the board sees real work, not automated junk.

Usage:
  python3 scripts/cleanup-test-fixtures.py             # dry-run: report only
  python3 scripts/cleanup-test-fixtures.py --apply     # delete matches
  python3 scripts/cleanup-test-fixtures.py --json      # machine-readable
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")

AUTHENTIC_PROJECT_IDENTIFIERS = {"PB", "HOME", "LOAD", "IBR", "OMNI", "MEM"}

# Junk observability alert rules created by auth-guard probes
# (metric_name 'x' via POST /alerts/configure) accumulate one per suite run
# and starve the evaluate window's fetch cap. See cycle 83.
JUNK_ALERT_METRICS = {"x"}
ALERT_CUSTOM_NAME_PREFIX = "Custom Alert Rule"

TEST_ISSUE_EXACT_TITLES = {
    "Architecture Spec",
    "Backend API",
    "Frontend UI",
    "E2E Testing",
    "Final Peer Review",
    "Step 1 Foundation",
    "Step 2 Feature",
    "Step 3 QA",
    "Arch Design",
    "Coding Task",
    "Verify Task",
    "Py Task 1",
    "Py Task 2",
    "SDK Code Gen",
    "Metrics Audit",
    "Test Parent",
    "Task 1 Spec",
    "Task 2 Build",
}

FIXTURE_TITLE_PREFIXES = (
    "guard-probe",  # auth-guard suite probe (test_custom_route_auth_guards)
    "Export CustomFields ",
    "Export Fixture ",
    "Search Identifier Probe ",
    "Keyed A ",
    "Keyed B ",
    "Linear Test ",
    "Linear Dedup ",
    "Linear Csv Form ",
    "L T ",
    "Plane Test ",
    "Plane Csv Form ",
    "Plane T ",
    "Plane Idem ",
    "Plane Csv Blank ",
    "Norm Check ",
    "Fuzz Good ",
    "Importer Metadata Check ",
    "Importer Start Date ",
    "Importer Test Issue ",
    "Importer Dedup Title ",
    "Status test ",
    "Probe after create",
    "Rap",
    "Rel QA target ",
    "TL QA target ",
    "RTprobe",
    "DAG Execution Test ",
    "DAG Step Test ",
    "Subtask Split Test ",
    "Peer Review Test ",
    "Lease Test ",
    "Auto-Heal Task ",
    "Auto-Triage Test ",
    "Sandbox Test ",
    "Anomaly Probe ",
    "Replication Test ",
    "Federation Test ",
    "SSO User Issue ",
    "Autoscale Task ",
    "Workflow Test ",
    "Tenant Issue ",
    "Heal Issue ",
    "Git Issue ",
    "Git Feature Issue ",
    "Consensus Issue ",
)

_FIXTURE_UID_RE = re.compile(r".*([0-9a-f]{8,40}|t[0-9]{4,10}|w[0-9]{4,10})\Z", re.IGNORECASE)
_PAGE_SIZE = 200


def _request(method, path, body=None, token=None, timeout=20):
    url = f"{BASE_URL}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode(errors="replace")
            status = resp.status
    except urllib.error.HTTPError as err:
        raw = err.read().decode(errors="replace")
        status = err.code
    except urllib.error.URLError as err:
        raise SystemExit(f"cannot reach ProjectBase at {BASE_URL}: {err.reason}") from err
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


def _superuser_token():
    status, body = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200:
        raise SystemExit(f"superuser auth failed ({status}): {body}")
    return body["token"]


def _is_fixture(record, authentic_project_ids):
    proj_id = record.get("project")
    title = (record.get("title") or "").strip()
    if proj_id not in authentic_project_ids:
        return True
    if title in TEST_ISSUE_EXACT_TITLES:
        return True
    for prefix in FIXTURE_TITLE_PREFIXES:
        if title.startswith(prefix):
            return True
    return False


def find_test_projects(token):
    projects = []
    for page in range(1, 100):
        status, body = _request("GET", f"/api/collections/projects/records?perPage={_PAGE_SIZE}&page={page}", token=token)
        if status != 200:
            break
        items = body.get("items") or []
        if not items:
            break
        projects.extend(items)
        if len(items) < _PAGE_SIZE:
            break
    authentic_projects = [p for p in projects if p.get("identifier") in AUTHENTIC_PROJECT_IDENTIFIERS]
    test_projects = [p for p in projects if p.get("identifier") not in AUTHENTIC_PROJECT_IDENTIFIERS]
    authentic_ids = {p["id"] for p in authentic_projects}
    return authentic_ids, test_projects


def find_fixtures(token, authentic_ids):
    matches = []
    for page in range(1, 100):
        status, body = _request(
            "GET",
            f"/api/collections/issues/records?perPage={_PAGE_SIZE}&sort=-created&page={page}",
            token=token,
        )
        if status != 200:
            break
        items = body.get("items") or []
        if not items:
            break
        matches.extend(it for it in items if _is_fixture(it, authentic_ids))
        if len(items) < _PAGE_SIZE:
            break
    return matches


def find_junk_alert_rules(token):
    """Find junk observability alert rules (auth-guard probe leftovers)."""
    junk = []
    page = 1
    while True:
        status, body = _request(
            "GET",
            f"/api/collections/observability_alert_configs/records?perPage={_PAGE_SIZE}&page={page}",
            token=token,
        )
        if status != 200:
            break
        items = body.get("items", [])
        for rec in items:
            metric = (rec.get("metric_name") or "").strip().lower()
            name = rec.get("name") or ""
            if metric in JUNK_ALERT_METRICS or (
                name == ALERT_CUSTOM_NAME_PREFIX and metric not in ("error_rate_pct", "p95_latency_ms", "failure_count", "dlq_queue_size")
            ):
                junk.append(rec)
        if len(items) < _PAGE_SIZE:
            break
        page += 1
        if page > 50:
            break
    return junk


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="delete matches (default: report only)")
    parser.add_argument("--json", action="store_true", help="output JSON summary")
    args = parser.parse_args(argv)

    token = _superuser_token()
    authentic_ids, test_projects = find_test_projects(token)
    matches = find_fixtures(token, authentic_ids)
    junk_alerts = find_junk_alert_rules(token)

    if args.json:
        print(json.dumps({
            "matches": len(matches) + len(test_projects),
            "issues": len(matches),
            "projects": len(test_projects),
            "junk_alert_rules": len(junk_alerts),
            "prefixes": list(FIXTURE_TITLE_PREFIXES),
            "dry_run": not args.apply,
        }))
        return 0

    print(f"found {len(matches)} fixture issues, {len(test_projects)} test projects, {len(junk_alerts)} junk alert rules")
    if not matches and not test_projects and not junk_alerts:
        print("clean: no test fixtures in the database.")
        return 0

    if not args.apply:
        print("dry-run only. Rerun with --apply to delete matches.")
        return 0

    # Apply cleanup
    for item in matches:
        _request("DELETE", f"/api/collections/issues/records/{item['id']}", token=token)
    for proj in test_projects:
        _request("DELETE", f"/api/collections/projects/records/{proj['id']}", token=token)
    for rec in junk_alerts:
        _request("DELETE", f"/api/collections/observability_alert_configs/records/{rec['id']}", token=token)

    print(f"deleted {len(matches)} issues and {len(test_projects)} test projects and {len(junk_alerts)} junk alert rules.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
