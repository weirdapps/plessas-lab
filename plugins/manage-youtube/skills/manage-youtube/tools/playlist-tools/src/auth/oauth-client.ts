// OAuth 2.0 Client for YouTube Data API
// Handles authentication, token storage, and refresh

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { URL } from 'url';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { OAuthCredentials, StoredTokens } from '../types/index.js';
import { PlaylistError } from '../types/index.js';

// ============================================================================
// Constants
// ============================================================================

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
const DATA_DIR = path.join(HOME_DIR, '.google-skills', 'youtube');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'YouTubeSkill-Credentials.json');
const TOKENS_FILE = path.join(DATA_DIR, 'youtube-tokens.json');

/**
 * Render an absolute $HOME path with `~` for user-facing error messages so we
 * don't leak the OS username when stderr is captured into logs.
 */
function displayPath(p: string): string {
  return HOME_DIR && p.startsWith(HOME_DIR) ? '~' + p.slice(HOME_DIR.length) : p;
}

// YouTube Data API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/youtube',  // Full access for CRUD
];

// Local server for OAuth callback
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

// ============================================================================
// File Operations
// ============================================================================

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadCredentials(): OAuthCredentials {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new PlaylistError(
      `Credentials file not found at: ${displayPath(CREDENTIALS_FILE)}`,
      'CREDENTIALS_NOT_FOUND'
    );
  }

  try {
    const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(content) as OAuthCredentials;
  } catch (error) {
    throw new PlaylistError(
      `Failed to read credentials file: ${error}`,
      'CREDENTIALS_NOT_FOUND',
      error
    );
  }
}

function loadTokens(): StoredTokens | null {
  if (!fs.existsSync(TOKENS_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(TOKENS_FILE, 'utf-8');
    return JSON.parse(content) as StoredTokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens): void {
  ensureDataDir();
  // 0600 keeps the long-lived refresh token unreadable to other local users
  // (full youtube scope; theft would let an attacker delete every playlist).
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

function deleteTokens(): void {
  if (fs.existsSync(TOKENS_FILE)) {
    fs.unlinkSync(TOKENS_FILE);
  }
}

// ============================================================================
// OAuth2 Client Management
// ============================================================================

let oauth2ClientInstance: OAuth2Client | null = null;

function createOAuth2Client(): OAuth2Client {
  const credentials = loadCredentials();
  const { client_id, client_secret } = credentials.installed;

  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

/**
 * Get the authenticated OAuth2 client
 * Returns null if not authenticated
 */
export function getOAuth2Client(): OAuth2Client | null {
  if (oauth2ClientInstance) {
    return oauth2ClientInstance;
  }

  const tokens = loadTokens();
  if (!tokens) {
    return null;
  }

  const client = createOAuth2Client();
  client.setCredentials(tokens);
  oauth2ClientInstance = client;

  return client;
}

/**
 * Get authenticated OAuth2 client or throw if not authenticated
 */
export function getAuthenticatedClient(): OAuth2Client {
  const client = getOAuth2Client();
  if (!client) {
    throw new PlaylistError(
      'Not authenticated. Run "npx tsx cli/auth.ts login" first.',
      'AUTH_REQUIRED'
    );
  }
  return client;
}

/**
 * Check if tokens are expired
 */
export function isTokenExpired(): boolean {
  const tokens = loadTokens();
  if (!tokens || !tokens.expiry_date) {
    return true;
  }

  // Add 5 minute buffer before expiry
  const bufferMs = 5 * 60 * 1000;
  return Date.now() >= tokens.expiry_date - bufferMs;
}

/**
 * Refresh the access token if expired
 */
export async function refreshTokenIfNeeded(): Promise<void> {
  const tokens = loadTokens();
  if (!tokens) {
    throw new PlaylistError('No tokens found. Please authenticate first.', 'AUTH_REQUIRED');
  }

  if (!isTokenExpired()) {
    return;
  }

  const client = createOAuth2Client();
  client.setCredentials(tokens);

  try {
    const { credentials } = await client.refreshAccessToken();

    const updatedTokens: StoredTokens = {
      access_token: credentials.access_token || tokens.access_token,
      refresh_token: credentials.refresh_token || tokens.refresh_token,
      scope: credentials.scope || tokens.scope,
      token_type: credentials.token_type || tokens.token_type,
      expiry_date: credentials.expiry_date || tokens.expiry_date,
    };

    saveTokens(updatedTokens);
    oauth2ClientInstance = client;
    oauth2ClientInstance.setCredentials(updatedTokens);
  } catch (error) {
    throw new PlaylistError(
      'Failed to refresh token. Please re-authenticate.',
      'AUTH_EXPIRED',
      error
    );
  }
}

/**
 * Get an authenticated client, refreshing token if needed
 */
export async function getAuthClient(): Promise<OAuth2Client> {
  await refreshTokenIfNeeded();
  return getAuthenticatedClient();
}

// ============================================================================
// Authentication Flow
// ============================================================================

/**
 * Generate the authorization URL for OAuth flow
 */
export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',  // Force refresh token
  });
}

/**
 * Start local server to handle OAuth callback
 */
function startCallbackServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', REDIRECT_URI);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #d32f2f;">Authentication Failed</h1>
              <p>Error: ${error}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new PlaylistError(`OAuth error: ${error}`, 'AUTH_REQUIRED'));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #4caf50;">Authentication Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);
        server.close();
        resolve(code);
        return;
      }

      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid request');
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Callback server listening on port ${REDIRECT_PORT}`);
    });

    server.on('error', (err) => {
      reject(new PlaylistError(`Failed to start callback server: ${err.message}`, 'NETWORK_ERROR', err));
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new PlaylistError('Authentication timed out', 'AUTH_REQUIRED'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string): Promise<StoredTokens> {
  const client = createOAuth2Client();

  try {
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing access_token or refresh_token in response');
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || SCOPES.join(' '),
      token_type: tokens.token_type || 'Bearer',
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000,
    };
  } catch (error) {
    throw new PlaylistError(
      `Failed to exchange code for tokens: ${error}`,
      'AUTH_REQUIRED',
      error
    );
  }
}

/**
 * Run the full OAuth authentication flow
 */
export async function authenticate(): Promise<void> {
  const authUrl = getAuthUrl();

  console.log('\n=== YouTube OAuth Authentication ===\n');
  console.log('Please visit the following URL to authorize this application:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...\n');

  // Try to open browser automatically. On macOS/Linux execFile (not exec)
  // avoids the shell entirely so a tampered credentials file cannot inject
  // metacharacters into the command via the auth URL Google's lib generates.
  // On Windows, `start` is a cmd.exe built-in (not an executable), so we
  // must use exec instead of execFile.
  const { exec, execFile } = await import('child_process');
  if (process.platform === 'win32') {
    exec(`start "" "${authUrl}"`, (err) => {
      if (err) {
        console.log(`(Could not open browser automatically: ${err.message})`);
      }
    });
  } else {
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    execFile(cmd, [authUrl], (err) => {
      if (err) {
        console.log(`(Could not open browser automatically: ${err.message})`);
      }
    });
  }

  // Wait for callback
  const code = await startCallbackServer();

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);
  saveTokens(tokens);

  // Update the client instance
  const client = createOAuth2Client();
  client.setCredentials(tokens);
  oauth2ClientInstance = client;

  console.log('\nAuthentication successful! Tokens saved.');
}

// ============================================================================
// Status and Logout
// ============================================================================

export interface AuthStatus {
  isAuthenticated: boolean;
  hasTokens: boolean;
  isExpired: boolean;
  expiryDate?: Date;
  scopes?: string[];
}

/**
 * Get the current authentication status
 */
export function getAuthStatus(): AuthStatus {
  const tokens = loadTokens();

  if (!tokens) {
    return {
      isAuthenticated: false,
      hasTokens: false,
      isExpired: true,
    };
  }

  const isExpired = isTokenExpired();

  return {
    isAuthenticated: !isExpired,
    hasTokens: true,
    isExpired,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scopes: tokens.scope ? tokens.scope.split(' ') : undefined,
  };
}

/**
 * Logout - remove stored tokens
 */
export function logout(): void {
  deleteTokens();
  oauth2ClientInstance = null;
  console.log('Logged out. Tokens removed.');
}

/**
 * Check if credentials file exists
 */
export function credentialsExist(): boolean {
  return fs.existsSync(CREDENTIALS_FILE);
}

/**
 * Get the paths used for storage
 */
export function getStoragePaths(): { credentials: string; tokens: string } {
  return {
    credentials: CREDENTIALS_FILE,
    tokens: TOKENS_FILE,
  };
}
