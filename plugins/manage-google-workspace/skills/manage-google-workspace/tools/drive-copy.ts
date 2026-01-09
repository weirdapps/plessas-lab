#!/usr/bin/env npx tsx
/**
 * Drive Copy CLI Tool
 *
 * Copy a file, optionally with a new name or to a different folder.
 *
 * Usage:
 *   npx tsx drive-copy.ts --id "file_id" [options]
 *
 * Options:
 *   --id, -i    File ID to copy (required)
 *   --name, -n  New name for the copy
 *   --to, -t    Destination folder ID
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
  const newName = args.name || args.n;
  const destinationId = args.to || args.t;
  const jsonOutput = args.json === 'true';

  if (!fileId) {
    console.error('[ERROR] --id is required');
    console.error('\nUsage: npx tsx drive-copy.ts --id "file_id" [--name "Copy Name"] [--to "folder_id"]');
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Drive - Copy File');
    printSeparator();
    console.log(`File ID: ${fileId}`);
    if (newName) console.log(`New name: ${newName}`);
    if (destinationId) console.log(`Destination: ${destinationId}`);
    printSeparator('-');
    console.log('[...] Copying file...');
  }

  try {
    const client = new DriveClient();
    const result = await client.copyFile(fileId, newName, destinationId);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printSeparator('-');
      console.log('[OK] File copied successfully');
      console.log(`[OK] Name: ${result.name}`);
      console.log(`[OK] ID: ${result.id}`);
      console.log(`[OK] Type: ${result.mimeType}`);
      if (result.webViewLink) {
        console.log(`[OK] Link: ${result.webViewLink}`);
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

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
