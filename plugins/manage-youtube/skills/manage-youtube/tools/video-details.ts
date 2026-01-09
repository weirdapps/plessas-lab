#!/usr/bin/env npx tsx
// Get detailed information about a YouTube video
// Usage: npx tsx video-details.ts --video <video_id_or_url> [--related N] [--json]

import {
  getClient,
  SearchResult,
  parseArgs,
  formatOutput,
  printStatus,
  printUsage
} from './youtube-client.js';

interface VideoDetails {
  id: string;
  title: string;
  description: string;
  url: string;
  channel: string;
  channelId: string;
  views: string;
  likes: string;
  duration: string;
  publishedAt: string;
  thumbnail: string;
  keywords: string[];
  category: string;
}

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

async function getVideoDetails(videoId: string): Promise<VideoDetails> {
  const client = await getClient();
  const videoInfo = await client.getInfo(videoId);

  const basicInfo = videoInfo.basic_info;
  const primaryInfo = (videoInfo as any).primary_info;
  const secondaryInfo = (videoInfo as any).secondary_info;

  return {
    id: videoId,
    title: basicInfo.title || '',
    description: basicInfo.short_description || '',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    channel: basicInfo.author || secondaryInfo?.owner?.author?.name || '',
    channelId: basicInfo.channel_id || secondaryInfo?.owner?.author?.id || '',
    views: basicInfo.view_count?.toString() || primaryInfo?.view_count?.text || '',
    likes: primaryInfo?.menu?.top_level_buttons?.find((b: any) => b.title?.text?.includes('like'))?.title?.text || '',
    duration: basicInfo.duration?.toString() || '',
    publishedAt: primaryInfo?.published?.text || primaryInfo?.relative_date?.text || '',
    thumbnail: basicInfo.thumbnail?.[0]?.url || '',
    keywords: basicInfo.keywords || [],
    category: basicInfo.category || '',
  };
}

async function getRelatedVideos(videoId: string, limit: number = 10): Promise<SearchResult[]> {
  const client = await getClient();
  const videoInfo = await client.getInfo(videoId);

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printUsage('video-details', [
      { flag: '--video <id_or_url>', description: 'Video ID or YouTube URL', required: true },
      { flag: '--related <N>', description: 'Also get N related videos' },
    ]);
    process.exit(0);
  }

  const videoArg = args['video'] as string;

  if (!videoArg) {
    printStatus('--video is required', 'ERROR');
    printUsage('video-details', [
      { flag: '--video <id_or_url>', description: 'Video ID or YouTube URL', required: true },
      { flag: '--related <N>', description: 'Also get N related videos' },
    ]);
    process.exit(1);
  }

  try {
    const videoId = extractVideoId(videoArg);
    printStatus(`Fetching details for video: ${videoId}...`);

    const details = await getVideoDetails(videoId);
    printStatus('Video details retrieved', 'OK');

    const relatedCount = parseInt(args['related'] as string);
    let related: SearchResult[] = [];

    if (relatedCount > 0) {
      printStatus(`Fetching ${relatedCount} related videos...`);
      related = await getRelatedVideos(videoId, relatedCount);
      printStatus(`Got ${related.length} related videos`, 'OK');
    }

    if (args['json']) {
      formatOutput({
        video: details,
        ...(related.length > 0 ? { related } : {}),
      }, true);
    } else {
      console.log('\n=== Video Details ===\n');
      console.log(`Title: ${details.title}`);
      console.log(`Channel: ${details.channel}`);
      console.log(`URL: ${details.url}`);
      console.log(`Views: ${details.views}`);
      console.log(`Duration: ${details.duration}s`);
      console.log(`Published: ${details.publishedAt}`);
      console.log(`Category: ${details.category}`);
      console.log(`Keywords: ${details.keywords.slice(0, 5).join(', ')}${details.keywords.length > 5 ? '...' : ''}`);
      console.log(`\nDescription:\n${details.description.substring(0, 300)}${details.description.length > 300 ? '...' : ''}`);

      if (related.length > 0) {
        console.log('\n=== Related Videos ===\n');
        related.forEach((video, i) => {
          console.log(`${i + 1}. ${video.title}`);
          console.log(`   ${video.url}`);
          console.log(`   ${video.channel} | ${video.views} | ${video.duration}`);
          console.log('');
        });
      }
    }
  } catch (error) {
    printStatus((error as Error).message, 'ERROR');
    process.exit(1);
  }
}

main();
