"""tests/test_ephemeral_sandboxes_orchestrator.py — Comprehensive test suite for Autonomous Ephemeral Dev Sandboxes & Worktree Container Orchestrator (Milestone 9 / Epic 30).

Verifies:
  1. Default Sandbox Blueprints Seeding (/api/projectbase/sandboxes/seed-defaults).
  2. Sandbox Templates Listing & Creation (/api/projectbase/sandboxes/templates).
  3. Sandbox Provisioning & Dynamic Port Allocation (/api/projectbase/sandboxes/provision).
  4. Sandbox Detail Inspection & Metrics (/api/projectbase/sandboxes/{id}).
  5. Sandbox Lifecycle Actions: start, pause, restart, terminate (/api/projectbase/sandboxes/{id}/action).
  6. In-Sandbox Command Execution & Health Degradation (/api/projectbase/sandboxes/{id}/exec).
  7. Execution History Querying (/api/projectbase/sandboxes/{id}/executions).
  8. State & Filesystem Snapshot Checkpoints (/api/projectbase/sandboxes/{id}/snapshot, /snapshots).
  9. Health Status Probing (/api/projectbase/sandboxes/{id}/health).
  10. Fleet-Wide Resource Allocation Metrics (/api/projectbase/sandboxes/metrics).
  11. Expired TTL Garbage Collection & Cleanup (/api/projectbase/sandboxes/cleanup-idle).
  12. FastMCP JSON-RPC 2.0 Tools (8 tools):
      - provision_dev_sandbox
      - list_dev_sandboxes
      - get_sandbox_status
      - exec_in_sandbox
      - snapshot_sandbox_state
      - terminate_dev_sandbox
      - list_sandbox_templates
      - get_sandbox_fleet_metrics
  13. Frontend Guard & Static CSS Sync Verification.
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


def _superuser_token():
    url = f"{BASE_URL}/api/collections/_superusers/auth-with-password"
    payload = json.dumps({"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("token")
    except Exception:
        return ""


def _post(path, data, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


def _get(path, token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


def _delete(path, token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


def _mcp_call(method, params, token=None):
    url = f"{BASE_URL}/api/projectbase/mcp"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    body = {
        "jsonrpc": "2.0",
        "id": "test-req-1",
        "method": "tools/call",
        "params": {
            "name": method,
            "arguments": params
        }
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if "result" in data and "content" in data["result"]:
                text = data["result"]["content"][0]["text"]
                return resp.status, json.loads(text)
            return resp.status, data
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))
    except Exception as e:
        return 500, {"error": str(e)}


@pytest.fixture(scope="module")
def auth_token():
    token = _superuser_token()
    assert token != "", "Superuser token acquisition failed"
    return token


# ==============================================================================
# 1. TEMPLATES & BLUEPRINTS
# ==============================================================================

def test_seed_default_sandbox_templates(auth_token):
    status, res = _post("/api/projectbase/sandboxes/seed-defaults", {}, auth_token)
    assert status == 200
    assert res.get("success") is True


def test_list_sandbox_templates(auth_token):
    status, res = _get("/api/projectbase/sandboxes/templates", auth_token)
    assert status == 200
    assert res.get("success") is True
    templates = res.get("templates", [])
    assert len(templates) >= 3
    slugs = [t["slug"] for t in templates]
    assert any("vue" in s or "fastapi" in s or "pocketbase" in s for s in slugs)


def test_create_custom_sandbox_template(auth_token):
    payload = {
        "name": "Custom Elixir Phoenix Sandbox",
        "slug": f"elixir-phoenix-{int(time.time())}",
        "description": "Distributed real-time Phoenix LiveView sandbox",
        "runtime_type": "custom",
        "environment_type": "worktree",
        "build_command": "mix deps.get && mix compile",
        "start_command": "mix phx.server",
        "default_port": 4000,
        "memory_limit_mb": 1024
    }
    status, res = _post("/api/projectbase/sandboxes/templates", payload, auth_token)
    assert status in [200, 201]
    assert res.get("success") is True
    assert res.get("template", {}).get("name") == "Custom Elixir Phoenix Sandbox"


# ==============================================================================
# 2. SANDBOX PROVISIONING & METRICS
# ==============================================================================

def test_provision_sandbox_worktree(auth_token):
    payload = {
        "name": "test-worktree-sandbox",
        "environment_type": "worktree",
        "runtime_type": "node",
        "memory_limit_mb": 1024,
        "ttl_seconds": 7200,
        "env_vars_json": {"NODE_ENV": "development", "MOCK_AUTH": "true"}
    }
    status, res = _post("/api/projectbase/sandboxes/provision", payload, auth_token)
    assert status in [200, 201]
    assert res.get("success") is True
    sb = res.get("sandbox", {})
    assert sb.get("status") == "running"
    assert sb.get("health_status") == "healthy"
    assert sb.get("allocated_port") >= 8140
    assert "http://127.0.0.1:" in sb.get("preview_url")
    assert sb.get("memory_limit_mb") == 1024


def test_list_sandboxes_filtering(auth_token):
    status, res = _get("/api/projectbase/sandboxes?status=running", auth_token)
    assert status == 200
    assert res.get("success") is True
    sandboxes = res.get("sandboxes", [])
    assert len(sandboxes) >= 1
    assert all(s["status"] == "running" for s in sandboxes)


def test_get_sandbox_detail(auth_token):
    # Provision first
    _, p_res = _post("/api/projectbase/sandboxes/provision", {"name": "inspectable-box"}, auth_token)
    sandbox_id = p_res["sandbox"]["id"]

    status, res = _get(f"/api/projectbase/sandboxes/{sandbox_id}", auth_token)
    assert status == 200
    assert res.get("success") is True
    sb = res.get("sandbox", {})
    assert sb.get("id") == sandbox_id
    assert "executions" in sb
    assert "snapshots" in sb


# ==============================================================================
# 3. LIFECYCLE ACTIONS & COMMAND EXECUTION
# ==============================================================================

def test_sandbox_lifecycle_actions(auth_token):
    _, p_res = _post("/api/projectbase/sandboxes/provision", {"name": "lifecycle-box"}, auth_token)
    sandbox_id = p_res["sandbox"]["id"]

    # Pause
    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/action", {"action": "stop"}, auth_token)
    assert status == 200
    assert res.get("status") == "paused"

    # Resume
    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/action", {"action": "start"}, auth_token)
    assert status == 200
    assert res.get("status") == "running"

    # Restart
    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/action", {"action": "restart"}, auth_token)
    assert status == 200
    assert res.get("status") == "running"

    # Terminate
    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/action", {"action": "terminate"}, auth_token)
    assert status == 200
    assert res.get("status") == "terminated"


def test_exec_in_sandbox(auth_token):
    _, p_res = _post("/api/projectbase/sandboxes/provision", {"name": "exec-target-box"}, auth_token)
    sandbox_id = p_res["sandbox"]["id"]

    # Successful exec
    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/exec", {
        "command": "npm test -- --coverage",
        "executed_by": "flomaster-agent",
        "exit_code": 0,
        "stdout": "PASS tests/app.test.js\n100% test coverage"
    }, auth_token)
    assert status in [200, 201]
    assert res.get("success") is True
    assert res.get("execution", {}).get("exit_code") == 0

    # Failed exec - health should degrade
    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/exec", {
        "command": "npm run build:fail",
        "executed_by": "flomaster-agent",
        "exit_code": 1,
        "stderr": "SyntaxError: Unexpected token"
    }, auth_token)
    assert status in [200, 201]
    assert res.get("execution", {}).get("status") == "failed"

    # Check sandbox health
    _, sb_res = _get(f"/api/projectbase/sandboxes/{sandbox_id}", auth_token)
    assert sb_res["sandbox"]["health_status"] == "degraded"


def test_list_sandbox_executions(auth_token):
    _, p_res = _post("/api/projectbase/sandboxes/provision", {"name": "exec-history-box"}, auth_token)
    sandbox_id = p_res["sandbox"]["id"]

    _post(f"/api/projectbase/sandboxes/{sandbox_id}/exec", {"command": "echo 1"}, auth_token)
    _post(f"/api/projectbase/sandboxes/{sandbox_id}/exec", {"command": "echo 2"}, auth_token)

    status, res = _get(f"/api/projectbase/sandboxes/{sandbox_id}/executions", auth_token)
    assert status == 200
    assert res.get("success") is True
    assert len(res.get("executions", [])) >= 2


# ==============================================================================
# 4. SNAPSHOTS & HEALTH PROBES
# ==============================================================================

def test_create_and_list_sandbox_snapshots(auth_token):
    _, p_res = _post("/api/projectbase/sandboxes/provision", {"name": "snapshot-box"}, auth_token)
    sandbox_id = p_res["sandbox"]["id"]

    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/snapshot", {
        "snapshot_name": "pre-auth-refactor-checkpoint",
        "notes": "State before modifying OAuth token exchange"
    }, auth_token)
    assert status in [200, 201]
    assert res.get("success") is True
    assert res.get("snapshot", {}).get("snapshot_name") == "pre-auth-refactor-checkpoint"

    # List snapshots
    status, list_res = _get(f"/api/projectbase/sandboxes/{sandbox_id}/snapshots", auth_token)
    assert status == 200
    assert len(list_res.get("snapshots", [])) >= 1


def test_sandbox_health_update(auth_token):
    _, p_res = _post("/api/projectbase/sandboxes/provision", {"name": "health-target-box"}, auth_token)
    sandbox_id = p_res["sandbox"]["id"]

    status, res = _post(f"/api/projectbase/sandboxes/{sandbox_id}/health", {
        "health_status": "healthy"
    }, auth_token)
    assert status == 200
    assert res.get("health_status") == "healthy"


# ==============================================================================
# 5. FLEET METRICS & AUTO-TEARDOWN
# ==============================================================================

def test_sandbox_fleet_metrics(auth_token):
    status, res = _get("/api/projectbase/sandboxes/metrics", auth_token)
    assert status == 200
    assert res.get("success") is True
    metrics = res.get("metrics", {})
    assert "total_sandboxes" in metrics
    assert "active_sandboxes" in metrics
    assert "total_allocated_memory_mb" in metrics
    assert "allocated_ports" in metrics


def test_cleanup_idle_sandboxes(auth_token):
    status, res = _post("/api/projectbase/sandboxes/cleanup-idle", {}, auth_token)
    assert status == 200
    assert res.get("success") is True
    assert "cleaned_count" in res


# ==============================================================================
# 6. FASTMCP JSON-RPC 2.0 INTEGRATION (8 TOOLS)
# ==============================================================================

def test_fastmcp_provision_and_manage_sandbox(auth_token):
    # 1. provision_dev_sandbox
    status, res = _mcp_call("provision_dev_sandbox", {
        "name": "mcp-agent-sandbox",
        "environment_type": "worktree",
        "runtime_type": "python",
        "memory_limit_mb": 1024
    }, auth_token)
    assert status == 200
    assert res.get("success") is True
    sandbox_id = res.get("sandbox_id")
    assert sandbox_id is not None

    # 2. list_dev_sandboxes
    status, list_res = _mcp_call("list_dev_sandboxes", {"status": "running"}, auth_token)
    assert status == 200
    assert list_res.get("count") >= 1

    # 3. get_sandbox_status
    status, status_res = _mcp_call("get_sandbox_status", {"sandbox_id": sandbox_id}, auth_token)
    assert status == 200
    assert status_res.get("id") == sandbox_id
    assert status_res.get("status") == "running"

    # 4. exec_in_sandbox
    status, exec_res = _mcp_call("exec_in_sandbox", {
        "sandbox_id": sandbox_id,
        "command": "pytest tests/test_core.py"
    }, auth_token)
    assert status == 200
    assert exec_res.get("success") is True
    assert exec_res.get("exit_code") == 0

    # 5. snapshot_sandbox_state
    status, snap_res = _mcp_call("snapshot_sandbox_state", {
        "sandbox_id": sandbox_id,
        "snapshot_name": "mcp-checkpoint-1"
    }, auth_token)
    assert status == 200
    assert snap_res.get("success") is True

    # 6. list_sandbox_templates
    status, tpl_res = _mcp_call("list_sandbox_templates", {}, auth_token)
    assert status == 200
    assert tpl_res.get("count") >= 1

    # 7. get_sandbox_fleet_metrics
    status, met_res = _mcp_call("get_sandbox_fleet_metrics", {}, auth_token)
    assert status == 200
    assert met_res.get("active_sandboxes") >= 1

    # 8. terminate_dev_sandbox
    status, term_res = _mcp_call("terminate_dev_sandbox", {"sandbox_id": sandbox_id}, auth_token)
    assert status == 200
    assert term_res.get("success") is True


# ==============================================================================
# 7. FRONTEND GUARD & STATIC CSS SYNC
# ==============================================================================

def test_frontend_guard_and_css_sync():
    css_path = "/data/projects/projectbase/app/pb_public/css/style.css"
    assert os.path.exists(css_path)
    assert os.path.getsize(css_path) > 30000

    agents_view_path = "/data/projects/projectbase/app/pb_public/js/components/AgentsView.js"
    assert os.path.exists(agents_view_path)
    with open(agents_view_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "sandboxes" in content
    assert "Autonomous Ephemeral Sandboxes & Dev Environments" in content
    # The lean console shows sandbox telemetry (PID, model, tokens, duration)
    # in the runs tab. Action stubs were removed during the Phase 1 de-bloat.
    assert "selectedSession.pid" in content
    assert "fmtTokens" in content
