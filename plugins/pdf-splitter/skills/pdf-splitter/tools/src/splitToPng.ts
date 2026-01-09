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
 * - Resolution: 72 DPI (native PDF resolution)
 * - Color Space: RGBA (8-bit with alpha channel)
 */
const PNG_CONFIG = {
  // pdf-to-img uses scale factor where 1.0 = 72 DPI
  SCALE: 1.0,
} as const;

/**
 * Converts each PDF page to a PNG image file
 * Uses pdf-to-img for PDF rendering (wraps pdfjs-dist with proper Node.js support).
 */
export async function splitToPng(options: SplitToPngOptions): Promise<void> {
  const { inputPath, totalPages, numDigits } = options;

  // Convert PDF to images using pdf-to-img
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
