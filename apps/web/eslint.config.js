import { react } from '@ft/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';

// The Next.js plugin is used directly: eslint-config-next also brings eslint-plugin-react and
// eslint-plugin-jsx-a11y, which do not support ESLint 10 yet.
export default defineConfig(
  react(import.meta.dirname),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  globalIgnores(['.next/', 'next-env.d.ts']),
);
