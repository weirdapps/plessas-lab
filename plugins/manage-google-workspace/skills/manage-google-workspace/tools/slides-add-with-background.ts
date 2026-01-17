#!/usr/bin/env npx tsx
/**
 * Add a new slide with an image background
 *
 * This script adds a blank slide at a specific position and sets an image as its background.
 */

import {
  getSlidesService,
  parseArgs,
  printSeparator,
} from './google-drive-client.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const presentationId = args.id || args.i;
  const indexStr = args.index;
  const driveId = args['drive-id'];
  const imageUrl = args['image-url'] || args.url;
  const jsonOutput = args.json === 'true';

  if (!presentationId) {
    console.error('[ERROR] --id is required');
    printUsage();
    process.exit(1);
  }

  if (!indexStr) {
    console.error('[ERROR] --index is required (0-based position for new slide)');
    printUsage();
    process.exit(1);
  }

  // Determine image URL
  let finalImageUrl = imageUrl;
  if (driveId) {
    finalImageUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
  }

  if (!finalImageUrl) {
    console.error('[ERROR] Either --image-url or --drive-id is required');
    printUsage();
    process.exit(1);
  }

  const insertionIndex = parseInt(indexStr);
  if (isNaN(insertionIndex) || insertionIndex < 0) {
    console.error('[ERROR] --index must be a non-negative number');
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Slides - Add Slide with Background');
    printSeparator();
    console.log(`Presentation ID: ${presentationId}`);
    console.log(`Insertion Index: ${insertionIndex}`);
    console.log(`Image URL: ${finalImageUrl.substring(0, 60)}...`);
    printSeparator('-');
  }

  try {
    const service = await getSlidesService();

    // Generate unique object ID for the new slide
    const slideObjectId = `slide_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    if (!jsonOutput) console.log('[...] Creating slide with background image...');

    // Create the slide and set background in a single batch update
    await service.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          // First, create a blank slide
          {
            createSlide: {
              objectId: slideObjectId,
              insertionIndex: insertionIndex,
              slideLayoutReference: {
                predefinedLayout: 'BLANK',
              },
            },
          },
          // Then, set the background image
          {
            updatePageProperties: {
              objectId: slideObjectId,
              pageProperties: {
                pageBackgroundFill: {
                  stretchedPictureFill: {
                    contentUrl: finalImageUrl,
                  },
                },
              },
              fields: 'pageBackgroundFill',
            },
          },
        ],
      },
    });

    if (jsonOutput) {
      console.log(JSON.stringify({
        success: true,
        slideObjectId,
        insertionIndex,
        imageUrl: finalImageUrl,
      }, null, 2));
    } else {
      printSeparator('-');
      console.log('[OK] Slide created successfully');
      console.log(`  Slide ID: ${slideObjectId}`);
      console.log(`  Position: ${insertionIndex + 1} (1-based)`);
      console.log('[OK] Background image set');
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

function printUsage(): void {
  console.error('\nUsage: npx tsx slides-add-with-background.ts --id "presentation_id" --index 10 --drive-id "image_file_id"');
  console.error('\nOptions:');
  console.error('  --id              Presentation ID (required)');
  console.error('  --index           0-based insertion position (required)');
  console.error('  --drive-id        Google Drive file ID for the background image');
  console.error('  --image-url       Direct URL to the background image');
  console.error('  --json            Output as JSON');
  console.error('\nExamples:');
  console.error('  npx tsx slides-add-with-background.ts --id "abc123" --index 10 --drive-id "xyz789"');
  console.error('  npx tsx slides-add-with-background.ts --id "abc123" --index 0 --image-url "https://example.com/image.png"');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
