#!/usr/bin/env npx tsx
// Get videos from YouTube channel(s)
// Usage: npx tsx channel-videos.ts --channel <id_or_handle> [--limit N] [--after-days N] [--popular N] [--json]
// Usage: npx tsx channel-videos.ts --channels <channel1,channel2,...> [--limit N] [--after-days N] [--popular N] [--json]

import {
  getClient,
  VideoInfo,
  parseArgs,
  formatOutput,
  printStatus,
  printUsage
} from './youtube-client.js';

// Extended VideoInfo with channel details
interface VideoInfoWithChannel extends VideoInfo {
  channelId: string;
  channelHandle: string;
  channelName: string;
}

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

interface ChannelInfo {
  id: string;
  handle: string;
  name: string;
}

async function getChannelInfo(channelId: string): Promise<ChannelInfo> {
  const client = await getClient();
  const channel = await client.getChannel(channelId);
  const metadata = channel.metadata as any;

  return {
    id: channelId,
    handle: metadata?.vanity_channel_url?.replace('http://www.youtube.com/', '') ||
            metadata?.external_id || channelId,
    name: metadata?.title || channel.title || 'Unknown'
  };
}

async function getChannelVideos(channelId: string, limit: number = 30): Promise<VideoInfo[]> {
  const client = await getClient();
  const channel = await client.getChannel(channelId);
  const videosTab = await channel.getVideos();

  const videoList: VideoInfo[] = [];

  if (videosTab.videos) {
    for (const item of videosTab.videos) {
      if (videoList.length >= limit) break;

      const video = item as any;
      if (video.id) {
        videoList.push({
          id: video.id,
          title: video.title?.text || video.title?.toString() || '',
          description: video.description_snippet?.text || video.description || '',
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

async function getChannelVideosWithInfo(
  channelId: string,
  channelInfo: ChannelInfo,
  limit: number = 30
): Promise<VideoInfoWithChannel[]> {
  const videos = await getChannelVideos(channelId, limit);

  return videos.map(video => ({
    ...video,
    channelId: channelInfo.id,
    channelHandle: channelInfo.handle,
    channelName: channelInfo.name
  }));
}

function parseViewCount(viewsStr: string): number {
  if (!viewsStr) return 0;
  const normalized = viewsStr.toLowerCase().replace(/,/g, '').replace(' views', '').trim();
  const multipliers: Record<string, number> = { k: 1000, m: 1000000, b: 1000000000 };

  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (normalized.endsWith(suffix)) {
      const num = parseFloat(normalized.slice(0, -1));
      return isNaN(num) ? 0 : num * multiplier;
    }
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

function parseRelativeDate(relativeStr: string, now: Date = new Date()): Date | null {
  if (!relativeStr) return null;
  const normalized = relativeStr.toLowerCase().trim();
  const result = new Date(now);

  const patterns: Array<{ regex: RegExp; unit: string }> = [
    { regex: /(\d+)\s*second/i, unit: 'second' },
    { regex: /(\d+)\s*minute/i, unit: 'minute' },
    { regex: /(\d+)\s*hour/i, unit: 'hour' },
    { regex: /(\d+)\s*day/i, unit: 'day' },
    { regex: /(\d+)\s*week/i, unit: 'week' },
    { regex: /(\d+)\s*month/i, unit: 'month' },
    { regex: /(\d+)\s*year/i, unit: 'year' },
  ];

  for (const { regex, unit } of patterns) {
    const match = normalized.match(regex);
    if (match) {
      const value = parseInt(match[1], 10);
      switch (unit) {
        case 'second': result.setSeconds(result.getSeconds() - value); break;
        case 'minute': result.setMinutes(result.getMinutes() - value); break;
        case 'hour': result.setHours(result.getHours() - value); break;
        case 'day': result.setDate(result.getDate() - value); break;
        case 'week': result.setDate(result.getDate() - value * 7); break;
        case 'month': result.setMonth(result.getMonth() - value); break;
        case 'year': result.setFullYear(result.getFullYear() - value); break;
      }
      return result;
    }
  }

  if (normalized.includes('streamed')) {
    return parseRelativeDate(normalized.replace('streamed', ''), now);
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printUsage('channel-videos', [
      { flag: '--channel <id_or_handle>', description: 'Single channel ID, handle (@username), or URL' },
      { flag: '--channels <list>', description: 'Comma-separated list of channels (e.g., @chan1,@chan2)' },
      { flag: '--limit <N>', description: 'Number of videos per channel (default: 10)' },
      { flag: '--after-days <N>', description: 'Only videos published in last N days' },
      { flag: '--popular <N>', description: 'Get N most popular videos by view count' },
      { flag: '--sort-by-date', description: 'Sort aggregated results by publish date (newest first)' },
    ]);
    process.exit(0);
  }

  const singleChannel = args['channel'] as string;
  const multipleChannels = args['channels'] as string;

  if (!singleChannel && !multipleChannels) {
    printStatus('--channel or --channels is required', 'ERROR');
    printUsage('channel-videos', [
      { flag: '--channel <id_or_handle>', description: 'Single channel ID, handle (@username), or URL' },
      { flag: '--channels <list>', description: 'Comma-separated list of channels (e.g., @chan1,@chan2)' },
      { flag: '--limit <N>', description: 'Number of videos per channel (default: 10)' },
      { flag: '--after-days <N>', description: 'Only videos published in last N days' },
      { flag: '--popular <N>', description: 'Get N most popular videos by view count' },
      { flag: '--sort-by-date', description: 'Sort aggregated results by publish date (newest first)' },
    ]);
    process.exit(1);
  }

  // Parse channel list
  const channelInputs: string[] = multipleChannels
    ? multipleChannels.split(',').map(c => c.trim()).filter(c => c.length > 0)
    : [singleChannel];

  const isMultiChannel = channelInputs.length > 1;
  const limit = parseInt(args['limit'] as string) || 10;
  const afterDays = parseInt(args['after-days'] as string);
  const popularCount = parseInt(args['popular'] as string);
  const sortByDate = args['sort-by-date'] === true || args['sort-by-date'] === 'true';

  // Fetch more videos if we need to filter/sort
  const fetchLimit = afterDays || popularCount ? Math.max(100, limit * 3) : limit;

  try {
    printStatus(`Processing ${channelInputs.length} channel(s)...`);

    // Process channels in parallel with concurrency limit
    const CONCURRENCY = 3;
    const allVideos: VideoInfoWithChannel[] = [];
    const errors: { channel: string; error: string }[] = [];

    for (let i = 0; i < channelInputs.length; i += CONCURRENCY) {
      const batch = channelInputs.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (channelInput) => {
          printStatus(`Resolving channel: ${channelInput}...`);
          const channelId = await resolveChannelHandle(channelInput);
          printStatus(`Fetching videos from ${channelInput}...`);

          // Get channel info for multi-channel mode
          const channelInfo = await getChannelInfo(channelId);
          const videos = await getChannelVideosWithInfo(channelId, channelInfo, fetchLimit);

          printStatus(`Got ${videos.length} videos from ${channelInfo.name}`, 'OK');
          return videos;
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          allVideos.push(...result.value);
        } else {
          errors.push({
            channel: batch[j],
            error: result.reason?.message || 'Unknown error'
          });
          printStatus(`Failed to fetch from ${batch[j]}: ${result.reason?.message}`, 'ERROR');
        }
      }
    }

    let videos: VideoInfoWithChannel[] = allVideos;

    // Filter by date if requested
    if (afterDays) {
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - afterDays);
      const now = new Date();

      videos = videos.filter(video => {
        const estimatedDate = parseRelativeDate(video.publishedAt, now);
        return estimatedDate !== null && estimatedDate.getTime() > afterDate.getTime();
      });

      printStatus(`Found ${videos.length} videos from last ${afterDays} days`);
    }

    // Sort by popularity if requested
    if (popularCount) {
      videos = videos.sort((a, b) => {
        const viewsA = parseViewCount(a.views);
        const viewsB = parseViewCount(b.views);
        return viewsB - viewsA;
      }).slice(0, popularCount);

      printStatus(`Returning ${videos.length} most popular videos`);
    } else if (sortByDate || isMultiChannel) {
      // Sort by date for multi-channel (newest first)
      const now = new Date();
      videos = videos.sort((a, b) => {
        const dateA = parseRelativeDate(a.publishedAt, now);
        const dateB = parseRelativeDate(b.publishedAt, now);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });

      // Apply limit after sorting for multi-channel
      if (!afterDays && isMultiChannel) {
        videos = videos.slice(0, limit * channelInputs.length);
      }
    } else if (!afterDays) {
      videos = videos.slice(0, limit);
    }

    printStatus(`Retrieved ${videos.length} videos total from ${channelInputs.length - errors.length} channel(s)`, 'OK');

    // Output format depends on single vs multi-channel
    if (isMultiChannel) {
      // For multi-channel, always include channel info in output
      formatOutput(videos, args['json'] as boolean);
    } else {
      // For single channel, strip channel info for backwards compatibility
      const simpleVideos: VideoInfo[] = videos.map(({ channelId, channelHandle, channelName, ...rest }) => rest);
      formatOutput(simpleVideos, args['json'] as boolean);
    }

    // Report errors at the end
    if (errors.length > 0) {
      printStatus(`Failed channels: ${errors.map(e => e.channel).join(', ')}`, 'ERROR');
    }
  } catch (error) {
    printStatus((error as Error).message, 'ERROR');
    process.exit(1);
  }
}

main();
