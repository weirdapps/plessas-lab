#!/usr/bin/env npx tsx
/**
 * Docs Manage CLI Tool
 *
 * Manage Google Docs documents.
 *
 * Usage:
 *   npx tsx docs-manage.ts --action "create" --title "My Document"
 *
 * Actions:
 *   create           - Create a new document
 *   create-with-content - Create document with initial content
 *   create-in-folder - Create document in a specific folder
 *   get              - Get document metadata
 *   text             - Get document text content
 *   summary          - Get document summary (first N characters)
 *   structure        - Get document structure (headings, counts)
 *   insert           - Insert text at a specific position
 *   append           - Append text to document
 *   delete-range     - Delete content in a range
 *   add-heading      - Add a heading to the document
 *   replace          - Replace text in document
 *   search           - Search for text in document
 *   search-multi     - Search for text across multiple documents
 *
 * Options:
 *   --action, -a      Action to perform (required)
 *   --id, -i          Document ID (for most operations)
 *   --ids             Comma-separated document IDs (for search-multi)
 *   --title, -t       Document title (for create)
 *   --text            Text content (for insert/append/add-heading)
 *   --content         Initial content (for create-with-content)
 *   --index           Position index (for insert/delete-range)
 *   --start-index     Start index (for delete-range)
 *   --end-index       End index (for delete-range)
 *   --find            Text to find (for replace/search)
 *   --replace-with    Replacement text (for replace)
 *   --folder-id       Folder ID (for create-in-folder)
 *   --level           Heading level 1-6 (for add-heading, default: 1)
 *   --max-chars       Maximum characters (for summary, default: 500)
 *   --json            Output as JSON
 */

import {
  DocsClient,
  parseArgs,
  printSeparator,
  type DocumentStructure,
  type TextSearchResult,
  type HeadingLevel,
} from './google-drive-client.js';

type Action =
  | 'create'
  | 'create-with-content'
  | 'create-in-folder'
  | 'get'
  | 'text'
  | 'summary'
  | 'structure'
  | 'insert'
  | 'append'
  | 'delete-range'
  | 'add-heading'
  | 'replace'
  | 'search'
  | 'search-multi';

const VALID_ACTIONS: Action[] = [
  'create',
  'create-with-content',
  'create-in-folder',
  'get',
  'text',
  'summary',
  'structure',
  'insert',
  'append',
  'delete-range',
  'add-heading',
  'replace',
  'search',
  'search-multi',
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const action = (args.action || args.a) as Action;
  const documentId = args.id || args.i;
  const documentIdsStr = args.ids;
  const title = args.title || args.t;
  const text = args.text;
  const content = args.content;
  const indexStr = args.index;
  const startIndexStr = args['start-index'];
  const endIndexStr = args['end-index'];
  const findText = args.find;
  const replaceWith = args['replace-with'];
  const folderId = args['folder-id'];
  const levelStr = args.level;
  const maxCharsStr = args['max-chars'];
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
    console.log('Google Docs - Manage');
    printSeparator();
    console.log(`Action: ${action}`);
    if (documentId) console.log(`Document ID: ${documentId}`);
    printSeparator('-');
  }

  try {
    const client = new DocsClient();

    switch (action) {
      case 'create': {
        if (!title) {
          console.error('[ERROR] --title is required for create action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Creating document "${title}"...`);
        const result = await client.createDocument(title);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Document created');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.documentId}`);
          console.log(`  Link: https://docs.google.com/document/d/${result.documentId}/edit`);
        }
        break;
      }

      case 'create-with-content': {
        if (!title) {
          console.error('[ERROR] --title is required for create-with-content action');
          process.exit(1);
        }
        if (!content) {
          console.error('[ERROR] --content is required for create-with-content action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Creating document "${title}" with content...`);
        const result = await client.createDocumentWithContent(title, content);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Document created with content');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.documentId}`);
          console.log(`  Link: https://docs.google.com/document/d/${result.documentId}/edit`);
        }
        break;
      }

      case 'create-in-folder': {
        if (!title) {
          console.error('[ERROR] --title is required for create-in-folder action');
          process.exit(1);
        }
        if (!folderId) {
          console.error('[ERROR] --folder-id is required for create-in-folder action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Creating document "${title}" in folder...`);
        const result = await client.createDocumentInFolder(title, folderId, content);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Document created in folder');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.documentId}`);
          console.log(`  Folder: ${folderId}`);
          console.log(`  Link: https://docs.google.com/document/d/${result.documentId}/edit`);
        }
        break;
      }

      case 'get': {
        if (!documentId) {
          console.error('[ERROR] --id is required for get action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Getting document metadata...');
        const result = await client.getDocument(documentId);

        if (jsonOutput) {
          console.log(JSON.stringify({
            documentId: result.documentId,
            title: result.title,
            revisionId: result.revisionId,
          }, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Document found');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.documentId}`);
          console.log(`  Revision: ${result.revisionId}`);
        }
        break;
      }

      case 'text': {
        if (!documentId) {
          console.error('[ERROR] --id is required for text action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Extracting document text...');
        const result = await client.getDocumentText(documentId);

        if (jsonOutput) {
          console.log(JSON.stringify({ text: result }, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Document text extracted');
          console.log(`  Length: ${result.length} characters`);
          printSeparator('-');
          console.log(result);
        }
        break;
      }

      case 'summary': {
        if (!documentId) {
          console.error('[ERROR] --id is required for summary action');
          process.exit(1);
        }

        const maxChars = maxCharsStr ? parseInt(maxCharsStr) : 500;

        if (!jsonOutput) console.log(`[...] Getting document summary (max ${maxChars} chars)...`);
        const result = await client.getDocumentSummary(documentId, maxChars);

        if (jsonOutput) {
          console.log(JSON.stringify({ summary: result, maxChars }, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Document summary');
          console.log(`  Length: ${result.length} characters`);
          printSeparator('-');
          console.log(result);
        }
        break;
      }

      case 'structure': {
        if (!documentId) {
          console.error('[ERROR] --id is required for structure action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Analyzing document structure...');
        const result: DocumentStructure = await client.getDocumentStructure(documentId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Document Structure');
          console.log(`  Characters: ${result.characterCount}`);
          console.log(`  Paragraphs: ${result.paragraphCount}`);
          console.log(`  Tables: ${result.tableCount}`);
          console.log(`  Lists: ${result.listCount}`);
          console.log(`  Images: ${result.imageCount}`);
          console.log(`  Headings: ${result.headings.length}`);
          if (result.headings.length > 0) {
            printSeparator('-');
            console.log('Headings:');
            for (const heading of result.headings) {
              const indent = '  '.repeat(heading.level);
              console.log(`  ${indent}H${heading.level}: ${heading.text}`);
            }
          }
        }
        break;
      }

      case 'insert': {
        if (!documentId) {
          console.error('[ERROR] --id is required for insert action');
          process.exit(1);
        }
        if (!text) {
          console.error('[ERROR] --text is required for insert action');
          process.exit(1);
        }
        if (!indexStr) {
          console.error('[ERROR] --index is required for insert action');
          process.exit(1);
        }

        const index = parseInt(indexStr);
        if (isNaN(index)) {
          console.error('[ERROR] --index must be a number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Inserting text at position ${index}...`);
        await client.insertTextAtPosition(documentId, text, index);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, index, textLength: text.length }));
        } else {
          printSeparator('-');
          console.log('[OK] Text inserted');
          console.log(`  Position: ${index}`);
          console.log(`  Characters inserted: ${text.length}`);
        }
        break;
      }

      case 'append': {
        if (!documentId) {
          console.error('[ERROR] --id is required for append action');
          process.exit(1);
        }
        if (!text) {
          console.error('[ERROR] --text is required for append action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Appending text...');
        await client.appendText(documentId, text);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, appended: text.length }));
        } else {
          printSeparator('-');
          console.log('[OK] Text appended');
          console.log(`  Characters added: ${text.length}`);
        }
        break;
      }

      case 'delete-range': {
        if (!documentId) {
          console.error('[ERROR] --id is required for delete-range action');
          process.exit(1);
        }
        if (!startIndexStr) {
          console.error('[ERROR] --start-index is required for delete-range action');
          process.exit(1);
        }
        if (!endIndexStr) {
          console.error('[ERROR] --end-index is required for delete-range action');
          process.exit(1);
        }

        const startIndex = parseInt(startIndexStr);
        const endIndex = parseInt(endIndexStr);

        if (isNaN(startIndex) || isNaN(endIndex)) {
          console.error('[ERROR] --start-index and --end-index must be numbers');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Deleting content from ${startIndex} to ${endIndex}...`);
        await client.deleteContentRange(documentId, startIndex, endIndex);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, startIndex, endIndex, deletedChars: endIndex - startIndex }));
        } else {
          printSeparator('-');
          console.log('[OK] Content deleted');
          console.log(`  Range: ${startIndex} - ${endIndex}`);
          console.log(`  Characters deleted: ${endIndex - startIndex}`);
        }
        break;
      }

      case 'add-heading': {
        if (!documentId) {
          console.error('[ERROR] --id is required for add-heading action');
          process.exit(1);
        }
        if (!text) {
          console.error('[ERROR] --text is required for add-heading action');
          process.exit(1);
        }

        const level = levelStr ? parseInt(levelStr) : 1;
        if (level < 1 || level > 6) {
          console.error('[ERROR] --level must be between 1 and 6');
          process.exit(1);
        }

        const headingLevel = `HEADING_${level}` as HeadingLevel;
        const index = indexStr ? parseInt(indexStr) : undefined;

        if (!jsonOutput) console.log(`[...] Adding H${level} heading...`);
        await client.addHeading(documentId, text, headingLevel, index);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, level, text }));
        } else {
          printSeparator('-');
          console.log('[OK] Heading added');
          console.log(`  Level: H${level}`);
          console.log(`  Text: ${text}`);
        }
        break;
      }

      case 'replace': {
        if (!documentId) {
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
        const count = await client.replaceText(documentId, findText, replaceWith);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, replacements: count }));
        } else {
          printSeparator('-');
          console.log('[OK] Text replaced');
          console.log(`  Occurrences replaced: ${count}`);
        }
        break;
      }

      case 'search': {
        if (!documentId) {
          console.error('[ERROR] --id is required for search action');
          process.exit(1);
        }
        if (!findText) {
          console.error('[ERROR] --find is required for search action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Searching for "${findText}"...`);
        const results: TextSearchResult[] = await client.searchInDocument(documentId, findText);

        if (jsonOutput) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Found ${results.length} match(es)`);
          for (const match of results.slice(0, 20)) {
            printSeparator('-');
            console.log(`  Position: ${match.startIndex}-${match.endIndex}`);
            console.log(`  Context: ${match.context}`);
          }
          if (results.length > 20) {
            console.log(`  ... and ${results.length - 20} more matches`);
          }
        }
        break;
      }

      case 'search-multi': {
        if (!documentIdsStr) {
          console.error('[ERROR] --ids is required for search-multi action');
          console.error('Example: --ids "doc_id_1,doc_id_2,doc_id_3"');
          process.exit(1);
        }
        if (!findText) {
          console.error('[ERROR] --find is required for search-multi action');
          process.exit(1);
        }

        const documentIds = documentIdsStr.split(',').map(s => s.trim());

        if (!jsonOutput) console.log(`[...] Searching ${documentIds.length} document(s) for "${findText}"...`);
        const results = await client.searchDocumentsForText(documentIds, findText);

        if (jsonOutput) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Found matches in ${results.length} document(s)`);
          for (const doc of results) {
            printSeparator('-');
            console.log(`  Document: ${doc.title} (${doc.documentId})`);
            console.log(`  Matches: ${doc.matches.length}`);
            for (const match of doc.matches.slice(0, 3)) {
              console.log(`    - ${match.context}`);
            }
            if (doc.matches.length > 3) {
              console.log(`    ... and ${doc.matches.length - 3} more`);
            }
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
  console.error('\nUsage: npx tsx docs-manage.ts --action "<action>" [options]');
  console.error('\nActions:');
  console.error('  create           Create a new document');
  console.error('  create-with-content Create document with initial content');
  console.error('  create-in-folder Create document in a specific folder');
  console.error('  get              Get document metadata');
  console.error('  text             Get document text content');
  console.error('  summary          Get document summary (first N characters)');
  console.error('  structure        Get document structure (headings, counts)');
  console.error('  insert           Insert text at a specific position');
  console.error('  append           Append text to document');
  console.error('  delete-range     Delete content in a range');
  console.error('  add-heading      Add a heading to the document');
  console.error('  replace          Replace text in document');
  console.error('  search           Search for text in document');
  console.error('  search-multi     Search for text across multiple documents');
  console.error('\nExamples:');
  console.error('  Create:      --action create --title "My Document"');
  console.error('  With content: --action create-with-content --title "Doc" --content "Initial text"');
  console.error('  In folder:   --action create-in-folder --title "Doc" --folder-id "folder_id"');
  console.error('  Get:         --action get --id "document_id"');
  console.error('  Text:        --action text --id "document_id"');
  console.error('  Summary:     --action summary --id "document_id" --max-chars 200');
  console.error('  Structure:   --action structure --id "document_id"');
  console.error('  Insert:      --action insert --id "document_id" --text "new text" --index 10');
  console.error('  Append:      --action append --id "document_id" --text "New paragraph"');
  console.error('  Delete:      --action delete-range --id "document_id" --start-index 10 --end-index 50');
  console.error('  Heading:     --action add-heading --id "document_id" --text "Section" --level 2');
  console.error('  Replace:     --action replace --id "document_id" --find "old" --replace-with "new"');
  console.error('  Search:      --action search --id "document_id" --find "keyword"');
  console.error('  Search multi: --action search-multi --ids "id1,id2,id3" --find "keyword"');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
