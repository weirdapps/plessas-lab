# YouTube Access Tools - Implementation Notes

**Version:** 1.2
**Date:** January 1, 2026
**Reference Implementation:** `/Users/giorgosmarinos/aiwork/TrainingMaterial/105 - YouTube Content Monitoring using 3rd-APIs/`

---

## Architecture Overview

The access-youtube skill uses a multi-library approach for robustness:

1. **Primary: youtubei.js** - Full-featured YouTube access via InnerTube API
2. **Fallback: youtube-sr** - Lightweight search when InnerTube fails
3. **Transcripts: youtube-caption-extractor** - Dedicated caption extraction

---

## Tool Summary

| Tool | Primary Library | Fallback | Purpose |
|------|----------------|----------|---------|
| channel-info.ts | youtubei.js | - | Channel metadata |
| channel-videos.ts | youtubei.js | - | Video listings |
| channel-search.ts | youtubei.js | - | In-channel search |
| search.ts | youtubei.js | youtube-sr | Global search |
| transcript.ts | youtube-caption-extractor | - | Captions |
| video-details.ts | youtubei.js | - | Video info |
| favorites.ts | Node.js fs + youtubei.js | - | Favorites management |
| saved-videos.ts | Node.js fs + youtubei.js | - | Save and organize videos |
| video-topics.ts | Node.js fs | - | Manage topics (labels) |
| video-thematics.ts | Node.js fs | - | Manage thematics (categories) |

---

## Channel Handle Resolution

The tools support multiple channel identifier formats:

```typescript
// All these resolve to the same channel:
"@tachesteaches"                           // Handle with @
"tachesteaches"                            // Handle without @
"https://www.youtube.com/@tachesteaches"   // Full URL
"UC_x5XG1OV2P6uZZ5FSM9Ttw"                // Channel ID
```

**Resolution logic:**
1. If starts with "UC" and length is 24 → treat as channel ID
2. Extract handle from URL if present
3. Prepend "@" if missing
4. Search YouTube for channel type to get channel ID

---

## Video ID Extraction

Supported URL formats:

```typescript
// All extract to "dQw4w9WgXcQ":
"dQw4w9WgXcQ"                                    // Direct ID
"https://www.youtube.com/watch?v=dQw4w9WgXcQ"   // Standard URL
"https://youtu.be/dQw4w9WgXcQ"                   // Short URL
"https://www.youtube.com/embed/dQw4w9WgXcQ"      // Embed URL
"https://www.youtube.com/shorts/abc123"          // Shorts URL
```

---

## View Count Parsing

YouTube returns views in various formats:

```typescript
// parseViewCount handles:
"1,234 views"     → 1234
"1.2K views"      → 1200
"5.3M views"      → 5300000
"1B views"        → 1000000000
"1.2M"            → 1200000
```

---

## Relative Date Parsing

YouTube returns publish dates as relative strings:

```typescript
// parseRelativeDate handles:
"2 hours ago"      → Date (2 hours before now)
"3 days ago"       → Date (3 days before now)
"1 week ago"       → Date (7 days before now)
"2 months ago"     → Date (2 months before now)
"Streamed 5 hours ago" → Date (5 hours before now)
```

---

## Known Limitations

### youtubei.js Parser Warnings

The library generates warnings about missing/changed node types:
- `VideoSummaryContentView not found!`
- `TicketShelf not found!`

**Impact:** Warnings only - functionality still works.

### Channel Handle Direct API

`client.getChannel('@handle')` returns HTTP 400 error for handles.

**Solution:** Use `client.search(handle, { type: 'channel' })` to resolve handles first.

### Transcript Availability

Not all videos have captions available. The transcript tool will fail with an error for videos without captions.

---

## Caching Strategy

The reference implementation uses in-memory caching:

| Cache Type | TTL | Purpose |
|------------|-----|---------|
| handleCache | 1 hour | Handle → channel ID mappings |
| channelCache | 10 minutes | Channel metadata |
| videoCache | 5 minutes | Video lists |

The CLI tools don't implement persistent caching - each invocation starts fresh.

---

## Favorites Data Storage

Favorites are stored in a JSON file at `~/.google-skills/youtube/favorite-channels.json`.

**Data structure:**

```typescript
interface FavoritesData {
  version: string;           // Data format version
  lastUpdated: string;       // ISO date string
  channels: FavoriteChannel[];
}

interface FavoriteChannel {
  id: string;           // Channel ID (UC...)
  handle: string;       // Handle (@username)
  name: string;         // Display name
  addedAt: string;      // ISO date string
  subscriberCount?: string;
  videoCount?: string;
  description?: string;
  thumbnailUrl?: string;
}
```

**Example file content:**

```json
{
  "version": "1.0",
  "lastUpdated": "2025-12-31T19:30:00.000Z",
  "channels": [
    {
      "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "handle": "@GoogleDevelopers",
      "name": "Google for Developers",
      "addedAt": "2025-12-31T19:30:00.000Z",
      "subscriberCount": "2.59M subscribers",
      "videoCount": "6.9K videos"
    }
  ]
}
```

**Lookup methods:**
- Channels can be found by ID, handle (case-insensitive), or name (case-insensitive)
- The `--resolve` flag fetches full channel metadata when adding (slower but more data)

---

## Video Organization Data Storage

Saved videos are stored in `~/.google-skills/youtube/saved-videos.json`.

**Data structure:**

```typescript
interface SavedVideosData {
  version: string;
  lastUpdated: string;
  thematics: Thematic[];
  topics: Topic[];
  videos: SavedVideo[];
}

interface Thematic {
  id: string;           // UUID
  name: string;
  description?: string;
  createdAt: string;
}

interface Topic {
  id: string;           // UUID
  name: string;
  thematicId: string | null;  // null = uncategorized
  createdAt: string;
}

interface SavedVideo {
  id: string;           // YouTube video ID
  title: string;
  channelId: string;
  channelName: string;
  description?: string;
  duration?: string;
  views?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  addedAt: string;
  topicIds: string[];   // Can be empty (uncategorized)
  notes?: string;
  metadata: {
    priority?: number;
    [key: string]: unknown;
  };
}
```

**Cascade behavior:**
- Deleting a topic removes it from all videos' `topicIds`
- Deleting a thematic sets its topics' `thematicId` to `null`
- Videos are never automatically deleted

**Lookup methods:**
- Thematics/topics found by UUID or name (case-insensitive)
- Videos found by YouTube video ID or URL

For detailed documentation, see [video-organization.md](video-organization.md).

---

## Rate Limiting Recommendations

While these tools don't enforce rate limits, YouTube may temporarily block rapid requests:

```bash
# Good: Add delays between bulk operations
for vid in $videos; do
  npx tsx transcript.ts --video "$vid" --text-only
  sleep 2  # 2 second delay
done

# Bad: No delay between requests
for vid in $videos; do
  npx tsx transcript.ts --video "$vid" --text-only
done
```

Recommended delays:
- Between channel operations: 1-2 seconds
- Between search operations: 2-3 seconds
- Between transcript extractions: 1-2 seconds

---

## Error Types

| Error Type | Common Causes | Recovery |
|------------|---------------|----------|
| RATE_LIMITED | Too many requests | Wait 60s, retry |
| VIDEO_UNAVAILABLE | Private/deleted video | Skip video |
| CHANNEL_NOT_FOUND | Invalid channel ID/handle | Verify input |
| NETWORK_ERROR | Connection issues | Retry |
| PARSE_ERROR | API structure changed | Update library |

---

## Testing

All tools support `--help` for usage information:

```bash
npx tsx channel-info.ts --help
npx tsx channel-videos.ts --help
npx tsx search.ts --help
npx tsx transcript.ts --help
npx tsx video-details.ts --help
npx tsx channel-search.ts --help
npx tsx favorites.ts --help
npx tsx saved-videos.ts --help
npx tsx video-topics.ts --help
npx tsx video-thematics.ts --help
```

Test with known channels:
- `@GoogleDevelopers` (UC_x5XG1OV2P6uZZ5FSM9Ttw)
- `@freeCodeCamp` (UC8butISFwT-Wl7EV0hUK0BQ)
- `@tachesteaches`

Test video for transcripts:
- `dQw4w9WgXcQ` (Rick Astley - Never Gonna Give You Up)

---

## Dependencies

```json
{
  "dependencies": {
    "youtubei.js": "^16.0.1",
    "youtube-sr": "^4.3.11",
    "youtube-caption-extractor": "^1.9.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0"
  }
}
```

---

## Legal Considerations

These tools interact with YouTube's unofficial APIs:

1. **Terms of Service**: Review YouTube's ToS regarding automated access
2. **Rate Limiting**: Respect reasonable request limits
3. **Commercial Use**: Consult legal counsel for business applications
4. **Data Privacy**: Handle user data according to regulations

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 31, 2025 | Initial skill implementation |
| 1.1 | December 31, 2025 | Added favorites.ts for managing favorite channels list |
| 1.2 | January 1, 2026 | Added video organization feature (saved-videos.ts, video-topics.ts, video-thematics.ts) |
