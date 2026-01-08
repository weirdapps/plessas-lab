#!/usr/bin/env npx tsx
/**
 * Sheets Manage CLI Tool
 *
 * Manage Google Sheets spreadsheets.
 *
 * Usage:
 *   npx tsx sheets-manage.ts --action "create" --title "My Spreadsheet"
 *
 * Actions:
 *   create           - Create a new spreadsheet
 *   create-with-sheets - Create spreadsheet with multiple named sheets
 *   create-with-data - Create spreadsheet and populate with data
 *   get              - Get spreadsheet metadata
 *   summary          - Get detailed spreadsheet summary
 *   read             - Read values from a range
 *   read-all         - Read all values from a sheet
 *   read-multi       - Read multiple ranges at once
 *   write            - Write values to a range
 *   write-multi      - Write to multiple ranges at once
 *   append           - Append values to a range
 *   clear            - Clear values from a range
 *   find             - Find cells containing text
 *   query            - Query rows with column filters
 *   find-row         - Find a row by value in a column
 *   get-column       - Get all values from a column
 *   add-sheet        - Add a new sheet to spreadsheet
 *   delete-sheet     - Delete a sheet from spreadsheet
 *
 * Options:
 *   --action, -a      Action to perform (required)
 *   --id, -i          Spreadsheet ID (for most operations)
 *   --title, -t       Spreadsheet title (for create)
 *   --range, -r       Cell range in A1 notation (for read/write/append/clear)
 *   --ranges          Comma-separated ranges (for read-multi/write-multi)
 *   --values, -v      JSON array of values (for write/append)
 *   --data            JSON object of {range: values} (for write-multi)
 *   --sheet, -s       Sheet name (default: Sheet1)
 *   --sheets          Comma-separated sheet names (for create-with-sheets)
 *   --sheet-id        Sheet ID number (for delete-sheet)
 *   --search          Search text (for find)
 *   --filters         JSON object of {columnIndex: filterValue} (for query)
 *   --column, -c      Column letter or index (for find-row/get-column)
 *   --value           Value to find (for find-row)
 *   --json            Output as JSON
 */

import {
  SheetsClient,
  parseArgs,
  printSeparator,
  type SheetValues,
  type CellMatch,
  type CellValue,
  type SpreadsheetSummary,
} from './google-drive-client.js';

type Action =
  | 'create'
  | 'create-with-sheets'
  | 'create-with-data'
  | 'get'
  | 'summary'
  | 'read'
  | 'read-all'
  | 'read-multi'
  | 'write'
  | 'write-multi'
  | 'append'
  | 'clear'
  | 'find'
  | 'query'
  | 'find-row'
  | 'get-column'
  | 'add-sheet'
  | 'delete-sheet';

const VALID_ACTIONS: Action[] = [
  'create',
  'create-with-sheets',
  'create-with-data',
  'get',
  'summary',
  'read',
  'read-all',
  'read-multi',
  'write',
  'write-multi',
  'append',
  'clear',
  'find',
  'query',
  'find-row',
  'get-column',
  'add-sheet',
  'delete-sheet',
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const action = (args.action || args.a) as Action;
  const spreadsheetId = args.id || args.i;
  const title = args.title || args.t;
  const range = args.range || args.r;
  const rangesStr = args.ranges;
  const valuesJson = args.values || args.v;
  const dataJson = args.data;
  const sheetName = args.sheet || args.s || 'Sheet1';
  const sheetsStr = args.sheets;
  const sheetIdStr = args['sheet-id'];
  const searchText = args.search;
  const filtersJson = args.filters;
  const column = args.column || args.c;
  const findValue = args.value;
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
    console.log('Google Sheets - Manage');
    printSeparator();
    console.log(`Action: ${action}`);
    if (spreadsheetId) console.log(`Spreadsheet ID: ${spreadsheetId}`);
    if (range) console.log(`Range: ${range}`);
    if (sheetName !== 'Sheet1') console.log(`Sheet: ${sheetName}`);
    printSeparator('-');
  }

  try {
    const client = new SheetsClient();

    switch (action) {
      case 'create': {
        if (!title) {
          console.error('[ERROR] --title is required for create action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Creating spreadsheet "${title}"...`);
        const result = await client.createSpreadsheet(title);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Spreadsheet created');
          console.log(`  ID: ${result.spreadsheetId}`);
          console.log(`  Link: ${result.spreadsheetUrl}`);
        }
        break;
      }

      case 'create-with-sheets': {
        if (!title) {
          console.error('[ERROR] --title is required for create-with-sheets action');
          process.exit(1);
        }
        if (!sheetsStr) {
          console.error('[ERROR] --sheets is required for create-with-sheets action');
          console.error('Example: --sheets "Data,Summary,Archive"');
          process.exit(1);
        }

        const sheetNames = sheetsStr.split(',').map(s => s.trim());

        if (!jsonOutput) console.log(`[...] Creating spreadsheet "${title}" with sheets: ${sheetNames.join(', ')}...`);
        const result = await client.createSpreadsheetWithSheets(title, sheetNames);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Spreadsheet created');
          console.log(`  ID: ${result.spreadsheetId}`);
          console.log(`  Sheets: ${result.sheets?.map(s => s.properties?.title).join(', ')}`);
          console.log(`  Link: ${result.spreadsheetUrl}`);
        }
        break;
      }

      case 'create-with-data': {
        if (!title) {
          console.error('[ERROR] --title is required for create-with-data action');
          process.exit(1);
        }
        if (!valuesJson) {
          console.error('[ERROR] --values is required for create-with-data action');
          console.error('Example: --values \'[["Header1","Header2"],["Data1","Data2"]]\'');
          process.exit(1);
        }

        let values: SheetValues;
        try {
          values = JSON.parse(valuesJson);
        } catch {
          console.error('[ERROR] --values must be valid JSON array');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Creating spreadsheet "${title}" with data...`);
        const result = await client.createSpreadsheetWithData(title, values, sheetName);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Spreadsheet created with data');
          console.log(`  ID: ${result.spreadsheetId}`);
          console.log(`  Link: ${result.spreadsheetUrl}`);
        }
        break;
      }

      case 'get': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for get action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Getting spreadsheet metadata...');
        const result = await client.getSpreadsheet(spreadsheetId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Spreadsheet found');
          console.log(`  Title: ${result.properties?.title}`);
          console.log(`  ID: ${result.spreadsheetId}`);
          console.log(`  Sheets: ${result.sheets?.map(s => s.properties?.title).join(', ')}`);
          console.log(`  Link: ${result.spreadsheetUrl}`);
        }
        break;
      }

      case 'summary': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for summary action');
          process.exit(1);
        }

        if (!jsonOutput) console.log('[...] Getting spreadsheet summary...');
        const result: SpreadsheetSummary = await client.getSheetSummary(spreadsheetId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Spreadsheet Summary');
          console.log(`  Title: ${result.title}`);
          console.log(`  ID: ${result.spreadsheetId}`);
          console.log(`  URL: ${result.url}`);
          console.log(`  Sheets (${result.sheets.length}):`);
          for (const sheet of result.sheets) {
            console.log(`    - ${sheet.title} (ID: ${sheet.sheetId}, ${sheet.rowCount}x${sheet.columnCount})`);
          }
        }
        break;
      }

      case 'read': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for read action');
          process.exit(1);
        }
        if (!range) {
          console.error('[ERROR] --range is required for read action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Reading values from ${range}...`);
        const result = await client.readValues(spreadsheetId, range);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Read ${result.length} row(s)`);
          printSeparator('-');
          for (let i = 0; i < result.length; i++) {
            console.log(`Row ${i + 1}: ${JSON.stringify(result[i])}`);
          }
        }
        break;
      }

      case 'read-all': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for read-all action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Reading all values from ${sheetName}...`);
        const result = await client.readAllValues(spreadsheetId, sheetName);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Read ${result.length} row(s) from ${sheetName}`);
          printSeparator('-');
          for (let i = 0; i < Math.min(result.length, 20); i++) {
            console.log(`Row ${i + 1}: ${JSON.stringify(result[i])}`);
          }
          if (result.length > 20) {
            console.log(`... and ${result.length - 20} more rows`);
          }
        }
        break;
      }

      case 'read-multi': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for read-multi action');
          process.exit(1);
        }
        if (!rangesStr) {
          console.error('[ERROR] --ranges is required for read-multi action');
          console.error('Example: --ranges "Sheet1!A1:B10,Sheet1!D1:E10"');
          process.exit(1);
        }

        const ranges = rangesStr.split(',').map(s => s.trim());

        if (!jsonOutput) console.log(`[...] Reading ${ranges.length} range(s)...`);
        const result = await client.readMultipleRanges(spreadsheetId, ranges);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Read ${Object.keys(result).length} range(s)`);
          for (const [rng, values] of Object.entries(result)) {
            printSeparator('-');
            console.log(`${rng}: ${values.length} row(s)`);
          }
        }
        break;
      }

      case 'write': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for write action');
          process.exit(1);
        }
        if (!range) {
          console.error('[ERROR] --range is required for write action');
          process.exit(1);
        }
        if (!valuesJson) {
          console.error('[ERROR] --values is required for write action');
          console.error('Example: --values \'[["a","b"],["c","d"]]\'');
          process.exit(1);
        }

        let values: SheetValues;
        try {
          values = JSON.parse(valuesJson);
        } catch {
          console.error('[ERROR] --values must be valid JSON array');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Writing values to ${range}...`);
        const result = await client.writeValues(spreadsheetId, range, values);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Values written');
          console.log(`  Range: ${result.updatedRange}`);
          console.log(`  Rows: ${result.updatedRows}`);
          console.log(`  Columns: ${result.updatedColumns}`);
          console.log(`  Cells: ${result.updatedCells}`);
        }
        break;
      }

      case 'write-multi': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for write-multi action');
          process.exit(1);
        }
        if (!dataJson) {
          console.error('[ERROR] --data is required for write-multi action');
          console.error('Example: --data \'{"Sheet1!A1":[["a","b"]],"Sheet1!D1":[["x","y"]]}\'');
          process.exit(1);
        }

        let data: Record<string, SheetValues>;
        try {
          data = JSON.parse(dataJson);
        } catch {
          console.error('[ERROR] --data must be valid JSON object');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Writing to ${Object.keys(data).length} range(s)...`);
        const result = await client.updateMultipleRanges(spreadsheetId, data);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Multiple ranges updated');
          console.log(`  Total cells updated: ${result.totalUpdatedCells}`);
        }
        break;
      }

      case 'append': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for append action');
          process.exit(1);
        }
        if (!range) {
          console.error('[ERROR] --range is required for append action');
          process.exit(1);
        }
        if (!valuesJson) {
          console.error('[ERROR] --values is required for append action');
          console.error('Example: --values \'[["new","row"]]\'');
          process.exit(1);
        }

        let values: SheetValues;
        try {
          values = JSON.parse(valuesJson);
        } catch {
          console.error('[ERROR] --values must be valid JSON array');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Appending values to ${range}...`);
        const result = await client.appendValues(spreadsheetId, range, values);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Values appended');
          console.log(`  Range: ${result.updatedRange}`);
          console.log(`  Rows: ${result.updatedRows}`);
          console.log(`  Cells: ${result.updatedCells}`);
        }
        break;
      }

      case 'clear': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for clear action');
          process.exit(1);
        }
        if (!range) {
          console.error('[ERROR] --range is required for clear action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Clearing values from ${range}...`);
        await client.clearValues(spreadsheetId, range);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, clearedRange: range }));
        } else {
          printSeparator('-');
          console.log('[OK] Values cleared');
          console.log(`  Range: ${range}`);
        }
        break;
      }

      case 'find': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for find action');
          process.exit(1);
        }
        if (!searchText) {
          console.error('[ERROR] --search is required for find action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Searching for "${searchText}" in ${sheetName}...`);
        const result: CellMatch[] = await client.findInSheet(spreadsheetId, searchText, sheetName);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Found ${result.length} match(es)`);
          for (const match of result.slice(0, 20)) {
            console.log(`  ${match.cell}: ${match.value}`);
          }
          if (result.length > 20) {
            console.log(`  ... and ${result.length - 20} more matches`);
          }
        }
        break;
      }

      case 'query': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for query action');
          process.exit(1);
        }
        if (!filtersJson) {
          console.error('[ERROR] --filters is required for query action');
          console.error('Example: --filters \'{"0":"John","2":"Active"}\' (column 0 contains "John", column 2 contains "Active")');
          process.exit(1);
        }

        let filters: Record<number, string>;
        try {
          filters = JSON.parse(filtersJson);
        } catch {
          console.error('[ERROR] --filters must be valid JSON object');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Querying ${sheetName} with ${Object.keys(filters).length} filter(s)...`);
        const result = await client.querySheet(spreadsheetId, filters, sheetName);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Found ${result.length} matching row(s)`);
          for (const row of result.slice(0, 10)) {
            console.log(`  ${JSON.stringify(row)}`);
          }
          if (result.length > 10) {
            console.log(`  ... and ${result.length - 10} more rows`);
          }
        }
        break;
      }

      case 'find-row': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for find-row action');
          process.exit(1);
        }
        if (!column) {
          console.error('[ERROR] --column is required for find-row action');
          console.error('Example: --column A or --column 0');
          process.exit(1);
        }
        if (findValue === undefined) {
          console.error('[ERROR] --value is required for find-row action');
          process.exit(1);
        }

        const colParam = isNaN(Number(column)) ? column : Number(column);

        if (!jsonOutput) console.log(`[...] Finding row where column ${column} = "${findValue}"...`);
        const result = await client.findRowByValue(spreadsheetId, colParam, findValue, sheetName);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          if (result) {
            console.log('[OK] Row found');
            console.log(`  ${JSON.stringify(result)}`);
          } else {
            console.log('[INFO] No matching row found');
          }
        }
        break;
      }

      case 'get-column': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for get-column action');
          process.exit(1);
        }
        if (!column) {
          console.error('[ERROR] --column is required for get-column action');
          console.error('Example: --column A or --column 0');
          process.exit(1);
        }

        const colParam = isNaN(Number(column)) ? column : Number(column);

        if (!jsonOutput) console.log(`[...] Getting column ${column} values from ${sheetName}...`);
        const result: CellValue[] = await client.getColumnValues(spreadsheetId, colParam, sheetName);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Got ${result.length} value(s) from column ${column}`);
          for (let i = 0; i < Math.min(result.length, 20); i++) {
            console.log(`  Row ${i + 1}: ${result[i]}`);
          }
          if (result.length > 20) {
            console.log(`  ... and ${result.length - 20} more values`);
          }
        }
        break;
      }

      case 'add-sheet': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for add-sheet action');
          process.exit(1);
        }
        if (!sheetName || sheetName === 'Sheet1') {
          console.error('[ERROR] --sheet is required for add-sheet action (sheet name to add)');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Adding sheet "${sheetName}"...`);
        const result = await client.addSheet(spreadsheetId, sheetName);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Sheet added');
          console.log(`  Title: ${result.title}`);
          console.log(`  Sheet ID: ${result.sheetId}`);
        }
        break;
      }

      case 'delete-sheet': {
        if (!spreadsheetId) {
          console.error('[ERROR] --id is required for delete-sheet action');
          process.exit(1);
        }
        if (!sheetIdStr) {
          console.error('[ERROR] --sheet-id is required for delete-sheet action');
          console.error('Use "summary" action to get sheet IDs');
          process.exit(1);
        }

        const sheetId = parseInt(sheetIdStr);
        if (isNaN(sheetId)) {
          console.error('[ERROR] --sheet-id must be a number');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Deleting sheet with ID ${sheetId}...`);
        await client.deleteSheet(spreadsheetId, sheetId);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, deletedSheetId: sheetId }));
        } else {
          printSeparator('-');
          console.log('[OK] Sheet deleted');
          console.log(`  Sheet ID: ${sheetId}`);
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
  console.error('\nUsage: npx tsx sheets-manage.ts --action "<action>" [options]');
  console.error('\nActions:');
  console.error('  create           Create a new spreadsheet');
  console.error('  create-with-sheets Create with multiple named sheets');
  console.error('  create-with-data Create and populate with data');
  console.error('  get              Get spreadsheet metadata');
  console.error('  summary          Get detailed spreadsheet summary');
  console.error('  read             Read values from a range');
  console.error('  read-all         Read all values from a sheet');
  console.error('  read-multi       Read multiple ranges at once');
  console.error('  write            Write values to a range');
  console.error('  write-multi      Write to multiple ranges at once');
  console.error('  append           Append values to a range');
  console.error('  clear            Clear values from a range');
  console.error('  find             Find cells containing text');
  console.error('  query            Query rows with column filters');
  console.error('  find-row         Find a row by value in a column');
  console.error('  get-column       Get all values from a column');
  console.error('  add-sheet        Add a new sheet to spreadsheet');
  console.error('  delete-sheet     Delete a sheet from spreadsheet');
  console.error('\nExamples:');
  console.error('  Create:      --action create --title "My Spreadsheet"');
  console.error('  With sheets: --action create-with-sheets --title "Report" --sheets "Data,Summary"');
  console.error('  With data:   --action create-with-data --title "Report" --values \'[["A","B"],[1,2]]\'');
  console.error('  Get:         --action get --id "spreadsheet_id"');
  console.error('  Summary:     --action summary --id "spreadsheet_id"');
  console.error('  Read:        --action read --id "id" --range "Sheet1!A1:D10"');
  console.error('  Read all:    --action read-all --id "id" --sheet "Sheet1"');
  console.error('  Read multi:  --action read-multi --id "id" --ranges "A1:B5,D1:E5"');
  console.error('  Write:       --action write --id "id" --range "A1" --values \'[["a","b"]]\'');
  console.error('  Write multi: --action write-multi --id "id" --data \'{"A1":[["a"]],"C1":[["b"]]}\'');
  console.error('  Append:      --action append --id "id" --range "A1" --values \'[["new"]]\'');
  console.error('  Clear:       --action clear --id "id" --range "A1:D10"');
  console.error('  Find:        --action find --id "id" --search "text" --sheet "Sheet1"');
  console.error('  Query:       --action query --id "id" --filters \'{"0":"John"}\'');
  console.error('  Find row:    --action find-row --id "id" --column A --value "John"');
  console.error('  Get column:  --action get-column --id "id" --column A');
  console.error('  Add sheet:   --action add-sheet --id "id" --sheet "NewSheet"');
  console.error('  Del sheet:   --action delete-sheet --id "id" --sheet-id 123456');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
