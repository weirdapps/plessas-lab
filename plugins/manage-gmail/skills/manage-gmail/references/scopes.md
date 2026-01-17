# Gmail API Scopes Reference

## Available Scopes

| Scope | URL | Description | Category |
|-------|-----|-------------|----------|
| Read-only | `https://www.googleapis.com/auth/gmail.readonly` | Read all messages and settings | Sensitive |
| Send | `https://www.googleapis.com/auth/gmail.send` | Send emails only | Sensitive |
| Compose | `https://www.googleapis.com/auth/gmail.compose` | Create drafts, read drafts, send emails | Sensitive |
| Modify | `https://www.googleapis.com/auth/gmail.modify` | All operations except permanent delete | Sensitive |
| Labels | `https://www.googleapis.com/auth/gmail.labels` | Manage labels only | Sensitive |
| Settings Basic | `https://www.googleapis.com/auth/gmail.settings.basic` | Manage basic mail settings | Sensitive |
| Settings Sharing | `https://www.googleapis.com/auth/gmail.settings.sharing` | Manage forwarding, aliases | Restricted |
| Full Access | `https://mail.google.com/` | Complete mailbox control | **Restricted** |

## Scope Selection Guide

| What You Want to Do | Minimum Scope Required |
|--------------------|----------------------|
| Read emails only | `gmail.readonly` |
| Send emails only | `gmail.send` |
| Send emails with attachments | `gmail.send` |
| Reply/forward with attachments | `gmail.send` |
| Read AND send emails | `gmail.readonly` + `gmail.send` |
| Manage drafts | `gmail.compose` |
| Create drafts with attachments | `gmail.compose` |
| Delete/archive emails | `gmail.modify` |
| Manage labels | `gmail.labels` or `gmail.modify` |
| Full mailbox control | `mail.google.com/` (avoid if possible) |

## Operations by Scope

### `gmail.readonly`
- List messages
- Get message content
- List threads
- Get thread content
- Get user profile
- List labels
- Get label details

### `gmail.send`
- Send messages (with or without attachments)
- Reply to messages (with or without attachments)
- Forward messages (with or without attachments)
- Everything in `gmail.readonly`

### `gmail.compose`
- Create drafts (with or without attachments)
- Update drafts
- Delete drafts
- Send drafts
- Everything in `gmail.send`

### `gmail.modify`
- Modify message labels
- Trash/untrash messages
- Mark as read/unread
- Archive messages
- Everything in `gmail.compose`

### `gmail.labels`
- Create labels
- Update labels
- Delete labels
- List labels

## Scope Categories

| Category | Examples | Verification Required |
|----------|----------|----------------------|
| **Non-sensitive** | `userinfo.email`, `userinfo.profile` | Basic verification |
| **Sensitive** | `gmail.readonly`, `gmail.send`, `gmail.modify` | Additional verification |
| **Restricted** | `mail.google.com/` | Security assessment |

## Best Practices

1. **Principle of Least Privilege**: Only request scopes you actually need
2. **Scope Declaration**: Declare all scopes in OAuth Consent Screen before using them
3. **Incremental Authorization**: Request basic scopes first, add more as needed
4. **Avoid Restricted Scopes**: Use specific scopes instead of `mail.google.com/`

## Changing Scopes

When you need different scopes than what the current token has:

1. Delete the token file:
   ```bash
   rm ~/.google-skills/gmail/gmail_token.json
   ```

2. Update the SCOPES array in the TypeScript code:
   ```typescript
   const SCOPES = [
     'https://www.googleapis.com/auth/gmail.readonly',
     'https://www.googleapis.com/auth/gmail.send',
     // Add additional scopes as needed
   ];
   ```

3. Rebuild the TypeScript code:
   ```bash
   cd ./scripts && npm run build
   ```

4. Re-run the application to trigger new OAuth flow

5. User will see updated consent screen with new permissions

## Scope Verification Status

For **External apps** (personal Gmail, public apps):
- Scopes declared in code MUST match OAuth Consent Screen
- Sensitive scopes require additional verification by Google
- Restricted scopes require security assessment

For **Internal apps** (Google Workspace only):
- Scopes are not enforced in consent screen
- No Google verification required
- Only organization users can access
