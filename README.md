# Utility Marketplace

A marketplace of utility and productivity plugins for Claude Code. Tools for file management, Google Workspace integration, image generation, Apple Notes, YouTube content, and PDF processing.

## Available Plugins

| Plugin | Version | Category | Description |
|--------|---------|----------|-------------|
| [manage-apple-notes](./plugins/manage-apple-notes/) | v1.0 | Productivity | CRUD operations for Apple Notes — persistent storage of thoughts, data, and information across sessions |
| [manage-gemini-file-search](./plugins/manage-gemini-file-search/) | v1.0 | Search | Manage Google Gemini File Search stores and documents — create stores, upload, query, update, and delete documents for RAG and semantic search |
| [manage-gmail](./plugins/manage-gmail/) | v1.0 | Communications | Access and process Gmail messages via the Gmail API — read, search, list, send, reply, and forward emails with OAuth 2.0 |
| [manage-google-workspace](./plugins/manage-google-workspace/) | v1.0 | Productivity | Full Google Workspace integration — Drive (list, search, upload, download), Docs, Sheets (CRUD, queries), and Slides via TypeScript CLI tools |
| [manage-nano-banana](./plugins/manage-nano-banana/) | v1.0 | Creative | Generate and edit images, diagrams, infographics, and visualizations using Google's Nano Banana API (Gemini Image Generation) |
| [manage-youtube](./plugins/manage-youtube/) | v1.0 | Media | Search, discover, and manage YouTube content — channels, videos, transcripts, favorites, playlists via TypeScript CLI tools |
| [nbg-presentation-format](./plugins/nbg-presentation-format/) | v1.0 | Presentations | NBG corporate brand guidelines for presentations — slides, charts, tables, icons, and color palettes |
| [pdf-splitter](./plugins/pdf-splitter/) | v1.0 | Documents | Split PDF files into individual pages as separate PDF or PNG files using TypeScript |

## Commands

| Command | Plugin | Description |
|---------|--------|-------------|
| `/apple-notes` | manage-apple-notes | Access and manage Apple Notes (list, create, read, delete) |
| `/gmail` | manage-gmail | Access and process Gmail messages (list, search, read, send, reply, forward, draft) |
| `/google-drive` | manage-google-workspace | Access and manage Google Drive files, folders, and documents |
| `/nano-banana` | manage-nano-banana | Generate or edit images, create diagrams and visualizations |
| `/create-nbg-infographic` | manage-nano-banana | Create an NBG-themed infographic using Nano Banana |
| `/youtube` | manage-youtube | Search YouTube, get channel info, retrieve videos and transcripts |
| `/split-pdf` | pdf-splitter | Split PDF files into individual pages (PDF or PNG format) |

## Installation

### Quick Install

```bash
curl -sSL https://raw.githubusercontent.com/weirdapps/marketplace-utility/main/install.sh | bash
```

### Manual Install

```bash
mkdir -p ~/.claude/plugins/marketplaces
git clone git@github.com:weirdapps/marketplace-utility.git ~/.claude/plugins/marketplaces/marketplace-utility
cd ~/.claude/plugins/marketplaces/marketplace-utility
./install.sh
```

### Update

```bash
cd ~/.claude/plugins/marketplaces/marketplace-utility && git pull
```

## Directory Structure

```
marketplace-utility/
├── .claude-plugin/
│   └── marketplace.json         # Marketplace manifest (lists all plugins)
├── plugins/
│   ├── manage-apple-notes/      # Apple Notes integration (v1.0)
│   │   ├── skills/              # Skill definition
│   │   ├── commands/            # /apple-notes
│   │   └── README.md
│   │
│   ├── manage-gemini-file-search/  # Gemini RAG & document search (v1.0)
│   │   ├── skills/
│   │   └── README.md
│   │
│   ├── manage-gmail/            # Gmail API integration (v1.0)
│   │   ├── skills/
│   │   ├── commands/            # /gmail
│   │   └── README.md
│   │
│   ├── manage-google-workspace/ # Google Drive, Docs, Sheets, Slides (v1.0)
│   │   ├── skills/
│   │   ├── commands/            # /google-drive
│   │   └── README.md
│   │
│   ├── manage-nano-banana/      # Gemini image generation (v1.0)
│   │   ├── skills/
│   │   ├── commands/            # /nano-banana, /create-nbg-infographic
│   │   └── README.md
│   │
│   ├── manage-youtube/          # YouTube content management (v1.0)
│   │   ├── skills/
│   │   ├── commands/            # /youtube, /create-nbg-infographic
│   │   └── README.md
│   │
│   ├── nbg-presentation-format/ # NBG brand guidelines (v1.0)
│   │   ├── skills/
│   │   └── README.md
│   │
│   └── pdf-splitter/            # PDF splitting tool (v1.0)
│       ├── skills/
│       ├── commands/            # /split-pdf
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
| `productivity` | Notes, file management, and workspace tools |
| `search` | Document indexing, semantic search, and RAG |
| `communications` | Email access and processing |
| `creative` | Image generation, diagrams, and visualizations |
| `media` | Video content search, discovery, and management |
| `presentations` | Presentation creation and brand formatting |
| `documents` | Document processing and conversion |

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
