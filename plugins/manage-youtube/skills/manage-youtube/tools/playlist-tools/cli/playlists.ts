#!/usr/bin/env npx tsx
// CLI Tool for YouTube Playlist Operations

import {
  listPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  listPlaylistItems,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  extractVideoId,
  getAuthStatus,
} from '../src/index.js';
import { PlaylistError } from '../src/types/index.js';
import type { Playlist, PlaylistItem, PlaylistPrivacy } from '../src/types/index.js';

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
YouTube Playlist Tools - Playlists CLI

Usage: npx tsx cli/playlists.ts <command> [options]

Commands:
  list                              List all your playlists
  get <playlist-id>                 Get details of a specific playlist
  create                            Create a new playlist
  update <playlist-id>              Update a playlist
  delete <playlist-id>              Delete a playlist
  videos <playlist-id>              List videos in a playlist
  add-video <playlist-id> <video>   Add a video to a playlist
  remove-video <item-id>            Remove a video from a playlist

Options:
  --json                    Output as JSON
  --title <title>           Playlist title (for create/update)
  --description <desc>      Playlist description (for create/update)
  --privacy <value>         Privacy: public, private, unlisted (for create/update)
  --video <id-or-url>       Video ID or URL (alternative to positional for add-video)
  --position <number>       Position in playlist (for add-video)
  --confirm                 Skip confirmation prompts (for delete)

Examples:
  npx tsx cli/playlists.ts list
  npx tsx cli/playlists.ts list --json
  npx tsx cli/playlists.ts get PLxxxxxxxxxxxxxxxx
  npx tsx cli/playlists.ts create --title "My Playlist" --privacy private
  npx tsx cli/playlists.ts update PLxxxxxxxx --title "New Title"
  npx tsx cli/playlists.ts delete PLxxxxxxxx --confirm
  npx tsx cli/playlists.ts videos PLxxxxxxxx
  npx tsx cli/playlists.ts add-video PLxxxxxxxx dQw4w9WgXcQ
  npx tsx cli/playlists.ts add-video PLxxxxxxxx https://youtube.com/watch?v=dQw4w9WgXcQ
  npx tsx cli/playlists.ts add-video PLxxxxxxxx dQw4w9WgXcQ --position 0
  npx tsx cli/playlists.ts remove-video PLxxxxxxxxxx
`);
}

function checkAuth(): void {
  const status = getAuthStatus();
  if (!status.isAuthenticated) {
    console.error('Not authenticated. Run "npx tsx cli/auth.ts login" first.');
    process.exit(1);
  }
}

function formatPlaylist(playlist: Playlist): void {
  console.log(`\n  ID:          ${playlist.id}`);
  console.log(`  Title:       ${playlist.title}`);
  console.log(`  Description: ${playlist.description || '(none)'}`);
  console.log(`  Videos:      ${playlist.itemCount}`);
  console.log(`  Privacy:     ${playlist.privacy}`);
  console.log(`  Channel:     ${playlist.channelTitle}`);
  console.log(`  Published:   ${playlist.publishedAt}`);
}

function formatPlaylistItem(item: PlaylistItem, index: number): void {
  console.log(`\n  [${index + 1}] ${item.title}`);
  console.log(`      Video ID:  ${item.videoId}`);
  console.log(`      Channel:   ${item.videoOwnerChannelTitle || item.channelTitle}`);
  console.log(`      Position:  ${item.position}`);
  console.log(`      Item ID:   ${item.id}`);
}

// ============================================================================
// Commands
// ============================================================================

async function handleList(flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  try {
    const playlists = await listPlaylists(100);

    if (flags.json) {
      console.log(JSON.stringify(playlists, null, 2));
      return;
    }

    console.log(`\n=== Your Playlists (${playlists.length}) ===`);

    if (playlists.length === 0) {
      console.log('\nNo playlists found.');
      return;
    }

    for (const playlist of playlists) {
      formatPlaylist(playlist);
    }
  } catch (error) {
    handleError(error, 'list playlists');
  }
}

async function handleGet(playlistId: string, flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  try {
    const playlist = await getPlaylist(playlistId);

    if (flags.json) {
      console.log(JSON.stringify(playlist, null, 2));
      return;
    }

    console.log('\n=== Playlist Details ===');
    formatPlaylist(playlist);
  } catch (error) {
    handleError(error, 'get playlist');
  }
}

async function handleCreate(flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  const title = flags.title as string;
  if (!title) {
    console.error('Error: --title is required');
    process.exit(1);
  }

  const description = flags.description as string | undefined;
  const privacy = flags.privacy as PlaylistPrivacy | undefined;

  if (privacy && !['public', 'private', 'unlisted'].includes(privacy)) {
    console.error('Error: --privacy must be one of: public, private, unlisted');
    process.exit(1);
  }

  try {
    const playlist = await createPlaylist({
      title,
      description,
      privacy,
    });

    if (flags.json) {
      console.log(JSON.stringify(playlist, null, 2));
      return;
    }

    console.log('\n=== Playlist Created ===');
    formatPlaylist(playlist);
  } catch (error) {
    handleError(error, 'create playlist');
  }
}

async function handleUpdate(playlistId: string, flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  const title = flags.title as string | undefined;
  const description = flags.description as string | undefined;
  const privacy = flags.privacy as PlaylistPrivacy | undefined;

  if (!title && !description && !privacy) {
    console.error('Error: At least one of --title, --description, or --privacy is required');
    process.exit(1);
  }

  if (privacy && !['public', 'private', 'unlisted'].includes(privacy)) {
    console.error('Error: --privacy must be one of: public, private, unlisted');
    process.exit(1);
  }

  try {
    const playlist = await updatePlaylist(playlistId, {
      title,
      description,
      privacy,
    });

    if (flags.json) {
      console.log(JSON.stringify(playlist, null, 2));
      return;
    }

    console.log('\n=== Playlist Updated ===');
    formatPlaylist(playlist);
  } catch (error) {
    handleError(error, 'update playlist');
  }
}

async function handleDelete(playlistId: string, flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  if (!flags.confirm) {
    console.error('Error: Use --confirm flag to confirm deletion');
    console.error('Warning: This action cannot be undone!');
    process.exit(1);
  }

  try {
    // Get playlist info first
    const playlist = await getPlaylist(playlistId);
    await deletePlaylist(playlistId);

    console.log(`\nPlaylist "${playlist.title}" deleted successfully.`);
  } catch (error) {
    handleError(error, 'delete playlist');
  }
}

async function handleVideos(playlistId: string, flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  try {
    const [playlist, items] = await Promise.all([
      getPlaylist(playlistId),
      listPlaylistItems(playlistId, 500),
    ]);

    if (flags.json) {
      console.log(JSON.stringify({ playlist, items }, null, 2));
      return;
    }

    console.log(`\n=== Videos in "${playlist.title}" (${items.length}) ===`);

    if (items.length === 0) {
      console.log('\nNo videos in this playlist.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      formatPlaylistItem(items[i], i);
    }
  } catch (error) {
    handleError(error, 'list playlist videos');
  }
}

async function handleAddVideo(
  playlistId: string,
  videoArg: string | undefined,
  flags: Record<string, string | boolean>
): Promise<void> {
  checkAuth();

  if (!playlistId) {
    console.error('Error: Playlist ID is required');
    process.exit(1);
  }

  // Support both positional argument and --video flag
  const video = videoArg || (flags.video as string);
  if (!video) {
    console.error('Error: Video ID or URL is required');
    console.error('Usage: add-video <playlist-id> <video-id-or-url>');
    console.error('   or: add-video <playlist-id> --video <video-id-or-url>');
    process.exit(1);
  }

  const videoId = extractVideoId(video);
  const position = flags.position ? parseInt(flags.position as string, 10) : undefined;

  try {
    const item = await addVideoToPlaylist({
      playlistId,
      videoId,
      position,
    });

    if (flags.json) {
      console.log(JSON.stringify(item, null, 2));
      return;
    }

    console.log('\n=== Video Added ===');
    console.log(`\n  Title:       ${item.title}`);
    console.log(`  Video ID:    ${item.videoId}`);
    console.log(`  Position:    ${item.position}`);
    console.log(`  Item ID:     ${item.id}`);
    console.log(`\n  (Use Item ID to remove this video later)`);
  } catch (error) {
    handleError(error, 'add video');
  }
}

async function handleRemoveVideo(itemId: string, flags: Record<string, string | boolean>): Promise<void> {
  checkAuth();

  if (!itemId) {
    console.error('Error: Playlist item ID is required');
    console.error('Hint: Use "videos" command to get item IDs');
    process.exit(1);
  }

  try {
    await removeVideoFromPlaylist(itemId);

    if (!flags.json) {
      console.log('\nVideo removed successfully.');
    }
  } catch (error) {
    handleError(error, 'remove video');
  }
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
    case 'list':
      await handleList(flags);
      break;

    case 'get':
      await handleGet(positional[1], flags);
      break;

    case 'create':
      await handleCreate(flags);
      break;

    case 'update':
      await handleUpdate(positional[1], flags);
      break;

    case 'delete':
      await handleDelete(positional[1], flags);
      break;

    case 'videos':
      await handleVideos(positional[1], flags);
      break;

    case 'add-video':
      await handleAddVideo(positional[1], positional[2], flags);
      break;

    case 'remove-video':
      await handleRemoveVideo(positional[1], flags);
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
