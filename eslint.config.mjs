// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/mobile/.expo/**',
      'apps/mobile/expo-env.d.ts',
      'pipeline/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '19.3' } },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Expo config plugins run in Node at prebuild time and are CommonJS by convention.
    files: ['apps/mobile/plugins/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // App code runs on Hermes: Node built-ins only in tests.
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    ignores: ['apps/mobile/src/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*'], message: 'app code runs on Hermes' }] },
      ],
    },
  },
  {
    // core runs inside React Native (Hermes): no Node built-ins in shipped code.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*'], message: 'core/src must run on Hermes' }] },
      ],
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.jest } },
  },
  prettier,
);
