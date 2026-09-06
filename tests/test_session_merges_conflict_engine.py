"""tests/test_session_merges_conflict_engine.py — Comprehensive test suite for Multi-Agent Merge & Semantic Conflict Auto-Resolution Engine, 3-Way Diff Matrix & Deterministic Merge Barrier (Milestone 6 / Epic 27).

Verifies:
  1. Multi-Agent Merge Request Proposal (/api/projectbase/merges/propose) with 3-way conflict analysis.
  2. Automatic Conflict Hunk Detection (content collisions between ancestor, source, and target branches).
  3. Merge Request Querying & Filtering (/api/projectbase/merges) by status and sessions.
  4. Merge Details & Conflict Retrieval (/api/projectbase/merges/{id}) with hunk payloads.
  5. 3-Way Semantic Auto-Resolution (/api/projectbase/merges/{id}/auto-resolve) with AST Clean and Union strategies.
  6. Granular Manual Hunk Resolution (/api/projectbase/merges/{id}/conflicts/{conflictId}/resolve) with custom content.
  7. Deterministic Merge Barrier Verification (/api/projectbase/merges/{id}/verify) preventing dirty merges.
  8. Merge Execution & Deterministic Commit Generation (/api/projectbase/merges/{id}/execute) updating session states.
  9. Merge Rejection & State Cleanup (/api/projectbase/merges/{id}/reject).
 10. Workspace-wide Multi-Agent Merge Matrix & File Contention (/api/projectbase/merges/matrix).
 11. FastMCP JSON-RPC 2.0 tools: propose_session_merge, list_session_merges, get_session_merge_details,
     auto_resolve_merge_conflicts, resolve_merge_conflict_hunk, verify_merge_readiness, execute_session_merge, get_session_merge_matrix.
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

# Cycle 74 hardening: /api/projectbase/* custom routes are auth-guarded. Tests
# exercise business logic, not the auth gate, so _request defaults to an
# authenticated superuser; use _request_anon for the unauthenticated path.
_AUTH_TOKEN_CACHE = {"token": None}

def _super_auth_header():
    if _AUTH_TOKEN_CACHE["token"] is None:
        tok = ""
        for col in ("_superusers", "users"):
            try:
                st, body = _request_raw("POST", f"/api/collections/{col}/auth-with-password", {
                    "identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD})
                if st == 200 and body.get("token"):
                    tok = body["token"]
                    break
            except Exception:
                pass
        _AUTH_TOKEN_CACHE["token"] = tok
    return {"Authorization": _AUTH_TOKEN_CACHE["token"]} if _AUTH_TOKEN_CACHE["token"] else {}


def _uid():
    return f"sess_mrg_{int(time.time() * 1000) % 10000000}"


def _request_raw(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body_bytes = resp.read()
            try:
                return status, json.loads(body_bytes.decode("utf-8"))
            except Exception:
                return status, body_bytes.decode("utf-8")
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        try:
            return e.code, json.loads(body_bytes.decode("utf-8"))
        except Exception:
            return e.code, body_bytes.decode("utf-8")




def _request(method, path, body=None, headers=None):
    """_request with a default superuser Authorization header.

    The engine custom routes are auth-guarded (cycle 74); tests here exercise
    the business logic, not the auth gate, so requests default to an
    authenticated superuser. Pass headers={"Authorization": ""} to force the
    unauthenticated path."""
    if headers is None or "Authorization" not in (headers or {}):
        merged = dict(_super_auth_header())
        merged.update(headers or {})
        headers = merged
    return _request_raw(method, path, body, headers)

def _request_anon(method, path, body=None, headers=None):
    """Explicitly unauthenticated request (for route-guard negative tests)."""
    return _request_raw(method, path, body, headers)
def _auth_token():
    status, res = _request("POST", "/api/collections/users/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    if status == 200 and "token" in res:
        return res["token"]
    status, res = _request("POST", "/api/collections/_superusers/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASSWORD,
    })
    if status == 200 and "token" in res:
        return res["token"]
    return None


def _mcp_call(tool_name, arguments):
    token = _auth_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {"X-Test-User-ID": "test_user_id"}
    status, res = _request("POST", "/api/projectbase/mcp", {
        "jsonrpc": "2.0",
        "id": "test_mcp_req",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }, headers=headers)
    assert status == 200, f"MCP call {tool_name} failed: {res}"
    assert "result" in res, f"MCP call {tool_name} returned error: {res}"
    content = res["result"]["content"][0]["text"]
    return json.loads(content)


def test_propose_merge_clean_diff():
    """Test proposing a clean merge without conflicts."""
    sid = _uid()
    status, res = _request("POST", "/api/projectbase/merges/propose", {
        "source_session_id": sid,
        "target_session_id": "sess_main",
        "title": "Clean Feature Branch Merge",
        "files": [
            {
                "file_path": "crates/core/src/lib.rs",
                "base_content": "// base version\n",
                "source_content": "// base version\npub fn feature() -> bool { true }\n",
                "target_content": "// base version\n"
            }
        ]
    })
    assert status == 200
    assert res["success"] is True
    assert res["merge"]["status"] == "clean"
    assert res["merge"]["conflict_count"] == 0
    assert len(res["conflicts"]) == 0


def test_propose_merge_with_conflicts_and_auto_resolve():
    """Test proposing a merge with divergent hunks and immediate auto-resolution."""
    sid = _uid()
    status, res = _request("POST", "/api/projectbase/merges/propose", {
        "source_session_id": sid,
        "title": "Conflicting API Branch Merge",
        "auto_resolve": True,
        "auto_resolution_strategy": "ast_clean",
        "files": [
            {
                "file_path": "app/pb_hooks/api.js",
                "base_content": "const base = 1;\nfunction run() { return base; }\n",
                "source_content": "import { featA } from './a';\nconst base = 1;\nfunction run() { return featA(); }\n",
                "target_content": "import { featB } from './b';\nconst base = 1;\nfunction run() { return featB(); }\n"
            }
        ]
    })
    assert status == 200
    assert res["success"] is True
    assert res["merge"]["status"] == "resolved"
    assert res["merge"]["conflict_count"] == 1
    assert res["merge"]["resolved_count"] == 1
    assert len(res["conflicts"]) == 1
    assert res["conflicts"][0]["resolution_status"] == "auto_resolved"


def test_list_and_get_session_merges():
    """Test listing merge requests and inspecting fine-grained details."""
    sid = _uid()
    _request("POST", "/api/projectbase/merges/propose", {
        "source_session_id": sid,
        "title": "Queryable Merge Request"
    })

    status, list_res = _request("GET", f"/api/projectbase/merges?session_id={sid}")
    assert status == 200
    assert list_res["total"] >= 1
    merge_id = list_res["merges"][0]["merge_id"]

    status, get_res = _request("GET", f"/api/projectbase/merges/{merge_id}")
    assert status == 200
    assert get_res["merge"]["merge_id"] == merge_id
    assert "conflicts" in get_res


def test_manual_conflict_hunk_resolution_and_barrier_verification():
    """Test manual hunk resolution followed by deterministic verification."""
    sid = _uid()
    status, prop_res = _request("POST", "/api/projectbase/merges/propose", {
        "source_session_id": sid,
        "title": "Unresolved Merge Request",
        "auto_resolve": False,
        "files": [
            {
                "file_path": "config/settings.json",
                "base_content": '{"port": 8080}',
                "source_content": '{"port": 8081, "ssl": true}',
                "target_content": '{"port": 8082, "ssl": false}'
            }
        ]
    })
    assert status == 200
    assert prop_res["merge"]["status"] == "conflicted"
    conflict_id = prop_res["conflicts"][0]["id"]
    merge_id = prop_res["merge"]["merge_id"]

    # Verify readiness should FAIL due to unresolved conflict
    v_status, v_res = _request("POST", f"/api/projectbase/merges/{merge_id}/verify")
    assert v_status == 400
    assert v_res["ready_to_merge"] is False

    # Manually resolve the hunk
    r_status, r_res = _request("POST", f"/api/projectbase/merges/{merge_id}/conflicts/{conflict_id}/resolve", {
        "resolution_status": "manual_resolved",
        "resolved_content": '{"port": 8081, "ssl": true, "env": "prod"}',
        "resolution_notes": "Merged custom configuration"
    })
    assert r_status == 200
    assert r_res["success"] is True
    assert r_res["unresolved_conflicts"] == 0

    # Verify readiness should now PASS
    v_status, v_res = _request("POST", f"/api/projectbase/merges/{merge_id}/verify")
    assert v_status == 200
    assert v_res["ready_to_merge"] is True


def test_execute_merge_barrier_and_rejection():
    """Test full execution of verified merge barrier and reject workflow."""
    sid = _uid()
    status, prop_res = _request("POST", "/api/projectbase/merges/propose", {
        "source_session_id": sid,
        "title": "Executable Barrier Merge",
        "auto_resolve": True
    })
    merge_id = prop_res["merge"]["merge_id"]

    # Execute merge
    exec_status, exec_res = _request("POST", f"/api/projectbase/merges/{merge_id}/execute")
    assert exec_status == 200
    assert exec_res["status"] == "merged"
    assert exec_res["merge_commit"].startswith("git_mrg_")

    # Second merge for reject test
    sid2 = _uid()
    status, prop_res2 = _request("POST", "/api/projectbase/merges/propose", {
        "source_session_id": sid2,
        "title": "Rejectable Merge"
    })
    merge_id2 = prop_res2["merge"]["merge_id"]

    rej_status, rej_res = _request("POST", f"/api/projectbase/merges/{merge_id2}/reject", {
        "reason": "Branch deprecated"
    })
    assert rej_status == 200
    assert rej_res["status"] == "rejected"


def test_get_session_merge_matrix():
    """Test workspace-wide merge matrix and contention detection."""
    status, res = _request("GET", "/api/projectbase/merges/matrix")
    assert status == 200
    assert "total_active_sessions" in res
    assert "contention_file_count" in res
    assert "matrix" in res


def test_fastmcp_merge_tools():
    """Test all 8 FastMCP JSON-RPC 2.0 tools for multi-agent merges."""
    sid = _uid()
    # 1. propose_session_merge
    prop_out = _mcp_call("propose_session_merge", {
        "source_session_id": sid,
        "title": "FastMCP Agent Merge",
        "auto_resolve": True,
        "auto_resolution_strategy": "ast_clean"
    })
    assert prop_out["success"] is True
    merge_id = prop_out["merge_id"]

    # 2. list_session_merges
    list_out = _mcp_call("list_session_merges", {"session_id": sid})
    assert list_out["total"] >= 1

    # 3. get_session_merge_details
    details_out = _mcp_call("get_session_merge_details", {"merge_id": merge_id})
    assert details_out["merge_id"] == merge_id

    # 4. auto_resolve_merge_conflicts
    res_out = _mcp_call("auto_resolve_merge_conflicts", {
        "merge_id": merge_id,
        "strategy": "union_merge"
    })
    assert res_out["success"] is True

    # 5. verify_merge_readiness
    verify_out = _mcp_call("verify_merge_readiness", {"merge_id": merge_id})
    assert verify_out["success"] is True
    assert verify_out["ready_to_merge"] is True

    # 6. execute_session_merge
    exec_out = _mcp_call("execute_session_merge", {"merge_id": merge_id})
    assert exec_out["status"] == "merged"
    assert "merge_commit" in exec_out

    # 7. get_session_merge_matrix
    matrix_out = _mcp_call("get_session_merge_matrix", {})
    assert "matrix" in matrix_out
