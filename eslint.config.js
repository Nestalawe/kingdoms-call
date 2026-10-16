// ESLint, flat config. TypeScript files get typescript-eslint's strictest type-checked rules, an error for a switch
// that misses a case, and Vitest's rules against focused (.only) and skipped tests. Today's JavaScript isn't linted
// yet: it becomes TypeScript during Phase 1 (P1-09, P1-14). Formatting is Prettier's job (eslint-config-prettier).
const { defineConfig, globalIgnores } = require('eslint/config');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const vitest = require('@vitest/eslint-plugin');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig(
  globalIgnores(['**/*.js', '**/*.cjs', '**/*.mjs', 'site/']),
  {
    files: ['**/*.ts', '**/*.mts'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    extends: [vitest.configs.recommended],
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      // expect(value, message): Vitest's own form, used to show a failing script's output.
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
    },
  },
  prettier,
);
