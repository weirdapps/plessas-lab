---
name: manage-gmail
description: Access and process Gmail messages using the Gmail API. Use when the user asks to read, search, list, send, reply to, or forward emails. Supports OAuth 2.0 authentication with stored credentials.
---

<objective>
Enable Claude Code to access and process Gmail messages using the Gmail API. This skill provides functions to authenticate, list messages, read message content, send new emails with file attachments, reply to messages, forward messages, and manage drafts.
</objective>

<context>
<credentials>
OAuth 2.0 credentials are stored at: `~/.google-skills/gmail/GMailSkill-Credentials.json`

Token file (generated after first authentication): `~/.google-skills/gmail/gmail_token.json`

**First-time authentication**: Running any Gmail operation for the first time will open a browser window for OAuth consent. The user must grant permission to access their Gmail account.
</credentials>

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
2. **Run the appropriate command** using the CLI at `~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js`
3. **Handle first-time auth**: Browser window opens for OAuth consent
4. **Process results**: Commands return JSON output for parsing
</workflow>

<common_operations>
**CLI Tool Location**: `~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js`
**Node.js Interpreter**: Use the system Node.js (v18+ required)

**List recent messages:**
```bash
node ~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js list --max-results 10
```

**Search messages:**
```bash
node ~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js search --query "is:unread newer_than:7d"
```

**Read a specific message:**
```bash
node ~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js read --message-id "MESSAGE_ID_HERE"
```

**Read a thread:**
```bash
node ~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js thread --thread-id "THREAD_ID_HERE"
```

**Send an email:**
```bash
node ~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js send --to "recipient@example.com" --subject "Subject" --body "Message body"
```

**Get profile:**
```bash
node ~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js profile
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
- `from:boss@company.com is:unread newer_than:7d` - Unread from boss in last week
- `has:attachment filename:pdf larger:2M` - PDFs larger than 2MB
- `subject:meeting newer_than:30d` - Meeting emails from last month
</search_queries>

<operations>
<list_messages>
**Purpose**: List messages matching criteria

**Command:**
```bash
node gmail-operations.js list [--query QUERY] [--max-results N] [--label-ids LABELS]
```

**Parameters:**
- `--query`, `-q`: Gmail search query (default: empty = all messages)
- `--max-results`, `-n`: Maximum messages to return (default: 10, max: 500)
- `--label-ids`: Comma-separated label IDs (e.g., `INBOX,UNREAD`)

**Output**: JSON array of message summaries with id, threadId, subject, from, date, snippet
</list_messages>

<read_message>
**Purpose**: Read full content of a specific message

**Command:**
```bash
node gmail-operations.js read --message-id MESSAGE_ID [--format FORMAT]
```

**Parameters:**
- `--message-id`, `-m`: The message ID to read (required)
- `--format`, `-f`: Output format - `full`, `metadata`, `minimal` (default: full)

**Output**: JSON object with headers, body (plain and HTML), labels, snippet
</read_message>

<read_thread>
**Purpose**: Read all messages in a conversation thread

**Command:**
```bash
node gmail-operations.js thread --thread-id THREAD_ID
```

**Parameters:**
- `--thread-id`, `-t`: The thread ID to read (required)

**Output**: JSON array of all messages in the thread with parsed content
</read_thread>

<send_email>
**Purpose**: Send a new email with optional file attachments

**Command:**
```bash
node gmail-operations.js send --to RECIPIENT --subject SUBJECT --body BODY [--cc CC] [--bcc BCC] [--html HTML_BODY] [--attachments FILES]
```

**Parameters:**
- `--to`: Recipient email (required, comma-separated for multiple)
- `--subject`, `-s`: Email subject (required)
- `--body`, `-b`: Plain text body (required)
- `--cc`: CC recipients (optional)
- `--bcc`: BCC recipients (optional)
- `--html`: HTML body for multipart message (optional)
- `--attachments`, `-a`: Comma-separated file paths to attach (optional)

**Output**: JSON object with sent message ID and thread ID

**Example with attachment:**
```bash
node gmail-operations.js send --to "user@example.com" --subject "Report" --body "Please find attached." --attachments "/path/to/report.pdf"
```

**Multiple attachments:**
```bash
node gmail-operations.js send --to "user@example.com" --subject "Files" --body "Multiple files attached." --attachments "/path/file1.pdf,/path/file2.docx"
```

**Requires**: `gmail.send` scope
</send_email>

<reply_to_message>
**Purpose**: Reply to an existing message with optional attachments

**Command:**
```bash
node gmail-operations.js reply --message-id MESSAGE_ID --body BODY [--reply-all] [--html HTML_BODY] [--attachments FILES]
```

**Parameters:**
- `--message-id`, `-m`: Original message ID to reply to (required)
- `--body`, `-b`: Reply body text (required)
- `--reply-all`: Reply to all recipients (optional flag)
- `--html`: HTML body (optional)
- `--attachments`, `-a`: Comma-separated file paths to attach (optional)

**Output**: JSON object with sent reply message ID

**Example with attachment:**
```bash
node gmail-operations.js reply --message-id "MSG_ID" --body "Here's the file you requested." --attachments "/path/to/file.pdf"
```

**Requires**: `gmail.send` scope
</reply_to_message>

<forward_message>
**Purpose**: Forward a message to new recipients with optional attachments

**Command:**
```bash
node gmail-operations.js forward --message-id MESSAGE_ID --to RECIPIENT [--text ADDITIONAL_TEXT] [--cc CC] [--bcc BCC] [--attachments FILES]
```

**Parameters:**
- `--message-id`, `-m`: Message ID to forward (required)
- `--to`: Recipient(s) to forward to (required)
- `--text`: Additional text to prepend (optional)
- `--cc`: CC recipients (optional)
- `--bcc`: BCC recipients (optional)
- `--attachments`, `-a`: Comma-separated file paths to attach (optional)

**Output**: JSON object with forwarded message ID

**Example with attachment:**
```bash
node gmail-operations.js forward --message-id "MSG_ID" --to "user@example.com" --text "Adding my notes." --attachments "/path/to/notes.pdf"
```

**Requires**: `gmail.send` scope
</forward_message>

<create_draft>
**Purpose**: Create a draft email with optional attachments without sending

**Command:**
```bash
node gmail-operations.js draft --to RECIPIENT --subject SUBJECT --body BODY [--cc CC] [--html HTML_BODY] [--attachments FILES]
```

**Parameters:**
- `--to`: Recipient email (required)
- `--subject`, `-s`: Email subject (required)
- `--body`, `-b`: Plain text body (required)
- `--cc`: CC recipients (optional)
- `--html`: HTML body (optional)
- `--attachments`, `-a`: Comma-separated file paths to attach (optional)

**Output**: JSON object with draft ID

**Example with attachment:**
```bash
node gmail-operations.js draft --to "user@example.com" --subject "Draft with file" --body "Review attached." --attachments "/path/to/doc.pdf"
```

**Requires**: `gmail.compose` scope
</create_draft>

<get_profile>
**Purpose**: Get authenticated user's email profile

**Command:**
```bash
node gmail-operations.js profile
```

**Output**: JSON object with email address, messages total, threads total
</get_profile>

<trash_message>
**Purpose**: Move a single message to trash

**Command:**
```bash
node gmail-operations.js trash --message-id MESSAGE_ID
```

**Parameters:**
- `--message-id`, `-m`: The message ID to trash (required)

**Output**: JSON object with id, threadId, labelIds, and status

**Requires**: `gmail.modify` scope
</trash_message>

<trash_bulk>
**Purpose**: Move multiple messages to trash in a single efficient batch operation

**Command:**
```bash
node gmail-operations.js trash-bulk --message-ids "ID1,ID2,ID3,ID4"
```

**Parameters:**
- `--message-ids`, `-m`: Comma-separated list of message IDs to trash (required)

**Output**: JSON object with:
- `results`: Array of successfully trashed messages
- `errors`: Array of any failed operations
- `summary`: Object with `total`, `trashed`, and `failed` counts

**Example:**
```bash
node ~/.claude/skills/manage-gmail/scripts/dist/gmail-operations.js trash-bulk --message-ids "19b68a0697430e5f,19b687ddaf35bf2f,19b68711bef8edad"
```

**Notes:**
- Uses Gmail's batchModify API for efficiency (up to 100 messages per batch)
- Falls back to individual operations if batch fails
- Much faster than calling trash individually for each message

**Requires**: `gmail.modify` scope
</trash_bulk>
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
**Search queries reference**: See [references/search-queries.md](references/search-queries.md)
**API error codes**: See [references/error-handling.md](references/error-handling.md)
**Scope reference**: See [references/scopes.md](references/scopes.md)
</reference_guides>
