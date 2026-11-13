---
name: manage-gmail
description: Reads, searches, lists, sends, replies to and forwards Gmail messages, creates drafts, moves messages to trash and keeps a local contacts registry, through the Gmail API with OAuth 2.0 credentials stored on disk. Use when the user asks to do any of these with a Gmail account. Do NOT use for Outlook or Microsoft 365 mail (use the outlook-mail skill of the `mail` plugin).
---

# Gmail

<!-- safety-guardrails:v1 -->
## Send/delete-safety blacklist (irreversible)

- Never auto-send, reply, or forward: draft first, show it, get explicit confirmation before dispatch.
- Never auto-trash (single or bulk). Confirm the exact messages first; `trash-bulk` has a large blast radius.
- Verify recipients before sending.

> **Path Convention**: All paths in this document are relative to this skill's root directory. When executing commands, first `cd` to the skill directory or adjust paths accordingly.

<objective>
Enable Claude Code to access and process Gmail messages using the Gmail API. This skill provides functions to authenticate, list messages, read message content, send new emails with file attachments, reply to messages, forward messages, and manage drafts.
</objective>

<context>
<credentials>
OAuth 2.0 credentials are stored at: `~/.google-skills/gmail/GMailSkill-Credentials.json`

Token file (generated after first authentication): `~/.google-skills/gmail/gmail_token.json`

**First-time authentication**: Running any Gmail operation for the first time will open a browser window for OAuth consent. The user must grant permission to access their Gmail account.
</credentials>

<contacts_registry>
**Contacts Registry**: `~/.google-skills/gmail/contacts-registry.json`

A JSON-based registry for storing email contacts. Allows looking up email addresses by name using case-insensitive partial matching.

The registry stores contacts with their full name and email address. When searching, typing "john" will match "John Smith", "Johnny Doe", etc.
</contacts_registry>

<scopes>
Available Gmail API scopes (configured in credentials):

| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read-only access to messages |
| `gmail.send` | Send emails |
| `gmail.compose` | Create and manage drafts |
| `gmail.modify` | Full read/write (except permanent delete) |

**Important**: Only request scopes that are configured in the OAuth Consent Screen's Data Access section.
</scopes>
</context>

<quick_start>
<workflow>

1. **Verify credentials exist**: Check `~/.google-skills/gmail/GMailSkill-Credentials.json`
2. **Run the appropriate command** using the CLI at `./scripts/dist/gmail-operations.js`
3. **Handle first-time auth**: Browser window opens for OAuth consent
4. **Process results**: Commands return JSON output for parsing
</workflow>

<common_operations>
**CLI Tool Location**: `./scripts/dist/gmail-operations.js`
**Node.js Interpreter**: Use the system Node.js (v18+ required)

**List recent messages:**

```bash
node ./scripts/dist/gmail-operations.js list --max-results 10
```

**Search messages:**

```bash
node ./scripts/dist/gmail-operations.js search --query "is:unread newer_than:7d"
```

**Read a specific message:**

```bash
node ./scripts/dist/gmail-operations.js read --message-id "MESSAGE_ID_HERE"
```

**Read a thread:**

```bash
node ./scripts/dist/gmail-operations.js thread --thread-id "THREAD_ID_HERE"
```

**Send an email:**

```bash
node ./scripts/dist/gmail-operations.js send --to "recipient@example.com" --subject "Subject" --body "Message body"
```

**Get profile:**

```bash
node ./scripts/dist/gmail-operations.js profile
```

**List contacts:**

```bash
node ./scripts/dist/gmail-operations.js contacts list
```

**Search contacts by name:**

```bash
node ./scripts/dist/gmail-operations.js contacts search --name "john"
```

**Add a contact:**

```bash
node ./scripts/dist/gmail-operations.js contacts add --name "John Smith" --email "john@example.com"
```

</common_operations>
</quick_start>

<search_queries>
Gmail search query operators (use with `--query` parameter):

| Operator | Description | Example |
|----------|-------------|---------|
| `from:` | Sender | `from:user@example.com` |
| `to:` | Recipient | `to:me@example.com` |
| `subject:` | Subject line | `subject:meeting` |
| `is:` | Status | `is:unread`, `is:starred`, `is:important` |
| `has:` | Content type | `has:attachment`, `has:drive` |
| `in:` | Location | `in:inbox`, `in:sent`, `in:trash` |
| `after:` | After date | `after:2024/01/01` |
| `before:` | Before date | `before:2024/12/31` |
| `newer_than:` | Relative time | `newer_than:7d`, `newer_than:1m` |
| `older_than:` | Relative time | `older_than:30d` |
| `label:` | Label name | `label:work` |
| `filename:` | Attachment | `filename:report.pdf` |
| `larger:` | Size | `larger:5M` |
| `smaller:` | Size | `smaller:1M` |
| `OR` | Boolean OR | `from:alice OR from:bob` |
| `-` | Exclude | `-is:spam` |
| `""` | Exact phrase | `"project update"` |

**Combined examples:**

- `from:boss@example.com is:unread newer_than:7d` - Unread from boss in last week
- `has:attachment filename:pdf larger:2M` - PDFs larger than 2MB
- `subject:meeting newer_than:30d` - Meeting emails from last month
</search_queries>

<operations>
Every operation (list, read, thread, send, reply, forward, draft, profile, trash, trash-bulk and the contacts registry commands), with its command line, parameters, output and required scope, is in [references/operations.md](references/operations.md). Read it before running an operation whose flags are not shown in Common operations above.
</operations>

<attachments>
**File Attachment Support**

The `send`, `reply`, `forward`, and `draft` commands support file attachments via the `--attachments` option.

**Supported file types:**

| Category | Extensions |
|----------|------------|
| Documents | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`, `.csv`, `.md` |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` |
| Archives | `.zip`, `.gz`, `.tar`, `.rar`, `.7z` |
| Code | `.json`, `.xml`, `.html`, `.css`, `.js`, `.ts` |
| Media | `.mp3`, `.mp4`, `.wav`, `.avi`, `.mov` |

**Limitations:**

- Maximum attachment size: **25MB** per file (Gmail limit)
- Files are automatically MIME-typed based on extension
- Unknown extensions default to `application/octet-stream`
- Paths can be absolute or use `~` for home directory

**Error handling:**

- File not found: Returns error with file path
- File too large: Returns error with size information
- File unreadable: Returns permission error
</attachments>

<error_handling>

| Error Code | Description | Solution |
|------------|-------------|----------|
| 401 | Unauthorized | Delete token.json and re-authenticate |
| 403 | Forbidden | Check scopes in OAuth Consent Screen |
| 404 | Not Found | Invalid message/thread ID |
| 429 | Rate Limit | Wait and retry with backoff |

**Token refresh**: Tokens are automatically refreshed when expired. If persistent auth errors occur, delete `~/.google-skills/gmail/gmail_token.json` and re-authenticate.
</error_handling>

<security_checklist>

- Never expose or log the credentials.json content
- Never commit token.json to version control
- Verify recipient addresses before sending
- Request minimum required scopes
- Token files contain sensitive refresh tokens - protect accordingly
</security_checklist>

<success_criteria>

- Credentials file exists at the expected path
- Authentication completes successfully (token.json created)
- Operations return valid JSON output
- Messages can be listed, read, and searched
- Emails can be sent (if gmail.send scope is available)
</success_criteria>

<reference_guides>
**Operations reference**: See [references/operations.md](references/operations.md) - Every command with parameters, output and scope
**First-time setup**: See [SETUP-CREDENTIALS.md](SETUP-CREDENTIALS.md) - How to configure credentials on first use
**Search queries reference**: See [references/search-queries.md](references/search-queries.md)
**API error codes**: See [references/error-handling.md](references/error-handling.md)
**Scope reference**: See [references/scopes.md](references/scopes.md)
</reference_guides>
