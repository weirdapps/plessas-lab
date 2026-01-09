#!/usr/bin/env npx tsx
// Wrapper for playlist-tools sync CLI
// Local caching and sync operations for YouTube playlists

import { spawn } from 'child_process';
import path from 'path';

const PLAYLIST_TOOLS_PATH = path.join(
  process.env.HOME || '~',
  'aiwork/TrainingMaterial/105 - YouTube Content Monitoring using 3rd-APIs/playlist-tools'
);

const args = process.argv.slice(2);

const child = spawn('npx', ['tsx', 'cli/sync.ts', ...args], {
  cwd: PLAYLIST_TOOLS_PATH,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
