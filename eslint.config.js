// ESLint, flat config. TypeScript files get typescript-eslint's strictest type-checked rules, an error for a switch
// that misses a case, and rules against focused (.only) and skipped tests: Vitest's for the Vitest tests, Playwright's
// for the browser specs (tests/browser/), which also may not wait a fixed time. Today's JavaScript isn't linted yet: it
// becomes TypeScript during Phase 1 (P1-09, P1-14). The one exception is the engine (src/engine/, src/views/): it gets
// no-undef, so code lifted out of resolveTurn can't keep a name it reached through the closure (plan P1-08a). Formatting
// is Prettier's job (eslint-config-prettier).
const { defineConfig, globalIgnores } = require('eslint/config');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const vitest = require('@vitest/eslint-plugin');
const playwright = require('eslint-plugin-playwright');
const prettier = require('eslint-config-prettier');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const { engineFiles } = require('./src/manifest.ts');

// The engine's files are classic scripts sharing the GM page's one global scope, so each may read what the others and
// the data file declare at top level. Those names are its globals, worked out here from the files themselves (no list
// kept by hand), with JavaScript's own built-ins (ecmaVersion) and console. Nothing else: not window, document or sb.
const ENGINE_SCRIPTS = ['content/kingdoms-call-data.js', ...engineFiles()];
const engineGlobals = {};
for (const file of ENGINE_SCRIPTS) {
  const tree = acorn.parse(fs.readFileSync(path.join(__dirname, 'src', file), 'utf8'), { ecmaVersion: 'latest' });
  for (const node of tree.body) {
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration')
      engineGlobals[node.id.name] = 'readonly';
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) if (d.id.type === 'Identifier') engineGlobals[d.id.name] = 'readonly';
    }
  }
}

module.exports = defineConfig(
  globalIgnores(['**/*.js', '!src/engine/**/*.js', '!src/views/**/*.js', '**/*.cjs', '**/*.mjs', 'site/']),
  {
    files: ['src/engine/**/*.js', 'src/views/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...engineGlobals, console: 'readonly' },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { 'no-undef': 'error' },
  },
  {
    // The names the engine reads from a page, each only when it's there: window for the bots' test hooks (__botDiag
    // and __botHyg), behind typeof; and the dice's seed, KC_RNG_SEED (behind typeof), or without one the browser's
    // crypto.
    files: ['src/engine/bots/economy.js'],
    languageOptions: { globals: { window: 'readonly' } },
  },
  {
    files: ['src/engine/rng.js'],
    languageOptions: { globals: { crypto: 'readonly', KC_RNG_SEED: 'readonly' } },
  },
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
    ignores: ['tests/browser/**'],
    extends: [vitest.configs.recommended],
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      // expect(value, message): Vitest's own form, used to show a failing script's output.
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
    },
  },
  {
    files: ['tests/browser/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-skipped-test': 'error',
      // Playwright's set turns this off for fixtures written ({}); the specs don't need it.
      'no-empty-pattern': 'error',
    },
  },
  {
    // Its check is that a page asks no other site for anything once loaded: it waits until no request has been made
    // for half a second (the script it replaced waited a fixed half second).
    files: ['tests/browser/third-party-requests.spec.ts'],
    rules: { 'playwright/no-networkidle': 'off' },
  },
  prettier,
);
