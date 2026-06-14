"""Tests for monitor.py."""

import json
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


def _claude_envelope(result, stop_reason="end_turn", is_error=False):
    """A `claude --output-format json` stdout envelope as a CompletedProcess."""
    return subprocess.CompletedProcess(
        args=["claude"],
        returncode=0,
        stdout=json.dumps({"result": result, "stop_reason": stop_reason, "is_error": is_error}),
        stderr="",
    )


def test_invoke_claude_returns_result():
    """invoke_claude requests the JSON envelope and returns its `result` text."""
    fake = _claude_envelope('{"reply": false, "reason": "ok"}')
    with patch("subprocess.run", return_value=fake) as mock_run:
        out = monitor.invoke_claude("test prompt")
        assert out == '{"reply": false, "reason": "ok"}'
        called_args = mock_run.call_args[0][0]
        assert "--model" in called_args
        assert "--print" in called_args
        assert "--output-format" in called_args and "json" in called_args


def test_invoke_claude_raises_on_timeout():
    """Subprocess timeout raises ClaudeCliError."""
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="claude", timeout=30)):
        with pytest.raises(monitor.ClaudeCliError):
            monitor.invoke_claude("test prompt")


def test_invoke_claude_default_timeout_is_at_least_240_seconds():
    """Vertex AI tail latency on Opus can blow past 120s. Default must be ≥240s."""
    assert monitor.CLAUDE_TIMEOUT_SECONDS >= 240


def test_invoke_claude_downgrades_on_policy_refusal(tmp_path, monkeypatch):
    """A spurious 'anthropic policy' refusal auto-retries on the Opus 4.6 /
    europe-west1 fallback tier (model AND region together)."""
    monkeypatch.setattr(monitor, "LOG_FILE", tmp_path / "log.jsonl")
    refusal = _claude_envelope("I can't help with that.", stop_reason="refusal")
    ok = _claude_envelope("REPLY_OK")
    with patch("subprocess.run", side_effect=[refusal, ok]) as mock_run:
        out = monitor.invoke_claude("test prompt")
    assert out == "REPLY_OK"
    assert mock_run.call_count == 2
    second = mock_run.call_args_list[1]
    assert "claude-opus-4-6[1m]" in second[0][0]
    assert second[1]["env"]["CLOUD_ML_REGION"] == "europe-west1"


def test_invoke_claude_downgrades_on_api_error(tmp_path, monkeypatch):
    """An is_error envelope (e.g. a 429) also triggers the fallback retry."""
    monkeypatch.setattr(monitor, "LOG_FILE", tmp_path / "log.jsonl")
    err = _claude_envelope("API Error: 429 quota", stop_reason="stop_sequence", is_error=True)
    ok = _claude_envelope("REPLY_OK")
    with patch("subprocess.run", side_effect=[err, ok]) as mock_run:
        out = monitor.invoke_claude("test prompt")
    assert out == "REPLY_OK"
    assert mock_run.call_count == 2
    assert "claude-opus-4-6[1m]" in mock_run.call_args_list[1][0][0]


# --- Resilient-error-handling regression tests (the "Σιωπή..." incident, 2026-05-09) ---


def _patch_recall(monkeypatch):
    """Stub fetch_recall_hits so tests never touch the real second-brain DB."""
    monkeypatch.setattr(monitor, "fetch_recall_hits", lambda _q: "(stubbed)")


def _isolate_log(monkeypatch, tmp_path):
    """Redirect LOG_FILE to tmp_path so tests don't pollute the real chat-watch log."""
    monkeypatch.setattr(monitor, "LOG_FILE", tmp_path / "log.jsonl")


def test_process_message_returns_false_on_llm_timeout(tmp_path, msg_factory, now, monkeypatch):
    """LLM timeout → process_message returns False (don't advance cursor) and bumps attempts."""
    _patch_recall(monkeypatch)
    _isolate_log(monkeypatch, tmp_path)
    _, template = _write_synthetic_config(tmp_path)
    cfg = monitor.ChatConfig(
        label="t",
        chat_id="c",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=False,
    )
    state = monitor.default_state()
    state["last_seen_message_id"] = "0"
    msg = msg_factory(msg_id="42", text="hello")

    with patch.object(monitor, "invoke_claude", side_effect=monitor.ClaudeCliError("timed out")):
        advance = monitor.process_message(msg, [msg], state, cfg, now=now, dry_run=False)

    assert advance is False
    assert state["attempts"]["42"] == 1


def test_process_message_gives_up_after_max_attempts(tmp_path, msg_factory, now, monkeypatch):
    """After MAX_LLM_ATTEMPTS retries on the same msg_id, advance the cursor (don't deadlock)."""
    _patch_recall(monkeypatch)
    _isolate_log(monkeypatch, tmp_path)
    _, template = _write_synthetic_config(tmp_path)
    cfg = monitor.ChatConfig(
        label="t",
        chat_id="c",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=False,
    )
    state = monitor.default_state()
    state["last_seen_message_id"] = "0"
    state["attempts"] = {"42": monitor.MAX_LLM_ATTEMPTS - 1}  # one more failure → give up
    msg = msg_factory(msg_id="42", text="hello")

    with patch.object(monitor, "invoke_claude", side_effect=monitor.ClaudeCliError("timed out")):
        with patch.object(monitor, "notify_user") as notify:
            advance = monitor.process_message(msg, [msg], state, cfg, now=now, dry_run=False)

    assert advance is True  # cursor advances on give-up
    assert "42" not in state.get("attempts", {})  # cleanup
    notify.assert_called_once()  # user gets a heads-up


def test_process_message_clears_attempts_on_success(tmp_path, msg_factory, now, monkeypatch):
    """After a previous transient failure, a successful LLM call clears the attempt counter."""
    _patch_recall(monkeypatch)
    _isolate_log(monkeypatch, tmp_path)
    _, template = _write_synthetic_config(tmp_path)
    cfg = monitor.ChatConfig(
        label="t",
        chat_id="c",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=False,
    )
    state = monitor.default_state()
    state["last_seen_message_id"] = "0"
    state["attempts"] = {"42": 1}
    msg = msg_factory(msg_id="42", text="hello")

    with patch.object(monitor, "invoke_claude", return_value='{"reply": false, "reason": "noop"}'):
        advance = monitor.process_message(msg, [msg], state, cfg, now=now, dry_run=True)

    assert advance is True
    assert "42" not in state.get("attempts", {})


def test_run_once_does_not_advance_cursor_on_transient_error(
    tmp_path, msg_factory, now, monkeypatch
):
    """The original bug: LLM timeout must NOT advance last_seen_message_id."""
    _patch_recall(monkeypatch)
    _isolate_log(monkeypatch, tmp_path)
    _, template = _write_synthetic_config(tmp_path)
    state_path = tmp_path / "state-t.json"
    cfg = monitor.ChatConfig(
        label="t",
        chat_id="c",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=False,
    )
    # Pre-seed cursor so we're past cold-start
    monitor.save_state(state_path, {**monitor.default_state(), "last_seen_message_id": "10"})
    new_msg = msg_factory(msg_id="42", text="hello")

    with (
        patch.object(monitor, "list_messages", return_value=[new_msg]),
        patch.object(monitor, "invoke_claude", side_effect=monitor.ClaudeCliError("timed out")),
        patch.object(
            monitor.ChatConfig, "state_file", new_callable=lambda: property(lambda self: state_path)
        ),
    ):
        monitor.run_once_for_chat(cfg, now=now, dry_run=False)

    final_state = monitor.load_state(state_path)
    assert final_state["last_seen_message_id"] == "10"  # cursor did NOT advance
    assert final_state["attempts"]["42"] == 1


# --- Reliability improvements (VPS crash-loop fix, 2026-06-14) ---


def test_save_state_atomic(tmp_path):
    """save_state writes atomically via tmp+rename — partial writes don't corrupt."""
    state_path = tmp_path / "state.json"
    original: dict = {
        "last_seen_message_id": "100",
        "replies": [],
        "first_run_at": None,
        "attempts": {},
    }
    monitor.save_state(state_path, original)

    # Verify the .tmp file is cleaned up (renamed away)
    assert not state_path.with_suffix(".tmp").exists()

    # Verify content is correct
    loaded = monitor.load_state(state_path)
    assert loaded["last_seen_message_id"] == "100"


def test_save_state_preserves_original_on_rename_failure(tmp_path):
    """If rename fails, the original state file survives."""
    state_path = tmp_path / "state.json"
    original: dict = {
        "last_seen_message_id": "50",
        "replies": [],
        "first_run_at": None,
        "attempts": {},
    }
    monitor.save_state(state_path, original)

    # Simulate: write new state where rename would fail
    new_state: dict = {
        "last_seen_message_id": "999",
        "replies": [],
        "first_run_at": None,
        "attempts": {},
    }
    with patch.object(Path, "rename", side_effect=OSError("disk full")):
        with pytest.raises(OSError):
            monitor.save_state(state_path, new_state)

    # Original survives
    loaded = monitor.load_state(state_path)
    assert loaded["last_seen_message_id"] == "50"


def test_startup_auth_retries_with_backoff(tmp_path, monkeypatch):
    """_startup_auth retries on TeamsCliAuthRequired with increasing backoff."""
    _isolate_log(monkeypatch, tmp_path)
    monkeypatch.setattr(monitor, "_shutdown_requested", False)

    call_count = 0

    def fake_run_teams_cli(args):
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            raise monitor.TeamsCliAuthRequired("auth required")
        return {"status": "ok"}

    with (
        patch.object(monitor, "run_teams_cli", side_effect=fake_run_teams_cli),
        patch.object(monitor, "_try_auth_renew", return_value=False),
        patch.object(monitor, "_interruptible_sleep"),
    ):
        # Third call succeeds
        result = monitor._startup_auth(max_attempts=5)

    assert result is True
    assert call_count == 3


def test_startup_auth_exhaustion(tmp_path, monkeypatch):
    """_startup_auth returns False after max_attempts exhausted."""
    _isolate_log(monkeypatch, tmp_path)
    monkeypatch.setattr(monitor, "_shutdown_requested", False)

    with (
        patch.object(monitor, "run_teams_cli", side_effect=monitor.TeamsCliAuthRequired("no")),
        patch.object(monitor, "_try_auth_renew", return_value=False),
        patch.object(monitor, "_interruptible_sleep"),
    ):
        result = monitor._startup_auth(max_attempts=3)

    assert result is False


def test_midloop_auth_failure_does_not_exit(tmp_path, msg_factory, now, monkeypatch):
    """Mid-loop auth failure skips remaining chats but does NOT return 2."""
    _patch_recall(monkeypatch)
    _isolate_log(monkeypatch, tmp_path)
    monkeypatch.setattr(monitor, "_shutdown_requested", False)
    monkeypatch.setattr(monitor, "HEARTBEAT_FILE", tmp_path / "heartbeat")

    _, template = _write_synthetic_config(tmp_path)
    cfg = monitor.ChatConfig(
        label="t",
        chat_id="c",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=False,
    )

    poll_count = 0

    def fake_run_once(chat_cfg, *, now, dry_run):
        nonlocal poll_count
        poll_count += 1
        if poll_count == 1:
            raise monitor.TeamsCliAuthRequired("expired")
        # After first cycle, request shutdown to exit the loop
        monitor._shutdown_requested = True

    with (
        patch.object(monitor, "_startup_auth", return_value=True),
        patch.object(monitor, "run_once_for_chat", side_effect=fake_run_once),
        patch.object(monitor, "_try_auth_renew", return_value=False),
        patch.object(monitor, "load_state", return_value=monitor.default_state()),
        patch.object(monitor, "sd_notify"),
    ):
        exit_code = monitor.main_loop([cfg], dry_run=False, poll_seconds=1)

    # Should exit cleanly via shutdown signal, NOT exit 2
    assert exit_code == 0
    monkeypatch.setattr(monitor, "_shutdown_requested", False)


def test_cached_recall_connection(monkeypatch):
    """fetch_recall_hits reuses the cached connection on subsequent calls."""
    # Reset module-level cache
    monkeypatch.setattr(monitor, "_recall_conn", None)
    monkeypatch.setattr(monitor, "_recall_fn", None)

    conn_calls = 0
    fake_conn = object()

    def fake_get_connection(path):
        nonlocal conn_calls
        conn_calls += 1
        return fake_conn

    def fake_recall(conn, *, query, limit_per_kind, days):
        return {}

    with (
        patch.dict(
            "sys.modules",
            {
                "src.store.recall": type(sys)("recall"),
                "src.store.schema": type(sys)("schema"),
            },
        ),
        patch.object(monitor, "_recall_fn", None),
        patch.object(monitor, "_recall_conn", None),
    ):
        # Manually set up the cached state
        monitor._recall_fn = fake_recall
        monitor._recall_conn = fake_conn

        result1 = monitor.fetch_recall_hits("test query 1")
        result2 = monitor.fetch_recall_hits("test query 2")

    assert result1 == "(no hits)"
    assert result2 == "(no hits)"
    # Connection was pre-cached, so get_connection was never called
    assert conn_calls == 0

    # Cleanup
    monkeypatch.setattr(monitor, "_recall_conn", None)
    monkeypatch.setattr(monitor, "_recall_fn", None)


def test_attempts_pruning_removes_stale_entries(tmp_path, msg_factory, now, monkeypatch):
    """Stale entries in state['attempts'] are pruned when their msg_id leaves the fetch window."""
    _patch_recall(monkeypatch)
    _isolate_log(monkeypatch, tmp_path)
    _, template = _write_synthetic_config(tmp_path)
    state_path = tmp_path / "state-t.json"
    cfg = monitor.ChatConfig(
        label="t",
        chat_id="c",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=False,
    )
    # Pre-seed with a stale attempt for msg_id "old-99" which won't be in the fetch
    monitor.save_state(
        state_path,
        {**monitor.default_state(), "last_seen_message_id": "100", "attempts": {"old-99": 2}},
    )
    # Only msg_id "101" is in the fetch window
    current_msg = msg_factory(msg_id="101", text="[Claude] self")

    with (
        patch.object(monitor, "list_messages", return_value=[current_msg]),
        patch.object(
            monitor.ChatConfig, "state_file", new_callable=lambda: property(lambda self: state_path)
        ),
    ):
        monitor.run_once_for_chat(cfg, now=now, dry_run=False)

    final = monitor.load_state(state_path)
    assert "old-99" not in final.get("attempts", {})


def test_heartbeat_file_written(tmp_path, monkeypatch):
    """main_loop writes a heartbeat file each poll cycle."""
    _isolate_log(monkeypatch, tmp_path)
    heartbeat = tmp_path / "heartbeat"
    monkeypatch.setattr(monitor, "HEARTBEAT_FILE", heartbeat)
    monkeypatch.setattr(monitor, "_shutdown_requested", False)

    _, template = _write_synthetic_config(tmp_path)
    cfg = monitor.ChatConfig(
        label="t",
        chat_id="c",
        prompt_template_path=template,
        max_replies_per_hour=5,
        per_thread_cooldown_minutes=10,
        dry_run=False,
    )

    call_count = 0

    def fake_run_once(chat_cfg, *, now, dry_run):
        nonlocal call_count
        call_count += 1
        monitor._shutdown_requested = True

    with (
        patch.object(monitor, "_startup_auth", return_value=True),
        patch.object(monitor, "run_once_for_chat", side_effect=fake_run_once),
        patch.object(monitor, "load_state", return_value=monitor.default_state()),
        patch.object(monitor, "sd_notify"),
    ):
        monitor.main_loop([cfg], dry_run=False, poll_seconds=1)

    assert heartbeat.exists()
    monkeypatch.setattr(monitor, "_shutdown_requested", False)
