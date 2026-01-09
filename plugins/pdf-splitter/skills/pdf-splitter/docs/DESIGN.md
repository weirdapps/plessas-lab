# SplitPdf Node.js/TypeScript Implementation Plan

**Date Created:** 2026-01-02
**Last Updated:** 2026-01-02
**Based On:** SplitPdf-Specs.md (Python version 0.02)
**Target Location:** `/Users/giorgosmarinos/_Tools/SplitPdfTS/`

---

## 1. Overview

This document provides a detailed implementation plan for recreating the SplitPdf tool in Node.js with TypeScript. The implementation will maintain exact feature parity with the Python version while following TypeScript best practices.

### 1.1 Goals

- Replicate all functionality from the Python implementation
- Maintain identical CLI interface and behavior
- Use TypeScript for type safety
- Follow Node.js best practices
- Produce identical output file naming conventions
- **Use pure JavaScript libraries** (no external system dependencies)

### 1.2 Feature Parity Checklist

| Feature | Python | TypeScript Target |
|---------|--------|-------------------|
| PDF to PDF splitting | Yes | Yes |
| PDF to PNG conversion | Yes | Yes |
| 72 DPI PNG output | Yes | Yes |
| RGBA with alpha channel | Yes | Yes |
| Zero-padded page numbers | Yes | Yes |
| CLI with -f/--format option | Yes | Yes |
| Help text with examples | Yes | Yes |

---

## 2. Project Structure

```
SplitPdfTS/
├── src/
│   ├── index.ts              # Entry point and CLI handling
│   ├── splitPdf.ts           # Main orchestrator function
│   ├── splitToPdf.ts         # PDF extraction logic
│   ├── splitToPng.ts         # PNG conversion logic (pdf-to-img)
│   └── utils/
│       └── fileUtils.ts      # File path and naming utilities
├── package.json              # Project configuration and dependencies
├── tsconfig.json             # TypeScript configuration
├── split-pdf.sh              # Shell wrapper script (optional)
└── README.md                 # Usage documentation
```

### 2.1 File Responsibilities

| File | Responsibility |
|------|----------------|
| `src/index.ts` | CLI argument parsing, entry point, help text |
| `src/splitPdf.ts` | Main orchestrator - reads PDF, routes to format handler |
| `src/splitToPdf.ts` | Extracts pages to separate PDF files |
| `src/splitToPng.ts` | Renders pages to PNG images using pdf-to-img |
| `src/utils/fileUtils.ts` | Filename generation, zero-padding logic |

---

## 3. Technology Stack

### 3.1 Runtime & Language

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js 20+ | LTS version with modern features |
| Language | TypeScript 5.x | Type safety, better tooling |
| Module System | ESM | Modern standard, better tree-shaking |

### 3.2 Dependencies

#### Core Dependencies

| Package | Version | Purpose | Python Equivalent |
|---------|---------|---------|-------------------|
| `pdf-lib` | ^1.17.1 | PDF reading and writing | PyPDF2 |
| `pdf-to-img` | ^5.0.0 | PDF to PNG conversion | PyMuPDF (fitz) |
| `pdfjs-dist` | ^4.0.379 | PDF parsing (peer dependency of pdf-to-img) | - |
| `canvas` | ^2.11.2 | Image rendering (peer dependency of pdf-to-img) | - |
| `commander` | ^12.x | CLI argument parsing | argparse |

#### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.x | TypeScript compiler |
| `@types/node` | ^20.x | Node.js type definitions |
| `tsx` | ^4.x | TypeScript execution (dev) |

### 3.3 Library Selection Rationale

#### pdf-lib (PDF Manipulation)
- Pure JavaScript implementation (no native dependencies)
- Excellent TypeScript support
- Can read, modify, and create PDFs
- Active maintenance and community support
- Works in both Node.js and browser environments

#### pdf-to-img (PNG Conversion)
- Wraps pdfjs-dist with proper Node.js support
- Requires `canvas` and `pdfjs-dist` as peer dependencies
- Handles PDFs with embedded images correctly
- Full RGBA support with alpha channel
- Simple async iterable API
- Reliable cross-platform behavior
- Note: `canvas` package requires native compilation (node-gyp)

#### commander (CLI)
- Most popular Node.js CLI framework
- Clean, declarative API
- Excellent TypeScript support
- Auto-generates help text
- Supports short and long option formats

### 3.4 Why pdf-to-img

| Aspect | pdf2pic | pdfjs-dist + canvas (manual) | pdf-to-img |
|--------|---------|------------------------------|------------|
| External Dependencies | Requires GraphicsMagick | canvas native bindings | canvas native bindings |
| Image Handling | Good | Problematic with embedded images | **Excellent** |
| Alpha Channel | Unreliable | Requires manual setup | **Built-in** |
| Cross-platform | Varies by system config | Requires native compilation | Requires native compilation |
| Installation | Complex (system packages) | Complex (manual setup) | **Simple (npm install)** |
| API | Callback-based | Complex factory setup | **Simple async iterable** |

> **Note:** While pdf-to-img v5 requires the `canvas` package (which needs native compilation), it provides a much simpler API than manually integrating pdfjs-dist with canvas. The tradeoff is worthwhile for the improved developer experience and reliable image handling.

---

## 4. Implementation Details

### 4.1 Module: `src/utils/fileUtils.ts`

**Purpose:** Utility functions for file naming and path manipulation.

```typescript
// src/utils/fileUtils.ts

import path from 'node:path';

/**
 * Calculates the number of digits needed for zero-padding based on total pages
 */
export function calculatePadding(totalPages: number): number {
  return String(totalPages).length;
}

/**
 * Generates a zero-padded page number string
 */
export function formatPageNumber(pageNum: number, numDigits: number): string {
  return String(pageNum).padStart(numDigits, '0');
}

/**
 * Generates output filename following the convention:
 * {original_filename}_page_{padded_number}.{extension}
 */
export function generateOutputFilename(
  inputPath: string,
  pageNumber: number,
  numDigits: number,
  extension: 'pdf' | 'png'
): string {
  const baseName = path.basename(inputPath);
  const paddedNum = formatPageNumber(pageNumber, numDigits);
  return `${baseName}_page_${paddedNum}.${extension}`;
}
```

**Mapping to Python:**
| TypeScript Function | Python Equivalent |
|---------------------|-------------------|
| `calculatePadding()` | `len(str(total_pages))` |
| `formatPageNumber()` | `str(i + 1).zfill(num_digits)` |
| `generateOutputFilename()` | f-string formatting |

---

### 4.2 Module: `src/splitToPdf.ts`

**Purpose:** Extract each page from a PDF into separate single-page PDF files.

```typescript
// src/splitToPdf.ts

import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import { generateOutputFilename } from './utils/fileUtils.js';

interface SplitToPdfOptions {
  inputPath: string;
  pdfDoc: PDFDocument;
  totalPages: number;
  numDigits: number;
}

/**
 * Extracts each page from a PDF into separate single-page PDF files
 * Equivalent to Python's split_to_pdf() function
 */
export async function splitToPdf(options: SplitToPdfOptions): Promise<void> {
  const { inputPath, pdfDoc, totalPages, numDigits } = options;

  for (let i = 0; i < totalPages; i++) {
    // Create a new PDF document for this page
    const newPdf = await PDFDocument.create();

    // Copy the page from source to new document
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);

    // Generate output filename (1-indexed for user display)
    const outputName = generateOutputFilename(inputPath, i + 1, numDigits, 'pdf');

    // Save the single-page PDF
    const pdfBytes = await newPdf.save();
    await fs.writeFile(outputName, pdfBytes);

    console.log(`Created: ${outputName}`);
  }
}
```

**Key Implementation Notes:**
1. Uses `PDFDocument.create()` to create a new empty PDF for each page
2. Uses `copyPages()` to copy page content preserving all attributes
3. Page numbers are 1-indexed in output (matching Python behavior)
4. Uses async/await for file operations

---

### 4.3 Module: `src/splitToPng.ts`

**Purpose:** Convert each PDF page to a PNG image file using pdf-to-img.

```typescript
// src/splitToPng.ts

import fs from 'node:fs/promises';
import { pdf } from 'pdf-to-img';
import { generateOutputFilename } from './utils/fileUtils.js';

interface SplitToPngOptions {
  inputPath: string;
  totalPages: number;
  numDigits: number;
}

/**
 * PNG Rendering Configuration
 * Matching Python PyMuPDF settings:
 * - Resolution: 72 DPI (native PDF resolution)
 * - Color Space: RGBA (8-bit with alpha channel)
 */
const PNG_CONFIG = {
  // pdf-to-img uses scale factor where 1.0 = 72 DPI
  SCALE: 1.0,
} as const;

/**
 * Converts each PDF page to a PNG image file
 * Equivalent to Python's split_to_png() function
 *
 * Uses pdf-to-img for PDF rendering (wraps pdfjs-dist with proper Node.js support).
 * This approach provides:
 * - No external system dependencies (pure JavaScript)
 * - Full control over rendering parameters
 * - Proper handling of PDFs with embedded images
 */
export async function splitToPng(options: SplitToPngOptions): Promise<void> {
  const { inputPath, totalPages, numDigits } = options;

  // Convert PDF to images using pdf-to-img
  // It returns an async iterable of page images
  const document = await pdf(inputPath, {
    scale: PNG_CONFIG.SCALE,
  });

  let pageNum = 0;
  for await (const image of document) {
    pageNum++;

    // Generate output filename with zero-padded page number
    const outputName = generateOutputFilename(inputPath, pageNum, numDigits, 'png');

    // Write PNG file (image is already a Buffer in PNG format)
    await fs.writeFile(outputName, image);

    console.log(`Created: ${outputName}`);
  }
}
```

**Key Implementation Notes:**

1. **Simple API:** pdf-to-img provides an async iterable that yields PNG buffers directly.

2. **Scale Factor:** pdf-to-img uses scale factor where `scale: 1.0` produces 72 DPI output (matching Python's `dpi=72`).

3. **Alpha Channel:** Output is automatically 8-bit RGBA PNG with alpha channel support.

4. **No Native Dependencies:** Unlike pdfjs-dist + canvas approach, pdf-to-img handles all the complexity internally.

5. **Embedded Images:** Properly handles PDFs with embedded images without "Image or Canvas expected" errors.

---

### 4.4 Module: `src/splitPdf.ts`

**Purpose:** Main orchestrator function that coordinates the splitting process.

```typescript
// src/splitPdf.ts

import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import { calculatePadding } from './utils/fileUtils.js';
import { splitToPdf } from './splitToPdf.js';
import { splitToPng } from './splitToPng.js';

export type OutputFormat = 'pdf' | 'png';

interface SplitPdfOptions {
  inputPath: string;
  outputFormat: OutputFormat;
}

/**
 * Main orchestrator function that coordinates the PDF splitting process
 * Equivalent to Python's split_pdf() function
 */
export async function splitPdf(options: SplitPdfOptions): Promise<void> {
  const { inputPath, outputFormat } = options;

  // Read the input PDF file
  const pdfBuffer = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // Get total page count
  const totalPages = pdfDoc.getPageCount();

  // Calculate zero-padding digits
  const numDigits = calculatePadding(totalPages);

  // Route to appropriate handler based on format
  if (outputFormat === 'png') {
    await splitToPng({
      inputPath,
      totalPages,
      numDigits,
    });
  } else {
    await splitToPdf({
      inputPath,
      pdfDoc,
      totalPages,
      numDigits,
    });
  }
}
```

**Key Implementation Notes:**
1. Reads PDF once with pdf-lib to get page count
2. For PNG output, pdf-to-img reads the file independently
3. Type-safe `OutputFormat` union type

---

### 4.5 Module: `src/index.ts`

**Purpose:** Entry point with CLI argument parsing.

```typescript
#!/usr/bin/env node
// src/index.ts

import { program } from 'commander';
import { splitPdf, OutputFormat } from './splitPdf.js';
import fs from 'node:fs';

// Package version (could be imported from package.json)
const VERSION = '1.0.0';

program
  .name('split-pdf')
  .description('Split PDF - Extract pages from a PDF file')
  .version(VERSION)
  .argument('<input_pdf>', 'Input PDF file')
  .option('-f, --format <format>', 'Output format: pdf or png', 'pdf')
  .addHelpText('after', `
Examples:
  $ split-pdf document.pdf              # Extract as PDF pages
  $ split-pdf -f png document.pdf       # Extract as PNG images
  $ split-pdf --format pdf document.pdf # Extract as PDF pages
`)
  .action(async (inputPdf: string, options: { format: string }) => {
    // Validate input file exists
    if (!fs.existsSync(inputPdf)) {
      console.error(`Error: File not found: ${inputPdf}`);
      process.exit(1);
    }

    // Validate format option
    const format = options.format.toLowerCase();
    if (format !== 'pdf' && format !== 'png') {
      console.error(`Error: Invalid format '${format}'. Must be 'pdf' or 'png'.`);
      process.exit(1);
    }

    try {
      await splitPdf({
        inputPath: inputPdf,
        outputFormat: format as OutputFormat,
      });
    } catch (error) {
      console.error(`Error processing PDF: ${error}`);
      process.exit(1);
    }
  });

program.parse();
```

**CLI Behavior Matching Python:**

| Aspect | Python | TypeScript |
|--------|--------|------------|
| Positional argument | `input_pdf` | `<input_pdf>` |
| Format short option | `-f` | `-f` |
| Format long option | `--format` | `--format` |
| Default format | `pdf` | `pdf` |
| Help examples | Yes | Yes |
| Exit code on error | 1 | 1 |

---

## 5. Configuration Files

### 5.1 package.json

```json
{
  "name": "split-pdf-ts",
  "version": "1.0.0",
  "description": "CLI tool to split PDF pages into separate files",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "split-pdf": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "keywords": ["pdf", "split", "cli", "typescript"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "canvas": "^2.11.2",
    "commander": "^12.1.0",
    "pdf-lib": "^1.17.1",
    "pdf-to-img": "^5.0.0",
    "pdfjs-dist": "^4.0.379"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 5.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 5.3 Shell Wrapper (Optional)

```bash
#!/bin/zsh
# split-pdf.sh

SCRIPT_DIR="${0:a:h}"

# Run the compiled JavaScript or use tsx for development
if [ -f "${SCRIPT_DIR}/dist/index.js" ]; then
  node "${SCRIPT_DIR}/dist/index.js" "$@"
else
  npx tsx "${SCRIPT_DIR}/src/index.ts" "$@"
fi
```

---

## 6. Implementation Steps

### Step 1: Project Initialization

```bash
# Create project directory
mkdir -p /Users/giorgosmarinos/_Tools/SplitPdfTS
cd /Users/giorgosmarinos/_Tools/SplitPdfTS

# Initialize npm project
npm init -y

# Install core dependencies
npm install pdf-lib pdf-to-img commander

# Install dev dependencies
npm install -D typescript @types/node tsx

# Create directory structure
mkdir -p src/utils
```

### Step 2: Configuration Setup

1. Create `package.json` with configuration from Section 5.1
2. Create `tsconfig.json` with configuration from Section 5.2

### Step 3: Implement Utility Module

1. Create `src/utils/fileUtils.ts`
2. Implement `calculatePadding()`, `formatPageNumber()`, `generateOutputFilename()`
3. Export all functions

### Step 4: Implement PDF Splitter

1. Create `src/splitToPdf.ts`
2. Implement `splitToPdf()` function using pdf-lib
3. Test with a sample PDF

### Step 5: Implement PNG Converter

1. Create `src/splitToPng.ts`
2. Implement `splitToPng()` function using pdf-to-img
3. Verify 72 DPI output (scale = 1.0)
4. Verify alpha channel in output (8-bit RGBA)
5. Test with PDFs containing embedded images

### Step 6: Implement Orchestrator

1. Create `src/splitPdf.ts`
2. Implement `splitPdf()` function
3. Connect PDF and PNG handlers

### Step 7: Implement CLI

1. Create `src/index.ts`
2. Implement CLI argument parsing with Commander
3. Add help text with examples
4. Add input validation

### Step 8: Build and Test

```bash
# Build TypeScript
npm run build

# Test PDF output
node dist/index.js test.pdf

# Test PNG output
node dist/index.js -f png test.pdf

# Test help
node dist/index.js --help
```

### Step 9: Create Shell Wrapper (Optional)

1. Create `split-pdf.sh`
2. Make executable: `chmod +x split-pdf.sh`

---

## 7. Testing Plan

### 7.1 Unit Tests

| Test Case | Description |
|-----------|-------------|
| `calculatePadding(9)` | Should return 1 |
| `calculatePadding(10)` | Should return 2 |
| `calculatePadding(100)` | Should return 3 |
| `formatPageNumber(1, 2)` | Should return "01" |
| `formatPageNumber(10, 2)` | Should return "10" |
| `generateOutputFilename()` | Should match expected pattern |

### 7.2 Integration Tests

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Single page PDF → PDF | 1-page.pdf | 1-page.pdf_page_1.pdf |
| Multi-page PDF → PDF | 15-pages.pdf | 15 files with 2-digit padding |
| PDF → PNG | document.pdf | document.pdf_page_XX.png files |
| 100+ page PDF | large.pdf | 3-digit padding in filenames |
| PDF with embedded images → PNG | image-heavy.pdf | PNG files with images rendered |

### 7.3 CLI Tests

| Command | Expected Behavior |
|---------|-------------------|
| `split-pdf` | Shows help (no input) |
| `split-pdf --help` | Shows help with examples |
| `split-pdf nonexistent.pdf` | Error: File not found |
| `split-pdf -f invalid doc.pdf` | Error: Invalid format |
| `split-pdf doc.pdf` | Creates PDF files |
| `split-pdf -f png doc.pdf` | Creates PNG files |

### 7.4 PNG Quality Tests

| Test | Verification |
|------|--------------|
| DPI verification | Output dimensions match 72 DPI calculation |
| Alpha channel | Output is 8-bit RGBA PNG |
| Color accuracy | Colors match source PDF |
| Text rendering | Text is crisp and readable |
| Embedded images | Images in PDF render correctly |

---

## 8. Comparison: Python vs TypeScript

### 8.1 Code Structure Mapping

| Python Function | TypeScript Module/Function |
|-----------------|---------------------------|
| `split_to_pdf()` | `src/splitToPdf.ts` → `splitToPdf()` |
| `split_to_png()` | `src/splitToPng.ts` → `splitToPng()` |
| `split_pdf()` | `src/splitPdf.ts` → `splitPdf()` |
| `main()` | `src/index.ts` → CLI setup |

### 8.2 Library Mapping

| Python Library | TypeScript Library | Notes |
|----------------|-------------------|-------|
| PyPDF2 | pdf-lib | Different API, same capability |
| PyMuPDF (fitz) | pdf-to-img | pdf-to-img wraps pdfjs-dist |
| argparse | commander | Similar declarative API |
| os.path | node:path | Native Node.js module |

### 8.3 Behavioral Differences

| Aspect | Python | TypeScript |
|--------|--------|------------|
| Execution | Synchronous | Asynchronous (async/await) |
| Type Safety | Runtime (duck typing) | Compile-time (static types) |
| Module System | Import | ESM import |
| Error Handling | Exceptions | try/catch + typed errors |
| PNG Rendering | PyMuPDF (MuPDF engine) | pdf-to-img (pdfjs-dist) |

### 8.4 DPI Configuration Comparison

| Aspect | Python (PyMuPDF) | TypeScript (pdf-to-img) |
|--------|------------------|-------------------------|
| Parameter | `dpi=72` | `scale: 1.0` |
| Base DPI | Configurable | 72 (fixed base) |
| Calculation | Direct DPI value | scale = targetDPI / 72 |
| For 72 DPI | `dpi=72` | `scale: 1.0` |
| For 144 DPI | `dpi=144` | `scale: 2.0` |
| For 300 DPI | `dpi=300` | `scale: 300/72 ≈ 4.17` |

---

## 9. Potential Issues and Mitigations

### 9.1 Large PDF Memory Usage

**Issue:** Both pdf-lib and pdf-to-img load entire PDF into memory.

**Mitigation:**
- For very large PDFs, consider streaming approaches
- Document memory requirements
- Current implementation matches Python behavior (loads full file)
- Add warning for PDFs > 100MB

### 9.2 Font Rendering

**Issue:** Some PDFs with non-embedded fonts may render differently.

**Mitigation:**
- pdf-to-img uses pdfjs-dist which has good font fallback support
- Document that output may vary for PDFs with non-embedded fonts
- Most modern PDFs embed their fonts, minimizing this issue

### 9.3 pdf-to-img Version Compatibility

**Issue:** pdf-to-img API may change between major versions.

**Mitigation:**
- Pin to specific major version (^5.x)
- Document tested version in README
- The async iterable API is stable
- Note: v5.x requires `canvas` and `pdfjs-dist` as peer dependencies

---

## 10. Future Enhancements (Post-MVP)

These enhancements match the Python spec's future opportunities:

1. **Configurable DPI**: Add `--dpi` CLI option
   ```typescript
   // Calculate scale from DPI
   const scale = targetDpi / 72;
   ```

2. **Page Range Selection**: Add `--pages 1-5,10,15-20` option

3. **Output Directory**: Add `--output-dir` option

4. **Progress Reporting**: Add progress bar for large documents
   ```bash
   npm install cli-progress
   ```

5. **Overwrite Protection**: Add `--no-overwrite` option

6. **JPEG Output**: Add JPEG format with quality setting (would require different library)

---

## 11. Summary

This implementation plan provides a complete roadmap for creating a TypeScript version of SplitPdf with exact feature parity to the Python version. The choice of **pdf-to-img v5** provides:

- **No external system package dependencies** (no GraphicsMagick/ImageMagick required)
- **Reliable image handling** (properly handles PDFs with embedded images)
- **Built-in RGBA support** (8-bit PNG with alpha channel)
- **Simple API** (async iterable pattern)
- **Consistent cross-platform behavior**

> **Note:** pdf-to-img v5 requires `canvas` and `pdfjs-dist` as peer dependencies. The `canvas` package requires native compilation via node-gyp, but this is handled automatically by npm install on systems with a working C++ toolchain.

**Key Deliverables:**
- Full feature parity with Python version
- Identical CLI interface
- Same output file naming convention
- TypeScript type safety
- Modern ESM module system

**Files Created:** 5 source files + 2 config files + 1 shell wrapper

**Advantages over alternative approaches:**
- Simpler than pdfjs-dist + canvas manual integration (no complex factory setup)
- More reliable than pdf2pic (no GraphicsMagick/ImageMagick system dependencies)
- Better image handling than raw pdfjs-dist

---

*Document created: 2026-01-02*
*Last updated: 2026-01-02 - Updated to reflect actual implementation with pdf-to-img v5 and its peer dependencies (canvas, pdfjs-dist)*
