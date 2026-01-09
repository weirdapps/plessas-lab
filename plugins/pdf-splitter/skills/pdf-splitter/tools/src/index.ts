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
