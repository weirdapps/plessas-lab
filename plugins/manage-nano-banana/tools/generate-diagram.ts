#!/usr/bin/env npx tsx
/**
 * Nano Banana Diagram Generation Tool
 * Generate diagrams, infographics, and visualizations using Google's Gemini API
 *
 * Usage:
 *   npx tsx generate-diagram.ts --type architecture --prompt "Description" --output ./diagram.png [options]
 *
 * Options:
 *   --type          Required. Diagram type: architecture, flowchart, erd, sequence, timeline, infographic, process, custom
 *   --prompt        Required. Description of the diagram content
 *   --output        Required. Output file path
 *   --aspect-ratio  Aspect ratio (default varies by type)
 *   --resolution    Resolution: 1K, 2K (default), 4K
 *   --style         Visual style: professional (default), colorful, minimal, modern
 */

import * as fs from "node:fs";
import {
  generateImage,
  parseArgs,
  type AspectRatio,
  type ImageResolution,
} from "./nano-banana-client.js";

type DiagramType = "architecture" | "flowchart" | "erd" | "sequence" | "timeline" | "infographic" | "process" | "custom";
type DiagramStyle = "professional" | "colorful" | "minimal" | "modern";

interface DiagramConfig {
  defaultAspectRatio: AspectRatio;
  promptTemplate: (description: string, style: DiagramStyle) => string;
}

const styleDescriptions: Record<DiagramStyle, string> = {
  professional: "Use clean lines, modern icons, and a professional color scheme with blues and grays.",
  colorful: "Use vibrant colors, playful icons, and an engaging visual style suitable for presentations.",
  minimal: "Use minimal design with clean lines, limited colors, and plenty of whitespace.",
  modern: "Use a modern tech aesthetic with gradients, rounded corners, and contemporary iconography.",
};

const diagramConfigs: Record<DiagramType, DiagramConfig> = {
  architecture: {
    defaultAspectRatio: "16:9",
    promptTemplate: (description, style) => `
Create a professional system architecture diagram showing:

${description}

Visual requirements:
- ${styleDescriptions[style]}
- Include clear labels for all components
- Show data flow with directional arrows
- Use consistent iconography for similar component types
- Include a legend if multiple connection types are shown
    `.trim(),
  },

  flowchart: {
    defaultAspectRatio: "3:4",
    promptTemplate: (description, style) => `
Create a detailed flowchart for the following process:

${description}

Requirements:
- Use standard flowchart symbols:
  - Rectangles for processes/actions
  - Diamonds for decision points
  - Ovals for start/end points
  - Parallelograms for input/output
- Label all decision paths (Yes/No, True/False, etc.)
- ${styleDescriptions[style]}
- Show clear flow direction with arrows
    `.trim(),
  },

  erd: {
    defaultAspectRatio: "16:9",
    promptTemplate: (description, style) => `
Create an entity-relationship diagram (ERD) for the following database schema:

${description}

Requirements:
- Show entities as rectangles with attribute lists
- Mark primary keys (PK) and foreign keys (FK)
- Use crow's foot notation for cardinality (1:1, 1:N, M:N)
- ${styleDescriptions[style]}
- Include relationship labels where appropriate

Note: If formal ERD notation cannot be rendered, provide a clear visual representation of the schema structure.
    `.trim(),
  },

  sequence: {
    defaultAspectRatio: "3:4",
    promptTemplate: (description, style) => `
Create a sequence diagram showing the following interaction:

${description}

Requirements:
- Show participants/actors as labeled boxes at the top
- Use vertical lifelines for each participant
- Show messages as horizontal arrows with labels
- Include activation bars for active processes
- ${styleDescriptions[style]}
- Number sequence steps if appropriate

Note: If formal UML notation cannot be rendered, provide a clear visual representation of the interaction flow.
    `.trim(),
  },

  timeline: {
    defaultAspectRatio: "21:9",
    promptTemplate: (description, style) => `
Create a timeline visualization for:

${description}

Requirements:
- Show events in chronological order along a horizontal axis
- Include clear date/time labels for each milestone
- Use icons or small illustrations for key events
- ${styleDescriptions[style]}
- Ensure readability of all text and labels
- Consider color-coding related events
    `.trim(),
  },

  infographic: {
    defaultAspectRatio: "3:4",
    promptTemplate: (description, style) => `
Create an informative infographic about:

${description}

Requirements:
- Use visual hierarchy to guide the reader
- Include relevant icons, illustrations, and data visualizations
- Break complex information into digestible sections
- ${styleDescriptions[style]}
- Ensure all text is legible and properly sized
- Use visual metaphors where appropriate
    `.trim(),
  },

  process: {
    defaultAspectRatio: "4:3",
    promptTemplate: (description, style) => `
Create a step-by-step process diagram for:

${description}

Requirements:
- Number each step clearly
- Use illustrations or icons for each step
- Show progression from start to finish
- ${styleDescriptions[style]}
- Include brief descriptions for each step
- Use arrows or visual flow indicators between steps
    `.trim(),
  },

  custom: {
    defaultAspectRatio: "16:9",
    promptTemplate: (description, style) => `
${description}

Visual style: ${styleDescriptions[style]}
    `.trim(),
  },
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Validate required arguments
  if (!args.type) {
    console.error("Error: --type is required");
    console.error("Valid types: architecture, flowchart, erd, sequence, timeline, infographic, process, custom");
    process.exit(1);
  }

  if (!args.prompt) {
    console.error("Error: --prompt is required");
    console.error("Usage: npx tsx generate-diagram.ts --type architecture --prompt \"Description\" --output ./diagram.png");
    process.exit(1);
  }

  if (!args.output) {
    console.error("Error: --output is required");
    console.error("Usage: npx tsx generate-diagram.ts --type architecture --prompt \"Description\" --output ./diagram.png");
    process.exit(1);
  }

  const diagramType = args.type as DiagramType;
  const description = args.prompt;
  const outputPath = args.output;
  const style = (args.style || "professional") as DiagramStyle;
  const resolution = (args.resolution || "2K") as ImageResolution;

  // Validate diagram type
  const validTypes = Object.keys(diagramConfigs);
  if (!validTypes.includes(diagramType)) {
    console.error(`Error: Invalid diagram type "${diagramType}". Valid options: ${validTypes.join(", ")}`);
    process.exit(1);
  }

  // Validate style
  const validStyles = ["professional", "colorful", "minimal", "modern"];
  if (!validStyles.includes(style)) {
    console.error(`Error: Invalid style "${style}". Valid options: ${validStyles.join(", ")}`);
    process.exit(1);
  }

  // Validate resolution
  const validResolutions = ["1K", "2K", "4K"];
  if (!validResolutions.includes(resolution)) {
    console.error(`Error: Invalid resolution "${resolution}". Valid options: ${validResolutions.join(", ")}`);
    process.exit(1);
  }

  const config = diagramConfigs[diagramType];
  const aspectRatio = (args["aspect-ratio"] || config.defaultAspectRatio) as AspectRatio;
  const fullPrompt = config.promptTemplate(description, style);

  console.log("=".repeat(60));
  console.log("Nano Banana Diagram Generation");
  console.log("=".repeat(60));
  console.log(`Diagram Type: ${diagramType}`);
  console.log(`Style: ${style}`);
  console.log(`Aspect Ratio: ${aspectRatio}`);
  console.log(`Resolution: ${resolution}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Description: ${description.substring(0, 80)}${description.length > 80 ? "..." : ""}`);
  console.log("-".repeat(60));

  console.log("[...] Generating diagram...");

  // Always use pro model for diagrams (better text rendering and quality)
  const result = await generateImage(fullPrompt, outputPath, {
    model: "gemini-3-pro-image-preview",
    aspectRatio,
    resolution,
  });

  if (result.success) {
    const fileSize = fs.statSync(outputPath).size;
    console.log(`[OK] Diagram generated successfully`);
    console.log(`[OK] Saved to: ${outputPath}`);
    console.log(`[OK] File size: ${fileSize.toLocaleString()} bytes`);
    if (result.text) {
      console.log(`[INFO] API response: ${result.text.substring(0, 200)}${result.text.length > 200 ? "..." : ""}`);
    }
    console.log("=".repeat(60));
    console.log("SUCCESS");
    console.log("=".repeat(60));
  } else {
    console.error(`[ERROR] Failed to generate diagram: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
