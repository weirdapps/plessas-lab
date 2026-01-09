---
description: Access and manage Google Drive files, folders, and documents
argument-hint: [operation: list|search|upload|download|export|docs|sheets|slides]
allowed-tools: Skill(manage-google-workspace), Bash
---

<objective>
Delegate Google Workspace operations to the manage-google-workspace skill for: $ARGUMENTS

This routes to the specialized skill containing prebuilt TypeScript CLI tools for:
- Google Drive (list, search, upload, download, organize, permissions)
- Google Docs (create, read, edit, search)
- Google Sheets (CRUD, queries, multi-range operations)
- Google Slides (presentations, slides, text)
</objective>

<process>
1. Use Skill tool to invoke manage-google-workspace skill
2. Pass user's request: $ARGUMENTS
3. Let skill handle the operation using appropriate CLI tools
</process>

<success_criteria>
- Skill successfully invoked
- Appropriate tool selected and executed
- Results returned in requested format (human-readable or JSON)
</success_criteria>
