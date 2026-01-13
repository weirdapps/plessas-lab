---
name: manage-google-workspace
description: Manage Google Workspace files, folders, and documents using TypeScript CLI tools. Full support for Google Drive (list, search, upload, download, organize), Google Docs (create, read, edit, search), Google Sheets (CRUD, queries, multi-range operations), and Google Slides (presentations, slides, text). Manage sharing permissions. Use when user needs to interact with Google Drive or any Google Workspace document types.
---

<objective>
Enable Claude Code to interact with Google Workspace using prebuilt TypeScript CLI tools. This skill provides comprehensive management of Google Drive files/folders, Google Docs documents, Google Sheets spreadsheets, and Google Slides presentations using the Google Workspace APIs.
</objective>

<context>
**Credentials location**: `~/.google-skills/drive/`
- `DriveSkill-Credentials.json` - OAuth client credentials (required)
- `token.json` - Stored access token (auto-refreshed)

**Setup**: Install dependencies once:
```bash
cd ~/.claude/skills/manage-google-workspace/tools
npm install
```

**First-time authentication**: Running any tool for the first time will automatically open a browser for OAuth consent. Grant the requested permissions to proceed.

**Required OAuth scopes** (already configured):
- `https://www.googleapis.com/auth/drive` - Full Drive access
- `https://www.googleapis.com/auth/documents` - Docs access
- `https://www.googleapis.com/auth/spreadsheets` - Sheets access
- `https://www.googleapis.com/auth/presentations` - Slides access
</context>

<quick_start>
**List recent files**:
```bash
npx tsx ~/.claude/skills/manage-google-workspace/tools/drive-list-files.ts \
  --limit 10 --order-by "modifiedTime desc"
```

**Search for files**:
```bash
# By name
npx tsx ~/.claude/skills/manage-google-workspace/tools/drive-search.ts \
  --name "report" --type all

# Find Google Docs
npx tsx ~/.claude/skills/manage-google-workspace/tools/drive-search.ts \
  --type docs --name "meeting"

# Recent files
npx tsx ~/.claude/skills/manage-google-workspace/tools/drive-search.ts \
  --recent 7
```

**Download a file**:
```bash
npx tsx ~/.claude/skills/manage-google-workspace/tools/drive-download.ts \
  --id "abc123" --output /tmp/myfile.pdf
```

**Export Google Doc as PDF**:
```bash
npx tsx ~/.claude/skills/manage-google-workspace/tools/drive-export.ts \
  --id "abc123" --format pdf --output /tmp/document.pdf
```

**Upload a file**:
```bash
npx tsx ~/.claude/skills/manage-google-workspace/tools/drive-upload.ts \
  --file /path/to/file.pdf --name "My Document.pdf"
```

**Read spreadsheet values**:
```bash
npx tsx ~/.claude/skills/manage-google-workspace/tools/sheets-manage.ts \
  --action read --id "spreadsheet_id" --range "Sheet1!A1:D10"
```
</quick_start>

<prebuilt_tools>
**Location**: `~/.claude/skills/manage-google-workspace/tools/`

| Tool | Purpose |
|------|---------|
| `drive-list-files.ts` | List files with query, pagination, ordering |
| `drive-search.ts` | Search by name, type, folder, recent, full-text |
| `drive-get-file.ts` | Get detailed file metadata |
| `drive-download.ts` | Download binary files |
| `drive-export.ts` | Export Google files to PDF/DOCX/XLSX/etc. |
| `drive-upload.ts` | Upload files to Drive |
| `drive-folder.ts` | Create folders and folder paths |
| `drive-move.ts` | Move files between folders |
| `drive-copy.ts` | Copy files |
| `drive-delete.ts` | Delete, trash, or restore files |
| `drive-permissions.ts` | Manage sharing permissions |
| `docs-manage.ts` | Google Docs: full CRUD, search, structure analysis, headings |
| `sheets-manage.ts` | Google Sheets: full CRUD, search, query, multi-range, sheet management |
| `slides-manage.ts` | Google Slides: full CRUD, slide management, text boxes, replace text |
| `google-drive-client.ts` | Shared client library (not a CLI tool) |

All tools:
- Read credentials from `~/.google-skills/drive/` (throws if missing)
- Support standard Google Drive API features
- Include proper error handling
- Output human-readable status with `--json` option for programmatic use
</prebuilt_tools>

<workflows>
<file_operations>
**List files with custom query**:
```bash
npx tsx drive-list-files.ts --query "name contains 'report' and trashed = false" --limit 50
```

**Get file metadata**:
```bash
npx tsx drive-get-file.ts --id "file_id" --json
```

**Download vs Export**:
- Use `drive-download.ts` for binary files (PDFs, images, etc.)
- Use `drive-export.ts` for Google Workspace files (Docs, Sheets, Slides)

**Upload with options**:
```bash
npx tsx drive-upload.ts --file "./report.pdf" --name "Q4 Report" --parent "folder_id"
```
</file_operations>

<search_operations>
**Search by type**:
```bash
# Find all Google Docs
npx tsx drive-search.ts --type docs

# Find sheets containing "budget"
npx tsx drive-search.ts --type sheets --name "budget"

# Find folders
npx tsx drive-search.ts --type folders --name "Projects"
```

**Search filters**:
```bash
# Files in a specific folder
npx tsx drive-search.ts --in-folder "folder_id"

# Files shared with me
npx tsx drive-search.ts --shared

# Recently modified files
npx tsx drive-search.ts --recent 7

# Full text search
npx tsx drive-search.ts --full-text "quarterly sales"

# Find files by owner email
npx tsx drive-search.ts --by-owner "user@example.com"

# Custom Drive API query
npx tsx drive-search.ts --query "modifiedTime > '2024-01-01' and mimeType = 'application/pdf'"
```
</search_operations>

<folder_operations>
**Create a folder**:
```bash
npx tsx drive-folder.ts --action create --name "New Folder"
```

**Create nested folder path**:
```bash
npx tsx drive-folder.ts --action create-path --path "Projects/2024/Q4"
```

**Get folder tree (hierarchical view)**:
```bash
# Get folder tree from root (default depth 3)
npx tsx drive-folder.ts --action tree

# Get folder tree from specific folder with custom depth
npx tsx drive-folder.ts --action tree --id "folder_id" --depth 5
```

**Get folder contents recursively**:
```bash
npx tsx drive-folder.ts --action contents --id "folder_id" --depth 10
```

**Add file shortcut to folder**:
```bash
npx tsx drive-folder.ts --action add-shortcut --file-id "file_id" --folder-id "target_folder_id"
```

**Organize files by MIME type**:
```bash
# Auto-create subfolders (Documents, Spreadsheets, Images, etc.) and move files
npx tsx drive-folder.ts --action organize --id "folder_id"
```

**Move a file**:
```bash
npx tsx drive-move.ts --id "file_id" --to "folder_id"
```

**Copy a file**:
```bash
npx tsx drive-copy.ts --id "file_id" --name "Copy of Document" --to "folder_id"
```

**Delete operations**:
```bash
# Move to trash
npx tsx drive-delete.ts --id "file_id"

# Permanently delete
npx tsx drive-delete.ts --id "file_id" --permanent

# Restore from trash
npx tsx drive-delete.ts --id "file_id" --restore
```
</folder_operations>

<permission_operations>
**List permissions**:
```bash
npx tsx drive-permissions.ts --id "file_id" --action list
```

**Get sharing summary**:
```bash
npx tsx drive-permissions.ts --id "file_id" --action summary
```

**Get detailed permission info**:
```bash
npx tsx drive-permissions.ts --id "file_id" --action details \
  --permission-id "permission_id"
```

**Share with user**:
```bash
npx tsx drive-permissions.ts --id "file_id" --action share \
  --email "user@example.com" --role writer --notify
```

**Share with anyone (link sharing)**:
```bash
npx tsx drive-permissions.ts --id "file_id" --action share \
  --anyone --role reader
```

**Transfer file ownership**:
```bash
npx tsx drive-permissions.ts --id "file_id" --action transfer-owner \
  --email "newowner@example.com"
```

**Remove access**:
```bash
npx tsx drive-permissions.ts --id "file_id" --action remove \
  --email "user@example.com"
```

**Permission roles**: `reader`, `commenter`, `writer`, `owner` (for transfer)
</permission_operations>

<docs_operations>
**Available actions**: create, create-with-content, create-in-folder, get, text, summary, structure, insert, append, delete-range, add-heading, replace, search, search-multi

**Create documents**:
```bash
# Basic create
npx tsx docs-manage.ts --action create --title "Meeting Notes"

# Create with initial content
npx tsx docs-manage.ts --action create-with-content --title "Report" \
  --content "This is the initial content of the document."

# Create in a specific folder
npx tsx docs-manage.ts --action create-in-folder --title "Project Doc" \
  --folder-id "folder_id" --content "Optional initial content"
```

**Read operations**:
```bash
# Get document metadata
npx tsx docs-manage.ts --action get --id "document_id"

# Get full document text
npx tsx docs-manage.ts --action text --id "document_id"

# Get document summary (first N characters)
npx tsx docs-manage.ts --action summary --id "document_id" --max-chars 200

# Get document structure (headings, tables, lists, images count)
npx tsx docs-manage.ts --action structure --id "document_id"
```

**Write operations**:
```bash
# Insert text at a specific position
npx tsx docs-manage.ts --action insert --id "document_id" \
  --text "inserted text" --index 10

# Append text to end of document
npx tsx docs-manage.ts --action append --id "document_id" --text "New paragraph"

# Delete content in a range
npx tsx docs-manage.ts --action delete-range --id "document_id" \
  --start-index 10 --end-index 50

# Add a heading (levels 1-6)
npx tsx docs-manage.ts --action add-heading --id "document_id" \
  --text "Section Title" --level 2

# Replace all occurrences of text
npx tsx docs-manage.ts --action replace --id "document_id" \
  --find "old text" --replace-with "new text"
```

**Search operations**:
```bash
# Search for text in a document (returns matches with context)
npx tsx docs-manage.ts --action search --id "document_id" --find "keyword"

# Search across multiple documents
npx tsx docs-manage.ts --action search-multi \
  --ids "doc_id_1,doc_id_2,doc_id_3" --find "keyword"
```
</docs_operations>

<sheets_operations>
**Available actions**: create, create-with-sheets, create-with-data, get, summary, read, read-all, read-multi, write, write-multi, append, clear, find, query, find-row, get-column, add-sheet, delete-sheet

**Create spreadsheets**:
```bash
# Basic create
npx tsx sheets-manage.ts --action create --title "Budget 2024"

# Create with multiple named sheets
npx tsx sheets-manage.ts --action create-with-sheets --title "Report" \
  --sheets "Data,Summary,Archive"

# Create and populate with data
npx tsx sheets-manage.ts --action create-with-data --title "Report" \
  --values '[["Name","Value"],["Item1",100],["Item2",200]]'
```

**Read operations**:
```bash
# Read a range
npx tsx sheets-manage.ts --action read --id "id" --range "Sheet1!A1:D10"

# Read all values from a sheet
npx tsx sheets-manage.ts --action read-all --id "id" --sheet "Sheet1"

# Read multiple ranges at once (batch)
npx tsx sheets-manage.ts --action read-multi --id "id" \
  --ranges "Sheet1!A1:B10,Sheet1!D1:E10"

# Get detailed summary (all sheets with dimensions)
npx tsx sheets-manage.ts --action summary --id "id"
```

**Write operations**:
```bash
# Write to a range
npx tsx sheets-manage.ts --action write --id "id" \
  --range "Sheet1!A1" --values '[["Name","Value"],["Item1",100]]'

# Write to multiple ranges at once (batch)
npx tsx sheets-manage.ts --action write-multi --id "id" \
  --data '{"Sheet1!A1":[["a","b"]],"Sheet1!D1":[["x","y"]]}'

# Append rows
npx tsx sheets-manage.ts --action append --id "id" \
  --range "Sheet1!A1" --values '[["New Item",200]]'

# Clear a range
npx tsx sheets-manage.ts --action clear --id "id" --range "Sheet1!A1:D10"
```

**Search operations**:
```bash
# Find cells containing text
npx tsx sheets-manage.ts --action find --id "id" --search "keyword" --sheet "Sheet1"

# Query rows with column filters (column index: filter value)
npx tsx sheets-manage.ts --action query --id "id" \
  --filters '{"0":"John","2":"Active"}' --sheet "Sheet1"

# Find a specific row by value in a column
npx tsx sheets-manage.ts --action find-row --id "id" \
  --column A --value "John" --sheet "Sheet1"

# Get all values from a column
npx tsx sheets-manage.ts --action get-column --id "id" --column A --sheet "Sheet1"
```

**Sheet management**:
```bash
# Add a new sheet to spreadsheet
npx tsx sheets-manage.ts --action add-sheet --id "id" --sheet "NewSheet"

# Delete a sheet (use summary to get sheet IDs)
npx tsx sheets-manage.ts --action delete-sheet --id "id" --sheet-id 123456789
```
</sheets_operations>

<slides_operations>
**Available actions**: create, create-with-slides, get, summary, count, text, text-slide, add-slide, delete-slide, add-textbox, replace

**Create presentations**:
```bash
# Basic create
npx tsx slides-manage.ts --action create --title "Q4 Review"

# Create with multiple slides
npx tsx slides-manage.ts --action create-with-slides --title "Report" \
  --slide-count 5 --layout TITLE_AND_BODY
```

**Read operations**:
```bash
# Get presentation metadata
npx tsx slides-manage.ts --action get --id "presentation_id"

# Get detailed summary with per-slide text
npx tsx slides-manage.ts --action summary --id "presentation_id"

# Get slide count
npx tsx slides-manage.ts --action count --id "presentation_id"

# Extract text from all slides
npx tsx slides-manage.ts --action text --id "presentation_id"

# Get text from a specific slide
npx tsx slides-manage.ts --action text-slide --id "presentation_id" --slide-number 2
```

**Slide management**:
```bash
# Add a new slide (with optional layout and position)
npx tsx slides-manage.ts --action add-slide --id "presentation_id" \
  --layout TITLE_AND_BODY --index 1

# Delete a slide by number
npx tsx slides-manage.ts --action delete-slide --id "presentation_id" --slide-number 3
```

**Content editing**:
```bash
# Add a text box to a slide (with optional position and size)
npx tsx slides-manage.ts --action add-textbox --id "presentation_id" \
  --slide-number 1 --text "Hello World" --x 100 --y 100 --width 300 --height 50

# Replace text across the presentation
npx tsx slides-manage.ts --action replace --id "presentation_id" \
  --find "old text" --replace-with "new text"
```

**Slide layouts**: BLANK, TITLE, TITLE_AND_BODY, TITLE_ONLY, SECTION_HEADER, CAPTION_ONLY, TITLE_AND_TWO_COLUMNS, SECTION_TITLE_AND_DESCRIPTION, ONE_COLUMN_TEXT, MAIN_POINT, BIG_NUMBER
</slides_operations>
</workflows>

<export_formats>
**Google Docs export formats**:
| Format | Extension | MIME Type |
|--------|-----------|-----------|
| PDF | .pdf | application/pdf |
| Word | .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| Plain Text | .txt | text/plain |
| HTML | .html | text/html |
| OpenDocument | .odt | application/vnd.oasis.opendocument.text |
| Rich Text | .rtf | application/rtf |
| EPUB | .epub | application/epub+zip |

**Google Sheets export formats**:
| Format | Extension | MIME Type |
|--------|-----------|-----------|
| Excel | .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet |
| PDF | .pdf | application/pdf |
| CSV | .csv | text/csv |
| OpenDocument | .ods | application/vnd.oasis.opendocument.spreadsheet |
| TSV | .tsv | text/tab-separated-values |

**Google Slides export formats**:
| Format | Extension | MIME Type |
|--------|-----------|-----------|
| PowerPoint | .pptx | application/vnd.openxmlformats-officedocument.presentationml.presentation |
| PDF | .pdf | application/pdf |
| OpenDocument | .odp | application/vnd.oasis.opendocument.presentation |
</export_formats>

<query_syntax>
**Drive API query operators**:
- `=` / `!=` - Equals / Not equals
- `contains` - Prefix match for name
- `in` - Value in collection (e.g., parents)
- `and` / `or` / `not` - Logical operators

**Common query patterns**:
```
# Exact name match
name = 'Exact Name.pdf'

# Name contains
name contains 'report'

# By MIME type
mimeType = 'application/pdf'
mimeType = 'application/vnd.google-apps.document'

# In specific folder
'folder_id' in parents

# By date
modifiedTime > '2024-01-01T00:00:00'
createdTime > '2024-06-01'

# Exclude trashed (always recommended)
trashed = false

# Combined
name contains 'report' and mimeType = 'application/pdf' and trashed = false
```
</query_syntax>

<error_handling>
**Common errors and solutions**:

| Error | Cause | Solution |
|-------|-------|----------|
| Credentials file not found | Missing OAuth credentials | Download from Google Cloud Console and place at `~/.google-skills/drive/DriveSkill-Credentials.json` |
| Token expired | Access token expired | Automatic refresh occurs; if fails, delete `token.json` and re-authenticate |
| 403 Forbidden | Insufficient permissions | Check OAuth scopes in Cloud Console |
| 404 Not Found | Invalid file/folder ID | Verify the ID is correct and you have access |
| 429 Rate Limit | Too many requests | Wait and retry; implement exponential backoff |
| This is a Google Workspace file | Trying to download instead of export | Use `drive-export.ts` for Google Docs/Sheets/Slides |
</error_handling>

<anti_patterns>
- **Never hardcode file IDs** - Always search or accept as parameter
- **Never skip trashed filter** - Always include `trashed = false` in queries
- **Never download Google files** - Use export for Docs/Sheets/Slides
- **Never store credentials in code** - Use the `~/.google-skills/drive/` location
</anti_patterns>

<success_criteria>
- Credentials file exists at expected path
- Authentication completes (token.json created/refreshed)
- Operations return valid output (or JSON with --json flag)
- Exit code 0 for success, 1 for errors
- All status messages use `[OK]`, `[ERROR]`, `[INFO]`, `[...]` prefixes
</success_criteria>

<detailed_references>
For complete API details and advanced usage, see:
- [SETUP-CREDENTIALS.md](SETUP-CREDENTIALS.md) - First-time credentials setup guide
- [references/drive-operations.md](references/drive-operations.md) - Complete Drive API operations
- [references/docs-sheets-slides.md](references/docs-sheets-slides.md) - Document, Spreadsheet, and Presentation APIs
- [references/permissions.md](references/permissions.md) - Detailed sharing and permissions guide
</detailed_references>
