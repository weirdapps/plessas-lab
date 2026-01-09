// Shared YouTube client for all tools
import { Innertube } from 'youtubei.js';

export interface YouTubeClientOptions {
  lang?: string;
  location?: string;
  retrievePlayer?: boolean;
  enableSessionCache?: boolean;
}

let clientInstance: Innertube | null = null;

export async function createYouTubeClient(
  options: YouTubeClientOptions = {}
): Promise<Innertube> {
  const innertube = await Innertube.create({
    lang: options.lang || 'en',
    location: options.location || 'US',
    retrieve_player: options.retrievePlayer ?? true,
    enable_session_cache: options.enableSessionCache ?? true,
  });

  return innertube;
}

export async function getClient(): Promise<Innertube> {
  if (!clientInstance) {
    clientInstance = await createYouTubeClient();
  }
  return clientInstance;
}

export { Innertube };

// Interfaces
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

export interface SearchResult {
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

export interface SearchFilters {
  uploadDate?: 'hour' | 'today' | 'week' | 'month' | 'year';
  duration?: 'short' | 'medium' | 'long';
  sortBy?: 'relevance' | 'upload_date' | 'view_count' | 'rating';
  type?: 'video' | 'channel' | 'playlist';
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptResult {
  videoId: string;
  segments: TranscriptSegment[];
  fullText: string;
}

// Utility functions
export function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (!nextArg || nextArg.startsWith('--')) {
        result[key] = true;
      } else {
        result[key] = nextArg;
        i++;
      }
    }
  }

  return result;
}

export function formatOutput(data: any, json: boolean = false): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    // Human-readable format
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        console.log(`\n[${index + 1}]`);
        formatObject(item);
      });
    } else {
      formatObject(data);
    }
  }
}

function formatObject(obj: any, indent: string = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${indent}${key}:`);
      formatObject(value, indent + '  ');
    } else if (Array.isArray(value)) {
      console.log(`${indent}${key}: [${value.length} items]`);
    } else {
      const displayValue = typeof value === 'string' && value.length > 100
        ? value.substring(0, 100) + '...'
        : value;
      console.log(`${indent}${key}: ${displayValue}`);
    }
  }
}

export function printStatus(message: string, type: 'OK' | 'ERROR' | 'INFO' | 'WARN' = 'INFO'): void {
  const prefix = {
    OK: '[OK]',
    ERROR: '[ERROR]',
    INFO: '[INFO]',
    WARN: '[WARN]'
  };
  console.error(`${prefix[type]} ${message}`);
}

export function printUsage(tool: string, options: Array<{ flag: string; description: string; required?: boolean }>): void {
  console.log(`\nUsage: npx tsx ${tool}.ts [options]\n`);
  console.log('Options:');
  for (const opt of options) {
    const req = opt.required ? ' (required)' : '';
    console.log(`  ${opt.flag.padEnd(25)} ${opt.description}${req}`);
  }
  console.log('  --json                    Output as JSON');
  console.log('  --help                    Show this help message');
}
