# plessas-lab

Experimental Claude Code plugins by Dimitrios Plessas, Lab edition.

[![Validate Plugins](https://github.com/weirdapps/plessas-lab/actions/workflows/validate-plugins.yml/badge.svg)](https://github.com/weirdapps/plessas-lab/actions/workflows/validate-plugins.yml)
[![CodeQL](https://github.com/weirdapps/plessas-lab/actions/workflows/codeql.yml/badge.svg)](https://github.com/weirdapps/plessas-lab/actions/workflows/codeql.yml)
[![PII Check](https://github.com/weirdapps/plessas-lab/actions/workflows/pii-check.yml/badge.svg)](https://github.com/weirdapps/plessas-lab/actions/workflows/pii-check.yml)
[![Rename Guard](https://github.com/weirdapps/plessas-lab/actions/workflows/rename-guard.yml/badge.svg)](https://github.com/weirdapps/plessas-lab/actions/workflows/rename-guard.yml)
[![SonarCloud](https://github.com/weirdapps/plessas-lab/actions/workflows/sonarcloud.yml/badge.svg)](https://github.com/weirdapps/plessas-lab/actions/workflows/sonarcloud.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What this is

A public Claude Code marketplace of seven experimental plugins that reach outside the local machine (Google APIs, macOS-only tooling, Microsoft Teams, an image generation model, and a fleet-wide ops engine). Every plugin needs credentials, a platform binding, or a private data store to be fully useful, which is why they live here rather than in the stable [`plessas-marketplace`](https://github.com/weirdapps/plessas-marketplace).

Relationship to the sibling repo:

- **`plessas-marketplace`** (public, stable): everyday workplace plugins (mail, chat, decks, meetings, excel, docs). Works out of the box with Microsoft 365.
- **`plessas-lab`** (public, this repo): plugins that need extra plumbing (Google OAuth, Gemini API key, macOS, private knowledge store, or SSH to a VPS), or are early stage (`chat-watch` is v0.1).

## Plugins

| Plugin | Version | Slash commands | Notes |
|---|---|---|---|
| [`manage-apple-notes`](./plugins/manage-apple-notes/) | 1.0.0 | `/apple-notes` | CRUD for Apple Notes via `osascript`. macOS only; scripts exit cleanly on other platforms. |
| [`manage-gmail`](./plugins/manage-gmail/) | 1.0.0 | `/gmail` | Gmail API (read, search, send, reply, forward, draft). Node CLI wrapper; requires Google Cloud OAuth 2.0 Desktop client. |
| [`manage-nano-banana`](./plugins/manage-nano-banana/) | 1.0.0 | `/nano-banana`, `/create-nbg-infographic` | Image generation and editing via Google Gemini (Nano Banana). Requires `GEMINI_API_KEY`. |
| [`manage-youtube`](./plugins/manage-youtube/) | 1.0.0 | `/youtube` | TypeScript CLI over YouTube. Discovery works with no auth; playlist management needs YouTube Data API v3 OAuth. |
| [`chat-watch`](./plugins/chat-watch/) | 0.1.0 (experimental) | none (Python `monitor.py`) | Polls Microsoft Teams chats and posts `[Claude]`-prefixed replies through an LLM gate. Runs as a long-lived process (launchd / systemd). Requires `teams-cli` authenticated. |
| [`mail-pro`](./plugins/mail-pro/) | 1.0.0 | `/comm-report`, `/style-rebuild` | Companion to the `mail` plugin. Corpus-driven relationship analytics and style-guide rebuild against the private `second-brain` SQLite store. Maintainer-only. |
| [`ops-sync`](./plugins/ops-sync/) | 1.0.0 | `/ops-sync`, `/ops-status`, `/ops-fix`, `/ops-doctor` | Fleet health engine. Six agents scan local repos, Hetzner VPS systemd timers, GitHub Actions, Mac LaunchAgents, and Mac / VPS HEAD alignment. Optional remediation. |

## Installation

Claude Code discovers marketplaces by cloning them into its marketplaces directory:

```bash
mkdir -p ~/.claude/plugins/marketplaces
git clone https://github.com/weirdapps/plessas-lab.git ~/.claude/plugins/marketplaces/plessas-lab
```

Then enable the plugins you want from the `/plugin` manager inside Claude Code.

Update later with:

```bash
cd ~/.claude/plugins/marketplaces/plessas-lab && git pull
```

## Usage

Typical entry points once a plugin is enabled:

```text
/gmail search from:boss@example.com after:2026/06/01
/nano-banana create a hero image for a fintech landing page
/create-nbg-infographic quarterly card revenue mix
/youtube channel @veritasium
/apple-notes create "Weekly review" "..."
/comm-report month --recipient theofilidi
/style-rebuild
/ops-status --live
/ops-sync --scope all
/ops-doctor vps
```

`chat-watch` has no slash command. It ships a Python CLI (`plugins/chat-watch/monitor.py`) that you run as a long-lived worker, with per-chat config held outside the repo at `~/.claude/chat-watch/`. See [`plugins/chat-watch/README.md`](./plugins/chat-watch/README.md) for the first-run walkthrough.

## Configuration and secrets

Nothing sensitive is committed. Each plugin's README documents its own setup; summary:

| Plugin | Setup / auth |
|---|---|
| `manage-apple-notes` | macOS only. No credentials. |
| `manage-gmail` | Google Cloud project with Gmail API enabled, OAuth 2.0 Desktop client. Store `client_secret_*.json` at `~/.google-skills/gmail/GMailSkill-Credentials.json`; token cached at `~/.google-skills/gmail/gmail_token.json`. |
| `manage-nano-banana` | `export GEMINI_API_KEY="..."` in your shell rc. |
| `manage-youtube` | Discovery: no auth. Playlist management: Google Cloud project with YouTube Data API v3 + OAuth 2.0 Desktop client. |
| `chat-watch` | `teams-cli auth-check` returns ok. Copy `chats.example.json` and `prompts/example_*.txt` into `~/.claude/chat-watch/` and edit. Recommend `dry_run: true` for the first hour. |
| `mail-pro` | Requires the private `weirdapps/second-brain` repo cloned at `~/SourceCode/second-brain/` with `data/brain.db` populated. Not portable. |
| `ops-sync` | Expects the full `~/SourceCode/` layout, plus SSH access to the Hetzner VPS for systemd checks. |

Secrets are kept out of the repo by `.gitignore`: `node_modules/`, `.env` / `.env.local`, `*credentials*.json`, `token.json`, `*.pem`, `*.key`, `skill-key/`. Personal `chat-watch` config lives entirely under `~/.claude/chat-watch/`, outside the repo.

## Repository layout

```text
plessas-lab/
  .claude-plugin/marketplace.json     Top-level manifest (all seven plugins)
  plugins/
    manage-apple-notes/               macOS Notes.app via osascript
    manage-gmail/                     Gmail API + Node CLI
    manage-nano-banana/               Google Gemini image generation
    manage-youtube/                   YouTube TypeScript CLI
    chat-watch/                       Teams monitor (monitor.py) + tests
    mail-pro/                         second-brain-backed mail analytics
    ops-sync/                         Ops fleet-health with six agents
  scripts/validate_consistency.py     Marketplace / plugin consistency check
  tests/auth-flow.test.ts             Top-level TypeScript test suite (vitest)
  .github/workflows/                  Seven CI workflows (see below)
  CLAUDE.md                           Project brief for Claude Code
  SECURITY.md
  LICENSE                             MIT
```

## Development and testing

```bash
# Node / TypeScript tests (top-level, vitest)
npm install
npm test
npm run test:coverage

# Python tests (chat-watch, manage-apple-notes)
pytest --cov=. --cov-report=xml --cov-report=term-missing

# Lint (Python)
ruff check .
mypy .
```

`pyproject.toml` pins Python 3.11 and a ruff rulepack of E, W, F, I, B, C4, UP. `package.json` requires Node 20+.

Adding a new plugin:

1. Create `plugins/<name>/.claude-plugin/plugin.json` with `name`, `description`, `version` (all validated by CI).
2. Add command files under `plugins/<name>/commands/*.md` with YAML frontmatter (`---` on line 1). CI rejects any command missing frontmatter.
3. Add `plugins/<name>/README.md`.
4. Register the plugin in `.claude-plugin/marketplace.json` under `"plugins"`.
5. Keep credentials out of the repo; the `.gitignore` patterns above already cover the usual suspects.

## Continuous integration

Seven workflows under `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `validate-plugins.yml` | push / PR on master | `marketplace.json` and every `plugin.json` are valid JSON with required fields; READMEs exist; every command has YAML frontmatter; runs `scripts/validate_consistency.py`. |
| `codeql.yml` | push / PR / weekly cron | GitHub CodeQL for JavaScript and TypeScript. |
| `pii-check.yml` | push / PR | Runs `installers/pii-gauntlet.sh --mode=ci` to scan git-tracked files for personal data. |
| `rename-guard.yml` | push / PR | Fails if the legacy names `integrations-marketplace` or `teams-monitor` leak back into tracked files. |
| `sonarcloud.yml` | push / PR / manual | Runs tests with coverage and, when `SONAR_TOKEN` is set, uploads to SonarCloud. |
| `deps-refresh.yml` | monthly cron (22nd, 07:11 UTC) | Delegates to `weirdapps/shared-workflows` monthly refresh; gate is `npm test`. |
| `dependabot-auto-merge.yml` | Dependabot PRs | Auto-merges minor and patch bumps. |

## License

MIT. See [LICENSE](./LICENSE). Individual plugins carry their own MIT declaration in their `plugin.json`.
