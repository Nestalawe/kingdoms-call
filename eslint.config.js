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
// strict TypeScript with what it checks. The other JavaScript (tests' scripts, tools/legacy/) isn't linted yet: it
// becomes TypeScript in Phase 1.
//
// The engine runs on plain data (plan P1-13, Decision 7): src/engine/, src/views/, src/content/, src/shared/ and
// src/schemas/ may read no page's, browser's or timer's name, nor the time (Date: the engine's clock is kcClock(),
// src/engine/clock.ts), nor the database (supabase, sb). Three files are the reviewed exceptions, each with its
// reason below. The dice come from kcRng() (src/engine/rng.ts) everywhere: Math.random is refused in all of src/ but
// rng.ts, through Math or through window. or globalThis., and in the classic scripts. Only src/db/ may read supabase
// (the client's global); the four pages' createClient calls are in the suppressions, for P1-17's access layer.
//
// The project's own rules (tools/eslint-rules/, the plugin kc; plan P1-13, Decision 8) are the incident rules that
// replaced home-made static tests: no random or argument-less sort comparator, and the big tables and profiles read by
// named columns. They run on src/ and on the classic scripts: public/'s two (copied as they are) and the templates'
// inline scripts and on…="…" handlers, which tests/static/the-templates-scripts-pass-the-sites-lint-rules.test.ts hands
// to ESLint as src/<template>.html/<piece>.js, under the same block.
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
const kc = require('./tools/eslint-rules/index.ts').default;

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

// The engine's purity (above): the names src/engine/, src/views/, src/content/, src/shared/ and src/schemas/ may not
// read, each with what to do instead. `except` names the ones a reviewed exception reads.
const PURE = [
  'src/engine/**/*.ts',
  'src/views/**/*.ts',
  'src/content/**/*.ts',
  'src/shared/**/*.ts',
  'src/schemas/**/*.ts',
];
const PLAIN_DATA = 'The engine runs on plain data: no page, browser or timer here (CLAUDE.md, the guardrails).';
const NOT_HERE = {
  window: PLAIN_DATA,
  document: PLAIN_DATA,
  localStorage: PLAIN_DATA,
  sessionStorage: PLAIN_DATA,
  fetch: PLAIN_DATA,
  navigator: PLAIN_DATA,
  location: PLAIN_DATA,
  crypto: 'Dice come from kcRng() (src/engine/rng.ts): docs/traps.md, "Dice come from kcRng()".',
  setTimeout: PLAIN_DATA,
  setInterval: PLAIN_DATA,
  globalThis: PLAIN_DATA,
  Date: 'The engine\'s time comes from kcClock() (src/engine/clock.ts): docs/traps.md, "Dice come from kcRng()".',
  supabase: 'Only src/db/ talks to the database (plan P1-17).',
  sb: 'Only src/db/ talks to the database (plan P1-17).',
};
const restrictedGlobals = (names) => ['error', ...names.map((name) => ({ name, message: NOT_HERE[name] }))];
const pureGlobals = (except = []) => restrictedGlobals(Object.keys(NOT_HERE).filter((n) => !except.includes(n)));
// Math.random, refused (above): as Math.random or Math['random'], and through any object's Math (window.Math.random,
// globalThis.Math['random']).
const DICE =
  'Dice come from kcRng() (src/engine/rng.ts), so a seed replays the game: docs/traps.md, "Dice come from kcRng()".';
const noMathRandom = {
  'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: DICE }],
  'no-restricted-syntax': [
    'error',
    {
      selector:
        "MemberExpression[object.type='MemberExpression']:matches([object.property.name='Math'], [object.property.value='Math']):matches([property.name='random'], [property.value='random'])",
      message: DICE,
    },
  ],
};
// The project's own rules (above), each an error.
const kcRules = {
  'kc/big-tables-and-profiles-are-read-by-named-columns': 'error',
  'kc/no-random-or-argument-less-sort-comparator': 'error',
};
// The classic scripts (above): public/'s two, and the templates' scripts and handlers as the static test names them.
const CLASSIC = ['public/*.js', 'src/*.html/*.js'];

module.exports = defineConfig(
  globalIgnores(['**/*.js', '!public/*.js', '!src/*.html/*.js', '**/*.cjs', '**/*.mjs', 'site/']),
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
    files: SITE,
    plugins: { kc },
    rules: kcRules,
  },
  {
    files: SITE,
    ignores: ['src/engine/rng.ts'],
    rules: noMathRandom,
  },
  {
    files: SITE,
    ignores: [...PURE, 'src/db/**'],
    rules: { 'no-restricted-globals': restrictedGlobals(['supabase']) },
  },
  {
    files: PURE,
    rules: { 'no-restricted-globals': pureGlobals() },
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
    // The engine's three reviewed exceptions to its purity (plan P1-13, Decision 7; tests/static/harness.test.ts pins
    // exactly these). The names it reads from a page, each only when it's there: window for the bots' test hooks
    // (__botDiag and __botHyg), behind typeof; and the dice's seed, KC_RNG_SEED (behind typeof), or without one the
    // browser's crypto. And the engine's clock, the one place it reads the time.
    files: ['src/engine/bots/economy.ts'],
    languageOptions: { globals: { window: 'readonly' } },
    rules: { 'no-restricted-globals': pureGlobals(['window']) },
  },
  {
    files: ['src/engine/rng.ts'],
    languageOptions: { globals: { crypto: 'readonly', KC_RNG_SEED: 'readonly' } },
    rules: { 'no-restricted-globals': pureGlobals(['crypto']) },
  },
  {
    files: ['src/engine/clock.ts'],
    rules: { 'no-restricted-globals': pureGlobals(['Date']) },
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
    // The classic scripts (above): ESLint's recommended rules, each an error, the dice and the project's own rules. A
    // top-level name of a classic script is a global the page's other scripts read, so only an unused local counts.
    files: CLASSIC,
    extends: atError(js.configs.recommended),
    plugins: { kc },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, KC_CONFIG: 'readonly', supabase: 'readonly' },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { 'no-unused-vars': ['error', { vars: 'local' }], ...noMathRandom, ...kcRules },
  },
  {
    // It declares KC_CONFIG, the global the other scripts read.
    files: ['public/kc-config.js'],
    languageOptions: { globals: { KC_CONFIG: 'off' } },
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
