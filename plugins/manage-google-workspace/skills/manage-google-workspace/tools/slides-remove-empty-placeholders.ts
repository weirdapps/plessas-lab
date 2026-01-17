#!/usr/bin/env npx tsx
/**
 * Remove Empty Placeholders from Google Slides
 *
 * This script identifies and removes empty placeholder shapes from a presentation.
 * Empty placeholders are shapes with placeholder properties that contain no text content.
 */

import {
  getSlidesService,
  parseArgs,
  printSeparator,
} from './google-drive-client.js';
import { slides_v1 } from 'googleapis';

interface EmptyPlaceholder {
  slideNumber: number;
  slideObjectId: string;
  elementId: string;
  placeholderType: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const presentationId = args.id || args.i;
  const dryRun = args['dry-run'] === 'true';
  const jsonOutput = args.json === 'true';

  if (!presentationId) {
    console.error('[ERROR] --id is required');
    console.error('\nUsage: npx tsx slides-remove-empty-placeholders.ts --id "presentation_id" [--dry-run true] [--json true]');
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Slides - Remove Empty Placeholders');
    printSeparator();
    console.log(`Presentation ID: ${presentationId}`);
    if (dryRun) console.log('[INFO] Dry run mode - no changes will be made');
    printSeparator('-');
  }

  try {
    const service = await getSlidesService();

    // Get full presentation data
    if (!jsonOutput) console.log('[...] Fetching presentation data...');

    const response = await service.presentations.get({ presentationId });
    const presentation = response.data;

    if (!jsonOutput) {
      console.log(`[OK] Presentation: ${presentation.title}`);
      console.log(`[INFO] Total slides: ${presentation.slides?.length || 0}`);
    }

    // Find empty placeholders
    const emptyPlaceholders: EmptyPlaceholder[] = [];

    for (let slideIdx = 0; slideIdx < (presentation.slides?.length || 0); slideIdx++) {
      const slide = presentation.slides![slideIdx];
      const slideNumber = slideIdx + 1;
      const slideObjectId = slide.objectId || '';

      for (const element of slide.pageElements || []) {
        // Check if this is a placeholder shape
        if (element.shape?.placeholder) {
          const placeholderType = element.shape.placeholder.type || 'UNKNOWN';
          const elementId = element.objectId || '';

          // Check if the placeholder has any text content
          let hasContent = false;

          if (element.shape.text?.textElements) {
            for (const textElement of element.shape.text.textElements) {
              if (textElement.textRun?.content) {
                const content = textElement.textRun.content.trim();
                if (content.length > 0) {
                  hasContent = true;
                  break;
                }
              }
            }
          }

          if (!hasContent) {
            emptyPlaceholders.push({
              slideNumber,
              slideObjectId,
              elementId,
              placeholderType,
            });
          }
        }
      }
    }

    if (!jsonOutput) {
      printSeparator('-');
      console.log(`[INFO] Found ${emptyPlaceholders.length} empty placeholder(s)`);

      if (emptyPlaceholders.length > 0) {
        for (const placeholder of emptyPlaceholders) {
          console.log(`  - Slide ${placeholder.slideNumber}: ${placeholder.placeholderType} (${placeholder.elementId})`);
        }
      }
    }

    // Delete empty placeholders if not in dry run mode
    if (emptyPlaceholders.length > 0 && !dryRun) {
      if (!jsonOutput) {
        printSeparator('-');
        console.log('[...] Removing empty placeholders...');
      }

      // Create delete requests for all empty placeholders
      const requests: slides_v1.Schema$Request[] = emptyPlaceholders.map(placeholder => ({
        deleteObject: {
          objectId: placeholder.elementId,
        },
      }));

      await service.presentations.batchUpdate({
        presentationId,
        requestBody: { requests },
      });

      if (!jsonOutput) {
        console.log(`[OK] Removed ${emptyPlaceholders.length} empty placeholder(s)`);
      }
    }

    // Output results
    if (jsonOutput) {
      console.log(JSON.stringify({
        presentationId,
        title: presentation.title,
        emptyPlaceholdersFound: emptyPlaceholders.length,
        emptyPlaceholders: emptyPlaceholders,
        removed: !dryRun && emptyPlaceholders.length > 0,
        dryRun,
      }, null, 2));
    } else {
      printSeparator();
      if (dryRun) {
        console.log(`DRY RUN COMPLETE - ${emptyPlaceholders.length} placeholder(s) would be removed`);
      } else if (emptyPlaceholders.length > 0) {
        console.log('SUCCESS - Empty placeholders removed');
      } else {
        console.log('SUCCESS - No empty placeholders found');
      }
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
