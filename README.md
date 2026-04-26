# Integrations Marketplace

A marketplace of integration plugins for Claude Code. Tools for Apple Notes, Gmail, image generation, and YouTube content management.

## Available Plugins

| Plugin | Version | Category | Description |
|--------|---------|----------|-------------|
| [manage-apple-notes](./plugins/manage-apple-notes/) | v1.0 | Productivity | CRUD operations for Apple Notes — persistent storage of thoughts, data, and information across sessions |
| [manage-gmail](./plugins/manage-gmail/) | v1.0 | Communications | Access and process Gmail messages via the Gmail API — read, search, list, send, reply, and forward emails with OAuth 2.0 |
| [manage-nano-banana](./plugins/manage-nano-banana/) | v1.0 | Creative | Generate and edit images, diagrams, infographics, and visualizations using Google's Nano Banana API (Gemini Image Generation) |
| [manage-youtube](./plugins/manage-youtube/) | v1.0 | Media | Search, discover, and manage YouTube content — channels, videos, transcripts, favorites, playlists via TypeScript CLI tools |

## Commands

| Command | Plugin | Description |
|---------|--------|-------------|
| `/apple-notes` | manage-apple-notes | Access and manage Apple Notes (list, create, read, delete) |
| `/gmail` | manage-gmail | Access and process Gmail messages (list, search, read, send, reply, forward, draft) |
| `/nano-banana` | manage-nano-banana | Generate or edit images, create diagrams and visualizations |
| `/create-nbg-infographic` | manage-nano-banana | Create an NBG-themed infographic using Nano Banana |
| `/youtube` | manage-youtube | Search YouTube, get channel info, retrieve videos and transcripts |

## Installation

Clone this marketplace into Claude Code's marketplaces directory; Claude Code will discover the plugins on next launch:

```bash
mkdir -p ~/.claude/plugins/marketplaces
git clone https://github.com/weirdapps/integrations-marketplace.git ~/.claude/plugins/marketplaces/integrations-marketplace
```

Then enable the plugins you want from the Claude Code plugin manager (`/plugin`).

### Update

```bash
cd ~/.claude/plugins/marketplaces/integrations-marketplace && git pull
```

## Directory Structure

```
integrations-marketplace/
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
│   └── manage-youtube/          # YouTube content management (v1.0)
│       ├── skills/
│       ├── commands/            # /youtube, /create-nbg-infographic
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
| `communications` | Email access and processing |
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

## License

MIT -- See individual plugins for their specific licenses.
