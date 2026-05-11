---
description: "Strategic communication health report with relationship heatmap and delegation effectiveness"
argument-hint: "[week|month] [--recipient NAME]"
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

> `/comm-report` requires the second-brain knowledge store, which is not installed on this machine.
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
> If you do **not** have access, ask the marketplace maintainer to grant it, or skip this command — the rest of the `mail` plugin works without it.
>
> Once the database exists at `~/SourceCode/second-brain/data/brain.db`, re-run `/comm-report`.

Do NOT attempt to fall back to Outlook or live mailbox queries — this report's analytics rely on the full ingested corpus with classifications.
</preflight>

<objective>
Generate a strategic communication health report powered by the knowledge store (SQLite database at `~/SourceCode/second-brain/data/brain.db`), covering relationship patterns, response behavior, delegation effectiveness, and language trends.

User request: $ARGUMENTS
</objective>

<process>
## Workflow

### 1. Determine Report Period

- `week`: last 7 days
- `month`: last 30 days (default)
- Use current date and compute the start date

> **Note**: For simple queries (decisions, actions, person context), prefer MCP tools (`mcp__second_brain__*`) over direct SQL. Direct SQL is used here for complex analytical queries only.

### 1b. Apply Recipient Filter (if --recipient specified)

When `--recipient NAME` is specified, add a filter to ALL queries below to scope results to emails involving that person:

```sql
-- Add to every query as an extra JOIN + WHERE clause:
JOIN email_people ep_filter ON e.id = ep_filter.email_id
JOIN people p_filter ON ep_filter.person_id = p_filter.id
WHERE p_filter.name LIKE '%[NAME]%'
```

Skip the Relationship Heatmap section (step 3) when filtering by a single recipient — it's redundant. Instead, present a detailed communication timeline for that person.

### 2. Query Communication Volume

From the knowledge store DB (`~/SourceCode/second-brain/data/brain.db`).

**Data source note:** All analytics are powered exclusively by the knowledge store DB. Do NOT query Sent Items — the user regularly empties it. The user CCs himself on all replies, so sent emails appear in the Archive mailbox and are ingested into the DB.

**Emails sent by user:**

```sql
SELECT COUNT(*) as sent_count,
       DATE(date_received) as day
FROM emails
WHERE sender_address LIKE '%<USER_EMAIL>%'
  AND date_received >= '[start_date]'
GROUP BY DATE(date_received)
ORDER BY day;
```

**Emails received by user:**

```sql
SELECT COUNT(*) as received_count,
       DATE(e.date_received) as day
FROM emails e
JOIN email_people ep ON e.id = ep.email_id
JOIN people p ON ep.person_id = p.id
WHERE p.email LIKE '%<USER_EMAIL>%'
  AND ep.role_in_email IN ('to', 'cc')
  AND date_received >= '[start_date]'
GROUP BY DATE(e.date_received)
ORDER BY day;
```

### 3. Relationship Heatmap

Top contacts ranked by email volume (sent + received):

```sql
-- Top recipients of user's emails
SELECT p.name, p.email, COUNT(*) as email_count
FROM emails e
JOIN email_people ep ON e.id = ep.email_id
JOIN people p ON ep.person_id = p.id
WHERE e.sender_address LIKE '%<USER_EMAIL>%'
  AND ep.role_in_email = 'to'
  AND e.date_received >= '[start_date]'
GROUP BY p.name
ORDER BY email_count DESC
LIMIT 15;
```

Present as heatmap:

```
RELATIONSHIP HEATMAP (last [period])
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Name]          ████████████████  32 emails
[Name]          ████████████      24 emails
[Name]          ████████          16 emails
[Name]          ████              8 emails
[Name]          ██                4 emails
```

### 4. Reactive vs Proactive Ratio

Classify sent emails:

- **Reactive**: replies (has `in_reply_to` or `conversation_id` with prior inbound)
- **Proactive**: new threads initiated by user

```sql
-- Proactive: emails sent by user with no in_reply_to
SELECT COUNT(*) FROM emails
WHERE sender_address LIKE '%<USER_EMAIL>%'
  AND (in_reply_to IS NULL OR in_reply_to = '')
  AND date_received >= '[start_date]';

-- Reactive: emails sent by user that are replies
SELECT COUNT(*) FROM emails
WHERE sender_address LIKE '%<USER_EMAIL>%'
  AND in_reply_to IS NOT NULL AND in_reply_to != ''
  AND date_received >= '[start_date]';
```

```
COMMUNICATION POSTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reactive:   ████████████████  72% (N emails)
Proactive:  ██████            28% (N emails)
```

### 5. Delegation Effectiveness

Query action items from second-brain:

```sql
SELECT ai.task, ai.owner, ai.deadline, ai.status, e.subject
FROM action_items ai
JOIN emails e ON ai.email_id = e.id
WHERE e.date_received >= '[start_date]'
ORDER BY ai.deadline;
```

Report:

- Tasks delegated vs completed
- Overdue items
- Top delegates by task count
- Completion rate per delegate

### 6. Response Time Analysis

For conversation threads, estimate response time:

```sql
-- Find reply pairs in the same conversation
SELECT e1.date_received as received,
       e2.date_received as replied,
       e1.sender_name as from_person
FROM emails e1
JOIN emails e2 ON e2.in_reply_to = e1.message_id
WHERE e2.sender_address LIKE '%<USER_EMAIL>%'
  AND e1.date_received >= '[start_date]';
```

```
RESPONSE TIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Avg response time: X hours
Median: X hours
< 1 hour:   ████████  40%
1-4 hours:  ██████    30%
4-24 hours: ████      20%
> 24 hours: ██        10%
```

### 7. Language Distribution Trends

```sql
SELECT language, COUNT(*) as count
FROM emails
WHERE sender_address LIKE '%<USER_EMAIL>%'
  AND date_received >= '[start_date]'
GROUP BY language;
```

### 8. Sentiment Overview

```sql
SELECT sentiment, COUNT(*) as count
FROM emails
WHERE date_received >= '[start_date]'
GROUP BY sentiment;
```

### 9. Present Full Report

Combine all sections into the strategic report with clear headers and visual indicators.
</process>

<specifications>
## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `period` | No | `month` | Report period: `week` or `month` |
| `--recipient` | No | all | Focus on communication with a specific person |

## Output

- Relationship heatmap
- Reactive vs proactive ratio
- Delegation effectiveness with overdue alerts
- Response time analysis
- Language distribution
- Sentiment overview
</specifications>

<examples>
## Usage Examples

### Monthly communication report (default)

```
/comm-report
```

### Weekly report

```
/comm-report week
```

### Focus on a specific relationship

```
/comm-report month --recipient Papadopoulos
```

</examples>
