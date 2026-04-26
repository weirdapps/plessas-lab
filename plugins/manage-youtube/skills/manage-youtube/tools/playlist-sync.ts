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

// shell:false avoids /bin/sh re-parsing of forwarded args. With shell:true any
// metachar in `args` (e.g. a playlist title containing $(...) or backticks
// passed through by the model) would execute as a shell command.
const child = spawn('npx', ['tsx', 'cli/sync.ts', ...args], {
  cwd: PLAYLIST_TOOLS_PATH,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
