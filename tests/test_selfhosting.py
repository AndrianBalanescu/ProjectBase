"""Self-hosting tests: systemd unit, installer, backup + restore tooling.

Covers the cycle-19 deploy milestone:
- deploy/projectbase.service template structure and hardening
- scripts/install-systemd.sh rendering, reserved-port refusal, systemd-analyze
- scripts/backup.sh live snapshot/download/verify/retention against the app
- scripts/restore.sh archive validation, --app-dir ordering regression,
  and a full online restore round-trip on a scratch instance

Uses only the stdlib (urllib) like the rest of the suite.
"""

import json
import os
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

import pytest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")

INSTALLER = os.path.join(REPO, "scripts", "install-systemd.sh")
BACKUP = os.path.join(REPO, "scripts", "backup.sh")
RESTORE = os.path.join(REPO, "scripts", "restore.sh")
UNIT_TEMPLATE = os.path.join(REPO, "deploy", "projectbase.service")


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


def api(method, path, body=None, auth=None, base=BASE_URL):
    headers = {"Authorization": auth} if auth else None
    return request(method, f"{base}{path}", body=body, headers=headers)


def superuser_token(base=BASE_URL, email=None, password=None):
    status, body = api("POST", "/api/collections/_superusers/auth-with-password",
                       {"identity": email or SUPERUSER_EMAIL,
                        "password": password or SUPERUSER_PASSWORD}, base=base)
    assert status == 200, f"superuser auth failed against {base}: {status} {body}"
    return body["token"]


# ---------------------------------------------------------------------------
# systemd unit template
# ---------------------------------------------------------------------------

def test_unit_template_exists_with_required_directives():
    text = open(UNIT_TEMPLATE).read()
    for directive in ("User=", "Group=", "WorkingDirectory=", "ExecStart=",
                      "Restart=on-failure", "NoNewPrivileges=true",
                      "ProtectSystem=full", "ProtectHome=read-only",
                      "PrivateTmp=true", "ReadWritePaths=", "WantedBy=multi-user.target"):
        assert directive in text, f"missing directive {directive}"
    # The template must not hardcode the gateway/default ports.
    assert ":8080" not in text and ":8090" not in text
    for placeholder in ("__PB_USER__", "__PB_GROUP__", "__APP_DIR__", "__PB_BIN__",
                        "__PB_HOST__", "__PB_PORT__"):
        assert placeholder in text, f"missing placeholder {placeholder}"


def test_unit_execstart_uses_relative_pb_layout():
    text = open(UNIT_TEMPLATE).read()
    exec_start = [l for l in text.splitlines() if l.startswith("ExecStart=")][0]
    assert "--dir pb_data" in exec_start
    assert "--publicDir pb_public" in exec_start
    assert "--hooksDir pb_hooks" in exec_start
    assert "--migrationsDir pb_migrations" in exec_start


# ---------------------------------------------------------------------------
# installer
# ---------------------------------------------------------------------------

def test_installer_script_is_executable_and_parses():
    assert os.access(INSTALLER, os.X_OK)
    r = run(["bash", "-n", INSTALLER])
    assert r.returncode == 0, r.stderr


def test_installer_print_unit_resolves_all_placeholders():
    r = run([INSTALLER, "--print-unit"])
    assert r.returncode == 0, r.stderr
    assert "__PB_" not in r.stdout, "unresolved placeholder in rendered unit"
    assert "0.0.0.0:8120" in r.stdout
    assert f"WorkingDirectory={REPO}/app" in r.stdout
    assert f"ExecStart={REPO}/pocketbase" in r.stdout


def test_installer_rejects_reserved_gateway_ports():
    for port in ("8080", "8090"):
        r = run([INSTALLER, "--port", port, "--print-unit"])
        assert r.returncode != 0
        assert "reserved" in (r.stdout + r.stderr).lower()


def test_installer_rejects_missing_checkout(tmp_path):
    r = run([INSTALLER, "--app-dir", str(tmp_path), "--print-unit"])
    assert r.returncode != 0
    assert "does not look like a ProjectBase checkout" in (r.stdout + r.stderr)


@pytest.mark.skipif(shutil.which("systemd-analyze") is None,
                    reason="systemd-analyze not available")
def test_rendered_unit_passes_systemd_analyze(tmp_path):
    r = run([INSTALLER, "--print-unit"])
    assert r.returncode == 0
    unit = tmp_path / "projectbase-test.service"
    unit.write_text(r.stdout)
    v = run(["systemd-analyze", "verify", str(unit)], timeout=60)
    assert v.returncode == 0, v.stderr


# ---------------------------------------------------------------------------
# backup script
# ---------------------------------------------------------------------------

def test_backup_script_is_executable_and_parses():
    assert os.access(BACKUP, os.X_OK)
    r = run(["bash", "-n", BACKUP])
    assert r.returncode == 0, r.stderr


def test_backup_creates_verified_zip_and_cleans_server_side(tmp_path):
    token = superuser_token()
    status, before = api("GET", "/api/backups", auth=token)
    assert status == 200
    before_keys = {b["key"] for b in before}

    r = run([BACKUP, "--out", str(tmp_path)], timeout=180)
    assert r.returncode == 0, r.stdout + r.stderr
    zips = list(tmp_path.glob("projectbase-*.zip"))
    assert len(zips) == 1
    with zipfile.ZipFile(zips[0]) as zf:
        assert zf.testzip() is None
        names = zf.namelist()
        assert any(n.endswith("data.db") for n in names), names

    status, after = api("GET", "/api/backups", auth=token)
    assert status == 200
    assert {b["key"] for b in after} == before_keys, \
        "backup.sh must delete its server-side snapshot after download"


def test_backup_retention_keeps_only_n(tmp_path):
    for _ in range(2):
        r = run([BACKUP, "--out", str(tmp_path), "--keep", "1"], timeout=180)
        assert r.returncode == 0, r.stdout + r.stderr
    zips = list(tmp_path.glob("projectbase-*.zip"))
    assert len(zips) == 1, f"expected 1 after retention, got {len(zips)}"


def test_backup_filenames_do_not_collide_within_same_second(tmp_path):
    """Regression: STAMP used only second precision, so two rapid backups in
    the same second overwrote each other (same filename) — the second silently
    clobbered the first even with --keep 0. Filenames must be unique."""
    for _ in range(2):
        r = run([BACKUP, "--out", str(tmp_path), "--keep", "0"], timeout=180)
        assert r.returncode == 0, r.stdout + r.stderr
    zips = sorted(tmp_path.glob("projectbase-*.zip"))
    assert len(zips) == 2, f"expected 2 distinct backups, got {len(zips)}"
    assert len({z.name for z in zips}) == 2, "backup filenames collided"


def test_backup_download_failure_removes_partial_and_server_side(tmp_path):
    """Regression: on a download failure, backup.sh must (a) remove the partial
    local file and (b) DELETE the server-side snapshot it created, so neither a
    truncated archive nor a leaked snapshot remains. A mock API serves auth +
    snapshot, then fails the download; the script must still attempt the
    server-side DELETE and exit non-zero with no leftover .zip."""
    import http.server
    import socketserver
    import threading

    created_keys = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def _json(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path == "/api/collections/_superusers/auth-with-password":
                self._json(200, {"token": "mock-token"})
            elif self.path == "/api/backups":
                key = "mock_backup_20260823000000.zip"
                created_keys.append(key)
                self._json(200, {"key": key})
            elif self.path == "/api/files/token":
                self._json(200, {"token": "mock-file-token"})
            elif self.path.endswith("/restore") or self.path == "/api/backups":
                self._json(200, {})
            else:
                self._json(404, {"message": "not found"})

        def do_GET(self):
            # Serve the backups list only AFTER the snapshot POST has created a
            # key (so backup.sh sees it as "new" and proceeds), then fail the
            # actual download with 5xx so curl -f exits non-zero.
            if self.path.startswith("/api/backups") and "token=" not in self.path:
                payload = [{"key": "mock_backup_20260823000000.zip", "size": 1}] \
                    if created_keys else []
                self._json(200, payload)
            else:
                self._json(500, {"message": "download exploded"})

        def do_DELETE(self):
            created_keys.append("DELETED")
            self._json(200, {})

        def log_message(self, *a):
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as srv:
        port = srv.server_address[1]
        thread = threading.Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{port}"
        out = tmp_path / "out"
        out.mkdir()
        try:
            r = run([BACKUP, "--url", base, "--email", "x@y.z",
                     "--password", "pw", "--out", str(out), "--timeout", "20"],
                    timeout=120)
        finally:
            srv.shutdown()
        assert r.returncode != 0, "backup must fail on download error"
        # No partial or complete local zip may remain.
        assert not list(out.glob("projectbase-*.zip")), \
            f"partial/full .zip leaked: {list(out.glob('projectbase-*.zip'))}"
        # The server-side snapshot must have been deleted (no leak).
        assert created_keys.count("DELETED") >= 1, "server-side snapshot was not cleaned up"


# ---------------------------------------------------------------------------
# restore script (validation + ordering regression, no destructive paths)
# ---------------------------------------------------------------------------

def test_restore_script_is_executable_and_parses():
    assert os.access(RESTORE, os.X_OK)
    r = run(["bash", "-n", RESTORE])
    assert r.returncode == 0, r.stderr


def test_restore_help_flag_shows_usage_without_error():
    """Regression: --help was consumed as the positional backup zip and failed
    with 'backup file not found: --help' instead of printing usage. Both the
    leading flag and a trailing flag must show usage and exit 0."""
    for args in ([RESTORE, "--help"], [RESTORE, "-h"], [RESTORE, "--url", "http://x", "--help"]):
        r = run(args)
        assert r.returncode == 0, f"{args} exited {r.returncode}: {r.stderr}"
        assert "restore a backup zip" in r.stdout, f"{args} did not print usage"


def test_restore_no_args_prints_usage_and_fails():
    r = run([RESTORE])
    assert r.returncode == 1
    assert "restore a backup zip" in r.stdout or "restore a backup zip" in r.stderr


@pytest.mark.skipif(not os.path.exists("/etc/systemd/system/projectbase.service"),
                    reason="projectbase.service not installed on this host")
def test_restore_offline_detects_managed_unit_not_sigpipe_branch(tmp_path):
    """Regression: the offline guard tested `systemctl list-unit-files |
    grep -q` in a pipeline. grep -q closes the pipe on first match, SIGPIPEs
    systemctl, and under `set -o pipefail` the pipeline exits 141 — so the
    guard ALWAYS took the elif branch and reported 'not projectbase.service'
    even when the unit was present. It must detect the installed unit and reach
    the root-required (managed-service) message instead."""
    fake = tmp_path / "fake.zip"
    with zipfile.ZipFile(fake, "w") as zf:
        zf.writestr("data.db", "x")
    r = run([RESTORE, str(fake), "--offline", "--service", "projectbase",
             "--port", "8199"])
    combined = r.stdout + r.stderr
    if os.geteuid() == 0:
        # Root: it will try to stop the unit on the (missing) :8199 port; we
        # only assert it did NOT take the "listening but not service" branch.
        assert "not projectbase.service" not in combined, combined
    else:
        assert "requires root" in combined, \
            "should reach the root-required gate (unit detected); got: " + combined


def test_restore_rejects_non_zip(tmp_path):
    bad = tmp_path / "bad.zip"
    bad.write_text("definitely not a zip archive")
    r = run([RESTORE, str(bad)])
    assert r.returncode != 0
    assert "unzip -t" in (r.stdout + r.stderr)


def test_restore_rejects_zip_without_database(tmp_path):
    bad = tmp_path / "empty.zip"
    with zipfile.ZipFile(bad, "w") as zf:
        zf.writestr("readme.txt", "no database here")
    r = run([RESTORE, str(bad)])
    assert r.returncode != 0
    assert "data.db" in (r.stdout + r.stderr)


def test_large_archive_with_db_not_falsely_rejected_by_sigpipe(tmp_path):
    """Regression: the data.db check used `unzip -l | grep -q` in a pipe. With
    many entries, grep -q matches early and SIGPIPEs unzip, so under
    `set -o pipefail` the pipeline exits 141 and the script falsely rejected a
    VALID backup (or deleted it). A large archive containing data.db must be
    accepted by both backup and restore paths."""
    big = tmp_path / "big.zip"
    with zipfile.ZipFile(big, "w") as zf:
        zf.writestr("data.db", "sqlite")
        # Hundreds of small files so unzip -l streams long after the match.
        for i in range(2000):
            zf.writestr(f"storage/obj_{i}.bin", b"x" * 64)
    # Restore must accept it (no die), reaching the app-unreachable gate.
    r = run([RESTORE, str(big), "--url", "http://127.0.0.1:1", "--timeout", "5"])
    combined = r.stdout + r.stderr
    assert "does not contain data.db" not in combined, combined
    assert "not reachable" in combined, combined


def test_restore_app_dir_flag_takes_effect(tmp_path):
    """Regression: PB_DATA must be resolved AFTER --app-dir parsing.

    An earlier version computed pb_data from the repo root before parsing
    arguments, so --app-dir was silently ignored and offline restores could
    target the wrong (live!) directory.
    """
    appdir = tmp_path / "elsewhere" / "app"
    appdir.mkdir(parents=True)
    # Do NOT create pb_data here: the script must fail referencing THIS path.
    fake = tmp_path / "fake.zip"
    with zipfile.ZipFile(fake, "w") as zf:
        zf.writestr("data.db", "sqlite placeholder")
    r = run([RESTORE, str(fake), "--offline", "--no-service",
             "--app-dir", str(appdir), "--port", "8199"])
    assert r.returncode != 0
    combined = r.stdout + r.stderr
    assert str(appdir / "pb_data") in combined, combined


# ---------------------------------------------------------------------------
# full online restore round-trip on a scratch instance
# ---------------------------------------------------------------------------

SCRATCH_PORT = None  # resolved at spawn time to the first free port
SCRATCH_ROOT = tempfile.mkdtemp(prefix="pb-selfhost-test-")
_scratch_proc = None


def _pick_free_port():
    """First free port in 8183..8199 (8181 is used by other tooling)."""
    for port in range(8183, 8200):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("no free scratch port in 8183..8199")


def _spawn_scratch():
    global _scratch_proc
    pbdata = os.path.join(SCRATCH_ROOT, "pb_data")
    os.makedirs(pbdata, exist_ok=True)
    upsert = subprocess.run(
        [os.path.join(REPO, "pocketbase"), "superuser", "upsert",
         "selfhost@test.local", "selfhost-pass-1", "--dir", pbdata],
        capture_output=True, timeout=60)
    assert upsert.returncode == 0, upsert.stderr
    log = open(os.path.join(SCRATCH_ROOT, "pb.log"), "ab")
    global SCRATCH_PORT
    SCRATCH_PORT = _pick_free_port()
    _scratch_proc = subprocess.Popen(
        [os.path.join(REPO, "pocketbase"), "--dir", pbdata, "serve",
         "--publicDir", os.path.join(REPO, "app", "pb_public"),
         "--hooksDir", os.path.join(SCRATCH_ROOT, "pb_hooks"),
         "--migrationsDir", os.path.join(REPO, "app", "pb_migrations"),
         "--http", f"127.0.0.1:{SCRATCH_PORT}"],
        stdout=log, stderr=log)
    base = f"http://127.0.0.1:{SCRATCH_PORT}"
    for _ in range(30):
        try:
            status, _ = request("GET", f"{base}/api/health", timeout=2)
            if status == 200:
                return base
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(1)
    raise RuntimeError("scratch instance did not become healthy")


@pytest.fixture(scope="module")
def scratch_base():
    os.makedirs(os.path.join(SCRATCH_ROOT, "pb_hooks"), exist_ok=True)
    base = _spawn_scratch()
    yield base
    if _scratch_proc and _scratch_proc.poll() is None:
        _scratch_proc.send_signal(signal.SIGTERM)
        try:
            _scratch_proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _scratch_proc.kill()


def _scratch_token(base):
    return superuser_token(base, "selfhost@test.local", "selfhost-pass-1")


def _scratch_projects(base):
    token = _scratch_token(base)
    status, body = api("GET", "/api/collections/projects/records?perPage=100",
                       auth=token, base=base)
    assert status == 200, body
    return [p["name"] for p in body["items"]]


def _create_scratch_project(base, name):
    token = _scratch_token(base)
    status, body = api("POST", "/api/collections/projects/records",
                       {"name": name, "identifier": name[:8], "status": "todo"},
                       auth=token, base=base)
    assert status == 200, body


def test_online_backup_restore_round_trip_on_scratch_instance(scratch_base, tmp_path):
    base = scratch_base
    _create_scratch_project(base, "ROUNDTRIP-KEEP")
    r = run([BACKUP, "--url", base, "--email", "selfhost@test.local",
             "--password", "selfhost-pass-1", "--out", str(tmp_path)], timeout=180)
    assert r.returncode == 0, r.stdout + r.stderr
    snapshot = sorted(tmp_path.glob("projectbase-*.zip"))[-1]

    # Mutate AFTER the snapshot: this project must disappear on restore.
    _create_scratch_project(base, "ROUNDTRIP-DROP")
    assert "ROUNDTRIP-DROP" in _scratch_projects(base)

    r = run([RESTORE, str(snapshot), "--url", base, "--email", "selfhost@test.local",
             "--password", "selfhost-pass-1", "--timeout", "90"], timeout=180)
    assert r.returncode == 0, r.stdout + r.stderr

    projects = _scratch_projects(base)
    assert "ROUNDTRIP-KEEP" in projects
    assert "ROUNDTRIP-DROP" not in projects, f"restore did not revert data: {projects}"
    status, _ = request("GET", f"{base}/api/health", timeout=5)
    assert status == 200
