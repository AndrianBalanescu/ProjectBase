"""
Unit and Integration Tests for ProjectBase Hook 123 & FastMCP Tools:
Autonomous Agent Performance Profiler, Memory Leak Detection, Bottleneck Sentinel & Flamegraph Engine (Milestone 18 / Epic 39 / v1.38.0).
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
            err_body = json.loads(err.read().decode("utf-8"))
        except Exception:
            err_body = {"error": str(err)}
        return err.code, err_body


def mcp_request(method, params=None, token=None):
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or {}
    }
    return api_request("/api/projectbase/mcp", method="POST", body=body, token=token)


def test_create_and_list_perf_profiles():
    """Verify performance profile lifecycle (create, list, get, update, delete)."""
    token = get_auth_token()
    assert token is not None, "Failed to authenticate superuser"

    # Create profile
    status, create_res = api_request("/api/projectbase/perf/profiles", method="POST", body={
        "title": "E2E Agent Kanban Dispatch Benchmark",
        "target_type": "agent_session",
        "duration_ms": 420,
        "peak_memory_mb": 52.4,
        "cpu_utilization_pct": 28.5
    }, token=token)
    assert status == 201, f"Failed to create profile: {create_res}"
    assert create_res["success"] is True
    profile = create_res["profile"]
    profile_id = profile["id"]
    assert profile["title"] == "E2E Agent Kanban Dispatch Benchmark"

    # Update profile
    status, update_res = api_request(f"/api/projectbase/perf/profiles/{profile_id}", method="PATCH", body={
        "status": "recording",
        "duration_ms": 450
    }, token=token)
    assert status == 200
    assert update_res["success"] is True
    assert update_res["profile"]["duration_ms"] == 450

    # List profiles
    status, list_res = api_request("/api/projectbase/perf/profiles", method="GET", token=token)
    assert status == 200
    assert list_res["success"] is True
    assert list_res["total"] >= 1

    # Get details
    status, get_res = api_request(f"/api/projectbase/perf/profiles/{profile_id}", method="GET", token=token)
    assert status == 200
    assert get_res["success"] is True
    assert get_res["profile"]["id"] == profile_id

    # Ingest a span to test cascade deletion
    status, _ = api_request(f"/api/projectbase/perf/profiles/{profile_id}/spans", method="POST", body={
        "name": "ephemeral_span",
        "category": "custom",
        "duration_ms": 10
    }, token=token)
    assert status == 201

    # Delete profile
    status, del_res = api_request(f"/api/projectbase/perf/profiles/{profile_id}", method="DELETE", token=token)
    assert status == 200
    assert del_res["success"] is True

    # Confirm 404 after delete
    status, not_found_res = api_request(f"/api/projectbase/perf/profiles/{profile_id}", method="GET", token=token)
    assert status == 404


def test_validation_and_error_handling():
    """Verify input validation and error states."""
    token = get_auth_token()
    assert token is not None

    # Missing title on create -> 400
    status, err_res = api_request("/api/projectbase/perf/profiles", method="POST", body={}, token=token)
    assert status == 400
    assert err_res["success"] is False

    # Get non-existent profile -> 404
    status, err_res2 = api_request("/api/projectbase/perf/profiles/nonexistent999", method="GET", token=token)
    assert status == 404

    # Update non-existent bottleneck -> 404
    status, err_res3 = api_request("/api/projectbase/perf/bottlenecks/nonexistent999", method="PATCH", body={"status": "optimized"}, token=token)
    assert status == 404


def test_bottleneck_lifecycle_and_filtering():
    """Verify bottleneck status updates and severity filtering."""
    token = get_auth_token()
    assert token is not None

    # Create profile and analyze to generate bottlenecks
    status, c_res = api_request("/api/projectbase/perf/profiles", method="POST", body={
        "title": "Bottleneck Lifecycle Test",
        "duration_ms": 500
    }, token=token)
    pid = c_res["profile"]["id"]

    api_request(f"/api/projectbase/perf/profiles/{pid}/spans", method="POST", body={
        "spans": [
            {"name": "n_plus_one_op", "category": "db_query", "duration_ms": 40, "call_count": 12}
        ]
    }, token=token)

    status, a_res = api_request(f"/api/projectbase/perf/profiles/{pid}/analyze", method="POST", token=token)
    assert status == 200
    assert len(a_res["bottlenecks"]) >= 1
    bid = a_res["bottlenecks"][0]["id"]

    # Patch bottleneck
    status, p_res = api_request(f"/api/projectbase/perf/bottlenecks/{bid}", method="PATCH", body={
        "status": "investigating",
        "root_cause": "Verified iterative query loop in test."
    }, token=token)
    assert status == 200
    assert p_res["bottleneck"]["status"] == "investigating"

    # Query with filter
    status, list_b = api_request(f"/api/projectbase/perf/bottlenecks?profile_id={pid}&status=investigating", method="GET", token=token)
    assert status == 200
    assert len(list_b["bottlenecks"]) >= 1


def test_span_ingestion_and_flamegraph_analysis():
    """Verify span ingestion, flamegraph hierarchy synthesis, and bottleneck detection."""
    token = get_auth_token()
    assert token is not None

    # Create test profile
    status, create_res = api_request("/api/projectbase/perf/profiles", method="POST", body={
        "title": "Data Importer & Query Processing Pipeline",
        "target_type": "workflow",
        "duration_ms": 650
    }, token=token)
    assert status == 201
    profile_id = create_res["profile"]["id"]

    # Ingest batch spans
    spans_payload = {
        "spans": [
            {
                "name": "import_coordinator",
                "category": "function",
                "start_time_offset_ms": 0,
                "duration_ms": 650,
                "self_time_ms": 80,
                "call_count": 1
            },
            {
                "name": "fetch_record_by_id_loop",
                "category": "db_query",
                "start_time_offset_ms": 50,
                "duration_ms": 320,
                "self_time_ms": 320,
                "call_count": 25  # N+1 bottleneck pattern
            },
            {
                "name": "slow_external_webhook",
                "category": "http_request",
                "start_time_offset_ms": 400,
                "duration_ms": 1200,  # Slow I/O bottleneck pattern
                "self_time_ms": 1200,
                "call_count": 1
            }
        ]
    }
    status, spans_res = api_request(f"/api/projectbase/perf/profiles/{profile_id}/spans", method="POST", body=spans_payload, token=token)
    assert status == 201
    assert spans_res["success"] is True
    assert spans_res["count"] == 3

    # Ingest heap snapshot with leak
    status, heap_res = api_request(f"/api/projectbase/perf/profiles/{profile_id}/heap-snapshots", method="POST", body={
        "snapshot_seq": 1,
        "total_heap_mb": 90,
        "used_heap_mb": 85,
        "retained_size_mb": 78,
        "growth_rate_kb_sec": 140,  # Exceeds threshold -> auto-detected leak
        "leak_detected": True
    }, token=token)
    assert status == 201
    assert heap_res["success"] is True
    assert heap_res["heap_snapshot"]["leak_detected"] is True

    # Run Analysis
    status, analyze_res = api_request(f"/api/projectbase/perf/profiles/{profile_id}/analyze", method="POST", token=token)
    assert status == 200
    assert analyze_res["success"] is True
    assert "flamegraph_tree" in analyze_res
    assert analyze_res["flamegraph_tree"]["category"] == "root"
    assert len(analyze_res["bottlenecks"]) >= 2

    # Verify detected bottlenecks
    status, b_res = api_request(f"/api/projectbase/perf/bottlenecks?profile_id={profile_id}", method="GET", token=token)
    assert status == 200
    assert b_res["total"] >= 2
    types = [b["bottleneck_type"] for b in b_res["bottlenecks"]]
    assert "n_plus_one_query" in types
    assert "memory_leak" in types or "io_blocking" in types


def test_optimization_synthesis():
    """Verify automated optimization patch generation for detected bottlenecks."""
    token = get_auth_token()
    assert token is not None

    # Synthesize patch for N+1 query
    status, patch_res = api_request("/api/projectbase/perf/synthesize-optimization", method="POST", body={
        "strategy": "query_batching"
    }, token=token)
    assert status == 200
    assert patch_res["success"] is True
    patch = patch_res["patch"]
    assert patch["strategy"] == "query_batching"
    assert patch["estimated_speedup_pct"] >= 70
    assert "diff" in patch and len(patch["diff"]) > 0


def test_fleet_perf_metrics():
    """Verify fleet-wide performance metric aggregation."""
    token = get_auth_token()
    assert token is not None

    status, metrics_res = api_request("/api/projectbase/perf/fleet-metrics", method="GET", token=token)
    assert status == 200
    assert metrics_res["success"] is True
    fm = metrics_res["fleet_metrics"]
    assert "total_profiles" in fm
    assert "avg_duration_ms" in fm
    assert "estimated_fleet_speedup_pct" in fm


def test_fastmcp_performance_profiler_tools():
    """Verify FastMCP JSON-RPC tools for performance profiling."""
    token = get_auth_token()
    assert token is not None

    # 1. tools/list contains perf tools
    status, list_tools = mcp_request("tools/list", token=token)
    assert status == 200
    tool_names = [t["name"] for t in list_tools["result"]["tools"]]
    assert "start_perf_profile" in tool_names
    assert "record_perf_span" in tool_names
    assert "capture_perf_heap_snapshot" in tool_names
    assert "analyze_perf_profile" in tool_names
    assert "list_perf_profiles" in tool_names
    assert "get_perf_profile_details" in tool_names
    assert "synthesize_perf_optimization" in tool_names
    assert "get_fleet_perf_metrics" in tool_names

    # 2. start_perf_profile tool call
    status, call_res = mcp_request("tools/call", {
        "name": "start_perf_profile",
        "arguments": {
            "title": "MCP Tool Benchmark Run",
            "target_type": "tool_call",
            "duration_ms": 180
        }
    }, token=token)
    assert status == 200
    assert "result" in call_res
    res_data = json.loads(call_res["result"]["content"][0]["text"])
    assert res_data["success"] is True
    prof_id = res_data["profile"]["id"]

    # 3. record_perf_span tool call
    status, span_call = mcp_request("tools/call", {
        "name": "record_perf_span",
        "arguments": {
            "profile_id": prof_id,
            "name": "mcp_tool_execution",
            "category": "tool_call",
            "duration_ms": 180,
            "call_count": 1
        }
    }, token=token)
    assert status == 200
    sdata = json.loads(span_call["result"]["content"][0]["text"])
    assert sdata["success"] is True

    # 4. analyze_perf_profile tool call
    status, an_call = mcp_request("tools/call", {
        "name": "analyze_perf_profile",
        "arguments": {
            "profile_id": prof_id
        }
    }, token=token)
    assert status == 200
    adata = json.loads(an_call["result"]["content"][0]["text"])
    assert adata["success"] is True
    assert "flamegraph_tree" in adata

    # 5. get_fleet_perf_metrics tool call
    status, fleet_call = mcp_request("tools/call", {
        "name": "get_fleet_perf_metrics",
        "arguments": {}
    }, token=token)
    assert status == 200
    fdata = json.loads(fleet_call["result"]["content"][0]["text"])
    assert fdata["success"] is True
    assert "total_profiles" in fdata
