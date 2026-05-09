"""Tests for monitor.py."""

import subprocess
import sys
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import pytest

# Make plugins/chat-watch importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import monitor  # noqa: E402


def test_first_run_cold_start_no_state_file(state_file):
    """Empty state dir → load_state returns default state with last_seen=None."""
    assert not state_file.exists()
    state = monitor.load_state(state_file)
    assert state["last_seen_message_id"] is None
    assert state["replies"] == []
    assert state["first_run_at"] is None


def test_state_file_corrupt_falls_back_to_default(state_file):
    """Corrupt JSON in state file → load returns default, no crash."""
    state_file.write_text("not valid json {{{")
    state = monitor.load_state(state_file)
    assert state == monitor.default_state()


def test_rate_limiter_hourly_window(now):
    """5 replies in last 60min → 6th blocked. One drops off → next allowed."""
    state = monitor.default_state()
    # 5 replies in the last 30 minutes — all within the rolling hour
    for i in range(5):
        ts = (now - timedelta(minutes=30 - i)).isoformat()
        state["replies"].append({"ts": ts, "thread_id": f"t{i}", "text": "..."})

    # 6th attempt: blocked
    assert monitor.rate_limit_ok(state, "t-new", now=now) is False

    # Now move 'now' forward 35 minutes — the first reply (35min back when set,
    # plus the 35min jump = 65min ago) drops off
    later = now + timedelta(minutes=35)
    assert monitor.rate_limit_ok(state, "t-new", now=later) is True


def test_rate_limiter_per_thread_cooldown(now):
    """Replied to thread X 5min ago → blocked. Same thread 11min ago → allowed."""
    state = monitor.default_state()
    state["replies"].append(
        {
            "ts": (now - timedelta(minutes=5)).isoformat(),
            "thread_id": "thread-A",
            "text": "earlier",
        }
    )

    # Same thread within 10min cooldown: blocked
    assert monitor.rate_limit_ok(state, "thread-A", now=now) is False

    # Different thread: allowed
    assert monitor.rate_limit_ok(state, "thread-B", now=now) is True

    # Same thread 11min later: allowed
    later = now + timedelta(minutes=6)  # makes original reply 11min old
    assert monitor.rate_limit_ok(state, "thread-A", now=later) is True


def test_self_loop_guard():
    """Messages whose visible text starts with [Claude] (any case, leading WS) skip."""
    assert monitor.is_self_message("[Claude] hello") is True
    assert monitor.is_self_message("[claude] hi") is True
    assert monitor.is_self_message("[CLAUDE] yo") is True
    assert monitor.is_self_message("  [Claude] padded") is True
    assert monitor.is_self_message("\t[Claude] tabbed") is True
    # HTML-wrapped content (teams-cli returns HTML bodies)
    assert monitor.is_self_message("<p>[Claude] from html</p>") is True
    assert monitor.is_self_message("<div><p>[Claude] nested</p></div>") is True
    # Negatives
    assert monitor.is_self_message("hello there") is False
    assert monitor.is_self_message("look at [Claude]'s reply") is False  # tag not at start
    assert monitor.is_self_message("") is False


def test_json_parser_tolerates_prose():
    """Extracts JSON from output even if LLM adds prose around it."""
    raw = 'thinking out loud... {"reply": false, "reason": "no context"} done.'
    decision = monitor.parse_decision(raw)
    assert decision == {"reply": False, "reason": "no context"}


def test_json_parser_handles_clean_json():
    """Pure JSON string parses cleanly."""
    decision = monitor.parse_decision('{"reply": true, "text": "hi", "reason": "ok"}')
    assert decision is not None
    assert decision["reply"] is True
    assert decision["text"] == "hi"


def test_json_parser_returns_none_on_garbage():
    """Non-JSON output returns None (caller treats as skip)."""
    assert monitor.parse_decision("just prose, no braces at all") is None


def test_json_parser_returns_none_on_missing_keys():
    """Valid JSON without required 'reply' key returns None."""
    assert monitor.parse_decision('{"foo": "bar"}') is None


def _write_synthetic_config(tmp_path: Path) -> tuple[Path, Path]:
    """Build a minimal valid chats.json + prompt template under tmp_path."""
    prompts_dir = tmp_path / "prompts"
    prompts_dir.mkdir()
    template = prompts_dir / "synthetic.txt"
    template.write_text(
        "PERSONALITY: synthetic test prompt with a Dry wit example.\n"
        "Sender: {sender}\nTime:   {composed_at}\nText:   {new_text}\n"
        "Thread: {thread_context}\nChat: {chat_context}\nRecall: {recall_context}\n"
        '{{"reply": false, "reason": "..."}} OR {{"reply": true, "text": "...", "reason": "..."}}\n'
    )
    cfg = tmp_path / "chats.json"
    cfg.write_text(
        '{"chats": [{"label": "synthetic", "id": "19:abc@thread.v2",'
        ' "prompt_template": "prompts/synthetic.txt",'
        ' "max_replies_per_hour": 5, "per_thread_cooldown_minutes": 10}]}'
    )
    return cfg, template


def test_build_prompt_substitutes_slots(tmp_path: Path):
    """build_prompt fills the template slots and never mutates the literal braces in the JSON example."""
    _, template_path = _write_synthetic_config(tmp_path)
    prompt = monitor.build_prompt(
        template_path,
        sender="Alice",
        composed_at="2026-05-05T10:00:00Z",
        new_text="Has this happened before?",
        thread_context="(none)",
        chat_context="(none)",
        recall_context="(none)",
    )
    # Slot substitutions present
    assert "Sender: Alice" in prompt
    assert "Time:   2026-05-05T10:00:00Z" in prompt
    assert "Text:   Has this happened before?" in prompt
    # Personality block placeholder survived
    assert "PERSONALITY" in prompt
    assert "Dry wit" in prompt
    # JSON example survived format() (literal braces preserved as {{ and }})
    assert '{"reply": false' in prompt
    assert '{"reply": true' in prompt


def test_load_chat_configs_resolves_relative_template_against_config_dir(tmp_path: Path):
    """Relative prompt_template paths resolve against chats.json's directory."""
    cfg, template = _write_synthetic_config(tmp_path)
    configs = monitor.load_chat_configs(cfg)
    assert len(configs) == 1
    assert configs[0].prompt_template_path == template


def test_load_chat_configs_accepts_absolute_template_path(tmp_path: Path):
    """Absolute prompt_template paths are used as-is, ignoring config dir."""
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    template = elsewhere / "tpl.txt"
    template.write_text("ok\n")
    cfg = tmp_path / "chats.json"
    cfg.write_text(
        f'{{"chats": [{{"label": "a", "id": "19:x@thread.v2", "prompt_template": "{template}"}}]}}'
    )
    configs = monitor.load_chat_configs(cfg)
    assert configs[0].prompt_template_path == template


def test_load_chat_configs_rejects_missing_template(tmp_path: Path):
    """A chat entry pointing at a non-existent template file fails fast."""
    cfg = tmp_path / "chats.json"
    cfg.write_text(
        '{"chats": [{"label": "x", "id": "19:abc@thread.v2",'
        ' "prompt_template": "prompts/does_not_exist.txt"}]}'
    )
    with pytest.raises(ValueError, match="prompt template not found"):
        monitor.load_chat_configs(cfg)


def test_load_chat_configs_rejects_duplicate_labels(tmp_path: Path):
    """Two chat entries with the same label fail validation."""
    prompts_dir = tmp_path / "prompts"
    prompts_dir.mkdir()
    (prompts_dir / "x.txt").write_text("ok\n")
    cfg = tmp_path / "chats.json"
    cfg.write_text(
        '{"chats": ['
        '{"label": "dup", "id": "1", "prompt_template": "prompts/x.txt"},'
        '{"label": "dup", "id": "2", "prompt_template": "prompts/x.txt"}'
        "]}"
    )
    with pytest.raises(ValueError, match="duplicate label"):
        monitor.load_chat_configs(cfg)


def test_load_chat_configs_missing_file_helpful_error(tmp_path: Path):
    """A missing chats.json points the user at chats.example.json."""
    missing = tmp_path / "chats.json"
    with pytest.raises(FileNotFoundError, match="chats.example.json"):
        monitor.load_chat_configs(missing)


def test_default_config_path_is_under_state_dir():
    """The default config path lives next to state files, not inside the repo."""
    assert monitor.DEFAULT_CONFIG_PATH == monitor.STATE_DIR / "chats.json"


def test_chat_config_state_file_is_label_scoped():
    """Each chat gets its own state-<label>.json under the shared state dir."""
    cfg = monitor.ChatConfig(
        label="manoli",
        chat_id="19:x@unq.gbl.spaces",
        prompt_template_path=Path("/nonexistent.txt"),
        max_replies_per_hour=2,
        per_thread_cooldown_minutes=30,
        dry_run=False,
    )
    assert cfg.state_file.name == "state-manoli.json"
    assert cfg.state_file.parent == monitor.STATE_DIR


def test_extract_thread_messages_filters_by_thread_id(msg_factory, now):
    msgs = [
        msg_factory(msg_id="1", thread_id="t-A", text="hi"),
        msg_factory(msg_id="2", thread_id="t-B", text="other"),
        msg_factory(msg_id="3", thread_id="t-A", text="reply"),
    ]
    new_msg = msg_factory(msg_id="4", thread_id="t-A", text="latest")
    out = monitor.extract_thread_messages(msgs, new_msg)
    assert len(out) == 2  # excludes new_msg itself
    assert [m["id"] for m in out] == ["1", "3"]


def test_extract_chat_24h_includes_only_last_day(msg_factory, now):
    old = msg_factory(msg_id="1", composed_at="2026-05-04T10:00:00.000Z")
    recent = msg_factory(msg_id="2", composed_at="2026-05-05T13:00:00.000Z")
    new_msg = msg_factory(msg_id="3", composed_at="2026-05-05T13:30:00.000Z")
    out = monitor.extract_chat_24h([old, recent], new_msg, now=now)
    assert [m["id"] for m in out] == ["2"]  # 'old' is >24h before new_msg


def test_format_messages_html_stripped_and_truncated(msg_factory):
    msgs = [
        msg_factory(msg_id="1", sender="Maria", text="<p>Hello <b>world</b></p>"),
    ]
    out = monitor.format_messages(msgs)
    assert "Maria: Hello world" in out
    assert "<p>" not in out and "<b>" not in out


def test_run_teams_cli_returns_parsed_json():
    """run_teams_cli passes args through subprocess and parses JSON stdout."""
    fake = subprocess.CompletedProcess(
        args=["teams-cli", "list-messages"],
        returncode=0,
        stdout='{"messages": []}',
        stderr="",
    )
    with patch("subprocess.run", return_value=fake) as mock_run:
        result = monitor.run_teams_cli(["list-messages", "--chat", "X"])
        assert result == {"messages": []}
        # Verify --no-auto-reauth is appended
        called_args = mock_run.call_args[0][0]
        assert "--no-auto-reauth" in called_args


def test_run_teams_cli_raises_on_auth_error():
    """Exit code 4 raises TeamsCliAuthRequired."""
    fake = subprocess.CompletedProcess(
        args=["teams-cli", "list-messages"],
        returncode=4,
        stdout="",
        stderr="auth required",
    )
    with patch("subprocess.run", return_value=fake):
        with pytest.raises(monitor.TeamsCliAuthRequired):
            monitor.run_teams_cli(["list-messages", "--chat", "X"])


def test_invoke_claude_returns_stdout():
    """invoke_claude passes prompt via stdin and returns stdout."""
    fake = subprocess.CompletedProcess(
        args=["claude", "--print"],
        returncode=0,
        stdout='{"reply": false, "reason": "ok"}\n',
        stderr="",
    )
    with patch("subprocess.run", return_value=fake) as mock_run:
        out = monitor.invoke_claude("test prompt")
        assert out.strip() == '{"reply": false, "reason": "ok"}'
        # Verify --model sonnet is in args
        called_args = mock_run.call_args[0][0]
        assert "--model" in called_args
        assert "sonnet" in called_args
        assert "--print" in called_args


def test_invoke_claude_raises_on_timeout():
    """Subprocess timeout raises ClaudeCliError."""
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="claude", timeout=30)):
        with pytest.raises(monitor.ClaudeCliError):
            monitor.invoke_claude("test prompt")
