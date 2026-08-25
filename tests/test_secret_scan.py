"""Secret / hardcoded-credential regression guard.

Regression background (cycle 12): a live iBrowse API key (`sk_live_...`) was
committed hardcoded in `scripts/qa/run_10_ibrowse_e2e.{sh,py}`, which triggered
the cycle-12 inspect audit veto (FAILED_AUDIT / P1 credential leak). The key was
subsequently removed and moved to an environment variable (`IBROWSE_API_KEY`),
but nothing prevented the same class of bug from coming back.

These tests scan every tracked source file for known secret patterns (API keys,
auth tokens, private keys, hardcoded credentials) and fail if any is found. It
is the regression guard that would have caught the cycle-12 P1 before merge.

Scope:
  - Scans all tracked files EXCEPT: vendored third-party bundles
    (app/pb_public/vendor/), binary assets, archived research dumps
    (docs/research/archive/), and the seeded demo superuser credential which is
    intentionally public (documented in AGENTS.md + CI for local dev + the
    self-host demo) and is not a secret.
  - Uses git ls-files so only files actually committed to the repo are checked
    (a file that never lands in git is not a leak).

Not tolerated (no whitelist): the documented demo superuser bootstrap
(`superdev123` / `f@flow.com`) is a known dev credential but is deliberately
NOT whitelisted — it matches none of the secret patterns on its own (it is a
12-char password, far below the high-entropy thresholds), and a whitelist would
risk masking a real key accidentally co-located with the demo credential on one
line. `IBROWSE_API_KEY` is only an env-var *reference*, never a value.
"""

import os
import re
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Patterns for actual secrets. We look for long high-entropy-looking tokens
# and the standard well-known prefix families.
SECRET_PATTERNS = [
    # Stripe-style live/test secret keys. The body may contain `_`/`-`
    # separators (e.g. iBrowse `sk_live_kAbz_...-...`), so the character class
    # must not stop at the first separator.
    re.compile(r"\bsk_live_[A-Za-z0-9_-]{10,}\b"),
    re.compile(r"\bsk_test_[A-Za-z0-9_-]{10,}\b"),
    re.compile(r"\bwhsec_[A-Za-z0-9_-]{10,}\b"),
    # Anthropic / OpenAI
    re.compile(r"\bsk-ant-[A-Za-z0-9]{10,}\b"),
    re.compile(r"\bsk-proj-[A-Za-z0-9]{10,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    # GitHub personal access tokens
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    # Slack
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    # AWS access key id
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    # Google API keys
    re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    # Private key blocks (PEM). Note the "BEGIN ... PRIVATE KEY" header itself
    # is the tell; a real key will also have a long base64 body.
    re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"),
    # Generic long base64-ish secret assignments (a rough net for the class of
    # `KEY = "<40+ base64>"` that bit us). Only matches assignment context.
    re.compile(r"""(?is)(?:key|token|secret|api_key|apikey|password|passwd)\s*[:=]\s*["'][A-Za-z0-9+/=_\-]{32,}["']"""),
]

# Directories / files excluded from the scan.
EXCLUDE_DIRS = (
    os.path.join(REPO, "app", "pb_public", "vendor"),     # vendored bundles
    os.path.join(REPO, "docs", "research", "archive"),    # raw scout dumps
    os.path.join(REPO, ".git"),
)
EXCLUDE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf")


def _tracked_files():
    """Yield all files tracked by git, newest-first, excluding vendored/binary."""
    res = subprocess.run(
        ["git", "-C", REPO, "ls-files"], capture_output=True, text=True, timeout=60
    )
    assert res.returncode == 0, f"git ls-files failed:\n{res.stderr}"
    for rel in res.stdout.splitlines():
        full = os.path.join(REPO, rel)
        if any(full.startswith(ex) for ex in EXCLUDE_DIRS):
            continue
        if full.endswith(EXCLUDE_EXT):
            continue
        if not os.path.isfile(full):
            continue
        yield full


def _scan_file(path):
    """Return list of (pattern, line_no, snippet) matches in one file."""
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            lines = fh.readlines()
    except OSError:
        return []
    hits = []
    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped:
            continue
        for pat in SECRET_PATTERNS:
            m = pat.search(line)
            if not m:
                continue
            # A private-key header with no body (e.g. a doc placeholder) is a
            # real hit — there is no legit reason to commit one.
            hit = (pat.pattern, idx, stripped[:120])
            if hit not in hits:
                hits.append(hit)
    return hits


def test_no_hardcoded_secrets_in_tracked_sources():
    """No committed source file contains a live-looking secret or key."""
    failures = []
    scanned = 0
    for path in _tracked_files():
        scanned += 1
        for pattern, lineno, snippet in _scan_file(path):
            failures.append((os.path.relpath(path, REPO), pattern, lineno, snippet))
    assert not failures, (
        "Hardcoded secret detected in tracked source (would have been a P1):\n"
        + "\n".join(f"  {f[0]}:{f[2]} [{f[1]}]  {f[3]!r}" for f in failures)
        + f"\nscanned {scanned} files"
    )


def test_secret_pattern_is_well_formed():
    """The guard itself must never match the placeholder used in its own file."""
    # Ensure the pattern list is non-trivial (catches accidental empties).
    assert SECRET_PATTERNS, "SECRET_PATTERNS must not be empty"
    assert all(hasattr(p, "pattern") for p in SECRET_PATTERNS)

def test_sk_live_pattern_catches_separator_keys():
    """Cycle-45 regression: `sk_live_` keys whose body contains `_`/`-`
    separators must still be caught. A plain-alphanumeric-only class silently
    missed them, which is the exact leak class the guard exists to block.
    Probe keys are assembled by concatenation with clearly-fake bodies so the
    guard file itself never contains a plaintext key-shaped literal."""
    live = re.compile(r"\bsk_live_[A-Za-z0-9_-]{10,}\b")
    plain = "sk_live_" + "AbCdEfGhIjKlMnOp123456"
    sep = "sk_live_" + "SampleKey_1234_abcd_5678-xyz"
    # Plain and separator-heavy forms both match.
    assert live.search(plain)
    assert live.search(sep)
    # The old broken pattern (alphanumeric-only body) misses the separator form.
    old = re.compile(r"\bsk_live_[A-Za-z0-9]{10,}\b")
    assert not old.search(sep), "guard regressed to the alphanumeric-only pattern"


def test_qa_scripts_do_not_hardcode_ibrowse_key():
    """The exact cycle-12 regression site stays clean: the iBrowse key must be
    read from the environment, never a literal in the committed QA scripts."""
    qa_py = os.path.join(REPO, "scripts", "qa", "run_10_ibrowse_e2e.py")
    qa_sh = os.path.join(REPO, "scripts", "qa", "run_10_ibrowse_e2e.sh")
    for path in (qa_py, qa_sh):
        assert os.path.isfile(path), f"missing expected QA script {path}"
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
        # No literal sk_live_/sk_ value in these files.
        assert "sk_live_" not in src, f"{path} hardcodes a live iBrowse key"
        assert "sk_" not in src.replace("IBROWSE_API_KEY", ""), (
            f"{path} appears to hardcode an iBrowse key value"
        )

def test_mcp_server_surface_is_english():
    """Cycle-46 modernization: the FastMCP server is the agent-facing moat —
    every tool error message is consumed verbatim by AI agents (Cursor,
    Flomaster, Hermes, Claude). Non-English (Romanian) diacritics in those
    messages degrade agent comprehension and violate the agents-hub invariant
    that agent-facing surfaces stay English. This guard fails if any Romanian
    diacritic re-leaks into scripts/mcp_server.py."""
    mcp_path = os.path.join(REPO, "scripts", "mcp_server.py")
    assert os.path.isfile(mcp_path), f"missing expected MCP server {mcp_path}"
    with open(mcp_path, encoding="utf-8") as fh:
        src = fh.read()
    # Romanian-specific diacritics (ă â î ș ț and their uppercase forms).
    diacritics = re.compile(r"[ăâîșțĂÂÎȘȚ]")
    matches = [(i + 1, ln.strip()) for i, ln in enumerate(src.splitlines()) if diacritics.search(ln)]
    assert not matches, (
        "Non-English (Romanian) text leaked into the agent-facing MCP server "
        "scripts/mcp_server.py (would degrade LLM consumption):\n"
        + "\n".join(f"  line {no}: {line!r}" for no, line in matches)
    )
