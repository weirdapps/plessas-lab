# Playlist Tools Reference

**Location:** `./tools/playlist-tools/`

## Overview

Playlist Tools provides full CRUD operations on YouTube custom playlists using the official YouTube Data API v3 with OAuth 2.0 authentication. Unlike the third-party library tools (youtubei.js), this uses Google's official API, which is required for write operations.

## Key Differences from Third-Party Tools

| Feature | Third-Party Tools | Playlist Tools (Official API) |
|---------|-------------------|-------------------------------|
| Authentication | None required | OAuth 2.0 required |
| Read operations | Yes | Yes |
| Write operations | No | Yes (create, update, delete) |
| Rate limits | Informal | Official quota (10,000/day) |
| Reliability | May break with YouTube changes | Stable, official support |
| Private playlists | No access | Full access |

## When to Use Which

**Use Third-Party Tools (channel-info, search, transcript, etc.) for:**

- Public content discovery
- Channel information
- Video transcripts
- Quick searches
- No authentication needed scenarios

**Use Playlist Tools for:**

- Managing your own playlists
- Creating/deleting playlists
- Adding/removing videos from playlists
- Accessing private/unlisted playlists
- Syncing playlist data locally

## File Storage

```
~/.google-skills/youtube/
├── YouTubeSkill-Credentials.json   # OAuth credentials (required)
├── youtube-tokens.json              # Stored OAuth tokens (auto-created)
└── playlists-cache.json             # Local playlist cache (auto-created)
```

## Initial Setup

### 1. Credentials File

Ensure you have OAuth credentials at `~/.google-skills/youtube/YouTubeSkill-Credentials.json`:

```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "project_id": "your-project-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost:3000/oauth/callback"]
  }
}
```

### 2. Install Dependencies

```bash
cd ./tools/playlist-tools
npm install
```

### 3. Authenticate

```bash
npx tsx playlist-auth.ts login
```

This opens a browser for Google OAuth consent. After authorization, tokens are stored automatically.

## CLI Commands Reference

### Authentication (playlist-auth.ts)

```bash
# Authenticate with YouTube (opens browser)
npx tsx playlist-auth.ts login

# Check authentication status
npx tsx playlist-auth.ts status

# Remove stored tokens (logout)
npx tsx playlist-auth.ts logout

# Manually refresh access token
npx tsx playlist-auth.ts refresh

# Show file paths
npx tsx playlist-auth.ts paths
```

### Playlist Management (playlist-manage.ts)

```bash
# List all your playlists
npx tsx playlist-manage.ts list
npx tsx playlist-manage.ts list --json

# Get specific playlist details
npx tsx playlist-manage.ts get <playlist-id>
npx tsx playlist-manage.ts get <playlist-id> --json

# Create a new playlist
npx tsx playlist-manage.ts create --title "My Playlist" --description "Description" --privacy private

# Update a playlist
npx tsx playlist-manage.ts update <playlist-id> --title "New Title"
npx tsx playlist-manage.ts update <playlist-id> --privacy public
npx tsx playlist-manage.ts update <playlist-id> --description "New description"

# Delete a playlist (requires confirmation)
npx tsx playlist-manage.ts delete <playlist-id> --confirm

# List videos in a playlist
npx tsx playlist-manage.ts videos <playlist-id>
npx tsx playlist-manage.ts videos <playlist-id> --json

# Add a video to a playlist
npx tsx playlist-manage.ts add-video <playlist-id> <video-id>
npx tsx playlist-manage.ts add-video <playlist-id> https://youtube.com/watch?v=dQw4w9WgXcQ
npx tsx playlist-manage.ts add-video <playlist-id> <video-id> --position 0

# Remove a video from a playlist (uses playlist item ID)
npx tsx playlist-manage.ts remove-video <playlist-item-id>
```

### Sync Operations (playlist-sync.ts)

```bash
# Sync all playlists to local cache
npx tsx playlist-sync.ts all
npx tsx playlist-sync.ts all --verbose

# Sync a specific playlist
npx tsx playlist-sync.ts playlist <playlist-id>

# Show cache status
npx tsx playlist-sync.ts status

# List playlists from local cache (offline)
npx tsx playlist-sync.ts local
npx tsx playlist-sync.ts local --json
npx tsx playlist-sync.ts local <playlist-id>

# Compare local cache with YouTube
npx tsx playlist-sync.ts diff
npx tsx playlist-sync.ts diff --json

# Compare videos in a specific playlist
npx tsx playlist-sync.ts diff-items <playlist-id>

# Clear local cache
npx tsx playlist-sync.ts clear --confirm
```

## Common Workflows

### Backup All Playlists Locally

```bash
# Authenticate
npx tsx playlist-auth.ts login

# Sync all playlists and videos
npx tsx playlist-sync.ts all --verbose

# Check what's cached
npx tsx playlist-sync.ts status
```

### Create and Populate a Playlist

```bash
# Create a new private playlist
npx tsx playlist-manage.ts create --title "Learning Path" --privacy private

# Note the playlist ID from output, then add videos
npx tsx playlist-manage.ts add-video PLxxxxxxxx dQw4w9WgXcQ
npx tsx playlist-manage.ts add-video PLxxxxxxxx https://youtu.be/abc123
```

### Detect Changes Since Last Sync

```bash
# Show what changed
npx tsx playlist-sync.ts diff

# See detailed video changes for a playlist
npx tsx playlist-sync.ts diff-items PLxxxxxxxx
```

### Export Playlist to JSON

```bash
# Get all playlists with full details
npx tsx playlist-manage.ts list --json > my-playlists.json

# Get specific playlist videos
npx tsx playlist-manage.ts videos PLxxxxxxxx --json > playlist-videos.json
```

## API Quota Considerations

| Operation | Quota Cost |
|-----------|------------|
| List playlists | 1 unit |
| Get playlist | 1 unit |
| List videos | 1 unit |
| Create playlist | 50 units |
| Update playlist | 50 units |
| Delete playlist | 50 units |
| Add video | 50 units |
| Remove video | 50 units |

**Default daily quota:** 10,000 units

**Best practices:**

- Use local cache (`playlist-sync.ts local`) for reads when possible
- Batch operations carefully
- Monitor quota in Google Cloud Console

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| AUTH_REQUIRED | Not authenticated | Run `playlist-auth.ts login` |
| AUTH_EXPIRED | Token expired | Run `playlist-auth.ts refresh` or `login` |
| QUOTA_EXCEEDED | API quota exceeded | Wait 24 hours or request quota increase |
| PLAYLIST_NOT_FOUND | Invalid playlist ID | Verify playlist exists and you have access |
| PERMISSION_DENIED | Not your playlist | Can only modify your own playlists |

## Programmatic Usage

The playlist-tools library can also be used programmatically:

```typescript
import {
  // Auth
  authenticate,
  getAuthStatus,

  // Playlists
  listPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  searchPlaylists,

  // Playlist Items
  listPlaylistItems,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  moveVideoInPlaylist,
  isVideoInPlaylist,

  // Sync
  syncAll,
  syncPlaylist,
  getLocalPlaylists,
  getLocalPlaylist,
  comparePlaylists,

  // Validation
  isValidPlaylistId,
  isValidVideoId,
  extractVideoId,
} from './tools/playlist-tools/src/index.js';
```

## Integration with Video Organization

The playlist-tools can be combined with the video organization system:

1. **Sync playlists** to get current YouTube state
2. **Save videos** to local library with topics
3. **Create reports** for interesting videos
4. **Organize** using thematics and topics

Example workflow:

```bash
# Sync YouTube playlists
npx tsx playlist-sync.ts all

# Get videos from a playlist
npx tsx playlist-manage.ts videos PLxxxxxxxx --json | jq '.[].videoId' | while read vid; do
  # Save each video locally with a topic
  npx tsx saved-videos.ts add "$vid" --topic "From YouTube Playlist" --resolve
done
```
