"""tests/test_cluster_replication.py — Distributed Cross-Cluster Replication, High-Availability Failover & Edge SQLite Sync.

Validates Epic 15 features:
1. Cluster node registration, discovery, role configuration, and listing (/api/projectbase/cluster/nodes/register, /api/projectbase/cluster/nodes).
2. Cluster node heartbeat tracking, sequence progress, and latency updates (/api/projectbase/cluster/nodes/heartbeat).
3. Cluster node decommissioning (/api/projectbase/cluster/nodes/{id}).
4. Delta replication log stream pulling and vector clock checkpoints (/api/projectbase/cluster/sync/pull).
5. Delta replication push with Lamport/vector clock conflict resolution and split-brain fencing guards (/api/projectbase/cluster/sync/push).
6. Cold-start point-in-time state snapshot bundles with checksums (/api/projectbase/cluster/sync/snapshot).
7. High-availability cluster health, quorum verification, and leader status (/api/projectbase/cluster/failover/status).
8. Primary failover promotion, term advancement, and split-brain barrier enforcement (/api/projectbase/cluster/failover/promote).
9. Split-brain fencing token validation (/api/projectbase/cluster/failover/fencing).
10. Two-way offline-first SQLite edge reconciliation (/api/projectbase/cluster/edge/reconcile).
11. FastMCP JSON-RPC 2.0 tool execution for all cluster sync, node, failover, and edge tools.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")


def _uid():
    return f"c{int(time.time() * 1000) % 10000000}"


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


def test_cluster_unauthorized_endpoints():
    """All cluster replication endpoints must reject unauthenticated requests with 401."""
    endpoints = [
        ("GET", "/api/projectbase/cluster/nodes"),
        ("POST", "/api/projectbase/cluster/nodes/register"),
        ("POST", "/api/projectbase/cluster/nodes/heartbeat"),
        ("DELETE", "/api/projectbase/cluster/nodes/some-node-id"),
        ("GET", "/api/projectbase/cluster/sync/pull"),
        ("POST", "/api/projectbase/cluster/sync/push"),
        ("POST", "/api/projectbase/cluster/sync/snapshot"),
        ("GET", "/api/projectbase/cluster/failover/status"),
        ("POST", "/api/projectbase/cluster/failover/promote"),
        ("POST", "/api/projectbase/cluster/failover/fencing"),
        ("POST", "/api/projectbase/cluster/edge/reconcile"),
    ]
    for method, path in endpoints:
        status, res = _request(method, path, body={})
        assert status in (401, 403), f"Expected 401/403 for unauthenticated {method} {path}, got {status}: {res}"


def test_register_cluster_node_and_listing():
    """Register primary and replica cluster nodes and verify listing and role queries."""
    token = _auth_token()
    u = _uid()
    node_id_1 = f"homelab-primary-{u}"
    node_id_2 = f"vps-replica-{u}"

    # 1. Register Primary
    status, res1 = _request(
        "POST",
        "/api/projectbase/cluster/nodes/register",
        {
            "node_id": node_id_1,
            "node_name": "Homelab MicroServer Master",
            "role": "primary",
            "endpoint_url": f"https://homelab-{u}.flow.lan:8120",
            "region": "homelab-local",
            "capabilities": ["sync", "write", "failover_coordinator"],
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Register primary failed: {res1}"
    assert res1.get("success") is True
    assert res1["node"]["node_id"] == node_id_1
    assert res1["node"]["role"] == "primary"

    # 2. Register Replica
    status, res2 = _request(
        "POST",
        "/api/projectbase/cluster/nodes/register",
        {
            "node_id": node_id_2,
            "node_name": "Hostinger Cloud Mirror",
            "role": "replica",
            "endpoint_url": f"https://vps-{u}.flow.lan:8120",
            "region": "cloud-vps-eu",
            "capabilities": ["sync", "read_replica"],
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Register replica failed: {res2}"
    assert res2.get("success") is True

    # 3. List Nodes
    status, list_res = _request(
        "GET",
        "/api/projectbase/cluster/nodes",
        headers={"Authorization": token},
    )
    assert status == 200, f"List nodes failed: {list_res}"
    assert list_res.get("success") is True
    assert list_res.get("count", 0) >= 2
    assert "cluster" in list_res
    assert list_res["cluster"]["is_quorum_ok"] is True

    # Filter by role
    status, rep_only = _request(
        "GET",
        "/api/projectbase/cluster/nodes?role=replica",
        headers={"Authorization": token},
    )
    assert status == 200
    roles = [n["role"] for n in rep_only.get("nodes", [])]
    assert all(r == "replica" for r in roles)


def test_cluster_node_heartbeat():
    """Send heartbeat updates reporting applied sequence number and lag."""
    token = _auth_token()
    u = _uid()
    node_id = f"node-hb-{u}"

    _request(
        "POST",
        "/api/projectbase/cluster/nodes/register",
        {
            "node_id": node_id,
            "node_name": "Heartbeat Test Node",
            "role": "replica",
            "endpoint_url": f"http://hb-{u}.internal:8120",
            "region": "edge",
        },
        headers={"Authorization": token},
    )

    status, hb_res = _request(
        "POST",
        "/api/projectbase/cluster/nodes/heartbeat",
        {
            "node_id": node_id,
            "applied_seq": 142,
            "lag_ms": 12,
            "status": "online",
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Heartbeat failed: {hb_res}"
    assert hb_res.get("success") is True
    assert hb_res.get("heartbeat_acknowledged") is True
    assert "cluster" in hb_res


def test_cluster_node_decommission():
    """Decommission and remove a cluster node."""
    token = _auth_token()
    u = _uid()
    node_id = f"node-decom-{u}"

    _request(
        "POST",
        "/api/projectbase/cluster/nodes/register",
        {
            "node_id": node_id,
            "node_name": "Decommission Candidate",
            "role": "edge",
            "endpoint_url": f"http://decom-{u}.internal:8120",
        },
        headers={"Authorization": token},
    )

    status, del_res = _request(
        "DELETE",
        f"/api/projectbase/cluster/nodes/{node_id}",
        headers={"Authorization": token},
    )
    assert status == 200, f"Delete node failed: {del_res}"
    assert del_res.get("success") is True
    assert del_res.get("node_id") == node_id


def test_cluster_sync_pull_deltas():
    """Pull delta change stream since a given checkpoint sequence."""
    token = _auth_token()
    status, pull_res = _request(
        "GET",
        "/api/projectbase/cluster/sync/pull?since_seq=0&limit=20",
        headers={"Authorization": token},
    )
    assert status == 200, f"Sync pull failed: {pull_res}"
    assert pull_res.get("success") is True
    assert "deltas" in pull_res
    assert isinstance(pull_res["deltas"], list)
    assert "latest_seq" in pull_res


def test_cluster_sync_push_deltas():
    """Push replication deltas into cluster log stream with deterministic LWW."""
    token = _auth_token()
    u = _uid()
    origin_node = f"edge-node-{u}"

    deltas = [
        {
            "seq_id": 101,
            "target_collection": "issues",
            "record_id": f"rec_iss_{u}_1",
            "op_type": "upsert",
            "checksum": f"sha256_{u}_1",
            "vector_clock": {origin_node: 1},
            "delta_payload": {
                "title": f"Synced Issue from Edge {u}",
                "status": "todo",
                "priority": "high",
            },
        },
        {
            "seq_id": 102,
            "target_collection": "issues",
            "record_id": f"rec_iss_{u}_2",
            "op_type": "update",
            "checksum": f"sha256_{u}_2",
            "vector_clock": {origin_node: 2},
            "delta_payload": {
                "status": "in_progress",
            },
        },
    ]

    status, push_res = _request(
        "POST",
        "/api/projectbase/cluster/sync/push",
        {
            "origin_node_id": origin_node,
            "deltas": deltas,
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Sync push failed: {push_res}"
    assert push_res.get("success") is True
    assert push_res.get("applied_deltas") == 2
    assert "fencing_token" in push_res


def test_cluster_split_brain_fencing_violation():
    """Ensure push with outdated fencing token is rejected with 409 conflict."""
    token = _auth_token()
    u = _uid()

    status, push_res = _request(
        "POST",
        "/api/projectbase/cluster/sync/push",
        {
            "origin_node_id": f"stale-node-{u}",
            "fencing_token": "PB-FENCE-T0-stale-node",
            "deltas": [
                {
                    "seq_id": 1,
                    "target_collection": "issues",
                    "record_id": f"rec_stale_{u}",
                    "op_type": "update",
                    "delta_payload": {"title": "Split brain mutation"},
                }
            ],
        },
        headers={"Authorization": token},
    )
    assert status == 409, f"Expected 409 fencing rejection, got {status}: {push_res}"
    assert push_res.get("success") is False
    assert "Fencing violation" in push_res.get("error", "")


def test_cluster_sync_snapshot_export():
    """Create point-in-time snapshot bundle for zero-copy edge bootstrapping."""
    token = _auth_token()
    u = _uid()
    target_node = f"mobile-edge-{u}"

    status, snap_res = _request(
        "POST",
        "/api/projectbase/cluster/sync/snapshot",
        {
            "target_node_id": target_node,
            "include_collections": ["projects", "issues"],
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Snapshot creation failed: {snap_res}"
    assert snap_res.get("success") is True
    assert "snapshot_id" in snap_res
    assert snap_res["target_node_id"] == target_node
    assert "data" in snap_res
    assert "checksum" in snap_res


def test_cluster_failover_status():
    """Query cluster failover status, quorum health, and term epoch."""
    token = _auth_token()
    status, res = _request(
        "GET",
        "/api/projectbase/cluster/failover/status",
        headers={"Authorization": token},
    )
    assert status == 200, f"Failover status query failed: {res}"
    assert res.get("success") is True
    assert "cluster" in res
    assert "term" in res["cluster"]
    assert "fencing_token" in res["cluster"]
    assert "split_brain_guard" in res["cluster"]


def test_cluster_failover_promote():
    """Promote a candidate node to cluster primary leader."""
    token = _auth_token()
    u = _uid()
    candidate_id = f"node-promoted-{u}"

    _request(
        "POST",
        "/api/projectbase/cluster/nodes/register",
        {
            "node_id": candidate_id,
            "node_name": "Standby Replica",
            "role": "replica",
            "endpoint_url": f"http://promoted-{u}.internal:8120",
        },
        headers={"Authorization": token},
    )

    status, prom_res = _request(
        "POST",
        "/api/projectbase/cluster/failover/promote",
        {
            "candidate_node_id": candidate_id,
            "reason": "simulated_primary_partition",
            "force": True,
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Promote failed: {prom_res}"
    assert prom_res.get("success") is True
    assert prom_res["promoted_primary"] == candidate_id
    assert prom_res["new_term"] >= 2
    assert candidate_id in prom_res["fencing_token"]


def test_cluster_failover_fencing_verification():
    """Verify split-brain fencing token validation check."""
    token = _auth_token()
    u = _uid()

    status, res = _request(
        "POST",
        "/api/projectbase/cluster/failover/fencing",
        {
            "node_id": f"node-{u}",
            "fencing_token": "PB-FENCE-T1-stale",
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Fencing verification call failed: {res}"
    assert res.get("success") is True
    assert "is_fenced" in res


def test_cluster_edge_two_way_reconcile():
    """Reconcile offline client modifications and return unified vector clock."""
    token = _auth_token()
    u = _uid()
    edge_id = f"edge-iphone-{u}"

    status, rec_res = _request(
        "POST",
        "/api/projectbase/cluster/edge/reconcile",
        {
            "edge_node_id": edge_id,
            "client_vector_clock": {edge_id: 3},
            "staged_changes": [
                {
                    "target_collection": "issues",
                    "record_id": f"offline_iss_{u}",
                    "op_type": "upsert",
                    "delta_payload": {
                        "title": f"Offline Issue Created {u}",
                        "status": "backlog",
                    },
                }
            ],
        },
        headers={"Authorization": token},
    )
    assert status == 200, f"Edge reconcile failed: {rec_res}"
    assert rec_res.get("success") is True
    assert rec_res.get("merged_changes_count") == 1
    assert "unified_vector_clock" in rec_res
    assert edge_id in rec_res["unified_vector_clock"]


def test_fastmcp_cluster_tools():
    """Verify FastMCP JSON-RPC 2.0 tools for cluster synchronization."""
    token = _auth_token()
    u = _uid()
    node_id = f"mcp-node-{u}"

    # 1. register_cluster_node
    payload = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "tools/call",
        "params": {
            "name": "register_cluster_node",
            "arguments": {
                "node_id": node_id,
                "node_name": "MCP Fast Registered Node",
                "role": "replica",
                "endpoint_url": f"https://mcp-{u}.cluster:8120",
                "region": "homelab",
            },
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", body=payload, headers={"Authorization": f"Bearer {token}"})
    assert status == 200, f"FastMCP register node failed: {res}"
    parsed = json.loads(res["result"]["content"][0]["text"])
    assert parsed.get("success") is True
    assert parsed.get("node_id") == node_id

    # 2. list_cluster_nodes
    payload = {
        "jsonrpc": "2.0",
        "id": "2",
        "method": "tools/call",
        "params": {
            "name": "list_cluster_nodes",
            "arguments": {},
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", body=payload, headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    parsed = json.loads(res["result"]["content"][0]["text"])
    assert parsed.get("success") is True
    assert parsed.get("count", 0) >= 1

    # 3. push_cluster_deltas
    payload = {
        "jsonrpc": "2.0",
        "id": "3",
        "method": "tools/call",
        "params": {
            "name": "push_cluster_deltas",
            "arguments": {
                "origin_node_id": node_id,
                "deltas": [
                    {
                        "seq_id": 501,
                        "target_collection": "issues",
                        "record_id": f"mcp_rec_{u}",
                        "op_type": "upsert",
                        "delta_payload": {"title": "MCP Replicated Task"},
                    }
                ],
            },
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", body=payload, headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    parsed = json.loads(res["result"]["content"][0]["text"])
    assert parsed.get("success") is True
    assert parsed.get("applied_deltas") == 1

    # 4. pull_cluster_deltas
    payload = {
        "jsonrpc": "2.0",
        "id": "4",
        "method": "tools/call",
        "params": {
            "name": "pull_cluster_deltas",
            "arguments": {"since_seq": 0, "limit": 10},
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", body=payload, headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    parsed = json.loads(res["result"]["content"][0]["text"])
    assert parsed.get("success") is True

    # 5. get_cluster_failover_status
    payload = {
        "jsonrpc": "2.0",
        "id": "5",
        "method": "tools/call",
        "params": {
            "name": "get_cluster_failover_status",
            "arguments": {},
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", body=payload, headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    parsed = json.loads(res["result"]["content"][0]["text"])
    assert parsed.get("success") is True
    assert "primary_node" in parsed

    # 6. trigger_cluster_failover
    payload = {
        "jsonrpc": "2.0",
        "id": "6",
        "method": "tools/call",
        "params": {
            "name": "trigger_cluster_failover",
            "arguments": {
                "candidate_node_id": node_id,
                "reason": "fastmcp_auto_election",
            },
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", body=payload, headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    parsed = json.loads(res["result"]["content"][0]["text"])
    assert parsed.get("success") is True
    assert parsed.get("promoted_primary") == node_id

    # 7. reconcile_edge_sync
    payload = {
        "jsonrpc": "2.0",
        "id": "7",
        "method": "tools/call",
        "params": {
            "name": "reconcile_edge_sync",
            "arguments": {
                "edge_node_id": f"edge-mcp-{u}",
                "client_vector_clock": {"edge-mcp": 1},
                "staged_changes": [],
            },
        },
    }
    status, res = _request("POST", "/api/projectbase/mcp", body=payload, headers={"Authorization": f"Bearer {token}"})
    assert status == 200
    parsed = json.loads(res["result"]["content"][0]["text"])
    assert parsed.get("success") is True
    assert "unified_vector_clock" in parsed
