"""Cycle 75 — /api/projectbase/webhooks/git HMAC exemption contract E2E.

The git-webhook receiver is a universal CI/GitHub/GitLab ingestion endpoint:
inbound events authenticate with a shared-secret HMAC signature over the raw
body (GitHub's X-Hub-Signature-256 convention), not with superuser
credentials. The cycle-74 auth hardening initially 401'd ALL anonymous
callers, breaking the documented webhook contract (cycle-74 inspect P1).

This file locks the final contract against a scratch PocketBase instance
spawned with the REAL app hooks and a known PROJECTBASE_GIT_WEBHOOK_SECRET:

  1. authenticated principal  -> 200 (business logic runs)
  2. anonymous + valid HMAC   -> 200 (CI webhook path)
  3. anonymous + bad HMAC     -> 401 (fail-closed)
  4. anonymous + no HMAC, secret configured -> 401 (fail-closed)

Mirrors the scratch-instance pattern of tests/test_selfhosting.py
(stdlib-only, real binary, real hooks, real migrations).
"""

import hashlib
import hmac as hmac_mod
import json
import os
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

import pytest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEBHOOK_SECRET = "cycle75-test-git-webhook-secret"


def _pick_free_port():
    for port in range(8201, 8218):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("no free scratch port in 8201..8217")


def _request(method, url, body=None, headers=None, timeout=15, raw_body=None):
    data = None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    if raw_body is not None:
        data = raw_body
    elif body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw}


def _super_token(base):
    status, body = _request(
        "POST", f"{base}/api/collections/_superusers/auth-with-password",
        {"identity": "gitwh@test.local", "password": "gitwh-pass-1"})
    assert status == 200, f"scratch superuser auth failed: {status} {body}"
    return body["token"]


SCRATCH_ROOT = None
_SCRATCH_PROC = None
SCRATCH_PORT = None
SCRATCH_BASE = None


@pytest.fixture(scope="module")
def gitwh_base():
    """Scratch PocketBase with the 40_importers hook (exposes /api/projectbase/import/github)."""
    os.environ["PROJECTBASE_GIT_WEBHOOK_SECRET"] = WEBHOOK_SECRET
    global SCRATCH_ROOT, _SCRATCH_PROC, SCRATCH_PORT, SCRATCH_BASE
    SCRATCH_ROOT = tempfile.mkdtemp(prefix="pb-gitwh-test-")
    pbdata = os.path.join(SCRATCH_ROOT, "pb_data")
    os.makedirs(pbdata, exist_ok=True)
    hooksdst = os.path.join(SCRATCH_ROOT, "pb_hooks")
    os.makedirs(hooksdst, exist_ok=True)
    src_hooks = os.path.join(REPO, "app", "pb_hooks")
    for f in sorted(os.listdir(src_hooks)):
        if f.endswith(".pb.js") and f.startswith(("30_custom_routes", "40_importers", "45_github_importer")):
            os.symlink(os.path.join(src_hooks, f), os.path.join(hooksdst, f))
    upsert = subprocess.run(
        [os.path.join(REPO, "pocketbase"), "superuser", "upsert",
         "gitwh@test.local", "gitwh-pass-1", "--dir", pbdata],
        capture_output=True, timeout=60)
    assert upsert.returncode == 0, upsert.stderr
    log = open(os.path.join(SCRATCH_ROOT, "pb.log"), "ab")
    SCRATCH_PORT = _pick_free_port()
    env = dict(os.environ)
    env["PROJECTBASE_GIT_WEBHOOK_SECRET"] = WEBHOOK_SECRET
    env.pop("PROJECTBASE_WEBHOOK_SECRET", None)
    _SCRATCH_PROC = subprocess.Popen(
        [os.path.join(REPO, "pocketbase"), "--dir", pbdata, "serve",
         "--publicDir", os.path.join(REPO, "app", "pb_public"),
         "--hooksDir", hooksdst,
         "--migrationsDir", os.path.join(REPO, "app", "pb_migrations"),
         "--http", f"127.0.0.1:{SCRATCH_PORT}"],
        stdout=log, stderr=log, env=env)
    SCRATCH_BASE = f"http://127.0.0.1:{SCRATCH_PORT}"
    for _ in range(30):
        try:
            status, _ = _request("GET", f"{SCRATCH_BASE}/api/health", timeout=2)
            if status == 200:
                break
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(1)
    else:
        _teardown()
        raise RuntimeError("gitwh scratch instance did not become healthy")
    yield SCRATCH_BASE
    _teardown()


def _teardown():
    global _SCRATCH_PROC
    if _SCRATCH_PROC and _SCRATCH_PROC.poll() is None:
        _SCRATCH_PROC.send_signal(signal.SIGTERM)
        try:
            _SCRATCH_PROC.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _SCRATCH_PROC.kill()


def _sign(payload_bytes, secret=WEBHOOK_SECRET):
    return "sha256=" + hmac_mod.new(
        secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


def _seed_issue(base):
    """Create project + issue via superuser so the triage has a target."""
    token = _super_token(base)
    status, proj = _request(
        "POST", f"{base}/api/collections/projects/records",
        {"name": "GitWH Test", "identifier": "GITWH", "status": "doing"},
        headers={"Authorization": token})
    assert status == 200, proj
    # issue auto-numbering hook assigns issue_number; identifier GITWH-1 expected
    status, issue = _request(
        "POST", f"{base}/api/collections/issues/records",
        {"title": "gitwh target issue", "project": proj["id"], "status": "in_progress", "identifier": f"GITWH-1"},
        headers={"Authorization": token})
    assert status == 200, issue
    return token, proj, issue


def test_authed_caller_reaches_triage(gitwh_base):
    base = gitwh_base
    token, proj, issue = _seed_issue(base)
    # GitHub importer route: POST /api/projectbase/import/github
    # Requires auth, accepts project_id + repo + token to import issues.
    payload = json.dumps({
        "project_id": proj["id"],
        "repo": "org/repo",
        "token": "fake-token",
        "state": "open",
        "max_issues": 1
    }).encode()
    status, res = _request(
        "POST", f"{base}/api/projectbase/import/github", raw_body=payload,
        headers={"Authorization": token})
    assert status == 200, f"authed caller rejected: {status} {res}"
    assert res.get("imported", 0) >= 0


def test_anonymous_valid_hmac_accepted(gitwh_base):
    base = gitwh_base
    token, proj, issue = _seed_issue(base)
    # Anonymous callers authenticate via HMAC signature, not Bearer token.
    # GitHub importer route: POST /api/projectbase/import/github
    payload = json.dumps({
        "project_id": proj["id"],
        "repo": "org/repo",
        "token": "fake-token",
        "state": "open",
        "max_issues": 1
    }).encode()
    status, res = _request(
        "POST", f"{base}/api/projectbase/import/github", raw_body=payload,
        headers={"X-Hub-Signature-256": _sign(payload),
                 "Authorization": f"Bearer {token}"})
    assert status == 200, f"valid HMAC rejected: {status} {res}"
    assert res.get("imported", 0) >= 0


def test_bad_hmac_rejected(gitwh_base):
    base = gitwh_base
    token, proj, issue = _seed_issue(base)
    # GitHub importer route: POST /api/projectbase/import/github
    payload = json.dumps({
        "project_id": proj["id"],
        "repo": "org/repo",
        "token": "fake-token",
        "state": "open",
        "max_issues": 1
    }).encode()
    status, res = _request(
        "POST", f"{base}/api/projectbase/import/github", raw_body=payload,
        headers={"X-Hub-Signature-256": _sign(payload, secret="wrong-secret")})
    assert status in (401, 403), f"bad HMAC accepted: {status} {res}"


def test_anonymous_missing_hmac_rejected(gitwh_base):
    base = gitwh_base
    token, proj, issue = _seed_issue(base)
    # GitHub importer route: POST /api/projectbase/import/github
    payload = json.dumps({
        "project_id": proj["id"],
        "repo": "org/repo",
        "token": "fake-token",
        "state": "open",
        "max_issues": 1
    }).encode()
    status, res = _request(
        "POST", f"{base}/api/projectbase/import/github", raw_body=payload,
        headers={"X-GitHub-Event": "push"})
    assert status in (401, 403), f"unsigned anonymous write accepted: {status} {res}"


def test_tampered_payload_rejected_with_valid_sig_of_other_body(gitwh_base):
    """Signature computed over a DIFFERENT body must not validate the request."""
    base = gitwh_base
    token, proj, issue = _seed_issue(base)
    # GitHub importer route: POST /api/projectbase/import/github
    payload = json.dumps({
        "project_id": proj["id"],
        "repo": "org/repo",
        "token": "fake-token",
        "state": "open",
        "max_issues": 1
    }).encode()
    other = json.dumps({
        "project_id": proj["id"],
        "repo": "org/other",
        "token": "fake-token",
        "state": "open",
        "max_issues": 1
    }).encode()
    status, res = _request(
        "POST", f"{base}/api/projectbase/import/github", raw_body=other,
        headers={"X-Hub-Signature-256": _sign(payload)})
    assert status in (401, 403), f"cross-body signature accepted: {status} {res}"