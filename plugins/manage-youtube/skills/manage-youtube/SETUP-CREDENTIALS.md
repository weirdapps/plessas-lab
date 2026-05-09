# YouTube Skill — Credentials Setup

This document walks you through obtaining and installing OAuth 2.0 credentials for the YouTube skill's **playlist management features only**.

> **Important:** Content discovery tools (channel info, search, transcripts, etc.) work without any credentials. You only need this setup if you want to create, update, or delete YouTube playlists.

The credentials JSON is per-user and per-project — the marketplace cannot ship one for you. Allow about 10 minutes the first time.

## Step 1 — Create a Google Cloud project (one-time)

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. In the project picker (top bar), choose **NEW PROJECT** (or reuse an existing personal project — the same project can host both Gmail and YouTube credentials).
3. Give it any name (e.g. `claude-youtube`) and click **CREATE**.
4. Wait for the project to provision, then make sure it's selected in the project picker.

## Step 2 — Enable the YouTube Data API v3

1. Open [API Library](https://console.cloud.google.com/apis/library) (with your project selected).
2. Search **YouTube Data API v3**, click it, and click **ENABLE**.

## Step 3 — Configure the OAuth consent screen

1. Open [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
2. Choose **External** (unless you're in a Google Workspace org).
3. Fill in:
   - **App name**: anything (e.g. `Claude YouTube`)
   - **User support email**: your own email
   - **Developer contact email**: your own email
4. Save and continue. Skip Scopes. On **Test users**, **add your own Google email** — otherwise OAuth will refuse to issue a token.
5. Save and continue. Leave the app in **Testing** status.

## Step 4 — Create the OAuth client credentials

1. Open [Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **+ CREATE CREDENTIALS → OAuth client ID**.
3. **Application type**: choose **Desktop app**.
4. **Name**: anything (e.g. `Claude YouTube Desktop`).
5. Click **CREATE**, then **DOWNLOAD JSON** in the dialog.

## Step 5 — Install the credentials

The skill expects the file at `~/.google-skills/youtube/YouTubeSkill-Credentials.json`. Move the downloaded file there:

```bash
mkdir -p ~/.google-skills/youtube
mv ~/Downloads/client_secret_*.json ~/.google-skills/youtube/YouTubeSkill-Credentials.json
ls -la ~/.google-skills/youtube/YouTubeSkill-Credentials.json
```

(Adjust the source path if your browser saves elsewhere. The destination filename **must** be exactly `YouTubeSkill-Credentials.json`.)

## Step 6 — Install playlist tooling dependencies

The playlist tools are TypeScript-based and need npm packages installed once:

```bash
cd ./tools/playlist-tools && npm install
```

## Step 7 — First-time authorization

```bash
npx tsx ./tools/playlist-auth.ts login
```

This will:

1. Open a browser window with Google's OAuth consent screen.
2. You'll see "**Google hasn't verified this app**" — expected for a personal Test-status app. Click **Advanced → Go to <your project> (unsafe)** to proceed.
3. Grant YouTube access.
4. The browser tab closes and a token is written to `~/.google-skills/youtube/youtube-tokens.json`. Subsequent playlist operations reuse it silently.

## File summary

| File | Location | Purpose |
|------|----------|---------|
| `YouTubeSkill-Credentials.json` | `~/.google-skills/youtube/` | OAuth client identity (your hand-installed file) |
| `youtube-tokens.json` | `~/.google-skills/youtube/` | Access + refresh token (auto-written after first auth) |
| `playlists-cache.json` | `~/.google-skills/youtube/` | Local playlist cache (auto-written by sync operations) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Credentials file not found` at runtime | Recheck Step 5 — the path must be exactly `~/.google-skills/youtube/YouTubeSkill-Credentials.json`. |
| `Error 403: access_denied` in the browser | You're not in the **Test users** list. Go back to Step 3, add your email, retry. |
| Token expired errors | `npx tsx ./tools/playlist-auth.ts refresh` — or full reset: `npx tsx ./tools/playlist-auth.ts logout && npx tsx ./tools/playlist-auth.ts login`. |
| Status check | `npx tsx ./tools/playlist-auth.ts status` confirms whether your token is still valid. |
| Discovery tools fail | They shouldn't need OAuth at all — if they do, it's a different bug; check the skill's main docs. |
