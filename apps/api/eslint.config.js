import { node } from '@ft/eslint-config';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(node(import.meta.dirname), globalIgnores(['src/generated/']), {
  rules: {
    // Nest modules are empty classes that exist for their decorator.
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
  },
});
