---
description: Split PDF files into individual pages (PDF or PNG format)
argument-hint: [pdf file path or task description]
allowed-tools: Skill(pdf-splitter)
---

<objective>
Delegate PDF splitting tasks to the pdf-splitter skill for: $ARGUMENTS

This routes to specialized skill containing TypeScript implementation patterns, library references, and configuration templates.
</objective>

<process>
1. Use Skill tool to invoke pdf-splitter skill
2. Pass user's request: $ARGUMENTS
3. Let skill handle implementation workflow
</process>

<success_criteria>
- Skill successfully invoked
- Arguments passed correctly to skill
</success_criteria>
