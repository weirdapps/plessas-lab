# plessas-lab

[![Validate Plugins](https://github.com/weirdapps/plessas-lab/actions/workflows/validate-plugins.yml/badge.svg)](https://github.com/weirdapps/plessas-lab/actions/workflows/validate-plugins.yml)
[![SonarCloud](https://github.com/weirdapps/plessas-lab/actions/workflows/sonarcloud.yml/badge.svg)](https://github.com/weirdapps/plessas-lab/actions/workflows/sonarcloud.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A lab marketplace of experimental Claude Code plugins. Covers Apple Notes, Gmail, image generation with Google's Gemini API, YouTube content management, Microsoft Teams monitoring, and an email communication analytics add-on.

> **Companion to [plessas-marketplace](https://github.com/weirdapps/plessas-marketplace)** — production-grade workplace plugins for email, presentations, meetings, and Teams chat. Plugins here are labelled "lab" because they require external API setup (Google OAuth, Gemini key, etc.) or are experimental in scope.

## Plugins

| Plugin | Version | Platform | Description |
|--------|---------|----------|-------------|
| [manage-apple-notes](./plugins/manage-apple-notes/) | v1.0 | macOS only | CRUD operations for Apple Notes — persistent storage of thoughts, data, and information across Claude Code sessions |
| [manage-gmail](./plugins/manage-gmail/) | v1.0 | All platforms | Access and process Gmail messages via the Gmail API — read, search, list, send, reply, and forward with OAuth 2.0 |
| [manage-nano-banana](./plugins/manage-nano-banana/) | v1.0 | All platforms | Generate and edit images, diagrams, infographics, and visualizations using Google's Gemini image generation API |
| [manage-youtube](./plugins/manage-youtube/) | v1.0 | All platforms | Search, discover, and manage YouTube content — channels, videos, transcripts, and playlists via TypeScript CLI tools |
| [chat-watch](./plugins/chat-watch/) | v0.1 experimental | All platforms | Polls Microsoft Teams chats and posts `[Claude]`-prefixed replies when an LLM gate decides context is genuinely useful |
| [mail-pro](./plugins/mail-pro/) | v1.0 | All platforms | Corpus-driven communication analytics add-on — relationship heatmap, style guide generation. Requires the `second-brain` knowledge store |

## Commands

| Command | Plugin | Description |
|---------|--------|-------------|
| `/apple-notes` | manage-apple-notes | List, create, read, and delete Apple Notes |
| `/gmail` | manage-gmail | Read, search, send, reply, forward, and draft Gmail messages |
| `/nano-banana` | manage-nano-banana | Generate or edit images, create diagrams and infographics |
| `/create-nbg-infographic` | manage-nano-banana | Create an NBG-themed infographic using the Gemini API |
| `/youtube` | manage-youtube | Search YouTube, get channel info, retrieve videos and transcripts |
| `/comm-report` | mail-pro | Strategic communication health report with relationship heatmap |
| `/style-rebuild` | mail-pro | Full corpus analysis to generate a statistically-grounded email style guide |

`chat-watch` does not register a slash command — it ships a Python CLI (`monitor.py`) intended to run as a long-lived process (manually or via launchd/systemd). See [plugins/chat-watch/README.md](./plugins/chat-watch/README.md) for setup.

`mail-pro` requires the [`second-brain`](https://github.com/weirdapps/second-brain) knowledge store (private repo). If you do not have access to it, use the `mail` plugin in `plessas-marketplace` instead — it covers all cross-platform use cases without this dependency.

## Installation

Clone this marketplace into Claude Code's marketplaces directory; Claude Code will discover the plugins on next launch:

```bash
mkdir -p ~/.claude/plugins/marketplaces
git clone https://github.com/weirdapps/plessas-lab.git ~/.claude/plugins/marketplaces/plessas-lab
```

Then enable the plugins you want from the Claude Code plugin manager (`/plugin`).

### Update

```bash
cd ~/.claude/plugins/marketplaces/plessas-lab && git pull
```

## Directory Structure

```text
plessas-lab/
├── .claude-plugin/
│   └── marketplace.json             # Marketplace manifest (lists all plugins)
├── plugins/
│   ├── manage-apple-notes/          # Apple Notes integration (v1.0, macOS only)
│   │   ├── skills/
│   │   ├── commands/                # /apple-notes
│   │   └── README.md
│   │
│   ├── manage-gmail/                # Gmail API integration (v1.0)
│   │   ├── skills/
│   │   ├── commands/                # /gmail
│   │   └── README.md
│   │
│   ├── manage-nano-banana/          # Gemini image generation (v1.0)
│   │   ├── skills/
│   │   ├── commands/                # /nano-banana, /create-nbg-infographic
│   │   └── README.md
│   │
│   ├── manage-youtube/              # YouTube content management (v1.0)
│   │   ├── skills/
│   │   ├── commands/                # /youtube
│   │   └── README.md
│   │
│   ├── chat-watch/                  # Teams chat monitor with LLM gate (v0.1, experimental)
│   │   ├── monitor.py               # Long-running CLI (no slash command)
│   │   ├── chats.example.json       # Sanitized config template
│   │   ├── prompts/                 # Sanitized gating-prompt templates
│   │   ├── tests/
│   │   └── README.md
│   │
│   └── mail-pro/                    # Email analytics add-on (v1.0, requires second-brain)
│       ├── commands/                # /comm-report, /style-rebuild
│       ├── scripts/                 # style-sync.py daily cron helper
│       └── README.md
│
├── .github/workflows/
│   ├── validate-plugins.yml         # Plugin manifest and frontmatter validation
│   ├── sonarcloud.yml               # Static analysis and code quality
│   ├── codeql.yml                   # Security scanning
│   ├── pii-check.yml                # PII leak detection on PRs
│   └── dependabot-auto-merge.yml    # Automatic dependency updates
│
├── README.md
└── SECURITY.md
```

## Data Privacy

This marketplace is designed so that **no credentials or personal data are committed to the repository**. All sensitive content stays local.

| Content | Why |
|---------|-----|
| `node_modules/` | Auto-generated dependencies |
| `.env` / `.env.local` | Environment variables and API keys |
| `*credentials*.json` / `token.json` | OAuth tokens and service account keys |
| `*.pem` / `*.key` | Private keys |
| `skill-key/` | Skill credential files |
| `~/.claude/chat-watch/` (outside the repo) | chat-watch per-chat IDs, prompts, and state |

## License

MIT — see individual plugins for their specific licenses.
