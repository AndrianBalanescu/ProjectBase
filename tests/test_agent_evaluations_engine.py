"""tests/test_agent_evaluations_engine.py — Comprehensive test suite for Agent Evaluation Benchmark Harness, Leaderboard & Regression Matrix (Milestone 8 / Epic 29).

Verifies:
  1. Benchmark Default Seeding (/api/projectbase/evals/seed-defaults).
  2. Eval Suites CRUD & Domain Filtering (/api/projectbase/evals/suites, /api/projectbase/evals/suites/{id}).
  3. Eval Run Triggering & Execution (/api/projectbase/evals/runs/trigger).
  4. Eval Run Listing & Granular Details (/api/projectbase/evals/runs, /api/projectbase/evals/runs/{id}).
  5. Scenario Metric Assertion Ingestion & Run Recalculation (/api/projectbase/evals/runs/{id}/metrics).
  6. Global Model Leaderboard & Composite Scoring (/api/projectbase/evals/leaderboard).
  7. Regression Anomaly Detection (/api/projectbase/evals/regressions).
  8. Side-by-Side Model Comparison (/api/projectbase/evals/compare).
  9. FastMCP JSON-RPC 2.0 Tools (8 tools):
     - run_agent_eval_suite
     - list_eval_suites
     - get_eval_run_details
     - get_agent_leaderboard
     - detect_agent_regressions
     - create_eval_suite
     - record_eval_scenario_result
     - compare_model_benchmarks
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
    except Exception as e:
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


def _call_mcp(tool_name, arguments, token):
    payload = {
        "jsonrpc": "2.0",
        "id": f"test-eval-{int(time.time()*1000)}",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    status, res = _post("/api/projectbase/mcp", payload, token=token)
    assert status == 200, f"MCP call to {tool_name} returned status {status}: {res}"
    if "error" in res:
        pytest.fail(f"MCP tool {tool_name} error: {res['error']}")
    assert "result" in res, f"Expected 'result' in response for {tool_name}"
    content = res["result"].get("content", [])
    assert len(content) > 0, f"Expected non-empty content in MCP result for {tool_name}"
    return json.loads(content[0]["text"])


@pytest.fixture(scope="module")
def auth_token():
    tok = _superuser_token()
    assert tok, "Failed to authenticate superuser for eval tests"
    return tok


def test_seed_default_eval_suites(auth_token):
    """Seed canonical benchmark suites and verify initialization."""
    status, data = _post("/api/projectbase/evals/seed-defaults", {}, token=auth_token)
    assert status == 200
    assert data.get("success") is True


def test_eval_suites_crud_and_filtering(auth_token):
    """Create, retrieve, filter, and delete an eval suite."""
    test_slug = f"test-suite-{int(time.time())}"
    suite_payload = {
        "name": "Integration Test Suite",
        "slug": test_slug,
        "description": "Validates API and CLI integration paths",
        "domain": "coding",
        "pass_threshold_pct": 95,
        "timeout_seconds": 40,
        "scenarios": [
            {"id": "t1", "name": "Scenario 1", "expected": "ok"},
            {"id": "t2", "name": "Scenario 2", "expected": "ok"}
        ]
    }
    status, create_res = _post("/api/projectbase/evals/suites", suite_payload, token=auth_token)
    assert status == 200
    assert create_res.get("success") is True
    suite_id = create_res["suite"]["id"]

    # Retrieve by ID
    status, get_res = _get(f"/api/projectbase/evals/suites/{suite_id}", token=auth_token)
    assert status == 200
    assert get_res["slug"] == test_slug
    assert len(get_res["scenarios"]) == 2

    # List & filter by domain
    status, list_res = _get("/api/projectbase/evals/suites?domain=coding", token=auth_token)
    assert status == 200
    assert any(s["slug"] == test_slug for s in list_res["suites"])

    # Delete
    status, del_res = _delete(f"/api/projectbase/evals/suites/{suite_id}", token=auth_token)
    assert status == 200
    assert del_res.get("success") is True


def test_trigger_eval_run_and_metrics(auth_token):
    """Trigger an automated evaluation run, record metrics, and inspect results."""
    run_payload = {
        "model": "gpt-5.5-eval-test",
        "persona": "coder",
        "suite_slug": "coding-accuracy-v1",
        "auto_execute": True
    }
    status, trigger_res = _post("/api/projectbase/evals/runs/trigger", run_payload, token=auth_token)
    assert status == 201
    assert trigger_res.get("success") is True
    run_id = trigger_res["run_id"]
    assert trigger_res["run"]["total_scenarios"] > 0
    assert trigger_res["run"]["score_percentage"] >= 0

    # Get Run details
    status, run_details = _get(f"/api/projectbase/evals/runs/{run_id}", token=auth_token)
    assert status == 200
    assert run_details["id"] == run_id
    assert len(run_details["metrics"]) > 0

    # Record additional manual metric assertion
    metric_payload = {
        "scenario_id": "custom-assert-1",
        "scenario_name": "Custom Edge Case Assertion",
        "status": "passed",
        "latency_ms": 190,
        "tokens_used": 420,
        "cost_usd": 0.00336,
        "mark_completed": True
    }
    status, metric_res = _post(f"/api/projectbase/evals/runs/{run_id}/metrics", metric_payload, token=auth_token)
    assert status == 201
    assert metric_res.get("success") is True
    assert metric_res["run_aggregates"]["passed_scenarios"] >= 1


def test_eval_leaderboard_and_composite_ranking(auth_token):
    """Verify live leaderboard returns ranked model evaluations."""
    status, lb_res = _get("/api/projectbase/evals/leaderboard", token=auth_token)
    assert status == 200
    leaderboard = lb_res.get("leaderboard", [])
    assert len(leaderboard) > 0
    assert "composite_score" in leaderboard[0]
    assert "win_rate" in leaderboard[0]
    assert "certification_status" in leaderboard[0]
    assert lb_res["summary"]["total_models_evaluated"] > 0


def test_detect_regressions_endpoint(auth_token):
    """Verify regression anomaly detection endpoint."""
    status, reg_res = _get("/api/projectbase/evals/regressions", token=auth_token)
    assert status == 200
    assert "regressions" in reg_res
    assert "total_regressions_detected" in reg_res


def test_compare_models_head_to_head(auth_token):
    """Verify side-by-side model comparison endpoint."""
    payload = {
        "model_a": "gpt-5.5",
        "model_b": "claude-fable-5",
        "persona": "coder"
    }
    status, comp_res = _post("/api/projectbase/evals/compare", payload, token=auth_token)
    assert status == 200
    assert "model_a" in comp_res
    assert "model_b" in comp_res
    assert "head_to_head" in comp_res
    assert "composite_winner" in comp_res["head_to_head"]


def test_fastmcp_eval_tools_suite(auth_token):
    """Verify all 8 FastMCP JSON-RPC 2.0 tools for evaluation harness."""
    # 1. list_eval_suites
    suites_res = _call_mcp("list_eval_suites", {"domain": "coding"}, auth_token)
    assert "suites" in suites_res

    # 2. create_eval_suite
    mcp_slug = f"mcp-suite-{int(time.time())}"
    create_res = _call_mcp("create_eval_suite", {
        "name": "FastMCP Eval Test Suite",
        "slug": mcp_slug,
        "domain": "tool_use",
        "pass_threshold_pct": 92,
        "timeout_seconds": 30
    }, auth_token)
    assert create_res.get("success") is True

    # 3. run_agent_eval_suite
    run_res = _call_mcp("run_agent_eval_suite", {
        "model": "gpt-5.5",
        "persona": "coder",
        "suite_slug": "coding-accuracy-v1",
        "auto_execute": True
    }, auth_token)
    assert run_res.get("success") is True
    run_id = run_res["run_id"]

    # 4. get_eval_run_details
    details_res = _call_mcp("get_eval_run_details", {"run_id": run_id}, auth_token)
    assert details_res["id"] == run_id

    # 5. record_eval_scenario_result
    rec_res = _call_mcp("record_eval_scenario_result", {
        "run_id": run_id,
        "scenario_id": "mcp-sc-1",
        "scenario_name": "MCP Scenario 1",
        "status": "passed",
        "latency_ms": 210,
        "tokens_used": 500,
        "cost_usd": 0.004
    }, auth_token)
    assert rec_res.get("success") is True

    # 6. get_agent_leaderboard
    lb_res = _call_mcp("get_agent_leaderboard", {}, auth_token)
    assert "leaderboard" in lb_res

    # 7. detect_agent_regressions
    reg_res = _call_mcp("detect_agent_regressions", {}, auth_token)
    assert "regressions" in reg_res

    # 8. compare_model_benchmarks
    comp_res = _call_mcp("compare_model_benchmarks", {
        "model_a": "gpt-5.5",
        "model_b": "claude-fable-5"
    }, auth_token)
    assert "head_to_head" in comp_res
