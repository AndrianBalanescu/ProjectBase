"""tests/test_fixture_hygiene.py — guard against live-DB test-fixture pollution.

The dogfooded ProjectBase instance doubles as the pytest target, so a test
that creates a fixture issue and forgets to delete it leaks junk into the
real backlog. `test_export_json_round_trips_custom_fields` did exactly that
and left 147 "Export CustomFields <uid>" records behind (cycle 50).

This guard snapshots the fixture-pollution baseline at collection time
(pytest imports every test module before it runs any test, so the snapshot is
the pre-session state) and asserts it is zero. A regression that leaked a
fixture in a PREVIOUS run is caught here on the next run, before the junk
accumulates. In-session fixtures created by other tests are excluded on
purpose: the session cleanup in `tests/test_api.py` removes them after the
run, so the baseline is the only state this guard must enforce.

Mirrors the drift-guard style of `tests/test_agents_drift_guard.py` (pure
checks against the live instance, consistent with the rest of the suite).
"""

import json
import os
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWEEP_SCRIPT = os.path.join(ROOT, "scripts", "cleanup-test-fixtures.py")


def _sweep_report():
    """Run the canonical sweep in dry-run mode; never delete from a test."""
    try:
        proc = subprocess.run(
            [sys.executable, SWEEP_SCRIPT, "--json"],
            capture_output=True, text=True, timeout=120,
        )
        if proc.returncode != 0:
            return {"matches": -1, "dry_run": True,
                    "error": f"exit {proc.returncode}: {proc.stdout} {proc.stderr}"}
        return json.loads(proc.stdout)
    except Exception as exc:  # pragma: no cover - defensive, see _BASELINE
        return {"matches": -1, "dry_run": True, "error": str(exc)}


# Captured at import time, i.e. during pytest collection, before any test in
# this session has executed. That makes it the pre-session baseline: pollution
# left behind by a previous run (a cleanup regression) is what we assert on.
_BASELINE = _sweep_report()


class TestFixtureHygiene(unittest.TestCase):
    """The live instance must start each session with zero test-fixture junk."""

    def test_no_test_fixture_pollution_at_session_start(self):
        """Baseline dry-run sweep finds zero fixture-pattern records."""
        self.assertNotEqual(
            _BASELINE.get("matches"), -1,
            "fixture-hygiene baseline could not be computed: "
            f"{_BASELINE.get('error')}",
        )
        self.assertEqual(
            _BASELINE["matches"], 0,
            "live instance starts the session with test-fixture pollution "
            f"({_BASELINE['matches']} records match "
            f"{_BASELINE['prefixes']}); run "
            "`python3 scripts/cleanup-test-fixtures.py --apply` to remove them",
        )
        self.assertTrue(
            _BASELINE["dry_run"],
            "guard must run the sweep in dry-run mode (never delete)",
        )


if __name__ == "__main__":
    unittest.main()
