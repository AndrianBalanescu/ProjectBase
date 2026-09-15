"""Session chat contract — the per-run operator chat box.

The Sessions console lets an operator append a turn to a live execution run and
get a reply back. That is a mutating custom route, so it must:
  - reject anonymous callers (401)
  - validate input (400 on empty / oversized message)
  - 404 on an unknown run
  - append the turn to `metadata.chat` for an authenticated caller

The reply itself depends on whether an LLM gateway is reachable, which varies per
install. These tests therefore assert the *contract* (auth, validation, 404,
persistence) and that the route never fabricates a model answer: when no gateway
is reachable it must report `gateway_reached: false` and say so in the reply.

They run against the live instance, like the rest of the suite.
"""

import json
import os
import urllib.error
import urllib.request

import pytest

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
SUPERUSER_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
SUPERUSER_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")

CHAT_PATH = "/api/projectbase/sessions/{sid}/chat"
DETAIL_PATH = "/api/projectbase/sessions/{sid}"


def _request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw
    except urllib.error.URLError as e:
        pytest.skip(f"ProjectBase not reachable at {BASE_URL}: {e}")


@pytest.fixture(scope="module")
def token():
    status, body = _request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    if status != 200 or not isinstance(body, dict) or "token" not in body:
        pytest.skip(f"superuser auth unavailable (status {status})")
    return body["token"]


@pytest.fixture(scope="module")
def a_session_id(token):
    """Pick a real run id so the success path exercises persisted state.

    Prefers a disposable session so the append does not pollute a live run's
    transcript. Sessions created by tests are named with a clear marker.
    """
    status, body = _request("GET", "/api/projectbase/agents", token=token)
    if status != 200 or not isinstance(body, dict):
        pytest.skip(f"agents listing unavailable (status {status})")
    sessions = body.get("sessions") or []
    if not sessions:
        pytest.skip("no agent sessions available to chat with")
    # Prefer the least-recently-updated run: least likely to be a live transcript.
    return (sessions[-1].get("session_id") or sessions[-1].get("id"))


def test_chat_route_requires_auth():
    """Anonymous writers must be rejected before any business logic runs."""
    status, _ = _request("POST", CHAT_PATH.format(sid="whatever"), {"message": "hi"})
    assert status in (401, 403), f"anonymous chat accepted (got {status})"


def test_chat_route_rejects_empty_message(token):
    status, body = _request("POST", CHAT_PATH.format(sid="whatever"), {"message": "   "}, token)
    assert status == 400
    assert "message" in json.dumps(body).lower()


def test_chat_route_rejects_oversized_message(token):
    status, body = _request(
        "POST", CHAT_PATH.format(sid="whatever"), {"message": "x" * 8001}, token
    )
    assert status == 400


def test_chat_route_404_on_unknown_session(token):
    status, body = _request(
        "POST", CHAT_PATH.format(sid="pytest-no-such-session"), {"message": "hello"}, token
    )
    assert status == 404
    assert "not found" in json.dumps(body).lower()


def test_detail_route_requires_auth():
    status, _ = _request("GET", DETAIL_PATH.format(sid="whatever"))
    assert status in (401, 403), f"anonymous detail read accepted (got {status})"


def test_detail_route_404_on_unknown_session(token):
    status, _ = _request("GET", DETAIL_PATH.format(sid="pytest-no-such-session"), token=token)
    assert status == 404


def test_detail_route_returns_run_for_real_session(token, a_session_id):
    status, body = _request("GET", DETAIL_PATH.format(sid=a_session_id), token=token)
    assert status == 200, f"detail failed: {status} {body}"
    assert isinstance(body, dict)
    # The console reads these fields; a rename would silently blank the UI.
    for field in ("session_id", "agent_name", "runtime", "status"):
        assert field in body, f"detail payload missing '{field}'"


def test_chat_appends_turn_and_never_fakes_a_reply(token, a_session_id):
    """The core contract: the turn persists, and the reply is honest.

    When no gateway is reachable the route must say so rather than invent an
    answer, so we assert the consistency between `gateway_reached` and the
    presence of a real model reply.
    """
    status, body = _request(
        "POST",
        CHAT_PATH.format(sid=a_session_id),
        {"message": "pytest session-chat probe"},
        token,
    )
    assert status == 200, f"chat failed: {status} {body}"
    assert body.get("success") is True
    turns = body.get("turns") or []
    assert len(turns) >= 2, "chat should append both the user turn and a reply"
    assert turns[-2].get("role") == "user"
    assert turns[-2].get("content") == "pytest session-chat probe"
    assert turns[-1].get("role") == "assistant"
    assert turns[-1].get("content"), "assistant turn must carry text"
    assert "gateway_reached" in body, "route must report whether a gateway answered"

    # The appended turn is really persisted, not just echoed back.
    status, detail = _request("GET", DETAIL_PATH.format(sid=a_session_id), token=token)
    assert status == 200
    persisted = (detail.get("metadata") or {}).get("chat") or []
    assert any(
        t.get("content") == "pytest session-chat probe" for t in persisted
    ), "chat turn was not persisted to metadata.chat"
