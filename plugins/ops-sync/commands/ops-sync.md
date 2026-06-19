---
description: "Full infrastructure scan — repos, VPS, GitHub Actions, Mac health with parallel agent dispatch"
argument-hint: "[--scope all|repos|vps|github|mac] [--fix] [--verbose]"
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
---

You are the ops-sync orchestrator. Your job is to dispatch scan agents, collect their reports, and present a unified health dashboard.

## Parse Arguments

From `$ARGUMENTS`, extract:

- `--scope`: one of `all` (default), `repos`, `vps`, `github`, `mac`
- `--fix`: if present, hand off issues to the fixer agent after the scan
- `--verbose`: if present, include full details in the dashboard (not just summaries)

## Step 1 — Prepare

```bash
mkdir -p ~/.ops-sync/reports
rm -f ~/.ops-sync/reports/*.json
```

## Step 2 — Read Registry

Read the repo registry for agent context:

```
${CLAUDE_PLUGIN_ROOT}/shared/repo-registry.md
```

You will embed relevant sections of this registry into each agent's prompt.

## Step 3 — Dispatch Agents

Based on `--scope`, dispatch the appropriate agents. ALL agents run in **parallel** (send all Agent tool calls in a SINGLE message). Each uses `model: "sonnet"` for cost efficiency.

### Scope: `all` (default)

Dispatch ALL 4 scan agents in parallel:

1. **repo-scanner** — scans all 25 local repos for git state, tests, lint
2. **vps-auditor** — SSH to VPS, checks systemd, tokens, disk
3. **github-checker** — checks GH Actions, crons, branch protection
4. **mac-auditor** — checks LaunchAgents, logs, disk, token pipeline

Plus the **sync-engine** — compares Mac↔VPS repos (can run in parallel with others).

That's 5 agents total for `--scope all`.

### Scope: `repos`

Dispatch only: **repo-scanner**

### Scope: `vps`

Dispatch only: **vps-auditor**

### Scope: `github`

Dispatch only: **github-checker**

### Scope: `mac`

Dispatch only: **mac-auditor**

### Agent Prompt Template

When dispatching each agent, include:

1. The full agent instructions (from the agent file)
2. The relevant sections of the repo registry
3. Instruction to write JSON to `~/.ops-sync/reports/<agent-name>.json`

Example dispatch for repo-scanner:

```
Scan all repos in ~/SourceCode/ for git state, test results, and lint compliance.

[paste repo registry table here]

Write your JSON report to ~/.ops-sync/reports/repo-scanner.json.
After writing the JSON, return a one-paragraph summary of findings.
```

## Step 4 — Validate Reports

After ALL agents complete, verify expected JSON files exist:

```bash
for f in ~/.ops-sync/reports/*.json; do
  echo "$(basename "$f"): $(wc -c < "$f") bytes"
done
```

If any expected report is missing or empty (0 bytes), note it as a scan failure.

## Step 5 — Synthesize Dashboard

Read all JSON report files. For each dimension, compute status:

| Dimension | Source Report(s) | GREEN | YELLOW | RED |
|-----------|-----------------|-------|--------|-----|
| Git Sync (local) | repo-scanner | all clean | dirty/unpushed/behind | — |
| Git Sync (VPS) | sync-engine | all synced | behind | diverged |
| Tests | repo-scanner | all pass | timeout | failures |
| Linting | repo-scanner | all pass | — | violations |
| GitHub Actions | github-checker | all success | in_progress | failures |
| VPS Systemd | vps-auditor | all active | overdue | failed |
| Mac LaunchAgents | mac-auditor | all healthy | never triggered | failed/not loaded |
| Token Sync | mac-auditor + vps-auditor | all fresh | aging (6-24h) | stale (>24h) |

Present the dashboard:

```
═══════════════════════════════════════════════════
 OPS-SYNC DASHBOARD — YYYY-MM-DD HH:MM
═══════════════════════════════════════════════════

 Dimension            Status   Details
 ─────────────────────────────────────────────────
 Git Sync (local)     GREEN    25/25 repos clean
 Git Sync (VPS)       GREEN    5/5 repos synced
 Tests                GREEN    18/18 repos pass
 Linting              GREEN    21/21 repos pass
 GitHub Actions       GREEN    All workflows green
 VPS Systemd          GREEN    26/26 units active
 Mac LaunchAgents     GREEN    6/6 healthy
 Token Sync           GREEN    All tokens fresh

═══════════════════════════════════════════════════
```

If there are issues, add an ISSUES section sorted by severity (RED first, then YELLOW):

```
 ISSUES (N)
 ─────────────────────────────────────────────────
 1. [RED]    <repo>: <detail>
 2. [YELLOW] <repo>: <detail>
═══════════════════════════════════════════════════
```

If `--verbose`, also include per-repo details below the dashboard.

## Step 6 — Save State

Collect all issues from all reports and write `~/.ops-sync/last-run.json`:

```json
{
  "timestamp": "<ISO-8601>",
  "scope": "all",
  "duration_seconds": 0,
  "dimensions": {
    "git_local": "GREEN",
    "git_vps": "GREEN",
    "tests": "GREEN",
    "linting": "GREEN",
    "github_actions": "GREEN",
    "vps_systemd": "GREEN",
    "mac_agents": "GREEN",
    "token_sync": "GREEN"
  },
  "issues_count": { "red": 0, "yellow": 0 },
  "issues": []
}
```

## Step 7 — Fix Mode (if --fix)

If `--fix` was passed and there are issues, dispatch the **fixer** agent (inherits default model — opus). Pass it:

1. The full issues list from all reports
2. The repo registry
3. Whether `--dry-run` was also passed (it wasn't — that's only on /ops-fix)

The fixer will attempt remediation with user approval gates.

## Important Notes

- ALL scan agents are dispatched in PARALLEL (single message with multiple Agent calls)
- ALL scan agents use `model: "sonnet"` — do NOT use opus for scans
- The fixer agent inherits the default model (opus) — do NOT override it
- Wait for ALL agents to complete before synthesizing the dashboard
- If an agent fails or times out, include its dimensions as YELLOW "scan failed" in the dashboard
