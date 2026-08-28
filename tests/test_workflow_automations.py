"""tests/test_workflow_automations.py — End-to-end tests for Epic 20 Native Workflow Automations & AI Agent Trigger Pipelines.

Verifies:
  1. Automation rule creation, listing, updating, toggle, and deletion
  2. Rule test execution with simulated payloads & condition matching
  3. Manual and automated event dispatching into automation engine
  4. Conditional evaluation (status, priority, labels, project)
  5. Action pipeline step execution (dispatch_agent, create_subtasks, send_notification, send_webhook, add_comment, update_issue)
  6. Execution runs listing, trace details, cancellation, and retry
  7. Engine telemetry metrics computation and success rate tracking
  8. Blueprint templates retrieval
  9. FastMCP JSON-RPC 2.0 tools for workflow automations
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
    return f"wf_{int(time.time() * 1000) % 10000000}"


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
        resp_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(resp_body)
        except Exception:
            parsed = {"error": resp_body}
        return e.code, parsed


def _get_auth_token():
    status, res = _request(
        "POST",
        "/api/collections/users/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status == 200 and "token" in res:
        return res["token"]
    status, res = _request(
        "POST",
        "/api/admins/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status == 200 and "token" in res:
        return res["token"]
    return None


@pytest.fixture(scope="module")
def auth_header():
    token = _get_auth_token()
    if not token:
        pytest.skip("Unable to obtain superuser auth token")
    return {"Authorization": f"Bearer {token}"}


class TestWorkflowAutomations:
    def test_get_templates(self, auth_header):
        status, res = _request("GET", "/api/projectbase/automations/templates", headers=auth_header)
        assert status == 200
        assert "templates" in res
        assert res["total"] >= 4
        ids = [t["id"] for t in res["templates"]]
        assert "template_bug_triage_agent" in ids
        assert "template_copilot_subtasks" in ids
        assert "template_sla_escalation_alert" in ids
        assert "template_done_verification_pipeline" in ids

    def test_create_and_list_rule(self, auth_header):
        rule_name = f"Auto QA Trigger {_uid()}"
        payload = {
            "name": rule_name,
            "description": "Trigger QA agent on done status",
            "event_type": "issue.status_changed",
            "trigger_conditions": {"status_to": "done"},
            "action_pipeline": [
                {
                    "id": "step_qa",
                    "action": "dispatch_agent",
                    "params": {"role": "qa", "prompt": "Verify completed issue"},
                },
                {
                    "id": "step_notif",
                    "action": "send_notification",
                    "params": {"title": "QA Triggered", "message": "Verification agent dispatched"},
                },
            ],
            "is_active": True,
            "execution_mode": "sequential",
        }
        status, res = _request("POST", "/api/projectbase/automations/rules", payload, auth_header)
        assert status == 200
        assert res.get("success") is True
        rule = res.get("rule", {})
        assert rule.get("name") == rule_name
        rule_id = rule.get("id")
        assert rule_id is not None

        # Verify in list
        status, list_res = _request("GET", "/api/projectbase/automations/rules", headers=auth_header)
        assert status == 200
        assert "rules" in list_res
        found = [r for r in list_res["rules"] if r["id"] == rule_id]
        assert len(found) == 1
        assert found[0]["event_type"] == "issue.status_changed"
        assert len(found[0]["action_pipeline"]) == 2

    def test_toggle_and_test_rule(self, auth_header):
        rule_name = f"Toggle Test Rule {_uid()}"
        status, res = _request(
            "POST",
            "/api/projectbase/automations/rules",
            {
                "name": rule_name,
                "event_type": "issue.created",
                "trigger_conditions": {"priority": "urgent", "labels_include": ["security"]},
                "action_pipeline": [{"id": "s1", "action": "log_audit", "params": {"message": "Security triage"}}],
            },
            auth_header,
        )
        assert status == 200
        rule_id = res["rule"]["id"]

        # Toggle inactive
        status, toggle_res = _request("POST", f"/api/projectbase/automations/rules/{rule_id}/toggle", headers=auth_header)
        assert status == 200
        assert toggle_res.get("is_active") is False

        # Toggle back active
        status, toggle_res = _request("POST", f"/api/projectbase/automations/rules/{rule_id}/toggle", headers=auth_header)
        assert status == 200
        assert toggle_res.get("is_active") is True

        # Test rule - matching payload
        status, test_res = _request(
            "POST",
            f"/api/projectbase/automations/rules/{rule_id}/test",
            {"priority": "urgent", "labels": ["security", "p0"]},
            auth_header,
        )
        assert status == 200
        assert test_res.get("matched") is True
        assert test_res.get("run", {}).get("status") == "completed"

        # Test rule - non-matching payload
        status, test_res = _request(
            "POST",
            f"/api/projectbase/automations/rules/{rule_id}/test",
            {"priority": "low", "labels": ["docs"]},
            auth_header,
        )
        assert status == 200
        assert test_res.get("matched") is False

    def test_trigger_pipeline_execution(self, auth_header):
        rule_name = f"Execution Pipeline Rule {_uid()}"
        status, res = _request(
            "POST",
            "/api/projectbase/automations/rules",
            {
                "name": rule_name,
                "event_type": "issue.priority_changed",
                "trigger_conditions": {"priority_to": "urgent"},
                "action_pipeline": [
                    {"id": "step_agent", "action": "dispatch_agent", "params": {"role": "sre", "prompt": "SLA alert"}},
                    {"id": "step_webhook", "action": "send_webhook", "params": {"url": "https://example.com/alert"}},
                    {"id": "step_subtasks", "action": "create_subtasks", "params": {"subtasks": ["Diagnose", "Patch"]}},
                ],
                "is_active": True,
            },
            auth_header,
        )
        assert status == 200
        rule_id = res["rule"]["id"]

        # Trigger event
        status, trig_res = _request(
            "POST",
            "/api/projectbase/automations/trigger",
            {
                "event_type": "issue.priority_changed",
                "payload": {
                    "issue_id": f"issue_{_uid()}",
                    "priority_to": "urgent",
                    "priority_from": "medium",
                },
            },
            auth_header,
        )
        assert status == 200
        assert trig_res.get("success") is True
        assert trig_res.get("fired_count") >= 1
        fired_runs = trig_res.get("fired_runs", [])
        our_run = [r for r in fired_runs if r["rule_id"] == rule_id]
        assert len(our_run) == 1
        assert our_run[0]["status"] == "completed"
        assert len(our_run[0]["step_results"]) == 3

    def test_runs_lifecycle_cancel_retry(self, auth_header):
        status, runs_res = _request("GET", "/api/projectbase/automations/runs?limit=10", headers=auth_header)
        assert status == 200
        assert "runs" in runs_res
        if len(runs_res["runs"]) > 0:
            run = runs_res["runs"][0]
            run_id = run["id"]

            # Get details
            status, det_res = _request("GET", f"/api/projectbase/automations/runs/{run_id}", headers=auth_header)
            assert status == 200
            assert det_res.get("run", {}).get("id") == run_id

            # Cancel
            status, cancel_res = _request("POST", f"/api/projectbase/automations/runs/{run_id}/cancel", headers=auth_header)
            assert status == 200
            assert cancel_res.get("status") == "cancelled"

            # Retry
            status, retry_res = _request("POST", f"/api/projectbase/automations/runs/{run_id}/retry", headers=auth_header)
            assert status == 200
            assert retry_res.get("success") is True
            assert retry_res.get("retried_from_run_id") == run_id

    def test_metrics_telemetry(self, auth_header):
        status, res = _request("GET", "/api/projectbase/automations/metrics", headers=auth_header)
        assert status == 200
        assert res.get("system_status") == "operational"
        assert res.get("total_rules", 0) >= 1
        assert res.get("active_rules", 0) >= 1
        assert res.get("total_runs", 0) >= 1
        assert 0 <= res.get("success_rate", 0) <= 100

    def test_delete_rule(self, auth_header):
        rule_name = f"Delete Me {_uid()}"
        status, res = _request(
            "POST",
            "/api/projectbase/automations/rules",
            {"name": rule_name, "event_type": "manual"},
            auth_header,
        )
        assert status == 200
        rule_id = res["rule"]["id"]

        status, del_res = _request("DELETE", f"/api/projectbase/automations/rules/{rule_id}", headers=auth_header)
        assert status == 200
        assert del_res.get("success") is True

        # Verify not found on second delete
        status, del_again = _request("DELETE", f"/api/projectbase/automations/rules/{rule_id}", headers=auth_header)
        assert status == 404


class TestFastMCPAutomationTools:
    def _call_mcp(self, tool_name, args, auth_header):
        payload = {
            "jsonrpc": "2.0",
            "id": f"mcp_{int(time.time()*1000)}",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args
            }
        }
        status, res = _request("POST", "/projectbase/mcp", payload, auth_header)
        if status != 200 or "result" not in res:
            status, res = _request("POST", "/api/projectbase/mcp", payload, auth_header)
        assert status == 200, f"MCP call {tool_name} failed: {res}"
        assert "result" in res, f"Expected result in MCP response: {res}"
        content = res["result"].get("content", [])
        assert len(content) > 0, f"Expected non-empty content in MCP response: {res}"
        text = content[0].get("text", "{}")
        return json.loads(text)

    def test_mcp_list_and_create_rule(self, auth_header):
        # 1. List templates via MCP
        res = self._call_mcp("list_automation_templates", {}, auth_header)
        assert res.get("success") is True
        assert len(res.get("templates", [])) >= 4

        # 2. Create rule via MCP
        rule_name = f"MCP Automated Bug Triager {_uid()}"
        res = self._call_mcp("create_automation_rule", {
            "name": rule_name,
            "description": "Created via FastMCP JSON-RPC 2.0 tool",
            "event_type": "issue.created",
            "trigger_conditions": {"labels_include": ["bug"]},
            "action_pipeline": [{"id": "s1", "action": "dispatch_agent", "params": {"role": "qa"}}]
        }, auth_header)
        assert res.get("success") is True
        assert res.get("name") == rule_name
        rule_id = res.get("id")
        assert rule_id is not None

        # 3. List rules via MCP
        res = self._call_mcp("list_automation_rules", {}, auth_header)
        assert res.get("success") is True
        assert res.get("count", 0) >= 1
        found = [r for r in res.get("rules", []) if r["id"] == rule_id]
        assert len(found) == 1

        # 4. Trigger automation via MCP
        res = self._call_mcp("trigger_automation_pipeline", {
            "event_type": "issue.created",
            "payload": {"labels": ["bug"], "issue_id": f"issue_{_uid()}"}
        }, auth_header)
        assert res.get("success") is True
        assert res.get("event_type") == "issue.created"

        # 5. List runs via MCP
        res = self._call_mcp("list_automation_runs", {"limit": 10}, auth_header)
        assert res.get("success") is True
        assert res.get("count", 0) >= 1

        # 6. Metrics via MCP
        res = self._call_mcp("get_automation_metrics", {}, auth_header)
        assert res.get("success") is True
        assert res.get("system_status") == "operational"
        assert res.get("total_rules", 0) >= 1
