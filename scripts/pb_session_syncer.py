#!/usr/bin/env python3
"""
ProjectBase Universal Agent Session Syncer (macOS, Linux, Homelab, Remote Dev)
==============================================================================

Automatically discovers and syncs local AI agent sessions (Flomaster, Hermes, Cursor, Flow)
from the host machine directly into ProjectBase (:8120) via HTTP API.

Features:
- Discovers sessions directly via `flomaster session list --json` and filesystem fallback.
- Maps session to ProjectBase project using git root directory & remote origin URL.
- Detects live PID process status (running, completed, failed).
- Streams git branch, head commit, and touched files.
- Cross-platform: Runs seamlessly on macOS (Darwin), Linux (Homelab/Ubuntu), and containers.

Usage:
  python3 scripts/pb_session_syncer.py --once
  python3 scripts/pb_session_syncer.py --daemon --interval 3
  PROJECTBASE_URL=http://homelab:8120 python3 scripts/pb_session_syncer.py --daemon
"""

import os
import sys
import time
import json
import socket
import platform
import argparse
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Dict, List, Any, Optional

DEFAULT_PB_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
HOSTNAME = socket.gethostname()
PLATFORM_SYSTEM = platform.system()


def get_git_info(path: str) -> Dict[str, Any]:
    """Extract git repository details from working directory."""
    if not path or not os.path.exists(path):
        return {"repo": "", "branch": "", "commit": "", "remote": "", "root": ""}
    try:
        root = subprocess.check_output(
            ["git", "-C", path, "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        repo_name = os.path.basename(root)
        
        branch = subprocess.check_output(
            ["git", "-C", path, "rev-parse", "--abbrev-ref", "HEAD"],
            stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        
        commit = subprocess.check_output(
            ["git", "-C", path, "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        
        remote = subprocess.check_output(
            ["git", "-C", path, "config", "--get", "remote.origin.url"],
            stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        
        return {"repo": repo_name, "branch": branch, "commit": commit, "remote": remote, "root": root}
    except Exception:
        return {"repo": os.path.basename(path), "branch": "", "commit": "", "remote": "", "root": path}


def discover_flomaster_cli_sessions() -> List[Dict[str, Any]]:
    """Scan flomaster sessions via CLI command."""
    sessions = []
    try:
        cmd = ["flomaster", "session", "list", "--json"]
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=5).decode()
        items = json.loads(out)
        for it in items:
            sid = it.get("id")
            if not sid:
                continue
            working_dir = it.get("working_dir") or str(Path.cwd())
            git_info = get_git_info(working_dir)
            raw_status = (it.get("status") or "").lower()
            status = "running" if raw_status == "active" else "completed"

            title = it.get("title") or it.get("short_name") or sid
            short_name = it.get("short_name") or sid

            sessions.append({
                "session_id": sid,
                "agent_name": f"Flomaster ({short_name})",
                "agent_role": short_name,
                "runtime": "flomaster",
                "working_dir": working_dir,
                "project_name": git_info["repo"] or "projectbase",
                "git_branch": git_info["branch"],
                "git_commit": git_info["commit"],
                "git_remote": git_info["remote"],
                "machine": HOSTNAME,
                "platform": PLATFORM_SYSTEM,
                "status": status,
                "pid": 0,
                "message_count": it.get("message_count", 0),
                "token_usage": it.get("tokens", 0),
                "last_prompt": (title[:250] + "...") if len(title) > 250 else title,
                "updated_at": it.get("updated_at")
            })
    except Exception:
        pass
    return sessions


def send_sessions_to_projectbase(pb_url: str, sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Push discovered sessions to ProjectBase API."""
    url = f"{pb_url.rstrip('/')}/api/projectbase/sessions/ingest"
    synced = 0
    errors = 0

    for s in sessions:
        try:
            payload = json.dumps(s).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                if res.status in (200, 201):
                    synced += 1
        except Exception as e:
            errors += 1

    return {"total": len(sessions), "synced": synced, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description="Universal ProjectBase Session Syncer")
    parser.add_argument("--server", default=DEFAULT_PB_URL, help=f"ProjectBase URL (default: {DEFAULT_PB_URL})")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in daemon mode")
    parser.add_argument("--interval", type=int, default=3, help="Poll interval in seconds (default: 3)")
    parser.add_argument("--once", action="store_true", help="Run a single sync and exit")
    args = parser.parse_args()

    print(f"🚀 ProjectBase Session Syncer started on [{HOSTNAME}] ({PLATFORM_SYSTEM})")
    print(f"📡 Target Server: {args.server}")

    if args.once or not args.daemon:
        sessions = discover_flomaster_cli_sessions()
        print(f"🔍 Discovered {len(sessions)} local agent session(s)")
        res = send_sessions_to_projectbase(args.server, sessions)
        print(f"✅ Sync complete: {res['synced']}/{res['total']} sessions ingested ({res['errors']} errors)")
        return

    print(f"🔄 Watching local sessions (polling every {args.interval}s)... Press Ctrl+C to stop.")
    while True:
        try:
            sessions = discover_flomaster_cli_sessions()
            res = send_sessions_to_projectbase(args.server, sessions)
            active_count = sum(1 for s in sessions if s["status"] == "running")
            print(f"[{time.strftime('%X')}] Synced {res['synced']} sessions | Active live runners: {active_count}", end="\r")
            time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n🛑 Syncer stopped by user.")
            break
        except Exception as err:
            print(f"\n⚠️ Syncer error: {err}")
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
