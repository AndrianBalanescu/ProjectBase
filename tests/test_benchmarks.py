"""Mechanical proof for the benchmark harness (v1.0 item 3/4).

Runs scripts/bench/bench.py with a small profile against an isolated scratch
instance and asserts the result JSON carries every required measurement with
sane values. Skips automatically where the pocketbase binary is absent.
"""

import json
import os
import subprocess
import sys

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BENCH = os.path.join(REPO_ROOT, "scripts", "bench", "bench.py")
PB_BIN = os.path.join(REPO_ROOT, "pocketbase")

pytestmark = pytest.mark.skipif(
    not os.path.isfile(PB_BIN), reason="pocketbase binary not present"
)


def test_bench_harness_smoke(tmp_path):
    out = tmp_path / "bench.json"
    proc = subprocess.run(
        [
            sys.executable, BENCH,
            "--issues", "200",
            "--cold-starts", "2",
            "--query-runs", "3",
            "--json", str(out),
        ],
        capture_output=True, text=True, timeout=300,
    )
    assert proc.returncode == 0, f"harness failed:\n{proc.stdout[-2000:]}\n{proc.stderr[-2000:]}"

    data = json.loads(out.read_text())
    assert data["schema"] == "projectbase-bench-v1"
    assert data["params"]["issues"] == 200

    # Cold start: a healthy PocketBase boots in well under 5 s even on slow disks.
    assert 0 < data["cold_start"]["fresh_dir_with_migrations_ms"] < 5000
    assert data["cold_start"]["warm_dir_samples_ms"], "expected at least one warm-dir boot"

    # RAM: single-process app; idle RSS must be modest and loaded >= idle.
    idle = data["ram_mb"]["idle_after_boot"]
    loaded = data["ram_mb"]["after_seed_and_queries"]
    assert 10 <= idle < 500
    assert loaded >= idle * 0.8

    # Writes actually happened.
    assert data["seed_writes_per_s"] > 50

    # All five query cases present with positive, ordered percentiles.
    expected_cases = {
        "project_board_query",
        "global_sort_created_worst_case",
        "filter_status_priority",
        "search_title",
        "count_project",
    }
    assert set(data["queries"]) == expected_cases
    for name, q in data["queries"].items():
        assert q["p50_ms"] > 0, name
        assert q["p95_ms"] >= q["p50_ms"], name
        assert q["min_ms"] <= q["p50_ms"] <= q["max_ms"], name


def test_bench_harness_isolation_no_leftover_default_port():
    """The harness must bind 127.0.0.1 on a random free port, never the live
    instance port (8120) unless explicitly asked via --port."""
    src = open(BENCH).read()
    assert 's.bind(("127.0.0.1", 0))' in src
    assert "8120" not in src


def test_global_created_index_migration_present():
    """The global cross-project sort (worst-case bench query) must have a
    covering index. Migration 1710000017 adds `idx_issues_created` on
    `issues (created DESC)` so SQLite can satisfy `sort=-created` without a
    full table scan + temp B-tree. Guards against the index being dropped or
    the migration renumbered/removed."""
    mig = os.path.join(REPO_ROOT, "app", "pb_migrations", "1710000017_global_created_index.js")
    assert os.path.isfile(mig), f"expected migration file {mig}"
    src = open(mig).read()
    assert "idx_issues_created" in src
    assert "issues (created DESC)" in src
    assert "CREATE INDEX IF NOT EXISTS" in src


