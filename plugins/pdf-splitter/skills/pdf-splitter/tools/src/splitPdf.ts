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
