#!/usr/bin/env npx tsx
// Wrapper for playlist-tools sync CLI
// Local caching and sync operations for YouTube playlists

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use relative path to playlist-tools directory within the skill
const PLAYLIST_TOOLS_PATH = path.join(__dirname, 'playlist-tools');

const args = process.argv.slice(2);

const child = spawn('npx', ['tsx', 'cli/sync.ts', ...args], {
  cwd: PLAYLIST_TOOLS_PATH,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
