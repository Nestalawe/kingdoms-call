// ESLint, flat config. TypeScript files get typescript-eslint's strictest type-checked rules and its stylistic
// type-checked ones, an error for a switch that misses a case, and rules against focused (.only) and skipped tests:
// Vitest's for the Vitest tests, Playwright's for the browser specs (tests/browser/), which also may not wait a fixed
// time. Formatting is Prettier's job (eslint-config-prettier).
//
// The site's code (src/, TypeScript modules since P1-09e) gets its own tier (plan P1-09, Decision 15): ESLint's
// recommended rules and typescript-eslint's strict set, which read the code alone, not its types. A file of src/ that
// TypeScript checks (its first line isn't the comment that switches the check off, read from the files here: no list
// kept by hand) gets the type-aware sets too, strictTypeChecked and stylisticTypeChecked (plan P1-13, Decision 5); a
// file TypeScript skips doesn't, since with nothing checked every value is any. Four rules are the site's own. no-undef
// (P1-09d), so a file can't read a name it doesn't import or declare: the engine (src/engine/, src/views/, the data
// file) only JavaScript's own built-ins and console, not window, document or sb; the rest of src/ the browser's names
// too, the page's own classic scripts' (KC_CONFIG from kc-config.js, supabase from supabase-js) and its declared
// globals. ban-ts-comment: a file is left unchecked only with its reason. And no type assertion (`as`, but `as const`)
// and no non-null assertion (`x!`), each a claim the compiler takes on trust (plan P1-10, Decision 2): a file passes
// strict TypeScript with what it checks. The other JavaScript (tests' scripts, tools/legacy/, public/'s two scripts)
// isn't linted yet: the tests' and tools' become TypeScript in Phase 1; public/'s are copied as they are.
//
// Every rule is an error (plan P1-13, Decisions 4 and 13): no rule is at warn. What the rules found when they came in
// is in eslint-suppressions.json (ESLint's bulk suppressions, per file and rule, with a count), which the command line
// reads (npm run lint, npm run check, the edit hook): a new finding fails, and so does a suppressed one that no longer
// occurs until `npx eslint --prune-suppressions` takes it out. tools/ratchet.ts counts the suppressions
// (eslintSuppressions), so they only fall. Only one rule of the two type-aware sets is off (Decision 6):
// non-nullable-type-assertion-style asks for `x!` where `as` is written, and no-non-null-assertion forbids `x!`.
const { defineConfig, globalIgnores } = require('eslint/config');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const vitest = require('@vitest/eslint-plugin');
const playwright = require('eslint-plugin-playwright');
const prettier = require('eslint-config-prettier');
const globals = require('globals');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// A page's declared globals (plan P1-09b): the variables its files and its tests share, each declared once as
// `globalThis.<name> = <value>;` at the top of the file that owns it and read and written by its bare name. Worked out
// here from the files themselves (no list kept by hand); tests/static/page-globals.test.ts checks each is one a
// handler or a test needs, or another file writes, and tests/static/globals-d-ts.test.ts that src/globals.d.ts
// declares exactly these for TypeScript.
const SITE = ['src/**/*.ts'];
const ENGINE = ['src/engine/**/*.ts', 'src/views/**/*.ts', 'src/content/**/*.ts'];
// The comment that leaves a file unchecked, built from parts so this file doesn't count as one (tools/ratchet.ts).
const UNCHECKED = new RegExp('^// @ts-' + 'nocheck\\b');
// The files of src/ that TypeScript checks: those whose first line isn't that comment (tests/static/harness.test.ts
// checks the comment is only ever on the first line).
const CHECKED = [];
const declaredGlobals = {};
for (const entry of fs.readdirSync(path.join(__dirname, 'src'), { recursive: true, withFileTypes: true })) {
  const file = path.join(entry.parentPath, entry.name);
  if (!entry.isFile() || !file.endsWith('.ts')) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (!UNCHECKED.test(text)) CHECKED.push(path.relative(__dirname, file).split(path.sep).join('/'));
  if (file.endsWith('.d.ts')) continue;
  if (/[\\/]src[\\/](engine|views|content)[\\/]/.test(file)) continue;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
  for (const node of source.statements) {
    const e = ts.isExpressionStatement(node) ? node.expression : null;
    if (!e || !ts.isBinaryExpression(e) || e.operatorToken.kind !== ts.SyntaxKind.EqualsToken) continue;
    const left = e.left;
    if (
      ts.isPropertyAccessExpression(left) &&
      ts.isIdentifier(left.expression) &&
      left.expression.text === 'globalThis'
    )
      declaredGlobals[left.name.text] = 'writable';
  }
}

// A shared set with every rule it asks for at error (a rule it switches off stays off): no rule is at warn.
const atError = (configs) =>
  [configs].flat().map((c) => {
    if (!c.rules) return c;
    const rules = {};
    for (const [rule, entry] of Object.entries(c.rules)) {
      const [level, ...options] = Array.isArray(entry) ? entry : [entry];
      rules[rule] = level === 'warn' || level === 1 ? ['error', ...options] : entry;
    }
    return { ...c, rules };
  });

// The site's rules (above): ESLint's recommended and typescript-eslint's strict set (its own order: what its
// eslint-recommended part switches off for TypeScript stays off); then the four of its own.
const siteSets = atError([js.configs.recommended, ...tseslint.configs.strict]);
const siteRules = {
  'no-undef': 'error',
  '@typescript-eslint/ban-ts-comment': ['error', { 'ts-nocheck': 'allow-with-description' }],
  '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
  '@typescript-eslint/no-non-null-assertion': 'error',
};
// The type-aware sets (above), with the one rule they disagree on off (Decision 6).
const typedSets = atError([...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked]);
const typedRules = { '@typescript-eslint/non-nullable-type-assertion-style': 'off' };
const projectService = { parserOptions: { projectService: true, tsconfigRootDir: __dirname } };
// The three type assertions src/ held when the rule came in (P1-11a3 wrote them, for reads TypeScript can't follow
// without a statement changed: a table read by any name, a key that may be missing, the first of a list that is never
// empty). P1-10b replaces each with a check, and this list goes; tests/static/harness.test.ts checks that it only
// shrinks and that each file holds just its one.
const TYPE_ASSERTIONS_KEPT = [
  'src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts',
  'src/engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts',
  'src/engine/rules-on-plain-values/unit-types-and-base-strength.ts',
];

module.exports = defineConfig(
  globalIgnores(['**/*.js', '**/*.cjs', '**/*.mjs', 'site/']),
  {
    files: SITE,
    ignores: ENGINE,
    extends: siteSets,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, KC_CONFIG: 'readonly', supabase: 'readonly', ...declaredGlobals },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: siteRules,
  },
  {
    files: ENGINE,
    extends: siteSets,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { console: 'readonly' } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: siteRules,
  },
  {
    // The files of src/ that TypeScript checks: the type-aware sets too, after which the site's own four again (the
    // stylistic set asks for `as` where the site allows no assertion at all).
    files: CHECKED,
    extends: typedSets,
    languageOptions: projectService,
    rules: { ...typedRules, ...siteRules },
  },
  {
    // The names the engine reads from a page, each only when it's there: window for the bots' test hooks (__botDiag
    // and __botHyg), behind typeof; and the dice's seed, KC_RNG_SEED (behind typeof), or without one the browser's
    // crypto.
    files: ['src/engine/bots/economy.ts'],
    languageOptions: { globals: { window: 'readonly' } },
  },
  {
    files: ['src/engine/rng.ts'],
    languageOptions: { globals: { crypto: 'readonly', KC_RNG_SEED: 'readonly' } },
  },
  {
    files: TYPE_ASSERTIONS_KEPT,
    rules: { '@typescript-eslint/consistent-type-assertions': 'off' },
  },
  {
    // TypeScript's form for a global variable is `declare var`: with `let` or `const`, globalThis.<name> (how a page's
    // declared globals are set, P1-09b) wouldn't be known.
    files: ['src/globals.d.ts'],
    rules: { 'no-var': 'off' },
  },
  {
    files: ['**/*.ts', '**/*.mts'],
    ignores: SITE,
    extends: atError([js.configs.recommended, ...typedSets]),
    languageOptions: projectService,
    rules: {
      ...typedRules,
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    ignores: ['tests/browser/**'],
    extends: atError(vitest.configs.recommended),
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      // expect(value, message): Vitest's own form, used to show a failing script's output.
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
    },
  },
  {
    files: ['tests/browser/**/*.ts'],
    extends: atError(playwright.configs['flat/recommended']),
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
