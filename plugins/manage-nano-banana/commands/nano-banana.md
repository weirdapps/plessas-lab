---
description: Generate or edit images, create diagrams and visualizations using Nano Banana API
argument-hint: [task description - e.g., "create an architecture diagram for microservices"]
allowed-tools: Skill(manage-nano-banana)
---

<objective>
Delegate image generation, editing, or diagram creation tasks to the manage-nano-banana skill for: $ARGUMENTS

This routes to the specialized skill containing prebuilt TypeScript tools for working with Google's Nano Banana API (Gemini Image Generation).
</objective>

<process>
1. Use Skill tool to invoke manage-nano-banana skill
2. Pass user's request: $ARGUMENTS
3. Let skill handle the workflow using appropriate prebuilt tools
</process>

<success_criteria>

- Skill successfully invoked
- Arguments passed correctly to skill
- Image or diagram generated at specified location
</success_criteria>
