"""Shell-consistency drift guard: every navigable view must exist everywhere.

The de-bloat pass removed the stats/docs/portfolio/timeline view components
but initially left keyboard shortcuts 4/6/7/8/9 setting currentView to views
with no render branch in index.html -> pressing them showed a blank main
area. URL routes were remapped (legacyViewMap in app.js) but the keyboard
handler was not. This file pins the invariant that ended the drift:

  VIEWS is the single source of truth. Every view id must be:
    - rendered by a v-if/v-else-if branch in index.html
    - present in app.js applyRoute() viewMap (deep-linkable)
    - navigable from the CommandPalette ("Switch to ..." action)
    - wired in the keyboard handler ONLY if listed in KEYBOARD_VIEWS
    - advertised in the ShortcutsModal "Switch Views" section ONLY if
      listed in KEYBOARD_VIEWS (same ids, same order)

If you re-add Timeline/Stats/Docs/Portfolio from the archive tags
(archive/feature-creep-full), add the id here and this test will tell you
every surface you still need to wire.
"""

import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "app", "pb_public")

# The single source of truth: live, rendered views in navigation order.
VIEWS = ["board", "list", "cycles", "milestones", "projects", "agents"]

# Views reachable via single-key shortcuts (1..6, in this order).
KEYBOARD_VIEWS = ["board", "list", "cycles", "milestones", "projects", "agents"]


def _read(*parts):
    with open(os.path.join(PUB, *parts), encoding="utf-8") as f:
        return f.read()


class TestShellConsistency(unittest.TestCase):
    def test_rendered_views_exist_in_index(self):
        """Every view in VIEWS must have a render branch in index.html."""
        index = _read("index.html")
        for view in VIEWS:
            self.assertRegex(
                index,
                rf"currentView === '{view}'",
                f"view '{view}' has no render branch in index.html",
            )

    def test_no_dead_view_branches(self):
        """index.html must not render views outside VIEWS (no blank mains)."""
        index = _read("index.html")
        rendered = set(re.findall(r"currentView === '(\w+)'", index))
        self.assertEqual(
            rendered - set(VIEWS), set(),
            f"index.html renders unknown views: {sorted(rendered - set(VIEWS))}",
        )

    def test_applyroute_viewmap_matches(self):
        """applyRoute() viewMap must map exactly the live views."""
        app = _read("js", "app.js")
        m = re.search(r"const viewMap = \{([^}]*)\}", app)
        self.assertIsNotNone(m, "applyRoute() viewMap not found in app.js")
        mapped = set(re.findall(r"(\w+):", m.group(1)))
        self.assertEqual(mapped, set(VIEWS),
                         f"viewMap {sorted(mapped)} != VIEWS {VIEWS}")

    def test_keyboard_handler_targets_live_views(self):
        """Every currentView set by a digit key must be a live view."""
        app = _read("js", "app.js")
        digit_block = re.search(
            r"e\.key === '1'.*?currentView = '(\w+)'.*?e\.key === '2'.*?"
            r"currentView = '(\w+)'.*?e\.key === '3'.*?currentView = '(\w+)'.*?"
            r"e\.key === '4'.*?currentView = '(\w+)'.*?e\.key === '5'.*?"
            r"currentView = '(\w+)'.*?e\.key === '6'.*?currentView = '(\w+)'",
            app, re.S,
        )
        self.assertIsNotNone(digit_block, "digit-key view chain not found")
        targets = list(digit_block.groups())
        self.assertEqual(targets, KEYBOARD_VIEWS,
                         f"keyboard targets {targets} != {KEYBOARD_VIEWS}")

    def test_no_dead_digit_shortcuts(self):
        """Digits beyond the live view count must not set currentView."""
        app = _read("js", "app.js")
        for key in "789":
            self.assertNotIn(
                f"e.key === '{key}'", app,
                f"key {key} is wired but views 7+ do not exist",
            )

    def test_shortcuts_modal_matches_keyboard_views(self):
        """ShortcutsModal 'Switch Views' must list KEYBOARD_VIEWS in order."""
        modal = _read("js", "components", "ShortcutsModal.js")
        self.assertIn("'Switch Views'", modal, "Switch Views section missing")
        # Digit-key shortcuts only appear in the Switch Views section.
        descs = re.findall(r"keys: \['(\d)'\], desc: '([^']+)'", modal)
        self.assertEqual(
            [k for k, _ in descs],
            [str(i + 1) for i in range(len(KEYBOARD_VIEWS))],
            f"modal key sequence {[k for k, _ in descs]} must be 1..{len(KEYBOARD_VIEWS)}",
        )
        expected = dict(zip(KEYBOARD_VIEWS, [
            "Board (Kanban)", "List", "Cycles (sprints)", "Roadmap",
            "Projects", "Sessions"]))
        got = dict(descs)
        for i, view in enumerate(KEYBOARD_VIEWS):
            key = str(i + 1)
            self.assertEqual(
                got.get(key), expected[view],
                f"modal key {key} says '{got.get(key)}' but is wired to "
                f"view '{view}' (expected '{expected[view]}')",
            )

    def test_command_palette_can_reach_every_view(self):
        """CommandPalette must emit change-view for every view in VIEWS."""
        palette = _read("js", "components", "CommandPalette.js")
        for view in VIEWS:
            self.assertIn(
                f"change-view', '{view}'", palette,
                f"CommandPalette cannot navigate to view '{view}'",
            )

    def test_header_nav_lists_live_views(self):
        """Header tab strip must cover VIEWS minus agents (standalone button)."""
        header = _read("js", "components", "Header.js")
        strip = re.findall(r"\{ id: '(\w+)', label:", header)
        expected_strip = [v for v in VIEWS if v != "agents"]
        self.assertEqual(strip, expected_strip,
                         f"header strip {strip} != {expected_strip}")
        self.assertIn("change-view', 'agents'", header,
                      "Header must keep the standalone Sessions button")

    def test_legacy_routes_remap(self):
        """Removed views must still deep-link somewhere sane, not blank."""
        app = _read("js", "app.js")
        m = re.search(r"const legacyViewMap = \{([^}]*)\}", app)
        self.assertIsNotNone(m, "legacyViewMap missing from app.js")
        remaps = dict(re.findall(r"(\w+): '(\w+)'", m.group(1)))
        for legacy in ("timeline", "portfolio", "stats"):
            self.assertIn(legacy, remaps, f"legacy route '{legacy}' unmapped")
            self.assertIn(remaps[legacy], VIEWS,
                          f"legacy '{legacy}' remaps to dead view '{remaps[legacy]}'")


if __name__ == "__main__":
    unittest.main()
