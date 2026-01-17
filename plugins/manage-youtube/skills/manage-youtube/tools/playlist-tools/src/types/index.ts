// YouTube Playlist Types
// Based on YouTube Data API v3

// ============================================================================
// Thumbnail Types
// ============================================================================

export interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface Thumbnails {
  default?: Thumbnail;
  medium?: Thumbnail;
  high?: Thumbnail;
  standard?: Thumbnail;
  maxres?: Thumbnail;
}

// ============================================================================
// Playlist Types
// ============================================================================

export type PlaylistPrivacy = 'public' | 'private' | 'unlisted';

export interface Playlist {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  thumbnails: Thumbnails;
  itemCount: number;
  privacy: PlaylistPrivacy;
  defaultLanguage?: string;
  localized?: {
    title: string;
    description: string;
  };
}

export interface PlaylistCreateOptions {
  title: string;
  description?: string;
  privacy?: PlaylistPrivacy;
  defaultLanguage?: string;
}

export interface PlaylistUpdateOptions {
  title?: string;
  description?: string;
  privacy?: PlaylistPrivacy;
  defaultLanguage?: string;
}

// ============================================================================
// Playlist Item Types
// ============================================================================

export interface PlaylistItem {
  id: string;  // playlistItemId - needed for removal/update
  playlistId: string;
  videoId: string;
  title: string;
  description: string;
  thumbnails: Thumbnails;
  channelId: string;
  channelTitle: string;
  position: number;
  publishedAt: string;
  videoOwnerChannelId?: string;
  videoOwnerChannelTitle?: string;
  privacyStatus?: string;
}

export interface PlaylistItemAddOptions {
  playlistId: string;
  videoId: string;
  position?: number;
  note?: string;
}

export interface PlaylistItemUpdateOptions {
  playlistItemId: string;
  playlistId: string;
  videoId: string;
  position?: number;
  note?: string;
}

// ============================================================================
// Sync Types
// ============================================================================

export interface CachedPlaylistItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl?: string;
  position: number;
}

export interface CachedPlaylist {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  privacy: PlaylistPrivacy;
  thumbnailUrl?: string;
  channelTitle: string;
  items: CachedPlaylistItem[];
  lastSynced: string;
}

export interface PlaylistsCache {
  version: string;
  lastSynced: string;
  playlists: CachedPlaylist[];
}

export interface SyncResult {
  success: boolean;
  playlistsCount: number;
  videosCount: number;
  timestamp: string;
  errors?: string[];
}

export interface DiffItem {
  type: 'added' | 'removed' | 'modified';
  playlistId: string;
  playlistTitle: string;
  details?: string;
}

export interface DiffResult {
  hasChanges: boolean;
  playlists: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  items: DiffItem[];
}

// ============================================================================
// OAuth Types
// ============================================================================

export interface OAuthCredentials {
  installed: {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PageInfo {
  totalResults: number;
  resultsPerPage: number;
}

export interface PlaylistListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: PageInfo;
  items: Playlist[];
}

export interface PlaylistItemListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: PageInfo;
  items: PlaylistItem[];
}

// ============================================================================
// Error Types
// ============================================================================

export type PlaylistErrorType =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'CREDENTIALS_NOT_FOUND'
  | 'PLAYLIST_NOT_FOUND'
  | 'VIDEO_NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'UNKNOWN';

export class PlaylistError extends Error {
  constructor(
    message: string,
    public readonly type: PlaylistErrorType,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PlaylistError';
  }
}
