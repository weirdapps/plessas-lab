# manage-gmail

Access and process Gmail messages using the Gmail API. Use when you want Claude to read, search, list, send, reply to, or forward emails. Supports OAuth 2.0 authentication with stored credentials.

## Overview

The plugin exposes Gmail through the `manage-gmail` skill, which Claude invokes automatically when your prompt looks like an email task. Behind the scenes it shells out to a small Node CLI (`gmail-operations.js`) that wraps Google's Gmail API client.

Operations supported include: list/search messages, read message bodies + headers + attachments, draft and send new messages, reply, forward, and search through your contacts.

## Prerequisites

- A Google account with Gmail.
- A Google Cloud project with the **Gmail API** enabled and an OAuth 2.0 **Desktop** client.
- Node.js 18+ (for the underlying CLI).

## Installation

```bash
/plugin install manage-gmail
```

Then complete the OAuth setup — it takes about 10 minutes the first time:

1. Read [`skills/manage-gmail/SETUP-CREDENTIALS.md`](./skills/manage-gmail/SETUP-CREDENTIALS.md) for the step-by-step Google Cloud Console walkthrough.
2. Install the downloaded `client_secret_*.json` to `~/.google-skills/gmail/GMailSkill-Credentials.json`.
3. Run any Gmail operation in Claude. A browser opens for OAuth consent. After you grant access, a token is cached at `~/.google-skills/gmail/gmail_token.json` and reused silently thereafter.

## Usage

This plugin provides the `manage-gmail` skill which Claude invokes automatically based on conversation context. You don't need to call it explicitly — say "check my inbox", "draft a reply to <person>", or "search Gmail for <topic>" and Claude will route to it.

For direct CLI invocation (from the plugin install dir):

```bash
node gmail-operations.js list --query "from:someone@example.com"
node gmail-operations.js contacts search --name "john"
```

## Documentation

- [`skills/manage-gmail/SKILL.md`](./skills/manage-gmail/SKILL.md) — full skill documentation
- [`skills/manage-gmail/SETUP-CREDENTIALS.md`](./skills/manage-gmail/SETUP-CREDENTIALS.md) — OAuth setup walkthrough

## License

MIT
