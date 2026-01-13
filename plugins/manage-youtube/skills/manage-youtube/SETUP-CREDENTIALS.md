# YouTube Skill - Credentials Setup

This document explains how to set up the OAuth credentials for the YouTube skill's playlist management features.

## Important Notes

The YouTube skill has two types of tools:

1. **Content Discovery Tools** - No authentication required (channel info, search, transcripts, etc.)
2. **Playlist Management Tools** - OAuth authentication required (create/update/delete playlists)

This setup is **only required for Playlist Management features**. Content discovery tools work without any credentials.

## Prerequisites

The skill comes with a pre-configured OAuth credentials file in the `skill-key` folder:

```
~/.claude/skills/manage-youtube/skill-key/YouTubeSkill-Credentials.json
```

## Setup Steps

### Step 1: Create the Target Directory

The skill expects credentials to be stored in `~/.google-skills/youtube/`. Create this directory if it doesn't exist:

```bash
mkdir -p ~/.google-skills/youtube
```

### Step 2: Copy the Credentials File

Copy the credentials file from the skill-key folder to the expected runtime location:

```bash
cp ~/.claude/skills/manage-youtube/skill-key/YouTubeSkill-Credentials.json ~/.google-skills/youtube/
```

### Step 3: Verify the File is in Place

Confirm the file was copied successfully:

```bash
ls -la ~/.google-skills/youtube/YouTubeSkill-Credentials.json
```

### Step 4: Install Dependencies for Playlist Tools

Navigate to the playlist-tools directory and install the required npm packages:

```bash
cd ~/aiwork/TrainingMaterial/105\ -\ YouTube\ Content\ Monitoring\ using\ 3rd-APIs/playlist-tools
npm install
```

## First-Time Authentication

To authenticate with YouTube for playlist management:

```bash
npx tsx ~/.claude/skills/manage-youtube/tools/playlist-auth.ts login
```

This will:

1. **Browser Window Opens**: A browser window will automatically open for OAuth consent
2. **Grant Permissions**: Sign in to your Google account and grant YouTube access
3. **Token Created**: After authorization, a token file is automatically created at:
   ```
   ~/.google-skills/youtube/youtube-tokens.json
   ```
4. **Ready to Use**: Subsequent playlist operations will use the stored token automatically

## File Summary

| File | Location | Purpose |
|------|----------|---------|
| `YouTubeSkill-Credentials.json` | `~/.google-skills/youtube/` | OAuth client credentials (copied from skill-key) |
| `youtube-tokens.json` | `~/.google-skills/youtube/` | Access token (auto-generated after first auth) |
| `playlists-cache.json` | `~/.google-skills/youtube/` | Local playlist cache (auto-created by sync operations) |

## Troubleshooting

### Check Authentication Status

To verify your authentication status:

```bash
npx tsx ~/.claude/skills/manage-youtube/tools/playlist-auth.ts status
```

### Refresh Tokens

If tokens are expired:

```bash
npx tsx ~/.claude/skills/manage-youtube/tools/playlist-auth.ts refresh
```

### Logout and Re-authenticate

If you encounter persistent authentication errors, logout and login again:

```bash
npx tsx ~/.claude/skills/manage-youtube/tools/playlist-auth.ts logout
npx tsx ~/.claude/skills/manage-youtube/tools/playlist-auth.ts login
```

### Credentials File Not Found Error

If you see "Credentials file not found", ensure you've completed Steps 1-2 above. The exact error message will show the expected path.

### Content Discovery Tools Not Affected

Remember: Content discovery tools (channel-info, search, transcript, etc.) work without OAuth. This setup is only for playlist management features.
