#!/usr/bin/env npx tsx
/**
 * Nano Banana Image Generation Tool
 * Generate images from text prompts using Google's Gemini API
 *
 * Usage:
 *   npx tsx generate-image.ts --prompt "Your prompt" --output ./output.png [options]
 *
 * Options:
 *   --prompt        Required. Text description of the image to generate
 *   --output        Required. Output file path for the generated image
 *   --model         Model to use: gemini-2.5-flash-image (default) or gemini-3-pro-image-preview
 *   --aspect-ratio  Aspect ratio: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 (default: 1:1)
 *   --resolution    Resolution: 1K (default), 2K, 4K (2K/4K only for pro model)
 */

import * as fs from "node:fs";
import {
  generateImage,
  parseArgs,
  type AspectRatio,
  type ImageResolution,
  type ModelId,
} from "./nano-banana-client.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Validate required arguments
  if (!args.prompt) {
    console.error("Error: --prompt is required");
    console.error("Usage: npx tsx generate-image.ts --prompt \"Your prompt\" --output ./output.png");
    process.exit(1);
  }

  if (!args.output) {
    console.error("Error: --output is required");
    console.error("Usage: npx tsx generate-image.ts --prompt \"Your prompt\" --output ./output.png");
    process.exit(1);
  }

  const prompt = args.prompt;
  const outputPath = args.output;
  const model = (args.model || "gemini-2.5-flash-image") as ModelId;
  const aspectRatio = (args["aspect-ratio"] || "1:1") as AspectRatio;
  const resolution = (args.resolution || "1K") as ImageResolution;

  // Validate model
  const validModels = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
  if (!validModels.includes(model)) {
    console.error(`Error: Invalid model "${model}". Valid options: ${validModels.join(", ")}`);
    process.exit(1);
  }

  // Validate aspect ratio
  const validRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
  if (!validRatios.includes(aspectRatio)) {
    console.error(`Error: Invalid aspect ratio "${aspectRatio}". Valid options: ${validRatios.join(", ")}`);
    process.exit(1);
  }

  // Validate resolution
  const validResolutions = ["1K", "2K", "4K"];
  if (!validResolutions.includes(resolution)) {
    console.error(`Error: Invalid resolution "${resolution}". Valid options: ${validResolutions.join(", ")}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Nano Banana Image Generation");
  console.log("=".repeat(60));
  console.log(`Model: ${model}`);
  console.log(`Aspect Ratio: ${aspectRatio}`);
  console.log(`Resolution: ${resolution}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`);
  console.log("-".repeat(60));

  console.log("[...] Generating image...");

  const result = await generateImage(prompt, outputPath, {
    model,
    aspectRatio,
    resolution,
  });

  if (result.success) {
    const fileSize = fs.statSync(outputPath).size;
    console.log(`[OK] Image generated successfully`);
    console.log(`[OK] Saved to: ${outputPath}`);
    console.log(`[OK] File size: ${fileSize.toLocaleString()} bytes`);
    if (result.text) {
      console.log(`[INFO] API response: ${result.text.substring(0, 200)}${result.text.length > 200 ? "..." : ""}`);
    }
    console.log("=".repeat(60));
    console.log("SUCCESS");
    console.log("=".repeat(60));
  } else {
    console.error(`[ERROR] Failed to generate image: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
