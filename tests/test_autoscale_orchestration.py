"""tests/test_autoscale_orchestration.py — Autonomous Agent Autoscaling, Dynamic Workload Orchestration & Self-Healing.

Validates Epic 14 features:
1. Real-time workload analytics, queue saturation, and per-persona queue depth (/api/projectbase/agents/workload).
2. Dynamic agent autoscaling recommendations and persona pool allocation plans (/api/projectbase/agents/autoscale).
3. Worker slot capacity reservation leases with TTL auto-expiration (/api/projectbase/agents/capacity/reserve, release).
4. Autonomous workflow self-healing engine detecting and auto-reconciling expired leases and stalled DAGs (/api/projectbase/workflow/self-heal).
5. Continuous live database latency benchmarking and WAL contention telemetry (/api/projectbase/benchmarks/live, run).
6. FastMCP JSON-RPC 2.0 tool execution for all autoscaling, capacity, self-healing, and benchmark tools.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


def _uid():
    return f"w{int(time.time() * 1000) % 10000000}"


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


def _create_test_project_and_issue(token, prefix="WKL"):
    u = _uid()
    proj_ident = f"W{u[-3:]}"
    status, proj = _request(
        "POST",
        "/api/collections/projects/records",
        {"name": f"Workload Test {u}", "identifier": proj_ident, "icon": "⚡", "color": "#6366f1"},
        headers={"Authorization": token},
    )
    assert status == 200, f"Failed to create project: {proj}"

    status, issue = _request(
        "POST",
        "/api/collections/issues/records",
        {
            "project": proj["id"],
            "title": f"Autoscale Backend API Task {u}",
            "status": "todo",
            "priority": "high",
            "task_persona": "backend",
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Failed to create issue: {issue}"
    return proj, issue


class TestAgentWorkloadAnalytics:
    def test_workload_requires_auth(self):
        status, res = _request("GET", "/api/projectbase/agents/workload")
        assert status == 401

    def test_workload_metrics_calculation(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        status, data = _request("GET", "/api/projectbase/agents/workload", headers={"Authorization": token})
        assert status == 200
        assert "total_issues" in data
        assert "status_distribution" in data
        assert "persona_queue_depth" in data
        assert "workload_metrics" in data
        assert "saturation_percent" in data["workload_metrics"]
        assert "sla_risk" in data["workload_metrics"]
        assert data["persona_queue_depth"]["backend"] >= 1

    def test_workload_project_filter(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        status, data = _request(
            "GET",
            f"/api/projectbase/agents/workload?project_id={proj['id']}",
            headers={"Authorization": token},
        )
        assert status == 200
        assert data["project_id"] == proj["id"]
        assert data["total_issues"] >= 1
        assert data["status_distribution"]["todo"] >= 1


class TestAutoscaleRecommendations:
    def test_autoscale_requires_auth(self):
        status, res = _request("POST", "/api/projectbase/agents/autoscale", body={})
        assert status == 401

    def test_autoscale_calculation_plan(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        status, data = _request(
            "POST",
            "/api/projectbase/agents/autoscale",
            body={
                "project_id": proj["id"],
                "min_workers": 2,
                "max_workers": 8,
                "target_saturation_pct": 75,
            },
            headers={"Authorization": token},
        )
        assert status == 200
        assert "autoscale_decision" in data
        assert data["autoscale_decision"] in ["scale_up", "scale_down", "maintain"]
        assert data["total_recommended_workers"] >= 2
        assert "persona_allocations" in data
        assert "backend" in data["persona_allocations"]
        assert data["scaling_plan"]["strategy"] is not None

    def test_autoscale_apply_persists_workloads(self):
        token = _auth_token()
        proj, issue = _create_test_project_and_issue(token)

        status, data = _request(
            "POST",
            "/api/projectbase/agents/autoscale",
            body={
                "project_id": proj["id"],
                "min_workers": 1,
                "max_workers": 5,
                "apply": True,
            },
            headers={"Authorization": token},
        )
        assert status == 200
        assert data["scaling_plan"]["applied"] is True


class TestAgentCapacityReservations:
    def test_capacity_reserve_and_release_lifecycle(self):
        token = _auth_token()
        u = _uid()
        worker_id = f"worker-test-{u}"

        # 1. Reserve capacity
        status, res = _request(
            "POST",
            "/api/projectbase/agents/capacity/reserve",
            body={
                "persona": "frontend",
                "worker_id": worker_id,
                "slots": 2,
                "ttl_seconds": 600,
            },
            headers={"Authorization": token},
        )
        assert status == 200
        assert res["success"] is True
        assert res["persona"] == "frontend"
        assert res["worker_id"] == worker_id
        assert res["slots"] == 2
        res_id = res["reservation_id"]
        assert res_id.startswith("RES-")

        # 2. Verify workload reflects reservation
        status, wl = _request("GET", "/api/projectbase/agents/workload", headers={"Authorization": token})
        assert status == 200
        assert wl["capacity"]["total_reserved_slots"] >= 2

        # 3. Release capacity
        status, rel = _request(
            "POST",
            "/api/projectbase/agents/capacity/release",
            body={"reservation_id": res_id},
            headers={"Authorization": token},
        )
        assert status == 200
        assert rel["success"] is True
        assert rel["released_count"] >= 1


class TestWorkflowSelfHealing:
    def test_self_heal_requires_auth(self):
        status, res = _request("POST", "/api/projectbase/workflow/self-heal", body={})
        assert status == 401

    def test_self_heal_heals_expired_leases_and_stalled_dags(self):
        token = _auth_token()
        proj, parent = _create_test_project_and_issue(token)

        # Create child subtask linked to parent
        status, child = _request(
            "POST",
            "/api/collections/issues/records",
            {
                "project": proj["id"],
                "title": "Subtask 1",
                "status": "done",
                "parent_issue": parent["id"],
            },
            headers={"Authorization": token},
        )
        assert status == 200

        # Set parent to in_progress (all children done -> should reconcile to done)
        _request(
            "PATCH",
            f"/api/collections/issues/records/{parent['id']}",
            {"status": "in_progress"},
            headers={"Authorization": token},
        )

        # Run Self-Heal
        status, heal = _request(
            "POST",
            "/api/projectbase/workflow/self-heal",
            body={"project_id": proj["id"], "auto_fix": True},
            headers={"Authorization": token},
        )
        assert status == 200
        assert heal["success"] is True
        assert "anomalies_detected" in heal
        assert "repairs_applied" in heal

        # Verify parent status was reconciled
        status, updated_parent = _request(
            "GET",
            f"/api/collections/issues/records/{parent['id']}",
            headers={"Authorization": token},
        )
        assert status == 200
        assert updated_parent["status"] == "done"


class TestLiveBenchmarks:
    def test_live_benchmarks_metrics(self):
        token = _auth_token()
        status, data = _request("GET", "/api/projectbase/benchmarks/live", headers={"Authorization": token})
        assert status == 200
        assert data["status"] == "healthy"
        assert "benchmark_metrics" in data
        metrics = data["benchmark_metrics"]
        assert "latency_ms" in metrics
        assert metrics["latency_ms"]["avg"] >= 0
        assert "estimated_qps" in metrics
        assert metrics["estimated_qps"] > 0

    def test_run_benchmarks_endpoint(self):
        token = _auth_token()
        status, data = _request(
            "POST",
            "/api/projectbase/benchmarks/run",
            body={"iterations": 5},
            headers={"Authorization": token},
        )
        assert status == 200
        assert data["success"] is True
        assert data["iterations"] == 5
        assert len(data["latencies_ms"]) == 5
        assert data["rating"] in ["ultra_fast", "good", "degraded"]


class TestFastMCPAutoscaleTools:
    def _call_mcp(self, token, tool_name, args=None):
        status, res = _request(
            "POST",
            "/api/projectbase/mcp",
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": args or {}},
            },
            headers={"Authorization": token},
        )
        assert status == 200, f"MCP call {tool_name} failed ({status}): {res}"
        assert "result" in res, f"MCP response error: {res}"
        content = res["result"]["content"][0]["text"]
        return json.loads(content)

    def test_mcp_get_agent_workload_status(self):
        token = _auth_token()
        data = self._call_mcp(token, "get_agent_workload_status")
        assert "total_issues" in data
        assert "status_distribution" in data
        assert "persona_queue_depth" in data

    def test_mcp_calculate_autoscale_recommendations(self):
        token = _auth_token()
        data = self._call_mcp(token, "calculate_autoscale_recommendations", {"min_workers": 2, "max_workers": 6})
        assert "decision" in data
        assert data["total_recommended_workers"] >= 2
        assert "persona_allocations" in data

    def test_mcp_reserve_and_release_capacity(self):
        token = _auth_token()
        u = _uid()
        res = self._call_mcp(
            token,
            "reserve_agent_capacity",
            {"persona": "review", "worker_id": f"mcp-w-{u}", "slots": 1},
        )
        assert res["success"] is True
        assert "reservation_id" in res
        res_id = res["reservation_id"]

        rel = self._call_mcp(token, "release_agent_capacity", {"reservation_id": res_id})
        assert rel["success"] is True
        assert rel["released_count"] >= 1

    def test_mcp_run_workflow_self_heal(self):
        token = _auth_token()
        heal = self._call_mcp(token, "run_workflow_self_heal", {"auto_fix": True})
        assert heal["success"] is True
        assert "anomalies_detected" in heal

    def test_mcp_get_live_benchmarks(self):
        token = _auth_token()
        bench = self._call_mcp(token, "get_live_benchmarks", {"iterations": 3})
        assert bench["success"] is True
        assert bench["iterations"] == 3
        assert "avg_latency_ms" in bench
