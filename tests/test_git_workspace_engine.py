"""tests/test_git_workspace_engine.py — Autonomous Agent Code Sandbox, Git Artifacts & Webhook Workspace Engine.

Validates Epic 13 features:
1. Git artifacts linking (branches, commits, pull requests, CI runs, and patches).
2. Autonomous Kanban stage transitions (branch -> in_progress, open PR -> in_review, merged PR -> done).
3. Staging and retrieval of unified diff code patches.
4. Universal Git webhook receiver (push, pull_request, workflow_run) with regex-free token triage.
5. Aggregated workspace & project Git status metrics and CI reliability pass rates.
6. FastMCP JSON-RPC 2.0 tool execution for all Git workspace operations.
"""

import json
import os
import time
import urllib.parse
import urllib.request
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


def _uid():
    return f"t{int(time.time() * 1000) % 10000000}"


def _request(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw}


def _auth_token():
    status, res = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200 or "token" not in res:
        pytest.fail(f"Superuser authentication failed ({status}): {res}")
    return res["token"]


def _create_test_project_and_issue(token, prefix="GIT"):
    u = _uid()
    proj_ident = f"G{u[-3:]}"
    status, proj = _request(
        "POST",
        "/api/collections/projects/records",
        {"name": f"Git Test {u}", "identifier": proj_ident, "icon": "🌿", "color": "#10b981"},
        headers={"Authorization": token},
    )
    assert status == 200, f"Failed to create project: {proj}"

    status, issue = _request(
        "POST",
        "/api/collections/issues/records",
        {
            "project": proj["id"],
            "title": f"Git Feature Issue {u}",
            "status": "todo",
            "priority": "high",
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Failed to create issue: {issue}"
    return proj, issue


class TestGitWorkspaceEngineAuth:
    def test_git_artifacts_auth_required(self):
        status, res = _request("GET", "/api/projectbase/git/artifacts")
        assert status in (401, 403)
        status2, res2 = _request("POST", "/api/projectbase/git/artifacts", {"artifact_type": "branch", "identifier": "feat"})
        assert status2 in (401, 403)

    def test_git_patch_auth_required(self):
        status, res = _request("POST", "/api/projectbase/git/patch", {"patch_content": "diff..."})
        assert status in (401, 403)

    def test_git_status_auth_required(self):
        status, res = _request("GET", "/api/projectbase/git/status")
        assert status in (401, 403)


class TestGitArtifactsAndTransitions:
    def test_link_branch_and_status_advance(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        branch_name = f"feat/{proj['identifier']}-{issue.get('issue_number', 1)}-user-auth"
        status, res = _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {
                "issue_id": issue["id"],
                "project_id": proj["id"],
                "artifact_type": "branch",
                "identifier": branch_name,
                "title": "Feature branch for user authentication",
            },
            headers={"Authorization": token},
        )
        assert status == 201
        assert res["artifact_type"] == "branch"
        assert res["identifier"] == branch_name

        # Verify issue status advanced to in_progress and git_branch set
        status_get, is_rec = _request("GET", f"/api/collections/issues/records/{issue['id']}", headers={"Authorization": token})
        assert status_get == 200
        assert is_rec["status"] == "in_progress"
        assert is_rec.get("git_branch") == branch_name

    def test_link_pull_request_open_and_merged(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        # 1. Link open PR -> status in_review
        status, res = _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {
                "issue_id": issue["id"],
                "artifact_type": "pull_request",
                "identifier": "#42",
                "title": "Add OAuth2 support",
                "url": "https://github.com/org/repo/pull/42",
                "status": "open",
                "author": "dev-agent",
            },
            headers={"Authorization": token},
        )
        assert status == 201

        status_get, is_rec = _request("GET", f"/api/collections/issues/records/{issue['id']}", headers={"Authorization": token})
        assert status_get == 200
        assert is_rec["status"] == "in_review"
        assert is_rec.get("pr_url") == "https://github.com/org/repo/pull/42"
        assert is_rec.get("pr_status") == "open"

        # 2. Link merged PR -> status done
        status_m, res_m = _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {
                "issue_id": issue["id"],
                "artifact_type": "pull_request",
                "identifier": "#42",
                "title": "Add OAuth2 support (Merged)",
                "url": "https://github.com/org/repo/pull/42",
                "status": "merged",
            },
            headers={"Authorization": token},
        )
        assert status_m == 201

        status_get2, is_rec2 = _request("GET", f"/api/collections/issues/records/{issue['id']}", headers={"Authorization": token})
        assert status_get2 == 200
        assert is_rec2["status"] == "done"
        assert is_rec2.get("pr_status") == "merged"

    def test_link_commit_with_diff_stats(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        status, res = _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {
                "issue_id": issue["id"],
                "artifact_type": "commit",
                "identifier": "c3a9f12",
                "title": "feat: implement token verification",
                "author": "flomaster",
                "diff_stats": {"files_changed": 3, "additions": 45, "deletions": 12},
            },
            headers={"Authorization": token},
        )
        assert status == 201
        assert res["diff_stats"]["files_changed"] == 3
        assert res["diff_stats"]["additions"] == 45

    def test_query_git_artifacts(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {
                "issue_id": issue["id"],
                "artifact_type": "branch",
                "identifier": "feat/api",
            },
            headers={"Authorization": token},
        )
        _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {
                "issue_id": issue["id"],
                "artifact_type": "commit",
                "identifier": "b8f2d4e",
            },
            headers={"Authorization": token},
        )

        status, res = _request("GET", f"/api/projectbase/git/artifacts?issue_id={issue['id']}", headers={"Authorization": token})
        assert status == 200
        assert res["total"] >= 2
        assert res["issue"]["id"] == issue["id"]


class TestGitPatchesAndDiffs:
    def test_stage_and_retrieve_patch(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        sample_diff = """--- a/src/auth.js
+++ b/src/auth.js
@@ -1,3 +1,5 @@
+function verifyToken(token) {
+    return token.startsWith("ey");
+}
"""
        status, res = _request(
            "POST",
            "/api/projectbase/git/patch",
            {
                "issue_id": issue["id"],
                "title": "Auth token validator implementation",
                "patch_content": sample_diff,
                "author": "builder-agent",
            },
            headers={"Authorization": token},
        )
        assert status == 201
        assert res["status"] == "staged"
        assert res["diff_stats"]["files_changed"] >= 1
        assert res["diff_stats"]["additions"] >= 3

        patch_id = res["patch_id"]

        # Retrieve patch by ID
        status_get, patch_res = _request("GET", f"/api/projectbase/git/patch/{patch_id}", headers={"Authorization": token})
        assert status_get == 200
        assert patch_res["artifact_type"] == "patch"
        assert patch_res["patch_content"] == sample_diff.strip()


class TestGitWebhookTriage:
    def test_github_push_webhook_triage(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)
        issue_key = f"{proj['identifier']}-{issue.get('issue_number', 1)}"

        webhook_payload = {
            "ref": f"refs/heads/feat/{issue_key}-webhook-test",
            "commits": [
                {
                    "id": "e98a12f34567890",
                    "message": f"feat({issue_key}): implement webhook handler logic",
                    "author": {"name": "alice", "username": "alice"},
                    "url": "https://github.com/org/repo/commit/e98a12f",
                    "added": ["handler.js"],
                    "modified": ["app.js"],
                    "removed": [],
                }
            ],
            "pusher": {"name": "alice"},
        }

        status, res = _request(
            "POST",
            "/api/projectbase/webhooks/git",
            webhook_payload,
            headers={"X-GitHub-Event": "push"},
        )
        assert status == 200
        assert res["event"] == "push"
        assert res["triaged_count"] >= 1

        # Check that commit artifact was recorded
        status_art, arts = _request("GET", f"/api/projectbase/git/artifacts?issue_id={issue['id']}", headers={"Authorization": token})
        assert status_art == 200
        assert any(a["artifact_type"] == "commit" for a in arts["items"])

    def test_github_pull_request_merged_webhook(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)
        issue_key = f"{proj['identifier']}-{issue.get('issue_number', 1)}"

        webhook_payload = {
            "action": "closed",
            "pull_request": {
                "number": 88,
                "title": f"Fixes {issue_key}: Resolve race condition",
                "html_url": "https://github.com/org/repo/pull/88",
                "merged": True,
                "head": {"ref": f"fix/{issue_key}-race"},
                "user": {"login": "octocat"},
            },
        }

        status, res = _request(
            "POST",
            "/api/projectbase/webhooks/git",
            webhook_payload,
            headers={"X-GitHub-Event": "pull_request"},
        )
        assert status == 200
        assert res["triaged_count"] >= 1

        # Verify issue status is done
        status_get, is_rec = _request("GET", f"/api/collections/issues/records/{issue['id']}", headers={"Authorization": token})
        assert status_get == 200
        assert is_rec["status"] == "done"
        assert is_rec.get("pr_status") == "merged"

    def test_github_workflow_run_webhook(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)
        issue_key = f"{proj['identifier']}-{issue.get('issue_number', 1)}"

        webhook_payload = {
            "workflow_run": {
                "id": 9928172,
                "name": "CI Test Suite",
                "head_branch": f"feat/{issue_key}-ci",
                "conclusion": "success",
                "html_url": "https://github.com/org/repo/actions/runs/9928172",
            }
        }

        status, res = _request(
            "POST",
            "/api/projectbase/webhooks/git",
            webhook_payload,
            headers={"X-GitHub-Event": "workflow_run"},
        )
        assert status == 200
        assert res["triaged_count"] >= 1


class TestGitStatusAndMetrics:
    def test_project_git_status_aggregation(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        # Create branch, PR, commit, and CI run
        _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {"issue_id": issue["id"], "project_id": proj["id"], "artifact_type": "branch", "identifier": "feat/xyz"},
            headers={"Authorization": token},
        )
        _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {"issue_id": issue["id"], "project_id": proj["id"], "artifact_type": "pull_request", "identifier": "#99", "status": "open"},
            headers={"Authorization": token},
        )
        _request(
            "POST",
            "/api/projectbase/git/artifacts",
            {"issue_id": issue["id"], "project_id": proj["id"], "artifact_type": "ci_run", "identifier": "ci-1", "status": "success"},
            headers={"Authorization": token},
        )

        status, res = _request("GET", f"/api/projectbase/git/status?project_id={proj['id']}", headers={"Authorization": token})
        assert status == 200
        summary = res["summary"]
        assert summary["branches_tracked"] >= 1
        assert summary["pull_requests"]["open"] >= 1
        assert summary["ci_reliability"]["pass_rate_percent"] >= 0


class TestFastMCPGitTools:
    def test_mcp_git_tools(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        def _call_mcp(tool, args):
            status, res = _request(
                "POST",
                "/api/projectbase/mcp",
                {
                    "jsonrpc": "2.0",
                    "id": f"call_{tool}",
                    "method": "tools/call",
                    "params": {"name": tool, "arguments": args},
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert status == 200, f"MCP call {tool} failed with status {status}: {res}"
            assert "error" not in res, f"MCP tool error in {tool}: {res.get('error')}"
            raw_text = res["result"]["content"][0]["text"]
            return json.loads(raw_text)

        # 1. link_git_commit
        c_res = _call_mcp(
            "link_git_commit",
            {
                "issue_id": issue["id"],
                "commit_sha": "fa12bc94",
                "message": "refactor: simplify token parsing",
                "author": "mcp-agent",
                "files_changed": 2,
                "additions": 20,
                "deletions": 5,
            },
        )
        assert c_res["success"] is True

        # 2. link_git_pr
        pr_res = _call_mcp(
            "link_git_pr",
            {
                "issue_id": issue["id"],
                "pr_number": "#55",
                "pr_url": "https://github.com/org/repo/pull/55",
                "title": "Refactor token parsing PR",
                "status": "open",
                "branch": "refactor/tokens",
            },
        )
        assert pr_res["success"] is True

        # 3. get_issue_git_artifacts
        art_res = _call_mcp("get_issue_git_artifacts", {"issue_id": issue["id"]})
        assert art_res["total"] >= 2

        # 4. stage_code_patch
        patch_res = _call_mcp(
            "stage_code_patch",
            {
                "issue_id": issue["id"],
                "patch_content": "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new",
                "title": "Small fix patch",
            },
        )
        assert patch_res["success"] is True
        assert patch_res["diff_stats"]["files_changed"] == 1

        # 5. get_project_git_status
        stat_res = _call_mcp("get_project_git_status", {"project_id": proj["id"]})
        assert "branches_tracked" in stat_res
        assert "pull_requests" in stat_res
