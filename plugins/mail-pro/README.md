# mail-pro v1.0

> **Maintainer-only.** This plugin requires the maintainer's private `second-brain` SQLite database at `~/SourceCode/second-brain/data/brain.db` and hardcodes `SENDER_FILTER = "%plessas%"` in `scripts/style-sync.py`. It's installed from the `plessas-lab` marketplace because it's not portable as-is. If you're not the maintainer, the `mail` plugin in `plessas-marketplace` covers the cross-platform use cases.

Optional companion to the [`mail`](../mail/) plugin. Adds two corpus-driven commands plus the daily style-sync helper. **Requires** the [`second-brain`](https://github.com/weirdapps/second-brain) knowledge store, which is currently a private GitHub repo.

If you do not have access to `weirdapps/second-brain`, install only the `mail` plugin and skip this one — `mail` is fully functional without `mail-pro`.

## Commands

| Command | Description |
|---------|-------------|
| `/comm-report` | Strategic communication health report — relationship heatmap, response patterns, delegation effectiveness, language trends. Powered by full email corpus. |
| `/style-rebuild` | Full corpus analysis of sent emails to (re-)generate a statistically-grounded style guide with per-recipient profiles. Run after major life or role changes; one-shot, not periodic. |

## Helper script (cron / launchd)

```
scripts/style-sync.py
```

A quantitative style-guide updater designed to run as a daily cron after the `second-brain` ingest pipeline completes. It refreshes aggregate metrics (total count, language/sentiment distributions, drift alerts) in the `mail` plugin's `shared/style-guide.md` — it does NOT touch per-recipient profiles, which require Claude-assisted analysis via `/style-rebuild`.

```bash
python plugins/mail-pro/scripts/style-sync.py             # normal sync
python plugins/mail-pro/scripts/style-sync.py --dry-run   # preview
python plugins/mail-pro/scripts/style-sync.py --force     # recompute even with no new data
python plugins/mail-pro/scripts/style-sync.py --db /path/to/your/brain.db   # override DB location
```

The script writes to `plugins/mail/shared/style-guide.md` — i.e. it lives in `mail-pro` but updates the consumer in `mail`.

## Why split from `mail`?

Three reasons:

1. `second-brain` is a substantial parallel system (ingestion pipeline, weeks of email to populate, ongoing daily sync). Forcing every teammate to install it just to use the basic mail plugin would be wrong.
2. `second-brain` is currently private. Public-marketplace plugins shouldn't have hard dependencies on private repos.
3. Splitting makes the dependency boundary explicit. If `second-brain` ever becomes public (or gets replaced by a slimmer alternative), only `mail-pro` needs to change.

## Install

`mail-pro` is part of the `plessas-lab` marketplace. It auto-installs alongside the other plugins. To use the commands, you additionally need:

```bash
git clone https://github.com/weirdapps/second-brain.git ~/SourceCode/second-brain
cd ~/SourceCode/second-brain && cat README.md   # follow the setup steps
```

If you don't have access to the private repo, ask the marketplace maintainer.

## License

MIT
