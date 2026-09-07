"""tests/test_agents_drift_guard.py — keep AGENTS.md's agent-facing map truthful.

AGENTS.md is the agent-facing technical map; every agent that works on this
repo (including ProjectBase's own dogfood) reads it to learn the test baseline
and directory layout. When it drifts from the actual tree — stale test count,
missing files — agents are misled (e.g. claiming "223 tests across 10 files"
when the real suite is 227 tests across 11 files).

These pure-static tests lock the two fragile facts in AGENTS.md to the repo:
  1. The `**Tests:**` bullet's "N tests across M files" claim equals the real
     collected pytest count and file count.
  2. The `tests/ <- ...` directory-map line lists exactly the `test_*.py`
     files that exist under `tests/`.

Mirrors the drift-guard style of `tests/test_css_sync.py` and
`tests/test_deploy_consistency.py` (pure static checks, no server spawn).
"""

import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(rel):
    with open(os.path.join(ROOT, rel), "r", encoding="utf-8") as fh:
        return fh.read()


def _test_filenames():
    tests_dir = os.path.join(ROOT, "tests")
    return sorted(f for f in os.listdir(tests_dir) if f.startswith("test_") and f.endswith(".py"))


AGENTS = _read("AGENTS.md")


def _count_test_functions():
    total = 0
    for f in _test_filenames():
        body = _read(os.path.join("tests", f))
        total += len(re.findall(r"^\s*def test_\w+\s*\(", body, re.M))
    return total


class TestAgentsMapMatchesTree(unittest.TestCase):
    """AGENTS.md's test baseline and file listing must match the real tree."""

    def test_agents_test_count_claim(self):
        """The 'N tests across M files' claim equals the actual pytest surface."""
        m = re.search(r"(\d+)\s+tests\s+across\s+(\d+)\s+files", AGENTS)
        self.assertIsNotNone(m, "AGENTS.md missing 'N tests across M files' claim")
        claimed_tests, claimed_files = int(m.group(1)), int(m.group(2))
        actual_tests = _count_test_functions()
        actual_files = len(_test_filenames())
        self.assertEqual(
            actual_tests,
            claimed_tests,
            f"AGENTS.md says {claimed_tests} tests but the tree has {actual_tests} "
            "(run `pytest tests/ -q` to confirm and update AGENTS.md)",
        )
        self.assertEqual(
            actual_files,
            claimed_files,
            f"AGENTS.md says {claimed_files} test files but the tree has {actual_files}",
        )

    def test_agents_no_conflicting_count_claims(self):
        """Every 'N tests across M files' claim in AGENTS.md must agree.

        AGENTS.md repeats the count in the **Tests:** bullet and the tests/
        directory-map line; a stale copy of either misleads agents (e.g. one
        line said 556 while another said 562). All occurrences must match
        the real collected surface.
        """
        claims = re.findall(r"(\d+)\s+tests\s+across\s+(\d+)\s+files", AGENTS)
        self.assertTrue(claims, "AGENTS.md missing 'N tests across M files' claim")
        actual_tests = _count_test_functions()
        actual_files = len(_test_filenames())
        for claimed_tests, claimed_files in claims:
            self.assertEqual(
                int(claimed_tests),
                actual_tests,
                f"AGENTS.md claims {claimed_tests} tests in one place but the tree "
                f"has {actual_tests}; every count claim must match "
                "(run `pytest tests/ -q` to confirm and update AGENTS.md)",
            )
            self.assertEqual(
                int(claimed_files),
                actual_files,
                f"AGENTS.md claims {claimed_files} test files in one place but the "
                f"tree has {actual_files}; every count claim must match",
            )

    def test_agents_lists_all_test_files(self):
        """Every test_*.py under tests/ appears in the AGENTS.md tests/ line."""
        # The directory-map tests/ line continues across subsequent lines.
        lines = AGENTS.splitlines()
        start = next(i for i, ln in enumerate(lines) if ln.strip().startswith("tests/"))
        block = "\n".join(lines[start:start + 6])
        for fname in _test_filenames():
            self.assertIn(
                fname,
                block,
                f"AGENTS.md tests/ map is missing {fname}; add it so agents see the suite",
            )

    def test_agents_version_matches_version_file(self):
        """The 'Live app ... (vX.Y.Z)' claim equals the VERSION file.

        Regression (cycle-81 inspect P2): AGENTS.md said v1.38.0 while VERSION
        was 1.39.0 and the live instance served 1.39.0 code — the version
        string had no guard, so it silently rotted while releases shipped.
        """
        with open(os.path.join(ROOT, "VERSION"), "r", encoding="utf-8") as fh:
            version = fh.read().strip()
        m = re.search(r"Live app: `http://[^`]+` \(v([^)]+)\)", AGENTS)
        self.assertIsNotNone(m, "AGENTS.md missing 'Live app: ... (vX.Y.Z)' claim")
        self.assertEqual(
            m.group(1),
            version,
            f"AGENTS.md says v{m.group(1)} but VERSION is {version}; "
            "update AGENTS.md's Live app line on release",
        )


if __name__ == "__main__":
    unittest.main()
