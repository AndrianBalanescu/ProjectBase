"""
Unit and Integration Tests for ProjectBase Hook 118 & FastMCP Tools:
Autonomous Agent Release Flight Control, Deployment Canary Gates, Production Health Probes & Self-Healing Rollback Engine (Milestone 13 / Epic 34 / v1.33.0).
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
            return err.code, {"error": err_body}


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


class TestReleaseFlightControlEngine:

    def test_01_create_and_plan_release(self, auth_token):
        payload = {
            "name": "v1.33.0 - Flight Control Engine Test",
            "version": "1.33.0-test",
            "target_environment": "production",
            "strategy": "canary_percentage",
            "commit_sha": "c0ffee123456",
            "branch": "feature/flight-control",
            "rollback_target": "v1.32.0",
            "canary_config": {
                "step_duration_seconds": 180,
                "error_rate_threshold_pct": 0.8,
                "p95_latency_threshold_ms": 200,
                "auto_rollback_on_failure": True
            }
        }
        status, res = api_request("/api/projectbase/releases", "POST", payload, token=auth_token)
        assert status == 201
        assert res["success"] is True
        assert "release" in res
        release = res["release"]
        assert release["version"] == "1.33.0-test"
        assert release["status"] == "draft"
        assert len(release["stages"]) == 4
        assert len(release["probes"]) == 4

    def test_02_list_and_get_release(self, auth_token):
        status, list_res = api_request("/api/projectbase/releases", "GET", token=auth_token)
        assert status == 200
        assert list_res["success"] is True
        assert list_res["total"] >= 1

        release_id = list_res["releases"][0]["id"]
        status, get_res = api_request(f"/api/projectbase/releases/{release_id}", "GET", token=auth_token)
        assert status == 200
        assert get_res["success"] is True
        assert get_res["release"]["id"] == release_id
        assert "stages" in get_res["release"]
        assert "probes" in get_res["release"]
        assert "summary" in get_res["release"]

    def test_03_start_canary_deployment(self, auth_token):
        # Create fresh release for deployment progression
        status, create_res = api_request("/api/projectbase/releases", "POST", {
            "name": "v1.33.0-canary-progression",
            "version": "1.33.0-prog",
            "target_environment": "production",
            "rollback_target": "v1.32.0"
        }, token=auth_token)
        assert status == 201
        rel_id = create_res["release"]["id"]

        # Start deployment
        status, start_res = api_request(f"/api/projectbase/releases/{rel_id}/start-deployment", "POST", {}, token=auth_token)
        assert status == 200
        assert start_res["success"] is True
        assert start_res["current_stage"]["order"] == 1
        assert start_res["current_stage"]["status"] == "running"

    def test_04_advance_canary_stages(self, auth_token):
        status, create_res = api_request("/api/projectbase/releases", "POST", {
            "name": "v1.33.0-advance-test",
            "version": "1.33.0-adv",
            "target_environment": "production"
        }, token=auth_token)
        assert status == 201
        rel_id = create_res["release"]["id"]

        # Start deployment
        api_request(f"/api/projectbase/releases/{rel_id}/start-deployment", "POST", {}, token=auth_token)

        # Advance to Stage 2 (10%)
        status, adv1 = api_request(f"/api/projectbase/releases/{rel_id}/advance-stage", "POST", {}, token=auth_token)
        assert status == 200
        assert adv1["success"] is True
        assert adv1["active_stage"]["traffic_percentage"] == 10
        assert adv1["traffic_weight"] == 10

        # Advance to Stage 3 (50%)
        status, adv2 = api_request(f"/api/projectbase/releases/{rel_id}/advance-stage", "POST", {}, token=auth_token)
        assert status == 200
        assert adv2["active_stage"]["traffic_percentage"] == 50
        assert adv2["traffic_weight"] == 50

        # Advance to Stage 4 (100%)
        status, adv3 = api_request(f"/api/projectbase/releases/{rel_id}/advance-stage", "POST", {}, token=auth_token)
        assert status == 200
        assert adv3["active_stage"]["traffic_percentage"] == 100

        # Advance past last stage -> full promotion
        status, promo = api_request(f"/api/projectbase/releases/{rel_id}/advance-stage", "POST", {}, token=auth_token)
        assert status == 200
        assert promo["status"] == "promoted"
        assert promo["traffic_weight"] == 100

    def test_05_health_probe_registration_and_simulation(self, auth_token):
        status, create_res = api_request("/api/projectbase/releases", "POST", {
            "name": "v1.33.0-telemetry-test",
            "version": "1.33.0-telem"
        }, token=auth_token)
        assert status == 201
        rel_id = create_res["release"]["id"]

        # Register custom probe
        status, probe_res = api_request(f"/api/projectbase/releases/{rel_id}/probes", "POST", {
            "probe_name": "gRPC Latency Probe",
            "probe_type": "metric_threshold",
            "target_url": "/api/grpc/health",
            "threshold_value": 150,
            "actual_value": 30,
            "status": "passing"
        }, token=auth_token)
        assert status == 201
        assert probe_res["probe"]["probe_name"] == "gRPC Latency Probe"

        # Ingest simulated traffic telemetry
        status, sim_res = api_request(f"/api/projectbase/releases/{rel_id}/simulate-traffic", "POST", {
            "error_rate_pct": 0.04,
            "latency_p95_ms": 42.5,
            "request_count": 1200
        }, token=auth_token)
        assert status == 200
        assert sim_res["success"] is True
        assert sim_res["telemetry"]["error_rate_pct"] == 0.04

    def test_06_evaluate_health_and_auto_rollback(self, auth_token):
        # Create release, start canary, simulate extreme error spike
        status, create_res = api_request("/api/projectbase/releases", "POST", {
            "name": "v1.33.0-auto-rollback-test",
            "version": "1.33.0-crash",
            "rollback_target": "v1.32.0",
            "canary_config": { "error_rate_threshold_pct": 0.5, "auto_rollback_on_failure": True }
        }, token=auth_token)
        assert status == 201
        rel_id = create_res["release"]["id"]

        # Start deployment -> canary active
        api_request(f"/api/projectbase/releases/{rel_id}/start-deployment", "POST", {}, token=auth_token)

        # Inject severe SLA breach error rate (5.5% error rate, threshold is 0.5%)
        api_request(f"/api/projectbase/releases/{rel_id}/simulate-traffic", "POST", {
            "error_rate_pct": 5.5,
            "latency_p95_ms": 850
        }, token=auth_token)

        # Trigger health evaluation gate
        status, eval_res = api_request(f"/api/projectbase/releases/{rel_id}/evaluate-health", "POST", {}, token=auth_token)
        assert status == 200
        assert eval_res["verdict"] == "auto_rollback_triggered"
        assert eval_res["action"] == "instant_self_healing_rollback"
        assert eval_res["restored_version"] == "v1.32.0"

        # Verify release state is rolled_back and traffic is 0%
        status, check_res = api_request(f"/api/projectbase/releases/{rel_id}", "GET", token=auth_token)
        assert check_res["release"]["status"] == "rolled_back"
        assert check_res["release"]["traffic_weight"] == 0
        assert len(check_res["release"]["rollback_events"]) >= 1

    def test_07_manual_emergency_rollback(self, auth_token):
        status, create_res = api_request("/api/projectbase/releases", "POST", {
            "name": "v1.33.0-manual-rollback-test",
            "version": "1.33.0-manual",
            "rollback_target": "v1.32.0"
        }, token=auth_token)
        assert status == 201
        rel_id = create_res["release"]["id"]

        # Trigger manual rollback
        status, rb_res = api_request(f"/api/projectbase/releases/{rel_id}/trigger-rollback", "POST", {
            "trigger_reason": "sceptic_veto",
            "executed_by": "flomaster_sceptic_lead",
            "details": { "note": "Sceptic veto: database migration invariant broken" }
        }, token=auth_token)
        assert status == 200
        assert rb_res["success"] is True
        assert rb_res["rollback_event"]["executed_by"] == "flomaster_sceptic_lead"

    def test_08_full_promotion_endpoint(self, auth_token):
        status, create_res = api_request("/api/projectbase/releases", "POST", {
            "name": "v1.33.0-direct-promotion",
            "version": "1.33.0-prom"
        }, token=auth_token)
        assert status == 201
        rel_id = create_res["release"]["id"]

        status, promo_res = api_request(f"/api/projectbase/releases/{rel_id}/promote", "POST", {}, token=auth_token)
        assert status == 200
        assert promo_res["release"]["status"] == "promoted"
        assert promo_res["release"]["traffic_weight"] == 100

    def test_09_fleet_summary_metrics(self, auth_token):
        status, metrics_res = api_request("/api/projectbase/releases/metrics/summary", "GET", token=auth_token)
        assert status == 200
        assert metrics_res["success"] is True
        summary = metrics_res["summary"]
        assert summary["total_releases"] >= 1
        assert "avg_rollback_mttr_ms" in summary
        assert "health_gate_pass_rate_pct" in summary
        assert summary["fleet_stability_index"] >= 0

    def test_10_fastmcp_release_tools(self, auth_token):
        # 1. plan_release_deployment
        status, plan_resp = mcp_request("tools/call", {
            "name": "plan_release_deployment",
            "arguments": {
                "name": "MCP FastMCP Planned Canary Release",
                "version": "1.33.0-mcp",
                "target_environment": "production",
                "rollback_target": "v1.32.0"
            }
        }, token=auth_token)
        assert status == 200
        assert "error" not in plan_resp
        plan_data = json.loads(plan_resp["result"]["content"][0]["text"])
        rel_id = plan_data["release_id"]
        assert rel_id != ""

        # 2. list_releases
        status, list_resp = mcp_request("tools/call", {
            "name": "list_releases",
            "arguments": { "limit": 10 }
        }, token=auth_token)
        assert status == 200
        assert "error" not in list_resp
        list_data = json.loads(list_resp["result"]["content"][0]["text"])
        assert list_data["total"] >= 1

        # 3. get_release_flight_status
        status, status_resp = mcp_request("tools/call", {
            "name": "get_release_flight_status",
            "arguments": { "release_id": rel_id }
        }, token=auth_token)
        assert status == 200
        assert "error" not in status_resp
        status_data = json.loads(status_resp["result"]["content"][0]["text"])
        assert status_data["id"] == rel_id

        # 4. advance_canary_stage
        status, adv_resp = mcp_request("tools/call", {
            "name": "advance_canary_stage",
            "arguments": { "release_id": rel_id }
        }, token=auth_token)
        assert status == 200
        assert "error" not in adv_resp
        adv_data = json.loads(adv_resp["result"]["content"][0]["text"])
        assert "traffic_percentage" in adv_data

        # 5. record_release_health_probe
        status, probe_resp = mcp_request("tools/call", {
            "name": "record_release_health_probe",
            "arguments": {
                "release_id": rel_id,
                "probe_name": "FastMCP SLA Monitor",
                "actual_value": 28.5,
                "status": "passing"
            }
        }, token=auth_token)
        assert status == 200
        assert "error" not in probe_resp
        probe_data = json.loads(probe_resp["result"]["content"][0]["text"])
        assert probe_data["status"] == "passing"

        # 6. evaluate_release_health_gate
        status, gate_resp = mcp_request("tools/call", {
            "name": "evaluate_release_health_gate",
            "arguments": { "release_id": rel_id }
        }, token=auth_token)
        assert status == 200
        assert "error" not in gate_resp
        gate_data = json.loads(gate_resp["result"]["content"][0]["text"])
        assert gate_data["verdict"] in ["pass", "warning"]

        # 7. promote_release_to_production
        status, promote_resp = mcp_request("tools/call", {
            "name": "promote_release_to_production",
            "arguments": { "release_id": rel_id }
        }, token=auth_token)
        assert status == 200
        assert "error" not in promote_resp
        promote_data = json.loads(promote_resp["result"]["content"][0]["text"])
        assert promote_data["status"] == "promoted"

        # 8. execute_instant_rollback
        status, rb_resp = mcp_request("tools/call", {
            "name": "execute_instant_rollback",
            "arguments": {
                "release_id": rel_id,
                "trigger_reason": "manual_operator_override",
                "executed_by": "fastmcp_sentinel"
            }
        }, token=auth_token)
        assert status == 200
        assert "error" not in rb_resp
        rb_data = json.loads(rb_resp["result"]["content"][0]["text"])
        assert rb_data["status"] == "rolled_back"
