#!/usr/bin/env npx tsx
// Search YouTube for videos, channels, or playlists
// Usage: npx tsx search.ts --query <search_query> [--type video|channel|playlist] [--limit N] [--upload-date hour|today|week|month|year] [--sort relevance|upload_date|view_count|rating] [--json]

import youtubeSr from 'youtube-sr';
import {
  getClient,
  SearchResult,
  SearchFilters,
  parseArgs,
  formatOutput,
  printStatus,
  printUsage
} from './youtube-client.js';

const YouTube = youtubeSr.YouTube;

async function searchWithInnertube(
  query: string,
  filters: SearchFilters = {},
  limit: number = 20
): Promise<SearchResult[]> {
  const client = await getClient();

  const searchResults = await client.search(query, {
    sort_by: filters.sortBy || 'relevance',
    upload_date: filters.uploadDate,
    duration: filters.duration,
    type: filters.type || 'video',
  });

  const results: SearchResult[] = [];

  if (searchResults.videos) {
    for (const item of searchResults.videos) {
      if (results.length >= limit) break;

      const video = item as any;
      if (video.id) {
        results.push({
          id: video.id,
          title: video.title?.text || video.title?.toString() || '',
          description: video.description_snippet?.text || video.description || '',
          url: `https://www.youtube.com/watch?v=${video.id}`,
          channel: video.author?.name || video.channel?.name || '',
          views: video.view_count?.text || video.short_view_count?.text || '',
          duration: video.duration?.text || video.length_text?.text || '',
          publishedAt: video.published?.text || '',
          thumbnail: video.thumbnails?.[0]?.url || '',
          source: 'innertube',
        });
      }
    }
  }

  return results;
}

async function searchWithYoutubeSr(
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

async function search(
  query: string,
  filters: SearchFilters = {},
  limit: number = 20
): Promise<SearchResult[]> {
  try {
    return await searchWithInnertube(query, filters, limit);
  } catch (error) {
    printStatus('InnerTube search failed, falling back to youtube-sr', 'WARN');
    return await searchWithYoutubeSr(query, limit);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printUsage('search', [
      { flag: '--query <search_query>', description: 'Search query', required: true },
      { flag: '--type <video|channel|playlist>', description: 'Result type (default: video)' },
      { flag: '--limit <N>', description: 'Number of results (default: 10)' },
      { flag: '--upload-date <value>', description: 'Filter: hour, today, week, month, year' },
      { flag: '--duration <value>', description: 'Filter: short, medium, long' },
      { flag: '--sort <value>', description: 'Sort: relevance, upload_date, view_count, rating' },
    ]);
    process.exit(0);
  }

  const query = args['query'] as string;

  if (!query) {
    printStatus('--query is required', 'ERROR');
    printUsage('search', [
      { flag: '--query <search_query>', description: 'Search query', required: true },
      { flag: '--type <video|channel|playlist>', description: 'Result type (default: video)' },
      { flag: '--limit <N>', description: 'Number of results (default: 10)' },
      { flag: '--upload-date <value>', description: 'Filter: hour, today, week, month, year' },
      { flag: '--duration <value>', description: 'Filter: short, medium, long' },
      { flag: '--sort <value>', description: 'Sort: relevance, upload_date, view_count, rating' },
    ]);
    process.exit(1);
  }

  try {
    const limit = parseInt(args['limit'] as string) || 10;

    const filters: SearchFilters = {};
    if (args['type']) {
      filters.type = args['type'] as 'video' | 'channel' | 'playlist';
    }
    if (args['upload-date']) {
      filters.uploadDate = args['upload-date'] as 'hour' | 'today' | 'week' | 'month' | 'year';
    }
    if (args['duration']) {
      filters.duration = args['duration'] as 'short' | 'medium' | 'long';
    }
    if (args['sort']) {
      filters.sortBy = args['sort'] as 'relevance' | 'upload_date' | 'view_count' | 'rating';
    }

    printStatus(`Searching YouTube for: "${query}"...`);
    const results = await search(query, filters, limit);

    printStatus(`Found ${results.length} results`, 'OK');
    formatOutput(results, args['json'] as boolean);
  } catch (error) {
    printStatus((error as Error).message, 'ERROR');
    process.exit(1);
  }
}

main();
