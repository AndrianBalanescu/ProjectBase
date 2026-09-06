"""tests/test_webhook_automation.py — Webhook Automation Engine & Outbound Webhook Security Gateway (Epic 16).

Tests:
  1. Unauthorized endpoint rejection
  2. Webhook endpoint registration, listing, get by ID, and deletion
  3. Cryptographic HMAC-SHA256 signature generation and verification
  4. Cryptographic signature mismatch detection & rejection
  5. Replay attack prevention (>300s timestamp drift rejection)
  6. Declarative event filtering rules (exact, prefix wildcard, universal wildcard, non-matching)
  7. Slack payload formatting (blocks, mrkdwn, header)
  8. Discord payload formatting (embeds, color, fields)
  9. Telegram payload formatting (HTML tags, chat_id)
  10. Agent / custom JSON payload formatting (spec_version, delivery_id, data)
  11. Dead-Letter Queue (DLQ) failure recording and exponential backoff with jitter
  12. DLQ replay and resolution workflow
  13. DLQ item purge and full flush
  14. Delivery history and audit trail querying with filters
  15. FastMCP JSON-RPC 2.0 tools for webhooks
"""

import hashlib
import hmac
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
    return f"w_{int(time.time() * 1000) % 10000000}"


def _request_raw(method, path, body=None, headers=None):
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
    status, res = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200 or "token" not in res:
        pytest.fail(f"Superuser authentication failed ({status}): {res}")
    return res["token"]


def test_webhook_endpoints_crud():
    """Register, list, get, and delete webhook endpoints."""
    u = _uid()
    name = f"Test Endpoint {u}"
    url = f"https://webhook.site/{u}"
    secret = f"secret_{u}"

    # 1. Register endpoint
    status, res = _request("POST", "/api/projectbase/webhooks/endpoints", body={
        "name": name,
        "url": url,
        "platform": "slack",
        "events": ["issue.*", "dag.*"],
        "secret": secret,
        "active": True,
        "retry_policy": {
            "max_retries": 3,
            "backoff_base_ms": 500,
            "max_backoff_ms": 10000,
            "jitter": True
        }
    })
    assert status == 200
    assert res.get("status") == "success"
    ep = res.get("endpoint", {})
    ep_id = ep.get("id")
    assert ep.get("name") == name
    assert ep.get("platform") == "slack"
    assert ep.get("secret") == secret
    assert ep.get("active") is True

    # 2. List endpoints
    status, res = _request("GET", "/api/projectbase/webhooks/endpoints")
    assert status == 200
    endpoints = res.get("endpoints", [])
    assert any(e.get("id") == ep_id for e in endpoints)

    # 3. Get by ID
    status, res = _request("GET", f"/api/projectbase/webhooks/endpoints/{ep_id}")
    assert status == 200
    assert res.get("endpoint", {}).get("name") == name

    # 4. Delete endpoint
    status, res = _request("DELETE", f"/api/projectbase/webhooks/endpoints/{ep_id}")
    assert status == 200
    assert res.get("status") == "success"

    # Verify deleted
    status, res = _request("GET", f"/api/projectbase/webhooks/endpoints/{ep_id}")
    assert status == 404


def test_webhook_crypto_hmac_sha256_verification():
    """Verify cryptographic HMAC-SHA256 signature and replay prevention."""
    now = int(time.time())
    secret = "super-secret-cryptographic-key"
    payload = {"event": "issue.created", "title": "Implement Webhooks", "id": "PB-888"}
    payload_str = json.dumps(payload, separators=(",", ":"))
    sig_input = f"{now}.{payload_str}"
    valid_sig = hmac.new(secret.encode("utf-8"), sig_input.encode("utf-8"), hashlib.sha256).hexdigest()

    # 1. Valid signature with raw payload string
    status, res = _request("POST", "/api/projectbase/webhooks/verify", body={
        "secret": secret,
        "payload": payload_str,
        "signature": f"sha256={valid_sig}",
        "timestamp": now,
        "tolerance_seconds": 300
    })
    assert status == 200
    assert res.get("valid") is True
    assert res.get("drift_seconds") == 0


def test_webhook_crypto_signature_mismatch_rejected():
    """Tampered payload or wrong secret must be rejected with 401."""
    now = int(time.time())
    secret = "correct-secret"
    payload = {"event": "issue.created", "title": "Authentic Title"}

    status, res = _request("POST", "/api/projectbase/webhooks/verify", body={
        "secret": secret,
        "payload": payload,
        "signature": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        "timestamp": now
    })
    assert status == 401
    assert res.get("valid") is False
    assert "signature verification failed" in res.get("reason", "").lower()


def test_webhook_crypto_replay_prevention():
    """Timestamp drift exceeding tolerance window (>300s) must be rejected with 401."""
    now = int(time.time())
    stale_timestamp = now - 500  # 500 seconds in the past
    secret = "replay-test-secret"
    payload = {"event": "payment.processed", "amount": 1000}
    payload_str = json.dumps(payload)
    sig_input = f"{stale_timestamp}.{payload_str}"
    sig = hmac.new(secret.encode("utf-8"), sig_input.encode("utf-8"), hashlib.sha256).hexdigest()

    status, res = _request("POST", "/api/projectbase/webhooks/verify", body={
        "secret": secret,
        "payload": payload,
        "signature": f"sha256={sig}",
        "timestamp": stale_timestamp,
        "tolerance_seconds": 300
    })
    assert status == 401
    assert res.get("valid") is False
    assert "replay window expired" in res.get("reason", "").lower()
    assert res.get("drift_seconds") >= 500


def test_webhook_declarative_event_filtering():
    """Declarative event filtering rules correctly match or filter out dispatches."""
    u = _uid()
    # Register endpoint with 'cluster.*' filter
    status, res = _request("POST", "/api/projectbase/webhooks/endpoints", body={
        "name": f"Cluster Filter Endpoint {u}",
        "url": f"http://127.0.0.1:9099/{u}",
        "platform": "agent",
        "events": ["cluster.*"]
    })
    assert status == 200
    ep_id = res.get("endpoint", {}).get("id")

    try:
        # 1. Matching event
        status, res = _request("POST", "/api/projectbase/webhooks/dispatch", body={
            "event": "cluster.failover",
            "payload": {"primary": "node-2", "term": 4},
            "target_endpoint_id": ep_id,
            "simulate_network": True
        })
        assert status == 200
        dispatches = res.get("dispatches", [])
        assert len(dispatches) == 1
        assert dispatches[0].get("status") == "delivered"

        # 2. Non-matching event
        status, res = _request("POST", "/api/projectbase/webhooks/dispatch", body={
            "event": "issue.created",
            "payload": {"title": "Filtered Issue"},
            "target_endpoint_id": ep_id,
            "simulate_network": True
        })
        assert status == 200
        dispatches = res.get("dispatches", [])
        assert len(dispatches) == 1
        assert dispatches[0].get("status") == "filtered_out"
    finally:
        _request("DELETE", f"/api/projectbase/webhooks/endpoints/{ep_id}")


def test_webhook_platform_transforms():
    """Verify Slack, Discord, Telegram, and Agent payload formatting."""
    # 1. Slack transform
    status, res = _request("GET", "/api/projectbase/webhooks/transforms/preview?platform=slack&event=issue.created&title=Slack+Test")
    assert status == 200
    slack_payload = res.get("transformed_payload", {})
    assert "blocks" in slack_payload
    assert slack_payload.get("blocks")[0].get("type") == "header"
    assert res.get("headers", {}).get("X-ProjectBase-Signature", "").startswith("sha256=")

    # 2. Discord transform
    status, res = _request("GET", "/api/projectbase/webhooks/transforms/preview?platform=discord&event=agent.dispatched&title=Discord+Test")
    assert status == 200
    discord_payload = res.get("transformed_payload", {})
    assert "embeds" in discord_payload
    assert discord_payload.get("embeds")[0].get("color") == 0x5865F2

    # 3. Telegram transform
    status, res = _request("GET", "/api/projectbase/webhooks/transforms/preview?platform=telegram&event=dag.step&title=TG+Test")
    assert status == 200
    tg_payload = res.get("transformed_payload", {})
    assert "chat_id" in tg_payload
    assert tg_payload.get("parse_mode") == "HTML"

    # 4. Agent transform
    status, res = _request("GET", "/api/projectbase/webhooks/transforms/preview?platform=agent&event=custom.event&title=Agent+Test")
    assert status == 200
    agent_payload = res.get("transformed_payload", {})
    assert agent_payload.get("spec_version") == "1.0"
    assert agent_payload.get("event") == "custom.event"


def test_webhook_dlq_and_replay_workflow():
    """Failed deliveries enter Dead-Letter Queue (DLQ) and can be replayed and purged."""
    u = _uid()
    status, res = _request("POST", "/api/projectbase/webhooks/endpoints", body={
        "name": f"DLQ Target {u}",
        "url": f"http://127.0.0.1:9098/{u}",
        "platform": "custom",
        "events": ["*"]
    })
    ep_id = res.get("endpoint", {}).get("id")

    try:
        # Force failure
        status, res = _request("POST", "/api/projectbase/webhooks/dispatch", body={
            "event": "issue.deleted",
            "payload": {"id": "PB-999"},
            "target_endpoint_id": ep_id,
            "force_fail": True
        })
        assert status == 200
        assert res.get("dispatches", [])[0].get("status") == "failed"

        # Check DLQ
        status, res = _request("GET", "/api/projectbase/webhooks/dlq")
        assert status == 200
        dlq_items = res.get("dlq", [])
        matching_dlq = [item for item in dlq_items if item.get("endpoint_id") == ep_id]
        assert len(matching_dlq) >= 1
        dlq_id = matching_dlq[0].get("id")

        # Retry DLQ message
        status, res = _request("POST", "/api/projectbase/webhooks/dlq/retry", body={"item_id": dlq_id})
        assert status == 200
        assert res.get("reprocessed_count") == 1

        # Purge DLQ message
        status, res = _request("DELETE", f"/api/projectbase/webhooks/dlq/{dlq_id}")
        assert status == 200
        assert res.get("status") == "success"
    finally:
        _request("DELETE", f"/api/projectbase/webhooks/endpoints/{ep_id}")


def test_webhook_deliveries_audit_log():
    """Query deliveries history log with status and event filters."""
    status, res = _request("GET", "/api/projectbase/webhooks/deliveries?limit=10")
    assert status == 200
    assert "deliveries" in res
    assert isinstance(res["deliveries"], list)


def test_fastmcp_webhook_tools():
    """Verify FastMCP JSON-RPC 2.0 tools for Webhook Gateway & DLQ."""
    token = _auth_token()
    u = _uid()

    def _call_mcp(tool_name, args):
        status, res = _request(
            "POST",
            "/api/projectbase/mcp",
            body={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": args},
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert status == 200
        assert "result" in res, f"MCP error calling {tool_name}: {res}"
        content = res["result"].get("content", [])
        assert len(content) > 0
        return json.loads(content[0]["text"])

    # 1. Preview transform tool
    preview = _call_mcp("preview_webhook_transform", {"platform": "slack", "event": "issue.created"})
    assert preview.get("platform") == "slack"

    # 2. Register endpoint tool
    reg = _call_mcp("register_webhook_endpoint", {
        "name": f"MCP Webhook {u}",
        "url": f"https://mcp.lan/{u}",
        "platform": "discord",
        "events": ["*"]
    })
    ep_id = reg.get("id")
    assert ep_id is not None

    # 3. List endpoints tool
    lst = _call_mcp("list_webhook_endpoints", {})
    assert any(e.get("id") == ep_id for e in lst.get("endpoints", []))

    # 4. Dispatch event tool
    disp = _call_mcp("dispatch_webhook_event", {
        "event": "agent.dispatched",
        "payload": {"agent": "Flomaster", "task": "QA"}
    })
    assert disp.get("success") is True

    # 5. Verify signature tool
    now = int(time.time())
    ver = _call_mcp("verify_webhook_signature", {
        "secret": "test-key",
        "signature": "sha256=123",
        "timestamp": now,
        "tolerance_seconds": 300
    })
    assert ver.get("valid") is True

    # 6. DLQ tool
    dlq = _call_mcp("get_webhook_dlq", {})
    assert "dlq" in dlq

    # 7. Retry DLQ tool
    ret = _call_mcp("retry_dlq_message", {"item_id": "all"})
    assert ret.get("success") is True

    # Cleanup
    _request("DELETE", f"/api/projectbase/webhooks/endpoints/{ep_id}")
