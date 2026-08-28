"""tests/conftest.py — Global test hooks for ProjectBase test suites.

Ensures deterministic test isolation:
- Sweeps any leftover test projects or fixture issues after the test session.
"""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWEEP_SCRIPT = os.path.join(ROOT, "scripts", "cleanup-test-fixtures.py")


def pytest_sessionfinish(session, exitstatus):
    """Clean up any ephemeral test projects and fixture issues created during testing."""
    if os.path.isfile(SWEEP_SCRIPT):
        try:
            subprocess.run(
                [sys.executable, SWEEP_SCRIPT, "--apply"],
                capture_output=True,
                text=True,
                timeout=30,
            )
        except Exception:
            pass
