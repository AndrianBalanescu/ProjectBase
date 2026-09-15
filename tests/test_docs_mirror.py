"""Docs view integrity: the synced mirror must exist and stay in sync.

The Docs view (app/pb_public/js/components/DocsView.js) reads a build-time
copy of curated repository markdown, produced by scripts/sync_docs.sh. This
guard pins three things:

  1. Every file in the sync allowlist exists (no silently-missing doc).
  2. Every allowlisted source has a copy in app/pb_public/docs-files.
  3. Every copy matches its source byte-for-byte (the mirror is not stale).

It deliberately does NOT run the script (tests never mutate tracked/untracked
build output); it verifies the committed mirror is current. Run
`bash scripts/sync_docs.sh` after editing any allowlisted file.
"""

import hashlib
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "scripts", "sync_docs.sh")
OUT_DIR = os.path.join(ROOT, "app", "pb_public", "docs-files")
MANIFEST = os.path.join(OUT_DIR, "manifest.json")


def _allowlist():
    """Parse the SOURCES=( ... ) array out of the shell script."""
    with open(SCRIPT, encoding="utf-8") as f:
        text = f.read()
    m = re.search(r"SOURCES=\((.*?)\)", text, re.S)
    assert m, "SOURCES array not found in sync_docs.sh"
    return re.findall(r'"([^"]+)"', m.group(1))


def _sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


class TestDocsMirror(unittest.TestCase):
    def test_allowlisted_sources_exist(self):
        """Every allowlisted path must exist in the repo (no phantom entries)."""
        missing = [r for r in _allowlist() if not os.path.isfile(os.path.join(ROOT, r))]
        self.assertEqual(missing, [], f"allowlist names missing files: {missing}")

    def test_manifest_present_and_consistent(self):
        """The manifest must exist, parse, and agree with its own file list."""
        self.assertTrue(os.path.isfile(MANIFEST), "run scripts/sync_docs.sh")
        with open(MANIFEST, encoding="utf-8") as f:
            man = json.load(f)
        self.assertEqual(man.get("count"), len(man.get("files", [])),
                         "manifest count does not match its files array")
        self.assertGreaterEqual(man["count"], 1, "manifest has no files")

    def test_every_copy_matches_its_source(self):
        """Each mirror file must be byte-identical to its repo source."""
        with open(MANIFEST, encoding="utf-8") as f:
            man = json.load(f)
        drifted = []
        for entry in man["files"]:
            src = os.path.join(ROOT, entry["source"])
            copy = os.path.join(OUT_DIR, entry["file"])
            self.assertTrue(os.path.isfile(copy), f"missing mirror for {entry['source']}")
            if _sha(src) != _sha(copy):
                drifted.append(entry["source"])
        self.assertEqual(drifted, [],
                         f"mirror is stale, run scripts/sync_docs.sh: {drifted}")

    def test_allowlist_fully_mirrored(self):
        """Every allowlisted source must appear in the manifest."""
        with open(MANIFEST, encoding="utf-8") as f:
            man = json.load(f)
        mirrored = {e["source"] for e in man["files"]}
        for rel in _allowlist():
            if os.path.isfile(os.path.join(ROOT, rel)):
                self.assertIn(rel, mirrored, f"{rel} is allowlisted but not mirrored")

    def test_no_runtime_file_read_in_docs_view(self):
        """The view must fetch static assets, never read server files.

        PocketBase's $os.readFile has no path-traversal guard (verified on
        0.39.11), so a runtime file-read route would let an authenticated user
        read arbitrary server files. The view must not rely on one.
        """
        view = open(os.path.join(ROOT, "app", "pb_public", "js", "components", "DocsView.js"),
                    encoding="utf-8").read()
        self.assertIn("/docs-files/manifest.json", view)
        # Strip comments first: the file *documents* the $os.readFile risk, and
        # mentioning it in prose is not the same as calling it.
        code = re.sub(r"//[^\n]*", "", view)
        self.assertNotIn("$os.readFile", code)
        self.assertNotIn("os.readFile", code)
        # It must fetch static assets instead.
        self.assertIn("fetch(", code)


if __name__ == "__main__":
    unittest.main()
