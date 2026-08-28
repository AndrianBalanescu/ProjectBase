"""tests/test_swarm_dag.py — Autonomous Swarm Choreography, Task Graph DAG Execution & Checkpoints.

Validates Epic 10 features:
1. Task Graph DAG decomposition with persona roles, dependency relations, and cycle rejection.
2. Topological DAG status evaluation, ready/blocked node calculations, and completion tracking.
3. Automated DAG step execution with lease acquisition and persona filtering.
4. Subtask checklist dynamic splitting with persona assignment.
5. Automated peer-review and validation checkpoints with quality gate aggregation.
6. FastMCP JSON-RPC 2.0 tools and Python FastMCP wrapper functions.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


def _uid():
    return f"t{int(time.time() * 1000) % 10000000}"


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
            return e.code, {"raw": raw}


def _superuser_token():
    status, res = _request("POST", "/api/collections/_superusers/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    if status == 200 and "token" in res:
        return res["token"]
    status, res = _request("POST", "/api/collections/users/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    assert status == 200, f"Failed superuser login: {res}"
    return res["token"]


def _authed_json(method, path, body=None):
    token = _superuser_token()
    return _request(method, path, body, headers={"Authorization": token})


def _first_project_id():
    token = _superuser_token()
    status, res = _request("GET", "/api/collections/projects/records?perPage=1", headers={"Authorization": token})
    assert status == 200 and res.get("items"), "Expected at least 1 project"
    return res["items"][0]["id"]


def _clean_issue_and_children(parent_id):
    token = _superuser_token()
    # Delete child issues first
    st, children = _authed_json("GET", f"/api/collections/issues/records?filter=(parent_issue='{parent_id}')&perPage=500")
    if st == 200:
        for c in children.get("items", []):
            _request("DELETE", f"/api/collections/issues/records/{c['id']}", headers={"Authorization": token})
    _request("DELETE", f"/api/collections/issues/records/{parent_id}", headers={"Authorization": token})


def test_dag_decomposition_and_cycle_rejection():
    """Verify DAG decomposition creates child issues, wires relations, and rejects cycles."""
    pid = _first_project_id()
    token = _superuser_token()

    # Create parent issue
    st, parent = _authed_json("POST", "/api/collections/issues/records", {
        "project": pid,
        "title": f"Parent Epic {_uid()}",
        "status": "todo",
        "description": "High-level goal requiring swarm decomposition"
    })
    assert st == 200
    parent_id = parent["id"]
    parent_ident = parent["identifier"]

    try:
        # 1. Test cyclic dependency rejection
        cyclic_nodes = [
            {"key": "a", "title": "Task A", "persona": "architect", "depends_on": ["b"]},
            {"key": "b", "title": "Task B", "persona": "coder", "depends_on": ["a"]}
        ]
        st, res_cyclic = _authed_json("POST", "/api/projectbase/dag/decompose", {
            "parent_issue": parent_id,
            "nodes": cyclic_nodes
        })
        assert st == 400
        assert "cyclic" in res_cyclic.get("error", "").lower()

        # 2. Test valid acyclic DAG decomposition: spec -> (backend + frontend) -> qa -> review
        valid_nodes = [
            {"key": "spec", "title": "Architecture Spec", "persona": "architect", "estimate": 2, "depends_on": []},
            {"key": "backend", "title": "Backend API", "persona": "coder", "estimate": 5, "depends_on": ["spec"]},
            {"key": "frontend", "title": "Frontend UI", "persona": "frontend", "estimate": 3, "depends_on": ["spec"]},
            {"key": "qa", "title": "E2E Testing", "persona": "qa", "estimate": 2, "depends_on": ["backend", "frontend"]},
            {"key": "review", "title": "Final Peer Review", "persona": "reviewer", "estimate": 1, "depends_on": ["qa"]}
        ]
        st, res_dag = _authed_json("POST", "/api/projectbase/dag/decompose", {
            "parent_issue": parent_ident,
            "nodes": valid_nodes
        })
        assert st == 200
        assert res_dag.get("success") is True
        assert res_dag.get("total_nodes") == 5
        created_nodes = res_dag.get("nodes", [])
        assert len(created_nodes) == 5

        # Check nodes are created with parent_issue and personas
        node_map = {n["key"]: n for n in created_nodes}
        assert node_map["spec"]["persona"] == "architect"
        assert node_map["backend"]["persona"] == "coder"
        assert node_map["frontend"]["persona"] == "frontend"
        assert node_map["qa"]["persona"] == "qa"
        assert node_map["review"]["persona"] == "reviewer"

        # Verify child issue relations in database
        st, be_issue = _authed_json("GET", f"/api/collections/issues/records/{node_map['backend']['id']}")
        assert st == 200
        assert be_issue.get("parent_issue") == parent_id
        be_rels = be_issue.get("relations") or []
        # Backend should have blocked_by spec
        spec_id = node_map["spec"]["id"]
        assert any(r.get("issue") == spec_id and r.get("type") == "blocked_by" for r in be_rels)

    finally:
        # Cleanup
        _clean_issue_and_children(parent_id)


def test_dag_status_and_topological_unblocking():
    """Verify DAG status computes ready vs blocked nodes and updates dynamically upon task completion."""
    pid = _first_project_id()
    token = _superuser_token()

    st, parent = _authed_json("POST", "/api/collections/issues/records", {
        "project": pid, "title": f"DAG Execution Test {_uid()}", "status": "todo"
    })
    assert st == 200
    parent_id = parent["id"]

    try:
        nodes = [
            {"key": "step1", "title": "Step 1 Foundation", "persona": "architect", "depends_on": []},
            {"key": "step2", "title": "Step 2 Feature", "persona": "coder", "depends_on": ["step1"]},
            {"key": "step3", "title": "Step 3 QA", "persona": "qa", "depends_on": ["step2"]}
        ]
        st, res_dag = _authed_json("POST", "/api/projectbase/dag/decompose", {
            "parent_issue": parent_id,
            "nodes": nodes
        })
        assert st == 200
        node_map = {n["key"]: n for n in res_dag["nodes"]}

        # 1. Initial status: only step1 should be ready; step2 and step3 blocked
        st, status1 = _authed_json("GET", f"/api/projectbase/dag/status?issue_id={parent_id}")
        assert st == 200
        assert status1["total_nodes"] == 3
        assert status1["completed_nodes"] == 0
        assert status1["progress_percent"] == 0
        assert status1["is_dag_completed"] is False
        assert node_map["step1"]["identifier"] in status1["ready_to_execute"]
        assert node_map["step2"]["identifier"] in status1["blocked"]
        assert node_map["step3"]["identifier"] in status1["blocked"]

        # 2. Complete step1
        st, _ = _authed_json("PATCH", f"/api/collections/issues/records/{node_map['step1']['id']}", {
            "status": "done"
        })
        assert st == 200

        # Now step2 should be ready_to_execute; step3 remains blocked
        st, status2 = _authed_json("GET", f"/api/projectbase/dag/status?issue_id={parent_id}")
        assert st == 200
        assert status2["completed_nodes"] == 1
        assert status2["progress_percent"] == 33
        assert node_map["step2"]["identifier"] in status2["ready_to_execute"]
        assert node_map["step3"]["identifier"] in status2["blocked"]

        # 3. Complete step2 and step3
        _authed_json("PATCH", f"/api/collections/issues/records/{node_map['step2']['id']}", {"status": "done"})
        _authed_json("PATCH", f"/api/collections/issues/records/{node_map['step3']['id']}", {"status": "done"})

        st, status3 = _authed_json("GET", f"/api/projectbase/dag/status?issue_id={parent_id}")
        assert st == 200
        assert status3["completed_nodes"] == 3
        assert status3["progress_percent"] == 100
        assert status3["is_dag_completed"] is True
        assert len(status3["ready_to_execute"]) == 0
        assert len(status3["blocked"]) == 0

    finally:
        _clean_issue_and_children(parent_id)


def test_dag_step_advancement_and_lease_claim():
    """Verify execute_dag_step advances execution, claims a lease, and handles persona filters."""
    pid = _first_project_id()
    token = _superuser_token()

    st, parent = _authed_json("POST", "/api/collections/issues/records", {
        "project": pid, "title": f"DAG Step Test {_uid()}", "status": "todo"
    })
    assert st == 200
    parent_id = parent["id"]

    try:
        nodes = [
            {"key": "arch", "title": "Arch Design", "persona": "architect", "depends_on": []},
            {"key": "code", "title": "Coding Task", "persona": "coder", "depends_on": []},
            {"key": "qa", "title": "Verify Task", "persona": "qa", "depends_on": ["code"]}
        ]
        st, res_dag = _authed_json("POST", "/api/projectbase/dag/decompose", {
            "parent_issue": parent_id,
            "nodes": nodes
        })
        assert st == 200

        # Step 1: Advance DAG step specifically requesting "coder" persona
        st, step1 = _authed_json("POST", "/api/projectbase/dag/step", {
            "parent_issue": parent_id,
            "agent_name": "CoderBot",
            "persona": "coder"
        })
        assert st == 200
        assert step1["success"] is True
        assert step1["node"]["persona"] == "coder"
        assert step1["node"]["status"] == "in_progress"
        assert step1["node"]["assignee"] == "CoderBot"

        # Check lease was created for CoderBot
        claimed_id = step1["node"]["id"]
        st, lease_check = _authed_json("GET", f"/api/collections/task_leases/records?filter=(issue='{claimed_id}')")
        assert st == 200
        assert len(lease_check.get("items", [])) > 0
        assert lease_check["items"][0]["agent_name"] == "CoderBot"

        # Step 2: Next step for "architect"
        st, step2 = _authed_json("POST", "/api/projectbase/dag/step", {
            "parent_issue": parent_id,
            "agent_name": "ArchBot",
            "persona": "architect"
        })
        assert st == 200
        assert step2["success"] is True
        assert step2["node"]["persona"] == "architect"

        # Step 3: No more unblocked/unleased nodes ready (QA is blocked by code)
        st, step3 = _authed_json("POST", "/api/projectbase/dag/step", {
            "parent_issue": parent_id,
            "agent_name": "AnyBot"
        })
        assert st == 200
        assert step3["node"] is None

    finally:
        _clean_issue_and_children(parent_id)


def test_subtask_splitting_with_personas():
    """Verify dynamically splitting subtasks checklist with persona assignments."""
    pid = _first_project_id()
    token = _superuser_token()

    st, issue = _authed_json("POST", "/api/collections/issues/records", {
        "project": pid, "title": f"Subtask Split Test {_uid()}", "status": "todo"
    })
    assert st == 200
    iid = issue["id"]

    try:
        subtasks_data = [
            {"title": "Schema migration", "persona": "backend", "estimate": 2},
            {"title": "Vue component UI", "persona": "frontend", "estimate": 3},
            {"title": "Unit & e2e tests", "persona": "qa", "estimate": 1}
        ]
        st, res = _authed_json("POST", "/api/projectbase/tasks/split", {
            "issue_id": iid,
            "subtasks": subtasks_data
        })
        assert st == 200
        assert res.get("success") is True
        assert res.get("subtasks_count") == 3
        items = res.get("subtasks", [])
        assert items[0]["persona"] == "backend"
        assert items[1]["persona"] == "frontend"
        assert items[2]["persona"] == "qa"
        assert items[0]["order"] == 1

        # Verify persisted on issue
        st, fetched = _authed_json("GET", f"/api/collections/issues/records/{iid}")
        assert st == 200
        persisted_subtasks = fetched.get("subtasks") or []
        assert len(persisted_subtasks) == 3

    finally:
        _request("DELETE", f"/api/collections/issues/records/{iid}", headers={"Authorization": token})


def test_validation_checkpoints_lifecycle():
    """Verify validation checkpoints submission, gate aggregation, and review comments."""
    pid = _first_project_id()
    token = _superuser_token()

    st, issue = _authed_json("POST", "/api/collections/issues/records", {
        "project": pid, "title": f"Checkpoint Test {_uid()}", "status": "in_review"
    })
    assert st == 200
    iid = issue["id"]

    try:
        # 1. Submit failed security review checkpoint
        st, cp1 = _authed_json("POST", "/api/projectbase/checkpoints/submit", {
            "issue_id": iid,
            "agent_name": "SecuritySentinel",
            "persona": "security",
            "checkpoint_type": "security_scan",
            "status": "failed",
            "notes": "Found unescaped user input in query",
            "artifacts": {"cve": "none", "severity": "medium"}
        })
        assert st == 200
        assert cp1["success"] is True
        assert cp1["gate_passed"] is False

        # Verify comment was automatically posted on the issue
        st, comments = _authed_json("GET", f"/api/collections/comments/records?filter=(issue='{iid}')")
        assert st == 200
        assert any("Validation Checkpoint: security_scan" in c.get("content", "") for c in comments.get("items", []))

        # 2. Check gate status: all_passed should be False
        st, gate1 = _authed_json("GET", f"/api/projectbase/checkpoints?issue_id={iid}")
        assert st == 200
        assert gate1["all_passed"] is False
        assert gate1["failed_count"] == 1

        # 3. Fix issue and submit passed checkpoints
        st, cp2 = _authed_json("POST", "/api/projectbase/checkpoints/submit", {
            "issue_id": iid,
            "agent_name": "SecuritySentinel",
            "persona": "security",
            "checkpoint_type": "security_scan",
            "status": "passed",
            "notes": "Sanitization verified clean"
        })
        assert st == 200
        assert cp2["gate_passed"] is True

        st, cp3 = _authed_json("POST", "/api/projectbase/checkpoints/submit", {
            "issue_id": iid,
            "agent_name": "QABot",
            "persona": "qa",
            "checkpoint_type": "unit_test",
            "status": "passed",
            "notes": "100% tests passing"
        })
        assert st == 200

        # Query all checkpoints
        st, gate2 = _authed_json("GET", f"/api/projectbase/checkpoints?issue_id={iid}")
        assert st == 200
        assert gate2["total_checkpoints"] == 3
        assert gate2["passed_count"] == 2

    finally:
        _request("DELETE", f"/api/collections/issues/records/{iid}", headers={"Authorization": token})


def test_fastmcp_swarm_dag_and_checkpoint_tools():
    """Verify FastMCP JSON-RPC 2.0 endpoint executes DAG and checkpoint tools."""
    token = _superuser_token()
    headers = {"Authorization": token, "Content-Type": "application/json"}
    pid = _first_project_id()

    st, parent = _authed_json("POST", "/api/collections/issues/records", {
        "project": pid, "title": f"FastMCP DAG {_uid()}", "status": "todo"
    })
    assert st == 200
    parent_id = parent["id"]

    try:
        # 1. tools/list contains all Epic 10 tools
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1
        }, headers=headers)
        assert st == 200
        tools = res.get("result", {}).get("tools", [])
        tool_names = {t["name"] for t in tools}
        for expected in [
            "decompose_task_graph", "get_dag_status", "execute_dag_step",
            "split_subtasks", "submit_validation_checkpoint", "get_validation_checkpoints"
        ]:
            assert expected in tool_names, f"Expected {expected} in MCP tools list"

        # 2. tools/call decompose_task_graph
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "decompose_task_graph",
                "arguments": {
                    "parent_issue": parent_id,
                    "nodes": [
                        {"key": "t1", "title": "Task 1 Spec", "persona": "architect", "depends_on": []},
                        {"key": "t2", "title": "Task 2 Build", "persona": "coder", "depends_on": ["t1"]}
                    ]
                }
            },
            "id": 2
        }, headers=headers)
        assert st == 200
        decomp_data = json.loads(res["result"]["content"][0]["text"])
        assert decomp_data.get("success") is True
        assert decomp_data.get("total_nodes") == 2

        # 3. tools/call get_dag_status
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "get_dag_status",
                "arguments": {"issue_id": parent_id}
            },
            "id": 3
        }, headers=headers)
        assert st == 200
        status_data = json.loads(res["result"]["content"][0]["text"])
        assert status_data.get("total_nodes") == 2
        assert len(status_data.get("ready_to_execute", [])) == 1

        # 4. tools/call execute_dag_step
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "execute_dag_step",
                "arguments": {
                    "parent_issue": parent_id,
                    "agent_name": "MCP Worker",
                    "persona": "architect"
                }
            },
            "id": 4
        }, headers=headers)
        assert st == 200
        step_data = json.loads(res["result"]["content"][0]["text"])
        assert step_data.get("success") is True
        assert step_data.get("node", {}).get("persona") == "architect"

        # 5. tools/call submit_validation_checkpoint
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "submit_validation_checkpoint",
                "arguments": {
                    "issue_id": parent_id,
                    "agent_name": "PeerReviewer",
                    "checkpoint_type": "peer_review",
                    "status": "passed",
                    "notes": "Looks solid"
                }
            },
            "id": 5
        }, headers=headers)
        assert st == 200
        cp_data = json.loads(res["result"]["content"][0]["text"])
        assert cp_data.get("success") is True
        assert cp_data.get("gate_passed") is True

        # 6. tools/call get_validation_checkpoints
        st, res = _request("POST", "/api/projectbase/mcp", {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "get_validation_checkpoints",
                "arguments": {"issue_id": parent_id}
            },
            "id": 6
        }, headers=headers)
        assert st == 200
        get_cp_data = json.loads(res["result"]["content"][0]["text"])
        assert get_cp_data.get("total_checkpoints") >= 1
        assert get_cp_data.get("all_passed") is True

    finally:
        _clean_issue_and_children(parent_id)


def test_mcp_server_python_swarm_dag_wrappers():
    """Verify python fastmcp wrappers in scripts/mcp_server.py for swarm DAG & checkpoints."""
    mcp_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "mcp_server.py")
    assert os.path.isfile(mcp_path)

    import types as _types
    stub = _types.ModuleType("fastmcp")
    stub.FastMCP = lambda name: _types.SimpleNamespace(tool=lambda *a, **k: (a[0] if a else (lambda f: f)))
    import sys as _sys
    _sys.modules["fastmcp"] = stub
    import importlib.util
    spec = importlib.util.spec_from_file_location("mcp_server_dag", mcp_path)
    mcp_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp_mod)
    mcp_mod.BASE_URL = BASE_URL
    mcp_mod.AUTH_EMAIL = SUPERUSER_EMAIL
    mcp_mod.AUTH_PASSWORD = SUPERUSER_PASSWORD
    mcp_mod.AUTH_TOKEN = ""

    pid = _first_project_id()
    token = _superuser_token()
    st, parent = _authed_json("POST", "/api/collections/issues/records", {
        "project": pid, "title": f"PyMCP DAG {_uid()}", "status": "todo"
    })
    assert st == 200
    parent_id = parent["id"]
    ident = parent["identifier"]

    try:
        # decompose_task_graph
        nodes = [
            {"key": "p1", "title": "Py Task 1", "persona": "architect", "depends_on": []},
            {"key": "p2", "title": "Py Task 2", "persona": "coder", "depends_on": ["p1"]}
        ]
        res_decomp = mcp_mod.decompose_task_graph(ident, nodes)
        assert res_decomp.get("success") is True
        assert res_decomp.get("total_nodes") == 2

        # get_dag_status
        dag_st = mcp_mod.get_dag_status(ident)
        assert dag_st.get("total_nodes") == 2

        # execute_dag_step
        step_res = mcp_mod.execute_dag_step(ident, agent_name="PyWorker", persona="architect")
        assert step_res.get("success") is True
        assert step_res.get("node", {}).get("persona") == "architect"

        # split_subtasks
        split_res = mcp_mod.split_subtasks(ident, [
            {"title": "Sub A", "persona": "backend", "estimate": 1}
        ])
        assert split_res.get("success") is True
        assert split_res.get("subtasks_count") == 1

        # submit_validation_checkpoint
        cp_res = mcp_mod.submit_validation_checkpoint(
            ident,
            agent_name="PyTester",
            checkpoint_type="unit_test",
            status="passed",
            notes="PyMCP Test Pass"
        )
        assert cp_res.get("success") is True
        assert cp_res.get("gate_passed") is True

        # get_validation_checkpoints
        cp_list = mcp_mod.get_validation_checkpoints(ident)
        assert cp_list.get("total_checkpoints") >= 1
        assert cp_list.get("all_passed") is True

    finally:
        _clean_issue_and_children(parent_id)
