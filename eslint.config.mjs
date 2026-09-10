import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jest from 'eslint-plugin-jest';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'backend/public/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['frontend/**/*.tsx', 'frontend/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/tests/**/*.ts', '**/tests/**/*.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // A test with no assertion always passes while still raising coverage.
    files: ['backend/tests/**/*.ts', 'frontend/tests/**/*.tsx'],
    plugins: { jest },
    rules: {
      'jest/expect-expect': 'error',
      'jest/valid-expect': 'error',
      'jest/no-identical-title': 'error',
    },
  },
  {
    // A Playwright assertion without await never runs, and the test still passes.
    files: ['e2e/tests/**/*.ts'],
    plugins: { playwright },
    rules: {
      'playwright/missing-playwright-await': 'error',
      'playwright/expect-expect': 'error',
      'playwright/no-focused-test': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
  },
  prettier,
);
