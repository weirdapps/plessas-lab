"""Shared pytest fixtures for monitor tests."""

from datetime import UTC, datetime
from pathlib import Path

import pytest


@pytest.fixture
def state_file(tmp_path: Path) -> Path:
    """Returns a path to a non-existent state file in a temp dir."""
    return tmp_path / "state.json"


@pytest.fixture
def now() -> datetime:
    """Fixed 'now' for deterministic time-based tests."""
    return datetime(2026, 5, 5, 13, 30, 0, tzinfo=UTC)


def make_message(
    msg_id: str = "1",
    sender: str = "Test User",
    text: str = "hello",
    thread_id: str | None = "thread-a",
    composed_at: str = "2026-05-05T13:30:00.000Z",
) -> dict:
    """Build a teams-cli list-messages-shaped message dict.

    Real teams-cli output is FLAT — `imdisplayname`, `content`, `composetime`,
    not nested. Group chats also have NO threading fields. The optional
    ``_thread_id`` test-only field lets us exercise the per-thread cooldown
    logic in unit tests, but has no analogue in production data.
    """
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


@pytest.fixture
def msg_factory():
    """Returns the make_message helper."""
    return make_message
