"""
Unit and Integration Tests for ProjectBase Hook 117 & FastMCP Tools:
Autonomous Agent Multi-Persona Code Review Swarm, AST-Aware Critique & Patch Synthesis Engine (Milestone 12 / Epic 33 / v1.32.0).
"""

import json
import os
import urllib.request
import urllib.error
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_ADMIN_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_ADMIN_PASSWORD", "superdev123")


def get_auth_token():
    payload = json.dumps({
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/collections/_superusers/auth-with-password",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("token")


def api_request(path, method="GET", body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        try:
            return err.code, json.loads(err_body)
        except Exception:
            return err.code, {"raw": err_body}


def mcp_request(method, params, token=None):
    url = f"{BASE_URL}/api/projectbase/mcp"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        try:
            return err.code, json.loads(err_body)
        except Exception:
            return err.code, {"raw": err_body}


@pytest.fixture(scope="module")
def auth_token():
    return get_auth_token()


class TestCodeReviewSwarmEngine:
    """Test suite for Hook 117 Autonomous Code Review Swarm REST APIs."""

    def test_01_create_code_review(self, auth_token):
        diff = (
            "--- a/app/pb_hooks/api.js\n"
            "+++ b/app/pb_hooks/api.js\n"
            "@@ -1,5 +1,6 @@\n"
            "+ const apiSecret = \"sk-test-123456\";\n"
            "+ const records = app.findRecordsByFilter(\"users\");\n"
        )
        status, res = api_request("/api/projectbase/reviews", "POST", {
            "title": "feat: add user query endpoint",
            "summary": "Adds user fetching with api secret",
            "source_branch": "feature/user-query",
            "target_branch": "main",
            "diff_content": diff,
            "author_agent": "flomaster-builder"
        }, token=auth_token)

        assert status == 201
        assert "id" in res
        assert res["title"] == "feat: add user query endpoint"
        assert "app/pb_hooks/api.js" in res["files_touched"]
        assert res["overall_score"] == 100
        assert res["status"] == "pending"

    def test_02_list_and_get_review(self, auth_token):
        status, list_res = api_request("/api/projectbase/reviews", "GET", token=auth_token)
        assert status == 200
        assert "reviews" in list_res
        assert list_res["total"] >= 1

        review_id = list_res["reviews"][0]["id"]
        status, get_res = api_request(f"/api/projectbase/reviews/{review_id}", "GET", token=auth_token)
        assert status == 200
        assert get_res["id"] == review_id
        assert "critiques" in get_res
        assert "patches" in get_res

    def test_03_submit_critiques_and_metrics_recalculation(self, auth_token):
        # Create a fresh review
        status, rev = api_request("/api/projectbase/reviews", "POST", {
            "title": "feat: dedicated critique review test",
            "source_branch": "feature/critique-test",
            "diff_content": "+ const temp = 123;",
            "author_agent": "flomaster"
        }, token=auth_token)
        assert status == 201
        review_id = rev["id"]

        # Submit P0 Blocker (Security)
        status, c1 = api_request(f"/api/projectbase/reviews/{review_id}/critiques", "POST", {
            "persona": "security_auditor",
            "severity": "p0_blocker",
            "title": "Hardcoded API Secret Literal",
            "critique_markdown": "Plaintext secret detected in diff.",
            "file_path": "app/pb_hooks/api.js",
            "line_start": 4,
            "line_end": 4,
            "suggested_diff": "- const apiSecret = \"sk-test-123456\";\n+ const apiSecret = process.env.API_SECRET;"
        }, token=auth_token)
        assert status == 201
        assert c1["severity"] == "p0_blocker"
        assert c1["metrics"]["p0"] == 1
        assert c1["metrics"]["verdict"] == "blocked"

        # Submit P1 Warning (Performance)
        status, c2 = api_request(f"/api/projectbase/reviews/{review_id}/critiques", "POST", {
            "persona": "performance_specialist",
            "severity": "p1_warning",
            "title": "Unbounded Query Collection",
            "critique_markdown": "Missing limit on users filter.",
            "file_path": "app/pb_hooks/api.js",
            "line_start": 5,
            "line_end": 5,
            "suggested_diff": "- app.findRecordsByFilter(\"users\");\n+ app.findRecordsByFilter(\"users\", \"id != ''\", \"-created\", 100, 0);"
        }, token=auth_token)
        assert status == 201
        assert c2["severity"] == "p1_warning"
        assert c2["metrics"]["p1"] == 1
        # Score deduction: 100 - (35*1 + 15*1) = 50
        assert c2["metrics"]["score"] == 50

    def test_04_dispatch_autonomous_review_swarm(self, auth_token):
        diff = (
            "--- a/src/billing.js\n"
            "+++ b/src/billing.js\n"
            "@@ -1,3 +1,4 @@\n"
            "+ const stripe = require('stripe')('sk_live_secret');\n"
            "+ const allUsers = app.findAll();\n"
        )
        status, r_res = api_request("/api/projectbase/reviews", "POST", {
            "title": "feat: add stripe billing and user list",
            "source_branch": "feature/stripe-billing",
            "diff_content": diff,
            "files_touched": ["src/billing.js"],
            "author_agent": "flomaster"
        }, token=auth_token)
        assert status == 201
        rev_id = r_res["id"]

        status, swarm_res = api_request(f"/api/projectbase/reviews/{rev_id}/swarm", "POST", token=auth_token)
        assert status == 200
        assert swarm_res["status"] == "success"
        assert swarm_res["critiques_created"] >= 2
        assert swarm_res["metrics"]["p0"] >= 1  # Catches secret / FOSS invariant
        assert swarm_res["metrics"]["verdict"] == "blocked"

    def test_05_synthesize_and_apply_patch(self, auth_token):
        # Create dedicated review with open critiques
        status, rev = api_request("/api/projectbase/reviews", "POST", {
            "title": "feat: patch synthesis review",
            "source_branch": "feature/patch-test",
            "diff_content": "+ const x = 1;",
            "author_agent": "flomaster"
        }, token=auth_token)
        assert status == 201
        review_id = rev["id"]

        # Add 1 P1 critique
        api_request(f"/api/projectbase/reviews/{review_id}/critiques", "POST", {
            "persona": "security_auditor",
            "severity": "p1_warning",
            "title": "Insecure Random Seed",
            "critique_markdown": "Use crypto.randomUUID()",
            "file_path": "src/util.js",
            "line_start": 10,
            "line_end": 10,
            "suggested_diff": "- Math.random()\n+ crypto.randomUUID()"
        }, token=auth_token)

        # Synthesize patch for open critiques
        status, patch_res = api_request(f"/api/projectbase/reviews/{review_id}/synthesize-patch", "POST", {
            "title": "Autonomous Security & Perf Remediation Patch",
            "author_agent": "patch_bot"
        }, token=auth_token)
        assert status == 201
        assert "id" in patch_res
        assert patch_res["dry_run_success"] is True
        patch_id = patch_res["id"]

        # List patches
        status, patches_list = api_request(f"/api/projectbase/reviews/{review_id}/patches", "GET", token=auth_token)
        assert status == 200
        assert patches_list["total"] >= 1

        # Apply patch
        status, apply_res = api_request(f"/api/projectbase/reviews/patches/{patch_id}/apply", "POST", token=auth_token)
        assert status == 200
        assert apply_res["success"] is True
        assert apply_res["status"] == "applied"
        assert apply_res["metrics"]["p0"] == 0
        assert apply_res["metrics"]["p1"] == 0
        assert apply_res["metrics"]["score"] == 100
        assert apply_res["metrics"]["verdict"] == "approved"

    def test_06_evaluate_and_merge_gate(self, auth_token):
        # Create clean review without blockers
        status, rev = api_request("/api/projectbase/reviews", "POST", {
            "title": "feat: clean merge test",
            "source_branch": "feature/clean-merge",
            "diff_content": "+ const clean = true;",
            "author_agent": "flomaster"
        }, token=auth_token)
        assert status == 201
        review_id = rev["id"]

        # Evaluate gate
        status, gate_res = api_request(f"/api/projectbase/reviews/{review_id}/evaluate-gate", "POST", token=auth_token)
        assert status == 200
        assert gate_res["verdict"] == "approved"
        assert gate_res["score"] == 100

        # Execute merge
        status, merge_res = api_request(f"/api/projectbase/reviews/{review_id}/merge", "POST", token=auth_token)
        assert status == 200
        assert merge_res["success"] is True
        assert merge_res["status"] == "merged"

    def test_07_manual_override_gate(self, auth_token):
        # Create review with hardcoded secret
        status, r = api_request("/api/projectbase/reviews", "POST", {
            "title": "hotfix: urgent unreviewed schema patch",
            "source_branch": "hotfix/urgent",
            "diff_content": "+ const password = \"supersecret123\";",
            "author_agent": "flomaster"
        }, token=auth_token)
        assert status == 201
        rev_id = r["id"]

        # Dispatch swarm to trigger blocker
        status, swarm_res = api_request(f"/api/projectbase/reviews/{rev_id}/swarm", "POST", token=auth_token)
        assert status == 200
        assert swarm_res["metrics"]["verdict"] == "blocked"

        # Attempt to merge while blocked -> Should be rejected (403)
        status, blocked_merge = api_request(f"/api/projectbase/reviews/{rev_id}/merge", "POST", token=auth_token)
        assert status == 403

        # Manual Override
        status, override_res = api_request(f"/api/projectbase/reviews/{rev_id}/override-gate", "POST", {
            "reason": "Emergency production hotfix approved by Lead Architect",
            "overridden_by": "tech-lead"
        }, token=auth_token)
        assert status == 200
        assert override_res["verdict"] == "overridden"
        assert override_res["status"] == "approved"

        # Now merge succeeds
        status, merge_res = api_request(f"/api/projectbase/reviews/{rev_id}/merge", "POST", token=auth_token)
        assert status == 200
        assert merge_res["status"] == "merged"

    def test_08_metrics_and_cascade_delete(self, auth_token):
        status, metrics = api_request("/api/projectbase/reviews/metrics", "GET", token=auth_token)
        assert status == 200
        assert metrics["total_reviews"] >= 2
        assert metrics["merged_reviews"] >= 1
        assert "severity_distribution" in metrics

        # Cascade delete a review
        status, list_res = api_request("/api/projectbase/reviews", "GET", token=auth_token)
        rev_to_del = list_res["reviews"][0]["id"]
        status, del_res = api_request(f"/api/projectbase/reviews/{rev_to_del}", "DELETE", token=auth_token)
        assert status == 200
        assert del_res["success"] is True


class TestCodeReviewFastMCPTools:
    """Test suite for FastMCP JSON-RPC tools for Code Reviews."""

    def test_mcp_request_code_review_and_critique(self, auth_token):
        status, res = mcp_request("tools/call", {
            "name": "request_code_review",
            "arguments": {
                "title": "feat: mcp agent refactoring diff",
                "source_branch": "mcp-agent/refactor",
                "diff_content": "+ const worker = new Worker();",
                "author_agent": "mcp_agent_01"
            }
        }, token=auth_token)
        assert status == 200
        assert "result" in res
        content = json.loads(res["result"]["content"][0]["text"])
        assert "id" in content
        rev_id = content["id"]

        # Submit critique via MCP
        status, c_res = mcp_request("tools/call", {
            "name": "submit_persona_critique",
            "arguments": {
                "review_id": rev_id,
                "persona": "architecture_guardian",
                "severity": "p1_warning",
                "title": "WebWorker Lifecycle Check",
                "critique_markdown": "Ensure worker termination on component unmount."
            }
        }, token=auth_token)
        assert status == 200
        critique_content = json.loads(c_res["result"]["content"][0]["text"])
        assert critique_content["persona"] == "architecture_guardian"
        assert critique_content["severity"] == "p1_warning"

    def test_mcp_synthesize_and_list_reviews(self, auth_token):
        status, list_res = mcp_request("tools/call", {
            "name": "list_code_reviews",
            "arguments": { "limit": 10 }
        }, token=auth_token)
        assert status == 200
        list_content = json.loads(list_res["result"]["content"][0]["text"])
        assert list_content["total"] >= 1
        rev_id = list_content["reviews"][0]["id"]

        # Get details
        status, det_res = mcp_request("tools/call", {
            "name": "get_code_review_details",
            "arguments": { "review_id": rev_id }
        }, token=auth_token)
        assert status == 200
        det_content = json.loads(det_res["result"]["content"][0]["text"])
        assert det_content["id"] == rev_id

        # Evaluate gate
        status, gate_res = mcp_request("tools/call", {
            "name": "evaluate_merge_gate",
            "arguments": { "review_id": rev_id }
        }, token=auth_token)
        assert status == 200
        gate_content = json.loads(gate_res["result"]["content"][0]["text"])
        assert "verdict" in gate_content
