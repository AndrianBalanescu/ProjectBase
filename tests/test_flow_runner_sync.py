"""Bidirectional Kanban sync tests for the Flow autonomous runner.

Cycle-20 milestone (PB-43): the autonomous daemon (`scripts/flow_runner.py`)
must not only READ issues from the Kanban but WRITE back — authenticate against
the API, claim a backlog/todo issue to `in_progress`, and post an agent audit
comment — so agents and humans see exactly what the daemon is working on.

These tests drive `flow_runner.py --once` against a scratch PocketBase instance
spawned on a free port (same pattern as tests/test_selfhosting.py) and assert
the write-back actually lands in the API (not just the SQLite read path).

Uses only the stdlib (urllib) like the rest of the suite.
"""

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
RUNNER = os.path.join(REPO, "scripts", "flow_runner.py")

# Scratch-instance protocol superuser (upserted below), same lifecycle as the
# self-host restore tests.
_SCRATCH_EMAIL = "selfhost@test.local"
_SCRATCH_PASS = "selfhost-pass-1"

_SCRATCH_ROOT = tempfile.mkdtemp(prefix="pb-flow-sync-test-")
SCRATCH_PORT = None  # resolved at spawn time
_scratch_proc = None


def run(cmd, **kw):
    return subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True,
                          text=True, timeout=kw.pop("timeout", 120), **kw)


def request(method, url, body=None, headers=None, timeout=15):
    """Stdlib HTTP helper returning (status, parsed_json_or_text)."""
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


def api(method, path, body=None, auth=None, base=None):
    headers = {"Authorization": auth} if auth else None
    return request(method, f"{base}{path}", body=body, headers=headers)


def _pick_free_port():
    for port in range(8183, 8200):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("no free scratch port in 8183..8199")


def _spawn_scratch():
    global _scratch_proc, SCRATCH_PORT
    pbdata = os.path.join(_SCRATCH_ROOT, "pb_data")
    os.makedirs(pbdata, exist_ok=True)
    upsert = subprocess.run(
        [os.path.join(REPO, "pocketbase"), "superuser", "upsert",
         _SCRATCH_EMAIL, _SCRATCH_PASS, "--dir", pbdata],
        capture_output=True, timeout=60)
    assert upsert.returncode == 0, upsert.stderr
    log = open(os.path.join(_SCRATCH_ROOT, "pb.log"), "ab")
    SCRATCH_PORT = _pick_free_port()
    _scratch_proc = subprocess.Popen(
        [os.path.join(REPO, "pocketbase"), "--dir", pbdata, "serve",
         "--publicDir", os.path.join(REPO, "app", "pb_public"),
         "--hooksDir", os.path.join(REPO, "app", "pb_hooks"),
         "--migrationsDir", os.path.join(REPO, "app", "pb_migrations"),
         "--http", f"127.0.0.1:{SCRATCH_PORT}"],
        stdout=log, stderr=log)
    base = f"http://127.0.0.1:{SCRATCH_PORT}"
    for _ in range(40):
        try:
            status, _ = request("GET", f"{base}/api/health", timeout=2)
            if status == 200:
                return base
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.5)
    raise RuntimeError("scratch instance did not become healthy")


@pytest.fixture(scope="module")
def scratch_base():
    base = _spawn_scratch()
    yield base
    if _scratch_proc and _scratch_proc.poll() is None:
        _scratch_proc.send_signal(signal.SIGTERM)
        try:
            _scratch_proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            _scratch_proc.kill()


def _scratch_token(base):
    status, body = api("POST", "/api/collections/_superusers/auth-with-password",
                       {"identity": _SCRATCH_EMAIL, "password": _SCRATCH_PASS},
                       base=base)
    assert status == 200, body
    return body["token"]


def _seed_project(base, identifier="SYNC"):
    """Create a project and a single backlog issue on the scratch instance.

    Returns (project_id, issue_id).
    """
    token = _scratch_token(base)
    status, proj = api("POST", "/api/collections/projects/records",
                       {"name": f"Sync Test {identifier}", "identifier": identifier},
                       auth=token, base=base)
    assert status == 200, proj
    project_id = proj["id"]

    status, issue = api("POST", "/api/collections/issues/records",
                        {"title": "Claimed by flow", "project": project_id,
                         "status": "todo"}, auth=token, base=base)
    assert status == 200, issue
    return project_id, issue["id"]


def _env(base):
    """Env for running flow_runner against the scratch instance."""
    env = dict(os.environ)
    env["PROJECTBASE_URL"] = base
    env["PB_SUPERUSER_EMAIL"] = _SCRATCH_EMAIL
    env["PB_SUPERUSER_PASSWORD"] = _SCRATCH_PASS
    env["AI_API_BASE"] = "http://127.0.0.1:1/invalid"  # force deterministic research
    return env


def test_runner_authenticates_and_reads(scratch_base):
    """The runner resolves a token and can read the project/issues via API."""
    _, issue_id = _seed_project(scratch_base, "SYNCR")
    r = run(["python3", RUNNER, "--project", "SYNCR", "--once", "--dry-run"],
            env=_env(scratch_base), timeout=60)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "Authenticated as _superusers" in r.stdout
    out = json.loads(r.stdout[r.stdout.index("{"):r.stdout.rindex("}") + 1])
    assert out["status"] == "in_progress"
    assert out["task"]  # identifier resolved (SYNCR-1)
    assert out["claimed"] is False  # dry-run must not write

    # Dry-run must NOT claim, and must NOT post an audit comment.
    token = _scratch_token(scratch_base)
    status, issue = api("GET", f"/api/collections/issues/records/{issue_id}",
                        auth=token, base=scratch_base)
    assert status == 200, issue
    assert issue["status"] == "todo", "dry-run must not move the issue to in_progress"
    status, comments = api(
        "GET", f"/api/collections/comments/records?filter=(issue='{issue_id}')",
        auth=token, base=scratch_base)
    assert status == 200, comments
    assert comments["totalItems"] == 0, "dry-run must not post an audit comment"


def test_runner_claims_backlog_to_in_progress(scratch_base):
    """A real (non-dry-run) cycle must move a backlog issue to in_progress and
    post an audit comment, i.e. bidirectional write-back."""
    _, issue_id = _seed_project(scratch_base, "SYNCW")
    r = run(["python3", RUNNER, "--project", "SYNCW", "--once"],
            env=_env(scratch_base), timeout=60)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "Claimed" in r.stdout
    # The runner must honestly report whether the audit comment persisted.
    assert "persisted" in r.stdout, "runner must log the comment write-back result"

    token = _scratch_token(scratch_base)
    status, issue = api("GET", f"/api/collections/issues/records/{issue_id}",
                        auth=token, base=scratch_base)
    assert status == 200, issue
    assert issue["status"] == "in_progress", "issue should have been claimed"

    # An agent audit comment must exist on the issue.
    status, comments = api(
        "GET", f"/api/collections/comments/records?filter=(issue='{issue_id}')",
        auth=token, base=scratch_base)
    assert status == 200, comments
    assert comments["totalItems"] >= 1
    assert comments["items"][0]["author_type"] == "agent"


def test_runner_no_auth_guards_writebacks():
    """Without an API token the write-back helpers must fail closed (return
    False) instead of posting a partial/unauthenticated comment. This covers
    the honest `FAILED` branch of the claim/comment log."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("flow_runner_mod", RUNNER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    runner = mod.FlowRunner(project_key="NONE", cycle_interval=1, dry_run=True)
    runner.token = ""  # force the unauthenticated path

    assert runner.claim_issue("any-id") is False
    assert runner.add_comment("any-id", "x") is False

