#!/usr/bin/env npx tsx
/**
 * Slides Manage CLI Tool
 *
 * Manage Google Slides presentations.
 *
 * Usage:
 *   npx tsx slides-manage.ts --action "create" --title "My Presentation"
 *
 * Actions:
 *   create           - Create a new presentation
 *   create-with-slides - Create presentation with multiple slides
 *   get              - Get presentation metadata
 *   summary          - Get detailed presentation summary with per-slide text
 *   count            - Get slide count
 *   text             - Get text from all slides
 *   text-slide       - Get text from a specific slide
 *   add-slide        - Add a new slide
 *   delete-slide     - Delete a slide by number
 *   add-textbox      - Add a text box to a slide
 *   add-image        - Add an image to a slide
 *   set-background   - Set slide background to an image
 *   set-background-color - Set slide background to a solid color
 *   remove-empty-placeholders - Remove empty placeholders from a slide
 *   remove-all-empty-placeholders - Remove empty placeholders from all slides
 *   replace          - Replace text across the presentation
 *   get-notes        - Get speaker notes from a slide
 *   set-notes        - Set speaker notes for a slide
 *   list-elements    - List all page elements on a slide
 *   clear-textboxes  - Clear all text boxes from a slide
 *   delete-elements  - Delete specific elements by ID
 *
 * Options:
 *   --action, -a      Action to perform (required)
 *   --id, -i          Presentation ID (for most operations)
 *   --title, -t       Presentation title (for create)
 *   --slide-count     Number of slides (for create-with-slides)
 *   --slide-number    Slide number 1-based (for text-slide/delete-slide/add-textbox)
 *   --layout          Slide layout (for add-slide/create-with-slides)
 *   --index           Insertion index (for add-slide)
 *   --text            Text content (for add-textbox/set-notes)
 *   --notes           Notes text (for set-notes)
 *   --find            Text to find (for replace)
 *   --replace-with    Replacement text (for replace)
 *   --x               X position in points (for add-textbox)
 *   --y               Y position in points (for add-textbox)
 *   --width           Width in points (for add-textbox)
 *   --height          Height in points (for add-textbox)
 *   --image-url       Image URL (for add-image/set-background)
 *   --drive-id        Google Drive file ID (for add-image/set-background)
 *   --color           Hex color (for set-background-color)
 *   --element-ids     Comma-separated element IDs (for delete-elements)
 *   --json            Output as JSON
 *
 * Layouts: BLANK, TITLE, TITLE_AND_BODY, TITLE_ONLY, SECTION_HEADER, etc.
 */

import {
  SlidesClient,
  parseArgs,
  printSeparator,
  type PresentationSummary,
  type PredefinedLayout,
  type SlideTextMap,
  type ImageOptions,
} from './google-drive-client.js';

type Action =
  | 'create'
  | 'create-with-slides'
  | 'get'
  | 'summary'
  | 'count'
  | 'text'
  | 'text-slide'
  | 'add-slide'
  | 'delete-slide'
  | 'add-textbox'
  | 'add-image'
  | 'set-background'
  | 'set-background-color'
  | 'remove-empty-placeholders'
  | 'remove-all-empty-placeholders'
  | 'replace'
  | 'get-notes'
  | 'set-notes'
  | 'list-elements'
  | 'clear-textboxes'
  | 'delete-elements';

const VALID_ACTIONS: Action[] = [
  'create',
  'create-with-slides',
  'get',
  'summary',
  'count',
  'text',
  'text-slide',
  'add-slide',
  'delete-slide',
  'add-textbox',
  'add-image',
  'set-background',
  'set-background-color',
  'remove-empty-placeholders',
  'remove-all-empty-placeholders',
  'replace',
  'get-notes',
  'set-notes',
  'list-elements',
  'clear-textboxes',
  'delete-elements',
];

const VALID_LAYOUTS: PredefinedLayout[] = [
  'BLANK',
  'CAPTION_ONLY',
  'TITLE',
  'TITLE_AND_BODY',
  'TITLE_AND_TWO_COLUMNS',
  'TITLE_ONLY',
  'SECTION_HEADER',
  'SECTION_TITLE_AND_DESCRIPTION',
  'ONE_COLUMN_TEXT',
  'MAIN_POINT',
  'BIG_NUMBER',
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const action = (args.action || args.a) as Action;
  const presentationId = args.id || args.i;
  const title = args.title || args.t;
  const slideCountStr = args['slide-count'];
  const slideNumberStr = args['slide-number'];
  const layout = (args.layout || 'BLANK') as PredefinedLayout;
  const indexStr = args.index;
  const text = args.text;
  const findText = args.find;
  const replaceWith = args['replace-with'];
  const xStr = args.x;
  const yStr = args.y;
  const widthStr = args.width;
  const heightStr = args.height;
  const imageUrl = args['image-url'] || args.url;
  const driveId = args['drive-id'];
  const elementIds = args['element-ids'];
  const notesText = args.notes;
  const jsonOutput = args.json === 'true';

  if (!action) {
    console.error('[ERROR] --action is required');
    printUsage();
    process.exit(1);
  }

  if (!VALID_ACTIONS.includes(action)) {
    console.error(`[ERROR] Unknown action: ${action}`);
    printUsage();
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Slides - Manage');
    printSeparator();
    console.log(`Action: ${action}`);
    if (presentationId) console.log(`Presentation ID: ${presentationId}`);
    printSeparator('-');
  }

  try {
    const client = new SlidesClient();

    switch (action) {
      case 'create': {
        if (!title) {
          console.error('[ERROR] --title is required for create action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Creating presentation "${title}"...`);
        const result = await client.createPresentation(title);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Presentation created');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.presentationId}`);
          console.log(`  Link: https://docs.google.com/presentation/d/${result.presentationId}/edit`);
        }
        break;
      }

      case 'create-with-slides': {
        if (!title) {
          console.error('[ERROR] --title is required for create-with-slides action');
          process.exit(1);
        }
        if (!slideCountStr) {
          console.error('[ERROR] --slide-count is required for create-with-slides action');
          process.exit(1);
        }

        const slideCount = parseInt(slideCountStr);
        if (isNaN(slideCount) || slideCount < 1) {
          console.error('[ERROR] --slide-count must be a positive number');
          process.exit(1);
        }

        if (!VALID_LAYOUTS.includes(layout)) {
          console.error(`[ERROR] Invalid layout: ${layout}`);
          console.error(`Valid layouts: ${VALID_LAYOUTS.join(', ')}`);
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Creating presentation "${title}" with ${slideCount} ${layout} slides...`);
        const result = await client.createPresentationWithSlides(title, slideCount, layout);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Presentation created');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.presentationId}`);
          console.log(`  Slides: ${result.slides?.length || 0}`);
          console.log(`  Link: https://docs.google.com/presentation/d/${result.presentationId}/edit`);
        }
        break;
      }

      case 'get': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for get action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Getting presentation metadata...');
        const result = await client.getPresentation(presentationId);

        if (jsonOutput) {
          console.log(JSON.stringify({
            presentationId: result.presentationId,
            title: result.title,
            slideCount: result.slides?.length || 0,
          }, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Presentation found');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.presentationId}`);
          console.log(`  Slides: ${result.slides?.length || 0}`);
        }
        break;
      }

      case 'summary': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for summary action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Getting presentation summary...');
        const result: PresentationSummary = await client.getPresentationSummary(presentationId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Presentation Summary');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.presentationId}`);
          console.log(`  Slides: ${result.slideCount}`);
          printSeparator('-');
          for (const slide of result.slides) {
            console.log(`  Slide ${slide.slideNumber} (${slide.objectId}):`);
            const preview = slide.text.substring(0, 100).replace(/\n/g, ' ');
            console.log(`    Text: ${preview}${slide.text.length > 100 ? '...' : ''}`);
          }
        }
        break;
      }

      case 'count': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for count action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Getting slide count...');
        const result = await client.getSlideCount(presentationId);

        if (jsonOutput) {
          console.log(JSON.stringify({ slideCount: result }));
        } else {
          printSeparator('-');
          console.log('[OK] Slide count');
          console.log(`  Total slides: ${result}`);
        }
        break;
      }

      case 'text': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for text action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Extracting text from all slides...');
        const result: SlideTextMap = await client.getSlideText(presentationId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Extracted text from ${Object.keys(result).length} slide(s)`);
          for (const [slideNum, slideText] of Object.entries(result)) {
            printSeparator('-');
            console.log(`Slide ${slideNum}:`);
            console.log(slideText || '(empty)');
          }
        }
        break;
      }

      case 'text-slide': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for text-slide action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for text-slide action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Getting text from slide ${slideNumber}...`);
        const result = await client.getSlideTextByNumber(presentationId, slideNumber);

        if (jsonOutput) {
          console.log(JSON.stringify({ slideNumber, text: result }));
        } else {
          printSeparator('-');
          console.log(`[OK] Text from slide ${slideNumber}`);
          printSeparator('-');
          console.log(result || '(empty)');
        }
        break;
      }

      case 'add-slide': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for add-slide action');
          process.exit(1);
        }

        if (!VALID_LAYOUTS.includes(layout)) {
          console.error(`[ERROR] Invalid layout: ${layout}`);
          console.error(`Valid layouts: ${VALID_LAYOUTS.join(', ')}`);
          process.exit(1);
        }

        const insertionIndex = indexStr ? parseInt(indexStr) : undefined;

        if (!jsonOutput) console.log(`[...] Adding ${layout} slide...`);
        const result = await client.addSlide(presentationId, layout, insertionIndex);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Slide added');
          console.log(`  Layout: ${layout}`);
          console.log(`  Slide ID: ${result.slideId}`);
        }
        break;
      }

      case 'delete-slide': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for delete-slide action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for delete-slide action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Deleting slide ${slideNumber}...`);
        await client.deleteSlideByNumber(presentationId, slideNumber);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, deletedSlideNumber: slideNumber }));
        } else {
          printSeparator('-');
          console.log('[OK] Slide deleted');
          console.log(`  Slide number: ${slideNumber}`);
        }
        break;
      }

      case 'add-textbox': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for add-textbox action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for add-textbox action');
          process.exit(1);
        }
        if (!text) {
          console.error('[ERROR] --text is required for add-textbox action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        const options = {
          x: xStr ? parseFloat(xStr) : undefined,
          y: yStr ? parseFloat(yStr) : undefined,
          width: widthStr ? parseFloat(widthStr) : undefined,
          height: heightStr ? parseFloat(heightStr) : undefined,
        };

        if (!jsonOutput) console.log(`[...] Adding text box to slide ${slideNumber}...`);
        const result = await client.addTextBoxBySlideNumber(presentationId, slideNumber, text, options);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Text box added');
          console.log(`  Slide: ${slideNumber}`);
          console.log(`  Element ID: ${result.elementId}`);
          console.log(`  Text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        }
        break;
      }

      case 'add-image': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for add-image action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for add-image action');
          process.exit(1);
        }

        // Determine image URL
        let finalImageUrl = imageUrl;
        if (driveId) {
          finalImageUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
        }
        if (!finalImageUrl) {
          console.error('[ERROR] Either --image-url or --drive-id is required for add-image action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        const imgOptions: ImageOptions = {
          x: xStr ? parseFloat(xStr) : undefined,
          y: yStr ? parseFloat(yStr) : undefined,
          width: widthStr ? parseFloat(widthStr) : undefined,
          height: heightStr ? parseFloat(heightStr) : undefined,
        };

        if (!jsonOutput) console.log(`[...] Adding image to slide ${slideNumber}...`);
        const result = await client.addImageBySlideNumber(presentationId, slideNumber, finalImageUrl, imgOptions);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Image added');
          console.log(`  Slide: ${slideNumber}`);
          console.log(`  Element ID: ${result.elementId}`);
          console.log(`  URL: ${finalImageUrl.substring(0, 60)}${finalImageUrl.length > 60 ? '...' : ''}`);
        }
        break;
      }

      case 'set-background': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for set-background action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for set-background action');
          process.exit(1);
        }

        // Determine image URL
        let bgImageUrl = imageUrl;
        if (driveId) {
          bgImageUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
        }
        if (!bgImageUrl) {
          console.error('[ERROR] Either --image-url or --drive-id is required for set-background action');
          process.exit(1);
        }

        const bgSlideNumber = parseInt(slideNumberStr);
        if (isNaN(bgSlideNumber) || bgSlideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Setting background for slide ${bgSlideNumber}...`);
        await client.setSlideBackgroundByNumber(presentationId, bgSlideNumber, bgImageUrl);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, slideNumber: bgSlideNumber }));
        } else {
          printSeparator('-');
          console.log('[OK] Background set');
          console.log(`  Slide: ${bgSlideNumber}`);
          console.log(`  Image: ${bgImageUrl.substring(0, 60)}${bgImageUrl.length > 60 ? '...' : ''}`);
        }
        break;
      }

      case 'set-background-color': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for set-background-color action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for set-background-color action');
          process.exit(1);
        }

        const colorStr = args.color;
        if (!colorStr) {
          console.error('[ERROR] --color is required for set-background-color action (hex format: #RRGGBB)');
          process.exit(1);
        }

        // Parse hex color
        const hexMatch = colorStr.match(/^#?([0-9A-Fa-f]{6})$/);
        if (!hexMatch) {
          console.error('[ERROR] --color must be in hex format: #RRGGBB (e.g., #007b85)');
          process.exit(1);
        }

        const hex = hexMatch[1];
        const rgbColor = {
          red: parseInt(hex.substring(0, 2), 16) / 255,
          green: parseInt(hex.substring(2, 4), 16) / 255,
          blue: parseInt(hex.substring(4, 6), 16) / 255,
        };

        const colorSlideNumber = parseInt(slideNumberStr);
        if (isNaN(colorSlideNumber) || colorSlideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Setting background color for slide ${colorSlideNumber}...`);
        await client.setSlideBackgroundColorByNumber(presentationId, colorSlideNumber, rgbColor);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, slideNumber: colorSlideNumber, color: colorStr }));
        } else {
          printSeparator('-');
          console.log('[OK] Background color set');
          console.log(`  Slide: ${colorSlideNumber}`);
          console.log(`  Color: ${colorStr}`);
        }
        break;
      }

      case 'remove-empty-placeholders': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for remove-empty-placeholders action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for remove-empty-placeholders action');
          process.exit(1);
        }

        const placeholderSlideNumber = parseInt(slideNumberStr);
        if (isNaN(placeholderSlideNumber) || placeholderSlideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Removing empty placeholders from slide ${placeholderSlideNumber}...`);
        const removeResult = await client.removeEmptyPlaceholdersByNumber(presentationId, placeholderSlideNumber);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, slideNumber: placeholderSlideNumber, ...removeResult }));
        } else {
          printSeparator('-');
          if (removeResult.removedCount === 0) {
            console.log('[OK] No empty placeholders found');
            console.log(`  Slide: ${placeholderSlideNumber}`);
          } else {
            console.log('[OK] Empty placeholders removed');
            console.log(`  Slide: ${placeholderSlideNumber}`);
            console.log(`  Removed: ${removeResult.removedCount} placeholder(s)`);
          }
        }
        break;
      }

      case 'remove-all-empty-placeholders': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for remove-all-empty-placeholders action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Removing empty placeholders from all slides...');
        const removeAllResult = await client.removeAllEmptyPlaceholders(presentationId);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, ...removeAllResult }));
        } else {
          printSeparator('-');
          if (removeAllResult.totalRemoved === 0) {
            console.log('[OK] No empty placeholders found in any slide');
          } else {
            console.log('[OK] Empty placeholders removed');
            console.log(`  Total removed: ${removeAllResult.totalRemoved}`);
            for (const detail of removeAllResult.slideDetails) {
              console.log(`    Slide ${detail.slideNumber}: ${detail.removedCount} placeholder(s)`);
            }
          }
        }
        break;
      }

      case 'replace': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for replace action');
          process.exit(1);
        }
        if (!findText) {
          console.error('[ERROR] --find is required for replace action');
          process.exit(1);
        }
        if (replaceWith === undefined) {
          console.error('[ERROR] --replace-with is required for replace action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Replacing "${findText}" with "${replaceWith}"...`);
        const count = await client.replaceTextInPresentation(presentationId, findText, replaceWith);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, replacements: count }));
        } else {
          printSeparator('-');
          console.log('[OK] Text replaced');
          console.log(`  Occurrences replaced: ${count}`);
        }
        break;
      }

      case 'get-notes': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for get-notes action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for get-notes action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Getting speaker notes from slide ${slideNumber}...`);
        const notes = await client.getSpeakerNotes(presentationId, slideNumber);

        if (jsonOutput) {
          console.log(JSON.stringify({ slideNumber, notes }));
        } else {
          printSeparator('-');
          console.log(`[OK] Speaker notes from slide ${slideNumber}`);
          printSeparator('-');
          console.log(notes || '(no notes)');
        }
        break;
      }

      case 'set-notes': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for set-notes action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for set-notes action');
          process.exit(1);
        }
        if (!notesText && !text) {
          console.error('[ERROR] --notes or --text is required for set-notes action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        const finalNotesText = notesText || text || '';

        if (!jsonOutput) console.log(`[...] Setting speaker notes for slide ${slideNumber}...`);
        await client.setSpeakerNotes(presentationId, slideNumber, finalNotesText);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, slideNumber }));
        } else {
          printSeparator('-');
          console.log('[OK] Speaker notes set');
          console.log(`  Slide: ${slideNumber}`);
          console.log(`  Notes: ${finalNotesText.substring(0, 50)}${finalNotesText.length > 50 ? '...' : ''}`);
        }
        break;
      }

      case 'list-elements': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for list-elements action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for list-elements action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Listing elements on slide ${slideNumber}...`);
        const elements = await client.getSlideElements(presentationId, slideNumber);

        if (jsonOutput) {
          console.log(JSON.stringify({ slideNumber, elements }, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Elements on slide ${slideNumber}`);
          console.log(`  Total: ${elements.length} element(s)`);
          printSeparator('-');
          for (const elem of elements) {
            const textPreview = elem.text ? ` - "${elem.text.substring(0, 40)}${elem.text.length > 40 ? '...' : ''}"` : '';
            console.log(`  [${elem.type}] ${elem.objectId}${textPreview}`);
          }
        }
        break;
      }

      case 'clear-textboxes': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for clear-textboxes action');
          process.exit(1);
        }
        if (!slideNumberStr) {
          console.error('[ERROR] --slide-number is required for clear-textboxes action');
          process.exit(1);
        }

        const slideNumber = parseInt(slideNumberStr);
        if (isNaN(slideNumber) || slideNumber < 1) {
          console.error('[ERROR] --slide-number must be a positive number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Clearing text boxes from slide ${slideNumber}...`);
        const clearResult = await client.clearSlideTextBoxes(presentationId, slideNumber);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, slideNumber, ...clearResult }));
        } else {
          printSeparator('-');
          if (clearResult.deletedCount === 0) {
            console.log('[OK] No text boxes found on slide');
            console.log(`  Slide: ${slideNumber}`);
          } else {
            console.log('[OK] Text boxes cleared');
            console.log(`  Slide: ${slideNumber}`);
            console.log(`  Deleted: ${clearResult.deletedCount} text box(es)`);
          }
        }
        break;
      }

      case 'delete-elements': {
        if (!presentationId) {
          console.error('[ERROR] --id is required for delete-elements action');
          process.exit(1);
        }
        if (!elementIds) {
          console.error('[ERROR] --element-ids is required for delete-elements action (comma-separated list)');
          process.exit(1);
        }

        const idsToDelete = elementIds.split(',').map((id: string) => id.trim()).filter((id: string) => id);

        if (idsToDelete.length === 0) {
          console.error('[ERROR] No valid element IDs provided');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Deleting ${idsToDelete.length} element(s)...`);
        await client.deletePageElements(presentationId, idsToDelete);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, deletedCount: idsToDelete.length, deletedIds: idsToDelete }));
        } else {
          printSeparator('-');
          console.log('[OK] Elements deleted');
          console.log(`  Count: ${idsToDelete.length}`);
          for (const id of idsToDelete) {
            console.log(`    - ${id}`);
          }
        }
        break;
      }
    }

    if (!jsonOutput) {
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
  console.error('\nUsage: npx tsx slides-manage.ts --action "<action>" [options]');
  console.error('\nActions:');
  console.error('  create           Create a new presentation');
  console.error('  create-with-slides Create presentation with multiple slides');
  console.error('  get              Get presentation metadata');
  console.error('  summary          Get detailed summary with per-slide text');
  console.error('  count            Get slide count');
  console.error('  text             Get text from all slides');
  console.error('  text-slide       Get text from a specific slide');
  console.error('  add-slide        Add a new slide');
  console.error('  delete-slide     Delete a slide by number');
  console.error('  add-textbox      Add a text box to a slide');
  console.error('  add-image        Add an image to a slide');
  console.error('  set-background   Set slide background to an image (proper API method)');
  console.error('  set-background-color Set slide background to a solid color');
  console.error('  remove-empty-placeholders      Remove empty placeholders from a slide');
  console.error('  remove-all-empty-placeholders  Remove empty placeholders from all slides');
  console.error('  replace          Replace text across the presentation');
  console.error('  get-notes        Get speaker notes from a slide');
  console.error('  set-notes        Set speaker notes for a slide');
  console.error('  list-elements    List all page elements on a slide');
  console.error('  clear-textboxes  Clear all text boxes from a slide');
  console.error('  delete-elements  Delete specific elements by ID');
  console.error('\nExamples:');
  console.error('  Create:       --action create --title "My Presentation"');
  console.error('  With slides:  --action create-with-slides --title "Report" --slide-count 5 --layout TITLE_AND_BODY');
  console.error('  Get:          --action get --id "presentation_id"');
  console.error('  Summary:      --action summary --id "presentation_id"');
  console.error('  Count:        --action count --id "presentation_id"');
  console.error('  All text:     --action text --id "presentation_id"');
  console.error('  Slide text:   --action text-slide --id "presentation_id" --slide-number 2');
  console.error('  Add slide:    --action add-slide --id "presentation_id" --layout BLANK --index 1');
  console.error('  Delete slide: --action delete-slide --id "presentation_id" --slide-number 3');
  console.error('  Add textbox:  --action add-textbox --id "presentation_id" --slide-number 1 --text "Hello" --x 100 --y 100');
  console.error('  Add image:    --action add-image --id "presentation_id" --slide-number 1 --drive-id "file_id"');
  console.error('  Add img URL:  --action add-image --id "presentation_id" --slide-number 1 --image-url "https://..."');
  console.error('  Set bg img:   --action set-background --id "presentation_id" --slide-number 1 --drive-id "file_id"');
  console.error('  Set bg URL:   --action set-background --id "presentation_id" --slide-number 1 --image-url "https://..."');
  console.error('  Set bg color: --action set-background-color --id "presentation_id" --slide-number 1 --color "#007b85"');
  console.error('  Clean slide:  --action remove-empty-placeholders --id "presentation_id" --slide-number 1');
  console.error('  Clean all:    --action remove-all-empty-placeholders --id "presentation_id"');
  console.error('  Replace:      --action replace --id "presentation_id" --find "old" --replace-with "new"');
  console.error('  Get notes:    --action get-notes --id "presentation_id" --slide-number 3');
  console.error('  Set notes:    --action set-notes --id "presentation_id" --slide-number 3 --notes "Speaker notes text"');
  console.error('  List elems:   --action list-elements --id "presentation_id" --slide-number 1');
  console.error('  Clear boxes:  --action clear-textboxes --id "presentation_id" --slide-number 1');
  console.error('  Delete elems: --action delete-elements --id "presentation_id" --element-ids "id1,id2,id3"');
  console.error('\nValid layouts: BLANK, TITLE, TITLE_AND_BODY, TITLE_ONLY, SECTION_HEADER, CAPTION_ONLY,');
  console.error('               TITLE_AND_TWO_COLUMNS, SECTION_TITLE_AND_DESCRIPTION, ONE_COLUMN_TEXT,');
  console.error('               MAIN_POINT, BIG_NUMBER');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
