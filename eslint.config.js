// ESLint, flat config. TypeScript files get typescript-eslint's strictest type-checked rules, an error for a switch
// that misses a case, and rules against focused (.only) and skipped tests: Vitest's for the Vitest tests, Playwright's
// for the browser specs (tests/browser/), which also may not wait a fixed time. Formatting is Prettier's job
// (eslint-config-prettier).
//
// The site's JavaScript (src/, ES modules since P1-09d) gets no-undef, so a file can't read a name it doesn't import or
// declare: the engine (src/engine/, src/views/, the data file) only JavaScript's own built-ins and console, not window,
// document or sb; the rest of src/ the browser's names too, the page's own classic scripts' (KC_CONFIG from
// kc-config.js, supabase from supabase-js) and its declared globals. The rest of its rules come with TypeScript
// (P1-09e). The other JavaScript (tests' scripts, tools/legacy/) isn't linted yet: it becomes TypeScript in Phase 1.
const { defineConfig, globalIgnores } = require('eslint/config');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const vitest = require('@vitest/eslint-plugin');
const playwright = require('eslint-plugin-playwright');
const prettier = require('eslint-config-prettier');
const globals = require('globals');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

// A page's declared globals (plan P1-09b): the variables its files and its tests share, each declared once as
// `globalThis.<name> = <value>;` at the top of the file that owns it and read and written by its bare name. Worked out
// here from the files themselves (no list kept by hand); tests/static/page-globals.test.ts checks each is one a
// handler or a test needs, or another file writes.
const ENGINE = ['src/engine/**/*.js', 'src/views/**/*.js', 'src/content/**/*.js'];
const declaredGlobals = {};
for (const entry of fs.readdirSync(path.join(__dirname, 'src'), { recursive: true, withFileTypes: true })) {
  const file = path.join(entry.parentPath, entry.name);
  if (!entry.isFile() || !file.endsWith('.js') || /[\\/]src[\\/](engine|views|content)[\\/]/.test(file)) continue;
  const tree = acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  for (const node of tree.body) {
    const e = node.type === 'ExpressionStatement' ? node.expression : null;
    if (e && e.type === 'AssignmentExpression' && e.operator === '=' && e.left.type === 'MemberExpression')
      if (e.left.object.type === 'Identifier' && e.left.object.name === 'globalThis' && !e.left.computed)
        declaredGlobals[e.left.property.name] = 'writable';
  }
}

module.exports = defineConfig(
  globalIgnores(['**/*.js', '!src/**/*.js', '**/*.cjs', '**/*.mjs', 'site/']),
  {
    files: ['src/**/*.js'],
    ignores: ENGINE,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, KC_CONFIG: 'readonly', supabase: 'readonly', ...declaredGlobals },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ENGINE,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { console: 'readonly' } },
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
