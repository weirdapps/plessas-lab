# Changelog

All notable changes to plessas-lab marketplace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-05-11

### Added

- `mail-pro` plugin migrated in from `plessas-marketplace` (maintainer-only — depends on private second-brain SQLite DB and hardcodes a sender filter; lives here because that constraint is acceptable in the lab marketplace)
- `_platform.py` helper in `manage-apple-notes` scripts dir with `require_macos()` guard
- `[macOS only]` prefix on `manage-apple-notes` description (plugin.json + marketplace.json)
- macOS-only callout at top of `manage-apple-notes/README.md`
- `engines.node >= 20` in `package.json`

### Changed

- `manage-apple-notes` scripts now exit cleanly with a friendly stderr message on non-Mac (no more `FileNotFoundError: 'osascript'` traceback)
- `package.json`: pinned `typescript ~5.9.3`, `@types/node ^22.0.0`, `vitest ^4.1.5`, `@vitest/coverage-v8 ^4.1.5` to tested versions (was ^6.0.3 / ^25.6.0 / ^4.1.5 — TS 6 was untested)
- `marketplace.json` metadata version 1.1.0 → 1.2.0

## [1.1.0] — 2026-05-08

Initial lab marketplace release with:

- `manage-apple-notes`: macOS Notes.app integration
- `manage-gmail`: Gmail API access
- `manage-nano-banana`: Google Nano Banana image generation
- `manage-youtube`: YouTube content management
- `chat-watch`: MS Teams monitoring with LLM gate
