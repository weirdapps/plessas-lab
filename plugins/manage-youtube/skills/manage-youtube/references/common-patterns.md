# YouTube common patterns

Moved from SKILL.md unchanged. Paths are relative to the skill's root directory; run the tools from `./tools/`.

<common_patterns>
**Get latest video and transcribe it**:

```bash
# Get most recent video
VIDEO=$(npx tsx channel-videos.ts --channel "@GoogleDevelopers" --limit 1 --json | jq -r '.[0].id')

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
