#!/usr/bin/env npx tsx
// saved-videos.ts - Manage saved YouTube videos

import {
  loadSavedVideosData,
  saveSavedVideosData,
  findVideoById,
  findTopicByIdOrName,
  findThematicByIdOrName,
  getVideosForTopic,
  getVideosForThematic,
  getUnassignedVideos,
  extractVideoId,
  resolveVideoInfo,
  parseArgs,
  getPositionalArgs,
  formatOutput,
  printStatus,
  printUsage,
  SavedVideo,
  SavedVideosData
} from './video-library-client.js';

// ============================================================================
// Actions
// ============================================================================

function listVideos(
  data: SavedVideosData,
  options: {
    topic?: string;
    thematic?: string;
    unassigned?: boolean;
    sort?: string;
    json?: boolean;
  }
): void {
  let videos: SavedVideo[];

  if (options.unassigned) {
    videos = getUnassignedVideos(data);
  } else if (options.topic) {
    const topic = findTopicByIdOrName(data, options.topic);
    if (!topic) {
      printStatus(`Topic not found: ${options.topic}`, 'ERROR');
      process.exit(1);
    }
    videos = getVideosForTopic(data, topic.id);
  } else if (options.thematic) {
    const thematic = findThematicByIdOrName(data, options.thematic);
    if (!thematic) {
      printStatus(`Thematic not found: ${options.thematic}`, 'ERROR');
      process.exit(1);
    }
    videos = getVideosForThematic(data, thematic.id);
  } else {
    videos = data.videos;
  }

  // Sort videos
  const sortField = options.sort || 'addedAt';
  videos = [...videos].sort((a, b) => {
    switch (sortField) {
      case 'priority':
        const pA = a.metadata.priority ?? Number.MAX_VALUE;
        const pB = b.metadata.priority ?? Number.MAX_VALUE;
        return pA - pB;
      case 'title':
        return a.title.localeCompare(b.title);
      case 'addedAt':
      default:
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
  });

  if (videos.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2));
    } else {
      printStatus('No videos found', 'INFO');
    }
    return;
  }

  const result = videos.map(video => {
    // Build labels with their thematics
    const labels = video.topicIds
      .map(tid => {
        const topic = data.topics.find(t => t.id === tid);
        if (topic) {
          const thematic = topic.thematicId
            ? data.thematics.find(th => th.id === topic.thematicId)?.name
            : null;
          return {
            name: topic.name,
            thematic: thematic || '(uncategorized)'
          };
        }
        return null;
      })
      .filter(Boolean);

    return {
      id: video.id,
      title: video.title,
      url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
      channelName: video.channelName,
      channelHandle: video.channelHandle,
      duration: video.duration || '',
      durationSeconds: video.durationSeconds,
      category: video.category,
      isShort: video.isShort,
      views: video.views || '',
      viewCount: video.viewCount,
      likes: video.likes,
      likeCount: video.likeCount,
      labels,
      priority: video.metadata.priority,
      reportPath: video.reportPath,
      addedAt: video.addedAt
    };
  });

  formatOutput(result, options.json);
}

async function addVideo(
  data: SavedVideosData,
  videoInput: string,
  options: {
    topic?: string | string[];
    notes?: string;
    priority?: string;
    resolve?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const videoId = extractVideoId(videoInput);

  // Check for duplicate
  const existing = findVideoById(data, videoId);
  if (existing) {
    printStatus(`Video already saved: ${existing.title}`, 'ERROR');
    process.exit(1);
  }

  // Resolve topic IDs
  const topicIds: string[] = [];
  const topicInputs = options.topic
    ? (Array.isArray(options.topic) ? options.topic : [options.topic])
    : [];

  for (const topicInput of topicInputs) {
    const topic = findTopicByIdOrName(data, topicInput);
    if (!topic) {
      printStatus(`Topic not found: ${topicInput}`, 'ERROR');
      process.exit(1);
    }
    if (!topicIds.includes(topic.id)) {
      topicIds.push(topic.id);
    }
  }

  // Create video entry
  let video: SavedVideo;

  if (options.resolve) {
    printStatus(`Resolving video info for: ${videoId}`, 'INFO');
    try {
      const info = await resolveVideoInfo(videoId);
      video = {
        // Core fields
        id: videoId,
        title: info.title,
        url: info.url,
        addedAt: new Date().toISOString(),
        topicIds,
        notes: options.notes,
        metadata: {
          priority: options.priority ? parseInt(options.priority, 10) : undefined
        },

        // Channel information
        channelId: info.channelId,
        channelName: info.channelName,
        channelHandle: info.channelHandle,

        // Video content metadata
        description: info.description,
        duration: info.duration,
        durationSeconds: info.durationSeconds,
        publishedAt: info.publishedAt,
        category: info.category,
        keywords: info.keywords,
        isShort: info.isShort,

        // Engagement statistics
        views: info.views,
        viewCount: info.viewCount,
        likes: info.likes,
        likeCount: info.likeCount,

        // Media
        thumbnailUrl: info.thumbnailUrl
      };
    } catch (error) {
      printStatus(`Failed to resolve video info: ${error}`, 'ERROR');
      process.exit(1);
    }
  } else {
    video = {
      id: videoId,
      title: `Video ${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      channelId: '',
      channelName: '',
      addedAt: new Date().toISOString(),
      topicIds,
      notes: options.notes,
      metadata: {
        priority: options.priority ? parseInt(options.priority, 10) : undefined
      }
    };
  }

  data.videos.push(video);
  saveSavedVideosData(data);

  const topicNames = topicIds
    .map(tid => data.topics.find(t => t.id === tid)?.name)
    .filter(Boolean);

  printStatus(`Saved video: ${video.title}`, 'OK');
  if (topicNames.length > 0) {
    printStatus(`Topics: ${topicNames.join(', ')}`, 'INFO');
  }

  if (options.json) {
    console.log(JSON.stringify(video, null, 2));
  }
}

function removeVideo(
  data: SavedVideosData,
  videoId: string,
  options: { json?: boolean }
): void {
  const extractedId = extractVideoId(videoId);
  const video = findVideoById(data, extractedId);

  if (!video) {
    printStatus(`Video not found: ${extractedId}`, 'ERROR');
    process.exit(1);
  }

  data.videos = data.videos.filter(v => v.id !== extractedId);
  saveSavedVideosData(data);

  printStatus(`Removed video: ${video.title}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify(video, null, 2));
  }
}

function getVideo(
  data: SavedVideosData,
  videoId: string,
  options: { json?: boolean }
): void {
  const extractedId = extractVideoId(videoId);
  const video = findVideoById(data, extractedId);

  if (!video) {
    printStatus(`Video not found: ${extractedId}`, 'ERROR');
    process.exit(1);
  }

  // Build labels with their thematics
  const labels = video.topicIds
    .map(tid => {
      const topic = data.topics.find(t => t.id === tid);
      if (topic) {
        const thematic = topic.thematicId
          ? data.thematics.find(t => t.id === topic.thematicId)?.name
          : null;
        return {
          name: topic.name,
          thematic: thematic || '(uncategorized)'
        };
      }
      return null;
    })
    .filter(Boolean);

  const result = {
    // Core fields
    id: video.id,
    title: video.title,
    url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
    addedAt: video.addedAt,

    // Channel information
    channelId: video.channelId,
    channelName: video.channelName,
    channelHandle: video.channelHandle,

    // Video content metadata
    description: video.description || '',
    duration: video.duration || '',
    durationSeconds: video.durationSeconds,
    publishedAt: video.publishedAt || '',
    category: video.category,
    keywords: video.keywords,
    isShort: video.isShort,

    // Engagement statistics
    views: video.views || '',
    viewCount: video.viewCount,
    likes: video.likes,
    likeCount: video.likeCount,

    // Media
    thumbnailUrl: video.thumbnailUrl || '',

    // User data
    labels,
    notes: video.notes || '',
    metadata: video.metadata,
    reportPath: video.reportPath
  };

  formatOutput(result, options.json);
}

function updateVideo(
  data: SavedVideosData,
  videoId: string,
  options: {
    addTopic?: string | string[];
    removeTopic?: string | string[];
    notes?: string;
    priority?: string;
    json?: boolean;
  }
): void {
  const extractedId = extractVideoId(videoId);
  const video = findVideoById(data, extractedId);

  if (!video) {
    printStatus(`Video not found: ${extractedId}`, 'ERROR');
    process.exit(1);
  }

  // Add topics
  const addTopicInputs = options.addTopic
    ? (Array.isArray(options.addTopic) ? options.addTopic : [options.addTopic])
    : [];

  for (const topicInput of addTopicInputs) {
    const topic = findTopicByIdOrName(data, topicInput);
    if (!topic) {
      printStatus(`Topic not found: ${topicInput}`, 'ERROR');
      process.exit(1);
    }
    if (!video.topicIds.includes(topic.id)) {
      video.topicIds.push(topic.id);
      printStatus(`Added topic: ${topic.name}`, 'INFO');
    }
  }

  // Remove topics
  const removeTopicInputs = options.removeTopic
    ? (Array.isArray(options.removeTopic) ? options.removeTopic : [options.removeTopic])
    : [];

  for (const topicInput of removeTopicInputs) {
    const topic = findTopicByIdOrName(data, topicInput);
    if (!topic) {
      printStatus(`Topic not found: ${topicInput}`, 'WARN');
      continue;
    }
    if (video.topicIds.includes(topic.id)) {
      video.topicIds = video.topicIds.filter(tid => tid !== topic.id);
      printStatus(`Removed topic: ${topic.name}`, 'INFO');
    }
  }

  // Update notes
  if (options.notes !== undefined) {
    video.notes = options.notes || undefined;
    printStatus('Updated notes', 'INFO');
  }

  // Update priority
  if (options.priority !== undefined) {
    video.metadata.priority = parseInt(options.priority, 10);
    printStatus(`Updated priority: ${video.metadata.priority}`, 'INFO');
  }

  saveSavedVideosData(data);

  printStatus(`Updated video: ${video.title}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify(video, null, 2));
  }
}

function searchVideos(
  data: SavedVideosData,
  query: string,
  options: {
    in?: string;
    json?: boolean;
  }
): void {
  const searchIn = options.in || 'all';
  const lowerQuery = query.toLowerCase();

  const results = data.videos.filter(video => {
    const matchTitle = video.title.toLowerCase().includes(lowerQuery);
    const matchNotes = video.notes?.toLowerCase().includes(lowerQuery) || false;
    const matchDescription = video.description?.toLowerCase().includes(lowerQuery) || false;

    switch (searchIn) {
      case 'title':
        return matchTitle;
      case 'notes':
        return matchNotes;
      case 'all':
      default:
        return matchTitle || matchNotes || matchDescription;
    }
  });

  if (results.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2));
    } else {
      printStatus(`No videos found matching: ${query}`, 'INFO');
    }
    return;
  }

  printStatus(`Found ${results.length} video(s) matching: ${query}`, 'OK');

  const output = results.map(video => {
    // Build labels with their thematics
    const labels = video.topicIds
      .map(tid => {
        const topic = data.topics.find(t => t.id === tid);
        if (topic) {
          const thematic = topic.thematicId
            ? data.thematics.find(th => th.id === topic.thematicId)?.name
            : null;
          return {
            name: topic.name,
            thematic: thematic || '(uncategorized)'
          };
        }
        return null;
      })
      .filter(Boolean);

    return {
      id: video.id,
      title: video.title,
      url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
      channelName: video.channelName,
      channelHandle: video.channelHandle,
      duration: video.duration,
      category: video.category,
      views: video.views,
      labels,
      priority: video.metadata.priority
    };
  });

  formatOutput(output, options.json);
}

// ============================================================================
// Main
// ============================================================================

function showHelp(): void {
  printUsage('saved-videos', 'Manage saved YouTube videos', [
    {
      name: 'list',
      description: 'List saved videos with optional filtering',
      options: [
        { flag: '--topic <id|name>', description: 'Filter by topic' },
        { flag: '--thematic <id|name>', description: 'Filter by thematic' },
        { flag: '--unassigned', description: 'Show only videos without topics' },
        { flag: '--sort <field>', description: 'Sort by: addedAt, priority, title' }
      ]
    },
    {
      name: 'add <video-id-or-url>',
      description: 'Save a new video',
      options: [
        { flag: '--topic <id|name>', description: 'Assign to topic (repeatable)' },
        { flag: '--notes "text"', description: 'Add personal notes' },
        { flag: '--priority <number>', description: 'Set priority/order index' },
        { flag: '--resolve', description: 'Fetch video metadata from YouTube' }
      ]
    },
    {
      name: 'remove <video-id>',
      description: 'Remove a saved video'
    },
    {
      name: 'get <video-id>',
      description: 'Get saved video details'
    },
    {
      name: 'update <video-id>',
      description: 'Update video topics, notes, or metadata',
      options: [
        { flag: '--add-topic <id|name>', description: 'Add topic (repeatable)' },
        { flag: '--remove-topic <id|name>', description: 'Remove topic (repeatable)' },
        { flag: '--notes "text"', description: 'Update notes' },
        { flag: '--priority <number>', description: 'Update priority' }
      ]
    },
    {
      name: 'search <query>',
      description: 'Search saved videos by keyword',
      options: [
        { flag: '--in <field>', description: 'Search in: title, notes, all (default: all)' }
      ]
    }
  ]);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsedArgs = parseArgs(args);
  const positional = getPositionalArgs(args);

  if (parsedArgs.help || positional.length === 0) {
    showHelp();
    process.exit(0);
  }

  const action = positional[0];
  const data = loadSavedVideosData();
  const json = parsedArgs.json === true;

  switch (action) {
    case 'list':
      listVideos(data, {
        topic: parsedArgs.topic as string | undefined,
        thematic: parsedArgs.thematic as string | undefined,
        unassigned: parsedArgs.unassigned === true,
        sort: parsedArgs.sort as string | undefined,
        json
      });
      break;

    case 'add':
      if (!positional[1]) {
        printStatus('Video ID or URL is required for add action', 'ERROR');
        process.exit(1);
      }
      await addVideo(data, positional[1], {
        topic: parsedArgs.topic as string | string[] | undefined,
        notes: parsedArgs.notes as string | undefined,
        priority: parsedArgs.priority as string | undefined,
        resolve: parsedArgs.resolve === true,
        json
      });
      break;

    case 'remove':
      if (!positional[1]) {
        printStatus('Video ID is required for remove action', 'ERROR');
        process.exit(1);
      }
      removeVideo(data, positional[1], { json });
      break;

    case 'get':
      if (!positional[1]) {
        printStatus('Video ID is required for get action', 'ERROR');
        process.exit(1);
      }
      getVideo(data, positional[1], { json });
      break;

    case 'update':
      if (!positional[1]) {
        printStatus('Video ID is required for update action', 'ERROR');
        process.exit(1);
      }
      updateVideo(data, positional[1], {
        addTopic: parsedArgs['add-topic'] as string | string[] | undefined,
        removeTopic: parsedArgs['remove-topic'] as string | string[] | undefined,
        notes: parsedArgs.notes as string | undefined,
        priority: parsedArgs.priority as string | undefined,
        json
      });
      break;

    case 'search':
      if (!positional[1]) {
        printStatus('Query is required for search action', 'ERROR');
        process.exit(1);
      }
      searchVideos(data, positional[1], {
        in: parsedArgs.in as string | undefined,
        json
      });
      break;

    default:
      printStatus(`Unknown action: ${action}`, 'ERROR');
      showHelp();
      process.exit(1);
  }
}

main().catch(error => {
  printStatus(`Error: ${error.message}`, 'ERROR');
  process.exit(1);
});
