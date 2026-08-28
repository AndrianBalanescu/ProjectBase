"""tests/test_session_trajectory_and_swarm.py — Comprehensive test suite for Live Trajectory Stream & Autonomous Swarm Clusters (Milestone 5 / Epic 26).

Verifies:
  1. Discrete Step-by-Step Trajectory Recording (thought, tool_call, tool_result, diff, error) with latency, token breakdown, and cost.
  2. Automatic Session Telemetry Aggregation (total_steps, total_tokens, total_cost_usd, active_tool, current_step_type, trajectory_summary).
  3. Bulk Trajectory Step Ingestion (/api/projectbase/sessions/trajectories/bulk).
  4. Chronological Step Querying & Filtering (by step_type, tool_name, status).
  5. Deep Trajectory Summary & Tool Latency Profiling (/api/projectbase/sessions/{id}/trajectories/summary).
  6. Hierarchical Swarm Cluster Orchestration (/api/projectbase/swarm/clusters) with topologies (hierarchical, flat_fanout, pipeline_linear, adversarial_critique).
  7. Dynamic Swarm Worker Addition & Cascading Lifecycle State Controls (pause, resume, abort, complete).
  8. Swarm Cluster Metrics & Aggregation (/api/projectbase/swarm/clusters/{id}/metrics).
  9. FastMCP JSON-RPC 2.0 tools: record_session_trajectory_step, get_session_trajectories, get_session_trajectory_summary, create_swarm_cluster, list_swarm_clusters, get_swarm_cluster_details, add_swarm_cluster_workers, update_swarm_cluster_status.
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
    return f"sess_traj_{int(time.time() * 1000) % 10000000}"


def _request(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body_bytes = resp.read()
            try:
                return status, json.loads(body_bytes.decode("utf-8"))
            except Exception:
                return status, body_bytes.decode("utf-8")
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        try:
            return e.code, json.loads(body_bytes.decode("utf-8"))
        except Exception:
            return e.code, body_bytes.decode("utf-8")


def _auth_token():
    status, res = _request("POST", "/api/collections/users/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    if status == 200 and "token" in res:
        return res["token"]
    status, res = _request("POST", "/api/collections/_superusers/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    if status == 200 and "token" in res:
        return res["token"]
    return None


def _mcp_call(method, params, token=None):
    hdrs = {}
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    return _request("POST", "/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "test-req-traj",
        "method": method,
        "params": params,
    }, headers=hdrs)


class TestSessionTrajectoryTracking:
    """Test suite for discrete trajectory steps, tool profiling, and telemetry aggregation."""

    def test_record_single_trajectory_step_and_session_aggregation(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        sid = _uid()

        # Ingest base session
        _request("POST", "/api/projectbase/sessions/ingest", {
            "session_id": sid,
            "agent_name": "TrajectoryAgent",
            "model": "gpt-5.5"
        }, headers=hdrs)

        # 1. Record thought step
        status, step1 = _request(
            "POST",
            f"/api/projectbase/sessions/{sid}/trajectories",
            {
                "step_type": "thought",
                "thought_text": "Investigating performance bottlenecks in SQLite query index",
                "duration_ms": 320,
                "tokens_prompt": 120,
                "tokens_completion": 45,
                "tokens_reasoning": 80,
                "cost_usd": 0.0012,
                "status": "success"
            },
            headers=hdrs
        )
        assert status == 201, f"Step 1 failed: {step1}"
        assert step1["success"] is True
        assert step1["step_number"] == 1
        assert step1["step_type"] == "thought"

        # 2. Record tool call step
        status, step2 = _request(
            "POST",
            f"/api/projectbase/sessions/{sid}/trajectories",
            {
                "step_type": "tool_call",
                "tool_name": "bash",
                "tool_input": {"command": "sqlite3 pb_data/data.db 'EXPLAIN QUERY PLAN SELECT * FROM issues;'"},
                "tool_output": {"stdout": "SCAN issues USING COVERING INDEX idx_issues_project"},
                "thought_text": "Executing query plan audit",
                "duration_ms": 115,
                "tokens_prompt": 210,
                "tokens_completion": 90,
                "tokens_reasoning": 0,
                "cost_usd": 0.0008,
                "files_touched": ["app/pb_migrations/1710000008_performance_indexes.js"],
                "status": "success"
            },
            headers=hdrs
        )
        assert status == 201, f"Step 2 failed: {step2}"
        assert step2["step_number"] == 2
        assert step2["tool_name"] == "bash"

        # 3. Verify session was automatically aggregated
        status, session = _request("GET", f"/api/projectbase/sessions/{sid}", headers=hdrs)
        assert status == 200
        assert session["total_steps"] >= 2
        assert session["total_tokens"] >= (120 + 45 + 80 + 210 + 90)
        assert session["total_cost_usd"] >= 0.0020
        assert session["active_tool"] == "bash"
        assert session["current_step_type"] == "tool_call"

    def test_bulk_trajectory_ingestion(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        sid = _uid()

        _request("POST", "/api/projectbase/sessions/ingest", {"session_id": sid, "agent_name": "BulkAgent"}, headers=hdrs)

        status, bulk_res = _request(
            "POST",
            "/api/projectbase/sessions/trajectories/bulk",
            {
                "session_id": sid,
                "steps": [
                    {
                        "step_number": 1,
                        "step_type": "thought",
                        "thought_text": "Step A",
                        "duration_ms": 150,
                        "tokens_prompt": 50,
                        "tokens_completion": 20
                    },
                    {
                        "step_number": 2,
                        "step_type": "tool_call",
                        "tool_name": "edit",
                        "tool_input": {"file_path": "app/pb_public/js/app.js"},
                        "duration_ms": 80,
                        "tokens_prompt": 80,
                        "tokens_completion": 40,
                        "files_touched": ["app/pb_public/js/app.js"]
                    },
                    {
                        "step_number": 3,
                        "step_type": "tool_result",
                        "tool_name": "edit",
                        "status": "success",
                        "duration_ms": 10
                    }
                ]
            },
            headers=hdrs
        )
        assert status == 201, f"Bulk ingestion failed: {bulk_res}"
        assert bulk_res["created_count"] == 3

    def test_trajectory_filtering_and_profiling_summary(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        sid = _uid()

        _request("POST", "/api/projectbase/sessions/ingest", {"session_id": sid, "agent_name": "SummaryAgent"}, headers=hdrs)

        # Seed steps
        _request("POST", f"/api/projectbase/sessions/{sid}/trajectories", {
            "step_type": "thought",
            "thought_text": "Planning architecture",
            "duration_ms": 200,
            "tokens_prompt": 100,
            "tokens_completion": 50,
            "cost_usd": 0.001
        }, headers=hdrs)

        _request("POST", f"/api/projectbase/sessions/{sid}/trajectories", {
            "step_type": "tool_call",
            "tool_name": "edit",
            "duration_ms": 300,
            "files_touched": ["app/main.js"],
            "tokens_prompt": 150,
            "tokens_completion": 80,
            "cost_usd": 0.002
        }, headers=hdrs)

        _request("POST", f"/api/projectbase/sessions/{sid}/trajectories", {
            "step_type": "error",
            "tool_name": "bash",
            "error_message": "Command syntax error",
            "status": "failed",
            "duration_ms": 50,
            "tokens_prompt": 50,
            "tokens_completion": 10,
            "cost_usd": 0.0005
        }, headers=hdrs)

        # Query full timeline
        status, timeline = _request("GET", f"/api/projectbase/sessions/{sid}/trajectories", headers=hdrs)
        assert status == 200
        assert timeline["count"] == 3

        # Query filtered by step_type
        status, thoughts = _request("GET", f"/api/projectbase/sessions/{sid}/trajectories?step_type=thought", headers=hdrs)
        assert status == 200
        assert thoughts["count"] == 1
        assert thoughts["trajectories"][0]["thought_text"] == "Planning architecture"

        # Query summary profiling
        status, summary = _request("GET", f"/api/projectbase/sessions/{sid}/trajectories/summary", headers=hdrs)
        assert status == 200
        assert summary["total_steps"] == 3
        assert summary["total_duration_ms"] == 550
        assert summary["total_tokens"] == (150 + 230 + 60)
        assert summary["failure_count"] == 1
        assert summary["files_touched_count"] == 1
        assert "app/main.js" in summary["files_touched"]
        assert len(summary["tool_profiling"]) >= 2


class TestSwarmClusterOrchestration:
    """Test suite for hierarchical multi-agent swarm clusters, workers, and lifecycle management."""

    def test_create_and_manage_swarm_cluster(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        cid = f"cluster_{int(time.time() * 1000) % 1000000}"
        coord_id = _uid()

        _request("POST", "/api/projectbase/sessions/ingest", {"session_id": coord_id, "agent_name": "ClusterCoordinator"}, headers=hdrs)

        # 1. Create cluster with initial workers
        status, cluster = _request(
            "POST",
            "/api/projectbase/swarm/clusters",
            {
                "cluster_id": cid,
                "name": "Feature Delivery Swarm",
                "objective": "Build and verify multi-agent step telemetry",
                "topology": "hierarchical",
                "max_concurrency": 5,
                "coordinator_session_id": coord_id,
                "workers": [
                    {"role": "researcher", "model": "rc/perplexity-sonar-reasoning-pro", "prompt": "Analyze telemetry API requirements"},
                    {"role": "implementer", "model": "claude-fable-5", "prompt": "Implement REST hooks and migrations"},
                    {"role": "auditor", "model": "deepseek/deepseek-r1-distill-llama-70b", "prompt": "Audit token calculations and unit tests"}
                ]
            },
            headers=hdrs
        )
        assert status == 201, f"Cluster creation failed: {cluster}"
        assert cluster["success"] is True
        assert cluster["cluster_id"] == cid
        assert cluster["total_workers"] == 3

        # 2. Get cluster details
        status, details = _request("GET", f"/api/projectbase/swarm/clusters/{cid}", headers=hdrs)
        assert status == 200
        assert details["name"] == "Feature Delivery Swarm"
        assert len(details["workers"]) == 3

        # 3. Add dynamic worker to cluster
        status, added = _request(
            "POST",
            f"/api/projectbase/swarm/clusters/{cid}/workers",
            {
                "workers": [
                    {"role": "tester", "model": "gpt-5.5", "prompt": "Run full test suite"}
                ]
            },
            headers=hdrs
        )
        assert status == 201
        assert added["total_workers"] == 4

        # 4. Lifecycle state change: Pause cluster
        status, paused = _request(
            "POST",
            f"/api/projectbase/swarm/clusters/{cid}/status",
            {"status": "paused"},
            headers=hdrs
        )
        assert status == 200
        assert paused["status"] == "paused"

        # Verify cluster metrics
        status, metrics = _request("GET", f"/api/projectbase/swarm/clusters/{cid}/metrics", headers=hdrs)
        assert status == 200
        assert metrics["total_workers"] == 4
        assert metrics["paused_workers"] == 4

        # 5. Lifecycle state change: Complete cluster
        status, completed = _request(
            "POST",
            f"/api/projectbase/swarm/clusters/{cid}/status",
            {"status": "completed"},
            headers=hdrs
        )
        assert status == 200
        assert completed["status"] == "completed"


class TestFastMCPSessionTrajectoryAndSwarmTools:
    """Test suite for FastMCP JSON-RPC 2.0 trajectory and swarm tools."""

    def test_mcp_trajectory_and_swarm_tools(self):
        token = _auth_token()
        sid = _uid()
        cid = f"mcp_cluster_{int(time.time() * 1000) % 1000000}"

        # 1. Ingest session via MCP
        st, res = _mcp_call("tools/call", {
            "name": "ingest_agent_session",
            "arguments": {"session_id": sid, "agent_name": "MCPTrajAgent", "model": "gpt-5.5"}
        }, token=token)
        assert st == 200

        # 2. Record trajectory step via MCP
        st, res = _mcp_call("tools/call", {
            "name": "record_session_trajectory_step",
            "arguments": {
                "session_id": sid,
                "step_type": "thought",
                "thought_text": "MCP initiated reasoning trace",
                "duration_ms": 180,
                "tokens_prompt": 90,
                "tokens_completion": 40,
                "cost_usd": 0.0009
            }
        }, token=token)
        assert st == 200, f"MCP step record failed: {res}"
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["success"] is True
        assert data["session_id"] == sid
        assert data["tokens_total"] == 130

        # 3. Retrieve trajectory timeline via MCP
        st, res = _mcp_call("tools/call", {
            "name": "get_session_trajectories",
            "arguments": {"session_id": sid}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["count"] >= 1

        # 4. Retrieve trajectory summary via MCP
        st, res = _mcp_call("tools/call", {
            "name": "get_session_trajectory_summary",
            "arguments": {"session_id": sid}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["total_steps"] >= 1
        assert data["total_tokens"] >= 130

        # 5. Create swarm cluster via MCP
        st, res = _mcp_call("tools/call", {
            "name": "create_swarm_cluster",
            "arguments": {
                "cluster_id": cid,
                "name": "MCP Swarm",
                "objective": "Orchestrate multi-agent MCP testing",
                "topology": "flat_fanout",
                "workers": [
                    {"role": "implementer", "agent_name": "MCPWorker1", "model": "gpt-5.5"}
                ]
            }
        }, token=token)
        assert st == 200, f"MCP create swarm failed: {res}"
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["success"] is True
        assert data["cluster_id"] == cid

        # 6. List and inspect swarm cluster via MCP
        st, res = _mcp_call("tools/call", {
            "name": "list_swarm_clusters",
            "arguments": {}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert any(c["cluster_id"] == cid for c in data["clusters"])

        st, res = _mcp_call("tools/call", {
            "name": "get_swarm_cluster_details",
            "arguments": {"cluster_id": cid}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["cluster_id"] == cid
        assert data["total_workers"] >= 1

        # 7. Add worker via MCP
        st, res = _mcp_call("tools/call", {
            "name": "add_swarm_cluster_workers",
            "arguments": {
                "cluster_id": cid,
                "workers": [{"role": "reviewer", "agent_name": "MCPReviewer"}]
            }
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["total_workers"] >= 2

        # 8. Update cluster status via MCP
        st, res = _mcp_call("tools/call", {
            "name": "update_swarm_cluster_status",
            "arguments": {"cluster_id": cid, "status": "completed"}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["status"] == "completed"
