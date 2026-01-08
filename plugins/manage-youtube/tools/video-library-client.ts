// Shared client for video organization tools
// Data is stored at ~/.google-skills/youtube/saved-videos.json

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Innertube } from 'youtubei.js';

// ============================================================================
// Constants
// ============================================================================

const DATA_DIR = path.join(process.env.HOME || '', '.google-skills', 'youtube');
const SAVED_VIDEOS_FILE = path.join(DATA_DIR, 'saved-videos.json');

// ============================================================================
// Interfaces
// ============================================================================

export interface VideoMetadata {
  priority?: number;
  [key: string]: unknown;
}

export interface SavedVideo {
  // Core fields
  id: string;
  title: string;
  url: string;
  addedAt: string;
  topicIds: string[];
  notes?: string;
  metadata: VideoMetadata;
  reportPath?: string;  // Path to associated report file (relative to reports folder)

  // Channel information
  channelId: string;
  channelName: string;
  channelHandle?: string;

  // Video content metadata
  description?: string;
  duration?: string;
  durationSeconds?: number;
  publishedAt?: string;
  category?: string;
  keywords?: string[];
  isShort?: boolean;

  // Engagement statistics
  views?: string;
  viewCount?: number;
  likes?: string;
  likeCount?: number;

  // Media
  thumbnailUrl?: string;
}

export interface Topic {
  id: string;
  name: string;
  thematicId: string | null;
  createdAt: string;
}

export interface Thematic {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface SavedVideosData {
  version: string;
  lastUpdated: string;
  thematics: Thematic[];
  topics: Topic[];
  videos: SavedVideo[];
}

// Report for standalone reports (not linked to a saved video)
export interface StandaloneReport {
  id: string;
  title: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
  videoId?: string;       // Optional: YouTube video ID if based on a video
  videoTitle?: string;    // Optional: Title of the source video
  videoUrl?: string;      // Optional: URL of the source video
}

export interface ReportsIndex {
  version: string;
  lastUpdated: string;
  reports: StandaloneReport[];
}

// ============================================================================
// Constants
// ============================================================================

const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const REPORTS_INDEX_FILE = path.join(REPORTS_DIR, 'index.json');

// ============================================================================
// File Operations
// ============================================================================

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getEmptyData(): SavedVideosData {
  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    thematics: [],
    topics: [],
    videos: []
  };
}

export function loadSavedVideosData(): SavedVideosData {
  ensureDataDir();

  if (!fs.existsSync(SAVED_VIDEOS_FILE)) {
    return getEmptyData();
  }

  try {
    const content = fs.readFileSync(SAVED_VIDEOS_FILE, 'utf-8');
    const data = JSON.parse(content) as SavedVideosData;

    // Ensure all required arrays exist
    data.thematics = data.thematics || [];
    data.topics = data.topics || [];
    data.videos = data.videos || [];

    return data;
  } catch (error) {
    printStatus(`Failed to read saved videos data: ${error}`, 'ERROR');
    return getEmptyData();
  }
}

export function saveSavedVideosData(data: SavedVideosData): void {
  ensureDataDir();

  data.lastUpdated = new Date().toISOString();

  try {
    fs.writeFileSync(SAVED_VIDEOS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save data: ${error}`);
  }
}

// ============================================================================
// Reports Operations
// ============================================================================

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function getEmptyReportsIndex(): ReportsIndex {
  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    reports: []
  };
}

export function loadReportsIndex(): ReportsIndex {
  ensureReportsDir();

  if (!fs.existsSync(REPORTS_INDEX_FILE)) {
    return getEmptyReportsIndex();
  }

  try {
    const content = fs.readFileSync(REPORTS_INDEX_FILE, 'utf-8');
    const data = JSON.parse(content) as ReportsIndex;
    data.reports = data.reports || [];
    return data;
  } catch (error) {
    printStatus(`Failed to read reports index: ${error}`, 'ERROR');
    return getEmptyReportsIndex();
  }
}

export function saveReportsIndex(index: ReportsIndex): void {
  ensureReportsDir();
  index.lastUpdated = new Date().toISOString();

  try {
    fs.writeFileSync(REPORTS_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save reports index: ${error}`);
  }
}

export function getReportsDir(): string {
  ensureReportsDir();
  return REPORTS_DIR;
}

export function generateReportFilename(title: string, videoId?: string): string {
  // Create a safe filename from the title
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const timestamp = new Date().toISOString().split('T')[0];
  const suffix = videoId ? `-${videoId}` : '';

  return `${timestamp}-${safeTitle}${suffix}.md`;
}

export function saveReport(
  content: string,
  title: string,
  options?: {
    videoId?: string;
    videoTitle?: string;
    videoUrl?: string;
    linkToSavedVideo?: boolean;
  }
): StandaloneReport {
  ensureReportsDir();

  const filename = generateReportFilename(title, options?.videoId);
  const filepath = path.join(REPORTS_DIR, filename);
  const now = new Date().toISOString();

  // Write the report file
  fs.writeFileSync(filepath, content, 'utf-8');

  // Create report entry
  const report: StandaloneReport = {
    id: generateUUID(),
    title,
    filename,
    createdAt: now,
    updatedAt: now,
    videoId: options?.videoId,
    videoTitle: options?.videoTitle,
    videoUrl: options?.videoUrl
  };

  // Add to index
  const index = loadReportsIndex();
  index.reports.push(report);
  saveReportsIndex(index);

  // Link to saved video if requested
  if (options?.linkToSavedVideo && options?.videoId) {
    const videosData = loadSavedVideosData();
    const video = findVideoById(videosData, options.videoId);
    if (video) {
      video.reportPath = filename;
      saveSavedVideosData(videosData);
    }
  }

  return report;
}

export function getReportContent(filename: string): string | null {
  const filepath = path.join(REPORTS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  return fs.readFileSync(filepath, 'utf-8');
}

export function findReportByVideoId(videoId: string): StandaloneReport | undefined {
  const index = loadReportsIndex();
  return index.reports.find(r => r.videoId === videoId);
}

export function findReportById(reportId: string): StandaloneReport | undefined {
  const index = loadReportsIndex();
  return index.reports.find(r => r.id === reportId);
}

export function deleteReport(reportId: string): boolean {
  const index = loadReportsIndex();
  const reportIndex = index.reports.findIndex(r => r.id === reportId);

  if (reportIndex === -1) {
    return false;
  }

  const report = index.reports[reportIndex];
  const filepath = path.join(REPORTS_DIR, report.filename);

  // Remove file
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  // Remove from index
  index.reports.splice(reportIndex, 1);
  saveReportsIndex(index);

  // Unlink from saved video if linked
  if (report.videoId) {
    const videosData = loadSavedVideosData();
    const video = findVideoById(videosData, report.videoId);
    if (video && video.reportPath === report.filename) {
      video.reportPath = undefined;
      saveSavedVideosData(videosData);
    }
  }

  return true;
}

// ============================================================================
// Lookup Helpers
// ============================================================================

export function findThematicByIdOrName(
  data: SavedVideosData,
  identifier: string
): Thematic | undefined {
  // First try by ID
  let thematic = data.thematics.find(t => t.id === identifier);
  if (thematic) return thematic;

  // Then try by name (case-insensitive)
  const lowerIdentifier = identifier.toLowerCase();
  return data.thematics.find(t => t.name.toLowerCase() === lowerIdentifier);
}

export function findTopicByIdOrName(
  data: SavedVideosData,
  identifier: string
): Topic | undefined {
  // First try by ID
  let topic = data.topics.find(t => t.id === identifier);
  if (topic) return topic;

  // Then try by name (case-insensitive)
  const lowerIdentifier = identifier.toLowerCase();
  return data.topics.find(t => t.name.toLowerCase() === lowerIdentifier);
}

export function findVideoById(
  data: SavedVideosData,
  videoId: string
): SavedVideo | undefined {
  return data.videos.find(v => v.id === videoId);
}

export function getVideosForTopic(
  data: SavedVideosData,
  topicId: string
): SavedVideo[] {
  return data.videos.filter(v => v.topicIds.includes(topicId));
}

export function getVideosForThematic(
  data: SavedVideosData,
  thematicId: string
): SavedVideo[] {
  // Get all topic IDs belonging to this thematic
  const topicIds = data.topics
    .filter(t => t.thematicId === thematicId)
    .map(t => t.id);

  // Get all videos that have at least one of these topics
  return data.videos.filter(v =>
    v.topicIds.some(tid => topicIds.includes(tid))
  );
}

export function getUnassignedVideos(data: SavedVideosData): SavedVideo[] {
  return data.videos.filter(v => v.topicIds.length === 0);
}

export function getTopicsForThematic(
  data: SavedVideosData,
  thematicId: string | null
): Topic[] {
  return data.topics.filter(t => t.thematicId === thematicId);
}

export function getUncategorizedTopics(data: SavedVideosData): Topic[] {
  return data.topics.filter(t => t.thematicId === null);
}

// ============================================================================
// UUID Generation
// ============================================================================

export function generateUUID(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Video ID Extraction
// ============================================================================

export function extractVideoId(input: string): string {
  // Already a video ID (11 characters, alphanumeric with - and _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Return as-is if no pattern matched (let the caller handle validation)
  return input;
}

// ============================================================================
// YouTube Client (for resolving video details)
// ============================================================================

let clientInstance: Innertube | null = null;

export async function getYouTubeClient(): Promise<Innertube> {
  if (!clientInstance) {
    clientInstance = await Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: true,
      enable_session_cache: true
    });
  }
  return clientInstance;
}

export interface ResolvedVideoInfo {
  id: string;
  title: string;
  url: string;

  // Channel info
  channelId: string;
  channelName: string;
  channelHandle?: string;

  // Content metadata
  description?: string;
  duration?: string;
  durationSeconds?: number;
  publishedAt?: string;
  category?: string;
  keywords?: string[];
  isShort?: boolean;

  // Engagement statistics
  views?: string;
  viewCount?: number;
  likes?: string;
  likeCount?: number;

  // Media
  thumbnailUrl?: string;
}

export async function resolveVideoInfo(videoId: string): Promise<ResolvedVideoInfo> {
  const client = await getYouTubeClient();
  const info = await client.getInfo(videoId);

  const basicInfo = info.basic_info;
  const videoDetails = info.primary_info;
  const secondaryInfo = info.secondary_info;

  // Extract channel info
  let channelId = '';
  let channelName = '';
  let channelHandle: string | undefined;

  if (secondaryInfo?.owner?.author) {
    channelName = secondaryInfo.owner.author.name || '';
    channelId = secondaryInfo.owner.author.id || '';
    // Extract channel handle from URL if available
    const authorUrl = (secondaryInfo.owner.author as any).url;
    if (authorUrl && authorUrl.includes('@')) {
      const handleMatch = authorUrl.match(/@([^/]+)/);
      if (handleMatch) {
        channelHandle = `@${handleMatch[1]}`;
      }
    }
  }

  // Duration
  let duration = '';
  let durationSeconds: number | undefined;
  if (basicInfo.duration) {
    durationSeconds = basicInfo.duration;
    const totalSeconds = basicInfo.duration;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      duration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Views
  let views = '';
  let viewCount: number | undefined;
  if (basicInfo.view_count !== undefined) {
    viewCount = basicInfo.view_count;
    views = formatCount(basicInfo.view_count);
  }

  // Likes - try to extract from primary_info
  let likes = '';
  let likeCount: number | undefined;
  try {
    const menuButtons = (videoDetails as any)?.menu?.top_level_buttons;
    if (menuButtons) {
      for (const button of menuButtons) {
        // Look for like button
        if (button.like_count !== undefined) {
          likeCount = button.like_count;
          likes = formatCount(button.like_count);
          break;
        }
        // Alternative: check toggle_button_view_model
        const toggleModel = button.toggle_button_view_model?.toggle_button_view_model;
        if (toggleModel?.default_button_view_model?.button_view_model?.title) {
          const titleText = toggleModel.default_button_view_model.button_view_model.title;
          if (titleText && /^\d/.test(titleText)) {
            likes = titleText;
            // Try to parse the count
            const parsed = parseCountString(titleText);
            if (parsed !== undefined) {
              likeCount = parsed;
            }
            break;
          }
        }
      }
    }
  } catch {
    // Ignore errors extracting likes
  }

  // Thumbnail
  let thumbnailUrl = '';
  if (basicInfo.thumbnail && basicInfo.thumbnail.length > 0) {
    thumbnailUrl = basicInfo.thumbnail[0].url;
  }

  // Category
  const category = basicInfo.category || undefined;

  // Keywords (limit to 10)
  let keywords: string[] | undefined;
  if (basicInfo.keywords && basicInfo.keywords.length > 0) {
    keywords = basicInfo.keywords.slice(0, 10);
  }

  // Check if it's a YouTube Short (typically <= 60 seconds and vertical)
  const isShort = durationSeconds !== undefined && durationSeconds <= 60;

  // Build URL
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  return {
    id: videoId,
    title: basicInfo.title || '',
    url,
    channelId,
    channelName,
    channelHandle,
    description: basicInfo.short_description ? basicInfo.short_description.substring(0, 500) : '',
    duration,
    durationSeconds,
    publishedAt: videoDetails?.published?.text || '',
    category,
    keywords,
    isShort,
    views,
    viewCount,
    likes,
    likeCount,
    thumbnailUrl
  };
}

function formatCount(count: number): string {
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1)}B`;
  } else if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  } else if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

function parseCountString(str: string): number | undefined {
  // Parse strings like "45K", "1.2M", "1.5B" back to numbers
  const match = str.match(/^([\d.]+)\s*([KMB])?/i);
  if (!match) return undefined;

  const num = parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();

  switch (suffix) {
    case 'K': return Math.round(num * 1_000);
    case 'M': return Math.round(num * 1_000_000);
    case 'B': return Math.round(num * 1_000_000_000);
    default: return Math.round(num);
  }
}

// ============================================================================
// CLI Utilities
// ============================================================================

export function parseArgs(args: string[]): Record<string, string | boolean | string[]> {
  const result: Record<string, string | boolean | string[]> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (!nextArg || nextArg.startsWith('--')) {
        result[key] = true;
      } else {
        // Support multiple values for the same key
        if (result[key] !== undefined) {
          if (Array.isArray(result[key])) {
            (result[key] as string[]).push(nextArg);
          } else {
            result[key] = [result[key] as string, nextArg];
          }
        } else {
          result[key] = nextArg;
        }
        i++;
      }
    }
  }

  return result;
}

export function getPositionalArgs(args: string[]): string[] {
  const positional: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      // Skip the flag
      i++;
      // Skip the value if it's not another flag
      if (i < args.length && !args[i].startsWith('--')) {
        i++;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }

  return positional;
}

export function formatOutput(data: unknown, json: boolean = false): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        console.log(`\n[${index + 1}]`);
        formatObject(item as Record<string, unknown>);
      });
    } else {
      formatObject(data as Record<string, unknown>);
    }
  }
}

function formatObject(obj: Record<string, unknown>, indent: string = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${indent}${key}:`);
      formatObject(value as Record<string, unknown>, indent + '  ');
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        console.log(`${indent}${key}: (none)`);
      } else if (typeof value[0] === 'string') {
        console.log(`${indent}${key}: ${value.join(', ')}`);
      } else {
        console.log(`${indent}${key}: [${value.length} items]`);
      }
    } else {
      const displayValue = typeof value === 'string' && value.length > 100
        ? value.substring(0, 100) + '...'
        : value;
      console.log(`${indent}${key}: ${displayValue}`);
    }
  }
}

export function printStatus(
  message: string,
  type: 'OK' | 'ERROR' | 'INFO' | 'WARN' = 'INFO'
): void {
  const prefix = {
    OK: '[OK]',
    ERROR: '[ERROR]',
    INFO: '[INFO]',
    WARN: '[WARN]'
  };
  console.error(`${prefix[type]} ${message}`);
}

export function printUsage(
  tool: string,
  description: string,
  actions: Array<{
    name: string;
    description: string;
    options?: Array<{ flag: string; description: string; required?: boolean }>;
  }>
): void {
  console.log(`\n${description}\n`);
  console.log(`Usage: npx tsx ${tool}.ts <action> [options]\n`);
  console.log('Actions:');

  for (const action of actions) {
    console.log(`\n  ${action.name}`);
    console.log(`    ${action.description}`);
    if (action.options) {
      for (const opt of action.options) {
        const req = opt.required ? ' (required)' : '';
        console.log(`      ${opt.flag.padEnd(30)} ${opt.description}${req}`);
      }
    }
  }

  console.log('\nGlobal Options:');
  console.log('  --json                          Output as JSON');
  console.log('  --help                          Show this help message');
}
