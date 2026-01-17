// Playlist Tools Library
// YouTube Custom Playlists Management via Official Google APIs

// ============================================================================
// Types
// ============================================================================

export type {
  // Thumbnail types
  Thumbnail,
  Thumbnails,

  // Playlist types
  Playlist,
  PlaylistPrivacy,
  PlaylistCreateOptions,
  PlaylistUpdateOptions,

  // Playlist item types
  PlaylistItem,
  PlaylistItemAddOptions,
  PlaylistItemUpdateOptions,

  // Cache types
  PlaylistsCache,
  CachedPlaylist,
  CachedPlaylistItem,
  SyncResult,
  DiffResult,
  DiffItem,

  // OAuth types
  OAuthCredentials,
  StoredTokens,

  // Error types
  PlaylistErrorType,
} from './types/index.js';

export { PlaylistError } from './types/index.js';

// ============================================================================
// Auth Module
// ============================================================================

export {
  // Client access
  getOAuth2Client,
  getAuthenticatedClient,
  getAuthClient,

  // Authentication
  authenticate,
  getAuthUrl,

  // Token management
  isTokenExpired,
  refreshTokenIfNeeded,

  // Status and logout
  getAuthStatus,
  logout,

  // Utilities
  credentialsExist,
  getStoragePaths,
} from './auth/oauth-client.js';

export type { AuthStatus } from './auth/oauth-client.js';

// ============================================================================
// Playlist API Module
// ============================================================================

export {
  // CRUD operations
  listPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,

  // Search
  searchPlaylists,
  getPlaylistByTitle,
} from './api/playlists.js';

// ============================================================================
// Playlist Items API Module
// ============================================================================

export {
  // CRUD operations
  listPlaylistItems,
  getPlaylistItem,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  updatePlaylistItem,
  moveVideoInPlaylist,

  // Utility functions
  isVideoInPlaylist,
  removeVideoByVideoId,
  getPlaylistItemCount,
  extractVideoId,
} from './api/playlist-items.js';

// ============================================================================
// Sync Module
// ============================================================================

export {
  // Sync operations
  syncAll,
  syncPlaylist,

  // Local access
  getLocalPlaylists,
  getLocalPlaylist,
  searchLocalPlaylists,

  // Cache management
  loadCache,
  saveCache,
  clearCache,
  getCacheStatus,
  getCacheFilePath,
  isCacheFresh,

  // Diff operations
  comparePlaylists,
  comparePlaylistItems,
} from './sync/local-sync.js';

// ============================================================================
// Validation Utilities
// ============================================================================

export {
  // Video validation
  isValidVideoId,
  validateVideoId,
  extractAndValidateVideoId,

  // Playlist validation
  isValidPlaylistId,
  validatePlaylistId,

  // Playlist item validation
  isValidPlaylistItemId,
  validatePlaylistItemId,

  // General validation
  validateRequiredString,
  validatePrivacy,
  validatePosition,
} from './utils/validators.js';

// ============================================================================
// Retry Utilities
// ============================================================================

export {
  withRetry,
  withRetryResult,
  createRetryWrapper,
} from './utils/retry.js';

export type {
  RetryOptions,
  RetryResult,
} from './utils/retry.js';
