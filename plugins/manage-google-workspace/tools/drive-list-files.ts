#!/usr/bin/env npx tsx
/**
 * Drive List Files CLI Tool
 *
 * List files from Google Drive with optional query, pagination, and ordering.
 *
 * Usage:
 *   npx tsx drive-list-files.ts [options]
 *
 * Options:
 *   --query "search query"        Drive API query string
 *   --limit 100                   Max results (default: 100)
 *   --order-by "modifiedTime desc" Sort order
 *   --json                        Output as JSON
 */

import {
  DriveClient,
  parseArgs,
  printSeparator,
  formatFileSize,
  type DriveFile,
} from './google-drive-client.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const query = args.query || args.q;
  const limit = parseInt(args.limit || args.n || '100', 10);
  const orderBy = args['order-by'] || args.order || 'modifiedTime desc';
  const jsonOutput = args.json === 'true';

  printSeparator();
  console.log('Google Drive - List Files');
  printSeparator();

  if (!jsonOutput) {
    console.log(`Query: ${query || '(all files)'}`);
    console.log(`Limit: ${limit}`);
    console.log(`Order: ${orderBy}`);
    printSeparator('-');
    console.log('[...] Fetching files...');
  }

  try {
    const client = new DriveClient();
    const files = await client.listFiles({
      query,
      pageSize: limit,
      orderBy,
    });

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
  if (file.webViewLink) {
    console.log(`  Link: ${file.webViewLink}`);
  }
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
