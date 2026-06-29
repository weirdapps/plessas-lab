"""Shared pytest fixtures for monitor tests."""

# Make plugins/chat-watch importable
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import monitor  # noqa: E402


@pytest.fixture
def state_file(tmp_path: Path) -> Path:
    """Returns a path to a non-existent state file in a temp dir."""
    return tmp_path / "state.json"


@pytest.fixture
def now() -> datetime:
    """Fixed 'now' for deterministic time-based tests."""
    return datetime(2026, 5, 5, 13, 30, 0, tzinfo=UTC)


def make_raw_teams_message(
    msg_id: str = "1",
    sender: str = "Test User",
    text: str = "hello",
    thread_id: str | None = "thread-a",
    composed_at: str = "2026-05-05T13:30:00.000Z",
) -> dict:
    """Build a teams-cli list-messages-shaped message dict (raw, pre-normalization)."""
    msg: dict = {
        "id": msg_id,
        "imdisplayname": sender,
        "content": text,
        "messagetype": "RichText/Html",
        "composetime": composed_at,
    }
    if thread_id is not None:
        msg["_thread_id"] = thread_id
    return msg


def make_message(
    msg_id: str = "1",
    sender: str = "Test User",
    text: str = "hello",
    thread_id: str | None = "thread-a",
    composed_at: str = "2026-05-05T13:30:00.000Z",
    service: str = "teams",
) -> monitor.NormalizedMessage:
    """Build a NormalizedMessage for direct use in process_message tests."""
    body = monitor._strip_html(text).strip()
    return monitor.NormalizedMessage(
        cursor_key=msg_id,
        msg_id=msg_id,
        sender=sender,
        body=body,
        composed_at=monitor._parse_ts(composed_at),
        is_self=monitor.is_self_message(text),
        service=service,
        thread_id=thread_id,
    )


@pytest.fixture
def msg_factory():
    """Returns the make_message helper (NormalizedMessage)."""
    return make_message


@pytest.fixture
def raw_msg_factory():
    """Returns the make_raw_teams_message helper (raw dict)."""
    return make_raw_teams_message


@pytest.fixture
def teams_adapter():
    """Returns a TeamsAdapter instance for tests."""
    return monitor.TeamsAdapter()
