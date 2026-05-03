# Video Organization Feature Reference

This document provides detailed information about the video organization feature for the access-youtube skill.

## Overview

The video organization feature allows users to save YouTube videos and organize them using a two-level hierarchy:

1. **Thematics** - Broad categories (e.g., "AI & Machine Learning", "Web Development")
2. **Topics** - Specific labels within thematics (e.g., "LangChain Tutorials", "React Hooks")

Videos can be assigned to multiple topics, and both topics and videos can exist without categorization.

## Data Storage

**File**: `~/.google-skills/youtube/saved-videos.json`

### Data Structure

```json
{
  "version": "1.1",
  "lastUpdated": "ISO 8601 timestamp",
  "thematics": [
    {
      "id": "uuid",
      "name": "AI & Machine Learning",
      "description": "Videos about AI/ML concepts",
      "createdAt": "ISO 8601 timestamp"
    }
  ],
  "topics": [
    {
      "id": "uuid",
      "name": "LangChain Tutorials",
      "thematicId": "uuid or null",
      "createdAt": "ISO 8601 timestamp"
    }
  ],
  "videos": [
    {
      "id": "YouTube video ID",
      "title": "Video Title",
      "url": "https://www.youtube.com/watch?v=...",
      "channelId": "UCxxxxxxxx",
      "channelName": "Channel Name",
      "channelHandle": "@ChannelHandle",
      "description": "Video description (first 500 chars)",
      "duration": "12:34",
      "durationSeconds": 754,
      "publishedAt": "Oct 25, 2009",
      "category": "Education",
      "keywords": ["tutorial", "coding", "javascript"],
      "isShort": false,
      "views": "1.2M",
      "viewCount": 1200000,
      "likes": "45K",
      "likeCount": 45000,
      "thumbnailUrl": "https://i.ytimg.com/vi/.../default.jpg",
      "addedAt": "ISO 8601 timestamp",
      "topicIds": ["uuid1", "uuid2"],
      "notes": "Personal notes",
      "metadata": {
        "priority": 1
      }
    }
  ]
}
```

### Video Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | YouTube video ID (11 chars) |
| `title` | string | Video title |
| `url` | string | Full YouTube URL |
| `channelId` | string | Channel ID (UCxxxxxx format) |
| `channelName` | string | Channel display name |
| `channelHandle` | string? | Channel handle (e.g., "@GoogleDevelopers") |
| `description` | string? | Video description (first 500 chars) |
| `duration` | string? | Human-readable duration (e.g., "12:34") |
| `durationSeconds` | number? | Duration in seconds (for sorting/filtering) |
| `publishedAt` | string? | Publication date text |
| `category` | string? | YouTube category (e.g., "Education") |
| `keywords` | string[]? | Video tags/keywords (up to 10) |
| `isShort` | boolean? | Whether this is a YouTube Short |
| `views` | string? | Human-readable view count (e.g., "1.2M") |
| `viewCount` | number? | Exact view count (for sorting/filtering) |
| `likes` | string? | Human-readable like count (e.g., "45K") |
| `likeCount` | number? | Exact like count (for sorting/filtering) |
| `thumbnailUrl` | string? | Thumbnail URL |
| `addedAt` | string | ISO 8601 timestamp when saved |
| `topicIds` | string[] | Array of topic UUIDs |
| `notes` | string? | User's personal notes |
| `metadata` | object | Extensible metadata (priority, etc.) |

## CLI Tools

### video-thematics.ts

Manages thematics (broad categories).

**Actions**:

| Action | Description |
|--------|-------------|
| `list` | List all thematics |
| `add <name>` | Create a new thematic |
| `remove <id\|name>` | Delete a thematic |
| `rename <id\|name>` | Rename or update description |
| `get <id\|name>` | Get thematic details |

**Options**:

- `--description "text"` - Set/update description
- `--name <new-name>` - New name for rename
- `--with-topics` - Include topics in output
- `--with-counts` - Include video counts
- `--with-videos` - Include all videos (for get)
- `--json` - JSON output

### video-topics.ts

Manages topics (labels for videos).

**Actions**:

| Action | Description |
|--------|-------------|
| `list` | List all topics |
| `add <name>` | Create a new topic |
| `remove <id\|name>` | Delete a topic |
| `rename <id\|name>` | Rename a topic |
| `move <id\|name>` | Move to different thematic |
| `get <id\|name>` | Get topic details |

**Options**:

- `--thematic <id\|name>` - Assign/filter by thematic
- `--uncategorized` - Show only uncategorized topics
- `--name <new-name>` - New name for rename
- `--with-counts` - Include video counts
- `--with-videos` - Include video list
- `--json` - JSON output

### saved-videos.ts

Manages saved videos.

**Actions**:

| Action | Description |
|--------|-------------|
| `list` | List saved videos |
| `add <video-id-or-url>` | Save a new video |
| `remove <video-id>` | Remove a video |
| `get <video-id>` | Get video details |
| `update <video-id>` | Update video topics/metadata |
| `search <query>` | Search saved videos |

**Options**:

- `--topic <id\|name>` - Filter by or assign to topic (repeatable)
- `--thematic <id\|name>` - Filter by thematic
- `--unassigned` - Show only uncategorized videos
- `--sort <field>` - Sort by: addedAt, priority, title
- `--notes "text"` - Set personal notes
- `--priority <number>` - Set priority index
- `--resolve` - Fetch video metadata from YouTube
- `--add-topic <id\|name>` - Add topic to video (repeatable)
- `--remove-topic <id\|name>` - Remove topic from video (repeatable)
- `--in <field>` - Search in: title, notes, all
- `--json` - JSON output

## Cascade Behavior

### When a Topic is Deleted

1. Topic ID is removed from all videos' `topicIds` array
2. Videos with no remaining topics become "uncategorized"
3. Topic is deleted from the `topics` array

### When a Thematic is Deleted

1. All topics in the thematic have their `thematicId` set to `null`
2. Topics become "uncategorized" but are not deleted
3. Videos remain unchanged
4. Thematic is deleted from the `thematics` array

## Metadata

The `metadata` object on videos is extensible for user-defined properties.

### Current Properties

| Property | Type | Description |
|----------|------|-------------|
| `priority` | number | Priority/order index (lower = higher priority) |

### Potential Future Properties

| Property | Type | Description |
|----------|------|-------------|
| `watchedAt` | ISO 8601 | When user watched the video |
| `rating` | number (1-5) | User rating |
| `status` | enum | "to-watch", "watched", "in-progress" |
| `durationWatched` | number | Seconds watched |
| `tags` | string[] | Free-form tags (separate from topics) |
| `source` | string | How the video was discovered |

## Filtering with Enhanced Metadata

The numeric fields (`durationSeconds`, `viewCount`, `likeCount`) enable powerful filtering with `jq`:

```bash
# Videos over 20 minutes
npx tsx saved-videos.ts list --json | jq '[.[] | select(.durationSeconds > 1200)]'

# Most popular videos
npx tsx saved-videos.ts list --json | jq 'sort_by(.viewCount) | reverse'

# YouTube Shorts only
npx tsx saved-videos.ts list --json | jq '[.[] | select(.isShort == true)]'

# Videos by category
npx tsx saved-videos.ts list --json | jq '[.[] | select(.category == "Education")]'

# Videos with specific keywords
npx tsx saved-videos.ts list --json | jq '[.[] | select(.keywords | any(. == "tutorial"))]'
```

## Lookup Behavior

Both topics and thematics can be referenced by:

- **UUID** - Exact match
- **Name** - Case-insensitive match

Videos can be referenced by:

- **Video ID** - 11-character YouTube video ID
- **URL** - Any YouTube URL format (watch, youtu.be, embed, shorts)

## Shared Library

The `video-library-client.ts` provides:

### Interfaces

- `VideoMetadata` - Extensible metadata object
- `SavedVideo` - Video entity
- `Topic` - Topic entity
- `Thematic` - Thematic entity
- `SavedVideosData` - Root data structure

### Functions

- `loadSavedVideosData()` - Load data from file
- `saveSavedVideosData(data)` - Save data to file
- `findThematicByIdOrName(data, identifier)` - Lookup thematic
- `findTopicByIdOrName(data, identifier)` - Lookup topic
- `findVideoById(data, videoId)` - Lookup video
- `getVideosForTopic(data, topicId)` - Get videos in topic
- `getVideosForThematic(data, thematicId)` - Get videos in thematic
- `getUnassignedVideos(data)` - Get uncategorized videos
- `getTopicsForThematic(data, thematicId)` - Get topics in thematic
- `getUncategorizedTopics(data)` - Get topics without thematic
- `extractVideoId(input)` - Extract video ID from URL
- `resolveVideoInfo(videoId)` - Fetch video metadata from YouTube
- `generateUUID()` - Generate UUID for new entities

## Examples

### Create a Learning Library

```bash
# Create structure
npx tsx video-thematics.ts add "Programming" --description "Coding tutorials"
npx tsx video-topics.ts add "TypeScript" --thematic "Programming"
npx tsx video-topics.ts add "Python" --thematic "Programming"

# Save videos
npx tsx saved-videos.ts add "https://youtu.be/abc123" \
  --topic "TypeScript" --priority 1 --resolve

# View library
npx tsx video-thematics.ts list --with-topics --with-counts
```

### Reorganize Videos

```bash
# Create new thematic
npx tsx video-thematics.ts add "Advanced Topics"

# Move topic to new thematic
npx tsx video-topics.ts move "TypeScript" --thematic "Advanced Topics"

# Update video topics
npx tsx saved-videos.ts update "abc123" \
  --add-topic "Python" \
  --remove-topic "TypeScript"
```

### Export for Review

```bash
# Get all high-priority videos as JSON
npx tsx saved-videos.ts list --sort priority --json > priority-videos.json

# Get thematic summary
npx tsx video-thematics.ts get "Programming" --with-topics --with-videos --json
```
