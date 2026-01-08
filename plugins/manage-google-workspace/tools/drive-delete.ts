#!/usr/bin/env npx tsx
/**
 * Drive Delete CLI Tool
 *
 * Delete, trash, or restore a file.
 *
 * Usage:
 *   npx tsx drive-delete.ts --id "file_id" [options]
 *
 * Options:
 *   --id, -i       File ID (required)
 *   --permanent    Permanently delete (default: move to trash)
 *   --restore      Restore from trash instead of deleting
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
  const permanent = args.permanent === 'true';
  const restore = args.restore === 'true';

  if (!fileId) {
    console.error('[ERROR] --id is required');
    console.error('\nUsage:');
    console.error('  Trash:     npx tsx drive-delete.ts --id "file_id"');
    console.error('  Delete:    npx tsx drive-delete.ts --id "file_id" --permanent');
    console.error('  Restore:   npx tsx drive-delete.ts --id "file_id" --restore');
    process.exit(1);
  }

  printSeparator();
  console.log('Google Drive - Delete/Restore File');
  printSeparator();
  console.log(`File ID: ${fileId}`);
  console.log(`Action: ${restore ? 'Restore' : permanent ? 'Permanent Delete' : 'Move to Trash'}`);
  printSeparator('-');

  try {
    const client = new DriveClient();

    if (restore) {
      console.log('[...] Restoring file from trash...');
      await client.restoreFile(fileId);
      printSeparator('-');
      console.log('[OK] File restored from trash');
    } else if (permanent) {
      console.log('[...] Permanently deleting file...');
      await client.deleteFile(fileId, true);
      printSeparator('-');
      console.log('[OK] File permanently deleted');
    } else {
      console.log('[...] Moving file to trash...');
      await client.deleteFile(fileId, false);
      printSeparator('-');
      console.log('[OK] File moved to trash');
    }

    console.log(`[OK] File ID: ${fileId}`);
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
