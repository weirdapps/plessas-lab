// Playlist Items Operations
// Manages videos within playlists using YouTube Data API v3

import { google, youtube_v3 } from 'googleapis';
import { getAuthClient } from '../auth/oauth-client.js';
import type {
  PlaylistItem,
  PlaylistItemAddOptions,
  PlaylistItemUpdateOptions,
  Thumbnails,
} from '../types/index.js';
import { PlaylistError } from '../types/index.js';
import {
  validatePlaylistId,
  validatePlaylistItemId,
  extractAndValidateVideoId,
  validatePosition,
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

function mapPlaylistItem(item: youtube_v3.Schema$PlaylistItem): PlaylistItem {
  const snippet = item.snippet || {};
  const contentDetails = item.contentDetails || {};
  const status = item.status || {};

  return {
    id: item.id || '',
    playlistId: snippet.playlistId || '',
    videoId: contentDetails.videoId || snippet.resourceId?.videoId || '',
    title: snippet.title || '',
    description: snippet.description || '',
    thumbnails: mapThumbnails(snippet.thumbnails),
    channelId: snippet.channelId || '',
    channelTitle: snippet.channelTitle || '',
    position: snippet.position ?? 0,
    publishedAt: snippet.publishedAt || '',
    videoOwnerChannelId: snippet.videoOwnerChannelId || undefined,
    videoOwnerChannelTitle: snippet.videoOwnerChannelTitle || undefined,
    privacyStatus: status.privacyStatus || undefined,
  };
}

function handleApiError(error: unknown, operation: string): never {
  if (error instanceof PlaylistError) {
    throw error;
  }

  const apiError = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> };

  if (apiError.code === 404) {
    throw new PlaylistError(`Resource not found`, 'VIDEO_NOT_FOUND', error);
  }

  if (apiError.code === 403) {
    const reason = apiError.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') {
      throw new PlaylistError('API quota exceeded', 'QUOTA_EXCEEDED', error);
    }
    if (reason === 'playlistContainsMaximumNumberOfVideos') {
      throw new PlaylistError('Playlist has reached maximum number of videos', 'API_ERROR', error);
    }
    throw new PlaylistError('Permission denied', 'PERMISSION_DENIED', error);
  }

  if (apiError.code === 401) {
    throw new PlaylistError('Authentication required or expired', 'AUTH_EXPIRED', error);
  }

  if (apiError.code === 400) {
    throw new PlaylistError(`Invalid request: ${apiError.message}`, 'API_ERROR', error);
  }

  throw new PlaylistError(
    `${operation} failed: ${apiError.message || 'Unknown error'}`,
    'API_ERROR',
    error
  );
}

/**
 * Extract video ID from URL or return as-is if already an ID
 */
export function extractVideoId(input: string): string {
  // Already a video ID (11 characters, alphanumeric with - and _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Return as-is if no pattern matched (let the API validate)
  return input;
}

// ============================================================================
// Playlist Item Operations
// ============================================================================

/**
 * List all videos in a playlist
 */
export async function listPlaylistItems(
  playlistId: string,
  maxResults: number = 200
): Promise<PlaylistItem[]> {
  validatePlaylistId(playlistId, 'listPlaylistItems');

  const youtube = await getYouTubeClient();
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await withRetry(() =>
        youtube.playlistItems.list({
          part: ['snippet', 'contentDetails', 'status'],
          playlistId,
          maxResults: Math.min(maxResults - items.length, 50),
          pageToken,
        })
      );

      const responseItems = response.data.items || [];
      for (const item of responseItems) {
        items.push(mapPlaylistItem(item));
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken && items.length < maxResults);

    return items;
  } catch (error) {
    handleApiError(error, 'List playlist items');
  }
}

/**
 * Get a specific playlist item by ID
 */
export async function getPlaylistItem(playlistItemId: string): Promise<PlaylistItem> {
  validatePlaylistItemId(playlistItemId, 'getPlaylistItem');

  const youtube = await getYouTubeClient();

  try {
    const response = await withRetry(() =>
      youtube.playlistItems.list({
        part: ['snippet', 'contentDetails', 'status'],
        id: [playlistItemId],
      })
    );

    const items = response.data.items || [];
    if (items.length === 0) {
      throw new PlaylistError(`Playlist item not found: ${playlistItemId}`, 'VIDEO_NOT_FOUND');
    }

    return mapPlaylistItem(items[0]);
  } catch (error) {
    handleApiError(error, 'Get playlist item');
  }
}

/**
 * Add a video to a playlist
 */
export async function addVideoToPlaylist(options: PlaylistItemAddOptions): Promise<PlaylistItem> {
  validatePlaylistId(options.playlistId, 'addVideoToPlaylist');
  const videoId = extractAndValidateVideoId(options.videoId);
  const position = validatePosition(options.position);

  const youtube = await getYouTubeClient();

  try {
    const requestBody: youtube_v3.Schema$PlaylistItem = {
      snippet: {
        playlistId: options.playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId,
        },
      },
    };

    // Add position if specified
    if (position !== undefined) {
      requestBody.snippet!.position = position;
    }

    const response = await withRetry(() =>
      youtube.playlistItems.insert({
        part: ['snippet', 'contentDetails', 'status'],
        requestBody,
      })
    );

    if (!response.data) {
      throw new PlaylistError('Failed to add video: No response data', 'API_ERROR');
    }

    return mapPlaylistItem(response.data);
  } catch (error) {
    handleApiError(error, 'Add video to playlist');
  }
}

/**
 * Remove a video from a playlist
 */
export async function removeVideoFromPlaylist(playlistItemId: string): Promise<void> {
  validatePlaylistItemId(playlistItemId, 'removeVideoFromPlaylist');

  const youtube = await getYouTubeClient();

  try {
    await withRetry(() =>
      youtube.playlistItems.delete({
        id: playlistItemId,
      })
    );
  } catch (error) {
    handleApiError(error, 'Remove video from playlist');
  }
}

/**
 * Update a playlist item (primarily for changing position)
 */
export async function updatePlaylistItem(options: PlaylistItemUpdateOptions): Promise<PlaylistItem> {
  validatePlaylistItemId(options.playlistItemId, 'updatePlaylistItem');
  validatePlaylistId(options.playlistId, 'updatePlaylistItem');
  const position = validatePosition(options.position);

  const youtube = await getYouTubeClient();

  try {
    const requestBody: youtube_v3.Schema$PlaylistItem = {
      id: options.playlistItemId,
      snippet: {
        playlistId: options.playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId: options.videoId,
        },
        position,
      },
    };

    const response = await withRetry(() =>
      youtube.playlistItems.update({
        part: ['snippet', 'contentDetails', 'status'],
        requestBody,
      })
    );

    if (!response.data) {
      throw new PlaylistError('Failed to update playlist item: No response data', 'API_ERROR');
    }

    return mapPlaylistItem(response.data);
  } catch (error) {
    handleApiError(error, 'Update playlist item');
  }
}

/**
 * Move a video to a new position in the playlist
 */
export async function moveVideoInPlaylist(
  playlistItemId: string,
  newPosition: number
): Promise<PlaylistItem> {
  validatePlaylistItemId(playlistItemId, 'moveVideoInPlaylist');
  const position = validatePosition(newPosition);

  // First get the current item to get playlist and video IDs
  const currentItem = await getPlaylistItem(playlistItemId);

  return updatePlaylistItem({
    playlistItemId,
    playlistId: currentItem.playlistId,
    videoId: currentItem.videoId,
    position,
  });
}

/**
 * Check if a video exists in a playlist
 */
export async function isVideoInPlaylist(
  playlistId: string,
  videoId: string
): Promise<{ exists: boolean; playlistItemId?: string }> {
  validatePlaylistId(playlistId, 'isVideoInPlaylist');
  const normalizedVideoId = extractAndValidateVideoId(videoId);

  const items = await listPlaylistItems(playlistId);
  const found = items.find((item) => item.videoId === normalizedVideoId);

  return {
    exists: !!found,
    playlistItemId: found?.id,
  };
}

/**
 * Remove a video from playlist by video ID (not playlist item ID)
 */
export async function removeVideoByVideoId(
  playlistId: string,
  videoId: string
): Promise<boolean> {
  validatePlaylistId(playlistId, 'removeVideoByVideoId');
  // videoId is validated in isVideoInPlaylist

  const { exists, playlistItemId } = await isVideoInPlaylist(playlistId, videoId);

  if (!exists || !playlistItemId) {
    return false;
  }

  await removeVideoFromPlaylist(playlistItemId);
  return true;
}

/**
 * Get count of videos in a playlist
 */
export async function getPlaylistItemCount(playlistId: string): Promise<number> {
  validatePlaylistId(playlistId, 'getPlaylistItemCount');

  const youtube = await getYouTubeClient();

  try {
    const response = await withRetry(() =>
      youtube.playlistItems.list({
        part: ['id'],
        playlistId,
        maxResults: 1,
      })
    );

    return response.data.pageInfo?.totalResults || 0;
  } catch (error) {
    handleApiError(error, 'Get playlist item count');
  }
}
