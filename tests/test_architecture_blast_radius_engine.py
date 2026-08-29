"""
Unit and Integration Tests for ProjectBase Hook 122 & FastMCP Tools:
Autonomous Agent Dynamic Architecture Graph, AST Blast-Radius Impact Simulator & Breaking Change Sentinel Engine (Milestone 17 / Epic 38 / v1.37.0).
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


def mcp_request(method_name, args=None, token=None):
    payload = {
        "jsonrpc": "2.0",
        "id": "test-blast-1",
        "method": "tools/call",
        "params": {
            "name": method_name,
            "arguments": args or {}
        }
    }
    status, res = api_request("/api/projectbase/mcp", method="POST", body=payload, token=token)
    return status, res


def test_architecture_graph_lifecycle():
    """Verify creating, listing, scanning, and retrieving an architecture graph."""
    token = get_auth_token()
    assert token is not None, "Failed to authenticate superuser"

    # 1. Create Architecture Graph
    status, res = api_request("/api/projectbase/arch/graphs", method="POST", body={
        "name": "Integration Test Graph",
        "root_path": "app/",
        "language": "javascript/python",
        "status": "active"
    }, token=token)
    assert status == 201, f"Expected 201 Created, got {status}: {res}"
    assert res.get("success") is True
    graph = res.get("graph", {})
    graph_id = graph.get("id")
    assert graph_id, "Missing graph ID in response"

    # 2. Scan Topology
    status, scan_res = api_request(f"/api/projectbase/arch/graphs/{graph_id}/scan", method="POST", token=token)
    assert status == 200, f"Expected 200 OK for scan, got {status}: {scan_res}"
    assert scan_res.get("success") is True
    assert scan_res.get("nodes_indexed", 0) > 0

    # 3. Retrieve Graph Details
    status, get_res = api_request(f"/api/projectbase/arch/graphs/{graph_id}", method="GET", token=token)
    assert status == 200, f"Expected 200 OK, got {status}: {get_res}"
    assert get_res.get("success") is True
    assert get_res.get("graph", {}).get("node_count", 0) > 0

    # 4. List Graphs
    status, list_res = api_request("/api/projectbase/arch/graphs", method="GET", token=token)
    assert status == 200
    assert list_res.get("total", 0) >= 1


def test_architecture_node_and_edge_registration():
    """Verify custom node creation, edge linking, and dependent counting."""
    token = get_auth_token()
    assert token is not None

    # Get an active graph
    status, list_res = api_request("/api/projectbase/arch/graphs", method="GET", token=token)
    assert status == 200
    graphs = list_res.get("graphs", [])
    assert len(graphs) > 0
    graph_id = graphs[0]["id"]

    # Register Source Node
    status, node1_res = api_request(f"/api/projectbase/arch/graphs/{graph_id}/nodes", method="POST", body={
        "name": "Test Payment Controller",
        "path": "app/pb_hooks/99_payment.pb.js",
        "node_type": "endpoint",
        "loc": 150,
        "complexity_score": 8,
        "exported": True
    }, token=token)
    assert status == 201
    node1_id = node1_res["node"]["id"]

    # Register Target Node
    status, node2_res = api_request(f"/api/projectbase/arch/graphs/{graph_id}/nodes", method="POST", body={
        "name": "Payment Schema Model",
        "path": "app/pb_migrations/99_payment_schema.js",
        "node_type": "database_model",
        "loc": 80,
        "complexity_score": 4,
        "exported": True
    }, token=token)
    assert status == 201
    node2_id = node2_res["node"]["id"]

    # Link Dependency Edge
    status, edge_res = api_request(f"/api/projectbase/arch/graphs/{graph_id}/edges", method="POST", body={
        "source_node_id": node1_id,
        "target_node_id": node2_id,
        "relation_type": "reads_schema",
        "weight": 2
    }, token=token)
    assert status == 201
    assert edge_res.get("success") is True


def test_blast_radius_simulation_direct_and_transitive():
    """Verify transitive blast radius calculation, risk score, and simulation persistence."""
    token = get_auth_token()
    assert token is not None

    status, list_res = api_request("/api/projectbase/arch/graphs", method="GET", token=token)
    graph_id = list_res["graphs"][0]["id"]

    # Simulate change to PocketBase server core and Kanban Board
    status, sim_res = api_request("/api/projectbase/arch/simulate-blast", method="POST", body={
        "graph_id": graph_id,
        "changed_paths": [
            "pocketbase",
            "app/pb_public/js/components/KanbanBoard.js"
        ],
        "title": "Core & Kanban Impact Simulation",
        "trigger_source": "agent_pr"
    }, token=token)

    assert status == 200, f"Expected 200 OK, got {status}: {sim_res}"
    assert sim_res.get("success") is True
    sim = sim_res.get("simulation", {})
    assert sim.get("blast_radius_score", 0) > 0
    assert sim.get("risk_level") in ("low", "moderate", "high", "critical")
    assert sim.get("affected_nodes_count", 0) >= 2


def test_breaking_change_detection():
    """Verify potential breaking changes are detected when exported core models/endpoints change."""
    token = get_auth_token()
    assert token is not None

    status, sim_res = api_request("/api/projectbase/arch/simulate-blast", method="POST", body={
        "changed_paths": ["app/pb_migrations/"],
        "title": "Schema Mutation Blast Test",
        "trigger_source": "commit"
    }, token=token)

    assert status == 200
    assert sim_res.get("success") is True
    sim = sim_res.get("simulation", {})
    assert sim.get("risk_level") in ("moderate", "high", "critical")


def test_architecture_metrics_endpoint():
    """Verify workspace metrics endpoint returns coupling index and summary counts."""
    token = get_auth_token()
    assert token is not None

    status, res = api_request("/api/projectbase/arch/metrics", method="GET", token=token)
    assert status == 200, f"Expected 200 OK, got {status}: {res}"
    assert res.get("success") is True
    metrics = res.get("metrics", {})
    assert "total_graphs" in metrics
    assert "total_nodes" in metrics
    assert "test_suite_reduction_pct" in metrics
    assert metrics["test_suite_reduction_pct"] >= 50


def test_blast_simulations_list_and_details():
    """Verify listing and fetching individual blast simulation records."""
    token = get_auth_token()
    assert token is not None

    status, list_res = api_request("/api/projectbase/arch/simulations", method="GET", token=token)
    assert status == 200
    assert list_res.get("success") is True
    sims = list_res.get("simulations", [])
    assert len(sims) > 0

    sim_id = sims[0]["id"]
    status, get_res = api_request(f"/api/projectbase/arch/simulations/{sim_id}", method="GET", token=token)
    assert status == 200
    assert get_res.get("success") is True
    assert get_res.get("simulation", {}).get("id") == sim_id


def test_fastmcp_architecture_tools():
    """Verify 5 FastMCP tools for architecture dependency and blast radius simulation."""
    token = get_auth_token()
    assert token is not None

    # 1. analyze_architecture_graph
    status, res = mcp_request("analyze_architecture_graph", {"name": "FastMCP Architecture Test"}, token=token)
    assert status == 200
    content = res.get("result", {}).get("content", [{}])[0].get("text", "{}")
    data = json.loads(content)
    assert data.get("success") is True
    graph_id = data.get("graph", {}).get("id")

    # 2. register_architecture_node
    status, res = mcp_request("register_architecture_node", {
        "graph_id": graph_id,
        "name": "FastMCP Agent Controller",
        "path": "app/pb_hooks/80_agent_triggers.pb.js",
        "node_type": "endpoint",
        "loc": 320,
        "complexity_score": 12,
        "exported": True
    }, token=token)
    assert status == 200
    content = res.get("result", {}).get("content", [{}])[0].get("text", "{}")
    data = json.loads(content)
    assert data.get("success") is True

    # 3. simulate_change_blast_radius
    status, res = mcp_request("simulate_change_blast_radius", {
        "graph_id": graph_id,
        "changed_paths": ["app/pb_hooks/80_agent_triggers.pb.js"],
        "title": "Agent Trigger Blast MCP Test"
    }, token=token)
    assert status == 200
    content = res.get("result", {}).get("content", [{}])[0].get("text", "{}")
    data = json.loads(content)
    assert data.get("success") is True
    assert "blast_radius_score" in data

    # 4. generate_targeted_test_plan
    status, res = mcp_request("generate_targeted_test_plan", {
        "graph_id": graph_id,
        "changed_paths": ["app/pb_hooks/80_agent_triggers.pb.js"]
    }, token=token)
    assert status == 200
    content = res.get("result", {}).get("content", [{}])[0].get("text", "{}")
    data = json.loads(content)
    assert data.get("success") is True
    assert "target_test_suites" in data

    # 5. get_architecture_metrics
    status, res = mcp_request("get_architecture_metrics", {}, token=token)
    assert status == 200
    content = res.get("result", {}).get("content", [{}])[0].get("text", "{}")
    data = json.loads(content)
    assert data.get("success") is True
    assert "total_graphs" in data
