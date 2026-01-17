---
name: pdf-splitter
description: Split PDF files into individual pages as separate PDF or PNG files using TypeScript. Use when the user needs to extract pages from a PDF, convert PDF pages to images, or split a multi-page PDF into single-page files.
---

> **Path Convention**: All paths in this document are relative to this skill's root directory. When executing commands, first `cd` to the skill directory or adjust paths accordingly.

<objective>
Split PDF documents into individual pages, outputting either separate PDF files or PNG images. Uses pure JavaScript libraries (pdf-lib for PDF manipulation, pdf-to-img for PNG conversion) with no external system dependencies.
</objective>

<tool_location>
The pdf-splitter tool is bundled with this skill at:
`./tools/`

The tool is pre-built and ready to use. No project setup required.
</tool_location>

<usage>
To split a PDF file, run the tool from the skill folder:

```bash
# Split PDF to individual PDF pages (default)
node ./tools/dist/index.js <input.pdf>

# Split PDF to PNG images
node ./tools/dist/index.js -f png <input.pdf>

# Alternative: use the shell wrapper
./scripts/pdf-splitter.sh <input.pdf>
./scripts/pdf-splitter.sh -f png <input.pdf>
```

**Options:**
- `-f, --format <format>`: Output format - `pdf` (default) or `png`
- `-V, --version`: Show version number
- `-h, --help`: Display help

**Examples:**
```bash
# Extract pages as PDFs
node ./tools/dist/index.js document.pdf

# Extract pages as PNG images
node ./tools/dist/index.js -f png document.pdf
```
</usage>

<output_naming>
Files are named following this convention:
`{original_filename}_page_{zero_padded_number}.{extension}`

Examples:
- `report.pdf` (3 pages) -> `report.pdf_page_1.pdf`, `report.pdf_page_2.pdf`, `report.pdf_page_3.pdf`
- `book.pdf` (150 pages) -> `book.pdf_page_001.pdf` ... `book.pdf_page_150.pdf`

Zero-padding is calculated dynamically based on total page count.
Output files are created in the current working directory.
</output_naming>

<maintenance>
If the tool needs to be rebuilt after modifications:

```bash
cd ./tools
npm install   # Only if node_modules is missing
npm run build
```
</maintenance>

<project_structure>
```
./
├── tools/
│   ├── src/
│   │   ├── index.ts              # CLI entry point
│   │   ├── splitPdf.ts           # Main orchestrator
│   │   ├── splitToPdf.ts         # PDF extraction logic
│   │   ├── splitToPng.ts         # PNG conversion logic
│   │   └── utils/
│   │       └── fileUtils.ts      # File naming utilities
│   ├── dist/                     # Compiled JavaScript (ready to use)
│   ├── node_modules/             # Dependencies
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── pdf-splitter.sh           # Shell wrapper
├── docs/
│   └── DESIGN.md                 # Implementation design document
└── SKILL.md                      # This file
```
</project_structure>

<library_reference>
<pdf_lib>
**Purpose**: PDF reading, writing, and page manipulation

Key methods:
- `PDFDocument.load(buffer)` - Load PDF from buffer
- `pdfDoc.getPageCount()` - Get total page count
- `PDFDocument.create()` - Create new empty PDF
- `newPdf.copyPages(source, [indices])` - Copy pages from another PDF
- `newPdf.addPage(page)` - Add page to document
- `newPdf.save()` - Serialize to bytes
</pdf_lib>

<pdf_to_img>
**Purpose**: Convert PDF pages to PNG images

Key usage:
- `pdf(filePath, options)` - Returns async iterable of page images
- `scale: 1.0` = 72 DPI (base resolution)
- `scale: 2.0` = 144 DPI
- `scale: 4.17` = 300 DPI (scale = targetDPI / 72)
- Output is 8-bit RGBA PNG with alpha channel
</pdf_to_img>
</library_reference>

<references>
**Design Document:** `docs/DESIGN.md`
- Complete implementation plan with feature parity checklist
- Technology stack rationale (pdf-lib, pdf-to-img, commander)
- Library selection comparison and alternatives evaluated
- Code structure mapping (Python vs TypeScript)
- DPI configuration comparison
- Testing plan with unit and integration test cases
- Future enhancement opportunities
</references>

<success_criteria>
- PDF splits into correct number of individual files
- PNG output produces 72 DPI RGBA images with alpha channel
- Output filenames use zero-padded page numbers
- CLI accepts `-f` / `--format` option for format selection
- Proper error handling for missing files and invalid formats
</success_criteria>
