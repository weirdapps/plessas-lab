# Gmail Skill — Credentials Setup

This document walks you through obtaining and installing OAuth 2.0 credentials so the Gmail skill can read and send mail on your behalf.

> **Why this exists:** The skill needs a Google Cloud OAuth client to talk to the Gmail API on your account. The credentials JSON is per-user and per-project — the marketplace cannot ship one for you. Allow about 10 minutes the first time.

## Step 1 — Create a Google Cloud project (one-time)

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. In the project picker (top bar), choose **NEW PROJECT** (or reuse an existing personal project).
3. Give it any name (e.g. `claude-gmail`) and click **CREATE**.
4. Wait for the project to provision, then make sure it's selected in the project picker.

## Step 2 — Enable the Gmail API

1. Open [API Library](https://console.cloud.google.com/apis/library) (with your new project selected).
2. Search **Gmail API**, click it, and click **ENABLE**.

## Step 3 — Configure the OAuth consent screen

1. Open [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
2. Choose **External** (unless you're in a Google Workspace org and only signing in to a `@yourdomain` account, in which case **Internal** is fine).
3. Fill in the required fields:
   - **App name**: anything (e.g. `Claude Gmail`)
   - **User support email**: your own email
   - **Developer contact email**: your own email
4. Save and continue. On the **Scopes** step you can skip (the skill requests scopes at runtime). On the **Test users** step, **add your own Google email** as a test user — otherwise OAuth will refuse to issue a token.
5. Save and continue. The app stays in **Testing** status, which is exactly what we want for personal use.

## Step 4 — Create the OAuth client credentials

1. Open [Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **+ CREATE CREDENTIALS → OAuth client ID**.
3. **Application type**: choose **Desktop app**.
4. **Name**: anything (e.g. `Claude Gmail Desktop`).
5. Click **CREATE**. A dialog appears with your client ID and secret — click **DOWNLOAD JSON**.

## Step 5 — Install the credentials

The skill expects the file at `~/.google-skills/gmail/GMailSkill-Credentials.json`. Move the downloaded file there:

```bash
mkdir -p ~/.google-skills/gmail
mv ~/Downloads/client_secret_*.json ~/.google-skills/gmail/GMailSkill-Credentials.json
ls -la ~/.google-skills/gmail/GMailSkill-Credentials.json
```

(Adjust the source path if your browser saves elsewhere. The destination filename **must** be exactly `GMailSkill-Credentials.json`.)

## Step 6 — First-time authorization

The first Gmail operation you run will:

1. Open a browser window with Google's OAuth consent screen.
2. You'll see "**Google hasn't verified this app**" — that's expected for a personal Test-status app. Click **Advanced → Go to <your project> (unsafe)** to proceed (you're authorizing yourself).
3. Grant the permissions the skill requests.
4. The browser tab closes automatically and a token is written to `~/.google-skills/gmail/gmail_token.json`. Subsequent calls reuse that token silently.

## File summary

| File | Location | Purpose |
|------|----------|---------|
| `GMailSkill-Credentials.json` | `~/.google-skills/gmail/` | OAuth client identity (your hand-installed file) |
| `gmail_token.json` | `~/.google-skills/gmail/` | Access + refresh token (auto-written after first auth) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Credentials file not found` at runtime | Recheck Step 5 — the path must be exactly `~/.google-skills/gmail/GMailSkill-Credentials.json`. |
| `Error 403: access_denied` in the browser | You're not in the **Test users** list. Go back to Step 3, add your email, retry. |
| Token expired or repeated auth errors | `rm ~/.google-skills/gmail/gmail_token.json` and re-run any Gmail operation to redo the OAuth flow. |
| App banner says "in production" or "needs verification" | Don't switch the app to Production unless you actually need other users to authenticate — Test status is the right mode for personal use. |
