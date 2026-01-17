# manage-google-workspace

Manage Google Workspace files, folders, and documents using TypeScript CLI tools. Full support for Google Drive (list, search, upload, download, organize), Google Docs (create, read, edit, search), Google Sheets (CRUD, queries, multi-range operations), and Google Slides (presentations, slides, text). Manage sharing permissions. Use when user needs to interact with Google Drive or any Google Workspace document types.

## Overview

npx tsx ./tools/drive-search.ts \
  --name "report" --type all

## Installation

```bash
/plugin install manage-google-workspace
```

## Usage

This plugin provides the `manage-google-workspace` skill which Claude will use automatically based on context.

## Documentation

See `skills/manage-google-workspace/SKILL.md` for complete documentation.

## License

MIT
