---
description: "Quick status dashboard — cached from last scan or live git sweep"
argument-hint: "[--live]"
allowed-tools: Bash, Read, Glob, Grep
---

Quick infrastructure status check. Two modes:

## Default Mode (cached)

Read `~/.ops-sync/last-run.json` and present a compact summary.

If the file exists:

- Show when the last full scan was (timestamp)
- Show the dimension status table (from saved state)
- Show the issues count (RED / YELLOW)
- List any RED issues
- If the scan is older than 24 hours, warn: "Last scan is >24h old — run `/ops-sync` for fresh data"

If the file does NOT exist:

- Say "No previous scan found. Run `/ops-sync` to perform a full infrastructure scan."

## Live Mode (`--live` in `$ARGUMENTS`)

Fast Bash-only git sweep across all repos — no agents, no SSH, no GH API. Completes in under 10 seconds.

Run this single batch command:

```bash
echo "REPO|BRANCH|DIRTY|UNPUSHED|BEHIND"
for d in ~/SourceCode/*/; do
  [ -d "$d/.git" ] || continue
  repo=$(basename "$d")
  cd "$d"
  branch=$(git branch --show-current 2>/dev/null || echo "detached")
  dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  unpushed=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "?")
  behind=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "?")
  [ "$dirty" != "0" ] || [ "$unpushed" != "0" ] || [ "$behind" != "0" ] && flag="*" || flag=" "
  echo "$flag $repo|$branch|$dirty|$unpushed|$behind"
done
```

Present as a compact table, highlighting repos with dirty files, unpushed commits, or behind remote. Show totals at the bottom.

```
 LIVE GIT STATUS — YYYY-MM-DD HH:MM
 ─────────────────────────────────────────────────
 Repo                   Branch    Dirty  Push  Pull
 ─────────────────────────────────────────────────
 * etoro-tui            fix/lint     2     0     0
 * news                 master       0     3     0
   etorotrade           master       0     0     0
   ... (clean repos collapsed if >10)

 TOTALS: 25 repos | 2 dirty | 1 with unpushed | 0 behind
 ─────────────────────────────────────────────────

 Last full scan: 2026-06-19 14:30 (2h ago)
```

If there are more than 10 clean repos, collapse them into a single "N repos clean" line to keep the output tight. Always show dirty/unpushed/behind repos individually.

Also show the timestamp of the last full scan (from `~/.ops-sync/last-run.json`) for context, if it exists.
