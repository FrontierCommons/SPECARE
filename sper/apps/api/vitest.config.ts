import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

// Load .env.test explicitly (not .env) so the test suite always talks to its
// own disposable database, never the dev DB — test/setup.ts truncates tables
// on every run and would otherwise wipe real dev data.
const { parsed: testEnv } = loadDotenv({
  path: fileURLToPath(new URL('.env.test', import.meta.url)),
});

export default defineConfig({
  resolve: {
    alias: {
      '@sper/shared-types': fileURLToPath(
        new URL('../../packages/shared-types/dist/index.js', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    env: testEnv,
    // DB tests share one Postgres; run serially in a single fork to avoid
    // cross-test interference on truncation.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
