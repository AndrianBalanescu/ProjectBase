"""
Unit and Integration Tests for ProjectBase Hook 116 & FastMCP Tools:
Autonomous Agent Knowledge Graph, Architectural Memory Index & Invariant Compliance Engine (Milestone 11 / Epic 32 / v1.31.0).
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


class TestKnowledgeGraphEngine:

    @pytest.fixture(autouse=True)
    def setup_token(self):
        self.token = get_auth_token()

    def test_01_version_endpoint(self):
        status, data = api_request("/api/projectbase/version")
        assert status == 200
        assert data.get("service") == "ProjectBase"
        assert "version" in data

    def test_02_seed_demo_knowledge_graph(self):
        status, data = api_request("/api/projectbase/knowledge/seed-demo", method="POST", body={}, token=self.token)
        assert status == 200
        assert data.get("success") is True

    def test_03_list_knowledge_nodes_and_adrs(self):
        status, data = api_request("/api/projectbase/knowledge/nodes?limit=500", token=self.token)
        assert status == 200
        items = data.get("items", [])
        assert len(items) >= 4
        
        # Verify ADR-001 exists
        adrs = [i for i in items if i.get("kind") == "adr"]
        assert len(adrs) >= 4
        titles = [a["title"] for a in adrs]
        assert any("Zero-Build Vue 3" in t for t in titles)

    def test_04_create_and_inspect_knowledge_node(self):
        node_payload = {
            "title": "Invariant: Strict Sub-50MB Memory Budget",
            "slug": "inv-strict-memory-budget",
            "kind": "invariant",
            "summary": "Every server daemon and hook must not exceed 50MB RSS memory ceiling.",
            "content_markdown": "# Memory Budget\nEnsures instant responsiveness and edge portability.",
            "file_path": "pocketbase",
            "symbol_name": "serve",
            "status": "active",
            "confidence_score": 0.98,
            "author_agent": "flomaster",
            "tags_json": ["performance", "memory", "budget"]
        }
        status, res = api_request("/api/projectbase/knowledge/nodes", method="POST", body=node_payload, token=self.token)
        assert status == 201
        assert res.get("success") is True
        node_id = res["node"]["id"]

        # Inspect details
        status, details = api_request(f"/api/projectbase/knowledge/nodes/{node_id}", token=self.token)
        assert status == 200
        assert details["node"]["title"] == "Invariant: Strict Sub-50MB Memory Budget"
        assert details["node"]["confidence_score"] == 0.98

    def test_05_create_relation_and_get_graph_topology(self):
        # List nodes to get 2 node IDs
        _, nodes_data = api_request("/api/projectbase/knowledge/nodes", token=self.token)
        nodes = nodes_data.get("items", [])
        assert len(nodes) >= 2
        src_id = nodes[0]["id"]
        tgt_id = nodes[1]["id"]

        rel_payload = {
            "source_node_id": src_id,
            "target_node_id": tgt_id,
            "relation_type": "governs",
            "weight": 1.5,
            "description": "Architectural governance constraint"
        }
        status, res = api_request("/api/projectbase/knowledge/relations", method="POST", body=rel_payload, token=self.token)
        assert status == 201
        assert res["relation"]["relation_type"] == "governs"

        # Get full topology
        status, graph = api_request("/api/projectbase/knowledge/graph", token=self.token)
        assert status == 200
        assert "nodes" in graph
        assert "edges" in graph
        assert len(graph["nodes"]) >= 2
        assert len(graph["edges"]) >= 1

    def test_06_architectural_invariants_crud_and_toggle(self):
        inv_payload = {
            "rule_name": "No uncompiled React or JSX assets",
            "rule_type": "path_pattern",
            "pattern_expression": "forbidden:react",
            "severity": "p0_blocking",
            "enforcement_action": "block_merge",
            "is_active": True
        }
        status, res = api_request("/api/projectbase/knowledge/invariants", method="POST", body=inv_payload, token=self.token)
        assert status == 201
        inv_id = res["invariant"]["id"]

        # Toggle inactive
        status, patch_res = api_request(f"/api/projectbase/knowledge/invariants/{inv_id}", method="PATCH", body={"is_active": False}, token=self.token)
        assert status == 200
        assert patch_res["is_active"] is False

        # Toggle back active
        status, patch_res = api_request(f"/api/projectbase/knowledge/invariants/{inv_id}", method="PATCH", body={"is_active": True}, token=self.token)
        assert status == 200
        assert patch_res["is_active"] is True

    def test_07_invariant_verification_clean_pass(self):
        verify_payload = {
            "target_files": [
                "app/pb_public/js/components/CleanComponent.js",
                "app/pb_hooks/117_clean.pb.js",
                "tests/test_clean.py"
            ],
            "diff_summary": "Added standard Vue 3 UMD component with clean SQLite hook",
            "agent_name": "flomaster"
        }
        status, res = api_request("/api/projectbase/knowledge/verify-invariants", method="POST", body=verify_payload, token=self.token)
        assert status == 200
        assert res.get("verdict") == "passed"
        assert res.get("passed") is True
        assert len(res.get("violations", [])) == 0
        assert res.get("total_rules_checked") > 0

    def test_08_invariant_verification_blocking_violation(self):
        verify_payload = {
            "target_files": [
                "app/pb_public/node_modules/lodash/index.js",
                "app/pb_hooks/billing_stripe.pb.js"
            ],
            "diff_summary": "Introduced node_modules and stripe billing integration",
            "agent_name": "flomaster"
        }
        status, res = api_request("/api/projectbase/knowledge/verify-invariants", method="POST", body=verify_payload, token=self.token)
        assert status == 200
        assert res.get("verdict") == "violations_detected"
        assert res.get("passed") is False
        violations = res.get("violations", [])
        assert len(violations) >= 1
        rule_names = [v["rule_name"] for v in violations]
        assert any("node_modules" in r or "Stripe" in r for r in rule_names)

    def test_09_semantic_knowledge_query(self):
        query_payload = {
            "query": "pocketbase sqlite",
            "limit": 5
        }
        status, res = api_request("/api/projectbase/knowledge/query", method="POST", body=query_payload, token=self.token)
        assert status == 200
        results = res.get("results", [])
        assert len(results) >= 1
        assert "relevance_score" in results[0]

    def test_10_knowledge_metrics(self):
        status, data = api_request("/api/projectbase/knowledge/metrics", token=self.token)
        assert status == 200
        assert data.get("total_nodes") >= 4
        assert data.get("active_invariants") >= 3
        assert "pass_rate_percent" in data

    def test_11_fastmcp_knowledge_tools_execution(self):
        # 1. store_architectural_fact via FastMCP JSON-RPC
        mcp_payload = {
            "jsonrpc": "2.0",
            "id": "req-mcp-fact-1",
            "method": "tools/call",
            "params": {
                "name": "store_architectural_fact",
                "arguments": {
                    "title": "ADR-006: Atomic File Writes for Integrity",
                    "kind": "adr",
                    "summary": "Use fs.writeFileSync via atomic temp file replacement",
                    "status": "accepted",
                    "author_agent": "flomaster_mcp"
                }
            }
        }
        status, data = api_request("/api/projectbase/mcp", method="POST", body=mcp_payload, token=self.token)
        assert status == 200
        assert "result" in data
        parsed = json.loads(data["result"]["content"][0]["text"])
        assert parsed["title"] == "ADR-006: Atomic File Writes for Integrity"

        # 2. query_knowledge_graph tool
        mcp_query = {
            "jsonrpc": "2.0",
            "id": "req-mcp-query-1",
            "method": "tools/call",
            "params": {
                "name": "query_knowledge_graph",
                "arguments": {
                    "query": "atomic",
                    "kind": "adr"
                }
            }
        }
        status, data = api_request("/api/projectbase/mcp", method="POST", body=mcp_query, token=self.token)
        assert status == 200
        parsed = json.loads(data["result"]["content"][0]["text"])
        assert parsed["total"] >= 1

        # 3. verify_change_against_invariants tool
        mcp_verify = {
            "jsonrpc": "2.0",
            "id": "req-mcp-verify-1",
            "method": "tools/call",
            "params": {
                "name": "verify_change_against_invariants",
                "arguments": {
                    "target_files": ["app/pb_public/js/components/CleanTest.js"],
                    "diff_summary": "Added component"
                }
            }
        }
        status, data = api_request("/api/projectbase/mcp", method="POST", body=mcp_verify, token=self.token)
        assert status == 200
        parsed = json.loads(data["result"]["content"][0]["text"])
        assert parsed["verdict"] == "passed"
        assert parsed["passed"] is True

        # 4. get_knowledge_graph_metrics tool
        mcp_metrics = {
            "jsonrpc": "2.0",
            "id": "req-mcp-metrics-1",
            "method": "tools/call",
            "params": {
                "name": "get_knowledge_graph_metrics",
                "arguments": {}
            }
        }
        status, data = api_request("/api/projectbase/mcp", method="POST", body=mcp_metrics, token=self.token)
        assert status == 200
        parsed = json.loads(data["result"]["content"][0]["text"])
        assert parsed["total_nodes"] >= 4
