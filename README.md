# plessas-lab

A lab marketplace of experimental Claude Code plugins. Tools for Apple Notes, Gmail, image generation, YouTube content management, and a Microsoft Teams chat monitor.

> Companion to [plessas-marketplace](https://github.com/weirdapps/plessas-marketplace) (production-grade workplace plugins). Plugins here are flagged "lab" because they require external API setup (Google OAuth, Gemini key, etc.) or are experimental in scope.

## Available Plugins

| Plugin | Version | Category | Platform | Description |
|--------|---------|----------|----------|-------------|
| [manage-apple-notes](./plugins/manage-apple-notes/) | v1.0 | Productivity | macOS only | CRUD operations for Apple Notes — persistent storage of thoughts, data, and information across sessions |
| [manage-gmail](./plugins/manage-gmail/) | v1.0 | Communications | All platforms | Access and process Gmail messages via the Gmail API — read, search, list, send, reply, and forward emails with OAuth 2.0 |
| [manage-nano-banana](./plugins/manage-nano-banana/) | v1.0 | Creative | All platforms | Generate and edit images, diagrams, infographics, and visualizations using Google's Nano Banana API (Gemini Image Generation) |
| [manage-youtube](./plugins/manage-youtube/) | v1.0 | Media | All platforms | Search, discover, and manage YouTube content — channels, videos, transcripts, favorites, playlists via TypeScript CLI tools |
| [chat-watch](./plugins/chat-watch/) | v0.1 (experimental) | Communications | All platforms | Polls one or more Microsoft Teams chats and posts `[Claude]`-prefixed replies when an LLM gate decides adding context is genuinely useful |

## Commands

| Command | Plugin | Description |
|---------|--------|-------------|
| `/apple-notes` | manage-apple-notes | Access and manage Apple Notes (list, create, read, delete) |
| `/gmail` | manage-gmail | Access and process Gmail messages (list, search, read, send, reply, forward, draft) |
| `/nano-banana` | manage-nano-banana | Generate or edit images, create diagrams and visualizations |
| `/create-nbg-infographic` | manage-nano-banana | Create an NBG-themed infographic using Nano Banana |
| `/youtube` | manage-youtube | Search YouTube, get channel info, retrieve videos and transcripts |

`chat-watch` does not register a slash command — it ships a Python CLI (`monitor.py`) intended to run as a long-lived process (manually or via launchd). See [plugins/chat-watch/README.md](./plugins/chat-watch/README.md) for setup.

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
│   └── marketplace.json         # Marketplace manifest (lists all plugins)
├── plugins/
│   ├── manage-apple-notes/      # Apple Notes integration (v1.0)
│   │   ├── skills/              # Skill definition
│   │   ├── commands/            # /apple-notes
│   │   └── README.md
│   │
│   ├── manage-gmail/            # Gmail API integration (v1.0)
│   │   ├── skills/
│   │   ├── commands/            # /gmail
│   │   └── README.md
│   │
│   ├── manage-nano-banana/      # Gemini image generation (v1.0)
│   │   ├── skills/
│   │   ├── commands/            # /nano-banana, /create-nbg-infographic
│   │   └── README.md
│   │
│   ├── manage-youtube/          # YouTube content management (v1.0)
│   │   ├── skills/
│   │   ├── commands/            # /youtube
│   │   └── README.md
│   │
│   └── chat-watch/              # Teams chat monitor with LLM gate (v0.1, experimental)
│       ├── monitor.py           # Long-running CLI (no slash command)
│       ├── chats.example.json   # Sanitized config template
│       ├── prompts/             # Sanitized gating-prompt templates
│       ├── tests/
│       └── README.md
│
├── .github/workflows/
│   └── validate-plugins.yml     # CI validation pipeline
│
├── README.md
└── SECURITY.md
```

## Plugin Categories

| Category | Description |
|----------|-------------|
| `productivity` | Notes and workspace tools |
| `communications` | Email and messaging access |
| `creative` | Image generation, diagrams, and visualizations |
| `media` | Video content search, discovery, and management |

## Data Privacy

This marketplace is designed so that **no credentials or personal data are committed to the repository**. All sensitive content stays local.

### What stays local (gitignored)

| Content | Why |
|---------|-----|
| `node_modules/` | Auto-generated dependencies |
| `.env` / `.env.local` | Environment variables and API keys |
| `*credentials*.json` / `token.json` | OAuth tokens and service account keys |
| `*.pem` / `*.key` | Private keys |
| `skill-key/` | Skill credential files |
| `~/.claude/chat-watch/` (outside the repo) | chat-watch per-chat ids, prompts, state |

## License

MIT -- See individual plugins for their specific licenses.
