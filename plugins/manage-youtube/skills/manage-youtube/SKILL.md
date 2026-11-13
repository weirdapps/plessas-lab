---
name: manage-youtube
description: Searches YouTube, reads channel information and channel video lists, fetches video transcripts and details, keeps local favourite channels and a saved-video library organised by topics and thematics, and manages the user's own YouTube playlists (list, create, update, delete, add or remove videos, sync), through bundled TypeScript CLI tools. Use when the user asks for any of these, given a channel handle (@name), a URL or an ID. Discovery needs no credentials; playlist management needs YouTube OAuth. Do NOT use for downloading video or audio files, or for video platforms other than YouTube.
---

# YouTube

<!-- safety-guardrails:v1 -->
## Account-changing actions

- Deleting a playlist (`playlist-manage.ts delete <id> --confirm`) and removing a video from a playlist change the user's YouTube account and cannot be undone. Confirm the exact playlist or item with the user before running either.
- Creating or updating a playlist, or changing its privacy, is visible on the user's channel. Say what will change before running it.

> **Path Convention**: All paths in this document are relative to this skill's root directory. When executing commands, first `cd` to the skill directory or adjust paths accordingly.

<objective>
Enable Claude Code to interact with YouTube programmatically using prebuilt TypeScript CLI tools. This skill provides:

1. **Content Discovery** (third-party libraries, no auth required):
   - Channel information and video retrieval
   - Global and channel-specific search
   - Video transcript extraction
   - Favorite channels management

2. **Video Organization** (local storage):
   - Save videos with topics and thematics
   - Create content reports
   - Priority-based organization

3. **Playlist Management** (official YouTube API, OAuth required):
   - Full CRUD on custom playlists (list, create, update, delete)
   - Add/remove/reorder videos in playlists
   - Local caching and sync for offline access
   - Diff detection between local and YouTube
</objective>

<context>
**Tools location**: `./tools/`

**Data storage**: `~/.google-skills/youtube/`

- `favorite-channels.json` - Stored favorite channels list
- `saved-videos.json` - Saved videos with topics and thematics
- `reports/` - Video content reports (markdown files)
- `reports/index.json` - Reports index and metadata
- `YouTubeSkill-Credentials.json` - OAuth credentials (for playlist tools)
- `youtube-tokens.json` - OAuth tokens (auto-created by playlist tools)
- `playlists-cache.json` - Local playlist cache (auto-created by playlist tools)

**Setup for Content Discovery Tools** (no auth required):

```bash
cd ./tools
npm install
```

**Setup for Playlist Management Tools** (OAuth required):

```bash
# Install dependencies
cd ./tools/playlist-tools
npm install

# Authenticate with YouTube (opens browser)
npx tsx ./tools/playlist-auth.ts login
```

**Two Types of Tools:**

| Category | Authentication | Write Access | Quota Limits |
|----------|----------------|--------------|--------------|
| Content Discovery (channel-*, search, transcript, etc.) | None | No | Informal |
| Playlist Management (playlist-*) | OAuth 2.0 | Yes | 10,000 units/day |

**Libraries used**:

- `youtubei.js` - Full YouTube access via InnerTube API (content discovery)
- `youtube-sr` - Lightweight search fallback (content discovery)
- `youtube-caption-extractor` - Transcript extraction (content discovery)
- `googleapis` - Official Google API client (playlist management)
</context>

<quick_start>
**Get channel information**:

```bash
npx tsx ./tools/channel-info.ts \
  --channel "@GoogleDevelopers" --json
```

**Get recent videos from a channel**:

```bash
npx tsx ./tools/channel-videos.ts \
  --channel "@GoogleDevelopers" --limit 5 --json
```

**Get recent videos from multiple channels**:

```bash
npx tsx ./tools/channel-videos.ts \
  --channels "@GoogleDevelopers,@indydevdan,@matthew_berman" --limit 3 --json
```

**Search YouTube**:

```bash
npx tsx ./tools/search.ts \
  --query "typescript tutorial 2025" --limit 10 --json
```

**Get video transcript**:

```bash
npx tsx ./tools/transcript.ts \
  --video "dQw4w9WgXcQ" --text-only
```

**Get video details**:

```bash
npx tsx ./tools/video-details.ts \
  --video "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --json
```

**Manage favorite channels**:

```bash
# Add channels to favorites
npx tsx ./tools/favorites.ts \
  --action add --channels "@GoogleDevelopers,@freeCodeCamp" --resolve

# List favorites
npx tsx ./tools/favorites.ts --action list --json
```

**Manage YouTube playlists** (requires OAuth):

```bash
# Authenticate first (one-time)
npx tsx ./tools/playlist-auth.ts login

# List all your playlists
npx tsx ./tools/playlist-manage.ts list --json

# Create a new playlist
npx tsx ./tools/playlist-manage.ts create \
  --title "My Learning Path" --privacy private

# Add video to playlist
npx tsx ./tools/playlist-manage.ts \
  add-video PLxxxxxxxx dQw4w9WgXcQ

# Sync all playlists locally
npx tsx ./tools/playlist-sync.ts all
```

</quick_start>

<prebuilt_tools>
**Location**: `./tools/`

### Content Discovery Tools (No Authentication)

| Tool | Purpose |
|------|---------|
| `channel-info.ts` | Get channel metadata (name, subscribers, description) |
| `channel-videos.ts` | Get videos from channel (recent, by date, popular) |
| `channel-search.ts` | Search for videos within a specific channel |
| `search.ts` | Search YouTube globally with filters |
| `transcript.ts` | Get video captions/transcript |
| `video-details.ts` | Get detailed video info and related videos |

### Local Organization Tools (No Authentication)

| Tool | Purpose |
|------|---------|
| `favorites.ts` | Manage favorite channels list (add, remove, list) |
| `saved-videos.ts` | Save and organize videos with topics |
| `video-topics.ts` | Manage topics (labels) for video organization |
| `video-thematics.ts` | Manage thematics (groups of topics) |
| `video-reports.ts` | Create and manage video content reports |

### Playlist Management Tools (OAuth Required)

| Tool | Purpose |
|------|---------|
| `playlist-auth.ts` | OAuth authentication for YouTube API (login, logout, status) |
| `playlist-manage.ts` | Full CRUD on playlists and playlist items |
| `playlist-sync.ts` | Local caching, sync, and diff operations |

### Shared Libraries (Not CLI Tools)

| Library | Purpose |
|---------|---------|
| `youtube-client.ts` | Shared client for content discovery tools |
| `video-library-client.ts` | Shared client for video organization |

**Tool characteristics:**

- Content discovery tools accept channel handles (@username), URLs, or channel IDs
- All tools support `--json` flag for structured output
- All tools support `--help` flag for usage information
- Print status messages to stderr, data to stdout
- Playlist tools require one-time OAuth authentication
</prebuilt_tools>

<workflows>
Step-by-step command lines for every task (channel operations, video retrieval, search, transcripts, video details, favourites, video organisation, video reports, playlist management) are in [references/workflows.md](references/workflows.md). Read the matching section before running a tool whose flags are not shown in Quick start above.
</workflows>

<common_patterns>
Multi-step recipes (latest video plus transcript, daily digests across favourite channels, building a library, syncing playlists) are in [references/common-patterns.md](references/common-patterns.md).
</common_patterns>

<error_handling>
**Common errors and solutions**:

### Content Discovery Tool Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Could not resolve channel handle | Invalid handle or channel doesn't exist | Verify the handle/URL is correct |
| Failed to fetch transcript | No captions available | Not all videos have captions |
| InnerTube search failed | Rate limiting or API changes | Tool auto-falls back to youtube-sr |
| Client not initialized | Internal error | Report issue, retry |

### Playlist Tool Errors (Official API)

| Error | Cause | Solution |
|-------|-------|----------|
| AUTH_REQUIRED | Not authenticated | Run `playlist-auth.ts login` |
| AUTH_EXPIRED | Access token expired | Run `playlist-auth.ts refresh` or `login` |
| QUOTA_EXCEEDED | API quota exceeded | Wait 24 hours or request quota increase |
| PLAYLIST_NOT_FOUND | Invalid playlist ID | Verify playlist exists and ID is correct |
| VIDEO_NOT_FOUND | Invalid video ID | Verify video exists and ID format is valid |
| PERMISSION_DENIED | Not your playlist | Can only modify your own playlists |
| Invalid playlist ID | ID format wrong | Playlist IDs start with PL, UU, LL, WL, etc. |
| Invalid video ID | ID format wrong | Video IDs are exactly 11 characters |

**Rate limiting**:

- Content discovery tools: No built-in rate limiting. Add delays for bulk operations.
- Playlist tools: Automatic retry with exponential backoff for transient errors. Daily quota limit applies.
</error_handling>

<anti_patterns>

- **Never run bulk operations without delays** - YouTube may temporarily block rapid requests
- **Never expect all videos to have transcripts** - Some videos have no captions
- **Never hardcode video/channel IDs** - Accept as parameters
- **Never ignore the --json flag for scripting** - Human-readable output is harder to parse
</anti_patterns>

<success_criteria>
A successful YouTube operation:

- Returns valid JSON when `--json` flag is used
- Prints `[OK]` status messages to stderr
- Exit code 0 for success, 1 for errors
- Handles all supported URL/ID formats
</success_criteria>

<detailed_references>
For complete implementation details and library documentation, see:

- [SETUP-CREDENTIALS.md](SETUP-CREDENTIALS.md) - First-time credentials setup for playlist management
- [references/workflows.md](references/workflows.md) - Command lines for every task, moved from this file
- [references/common-patterns.md](references/common-patterns.md) - Multi-step recipes, moved from this file
- [references/youtube-guide.md](references/youtube-guide.md) - Full YouTube monitoring guide
- [references/implementation-notes.md](references/implementation-notes.md) - Implementation details and troubleshooting
- [references/video-organization.md](references/video-organization.md) - Video organization feature design and details
- [references/playlist-tools.md](references/playlist-tools.md) - Official YouTube API playlist management guide
</detailed_references>
