"""Tests for the _platform.require_macos() OS-guard helper.

This is the gate that the 5 osascript-driven scripts (list/create/read/delete-note,
attach-clipboard-image) call at entry to fail cleanly on non-macOS instead of
letting subprocess raise FileNotFoundError on 'osascript'.
"""

import sys
from pathlib import Path

import pytest

# Make plugins/manage-apple-notes/skills/manage-apple-notes/scripts importable
sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "skills/manage-apple-notes/scripts"),
)

from _platform import require_macos  # noqa: E402  # type: ignore[import-not-found]


def test_require_macos_noop_on_darwin(monkeypatch, capsys):
    """On macOS, the guard returns silently and prints nothing."""
    monkeypatch.setattr(sys, "platform", "darwin")
    require_macos("test-script.py")
    captured = capsys.readouterr()
    assert captured.err == ""
    assert captured.out == ""


def test_require_macos_exits_on_linux(monkeypatch, capsys):
    """On Linux, the guard exits 1 with a friendly stderr message."""
    monkeypatch.setattr(sys, "platform", "linux")
    with pytest.raises(SystemExit) as exc:
        require_macos("list-notes.py")
    assert exc.value.code == 1
    captured = capsys.readouterr()
    assert "manage-apple-notes is macOS-only" in captured.err
    assert "list-notes.py" in captured.err
    assert "linux" in captured.err
    assert "Notes.app" in captured.err
    # The friendly message should NOT include any traceback markers
    assert "Traceback" not in captured.err
    assert "FileNotFoundError" not in captured.err


def test_require_macos_exits_on_windows(monkeypatch, capsys):
    """On Windows (sys.platform == 'win32'), the guard exits 1 with a friendly message."""
    monkeypatch.setattr(sys, "platform", "win32")
    with pytest.raises(SystemExit) as exc:
        require_macos("attach-clipboard-image.py")
    assert exc.value.code == 1
    captured = capsys.readouterr()
    assert "manage-apple-notes is macOS-only" in captured.err
    assert "attach-clipboard-image.py" in captured.err
    assert "win32" in captured.err


def test_require_macos_uses_default_script_name_when_omitted(monkeypatch, capsys):
    """When called without an explicit script_name, the default 'this script' is used."""
    monkeypatch.setattr(sys, "platform", "linux")
    with pytest.raises(SystemExit):
        require_macos()
    captured = capsys.readouterr()
    assert "this script" in captured.err


def test_startswith_form_matches_darwin_variants(monkeypatch, capsys):
    """The startswith('darwin') form should accept any 'darwin*' platform string.

    macOS sometimes reports sys.platform as 'darwin', and on rare builds as
    'darwin23' or similar. Verify the guard accepts both rather than only
    matching the exact string.
    """
    for darwin_variant in ["darwin", "darwin22", "darwin23.6.0"]:
        monkeypatch.setattr(sys, "platform", darwin_variant)
        # Should not raise — startswith('darwin') matches all of these
        require_macos("test")
        captured = capsys.readouterr()
        assert captured.err == "", f"Unexpected stderr on {darwin_variant}: {captured.err}"
