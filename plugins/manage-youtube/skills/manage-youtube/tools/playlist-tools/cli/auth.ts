#!/usr/bin/env npx tsx
// CLI Tool for YouTube OAuth Authentication

import {
  authenticate,
  getAuthStatus,
  logout,
  credentialsExist,
  getStoragePaths,
  refreshTokenIfNeeded,
} from '../src/index.js';
import { PlaylistError } from '../src/types/index.js';

// ============================================================================
// CLI Utilities
// ============================================================================

function printUsage(): void {
  console.log(`
YouTube Playlist Tools - Authentication CLI

Usage: npx tsx cli/auth.ts <command>

Commands:
  login     Authenticate with YouTube (opens browser)
  status    Check authentication status
  logout    Remove stored tokens
  refresh   Manually refresh the access token
  paths     Show file paths for credentials and tokens

Examples:
  npx tsx cli/auth.ts login
  npx tsx cli/auth.ts status
  npx tsx cli/auth.ts logout
`);
}

function formatDate(date: Date): string {
  return date.toLocaleString();
}

// ============================================================================
// Commands
// ============================================================================

async function handleLogin(): Promise<void> {
  if (!credentialsExist()) {
    const paths = getStoragePaths();
    console.error(`\nError: Credentials file not found at:`);
    console.error(`  ${paths.credentials}`);
    console.error(`\nPlease ensure your YouTube OAuth credentials are saved at this location.`);
    process.exit(1);
  }

  try {
    await authenticate();
    console.log('\nAuthentication successful!');
    console.log('You can now use the playlist tools.');
  } catch (error) {
    if (error instanceof PlaylistError) {
      console.error(`\nAuthentication failed: ${error.message}`);
    } else {
      console.error(`\nAuthentication failed:`, error);
    }
    process.exit(1);
  }
}

function handleStatus(): void {
  const status = getAuthStatus();

  console.log('\n=== Authentication Status ===\n');

  if (!credentialsExist()) {
    console.log('Credentials:  NOT FOUND');
    const paths = getStoragePaths();
    console.log(`  Expected at: ${paths.credentials}`);
  } else {
    console.log('Credentials:  Found');
  }

  if (!status.hasTokens) {
    console.log('Tokens:       NOT FOUND');
    console.log('Status:       Not authenticated');
    console.log('\nRun "npx tsx cli/auth.ts login" to authenticate.');
    return;
  }

  console.log('Tokens:       Found');

  if (status.isExpired) {
    console.log('Status:       EXPIRED (needs refresh)');
  } else {
    console.log('Status:       Authenticated');
  }

  if (status.expiryDate) {
    console.log(`Expires:      ${formatDate(status.expiryDate)}`);
  }

  if (status.scopes && status.scopes.length > 0) {
    console.log('Scopes:');
    for (const scope of status.scopes) {
      console.log(`  - ${scope}`);
    }
  }
}

function handleLogout(): void {
  const status = getAuthStatus();

  if (!status.hasTokens) {
    console.log('Already logged out (no tokens found).');
    return;
  }

  logout();
  console.log('Successfully logged out. Tokens have been removed.');
}

async function handleRefresh(): Promise<void> {
  const status = getAuthStatus();

  if (!status.hasTokens) {
    console.error('Not authenticated. Run "npx tsx cli/auth.ts login" first.');
    process.exit(1);
  }

  try {
    await refreshTokenIfNeeded();
    console.log('Token refreshed successfully.');

    const newStatus = getAuthStatus();
    if (newStatus.expiryDate) {
      console.log(`New expiry: ${formatDate(newStatus.expiryDate)}`);
    }
  } catch (error) {
    if (error instanceof PlaylistError) {
      console.error(`Failed to refresh token: ${error.message}`);
      console.error('Please run "npx tsx cli/auth.ts login" to re-authenticate.');
    } else {
      console.error('Failed to refresh token:', error);
    }
    process.exit(1);
  }
}

function handlePaths(): void {
  const paths = getStoragePaths();

  console.log('\n=== Storage Paths ===\n');
  console.log(`Credentials: ${paths.credentials}`);
  console.log(`Tokens:      ${paths.tokens}`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'login':
      await handleLogin();
      break;

    case 'status':
      handleStatus();
      break;

    case 'logout':
      handleLogout();
      break;

    case 'refresh':
      await handleRefresh();
      break;

    case 'paths':
      handlePaths();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
