import { web } from '@ft/vitest-config';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(web, {
  // Next.js requires "jsx": "preserve" in tsconfig, which would leave JSX untransformed in tests.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
