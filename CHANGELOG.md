# Changelog

All notable changes to plessas-lab marketplace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `checks.yml` workflow: a blocking gate that typechecks all four TypeScript packages, runs the vitest suite, and runs pytest on every push and PR. No existing workflow compiled the TypeScript, and `sonarcloud.yml` runs pytest behind `continue-on-error` + `|| true`, so type errors and failing tests could land on master unnoticed.
- `npm run typecheck` (`scripts/typecheck.sh`) to run the same check locally.
- Explicit `google-auth-library` dependency plus an `overrides` pin in `manage-gmail` and `manage-youtube`'s `playlist-tools`. Both imported it without declaring it.

### Changed

- TypeScript 6.0.3 → 7.0.2 (the Go-native compiler) in the root package and all four plugin packages.
- Every `tsconfig.json` now sets `"types": ["node"]`. TypeScript 6 changed the default of `types` from "every installed `@types` package" to `[]`, and the packages had been relying on that implicit inclusion.
- `manage-youtube`'s `tools/tsconfig.json` no longer compiles the nested `playlist-tools` package, which is a separate npm package with its own dependency tree and is spawned as a subprocess rather than imported.
- `googleapis` `^173.0.0` → `^174.0.0` in `manage-gmail` and `playlist-tools`, which pins `google-auth-library` to a single exact version instead of two incompatible copies.
- `actions/setup-python` 6 → 7 in `sonarcloud.yml`.
- vitest `testTimeout` and `hookTimeout` raised to 60s. The suite re-imports plugin sources per test, and the first cold import exceeded the 5s default.

### Fixed

- `search.ts` sent filter values InnerTube does not accept, so `--duration` and `--sort` were silently ignored. `short`/`medium`/`long` now map to InnerTube's minute buckets and `--sort` maps to its `prioritize` field.
- `--upload-date hour` and `--sort upload_date|rating` are no longer advertised; InnerTube has no equivalent. Unknown filter values now fail with a clear message instead of being passed through.
- Ten pre-existing type errors across `manage-gmail` and `manage-youtube` that had never been caught because nothing ran `tsc`.

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
