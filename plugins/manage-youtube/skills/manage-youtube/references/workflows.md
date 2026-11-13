# YouTube workflows reference

Moved from SKILL.md unchanged. Paths are relative to the skill's root directory; run the tools from `./tools/`.

<workflows>
<channel_operations>
**Get channel info (basic)**:
```bash
npx tsx channel-info.ts --channel "@GoogleDevelopers"
```

**Get channel info (detailed with About tab data)**:

```bash
npx tsx channel-info.ts --channel "UC_x5XG1OV2P6uZZ5FSM9Ttw" --detailed --json
```

**Channel identifier formats** (all work for any tool):

- Handle: `@GoogleDevelopers`
- Plain handle: `GoogleDevelopers`
- URL: `https://www.youtube.com/@GoogleDevelopers`
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
- `--upload-date`: today, week, month, year
- `--duration`: short (<3min), medium (3-20min), long (>20min)
- `--sort`: relevance, view_count
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
npx tsx favorites.ts --action add --channels "@GoogleDevelopers,fireship" --resolve
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
