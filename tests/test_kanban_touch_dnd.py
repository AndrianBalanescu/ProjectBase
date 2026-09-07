# @file test_kanban_touch_dnd.py
# @description Mechanical guard: Kanban mobile touch drag-and-drop (node QA runner).
#
# Runs scripts/qa/verify_kanban_touch_dnd.js against the live app. The script
# proves, in a real browser: desktop mouse drag still moves cards between
# columns, touch long-press drag (delayOnTouchOnly) moves cards on a mobile
# viewport, a quick touch tap still opens the issue drawer, the touch-grip
# affordance renders on touch devices and stays hidden on desktop, and the
# whole flow is free of console/page errors and failed requests.
#
# @changes
# - [2026-09-07] [Flomaster] - Cycle 79: Kanban touch drag-and-drop + destroyed-instance dragover guard

import os
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "scripts", "qa", "verify_kanban_touch_dnd.js")


class KanbanTouchDndTest(unittest.TestCase):
    def test_touch_dnd_assertions_pass(self):
        node = "node"
        env = dict(os.environ)
        # playwright lives in a sibling project's node_modules on this host;
        # NODE_PATH lets the QA script resolve it without a local install.
        if "NODE_PATH" not in env:
            for cand in ("/data/projects/dev/iBrowse/node_modules",):
                if os.path.isdir(cand):
                    env["NODE_PATH"] = cand
                    break
        r = subprocess.run(
            [node, SCRIPT],
            capture_output=True,
            text=True,
            env=env,
            timeout=300,
        )
        self.assertEqual(
            r.returncode,
            0,
            f"verify_kanban_touch_dnd.js failed:\nstdout: {r.stdout[-2000:]}\nstderr: {r.stderr[-1000:]}",
        )
        self.assertIn('"pass": true', r.stdout)


if __name__ == "__main__":
    unittest.main()