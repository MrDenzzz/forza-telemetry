import { node } from '@ft/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(node(import.meta.dirname), {
  rules: {
    // Nest modules are empty classes that exist for their decorator.
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
  },
});
