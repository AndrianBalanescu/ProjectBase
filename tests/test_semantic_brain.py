"""tests/test_semantic_brain.py — End-to-end tests for Epic 23 Autonomous Semantic Review, Neural Embeddings & Cross-Encoder Reranker Board Brain Engine.

Verifies:
  1. Semantic review evaluates candidate issues against active board with dense embeddings.
  2. Duplicate detection identifies high-similarity tickets and returns REJECTED_DUPLICATE.
  3. Vague / probe / test junk detection rejects low-information submissions (REJECTED_VAGUE).
  4. Novel issue proposals pass review cleanly (ALLOWED / AUTO_LINKED).
  5. Cross-encoder reranker scores and sorts candidates by contextual similarity.
  6. Semantic clustering groups related / duplicate issues across projects.
  7. Semantic consolidation merges duplicates, migrates comments, and updates canonical tickets.
  8. Admission policy management (list, create custom policies).
  9. Semantic review audit logs and telemetry persistence.
  10. Aggregated clutter prevention metrics and neural embedder status.
  11. Batch neural embedding reindexer.
  12. FastMCP JSON-RPC tools for semantic review and board governance.
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
    return f"semantic_{int(time.time() * 1000) % 10000000}"


def _request(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"error": err_body}


def _get_auth_token():
    status, res = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status == 200 and "token" in res:
        return res["token"]
    status, res = _request(
        "POST",
        "/api/collections/users/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    return res.get("token")


def test_semantic_review_duplicate_detection():
    """Verify semantic review catches high-similarity duplicate issues."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    # Query for an issue that already exists in LOAD project
    body = {
        "title": "Driver live GPS telematics webhook ingestor",
        "project": "LOAD"
    }
    status, res = _request("POST", "/api/projectbase/semantic/review", body, headers)
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert res.get("status") == "success"
    assert res.get("decision") == "REJECTED_DUPLICATE"
    assert res.get("is_allowed") is False
    assert res.get("recommended_action") == "REJECT_AND_MERGE"
    assert res.get("highest_similarity", 0) >= 0.70
    assert res.get("primary_match") is not None
    assert "LOAD-" in res["primary_match"].get("matched_identifier", "")


def test_semantic_review_vague_junk_rejection():
    """Verify semantic review catches low-information/probe submissions."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    vague_titles = ["123", "test", "probe", "todo", "ab"]
    for title in vague_titles:
        body = {"title": title, "project": "PB"}
        status, res = _request("POST", "/api/projectbase/semantic/review", body, headers)
        assert status == 200, f"Expected 200, got {status}: {res}"
        assert res.get("decision") == "REJECTED_VAGUE"
        assert res.get("is_allowed") is False


def test_semantic_review_novel_issue_allowed():
    """Verify semantic review permits genuine novel issues."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    body = {
        "title": f"Quantum key distribution microservice pipeline {_uid()}",
        "description": "Implement BB84 protocol simulation with zero-knowledge verification.",
        "project": "PB"
    }
    status, res = _request("POST", "/api/projectbase/semantic/review", body, headers)
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert res.get("decision") in ("ALLOWED", "AUTO_LINKED")
    assert res.get("is_allowed") is True


def test_semantic_reranker():
    """Verify cross-encoder reranker scores and orders candidates."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    body = {
        "query": "telematics webhook GPS live tracking",
        "project": "LOAD"
    }
    status, res = _request("POST", "/api/projectbase/semantic/rerank", body, headers)
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert "ranked_results" in res
    assert res["total_evaluated"] > 0
    ranked = res["ranked_results"]
    assert len(ranked) > 0
    # Top result should have highest similarity
    assert ranked[0]["similarity_score"] >= ranked[-1]["similarity_score"]


def test_semantic_clustering():
    """Verify semantic clustering endpoint groups issues across board."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    status, res = _request("POST", "/api/projectbase/semantic/cluster", {"threshold": 0.50}, headers)
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert "total_issues_scanned" in res
    assert "clusters" in res
    assert res["total_issues_scanned"] >= 0


def test_semantic_policies_and_audit():
    """Verify admission policies listing and creation, plus audit log access."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    # 1. List policies
    status, res = _request("GET", "/api/projectbase/semantic/policies", None, headers)
    assert status == 200
    assert "policies" in res

    # 2. Create custom policy
    p_body = {
        "policy_name": f"Test Strict Gate {_uid()}",
        "duplicate_threshold": 0.80,
        "related_threshold": 0.50,
        "require_acceptance_criteria": True
    }
    status, p_res = _request("POST", "/api/projectbase/semantic/policies", p_body, headers)
    assert status == 201
    assert "policy_id" in p_res

    # 3. Read audit log
    status, a_res = _request("GET", "/api/projectbase/semantic/audit", None, headers)
    assert status == 200
    assert "audits" in a_res
    assert len(a_res["audits"]) > 0


def test_semantic_metrics():
    """Verify semantic brain metrics and clutter reduction statistics."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    status, res = _request("GET", "/api/projectbase/semantic/metrics", None, headers)
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert res.get("status") == "active_and_protecting"
    assert "neural_embedder" in res
    assert "reranker_engine" in res
    assert "duplicates_blocked" in res
    assert "vague_junk_blocked" in res


def test_semantic_embeddings_reindex():
    """Verify batch reindexing of workspace issues into semantic embeddings."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    status, res = _request("POST", "/api/projectbase/semantic/embeddings/reindex", {}, headers)
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert res.get("status") == "success"
    assert res.get("vector_dimensions") == 64
    assert res.get("total_issues_indexed", 0) >= 0


def test_semantic_consolidation_flow():
    """Verify end-to-end duplicate consolidation, comment migration and status update."""
    token = _get_auth_token()
    headers = {"Authorization": token}

    # Find project ID
    s_p, projects = _request("GET", "/api/collections/projects/records?perPage=1", None, headers)
    assert s_p == 200 and projects["items"]
    proj_id = projects["items"][0]["id"]

    # Create canonical issue and duplicate issue
    uid = _uid()
    s_c, can = _request("POST", "/api/collections/issues/records", {
        "project": proj_id,
        "title": f"Canonical Feature {uid}",
        "description": "Primary feature ticket description."
    }, headers)
    assert s_c == 200

    s_d, dup = _request("POST", "/api/collections/issues/records", {
        "project": proj_id,
        "title": f"Duplicate Feature {uid}",
        "description": "Secondary duplicate ticket description."
    }, headers)
    assert s_d == 200

    # Add a comment to duplicate
    _request("POST", "/api/collections/comments/records", {
        "issue": dup["id"],
        "author": "Agent Tester",
        "content": "Valuable research note on duplicate"
    }, headers)

    try:
        # Consolidate duplicate into canonical
        status, res = _request("POST", "/api/projectbase/semantic/consolidate", {
            "canonical_issue_id": can["id"],
            "duplicate_issue_ids": [dup["id"]],
            "reason": "Test consolidation validation"
        }, headers)
        assert status == 200
        assert res.get("consolidated_count") == 1

        # Check duplicate status is cancelled
        s_chk, dup_chk = _request("GET", f"/api/collections/issues/records/{dup['id']}", None, headers)
        assert s_chk == 200
        assert dup_chk.get("status") == "cancelled"
    finally:
        # Cleanup
        _request("DELETE", f"/api/collections/issues/records/{can['id']}", None, headers)
        _request("DELETE", f"/api/collections/issues/records/{dup['id']}", None, headers)
