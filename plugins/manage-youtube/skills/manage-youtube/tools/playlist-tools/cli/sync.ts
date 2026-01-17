#!/usr/bin/env npx tsx
// CLI Tool for YouTube Playlist Sync Operations

import {
  syncAll,
  syncPlaylist,
  getLocalPlaylists,
  getLocalPlaylist,
  getCacheStatus,
  clearCache,
  comparePlaylists,
  comparePlaylistItems,
  getCacheFilePath,
  getAuthStatus,
} from '../src/index.js';
import { PlaylistError } from '../src/types/index.js';
import type { CachedPlaylist, CachedPlaylistItem } from '../src/types/index.js';

// ============================================================================
// CLI Utilities
// ============================================================================

interface ParsedArgs {
  flags: Record<string, string | boolean>;
  positional: string[];
}

function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (!nextArg || nextArg.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = nextArg;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

function printUsage(): void {
  console.log(`
YouTube Playlist Tools - Sync CLI

Usage: npx tsx cli/sync.ts <command> [options]

Commands:
  all                       Sync all playlists to local cache
  playlist <playlist-id>    Sync a specific playlist
  status                    Show local cache status
  local                     List playlists from local cache (offline)
  diff                      Compare local cache with YouTube
  diff-items <playlist-id>  Compare videos in a specific playlist
  clear                     Clear the local cache

Options:
  --json                    Output as JSON
  --verbose                 Show progress during sync

Examples:
  npx tsx cli/sync.ts all
  npx tsx cli/sync.ts all --verbose
  npx tsx cli/sync.ts playlist PLxxxxxxxx
  npx tsx cli/sync.ts status
  npx tsx cli/sync.ts local
  npx tsx cli/sync.ts local --json
  npx tsx cli/sync.ts diff
  npx tsx cli/sync.ts diff-items PLxxxxxxxx
  npx tsx cli/sync.ts clear
`);
}

function checkAuth(): void {
  const status = getAuthStatus();
  if (!status.isAuthenticated) {
    console.error('Not authenticated. Run "npx tsx cli/auth.ts login" first.');
    process.exit(1);
  }
}

function formatPlaylist(playlist: CachedPlaylist): void {
  console.log(`\n  ID:          ${playlist.id}`);
  console.log(`  Title:       ${playlist.title}`);
  console.log(`  Videos:      ${playlist.items.length}`);
  console.log(`  Privacy:     ${playlist.privacy}`);
  console.log(`  Last Synced: ${playlist.lastSynced}`);
}

function formatVideo(item: CachedPlaylistItem, index: number): void {
  console.log(`  [${index + 1}] ${item.title}`);
  console.log(`      Video ID: ${item.videoId}`);
  console.log(`      Channel:  ${item.channelTitle}`);
}

// ============================================================================
// Commands
// ============================================================================

async function handleSyncAll(flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  const verbose = flags.verbose === true;

  console.log('\n=== Syncing All Playlists ===\n');

  try {
    const result = await syncAll(verbose ? (msg) => console.log(msg) : undefined);

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log('\n=== Sync Complete ===');
    console.log(`\n  Playlists: ${result.playlistsCount}`);
    console.log(`  Videos:    ${result.videosCount}`);
    console.log(`  Timestamp: ${result.timestamp}`);

    if (result.errors && result.errors.length > 0) {
      console.log(`\n  Errors: ${result.errors.length}`);
      for (const error of result.errors) {
        console.log(`    - ${error}`);
      }
    }
  } catch (error) {
    handleError(error, 'sync');
  }
}

async function handleSyncPlaylist(playlistId: string, flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  console.log(`\nSyncing playlist: ${playlistId}...`);

  try {
    const result = await syncPlaylist(playlistId);

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log('\n=== Sync Complete ===');
    console.log(`\n  Videos:    ${result.videosCount}`);
    console.log(`  Timestamp: ${result.timestamp}`);
  } catch (error) {
    handleError(error, 'sync playlist');
  }
}

function handleStatus(flags: Record<string, string | boolean>): void {
  const status = getCacheStatus();

  if (flags.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log('\n=== Cache Status ===\n');

  if (!status.exists) {
    console.log('Cache:      Not initialized');
    console.log('\nRun "npx tsx cli/sync.ts all" to create the cache.');
    return;
  }

  console.log(`Cache:      ${getCacheFilePath()}`);
  console.log(`Last Sync:  ${status.lastSynced}`);
  console.log(`Playlists:  ${status.playlistCount}`);
  console.log(`Videos:     ${status.totalVideos}`);
}

function handleLocal(flags: Record<string, string | boolean>): void {
  const playlists = getLocalPlaylists();

  if (flags.json) {
    console.log(JSON.stringify(playlists, null, 2));
    return;
  }

  console.log(`\n=== Local Playlists (${playlists.length}) ===`);

  if (playlists.length === 0) {
    console.log('\nNo playlists in cache. Run "npx tsx cli/sync.ts all" first.');
    return;
  }

  for (const playlist of playlists) {
    formatPlaylist(playlist);
  }
}

function handleLocalPlaylist(playlistId: string, flags: Record<string, string | boolean>): void {
  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  const playlist = getLocalPlaylist(playlistId);

  if (!playlist) {
    console.error(`Playlist not found in local cache: ${playlistId}`);
    process.exit(1);
  }

  if (flags.json) {
    console.log(JSON.stringify(playlist, null, 2));
    return;
  }

  console.log('\n=== Local Playlist ===');
  formatPlaylist(playlist);

  console.log(`\n  Videos (${playlist.items.length}):`);
  for (let i = 0; i < playlist.items.length; i++) {
    formatVideo(playlist.items[i], i);
  }
}

async function handleDiff(flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  console.log('\nComparing local cache with YouTube...\n');

  try {
    const diff = await comparePlaylists();

    if (flags.json) {
      console.log(JSON.stringify(diff, null, 2));
      return;
    }

    console.log('=== Playlist Differences ===\n');

    if (!diff.hasChanges) {
      console.log('No changes detected. Local cache is up to date.');
      return;
    }

    if (diff.playlists.added.length > 0) {
      console.log('Added playlists:');
      for (const title of diff.playlists.added) {
        console.log(`  + ${title}`);
      }
      console.log();
    }

    if (diff.playlists.removed.length > 0) {
      console.log('Removed playlists:');
      for (const title of diff.playlists.removed) {
        console.log(`  - ${title}`);
      }
      console.log();
    }

    if (diff.playlists.modified.length > 0) {
      console.log('Modified playlists:');
      for (const title of diff.playlists.modified) {
        console.log(`  ~ ${title}`);
      }
      console.log();
    }

    if (flags.verbose && diff.items.length > 0) {
      console.log('Details:');
      for (const item of diff.items) {
        const symbol = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : '~';
        console.log(`  ${symbol} ${item.playlistTitle}: ${item.details}`);
      }
    }

    console.log('\nRun "npx tsx cli/sync.ts all" to update the local cache.');
  } catch (error) {
    handleError(error, 'compare playlists');
  }
}

async function handleDiffItems(playlistId: string, flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  console.log(`\nComparing videos in playlist: ${playlistId}...\n`);

  try {
    const diff = await comparePlaylistItems(playlistId);

    if (flags.json) {
      console.log(JSON.stringify(diff, null, 2));
      return;
    }

    console.log('=== Video Differences ===\n');

    if (diff.added.length === 0 && diff.removed.length === 0 && !diff.reordered) {
      console.log('No changes detected.');
      return;
    }

    if (diff.added.length > 0) {
      console.log(`Added videos (${diff.added.length}):`);
      for (const item of diff.added) {
        console.log(`  + ${item.title}`);
      }
      console.log();
    }

    if (diff.removed.length > 0) {
      console.log(`Removed videos (${diff.removed.length}):`);
      for (const item of diff.removed) {
        console.log(`  - ${item.title}`);
      }
      console.log();
    }

    if (diff.reordered) {
      console.log('Note: Videos have been reordered.\n');
    }
  } catch (error) {
    handleError(error, 'compare playlist items');
  }
}

function handleClear(): void {
  clearCache();
  console.log('\nLocal cache cleared.');
}

function handleError(error: unknown, operation: string): never {
  if (error instanceof PlaylistError) {
    console.error(`\nError (${error.type}): ${error.message}`);

    if (error.type === 'AUTH_EXPIRED' || error.type === 'AUTH_REQUIRED') {
      console.error('\nPlease re-authenticate with: npx tsx cli/auth.ts login');
    }
  } else {
    console.error(`\nFailed to ${operation}:`, error);
  }
  process.exit(1);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { flags, positional } = parseArgs(args);
  const command = positional[0];

  if (!command || command === '--help' || command === '-h' || flags.help) {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'all':
      await handleSyncAll(flags);
      break;

    case 'playlist':
      await handleSyncPlaylist(positional[1], flags);
      break;

    case 'status':
      handleStatus(flags);
      break;

    case 'local':
      if (positional[1]) {
        handleLocalPlaylist(positional[1], flags);
      } else {
        handleLocal(flags);
      }
      break;

    case 'diff':
      await handleDiff(flags);
      break;

    case 'diff-items':
      await handleDiffItems(positional[1], flags);
      break;

    case 'clear':
      handleClear();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
