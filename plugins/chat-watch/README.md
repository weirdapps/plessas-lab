# chat-watch

Monitors one or more Microsoft Teams chats and posts `[Claude]`-prefixed replies when an LLM judges that adding context is genuinely useful.

> **Renamed 2026-05-09:** previously called `teams-monitor`. The runtime config dir was `~/.claude/teams-monitor/` — `monitor.py` auto-migrates it to `~/.claude/chat-watch/` on first run after the upgrade. No manual move required.

Per-chat configuration (id, prompt, rate limits, dry-run) lives in **`~/.claude/chat-watch/chats.json`** — outside the repo, so personal chat ids and colleague-naming prompts never get committed. Each configured chat gets:

- its own prompt template under `~/.claude/chat-watch/prompts/<label>.txt`
- its own state file `~/.claude/chat-watch/state-<label>.json`
- its own rate limits (`max_replies_per_hour`, `per_thread_cooldown_minutes`)
- its own `dry_run` flag

The repo only ships sanitized templates: `chats.example.json`, `prompts/example_group.txt`, `prompts/example_one_to_one.txt`.

## First-time setup

```bash
mkdir -p ~/.claude/chat-watch/prompts
cp plugins/chat-watch/chats.example.json ~/.claude/chat-watch/chats.json
cp plugins/chat-watch/prompts/example_group.txt ~/.claude/chat-watch/prompts/<your-label>.txt
# edit chats.json: replace REPLACE_ME ids with real Teams chat ids (find via `teams-cli list-chats`)
# edit your prompt(s): replace the SECTIONS marked "REPLACE THIS SECTION" with your own policy
```

Recommended posture for a brand-new chat: keep `dry_run: true` for the first hour so you can read what `would_post` decisions look like before they go live.

## Prerequisites

- `teams-cli` authenticated (`teams-cli auth-check` returns `status: ok`). Run `teams-cli login` if not.
- `claude` CLI on PATH.
- Python 3.11+.
- Optional: second-brain repo at `~/SourceCode/second-brain` with `data/brain.db` (used for recall context — the monitor degrades gracefully if missing or locked).

## Run modes

### Dry-run (no posting — for calibration)

```bash
cd plugins/chat-watch
python monitor.py --dry-run --poll-seconds 30
```

Logs to stderr and to `~/.claude/chat-watch/log.jsonl`. No messages are posted to any chat (overrides per-chat `dry_run` flags to be more conservative, never less).

### Live (posts to chats with `dry_run: false`)

```bash
cd plugins/chat-watch
python monitor.py --poll-seconds 30
```

Posts go out as `[Claude] <text>`. Per-chat hard caps apply (configurable in chats.json); defaults are 5 replies/hour for groups, 2/hour for 1:1s, with a 10–30-minute per-thread cooldown.

### Replay one message

```bash
python monitor.py --replay <message_id> --chat <label>
```

Runs the gating prompt against one historical message and prints the decision. `--chat` is required when more than one chat is configured.

### Backtest last N hours

```bash
python monitor.py --backtest --hours 24 --chat <label>
```

Replays the last N hours in dry-run, prints decision distribution + first 5 would-reply / skip examples. Makes ~1 LLM call per non-self message in the window.

### Use a custom config path

```bash
python monitor.py --config /path/to/chats.json
```

## Stopping

- **Ctrl-C** — graceful shutdown via SIGINT.
- **Stop file** — `touch ~/.claude/chat-watch/STOP` from another terminal. The loop exits within one poll cycle. Remember to `rm` the STOP file before next run.
- **kill <pid>** — sends SIGTERM, also handled gracefully.

## State + logs

| Path | Purpose |
|---|---|
| `~/.claude/chat-watch/chats.json` | Per-chat configuration. **Personal — never check in.** |
| `~/.claude/chat-watch/prompts/<label>.txt` | Per-chat gating prompts. **Personal — never check in.** |
| `~/.claude/chat-watch/state-<label>.json` | Per-chat `last_seen_message_id`, replies in last hour (rate limit source of truth) |
| `~/.claude/chat-watch/log.jsonl` | Append-only event log (single shared log across all chats — every record carries a `chat: <label>` field): `start`, `poll`, `cold_start`, `skip`, `would_post`, `reply_posted`, `error`, `auth_required`, `rate_limited`, `stop` |
| `~/.claude/chat-watch/STOP` | Touch this file to gracefully stop the loop |

To reset state for one chat and start fresh:

```bash
rm -f ~/.claude/chat-watch/state-<label>.json
```

(On next run, the loop performs cold-start for that chat: sets `last_seen` to the newest existing message and processes zero. No backlog reply spam.)

## Tests

```bash
cd plugins/chat-watch
python -m pytest -v
```

Tests cover: state load/corrupt-fallback, hourly + per-thread rate limit, self-loop guard, JSON parser tolerance, prompt builder, context builders, teams-cli wrapper, claude CLI wrapper, chats.json loader (validation, missing template, duplicate label, missing-file helpful error, absolute vs relative template paths, default config path, label-scoped state file path).

## Optional launchd integration

A sample launchd plist (macOS) — adjust paths for your install:

```xml
<key>ProgramArguments</key>
<array>
    <string>/path/to/python</string>
    <string>/path/to/plugins/chat-watch/monitor.py</string>
    <string>--poll-seconds</string>
    <string>30</string>
</array>
```

Logs go to `~/.claude/chat-watch/launchd.{out,err}`. The monitor reads `~/.claude/chat-watch/chats.json` by default, so no `--config` flag is needed unless you want a non-standard location.
