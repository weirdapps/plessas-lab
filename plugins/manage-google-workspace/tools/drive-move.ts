#!/usr/bin/env npx tsx
/**
 * Drive Move CLI Tool
 *
 * Move a file to a different folder.
 *
 * Usage:
 *   npx tsx drive-move.ts --id "file_id" --to "folder_id"
 *
 * Options:
 *   --id, -i    File ID to move (required)
 *   --to, -t    Destination folder ID (required)
 *   --json      Output as JSON
 */

import {
  DriveClient,
  parseArgs,
  printSeparator,
} from './google-drive-client.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const fileId = args.id || args.i;
  const destinationId = args.to || args.t;
  const jsonOutput = args.json === 'true';

  if (!fileId) {
    console.error('[ERROR] --id is required');
    console.error('\nUsage: npx tsx drive-move.ts --id "file_id" --to "folder_id"');
    process.exit(1);
  }

  if (!destinationId) {
    console.error('[ERROR] --to is required');
    console.error('\nUsage: npx tsx drive-move.ts --id "file_id" --to "folder_id"');
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Drive - Move File');
    printSeparator();
    console.log(`File ID: ${fileId}`);
    console.log(`Destination: ${destinationId}`);
    printSeparator('-');
    console.log('[...] Moving file...');
  }

  try {
    const client = new DriveClient();
    const result = await client.moveFile(fileId, destinationId);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printSeparator('-');
      console.log('[OK] File moved successfully');
      console.log(`[OK] Name: ${result.name}`);
      console.log(`[OK] ID: ${result.id}`);
      console.log(`[OK] New parent: ${result.parents?.[0] || destinationId}`);
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
