#!/usr/bin/env npx tsx
/**
 * Add Hyperlinks to Text in Google Slides
 *
 * This script adds hyperlinks to specific text within a slide.
 */

import {
  getSlidesService,
  parseArgs,
  printSeparator,
} from './google-drive-client.js';
import { slides_v1 } from 'googleapis';

interface TextLink {
  text: string;
  url: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const presentationId = args.id || args.i;
  const slideNumberStr = args['slide-number'];
  const linksJson = args.links;
  const jsonOutput = args.json === 'true';
  const dryRun = args['dry-run'] === 'true';

  if (!presentationId) {
    console.error('[ERROR] --id is required');
    printUsage();
    process.exit(1);
  }

  if (!slideNumberStr) {
    console.error('[ERROR] --slide-number is required');
    printUsage();
    process.exit(1);
  }

  if (!linksJson) {
    console.error('[ERROR] --links is required (JSON array of {text, url} objects)');
    printUsage();
    process.exit(1);
  }

  const slideNumber = parseInt(slideNumberStr);
  if (isNaN(slideNumber) || slideNumber < 1) {
    console.error('[ERROR] --slide-number must be a positive number');
    process.exit(1);
  }

  let links: TextLink[];
  try {
    links = JSON.parse(linksJson);
  } catch (e) {
    console.error('[ERROR] --links must be valid JSON');
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Slides - Add Hyperlinks');
    printSeparator();
    console.log(`Presentation ID: ${presentationId}`);
    console.log(`Slide Number: ${slideNumber}`);
    console.log(`Links to add: ${links.length}`);
    if (dryRun) console.log('[INFO] Dry run mode - no changes will be made');
    printSeparator('-');
  }

  try {
    const service = await getSlidesService();

    // Get full presentation data
    if (!jsonOutput) console.log('[...] Fetching presentation data...');

    const response = await service.presentations.get({ presentationId });
    const presentation = response.data;
    const slides = presentation.slides || [];

    if (slideNumber > slides.length) {
      console.error(`[ERROR] Slide ${slideNumber} not found. Presentation has ${slides.length} slides.`);
      process.exit(1);
    }

    const slide = slides[slideNumber - 1];
    const requests: slides_v1.Schema$Request[] = [];
    const results: { text: string; url: string; found: boolean; objectId?: string }[] = [];

    // Find each text and create link requests
    for (const link of links) {
      let found = false;

      for (const element of slide.pageElements || []) {
        if (!element.shape?.text?.textElements) continue;

        const objectId = element.objectId;
        let fullText = '';
        const textRanges: { startIndex: number; endIndex: number; content: string }[] = [];

        // Build full text and track ranges
        for (const textElement of element.shape.text.textElements) {
          if (textElement.textRun?.content) {
            const startIndex = textElement.startIndex || 0;
            const endIndex = textElement.endIndex || startIndex + textElement.textRun.content.length;
            textRanges.push({
              startIndex,
              endIndex,
              content: textElement.textRun.content,
            });
            fullText += textElement.textRun.content;
          }
        }

        // Search for the link text in the full text
        const searchText = link.text;
        const foundIndex = fullText.indexOf(searchText);

        if (foundIndex !== -1) {
          // Calculate the actual indices within the text element
          let currentPos = 0;
          let startInElement = 0;
          let endInElement = 0;

          for (const range of textRanges) {
            const rangeLen = range.content.length;
            const rangeStart = currentPos;
            const rangeEnd = currentPos + rangeLen;

            // Check if the search text starts in this range
            if (foundIndex >= rangeStart && foundIndex < rangeEnd) {
              startInElement = range.startIndex + (foundIndex - rangeStart);
            }

            // Check if the search text ends in this range
            const searchEndPos = foundIndex + searchText.length;
            if (searchEndPos > rangeStart && searchEndPos <= rangeEnd) {
              endInElement = range.startIndex + (searchEndPos - rangeStart);
            }

            currentPos = rangeEnd;
          }

          if (startInElement > 0 || endInElement > 0) {
            found = true;

            if (!jsonOutput) {
              console.log(`[OK] Found "${searchText}" in element ${objectId} at ${startInElement}-${endInElement}`);
            }

            requests.push({
              updateTextStyle: {
                objectId: objectId!,
                textRange: {
                  type: 'FIXED_RANGE',
                  startIndex: startInElement,
                  endIndex: endInElement,
                },
                style: {
                  link: {
                    url: link.url,
                  },
                },
                fields: 'link',
              },
            });

            results.push({ text: link.text, url: link.url, found: true, objectId });
            break;
          }
        }
      }

      if (!found) {
        if (!jsonOutput) {
          console.log(`[WARN] Text "${link.text}" not found in slide ${slideNumber}`);
        }
        results.push({ text: link.text, url: link.url, found: false });
      }
    }

    // Apply the link requests
    if (requests.length > 0 && !dryRun) {
      if (!jsonOutput) {
        printSeparator('-');
        console.log(`[...] Applying ${requests.length} hyperlink(s)...`);
      }

      await service.presentations.batchUpdate({
        presentationId,
        requestBody: { requests },
      });

      if (!jsonOutput) {
        console.log(`[OK] Applied ${requests.length} hyperlink(s)`);
      }
    }

    // Output results
    if (jsonOutput) {
      console.log(JSON.stringify({
        presentationId,
        slideNumber,
        linksRequested: links.length,
        linksApplied: requests.length,
        results,
        dryRun,
      }, null, 2));
    } else {
      printSeparator();
      const appliedCount = results.filter(r => r.found).length;
      const notFoundCount = results.filter(r => !r.found).length;
      if (dryRun) {
        console.log(`DRY RUN COMPLETE - ${appliedCount} link(s) would be applied, ${notFoundCount} not found`);
      } else {
        console.log(`SUCCESS - ${appliedCount} link(s) applied, ${notFoundCount} not found`);
      }
      printSeparator();
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] ${errorMessage}`);
    process.exit(1);
  }
}

function printUsage(): void {
  console.error('\nUsage: npx tsx slides-add-links.ts --id "presentation_id" --slide-number 2 --links \'[{"text":"PEE 172/1","url":"https://..."}]\'');
  console.error('\nOptions:');
  console.error('  --id              Presentation ID (required)');
  console.error('  --slide-number    Slide number 1-based (required)');
  console.error('  --links           JSON array of {text, url} objects (required)');
  console.error('  --dry-run         Preview changes without applying');
  console.error('  --json            Output as JSON');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
