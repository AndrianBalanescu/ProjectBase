"""Session copilot attachment storage and UI contract."""

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
    ]:
        assert token in view or token in api
