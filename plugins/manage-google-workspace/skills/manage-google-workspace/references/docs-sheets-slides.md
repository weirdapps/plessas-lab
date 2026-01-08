# Google Docs, Sheets, and Slides API Reference (TypeScript)

Complete reference for working with Google Workspace document types in TypeScript.

## Google Docs API

### Create Document

```typescript
import { docs_v1 } from 'googleapis';

/**
 * Create a new Google Document.
 *
 * @param docsService - Docs API service instance
 * @param title - Document title
 * @returns Created document metadata
 */
export async function createDocument(
  docsService: docs_v1.Docs,
  title: string
): Promise<docs_v1.Schema$Document> {
  const response = await docsService.documents.create({
    requestBody: { title },
  });

  return response.data;
}
```

### Create Document with Content

```typescript
/**
 * Create a new Google Document with initial content.
 *
 * @param docsService - Docs API service instance
 * @param title - Document title
 * @param content - Initial text content
 * @returns Created document metadata
 */
export async function createDocumentWithContent(
  docsService: docs_v1.Docs,
  title: string,
  content: string
): Promise<docs_v1.Schema$Document> {
  const document = await createDocument(docsService, title);
  const documentId = document.documentId!;

  const requests: docs_v1.Schema$Request[] = [
    {
      insertText: {
        location: { index: 1 },
        text: content,
      },
    },
  ];

  await docsService.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });

  return document;
}
```

### Create Document in Folder

```typescript
import { drive_v3 } from 'googleapis';

/**
 * Create a document in a specific folder.
 *
 * @param driveService - Drive API service instance
 * @param docsService - Docs API service instance
 * @param title - Document title
 * @param folderId - Parent folder ID
 * @returns Created document metadata
 */
export async function createDocumentInFolder(
  driveService: drive_v3.Drive,
  docsService: docs_v1.Docs,
  title: string,
  folderId: string
): Promise<docs_v1.Schema$Document> {
  const document = await createDocument(docsService, title);
  const documentId = document.documentId!;

  // Move to folder using Drive API
  const file = await driveService.files.get({
    fileId: documentId,
    fields: 'parents',
  });
  const previousParents = (file.data.parents || []).join(',');

  await driveService.files.update({
    fileId: documentId,
    addParents: folderId,
    removeParents: previousParents,
  });

  return document;
}
```

### Read Document

```typescript
/**
 * Get a document's full content.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @returns Document object with content
 */
export async function getDocument(
  docsService: docs_v1.Docs,
  documentId: string
): Promise<docs_v1.Schema$Document> {
  const response = await docsService.documents.get({
    documentId,
  });

  return response.data;
}

/**
 * Extract plain text from a document.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @returns Plain text content of the document
 */
export async function getDocumentText(
  docsService: docs_v1.Docs,
  documentId: string
): Promise<string> {
  const document = await getDocument(docsService, documentId);
  const textContent: string[] = [];

  function extractText(elements: docs_v1.Schema$StructuralElement[]): void {
    for (const element of elements) {
      if (element.paragraph) {
        for (const paraElement of element.paragraph.elements || []) {
          if (paraElement.textRun) {
            textContent.push(paraElement.textRun.content || '');
          }
        }
      } else if (element.table) {
        for (const row of element.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            extractText(cell.content || []);
          }
        }
      }
    }
  }

  const body = document.body;
  if (body?.content) {
    extractText(body.content);
  }

  return textContent.join('');
}
```

### Get Document Summary

```typescript
export interface DocumentSummary {
  title: string | null | undefined;
  documentId: string;
  summary: string;
  totalLength: number;
}

/**
 * Get a summary of document content (first N characters).
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @param maxChars - Maximum characters to return
 * @returns Dictionary with title and summary
 */
export async function getDocumentSummary(
  docsService: docs_v1.Docs,
  documentId: string,
  maxChars: number = 500
): Promise<DocumentSummary> {
  const document = await getDocument(docsService, documentId);
  const text = await getDocumentText(docsService, documentId);

  let summary = text.slice(0, maxChars).trim();
  if (text.length > maxChars) {
    summary += '...';
  }

  return {
    title: document.title,
    documentId,
    summary,
    totalLength: text.length,
  };
}
```

### Get Document Structure

```typescript
export interface HeadingInfo {
  level: string;
  text: string;
}

export interface DocumentStructure {
  title: string | null | undefined;
  headings: HeadingInfo[];
  lists: number;
  tables: number;
  images: number;
}

/**
 * Get the structural elements of a document (headings, lists, tables).
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @returns Dictionary with document structure
 */
export async function getDocumentStructure(
  docsService: docs_v1.Docs,
  documentId: string
): Promise<DocumentStructure> {
  const document = await getDocument(docsService, documentId);

  const structure: DocumentStructure = {
    title: document.title,
    headings: [],
    lists: 0,
    tables: 0,
    images: 0,
  };

  const body = document.body;

  for (const element of body?.content || []) {
    if (element.paragraph) {
      const paragraph = element.paragraph;
      const style = paragraph.paragraphStyle?.namedStyleType || '';

      if (style.startsWith('HEADING')) {
        let text = '';
        for (const paraElement of paragraph.elements || []) {
          if (paraElement.textRun) {
            text += paraElement.textRun.content || '';
          }
        }

        structure.headings.push({
          level: style,
          text: text.trim(),
        });
      }

      // Check for inline objects (images)
      for (const paraElement of paragraph.elements || []) {
        if (paraElement.inlineObjectElement) {
          structure.images += 1;
        }
      }
    } else if (element.table) {
      structure.tables += 1;
    }
  }

  return structure;
}
```

### Update Document

```typescript
/**
 * Append text to the end of a document.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @param text - Text to append
 */
export async function appendText(
  docsService: docs_v1.Docs,
  documentId: string,
  text: string
): Promise<void> {
  const document = await getDocument(docsService, documentId);
  const content = document.body?.content || [];
  const endIndex = content[content.length - 1]?.endIndex || 1;
  const insertIndex = endIndex - 1;

  const requests: docs_v1.Schema$Request[] = [
    {
      insertText: {
        location: { index: insertIndex },
        text,
      },
    },
  ];

  await docsService.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}

/**
 * Insert text at a specific position in the document.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @param text - Text to insert
 * @param index - Position to insert at (1-based)
 */
export async function insertTextAtPosition(
  docsService: docs_v1.Docs,
  documentId: string,
  text: string,
  index: number
): Promise<void> {
  const requests: docs_v1.Schema$Request[] = [
    {
      insertText: {
        location: { index },
        text,
      },
    },
  ];

  await docsService.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}

/**
 * Replace all occurrences of text in a document.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @param oldText - Text to find
 * @param newText - Replacement text
 * @returns Number of replacements made
 */
export async function replaceText(
  docsService: docs_v1.Docs,
  documentId: string,
  oldText: string,
  newText: string
): Promise<number> {
  const requests: docs_v1.Schema$Request[] = [
    {
      replaceAllText: {
        containsText: {
          text: oldText,
          matchCase: true,
        },
        replaceText: newText,
      },
    },
  ];

  const response = await docsService.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });

  const replies = response.data.replies || [];
  if (replies.length > 0) {
    return replies[0].replaceAllText?.occurrencesChanged || 0;
  }
  return 0;
}

/**
 * Delete content in a specific range.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @param startIndex - Start index (1-based)
 * @param endIndex - End index
 */
export async function deleteContentRange(
  docsService: docs_v1.Docs,
  documentId: string,
  startIndex: number,
  endIndex: number
): Promise<void> {
  const requests: docs_v1.Schema$Request[] = [
    {
      deleteContentRange: {
        range: {
          startIndex,
          endIndex,
        },
      },
    },
  ];

  await docsService.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}

/**
 * Add a heading to the end of the document.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @param text - Heading text
 * @param headingLevel - Heading level (1-6)
 */
export async function addHeading(
  docsService: docs_v1.Docs,
  documentId: string,
  text: string,
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6 = 1
): Promise<void> {
  const document = await getDocument(docsService, documentId);
  const content = document.body?.content || [];
  const endIndex = content[content.length - 1]?.endIndex || 1;
  const insertIndex = endIndex - 1;

  const headingStyles: Record<number, string> = {
    1: 'HEADING_1',
    2: 'HEADING_2',
    3: 'HEADING_3',
    4: 'HEADING_4',
    5: 'HEADING_5',
    6: 'HEADING_6',
  };

  const requests: docs_v1.Schema$Request[] = [
    {
      insertText: {
        location: { index: insertIndex },
        text: text + '\n',
      },
    },
    {
      updateParagraphStyle: {
        range: {
          startIndex: insertIndex,
          endIndex: insertIndex + text.length + 1,
        },
        paragraphStyle: {
          namedStyleType: headingStyles[headingLevel],
        },
        fields: 'namedStyleType',
      },
    },
  ];

  await docsService.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}
```

### Search in Document

```typescript
export interface TextMatch {
  position: number;
  context: string;
  match: string;
}

/**
 * Search for text within a document.
 *
 * @param docsService - Docs API service instance
 * @param documentId - ID of the document
 * @param searchText - Text to search for
 * @returns List of matches with context
 */
export async function searchInDocument(
  docsService: docs_v1.Docs,
  documentId: string,
  searchText: string
): Promise<TextMatch[]> {
  const text = await getDocumentText(docsService, documentId);

  const matches: TextMatch[] = [];
  const searchLower = searchText.toLowerCase();
  const textLower = text.toLowerCase();

  let start = 0;
  while (true) {
    const index = textLower.indexOf(searchLower, start);
    if (index === -1) break;

    const contextStart = Math.max(0, index - 50);
    const contextEnd = Math.min(text.length, index + searchText.length + 50);

    matches.push({
      position: index,
      context: text.slice(contextStart, contextEnd),
      match: text.slice(index, index + searchText.length),
    });

    start = index + 1;
  }

  return matches;
}
```

---

## Google Sheets API

### Create Spreadsheet

```typescript
import { sheets_v4 } from 'googleapis';

/**
 * Create a new Google Spreadsheet.
 *
 * @param sheetsService - Sheets API service instance
 * @param title - Spreadsheet title
 * @returns Created spreadsheet metadata
 */
export async function createSpreadsheet(
  sheetsService: sheets_v4.Sheets,
  title: string
): Promise<sheets_v4.Schema$Spreadsheet> {
  const spreadsheet: sheets_v4.Schema$Spreadsheet = {
    properties: {
      title,
    },
  };

  const response = await sheetsService.spreadsheets.create({
    requestBody: spreadsheet,
    fields: 'spreadsheetId,spreadsheetUrl',
  });

  return response.data;
}

/**
 * Create a spreadsheet with multiple named sheets.
 *
 * @param sheetsService - Sheets API service instance
 * @param title - Spreadsheet title
 * @param sheetNames - List of sheet names
 * @returns Created spreadsheet metadata
 */
export async function createSpreadsheetWithSheets(
  sheetsService: sheets_v4.Sheets,
  title: string,
  sheetNames: string[]
): Promise<sheets_v4.Schema$Spreadsheet> {
  const sheets: sheets_v4.Schema$Sheet[] = sheetNames.map(name => ({
    properties: { title: name },
  }));

  const spreadsheet: sheets_v4.Schema$Spreadsheet = {
    properties: { title },
    sheets,
  };

  const response = await sheetsService.spreadsheets.create({
    requestBody: spreadsheet,
    fields: 'spreadsheetId,spreadsheetUrl,sheets.properties',
  });

  return response.data;
}

/**
 * Create a spreadsheet and populate it with data.
 *
 * @param sheetsService - Sheets API service instance
 * @param title - Spreadsheet title
 * @param data - 2D array of values
 * @param sheetName - Name of the sheet
 * @returns Created spreadsheet metadata
 */
export async function createSpreadsheetWithData(
  sheetsService: sheets_v4.Sheets,
  title: string,
  data: any[][],
  sheetName: string = 'Sheet1'
): Promise<sheets_v4.Schema$Spreadsheet> {
  const spreadsheet = await createSpreadsheet(sheetsService, title);
  const spreadsheetId = spreadsheet.spreadsheetId!;

  await writeValues(sheetsService, spreadsheetId, `${sheetName}!A1`, data);

  return spreadsheet;
}
```

### Read Data

```typescript
/**
 * Get spreadsheet metadata.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @returns Spreadsheet metadata
 */
export async function getSpreadsheet(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<sheets_v4.Schema$Spreadsheet> {
  const response = await sheetsService.spreadsheets.get({
    spreadsheetId,
  });

  return response.data;
}

/**
 * Read values from a spreadsheet range.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param rangeName - A1 notation range (e.g., 'Sheet1!A1:D10')
 * @returns 2D array of values
 */
export async function readValues(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  rangeName: string
): Promise<any[][]> {
  const response = await sheetsService.spreadsheets.values.get({
    spreadsheetId,
    range: rangeName,
  });

  return response.data.values || [];
}

/**
 * Read all values from a sheet.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param sheetName - Name of the sheet
 * @returns 2D array of all values
 */
export async function readAllValues(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string = 'Sheet1'
): Promise<any[][]> {
  return readValues(sheetsService, spreadsheetId, sheetName);
}

/**
 * Read multiple ranges at once.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param ranges - List of A1 notation ranges
 * @returns Dictionary mapping ranges to values
 */
export async function readMultipleRanges(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  ranges: string[]
): Promise<Record<string, any[][]>> {
  const response = await sheetsService.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  const result: Record<string, any[][]> = {};
  for (const vr of response.data.valueRanges || []) {
    if (vr.range) {
      result[vr.range] = vr.values || [];
    }
  }

  return result;
}
```

### Get Sheet Summary

```typescript
export interface SheetSummary {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetSummary {
  title: string | null | undefined;
  spreadsheetId: string;
  url: string | null | undefined;
  sheets: SheetSummary[];
}

/**
 * Get a summary of the spreadsheet.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @returns Dictionary with spreadsheet summary
 */
export async function getSheetSummary(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<SpreadsheetSummary> {
  const spreadsheet = await getSpreadsheet(sheetsService, spreadsheetId);

  const summary: SpreadsheetSummary = {
    title: spreadsheet.properties?.title,
    spreadsheetId,
    url: spreadsheet.spreadsheetUrl,
    sheets: [],
  };

  for (const sheet of spreadsheet.sheets || []) {
    const props = sheet.properties;
    const gridProps = props?.gridProperties;

    summary.sheets.push({
      sheetId: props?.sheetId || 0,
      title: props?.title || '',
      rowCount: gridProps?.rowCount || 0,
      columnCount: gridProps?.columnCount || 0,
    });
  }

  return summary;
}
```

### Write Data

```typescript
/**
 * Write values to a spreadsheet range.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param rangeName - A1 notation range
 * @param values - 2D array of values
 * @returns Update result
 */
export async function writeValues(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  rangeName: string,
  values: any[][]
): Promise<sheets_v4.Schema$UpdateValuesResponse> {
  const response = await sheetsService.spreadsheets.values.update({
    spreadsheetId,
    range: rangeName,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  return response.data;
}

/**
 * Append values after the last row of data.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param rangeName - A1 notation range (determines columns)
 * @param values - 2D array of values to append
 * @returns Append result
 */
export async function appendValues(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  rangeName: string,
  values: any[][]
): Promise<sheets_v4.Schema$AppendValuesResponse> {
  const response = await sheetsService.spreadsheets.values.append({
    spreadsheetId,
    range: rangeName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  return response.data;
}

/**
 * Clear values from a range.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param rangeName - A1 notation range
 */
export async function clearValues(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  rangeName: string
): Promise<void> {
  await sheetsService.spreadsheets.values.clear({
    spreadsheetId,
    range: rangeName,
  });
}

/**
 * Update multiple ranges at once.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param data - Dictionary mapping ranges to values
 * @returns Update result
 */
export async function updateMultipleRanges(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  data: Record<string, any[][]>
): Promise<sheets_v4.Schema$BatchUpdateValuesResponse> {
  const valueRanges: sheets_v4.Schema$ValueRange[] = Object.entries(data).map(
    ([range, values]) => ({ range, values })
  );

  const response = await sheetsService.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: valueRanges,
    },
  });

  return response.data;
}
```

### Sheet Management

```typescript
/**
 * Add a new sheet to a spreadsheet.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param sheetName - Name for the new sheet
 * @returns New sheet properties
 */
export async function addSheet(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<sheets_v4.Schema$SheetProperties> {
  const requests: sheets_v4.Schema$Request[] = [
    {
      addSheet: {
        properties: {
          title: sheetName,
        },
      },
    },
  ];

  const response = await sheetsService.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return response.data.replies![0].addSheet!.properties!;
}

/**
 * Delete a sheet from a spreadsheet.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param sheetId - ID of the sheet to delete
 */
export async function deleteSheet(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number
): Promise<void> {
  const requests: sheets_v4.Schema$Request[] = [
    {
      deleteSheet: {
        sheetId,
      },
    },
  ];

  await sheetsService.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}
```

### Search in Spreadsheet

```typescript
export interface CellMatch {
  cell: string;
  row: number;
  column: number;
  value: any;
}

/**
 * Find cells containing specific text.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param searchText - Text to search for
 * @param sheetName - Sheet to search
 * @returns List of matches with cell references
 */
export async function findInSheet(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  searchText: string,
  sheetName: string = 'Sheet1'
): Promise<CellMatch[]> {
  const values = await readAllValues(sheetsService, spreadsheetId, sheetName);

  const matches: CellMatch[] = [];
  const searchLower = searchText.toLowerCase();

  for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
    const row = values[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx];
      if (String(cell).toLowerCase().includes(searchLower)) {
        const colLetter = colIdx < 26
          ? String.fromCharCode('A'.charCodeAt(0) + colIdx)
          : String.fromCharCode('A'.charCodeAt(0) + Math.floor(colIdx / 26) - 1) +
            String.fromCharCode('A'.charCodeAt(0) + (colIdx % 26));

        matches.push({
          cell: `${colLetter}${rowIdx + 1}`,
          row: rowIdx + 1,
          column: colIdx + 1,
          value: cell,
        });
      }
    }
  }

  return matches;
}

/**
 * Query sheet data with column filters.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param columnFilters - Dict of {column_index: filter_value}
 * @param sheetName - Sheet to query
 * @returns Filtered rows
 */
export async function querySheet(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  columnFilters: Record<number, string>,
  sheetName: string = 'Sheet1'
): Promise<Record<string, any>[]> {
  const values = await readAllValues(sheetsService, spreadsheetId, sheetName);

  if (values.length === 0) {
    return [];
  }

  const headers = values[0] || [];
  const results: Record<string, any>[] = [];

  for (const row of values.slice(1)) {
    let match = true;
    for (const [colIdx, filterValue] of Object.entries(columnFilters)) {
      const idx = parseInt(colIdx);
      if (idx >= row.length) {
        match = false;
        break;
      }
      if (!String(row[idx]).toLowerCase().includes(filterValue.toLowerCase())) {
        match = false;
        break;
      }
    }

    if (match) {
      const rowObj: Record<string, any> = {};
      headers.forEach((header, i) => {
        rowObj[header] = row[i];
      });
      results.push(rowObj);
    }
  }

  return results;
}

/**
 * Get all values from a specific column.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param column - Column letter (e.g., 'A') or index (0-based)
 * @param sheetName - Sheet name
 * @returns List of column values
 */
export async function getColumnValues(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  column: string | number,
  sheetName: string = 'Sheet1'
): Promise<any[]> {
  let colLetter: string;
  if (typeof column === 'number') {
    colLetter = String.fromCharCode('A'.charCodeAt(0) + column);
  } else {
    colLetter = column;
  }

  const rangeName = `${sheetName}!${colLetter}:${colLetter}`;
  const values = await readValues(sheetsService, spreadsheetId, rangeName);

  return values.map(row => row[0] || '');
}

/**
 * Find a row by a value in a specific column.
 *
 * @param sheetsService - Sheets API service instance
 * @param spreadsheetId - ID of the spreadsheet
 * @param column - Column to search
 * @param value - Value to find
 * @param sheetName - Sheet name
 * @returns Row data as dictionary (with headers) or null
 */
export async function findRowByValue(
  sheetsService: sheets_v4.Sheets,
  spreadsheetId: string,
  column: string | number,
  value: any,
  sheetName: string = 'Sheet1'
): Promise<Record<string, any> | null> {
  const values = await readAllValues(sheetsService, spreadsheetId, sheetName);

  if (values.length < 2) {
    return null;
  }

  const headers = values[0];

  let colIdx: number;
  if (typeof column === 'string') {
    colIdx = column.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  } else {
    colIdx = column;
  }

  for (const row of values.slice(1)) {
    if (colIdx < row.length && String(row[colIdx]) === String(value)) {
      const rowObj: Record<string, any> = {};
      headers.forEach((header, i) => {
        rowObj[header] = row[i];
      });
      return rowObj;
    }
  }

  return null;
}
```

---

## Google Slides API

### Create Presentation

```typescript
import { slides_v1 } from 'googleapis';

/**
 * Create a new Google Slides presentation.
 *
 * @param slidesService - Slides API service instance
 * @param title - Presentation title
 * @returns Created presentation metadata
 */
export async function createPresentation(
  slidesService: slides_v1.Slides,
  title: string
): Promise<slides_v1.Schema$Presentation> {
  const presentation: slides_v1.Schema$Presentation = {
    title,
  };

  const response = await slidesService.presentations.create({
    requestBody: presentation,
  });

  return response.data;
}

/**
 * Create a presentation with multiple blank slides.
 *
 * @param slidesService - Slides API service instance
 * @param title - Presentation title
 * @param slideCount - Number of slides to create
 * @returns Created presentation
 */
export async function createPresentationWithSlides(
  slidesService: slides_v1.Slides,
  title: string,
  slideCount: number = 5
): Promise<slides_v1.Schema$Presentation> {
  const presentation = await createPresentation(slidesService, title);
  const presentationId = presentation.presentationId!;

  const requests: slides_v1.Schema$Request[] = [];
  for (let i = 0; i < slideCount - 1; i++) {
    requests.push({
      createSlide: {
        insertionIndex: i + 1,
        slideLayoutReference: {
          predefinedLayout: 'BLANK',
        },
      },
    });
  }

  if (requests.length > 0) {
    await slidesService.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
  }

  return presentation;
}
```

### Read Presentation

```typescript
/**
 * Get presentation metadata and content.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @returns Presentation object
 */
export async function getPresentation(
  slidesService: slides_v1.Slides,
  presentationId: string
): Promise<slides_v1.Schema$Presentation> {
  const response = await slidesService.presentations.get({
    presentationId,
  });

  return response.data;
}

export interface SlideInfo {
  slideNumber: number;
  objectId: string;
  textContent: string[];
}

export interface PresentationSummary {
  title: string | null | undefined;
  presentationId: string;
  slideCount: number;
  slides: SlideInfo[];
}

/**
 * Get a summary of the presentation.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @returns Dictionary with presentation summary
 */
export async function getPresentationSummary(
  slidesService: slides_v1.Slides,
  presentationId: string
): Promise<PresentationSummary> {
  const presentation = await getPresentation(slidesService, presentationId);

  const summary: PresentationSummary = {
    title: presentation.title,
    presentationId,
    slideCount: presentation.slides?.length || 0,
    slides: [],
  };

  for (let idx = 0; idx < (presentation.slides || []).length; idx++) {
    const slide = presentation.slides![idx];
    const slideInfo: SlideInfo = {
      slideNumber: idx + 1,
      objectId: slide.objectId!,
      textContent: [],
    };

    for (const element of slide.pageElements || []) {
      if (element.shape?.text) {
        const textElements = element.shape.text.textElements || [];
        for (const textEl of textElements) {
          if (textEl.textRun) {
            const content = (textEl.textRun.content || '').trim();
            if (content) {
              slideInfo.textContent.push(content);
            }
          }
        }
      }
    }

    summary.slides.push(slideInfo);
  }

  return summary;
}

/**
 * Get all text content from a specific slide.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @param slideIndex - Index of the slide (0-based)
 * @returns List of text strings from the slide
 */
export async function getSlideText(
  slidesService: slides_v1.Slides,
  presentationId: string,
  slideIndex: number = 0
): Promise<string[]> {
  const presentation = await getPresentation(slidesService, presentationId);
  const slides = presentation.slides || [];

  if (slideIndex >= slides.length) {
    return [];
  }

  const slide = slides[slideIndex];
  const textContent: string[] = [];

  for (const element of slide.pageElements || []) {
    if (element.shape?.text) {
      const textElements = element.shape.text.textElements || [];
      for (const textEl of textElements) {
        if (textEl.textRun) {
          const content = (textEl.textRun.content || '').trim();
          if (content) {
            textContent.push(content);
          }
        }
      }
    }
  }

  return textContent;
}

/**
 * Get all text content from the entire presentation.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @returns Dictionary mapping slide numbers to text content
 */
export async function getAllPresentationText(
  slidesService: slides_v1.Slides,
  presentationId: string
): Promise<Record<number, string[]>> {
  const presentation = await getPresentation(slidesService, presentationId);
  const allText: Record<number, string[]> = {};

  for (let idx = 0; idx < (presentation.slides || []).length; idx++) {
    const slide = presentation.slides![idx];
    const slideText: string[] = [];

    for (const element of slide.pageElements || []) {
      if (element.shape?.text) {
        const textElements = element.shape.text.textElements || [];
        for (const textEl of textElements) {
          if (textEl.textRun) {
            const content = (textEl.textRun.content || '').trim();
            if (content) {
              slideText.push(content);
            }
          }
        }
      }
    }

    allText[idx + 1] = slideText;
  }

  return allText;
}
```

### Update Presentation

```typescript
import { v4 as uuidv4 } from 'uuid';

export type PredefinedLayout = 'BLANK' | 'TITLE' | 'TITLE_AND_BODY' | 'TITLE_AND_TWO_COLUMNS' | 'TITLE_ONLY' | 'SECTION_HEADER' | 'SECTION_TITLE_AND_DESCRIPTION' | 'ONE_COLUMN_TEXT' | 'MAIN_POINT' | 'BIG_NUMBER';

/**
 * Add a new slide to the presentation.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @param layout - Slide layout (BLANK, TITLE, TITLE_AND_BODY, etc.)
 * @param insertionIndex - Position to insert (undefined = end)
 * @returns Created slide info
 */
export async function addSlide(
  slidesService: slides_v1.Slides,
  presentationId: string,
  layout: PredefinedLayout = 'BLANK',
  insertionIndex?: number
): Promise<slides_v1.Schema$CreateSlideResponse> {
  const request: slides_v1.Schema$Request = {
    createSlide: {
      slideLayoutReference: {
        predefinedLayout: layout,
      },
    },
  };

  if (insertionIndex !== undefined) {
    request.createSlide!.insertionIndex = insertionIndex;
  }

  const response = await slidesService.presentations.batchUpdate({
    presentationId,
    requestBody: { requests: [request] },
  });

  return response.data.replies![0].createSlide!;
}

/**
 * Delete a slide from the presentation.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @param slideObjectId - Object ID of the slide to delete
 */
export async function deleteSlide(
  slidesService: slides_v1.Slides,
  presentationId: string,
  slideObjectId: string
): Promise<void> {
  const requests: slides_v1.Schema$Request[] = [
    {
      deleteObject: {
        objectId: slideObjectId,
      },
    },
  ];

  await slidesService.presentations.batchUpdate({
    presentationId,
    requestBody: { requests },
  });
}

/**
 * Add a text box to a slide.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @param slideObjectId - Object ID of the slide
 * @param text - Text content
 * @param x - X position in points
 * @param y - Y position in points
 * @param width - Width in points
 * @param height - Height in points
 * @returns Created element info
 */
export async function addTextBox(
  slidesService: slides_v1.Slides,
  presentationId: string,
  slideObjectId: string,
  text: string,
  x: number = 100,
  y: number = 100,
  width: number = 300,
  height: number = 50
): Promise<slides_v1.Schema$BatchUpdatePresentationResponse> {
  const elementId = `textbox_${uuidv4().slice(0, 8)}`;

  const requests: slides_v1.Schema$Request[] = [
    {
      createShape: {
        objectId: elementId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideObjectId,
          size: {
            width: { magnitude: width, unit: 'PT' },
            height: { magnitude: height, unit: 'PT' },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: x,
            translateY: y,
            unit: 'PT',
          },
        },
      },
    },
    {
      insertText: {
        objectId: elementId,
        text,
      },
    },
  ];

  const response = await slidesService.presentations.batchUpdate({
    presentationId,
    requestBody: { requests },
  });

  return response.data;
}

/**
 * Replace all occurrences of text in the presentation.
 *
 * @param slidesService - Slides API service instance
 * @param presentationId - ID of the presentation
 * @param oldText - Text to find
 * @param newText - Replacement text
 * @returns Number of replacements
 */
export async function replaceTextInPresentation(
  slidesService: slides_v1.Slides,
  presentationId: string,
  oldText: string,
  newText: string
): Promise<number> {
  const requests: slides_v1.Schema$Request[] = [
    {
      replaceAllText: {
        containsText: {
          text: oldText,
          matchCase: true,
        },
        replaceText: newText,
      },
    },
  ];

  const response = await slidesService.presentations.batchUpdate({
    presentationId,
    requestBody: { requests },
  });

  const replies = response.data.replies || [];
  if (replies.length > 0) {
    return replies[0].replaceAllText?.occurrencesChanged || 0;
  }
  return 0;
}
```

---

## Getting Service Instances

```typescript
import { getAllServices } from './google-workspace-auth';

const services = await getAllServices();
const driveService = services.drive;
const docsService = services.docs;
const sheetsService = services.sheets;
const slidesService = services.slides;
```

## Slide Layouts Reference

| Layout | Description |
|--------|-------------|
| `BLANK` | Empty slide |
| `TITLE` | Title slide with large title |
| `TITLE_AND_BODY` | Title with body content |
| `TITLE_AND_TWO_COLUMNS` | Title with two-column body |
| `TITLE_ONLY` | Title only at top |
| `SECTION_HEADER` | Section divider slide |
| `SECTION_TITLE_AND_DESCRIPTION` | Section title with description |
| `ONE_COLUMN_TEXT` | Single column text layout |
| `MAIN_POINT` | Main point emphasis layout |
| `BIG_NUMBER` | Large number emphasis layout |
