#!/usr/bin/env npx tsx
// Search for videos within a specific YouTube channel
// Usage: npx tsx channel-search.ts --channel <id_or_handle> --query <search_query> [--limit N] [--json]

import {
  getClient,
  VideoInfo,
  parseArgs,
  formatOutput,
  printStatus,
  printUsage
} from './youtube-client.js';

async function resolveChannelHandle(handleOrUrl: string): Promise<string> {
  if (handleOrUrl.startsWith('UC') && handleOrUrl.length === 24) {
    return handleOrUrl;
  }

  let handle = handleOrUrl;
  const urlMatch = handleOrUrl.match(/youtube\.com\/@([^\/\?]+)/);
  if (urlMatch) {
    handle = `@${urlMatch[1]}`;
  } else if (!handle.startsWith('@')) {
    handle = `@${handle}`;
  }

  const client = await getClient();
  const searchResults = await client.search(handle, { type: 'channel' });

  if (searchResults.channels && searchResults.channels.length > 0) {
    const channelResult = searchResults.channels[0] as any;
    if (channelResult.id) {
      return channelResult.id;
    }
  }

  throw new Error(`Could not resolve channel handle: ${handleOrUrl}`);
}

async function searchChannel(channelId: string, query: string, limit: number = 20): Promise<VideoInfo[]> {
  const client = await getClient();
  const channel = await client.getChannel(channelId);
  const searchResults = await channel.search(query);

  const videos: VideoInfo[] = [];

  if (searchResults.videos) {
    for (const item of searchResults.videos) {
      if (videos.length >= limit) break;

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printUsage('channel-search', [
      { flag: '--channel <id_or_handle>', description: 'Channel ID, handle (@username), or URL', required: true },
      { flag: '--query <search_query>', description: 'Search query within channel', required: true },
      { flag: '--limit <N>', description: 'Number of results (default: 10)' },
    ]);
    process.exit(0);
  }

  const channelArg = args['channel'] as string;
  const query = args['query'] as string;

  if (!channelArg || !query) {
    printStatus('--channel and --query are required', 'ERROR');
    printUsage('channel-search', [
      { flag: '--channel <id_or_handle>', description: 'Channel ID, handle (@username), or URL', required: true },
      { flag: '--query <search_query>', description: 'Search query within channel', required: true },
      { flag: '--limit <N>', description: 'Number of results (default: 10)' },
    ]);
    process.exit(1);
  }

  try {
    printStatus(`Resolving channel: ${channelArg}...`);
    const channelId = await resolveChannelHandle(channelArg);
    printStatus(`Channel ID: ${channelId}`, 'OK');

    const limit = parseInt(args['limit'] as string) || 10;

    printStatus(`Searching channel for: "${query}"...`);
    const videos = await searchChannel(channelId, query, limit);

    printStatus(`Found ${videos.length} videos`, 'OK');
    formatOutput(videos, args['json'] as boolean);
  } catch (error) {
    printStatus((error as Error).message, 'ERROR');
    process.exit(1);
  }
}

main();
