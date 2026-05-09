"""Teams chat monitor — experimental.

Polls one or more Microsoft Teams chats and posts ``[Claude]``-prefixed
replies when an LLM gate decides adding context is genuinely useful.

Per-chat configuration (id, prompt template, rate limits, dry-run) lives
in ``chats.json`` next to this file.

See docs/superpowers/specs/2026-05-05-teams-digital-nomads-monitor-design.md
for the original (single-chat) design. The multi-chat refactor preserves
the single-chat behaviour for ``digital_claude`` and adds per-chat state.
"""

from __future__ import annotations

import argparse
import json
import re
import signal
import subprocess
import sys
import time
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

_shutdown_requested = False


def _request_shutdown(_signum: int, _frame: object) -> None:
    global _shutdown_requested
    _shutdown_requested = True


class TeamsCliError(Exception):
    """Generic teams-cli failure."""

    def __init__(self, exit_code: int, stderr: str, retryable: bool):
        self.exit_code = exit_code
        self.stderr = stderr
        self.retryable = retryable
        super().__init__(f"teams-cli exit {exit_code}: {stderr}")


class TeamsCliAuthRequired(TeamsCliError):
    """Exit 4 — caller should bail without retrying."""

    def __init__(self, stderr: str):
        super().__init__(exit_code=4, stderr=stderr, retryable=False)


class ClaudeCliError(Exception):
    """claude CLI failure (timeout, non-zero, missing binary)."""


HERE = Path(__file__).resolve().parent
STATE_DIR = Path("~/.claude/chat-watch").expanduser()
LEGACY_STATE_DIR = Path("~/.claude/teams-monitor").expanduser()
DEFAULT_CONFIG_PATH = STATE_DIR / "chats.json"
LOG_FILE = STATE_DIR / "log.jsonl"
STOP_FILE = STATE_DIR / "STOP"
CLAUDE_TAG = "[Claude] "
DEFAULT_POLL_SECONDS = 30


def migrate_legacy_state_dir() -> bool:
    """One-shot migration from ~/.claude/teams-monitor/ -> ~/.claude/chat-watch/.

    The plugin was renamed from teams-monitor -> chat-watch on 2026-05-09. Existing
    installs have config + state under the old path. This function moves the dir
    on first run if (and only if): legacy exists AND new path does not.

    Idempotent. Logs to stderr (cannot use log_event because LOG_FILE may not
    exist yet — and would point to the new dir before migration completes).

    Returns True if migration ran, False if no migration needed.
    """
    if not LEGACY_STATE_DIR.exists():
        return False
    if STATE_DIR.exists():
        # Both exist — migration already happened or operator created new path manually
        return False
    try:
        LEGACY_STATE_DIR.rename(STATE_DIR)
        print(
            f"chat-watch: migrated {LEGACY_STATE_DIR} -> {STATE_DIR} (one-shot rename)",
            file=sys.stderr,
            flush=True,
        )
        return True
    except OSError as exc:
        print(
            f"chat-watch: WARN — could not migrate {LEGACY_STATE_DIR} -> {STATE_DIR}: {exc}. "
            f"Move manually or set --config to a custom path.",
            file=sys.stderr,
            flush=True,
        )
        return False


@dataclass(frozen=True)
class ChatConfig:
    """Per-chat policy resolved from chats.json."""

    label: str
    chat_id: str
    prompt_template_path: Path
    max_replies_per_hour: int
    per_thread_cooldown_minutes: int
    dry_run: bool

    @property
    def state_file(self) -> Path:
        return STATE_DIR / f"state-{self.label}.json"


def load_chat_configs(path: Path = DEFAULT_CONFIG_PATH) -> list[ChatConfig]:
    """Load and validate chat configurations from JSON.

    Relative ``prompt_template`` paths resolve against the directory containing
    ``path`` — this lets the personal config + prompts live together under
    ``~/.claude/teams-monitor/`` while the repo only ships sanitized examples.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"chats.json not found at {path}. Copy chats.example.json from the "
            "plugin dir to this location and edit it. See README.md."
        )
    raw = json.loads(path.read_text(encoding="utf-8"))
    chats_raw = raw.get("chats", [])
    if not isinstance(chats_raw, list) or not chats_raw:
        raise ValueError(f"{path}: 'chats' must be a non-empty array")
    config_dir = path.parent
    configs: list[ChatConfig] = []
    seen_labels: set[str] = set()
    for entry in chats_raw:
        for required in ("label", "id", "prompt_template"):
            if required not in entry:
                raise ValueError(f"{path}: chat entry missing '{required}': {entry}")
        label = entry["label"]
        if label in seen_labels:
            raise ValueError(f"{path}: duplicate label '{label}'")
        seen_labels.add(label)
        raw_template = Path(entry["prompt_template"])
        template_path = raw_template if raw_template.is_absolute() else config_dir / raw_template
        if not template_path.exists():
            raise ValueError(f"{path}: prompt template not found: {template_path}")
        configs.append(
            ChatConfig(
                label=label,
                chat_id=entry["id"],
                prompt_template_path=template_path,
                max_replies_per_hour=int(entry.get("max_replies_per_hour", 5)),
                per_thread_cooldown_minutes=int(entry.get("per_thread_cooldown_minutes", 10)),
                dry_run=bool(entry.get("dry_run", False)),
            )
        )
    return configs


def default_state() -> dict[str, Any]:
    return {
        "first_run_at": None,
        "last_seen_message_id": None,
        "replies": [],
    }


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return default_state()
    try:
        with path.open() as f:
            return cast(dict[str, Any], json.load(f))
    except (json.JSONDecodeError, OSError):
        return default_state()


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False))


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(html: str) -> str:
    """Cheap HTML-to-text. Sufficient for self-loop check; not for prompt context."""
    return _HTML_TAG_RE.sub("", html or "")


def is_self_message(body: str) -> bool:
    """True if the visible body text starts with [Claude] (case-insensitive)."""
    text = _strip_html(body).lstrip()
    return text[:8].lower().startswith("[claude]")


def _parse_ts(ts: str) -> datetime:
    """Parse ISO 8601 timestamp into aware UTC datetime."""
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def prune_old_replies(state: dict[str, Any], now: datetime) -> None:
    """Drop replies older than the rolling hour. Mutates state in place."""
    cutoff = now - timedelta(hours=1)
    state["replies"] = [r for r in state["replies"] if _parse_ts(r["ts"]) >= cutoff]


def rate_limit_ok(
    state: dict[str, Any],
    thread_id: str,
    now: datetime,
    *,
    max_replies_per_hour: int = 5,
    per_thread_cooldown_minutes: int = 10,
) -> bool:
    """True if a reply to thread_id is allowed under hourly + per-thread limits."""
    prune_old_replies(state, now)
    if len(state["replies"]) >= max_replies_per_hour:
        return False
    cooldown_cutoff = now - timedelta(minutes=per_thread_cooldown_minutes)
    for r in state["replies"]:
        if r["thread_id"] == thread_id and _parse_ts(r["ts"]) >= cooldown_cutoff:
            return False
    return True


def parse_decision(raw: str) -> dict[str, Any] | None:
    """Extract a {"reply": bool, ...} JSON object from LLM output.

    Tolerates leading/trailing prose. Returns None on garbage or missing keys.
    """
    if not raw:
        return None
    # Find the first '{' and the matching last '}' — naive but works for our shape
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = raw[start : end + 1]
    try:
        decision = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    if not isinstance(decision, dict):
        return None
    if "reply" not in decision or not isinstance(decision["reply"], bool):
        return None
    if decision["reply"] and not isinstance(decision.get("text"), str):
        return None
    return decision


MAX_THREAD_MESSAGES = 20
MAX_CHAT_24H_MESSAGES = 30


def extract_thread_messages(
    all_msgs: list[dict[str, Any]], new_msg: dict[str, Any]
) -> list[dict[str, Any]]:
    """Return messages with same threadId/replyToId chain as new_msg, oldest first, excluding new_msg itself."""
    new_thread = _thread_key(new_msg)
    siblings = [m for m in all_msgs if m["id"] != new_msg["id"] and _thread_key(m) == new_thread]
    siblings.sort(key=lambda m: m.get("composedDateTime", ""))
    return siblings[-MAX_THREAD_MESSAGES:]


def extract_chat_24h(
    all_msgs: list[dict[str, Any]], new_msg: dict[str, Any], now: datetime
) -> list[dict[str, Any]]:
    """Return messages from the last 24h before now, oldest first, excluding new_msg itself."""
    cutoff = now - timedelta(hours=24)
    out = []
    for m in all_msgs:
        if m["id"] == new_msg["id"]:
            continue
        ts = m.get("composetime")
        if not ts:
            continue
        if _parse_ts(ts) >= cutoff:
            out.append(m)
    out.sort(key=lambda m: m.get("composetime", ""))
    return out[-MAX_CHAT_24H_MESSAGES:]


def _thread_key(msg: dict[str, Any]) -> str:
    """A stable thread identifier from a teams-cli message.

    Real Teams group chats have NO threading fields, so ``_thread_key`` falls
    back to the message's own ``id`` — meaning the per-thread cooldown is a
    no-op in production (every message is its own one-message "thread"). The
    optional ``_thread_id`` field is a test-only hook for exercising the
    cooldown logic in unit tests.
    """
    return str(msg.get("_thread_id") or msg["id"])


def format_messages(msgs: list[dict[str, Any]]) -> str:
    """Format a list of messages as a plain-text block: '<sender>: <text>'."""
    lines = []
    for m in msgs:
        sender = m.get("imdisplayname") or "?"
        body = m.get("content") or ""
        text = _strip_html(body).strip()
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text)
        if not text:
            continue
        lines.append(f"{sender}: {text}")
    return "\n".join(lines) if lines else "(none)"


SECOND_BRAIN_SRC = Path("~/SourceCode/second-brain").expanduser()
SECOND_BRAIN_DB = SECOND_BRAIN_SRC / "data" / "brain.db"


def fetch_recall_hits(query: str, limit_per_kind: int = 3) -> str:
    """Targeted second-brain recall. Returns formatted hits or '(unavailable)'."""
    try:
        if str(SECOND_BRAIN_SRC) not in sys.path:
            sys.path.insert(0, str(SECOND_BRAIN_SRC))
        from src.store.recall import recall  # type: ignore
        from src.store.schema import get_connection  # type: ignore

        conn = get_connection(str(SECOND_BRAIN_DB))
        try:
            hits = recall(conn, query=query, limit_per_kind=limit_per_kind, days=365)
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001 — graceful degradation is the contract
        return f"(unavailable: {type(exc).__name__})"

    return _format_recall(hits)


def _format_recall(hits: dict[str, Any]) -> str:
    """Flatten recall() output into the prompt-friendly text block."""
    lines = []
    for kind, items in hits.items():
        if not isinstance(items, list) or not items:
            continue
        for item in items[:3]:
            title = (
                item.get("subject")
                or item.get("title")
                or item.get("task")
                or item.get("decision")
                or "(no title)"
            )
            snippet = item.get("snippet") or item.get("summary") or ""
            snippet = re.sub(r"\s+", " ", str(snippet))[:200]
            lines.append(f"[{kind}] {title} | {snippet}")
    return "\n".join(lines) if lines else "(no hits)"


def build_prompt(
    template_path: Path,
    *,
    sender: str,
    composed_at: str,
    new_text: str,
    thread_context: str,
    chat_context: str,
    recall_context: str,
) -> str:
    """Render a gating prompt template with the given context."""
    template = template_path.read_text(encoding="utf-8")
    return template.format(
        sender=sender,
        composed_at=composed_at,
        new_text=new_text,
        thread_context=thread_context,
        chat_context=chat_context,
        recall_context=recall_context,
    )


CLAUDE_TIMEOUT_SECONDS = 120
CLAUDE_MODEL = "sonnet"


def invoke_claude(prompt: str, timeout: int = CLAUDE_TIMEOUT_SECONDS) -> str:
    """Invoke `claude --model sonnet --print`, return stdout. Raise ClaudeCliError on failure."""
    try:
        proc = subprocess.run(
            ["claude", "--model", CLAUDE_MODEL, "--print"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise ClaudeCliError(f"claude CLI timed out after {timeout}s") from exc
    except FileNotFoundError as exc:
        raise ClaudeCliError("claude CLI not found on PATH") from exc
    if proc.returncode != 0:
        raise ClaudeCliError(f"claude CLI exit {proc.returncode}: {proc.stderr}")
    return proc.stdout


def run_teams_cli(args: list[str], timeout: int = 60) -> dict[str, Any]:
    """Invoke teams-cli with given args. Always passes --no-auto-reauth."""
    full_args = ["teams-cli"] + args
    if "--no-auto-reauth" not in full_args:
        full_args.append("--no-auto-reauth")
    proc = subprocess.run(full_args, capture_output=True, text=True, timeout=timeout)
    if proc.returncode == 4:
        raise TeamsCliAuthRequired(proc.stderr)
    if proc.returncode == 5:
        raise TeamsCliError(5, proc.stderr, retryable=True)
    if proc.returncode != 0:
        raise TeamsCliError(proc.returncode, proc.stderr, retryable=False)
    return json.loads(proc.stdout) if proc.stdout.strip() else {}


def list_messages(chat_id: str, page_size: int = 50) -> list[dict[str, Any]]:
    """Return chat messages newest-first."""
    result = run_teams_cli(["list-messages", "--chat", chat_id, "--page-size", str(page_size)])
    messages = result.get("messages", []) if isinstance(result, dict) else result
    return cast(list[dict[str, Any]], messages)


def send_message(chat_id: str, html_body: str) -> dict[str, Any]:
    """Post a message to a chat. Returns the teams-cli response."""
    return run_teams_cli(["send-message", "--chat", chat_id, "--html", html_body])


def log_event(event: str, **fields: Any) -> None:
    """Append one JSON object to log.jsonl."""
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    rec = {
        "ts": datetime.now(UTC).isoformat(),
        "event": event,
        **fields,
    }
    line = json.dumps(rec, ensure_ascii=False)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    # Also echo to stderr so the foreground operator sees it
    print(line, file=sys.stderr, flush=True)


def process_message(
    msg: dict[str, Any],
    all_msgs: list[dict[str, Any]],
    state: dict[str, Any],
    chat_cfg: ChatConfig,
    *,
    now: datetime,
    dry_run: bool,
) -> None:
    """Decide whether to reply to msg and (if not dry-run) post the reply."""
    msg_id = msg["id"]
    body_html = msg.get("content", "")
    sender = msg.get("imdisplayname", "?")
    composed_at = msg.get("composetime", "")
    new_text = _strip_html(body_html).strip()
    thread_id = _thread_key(msg)

    if is_self_message(body_html):
        log_event("skip", chat=chat_cfg.label, reason="self_message", msg_id=msg_id)
        return

    if not rate_limit_ok(
        state,
        thread_id,
        now=now,
        max_replies_per_hour=chat_cfg.max_replies_per_hour,
        per_thread_cooldown_minutes=chat_cfg.per_thread_cooldown_minutes,
    ):
        log_event("rate_limited", chat=chat_cfg.label, msg_id=msg_id, thread_id=thread_id)
        return

    thread_msgs = extract_thread_messages(all_msgs, msg)
    chat_24h_msgs = extract_chat_24h(all_msgs, msg, now=now)
    recall_hits = fetch_recall_hits(new_text)
    prompt = build_prompt(
        chat_cfg.prompt_template_path,
        sender=sender,
        composed_at=composed_at,
        new_text=new_text,
        thread_context=format_messages(thread_msgs),
        chat_context=format_messages(chat_24h_msgs),
        recall_context=recall_hits,
    )

    try:
        raw = invoke_claude(prompt)
    except ClaudeCliError as exc:
        log_event(
            "error", chat=chat_cfg.label, stage="invoke_claude", msg_id=msg_id, error=str(exc)
        )
        return

    decision = parse_decision(raw)
    if decision is None:
        log_event(
            "error",
            chat=chat_cfg.label,
            stage="parse_decision",
            msg_id=msg_id,
            raw_preview=raw[:200],
        )
        return

    if not decision["reply"]:
        log_event(
            "skip",
            chat=chat_cfg.label,
            reason="gate_said_no",
            msg_id=msg_id,
            gate_reason=decision.get("reason", ""),
        )
        return

    text = decision["text"].strip()
    # Strip any [Claude] the LLM added — we add it ourselves
    if text.lower().startswith("[claude]"):
        text = text[8:].lstrip(" :,-")
    posted_html = f"{CLAUDE_TAG}{text}"

    if dry_run or chat_cfg.dry_run:
        log_event(
            "would_post",
            chat=chat_cfg.label,
            msg_id=msg_id,
            text=posted_html,
            gate_reason=decision.get("reason", ""),
        )
        return

    try:
        send_message(chat_cfg.chat_id, posted_html)
    except (TeamsCliError, TeamsCliAuthRequired) as exc:
        log_event(
            "error",
            chat=chat_cfg.label,
            stage="send_message",
            msg_id=msg_id,
            drafted=posted_html,
            error=str(exc),
        )
        return

    state["replies"].append(
        {
            "ts": now.isoformat(),
            "thread_id": thread_id,
            "text": posted_html,
        }
    )
    log_event(
        "reply_posted", chat=chat_cfg.label, msg_id=msg_id, text=posted_html, thread_id=thread_id
    )


def run_once_for_chat(chat_cfg: ChatConfig, *, now: datetime, dry_run: bool) -> None:
    """One polling cycle for one chat: fetch, filter, process new messages."""
    state = load_state(chat_cfg.state_file)
    msgs = list_messages(chat_cfg.chat_id)
    if not msgs:
        log_event("poll", chat=chat_cfg.label, note="no_messages")
        return

    # First-run cold start: set last_seen to newest, do not process backlog
    if state["last_seen_message_id"] is None:
        newest_id = msgs[0]["id"]
        state["last_seen_message_id"] = newest_id
        state["first_run_at"] = now.isoformat()
        log_event(
            "cold_start",
            chat=chat_cfg.label,
            last_seen_message_id=newest_id,
            total_in_window=len(msgs),
        )
        save_state(chat_cfg.state_file, state)
        return

    last_seen = state["last_seen_message_id"]
    # teams-cli returns newest-first; process in chronological order so context builds correctly
    new_msgs = [m for m in msgs if m["id"] > last_seen]
    new_msgs.sort(key=lambda m: m.get("composetime", ""))

    log_event("poll", chat=chat_cfg.label, new_count=len(new_msgs), total_in_window=len(msgs))

    for m in new_msgs:
        process_message(m, msgs, state, chat_cfg, now=now, dry_run=dry_run)
        state["last_seen_message_id"] = max(state["last_seen_message_id"], m["id"])
        save_state(chat_cfg.state_file, state)


def replay_one(message_id: str, chat_cfg: ChatConfig) -> int:
    """Replay one historical message through the gate. Print decision JSON. Always dry."""
    msgs = list_messages(chat_cfg.chat_id, page_size=100)
    target = next((m for m in msgs if m["id"] == message_id), None)
    if target is None:
        print(f"Message id {message_id} not found in last 100 messages.", file=sys.stderr)
        return 1
    state = default_state()  # ignore real rate limits / cooldowns
    process_message(target, msgs, state, chat_cfg, now=datetime.now(UTC), dry_run=True)
    return 0


def run_backtest(hours: int, chat_cfg: ChatConfig) -> int:
    """Replay all messages in the last N hours through the gate. Print summary."""
    msgs = list_messages(chat_cfg.chat_id, page_size=200)
    now = datetime.now(UTC)
    cutoff = now - timedelta(hours=hours)
    in_window = [
        m
        for m in msgs
        if not is_self_message(m.get("content", ""))
        and m.get("composetime")
        and _parse_ts(m["composetime"]) >= cutoff
    ]
    in_window.sort(key=lambda m: m.get("composetime", ""))

    decisions: Counter[str] = Counter()
    examples_reply: list[tuple[str, str]] = []
    examples_skip: list[tuple[str, str]] = []

    for m in in_window:
        body = m.get("content", "")
        new_text = _strip_html(body).strip()
        thread_msgs = extract_thread_messages(msgs, m)
        chat_24h_msgs = extract_chat_24h(msgs, m, now=now)
        recall_hits = fetch_recall_hits(new_text)
        prompt = build_prompt(
            chat_cfg.prompt_template_path,
            sender=m.get("imdisplayname", "?"),
            composed_at=m.get("composetime", ""),
            new_text=new_text,
            thread_context=format_messages(thread_msgs),
            chat_context=format_messages(chat_24h_msgs),
            recall_context=recall_hits,
        )
        try:
            raw = invoke_claude(prompt)
        except ClaudeCliError as exc:
            decisions["error"] += 1
            print(f"  ERROR on {m['id']}: {exc}", file=sys.stderr)
            continue
        decision = parse_decision(raw)
        if decision is None:
            decisions["unparseable"] += 1
            continue
        if decision["reply"]:
            decisions["reply"] += 1
            examples_reply.append((new_text[:80], decision["text"][:140]))
        else:
            decisions["skip"] += 1
            examples_skip.append((new_text[:80], decision.get("reason", "")[:100]))

    print(
        f"\nBacktest summary — chat={chat_cfg.label}, {hours}h window, {len(in_window)} messages considered"
    )
    for k, v in decisions.most_common():
        print(f"  {k}: {v}")
    print("\nFirst 5 WOULD-REPLY examples:")
    for inbound, draft in examples_reply[:5]:
        print(f"  IN:  {inbound}\n  OUT: {draft}\n")
    print("First 5 SKIP reasons:")
    for inbound, reason in examples_skip[:5]:
        print(f"  IN:  {inbound}\n  WHY: {reason}\n")
    return 0


AUTH_RENEW_INTERVAL_SECONDS = 3600


def _try_auth_renew() -> bool:
    """Silently renew teams-cli auth. Returns True on success."""
    try:
        subprocess.run(
            ["teams-cli", "auth-renew", "--no-auto-reauth"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        run_teams_cli(["auth-check"])
        return True
    except Exception:  # noqa: BLE001
        return False


def main_loop(chat_configs: list[ChatConfig], *, dry_run: bool, poll_seconds: int) -> int:
    """Forever: poll each chat, process, sleep. Auto-renews auth every hour."""
    log_event(
        "start",
        dry_run=dry_run,
        poll_seconds=poll_seconds,
        chats=[c.label for c in chat_configs],
    )
    signal.signal(signal.SIGINT, _request_shutdown)
    signal.signal(signal.SIGTERM, _request_shutdown)

    try:
        run_teams_cli(["auth-check"])
    except TeamsCliAuthRequired:
        log_event("auth_renewing", reason="startup")
        if not _try_auth_renew():
            print("FATAL: teams-cli auth failed. Run `teams-cli login` first.", file=sys.stderr)
            log_event("auth_required")
            return 2

    last_auth_renew = time.time()

    while not _shutdown_requested:
        if STOP_FILE.exists():
            log_event("stop", reason="STOP_file")
            return 0

        if time.time() - last_auth_renew > AUTH_RENEW_INTERVAL_SECONDS:
            log_event("auth_renewing", reason="periodic")
            if _try_auth_renew():
                log_event("auth_renewed")
            else:
                log_event("auth_renew_failed")
            last_auth_renew = time.time()

        cycle_failed = False
        for chat_cfg in chat_configs:
            if _shutdown_requested:
                break
            try:
                run_once_for_chat(chat_cfg, now=datetime.now(UTC), dry_run=dry_run)
            except TeamsCliAuthRequired:
                log_event("auth_renewing", chat=chat_cfg.label, reason="mid_loop_401")
                if _try_auth_renew():
                    log_event("auth_renewed", chat=chat_cfg.label)
                    continue
                log_event("auth_required", chat=chat_cfg.label)
                print("Auth renewal failed. Run `teams-cli login` and restart.", file=sys.stderr)
                return 2
            except Exception as exc:  # noqa: BLE001
                import traceback

                log_event(
                    "error",
                    chat=chat_cfg.label,
                    stage="run_once",
                    error=repr(exc),
                    traceback=traceback.format_exc(),
                )
                cycle_failed = True

        # Sleep between cycles. On error, back off the same 60s the original
        # single-chat version used.
        sleep_seconds = 60 if cycle_failed else poll_seconds
        for _ in range(sleep_seconds):
            if _shutdown_requested:
                break
            time.sleep(1)

    log_event("stop", reason="signal")
    return 0


def _resolve_chat(chat_configs: list[ChatConfig], label: str | None) -> ChatConfig:
    """Pick chat by label, or if only one configured, return it."""
    if label:
        for c in chat_configs:
            if c.label == label:
                return c
        raise SystemExit(f"chat label not found in config: {label}")
    if len(chat_configs) == 1:
        return chat_configs[0]
    labels = ", ".join(c.label for c in chat_configs)
    raise SystemExit(f"--replay/--backtest require --chat <label> (configured: {labels})")


def main() -> int:
    # One-shot migration before any path is used (legacy teams-monitor -> chat-watch).
    # Safe no-op if migration already happened or never needed.
    migrate_legacy_state_dir()

    parser = argparse.ArgumentParser(description="Teams chat monitor (multi-chat)")
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help="Path to chats.json (default: chats.json next to this script)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Don't post; just log decisions")
    parser.add_argument("--replay", metavar="MSG_ID", help="Replay one message by id and exit")
    parser.add_argument(
        "--backtest", action="store_true", help="Replay last N hours and print summary"
    )
    parser.add_argument("--hours", type=int, default=24, help="Backtest window in hours")
    parser.add_argument(
        "--chat",
        metavar="LABEL",
        help="Restrict --replay/--backtest to one chat by label",
    )
    parser.add_argument(
        "--poll-seconds", type=int, default=DEFAULT_POLL_SECONDS, help="Poll cadence"
    )
    args = parser.parse_args()

    chat_configs = load_chat_configs(args.config)

    if args.replay:
        return replay_one(args.replay, _resolve_chat(chat_configs, args.chat))
    if args.backtest:
        return run_backtest(args.hours, _resolve_chat(chat_configs, args.chat))

    return main_loop(chat_configs, dry_run=args.dry_run, poll_seconds=args.poll_seconds)


if __name__ == "__main__":
    sys.exit(main())
