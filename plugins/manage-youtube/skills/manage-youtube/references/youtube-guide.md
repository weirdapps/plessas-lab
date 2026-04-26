# YouTube Content Monitoring with Third-Party TypeScript Libraries

**Document Version:** 1.0
**Date:** December 31, 2025
**Purpose:** Developer's guide for building YouTube content monitoring tools using TypeScript libraries that bypass the official YouTube API

---

## Table of Contents

1. [Introduction](#introduction)
2. [Library Comparison Overview](#library-comparison-overview)
3. [Primary Recommended Library: YouTube.js](#primary-recommended-library-youtubejs)
4. [Search-Focused Libraries](#search-focused-libraries)
5. [Transcript Extraction Libraries](#transcript-extraction-libraries)
6. [Channel Monitoring Implementation](#channel-monitoring-implementation)
7. [Content Search Implementation](#content-search-implementation)
8. [Rate Limiting and Bot Detection](#rate-limiting-and-bot-detection)
9. [Best Practices and Recommendations](#best-practices-and-recommendations)
10. [Complete Example Project](#complete-example-project)

---

## Introduction

This guide covers TypeScript libraries that allow you to interact with YouTube programmatically **without using the official YouTube Data API**. These libraries provide alternatives that avoid:

- **API Key Registration**: No Google Cloud Console setup required
- **Quota Limitations**: Official API has strict daily quotas (10,000 units/day)
- **OAuth Complexities**: No authentication flows for basic read operations

### Trade-offs to Consider

| Aspect | Official API | Third-Party Libraries |
|--------|-------------|----------------------|
| Stability | Guaranteed SLA | May break with YouTube updates |
| Rate Limits | Fixed quotas | Self-managed, risk of blocks |
| Legal Standing | Fully compliant | Grey area (ToS considerations) |
| Features | Well-documented | Varies by library |
| Setup | Complex | Simple npm install |

---

## Library Comparison Overview

| Library | Primary Use Case | TypeScript | Active | Weekly Downloads |
|---------|-----------------|------------|--------|------------------|
| **[youtubei.js](https://github.com/LuanRT/YouTube.js)** | Full YouTube access | Native | Yes | ~500k |
| **[youtube-sr](https://github.com/twlite/youtube-sr)** | Search & Discovery | Yes | Yes | ~100k |
| **[scrape-youtube](https://www.npmjs.com/package/scrape-youtube)** | Quick searches | Types included | Yes | ~50k |
| **[yt-search](https://github.com/talmobi/yt-search)** | Simple search | @types/yt-search | Yes | ~80k |
| **[youtube-caption-extractor](https://github.com/devhims/youtube-caption-extractor)** | Transcripts & Captions | Native | Yes | ~340 |

---

## Primary Recommended Library: YouTube.js

**YouTube.js** (npm: `youtubei.js`) is the most comprehensive library for YouTube interaction. It uses YouTube's private InnerTube API—the same API used by official YouTube clients.

### Key Features

- Search videos, playlists, music, and albums
- Get detailed video/playlist information
- Fetch live chat and live statistics
- Subscribe/unsubscribe to channels
- Like/dislike/comment functionality
- Access notifications and watch history
- Download video streams
- Full TypeScript support (98.7% of codebase)

### Installation

```bash
# Using npm
npm install youtubei.js@latest

# Using yarn
yarn add youtubei.js@latest

# Using pnpm
pnpm add youtubei.js@latest
```

### Project Setup

Create a new TypeScript project:

```bash
mkdir youtube-monitor
cd youtube-monitor
uv init  # or use npm init for Node.js projects
npm init -y
npm install youtubei.js typescript @types/node ts-node
npx tsc --init
```

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### Basic Initialization

```typescript
// src/youtube-client.ts
import { Innertube } from 'youtubei.js';

export async function createYouTubeClient(): Promise<Innertube> {
  const innertube = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: true,
    enable_session_cache: true,
  });

  return innertube;
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lang` | string | `'en'` | Language for responses |
| `location` | string | `'US'` | Geolocation for results |
| `device_category` | string | `'DESKTOP'` | Platform type |
| `enable_session_cache` | boolean | `true` | Cache session data |
| `retrieve_player` | boolean | `true` | Load JS player for stream URLs |
| `cookie` | string | undefined | Cookie string for auth |

---

## Search-Focused Libraries

### youtube-sr

A lightweight library focused on search functionality.

```bash
npm install youtube-sr
```

```typescript
// src/search-youtube-sr.ts
import youtubeSr from 'youtube-sr';

// Note: youtube-sr exports YouTube as a nested property in ESM
const YouTube = youtubeSr.YouTube;

// Search for videos
async function searchVideos(query: string, limit: number = 10) {
  const results = await YouTube.search(query, {
    limit,
    type: 'video',
    safeSearch: false,
  });

  return results.map(video => ({
    id: video.id,
    title: video.title,
    url: video.url,
    duration: video.durationFormatted,
    views: video.views,
    uploadedAt: video.uploadedAt,
    channel: {
      name: video.channel?.name,
      url: video.channel?.url,
    },
    thumbnail: video.thumbnail?.url,
  }));
}

// Get single video details
async function getVideo(url: string) {
  const video = await YouTube.getVideo(url);
  return video;
}

// Get playlist with all videos
async function getFullPlaylist(playlistUrl: string) {
  const playlist = await YouTube.getPlaylist(playlistUrl, {
    fetchAll: true,
  });
  return playlist;
}

// Get trending videos
async function getTrending() {
  const trending = await YouTube.trending();
  return trending;
}

// Get search suggestions
async function getSuggestions(query: string) {
  const suggestions = await YouTube.getSuggestions(query);
  return suggestions;
}
```

### scrape-youtube

Optimized for Discord bots and quick searches.

```bash
npm install scrape-youtube
```

```typescript
// src/search-scrape-youtube.ts
import { youtube } from 'scrape-youtube';

interface SearchOptions {
  type?: 'video' | 'live' | 'movie' | 'channel' | 'playlist' | 'any';
}

async function search(query: string, options: SearchOptions = {}) {
  const results = await youtube.search(query, {
    type: options.type || 'video',
  });

  return results;
}

// Search for channels
async function searchChannels(query: string) {
  const results = await youtube.search(query, { type: 'channel' });
  return results.channels;
}

// Search for live streams
async function searchLiveStreams(query: string) {
  const results = await youtube.search(query, { type: 'live' });
  return results.streams;
}
```

### yt-search

Simple and reliable for basic search needs.

```bash
npm install yt-search
npm install @types/yt-search --save-dev
```

```typescript
// src/search-yt-search.ts
import yts from 'yt-search';

async function searchVideos(query: string) {
  const results = await yts(query);

  return results.videos.map(video => ({
    videoId: video.videoId,
    title: video.title,
    url: video.url,
    duration: video.duration,
    views: video.views,
    author: video.author,
    description: video.description,
    image: video.image,
    ago: video.ago,
  }));
}

// Get video by ID
async function getVideoById(videoId: string) {
  const result = await yts({ videoId });
  return result;
}

// Search playlists
async function searchPlaylists(query: string) {
  const results = await yts(query);
  return results.playlists;
}
```

---

## Transcript Extraction Libraries

### youtube-caption-extractor

The `youtube-caption-extractor` package is a lightweight, TypeScript-native library for extracting captions and subtitles from YouTube videos. It supports both user-submitted and auto-generated captions with language options.

**Key Features:**
- TypeScript support out of the box
- Works in Node.js and Edge runtime environments
- Can fetch video title and description along with subtitles
- Supports multiple languages

```bash
npm install youtube-caption-extractor
```

### Basic Usage

```typescript
// src/transcripts.ts
import { getSubtitles, getVideoDetails } from 'youtube-caption-extractor';

interface TranscriptSegment {
  text: string;
  start: number;    // Start time in seconds
  duration: number; // Duration in seconds
}

interface TranscriptResult {
  videoId: string;
  segments: TranscriptSegment[];
  fullText: string;
}

interface VideoDetailsResult {
  videoId: string;
  title: string;
  description: string;
  segments: TranscriptSegment[];
  fullText: string;
}

/**
 * Fetch transcript/captions for a YouTube video
 * @param videoIdOrUrl - YouTube video ID or full URL
 * @param lang - Language code (e.g., 'en', 'es', 'fr'). Defaults to 'en'
 */
async function getTranscript(
  videoIdOrUrl: string,
  lang: string = 'en'
): Promise<TranscriptResult> {
  const videoId = extractVideoId(videoIdOrUrl);

  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang });

    const segments: TranscriptSegment[] = subtitles.map(segment => ({
      text: segment.text,
      start: parseFloat(segment.start),
      duration: parseFloat(segment.dur),
    }));

    const fullText = segments.map(s => s.text).join(' ');

    return {
      videoId,
      segments,
      fullText,
    };
  } catch (error) {
    throw new Error(`Failed to fetch transcript for ${videoId}: ${error}`);
  }
}

/**
 * Fetch video details including title, description, and transcript
 */
async function getVideoDetailsWithTranscript(
  videoIdOrUrl: string,
  lang: string = 'en'
): Promise<VideoDetailsResult> {
  const videoId = extractVideoId(videoIdOrUrl);

  try {
    const details = await getVideoDetails({ videoID: videoId, lang });

    const segments: TranscriptSegment[] = (details.subtitles || []).map(segment => ({
      text: segment.text,
      start: parseFloat(segment.start),
      duration: parseFloat(segment.dur),
    }));

    const fullText = segments.map(s => s.text).join(' ');

    return {
      videoId,
      title: details.title || '',
      description: details.description || '',
      segments,
      fullText,
    };
  } catch (error) {
    throw new Error(`Failed to fetch video details for ${videoId}: ${error}`);
  }
}

/**
 * Get transcript as plain text
 */
async function getTranscriptText(
  videoIdOrUrl: string,
  lang: string = 'en'
): Promise<string> {
  const result = await getTranscript(videoIdOrUrl, lang);
  return result.fullText;
}

/**
 * Search for keywords in transcript
 */
async function searchTranscript(
  videoIdOrUrl: string,
  keywords: string[],
  lang: string = 'en'
): Promise<TranscriptSegment[]> {
  const result = await getTranscript(videoIdOrUrl, lang);
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  return result.segments.filter(segment => {
    const lowerText = segment.text.toLowerCase();
    return lowerKeywords.some(keyword => lowerText.includes(keyword));
  });
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(videoIdOrUrl: string): string {
  if (!videoIdOrUrl.includes('/') && !videoIdOrUrl.includes('.')) {
    return videoIdOrUrl;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = videoIdOrUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return videoIdOrUrl;
}
```

### TranscriptService Class

A service class with caching support for both transcripts and video details:

```typescript
// src/transcript-service.ts
import { getSubtitles, getVideoDetails } from 'youtube-caption-extractor';

export class TranscriptService {
  private cache: Map<string, TranscriptResult> = new Map();
  private detailsCache: Map<string, VideoDetailsResult> = new Map();

  async getTranscript(
    videoIdOrUrl: string,
    lang: string = 'en',
    useCache: boolean = true
  ): Promise<TranscriptResult> {
    const videoId = extractVideoId(videoIdOrUrl);
    const cacheKey = `${videoId}:${lang}`;

    if (useCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await getTranscript(videoId, lang);

    if (useCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async getVideoDetails(
    videoIdOrUrl: string,
    lang: string = 'en',
    useCache: boolean = true
  ): Promise<VideoDetailsResult> {
    const videoId = extractVideoId(videoIdOrUrl);
    const cacheKey = `details:${videoId}:${lang}`;

    if (useCache && this.detailsCache.has(cacheKey)) {
      return this.detailsCache.get(cacheKey)!;
    }

    const result = await getVideoDetailsWithTranscript(videoId, lang);

    if (useCache) {
      this.detailsCache.set(cacheKey, result);
    }

    return result;
  }

  clearCache(): void {
    this.cache.clear();
    this.detailsCache.clear();
  }

  getCacheSize(): number {
    return this.cache.size + this.detailsCache.size;
  }
}
```

### Usage Example

```typescript
// Fetch just the transcript
const transcript = await getTranscript('dQw4w9WgXcQ', 'en');
console.log(`Got ${transcript.segments.length} segments`);

// Fetch video details with transcript
const details = await getVideoDetailsWithTranscript('dQw4w9WgXcQ');
console.log(`Title: ${details.title}`);
console.log(`Transcript: ${details.fullText.substring(0, 200)}...`);

// Search for keywords
const matches = await searchTranscript('qp0HIF3SfI4', ['why', 'golden']);
console.log(`Found ${matches.length} segments containing keywords`);
```

---

## Channel Monitoring Implementation

### Complete Channel Monitor Class

```typescript
// src/channel-monitor.ts
import { Innertube } from 'youtubei.js';

export interface ChannelInfo {
  id: string;
  name: string;
  handle: string;
  subscriberCount: string;
  videoCount: string;
  description: string;
  thumbnailUrl: string;
  bannerUrl: string;
}

// Extended interface with additional metadata from About tab
export interface ChannelAboutInfo extends ChannelInfo {
  viewCount: string;
  joinedDate: string;
  country: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  duration: string;
  views: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export class ChannelMonitor {
  private client: Innertube | null = null;
  private monitoredChannels: Map<string, NodeJS.Timeout> = new Map();

  async initialize(): Promise<void> {
    this.client = await Innertube.create({
      lang: 'en',
      location: 'US',
    });
  }

  private ensureClient(): Innertube {
    if (!this.client) {
      throw new Error('Client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  async getChannelInfo(channelId: string): Promise<ChannelInfo> {
    const client = this.ensureClient();
    const channel = await client.getChannel(channelId);

    // Cast to any to handle dynamic properties not in type definitions
    const metadata = channel.metadata as any;
    const header = channel.header as any;

    // Extract subscriber and video counts from header
    // Path: header.content.metadata.metadata_rows[1].metadata_parts
    let subscriberCount = '';
    let videoCount = '';

    try {
      const metadataRows = header?.content?.metadata?.metadata_rows;
      if (metadataRows && metadataRows.length > 1) {
        const statsRow = metadataRows[1];
        if (statsRow?.metadata_parts) {
          // First part is subscriber count
          if (statsRow.metadata_parts[0]?.text?.text) {
            subscriberCount = statsRow.metadata_parts[0].text.text;
          }
          // Second part is video count
          if (statsRow.metadata_parts[1]?.text?.text) {
            videoCount = statsRow.metadata_parts[1].text.text;
          }
        }
      }
    } catch (e) {
      // Fallback: counts remain empty if header structure is different
    }

    // Extract handle from header if available
    let handle = metadata.vanity_channel_url || '';
    try {
      const handleRow = header?.content?.metadata?.metadata_rows?.[0];
      if (handleRow?.metadata_parts?.[0]?.text?.text) {
        const handleText = handleRow.metadata_parts[0].text.text;
        if (handleText.startsWith('@')) {
          handle = handleText;
        }
      }
    } catch (e) {
      // Use fallback from metadata
    }

    return {
      id: channelId,
      name: metadata.title || '',
      handle: handle,
      subscriberCount: subscriberCount,
      videoCount: videoCount,
      description: metadata.description || '',
      thumbnailUrl: metadata.thumbnail?.[0]?.url || metadata.avatar?.[0]?.url || '',
      bannerUrl: metadata.banner?.[0]?.url || '',
    };
  }

  /**
   * Get detailed channel information from the About tab
   * This makes an additional API call but provides more accurate data
   */
  async getChannelAboutInfo(channelId: string): Promise<ChannelAboutInfo> {
    const client = this.ensureClient();
    const channel = await client.getChannel(channelId);

    const metadata = channel.metadata as any;
    const header = channel.header as any;

    // Get detailed info from About tab
    const aboutTab = await channel.getAbout();
    const about = aboutTab as any;
    const aboutMeta = about?.metadata || {};

    // Extract handle from header
    let handle = metadata.vanity_channel_url || '';
    try {
      const handleRow = header?.content?.metadata?.metadata_rows?.[0];
      if (handleRow?.metadata_parts?.[0]?.text?.text) {
        const handleText = handleRow.metadata_parts[0].text.text;
        if (handleText.startsWith('@')) {
          handle = handleText;
        }
      }
    } catch (e) {
      // Use fallback
    }

    // Extract joined date text
    let joinedDate = '';
    if (aboutMeta.joined_date) {
      joinedDate = typeof aboutMeta.joined_date === 'string'
        ? aboutMeta.joined_date
        : aboutMeta.joined_date.text || '';
    }

    return {
      id: channelId,
      name: metadata.title || '',
      handle: handle,
      subscriberCount: aboutMeta.subscriber_count || '',
      videoCount: aboutMeta.video_count || '',
      viewCount: aboutMeta.view_count || '',
      joinedDate: joinedDate,
      country: aboutMeta.country || '',
      description: metadata.description || '',
      thumbnailUrl: metadata.thumbnail?.[0]?.url || metadata.avatar?.[0]?.url || '',
      bannerUrl: metadata.banner?.[0]?.url || '',
    };
  }

  async getChannelVideos(channelId: string, limit: number = 30): Promise<VideoInfo[]> {
    const client = this.ensureClient();
    const channel = await client.getChannel(channelId);
    const videosTab = await channel.getVideos();

    const videoList: VideoInfo[] = [];

    // Iterate through videos - cast to any for flexible property access
    if (videosTab.videos) {
      for (const item of videosTab.videos) {
        if (videoList.length >= limit) break;

        const video = item as any;
        if (video.id) {
          videoList.push({
            id: video.id,
            title: video.title?.text || video.title?.toString() || '',
            description: video.description_snippet?.text || '',
            duration: video.duration?.text || video.length_text?.text || '',
            views: video.view_count?.text || video.short_view_count?.text || '',
            publishedAt: video.published?.text || '',
            thumbnailUrl: video.thumbnails?.[0]?.url || '',
          });
        }
      }
    }

    return videoList;
  }

  async getLatestVideos(channelId: string, since: Date): Promise<VideoInfo[]> {
    const videos = await this.getChannelVideos(channelId, 50);

    // Filter videos published after the 'since' date
    // Note: YouTube's relative dates need parsing
    return videos.filter(video => {
      // Simple check - in production, parse the relative date properly
      const isRecent = video.publishedAt.includes('hour') ||
                       video.publishedAt.includes('minute') ||
                       video.publishedAt.includes('day');
      return isRecent;
    });
  }

  async searchChannel(channelId: string, query: string): Promise<VideoInfo[]> {
    const client = this.ensureClient();
    const channel = await client.getChannel(channelId);
    const searchResults = await channel.search(query);

    const videos: VideoInfo[] = [];

    if (searchResults.videos) {
      for (const item of searchResults.videos) {
        // Cast to any for flexible property access
        const video = item as any;
        if (video.id) {
          videos.push({
            id: video.id,
            title: video.title?.text || video.title?.toString() || '',
            description: video.description_snippet?.text || '',
            duration: video.duration?.text || '',
            views: video.view_count?.text || '',
            publishedAt: video.published?.text || '',
            thumbnailUrl: video.thumbnails?.[0]?.url || '',
          });
        }
      }
    }

    return videos;
  }

  startMonitoring(
    channelId: string,
    intervalMs: number,
    callback: (videos: VideoInfo[]) => void
  ): void {
    let lastCheck = new Date();

    const checkForNewVideos = async () => {
      try {
        const newVideos = await this.getLatestVideos(channelId, lastCheck);
        if (newVideos.length > 0) {
          callback(newVideos);
        }
        lastCheck = new Date();
      } catch (error) {
        console.error(`Error checking channel ${channelId}:`, error);
      }
    };

    // Initial check
    checkForNewVideos();

    // Set up interval
    const intervalId = setInterval(checkForNewVideos, intervalMs);
    this.monitoredChannels.set(channelId, intervalId);
  }

  stopMonitoring(channelId: string): void {
    const intervalId = this.monitoredChannels.get(channelId);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoredChannels.delete(channelId);
    }
  }

  stopAllMonitoring(): void {
    for (const [channelId] of this.monitoredChannels) {
      this.stopMonitoring(channelId);
    }
  }
}
```

### Usage Example

```typescript
// src/monitor-example.ts
import { ChannelMonitor } from './channel-monitor';

async function main() {
  const monitor = new ChannelMonitor();
  await monitor.initialize();

  // Get channel info
  const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // Google Developers
  const info = await monitor.getChannelInfo(channelId);
  console.log('Channel:', info.name);
  console.log('Subscribers:', info.subscriberCount);

  // Get latest videos
  const videos = await monitor.getChannelVideos(channelId, 10);
  console.log('\nLatest videos:');
  videos.forEach(v => console.log(`- ${v.title}`));

  // Start monitoring (check every 5 minutes)
  monitor.startMonitoring(channelId, 5 * 60 * 1000, (newVideos) => {
    console.log('\n🎬 New videos detected:');
    newVideos.forEach(v => console.log(`- ${v.title}`));
  });

  // Stop after 1 hour
  setTimeout(() => {
    monitor.stopAllMonitoring();
    console.log('Monitoring stopped');
  }, 60 * 60 * 1000);
}

main().catch(console.error);
```

---

## Content Search Implementation

### Multi-Source Search Service

```typescript
// src/content-search.ts
import { Innertube } from 'youtubei.js';
import youtubeSr from 'youtube-sr';

// Note: youtube-sr exports YouTube as a nested property in ESM
const YouTube = youtubeSr.YouTube;

interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  channel: string;
  views: string;
  duration: string;
  publishedAt: string;
  thumbnail: string;
  source: 'innertube' | 'youtube-sr';
}

interface SearchFilters {
  uploadDate?: 'hour' | 'today' | 'week' | 'month' | 'year';
  duration?: 'short' | 'medium' | 'long';
  sortBy?: 'relevance' | 'upload_date' | 'view_count' | 'rating';
  type?: 'video' | 'channel' | 'playlist';
}

export class ContentSearchService {
  private innertubeClient: Innertube | null = null;

  async initialize(): Promise<void> {
    this.innertubeClient = await Innertube.create({
      lang: 'en',
      location: 'US',
    });
  }

  // Search using YouTube.js (InnerTube)
  async searchWithInnertube(
    query: string,
    filters: SearchFilters = {},
    limit: number = 20
  ): Promise<SearchResult[]> {
    if (!this.innertubeClient) {
      throw new Error('Client not initialized');
    }

    const searchResults = await this.innertubeClient.search(query, {
      sort_by: filters.sortBy || 'relevance',
      upload_date: filters.uploadDate,
      duration: filters.duration,
      type: filters.type || 'video',
    });

    const results: SearchResult[] = [];

    for (const video of searchResults.videos) {
      if (results.length >= limit) break;

      results.push({
        id: video.id,
        title: video.title?.text || '',
        description: video.description_snippet?.text || '',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        channel: video.author?.name || '',
        views: video.view_count?.text || '',
        duration: video.duration?.text || '',
        publishedAt: video.published?.text || '',
        thumbnail: video.thumbnails?.[0]?.url || '',
        source: 'innertube',
      });
    }

    return results;
  }

  // Search using youtube-sr (fallback)
  async searchWithYoutubeSr(
    query: string,
    limit: number = 20
  ): Promise<SearchResult[]> {
    const results = await YouTube.search(query, {
      limit,
      type: 'video',
    });

    return results.map(video => ({
      id: video.id || '',
      title: video.title || '',
      description: video.description || '',
      url: video.url || '',
      channel: video.channel?.name || '',
      views: video.views?.toString() || '',
      duration: video.durationFormatted || '',
      publishedAt: video.uploadedAt || '',
      thumbnail: video.thumbnail?.url || '',
      source: 'youtube-sr' as const,
    }));
  }

  // Combined search with fallback
  async search(
    query: string,
    filters: SearchFilters = {},
    limit: number = 20
  ): Promise<SearchResult[]> {
    try {
      return await this.searchWithInnertube(query, filters, limit);
    } catch (error) {
      console.warn('InnerTube search failed, falling back to youtube-sr:', error);
      return await this.searchWithYoutubeSr(query, limit);
    }
  }

  // Search across multiple queries (for topic monitoring)
  async searchMultipleTopics(
    topics: string[],
    resultsPerTopic: number = 10
  ): Promise<Map<string, SearchResult[]>> {
    const results = new Map<string, SearchResult[]>();

    for (const topic of topics) {
      try {
        const topicResults = await this.search(topic, {}, resultsPerTopic);
        results.set(topic, topicResults);

        // Add delay between requests to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        console.error(`Search failed for topic "${topic}":`, error);
        results.set(topic, []);
      }
    }

    return results;
  }

  // Get related videos
  async getRelatedVideos(videoId: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.innertubeClient) {
      throw new Error('Client not initialized');
    }

    const videoInfo = await this.innertubeClient.getInfo(videoId);

    // Access watch_next_feed for related videos
    const relatedItems = videoInfo.watch_next_feed || [];
    const results: SearchResult[] = [];

    for (const item of relatedItems) {
      if (results.length >= limit) break;

      const video = item as any;
      if (video.id) {
        results.push({
          id: video.id,
          title: video.title?.text || video.title?.toString() || '',
          description: '',
          url: `https://www.youtube.com/watch?v=${video.id}`,
          channel: video.author?.name || '',
          views: video.view_count?.text || video.short_view_count?.text || '',
          duration: video.duration?.text || '',
          publishedAt: '',
          thumbnail: video.thumbnails?.[0]?.url || '',
          source: 'innertube' as const,
        });
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Topic Monitoring Service

```typescript
// src/topic-monitor.ts
import { ContentSearchService, SearchResult } from './content-search';

interface TopicConfig {
  name: string;
  keywords: string[];
  filters?: {
    uploadDate?: 'hour' | 'today' | 'week' | 'month' | 'year';
    minViews?: number;
  };
}

interface TopicAlert {
  topic: string;
  videos: SearchResult[];
  timestamp: Date;
}

export class TopicMonitorService {
  private searchService: ContentSearchService;
  private seenVideoIds: Set<string> = new Set();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.searchService = new ContentSearchService();
  }

  async initialize(): Promise<void> {
    await this.searchService.initialize();
  }

  async checkTopic(topic: TopicConfig): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    for (const keyword of topic.keywords) {
      const results = await this.searchService.search(
        keyword,
        { uploadDate: topic.filters?.uploadDate || 'today' },
        20
      );
      allResults.push(...results);
    }

    // Filter out already seen videos
    const newVideos = allResults.filter(video => {
      if (this.seenVideoIds.has(video.id)) {
        return false;
      }
      this.seenVideoIds.add(video.id);
      return true;
    });

    // Apply additional filters
    return newVideos.filter(video => {
      if (topic.filters?.minViews) {
        const views = parseInt(video.views.replace(/[^0-9]/g, '')) || 0;
        if (views < topic.filters.minViews) {
          return false;
        }
      }
      return true;
    });
  }

  startMonitoring(
    topics: TopicConfig[],
    intervalMs: number,
    onAlert: (alert: TopicAlert) => void
  ): void {
    for (const topic of topics) {
      const checkAndAlert = async () => {
        try {
          const newVideos = await this.checkTopic(topic);
          if (newVideos.length > 0) {
            onAlert({
              topic: topic.name,
              videos: newVideos,
              timestamp: new Date(),
            });
          }
        } catch (error) {
          console.error(`Error monitoring topic "${topic.name}":`, error);
        }
      };

      // Initial check
      checkAndAlert();

      // Set up interval
      const intervalId = setInterval(checkAndAlert, intervalMs);
      this.monitoringIntervals.set(topic.name, intervalId);
    }
  }

  stopMonitoring(topicName?: string): void {
    if (topicName) {
      const intervalId = this.monitoringIntervals.get(topicName);
      if (intervalId) {
        clearInterval(intervalId);
        this.monitoringIntervals.delete(topicName);
      }
    } else {
      for (const intervalId of this.monitoringIntervals.values()) {
        clearInterval(intervalId);
      }
      this.monitoringIntervals.clear();
    }
  }
}
```

---

## Channel Handle Resolution and Video Retrieval

### Resolving Channel Handles

YouTube channels can be identified by:
- **Channel ID**: `UC_x5XG1OV2P6uZZ5FSM9Ttw` (24-character string starting with UC)
- **Handle**: `@GoogleDevelopers`
- **URL**: `https://www.youtube.com/@GoogleDevelopers`

The `ChannelMonitor` class provides methods to resolve handles to channel IDs and retrieve videos using any format:

```typescript
// src/channel-monitor.ts additions

/**
 * Resolve a channel handle (@username) or URL to a channel ID
 * Handles formats: @username, https://youtube.com/@username, UC...channelId
 */
async resolveChannelHandle(handleOrUrl: string): Promise<string> {
  // If it's already a channel ID (starts with UC), return it
  if (handleOrUrl.startsWith('UC') && handleOrUrl.length === 24) {
    return handleOrUrl;
  }

  // Normalize the handle
  let handle = handleOrUrl;

  // Extract handle from URL if needed
  const urlMatch = handleOrUrl.match(/youtube\.com\/@([^\/\?]+)/);
  if (urlMatch) {
    handle = `@${urlMatch[1]}`;
  } else if (!handle.startsWith('@')) {
    handle = `@${handle}`;
  }

  const client = this.ensureClient();

  // Search for the channel to get the channel ID
  const searchResults = await client.search(handle, { type: 'channel' });

  if (searchResults.channels && searchResults.channels.length > 0) {
    const channelResult = searchResults.channels[0] as any;
    return channelResult.id;
  }

  throw new Error(`Could not resolve channel handle: ${handleOrUrl}`);
}

/**
 * Get channel info by handle (@username) or URL
 */
async getChannelInfoByHandle(handleOrUrl: string): Promise<ChannelInfo> {
  const channelId = await this.resolveChannelHandle(handleOrUrl);
  return this.getChannelInfo(channelId);
}
```

### Generic Video Retrieval Methods

The `ChannelMonitor` class provides flexible methods to retrieve videos from any channel using handles, URLs, or channel IDs:

#### Get N Most Recent Videos

```typescript
/**
 * Get the N most recent videos from a channel
 * @param channelIdOrHandle - Channel ID, handle (@username), or URL
 * @param count - Number of videos to return (default: 10)
 * @returns Array of most recent videos, ordered from newest to oldest
 */
async getRecentVideos(channelIdOrHandle: string, count: number = 10): Promise<VideoInfo[]> {
  const channelId = await this.resolveToChannelId(channelIdOrHandle);
  return this.getChannelVideos(channelId, count);
}
```

#### Get Videos After a Specific Date

```typescript
/**
 * Get videos published after a specific date
 * @param channelIdOrHandle - Channel ID, handle (@username), or URL
 * @param afterDate - Only return videos published after this date
 * @param maxVideos - Maximum videos to scan (default: 100)
 * @returns Array of videos published after the specified date
 */
async getVideosAfterDate(
  channelIdOrHandle: string,
  afterDate: Date,
  maxVideos: number = 100
): Promise<VideoInfo[]> {
  const channelId = await this.resolveToChannelId(channelIdOrHandle);
  const videos = await this.getChannelVideos(channelId, maxVideos);

  const now = new Date();
  const targetTime = afterDate.getTime();

  return videos.filter(video => {
    const estimatedDate = this.parseRelativeDate(video.publishedAt, now);
    return estimatedDate !== null && estimatedDate.getTime() > targetTime;
  });
}
```

#### Get N Most Popular Videos

```typescript
/**
 * Get the N most popular (most viewed) videos from a channel
 * @param channelIdOrHandle - Channel ID, handle (@username), or URL
 * @param count - Number of videos to return (default: 10)
 * @param fromRecent - How many recent videos to consider (default: 100)
 * @returns Array of videos sorted by view count (highest first)
 */
async getMostPopularVideos(
  channelIdOrHandle: string,
  count: number = 10,
  fromRecent: number = 100
): Promise<VideoInfo[]> {
  const channelId = await this.resolveToChannelId(channelIdOrHandle);
  const videos = await this.getChannelVideos(channelId, fromRecent);

  // Sort by view count (parse the view string to number)
  const sortedVideos = videos.sort((a, b) => {
    const viewsA = this.parseViewCount(a.views);
    const viewsB = this.parseViewCount(b.views);
    return viewsB - viewsA; // Descending order
  });

  return sortedVideos.slice(0, count);
}
```

### Usage Examples

```typescript
import { ChannelMonitor, getTranscript } from './index.js';

async function examples() {
  const monitor = new ChannelMonitor();
  await monitor.initialize();

  // All these formats work for any method:
  const channel = '@GoogleDevelopers';
  // or: 'GoogleDevelopers'
  // or: 'https://www.youtube.com/@GoogleDevelopers'
  // or: 'UC_x5XG1OV2P6uZZ5FSM9Ttw'

  // Get the 5 most recent videos
  const recentVideos = await monitor.getRecentVideos(channel, 5);
  console.log('5 most recent videos:');
  recentVideos.forEach((v, i) => console.log(`  ${i + 1}. ${v.title}`));

  // Get videos from the last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeeksVideos = await monitor.getVideosAfterDate(channel, weekAgo);
  console.log(`\nVideos from last 7 days: ${thisWeeksVideos.length}`);

  // Get the 3 most popular videos (from last 50 uploads)
  const popularVideos = await monitor.getMostPopularVideos(channel, 3, 50);
  console.log('\n3 most popular videos:');
  popularVideos.forEach((v, i) => console.log(`  ${i + 1}. ${v.title} (${v.views})`));

  // Transcription is kept separate - apply to any video(s) as needed
  if (recentVideos.length > 0) {
    const latestVideo = recentVideos[0];
    const transcript = await getTranscript(latestVideo.id, 'en');
    console.log(`\nTranscript for "${latestVideo.title}":`);
    console.log(transcript.fullText.substring(0, 200) + '...');
  }
}
```

### Transcription (Separate Concern)

Transcription is intentionally kept separate from video retrieval. Use the `getTranscript()` function or `TranscriptService` class to transcribe any video:

```typescript
import { ChannelMonitor, getTranscript, TranscriptService } from './index.js';

async function transcribeSelectedVideos() {
  const monitor = new ChannelMonitor();
  await monitor.initialize();

  // Get some videos
  const videos = await monitor.getRecentVideos('@GoogleDevelopers', 3);

  // Transcribe just the first one
  const transcript1 = await getTranscript(videos[0].id);
  console.log('First video transcript:', transcript1.fullText);

  // Transcribe all of them
  for (const video of videos) {
    const transcript = await getTranscript(video.id);
    console.log(`\n${video.title}: ${transcript.segments.length} segments`);
  }

  // Or use TranscriptService for caching
  const transcriptService = new TranscriptService();
  for (const video of videos) {
    const result = await transcriptService.getTranscript(video.id, 'en', true); // useCache=true
    console.log(`Cached transcript for ${video.id}`);
  }
}
```

---

## Rate Limiting and Bot Detection

### Understanding YouTube's Protections

YouTube employs sophisticated anti-bot measures:

| Detection Method | Description | Mitigation |
|-----------------|-------------|------------|
| IP Rate Limiting | Tracks request frequency per IP | Use delays, rotate IPs |
| Browser Fingerprinting | Checks browser signatures | Use realistic headers |
| Behavioral Analysis | Analyzes request patterns | Add randomization |
| Cookie/Session Tracking | Monitors session behavior | Rotate sessions |
| JavaScript Challenges | Tests JS execution | Use proper clients |

### Rate Limiting Implementation

```typescript
// src/rate-limiter.ts

interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  retryAfterMs: number;
  maxRetries: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private minuteRequests: number[] = [];
  private hourRequests: number[] = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      requestsPerMinute: config.requestsPerMinute || 10,
      requestsPerHour: config.requestsPerHour || 100,
      retryAfterMs: config.retryAfterMs || 60000,
      maxRetries: config.maxRetries || 3,
    };
  }

  private cleanOldRequests(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    this.minuteRequests = this.minuteRequests.filter(t => t > oneMinuteAgo);
    this.hourRequests = this.hourRequests.filter(t => t > oneHourAgo);
  }

  async canMakeRequest(): Promise<boolean> {
    this.cleanOldRequests();

    return (
      this.minuteRequests.length < this.config.requestsPerMinute &&
      this.hourRequests.length < this.config.requestsPerHour
    );
  }

  async waitForSlot(): Promise<void> {
    while (!(await this.canMakeRequest())) {
      await this.delay(1000);
    }
  }

  recordRequest(): void {
    const now = Date.now();
    this.minuteRequests.push(now);
    this.hourRequests.push(now);
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      await this.waitForSlot();

      try {
        this.recordRequest();
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        const isRateLimit =
          error instanceof Error &&
          (error.message.includes('429') ||
           error.message.includes('rate') ||
           error.message.includes('quota'));

        if (isRateLimit) {
          console.warn(
            `Rate limit hit for ${operationName} (attempt ${attempt}/${this.config.maxRetries}). ` +
            `Waiting ${this.config.retryAfterMs / 1000}s...`
          );
          await this.delay(this.config.retryAfterMs * attempt);
        } else {
          throw error;
        }
      }
    }

    throw new Error(
      `${operationName} failed after ${this.config.maxRetries} retries: ${lastError?.message}`
    );
  }

  private delay(ms: number): Promise<void> {
    // Add jitter to avoid thundering herd
    const jitter = Math.random() * 1000;
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
  }
}
```

### Request Queue with Prioritization

```typescript
// src/request-queue.ts

interface QueuedRequest<T> {
  id: string;
  priority: number;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private processing: boolean = false;
  private rateLimiter: RateLimiter;
  private minDelayMs: number;

  constructor(rateLimiter: RateLimiter, minDelayMs: number = 500) {
    this.rateLimiter = rateLimiter;
    this.minDelayMs = minDelayMs;
  }

  async enqueue<T>(
    operation: () => Promise<T>,
    priority: number = 5
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: crypto.randomUUID(),
        priority,
        operation,
        resolve,
        reject,
      };

      // Insert based on priority (higher = more important)
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      try {
        const result = await this.rateLimiter.executeWithRetry(
          request.operation,
          `Request ${request.id}`
        );
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      }

      // Minimum delay between requests
      await this.delay(this.minDelayMs);
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Best Practices and Recommendations

### 1. Library Selection Guide

| Use Case | Recommended Library | Reason |
|----------|-------------------|--------|
| Full-featured app | **YouTube.js** | Most comprehensive |
| Quick search tool | **youtube-sr** | Lightweight, fast |
| Discord bot | **scrape-youtube** | Optimized for bots |
| Transcript extraction | **youtube-caption-extractor** | TypeScript native, video details |
| Simple CLI tool | **yt-search** | Minimal dependencies |

### 2. Error Handling Strategy

```typescript
// src/error-handler.ts

export enum YouTubeErrorType {
  RATE_LIMITED = 'RATE_LIMITED',
  VIDEO_UNAVAILABLE = 'VIDEO_UNAVAILABLE',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class YouTubeError extends Error {
  constructor(
    public type: YouTubeErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

export function classifyError(error: Error): YouTubeErrorType {
  const message = error.message.toLowerCase();

  if (message.includes('429') || message.includes('rate')) {
    return YouTubeErrorType.RATE_LIMITED;
  }
  if (message.includes('unavailable') || message.includes('private')) {
    return YouTubeErrorType.VIDEO_UNAVAILABLE;
  }
  if (message.includes('not found') || message.includes('404')) {
    return YouTubeErrorType.CHANNEL_NOT_FOUND;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return YouTubeErrorType.NETWORK_ERROR;
  }
  if (message.includes('parse') || message.includes('json')) {
    return YouTubeErrorType.PARSE_ERROR;
  }

  return YouTubeErrorType.UNKNOWN;
}
```

### 3. Caching Strategy

```typescript
// src/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class YouTubeCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 300000) { // 5 minutes default
    this.defaultTtl = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
    });
  }

  async getOrFetch<R extends T>(
    key: string,
    fetcher: () => Promise<R>,
    ttl?: number
  ): Promise<R> {
    const cached = this.get(key);

    if (cached) {
      return cached as R;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  clear(): void {
    this.cache.clear();
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 4. Production Checklist

- [ ] **Rate Limiting**: Implement proper delays between requests
- [ ] **Error Handling**: Handle all error types gracefully
- [ ] **Caching**: Cache responses to reduce API calls
- [ ] **Logging**: Log all operations for debugging
- [ ] **Monitoring**: Track success/failure rates
- [ ] **Fallbacks**: Have backup libraries ready
- [ ] **Testing**: Test against YouTube's changing DOM
- [ ] **Updates**: Keep libraries updated regularly

---

## Complete Example Project

### Project Structure

```
youtube-monitor/
├── src/
│   ├── index.ts
│   ├── youtube-client.ts
│   ├── channel-monitor.ts
│   ├── content-search.ts
│   ├── topic-monitor.ts
│   ├── transcripts.ts
│   ├── channel-transcript.ts
│   ├── rate-limiter.ts
│   ├── request-queue.ts
│   ├── cache.ts
│   └── error-handler.ts
├── package.json
├── tsconfig.json
└── README.md
```

### package.json

```json
{
  "name": "youtube-content-monitor",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "npx tsx src/index.ts"
  },
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

### Main Entry Point

The main entry point exports all modules for library usage and includes a simple demo function:

```typescript
// src/index.ts
// Main entry point for YouTube Content Monitoring Tools

export { createYouTubeClient, Innertube } from './youtube-client.js';
export { ChannelMonitor, ChannelInfo, ChannelAboutInfo, VideoInfo } from './channel-monitor.js';
export { ContentSearchService, SearchResult, SearchFilters } from './content-search.js';
export { TopicMonitorService, TopicConfig, TopicAlert } from './topic-monitor.js';
export {
  getTranscript,
  getVideoDetailsWithTranscript,
  getTranscriptText,
  getTranscriptWithTimestamps,
  searchTranscript,
  TranscriptService,
  TranscriptSegment,
  TranscriptResult,
  VideoDetailsResult,
} from './transcripts.js';
export { RateLimiter, RateLimiterConfig } from './rate-limiter.js';
export { RequestQueue, RequestQueueStats } from './request-queue.js';
export { YouTubeCache } from './cache.js';
export {
  YouTubeError,
  YouTubeErrorType,
  classifyError,
  wrapError,
} from './error-handler.js';

// Channel + Transcript convenience functions
export {
  ChannelTranscriptService,
  getLatestVideoWithTranscript,
  getLatestVideoWithFullDetails,
  VideoWithTranscript,
  VideoWithFullDetails,
  TranscriptOptions,
} from './channel-transcript.js';

// Demo function
async function demo() {
  console.log('YouTube Content Monitor - Demo\n');
  console.log('Available exports:');
  console.log('  - createYouTubeClient: Create InnerTube client');
  console.log('  - ChannelMonitor: Monitor YouTube channels');
  console.log('  - ContentSearchService: Search YouTube content');
  console.log('  - TopicMonitorService: Monitor topics/keywords');
  console.log('  - TranscriptService: Extract video transcripts');
  console.log('  - ChannelTranscriptService: Combined channel + transcript operations');
  console.log('  - getLatestVideoWithTranscript: Get latest video and transcribe it');
  console.log('  - RateLimiter: Rate limiting utilities');
  console.log('  - RequestQueue: Priority-based request queue');
  console.log('  - YouTubeCache: Caching utilities');
  console.log('\nRun test scripts:');
  console.log('  npm run test:channel   - Test channel monitoring');
  console.log('  npm run test:search    - Test content search');
  console.log('  npm run test:transcript - Test transcript extraction');
  console.log('  npm run test:queue     - Test request queue');
}

// Run demo if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  demo();
}
```

### Usage Example

Here's how to use the library in your own application:

```typescript
// example-usage.ts
import { ChannelMonitor, TopicMonitorService } from './index.js';

async function main() {
  console.log('YouTube Content Monitor Starting...\n');

  // Initialize services
  const channelMonitor = new ChannelMonitor();
  const topicMonitor = new TopicMonitorService();

  await Promise.all([
    channelMonitor.initialize(),
    topicMonitor.initialize(),
  ]);

  // Example: Monitor specific channels
  const channelsToMonitor = [
    'UC_x5XG1OV2P6uZZ5FSM9Ttw', // Google Developers
    'UCVHFbqXqoYvEWM1Ddxl0QKg', // Android Developers
  ];

  for (const channelId of channelsToMonitor) {
    const info = await channelMonitor.getChannelInfo(channelId);
    console.log(`Monitoring: ${info.name} (${info.subscriberCount} subscribers)`);

    channelMonitor.startMonitoring(
      channelId,
      15 * 60 * 1000, // Check every 15 minutes
      (newVideos) => {
        console.log(`\nNew videos from ${info.name}:`);
        newVideos.forEach(v => console.log(`   - ${v.title}`));
      }
    );
  }

  // Example: Monitor topics
  const topicsToMonitor = [
    {
      name: 'TypeScript Updates',
      keywords: ['typescript 5', 'typescript new features', 'typescript tutorial 2025'],
      filters: { uploadDate: 'week' as const },
    },
    {
      name: 'AI Development',
      keywords: ['langchain tutorial', 'openai api', 'claude api'],
      filters: { uploadDate: 'today' as const, minViews: 1000 },
    },
  ];

  topicMonitor.startMonitoring(
    topicsToMonitor,
    30 * 60 * 1000, // Check every 30 minutes
    (alert) => {
      console.log(`\nTopic Alert: ${alert.topic}`);
      console.log(`   Found ${alert.videos.length} new videos:`);
      alert.videos.slice(0, 5).forEach(v =>
        console.log(`   - ${v.title} (${v.views} views)`)
      );
    }
  );

  console.log('\nMonitoring started. Press Ctrl+C to stop.\n');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping monitors...');
    channelMonitor.stopAllMonitoring();
    topicMonitor.stopMonitoring();
    process.exit(0);
  });
}

main().catch(console.error);
```

---

## Additional Resources

### Official Documentation

- [YouTube.js Documentation](https://ytjs.dev/)
- [YouTube.js GitHub](https://github.com/LuanRT/YouTube.js)
- [youtube-sr GitHub](https://github.com/twlite/youtube-sr)

### Related Tools

- [Invidious](https://invidious.io/) - Alternative YouTube front-end with REST API
- [FreeTube](https://freetubeapp.io/) - Privacy-focused YouTube client

### Legal Considerations

These libraries interact with YouTube's unofficial APIs. While commonly used, consider:

1. **Terms of Service**: Review YouTube's ToS regarding automated access
2. **Rate Limiting**: Respect reasonable request limits
3. **Commercial Use**: Consult legal counsel for business applications
4. **Data Privacy**: Handle user data according to regulations

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 31, 2025 | Initial release |
