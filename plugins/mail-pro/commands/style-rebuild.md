---
description: "Full corpus analysis of sent emails in the knowledge store to generate statistically-grounded style guide"
argument-hint: "[--recipient NAME] [--dry-run]"
allowed-tools: Agent, Read, Write, Edit, Bash, Glob, Grep
---

<preflight>
## Pre-flight: knowledge store check (MANDATORY)

This command requires the **second-brain knowledge store** — a local SQLite database that ingests your sent/received email. It ships separately from `plessas-lab`.

Before doing anything else, run:

```bash
test -f ~/SourceCode/second-brain/data/brain.db && echo "ok" || echo "missing"
```

If the file is **missing**, stop immediately and tell the user verbatim:

> `/style-rebuild` requires the second-brain knowledge store, which is not installed on this machine.
>
> The knowledge store is a local SQLite database that holds your full email corpus, classified and indexed. It ships in the `second-brain` repo, which is **currently a private GitHub repo** under the `weirdapps` organisation.
>
> If you have access to `weirdapps`, install it:
>
> ```bash
> git clone https://github.com/weirdapps/second-brain.git ~/SourceCode/second-brain
> cd ~/SourceCode/second-brain && cat README.md   # follow the setup steps
> ```
>
> If you do **not** have access, ask the marketplace maintainer to grant it, or skip this command — `/reply` and the rest of the `mail` plugin work without it (just without the corpus-driven style refinement).
>
> Once the database exists at `~/SourceCode/second-brain/data/brain.db`, re-run `/style-rebuild`.

Do NOT attempt to fall back to Outlook, Sent Items, or other data sources — the analysis is statistically meaningful only with the full ingested corpus.
</preflight>

<objective>
Perform a comprehensive corpus analysis of ALL sent emails stored in the knowledge store (SQLite database at `~/SourceCode/second-brain/data/brain.db`) to generate a statistically-grounded style guide with per-recipient profiles.

User request: $ARGUMENTS
</objective>

<process>
## Workflow

### 1. Connect to Knowledge Store DB

Open the SQLite database at `~/SourceCode/second-brain/data/brain.db`.

Verify tables exist:

```bash
sqlite3 ~/SourceCode/second-brain/data/brain.db ".tables"
```

**Data source priority:**

1. **Knowledge store DB** (primary) — contains the full email corpus with content, already classified
2. **Archive mailbox** via `mcp__outlook-bridge__outlook_list_mail` (supplementary) — for very recent emails not yet ingested into DB. The user CCs himself on all replies, so sent mail appears in Archive (`folder: "Archive"`); filter client-side to messages where `From.upn` matches the user's UPN.
3. **Sent Items** — NEVER use for historical analysis. The user regularly empties Sent Items. Only useful for emails sent in the last few hours (call `outlook_list_mail` with `folder: "Sent Items"` if ever needed).

### 2. Extract All Sent Emails

Query all emails where the user is the sender (from second-brain DB):

```sql
SELECT e.id, e.date_received, e.sender_name, e.sender_address,
       e.subject, e.summary, e.sentiment, e.language, e.content,
       e.in_reply_to, e.conversation_id
FROM emails e
WHERE e.sender_address LIKE '%<USER_EMAIL>%'
ORDER BY e.date_received DESC;
```

### 3. Map Recipients for Each Sent Email

For each sent email, identify recipients:

```sql
SELECT p.name, p.email, p.role, p.department, ep.role_in_email
FROM email_people ep
JOIN people p ON ep.person_id = p.id
WHERE ep.email_id = ? AND ep.role_in_email IN ('to', 'cc');
```

### 4. Per-Recipient Analysis

For each unique recipient, compute:

| Metric | How |
|--------|-----|
| **Email count** | Total emails sent to this person |
| **Avg reply length** | Mean character/word count of replies |
| **Length distribution** | p10, median, p90 word counts |
| **Language distribution** | % Greek vs English vs mixed |
| **Greeting patterns** | Most common openings (top 3 with frequency) |
| **Closing patterns** | Most common sign-offs (top 3 with frequency) |
| **Tone** | Formal / semi-formal / casual (classify each, report distribution) |
| **Formality score** | 1-5 scale based on vocabulary and structure |
| **Reply speed** | Avg time between received and reply (if conversation threading available) |
| **Time-of-day patterns** | Hour distribution of sent emails to this person |

### 5. Global Style Analysis

Across all sent emails:

- Overall average reply length (mean, median, p10, p90)
- Language split (Greek / English / mixed)
- Most common greeting patterns (with N counts)
- Most common closing patterns (with N counts)
- Vocabulary fingerprint: frequently used phrases, filler words, transition markers
- Escalation markers: phrases used when tone shifts to urgent/directive
- Delegation patterns: how tasks are assigned vs requested

### 6. Identify Style Clusters

Group recipients into style clusters:

- **Formal**: Board, C-suite, external partners
- **Semi-formal**: Peers, cross-department heads
- **Casual**: Direct reports, close colleagues
- **Brief**: Recipients who get terse replies
- **Detailed**: Recipients who get longer, structured replies

### 7. Backup Current Style Guide

Before overwriting, create a timestamped backup:

```bash
TZ='Europe/Athens' date '+%Y%m%d%H%M'
cp plugins/mail/shared/style-guide.md \
   ~/.claude/drafts/style-guide-backups/YYYYMMDDHHMM_style-guide.md
```

Create the backups directory if it doesn't exist.

### 8. Generate New Style Guide

Write the rebuilt `shared/style-guide.md` with:

- Statistical backing for every claim (e.g., "Based on N=47 emails to X")
- Per-recipient profiles with evidence counts
- Global defaults with distributions
- Confidence indicators (high/medium/low based on sample size)

### 9. Present Summary Report

```
STYLE REBUILD REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total emails analyzed: N
Unique recipients profiled: N
Date range: [earliest] to [latest]

TOP RECIPIENTS (by email count):
  1. [Name] — N emails, [language], [tone]
  2. [Name] — N emails, [language], [tone]
  ...

GLOBAL PATTERNS:
  Avg reply length: X words (p10: Y, p90: Z)
  Language split: X% English, Y% Greek, Z% mixed
  Most common greeting: "[greeting]" (N times)
  Most common closing: "[closing]" (N times)

STYLE CLUSTERS:
  Formal: N recipients
  Semi-formal: N recipients
  Casual: N recipients
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<specifications>
## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--recipient` | No | all | Focus rebuild on a specific recipient |
| `--dry-run` | No | `false` | Show report without overwriting style guide |
| `--min-emails` | No | `3` | Minimum emails to create a recipient profile |

## Output

- Backup of current style guide
- Rebuilt style-guide.md with statistical backing
- Summary report with corpus statistics
</specifications>

<examples>
## Usage Examples

### Full rebuild from all sent emails

```
/style-rebuild
```

### Rebuild for a specific recipient

```
/style-rebuild --recipient Papadopoulos
```

### Preview without overwriting

```
/style-rebuild --dry-run
```

### Only profile recipients with 5+ emails

```
/style-rebuild --min-emails 5
```

</examples>
