# @file test_listview_sort_logic.py
# @description Mechanical guard: ListView semantic sorting logic (node).
#
# Runs scripts/qa/verify_listview_sort_logic.js, which extracts the sort
# methods from the zero-build component and asserts numeric estimate order,
# chronological due dates (undated last both ways), workflow-order statuses,
# severity-order priorities, and subtask completion-ratio ordering.
#
# @changes
# - [2026-09-06] [Flomaster] - Cycle 78: ListView semantic sort + Subs progress column guard

import os
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "scripts", "qa", "verify_listview_sort_logic.js")


class ListViewSortLogicTest(unittest.TestCase):
    def test_sort_logic_assertions_pass(self):
        node = "node"
        env = dict(os.environ)
        # Prefer the hermes node_modules for playwright-style runs; logic script needs neither.
        r = subprocess.run(
            [node, SCRIPT],
            capture_output=True,
            text=True,
            env=env,
            timeout=60,
        )
        self.assertEqual(
            r.returncode,
            0,
            f"verify_listview_sort_logic.js failed:\nstdout: {r.stdout}\nstderr: {r.stderr}",
        )
        self.assertIn("ALL ASSERTIONS PASS", r.stdout)


if __name__ == "__main__":
    unittest.main()