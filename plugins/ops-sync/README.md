# ops-sync

Infrastructure health & sync engine for the whole repo fleet — local Mac, the
Hetzner VPS, and GitHub. A parallel multi-agent plugin that scans git state,
tests, lint, CI/CD, systemd timers, LaunchAgents, and token freshness, then
reports a RED/YELLOW/GREEN dashboard and can remediate.

## Commands

| Command | What it does |
|---------|--------------|
| `/ops-sync [--scope all\|repos\|vps\|github\|mac] [--fix]` | Full scan — dispatches scan agents in parallel, synthesizes a health dashboard, optionally fixes |
| `/ops-status [--live]` | Quick status from the last scan, or a fast live git sweep across all repos |
| `/ops-fix [--issue N] [--all] [--dry-run]` | Conservative remediation (lint/test/git/services) with approval gates |
| `/ops-doctor <repos\|vps\|github\|mac> [name]` | Deep single-subsystem diagnostic |

## Agents

- `repo-scanner` — git state + tests + lint across all local repos (venv-aware)
- `vps-auditor` — systemd timers/services, journal, tokens, disk (timestamp-aware)
- `github-checker` — GitHub Actions runs, cron health, branch protection
- `mac-auditor` — LaunchAgents, logs, plists, token-sync pipeline
- `sync-engine` — Mac ↔ VPS repo HEAD alignment
- `fixer` — applies remediation; never auto-pushes/commits/restarts without approval

## Source of truth

`shared/repo-registry.md` lists every repo and its expected test/lint/CI config,
plus the VPS systemd units, Mac LaunchAgents, and GitHub Actions crons. Scan
agents receive it inline.

## Safety

Scan agents are read-only. The fixer shows diffs/logs and asks before any
state-changing action; `--dry-run` reports intent only. Runtime artifacts live
under `~/.ops-sync/` (reports, `last-run.json`, `fix-log.jsonl`).
