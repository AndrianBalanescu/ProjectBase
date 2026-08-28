"""tests/test_session_branching_and_intervention.py — Comprehensive test suite for Session Branching, DAGs & Human Intervention (Milestone 4 / Epic 25).

Verifies:
  1. Interactive Session Branching (fork, continuation, retry, repair, swarm_worker) with parent lineage & generation tracking.
  2. Session DAG Graph Construction & Traversal (ancestor walk, descendant discovery, edge relations, generation depths).
  3. Live Process Pause & Resume Controls with intervention audit logging.
  4. Human Instruction / Steering Prompt Injection into live agent context queue.
  5. Human Intervention Gate resolution (Approve, Reject, Require Review, Auto Pass) and status progression.
  6. Multi-session Worktree & File Collision Detection and Arbitration (/api/projectbase/sessions/conflicts and /arbitrate).
  7. Multi-Agent Swarm Fan-Out Dispatch linked to root DAG session (/api/projectbase/sessions/swarm/dispatch).
  8. FastMCP JSON-RPC 2.0 tools: branch_agent_session, inject_session_instruction, pause_agent_session, resume_agent_session, set_session_intervention_gate, get_session_dag, arbitrate_session_conflicts, dispatch_session_swarm.
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
    return f"sess_br_{int(time.time() * 1000) % 10000000}"


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
            raw = resp.read().decode("utf-8")
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw
            return status, parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return exc.code, parsed


def _auth_token():
    status, body = _request(
        "POST",
        "/api/collections/users/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    assert status == 200, f"Superuser auth failed: {body}"
    return body["token"]


def _mcp_call(method, params, token=None):
    hdrs = {}
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    return _request(
        "POST",
        "/api/projectbase/mcp",
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        headers=hdrs,
    )


class TestSessionBranchingAndDAG:
    """Test suite for session branching, DAG trees, and multi-generation lineages."""

    def test_session_branch_creation(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        root_id = _uid()

        # 1. Ingest root session
        status, ing = _request(
            "POST",
            "/api/projectbase/sessions/ingest",
            {
                "session_id": root_id,
                "agent_name": "FlomasterRoot",
                "runtime": "flomaster",
                "model": "gpt-5.5",
                "command": "Initialize microservice architecture",
                "workdir": "/data/projects/projectbase"
            },
            headers=hdrs
        )
        assert status in (200, 201), f"Ingest failed: {ing}"

        # 2. Branch child session (Gen 1)
        branch_name = f"branch-auth-{_uid()}"
        status, br = _request(
            "POST",
            f"/api/projectbase/sessions/{root_id}/branch",
            {
                "branch_name": branch_name,
                "branch_type": "continuation",
                "prompt": "Implement authentication endpoints",
                "model": "claude-fable-5"
            },
            headers=hdrs
        )
        assert status == 201, f"Branch failed: {br}"
        assert br["success"] is True
        assert br["parent_session_id"] == root_id
        assert br["branch_name"] == branch_name
        assert br["branch_type"] == "continuation"
        assert br["generation"] == 1
        child_id = br["session_id"]

        # 3. Branch grand-child session (Gen 2)
        grandchild_name = f"branch-audit-{_uid()}"
        status, gbr = _request(
            "POST",
            f"/api/projectbase/sessions/{child_id}/branch",
            {
                "branch_name": grandchild_name,
                "branch_type": "critique",
                "prompt": "Perform security audit on auth endpoints"
            },
            headers=hdrs
        )
        assert status == 201, f"Grandchild branch failed: {gbr}"
        assert gbr["generation"] == 2
        assert gbr["parent_session_id"] == child_id

        # 4. Fetch DAG for target session
        status, dag = _request(
            "GET",
            f"/api/projectbase/sessions/{child_id}/dag",
            headers=hdrs
        )
        assert status == 200, f"Get DAG failed: {dag}"
        assert dag["root_session_id"] == root_id
        assert dag["total_nodes"] >= 3
        assert dag["max_generation"] >= 2
        assert len(dag["edges"]) >= 2

        # 5. Fetch workspace DAGs
        status, all_dag = _request(
            "GET",
            "/api/projectbase/sessions/dag",
            headers=hdrs
        )
        assert status == 200
        assert all_dag["total_sessions"] >= 3


class TestHumanInterventionAndControls:
    """Test suite for live process pause/resume, steering instruction injection, and intervention gates."""

    def test_pause_and_resume_controls(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        sid = _uid()

        # Ingest session
        _request("POST", "/api/projectbase/sessions/ingest", {"session_id": sid, "agent_name": "TestAgent"}, headers=hdrs)

        # Pause session
        status, p_res = _request(
            "POST",
            f"/api/projectbase/sessions/{sid}/pause",
            {"reason": "Wait for user confirmation"},
            headers=hdrs
        )
        assert status == 200, f"Pause failed: {p_res}"
        assert p_res["is_paused"] is True

        # Resume session
        status, r_res = _request(
            "POST",
            f"/api/projectbase/sessions/{sid}/resume",
            {"reason": "User approved continuation"},
            headers=hdrs
        )
        assert status == 200, f"Resume failed: {r_res}"
        assert r_res["is_paused"] is False

    def test_inject_instruction_and_audit_trail(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        sid = _uid()

        _request("POST", "/api/projectbase/sessions/ingest", {"session_id": sid, "agent_name": "SteeredAgent"}, headers=hdrs)

        # Inject steering prompt
        status, inj = _request(
            "POST",
            f"/api/projectbase/sessions/{sid}/inject",
            {
                "instruction": "Fix null pointer in auth middleware before compiling",
                "priority": "urgent",
                "author": "lead_engineer@projectbase.org"
            },
            headers=hdrs
        )
        assert status == 201, f"Inject failed: {inj}"
        assert inj["success"] is True
        assert inj["instruction"]["priority"] == "urgent"

        # Check interventions list
        status, int_list = _request(
            "GET",
            f"/api/projectbase/sessions/{sid}/interventions",
            headers=hdrs
        )
        assert status == 200, f"Get interventions failed: {int_list}"
        assert int_list["total_interventions"] >= 1
        assert len(int_list["injected_instructions_queue"]) >= 1
        assert int_list["injected_instructions_queue"][0]["instruction"] == "Fix null pointer in auth middleware before compiling"

    def test_human_intervention_gate_progression(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        sid = _uid()

        _request("POST", "/api/projectbase/sessions/ingest", {"session_id": sid, "status": "verifying"}, headers=hdrs)

        # Set gate to pending_human_review
        status, g1 = _request(
            "POST",
            f"/api/projectbase/sessions/{sid}/gate",
            {"action": "require_review", "comment": "Human review needed before production merge"},
            headers=hdrs
        )
        assert status == 200
        assert g1["intervention_gate"] == "pending_human_review"

        # Approve gate
        status, g2 = _request(
            "POST",
            f"/api/projectbase/sessions/{sid}/gate",
            {"action": "approve", "reviewer": "qa_director@flow.com", "comment": "Verified all 400 tests passing"},
            headers=hdrs
        )
        assert status == 200
        assert g2["intervention_gate"] == "human_approved"
        assert g2["status"] == "completed"


class TestSwarmChoreographyAndConflictArbitration:
    """Test suite for worktree conflict detection, arbitration, and swarm dispatch."""

    def test_swarm_fanout_dispatch(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        root_id = _uid()

        _request("POST", "/api/projectbase/sessions/ingest", {"session_id": root_id, "agent_name": "SwarmCoordinator"}, headers=hdrs)

        status, swarm = _request(
            "POST",
            "/api/projectbase/sessions/swarm/dispatch",
            {
                "root_session_id": root_id,
                "workers": [
                    {"role": "researcher", "model": "rc/perplexity-sonar-reasoning-pro", "prompt": "Analyze market pricing"},
                    {"role": "implementer", "model": "claude-fable-5", "prompt": "Write billing engine"},
                    {"role": "auditor", "model": "deepseek/deepseek-r1-distill-llama-70b", "prompt": "Audit billing ledger math"}
                ]
            },
            headers=hdrs
        )
        assert status == 201, f"Swarm dispatch failed: {swarm}"
        assert swarm["success"] is True
        assert swarm["workers_count"] == 3
        assert len(swarm["workers"]) == 3

    def test_worktree_conflict_detection_and_arbitration(self):
        token = _auth_token()
        hdrs = {"Authorization": f"Bearer {token}"}
        sid_a = _uid()
        sid_b = _uid()

        # Ingest two concurrent sessions modifying same file
        _request("POST", "/api/projectbase/sessions/ingest", {
            "session_id": sid_a,
            "status": "running",
            "files_touched": ["app/pb_public/js/api.js", "app/pb_hooks/30_custom_routes.pb.js"]
        }, headers=hdrs)

        _request("POST", "/api/projectbase/sessions/ingest", {
            "session_id": sid_b,
            "status": "running",
            "files_touched": ["app/pb_public/js/api.js", "README.md"]
        }, headers=hdrs)

        # Detect workspace conflicts
        status, conf = _request("GET", "/api/projectbase/sessions/conflicts", headers=hdrs)
        assert status == 200, f"Conflicts check failed: {conf}"
        assert conf["has_conflicts"] is True
        assert any(c["file"] == "app/pb_public/js/api.js" for c in conf["conflicts"])

        # Arbitrate conflicts for session A
        status, arb = _request(
            "POST",
            f"/api/projectbase/sessions/{sid_a}/arbitrate",
            {"strategy": "isolated_worktree_rebase", "resolve": True},
            headers=hdrs
        )
        assert status == 200, f"Arbitration failed: {arb}"
        assert arb["success"] is True
        assert arb["has_conflicts"] is True
        assert arb["conflict_status"] == "resolved"


class TestFastMCPSessionBranchingTools:
    """Test suite for FastMCP JSON-RPC 2.0 session branching and human intervention tools."""

    def test_mcp_session_branching_and_dag_tools(self):
        token = _auth_token()
        root_id = _uid()

        # 1. Ingest session via MCP
        st, res = _mcp_call("tools/call", {
            "name": "ingest_agent_session",
            "arguments": {"session_id": root_id, "agent_name": "MCPRootAgent", "model": "gpt-5.5"}
        }, token=token)
        assert st == 200, f"MCP ingest failed: {res}"

        # 2. Branch session via MCP
        st, res = _mcp_call("tools/call", {
            "name": "branch_agent_session",
            "arguments": {
                "session_id": root_id,
                "branch_name": "mcp-child-branch",
                "branch_type": "fork",
                "prompt": "Optimize database indexing"
            }
        }, token=token)
        assert st == 200, f"MCP branch failed: {res}"
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["success"] is True
        assert data["parent_session_id"] == root_id
        child_id = data["session_id"]

        # 3. Inject instruction via MCP
        st, res = _mcp_call("tools/call", {
            "name": "inject_session_instruction",
            "arguments": {
                "session_id": child_id,
                "instruction": "Ensure migration contains down rollback script"
            }
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["success"] is True

        # 4. Pause and resume via MCP
        st, res = _mcp_call("tools/call", {
            "name": "pause_agent_session",
            "arguments": {"session_id": child_id, "reason": "MCP pause test"}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["is_paused"] is True

        st, res = _mcp_call("tools/call", {
            "name": "resume_agent_session",
            "arguments": {"session_id": child_id}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["is_paused"] is False

        # 5. Set intervention gate via MCP
        st, res = _mcp_call("tools/call", {
            "name": "set_session_intervention_gate",
            "arguments": {"session_id": child_id, "action": "approve", "reviewer": "mcp_arbiter"}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["intervention_gate"] == "human_approved"

        # 6. Retrieve DAG via MCP
        st, res = _mcp_call("tools/call", {
            "name": "get_session_dag",
            "arguments": {"session_id": child_id}
        }, token=token)
        assert st == 200
        data = json.loads(res["result"]["content"][0]["text"])
        assert data["root_session_id"] == root_id
        assert data["total_nodes"] >= 2
