#!/usr/bin/env npx tsx
// Get channel information from YouTube
// Usage: npx tsx channel-info.ts --channel <channel_id_or_handle> [--detailed] [--json]

import {
  getClient,
  ChannelInfo,
  ChannelAboutInfo,
  parseArgs,
  formatOutput,
  printStatus,
  printUsage
} from './youtube-client.js';

async function getChannelInfo(channelId: string): Promise<ChannelInfo> {
  const client = await getClient();
  const channel = await client.getChannel(channelId);

  const metadata = channel.metadata as any;
  const header = channel.header as any;

  // Extract subscriber and video counts from header
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

  // Extract handle
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

async function getChannelAboutInfo(channelId: string): Promise<ChannelAboutInfo> {
  const client = await getClient();
  const channel = await client.getChannel(channelId);

  const metadata = channel.metadata as any;
  const header = channel.header as any;

  // Get detailed info from About tab
  const aboutTab = await channel.getAbout();
  const about = aboutTab as any;
  const aboutMeta = about?.metadata || {};

  // Extract handle
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

  // Extract joined date
  let joinedDate = '';
  if (aboutMeta.joined_date) {
    joinedDate = typeof aboutMeta.joined_date === 'string'
      ? aboutMeta.joined_date
      : aboutMeta.joined_date.text || '';
  }

  return {
    id: channelId,
    name: metadata.title || '',
    handle: handle,
    subscriberCount: aboutMeta.subscriber_count || '',
    videoCount: aboutMeta.video_count || '',
    viewCount: aboutMeta.view_count || '',
    joinedDate: joinedDate,
    country: aboutMeta.country || '',
    description: metadata.description || '',
    thumbnailUrl: metadata.thumbnail?.[0]?.url || metadata.avatar?.[0]?.url || '',
    bannerUrl: metadata.banner?.[0]?.url || '',
  };
}

async function resolveChannelHandle(handleOrUrl: string): Promise<string> {
  // If it's already a channel ID (starts with UC), return it
  if (handleOrUrl.startsWith('UC') && handleOrUrl.length === 24) {
    return handleOrUrl;
  }

  // Normalize the handle
  let handle = handleOrUrl;

  // Extract handle from URL if needed
  const urlMatch = handleOrUrl.match(/youtube\.com\/@([^\/\?]+)/);
  if (urlMatch) {
    handle = `@${urlMatch[1]}`;
  } else if (!handle.startsWith('@')) {
    handle = `@${handle}`;
  }

  const client = await getClient();

  // Search for the channel to get the channel ID
  const searchResults = await client.search(handle, { type: 'channel' });

  if (searchResults.channels && searchResults.channels.length > 0) {
    const channelResult = searchResults.channels[0] as any;
    if (channelResult.id) {
      return channelResult.id;
    }
  }

  // Fallback: try resolveURL
  try {
    const resolved = await client.resolveURL(`https://www.youtube.com/${handle}`);
    if (resolved.payload?.browseId) {
      return resolved.payload.browseId;
    }
  } catch (e) {
    // resolveURL failed
  }

  throw new Error(`Could not resolve channel handle: ${handleOrUrl}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printUsage('channel-info', [
      { flag: '--channel <id_or_handle>', description: 'Channel ID, handle (@username), or URL', required: true },
      { flag: '--detailed', description: 'Get detailed info from About tab' },
    ]);
    process.exit(0);
  }

  const channelArg = args['channel'] as string;

  if (!channelArg) {
    printStatus('--channel is required', 'ERROR');
    printUsage('channel-info', [
      { flag: '--channel <id_or_handle>', description: 'Channel ID, handle (@username), or URL', required: true },
      { flag: '--detailed', description: 'Get detailed info from About tab' },
    ]);
    process.exit(1);
  }

  try {
    printStatus(`Resolving channel: ${channelArg}...`);
    const channelId = await resolveChannelHandle(channelArg);
    printStatus(`Channel ID: ${channelId}`, 'OK');

    let info: ChannelInfo | ChannelAboutInfo;

    if (args['detailed']) {
      printStatus('Fetching detailed channel info...');
      info = await getChannelAboutInfo(channelId);
    } else {
      printStatus('Fetching channel info...');
      info = await getChannelInfo(channelId);
    }

    printStatus('Channel info retrieved', 'OK');
    formatOutput(info, args['json'] as boolean);
  } catch (error) {
    printStatus((error as Error).message, 'ERROR');
    process.exit(1);
  }
}

main();
