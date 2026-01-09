#!/usr/bin/env npx tsx
// video-thematics.ts - Manage thematics (groups) for video organization

import {
  loadSavedVideosData,
  saveSavedVideosData,
  findThematicByIdOrName,
  getTopicsForThematic,
  getVideosForThematic,
  generateUUID,
  parseArgs,
  getPositionalArgs,
  formatOutput,
  printStatus,
  printUsage,
  Thematic,
  SavedVideosData
} from './video-library-client.js';

// ============================================================================
// Actions
// ============================================================================

function listThematics(
  data: SavedVideosData,
  options: { withTopics?: boolean; withCounts?: boolean; json?: boolean }
): void {
  const thematics = data.thematics;

  if (thematics.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2));
    } else {
      printStatus('No thematics found', 'INFO');
    }
    return;
  }

  const result = thematics.map(thematic => {
    const output: Record<string, unknown> = {
      id: thematic.id,
      name: thematic.name,
      description: thematic.description || '',
      createdAt: thematic.createdAt
    };

    if (options.withCounts || options.withTopics) {
      const topics = getTopicsForThematic(data, thematic.id);
      output.topicCount = topics.length;

      if (options.withTopics) {
        output.topics = topics.map(t => ({ id: t.id, name: t.name }));
      }
    }

    if (options.withCounts) {
      const videos = getVideosForThematic(data, thematic.id);
      output.videoCount = videos.length;
    }

    return output;
  });

  formatOutput(result, options.json);
}

function addThematic(
  data: SavedVideosData,
  name: string,
  options: { description?: string; json?: boolean }
): void {
  // Check for duplicate name
  const existing = findThematicByIdOrName(data, name);
  if (existing) {
    printStatus(`Thematic "${name}" already exists`, 'ERROR');
    process.exit(1);
  }

  const thematic: Thematic = {
    id: generateUUID(),
    name,
    description: options.description,
    createdAt: new Date().toISOString()
  };

  data.thematics.push(thematic);
  saveSavedVideosData(data);

  printStatus(`Created thematic: ${name}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify(thematic, null, 2));
  }
}

function removeThematic(
  data: SavedVideosData,
  identifier: string,
  options: { json?: boolean }
): void {
  const thematic = findThematicByIdOrName(data, identifier);

  if (!thematic) {
    printStatus(`Thematic not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  // Cascade: set thematicId to null for all topics in this thematic
  const affectedTopics = getTopicsForThematic(data, thematic.id);
  for (const topic of affectedTopics) {
    topic.thematicId = null;
  }

  // Remove the thematic
  data.thematics = data.thematics.filter(t => t.id !== thematic.id);
  saveSavedVideosData(data);

  printStatus(`Removed thematic: ${thematic.name}`, 'OK');
  if (affectedTopics.length > 0) {
    printStatus(`${affectedTopics.length} topic(s) moved to uncategorized`, 'INFO');
  }

  if (options.json) {
    console.log(JSON.stringify({
      removed: thematic,
      uncategorizedTopics: affectedTopics.map(t => t.name)
    }, null, 2));
  }
}

function renameThematic(
  data: SavedVideosData,
  identifier: string,
  options: { name?: string; description?: string; json?: boolean }
): void {
  const thematic = findThematicByIdOrName(data, identifier);

  if (!thematic) {
    printStatus(`Thematic not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  if (!options.name && options.description === undefined) {
    printStatus('Must provide --name or --description to update', 'ERROR');
    process.exit(1);
  }

  const oldName = thematic.name;

  if (options.name) {
    // Check for duplicate name
    const existing = findThematicByIdOrName(data, options.name);
    if (existing && existing.id !== thematic.id) {
      printStatus(`Thematic "${options.name}" already exists`, 'ERROR');
      process.exit(1);
    }
    thematic.name = options.name;
  }

  if (options.description !== undefined) {
    thematic.description = options.description || undefined;
  }

  saveSavedVideosData(data);

  printStatus(`Updated thematic: ${oldName} -> ${thematic.name}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify(thematic, null, 2));
  }
}

function getThematic(
  data: SavedVideosData,
  identifier: string,
  options: { withTopics?: boolean; withVideos?: boolean; json?: boolean }
): void {
  const thematic = findThematicByIdOrName(data, identifier);

  if (!thematic) {
    printStatus(`Thematic not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  const topics = getTopicsForThematic(data, thematic.id);
  const videos = getVideosForThematic(data, thematic.id);

  const result: Record<string, unknown> = {
    id: thematic.id,
    name: thematic.name,
    description: thematic.description || '',
    createdAt: thematic.createdAt,
    topicCount: topics.length,
    videoCount: videos.length
  };

  if (options.withTopics) {
    result.topics = topics.map(t => ({
      id: t.id,
      name: t.name,
      videoCount: data.videos.filter(v => v.topicIds.includes(t.id)).length
    }));
  }

  if (options.withVideos) {
    result.videos = videos.map(v => ({
      id: v.id,
      title: v.title,
      topics: v.topicIds
        .map(tid => data.topics.find(t => t.id === tid)?.name)
        .filter(Boolean)
    }));
  }

  formatOutput(result, options.json);
}

// ============================================================================
// Main
// ============================================================================

function showHelp(): void {
  printUsage('video-thematics', 'Manage thematics (groups) for video organization', [
    {
      name: 'list',
      description: 'List all thematics',
      options: [
        { flag: '--with-topics', description: 'Include topics in each thematic' },
        { flag: '--with-counts', description: 'Include video counts' }
      ]
    },
    {
      name: 'add <name>',
      description: 'Create a new thematic',
      options: [
        { flag: '--description "text"', description: 'Optional description' }
      ]
    },
    {
      name: 'remove <id|name>',
      description: 'Delete a thematic (topics become uncategorized)'
    },
    {
      name: 'rename <id|name>',
      description: 'Rename a thematic or update description',
      options: [
        { flag: '--name <new-name>', description: 'New name' },
        { flag: '--description "text"', description: 'New description' }
      ]
    },
    {
      name: 'get <id|name>',
      description: 'Get thematic details',
      options: [
        { flag: '--with-topics', description: 'Include topics' },
        { flag: '--with-videos', description: 'Include all videos' }
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
      listThematics(data, {
        withTopics: parsedArgs['with-topics'] === true,
        withCounts: parsedArgs['with-counts'] === true,
        json
      });
      break;

    case 'add':
      if (!positional[1]) {
        printStatus('Name is required for add action', 'ERROR');
        process.exit(1);
      }
      addThematic(data, positional[1], {
        description: parsedArgs.description as string | undefined,
        json
      });
      break;

    case 'remove':
      if (!positional[1]) {
        printStatus('Identifier is required for remove action', 'ERROR');
        process.exit(1);
      }
      removeThematic(data, positional[1], { json });
      break;

    case 'rename':
      if (!positional[1]) {
        printStatus('Identifier is required for rename action', 'ERROR');
        process.exit(1);
      }
      renameThematic(data, positional[1], {
        name: parsedArgs.name as string | undefined,
        description: parsedArgs.description as string | undefined,
        json
      });
      break;

    case 'get':
      if (!positional[1]) {
        printStatus('Identifier is required for get action', 'ERROR');
        process.exit(1);
      }
      getThematic(data, positional[1], {
        withTopics: parsedArgs['with-topics'] === true,
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
