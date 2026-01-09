#!/usr/bin/env npx tsx
/**
 * Drive Upload CLI Tool
 *
 * Upload a file to Google Drive.
 *
 * Usage:
 *   npx tsx drive-upload.ts --file "./local/path" [options]
 *
 * Options:
 *   --file, -f      Local file path (required)
 *   --name, -n      Name in Drive (defaults to local filename)
 *   --parent, -p    Parent folder ID
 *   --mime-type, -m MIME type override
 *   --json          Output as JSON
 */

import * as fs from 'node:fs';
import {
  DriveClient,
  parseArgs,
  printSeparator,
} from './google-drive-client.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const filePath = args.file || args.f;
  const name = args.name || args.n;
  const parentId = args.parent || args.p;
  const mimeType = args['mime-type'] || args.m;
  const jsonOutput = args.json === 'true';

  if (!filePath) {
    console.error('[ERROR] --file is required');
    console.error('\nUsage: npx tsx drive-upload.ts --file "./file.pdf" [--name "Custom Name"] [--parent "folder_id"]');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] File not found: ${filePath}`);
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Drive - Upload File');
    printSeparator();
    console.log(`Local file: ${filePath}`);
    if (name) console.log(`Name in Drive: ${name}`);
    if (parentId) console.log(`Parent folder: ${parentId}`);
    if (mimeType) console.log(`MIME type: ${mimeType}`);
    printSeparator('-');
    console.log('[...] Uploading file...');
  }

  try {
    const client = new DriveClient();
    const result = await client.uploadFile(filePath, {
      name,
      parentId,
      mimeType,
    });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printSeparator('-');
      console.log('[OK] Upload successful');
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
