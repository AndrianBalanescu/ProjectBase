"""tests/test_session_observability.py — Comprehensive tests for Deep Observability & Ground Truth Verification Hub (Milestone 3).

Verifies:
  1. Unified Git Diff recording & parsing (file list, hunks, additions, deletions, net change).
  2. Test Verdict Ingestion (Pytest, Playwright) & Ground-Truth pass rate calculation.
  3. Failing test suite detection & badge state transition to 'failing_tests'.
  4. Sceptic Audit submission with cryptographic signature generation and audit history.
  5. Sceptic P0 Veto Enforcement: P0 findings immediately veto session, block auto-dock, and flag failure.
  6. Workspace-wide Ground-Truth Observability Summary (global pass rate, code volume delta, auditor health).
  7. Automated Fast Verification Suite runner (/api/projectbase/observability/verify-suite).
  8. FastMCP JSON-RPC 2.0 tools: record_session_diff, record_test_verdict, submit_sceptic_audit, get_session_observability, list_agent_sessions.
"""

import json
import os
import time
import urllib.error
import urllib.request
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


def _uid():
    return f"sess_obs_{int(time.time() * 1000) % 10000000}"


def _request(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"raw": err_body}
        return e.code, parsed
    except Exception as e:
        return 500, {"error": str(e)}


def _get_auth_token():
    status, body = _request("POST", "/api/collections/_superusers/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD
    })
    if status == 200 and "token" in body:
        return body["token"]
    status, body2 = _request("POST", "/api/collections/users/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD
    })
    if status == 200 and "token" in body2:
        return body2["token"]
    return ""


def _create_sample_session():
    sid = _uid()
    status, body = _request("POST", "/api/projectbase/sessions/ingest", {
        "session_id": sid,
        "agent_name": "flomaster-builder",
        "runtime": "flomaster",
        "model": "gpt-5.5",
        "status": "running",
        "pid": 58921,
        "git_branch": "feat/ground-truth-observability",
        "command": "Build visual git diff viewer and sceptic audit inspector"
    })
    assert status in (200, 201)
    return sid, body.get("id")


SAMPLE_DIFF = """diff --git a/app/pb_public/js/components/AgentsView.js b/app/pb_public/js/components/AgentsView.js
--- a/app/pb_public/js/components/AgentsView.js
+++ b/app/pb_public/js/components/AgentsView.js
@@ -10,6 +10,12 @@
+      // Deep Observability & Ground Truth Verification Hub
+      sessionObservabilityTab: 'diff',
+      sessionDiffData: null,
diff --git a/tests/test_session_observability.py b/tests/test_session_observability.py
--- a/tests/test_session_observability.py
+++ b/tests/test_session_observability.py
@@ -1,3 +1,15 @@
+import pytest
+def test_sample():
+    assert True
-old_broken_test()
"""


# 1. Test Unified Git Diff Ingestion & Retrieval
def test_record_and_get_unified_git_diff():
    sid, rec_id = _create_sample_session()

    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/diff", {
        "raw_diff": SAMPLE_DIFF,
        "git_commit_before": "c0ffee11",
        "git_commit_after": "deadbeef99",
        "git_branch": "feat/ground-truth-observability"
    })
    assert status == 200
    assert body["success"] is True
    assert body["files_count"] == 2
    assert body["summary"]["additions"] >= 5
    assert body["summary"]["deletions"] >= 1

    status, diff_data = _request("GET", f"/api/projectbase/sessions/{sid}/diff")
    assert status == 200
    assert diff_data["session_id"] == sid
    assert diff_data["git_commit_after"] == "deadbeef99"
    assert len(diff_data["files"]) == 2
    assert diff_data["files"][0]["file"] == "app/pb_public/js/components/AgentsView.js"
    assert diff_data["files"][1]["file"] == "tests/test_session_observability.py"
    assert diff_data["raw_diff"] == SAMPLE_DIFF


# 2. Test Test Verdict Ingestion (Passing Pytest Suite)
def test_record_and_get_passing_test_verdict():
    sid, rec_id = _create_sample_session()

    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/verdict", {
        "framework": "pytest",
        "passed": 401,
        "failed": 0,
        "skipped": 2,
        "duration_s": 1.25,
        "suite": "projectbase_e2e"
    })
    assert status == 200
    assert body["success"] is True
    assert body["verification_badge"] == "verified"
    assert body["verification_score"] >= 95
    assert body["test_verdict"]["passed"] == 401
    assert body["test_verdict"]["failed"] == 0

    status, verdict_data = _request("GET", f"/api/projectbase/sessions/{sid}/verdict")
    assert status == 200
    assert verdict_data["verification_badge"] == "verified"
    assert verdict_data["test_verdict"]["passed"] == 401


# 3. Test Failing Test Verdict Triggers failing_tests Badge
def test_record_failing_test_verdict():
    sid, rec_id = _create_sample_session()

    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/verdict", {
        "framework": "pytest",
        "passed": 390,
        "failed": 11,
        "skipped": 0,
        "duration_s": 2.1,
        "failures": [
            {"name": "test_auth_guard", "error_message": "AssertionError: 401 != 200"}
        ]
    })
    assert status == 200
    assert body["verification_badge"] == "failing_tests"
    assert body["verification_score"] < 80

    status, verdict_data = _request("GET", f"/api/projectbase/sessions/{sid}/verdict")
    assert status == 200
    assert verdict_data["verification_badge"] == "failing_tests"
    assert verdict_data["test_verdict"]["failed"] == 11


# 4. Test Sceptic Audit Pass Verdict & Signature
def test_sceptic_audit_pass_verdict():
    sid, rec_id = _create_sample_session()

    # Ingest passing tests first
    _request("POST", f"/api/projectbase/sessions/{sid}/verdict", {
        "framework": "pytest",
        "passed": 401,
        "failed": 0
    })

    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/audit", {
        "auditor": "Flow Inspect Sceptic Validator",
        "verdict": "PASS",
        "risk_score": 5,
        "findings": [],
        "summary": "Full security and unit verification passed with zero regressions."
    })
    assert status == 200
    assert body["success"] is True
    assert body["vetoed"] is False
    assert body["verification_badge"] == "verified"
    assert body["verification_score"] == 100
    assert "sig_audit_" in body["audit"]["signature"]

    status, audit_data = _request("GET", f"/api/projectbase/sessions/{sid}/audit")
    assert status == 200
    assert audit_data["verification_badge"] == "verified"
    assert audit_data["sceptic_audit"]["verdict"] == "PASS"
    assert len(audit_data["audit_history"]) >= 1


# 5. Test Sceptic P0 Veto Enforcement
def test_sceptic_audit_p0_veto_enforcement():
    sid, rec_id = _create_sample_session()

    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/audit", {
        "auditor": "Flow Inspect Sceptic Security Auditor",
        "verdict": "FAIL",
        "risk_score": 95,
        "findings": [
            {
                "id": "FIND-SEC-01",
                "severity": "P0",
                "category": "security",
                "title": "Unauthenticated endpoint exposure detected",
                "description": "Sensitive internal route lacked auth token verification."
            }
        ],
        "summary": "P0 Critical veto issued: security flaw blocks release."
    })
    assert status == 200
    assert body["vetoed"] is True
    assert body["verification_badge"] == "vetoed"
    assert body["verification_score"] <= 30

    status, session_details = _request("GET", f"/api/projectbase/sessions/{sid}")
    assert status == 200
    assert session_details["status"] == "failed"


# 6. Test Workspace Observability Summary Metrics
def test_observability_summary_metrics():
    status, body = _request("GET", "/api/projectbase/observability/summary")
    assert status == 200
    assert "total_sessions" in body
    assert "verified_count" in body
    assert "vetoed_count" in body
    assert "global_test_pass_rate_percent" in body
    assert "total_tests_executed" in body
    assert "total_lines_added" in body
    assert "total_lines_deleted" in body
    assert "health" in body


# 7. Test Automated Verify Suite Runner
def test_verify_suite_runner():
    sid, rec_id = _create_sample_session()

    status, body = _request("POST", "/api/projectbase/observability/verify-suite", {
        "session_id": sid,
        "framework": "playwright",
        "passed": 48,
        "failed": 0,
        "raw_diff": SAMPLE_DIFF
    })
    assert status == 200
    assert body["success"] is True
    assert body["verification_badge"] == "verified"
    assert body["test_verdict"]["framework"] == "playwright"
    assert body["test_verdict"]["passed"] == 48
    assert body["sceptic_audit"]["verdict"] == "PASS"


# 8. Test FastMCP Observability Tools
def test_mcp_observability_tools():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    sid, rec_id = _create_sample_session()

    # A. record_session_diff MCP tool
    status, mcp_resp = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "diff-1",
        "method": "tools/call",
        "params": {
            "name": "record_session_diff",
            "arguments": {
                "session_id": sid,
                "raw_diff": SAMPLE_DIFF,
                "git_branch": "main"
            }
        }
    }, headers=headers)
    assert status == 200
    assert "result" in mcp_resp

    # B. record_test_verdict MCP tool
    status, mcp_resp = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "verdict-1",
        "method": "tools/call",
        "params": {
            "name": "record_test_verdict",
            "arguments": {
                "session_id": sid,
                "framework": "pytest",
                "passed": 401,
                "failed": 0,
                "duration_s": 0.85
            }
        }
    }, headers=headers)
    assert status == 200
    assert "result" in mcp_resp

    # C. submit_sceptic_audit MCP tool
    status, mcp_resp = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "audit-1",
        "method": "tools/call",
        "params": {
            "name": "submit_sceptic_audit",
            "arguments": {
                "session_id": sid,
                "auditor": "Flow Inspect FastMCP Sceptic",
                "verdict": "PASS",
                "risk_score": 10,
                "findings": []
            }
        }
    }, headers=headers)
    assert status == 200
    assert "result" in mcp_resp

    # D. get_session_observability MCP tool
    status, mcp_resp = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "get-obs-1",
        "method": "tools/call",
        "params": {
            "name": "get_session_observability",
            "arguments": {
                "session_id": sid
            }
        }
    }, headers=headers)
    assert status == 200
    assert "result" in mcp_resp

    # E. list_agent_sessions MCP tool
    status, mcp_resp = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "list-sess-1",
        "method": "tools/call",
        "params": {
            "name": "list_agent_sessions",
            "arguments": {
                "verification_badge": "verified"
            }
        }
    }, headers=headers)
    assert status == 200
    assert "result" in mcp_resp

    # F. fork_agent_session MCP tool
    status, mcp_resp = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "fork-sess-1",
        "method": "tools/call",
        "params": {
            "name": "fork_agent_session",
            "arguments": {
                "session_id": sid,
                "prompt": "Continue autonomous refinement cycle"
            }
        }
    }, headers=headers)
    assert status == 200
    assert "result" in mcp_resp


# 9. Test Multi-Audit History Persistence in session_audits Collection
def test_session_audits_collection_persistence():
    sid, rec_id = _create_sample_session()

    _request("POST", f"/api/projectbase/sessions/{sid}/audit", {
        "auditor": "Flow Inspect First Pass",
        "verdict": "CONDITIONAL_PASS",
        "risk_score": 20,
        "findings": [{"id": "F-01", "severity": "P2", "title": "Style warning"}]
    })

    _request("POST", f"/api/projectbase/sessions/{sid}/audit", {
        "auditor": "Flow Inspect Final Pass",
        "verdict": "PASS",
        "risk_score": 0,
        "findings": []
    })

    status, audit_data = _request("GET", f"/api/projectbase/sessions/{sid}/audit")
    assert status == 200
    assert len(audit_data["audit_history"]) >= 2
    assert audit_data["verification_badge"] == "verified"


# 10. Test Observability with Direct JSON File Diffs Payload
def test_record_structured_file_diffs():
    sid, rec_id = _create_sample_session()

    status, body = _request("POST", f"/api/projectbase/sessions/{sid}/diff", {
        "files": [
            {"file": "app/pb_public/js/api.js", "additions": 45, "deletions": 2},
            {"file": "app/pb_hooks/108_session_observability_engine.pb.js", "additions": 320, "deletions": 0}
        ],
        "git_commit_after": "a1b2c3d4",
        "git_branch": "main"
    })
    assert status == 200
    assert body["files_count"] == 2
    assert body["summary"]["additions"] == 365
    assert body["summary"]["deletions"] == 2

    status, diff_data = _request("GET", f"/api/projectbase/sessions/{sid}/diff")
    assert status == 200
    assert len(diff_data["files"]) == 2
    assert diff_data["summary"]["net_change"] == 363
