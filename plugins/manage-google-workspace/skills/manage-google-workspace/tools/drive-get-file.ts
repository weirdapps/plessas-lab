#!/usr/bin/env npx tsx
/**
 * Drive Get File CLI Tool
 *
 * Get detailed metadata for a specific file by ID.
 *
 * Usage:
 *   npx tsx drive-get-file.ts --id "file_id"
 *
 * Options:
 *   --id, -i       File ID (required)
 *   --json         Output as JSON
 */

import {
  DriveClient,
  parseArgs,
  printSeparator,
  formatFileSize,
} from './google-drive-client.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const fileId = args.id || args.i;
  const jsonOutput = args.json === 'true';

  if (!fileId) {
    console.error('[ERROR] --id is required');
    console.error('\nUsage: npx tsx drive-get-file.ts --id "file_id"');
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Drive - Get File');
    printSeparator();
    console.log(`File ID: ${fileId}`);
    printSeparator('-');
    console.log('[...] Fetching file metadata...');
  }

  try {
    const client = new DriveClient();
    const file = await client.getFile(fileId);

    if (jsonOutput) {
      console.log(JSON.stringify(file, null, 2));
    } else {
      printSeparator('-');
      console.log('[OK] File found');
      printSeparator('-');

      console.log(`\nName: ${file.name}`);
      console.log(`ID: ${file.id}`);
      console.log(`Type: ${file.mimeType}`);

      if (file.size) {
        console.log(`Size: ${formatFileSize(file.size)}`);
      }

      if (file.createdTime) {
        console.log(`Created: ${new Date(file.createdTime).toLocaleString()}`);
      }

      if (file.modifiedTime) {
        console.log(`Modified: ${new Date(file.modifiedTime).toLocaleString()}`);
      }

      if (file.owners && file.owners.length > 0) {
        console.log(`Owner: ${file.owners[0].emailAddress || file.owners[0].displayName}`);
      }

      if (file.parents && file.parents.length > 0) {
        console.log(`Parent Folder IDs: ${file.parents.join(', ')}`);
      }

      if (file.description) {
        console.log(`Description: ${file.description}`);
      }

      if (file.webViewLink) {
        console.log(`Link: ${file.webViewLink}`);
      }

      console.log(`Trashed: ${file.trashed ? 'Yes' : 'No'}`);

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

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
