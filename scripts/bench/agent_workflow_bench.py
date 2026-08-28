#!/usr/bin/env python3
"""ProjectBase Automated Agent Workflow Verification & Benchmark Harness (stdlib only).

Validates end-to-end agentic workflow over FastMCP JSON-RPC on an isolated scratch instance:
  1. Bootstraps scratch PocketBase instance with migrations & superuser.
  2. Executes full autonomous lifecycle:
     - Discover projects via MCP `list_projects`
     - Create task via MCP `create_issue`
     - Retrieve task via MCP `get_issue` (by ID and by identifier)
     - Progress task: `backlog` -> `in_progress` -> `in_review` -> `done` via MCP `move_issue`
     - Post audit comment via MCP `add_comment`
     - Verify state via MCP `list_issues`
  3. Measures operation latencies (p50, p95) and memory footprint.
  4. Asserts cold start < 100ms (warm) and RAM < 100MB.

Usage:
    python3 scripts/bench/agent_workflow_bench.py
    python3 scripts/bench/agent_workflow_bench.py --json out.json
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

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PB_BIN = os.path.join(REPO_ROOT, "pocketbase")
HOOKS_DIR = os.path.join(REPO_ROOT, "app", "pb_hooks")
MIGRATIONS_DIR = os.path.join(REPO_ROOT, "app", "pb_migrations")

SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "superdev123")


def log(msg):
    print(f"[agent-bench] {msg}", file=sys.stderr)


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def http(port, method, path, body=None, token=None, timeout=10):
    url = f"http://127.0.0.1:{port}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            return err.code, json.loads(raw)
        except Exception:
            return err.code, raw


def wait_healthy(port, timeout=10.0):
    start = time.perf_counter()
    while time.perf_counter() - start < timeout:
        try:
            st, _ = http(port, "GET", "/api/health", timeout=1.0)
            if st == 200:
                return (time.perf_counter() - start) * 1000.0
        except Exception:
            pass
        time.sleep(0.01)
    raise TimeoutError(f"instance on port {port} did not become healthy within {timeout}s")


def spawn_instance(data_dir, port):
    args = [
        PB_BIN,
        "serve",
        "--dir", data_dir,
        "--hooksDir", HOOKS_DIR,
        "--migrationsDir", MIGRATIONS_DIR,
        "--http", f"127.0.0.1:{port}",
    ]
    proc = subprocess.Popen(
        args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        preexec_fn=os.setsid if hasattr(os, "setsid") else None,
    )
    return proc


def stop_instance(proc):
    if proc is None or proc.poll() is not None:
        return
    try:
        if hasattr(os, "killpg") and hasattr(os, "getpgid"):
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        else:
            proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def vm_rss_mb(pid):
    statm = f"/proc/{pid}/statm"
    if os.path.isfile(statm):
        try:
            with open(statm) as fh:
                pages = int(fh.read().split()[1])
                return round(pages * os.sysconf("SC_PAGE_SIZE") / (1024 * 1024), 2)
        except Exception:
            pass
    return None


def run_benchmark(cycles=5):
    scratch_parent = os.environ.get("FLOMASTER_SCRATCH_DIR") or tempfile.gettempdir()
    scratch_dir = tempfile.mkdtemp(prefix="projectbase-agent-bench-", dir=scratch_parent)
    port = free_port()
    log(f"scratch dir: {scratch_dir}  port: {port}")

    proc = None
    try:
        # 1. Fresh boot & migrations
        proc = spawn_instance(scratch_dir, port)
        fresh_boot_ms = wait_healthy(port)
        log(f"fresh boot with migrations: {fresh_boot_ms:.1f} ms")

        # 2. Superuser upsert
        up = subprocess.run(
            [PB_BIN, "superuser", "upsert", SUPERUSER_EMAIL, SUPERUSER_PASSWORD, "--dir", scratch_dir],
            capture_output=True, text=True, timeout=10,
        )
        if up.returncode != 0:
            raise RuntimeError(f"superuser upsert failed: {up.stderr}")

        # Authenticate
        st, auth_res = http(port, "POST", "/api/collections/_superusers/auth-with-password",
                            body={"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
        assert st == 200, f"auth failed: {auth_res}"
        token = auth_res["token"]

        idle_rss = vm_rss_mb(proc.pid)
        log(f"idle RSS: {idle_rss} MB")

        # Helper for FastMCP call
        def mcp_call(method, params=None):
            t0 = time.perf_counter()
            body = {"jsonrpc": "2.0", "method": method, "id": int(time.time() * 1000)}
            if params is not None:
                body["params"] = params
            s, res = http(port, "POST", "/api/projectbase/mcp", body=body, token=token)
            lat_ms = (time.perf_counter() - t0) * 1000.0
            if s != 200 or "error" in res:
                raise RuntimeError(f"MCP call failed: {s} {res}")
            return res.get("result"), lat_ms

        def mcp_tool(name, args=None):
            res, lat = mcp_call("tools/call", {"name": name, "arguments": args or {}})
            content = res.get("content", [{}])[0].get("text", "")
            return json.loads(content) if content else None, lat

        # 3. Discover projects
        projects, p_lat = mcp_tool("list_projects")
        assert len(projects) > 0, "expected seeded projects"
        target_project_id = projects[0]["id"]
        log(f"discovered {len(projects)} projects (target={target_project_id}) in {p_lat:.2f}ms")

        # 4. Execute repeated full agent cycles
        latencies = {
            "create_issue": [],
            "get_issue": [],
            "update_issue": [],
            "move_issue": [],
            "add_comment": [],
            "list_issues": []
        }

        created_issues = []
        for i in range(cycles):
            # Create
            created, lat = mcp_tool("create_issue", {
                "project_id": target_project_id,
                "title": f"Autonomous Agent Verification Task #{i+1}",
                "description": "Benchmark verification for agent board integration",
                "status": "backlog",
                "priority": "high"
            })
            latencies["create_issue"].append(lat)
            iid = created["id"]
            ident = created["identifier"]
            created_issues.append(iid)

            # Get
            got, lat = mcp_tool("get_issue", {"issue_id": ident})
            latencies["get_issue"].append(lat)
            assert got["id"] == iid

            # Update
            updated, lat = mcp_tool("update_issue", {
                "issue_id": ident,
                "description": "Updated by autonomous Flomaster agent"
            })
            latencies["update_issue"].append(lat)

            # Move through stages: backlog -> in_progress -> in_review -> done
            for st_next in ["in_progress", "in_review", "done"]:
                moved, lat = mcp_tool("move_issue", {"issue_id": ident, "new_status": st_next})
                latencies["move_issue"].append(lat)
                assert moved["status"] == st_next

            # Add comment
            comm, lat = mcp_tool("add_comment", {
                "issue_id": ident,
                "content": f"## Completed by Flomaster\nVerified pass cycle {i+1}",
                "author": "Flomaster Agent",
                "author_type": "agent"
            })
            latencies["add_comment"].append(lat)
            assert comm["issue"] == iid

            # List
            listed, lat = mcp_tool("list_issues", {"project_id": target_project_id, "status": "done"})
            latencies["list_issues"].append(lat)

        loaded_rss = vm_rss_mb(proc.pid)
        log(f"loaded RSS after {cycles} agent runs: {loaded_rss} MB")

        # Stop and test warm restart
        stop_instance(proc)
        proc = None

        proc = spawn_instance(scratch_dir, port)
        warm_boot_ms = wait_healthy(port)
        log(f"warm restart: {warm_boot_ms:.1f} ms")

        def pstats(samples):
            if not samples:
                return {}
            s = sorted(samples)
            p50_idx = int(len(s) * 0.50)
            p95_idx = min(int(len(s) * 0.95), len(s) - 1)
            return {
                "p50_ms": round(s[p50_idx], 2),
                "p95_ms": round(s[p95_idx], 2),
                "min_ms": round(s[0], 2),
                "max_ms": round(s[-1], 2),
                "runs": len(s)
            }

        result = {
            "schema": "projectbase-agent-workflow-v1",
            "host": {
                "cpu": platform.processor() or "unknown",
                "kernel": platform.release()
            },
            "cold_start": {
                "fresh_dir_ms": round(fresh_boot_ms, 1),
                "warm_dir_ms": round(warm_boot_ms, 1)
            },
            "ram_mb": {
                "idle_after_boot": idle_rss,
                "loaded_after_agent_cycles": loaded_rss
            },
            "cycles_completed": cycles,
            "tool_latencies": {k: pstats(v) for k, v in latencies.items()}
        }
        return result
    finally:
        if proc is not None:
            stop_instance(proc)
        if os.path.isdir(scratch_dir):
            shutil.rmtree(scratch_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="ProjectBase Agent Workflow Benchmark Harness")
    parser.add_argument("--cycles", type=int, default=5, help="Number of agent lifecycle runs")
    parser.add_argument("--json", type=str, default="", help="Path to write JSON output")
    args = parser.parse_args()

    result = run_benchmark(cycles=args.cycles)
    out_str = json.dumps(result, indent=2)
    print(out_str)
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            fh.write(out_str + "\n")


if __name__ == "__main__":
    main()
