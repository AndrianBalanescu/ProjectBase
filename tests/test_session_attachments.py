"""Session copilot attachment storage and UI contract."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_attachment_migration_is_bounded_and_owner_scoped():
    src = (ROOT / "app/pb_migrations/1710000057_add_session_attachments.js").read_text()
    assert 'name: "session_attachments"' in src
    assert 'maxSelect: 1' in src
    assert 'maxSize: 10485760' in src
    assert 'protected: true' in src
    assert 'owner = @request.auth.id' in src
    assert 'session_id' in src
    assert 'image/png' in src and 'application/pdf' in src


def test_session_chat_validates_attachment_ownership_and_count():
    src = (ROOT / "app/pb_hooks/82_session_chat.pb.js").read_text()
    assert 'requestedAttachments.length > 5' in src
    assert 'att.getString("owner") !== e.auth.id' in src
    assert 'att.getString("session_id") !== sessionId' in src
    assert 'attachments: attachments' in src
    assert 'attachment_payloads' in src
    assert 'type: "image_url"' in src
    assert 'payload.data.length <= 6000000' in src
    assert 'payload.data.length <= 102400' in src
    assert 'Attachment payload must match a validated session attachment' in src


def test_smart_composer_wires_picker_paste_chips_and_cleanup():
    view = (ROOT / "app/pb_public/js/components/AgentsView.js").read_text()
    api = (ROOT / "app/pb_public/js/api.js").read_text()
    for token in [
        '@paste="onComposerPaste"',
        'aria-label="Attach screenshots or files"',
        'removeAttachment(item)',
        'Up to 5 attachments per message.',
        'exceeds 10 MB',
        'uploadSessionAttachment',
        'deleteSessionAttachment',
        'pb.files.getToken()',
        "reader.readAsDataURL(file)",
        "await file.text()",
        "Object.assign({ id: a.id }, a.inline)",
    ]:
        assert token in view or token in api


def test_openapi_documents_copilot_attachment_contract():
    spec = json.loads((ROOT / "app/pb_public/openapi.json").read_text())
    operation = spec["paths"]["/projectbase/sessions/{id}/chat"]["post"]
    assert "does not send input to or control" in operation["description"]
    props = operation["requestBody"]["content"]["application/json"]["schema"]["properties"]
    assert props["attachments"]["maxItems"] == 5
    assert props["attachment_payloads"]["maxItems"] == 5
    assert set(props["attachment_payloads"]["items"]["properties"]["kind"]["enum"]) == {"image", "text"}


def test_agents_map_lists_attachment_collection():
    agents = (ROOT / "AGENTS.md").read_text()
    assert "`agent_sessions` · `session_attachments` · `session_audits`" in agents
