"""
Unit and Integration Tests for ProjectBase Hook 120 & FastMCP Tools:
Autonomous Agent Test-Driven Development (TDD) Synthesizer, Mutation Testing Matrix, Flaky Test Quarantine & Test Coverage Sentinel Engine (Milestone 15 / Epic 36 / v1.35.0).
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


class TestTddMutationEngine:

    def test_01_create_and_list_tdd_suites(self, auth_token):
        payload = {
            "name": "User Auth Session Flow",
            "description": "Integration test suite verifying session lifecycle and token refresh",
            "framework": "pytest",
            "test_type": "integration",
            "cases": [
                {
                    "name": "test_token_generation_and_expiry",
                    "description": "Assert JWT token validity window",
                    "assertion_type": "boundary",
                    "test_code": "def test_token(): assert True",
                    "expected_output": "Token validated"
                },
                {
                    "name": "test_invalid_signature_rejection",
                    "description": "Reject corrupted signature",
                    "assertion_type": "exception",
                    "test_code": "def test_invalid(): assert True",
                    "expected_output": "Rejected"
                }
            ]
        }
        status, res = api_request("/api/projectbase/tdd/suites", method="POST", body=payload, token=auth_token)
        assert status in (200, 201)
        assert res.get("success") is True
        suite = res.get("suite", {})
        suite_id = suite.get("id")
        assert suite_id is not None
        assert suite.get("name") == "User Auth Session Flow"

        # List suites
        status, list_res = api_request("/api/projectbase/tdd/suites", method="GET", token=auth_token)
        assert status == 200
        assert list_res.get("success") is True
        assert any(s.get("id") == suite_id for s in list_res.get("suites", []))

    def test_02_synthesize_tdd_suite_from_criteria(self, auth_token):
        payload = {
            "title": "FastMCP Stream Ingestion",
            "criteria": "Ingest SSE events without dropped frames, clamp latency under 50ms, and reject unauthenticated connections",
            "framework": "pytest",
            "test_type": "unit"
        }
        status, res = api_request("/api/projectbase/tdd/suites/synthesize", method="POST", body=payload, token=auth_token)
        assert status in (200, 201)
        assert res.get("success") is True
        suite = res.get("suite", {})
        assert "TDD: FastMCP Stream Ingestion" in suite.get("name")
        assert suite.get("cases_count") == 4
        assert len(suite.get("cases", [])) == 4

    def test_03_get_suite_details_and_run(self, auth_token):
        # Create a fresh suite
        payload = {
            "name": "Payment Webhook Dispatcher",
            "framework": "pytest",
            "cases": [
                {
                    "name": "test_webhook_delivery_retry",
                    "assertion_type": "invariant",
                    "test_code": "def test_retry(): assert True"
                }
            ]
        }
        _, c_res = api_request("/api/projectbase/tdd/suites", method="POST", body=payload, token=auth_token)
        suite_id = c_res["suite"]["id"]

        # Get details
        status, d_res = api_request(f"/api/projectbase/tdd/suites/{suite_id}", method="GET", token=auth_token)
        assert status == 200
        assert d_res.get("success") is True
        assert len(d_res["suite"]["cases"]) == 1

        # Run suite
        status, r_res = api_request(f"/api/projectbase/tdd/suites/{suite_id}/run", method="POST", token=auth_token)
        assert status == 200
        assert r_res.get("success") is True
        assert r_res.get("status") == "passing"
        assert r_res.get("summary", {}).get("passed") >= 1

    def test_04_execute_single_case_assertion(self, auth_token):
        # Create suite and case
        payload = {"name": "Single Case Test Suite"}
        _, c_res = api_request("/api/projectbase/tdd/suites", method="POST", body=payload, token=auth_token)
        suite_id = c_res["suite"]["id"]

        case_payload = {
            "name": "test_atomic_counter_increment",
            "assertion_type": "equality",
            "test_code": "def test_counter(): assert counter.inc() == 1"
        }
        status, case_res = api_request(f"/api/projectbase/tdd/suites/{suite_id}/cases", method="POST", body=case_payload, token=auth_token)
        assert status in (200, 201)
        case_id = case_res["case"]["id"]

        # Execute case (passing)
        status, exec_res = api_request(f"/api/projectbase/tdd/cases/{case_id}/execute", method="POST", body={"force_pass": True}, token=auth_token)
        assert status == 200
        assert exec_res.get("status") == "passing"
        assert exec_res.get("pass_count") == 1

    def test_05_mutation_testing_run(self, auth_token):
        payload = {
            "target_file": "app/pb_hooks/120_tdd_mutation_engine.pb.js",
            "mutator_type": "boundary_condition",
            "mutants_total": 8,
            "mutants_killed": 7
        }
        status, res = api_request("/api/projectbase/tdd/mutation/runs", method="POST", body=payload, token=auth_token)
        assert status in (200, 201)
        assert res.get("success") is True
        run = res.get("run", {})
        assert run.get("mutation_score") >= 80
        assert run.get("mutants_killed") == 7
        run_id = run.get("id")

        # Get details
        status, d_res = api_request(f"/api/projectbase/tdd/mutation/runs/{run_id}", method="GET", token=auth_token)
        assert status == 200
        assert d_res.get("run", {}).get("mutants_total") == 8

    def test_06_flaky_test_quarantine_lifecycle(self, auth_token):
        payload = {
            "test_name": "test_distributed_lock_contention",
            "file_path": "tests/test_cluster_replication.py",
            "flake_rate_pct": 33.3,
            "quarantine_reason": "Sporadic lock acquisition timeout under concurrent multi-worker swarm",
            "isolation_level": "strict_quarantine"
        }
        status, res = api_request("/api/projectbase/tdd/quarantines", method="POST", body=payload, token=auth_token)
        assert status in (200, 201)
        assert res.get("success") is True
        quar = res.get("quarantine", {})
        assert quar.get("status") == "active"
        quar_id = quar.get("id")

        # List quarantines
        status, l_res = api_request("/api/projectbase/tdd/quarantines", method="GET", token=auth_token)
        assert status == 200
        assert any(q.get("id") == quar_id for q in l_res.get("quarantines", []))

        # Resolve / unquarantine
        status, r_res = api_request(f"/api/projectbase/tdd/quarantines/{quar_id}/resolve", method="POST", body={"status": "resolved"}, token=auth_token)
        assert status == 200
        assert r_res.get("success") is True
        assert r_res.get("status") == "resolved"

    def test_07_coverage_and_fleet_metrics(self, auth_token):
        status, cov_res = api_request("/api/projectbase/tdd/coverage", method="GET", token=auth_token)
        assert status == 200
        assert cov_res.get("success") is True
        assert cov_res.get("overall_coverage_pct") >= 90
        assert len(cov_res.get("matrix", [])) >= 4

        status, met_res = api_request("/api/projectbase/tdd/metrics", method="GET", token=auth_token)
        assert status == 200
        assert met_res.get("success") is True
        metrics = met_res.get("metrics", {})
        assert "mutation_kill_rate_pct" in metrics
        assert "fleet_coverage_pct" in metrics

    def test_08_fastmcp_tdd_tools_execution(self, auth_token):
        # 1. synthesize_tdd_tests
        status, res = mcp_request("tools/call", {
            "name": "synthesize_tdd_tests",
            "arguments": {
                "title": "OAuth SSO Callback",
                "criteria": "Validate state parameter and nonce"
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        suite_id = content["id"]
        assert suite_id is not None

        # 2. run_tdd_suite
        status, res = mcp_request("tools/call", {
            "name": "run_tdd_suite",
            "arguments": {"suite_id": suite_id}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content["status"] == "passing"

        # 3. list_tdd_suites
        status, res = mcp_request("tools/call", {
            "name": "list_tdd_suites",
            "arguments": {"limit": 10}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content["total"] >= 1

        # 4. get_tdd_suite_details
        status, res = mcp_request("tools/call", {
            "name": "get_tdd_suite_details",
            "arguments": {"suite_id": suite_id}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content["suite"]["id"] == suite_id

        # 5. run_mutation_test
        status, res = mcp_request("tools/call", {
            "name": "run_mutation_test",
            "arguments": {
                "target_file": "app/pb_hooks/120_tdd_mutation_engine.pb.js",
                "mutator_type": "conditional_inversion",
                "mutants_total": 8
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content["status"] == "completed"

        # 6. quarantine_flaky_test
        status, res = mcp_request("tools/call", {
            "name": "quarantine_flaky_test",
            "arguments": {
                "test_name": "test_mcp_concurrent_stream",
                "flake_rate_pct": 20,
                "quarantine_reason": "Intermittent socket hangup"
            }
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content["status"] == "active"

        # 7. list_quarantined_tests
        status, res = mcp_request("tools/call", {
            "name": "list_quarantined_tests",
            "arguments": {"limit": 10}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content["total"] >= 1

        # 8. get_fleet_test_coverage
        status, res = mcp_request("tools/call", {
            "name": "get_fleet_test_coverage",
            "arguments": {}
        }, token=auth_token)
        assert status == 200
        content = json.loads(res["result"]["content"][0]["text"])
        assert content["overall_coverage_pct"] >= 90
