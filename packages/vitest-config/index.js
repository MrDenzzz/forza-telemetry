// @ts-check
import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Tests for Node.js packages. Workspace dependencies resolve to their TypeScript sources
 * through the `@ft/source` export condition, so tests never wait for dependency builds.
 * Vitest reads server-side conditions from `ssr.resolve`, not from `resolve`.
 */
export const node = defineConfig({
  ssr: {
    resolve: {
      conditions: ['@ft/source', ...defaultServerConditions],
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
