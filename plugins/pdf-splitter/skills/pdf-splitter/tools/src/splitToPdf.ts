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
