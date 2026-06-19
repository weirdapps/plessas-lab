---
description: "Deep diagnostic of a specific subsystem — repos, VPS, GitHub, or Mac"
argument-hint: "<subsystem> [name]  —  subsystems: repos, vps, github, mac"
allowed-tools: Bash, Read, Glob, Grep
---

Deep diagnostic for a single subsystem. No agents — runs inline for fast response.

Parse `$ARGUMENTS` to identify the subsystem and optional target name.

## Subsystem: `repos [repo-name]`

If a specific repo name is given, deep-dive that repo. If no name given, ask which repo (or run quick summary of all).

**For a specific repo:**

```bash
cd ~/SourceCode/<repo>

# Git state
echo "=== GIT STATE ==="
git status
git log --oneline -10
git remote -v
git branch -a
git stash list
git worktree list

# CI config
echo "=== CI CONFIG ==="
ls .github/workflows/ 2>/dev/null

# Test config + run
echo "=== TESTS ==="
# Python:
python -m pytest --tb=short -v 2>&1 | tail -30
# OR JS/TS:
npx vitest run --reporter=verbose 2>&1 | tail -30

# Lint config + run
echo "=== LINT ==="
# Python:
ruff check . 2>&1
# OR JS/TS:
npx eslint . 2>&1

# VPS copy check
echo "=== VPS COPY ==="
ssh -o ConnectTimeout=5 vps "cd ~/SourceCode/<repo> 2>/dev/null && git log --oneline -3 && git status --porcelain" 2>&1 || echo "Not on VPS or unreachable"

# Disk usage
echo "=== DISK ==="
du -sh .
du -sh .git
```

Present results in organized sections with clear pass/fail indicators.

## Subsystem: `vps [unit-name]`

If a specific unit name is given, deep-dive that unit. If no name, show full VPS overview.

**Full VPS overview:**

```bash
ssh vps '
echo "=== SYSTEM ==="
uptime
free -h
df -h / /mnt/data

echo "=== SERVICES ==="
systemctl --user list-units --type=service --state=active --no-pager

echo "=== TIMERS ==="
systemctl --user list-timers --all --no-pager

echo "=== FAILED UNITS ==="
systemctl --user --failed --no-pager

echo "=== RECENT ERRORS (1h) ==="
journalctl --user --since "1 hour ago" --priority=err --no-pager | tail -20

echo "=== TOKEN AGES ==="
for f in ~/.config/outlook-cli/session.json ~/.config/outlook-cli/multi-tokens.json ~/.config/gcloud/application_default_credentials.json; do
  [ -f "$f" ] && echo "$(basename $f): $(stat -c %y $f 2>/dev/null)"
done
' 2>&1
```

**For a specific unit:**

```bash
ssh vps "
echo '=== STATUS ==='
systemctl --user status <unit> --no-pager

echo '=== PROPERTIES ==='
systemctl --user show <unit> --property=ActiveState,SubState,NRestarts,ActiveEnterTimestamp,ExecMainStartTimestamp,Result --no-pager

echo '=== JOURNAL (last 2h) ==='
journalctl --user -u <unit> --since '2 hours ago' --no-pager | tail -50

echo '=== TIMER INFO ==='
systemctl --user list-timers <unit>.timer --no-pager 2>/dev/null
" 2>&1
```

## Subsystem: `github [repo-name]`

If a repo name is given, deep-dive that repo's GH status. If no name, show overview.

**For a specific repo:**

```bash
cd ~/SourceCode/<repo>

echo "=== WORKFLOW RUNS (last 10) ==="
gh run list --limit 10

echo "=== WORKFLOWS ==="
gh workflow list

echo "=== BRANCH PROTECTION ==="
gh api repos/weirdapps/<repo>/branches/master/protection 2>&1 | head -30

echo "=== REPO SETTINGS ==="
gh repo view --json isPrivate,defaultBranchRef,hasIssuesEnabled,hasWikiEnabled

echo "=== OPEN PRs ==="
gh pr list --limit 5

echo "=== SECRETS (names only) ==="
gh secret list 2>&1
```

**Overview (no specific repo):**

```bash
echo "=== REPOS ==="
gh repo list weirdapps --limit 50 --json name,isPrivate,pushedAt | head -60

echo "=== RATE LIMIT ==="
gh api rate_limit --jq '.resources.core | "Used: \(.used)/\(.limit), Remaining: \(.remaining), Reset: \(.reset | strftime("%H:%M UTC"))"'
```

## Subsystem: `mac [label]`

If a LaunchAgent label is given, deep-dive that agent. If no label, show Mac overview.

**Full Mac overview:**

```bash
echo "=== DISK ==="
df -h /
du -sh ~/SourceCode/ ~/Library/Caches/ ~/Downloads/ 2>/dev/null

echo "=== LAUNCHAGENTS ==="
for label in com.automation.daily-health com.plessas.token-sync-vps com.trading.gcloud-auto-login com.user.brew-maintenance com.user.caffeinate-display com.weirdapps.viber-cleanup; do
  echo "--- $label ---"
  launchctl print gui/501/$label 2>&1 | grep -E 'state|exit|runs|pid' | head -5
done

echo "=== PLISTS ==="
plutil -lint ~/Library/LaunchAgents/com.automation.*.plist ~/Library/LaunchAgents/com.plessas.*.plist ~/Library/LaunchAgents/com.trading.*.plist ~/Library/LaunchAgents/com.user.*.plist ~/Library/LaunchAgents/com.weirdapps.*.plist 2>/dev/null

echo "=== TOKEN PIPELINE ==="
echo "Local outlook session:"
ls -la ~/.config/outlook-cli/session.json 2>/dev/null
echo "Local gcloud ADC:"
ls -la ~/.config/gcloud/application_default_credentials.json 2>/dev/null
echo "VPS outlook session:"
ssh -o ConnectTimeout=5 vps 'ls -la ~/.config/outlook-cli/session.json' 2>/dev/null || echo "VPS unreachable"
```

**For a specific label:**

```bash
echo "=== FULL STATUS ==="
launchctl print gui/501/<label> 2>&1

echo "=== PLIST ==="
plutil -p ~/Library/LaunchAgents/<label>.plist 2>/dev/null

echo "=== LOGS ==="
tail -30 ~/Library/Logs/<basename>.log 2>/dev/null
tail -30 ~/Library/Logs/<basename>.err 2>/dev/null

echo "=== RECENT SYSLOG ==="
log show --predicate 'senderImagePath contains "<label>"' --last 1h --style compact 2>/dev/null | tail -20
```

## Output Format

Present results with clear section headers and pass/fail indicators. Highlight anything that needs attention. At the end, provide a one-line recommendation (e.g., "Consider restarting X" or "All looks healthy").
