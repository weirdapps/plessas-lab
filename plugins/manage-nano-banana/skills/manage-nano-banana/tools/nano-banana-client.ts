/**
 * Nano Banana API Client Library
 * Shared utilities for image generation using Google's Gemini API
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
export type ImageResolution = "1K" | "2K" | "4K";
export type ModelId = "gemini-2.5-flash-image" | "gemini-3-pro-image-preview";

export interface GenerationResult {
  success: boolean;
  imagePath?: string;
  text?: string;
  error?: string;
}

export interface ImageConfig {
  aspectRatio?: AspectRatio;
  imageSize?: ImageResolution;
}

export interface GenerateImageOptions {
  model?: ModelId;
  aspectRatio?: AspectRatio;
  resolution?: ImageResolution;
}

export interface EditImageOptions {
  model?: ModelId;
}

/**
 * Get API key from environment - throws if not set
 */
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set or is empty. " +
      "Please set it before using the Nano Banana API tools."
    );
  }
  return apiKey;
}

/**
 * Create a configured GoogleGenAI client
 */
export function createClient(): GoogleGenAI {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
}

/**
 * Ensure output directory exists
 */
export function ensureOutputDir(outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read image file and encode as base64
 */
export function readImageAsBase64(imagePath: string): string {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  const imageData = fs.readFileSync(imagePath);
  return imageData.toString("base64");
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] || "image/png";
}

/**
 * Save image data from API response
 */
export function saveImage(base64Data: string, outputPath: string): void {
  ensureOutputDir(outputPath);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(outputPath, buffer);
}

/**
 * Generate an image from a text prompt
 */
export async function generateImage(
  prompt: string,
  outputPath: string,
  options: GenerateImageOptions = {}
): Promise<GenerationResult> {
  const {
    model = "gemini-2.5-flash-image",
    aspectRatio = "1:1",
    resolution = "1K",
  } = options;

  // Validate resolution for flash model
  if (model === "gemini-2.5-flash-image" && resolution !== "1K") {
    return {
      success: false,
      error: `Model ${model} only supports 1K resolution. Use gemini-3-pro-image-preview for ${resolution}.`,
    };
  }

  try {
    const ai = createClient();

    const imageConfig: ImageConfig = {
      aspectRatio,
    };

    // Only add imageSize for pro model
    if (model === "gemini-3-pro-image-preview") {
      imageConfig.imageSize = resolution;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig,
      },
    });

    const result: GenerationResult = { success: false };

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0 || !candidates[0].content?.parts) {
      return {
        success: false,
        error: "No valid response from API",
      };
    }

    for (const part of candidates[0].content.parts) {
      if (part.text) {
        result.text = part.text;
      } else if (part.inlineData?.data) {
        saveImage(part.inlineData.data, outputPath);
        result.imagePath = outputPath;
        result.success = true;
      }
    }

    if (!result.success) {
      result.error = "No image was generated in the response";
      if (result.text) {
        result.error += `. API response: ${result.text}`;
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Edit an existing image based on a prompt
 */
export async function editImage(
  inputPath: string,
  prompt: string,
  outputPath: string,
  options: EditImageOptions = {}
): Promise<GenerationResult> {
  const { model = "gemini-2.5-flash-image" } = options;

  try {
    const ai = createClient();
    const base64Image = readImageAsBase64(inputPath);
    const mimeType = getMimeType(inputPath);

    const contents = [
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      {
        text: prompt,
      },
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const result: GenerationResult = { success: false };

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0 || !candidates[0].content?.parts) {
      return {
        success: false,
        error: "No valid response from API",
      };
    }

    for (const part of candidates[0].content.parts) {
      if (part.text) {
        result.text = part.text;
      } else if (part.inlineData?.data) {
        saveImage(part.inlineData.data, outputPath);
        result.imagePath = outputPath;
        result.success = true;
      }
    }

    if (!result.success) {
      result.error = "No image was generated in the response";
      if (result.text) {
        result.error += `. API response: ${result.text}`;
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}
