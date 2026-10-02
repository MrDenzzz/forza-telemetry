// @ts-check
import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Strict type-aware config shared by every TypeScript workspace.
 *
 * @param {string} tsconfigRootDir Directory of the consuming package, usually `import.meta.dirname`.
 */
export function base(tsconfigRootDir) {
  return defineConfig(
    globalIgnores(['**/dist/', '**/coverage/', '**/.turbo/']),
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
      },
      rules: {
        eqeqeq: ['error', 'always'],
        'no-console': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    prettier,
  );
}

/**
 * Node.js services and CLIs.
 *
 * @param {string} tsconfigRootDir Directory of the consuming package, usually `import.meta.dirname`.
 */
export function node(tsconfigRootDir) {
  return defineConfig(base(tsconfigRootDir), {
    languageOptions: {
      globals: globals.node,
    },
  });
}

/**
 * Command-line tools, whose terminal output is their user interface.
 *
 * @param {string} tsconfigRootDir Directory of the consuming package, usually `import.meta.dirname`.
 */
export function cli(tsconfigRootDir) {
  return defineConfig(node(tsconfigRootDir), {
    rules: {
      'no-console': 'off',
    },
  });
}

/**
 * React for the web and React Native. Uses @eslint-react rather than eslint-plugin-react,
 * which does not support ESLint 10.
 *
 * @param {string} tsconfigRootDir Directory of the consuming package, usually `import.meta.dirname`.
 */
export function react(tsconfigRootDir) {
  return defineConfig(base(tsconfigRootDir), {
    files: ['**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['recommended-type-checked'],
      reactHooks.configs.flat['recommended-latest'],
    ],
  });
}
