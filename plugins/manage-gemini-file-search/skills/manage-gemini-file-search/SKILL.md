---
name: manage-gemini-file-search
description: Manage Google Gemini File Search stores and documents. Create stores, upload/query/update/delete/replace documents, and track store inventory. Use when working with Gemini RAG, document search, or when user mentions file search stores, document indexing, or semantic search with Gemini.
---

<objective>
Manage Google Gemini File Search Tool for Retrieval Augmented Generation (RAG) operations. This skill enables creating document stores, uploading documents for semantic search, querying indexed content, and maintaining document repositories with version tracking.
</objective>

<standard_workflows>
**IMPORTANT:** Use the prebuilt TypeScript CLI tools in [references/tools/](references/tools/) for all operations.

## Standard Workflow 1: Create Store and Upload Documents

```bash
cd ~/.claude/skills/manage-gemini-file-search/references/tools

# Create a new store
npx ts-node create-store.ts "My-Knowledge-Base"

# Upload documents to the store
npx ts-node upload-document.ts "My-Knowledge-Base" ./manual.pdf
npx ts-node upload-document.ts "My-Knowledge-Base" ./guide.md --name "User Guide"
```

## Standard Workflow 2: Query with Full Excerpts

```bash
cd ~/.claude/skills/manage-gemini-file-search/references/tools

# Query the store - returns answer, sources, and excerpts
npx ts-node query-store.ts "My-Knowledge-Base" "What is the main topic?"
```

Output format:
```
======================================================================
QUERY RESULT
======================================================================

  Store: My-Knowledge-Base
  Query: What is the main topic?

======================================================================
ANSWER
======================================================================

[The generated answer text...]

======================================================================
SOURCES
======================================================================

  - Document-Name-1
  - Document-Name-2

======================================================================
EXCERPTS
======================================================================

[1] Document-Name-1
----------------------------------------------------------------------
[Exact text excerpt from the document...]

[2] Document-Name-2
----------------------------------------------------------------------
[Exact text excerpt from the document...]

======================================================================
```

## Standard Workflow 3: Common Operations

```bash
cd ~/.claude/skills/manage-gemini-file-search/references/tools

# List all stores
npx ts-node list-stores.ts

# List documents in a store
npx ts-node list-documents.ts "My-Knowledge-Base"

# Delete a store
npx ts-node delete-store.ts "My-Knowledge-Base" --force

# Remove specific document
npx ts-node remove-documents.ts "My-Knowledge-Base" "Document Name"

# Remove all documents from a store
npx ts-node remove-documents.ts "My-Knowledge-Base" --all --force
```

**All tools location:** `~/.claude/skills/manage-gemini-file-search/references/tools/`
</standard_workflows>

<typescript_tools>
## Prebuilt TypeScript CLI Tools

All operations are performed using the prebuilt TypeScript tools in [references/tools/](references/tools/).

### First-time Setup

```bash
cd ~/.claude/skills/manage-gemini-file-search/references/tools
npm install
```

### Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `list-stores.ts` | List all stores | `npx ts-node list-stores.ts` |
| `list-documents.ts` | List documents in store | `npx ts-node list-documents.ts my-store` |
| `create-store.ts` | Create a new store | `npx ts-node create-store.ts my-store` |
| `delete-store.ts` | Delete a store | `npx ts-node delete-store.ts my-store --force` |
| `upload-document.ts` | Upload a document | `npx ts-node upload-document.ts my-store ./file.pdf` |
| `upload-folder.ts` | Batch upload folder | `npx ts-node upload-folder.ts my-store ./docs` |
| `remove-documents.ts` | Remove documents | `npx ts-node remove-documents.ts my-store "Doc Name"` |
| `replace-document.ts` | Replace a document | `npx ts-node replace-document.ts my-store "Doc" ./new.pdf` |
| `query-store.ts` | Query a store | `npx ts-node query-store.ts my-store "question"` |
| `get-store-info.ts` | Get store details | `npx ts-node get-store-info.ts my-store` |
| `export-inventory.ts` | Export all stores/docs | `npx ts-node export-inventory.ts -o inventory.json` |

### Common Options

All tools support:
- `--json` or `-j`: Output in JSON format for programmatic use
- `--force` or `-f`: Skip confirmation prompts (where applicable)
- `--name` or `-n`: Custom display name (for upload-document)

### List All Stores

```bash
npx ts-node list-stores.ts           # Human-readable output
npx ts-node list-stores.ts --json    # JSON output
```

Example output:
```
============================================================
GEMINI FILE SEARCH STORES
============================================================

  Found 2 store(s):

  [1] my-knowledge-base
      API Name: fileSearchStores/abc123def456...
      Created:  12/28/2025, 3:45:00 PM

  [2] project-docs
      API Name: fileSearchStores/xyz789...
      Created:  12/27/2025, 10:30:00 AM

============================================================
```

### List Documents in a Store

```bash
npx ts-node list-documents.ts my-knowledge-base           # By display name
npx ts-node list-documents.ts "fileSearchStores/abc..."   # By API name
npx ts-node list-documents.ts my-knowledge-base --json    # JSON output
```

Example output:
```
============================================================
DOCUMENTS IN STORE: my-knowledge-base
============================================================

  Found 3 document(s):

  [OK] [1] Product Manual
        State: ACTIVE
        Size:  245.3 KB
        Type:  application/pdf
        Name:  fileSearchStores/abc.../documents/doc1...

  [OK] [2] FAQ Document
        State: ACTIVE
        Size:  12.8 KB
        Type:  text/plain
        Name:  fileSearchStores/abc.../documents/doc2...

  [...] [3] New Guide
        State: PENDING
        Size:  89.2 KB
        Type:  application/pdf
        Name:  fileSearchStores/abc.../documents/doc3...

============================================================

Legend: [OK] Active  [...] Pending  [X] Failed
```

### Create a New Store

```bash
npx ts-node create-store.ts my-knowledge-base              # Create with display name
npx ts-node create-store.ts "Project Documentation"        # Names with spaces
npx ts-node create-store.ts my-knowledge-base --json       # JSON output
```

Example output:
```
============================================================
STORE CREATED SUCCESSFULLY
============================================================

  Display Name: my-knowledge-base
  API Name:     fileSearchStores/abc123def456...
  Created:      12/29/2025, 10:30:00 AM

------------------------------------------------------------
  Next steps:

  1. Upload documents to this store:
     npx ts-node upload-document.ts "my-knowledge-base" /path/to/file.pdf

  2. List documents in this store:
     npx ts-node list-documents.ts "my-knowledge-base"

============================================================
```

### Delete a Store

```bash
npx ts-node delete-store.ts my-knowledge-base              # Delete by display name
npx ts-node delete-store.ts my-knowledge-base --force      # Skip confirmation
npx ts-node delete-store.ts my-knowledge-base --json       # JSON output
```

### Upload a Document

```bash
npx ts-node upload-document.ts my-knowledge-base ./manual.pdf              # Auto display name
npx ts-node upload-document.ts my-knowledge-base ./guide.md --name "Guide" # Custom name
npx ts-node upload-document.ts my-knowledge-base ./doc.pdf --json          # JSON output
```

Example output:
```
============================================================
UPLOADING DOCUMENT
============================================================

  Store:        my-knowledge-base
  File:         manual.pdf
  Display Name: manual.pdf
  Size:         245.3 KB

  Uploading.......

============================================================
DOCUMENT UPLOADED SUCCESSFULLY
============================================================

  Display Name:   manual.pdf
  Document Name:  fileSearchStores/abc.../documents/doc123...
  State:          ACTIVE
  Size:           245.3 KB
  MIME Type:      application/pdf

============================================================
```

### Query a Store

```bash
npx ts-node query-store.ts my-knowledge-base "What is the return policy?"
npx ts-node query-store.ts my-knowledge-base "How to configure auth?" --json
```

Example output:
```
======================================================================
QUERY RESULT
======================================================================

  Store: my-knowledge-base
  Query: What is the return policy?

======================================================================
ANSWER
======================================================================

Based on the documentation, the return policy allows returns within
30 days of purchase with original receipt...

======================================================================
SOURCES
======================================================================

  - Return-Policy-Document
  - FAQ-Guide

======================================================================
EXCERPTS
======================================================================

[1] Return-Policy-Document
----------------------------------------------------------------------
Returns are accepted within 30 days of the original purchase date.
Items must be in original condition with all tags attached...

======================================================================
```

### Remove Documents

```bash
npx ts-node remove-documents.ts my-knowledge-base "Product Manual"     # Single document
npx ts-node remove-documents.ts my-knowledge-base --all                # All documents
npx ts-node remove-documents.ts my-knowledge-base --all --force        # Skip confirmation
npx ts-node remove-documents.ts my-knowledge-base "Manual" --json      # JSON output
```

### Upload Folder (Batch Upload)

```bash
npx ts-node upload-folder.ts my-knowledge-base ./documents              # Upload all files
npx ts-node upload-folder.ts my-knowledge-base ./docs --pattern "*.md"  # Only markdown files
npx ts-node upload-folder.ts my-knowledge-base ./project -r -p "*.pdf"  # Recursive, PDFs only
npx ts-node upload-folder.ts my-knowledge-base ./docs --json            # JSON output
```

Options:
- `--pattern` or `-p`: Glob pattern to filter files (e.g., `"*.md"`, `"*.pdf"`)
- `--recursive` or `-r`: Include files in subdirectories
- `--json` or `-j`: JSON output

Example output:
```
============================================================
UPLOADING FOLDER
============================================================

  Store:     my-knowledge-base
  Folder:    /path/to/documents
  Pattern:   *.md
  Recursive: No
  Files:     5

------------------------------------------------------------
  [1/5] readme.md... OK
  [2/5] guide.md... OK
  [3/5] faq.md... OK
  [4/5] api.md... OK
  [5/5] changelog.md... OK

============================================================
FOLDER UPLOAD COMPLETED SUCCESSFULLY
============================================================

  Store:      my-knowledge-base
  Total:      5 files
  Success:    5
  Failed:     0

============================================================
```

### Replace Document

Replace an existing document with a new version (delete + re-upload):

```bash
npx ts-node replace-document.ts my-knowledge-base "Product Manual" ./manual-v2.pdf
npx ts-node replace-document.ts my-knowledge-base "Guide" ./guide.md --force
npx ts-node replace-document.ts my-knowledge-base "Doc" ./new.pdf --json
```

Example output:
```
============================================================
REPLACE DOCUMENT CONFIRMATION
============================================================

  Store:            my-knowledge-base
  Document:         Product Manual

  Current version:
    Size:           245.3 KB
    MIME Type:      application/pdf

  New version:
    File:           /path/to/manual-v2.pdf
    Size:           312.1 KB
    MIME Type:      application/pdf

  WARNING: The current document will be deleted!

  Are you sure? (y/N): y

  Step 1: Deleting existing document...
  Step 2: Uploading new document...... done

============================================================
DOCUMENT REPLACED SUCCESSFULLY
============================================================

  Store:            my-knowledge-base
  Document:         Product Manual
  New API Name:     fileSearchStores/abc.../documents/doc456...
  State:            ACTIVE
  Size:             312.1 KB
  MIME Type:        application/pdf

============================================================
```

### Get Store Info

Get detailed information about a store including statistics and document list:

```bash
npx ts-node get-store-info.ts my-knowledge-base
npx ts-node get-store-info.ts my-knowledge-base --json
```

Example output:
```
======================================================================
STORE INFORMATION
======================================================================

  Display Name:      my-knowledge-base
  API Name:          fileSearchStores/abc123...
  Created:           12/29/2025, 10:30:00 AM

----------------------------------------------------------------------
STATISTICS
----------------------------------------------------------------------

  Total Documents:   5
  Total Size:        1.2 MB

  Active:            4
  Pending:           1
  Failed:            0

----------------------------------------------------------------------
DOCUMENTS
----------------------------------------------------------------------

  [OK] [1] Product Manual
        State:     ACTIVE
        Size:      245.3 KB
        MIME Type: application/pdf

  [OK] [2] FAQ Guide
        State:     ACTIVE
        Size:      12.8 KB
        MIME Type: text/markdown

  [...] [3] New Document
        State:     PENDING
        Size:      89.2 KB
        MIME Type: application/pdf

  Legend: [OK] Active  [...] Pending  [X] Failed

======================================================================
```

### Export Inventory

Export a complete inventory of all stores and documents to JSON:

```bash
npx ts-node export-inventory.ts                             # Output to console
npx ts-node export-inventory.ts --output inventory.json     # Save to file
npx ts-node export-inventory.ts -o ~/backups/stores.json    # Save to specific path
```

Example output (when saving to file):
```
Fetching stores... found 3
  [1/3] my-knowledge-base... 5 docs
  [2/3] project-docs... 12 docs
  [3/3] test-store... 2 docs

============================================================
INVENTORY EXPORTED SUCCESSFULLY
============================================================

  Output File:      /path/to/inventory.json
  Export Date:      12/29/2025, 2:30:00 PM

  Total Stores:     3
  Total Documents:  19
  Total Size:       4.5 MB

------------------------------------------------------------
STORES SUMMARY
------------------------------------------------------------

  my-knowledge-base
    Documents: 5
    Size:      1.2 MB

  project-docs
    Documents: 12
    Size:      3.1 MB

  test-store
    Documents: 2
    Size:      200 KB

============================================================
```

JSON output structure:
```json
{
  "exportDate": "2025-12-29T14:30:00.000Z",
  "storeCount": 3,
  "totalDocuments": 19,
  "totalSizeBytes": 4718592,
  "stores": [
    {
      "displayName": "my-knowledge-base",
      "apiName": "fileSearchStores/abc123...",
      "createTime": "2025-12-28T10:00:00.000Z",
      "documentCount": 5,
      "totalSizeBytes": 1258291,
      "documents": [
        {
          "displayName": "Product Manual",
          "apiName": "fileSearchStores/abc.../documents/doc1...",
          "state": "ACTIVE",
          "sizeBytes": 251289,
          "mimeType": "application/pdf"
        }
      ]
    }
  ]
}
```

### Tool Location
All TypeScript tools are in: `~/.claude/skills/manage-gemini-file-search/references/tools/`
</typescript_tools>

<context>
<api_key>
The Gemini API key is stored in the `GEMINI_API_KEY` environment variable.

**Important**: If both `GOOGLE_API_KEY` and `GEMINI_API_KEY` are set, the library defaults to `GOOGLE_API_KEY`. The TypeScript tools handle this automatically by temporarily removing `GOOGLE_API_KEY` during initialization.

**TypeScript initialization pattern** (used in all tools):
```typescript
import { GoogleGenAI } from '@google/genai';

// Validate environment
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
}

// Temporarily remove GOOGLE_API_KEY to prevent library warning
const _googleKeyBackup = process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_API_KEY;

// Initialize client with explicit GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Restore GOOGLE_API_KEY if it was set
if (_googleKeyBackup) process.env.GOOGLE_API_KEY = _googleKeyBackup;
```
</api_key>

<store_tracking>
Stores and documents are tracked via the Gemini API directly. Use the CLI tools to list and manage:

```bash
# List all stores
npx ts-node list-stores.ts --json > stores.json

# List documents in a store
npx ts-node list-documents.ts my-store --json > documents.json
```
</store_tracking>

<supported_formats>
Documents: PDF, DOCX, XLSX, PPTX, ODT, RTF, JSON, XML
Text: TXT, CSV, TSV, MD, HTML, YAML
Code: 50+ languages (Python, JavaScript, TypeScript, Java, Go, etc.)
</supported_formats>

<limits>
- Max file size: 100 MB per document
- Max stores per query: 5
- Max stores per project: 10
- Max metadata entries: 20 per document
- Recommended store size: under 20 GB
</limits>
</context>

<quick_start>
<setup>
Set up the TypeScript tools:

```bash
cd ~/.claude/skills/manage-gemini-file-search/references/tools
npm install

# Ensure GEMINI_API_KEY is set
export GEMINI_API_KEY="your-api-key-here"
```
</setup>

<basic_operations>
**Create a store:**
```bash
npx ts-node create-store.ts my-knowledge-base
```

**Upload a document:**
```bash
npx ts-node upload-document.ts my-knowledge-base ./documents/manual.pdf --name "Product Manual"
```

**Query documents:**
```bash
npx ts-node query-store.ts my-knowledge-base "How do I reset the device?"
```

**List stores and documents:**
```bash
npx ts-node list-stores.ts
npx ts-node list-documents.ts my-knowledge-base
```
</basic_operations>
</quick_start>

<programmatic_usage>
## Using TypeScript Programmatically

For custom scripts, import from `@google/genai`:

### Initialize Client

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

### Create a Store

```typescript
const store = await ai.fileSearchStores.create({
    config: { displayName: 'my-knowledge-base' }
});
console.log(`Store created: ${store.name}`);
```

### Upload a Document

```typescript
const operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: './documents/manual.pdf',
    fileSearchStoreName: store.name,
    config: {
        displayName: 'Product Manual',
        mimeType: 'application/pdf'
    }
});

// Poll for completion
let currentOp = operation;
while (!currentOp.done) {
    await new Promise(r => setTimeout(r, 2000));
    currentOp = await ai.operations.get({ operation: currentOp });
}
```

### Query Documents

```typescript
const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'How do I reset the device?',
    config: {
        tools: [{
            fileSearch: {
                fileSearchStoreNames: [store.name]
            }
        }]
    }
});
console.log(response.text);
```

### List Stores

```typescript
const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
for (const store of pager.page) {
    console.log(`${store.displayName}: ${store.name}`);
}
```

### Find Store by Display Name

```typescript
async function findStore(displayName: string) {
    const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
    let page = pager.page;
    while (true) {
        for (const store of page) {
            if (store.displayName === displayName) return store;
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return null;
}
```

### Delete a Store

```typescript
await ai.fileSearchStores.delete({
    name: store.name,
    config: { force: true }  // Also deletes all documents
});
```

### List Documents in Store

```typescript
const docPager = await ai.fileSearchStores.documents.list({ parent: store.name });
for await (const doc of docPager) {
    console.log(`${doc.displayName} - ${doc.state} (${doc.sizeBytes} bytes)`);
}
```

### Delete a Document

```typescript
await ai.fileSearchStores.documents.delete({
    name: document.name,
    config: { force: true }
});
```

### Upload with Metadata

```typescript
const operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: './manual.pdf',
    fileSearchStoreName: store.name,
    config: {
        displayName: 'Engineering Manual',
        mimeType: 'application/pdf',
        customMetadata: [
            { key: 'author', stringValue: 'John Smith' },
            { key: 'department', stringValue: 'Engineering' },
            { key: 'year', numericValue: 2025 }
        ]
    }
});
```

### Query with Metadata Filter

```typescript
const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'What are the safety guidelines?',
    config: {
        tools: [{
            fileSearch: {
                fileSearchStoreNames: [store.name],
                metadataFilter: 'department="Engineering" AND year>=2024'
            }
        }]
    }
});
```

Filter syntax: `author="John"`, `year>=2024`, `department="Sales" OR department="Marketing"`, `tags:"manual"`

### Upload with Custom Chunking

```typescript
const operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: './technical-manual.pdf',
    fileSearchStoreName: store.name,
    config: {
        displayName: 'Technical Manual',
        mimeType: 'application/pdf',
        chunkingConfig: {
            whiteSpaceConfig: {
                maxTokensPerChunk: 500,    // 200-1000 typical
                maxOverlapTokens: 50       // Context overlap
            }
        }
    }
});
```

Chunking guidelines:
- 200-300 tokens: FAQ, short answers
- 500 tokens: General documents (default-like)
- 1000 tokens: Technical docs needing more context
</programmatic_usage>

<anti_patterns>
- **Never hardcode API keys** - Always use `GEMINI_API_KEY` environment variable
- **Never assume store exists** - Always check first with `list-stores.ts`
- **Never skip operation polling** - Upload operations are async; poll until done
- **Never modify documents in place** - Documents are immutable; delete and re-upload
- **Never exceed 10 stores** - There's a soft limit per project
- **Never forget cleanup** - Delete test stores to stay under quota
</anti_patterns>

<success_criteria>
- Store created with meaningful display name
- Documents uploaded and reach `ACTIVE` state
- Queries return relevant responses with citations
- Clean up of test/temporary stores performed
</success_criteria>
