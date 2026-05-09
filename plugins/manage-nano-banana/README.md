# manage-nano-banana

Generate and edit images, create diagrams, infographics, and visualizations using Google's Nano Banana API (Gemini Image Generation). Use when you want Claude to create images from text, edit existing images, generate architecture diagrams, flowcharts, ERDs, timelines, or any visual artifact.

## Overview

The plugin exposes image generation and editing through the `manage-nano-banana` skill, which Claude invokes automatically when you ask for visual output. It calls Google's Gemini Image Generation API (Nano Banana) and saves the resulting PNG to disk for inspection.

Typical outputs land at `./output.png` (or a path you specify). Inputs can be a text prompt alone or a text prompt plus one or more reference images for editing/style transfer.

## Prerequisites

- A Google AI Studio account ([aistudio.google.com](https://aistudio.google.com)) — free tier works for low-volume use.
- A **Gemini API key** (create one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
- Node.js 18+.

## Installation

```bash
/plugin install manage-nano-banana
```

Set your API key as an environment variable so the skill can reach Gemini:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Add it to `~/.zshrc` or `~/.bashrc` to persist across sessions. The skill reads `GEMINI_API_KEY` at runtime and refuses to start without it.

## Usage

This plugin provides the `manage-nano-banana` skill which Claude invokes automatically. Say "generate an image of...", "create a diagram showing...", or "edit this image to..." and Claude routes to the skill.

There's also one slash command that wraps the skill with NBG branding:

- `/create-nbg-infographic` — generates landscape infographics with the NBG accent colour `#007b85` and Roboto font.

## Documentation

See [`skills/manage-nano-banana/SKILL.md`](./skills/manage-nano-banana/SKILL.md) for the full prompt-to-image API and supported image-editing modes.

## License

MIT
