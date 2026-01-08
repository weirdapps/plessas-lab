#!/usr/bin/env npx tsx
/**
 * Drive Download CLI Tool
 *
 * Download a binary file from Google Drive.
 * For Google Docs/Sheets/Slides, use drive-export.ts instead.
 *
 * Usage:
 *   npx tsx drive-download.ts --id "file_id" --output "./local/path"
 *
 * Options:
 *   --id, -i       File ID (required)
 *   --output, -o   Output file path (required)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DriveClient,
  parseArgs,
  printSeparator,
  isGoogleFile,
} from './google-drive-client.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const fileId = args.id || args.i;
  const outputPath = args.output || args.o;

  if (!fileId) {
    console.error('[ERROR] --id is required');
    console.error('\nUsage: npx tsx drive-download.ts --id "file_id" --output "./file.pdf"');
    process.exit(1);
  }

  if (!outputPath) {
    console.error('[ERROR] --output is required');
    console.error('\nUsage: npx tsx drive-download.ts --id "file_id" --output "./file.pdf"');
    process.exit(1);
  }

  printSeparator();
  console.log('Google Drive - Download File');
  printSeparator();
  console.log(`File ID: ${fileId}`);
  console.log(`Output: ${outputPath}`);
  printSeparator('-');

  try {
    const client = new DriveClient();

    // First check if it's a Google file
    console.log('[...] Checking file type...');
    const file = await client.getFile(fileId);

    if (isGoogleFile(file.mimeType)) {
      console.error(`[ERROR] This is a Google Workspace file (${file.mimeType}).`);
      console.error('Use drive-export.ts instead to export to a specific format.');
      console.error('\nExample: npx tsx drive-export.ts --id "file_id" --format pdf --output "./file.pdf"');
      process.exit(1);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`[...] Downloading "${file.name}"...`);
    await client.downloadFile(fileId, outputPath);

    // Get file size
    const stats = fs.statSync(outputPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    printSeparator('-');
    console.log(`[OK] Downloaded successfully`);
    console.log(`[OK] File: ${file.name}`);
    console.log(`[OK] Saved to: ${outputPath}`);
    console.log(`[OK] Size: ${fileSizeKB} KB`);
    printSeparator();
    console.log('SUCCESS');
    printSeparator();
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
