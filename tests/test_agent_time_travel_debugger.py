"""
Unit and Integration Tests for ProjectBase Hook 121 & FastMCP Tools:
Autonomous Agent Time-Travel Debugger, Execution Trace Replay, Breakpoint Watchpoints & State Snapshot Engine (Milestone 16 / Epic 37 / v1.36.0).
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
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("token")
    except Exception:
        return None


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
        try:
            return err.code, json.loads(err.read().decode("utf-8"))
        except Exception:
            return err.code, {"error": str(err)}
    except Exception as err:
        return 500, {"error": str(err)}


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
    token = get_auth_token()
    assert token is not None, "Superuser auth token must be available for testing"
    return token


class TestAgentTimeTravelDebugger:
    created_session_id = None
    created_bp_id = None

    def test_01_create_and_list_debug_session(self, auth_token):
        payload = {
            "name": "Flomaster Autonomous Workflow Debug Run",
            "agent_id": "flomaster",
            "target_model": "claude-fable-5",
            "entrypoint": "orchestrate_swarm_plan",
            "tags": "autonomous,swarm,debugger",
            "metadata_json": {
                "max_depth": 5,
                "timeout_sec": 300
            }
        }
        status, res = api_request("/api/projectbase/debug/sessions", method="POST", body=payload, token=auth_token)
        assert status in (200, 201)
        assert res.get("success") is True
        session = res.get("session", {})
        TestAgentTimeTravelDebugger.created_session_id = session.get("id")
        assert TestAgentTimeTravelDebugger.created_session_id is not None
        assert session.get("name") == "Flomaster Autonomous Workflow Debug Run"
        assert session.get("status") == "active"

        # List debug sessions
        status, list_res = api_request("/api/projectbase/debug/sessions", method="GET", token=auth_token)
        assert status == 200
        assert any(s.get("id") == TestAgentTimeTravelDebugger.created_session_id for s in list_res.get("items", []))

    def test_02_register_breakpoints(self, auth_token):
        sess_id = TestAgentTimeTravelDebugger.created_session_id
        assert sess_id is not None

        # 1. Breakpoint on error
        payload1 = {
            "name": "Trap Critical Errors",
            "condition_type": "on_error",
            "condition_expr": "",
            "action": "pause"
        }
        status, res1 = api_request(f"/api/projectbase/debug/sessions/{sess_id}/breakpoints", method="POST", body=payload1, token=auth_token)
        assert status in (200, 201)
        assert res1.get("success") is True
        TestAgentTimeTravelDebugger.created_bp_id = res1.get("breakpoint", {}).get("id")

        # 2. Breakpoint on specific tool
        payload2 = {
            "name": "Trap Git Operations",
            "condition_type": "on_tool",
            "condition_expr": "git_commit",
            "action": "pause"
        }
        status, res2 = api_request(f"/api/projectbase/debug/sessions/{sess_id}/breakpoints", method="POST", body=payload2, token=auth_token)
        assert status in (200, 201)

        # List breakpoints
        status, list_res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/breakpoints", method="GET", token=auth_token)
        assert status == 200
        assert len(list_res.get("items", [])) >= 2

    def test_03_record_trace_frames_and_trigger_breakpoints(self, auth_token):
        sess_id = TestAgentTimeTravelDebugger.created_session_id
        assert sess_id is not None

        # Frame 1: regular thought
        frame1 = {
            "step_index": 1,
            "event_type": "thought",
            "action_name": "analyze_workspace_intent",
            "caller": "coordinator",
            "variable_state_json": {"active_project": "projectbase", "pending_tasks": 3},
            "duration_ms": 12,
            "memory_usage_mb": 45.2
        }
        status, res1 = api_request(f"/api/projectbase/debug/sessions/{sess_id}/frames", method="POST", body=frame1, token=auth_token)
        assert status in (200, 201)
        assert res1.get("success") is True
        assert res1.get("session_paused") is False

        # Frame 2: tool call matching git_commit breakpoint
        frame2 = {
            "step_index": 2,
            "event_type": "tool_call",
            "action_name": "git_commit",
            "caller": "implementer",
            "input_payload_json": {"message": "feat: add time travel debugger"},
            "output_payload_json": {"commit_sha": "a1b2c3d4"},
            "variable_state_json": {"working_tree_dirty": False},
            "duration_ms": 120,
            "memory_usage_mb": 46.1
        }
        status, res2 = api_request(f"/api/projectbase/debug/sessions/{sess_id}/frames", method="POST", body=frame2, token=auth_token)
        assert status in (200, 201)
        assert res2.get("success") is True
        assert res2.get("session_paused") is True
        assert res2.get("breakpoint_triggered") is not None

        # Frame 3: error frame matching on_error breakpoint
        frame3 = {
            "step_index": 3,
            "event_type": "error",
            "action_name": "write_file",
            "caller": "writer",
            "error_message": "Disk write permission denied",
            "duration_ms": 5,
            "memory_usage_mb": 46.5
        }
        status, res3 = api_request(f"/api/projectbase/debug/sessions/{sess_id}/frames", method="POST", body=frame3, token=auth_token)
        assert status in (200, 201)
        assert res3.get("success") is True
        assert res3.get("session_paused") is True

    def test_04_time_travel_stepping_and_pausing(self, auth_token):
        sess_id = TestAgentTimeTravelDebugger.created_session_id
        assert sess_id is not None

        # Resume session
        status, res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/resume", method="POST", token=auth_token)
        assert status == 200
        assert res.get("status") == "active"

        # Step back to step 1
        status, step_res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/step", method="POST", body={"direction": "goto", "target_step": 1}, token=auth_token)
        assert status == 200
        assert step_res.get("current_step_index") == 1
        assert step_res.get("current_frame") is not None
        assert step_res.get("current_frame", {}).get("action_name") == "analyze_workspace_intent"

        # Step next
        status, next_res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/step", method="POST", body={"direction": "next", "steps": 1}, token=auth_token)
        assert status == 200
        assert next_res.get("current_step_index") == 2

        # Pause session
        status, pause_res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/pause", method="POST", token=auth_token)
        assert status == 200
        assert pause_res.get("status") == "paused"

    def test_05_state_snapshots_lifecycle(self, auth_token):
        sess_id = TestAgentTimeTravelDebugger.created_session_id
        assert sess_id is not None

        payload = {
            "label": "Pre-execution checkpoint",
            "snapshot_type": "manual",
            "memory_snapshot_json": {"heap_used_mb": 42.0, "total_entities": 150},
            "env_snapshot_json": {"NODE_ENV": "development", "PORT": 8120},
            "fs_diff": "--- a/app.js\n+++ b/app.js\n@@ -1 +1 @@",
            "tokens_consumed": 1250,
            "captured_by": "agent_debugger"
        }
        status, res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/snapshots", method="POST", body=payload, token=auth_token)
        assert status in (200, 201)
        assert res.get("success") is True
        snap_id = res.get("snapshot", {}).get("id")
        assert snap_id is not None

        # List snapshots
        status, list_res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/snapshots", method="GET", token=auth_token)
        assert status == 200
        assert len(list_res.get("items", [])) >= 1

    def test_06_replay_simulation(self, auth_token):
        sess_id = TestAgentTimeTravelDebugger.created_session_id
        assert sess_id is not None

        payload = {
            "from_step": 1,
            "to_step": 3
        }
        status, res = api_request(f"/api/projectbase/debug/sessions/{sess_id}/replay", method="POST", body=payload, token=auth_token)
        assert status == 200
        assert res.get("session_id") == sess_id
        assert res.get("frame_count") == 3
        assert res.get("error_count") == 1
        assert res.get("breakpoint_hit_count") >= 1
        assert len(res.get("replay_timeline", [])) == 3

    def test_07_workspace_debug_metrics(self, auth_token):
        status, res = api_request("/api/projectbase/debug/metrics", method="GET", token=auth_token)
        assert status == 200
        assert res.get("total_sessions", 0) >= 1
        assert res.get("total_trace_frames", 0) >= 3
        assert res.get("total_breakpoints", 0) >= 2
        assert "avg_step_duration_ms" in res
        assert "error_interception_rate_pct" in res

    def test_08_fastmcp_python_tools(self, auth_token):
        # 1. start_debug_session
        status, res = mcp_request("tools/call", {
            "name": "start_debug_session",
            "arguments": {
                "name": "FastMCP Debugger Integration Test",
                "agent_id": "flomaster",
                "target_model": "claude-fable-5",
                "entrypoint": "test_pipeline"
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("success") is True
        session_id = content["session"]["id"]
        assert session_id is not None

        # 2. record_debug_trace_frame
        status, res = mcp_request("tools/call", {
            "name": "record_debug_trace_frame",
            "arguments": {
                "debug_session_id": session_id,
                "action_name": "inspect_code",
                "event_type": "tool_call",
                "caller": "coordinator",
                "duration_ms": 25,
                "memory_usage_mb": 48.0
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("success") is True

        # 3. list_debug_sessions
        status, res = mcp_request("tools/call", {
            "name": "list_debug_sessions",
            "arguments": {"limit": 10}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("total", 0) >= 1

        # 4. get_debug_session_trace
        status, res = mcp_request("tools/call", {
            "name": "get_debug_session_trace",
            "arguments": {"debug_session_id": session_id}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("total", 0) >= 1

        # 5. step_debug_session
        status, res = mcp_request("tools/call", {
            "name": "step_debug_session",
            "arguments": {
                "debug_session_id": session_id,
                "direction": "goto",
                "target_step": 0
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("current_step_index") == 0

        # 6. set_debug_breakpoint
        status, res = mcp_request("tools/call", {
            "name": "set_debug_breakpoint",
            "arguments": {
                "debug_session_id": session_id,
                "name": "Stop On Error",
                "condition_type": "on_error",
                "action": "pause"
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("success") is True

        # 7. capture_debug_state_snapshot
        status, res = mcp_request("tools/call", {
            "name": "capture_debug_state_snapshot",
            "arguments": {
                "debug_session_id": session_id,
                "label": "Test checkpoint",
                "snapshot_type": "manual",
                "memory_snapshot": {"ram_mb": 48}
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("success") is True

        # 8. get_debug_workspace_metrics
        status, res = mcp_request("tools/call", {
            "name": "get_debug_workspace_metrics",
            "arguments": {}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content.get("total_sessions", 0) >= 1
