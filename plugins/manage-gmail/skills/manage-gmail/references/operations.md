# Gmail operations reference

Moved from SKILL.md unchanged. Paths are relative to the skill's root directory; run the commands from there.

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
node ./scripts/dist/gmail-operations.js trash-bulk --message-ids "19b68a0697430e5f,19b687ddaf35bf2f,19b68711bef8edad"
```

**Notes:**

- Uses Gmail's batchModify API for efficiency (up to 100 messages per batch)
- Falls back to individual operations if batch fails
- Much faster than calling trash individually for each message

**Requires**: `gmail.modify` scope
</trash_bulk>

<contacts_list>
**Purpose**: List all contacts in the registry

**Command:**

```bash
node gmail-operations.js contacts list
```

**Output**: JSON object with count and array of contacts, each with name, email, and formatted display
</contacts_list>

<contacts_search>
**Purpose**: Search contacts by name using case-insensitive partial matching

**Command:**

```bash
node gmail-operations.js contacts search --name QUERY
```

**Parameters:**

- `--name`, `-n`: Search query to match against contact names (required)

**Output**: JSON object with query, count, and matching contacts array

**Examples:**

```bash
# Find all contacts with "john" in their name
node gmail-operations.js contacts search --name "john"

# Case-insensitive search
node gmail-operations.js contacts search --name "SMITH"
```

</contacts_search>

<contacts_add>
**Purpose**: Add a new contact to the registry

**Command:**

```bash
node gmail-operations.js contacts add --name NAME --email EMAIL
```

**Parameters:**

- `--name`, `-n`: Full name of the contact (required)
- `--email`, `-e`: Email address (required, must be valid format)

**Output**: JSON object with status and added contact details

**Notes:**

- Duplicate names are not allowed (case-insensitive)
- Email format is validated before adding

**Example:**

```bash
node gmail-operations.js contacts add --name "John Smith" --email "john.smith@example.com"
```

</contacts_add>

<contacts_update>
**Purpose**: Update an existing contact's email address

**Command:**

```bash
node gmail-operations.js contacts update --name NAME --email EMAIL
```

**Parameters:**

- `--name`, `-n`: Full name of the contact to update (exact match, case-insensitive)
- `--email`, `-e`: New email address (required)

**Output**: JSON object with status and updated contact details

**Example:**

```bash
node gmail-operations.js contacts update --name "John Smith" --email "john.new@example.com"
```

</contacts_update>

<contacts_remove>
**Purpose**: Remove a contact from the registry

**Command:**

```bash
node gmail-operations.js contacts remove --name NAME
```

**Parameters:**

- `--name`, `-n`: Full name of the contact to remove (exact match, case-insensitive)

**Output**: JSON object with status and removed contact details

**Example:**

```bash
node gmail-operations.js contacts remove --name "John Smith"
```

</contacts_remove>
</operations>
