# manage-youtube

Search, discover, consume, and manage YouTube content using TypeScript CLI tools. Use when you want Claude to search YouTube, get channel information, retrieve videos from a channel, get video transcripts, analyze YouTube content, manage favorite channels, organize saved videos with topics and thematics, or manage YouTube playlists (list, create, update, delete, add/remove videos).

## Overview

The plugin exposes two distinct toolsets through the `manage-youtube` skill:

| Toolset | Auth required? | What it does |
|---------|----------------|--------------|
| **Content discovery** | No | Search YouTube, fetch channel metadata (handles like `@username`, URLs, or channel IDs all work), list videos from a channel, fetch video transcripts |
| **Playlist management** | Yes (OAuth) | Create / read / update / delete playlists on your account, add and remove videos |

You only need OAuth setup if you want playlist management. Discovery tools work out of the box.

## Prerequisites

- Node.js 18+ (for the TypeScript CLI).
- For **playlist management only**: a Google Cloud project with **YouTube Data API v3** enabled and an OAuth 2.0 Desktop client.

## Installation

```bash
/plugin install manage-youtube
```

For discovery tools, you're done — start asking Claude about YouTube channels or videos.

For playlist management, complete the OAuth setup (~10 minutes):

1. Read [`skills/manage-youtube/SETUP-CREDENTIALS.md`](./skills/manage-youtube/SETUP-CREDENTIALS.md) for the step-by-step Google Cloud Console walkthrough.
2. Install the downloaded `client_secret_*.json` to `~/.google-skills/youtube/YouTubeSkill-Credentials.json`.
3. Install playlist-tool deps: `cd ./tools/playlist-tools && npm install`
4. Authenticate: `npx tsx ./tools/playlist-auth.ts login`

## Usage

This plugin provides the `manage-youtube` skill which Claude invokes automatically based on conversation context. Examples:

- "Get the transcript of this YouTube video: <url>"
- "What are the latest videos on @mkbhd?"
- "Search YouTube for 'kubernetes networking deep dive'"
- "Create a playlist called 'Watch later' and add these videos"

The slash command `/youtube` is also available for explicit invocation.

## Documentation

- [`skills/manage-youtube/SKILL.md`](./skills/manage-youtube/SKILL.md) — full skill documentation
- [`skills/manage-youtube/SETUP-CREDENTIALS.md`](./skills/manage-youtube/SETUP-CREDENTIALS.md) — OAuth setup walkthrough (playlist features only)

## License

MIT
