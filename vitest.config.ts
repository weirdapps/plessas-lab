import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The suite calls vi.resetModules() per test and re-imports the plugin
    // sources dynamically, so the first import in a cold run pays the whole
    // transform cost of the Google API surface. That regularly exceeds the 5s
    // default on a cold CI runner and fails a test that is otherwise passing.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'plugins/**/tools/**/*.ts',
        'plugins/**/scripts/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/cli/**',  // CLI scripts tested via integration
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
