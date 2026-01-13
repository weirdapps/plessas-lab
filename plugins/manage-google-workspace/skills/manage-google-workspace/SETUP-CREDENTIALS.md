# Google Workspace Skill - Credentials Setup

This document explains how to set up the OAuth credentials for the Google Workspace skill on first-time use.

## Prerequisites

The skill comes with a pre-configured OAuth credentials file in the `skill-key` folder:

```
~/.claude/skills/manage-google-workspace/skill-key/DriveSkill-Credentials.json
```

## Setup Steps

### Step 1: Create the Target Directory

The skill expects credentials to be stored in `~/.google-skills/drive/`. Create this directory if it doesn't exist:

```bash
mkdir -p ~/.google-skills/drive
```

### Step 2: Copy the Credentials File

Copy the credentials file from the skill-key folder to the expected runtime location:

```bash
cp ~/.claude/skills/manage-google-workspace/skill-key/DriveSkill-Credentials.json ~/.google-skills/drive/
```

### Step 3: Verify the File is in Place

Confirm the file was copied successfully:

```bash
ls -la ~/.google-skills/drive/DriveSkill-Credentials.json
```

### Step 4: Install Dependencies

Navigate to the tools directory and install the required npm packages:

```bash
cd ~/.claude/skills/manage-google-workspace/tools
npm install
```

## First-Time Authentication

When you run any Google Workspace operation for the first time, the following will happen:

1. **Browser Window Opens**: A browser window will automatically open on port 8080 for OAuth consent
2. **Grant Permissions**: Sign in to your Google account and grant the requested permissions for:
   - Google Drive (full access)
   - Google Docs
   - Google Sheets
   - Google Slides
3. **Token Created**: After authorization, a token file is automatically created at:
   ```
   ~/.google-skills/drive/token.json
   ```
4. **Ready to Use**: Subsequent operations will use the stored token automatically (with auto-refresh)

## File Summary

| File | Location | Purpose |
|------|----------|---------|
| `DriveSkill-Credentials.json` | `~/.google-skills/drive/` | OAuth client credentials (copied from skill-key) |
| `token.json` | `~/.google-skills/drive/` | Access token (auto-generated after first auth) |

## Troubleshooting

### Token Expired or Authentication Errors

The skill automatically refreshes expired tokens. If you encounter persistent authentication errors, delete the token file and re-authenticate:

```bash
rm ~/.google-skills/drive/token.json
```

Then run any Google Workspace operation to trigger the OAuth flow again.

### Credentials File Not Found Error

If you see "Credentials file not found", ensure you've completed Steps 1-2 above. The exact error message will show the expected path.

### Port 8080 Already in Use

The OAuth flow uses port 8080. If another application is using this port, temporarily stop it before authenticating.
