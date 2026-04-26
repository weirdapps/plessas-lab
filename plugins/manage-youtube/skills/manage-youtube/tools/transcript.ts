#!/usr/bin/env npx tsx
// Get transcript/captions from a YouTube video
// Usage: npx tsx transcript.ts --video <video_id_or_url> [--lang en] [--with-timestamps] [--search keyword1,keyword2] [--json]

import { getSubtitles, getVideoDetails } from 'youtube-caption-extractor';
import {
  TranscriptSegment,
  TranscriptResult,
  parseArgs,
  formatOutput,
  printStatus,
  printUsage
} from './youtube-client.js';

interface VideoDetailsResult {
  videoId: string;
  title: string;
  description: string;
  segments: TranscriptSegment[];
  fullText: string;
}

// YouTube video IDs are exactly 11 chars from a known alphabet. Any input that
// doesn't match this shape is rejected so it can't reach the third-party caption
// scraper as-is, which would otherwise concatenate it into an outbound URL and
// open an SSRF / data-exfil window if the input contained percent-encoded path
// separators or arbitrary host names.
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function extractVideoId(videoIdOrUrl: string): string {
  if (!videoIdOrUrl.includes('/') && !videoIdOrUrl.includes('.')) {
    if (!VIDEO_ID_RE.test(videoIdOrUrl)) {
      throw new Error(`Invalid YouTube video ID: ${videoIdOrUrl}`);
    }
    return videoIdOrUrl;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = videoIdOrUrl.match(pattern);
    if (match && match[1]) {
      const id = match[1];
      if (!VIDEO_ID_RE.test(id)) {
        throw new Error(`Extracted video ID has invalid shape: ${id}`);
      }
      return id;
    }
  }

  throw new Error(`Could not extract a valid YouTube video ID from: ${videoIdOrUrl}`);
}

function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
}

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printUsage('transcript', [
      { flag: '--video <id_or_url>', description: 'Video ID or YouTube URL', required: true },
      { flag: '--lang <code>', description: 'Language code (default: en)' },
      { flag: '--with-details', description: 'Include video title and description' },
      { flag: '--with-timestamps', description: 'Format output with timestamps' },
      { flag: '--search <keywords>', description: 'Search for keywords (comma-separated)' },
      { flag: '--text-only', description: 'Output only the full text' },
    ]);
    process.exit(0);
  }

  const videoArg = args['video'] as string;

  if (!videoArg) {
    printStatus('--video is required', 'ERROR');
    printUsage('transcript', [
      { flag: '--video <id_or_url>', description: 'Video ID or YouTube URL', required: true },
      { flag: '--lang <code>', description: 'Language code (default: en)' },
      { flag: '--with-details', description: 'Include video title and description' },
      { flag: '--with-timestamps', description: 'Format output with timestamps' },
      { flag: '--search <keywords>', description: 'Search for keywords (comma-separated)' },
      { flag: '--text-only', description: 'Output only the full text' },
    ]);
    process.exit(1);
  }

  try {
    const lang = (args['lang'] as string) || 'en';
    const videoId = extractVideoId(videoArg);
    printStatus(`Fetching transcript for video: ${videoId} (lang: ${lang})...`);

    // Handle search mode
    if (args['search']) {
      const keywords = (args['search'] as string).split(',').map(k => k.trim());
      printStatus(`Searching for keywords: ${keywords.join(', ')}`);
      const matches = await searchTranscript(videoArg, keywords, lang);
      printStatus(`Found ${matches.length} matching segments`, 'OK');

      if (args['json']) {
        formatOutput(matches, true);
      } else {
        for (const segment of matches) {
          const timestamp = formatTimestamp(segment.start);
          console.log(`[${timestamp}] ${segment.text}`);
        }
      }
      return;
    }

    // Handle with-details mode
    if (args['with-details']) {
      const result = await getVideoDetailsWithTranscript(videoArg, lang);
      printStatus(`Got transcript with ${result.segments.length} segments`, 'OK');

      if (args['json']) {
        formatOutput(result, true);
      } else {
        console.log(`\nTitle: ${result.title}`);
        console.log(`Description: ${result.description.substring(0, 200)}...`);
        console.log(`\nTranscript (${result.segments.length} segments):\n`);

        if (args['with-timestamps']) {
          for (const segment of result.segments) {
            const timestamp = formatTimestamp(segment.start);
            console.log(`[${timestamp}] ${segment.text}`);
          }
        } else {
          console.log(result.fullText);
        }
      }
      return;
    }

    // Standard transcript mode
    const result = await getTranscript(videoArg, lang);
    printStatus(`Got transcript with ${result.segments.length} segments`, 'OK');

    if (args['text-only']) {
      console.log(result.fullText);
      return;
    }

    if (args['json']) {
      formatOutput(result, true);
    } else if (args['with-timestamps']) {
      for (const segment of result.segments) {
        const timestamp = formatTimestamp(segment.start);
        console.log(`[${timestamp}] ${segment.text}`);
      }
    } else {
      console.log(`\nVideo ID: ${result.videoId}`);
      console.log(`Segments: ${result.segments.length}`);
      console.log(`\nFull Text:\n${result.fullText}`);
    }
  } catch (error) {
    printStatus((error as Error).message, 'ERROR');
    process.exit(1);
  }
}

main();
