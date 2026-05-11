# plessas-lab Share-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `plessas-lab` to "future-shareable" hygiene — fix the broken-build risk in `package.json`, add a graceful platform check to the macOS-only `manage-apple-notes` plugin (so non-Mac teammates get a clean message instead of a `FileNotFoundError: 'osascript'` traceback), and accept the `mail-pro` plugin moved from `plessas-marketplace`. Maintainer-only plugins (`mail-pro`, `chat-watch`) keep their hardcoded paths and dependencies — they live in this lab marketplace exactly because that's acceptable here.

**Architecture:** Three short phases. (1) Pin npm devDependencies to versions actually tested. (2) Add a tiny `_platform.py` helper in the apple-notes scripts dir; each of the 5 osascript-calling scripts imports it and calls `require_macos()` before any other work — friendly stderr message + non-zero exit on non-Darwin. (3) Receive the `mail-pro` plugin migrated from `plessas-marketplace` (the move itself is in `plessas-marketplace`'s plan, Phase 4 — this plan only covers the lab side: marketplace.json entry, README annotation).

**Tech Stack:** Python 3.11+ for `chat-watch` and `manage-apple-notes` scripts; Node 20 LTS + TypeScript 5.9 for `manage-gmail`/`manage-youtube`/`manage-nano-banana` tools and the lab's vitest suite.

**Out of scope (deliberate maintainer decisions):**

- `chat-watch` keeps the undocumented `teams-cli` dependency. The description already says "Requires teams-cli authenticated"; the plugin is maintainer-only by design.
- `mail-pro` keeps its hardcoded `SENDER_FILTER = "%plessas%"` and `~/SourceCode/second-brain/` dependency. Same reason.
- `/create-nbg-infographic` keeps its NBG branding (NBG colors, "NBG themed" wording). Falls under the "lab is maintainer's personal marketplace" framing.
- Top-level README rewrite, per-plugin Windows env-var syntax additions, pre-built `dist/` for `manage-youtube` / `manage-nano-banana` — defer until lab is actually being shared.

---

## File Structure

**New files:**

- `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/_platform.py` — shared OS-guard helper

**Modified files:**

- `package.json` — pin TS / @types/node / vitest / coverage to tested versions
- `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/list-notes.py` — add OS guard
- `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/create-note.py` — add OS guard
- `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/read-note.py` — add OS guard
- `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/delete-note.py` — add OS guard
- `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/attach-clipboard-image.py` — add OS guard
- `plugins/manage-apple-notes/.claude-plugin/plugin.json` — description prefixed `[macOS only]`
- `plugins/manage-apple-notes/README.md` — top callout for macOS-only
- `.claude-plugin/marketplace.json` — register `mail-pro` plugin (after Phase 4 of plessas-marketplace plan completes), bump metadata.version

**Received from `plessas-marketplace`:**

- `plugins/mail-pro/` — entire directory (handled in `plessas-marketplace`'s plan Phase 4; this plan only verifies receipt)

---

## Phase 1 — Pin npm devDependencies

### Task 1.1: Pin lab top-level package.json deps to tested versions

**Why:** `package.json` declares `"typescript": "^6.0.3"`, `"@types/node": "^25.6.0"`, `"vitest": "^4.1.5"`, `"@vitest/coverage-v8": "^4.1.5"`. Versions 6.x and 4.x exist on npm — but the lab has only ever been verified against earlier major versions (TS 5.x, vitest 3.x). A fresh `npm install` today silently bumps to TS 6 with breaking changes, and the lab's test suite (`vitest`) hasn't been validated against vitest 4. Pin to what was tested.

**Files:**

- Modify: `package.json`
- Test: `rm -rf node_modules package-lock.json && npm install && npm test`

- [ ] **Step 1: Inspect actually-installed versions.**

```bash
cd ~/SourceCode/plessas-lab
for dep in typescript @types/node vitest @vitest/coverage-v8; do
  echo "=== $dep ==="
  cat node_modules/$dep/package.json 2>/dev/null \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['version'])" 2>/dev/null \
    || echo "(not installed)"
done
```

Record the four installed versions. Use those as the pin targets in Step 2.

- [ ] **Step 2: Rewrite `package.json`** (use the actual versions from Step 1; the values below are placeholders matching `plessas-marketplace`'s plan):

```json
{
  "name": "plessas-lab",
  "version": "1.2.0",
  "type": "module",
  "private": true,
  "description": "Lab marketplace: Apple Notes (macOS-only), Gmail, Nano Banana, YouTube, chat-watch (Teams monitor with LLM gate), and mail-pro (maintainer-only).",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "typescript": "~5.9.3",
    "vitest": "^3.0.0"
  }
}
```

Notes:

- `~5.9.3` (tilde) blocks an automatic upgrade to TS 6.
- `@types/node ^22.0.0` matches Node 22 LTS while staying compatible with the declared `engines.node >=20`.
- `vitest ^3.0.0` is the last stable line before vitest 4 (which broke config compatibility).
- `@vitest/coverage-v8 ^3.0.0` must match the vitest major version.
- Bumped `version` 1.1.0 → 1.2.0 to mark this change.
- Description updated to reflect the incoming `mail-pro` and clarify macOS-only nature of `manage-apple-notes`.

- [ ] **Step 3: Clean install.**

```bash
cd ~/SourceCode/plessas-lab
rm -rf node_modules package-lock.json
npm install 2>&1 | tail -5
```

Expected: exit 0, output ends with `added N packages` and zero `npm error` lines.

- [ ] **Step 4: Run the test suite.**

```bash
npm test 2>&1 | tail -10
```

Expected: vitest summary `Tests N passed` with no failures.

- [ ] **Step 5: Commit.**

```bash
git add package.json package-lock.json
git commit -m "fix(lab): pin TS/types-node/vitest to tested versions, add engines.node, bump 1.2.0"
```

---

## Phase 2 — Apple Notes graceful OS check

`manage-apple-notes` is structurally macOS-only (uses `osascript` to drive the Notes.app). On non-Mac it currently crashes with `FileNotFoundError: [Errno 2] No such file or directory: 'osascript'` — confusing for a non-Mac teammate who just installed the plugin and is trying to figure out why. Add a friendly, early platform check that exits cleanly with a clear message.

**Maintainer requirement:** check OS at script entry, inform gracefully on first use. Do NOT refuse install (the plugin still has value as a macOS resource; install-time refusal would block fresh-clone testing on a CI Linux runner).

### Task 2.1: Create `_platform.py` helper

**Why:** Five scripts need the same 3-line check. A tiny helper module DRYs it up and lets any future macOS-only script in this plugin reuse the same gate.

**Files:**

- Create: `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/_platform.py`

- [ ] **Step 1: Write the helper.**

```python
"""Platform compatibility helpers for manage-apple-notes scripts.

manage-apple-notes drives Apple's Notes.app via osascript (AppleScript),
which only exists on macOS. This module enforces that constraint with a
friendly stderr message instead of letting subprocess raise
FileNotFoundError on Linux/Windows.
"""

import sys


def require_macos(script_name: str = "this script") -> None:
    """Exit cleanly with a friendly message if not running on macOS.

    Call at the top of any script in this plugin, before any subprocess
    call to ``osascript``. On Darwin this is a no-op. On any other
    platform, prints a one-line explanation to stderr and exits 1 — so
    the calling agent (or shell) sees a clear "this is macOS only"
    message rather than a Python traceback or "command not found".
    """
    if sys.platform != "darwin":
        sys.stderr.write(
            f"manage-apple-notes is macOS-only — {script_name} requires the "
            f"Notes.app and osascript, neither of which exist on "
            f"{sys.platform}.\n"
            f"This plugin works on macOS. On Linux/Windows, skip it or run "
            f"on a Mac.\n"
        )
        sys.exit(1)
```

- [ ] **Step 2: Verify it imports cleanly.**

```bash
cd ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts
python3 -c "from _platform import require_macos; print(require_macos.__doc__[:60])"
```

Expected: prints the first 60 chars of the docstring.

- [ ] **Step 3: Test the macOS path** (no-op on Mac).

```bash
python3 -c "import sys; sys.path.insert(0, '.'); from _platform import require_macos; require_macos('test'); print('OK on darwin')"
```

Expected on Mac: `OK on darwin`. Expected on Linux/Windows: friendly stderr message + exit 1.

- [ ] **Step 4: Test the non-macOS path** by faking the platform.

```bash
python3 -c "
import sys
sys.platform = 'linux'   # simulate non-Mac
sys.path.insert(0, '.')
from _platform import require_macos
require_macos('list-notes.py')
" 2>&1 || echo "exit code: $?"
```

Expected output:

```text
manage-apple-notes is macOS-only — list-notes.py requires the Notes.app and osascript, neither of which exist on linux.
This plugin works on macOS. On Linux/Windows, skip it or run on a Mac.
exit code: 1
```

- [ ] **Step 5: Commit.**

```bash
cd ~/SourceCode/plessas-lab
git add plugins/manage-apple-notes/skills/manage-apple-notes/scripts/_platform.py
git commit -m "feat(apple-notes): add _platform.py helper with require_macos guard"
```

### Task 2.2: Wire `require_macos` into list-notes.py

**Files:**

- Modify: `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/list-notes.py`

- [ ] **Step 1: Read the current top of file** to confirm insertion point (just after the docstring + imports).

```bash
head -15 ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts/list-notes.py
```

- [ ] **Step 2: Edit the file** to add the guard right after `import subprocess` (line 11).

Change from:

```python
import subprocess

FOLDER = "agent-notes"
```

To:

```python
import subprocess
import sys
from pathlib import Path

# OS guard — manage-apple-notes is macOS-only.
sys.path.insert(0, str(Path(__file__).parent))
from _platform import require_macos
require_macos("list-notes.py")

FOLDER = "agent-notes"
```

- [ ] **Step 3: Test on Mac.**

```bash
python3 ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts/list-notes.py
```

Expected: same behavior as before (lists notes from the `agent-notes` folder, or "No notes found.").

- [ ] **Step 4: Defer commit until all 5 scripts are guarded** (Task 2.6).

### Task 2.3: Wire `require_macos` into create-note.py

**Files:**

- Modify: `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/create-note.py`

- [ ] **Step 1: Apply the same import + guard pattern** from Task 2.2 Step 2 — replace the script identifier in the `require_macos(...)` call with `"create-note.py"`.

- [ ] **Step 2: Smoke test on Mac.**

```bash
python3 ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts/create-note.py --help 2>&1 | head -5
```

Expected: prints the help message (no platform error on Mac).

- [ ] **Step 3: Defer commit.**

### Task 2.4: Wire `require_macos` into read-note.py

**Files:**

- Modify: `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/read-note.py`

- [ ] **Step 1: Apply the guard** from Task 2.2 Step 2, with `"read-note.py"` as the identifier.

- [ ] **Step 2: Smoke test on Mac.**

```bash
python3 ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts/read-note.py --help 2>&1 | head -5
```

- [ ] **Step 3: Defer commit.**

### Task 2.5: Wire `require_macos` into delete-note.py

**Files:**

- Modify: `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/delete-note.py`

- [ ] **Step 1: Apply the guard** from Task 2.2 Step 2, with `"delete-note.py"` as the identifier.

- [ ] **Step 2: Smoke test on Mac.**

```bash
python3 ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts/delete-note.py --help 2>&1 | head -5
```

- [ ] **Step 3: Defer commit.**

### Task 2.6: Wire `require_macos` into attach-clipboard-image.py + commit all 5 guards

**Files:**

- Modify: `plugins/manage-apple-notes/skills/manage-apple-notes/scripts/attach-clipboard-image.py`

- [ ] **Step 1: Apply the guard** from Task 2.2 Step 2. The current top of file is:

```python
import argparse
import os
import subprocess
import sys
import tempfile
```

(`sys` is already imported.) Change to:

```python
import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# OS guard — manage-apple-notes is macOS-only.
sys.path.insert(0, str(Path(__file__).parent))
from _platform import require_macos
require_macos("attach-clipboard-image.py")
```

- [ ] **Step 2: Smoke test on Mac.**

```bash
python3 ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts/attach-clipboard-image.py --help 2>&1 | head -5
```

Expected: prints help, no platform error.

- [ ] **Step 3: Verify all 5 scripts wire the guard correctly via grep** (avoids the need to fake `sys.platform` per script — the helper itself was tested in Task 2.1 Step 4).

```bash
cd ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts
for script in list-notes.py create-note.py read-note.py delete-note.py attach-clipboard-image.py; do
  if grep -q 'from _platform import require_macos' "$script" \
     && grep -q "require_macos(\"$script\")" "$script"; then
    echo "OK $script"
  else
    echo "MISSING_GUARD $script"
  fi
done
```

Expected: 5 lines, all `OK <script>`. Zero `MISSING_GUARD` lines.

- [ ] **Step 4: One end-to-end non-Mac test by spawning a script as a subprocess with a wrapper that fakes `sys.platform` BEFORE the script imports anything.** This catches any case where the guard isn't called early enough.

```bash
cd ~/SourceCode/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts
for script in list-notes.py create-note.py read-note.py delete-note.py attach-clipboard-image.py; do
  echo "=== $script ==="
  python3 -c "
import sys
# Fake non-Mac platform BEFORE running the script via runpy.
sys.platform = 'linux'
sys.path.insert(0, '.')
import runpy
try:
    runpy.run_path('$script', run_name='__main__')
except SystemExit as e:
    sys.stderr.write(f'(exit code: {e.code})\n')
" 2>&1 | head -3
done
```

Expected per script: stderr message starts with `manage-apple-notes is macOS-only — <script>`, ends with `(exit code: 1)`. Zero Python tracebacks. Zero `FileNotFoundError`. Zero `command not found`.

If a script's output starts with anything other than the friendly message, the guard is in the wrong place — re-check that script and re-run.

- [ ] **Step 5: Commit all 5 guards together.**

```bash
cd ~/SourceCode/plessas-lab
git add plugins/manage-apple-notes/skills/manage-apple-notes/scripts/list-notes.py \
        plugins/manage-apple-notes/skills/manage-apple-notes/scripts/create-note.py \
        plugins/manage-apple-notes/skills/manage-apple-notes/scripts/read-note.py \
        plugins/manage-apple-notes/skills/manage-apple-notes/scripts/delete-note.py \
        plugins/manage-apple-notes/skills/manage-apple-notes/scripts/attach-clipboard-image.py
git commit -m "fix(apple-notes): add OS guard to all 5 scripts — friendly message instead of FileNotFoundError on non-Mac"
```

### Task 2.7: Update plugin.json description to mark macOS-only

**Files:**

- Modify: `plugins/manage-apple-notes/.claude-plugin/plugin.json`

- [ ] **Step 1: Read current description.**

```bash
python3 -c "import json; print(json.load(open(__import__('os').path.expanduser('~/SourceCode/plessas-lab/plugins/manage-apple-notes/.claude-plugin/plugin.json'))['description'])"
```

- [ ] **Step 2: Prefix with `[macOS only]`.** Edit `plugins/manage-apple-notes/.claude-plugin/plugin.json` so the description starts with `[macOS only]`:

```diff
-  "description": "Interact with the Apple Notes app. CRUD operations for persistent storage of thoughts, data, and information across sessions.",
+  "description": "[macOS only] Interact with the Apple Notes app via osascript. CRUD operations for persistent storage of thoughts, data, and information across sessions. On non-Mac, scripts exit with a clear platform-error message.",
```

- [ ] **Step 3: Mirror change in `.claude-plugin/marketplace.json`** (which has its own description for the lab-level listing):

```diff
-      "description": "Interact with the Apple Notes app. CRUD operations for persistent storage of thoughts, data, and information across sessions.",
+      "description": "[macOS only] Interact with the Apple Notes app via osascript. CRUD operations for persistent storage of thoughts, data, and information across sessions. On non-Mac, scripts exit with a clear platform-error message.",
```

- [ ] **Step 4: Validate JSON.**

```bash
python3 -c "import json; json.load(open(__import__('os').path.expanduser('~/SourceCode/plessas-lab/plugins/manage-apple-notes/.claude-plugin/plugin.json'))" && echo OK
python3 -c "import json; json.load(open(__import__('os').path.expanduser('~/SourceCode/plessas-lab/.claude-plugin/marketplace.json'))" && echo OK
```

Expected: two `OK` lines.

- [ ] **Step 5: Commit.**

```bash
git add plugins/manage-apple-notes/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "docs(apple-notes): prefix description with [macOS only] in plugin.json + marketplace.json"
```

### Task 2.8: Add macOS-only callout to plugin README

**Files:**

- Modify: `plugins/manage-apple-notes/README.md`

- [ ] **Step 1: Add a top-of-file callout** right after the H1 heading:

```markdown
> **Platform: macOS only.** This plugin uses AppleScript via `osascript` to drive the Notes.app, which only exists on macOS. On Linux/Windows, every script exits cleanly with a friendly platform-error message (no traceback, no `FileNotFoundError`). The plugin can still be installed on any OS — it just doesn't function elsewhere.
```

- [ ] **Step 2: Commit.**

```bash
git add plugins/manage-apple-notes/README.md
git commit -m "docs(apple-notes): add macOS-only callout at top of README"
```

---

## Phase 3 — Receive mail-pro from plessas-marketplace

The actual move (copy + register + delete) is in `plessas-marketplace`'s plan, Phase 4. This plan only covers the lab-side verification: confirm the migration landed correctly and `mail-pro` is now installable from the lab marketplace.

### Task 3.1: Verify mail-pro arrived from plessas-marketplace

**Why:** The migration is a multi-repo operation. Don't let it half-land.

**Files:** none modified — this is verification only.

- [ ] **Step 1: Confirm the lab now has mail-pro.**

```bash
ls ~/SourceCode/plessas-lab/plugins/mail-pro/ 2>&1
```

Expected: README.md, scripts/style-sync.py, .claude-plugin/plugin.json, commands/comm-report.md, commands/style-rebuild.md.

- [ ] **Step 2: Confirm marketplace.json registered it.**

```bash
python3 -c "
import json
m = json.load(open(__import__('os').path.expanduser('~/SourceCode/plessas-lab/.claude-plugin/marketplace.json'))
names = [p['name'] for p in m['plugins']]
print('plugins:', names)
assert 'mail-pro' in names, 'mail-pro NOT registered'
print('mail-pro registered: OK')
"
```

Expected: `mail-pro registered: OK`.

- [ ] **Step 3: Confirm plessas-marketplace no longer has it.**

```bash
ls ~/SourceCode/plessas-marketplace/plugins/mail-pro/ 2>&1
```

Expected: `No such file or directory`.

```bash
python3 -c "
import json
m = json.load(open(__import__('os').path.expanduser('~/SourceCode/plessas-marketplace/.claude-plugin/marketplace.json'))
names = [p['name'] for p in m['plugins']]
print('plugins:', names)
assert 'mail-pro' not in names, 'mail-pro still in plessas-marketplace'
print('mail-pro removed: OK')
"
```

Expected: `mail-pro removed: OK`.

- [ ] **Step 4: Confirm the maintainer-only callout was added** (per `plessas-marketplace` plan Task 4.5).

```bash
head -10 ~/SourceCode/plessas-lab/plugins/mail-pro/README.md
```

Expected: Top of file contains `> **Maintainer-only.**` callout.

### Task 3.2: Run lab plugin manifest validator

**Files:** none modified.

- [ ] **Step 1: Run any validator the lab ships with.**

```bash
find ~/SourceCode/plessas-lab -name "validate*" -type f 2>/dev/null
```

If a validator is found, run it. If not, fall back to a generic JSON validation:

```bash
python3 -c "
import json, glob
for path in sorted(glob.glob(__import__('os').path.expanduser('~/SourceCode/plessas-lab/plugins/*/.claude-plugin/plugin.json')):
    try:
        d = json.load(open(path))
        assert 'name' in d, f'missing name in {path}'
        assert 'version' in d, f'missing version in {path}'
        print(f'OK {d[\"name\"]} {d[\"version\"]}')
    except Exception as e:
        print(f'FAIL {path}: {e}')
"
```

Expected: `OK <name> <version>` for each of the 6 plugins (manage-apple-notes, manage-gmail, manage-nano-banana, manage-youtube, chat-watch, mail-pro). Zero `FAIL` lines.

### Task 3.3: Smoke-test the lab marketplace install end-to-end

**Files:** none modified.

- [ ] **Step 1: Tear down + reinstall.**

```bash
rm -rf ~/.claude/plugins/marketplaces/plessas-lab
mkdir -p ~/.claude/plugins/marketplaces
git clone https://github.com/weirdapps/plessas-lab.git ~/.claude/plugins/marketplaces/plessas-lab
```

- [ ] **Step 2: Open Claude Code and verify `/plugin list` shows all 6 plugins** including mail-pro.

- [ ] **Step 3: Run an `apple-notes` script on Mac** to confirm the OS guard doesn't break the macOS path.

```bash
python3 ~/.claude/plugins/marketplaces/plessas-lab/plugins/manage-apple-notes/skills/manage-apple-notes/scripts/list-notes.py
```

Expected: works as before.

---

## Phase 4 — Bookkeeping

### Task 4.1: Update CHANGELOG (or create one if missing)

**Files:**

- Create or modify: `CHANGELOG.md`

- [ ] **Step 1: Check if a CHANGELOG exists.**

```bash
ls ~/SourceCode/plessas-lab/CHANGELOG.md 2>&1
```

If missing, create. If present, prepend.

- [ ] **Step 2: Write the entry.**

```markdown
# Changelog

## [1.2.0] — 2026-05-11

### Added
- `mail-pro` plugin migrated in from `plessas-marketplace` (maintainer-only — depends on private second-brain SQLite DB and hardcodes a sender filter; lives here because that constraint is acceptable in the lab marketplace)
- `_platform.py` helper in `manage-apple-notes` scripts dir with `require_macos()` guard
- `[macOS only]` prefix on `manage-apple-notes` description (plugin.json + marketplace.json)
- macOS-only callout at top of `manage-apple-notes/README.md`
- `engines.node >= 20` in `package.json`

### Changed
- `manage-apple-notes` scripts now exit cleanly with a friendly stderr message on non-Mac (no more `FileNotFoundError: 'osascript'` traceback)
- `package.json`: pinned `typescript ~5.9.3`, `@types/node ^22.0.0`, `vitest ^3.0.0`, `@vitest/coverage-v8 ^3.0.0` (was `^6.0.3` / `^25.6.0` / `^4.1.5` — versions exist on npm but lab was only verified against earlier major versions)
- `marketplace.json` metadata version 1.1.0 → 1.2.0
```

- [ ] **Step 3: Commit.**

```bash
git add CHANGELOG.md
git commit -m "chore: changelog for 1.2.0 (apple-notes guard, mail-pro arrival, dep pins)"
```

### Task 4.2: Push + tag

- [ ] **Step 1: Verify git status is clean.**

```bash
cd ~/SourceCode/plessas-lab && git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 2: Push.**

```bash
git push origin <branch-name>
```

- [ ] **Step 3: Tag.**

```bash
git tag v1.2.0
git push --tags
```

---

## Self-review checklist

- [ ] **Spec coverage:** Every audit finding for plessas-lab in scope (TS pins, Apple Notes graceful guard, mail-pro acceptance) has a task. Out-of-scope items (chat-watch teams-cli dep, NBG infographic naming, README Windows variants, dist/ ship for nano-banana/youtube) are listed in "Out of scope" above.

- [ ] **No placeholders:** No `TBD`, `TODO`, `add error handling`, etc.

- [ ] **Path consistency:** Each `~/SourceCode/plessas-lab/...` path resolves to a real file (or one this plan creates).

- [ ] **Verification commands:** Each code change has a verification step with expected output.

- [ ] **Frequent commits:** Every task ends in `git commit`.

- [ ] **Cross-plan consistency:** Phase 3 verifications match what `plessas-marketplace` plan Phase 4 promises to deliver. If `plessas-marketplace`'s plan changes the migration approach, this plan's Phase 3 needs to be updated.

---

## Estimated effort

- Phase 1: 30 min (one task)
- Phase 2: 2 hours (8 tasks across 5 scripts + helper + 2 docs updates)
- Phase 3: 30 min (verification only — actual work in `plessas-marketplace` plan)
- Phase 4: 30 min (changelog + push)

**Total: ~3.5 hours / half a day for one engineer.**

---

## Execution dependency on plessas-marketplace plan

This plan's Phase 3 (Receive mail-pro) cannot complete until `plessas-marketplace`'s plan Phase 4 (Move mail-pro to plessas-lab) has run. Order of operations:

1. Run `plessas-marketplace` plan Tasks 4.1, 4.2 (copy + register in lab) — these write to `plessas-lab`
2. Run `plessas-marketplace` plan Tasks 4.3, 4.4, 4.5 (remove from marketplace + maintainer-only callout)
3. Run THIS plan Phase 3 (verify the migration landed)

Phases 1, 2, and 4 of THIS plan are independent and can run in any order relative to `plessas-marketplace` work.
