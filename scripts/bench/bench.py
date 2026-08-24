#!/usr/bin/env python3
"""ProjectBase reproducible benchmark harness (stdlib only).

Measures on an isolated scratch PocketBase instance (never the live one):
  1. Cold start  - wall time from process spawn to first 200 from /api/health,
                   first boot on a fresh data dir (includes JS migrations) and
                   subsequent boots on the already-migrated dir.
  2. RAM         - VmRSS idle (after boot) and loaded (after 10k issues +
                   a query warmup round).
  3. Query p50/p95 at 10k issues - first page, filtered, title search.

Usage:
    python3 scripts/bench/bench.py                       # 10k issues, full run
    python3 scripts/bench/bench.py --issues 300          # quick smoke profile
    python3 scripts/bench/bench.py --json out.json       # machine-readable results

Exit code 0 on success; nonzero on any measurement failure (never fake a number).
"""

import argparse
import json
import os
import platform
import shutil
import signal
import socket
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PB_BIN = os.path.join(REPO_ROOT, "pocketbase")
HOOKS_DIR = os.path.join(REPO_ROOT, "app", "pb_hooks")
MIGRATIONS_DIR = os.path.join(REPO_ROOT, "app", "pb_migrations")

SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")

STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]
PRIORITIES = ["urgent", "high", "medium", "low", "none"]
BATCH_SIZE = 100  # kept for reference; seeding uses concurrent REST creates


def log(msg: str) -> None:
    print(f"[bench] {msg}", flush=True)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def http(method: str, url: str, body=None, token: str = None, timeout: float = 30.0):
    """Return (status, parsed_body). Raises nothing for HTTP error statuses."""
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw, status = resp.read().decode(errors="replace"), resp.status
    except urllib.error.HTTPError as err:
        raw, status = err.read().decode(errors="replace"), err.code
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


def wait_healthy(port: int, timeout_s: float = 20.0) -> float:
    """Poll /api/health until 200; return elapsed seconds. Raise on timeout."""
    deadline = time.monotonic() + timeout_s
    url = f"http://127.0.0.1:{port}/api/health"
    while time.monotonic() < deadline:
        try:
            status, _ = http("GET", url, timeout=2.0)
            if status == 200:
                return time.monotonic() - (deadline - timeout_s)
        except (urllib.error.URLError, ConnectionError, OSError):
            pass
        time.sleep(0.01)
    raise TimeoutError(f"instance on :{port} never became healthy in {timeout_s}s")


def spawn_instance(port: int, data_dir: str) -> subprocess.Popen:
    return subprocess.Popen(
        [
            PB_BIN, "serve",
            "--dir", data_dir,
            "--hooksDir", HOOKS_DIR,
            "--migrationsDir", MIGRATIONS_DIR,
            "--http", f"127.0.0.1:{port}",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def stop_instance(proc: subprocess.Popen, timeout_s: float = 10.0) -> None:
    if proc.poll() is not None:
        return
    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    try:
        proc.wait(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        proc.wait(timeout=timeout_s)


def vm_rss_mb(pid: int) -> float:
    with open(f"/proc/{pid}/status") as fh:
        for line in fh:
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024.0
    raise RuntimeError(f"no VmRSS for pid {pid}")


def superuser_token(port: int) -> str:
    status, body = http(
        "POST",
        f"http://127.0.0.1:{port}/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200:
        raise RuntimeError(f"superuser auth failed: {status} {body}")
    return body["token"]


def seed_issues(port: int, token: str, count: int) -> str:
    """Create `count` issues through the public REST API (no superuser-only
    batch endpoint: /api/batch is disabled in this PocketBase build), using a
    small thread pool so 10k issues seed in seconds, not minutes.
    Returns the Bench project id."""
    base = f"http://127.0.0.1:{port}"
    status, body = http("POST", f"{base}/api/collections/projects/records",
                        {"name": "Bench", "identifier": "BENCH"}, token)
    if status not in (200, 400):  # 400 = already exists on a reused dir
        raise RuntimeError(f"project create failed: {status} {body}")
    if status == 400:
        status, body = http("GET", f"{base}/api/collections/projects/records?filter=identifier='BENCH'", token=token)
        project_id = body["items"][0]["id"]
    else:
        project_id = body["id"]

    def create_one(i: int) -> None:
        # Every 10th title carries the search token so title~ matches ~10%.
        title = (f"Fix login regression {i}" if i % 10 == 0
                 else f"Improve dashboard latency {i}")
        record = {
            "identifier": f"BENCH-{i}",
            "project": project_id,
            "title": title,
            "description": "Benchmark seeded issue. " * 20,
            "status": STATUSES[i % len(STATUSES)],
            "priority": PRIORITIES[i % len(PRIORITIES)],
        }
        for attempt in range(3):
            status, body = http("POST", f"{base}/api/collections/issues/records", record, token, timeout=60)
            if status == 200:
                return
            time.sleep(0.2 * (attempt + 1))
        raise RuntimeError(f"create BENCH-{i} failed: {status} {str(body)[:200]}")

    done = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for _ in pool.map(create_one, range(1, count + 1)):
            done += 1
            if done % 2000 == 0:
                log(f"seeded {done}/{count} issues")
    return project_id


def bench_queries(port: int, token: str, project_id: str, runs: int) -> dict:
    base = f"http://127.0.0.1:{port}/api/collections/issues/records"
    cases = {
        # The real board/list UI path: scoped to one project, ordered by
        # board order then created (uses idx_issues_project_order).
        "project_board_query": f"{base}?filter=(project%3D%27{project_id}%27)&sort=order%2C-created&page=1&perPage=50",
        # Cross-project global sort with no filter: worst case, full scan+sort.
        "global_sort_created_worst_case": f"{base}?page=1&perPage=50&sort=-created",
        "filter_status_priority": f"{base}?filter=(status='todo'%20%26%26%20priority='high')&page=1&perPage=50",
        "search_title": f"{base}?filter=(title~'regression')&page=1&perPage=50",
        "count_project": f"{base}?filter=(project='{project_id}')&page=1&perPage=1",
    }
    results = {}
    for name, url in cases.items():
        samples = []
        for r in range(runs + 1):  # +1: first run warms, excluded
            t0 = time.perf_counter()
            status, body = http("GET", url, token=token, timeout=60.0)
            dt = (time.perf_counter() - t0) * 1000.0
            if status != 200:
                raise RuntimeError(f"{name} run {r}: {status} {str(body)[:200]}")
            if r > 0:
                samples.append(dt)
        results[name] = {
            "p50_ms": round(statistics.median(samples), 2),
            "p95_ms": round(statistics.quantiles(samples, n=20)[18], 2) if len(samples) >= 20 else round(max(samples), 2),
            "min_ms": round(min(samples), 2),
            "max_ms": round(max(samples), 2),
            "runs": len(samples),
        }
        log(f"{name}: p50={results[name]['p50_ms']}ms p95={results[name]['p95_ms']}ms")
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--issues", type=int, default=10000)
    ap.add_argument("--cold-starts", type=int, default=3, dest="cold_starts")
    ap.add_argument("--query-runs", type=int, default=30, dest="query_runs")
    ap.add_argument("--port", type=int, default=None)
    ap.add_argument("--json", default=None, help="write results JSON here")
    ap.add_argument("--keep", action="store_true", help="keep scratch dir")
    args = ap.parse_args()

    if not os.path.isfile(PB_BIN):
        log(f"ERROR: pocketbase binary not found at {PB_BIN}")
        return 2

    scratch = tempfile.mkdtemp(prefix="projectbase-bench-")
    data_dir = os.path.join(scratch, "pb_data")
    port = args.port or free_port()
    log(f"scratch dir: {scratch}  port: {port}")

    # Ensure protocol superuser exists on the scratch dir before first boot.
    up = subprocess.run(
        [PB_BIN, "superuser", "upsert", SUPERUSER_EMAIL, SUPERUSER_PASSWORD, "--dir", data_dir],
        capture_output=True, text=True,
    )
    if up.returncode != 0:
        log(f"ERROR: superuser upsert failed: {up.stderr.strip()[:200]}")
        shutil.rmtree(scratch, ignore_errors=True)
        return 2

    cold_fresh_s = None
    cold_warm_samples = []
    proc = None
    try:
        # Boot 1 on fresh dir: includes JS migration application.
        t0 = time.perf_counter()
        proc = spawn_instance(port, data_dir)
        cold_fresh_s = wait_healthy(port)
        log(f"cold start (fresh dir, incl. migrations): {cold_fresh_s * 1000:.1f} ms")
        idle_rss = vm_rss_mb(proc.pid)
        log(f"RAM idle after boot: {idle_rss:.1f} MB")
        stop_instance(proc)
        proc = None

        # Boots 2..N on the already-migrated dir: pure cold start.
        for i in range(args.cold_starts - 1):
            proc = spawn_instance(port, data_dir)
            dt = wait_healthy(port)
            cold_warm_samples.append(dt)
            log(f"cold start (warm dir) #{i + 1}: {dt * 1000:.1f} ms")
            if i < args.cold_starts - 2:
                stop_instance(proc)
                proc = None

        # Keep last instance for seeding + queries.
        token = superuser_token(port)
        log(f"seeding {args.issues} issues via REST (8 workers)...")
        t0 = time.perf_counter()
        project_id = seed_issues(port, token, args.issues)
        seed_s = time.perf_counter() - t0
        log(f"seeded in {seed_s:.1f}s ({args.issues / seed_s:.0f} writes/s)")

        # Verify count so numbers are never reported against wrong data.
        status, body = http("GET", f"http://127.0.0.1:{port}/api/collections/issues/records?filter=(project='{project_id}')&page=1&perPage=1", token=token)
        total = body.get("totalItems")
        if total != args.issues:
            raise RuntimeError(f"expected {args.issues} bench issues, found {total}")

        loaded_rss = vm_rss_mb(proc.pid)
        log(f"RAM after {args.issues} issues + workload: {loaded_rss:.1f} MB")

        queries = bench_queries(port, token, project_id, args.query_runs)

        results = {
            "schema": "projectbase-bench-v1",
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "host": {
                "cpu": _cpu_model(),
                "ram_gb": _ram_gb(),
                "kernel": platform.release(),
            },
            "versions": {"pocketbase": _pb_version()},
            "params": {"issues": args.issues, "cold_starts": args.cold_starts, "query_runs": args.query_runs},
            "cold_start": {
                "fresh_dir_with_migrations_ms": round(cold_fresh_s * 1000, 0),
                "warm_dir_median_ms": round(statistics.median(cold_warm_samples) * 1000, 0) if cold_warm_samples else None,
                "warm_dir_samples_ms": [round(s * 1000, 0) for s in cold_warm_samples],
            },
            "ram_mb": {"idle_after_boot": round(idle_rss, 1), "after_seed_and_queries": round(loaded_rss, 1)},
            "seed_writes_per_s": round(args.issues / seed_s, 0),
            "queries": queries,
        }

        out = json.dumps(results, indent=2)
        print(out)
        if args.json:
            with open(args.json, "w") as fh:
                fh.write(out + "\n")
            log(f"results written to {args.json}")
        return 0
    finally:
        if proc and proc.poll() is None:
            stop_instance(proc)
        if not args.keep:
            shutil.rmtree(scratch, ignore_errors=True)


def _cpu_model() -> str:
    try:
        with open("/proc/cpuinfo") as fh:
            for line in fh:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or "unknown"


def _ram_gb() -> float:
    try:
        with open("/proc/meminfo") as fh:
            for line in fh:
                if line.startswith("MemTotal:"):
                    return round(int(line.split()[1]) / 1024 / 1024, 1)
    except OSError:
        pass
    return 0.0


def _pb_version() -> str:
    try:
        out = subprocess.run([PB_BIN, "--version"], capture_output=True, text=True).stdout
        return out.strip().split()[-1]
    except Exception:
        return "unknown"


if __name__ == "__main__":
    sys.exit(main())
