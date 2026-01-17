---
name: manage-youtube
description: Search, discover, consume, and manage YouTube content using TypeScript CLI tools. Use when the user asks to search YouTube, get channel information, retrieve videos from a channel, get video transcripts, analyze YouTube content, manage favorite channels, organize saved videos with topics and thematics, or manage YouTube playlists (list, create, update, delete, add/remove videos). Works with channel handles (@username), URLs, or channel IDs. Includes both third-party API tools (no auth required) and official YouTube API tools (OAuth required for playlist management).
---

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
  --channel "@tachesteaches" --json
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
<channel_operations>
**Get channel info (basic)**:
```bash
npx tsx channel-info.ts --channel "@tachesteaches"
```

**Get channel info (detailed with About tab data)**:
```bash
npx tsx channel-info.ts --channel "UC_x5XG1OV2P6uZZ5FSM9Ttw" --detailed --json
```

**Channel identifier formats** (all work for any tool):
- Handle: `@tachesteaches`
- Plain handle: `tachesteaches`
- URL: `https://www.youtube.com/@tachesteaches`
- Channel ID: `UC_x5XG1OV2P6uZZ5FSM9Ttw`
</channel_operations>

<video_retrieval>
**Get N most recent videos from a single channel**:
```bash
npx tsx channel-videos.ts --channel "@GoogleDevelopers" --limit 10 --json
```

**Get videos from multiple channels** (aggregated, sorted by date):
```bash
npx tsx channel-videos.ts --channels "@GoogleDevelopers,@indydevdan,@matthew_berman" --limit 5 --json
```

**Get videos from last N days**:
```bash
npx tsx channel-videos.ts --channel "@GoogleDevelopers" --after-days 7 --json
```

**Get videos from last N days across multiple channels**:
```bash
npx tsx channel-videos.ts --channels "@channel1,@channel2" --after-days 7 --json
```

**Get N most popular videos**:
```bash
npx tsx channel-videos.ts --channel "@GoogleDevelopers" --popular 5 --json
```

**Get N most popular videos across multiple channels**:
```bash
npx tsx channel-videos.ts --channels "@channel1,@channel2" --popular 10 --json
```

**Search within a channel**:
```bash
npx tsx channel-search.ts --channel "@GoogleDevelopers" --query "kubernetes" --limit 10 --json
```

**Multi-channel output includes channel info**:
When using `--channels`, each video includes:
- `channelId` - The channel's YouTube ID
- `channelHandle` - The channel's @handle
- `channelName` - The channel's display name

**Options for channel-videos.ts**:
| Flag | Description |
|------|-------------|
| `--channel <id>` | Single channel (handle, URL, or ID) |
| `--channels <list>` | Comma-separated list of channels |
| `--limit <N>` | Videos per channel (default: 10) |
| `--after-days <N>` | Only videos from last N days |
| `--popular <N>` | Get N most popular by views |
| `--sort-by-date` | Sort by date (auto-enabled for multi-channel) |
| `--json` | Output as JSON |
</video_retrieval>

<search_operations>
**Basic search**:
```bash
npx tsx search.ts --query "react tutorial" --limit 10 --json
```

**Search with filters**:
```bash
npx tsx search.ts --query "python course" \
  --upload-date week \
  --duration long \
  --sort view_count \
  --limit 20 --json
```

**Search filter options**:
- `--type`: video, channel, playlist
- `--upload-date`: hour, today, week, month, year
- `--duration`: short (<4min), medium (4-20min), long (>20min)
- `--sort`: relevance, upload_date, view_count, rating
</search_operations>

<transcript_operations>
**Get transcript as plain text**:
```bash
npx tsx transcript.ts --video "dQw4w9WgXcQ" --text-only
```

**Get transcript with timestamps**:
```bash
npx tsx transcript.ts --video "dQw4w9WgXcQ" --with-timestamps
```

**Get transcript with video details**:
```bash
npx tsx transcript.ts --video "dQw4w9WgXcQ" --with-details --json
```

**Search transcript for keywords**:
```bash
npx tsx transcript.ts --video "dQw4w9WgXcQ" --search "never,gonna,give" --json
```

**Specify language**:
```bash
npx tsx transcript.ts --video "dQw4w9WgXcQ" --lang es --text-only
```
</transcript_operations>

<video_details>
**Get video details**:
```bash
npx tsx video-details.ts --video "dQw4w9WgXcQ" --json
```

**Get video details with related videos**:
```bash
npx tsx video-details.ts --video "dQw4w9WgXcQ" --related 5 --json
```

**Video URL formats supported**:
- Full URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Short URL: `https://youtu.be/dQw4w9WgXcQ`
- Embed URL: `https://www.youtube.com/embed/dQw4w9WgXcQ`
- Shorts URL: `https://www.youtube.com/shorts/abc123`
- Video ID: `dQw4w9WgXcQ`
</video_details>

<favorites_management>
**List all favorite channels**:
```bash
npx tsx favorites.ts --action list --json
```

**Add channels to favorites** (supports multiple, comma-separated):
```bash
# Basic add (just resolves IDs)
npx tsx favorites.ts --action add --channels "@GoogleDevelopers,@freeCodeCamp"

# Add with full info (fetches metadata)
npx tsx favorites.ts --action add --channels "@tachesteaches,fireship" --resolve
```

**Remove channels from favorites** (supports multiple):
```bash
npx tsx favorites.ts --action remove --channels "@GoogleDevelopers,freeCodeCamp"
```

**Get a specific favorite channel**:
```bash
npx tsx favorites.ts --action get --channel "@GoogleDevelopers" --json
```

**Clear all favorites**:
```bash
npx tsx favorites.ts --action clear
```

**Favorites data location**: `~/.google-skills/youtube/favorite-channels.json`

**Stored data per channel**:
- Channel ID, handle, name
- Subscriber count, video count (if --resolve used)
- Description snippet, thumbnail URL
- Date added to favorites
</favorites_management>

<video_organization>
**Video Organization Hierarchy**:
```
Thematic (broad category, e.g., "AI & Machine Learning")
├── Topic (label, e.g., "LangChain Tutorials")
│   ├── Video A
│   └── Video B
└── Topic (label, e.g., "Prompt Engineering")
    └── Video C

Uncategorized Topics (topics without thematic)
└── Topic (e.g., "Watch Later")
    └── Video D

Uncategorized Videos (videos without topics)
└── Video E
```

**Create thematics and topics**:
```bash
# Create a thematic (broad category)
npx tsx video-thematics.ts add "AI & Machine Learning" \
  --description "Videos about AI/ML concepts"

# Create topics within a thematic
npx tsx video-topics.ts add "LangChain" --thematic "AI & Machine Learning"
npx tsx video-topics.ts add "Claude/Anthropic" --thematic "AI & Machine Learning"

# Create an uncategorized topic
npx tsx video-topics.ts add "Watch Later"
```

**Save videos with topics**:
```bash
# Save video with topic and priority (--resolve fetches metadata)
npx tsx saved-videos.ts add "https://youtu.be/abc123" \
  --topic "LangChain" \
  --notes "Great tutorial on LCEL" \
  --priority 1 \
  --resolve

# Save uncategorized video
npx tsx saved-videos.ts add "xyz789" --resolve

# Add multiple topics to existing video
npx tsx saved-videos.ts update abc123 \
  --add-topic "Claude/Anthropic" \
  --add-topic "Prompt Engineering"
```

**Browse and filter videos**:
```bash
# List all videos sorted by priority
npx tsx saved-videos.ts list --sort priority

# List videos in a specific topic
npx tsx saved-videos.ts list --topic "LangChain"

# List all videos in a thematic
npx tsx saved-videos.ts list --thematic "AI & Machine Learning"

# List uncategorized videos
npx tsx saved-videos.ts list --unassigned

# Search videos by keyword
npx tsx saved-videos.ts search "tutorial"
```

**Manage organization structure**:
```bash
# List thematics with topics and counts
npx tsx video-thematics.ts list --with-topics --with-counts

# List all topics with video counts
npx tsx video-topics.ts list --with-counts

# Move topic to different thematic
npx tsx video-topics.ts move "LangChain" --thematic "Web Development"

# Move topic to uncategorized (omit --thematic)
npx tsx video-topics.ts move "LangChain"

# Rename a topic
npx tsx video-topics.ts rename "LangChain" --name "LangChain Framework"

# Get detailed view of a thematic
npx tsx video-thematics.ts get "AI & Machine Learning" --with-topics --with-videos --json
```

**Cascade behavior on delete**:
- Deleting a **topic** removes it from videos (videos retain other topics)
- Deleting a **thematic** makes its topics uncategorized
- Videos are never automatically deleted

**Video data location**: `~/.google-skills/youtube/saved-videos.json`

**Stored data per video** (when using `--resolve`):

| Category | Fields |
|----------|--------|
| **Core** | Video ID, title, URL, date added |
| **Channel** | Channel ID, name, handle (@username) |
| **Content** | Description, duration (text & seconds), published date, category, keywords, isShort |
| **Engagement** | Views (text & count), likes (text & count) |
| **Media** | Thumbnail URL |
| **User** | Topic assignments, personal notes, metadata (priority, extensible), report path |
</video_organization>

<video_reports>
**Reports Management**

Reports are detailed content analyses stored as markdown files. They can be:
- Linked to saved videos (stored in video's `reportPath` field)
- Standalone reports (not linked to any saved video)

**Reports storage**: `~/.google-skills/youtube/reports/`

**Create a report for a video**:
```bash
# Create report from a file and link to saved video
npx tsx video-reports.ts create "Video Analysis Report" report.md \
  --video "zuJyJP517Uw" --link

# Create from stdin
cat report.md | npx tsx video-reports.ts create "My Report" - --video "abc123" --link
```

**Create a standalone report** (not linked to any video):
```bash
npx tsx video-reports.ts create "Research Notes" notes.md
```

**List all reports**:
```bash
npx tsx video-reports.ts list --json
```

**Get report metadata or content**:
```bash
# Get metadata by video ID
npx tsx video-reports.ts get "zuJyJP517Uw" --json

# Get actual report content
npx tsx video-reports.ts get "zuJyJP517Uw" --content
```

**Link/unlink reports**:
```bash
# Link existing report to a saved video
npx tsx video-reports.ts link "report-filename.md" "zuJyJP517Uw"

# Unlink report from video
npx tsx video-reports.ts unlink "zuJyJP517Uw"
```

**Remove a report**:
```bash
npx tsx video-reports.ts remove "zuJyJP517Uw"
```
</video_reports>

<playlist_management>
**YouTube Playlist Management** (OAuth Required)

These tools use the official YouTube Data API v3 and require OAuth authentication.

**First-Time Setup:**
```bash
# Install playlist-tools dependencies (one-time)
cd ./tools/playlist-tools
npm install

# Authenticate with YouTube (opens browser)
npx tsx ./tools/playlist-auth.ts login
```

**Authentication Operations:**
```bash
# Check authentication status
npx tsx playlist-auth.ts status

# Refresh access token
npx tsx playlist-auth.ts refresh

# Logout (remove tokens)
npx tsx playlist-auth.ts logout

# Show storage file paths
npx tsx playlist-auth.ts paths
```

**Playlist CRUD Operations:**
```bash
# List all your playlists
npx tsx playlist-manage.ts list
npx tsx playlist-manage.ts list --json

# Get specific playlist details
npx tsx playlist-manage.ts get PLxxxxxxxxxxxxxxxx --json

# Create a new playlist
npx tsx playlist-manage.ts create --title "My Playlist" --privacy private
npx tsx playlist-manage.ts create --title "Public List" --description "Description" --privacy public

# Update playlist
npx tsx playlist-manage.ts update PLxxxxxxxx --title "New Title"
npx tsx playlist-manage.ts update PLxxxxxxxx --privacy unlisted
npx tsx playlist-manage.ts update PLxxxxxxxx --description "New description"

# Delete playlist (requires confirmation)
npx tsx playlist-manage.ts delete PLxxxxxxxx --confirm
```

**Playlist Item Operations:**
```bash
# List videos in a playlist
npx tsx playlist-manage.ts videos PLxxxxxxxx
npx tsx playlist-manage.ts videos PLxxxxxxxx --json

# Add video to playlist (supports video ID or URL)
npx tsx playlist-manage.ts add-video PLxxxxxxxx dQw4w9WgXcQ
npx tsx playlist-manage.ts add-video PLxxxxxxxx https://youtube.com/watch?v=dQw4w9WgXcQ
npx tsx playlist-manage.ts add-video PLxxxxxxxx dQw4w9WgXcQ --position 0

# Remove video from playlist (uses playlist item ID, not video ID)
# First get the item ID from 'videos' command
npx tsx playlist-manage.ts remove-video PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Sync and Cache Operations:**
```bash
# Sync all playlists to local cache
npx tsx playlist-sync.ts all
npx tsx playlist-sync.ts all --verbose

# Sync specific playlist
npx tsx playlist-sync.ts playlist PLxxxxxxxx

# View cache status
npx tsx playlist-sync.ts status

# View cached playlists (offline)
npx tsx playlist-sync.ts local
npx tsx playlist-sync.ts local --json
npx tsx playlist-sync.ts local PLxxxxxxxx

# Compare local cache with YouTube
npx tsx playlist-sync.ts diff
npx tsx playlist-sync.ts diff --json

# Compare videos in a specific playlist
npx tsx playlist-sync.ts diff-items PLxxxxxxxx

# Clear local cache
npx tsx playlist-sync.ts clear --confirm
```

**Privacy Options:** `public`, `private`, `unlisted`

**Data locations:**
- Tokens: `~/.google-skills/youtube/youtube-tokens.json`
- Cache: `~/.google-skills/youtube/playlists-cache.json`

**API Quota:** Operations cost 1-50 units. Daily limit is 10,000 units.
</playlist_management>
</workflows>

<common_patterns>
**Get latest video and transcribe it**:
```bash
# Get most recent video
VIDEO=$(npx tsx channel-videos.ts --channel "@tachesteaches" --limit 1 --json | jq -r '.[0].id')

# Get its transcript
npx tsx transcript.ts --video "$VIDEO" --with-details --json
```

**Search and analyze results**:
```bash
# Search for videos
npx tsx search.ts --query "AI coding assistant" --upload-date week --limit 5 --json > results.json

# Process each video for transcripts
cat results.json | jq -r '.[].id' | while read vid; do
  npx tsx transcript.ts --video "$vid" --text-only > "transcript_$vid.txt"
done
```

**Monitor channel for new content**:
```bash
# Get videos from last 24 hours
npx tsx channel-videos.ts --channel "@GoogleDevelopers" --after-days 1 --json
```

**Get recent videos from all favorite channels**:
```bash
# Method 1: Use --channels with favorites list (recommended - single call, sorted by date)
HANDLES=$(npx tsx favorites.ts --action list --json | jq -r '.channels[].handle' | tr '\n' ',' | sed 's/,$//')
npx tsx channel-videos.ts --channels "$HANDLES" --limit 3 --json

# Method 2: Loop through each channel separately
npx tsx favorites.ts --action list --json | jq -r '.channels[].handle' | while read handle; do
  echo "=== Videos from $handle ==="
  npx tsx channel-videos.ts --channel "$handle" --limit 3 --json
done
```

**Add multiple channels from a file**:
```bash
# channels.txt contains one handle per line
cat channels.txt | tr '\n' ',' | xargs -I {} npx tsx favorites.ts --action add --channels "{}" --resolve
```

**Save video while watching and organize later**:
```bash
# Quick save without topic
npx tsx saved-videos.ts add "dQw4w9WgXcQ" --resolve

# Later, assign topics
npx tsx saved-videos.ts update "dQw4w9WgXcQ" \
  --add-topic "Music" \
  --notes "Classic!"
```

**Build a curated learning playlist by priority**:
```bash
# Create structure
npx tsx video-thematics.ts add "Learning Path"
npx tsx video-topics.ts add "Week 1" --thematic "Learning Path"
npx tsx video-topics.ts add "Week 2" --thematic "Learning Path"

# Add videos with priority
npx tsx saved-videos.ts add "video1" --topic "Week 1" --priority 1 --resolve
npx tsx saved-videos.ts add "video2" --topic "Week 1" --priority 2 --resolve

# List in order
npx tsx saved-videos.ts list --topic "Week 1" --sort priority
```

**Get high-priority unwatched videos**:
```bash
npx tsx saved-videos.ts list --sort priority --json | jq '.[:5]'
```

**Filter videos by engagement (using JSON output)**:
```bash
# Get most viewed saved videos (using viewCount for accurate sorting)
npx tsx saved-videos.ts list --json | jq 'sort_by(.viewCount) | reverse | .[:10]'

# Find long-form videos (over 20 minutes)
npx tsx saved-videos.ts list --json | jq '[.[] | select(.durationSeconds > 1200)]'

# Find YouTube Shorts
npx tsx saved-videos.ts list --json | jq '[.[] | select(.isShort == true)]'

# Get videos by category
npx tsx saved-videos.ts list --json | jq '[.[] | select(.category == "Education")]'
```

**Use keywords for discovery**:
```bash
# Find videos with specific keywords
npx tsx saved-videos.ts list --json | jq '[.[] | select(.keywords | any(. == "tutorial"))]'
```

**Backup all YouTube playlists locally**:
```bash
# Authenticate if not already done
npx tsx playlist-auth.ts status || npx tsx playlist-auth.ts login

# Sync all playlists with full details
npx tsx playlist-sync.ts all --verbose

# Export to JSON file
npx tsx playlist-manage.ts list --json > ~/my-youtube-playlists.json
```

**Create a YouTube playlist from local saved videos**:
```bash
# Create the playlist on YouTube
npx tsx playlist-manage.ts create --title "From Saved Videos" --privacy private

# Get the playlist ID and add videos from a topic
PLAYLIST_ID="PLxxxxxxxx"
npx tsx saved-videos.ts list --topic "Watch Later" --json | jq -r '.[].videoId' | while read vid; do
  npx tsx playlist-manage.ts add-video "$PLAYLIST_ID" "$vid"
done
```

**Detect and report playlist changes**:
```bash
# First sync to establish baseline
npx tsx playlist-sync.ts all

# Later, check for changes
npx tsx playlist-sync.ts diff --json

# Get detailed changes for specific playlist
npx tsx playlist-sync.ts diff-items PLxxxxxxxx --json
```

**Import videos from YouTube playlist to local organization**:
```bash
# Get videos from a YouTube playlist and save locally
npx tsx playlist-manage.ts videos PLxxxxxxxx --json | jq -r '.[].videoId' | while read vid; do
  npx tsx saved-videos.ts add "$vid" --topic "Imported from YouTube" --resolve
done
```

**Migrate playlist to different privacy setting**:
```bash
# Make a private playlist public
npx tsx playlist-manage.ts update PLxxxxxxxx --privacy public

# Or make it unlisted (accessible only via link)
npx tsx playlist-manage.ts update PLxxxxxxxx --privacy unlisted
```
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
- [references/youtube-guide.md](references/youtube-guide.md) - Full YouTube monitoring guide
- [references/implementation-notes.md](references/implementation-notes.md) - Implementation details and troubleshooting
- [references/video-organization.md](references/video-organization.md) - Video organization feature design and details
- [references/playlist-tools.md](references/playlist-tools.md) - Official YouTube API playlist management guide
</detailed_references>
