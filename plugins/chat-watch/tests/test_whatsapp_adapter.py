"""Tests for the WhatsApp adapter."""

import json
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import monitor  # noqa: E402


@pytest.fixture
def wa_db(tmp_path: Path) -> Path:
    """Create an in-memory-like WhatsApp messages.db in tmp_path."""
    db_path = tmp_path / "messages.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE chats (jid TEXT PRIMARY KEY, name TEXT, last_message_time TIMESTAMP)"
    )
    conn.execute(
        "CREATE TABLE messages ("
        "id TEXT, chat_jid TEXT, sender TEXT, content TEXT, "
        "timestamp TIMESTAMP, is_from_me BOOLEAN, "
        "media_type TEXT, filename TEXT, url TEXT, "
        "media_key BLOB, file_sha256 BLOB, file_enc_sha256 BLOB, file_length INTEGER, "
        "PRIMARY KEY (id, chat_jid))"
    )
    conn.execute(
        "INSERT INTO chats (jid, name) VALUES (?, ?)",
        ("306912345678@s.whatsapp.net", "Test Contact"),
    )
    conn.execute(
        "INSERT INTO chats (jid, name) VALUES (?, ?)",
        ("120363025526@g.us", "Family Group"),
    )
    conn.commit()
    conn.close()
    return db_path


def _insert_message(
    db_path: Path,
    *,
    msg_id: str = "MSG001",
    chat_jid: str = "120363025526@g.us",
    sender: str = "306912345678",
    content: str = "hello",
    timestamp: str = "2026-06-26T18:00:00+03:00",
    is_from_me: bool = False,
) -> None:
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO messages (id, chat_jid, sender, content, timestamp, is_from_me) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (msg_id, chat_jid, sender, content, timestamp, is_from_me),
    )
    conn.commit()
    conn.close()


@pytest.fixture
def wa_adapter(wa_db: Path) -> monitor.WhatsAppAdapter:
    return monitor.WhatsAppAdapter({"db_path": str(wa_db), "api_url": "http://localhost:9999"})


# ---------------------------------------------------------------------------
# fetch_messages
# ---------------------------------------------------------------------------


def test_wa_fetch_messages_returns_normalized(wa_db, wa_adapter):
    """WhatsApp adapter returns NormalizedMessage instances."""
    _insert_message(wa_db, msg_id="M1", content="hi there")
    msgs = wa_adapter.fetch_messages("120363025526@g.us", limit=10)
    assert len(msgs) == 1
    msg = msgs[0]
    assert isinstance(msg, monitor.NormalizedMessage)
    assert msg.msg_id == "M1"
    assert msg.body == "hi there"
    assert msg.service == "whatsapp"
    assert msg.is_self is False


def test_wa_fetch_messages_resolves_sender_name(wa_db, wa_adapter):
    """Sender JID is resolved to contact name from chats table."""
    _insert_message(wa_db, sender="306912345678", content="yo")
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    assert msgs[0].sender == "Test Contact"


def test_wa_fetch_messages_own_messages_marked_self(wa_db, wa_adapter):
    """Messages with is_from_me=True are marked as self."""
    _insert_message(wa_db, msg_id="M1", content="my msg", is_from_me=True)
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    assert msgs[0].is_self is True
    assert msgs[0].sender == "Me"


def test_wa_fetch_messages_claude_tag_marked_self(wa_db, wa_adapter):
    """Messages starting with [Claude] are marked as self even if is_from_me=False."""
    _insert_message(wa_db, msg_id="M1", content="[Claude] auto reply", is_from_me=False)
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    assert msgs[0].is_self is True


def test_wa_fetch_messages_empty_content_excluded(wa_db, wa_adapter):
    """Messages with empty content are filtered out by the SQL query."""
    _insert_message(wa_db, msg_id="M1", content="")
    _insert_message(wa_db, msg_id="M2", content="real message")
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    assert len(msgs) == 1
    assert msgs[0].msg_id == "M2"


def test_wa_fetch_messages_newest_first(wa_db, wa_adapter):
    """Messages are returned newest-first (matching Teams behavior)."""
    _insert_message(wa_db, msg_id="M1", content="older", timestamp="2026-06-26T10:00:00+03:00")
    _insert_message(wa_db, msg_id="M2", content="newer", timestamp="2026-06-26T18:00:00+03:00")
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    assert msgs[0].msg_id == "M2"
    assert msgs[1].msg_id == "M1"


def test_wa_fetch_messages_respects_limit(wa_db, wa_adapter):
    """Limit parameter caps the number of messages returned."""
    for i in range(5):
        _insert_message(
            wa_db,
            msg_id=f"M{i}",
            content=f"msg {i}",
            timestamp=f"2026-06-26T1{i}:00:00+03:00",
        )
    msgs = wa_adapter.fetch_messages("120363025526@g.us", limit=3)
    assert len(msgs) == 3


# ---------------------------------------------------------------------------
# cursor operations
# ---------------------------------------------------------------------------


def test_wa_messages_after_cursor(wa_db, wa_adapter):
    """messages_after_cursor filters by timestamp and sorts chronologically."""
    _insert_message(wa_db, msg_id="M1", content="old", timestamp="2026-06-26T10:00:00+03:00")
    _insert_message(wa_db, msg_id="M2", content="new", timestamp="2026-06-26T18:00:00+03:00")
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    new = wa_adapter.messages_after_cursor(msgs, "2026-06-26T12:00:00+03:00")
    assert len(new) == 1
    assert new[0].msg_id == "M2"


def test_wa_messages_after_cursor_none_returns_empty(wa_db, wa_adapter):
    """None cursor returns empty list (cold start behavior)."""
    _insert_message(wa_db, msg_id="M1", content="hi")
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    assert wa_adapter.messages_after_cursor(msgs, None) == []


def test_wa_cold_start_cursor(wa_db, wa_adapter):
    """cold_start_cursor returns the newest message's timestamp."""
    _insert_message(wa_db, msg_id="M1", content="old", timestamp="2026-06-26T10:00:00+03:00")
    _insert_message(wa_db, msg_id="M2", content="new", timestamp="2026-06-26T18:00:00+03:00")
    msgs = wa_adapter.fetch_messages("120363025526@g.us")
    cursor = wa_adapter.cold_start_cursor(msgs)
    assert cursor == "2026-06-26T18:00:00+03:00"


# ---------------------------------------------------------------------------
# send_message
# ---------------------------------------------------------------------------


def test_wa_send_message_posts_to_api(wa_adapter):
    """send_message POSTs JSON to the Go bridge API."""
    response = json.dumps({"success": True, "message": "sent"}).encode()
    mock_resp = MagicMock()
    mock_resp.read.return_value = response
    mock_resp.__enter__ = MagicMock(return_value=mock_resp)
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_resp) as mock_url:
        wa_adapter.send_message("120363025526@g.us", "[Claude] test reply")
        req = mock_url.call_args[0][0]
        assert req.full_url == "http://localhost:9999/api/send"
        body = json.loads(req.data)
        assert body["recipient"] == "120363025526@g.us"
        assert body["message"] == "[Claude] test reply"


def test_wa_send_message_raises_on_failure(wa_adapter):
    """send_message raises WhatsAppBridgeError when API returns success=false."""
    response = json.dumps({"success": False, "message": "not registered"}).encode()
    mock_resp = MagicMock()
    mock_resp.read.return_value = response
    mock_resp.__enter__ = MagicMock(return_value=mock_resp)
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_resp):
        with pytest.raises(monitor.WhatsAppBridgeError, match="not registered"):
            wa_adapter.send_message("120363025526@g.us", "test")


def test_wa_send_message_raises_on_network_error(wa_adapter):
    """send_message raises WhatsAppBridgeError when bridge is unreachable."""
    import urllib.error

    with patch(
        "urllib.request.urlopen",
        side_effect=urllib.error.URLError("Connection refused"),
    ):
        with pytest.raises(monitor.WhatsAppBridgeError, match="unreachable"):
            wa_adapter.send_message("120363025526@g.us", "test")


# ---------------------------------------------------------------------------
# auth
# ---------------------------------------------------------------------------


def test_wa_check_auth_succeeds_with_valid_db(wa_db, wa_adapter):
    """check_auth does not raise when DB is readable."""
    wa_adapter.check_auth()


def test_wa_check_auth_raises_on_missing_db(tmp_path):
    """check_auth raises AdapterAuthError when DB file is missing."""
    adapter = monitor.WhatsAppAdapter({"db_path": str(tmp_path / "nonexistent.db")})
    with pytest.raises(monitor.AdapterAuthError):
        adapter.check_auth()


def test_wa_renew_auth_is_noop(wa_adapter):
    """renew_auth always returns True (no auth renewal for WhatsApp)."""
    assert wa_adapter.renew_auth() is True


def test_wa_supports_auth_renewal_is_false(wa_adapter):
    """WhatsApp adapter does not support auth renewal."""
    assert wa_adapter.supports_auth_renewal is False


# ---------------------------------------------------------------------------
# Integration: run_once_for_chat with WhatsApp
# ---------------------------------------------------------------------------


def test_wa_run_once_cold_start(wa_db, tmp_path, monkeypatch):
    """First poll sets cursor without processing messages."""
    monkeypatch.setattr(monitor, "LOG_FILE", tmp_path / "log.jsonl")
    _insert_message(wa_db, msg_id="M1", content="hello", timestamp="2026-06-26T18:00:00+03:00")

    prompts_dir = tmp_path / "prompts"
    prompts_dir.mkdir()
    template = prompts_dir / "wa.txt"
    template.write_text(
        "{sender} {composed_at} {new_text} {thread_context} {chat_context} {recall_context}"
    )

    state_path = tmp_path / "state-wa-test.json"
    cfg = monitor.ChatConfig(
        label="wa-test",
        chat_id="120363025526@g.us",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=True,
        service="whatsapp",
    )
    adapter = monitor.WhatsAppAdapter({"db_path": str(wa_db)})

    with patch.object(
        monitor.ChatConfig, "state_file", new_callable=lambda: property(lambda self: state_path)
    ):
        monitor.run_once_for_chat(cfg, adapter, now=datetime.now(UTC), dry_run=True)

    state = monitor.load_state(state_path)
    assert state[monitor._CURSOR_KEY] == "2026-06-26T18:00:00+03:00"
    assert state["first_run_at"] is not None
