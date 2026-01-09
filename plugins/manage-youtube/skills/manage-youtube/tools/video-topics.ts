#!/usr/bin/env npx tsx
// video-topics.ts - Manage topics (labels) for video organization

import {
  loadSavedVideosData,
  saveSavedVideosData,
  findTopicByIdOrName,
  findThematicByIdOrName,
  getVideosForTopic,
  getUncategorizedTopics,
  getTopicsForThematic,
  generateUUID,
  parseArgs,
  getPositionalArgs,
  formatOutput,
  printStatus,
  printUsage,
  Topic,
  SavedVideosData
} from './video-library-client.js';

// ============================================================================
// Actions
// ============================================================================

function listTopics(
  data: SavedVideosData,
  options: {
    thematic?: string;
    uncategorized?: boolean;
    withCounts?: boolean;
    json?: boolean;
  }
): void {
  let topics: Topic[];

  if (options.uncategorized) {
    topics = getUncategorizedTopics(data);
  } else if (options.thematic) {
    const thematic = findThematicByIdOrName(data, options.thematic);
    if (!thematic) {
      printStatus(`Thematic not found: ${options.thematic}`, 'ERROR');
      process.exit(1);
    }
    topics = getTopicsForThematic(data, thematic.id);
  } else {
    topics = data.topics;
  }

  if (topics.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2));
    } else {
      printStatus('No topics found', 'INFO');
    }
    return;
  }

  const result = topics.map(topic => {
    const thematic = topic.thematicId
      ? data.thematics.find(t => t.id === topic.thematicId)
      : null;

    const output: Record<string, unknown> = {
      id: topic.id,
      name: topic.name,
      thematic: thematic ? thematic.name : '(uncategorized)',
      thematicId: topic.thematicId,
      createdAt: topic.createdAt
    };

    if (options.withCounts) {
      const videos = getVideosForTopic(data, topic.id);
      output.videoCount = videos.length;
    }

    return output;
  });

  formatOutput(result, options.json);
}

function addTopic(
  data: SavedVideosData,
  name: string,
  options: { thematic?: string; json?: boolean }
): void {
  // Check for duplicate name
  const existing = findTopicByIdOrName(data, name);
  if (existing) {
    printStatus(`Topic "${name}" already exists`, 'ERROR');
    process.exit(1);
  }

  let thematicId: string | null = null;

  if (options.thematic) {
    const thematic = findThematicByIdOrName(data, options.thematic);
    if (!thematic) {
      printStatus(`Thematic not found: ${options.thematic}`, 'ERROR');
      process.exit(1);
    }
    thematicId = thematic.id;
  }

  const topic: Topic = {
    id: generateUUID(),
    name,
    thematicId,
    createdAt: new Date().toISOString()
  };

  data.topics.push(topic);
  saveSavedVideosData(data);

  const thematicName = thematicId
    ? data.thematics.find(t => t.id === thematicId)?.name
    : 'uncategorized';

  printStatus(`Created topic: ${name} (${thematicName})`, 'OK');

  if (options.json) {
    console.log(JSON.stringify(topic, null, 2));
  }
}

function removeTopic(
  data: SavedVideosData,
  identifier: string,
  options: { json?: boolean }
): void {
  const topic = findTopicByIdOrName(data, identifier);

  if (!topic) {
    printStatus(`Topic not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  // Cascade: remove topic from all videos
  const affectedVideos = getVideosForTopic(data, topic.id);
  for (const video of affectedVideos) {
    video.topicIds = video.topicIds.filter(id => id !== topic.id);
  }

  // Count videos that became uncategorized
  const newlyUncategorized = affectedVideos.filter(v => v.topicIds.length === 0);

  // Remove the topic
  data.topics = data.topics.filter(t => t.id !== topic.id);
  saveSavedVideosData(data);

  printStatus(`Removed topic: ${topic.name}`, 'OK');
  if (affectedVideos.length > 0) {
    printStatus(`Topic removed from ${affectedVideos.length} video(s)`, 'INFO');
  }
  if (newlyUncategorized.length > 0) {
    printStatus(`${newlyUncategorized.length} video(s) now uncategorized`, 'INFO');
  }

  if (options.json) {
    console.log(JSON.stringify({
      removed: topic,
      affectedVideos: affectedVideos.map(v => v.id),
      newlyUncategorized: newlyUncategorized.map(v => v.id)
    }, null, 2));
  }
}

function renameTopic(
  data: SavedVideosData,
  identifier: string,
  options: { name?: string; json?: boolean }
): void {
  const topic = findTopicByIdOrName(data, identifier);

  if (!topic) {
    printStatus(`Topic not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  if (!options.name) {
    printStatus('Must provide --name to rename', 'ERROR');
    process.exit(1);
  }

  // Check for duplicate name
  const existing = findTopicByIdOrName(data, options.name);
  if (existing && existing.id !== topic.id) {
    printStatus(`Topic "${options.name}" already exists`, 'ERROR');
    process.exit(1);
  }

  const oldName = topic.name;
  topic.name = options.name;

  saveSavedVideosData(data);

  printStatus(`Renamed topic: ${oldName} -> ${topic.name}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify(topic, null, 2));
  }
}

function moveTopic(
  data: SavedVideosData,
  identifier: string,
  options: { thematic?: string; json?: boolean }
): void {
  const topic = findTopicByIdOrName(data, identifier);

  if (!topic) {
    printStatus(`Topic not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  let newThematicId: string | null = null;
  let newThematicName = 'uncategorized';

  if (options.thematic) {
    const thematic = findThematicByIdOrName(data, options.thematic);
    if (!thematic) {
      printStatus(`Thematic not found: ${options.thematic}`, 'ERROR');
      process.exit(1);
    }
    newThematicId = thematic.id;
    newThematicName = thematic.name;
  }

  const oldThematic = topic.thematicId
    ? data.thematics.find(t => t.id === topic.thematicId)?.name || 'unknown'
    : 'uncategorized';

  topic.thematicId = newThematicId;

  saveSavedVideosData(data);

  printStatus(`Moved topic "${topic.name}": ${oldThematic} -> ${newThematicName}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify(topic, null, 2));
  }
}

function getTopic(
  data: SavedVideosData,
  identifier: string,
  options: { withVideos?: boolean; json?: boolean }
): void {
  const topic = findTopicByIdOrName(data, identifier);

  if (!topic) {
    printStatus(`Topic not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  const thematic = topic.thematicId
    ? data.thematics.find(t => t.id === topic.thematicId)
    : null;

  const videos = getVideosForTopic(data, topic.id);

  const result: Record<string, unknown> = {
    id: topic.id,
    name: topic.name,
    thematic: thematic ? thematic.name : '(uncategorized)',
    thematicId: topic.thematicId,
    createdAt: topic.createdAt,
    videoCount: videos.length
  };

  if (options.withVideos) {
    result.videos = videos.map(v => ({
      id: v.id,
      title: v.title,
      priority: v.metadata.priority,
      addedAt: v.addedAt
    }));
  }

  formatOutput(result, options.json);
}

// ============================================================================
// Main
// ============================================================================

function showHelp(): void {
  printUsage('video-topics', 'Manage topics (labels) for video organization', [
    {
      name: 'list',
      description: 'List all topics',
      options: [
        { flag: '--thematic <id|name>', description: 'Filter by thematic' },
        { flag: '--uncategorized', description: 'Show only topics without thematic' },
        { flag: '--with-counts', description: 'Include video counts' }
      ]
    },
    {
      name: 'add <name>',
      description: 'Create a new topic',
      options: [
        { flag: '--thematic <id|name>', description: 'Assign to thematic' }
      ]
    },
    {
      name: 'remove <id|name>',
      description: 'Delete a topic (videos lose this topic)'
    },
    {
      name: 'rename <id|name>',
      description: 'Rename a topic',
      options: [
        { flag: '--name <new-name>', description: 'New name', required: true }
      ]
    },
    {
      name: 'move <id|name>',
      description: 'Move topic to different thematic',
      options: [
        { flag: '--thematic <id|name>', description: 'Target thematic (omit for uncategorized)' }
      ]
    },
    {
      name: 'get <id|name>',
      description: 'Get topic details',
      options: [
        { flag: '--with-videos', description: 'Include list of videos' }
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
      listTopics(data, {
        thematic: parsedArgs.thematic as string | undefined,
        uncategorized: parsedArgs.uncategorized === true,
        withCounts: parsedArgs['with-counts'] === true,
        json
      });
      break;

    case 'add':
      if (!positional[1]) {
        printStatus('Name is required for add action', 'ERROR');
        process.exit(1);
      }
      addTopic(data, positional[1], {
        thematic: parsedArgs.thematic as string | undefined,
        json
      });
      break;

    case 'remove':
      if (!positional[1]) {
        printStatus('Identifier is required for remove action', 'ERROR');
        process.exit(1);
      }
      removeTopic(data, positional[1], { json });
      break;

    case 'rename':
      if (!positional[1]) {
        printStatus('Identifier is required for rename action', 'ERROR');
        process.exit(1);
      }
      renameTopic(data, positional[1], {
        name: parsedArgs.name as string | undefined,
        json
      });
      break;

    case 'move':
      if (!positional[1]) {
        printStatus('Identifier is required for move action', 'ERROR');
        process.exit(1);
      }
      moveTopic(data, positional[1], {
        thematic: parsedArgs.thematic as string | undefined,
        json
      });
      break;

    case 'get':
      if (!positional[1]) {
        printStatus('Identifier is required for get action', 'ERROR');
        process.exit(1);
      }
      getTopic(data, positional[1], {
        withVideos: parsedArgs['with-videos'] === true,
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
