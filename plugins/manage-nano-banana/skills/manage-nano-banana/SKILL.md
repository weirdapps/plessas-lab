---
name: manage-nano-banana
description: Generate and edit images, create diagrams, infographics, and visualizations using Google's Nano Banana API (Gemini Image Generation). Use when the user asks to create images, edit existing images, generate architecture diagrams, flowcharts, ERDs, timelines, or any visual artifacts.
---

> **Path Convention**: All paths in this document are relative to this skill's root directory. When executing commands, first `cd` to the skill directory or adjust paths accordingly.

<objective>
Enable Claude Code to create, edit, and generate visual content using Google's Nano Banana API. This skill provides prebuilt TypeScript tools to avoid code duplication and ensure consistent image generation across tasks.
</objective>

<context>
**API Authentication**: Uses the `GEMINI_API_KEY` environment variable.

**Available Models**:

- `gemini-2.5-flash-image` - Fast, efficient, ~$0.039/image, 1K resolution
- `gemini-3-pro-image-preview` - High quality, up to 4K, advanced text rendering, up to 14 reference images

**Aspect Ratios**: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

**Resolutions**: `1K` (both models), `2K`, `4K` (Pro only)
</context>

<quick_start>
**Setup**: Ensure `GEMINI_API_KEY` is set in environment and install dependencies:

```bash
cd ./tools
npm install
```

**Generate an image**:

```bash
npx tsx ./tools/generate-image.ts \
  --prompt "A watercolor painting of a fox in a snowy forest" \
  --output ./fox.png
```

**Edit an existing image**:

```bash
npx tsx ./tools/edit-image.ts \
  --input ./photo.png \
  --prompt "Change the blue car to red" \
  --output ./photo-edited.png
```

**Generate a diagram**:

```bash
npx tsx ./tools/generate-diagram.ts \
  --type architecture \
  --prompt "Microservices architecture with API Gateway, User Service, and Database" \
  --output ./architecture.png
```

</quick_start>

<workflows>
<image_generation>
**Text-to-Image Generation**

Use `generate-image.ts` for creating images from text descriptions.

```bash
npx tsx ./tools/generate-image.ts \
  --prompt "Your detailed prompt here" \
  --output ./output.png \
  --model gemini-2.5-flash-image \
  --aspect-ratio 16:9 \
  --resolution 1K
```

**Options**:

- `--prompt` (required): Text description of the image
- `--output` (required): Output file path
- `--model`: `gemini-2.5-flash-image` (default) or `gemini-3-pro-image-preview`
- `--aspect-ratio`: Any supported ratio (default: `1:1`)
- `--resolution`: `1K` (default), `2K`, or `4K` (Pro model only)
</image_generation>

<image_editing>
**Image Editing (Inpainting)**

Use `edit-image.ts` for modifying specific elements in existing images.

```bash
npx tsx ./tools/edit-image.ts \
  --input ./source.png \
  --prompt "Change the sofa to a brown leather chesterfield" \
  --output ./edited.png \
  --model gemini-2.5-flash-image
```

**Options**:

- `--input` (required): Source image path
- `--prompt` (required): Editing instructions
- `--output` (required): Output file path
- `--model`: Model to use (default: `gemini-2.5-flash-image`)

**Best Practices**:

- Be specific about what to change and what to preserve
- Reference specific elements: "change only the blue sofa"
- Mention preservation: "keep the rest of the room unchanged"
</image_editing>

<diagram_generation>
**Diagram and Visualization Generation**

Use `generate-diagram.ts` for creating technical diagrams, infographics, and visualizations.

```bash
npx tsx ./tools/generate-diagram.ts \
  --type flowchart \
  --prompt "Authentication flow with 2FA" \
  --output ./auth-flow.png \
  --aspect-ratio 3:4 \
  --resolution 2K
```

**Diagram Types** (`--type`):

- `architecture` - System architecture diagrams
- `flowchart` - Process flowcharts and decision trees
- `erd` - Entity-relationship diagrams
- `sequence` - Sequence diagrams
- `timeline` - Timeline visualizations
- `infographic` - Infographics for explaining concepts
- `process` - Step-by-step process diagrams
- `custom` - Free-form diagram (uses prompt as-is)

**Options**:

- `--type` (required): Diagram type
- `--prompt` (required): Description of the diagram content
- `--output` (required): Output file path
- `--aspect-ratio`: Ratio (default varies by type)
- `--resolution`: `1K`, `2K` (default), or `4K`
- `--style`: `professional` (default), `colorful`, `minimal`, `modern`
</diagram_generation>
</workflows>

<prebuilt_tools>
**Location**: `./tools/`

| Tool | Purpose |
|------|---------|
| `generate-image.ts` | Text-to-image generation |
| `edit-image.ts` | Image editing/inpainting |
| `generate-diagram.ts` | Diagrams and visualizations |
| `nano-banana-client.ts` | Shared client library |

All tools:

- Read `GEMINI_API_KEY` from environment (no fallback - throws if missing)
- Support both models
- Include proper error handling
- Save images to specified output paths
</prebuilt_tools>

<prompting_best_practices>
**For Images**:

- Be specific about subject, style, colors, mood
- Include artistic style references: "watercolor", "photorealistic", "minimalist"
- Specify composition: "centered", "rule of thirds", "close-up"

**For Diagrams**:

- List all components explicitly
- Describe connections and relationships
- Specify visual requirements: icons, colors, labels
- Include standard notation where applicable (UML, crow's foot, etc.)

**For Editing**:

- Clearly identify what to change
- Explicitly state what should remain unchanged
- Describe the desired result in detail
</prompting_best_practices>

<anti_patterns>

- **Missing API key**: Never provide fallback values. The tools will throw if `GEMINI_API_KEY` is not set.
- **Wrong resolution for model**: Don't use `2K` or `4K` with `gemini-2.5-flash-image` (1K max)
- **Vague editing prompts**: "Make it better" won't work. Be specific: "Change the color to blue"
- **Expecting precise UML notation**: For formal ERD/sequence diagrams, the API may return Mermaid syntax instead of images
</anti_patterns>

<success_criteria>

- Generated image saved to the specified output path
- File size is non-zero (typically 50KB-500KB+)
- Tool exits with code 0
- No API errors in output

**Verification**:

```bash
# Check file was created
ls -la ./output.png

# Use the Read tool to view the generated image
# Claude Code can display images when read with the Read tool
```

</success_criteria>

<detailed_references>
**API Guide**: See the full Nano Banana API Guide for advanced features:

- Multi-turn editing (chat-based refinement)
- Multiple reference images for character consistency
- Image blending techniques

**Diagram Templates**: The `generate-diagram.ts` tool includes optimized prompt templates for each diagram type. See [tools/generate-diagram.ts](tools/generate-diagram.ts) for the full template definitions.
</detailed_references>
