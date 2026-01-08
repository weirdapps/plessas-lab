#!/usr/bin/env npx tsx
/**
 * Drive Export CLI Tool
 *
 * Export Google Docs/Sheets/Slides to various formats.
 *
 * Usage:
 *   npx tsx drive-export.ts --id "file_id" --format "pdf" --output "./file.pdf"
 *
 * Options:
 *   --id, -i       File ID (required)
 *   --format, -f   Export format (required): pdf, docx, txt, html, xlsx, csv, pptx
 *   --output, -o   Output file path (required)
 *
 * Supported formats:
 *   Google Docs: pdf, docx, txt, html, odt, rtf, epub
 *   Google Sheets: pdf, xlsx, csv, ods, tsv
 *   Google Slides: pdf, pptx, odp
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DriveClient,
  parseArgs,
  printSeparator,
  EXPORT_FORMATS,
  isGoogleFile,
} from './google-drive-client.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const fileId = args.id || args.i;
  const format = (args.format || args.f || '').toLowerCase();
  const outputPath = args.output || args.o;

  if (!fileId) {
    console.error('[ERROR] --id is required');
    printUsage();
    process.exit(1);
  }

  if (!format) {
    console.error('[ERROR] --format is required');
    printUsage();
    process.exit(1);
  }

  if (!outputPath) {
    console.error('[ERROR] --output is required');
    printUsage();
    process.exit(1);
  }

  const mimeType = EXPORT_FORMATS[format];
  if (!mimeType) {
    console.error(`[ERROR] Unknown format: ${format}`);
    console.error(`Supported formats: ${Object.keys(EXPORT_FORMATS).join(', ')}`);
    process.exit(1);
  }

  printSeparator();
  console.log('Google Drive - Export File');
  printSeparator();
  console.log(`File ID: ${fileId}`);
  console.log(`Format: ${format} (${mimeType})`);
  console.log(`Output: ${outputPath}`);
  printSeparator('-');

  try {
    const client = new DriveClient();

    // Check if it's a Google file
    console.log('[...] Checking file type...');
    const file = await client.getFile(fileId);

    if (!isGoogleFile(file.mimeType)) {
      console.error(`[ERROR] This is not a Google Workspace file (${file.mimeType}).`);
      console.error('Use drive-download.ts for regular files.');
      process.exit(1);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`[...] Exporting "${file.name}" as ${format.toUpperCase()}...`);
    await client.exportGoogleFile(fileId, mimeType, outputPath);

    // Get file size
    const stats = fs.statSync(outputPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    printSeparator('-');
    console.log(`[OK] Exported successfully`);
    console.log(`[OK] Source: ${file.name}`);
    console.log(`[OK] Format: ${format.toUpperCase()}`);
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

function printUsage(): void {
  console.error('\nUsage: npx tsx drive-export.ts --id "file_id" --format "pdf" --output "./file.pdf"');
  console.error('\nSupported formats:');
  console.error('  Google Docs: pdf, docx, txt, html, odt, rtf, epub');
  console.error('  Google Sheets: pdf, xlsx, csv, ods, tsv');
  console.error('  Google Slides: pdf, pptx, odp');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
