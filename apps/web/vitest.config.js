import { resolve } from 'node:path';

import { web } from '@ft/vitest-config';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(web, {
  // Next.js requires "jsx": "preserve" in tsconfig, which would leave JSX untransformed in tests.
  oxc: { jsx: { runtime: 'automatic' } },
  // The tsconfig path alias that Next.js resolves for the app.
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
