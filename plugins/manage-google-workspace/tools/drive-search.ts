#!/usr/bin/env npx tsx
/**
 * Drive Search CLI Tool
 *
 * Search for files with various filters.
 *
 * Usage:
 *   npx tsx drive-search.ts --type "docs" --name "report"
 *
 * Options:
 *   --type, -t      File type: docs, sheets, slides, folders, all (default: all)
 *   --name, -n      Search by name (contains match)
 *   --exact         Use exact name match instead of contains
 *   --in-folder     Search in specific folder ID
 *   --shared        Show files shared with me
 *   --recent        Show files modified in last N days
 *   --full-text     Full text search
 *   --by-owner      Find files by owner email address
 *   --query, -q     Custom Drive API query
 *   --limit         Max results (default: 100)
 *   --json          Output as JSON
 */

import {
  DriveClient,
  parseArgs,
  printSeparator,
  formatFileSize,
  type DriveFile,
} from './google-drive-client.js';

type SearchType = 'docs' | 'sheets' | 'slides' | 'folders' | 'all';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const type = (args.type || args.t || 'all') as SearchType;
  const name = args.name || args.n;
  const exact = args.exact === 'true';
  const inFolder = args['in-folder'];
  const shared = args.shared === 'true';
  const recent = args.recent ? parseInt(args.recent, 10) : undefined;
  const fullText = args['full-text'];
  const byOwner = args['by-owner'];
  const customQuery = args.query || args.q;
  const limit = parseInt(args.limit || '100', 10);
  const jsonOutput = args.json === 'true';

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Drive - Search');
    printSeparator();
    console.log(`Type: ${type}`);
    if (name) console.log(`Name: ${name}${exact ? ' (exact)' : ''}`);
    if (inFolder) console.log(`In folder: ${inFolder}`);
    if (shared) console.log(`Shared with me: Yes`);
    if (recent) console.log(`Recent: ${recent} days`);
    if (fullText) console.log(`Full text: ${fullText}`);
    if (byOwner) console.log(`By owner: ${byOwner}`);
    if (customQuery) console.log(`Custom query: ${customQuery}`);
    console.log(`Limit: ${limit}`);
    printSeparator('-');
    console.log('[...] Searching...');
  }

  try {
    const client = new DriveClient();
    let files: DriveFile[] = [];

    // Execute search based on parameters
    if (customQuery) {
      files = await client.search(customQuery);
    } else if (inFolder) {
      files = await client.findInFolder(inFolder);
    } else if (shared) {
      files = await client.findSharedWithMe();
    } else if (recent) {
      files = await client.findRecent(recent);
    } else if (fullText) {
      files = await client.fullTextSearch(fullText);
    } else if (byOwner) {
      files = await client.findFilesByOwner(byOwner);
    } else if (name) {
      // Search by name with type filter
      switch (type) {
        case 'docs':
          files = await client.findDocs(name);
          break;
        case 'sheets':
          files = await client.findSheets(name);
          break;
        case 'slides':
          files = await client.findSlides(name);
          break;
        case 'folders':
          files = await client.findFolders(name);
          break;
        default:
          files = await client.findByName(name, exact);
      }
    } else {
      // Just type filter
      switch (type) {
        case 'docs':
          files = await client.findDocs();
          break;
        case 'sheets':
          files = await client.findSheets();
          break;
        case 'slides':
          files = await client.findSlides();
          break;
        case 'folders':
          files = await client.findFolders();
          break;
        default:
          files = await client.listFiles({ pageSize: limit });
      }
    }

    // Apply limit
    files = files.slice(0, limit);

    if (jsonOutput) {
      console.log(JSON.stringify(files, null, 2));
    } else {
      printSeparator('-');
      console.log(`[OK] Found ${files.length} file(s)`);
      printSeparator('-');

      if (files.length === 0) {
        console.log('No files found.');
      } else {
        for (const file of files) {
          printFileInfo(file);
        }
      }

      printSeparator();
      console.log('SUCCESS');
      printSeparator();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] ${errorMessage}`);
    process.exit(1);
  }
}

function printFileInfo(file: DriveFile): void {
  console.log(`\nName: ${file.name}`);
  console.log(`  ID: ${file.id}`);
  console.log(`  Type: ${file.mimeType}`);
  if (file.size) {
    console.log(`  Size: ${formatFileSize(file.size)}`);
  }
  if (file.modifiedTime) {
    console.log(`  Modified: ${new Date(file.modifiedTime).toLocaleString()}`);
  }
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
