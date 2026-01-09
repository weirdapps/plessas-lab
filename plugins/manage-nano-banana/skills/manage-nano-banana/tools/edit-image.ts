#!/usr/bin/env npx tsx
/**
 * Nano Banana Image Editing Tool
 * Edit existing images using Google's Gemini API (inpainting)
 *
 * Usage:
 *   npx tsx edit-image.ts --input ./source.png --prompt "Your editing instructions" --output ./edited.png [options]
 *
 * Options:
 *   --input   Required. Path to the source image to edit
 *   --prompt  Required. Instructions for how to edit the image
 *   --output  Required. Output file path for the edited image
 *   --model   Model to use: gemini-2.5-flash-image (default) or gemini-3-pro-image-preview
 */

import * as fs from "node:fs";
import {
  editImage,
  parseArgs,
  type ModelId,
} from "./nano-banana-client.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Validate required arguments
  if (!args.input) {
    console.error("Error: --input is required");
    console.error("Usage: npx tsx edit-image.ts --input ./source.png --prompt \"Edit instructions\" --output ./edited.png");
    process.exit(1);
  }

  if (!args.prompt) {
    console.error("Error: --prompt is required");
    console.error("Usage: npx tsx edit-image.ts --input ./source.png --prompt \"Edit instructions\" --output ./edited.png");
    process.exit(1);
  }

  if (!args.output) {
    console.error("Error: --output is required");
    console.error("Usage: npx tsx edit-image.ts --input ./source.png --prompt \"Edit instructions\" --output ./edited.png");
    process.exit(1);
  }

  const inputPath = args.input;
  const prompt = args.prompt;
  const outputPath = args.output;
  const model = (args.model || "gemini-2.5-flash-image") as ModelId;

  // Validate input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Validate model
  const validModels = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
  if (!validModels.includes(model)) {
    console.error(`Error: Invalid model "${model}". Valid options: ${validModels.join(", ")}`);
    process.exit(1);
  }

  const inputSize = fs.statSync(inputPath).size;

  console.log("=".repeat(60));
  console.log("Nano Banana Image Editing");
  console.log("=".repeat(60));
  console.log(`Model: ${model}`);
  console.log(`Input: ${inputPath} (${inputSize.toLocaleString()} bytes)`);
  console.log(`Output: ${outputPath}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`);
  console.log("-".repeat(60));

  console.log("[...] Editing image...");

  const result = await editImage(inputPath, prompt, outputPath, { model });

  if (result.success) {
    const fileSize = fs.statSync(outputPath).size;
    console.log(`[OK] Image edited successfully`);
    console.log(`[OK] Saved to: ${outputPath}`);
    console.log(`[OK] File size: ${fileSize.toLocaleString()} bytes`);
    if (result.text) {
      console.log(`[INFO] API response: ${result.text.substring(0, 200)}${result.text.length > 200 ? "..." : ""}`);
    }
    console.log("=".repeat(60));
    console.log("SUCCESS");
    console.log("=".repeat(60));
  } else {
    console.error(`[ERROR] Failed to edit image: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
