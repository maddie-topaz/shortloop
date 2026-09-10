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
      // Stryker's sandbox is a full copy of the workspace; an interrupted run
      // leaves one behind and it would otherwise be linted as source.
      '**/.stryker-tmp/**',
      '**/mutation-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // House style is functional: factory functions returning object literals
    // rather than classes, and arrow consts rather than `function`. Enforced
    // here because a convention only in CLAUDE.md is a request, not a gate.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message:
            'Prefer a factory function returning an object literal over a class. Custom Error subclasses are the exception — disable this rule inline for those.',
        },
      ],
    },
  },
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
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
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
    // These are CommonJS config files; require() is the module system, not a lapse.
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
