// Playlist CRUD Operations
// Uses YouTube Data API v3

import { google, youtube_v3 } from 'googleapis';
import { getAuthClient } from '../auth/oauth-client.js';
import type {
  Playlist,
  PlaylistCreateOptions,
  PlaylistUpdateOptions,
  Thumbnails,
  PlaylistPrivacy,
} from '../types/index.js';
import { PlaylistError } from '../types/index.js';
import {
  validatePlaylistId,
  validateRequiredString,
  validatePrivacy,
} from '../utils/validators.js';
import { withRetry } from '../utils/retry.js';

// ============================================================================
// YouTube API Client
// ============================================================================

async function getYouTubeClient(): Promise<youtube_v3.Youtube> {
  const auth = await getAuthClient();
  return google.youtube({ version: 'v3', auth });
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapThumbnails(thumbnails: youtube_v3.Schema$ThumbnailDetails | undefined): Thumbnails {
  if (!thumbnails) return {};

  return {
    default: thumbnails.default ? {
      url: thumbnails.default.url || '',
      width: thumbnails.default.width || undefined,
      height: thumbnails.default.height || undefined,
    } : undefined,
    medium: thumbnails.medium ? {
      url: thumbnails.medium.url || '',
      width: thumbnails.medium.width || undefined,
      height: thumbnails.medium.height || undefined,
    } : undefined,
    high: thumbnails.high ? {
      url: thumbnails.high.url || '',
      width: thumbnails.high.width || undefined,
      height: thumbnails.high.height || undefined,
    } : undefined,
    standard: thumbnails.standard ? {
      url: thumbnails.standard.url || '',
      width: thumbnails.standard.width || undefined,
      height: thumbnails.standard.height || undefined,
    } : undefined,
    maxres: thumbnails.maxres ? {
      url: thumbnails.maxres.url || '',
      width: thumbnails.maxres.width || undefined,
      height: thumbnails.maxres.height || undefined,
    } : undefined,
  };
}

function mapPlaylist(item: youtube_v3.Schema$Playlist): Playlist {
  const snippet = item.snippet || {};
  const contentDetails = item.contentDetails || {};
  const status = item.status || {};

  return {
    id: item.id || '',
    title: snippet.title || '',
    description: snippet.description || '',
    publishedAt: snippet.publishedAt || '',
    channelId: snippet.channelId || '',
    channelTitle: snippet.channelTitle || '',
    thumbnails: mapThumbnails(snippet.thumbnails),
    itemCount: contentDetails.itemCount || 0,
    privacy: (status.privacyStatus as PlaylistPrivacy) || 'private',
    defaultLanguage: snippet.defaultLanguage || undefined,
    localized: snippet.localized ? {
      title: snippet.localized.title || '',
      description: snippet.localized.description || '',
    } : undefined,
  };
}

function handleApiError(error: unknown, operation: string): never {
  if (error instanceof PlaylistError) {
    throw error;
  }

  const apiError = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> };

  if (apiError.code === 404) {
    throw new PlaylistError(`Playlist not found`, 'PLAYLIST_NOT_FOUND', error);
  }

  if (apiError.code === 403) {
    const reason = apiError.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') {
      throw new PlaylistError('API quota exceeded', 'QUOTA_EXCEEDED', error);
    }
    throw new PlaylistError('Permission denied', 'PERMISSION_DENIED', error);
  }

  if (apiError.code === 401) {
    throw new PlaylistError('Authentication required or expired', 'AUTH_EXPIRED', error);
  }

  throw new PlaylistError(
    `${operation} failed: ${apiError.message || 'Unknown error'}`,
    'API_ERROR',
    error
  );
}

// ============================================================================
// Playlist Operations
// ============================================================================

/**
 * List all playlists for the authenticated user
 */
export async function listPlaylists(maxResults: number = 50): Promise<Playlist[]> {
  const youtube = await getYouTubeClient();
  const playlists: Playlist[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await withRetry(() =>
        youtube.playlists.list({
          part: ['snippet', 'contentDetails', 'status'],
          mine: true,
          maxResults: Math.min(maxResults - playlists.length, 50),
          pageToken,
        })
      );

      const items = response.data.items || [];
      for (const item of items) {
        playlists.push(mapPlaylist(item));
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken && playlists.length < maxResults);

    return playlists;
  } catch (error) {
    handleApiError(error, 'List playlists');
  }
}

/**
 * Get a specific playlist by ID
 */
export async function getPlaylist(playlistId: string): Promise<Playlist> {
  validatePlaylistId(playlistId, 'getPlaylist');

  const youtube = await getYouTubeClient();

  try {
    const response = await withRetry(() =>
      youtube.playlists.list({
        part: ['snippet', 'contentDetails', 'status'],
        id: [playlistId],
      })
    );

    const items = response.data.items || [];
    if (items.length === 0) {
      throw new PlaylistError(`Playlist not found: ${playlistId}`, 'PLAYLIST_NOT_FOUND');
    }

    return mapPlaylist(items[0]);
  } catch (error) {
    handleApiError(error, 'Get playlist');
  }
}

/**
 * Create a new playlist
 */
export async function createPlaylist(options: PlaylistCreateOptions): Promise<Playlist> {
  const title = validateRequiredString(options.title, 'Playlist title');
  const privacy = validatePrivacy(options.privacy) || 'private';

  const youtube = await getYouTubeClient();

  try {
    const response = await withRetry(() =>
      youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description: options.description || '',
            defaultLanguage: options.defaultLanguage,
          },
          status: {
            privacyStatus: privacy,
          },
        },
      })
    );

    if (!response.data) {
      throw new PlaylistError('Failed to create playlist: No response data', 'API_ERROR');
    }

    return mapPlaylist(response.data);
  } catch (error) {
    handleApiError(error, 'Create playlist');
  }
}

/**
 * Update an existing playlist
 */
export async function updatePlaylist(
  playlistId: string,
  options: PlaylistUpdateOptions
): Promise<Playlist> {
  validatePlaylistId(playlistId, 'updatePlaylist');
  const privacy = validatePrivacy(options.privacy);

  const youtube = await getYouTubeClient();

  // First, get the current playlist to preserve unchanged fields
  const current = await getPlaylist(playlistId);

  try {
    const response = await withRetry(() =>
      youtube.playlists.update({
        part: ['snippet', 'status'],
        requestBody: {
          id: playlistId,
          snippet: {
            title: options.title ?? current.title,
            description: options.description ?? current.description,
            defaultLanguage: options.defaultLanguage ?? current.defaultLanguage,
          },
          status: {
            privacyStatus: privacy ?? current.privacy,
          },
        },
      })
    );

    if (!response.data) {
      throw new PlaylistError('Failed to update playlist: No response data', 'API_ERROR');
    }

    return mapPlaylist(response.data);
  } catch (error) {
    handleApiError(error, 'Update playlist');
  }
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(playlistId: string): Promise<void> {
  validatePlaylistId(playlistId, 'deletePlaylist');

  const youtube = await getYouTubeClient();

  try {
    await withRetry(() =>
      youtube.playlists.delete({
        id: playlistId,
      })
    );
  } catch (error) {
    handleApiError(error, 'Delete playlist');
  }
}

/**
 * Search playlists by title (client-side filtering)
 */
export async function searchPlaylists(query: string): Promise<Playlist[]> {
  const allPlaylists = await listPlaylists(100);
  const lowerQuery = query.toLowerCase();

  return allPlaylists.filter(
    (p) =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get playlist by title (exact match, case-insensitive)
 */
export async function getPlaylistByTitle(title: string): Promise<Playlist | null> {
  const allPlaylists = await listPlaylists(100);
  const lowerTitle = title.toLowerCase();

  return allPlaylists.find((p) => p.title.toLowerCase() === lowerTitle) || null;
}
