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
