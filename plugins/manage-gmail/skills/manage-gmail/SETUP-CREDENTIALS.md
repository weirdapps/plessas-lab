# Gmail Skill - Credentials Setup

This document explains how to set up the OAuth credentials for the Gmail skill on first-time use.

## Prerequisites

The skill comes with a pre-configured OAuth credentials file in the `skill-key` folder:

```
~/.claude/skills/manage-gmail/skill-key/GMailSkill-Credentials.json
```

## Setup Steps

### Step 1: Create the Target Directory

The skill expects credentials to be stored in `~/.google-skills/gmail/`. Create this directory if it doesn't exist:

```bash
mkdir -p ~/.google-skills/gmail
```

### Step 2: Copy the Credentials File

Copy the credentials file from the skill-key folder to the expected runtime location:

```bash
cp ~/.claude/skills/manage-gmail/skill-key/GMailSkill-Credentials.json ~/.google-skills/gmail/
```

### Step 3: Verify the File is in Place

Confirm the file was copied successfully:

```bash
ls -la ~/.google-skills/gmail/GMailSkill-Credentials.json
```

## First-Time Authentication

When you run any Gmail operation for the first time, the following will happen:

1. **Browser Window Opens**: A browser window will automatically open for OAuth consent
2. **Grant Permissions**: Sign in to your Google account and grant the requested permissions
3. **Token Created**: After authorization, a token file is automatically created at:
   ```
   ~/.google-skills/gmail/gmail_token.json
   ```
4. **Ready to Use**: Subsequent operations will use the stored token automatically

## File Summary

| File | Location | Purpose |
|------|----------|---------|
| `GMailSkill-Credentials.json` | `~/.google-skills/gmail/` | OAuth client credentials (copied from skill-key) |
| `gmail_token.json` | `~/.google-skills/gmail/` | Access token (auto-generated after first auth) |

## Troubleshooting

### Token Expired or Authentication Errors

If you encounter persistent authentication errors, delete the token file and re-authenticate:

```bash
rm ~/.google-skills/gmail/gmail_token.json
```

Then run any Gmail operation to trigger the OAuth flow again.

### Credentials File Not Found Error

If you see "Credentials file not found", ensure you've completed Steps 1-2 above. The exact error message will show the expected path.
