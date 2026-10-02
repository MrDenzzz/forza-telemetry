// @ts-check
import { defaultClientConditions, defaultServerConditions } from 'vite';
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

/**
 * Tests for browser code in a simulated DOM. Code under a DOM environment is resolved with
 * client conditions, so the source condition is added there as well.
 */
export const web = defineConfig({
  resolve: {
    conditions: ['@ft/source', ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: ['@ft/source', ...defaultServerConditions],
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
