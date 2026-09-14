"""tests/test_css_sync.py — guard against stale compiled Tailwind CSS.

Regression background (cycle 39): templates gained new Tailwind utilities
(pl-7, ml-1.5, text-sky-300, max-h-52, ...) but scripts/build_css.sh was not
re-run, so the served css/style.css tree-shook them away and the UI silently
rendered unstyled. Also py-0.2 was used in 8 components even though it is not
a valid default Tailwind spacing value.

These tests extract every static class token from the frontend sources and
assert each resolves to a rule in the compiled css/style.css or the
hand-written css/app.css. They fail whenever someone edits templates without
rebuilding the CSS, or uses a utility Tailwind cannot generate.
"""

import glob
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PB_PUBLIC = os.path.join(ROOT, "app", "pb_public")
STYLE_CSS = os.path.join(PB_PUBLIC, "css", "style.css")
APP_CSS = os.path.join(PB_PUBLIC, "css", "app.css")

# Files whose class attributes are checked. Vendor bundles are excluded.
SOURCE_GLOBS = [
    os.path.join(PB_PUBLIC, "*.html"),
    os.path.join(PB_PUBLIC, "js", "*.js"),
    os.path.join(PB_PUBLIC, "js", "components", "*.js"),
]

STATIC_CLASS_RE = re.compile(r"""(?<![:\w-])class=(["'])(.*?)\1""", re.S)
# :class bindings contain quoted string literals of static utilities
# (e.g. :class="isFullscreen ? 'a b' : 'c d'"). The attribute regex captures
# the whole binding; the literal regex then pulls EVERY quoted class list
# inside it (a ternary can have multiple branches — first-branch-only
# extraction was a cycle-39 gap). Single-word quoted values are enum/tab
# keys, not classes, and are skipped to avoid false positives.
BOUND_CLASS_ATTR_RE = re.compile(r""":class=(["'])(.*?)\1""", re.S)
BOUND_CLASS_LITERAL_RE = re.compile(r"""(["'])([a-z0-9\-\s]+)\1""")

# Classes that are pure JS hook selectors / layout markers and intentionally
# carry no styling of their own (styles come from co-applied utilities or are
# consumed by SortableJS). Keep this list short and documented.
MARKER_CLASSES = {
    # SortableJS drag handle selector (KanbanBoard.js), styled via utilities.
    "kanban-card-drag-handle",
    # Semantic root marker for the Portfolio view (PortfolioView.js), styled
    # via utilities; used as a stable QA/selector hook, not a styled utility.
    "pb-portfolio",
    # `<html class="dark ...">` ancestor hook for Tailwind dark-mode variant.
    # It is a state toggle on the root element, not a styled utility class.
    "dark",
    # Regex/template fragments in MilkdownEditor.js code-block enhancement:
    # `language-*` matches the class that marked.js emits on `<code>`; these
    # literals are JS patterns, not real template classes.
    "language-([^",
    "language-x",
}


def _css_escape(token: str) -> str:
    """Escape a class token the way Tailwind emits it in the stylesheet."""
    return "".join(
        ("\\" + ch) if not (ch.isalnum() or ch in "_-") else ch for ch in token
    )


def _source_files():
    files = []
    for pattern in SOURCE_GLOBS:
        files.extend(glob.glob(pattern))
    return sorted(files)


def _static_tokens():
    """All static class tokens across the frontend, including string literals
    inside :class bindings (e.g. the issue drawer's slide-in-from-right)."""
    tokens = set()
    for path in _source_files():
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
        for match in STATIC_CLASS_RE.finditer(src):
            for tok in match.group(2).split():
                # Skip Vue interpolation / obviously dynamic fragments.
                if "{" in tok or "}" in tok:
                    continue
                tokens.add(tok)
        for am in BOUND_CLASS_ATTR_RE.finditer(src):
            content = am.group(2)
            for lm in BOUND_CLASS_LITERAL_RE.finditer(content):
                literal = lm.group(2)
                # Only treat it as a class list if it contains whitespace. A
                # single-word quoted value is usually an enum/tab key (e.g.
                # activeTab === 'guide'), not a CSS class.
                if " " in literal:
                    for tok in literal.split():
                        tokens.add(tok)
    return tokens


class TestCompiledCssCoversTemplates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(STYLE_CSS, encoding="utf-8") as fh:
            cls.style_css = fh.read()
        with open(APP_CSS, encoding="utf-8") as fh:
            cls.app_css = fh.read()
        # Shipped vendor stylesheets (e.g. milkdown.css) are real style sources.
        cls.vendor_css = ""
        for vpath in sorted(glob.glob(os.path.join(PB_PUBLIC, "vendor", "*.css"))):
            with open(vpath, encoding="utf-8") as fh:
                cls.vendor_css += fh.read()
        cls.tokens = _static_tokens()
        # Sanity: extraction actually found a meaningful number of tokens.
        assert len(cls.tokens) > 200, "class extraction looks broken"

    def _resolve(self, token: str) -> bool:
        if token in MARKER_CLASSES:
            return True
        escaped = _css_escape(token)
        return (
            (escaped in self.style_css)
            or (escaped in self.app_css)
            or (escaped in self.vendor_css)
        )

    def test_every_static_class_resolves(self):
        missing = sorted(t for t in self.tokens if not self._resolve(t))
        self.assertEqual(
            missing,
            [],
            "Classes referenced by templates are missing from compiled CSS. "
            "Run scripts/build_css.sh (and extend app.css for custom utilities). "
            f"Missing: {missing}",
        )

    def test_no_invalid_default_spacing_utilities(self):
        # py-0.2 & friends are not part of Tailwind's default spacing scale;
        # Tailwind silently drops them (cycle-39 bug). px/pt/pb/py/mx/my variants.
        bad_re = re.compile(r"^[pm][trblxy]?-0\.[23468]$|^[pm][trblxy]?-0\.25$")
        bad = sorted(t for t in self.tokens if bad_re.match(t))
        self.assertEqual(
            bad,
            [],
            f"Invalid default Tailwind spacing utilities used (will never generate CSS): {bad}",
        )

    def test_compiled_css_is_nontrivial(self):
        self.assertGreater(len(self.style_css), 40000, "style.css looks truncated")


if __name__ == "__main__":
    unittest.main()


class TestSpaNavigationCleanup(unittest.TestCase):
    """Removed SPA views must stay absent and legacy hashes must redirect safely."""

    def test_primary_navigation_and_external_docs_are_strict(self):
        header = open(os.path.join(PB_PUBLIC, "js", "components", "Header.js"), encoding="utf-8").read()
        ordered = ["label: 'Board'", "label: 'List'", "label: 'Cycles'", "label: 'Roadmap'", "label: 'Projects'"]
        positions = [header.index(label) for label in ordered]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("<span>Sessions</span>", header)
        self.assertIn('href="/docs"', header)
        self.assertIn('target="_blank"', header)
        for removed in ("Timeline", "Portfolio", ">Stats<", "change-view', 'docs"):
            self.assertNotIn(removed, header)

    def test_removed_views_have_no_assets_or_mounts(self):
        index = open(os.path.join(PB_PUBLIC, "index.html"), encoding="utf-8").read()
        sw = open(os.path.join(PB_PUBLIC, "sw.js"), encoding="utf-8").read()
        app = open(os.path.join(PB_PUBLIC, "js", "app.js"), encoding="utf-8").read()
        for name in ("TimelineView", "PortfolioView", "StatsView", "DocsView"):
            self.assertFalse(os.path.exists(os.path.join(PB_PUBLIC, "js", "components", name + ".js")))
            self.assertNotIn(name, index + sw + app)
        for tag in ("timeline-view", "portfolio-view", "stats-view", "docs-view"):
            self.assertNotIn(tag, index + app)

    def test_legacy_routes_redirect_without_blank_views(self):
        app = open(os.path.join(PB_PUBLIC, "js", "app.js"), encoding="utf-8").read()
        self.assertIn("timeline: 'milestones'", app)
        self.assertIn("portfolio: 'projects'", app)
        self.assertIn("stats: 'board'", app)
        self.assertIn("new URL('docs', document.baseURI)", app)
