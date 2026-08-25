"""tests/test_openapi_drift.py — OpenAPI spec stays the source of truth.

The OpenAPI document (app/pb_public/openapi.json) is written by hand today
(1933 lines, 25 projectbase paths). The moment a developer adds a custom
route in app/pb_hooks/*.pb.js via routerAdd(...) and forgets to document it,
agents stop discovering it and the spec silently rots.

Instead of maintaining a second hand-written list of "documented" routes
(test_api.py's DOCUMENTED_CUSTOM_ROUTES), these tests *derive* the expected
surface straight from the hooks source. That way:
  - every /api/projectbase/* routerAdd() is required to appear in openapi.json
  - the only place you edit is the hook + the spec, and the test reads both
This is a pure static check (no server needed), mirroring test_css_sync.py.
"""

import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOOKS_DIR = os.path.join(ROOT, "app", "pb_hooks")
OPENAPI = os.path.join(ROOT, "app", "pb_public", "openapi.json")

_ROUTER_ADD = re.compile(
    r'routerAdd\(\s*"([A-Z]+)"\s*,\s*"([^"]+)"', re.MULTILINE
)


def _hook_files():
    return sorted(
        f for f in os.listdir(HOOKS_DIR) if f.endswith(".pb.js")
    )


def _extract_routes():
    """Return {(openapi_path, method)} for every /api/projectbase/* route.

    routerAdd("GET", "/api/projectbase/stats", ...) -> ("/projectbase/stats", "GET")
    """
    routes = set()
    for fname in _hook_files():
        src = open(os.path.join(HOOKS_DIR, fname), "r", encoding="utf-8").read()
        for method, path in _ROUTER_ADD.findall(src):
            if path.startswith("/api/projectbase/"):
                openapi_path = path[len("/api"):]
                routes.add((openapi_path, method))
    return routes


class TestOpenApiDrift(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.routes = _extract_routes()
        with open(OPENAPI, "r", encoding="utf-8") as fh:
            cls.spec = json.load(fh)
        cls.paths = cls.spec.get("paths", {})

    def test_hooks_found(self):
        """Sanity: the parser actually sees routes, so a silent miss fails loudly."""
        self.assertGreaterEqual(len(self.routes), 20,
                                "expected to find 20+ /api/projectbase/* routes")

    def test_every_custom_route_is_documented(self):
        missing = []
        for openapi_path, method in sorted(self.routes):
            methods = self.paths.get(openapi_path, {})
            if method.lower() not in methods:
                missing.append(f"{method} {openapi_path}")
        self.assertEqual(
            missing, [],
            "custom routes missing from openapi.json:\n  " + "\n  ".join(missing)
        )

    def test_openapi_spec_is_valid_openapi3(self):
        self.assertTrue(str(self.spec.get("openapi", "")).startswith("3."),
                        "openapi.json must be an OpenAPI 3.x document")
        self.assertIn("paths", self.spec)
        self.assertIn("info", self.spec)


if __name__ == "__main__":
    unittest.main()
