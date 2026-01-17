// Local Sync Module
// Caches playlists locally for offline access and comparison

import * as fs from 'fs';
import * as path from 'path';
import { listPlaylists } from '../api/playlists.js';
import { listPlaylistItems } from '../api/playlist-items.js';
import type {
  PlaylistsCache,
  CachedPlaylist,
  CachedPlaylistItem,
  SyncResult,
  DiffResult,
  DiffItem,
  Playlist,
  PlaylistItem,
} from '../types/index.js';
import { PlaylistError } from '../types/index.js';

// ============================================================================
// Constants
// ============================================================================

const DATA_DIR = path.join(process.env.HOME || '', '.google-skills', 'youtube');
const CACHE_FILE = path.join(DATA_DIR, 'playlists-cache.json');
const CACHE_VERSION = '1.0';

// ============================================================================
// File Operations
// ============================================================================

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getEmptyCache(): PlaylistsCache {
  return {
    version: CACHE_VERSION,
    lastSynced: '',
    playlists: [],
  };
}

/**
 * Load the local playlist cache
 */
export function loadCache(): PlaylistsCache {
  if (!fs.existsSync(CACHE_FILE)) {
    return getEmptyCache();
  }

  try {
    const content = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(content) as PlaylistsCache;

    // Ensure structure is valid
    cache.playlists = cache.playlists || [];

    return cache;
  } catch {
    return getEmptyCache();
  }
}

/**
 * Save the playlist cache
 */
export function saveCache(cache: PlaylistsCache): void {
  ensureDataDir();
  cache.lastSynced = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Clear the local cache
 */
export function clearCache(): void {
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
  }
}

// ============================================================================
// Conversion Functions
// ============================================================================

function playlistToCached(playlist: Playlist, items: PlaylistItem[]): CachedPlaylist {
  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    itemCount: playlist.itemCount,
    privacy: playlist.privacy,
    thumbnailUrl: playlist.thumbnails.medium?.url || playlist.thumbnails.default?.url,
    channelTitle: playlist.channelTitle,
    items: items.map(itemToCached),
    lastSynced: new Date().toISOString(),
  };
}

function itemToCached(item: PlaylistItem): CachedPlaylistItem {
  return {
    id: item.id,
    videoId: item.videoId,
    title: item.title,
    channelTitle: item.videoOwnerChannelTitle || item.channelTitle,
    thumbnailUrl: item.thumbnails.medium?.url || item.thumbnails.default?.url,
    position: item.position,
  };
}

// ============================================================================
// Sync Operations
// ============================================================================

/**
 * Sync all playlists from YouTube to local cache
 */
export async function syncAll(
  progressCallback?: (message: string) => void
): Promise<SyncResult> {
  const errors: string[] = [];
  let playlistsCount = 0;
  let videosCount = 0;

  try {
    progressCallback?.('Fetching playlists...');
    const playlists = await listPlaylists(100);
    playlistsCount = playlists.length;

    const cachedPlaylists: CachedPlaylist[] = [];

    for (const playlist of playlists) {
      try {
        progressCallback?.(`Syncing: ${playlist.title} (${playlist.itemCount} items)`);
        const items = await listPlaylistItems(playlist.id, 500);
        videosCount += items.length;
        cachedPlaylists.push(playlistToCached(playlist, items));
      } catch (error) {
        const message = `Failed to sync playlist "${playlist.title}": ${error}`;
        errors.push(message);
        progressCallback?.(message);
      }
    }

    const cache: PlaylistsCache = {
      version: CACHE_VERSION,
      lastSynced: new Date().toISOString(),
      playlists: cachedPlaylists,
    };

    saveCache(cache);

    return {
      success: errors.length === 0,
      playlistsCount,
      videosCount,
      timestamp: cache.lastSynced,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    throw new PlaylistError(
      `Sync failed: ${error}`,
      'API_ERROR',
      error
    );
  }
}

/**
 * Sync a single playlist
 */
export async function syncPlaylist(playlistId: string): Promise<SyncResult> {
  try {
    const playlists = await listPlaylists(100);
    const playlist = playlists.find((p) => p.id === playlistId);

    if (!playlist) {
      throw new PlaylistError(`Playlist not found: ${playlistId}`, 'PLAYLIST_NOT_FOUND');
    }

    const items = await listPlaylistItems(playlistId, 500);
    const cachedPlaylist = playlistToCached(playlist, items);

    // Update cache
    const cache = loadCache();
    const existingIndex = cache.playlists.findIndex((p) => p.id === playlistId);

    if (existingIndex >= 0) {
      cache.playlists[existingIndex] = cachedPlaylist;
    } else {
      cache.playlists.push(cachedPlaylist);
    }

    saveCache(cache);

    return {
      success: true,
      playlistsCount: 1,
      videosCount: items.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof PlaylistError) {
      throw error;
    }
    throw new PlaylistError(
      `Failed to sync playlist: ${error}`,
      'API_ERROR',
      error
    );
  }
}

// ============================================================================
// Local Access (Offline)
// ============================================================================

/**
 * Get all playlists from local cache
 */
export function getLocalPlaylists(): CachedPlaylist[] {
  const cache = loadCache();
  return cache.playlists;
}

/**
 * Get a specific playlist from local cache
 */
export function getLocalPlaylist(playlistId: string): CachedPlaylist | null {
  const cache = loadCache();
  return cache.playlists.find((p) => p.id === playlistId) || null;
}

/**
 * Search local playlists by title
 */
export function searchLocalPlaylists(query: string): CachedPlaylist[] {
  const cache = loadCache();
  const lowerQuery = query.toLowerCase();

  return cache.playlists.filter(
    (p) =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get cache status
 */
export function getCacheStatus(): {
  exists: boolean;
  lastSynced: string | null;
  playlistCount: number;
  totalVideos: number;
} {
  const cache = loadCache();

  return {
    exists: cache.lastSynced !== '',
    lastSynced: cache.lastSynced || null,
    playlistCount: cache.playlists.length,
    totalVideos: cache.playlists.reduce((sum, p) => sum + p.items.length, 0),
  };
}

// ============================================================================
// Diff Operations
// ============================================================================

/**
 * Compare local cache with remote YouTube playlists
 */
export async function comparePlaylists(): Promise<DiffResult> {
  const cache = loadCache();
  const remotePlaylists = await listPlaylists(100);

  const localIds = new Set(cache.playlists.map((p) => p.id));
  const remoteIds = new Set(remotePlaylists.map((p) => p.id));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const items: DiffItem[] = [];

  // Find added playlists (in remote but not local)
  for (const remote of remotePlaylists) {
    if (!localIds.has(remote.id)) {
      added.push(remote.title);
      items.push({
        type: 'added',
        playlistId: remote.id,
        playlistTitle: remote.title,
        details: `New playlist with ${remote.itemCount} videos`,
      });
    }
  }

  // Find removed playlists (in local but not remote)
  for (const local of cache.playlists) {
    if (!remoteIds.has(local.id)) {
      removed.push(local.title);
      items.push({
        type: 'removed',
        playlistId: local.id,
        playlistTitle: local.title,
        details: `Playlist no longer exists`,
      });
    }
  }

  // Find modified playlists
  for (const remote of remotePlaylists) {
    const local = cache.playlists.find((p) => p.id === remote.id);
    if (local) {
      const changes: string[] = [];

      if (local.title !== remote.title) {
        changes.push(`title: "${local.title}" -> "${remote.title}"`);
      }
      if (local.itemCount !== remote.itemCount) {
        changes.push(`videos: ${local.itemCount} -> ${remote.itemCount}`);
      }
      if (local.privacy !== remote.privacy) {
        changes.push(`privacy: ${local.privacy} -> ${remote.privacy}`);
      }

      if (changes.length > 0) {
        modified.push(remote.title);
        items.push({
          type: 'modified',
          playlistId: remote.id,
          playlistTitle: remote.title,
          details: changes.join(', '),
        });
      }
    }
  }

  return {
    hasChanges: items.length > 0,
    playlists: { added, removed, modified },
    items,
  };
}

/**
 * Get detailed diff for a specific playlist
 */
export async function comparePlaylistItems(playlistId: string): Promise<{
  added: CachedPlaylistItem[];
  removed: CachedPlaylistItem[];
  reordered: boolean;
}> {
  const local = getLocalPlaylist(playlistId);
  if (!local) {
    throw new PlaylistError(`Playlist not in local cache: ${playlistId}`, 'PLAYLIST_NOT_FOUND');
  }

  const remoteItems = await listPlaylistItems(playlistId, 500);

  const localVideoIds = new Set(local.items.map((i) => i.videoId));
  const remoteVideoIds = new Set(remoteItems.map((i) => i.videoId));

  const added: CachedPlaylistItem[] = [];
  const removed: CachedPlaylistItem[] = [];

  // Find added videos
  for (const remote of remoteItems) {
    if (!localVideoIds.has(remote.videoId)) {
      added.push(itemToCached(remote));
    }
  }

  // Find removed videos
  for (const localItem of local.items) {
    if (!remoteVideoIds.has(localItem.videoId)) {
      removed.push(localItem);
    }
  }

  // Check for reordering
  let reordered = false;
  if (added.length === 0 && removed.length === 0) {
    for (let i = 0; i < local.items.length; i++) {
      const remoteItem = remoteItems.find((r) => r.videoId === local.items[i].videoId);
      if (remoteItem && remoteItem.position !== local.items[i].position) {
        reordered = true;
        break;
      }
    }
  }

  return { added, removed, reordered };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the cache file path
 */
export function getCacheFilePath(): string {
  return CACHE_FILE;
}

/**
 * Check if cache exists and is recent
 */
export function isCacheFresh(maxAgeMinutes: number = 60): boolean {
  const cache = loadCache();
  if (!cache.lastSynced) {
    return false;
  }

  const lastSyncTime = new Date(cache.lastSynced).getTime();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  return Date.now() - lastSyncTime < maxAgeMs;
}
