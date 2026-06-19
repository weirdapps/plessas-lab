---
description: "Fix identified issues from last ops-sync scan — lint errors, test failures, git sync, service restarts"
argument-hint: "[--issue N] [--all] [--dry-run]"
allowed-tools: Agent, Read, Write, Edit, Bash, Glob, Grep
---

Fix issues identified by the last `/ops-sync` scan.

## Parse Arguments

From `$ARGUMENTS`:

- `--issue N`: fix only issue number N from the issues list
- `--all`: fix all issues in sequence
- `--dry-run`: report what WOULD be done without executing
- If none specified: present the issues list and ask which to fix

## Step 1 — Load Issues

Read `~/.ops-sync/last-run.json` to get the issues list.

If the file doesn't exist or has no issues:
> "No issues found. Run `/ops-sync` first to scan for problems, or all systems are green."

## Step 2 — Present Issues

Show the numbered issues list:

```
 ISSUES FROM LAST SCAN (YYYY-MM-DD HH:MM)
 ─────────────────────────────────────────────────
 1. [RED]    news: 5 ruff lint violations
 2. [RED]    etoro-tui: 3 test failures in test_ui.py
 3. [YELLOW] second-brain (VPS): 2 commits behind remote
 4. [YELLOW] plessas-lab: on branch fix/ruff (not master)
```

If `--issue N` was specified, select that issue.
If `--all` was specified, select all issues.
Otherwise, ask: "Which issue(s) to fix? Enter number(s), 'all', or 'cancel'."

## Step 3 — Dispatch Fixer

Launch the **fixer** agent with the selected issues. The fixer inherits the default model (opus) for complex remediation.

Include in the fixer's prompt:

1. The selected issues with full details (from the JSON reports)
2. The repo registry (from `${CLAUDE_PLUGIN_ROOT}/shared/repo-registry.md`)
3. Whether `--dry-run` was specified
4. The safety contract (no auto-push, no auto-commit, ask before service restarts)

Read the relevant agent report files for full details:

```bash
cat ~/.ops-sync/reports/repo-scanner.json 2>/dev/null
cat ~/.ops-sync/reports/vps-auditor.json 2>/dev/null
cat ~/.ops-sync/reports/mac-auditor.json 2>/dev/null
```

## Step 4 — Update State

After the fixer completes, update `~/.ops-sync/last-run.json`:

- Remove issues that were fully fixed
- Update issues that were partially fixed
- Keep issues that were skipped or couldn't be fixed

## Important

- The fixer agent inherits the session model (opus) — do NOT override
- Pass the `--dry-run` flag through to the fixer if specified
- The fixer has a strict safety contract — it will ask the user before any state-changing operation
- After fixing, suggest running `/ops-sync --scope <relevant>` to verify the fixes
