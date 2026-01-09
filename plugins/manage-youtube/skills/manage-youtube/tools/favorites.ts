#!/usr/bin/env npx tsx
// Manage favorite YouTube channels list
// Usage:
//   npx tsx favorites.ts --action list [--json]
//   npx tsx favorites.ts --action add --channels "@channel1,@channel2" [--resolve]
//   npx tsx favorites.ts --action remove --channels "@channel1,@channel2"
//   npx tsx favorites.ts --action get --channel "@channel1" [--json]
//   npx tsx favorites.ts --action clear

import * as fs from 'fs';
import * as path from 'path';
import {
  getClient,
  ChannelInfo,
  parseArgs,
  formatOutput,
  printStatus,
  printUsage
} from './youtube-client.js';

// Data directory for YouTube skill data
const DATA_DIR = path.join(process.env.HOME || '~', '.google-skills', 'youtube');
const FAVORITES_FILE = path.join(DATA_DIR, 'favorite-channels.json');

export interface FavoriteChannel {
  id: string;           // Channel ID (UC...)
  handle: string;       // Handle (@username)
  name: string;         // Display name
  addedAt: string;      // ISO date string
  subscriberCount?: string;
  videoCount?: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface FavoritesData {
  version: string;
  lastUpdated: string;
  channels: FavoriteChannel[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFavorites(): FavoritesData {
  ensureDataDir();

  if (!fs.existsSync(FAVORITES_FILE)) {
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      channels: []
    };
  }

  try {
    const content = fs.readFileSync(FAVORITES_FILE, 'utf-8');
    return JSON.parse(content) as FavoritesData;
  } catch (error) {
    printStatus(`Error reading favorites file: ${(error as Error).message}`, 'WARN');
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      channels: []
    };
  }
}

function saveFavorites(data: FavoritesData): void {
  ensureDataDir();
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2));
}

async function resolveChannelHandle(handleOrUrl: string): Promise<string> {
  if (handleOrUrl.startsWith('UC') && handleOrUrl.length === 24) {
    return handleOrUrl;
  }

  let handle = handleOrUrl;
  const urlMatch = handleOrUrl.match(/youtube\.com\/@([^\/\?]+)/);
  if (urlMatch) {
    handle = `@${urlMatch[1]}`;
  } else if (!handle.startsWith('@')) {
    handle = `@${handle}`;
  }

  const client = await getClient();
  const searchResults = await client.search(handle, { type: 'channel' });

  if (searchResults.channels && searchResults.channels.length > 0) {
    const channelResult = searchResults.channels[0] as any;
    if (channelResult.id) {
      return channelResult.id;
    }
  }

  throw new Error(`Could not resolve channel handle: ${handleOrUrl}`);
}

async function getChannelInfo(channelId: string): Promise<ChannelInfo> {
  const client = await getClient();
  const channel = await client.getChannel(channelId);

  const metadata = channel.metadata as any;
  const header = channel.header as any;

  let subscriberCount = '';
  let videoCount = '';

  try {
    const metadataRows = header?.content?.metadata?.metadata_rows;
    if (metadataRows && metadataRows.length > 1) {
      const statsRow = metadataRows[1];
      if (statsRow?.metadata_parts) {
        if (statsRow.metadata_parts[0]?.text?.text) {
          subscriberCount = statsRow.metadata_parts[0].text.text;
        }
        if (statsRow.metadata_parts[1]?.text?.text) {
          videoCount = statsRow.metadata_parts[1].text.text;
        }
      }
    }
  } catch (e) {
    // Counts remain empty
  }

  let handle = metadata.vanity_channel_url || '';
  try {
    const handleRow = header?.content?.metadata?.metadata_rows?.[0];
    if (handleRow?.metadata_parts?.[0]?.text?.text) {
      const handleText = handleRow.metadata_parts[0].text.text;
      if (handleText.startsWith('@')) {
        handle = handleText;
      }
    }
  } catch (e) {
    // Use fallback
  }

  return {
    id: channelId,
    name: metadata.title || '',
    handle: handle,
    subscriberCount: subscriberCount,
    videoCount: videoCount,
    description: metadata.description || '',
    thumbnailUrl: metadata.thumbnail?.[0]?.url || metadata.avatar?.[0]?.url || '',
    bannerUrl: metadata.banner?.[0]?.url || '',
  };
}

async function listFavorites(json: boolean): Promise<void> {
  const data = loadFavorites();

  if (data.channels.length === 0) {
    printStatus('No favorite channels found', 'INFO');
    if (json) {
      console.log(JSON.stringify({ channels: [], count: 0 }, null, 2));
    }
    return;
  }

  printStatus(`Found ${data.channels.length} favorite channel(s)`, 'OK');

  if (json) {
    console.log(JSON.stringify({
      channels: data.channels,
      count: data.channels.length,
      lastUpdated: data.lastUpdated
    }, null, 2));
  } else {
    console.log('\n=== Favorite Channels ===\n');
    data.channels.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel.name}`);
      console.log(`   Handle: ${channel.handle}`);
      console.log(`   ID: ${channel.id}`);
      if (channel.subscriberCount) {
        console.log(`   Subscribers: ${channel.subscriberCount}`);
      }
      console.log(`   Added: ${new Date(channel.addedAt).toLocaleDateString()}`);
      console.log('');
    });
  }
}

async function addFavorites(channelsArg: string, resolve: boolean): Promise<void> {
  const channels = channelsArg.split(',').map(c => c.trim()).filter(c => c.length > 0);

  if (channels.length === 0) {
    printStatus('No channels provided', 'ERROR');
    return;
  }

  const data = loadFavorites();
  const added: FavoriteChannel[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const channelInput of channels) {
    try {
      printStatus(`Processing: ${channelInput}...`);

      let channelId: string;
      let channelInfo: ChannelInfo | null = null;

      if (resolve) {
        // Resolve and fetch full info
        channelId = await resolveChannelHandle(channelInput);
        channelInfo = await getChannelInfo(channelId);
      } else {
        // Just resolve the ID
        channelId = await resolveChannelHandle(channelInput);
        // Try to get info, but don't fail if it doesn't work
        try {
          channelInfo = await getChannelInfo(channelId);
        } catch (e) {
          // Use minimal info
        }
      }

      // Check if already exists
      const exists = data.channels.some(c => c.id === channelId);
      if (exists) {
        printStatus(`Already in favorites: ${channelInput}`, 'WARN');
        skipped.push(channelInput);
        continue;
      }

      // Create favorite entry
      const favorite: FavoriteChannel = {
        id: channelId,
        handle: channelInfo?.handle || channelInput,
        name: channelInfo?.name || channelInput,
        addedAt: new Date().toISOString(),
        subscriberCount: channelInfo?.subscriberCount,
        videoCount: channelInfo?.videoCount,
        description: channelInfo?.description?.substring(0, 200),
        thumbnailUrl: channelInfo?.thumbnailUrl,
      };

      data.channels.push(favorite);
      added.push(favorite);
      printStatus(`Added: ${favorite.name} (${favorite.handle})`, 'OK');

    } catch (error) {
      printStatus(`Failed to add ${channelInput}: ${(error as Error).message}`, 'ERROR');
      failed.push(channelInput);
    }
  }

  if (added.length > 0) {
    saveFavorites(data);
    printStatus(`Successfully added ${added.length} channel(s)`, 'OK');
  }

  if (skipped.length > 0) {
    printStatus(`Skipped ${skipped.length} (already in favorites)`, 'INFO');
  }

  if (failed.length > 0) {
    printStatus(`Failed to add ${failed.length} channel(s)`, 'WARN');
  }
}

async function removeFavorites(channelsArg: string): Promise<void> {
  const channels = channelsArg.split(',').map(c => c.trim()).filter(c => c.length > 0);

  if (channels.length === 0) {
    printStatus('No channels provided', 'ERROR');
    return;
  }

  const data = loadFavorites();
  const removed: string[] = [];
  const notFound: string[] = [];

  for (const channelInput of channels) {
    // Normalize handle
    let handle = channelInput;
    const urlMatch = channelInput.match(/youtube\.com\/@([^\/\?]+)/);
    if (urlMatch) {
      handle = `@${urlMatch[1]}`;
    } else if (!handle.startsWith('@') && !handle.startsWith('UC')) {
      handle = `@${handle}`;
    }

    // Find by handle, ID, or name (case-insensitive)
    const index = data.channels.findIndex(c =>
      c.id === channelInput ||
      c.handle.toLowerCase() === handle.toLowerCase() ||
      c.name.toLowerCase() === channelInput.toLowerCase()
    );

    if (index === -1) {
      printStatus(`Not found in favorites: ${channelInput}`, 'WARN');
      notFound.push(channelInput);
      continue;
    }

    const channel = data.channels[index];
    data.channels.splice(index, 1);
    removed.push(channel.name);
    printStatus(`Removed: ${channel.name} (${channel.handle})`, 'OK');
  }

  if (removed.length > 0) {
    saveFavorites(data);
    printStatus(`Successfully removed ${removed.length} channel(s)`, 'OK');
  }

  if (notFound.length > 0) {
    printStatus(`${notFound.length} channel(s) not found in favorites`, 'INFO');
  }
}

async function getFavorite(channelInput: string, json: boolean): Promise<void> {
  const data = loadFavorites();

  // Normalize handle
  let handle = channelInput;
  const urlMatch = channelInput.match(/youtube\.com\/@([^\/\?]+)/);
  if (urlMatch) {
    handle = `@${urlMatch[1]}`;
  } else if (!handle.startsWith('@') && !handle.startsWith('UC')) {
    handle = `@${handle}`;
  }

  // Find by handle, ID, or name
  const channel = data.channels.find(c =>
    c.id === channelInput ||
    c.handle.toLowerCase() === handle.toLowerCase() ||
    c.name.toLowerCase() === channelInput.toLowerCase()
  );

  if (!channel) {
    printStatus(`Channel not found in favorites: ${channelInput}`, 'ERROR');
    process.exit(1);
  }

  printStatus(`Found favorite channel`, 'OK');
  formatOutput(channel, json);
}

async function clearFavorites(): Promise<void> {
  const data = loadFavorites();
  const count = data.channels.length;

  if (count === 0) {
    printStatus('No favorites to clear', 'INFO');
    return;
  }

  data.channels = [];
  saveFavorites(data);
  printStatus(`Cleared ${count} favorite channel(s)`, 'OK');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printUsage('favorites', [
      { flag: '--action <action>', description: 'Action: list, add, remove, get, clear', required: true },
      { flag: '--channels <list>', description: 'Comma-separated channel handles/IDs (for add/remove)' },
      { flag: '--channel <id>', description: 'Single channel handle/ID (for get)' },
      { flag: '--resolve', description: 'Fetch full channel info when adding' },
    ]);
    console.log('\nExamples:');
    console.log('  npx tsx favorites.ts --action list --json');
    console.log('  npx tsx favorites.ts --action add --channels "@channel1,@channel2" --resolve');
    console.log('  npx tsx favorites.ts --action remove --channels "@channel1,channel2"');
    console.log('  npx tsx favorites.ts --action get --channel "@channel1" --json');
    console.log('  npx tsx favorites.ts --action clear');
    process.exit(0);
  }

  const action = args['action'] as string;

  if (!action) {
    printStatus('--action is required', 'ERROR');
    printUsage('favorites', [
      { flag: '--action <action>', description: 'Action: list, add, remove, get, clear', required: true },
      { flag: '--channels <list>', description: 'Comma-separated channel handles/IDs (for add/remove)' },
      { flag: '--channel <id>', description: 'Single channel handle/ID (for get)' },
      { flag: '--resolve', description: 'Fetch full channel info when adding' },
    ]);
    process.exit(1);
  }

  try {
    switch (action) {
      case 'list':
        await listFavorites(args['json'] as boolean);
        break;

      case 'add':
        const addChannels = args['channels'] as string;
        if (!addChannels) {
          printStatus('--channels is required for add action', 'ERROR');
          process.exit(1);
        }
        await addFavorites(addChannels, args['resolve'] as boolean);
        break;

      case 'remove':
        const removeChannels = args['channels'] as string;
        if (!removeChannels) {
          printStatus('--channels is required for remove action', 'ERROR');
          process.exit(1);
        }
        await removeFavorites(removeChannels);
        break;

      case 'get':
        const getChannel = args['channel'] as string;
        if (!getChannel) {
          printStatus('--channel is required for get action', 'ERROR');
          process.exit(1);
        }
        await getFavorite(getChannel, args['json'] as boolean);
        break;

      case 'clear':
        await clearFavorites();
        break;

      default:
        printStatus(`Unknown action: ${action}. Use list, add, remove, get, or clear`, 'ERROR');
        process.exit(1);
    }
  } catch (error) {
    printStatus((error as Error).message, 'ERROR');
    process.exit(1);
  }
}

main();
