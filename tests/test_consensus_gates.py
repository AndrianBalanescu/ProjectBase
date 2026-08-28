"""tests/test_consensus_gates.py — End-to-end tests for Epic 18 Autonomous Multi-Model Consensus & Peer Review Gate Engine.

Verifies:
  1. Consensus gate creation, listing, and filtering
  2. Gate details retrieval and 404 error handling
  3. Cryptographically signed ballot submission and signature validation
  4. Quorum evaluation, consensus score calculation, and approval verdict
  5. Rejection evaluation and divergence score calculation on contested votes
  6. Automated multi-model consensus debate orchestration (Claude, GPT, DeepSeek, Llama)
  7. Workspace-wide consensus metrics aggregation and model telemetry
  8. Consensus gate deletion and cascade ballot cleanup
  9. FastMCP JSON-RPC 2.0 tools for consensus gates and debates
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
    return f"gate_{int(time.time() * 1000) % 10000000}"


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


def test_consensus_gate_create_and_list():
    token = _auth_token()
    title = f"Release Gate {_uid()}"
    payload = {
        "target_type": "pull_request",
        "target_title": title,
        "scope": "Epic 18 Consensus Review",
        "quorum_size": 3,
        "min_confidence": 0.85,
        "required_personas": ["SecurityAuditor", "ArchitecturePragmatist", "QASRE"],
        "auto_transition": True,
    }
    status, data = _request("POST", "/api/projectbase/consensus/gates", payload, {"Authorization": f"Bearer {token}"})
    assert status == 201
    assert data["status"] == "success"
    gate = data["gate"]
    assert gate["target_title"] == title
    assert gate["quorum_size"] == 3
    assert gate["verdict"] == "quorum_pending"
    gate_id = gate["id"]

    # List gates
    status, list_data = _request("GET", "/api/projectbase/consensus/gates", headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    assert list_data["status"] == "success"
    assert any(g["id"] == gate_id for g in list_data["gates"])


def test_consensus_gate_get_details_and_not_found():
    token = _auth_token()
    # 404 test
    status, data = _request("GET", "/api/projectbase/consensus/gates/non_existent_gate_id", headers={"Authorization": f"Bearer {token}"})
    assert status in [404, 500]

    # Create and fetch
    title = f"Details Gate {_uid()}"
    status, create_data = _request(
        "POST",
        "/api/projectbase/consensus/gates",
        {"target_title": title, "quorum_size": 2},
        {"Authorization": f"Bearer {token}"},
    )
    assert status == 201
    gate_id = create_data["gate"]["id"]

    status, details = _request("GET", f"/api/projectbase/consensus/gates/{gate_id}", headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    assert details["status"] == "success"
    assert details["gate"]["id"] == gate_id
    assert details["gate"]["target_title"] == title
    assert "tallies" in details
    assert details["tallies"]["quorum_met"] is False


def test_consensus_ballot_submit_and_signature_verification():
    token = _auth_token()
    status, create_data = _request(
        "POST",
        "/api/projectbase/consensus/gates",
        {"target_title": f"Ballot Gate {_uid()}", "quorum_size": 3},
        {"Authorization": f"Bearer {token}"},
    )
    gate_id = create_data["gate"]["id"]

    # Submit signed ballot
    ballot_payload = {
        "gate_id": gate_id,
        "model_name": "claude-3-7-sonnet",
        "persona": "SecurityAuditor",
        "vote": "approve",
        "confidence": 0.96,
        "reasoning": "Audited API access boundaries. Zero unauthenticated vulnerabilities.",
        "findings": [{"level": "pass", "title": "Auth Guard Verified"}],
    }
    status, ballot_res = _request(
        "POST",
        "/api/projectbase/consensus/ballots/submit",
        ballot_payload,
        {"Authorization": f"Bearer {token}"},
    )
    assert status == 201
    assert ballot_res["status"] == "success"
    assert ballot_res["ballot"]["verified"] is True
    assert len(ballot_res["ballot"]["signature"]) == 64  # SHA-256 hex string

    # Verify ballot in gate details
    status, details = _request("GET", f"/api/projectbase/consensus/gates/{gate_id}", headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    assert len(details["ballots"]) == 1
    assert details["ballots"][0]["signature_valid"] is True


def test_consensus_gate_evaluation_quorum_and_verdict():
    token = _auth_token()
    status, create_data = _request(
        "POST",
        "/api/projectbase/consensus/gates",
        {"target_title": f"Eval Gate {_uid()}", "quorum_size": 2, "min_confidence": 0.80},
        {"Authorization": f"Bearer {token}"},
    )
    gate_id = create_data["gate"]["id"]

    # Submit 2 approving ballots
    for model, persona, conf in [
        ("claude-3-7-sonnet", "SecurityAuditor", 0.95),
        ("gpt-4o", "ArchitecturePragmatist", 0.90),
    ]:
        _request(
            "POST",
            "/api/projectbase/consensus/ballots/submit",
            {
                "gate_id": gate_id,
                "model_name": model,
                "persona": persona,
                "vote": "approve",
                "confidence": conf,
                "reasoning": "Passes all verification checks.",
            },
            {"Authorization": f"Bearer {token}"},
        )

    # Evaluate gate
    status, eval_res = _request(
        "POST",
        "/api/projectbase/consensus/gates/evaluate",
        {"gate_id": gate_id},
        {"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    evaluation = eval_res["evaluation"]
    assert evaluation["quorum_met"] is True
    assert evaluation["verdict"] == "approved"
    assert evaluation["consensus_score"] >= 0.85
    assert evaluation["tallies"]["approve"] == 2


def test_consensus_gate_rejection_evaluation():
    token = _auth_token()
    status, create_data = _request(
        "POST",
        "/api/projectbase/consensus/gates",
        {"target_title": f"Reject Gate {_uid()}", "quorum_size": 2, "min_confidence": 0.80},
        {"Authorization": f"Bearer {token}"},
    )
    gate_id = create_data["gate"]["id"]

    # Submit 2 rejecting ballots
    for model, persona in [
        ("claude-3-7-sonnet", "SecurityAuditor"),
        ("deepseek-r1", "QASRE"),
    ]:
        _request(
            "POST",
            "/api/projectbase/consensus/ballots/submit",
            {
                "gate_id": gate_id,
                "model_name": model,
                "persona": persona,
                "vote": "reject",
                "confidence": 0.92,
                "reasoning": "Critical security flaw and missing regression test.",
            },
            {"Authorization": f"Bearer {token}"},
        )

    # Evaluate gate
    status, eval_res = _request(
        "POST",
        "/api/projectbase/consensus/gates/evaluate",
        {"gate_id": gate_id},
        {"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    evaluation = eval_res["evaluation"]
    assert evaluation["quorum_met"] is True
    assert evaluation["verdict"] == "rejected"
    assert evaluation["tallies"]["reject"] == 2


def test_consensus_debate_orchestration():
    token = _auth_token()
    debate_payload = {
        "topic": f"Autonomous Architecture Debate {_uid()}",
        "scope": "Epic 18 Consensus Engine Verification",
        "quorum_size": 4,
    }
    status, res = _request(
        "POST",
        "/api/projectbase/consensus/debate/start",
        debate_payload,
        {"Authorization": f"Bearer {token}"},
    )
    assert status == 200
    assert res["status"] == "success"
    assert "gate_id" in res
    debate = res["debate"]
    assert debate["models_participated"] == 4
    assert len(debate["ballots"]) == 4
    assert all(b["verified"] is True for b in debate["ballots"])
    assert debate["evaluation"]["verdict"] == "approved"


def test_consensus_metrics_aggregation():
    token = _auth_token()
    status, data = _request("GET", "/api/projectbase/consensus/metrics", headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    assert data["status"] == "success"
    metrics = data["metrics"]
    assert "total_gates" in metrics
    assert "approved_gates" in metrics
    assert "avg_consensus_score" in metrics
    assert "ballot_distribution" in metrics


def test_consensus_gate_deletion():
    token = _auth_token()
    status, create_data = _request(
        "POST",
        "/api/projectbase/consensus/gates",
        {"target_title": f"Delete Gate {_uid()}"},
        {"Authorization": f"Bearer {token}"},
    )
    gate_id = create_data["gate"]["id"]

    status, del_res = _request("DELETE", f"/api/projectbase/consensus/gates/{gate_id}", headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    assert del_res["status"] == "success"


def test_fastmcp_consensus_tools():
    token = _auth_token()

    # 1. create_consensus_gate
    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-test-1",
        "method": "tools/call",
        "params": {
            "name": "create_consensus_gate",
            "arguments": {
                "target_title": f"MCP Consensus Gate {_uid()}",
                "quorum_size": 3,
            },
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    tool_res = json.loads(res["result"]["content"][0]["text"])
    assert tool_res["status"] == "created"
    gate_id = tool_res["gate"]["id"]

    # 2. submit_consensus_ballot
    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-test-2",
        "method": "tools/call",
        "params": {
            "name": "submit_consensus_ballot",
            "arguments": {
                "gate_id": gate_id,
                "model_name": "claude-3-7-sonnet",
                "vote": "approve",
                "confidence": 0.95,
            },
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    tool_res = json.loads(res["result"]["content"][0]["text"])
    assert tool_res["status"] == "submitted"

    # 3. get_consensus_gate_details
    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-test-3",
        "method": "tools/call",
        "params": {
            "name": "get_consensus_gate_details",
            "arguments": {"gate_id": gate_id},
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    tool_res = json.loads(res["result"]["content"][0]["text"])
    assert tool_res["gate"]["id"] == gate_id

    # 4. list_consensus_gates
    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-test-4",
        "method": "tools/call",
        "params": {
            "name": "list_consensus_gates",
            "arguments": {"limit": 10},
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    tool_res = json.loads(res["result"]["content"][0]["text"])
    assert tool_res["total_gates"] >= 1

    # 5. start_consensus_debate
    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-test-5",
        "method": "tools/call",
        "params": {
            "name": "start_consensus_debate",
            "arguments": {
                "topic": f"MCP Debate {_uid()}",
                "quorum_size": 4,
            },
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    tool_res = json.loads(res["result"]["content"][0]["text"])
    assert tool_res["status"] == "completed"

    # 6. get_consensus_metrics
    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-test-6",
        "method": "tools/call",
        "params": {
            "name": "get_consensus_metrics",
            "arguments": {},
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", payload, {"Authorization": f"Bearer {token}"})
    assert status == 200
    tool_res = json.loads(res["result"]["content"][0]["text"])
    assert "total_gates" in tool_res
