import { react } from '@ft/eslint-config';
import { defineConfig, globalIgnores } from 'eslint/config';

// eslint-config-expo brings eslint-plugin-react, which does not support ESLint 10; the shared
// React preset covers React Native too.
export default defineConfig(
  react(import.meta.dirname),
  {
    // Metro and Jest load their configs as CommonJS.
    files: ['*.config.js', 'test/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores(['.expo/', 'dist/', 'android/', 'ios/']),
);
