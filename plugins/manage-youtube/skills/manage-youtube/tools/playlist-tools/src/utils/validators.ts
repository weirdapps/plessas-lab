// Input Validation Utilities
// Validates YouTube IDs before making API calls to save quota

import { PlaylistError } from '../types/index.js';

// ============================================================================
// Video ID Validation
// ============================================================================

/**
 * Check if a string is a valid YouTube video ID
 * Video IDs are exactly 11 characters: alphanumeric, dash, or underscore
 */
export function isValidVideoId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Validate video ID and throw if invalid
 */
export function validateVideoId(id: string, context?: string): void {
  if (!isValidVideoId(id)) {
    const message = context
      ? `Invalid video ID "${id}" for ${context}`
      : `Invalid video ID: "${id}"`;
    throw new PlaylistError(
      `${message}. Video IDs must be exactly 11 characters (alphanumeric, dash, or underscore).`,
      'VIDEO_NOT_FOUND'
    );
  }
}

// ============================================================================
// Playlist ID Validation
// ============================================================================

/**
 * Known playlist ID prefixes:
 * - PL: User-created playlists
 * - UU: Channel uploads
 * - LL: Liked videos
 * - WL: Watch Later
 * - HL: History (deprecated)
 * - FL: Favorites (deprecated)
 * - OL: Popular on YouTube
 * - RD: Mix/Radio playlists
 * - RDMM: My Mix
 * - RDEM: Endless Mix
 */
const PLAYLIST_ID_PREFIXES = ['PL', 'UU', 'LL', 'WL', 'HL', 'FL', 'OL', 'RD', 'RDMM', 'RDEM'];

/**
 * Maximum reasonable playlist ID length. Real YouTube IDs are typically 34
 * characters (PL + 32) but some prefix variants and test IDs are longer; 64 is
 * a generous cap that still prevents a megabyte-long string from reaching the
 * API and triggering retries / exponential backoff (a quota DoS).
 */
const MAX_PLAYLIST_ID_LENGTH = 64;

/**
 * Check if a string is a valid YouTube playlist ID
 */
export function isValidPlaylistId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // Cap length BEFORE regex match to defuse pathological inputs.
  if (id.length > MAX_PLAYLIST_ID_LENGTH) {
    return false;
  }

  // Special case: WL (Watch Later) is just 2 characters
  if (id === 'WL' || id === 'HL') {
    return true;
  }

  // Must start with a known prefix and have additional characters
  const hasValidPrefix = PLAYLIST_ID_PREFIXES.some(prefix => id.startsWith(prefix));
  if (!hasValidPrefix) {
    return false;
  }

  // Playlist IDs are alphanumeric with dashes and underscores
  // Minimum length varies by type, but typically at least 10+ chars for PL playlists
  return /^[a-zA-Z0-9_-]{2,}$/.test(id) && id.length >= 2;
}

/**
 * Validate playlist ID and throw if invalid
 */
export function validatePlaylistId(id: string, context?: string): void {
  if (!isValidPlaylistId(id)) {
    const message = context
      ? `Invalid playlist ID "${id}" for ${context}`
      : `Invalid playlist ID: "${id}"`;
    throw new PlaylistError(
      `${message}. Playlist IDs typically start with PL, UU, LL, WL, RD, etc.`,
      'PLAYLIST_NOT_FOUND'
    );
  }
}

// ============================================================================
// Playlist Item ID Validation
// ============================================================================

/**
 * Check if a string is a valid playlist item ID
 * Playlist item IDs are longer alphanumeric strings (typically 40+ chars)
 */
export function isValidPlaylistItemId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // Playlist item IDs are long alphanumeric strings
  // They contain the playlist ID and video ID encoded
  return /^[a-zA-Z0-9_-]{20,}$/.test(id);
}

/**
 * Validate playlist item ID and throw if invalid
 */
export function validatePlaylistItemId(id: string, context?: string): void {
  if (!isValidPlaylistItemId(id)) {
    const message = context
      ? `Invalid playlist item ID "${id}" for ${context}`
      : `Invalid playlist item ID: "${id}"`;
    throw new PlaylistError(
      `${message}. Playlist item IDs are long alphanumeric strings (use 'videos' command to get them).`,
      'VIDEO_NOT_FOUND'
    );
  }
}

// ============================================================================
// URL Extraction with Validation
// ============================================================================

/**
 * Extract and validate video ID from URL or direct ID
 * Returns the validated video ID or throws if invalid
 */
export function extractAndValidateVideoId(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new PlaylistError(
      'Video ID or URL is required',
      'VIDEO_NOT_FOUND'
    );
  }

  const trimmed = input.trim();

  // If it's already a valid video ID, return it
  if (isValidVideoId(trimmed)) {
    return trimmed;
  }

  // Try to extract from URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If we get here, the input is neither a valid ID nor a recognizable URL
  throw new PlaylistError(
    `Could not extract valid video ID from: "${input}". Provide an 11-character video ID or a valid YouTube URL.`,
    'VIDEO_NOT_FOUND'
  );
}

// ============================================================================
// General Input Validation
// ============================================================================

/**
 * Validate required string input
 */
export function validateRequiredString(
  value: string | undefined | null,
  fieldName: string
): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new PlaylistError(
      `${fieldName} is required and cannot be empty`,
      'API_ERROR'
    );
  }
  return value.trim();
}

/**
 * Validate playlist privacy value
 */
export function validatePrivacy(
  privacy: string | undefined
): 'public' | 'private' | 'unlisted' | undefined {
  if (!privacy) {
    return undefined;
  }

  const normalized = privacy.toLowerCase();
  if (!['public', 'private', 'unlisted'].includes(normalized)) {
    throw new PlaylistError(
      `Invalid privacy value: "${privacy}". Must be one of: public, private, unlisted`,
      'API_ERROR'
    );
  }

  return normalized as 'public' | 'private' | 'unlisted';
}

/**
 * Validate position (must be non-negative integer)
 */
export function validatePosition(position: number | undefined): number | undefined {
  if (position === undefined) {
    return undefined;
  }

  if (!Number.isInteger(position) || position < 0) {
    throw new PlaylistError(
      `Invalid position: ${position}. Position must be a non-negative integer.`,
      'API_ERROR'
    );
  }

  return position;
}
