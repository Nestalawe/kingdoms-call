// The harness checks itself (P1-01b; plan "The harness, enforced, not remembered"). Fails if a setting that keeps the
// tests honest is missing or weakened: the compiler flags, the lint rules' severities, no retries and no .only (in
// Vitest and in Playwright), the test runs' own checks, the Node pin, the Claude Code hooks and their stop limit, the
// CI jobs and the required "ci" check, the build that every test job, the deploy and staging run first (P1-05), the
// deploy's and staging's build in a job that can only read, published by a job that runs no npm (P1-06a), the
// balance job and its engine paths, the nightly random-seed run and fast-check's seed, the dangerous paths, and the
// ratchet, the architecture rules (dependency-cruiser and knip, P1-13a), ESLint's bulk suppressions (P1-13b), and the
// engine's purity, the dice and the project's own lint rules (P1-13c). It
// runs ESLint on one file to show the suppressions hold (a few seconds). Every later step that adds a guarantee
// adds its check here. Level 1 (static): it reads settings files and the counts, and runs no game code.
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ESLint, type Linter } from 'eslint';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';
import ts from 'typescript';
import { z } from 'zod';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import archConfig from '../../.dependency-cruiser.mts';
import knipConfig from '../../knip.ts';
import config from '../../vitest.config.mts';
import pwConfig from '../../playwright.config.ts';
import dangerous from '../../.github/scripts/dangerous-paths.js';
import { CHECK_LEVELS } from '../../tools/check.ts';
import { ENGINE_PATHS, isEnginePath } from '../../tools/balance/engine-paths.ts';
import { pageSources } from '../../tools/balance/run.ts';
import { filesUnder } from '../../tools/build.ts';
import { pageNames } from '../../tools/pages.ts';
import { decide, STOP_LIMIT } from '../../tools/hooks/before-stop.ts';
import {
  BASELINE_FILE,
  compare,
  countsFromTheCodeFiles,
  ENGINE_SIDE_FOLDERS,
  ESLINT_SUPPRESSIONS_FILE,
  eslintSuppressions,
  KNOWN_ARCHITECTURE_VIOLATIONS_FILE,
  measure,
  readBaseline,
  theCodeFiles,
  unitNameChecksInEngine,
} from '../../tools/ratchet.ts';
import { LEVELS } from '../suite.ts';
import { ALLOWANCE_MS, timeLimitForPropertyRuns, timeLimitForTheWork } from '../lib/time-limits.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>;
  engines?: { node?: string };
  packageManager?: string;
  devDependencies?: Record<string, string>;
};

describe('the compiler', () => {
  const file = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), (f) => ts.sys.readFile(f));
  const parsed = ts.parseJsonConfigFileContent(file.config, ts.sys, ROOT);
  const o = parsed.options;

  test('every strict flag is on, and none of strict is switched back off', () => {
    expect(parsed.errors).toEqual([]);
    for (const flag of [
      'strict',
      'noUncheckedIndexedAccess',
      'exactOptionalPropertyTypes',
      'noFallthroughCasesInSwitch',
      'noImplicitOverride',
      'noPropertyAccessFromIndexSignature',
    ]) {
      expect(o[flag], flag).toBe(true);
    }
    for (const flag of [
      'noImplicitAny',
      'noImplicitThis',
      'strictNullChecks',
      'strictFunctionTypes',
      'strictBindCallApply',
      'strictPropertyInitialization',
      'useUnknownInCatchVariables',
      'alwaysStrict',
    ]) {
      expect(o[flag], flag).not.toBe(false);
    }
  });

  test("it checks the tests, the tools and the site, with the browser's types", () => {
    const files = parsed.fileNames.map((f) => path.relative(ROOT, f));
    for (const f of [
      'tests/static/harness.test.ts',
      'tests/legacy.test.ts',
      'tools/check.ts',
      'tools/hooks/after-edit.ts',
      // the architecture rules' configs (P1-13a)
      '.dependency-cruiser.mts',
      'knip.ts',
      // the site (P1-09e): every file of src/, and the globals its modules read without importing
      'src/engine/run-turn.ts',
      'src/content/kingdoms-call-data.ts',
      'src/ui/gm/page.ts',
      'src/globals.d.ts',
    ]) {
      expect(files, f).toContain(f);
    }
    expect(files.filter((f) => f.startsWith('src/')).length).toBe(
      filesUnder(path.join(ROOT, 'src')).filter((f) => f.endsWith('.ts')).length,
    );
    expect(o.lib).toEqual(expect.arrayContaining(['lib.es2024.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts']));
  });

  // P1-09e: a file of src/ that TypeScript doesn't check says why in its first line (Decision 15); the ratchet counts
  // them, the engine's side and the UI's apart (tsNocheckEngineSide and tsNocheckUi, P1-10b1), so they only fall.
  test('a file of src/ that TypeScript skips says why, in its first line', () => {
    const without = filesUnder(path.join(ROOT, 'src'))
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => {
        const text = read('src/' + f);
        const at = text.search(new RegExp('@ts-' + 'nocheck'));
        return at >= 0 && !new RegExp('^// @ts-' + 'nocheck: \\S.{10,}').test(text);
      });
    expect(without).toEqual([]);
  });
});

describe('the lint rules', () => {
  const eslint = new ESLint({ cwd: ROOT });
  const level = (v: Linter.RuleEntry | undefined): number => {
    const s = Array.isArray(v) ? v[0] : v;
    return s === 'error' || s === 2 ? 2 : s === 'warn' || s === 1 ? 1 : 0;
  };
  // What the shared configs ask for, each rule at error (no rule is at warn: plan P1-13, Decision 13): ESLint's
  // recommended rules, then typescript-eslint's strictest type-checked set and its stylistic type-checked set. Only
  // eslint-config-prettier may switch one off (formatting is Prettier's), and the one rule the two type-aware sets
  // disagree on (Decision 6): non-nullable-type-assertion-style asks for `x!`, which no-non-null-assertion forbids.
  const setsOf = (configs: Linter.Config[]): Partial<Linter.RulesRecord> => {
    const rules: Partial<Linter.RulesRecord> = {};
    for (const c of configs) Object.assign(rules, c.rules);
    return rules;
  };
  const TYPED = [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked] as Linter.Config[];
  const SITE = [js.configs.recommended, ...tseslint.configs.strict] as Linter.Config[];
  const expected = setsOf([js.configs.recommended, ...TYPED]);
  const typedExpected = setsOf(TYPED);
  const siteExpected = setsOf(SITE);
  const DISAGREE = '@typescript-eslint/non-nullable-type-assertion-style';
  const formatting = new Set(Object.keys(prettier.rules));
  // The rules of a set that a file's config doesn't hold at error (a rule the set itself switches off left out).
  const notAtError = (set: Partial<Linter.RulesRecord>, rules: Partial<Linter.RulesRecord>): string[] =>
    Object.entries(set)
      .filter(([rule, v]) => !formatting.has(rule) && level(v) > 0 && level(rules[rule]) < 2)
      .map(([rule]) => rule);

  test.for([
    'tests/static/harness.test.ts',
    'tools/check.ts',
    'vitest.config.mts',
    'playwright.config.ts',
    '.dependency-cruiser.mts',
    'knip.ts',
    'tests/browser/x.spec.ts',
    'tests/browser/third-party-requests.spec.ts',
    'tools/module-map.ts',
  ])(
    '%s gets the strict and stylistic type-aware rules, each an error, only the one they disagree on off',
    async (file) => {
      expect(await eslint.isPathIgnored(path.join(ROOT, file))).toBe(false);
      const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config).rules ?? {};
      expect(notAtError(expected, rules)).toEqual([DISAGREE]);
      expect(level(rules[DISAGREE])).toBe(0);
      expect(level(rules['@typescript-eslint/no-non-null-assertion'])).toBe(2);
      expect(level(rules['@typescript-eslint/switch-exhaustiveness-check'])).toBe(2);
    },
  );

  // The site's modules get no-undef (plan P1-08a for the engine; P1-09d for all of src/): a file that reads a name it
  // neither imports nor declares (a helper lifted out of resolveTurn that still reads its closure, a missing import)
  // is an error, not a ReferenceError the day it first runs. The engine may read no page's or browser's name.
  const ENGINE_FILES = ['src/engine/run-turn.ts', 'src/engine/turn/context.ts', 'src/views/turn-report.ts'];
  const PAGE_FILES = ['src/ui/gm/turn-shell.ts', 'src/ui/player/map.ts', 'src/db/telemetry.ts'];
  test.for([...ENGINE_FILES, ...PAGE_FILES])('%s gets no-undef, as a module', async (file) => {
    expect(await eslint.isPathIgnored(path.join(ROOT, file))).toBe(false);
    const config = (await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config;
    expect(level(config.rules?.['no-undef'])).toBe(2);
    const options = (config.languageOptions ?? {}) as { sourceType?: string; globals?: Record<string, unknown> };
    expect(options.sourceType).toBe('module');
    const globals = options.globals ?? {};
    const known = (name: string) => name in globals && globals[name] !== 'off';
    const pagesOwn = ['window', 'document', 'KC_CONFIG', 'supabase', 'currentGame', 'currentReport'];
    expect(pagesOwn.filter(known)).toEqual(ENGINE_FILES.includes(file) ? [] : pagesOwn);
  });

  // The site's own tier (plan P1-09, Decision 15, P1-09e; P1-13b): ESLint's recommended rules and typescript-eslint's
  // strict set, each an error (what they found when they came in is in ESLint's suppressions), no-undef and
  // ban-ts-comment errors (a file left unchecked only with its reason), no type assertion and no non-null assertion
  // (P1-10a1, plan P1-10 Decision 2: claims the compiler takes on trust). A file TypeScript checks (its first line
  // doesn't switch the check off) gets the type-aware sets too, each an error, the one they disagree on off (plan
  // P1-13, Decisions 5 and 6); a file it skips gets no type-aware rule (no project service: with everything any, they
  // would only find that). Every file of src/ is read, so a file freed from the switch-off gets them with no list kept.
  const NO_ASSERTIONS = '@typescript-eslint/consistent-type-assertions';
  const NO_NON_NULL = '@typescript-eslint/no-non-null-assertion';
  const typeChecked = (file: string) => !new RegExp('^// @ts-' + 'nocheck\\b').test(read(file));
  const srcFiles = filesUnder(path.join(ROOT, 'src'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => 'src/' + f);
  test('src/ has files of both kinds: TypeScript checks some and skips others', () => {
    for (const f of [
      'src/engine/clock.ts',
      'src/schemas/saved-game-state.ts',
      'src/globals.d.ts',
      'src/ui/gm/start.ts',
    ])
      expect(typeChecked(f), f).toBe(true);
    // until P1-10b and P1-16 free the last of them
    expect(srcFiles.filter((f) => !typeChecked(f)).length).toBeGreaterThan(0);
  });
  // A planted finding of a type-aware rule (a `||` that should be `??`: it needs the value's type) is an error in a file
  // TypeScript checks, and isn't looked for in one it skips. ESLint builds the checked file's program first: over 4 s
  // on CI.
  test.for([
    ['src/engine/clock.ts', true],
    ['src/engine/turn/context.ts', false],
  ] as const)(
    '%s: a planted type-aware finding is an error: %s',
    timeLimitForTheWork({ typeScriptPrograms: 1 }),
    async ([file, isError]) => {
      expect(typeChecked(file)).toBe(isError);
      const code = read(file) + '\nexport const planted = (x: string | undefined) => x || "a";\n';
      const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
      const found = (result?.messages ?? []).filter((m) => m.ruleId === '@typescript-eslint/prefer-nullish-coalescing');
      expect(found.map((m) => m.severity)).toEqual(isError ? [2] : []);
    },
  );
  test(
    "every file of src/ gets the site's rules, each an error, and the type-aware ones exactly when TypeScript checks it",
    timeLimitForTheWork({ toolRuns: 1 }),
    async () => {
      const wrong: string[] = [];
      for (const file of srcFiles) {
        expect(await eslint.isPathIgnored(path.join(ROOT, file)), file).toBe(false);
        const config = (await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config;
        const rules = config.rules ?? {};
        const checked = typeChecked(file);
        // globals.d.ts may write `declare var` (TypeScript's form for a global: eslint.config.js)
        const allowedOff = [...(file === 'src/globals.d.ts' ? ['no-var'] : []), ...(checked ? [DISAGREE] : [])];
        const off = notAtError({ ...siteExpected, ...(checked ? typedExpected : {}) }, rules);
        if (off.join() !== allowedOff.join()) wrong.push(`${file}: not errors: ${off.join(', ')}`);
        if (level(rules['no-undef']) !== 2) wrong.push(`${file}: no-undef`);
        const ban = rules['@typescript-eslint/ban-ts-comment'];
        if (
          level(ban) !== 2 ||
          JSON.stringify(Array.isArray(ban) ? ban[1] : undefined) !== '{"ts-nocheck":"allow-with-description"}'
        )
          wrong.push(`${file}: ban-ts-comment`);
        if (level(rules[NO_NON_NULL]) !== 2) wrong.push(`${file}: ${NO_NON_NULL}`);
        // no type assertion at all, in every file (P1-10b1 replaced the three let through with statements)
        const assertions = rules[NO_ASSERTIONS];
        if (
          level(assertions) !== 2 ||
          JSON.stringify(Array.isArray(assertions) ? assertions[1] : undefined) !== '{"assertionStyle":"never"}'
        )
          wrong.push(`${file}: ${NO_ASSERTIONS}`);
        const parserOptions = (config.languageOptions as { parserOptions?: Record<string, unknown> } | undefined)
          ?.parserOptions;
        const typeAware = (parserOptions?.['projectService'] ?? parserOptions?.['project'] ?? null) !== null;
        if (typeAware !== checked) wrong.push(`${file}: type-aware ${String(typeAware)}`);
        // a file TypeScript skips gets no rule of the type-aware sets but the site's own (its four, above)
        const typedOnly = Object.keys(typedExpected).filter(
          (r) => !(r in siteExpected) && r !== NO_ASSERTIONS && level(typedExpected[r]) > 0,
        );
        if (!checked && typedOnly.some((r) => level(rules[r]) > 0))
          wrong.push(`${file}: a type-aware set's rule is on`);
      }
      expect(wrong).toEqual([]);
    },
  );

  // A type assertion or a non-null assertion planted in an engine file and in a page's: each an error (P1-10a1). `as
  // const` is no claim (it narrows a literal), so it stays. (Not src/ui/player/map.ts, whose reviewed exception to the
  // HTML rule would match nothing in the planted text.)
  test.for(['src/engine/turn/context.ts', 'src/ui/player/report.ts'])(
    '%s: a planted `as` and `!` are errors, `as const` is not',
    async (file) => {
      const code = [
        'export const n = (x: unknown) => x as number;',
        'export const m = (x: number | undefined) => x!;',
        "export const k = ['a'] as const;",
        '',
      ].join('\n');
      const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
      const errors = (result?.messages ?? [])
        .filter((m) => m.severity === 2)
        .map((m) => `${String(m.line)} ${m.ruleId ?? ''}`);
      expect(errors).toEqual([`1 ${NO_ASSERTIONS}`, `2 ${NO_NON_NULL}`]);
    },
  );

  // The engine's purity (plan P1-13, Decision 7): src/engine/, src/views/, src/content/, src/shared/ and src/schemas/
  // may read none of these names, each refused by no-restricted-globals, but in the three reviewed exceptions, each one
  // name of one file; the rest of src/ but src/db/ may not read supabase (the client's global: only src/db/ talks to
  // the database, P1-17); src/db/ is free of it. Read from every file of src/, so a new folder or file can't slip by.
  const PURE_FOLDERS = /^src\/(engine|views|content|shared|schemas)\//;
  const NOT_IN_THE_ENGINE = [
    'window',
    'document',
    'localStorage',
    'sessionStorage',
    'fetch',
    'navigator',
    'location',
    'crypto',
    'setTimeout',
    'setInterval',
    'globalThis',
    'Date',
    'supabase',
    'sb',
  ];
  const PURITY_EXCEPTIONS: Record<string, string> = {
    'src/engine/bots/economy.ts': 'window',
    'src/engine/rng.ts': 'crypto',
    'src/engine/clock.ts': 'Date',
  };
  const restrictedNames = (entry: Linter.RuleEntry | undefined): string[] =>
    level(entry) === 2 && Array.isArray(entry)
      ? entry.slice(1).map((o) => (typeof o === 'string' ? o : (o as { name: string }).name))
      : [];
  test(
    'the engine reads no page, browser, timer, clock or database name, but the three reviewed exceptions',
    timeLimitForTheWork({ toolRuns: 1 }),
    async () => {
      const wrong: string[] = [];
      for (const file of srcFiles) {
        const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config).rules ?? {};
        const names = restrictedNames(rules['no-restricted-globals']);
        const except = PURITY_EXCEPTIONS[file];
        const expected = PURE_FOLDERS.test(file)
          ? NOT_IN_THE_ENGINE.filter((n) => n !== except)
          : file.startsWith('src/db/')
            ? []
            : ['supabase'];
        if (names.join() !== expected.join()) wrong.push(`${file}: ${names.join(', ')}`);
      }
      expect(wrong).toEqual([]);
      for (const file of Object.keys(PURITY_EXCEPTIONS)) expect(srcFiles, file).toContain(file);
    },
  );

  // The dice come from kcRng() (P1-07; plan P1-13, Decision 7): Math.random, refused in every file of src/ but
  // src/engine/rng.ts and in the classic scripts (public/'s two; the templates' are
  // the-templates-scripts-pass-the-sites-lint-rules.test.ts's), through Math or through any object's Math. And the
  // project's own rules (tools/eslint-rules/) on the same files, each an error.
  const KC_RULES = [
    'kc/big-tables-and-profiles-are-read-by-named-columns',
    'kc/html-is-built-only-through-kc-html',
    'kc/no-random-or-argument-less-sort-comparator',
  ];
  test(
    "Math.random is refused everywhere but rng.ts, and the project's own rules run on src/ and public/",
    timeLimitForTheWork({ toolRuns: 1 }),
    async () => {
      const publicScripts = fs
        .readdirSync(path.join(ROOT, 'public'))
        .filter((f) => f.endsWith('.js'))
        .map((f) => 'public/' + f);
      expect(publicScripts).toEqual(['public/kc-config.js', 'public/kc-staging-footer.js']);
      const wrong: string[] = [];
      for (const file of [...srcFiles, ...publicScripts]) {
        expect(await eslint.isPathIgnored(path.join(ROOT, file)), file).toBe(false);
        const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config).rules ?? {};
        const dice = file !== 'src/engine/rng.ts';
        if ((level(rules['no-restricted-properties']) === 2) !== dice) wrong.push(`${file}: no-restricted-properties`);
        if ((level(rules['no-restricted-syntax']) === 2) !== dice) wrong.push(`${file}: no-restricted-syntax`);
        for (const rule of KC_RULES) if (level(rules[rule]) !== 2) wrong.push(`${file}: ${rule}`);
      }
      expect(wrong).toEqual([]);
      expect(await eslint.isPathIgnored(path.join(ROOT, 'public/vendor/supabase-js-2.117.3.min.js'))).toBe(true);
    },
  );

  // kc/narrative-lines-go-through-emit (plan P1-12, Decision 6): every line of the turn enters the GM's log through
  // emit, in the events file. It runs, in full and with no options, on every file of the engine and the views but the
  // events file (since P1-12a4; before, only in the folders P1-12a's rows had converted), and nowhere else. A planted
  // line of each kind is refused exactly there.
  const EVENTS_FILE = 'src/engine/turn/events-and-their-audiences.ts';
  test(
    'the rule that lines go through emit runs, in full, in all of the engine and the views but the events file',
    timeLimitForTheWork({ toolRuns: 1 }),
    async () => {
      const wrong: string[] = [];
      for (const file of srcFiles) {
        const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config).rules ?? {};
        const entry = rules['kc/narrative-lines-go-through-emit'];
        const options: unknown[] = Array.isArray(entry) ? entry.slice(1) : [];
        const runs = /^src\/(engine|views)\//.test(file) && file !== EVENTS_FILE;
        const expected = runs ? 'in full' : 'off';
        const found =
          level(entry) !== 2 ? 'off' : options.length ? `with options ${JSON.stringify(options)}` : 'in full';
        if (found !== expected) wrong.push(`${file}: ${found}, not ${expected}`);
      }
      expect(wrong).toEqual([]);
      const planted = [
        'export function planted(turnContext: any, narrative: any, log: any) {',
        '  turnContext.turnLog.push(1);',
        "  log('system', 'a line');",
        "  narrative.push('a line');",
        "  emit(turnContext, { type: 'system', text: 'a line', audience: {} });",
        "  return { text: 'a line', onlyPlayer: 1 };",
        '}',
      ].join('\n');
      const refused = async (file: string) => {
        const [result] = await eslint.lintText(planted, { filePath: path.join(ROOT, file) });
        return (result?.messages ?? [])
          .filter((m) => m.ruleId === 'kc/narrative-lines-go-through-emit')
          .map((m) => m.line);
      };
      expect(await refused('src/engine/turn/planted-here.ts')).toEqual([2, 3, 4, 5, 6]);
      expect(await refused('src/views/planted-here.ts')).toEqual([2, 3, 4, 5, 6]);
      expect(await refused('src/engine/battle/planted-here.ts')).toEqual([2, 3, 4, 5, 6]);
      expect(await refused('src/engine/personal-combat/planted-here.ts')).toEqual([2, 3, 4, 5, 6]);
      expect(await refused('src/engine/orders/planted-here.ts')).toEqual([2, 3, 4, 5, 6]);
      expect(await refused('src/engine/heroes/planted-here.ts')).toEqual([2, 3, 4, 5, 6]);
      expect(await refused('src/engine/planted-here.ts')).toEqual([2, 3, 4, 5, 6]);
      expect(await refused(EVENTS_FILE)).toEqual([]);
      expect(await refused('src/ui/gm/planted-here.ts')).toEqual([]);
    },
  );

  // kc/html-is-built-only-through-kc-html's reviewed exceptions (eslint.config.js's HTML_EXCEPTIONS; plan P1-13,
  // Decision 8): the rule refuses one that matches nothing in its file, but only as it lints that file, so each must
  // name a file of src/ or public/ that ESLint lints, with its reason.
  test('each reviewed exception to the HTML rule names a file ESLint lints, with its reason', async () => {
    const config = (await eslint.calculateConfigForFile(path.join(ROOT, 'src/ui/gm/start.ts'))) as Linter.Config;
    const [, options] = z
      .tuple([
        z.literal(2),
        z.object({ exceptions: z.array(z.object({ file: z.string(), reason: z.string().min(1) }).loose()) }),
      ])
      .parse(config.rules?.['kc/html-is-built-only-through-kc-html']);
    expect(options.exceptions.length).toBeGreaterThan(0);
    for (const { file } of options.exceptions) {
      expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
      expect(await eslint.isPathIgnored(path.join(ROOT, file)), file).toBe(false);
      expect(/^(src|public)\//.test(file), file).toBe(true);
    }
  });

  // dice-and-clock's cases (the static test these rules replaced), planted as code ESLint lints in place: each red one
  // is still found, at its line, and the quiet ones (comments, strings, a property named Date, the dice and the clock
  // themselves) are not.
  const RESTRICTED = new Set(['no-restricted-globals', 'no-restricted-properties', 'no-restricted-syntax']);
  const restrictedFindings = async (file: string, code: string): Promise<string[]> => {
    const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
    return (result?.messages ?? [])
      .filter((m) => m.severity === 2 && RESTRICTED.has(m.ruleId ?? ''))
      .map((m) => `${String(m.line)} ${m.ruleId ?? ''}`);
  };
  test.for([
    ['src/engine/x.ts', 'export function f() {\n  return Math.random();\n}\n', ['2 no-restricted-properties']],
    ['src/engine/x.ts', 'export const t =\n  new Date().toISOString();\n', ['2 no-restricted-globals']],
    ['src/views/x.ts', 'export const id = `m_${String(Date.now())}`;\n', ['1 no-restricted-globals']],
    [
      'src/engine/x.ts',
      "export const r = Math['random'];\nexport const g = window.Math.random;\n",
      ['1 no-restricted-properties', '2 no-restricted-globals', '2 no-restricted-syntax'],
    ],
    [
      'src/ui/gm/x.ts',
      "export const g = window.Math.random;\nexport const h = globalThis.Math['random'];\n",
      ['1 no-restricted-syntax', '2 no-restricted-syntax'],
    ],
    [
      'src/engine/x.ts',
      'export const shuffle = (a: unknown[], rnd = Math.random) => [a, rnd];\n',
      ['1 no-restricted-properties'],
    ],
    [
      'src/ui/gm/x.ts',
      'export const tab = Math.random();\nexport const t = new Date();\n',
      ['1 no-restricted-properties'],
    ],
    ['public/x.js', 'var tab = Math.random();\n', ['1 no-restricted-properties']],
    [
      'src/engine/x.ts',
      [
        '// dice = Math.random()*range, read at new Date()',
        '/* Math.random */',
        "export const s = 'Math.random and Date';",
        'export const o = { Date: 1 };',
        'export const d = o.Date;',
        'export const r = kcRng(), t = kcClock();',
        '',
      ].join('\n'),
      [],
    ],
    ['src/engine/rng.ts', 'export const r = Math.random();\n', []],
    ['src/engine/clock.ts', 'export const t = Date.now();\n', []],
  ] as const)(
    '%s: planted %j finds %j',
    timeLimitForTheWork({ typeScriptPrograms: 1 }),
    async ([file, code, expected]) => {
      expect(await restrictedFindings(file, code)).toEqual(expected);
    },
  );
  test('a Math.random() and a new Date() planted in the real run-turn.ts are found', async () => {
    const file = 'src/engine/run-turn.ts';
    const real = read(file);
    const before = await restrictedFindings(file, real);
    const planted = await restrictedFindings(file, real + '\nexport const _x = Math.random(), _t = new Date();\n');
    const line = String(real.split('\n').length + 1);
    expect(before).toEqual([]);
    expect(planted).toEqual([`${line} no-restricted-properties`, `${line} no-restricted-globals`]);
  });
  // Each name the engine may not read, planted in an engine file: refused. In each exception's own file its one name
  // passes and another is still refused (the test above pins each file's whole list).
  test.for(NOT_IN_THE_ENGINE)('typeof %s planted in the engine is refused', async (name) => {
    expect(await restrictedFindings('src/engine/x.ts', `export const planted = typeof ${name};\n`)).toEqual([
      '1 no-restricted-globals',
    ]);
  });
  // Two of the three are files TypeScript checks, so ESLint builds their program first: up to several seconds on CI.
  test.for(Object.entries(PURITY_EXCEPTIONS))(
    '%s may read %s, and nothing else the engine may not',
    timeLimitForTheWork({ typeScriptPrograms: 2 }),
    async ([file, except]) => {
      expect(await restrictedFindings(file, `export const planted = typeof ${except};\n`)).toEqual([]);
      expect(await restrictedFindings(file, 'export const planted = typeof document;\n')).toEqual([
        '1 no-restricted-globals',
      ]);
    },
  );

  // The three type assertions src/ held when the rule came in (P1-11a3 wrote them; eslint.config.js let them through by
  // a list, TYPE_ASSERTIONS_KEPT) are statements since P1-10b1, and the list is gone: an `as` planted in any of their
  // files is refused, as everywhere in src/ (the test above holds the rule at error in every file). ESLint builds each
  // file's program first.
  test('no list of files lets a type assertion through', () => {
    expect(read('eslint.config.js')).not.toMatch(/TYPE_ASSERTIONS_KEPT/);
  });
  test.for([
    'src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts',
    'src/engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts',
    'src/engine/rules-on-plain-values/unit-types-and-base-strength.ts',
  ])('%s: a planted type assertion is refused', timeLimitForTheWork({ typeScriptPrograms: 1 }), async (file) => {
    const code = read(file) + '\nexport const planted = (x: unknown) => x as string;\n';
    const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
    const found = (result?.messages ?? []).filter((m) => m.ruleId === NO_ASSERTIONS);
    expect(found.map((m) => `${String(m.line)} ${String(m.severity)}`)).toEqual([
      `${String(code.split('\n').length - 1)} 2`,
    ]);
  });

  test('a focused or skipped test is an error', async () => {
    const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, 'tests/static/x.test.ts'))) as Linter.Config)
      .rules;
    expect(level(rules?.['vitest/no-focused-tests'])).toBe(2);
    expect(level(rules?.['vitest/no-disabled-tests'])).toBe(2);
  });

  // A test's time limit (tests/lib/time-limits.ts) can't be loosened into a retry or a repeat: one written in a test's
  // options, a describe's, a helper's or a spec's, by name or by assignment, is an error in every test file; a limit
  // alone and the setup file that reads a test's retry to fail it are not. ESLint builds the tests' program first.
  const retryFindings = async (file: string, code: string): Promise<string[]> => {
    const real = read(file);
    const line = real.split('\n').length;
    const [result] = await eslint.lintText(`${real}\n${code}\n`, { filePath: path.join(ROOT, file) });
    return (result?.messages ?? [])
      .filter((m) => m.severity === 2 && m.ruleId === 'no-restricted-syntax')
      .map((m) => `${m.line === line + 1 ? 'the planted line' : String(m.line)}: ${m.message.split(':')[0] ?? ''}`);
  };
  const REFUSED = ['the planted line: A test passes the first time or fails'];
  test.for([
    ['tests/unit/combat-properties.test.ts', "test('planted', { ...LIMIT, retry: 2 }, () => undefined);", REFUSED],
    ['tests/unit/combat-properties.test.ts', "test('planted', { repeats: 3 }, () => undefined);", REFUSED],
    ['tests/unit/combat-properties.test.ts', "describe('planted', { 'retry': 1 }, () => undefined);", REFUSED],
    [
      'tests/lib/time-limits.ts',
      'export const planted = () => ({ ...timeLimitForTheWork({ siteBuilds: 1 }), retry: 3 });',
      REFUSED,
    ],
    ['tests/lib/time-limits.ts', 'export const planted = (o: { retry?: number }) => (o.retry = 3);', REFUSED],
    ['tests/browser/dispatches-badge.spec.ts', 'test.describe.configure({ retries: 2 });', REFUSED],
    [
      'tests/unit/combat-properties.test.ts',
      "test('planted', timeLimitForPropertyRuns(RUNS, 2.5), () => undefined);",
      [],
    ],
    ['tests/setup/each.ts', '', []],
  ] as const)(
    '%s: planted %j finds %j',
    timeLimitForTheWork({ typeScriptPrograms: 1 }),
    async ([file, code, expected]) => {
      expect(await retryFindings(file, code)).toEqual(expected);
    },
  );

  // Playwright's recommended rules at full strength in every spec, and a focused or skipped spec, or a fixed wait, an
  // error. One spec may wait for the network to go quiet: that is its check (eslint.config.js).
  test.for([
    ['tests/browser/x.spec.ts', []],
    ['tests/browser/third-party-requests.spec.ts', ['playwright/no-networkidle']],
  ] as const)('%s: a focused or skipped spec, or a fixed wait, is an error', async ([file, allowedOff]) => {
    const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config).rules ?? {};
    for (const rule of ['playwright/no-focused-test', 'playwright/no-skipped-test', 'playwright/no-wait-for-timeout']) {
      expect(level(rules[rule]), rule).toBe(2);
    }
    const weaker = Object.entries(playwright.configs['flat/recommended'].rules ?? {})
      .filter(([rule, v]) => level(rules[rule]) < level(v))
      .map(([rule]) => rule);
    expect(weaker).toEqual(allowedOff);
    // and each at error, as every rule is (below)
    expect(notAtError(playwright.configs['flat/recommended'].rules ?? {}, rules)).toEqual(allowedOff);
  });

  // No rule is at warn (plan P1-13, Decision 13): a warning passes the lint run, so every finding is an error, held
  // only in ESLint's suppressions. Read from every file ESLint lints.
  test('no rule is at warn, in any file ESLint lints', timeLimitForTheWork({ toolRuns: 1 }), async () => {
    const linted = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT })
      .toString()
      .split('\0')
      .filter((f) => (/\.(ts|mts)$/.test(f) || /^public\/[^/]+\.js$/.test(f)) && fs.existsSync(path.join(ROOT, f)));
    expect(linted.length).toBeGreaterThan(300);
    const warned: string[] = [];
    for (const file of linted) {
      if (await eslint.isPathIgnored(path.join(ROOT, file))) continue;
      const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config).rules ?? {};
      for (const [rule, v] of Object.entries(rules)) if (level(v) === 1) warned.push(`${file}: ${rule}`);
    }
    expect(warned).toEqual([]);
  });
});

// ESLint's bulk suppressions (plan P1-13, Decisions 4 and 13): what the rules found when they came in, per file and
// rule with a count, in the file ESLint's command line reads by default (npm run lint, npm run check, the edit hook)
// and the ratchet counts (eslintSuppressions). Shown here on the smallest file the list names, with the list written
// to a temporary file: a finding the list doesn't hold fails (exit 1), as a new one would; a list that holds more than
// the file has fails too (exit 2), as a fixed finding left in it would, until `npx eslint --prune-suppressions`.
describe("ESLint's suppressions", () => {
  const list = JSON.parse(read(ESLINT_SUPPRESSIONS_FILE)) as Record<string, Record<string, { count: number }>>;

  test('the list is the one ESLint reads by default, and the ratchet counts it', () => {
    expect(ESLINT_SUPPRESSIONS_FILE).toBe('eslint-suppressions.json');
    expect(pkg.scripts['lint']).toBe('eslint .');
    const sum = Object.values(list)
      .flatMap((rules) => Object.values(rules))
      .reduce((n, e) => n + e.count, 0);
    expect(eslintSuppressions()).toBe(sum);
    expect(readBaseline()['eslintSuppressions']).toBeDefined();
    // Nothing lints with another list, writes to it, or lets a stale entry through.
    const weak = /--suppress|--prune-suppressions|--pass-on-unpruned-suppressions/;
    for (const f of ['package.json', 'tools/check.ts', 'tools/hooks/after-edit.ts', '.github/workflows/ci.yml'])
      expect(read(f), f).not.toMatch(weak);
  });

  test(
    'a finding the list lacks fails, and so does an entry the file no longer holds',
    timeLimitForTheWork({ toolRuns: 3 }),
    async () => {
      const [file = ''] = Object.keys(list).sort(
        (a, b) => fs.statSync(path.join(ROOT, a)).size - fs.statSync(path.join(ROOT, b)).size || a.localeCompare(b),
      );
      const own = list[file] ?? {};
      const [rule = ''] = Object.keys(own);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-suppressions-'));
      const exitOf = (name: string, suppressions: unknown) =>
        new Promise<number>((resolve) => {
          const at = path.join(dir, name);
          fs.writeFileSync(at, JSON.stringify(suppressions));
          const bin = path.join(ROOT, 'node_modules', '.bin', 'eslint');
          execFile(bin, ['--suppressions-location', at, file], { cwd: ROOT }, (e) => {
            resolve(e ? Number((e as { code?: unknown }).code) : 0);
          });
        });
      const withoutRule = Object.fromEntries(Object.entries(own).filter(([r]) => r !== rule));
      const [asListed, findingNotListed, oneMoreThanHeld] = await Promise.all([
        exitOf('as-listed.json', { [file]: own }),
        exitOf('finding-not-listed.json', { [file]: withoutRule }),
        exitOf('one-more.json', { [file]: { ...own, [rule]: { count: (own[rule]?.count ?? 0) + 1 } } }),
      ]);
      fs.rmSync(dir, { recursive: true, force: true });
      expect({ file, rule, asListed, findingNotListed, oneMoreThanHeld }).toEqual({
        file,
        rule,
        asListed: 0,
        findingNotListed: 1,
        oneMoreThanHeld: 2,
      });
    },
  );
});

describe('the test run', () => {
  const t = config.test ?? {};

  test('no retries, no .only, and the run checks itself', () => {
    expect(t.retry).toBe(0);
    expect(t.allowOnly).toBe(false);
    expect(t.setupFiles).toContain('tests/setup/each.ts');
    expect(t.globalSetup).toContain('tests/setup/global.ts');
    expect(t.reporters).toContain('./tests/setup/reporter.ts');
    expect(t.env).toMatchObject({ TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
    for (const flag of ['--retry', '--allowOnly', '--allow-only', '--bail']) {
      expect(pkg.scripts['test'], flag).not.toContain(flag);
    }
  });

  test('no project changes those settings', () => {
    for (const p of t.projects ?? []) {
      expect(typeof p).toBe('object');
      const keys = typeof p === 'object' && 'test' in p ? Object.keys(p.test ?? {}) : [];
      expect(keys.filter((k) => !['name', 'include', 'provide'].includes(k))).toEqual([]);
    }
  });

  // Read here, in a test file, after the setup files ran: what every property test gets.
  test("fast-check's seed is KC_SEED's in every test file, so a property's inputs repeat", () => {
    expect(t.setupFiles).toContain('tests/setup/fast-check.ts');
    expect(fc.readConfigureGlobal().seed).toBe(Number(process.env['KC_SEED']) >>> 0 || 1);
    for (const script of ['test', 'test:full']) expect(pkg.scripts[script], script).not.toMatch(/--(retry|repeat)/);
  });

  // P1-05: site/ is build output. Both runners build it from src/ before any test (unless KC_SITE names another copy),
  // so no test opens stale pages.
  test('both runners build site/ from src/ first', () => {
    expect(pkg.scripts['build']).toMatch(/^node (--disable-warning=\S+ )?tools\/build\.ts$/);
    const global = read('tests/setup/global.ts');
    expect(global).toContain("execFileSync('npm', ['run', '--silent', 'build']");
    expect(global).toContain("if (!process.env['KC_SITE'])");
    expect(read('.gitignore')).toMatch(/^\/site\/$/m);
    expect(execFileSync('git', ['ls-files', 'site'], { cwd: ROOT, encoding: 'utf8' }), 'site/ is in git').toBe('');
  });

  test('a test fails on a retry or repeat, on console.error and on an unhandled rejection', () => {
    const each = read('tests/setup/each.ts');
    for (const piece of [
      'task.retry',
      'task.repeats',
      'console.error = ',
      "process.on('unhandledRejection'",
      'afterEach(',
    ]) {
      expect(each, piece).toContain(piece);
    }
  });

  // A test that builds the site, builds a TypeScript program, runs a tool or reads every file of src/ gets a time limit
  // sized to that work, and a property test one sized to its run count (tests/lib/time-limits.ts): only a limit, the
  // sum of the work's allowances. The static tests take every limit from it, none typed in as a number.
  test("a test's time limit is sized to its work, and is only a limit", () => {
    const three = timeLimitForTheWork({ siteBuilds: 3 });
    expect(Object.keys(three)).toEqual(['timeout']);
    expect(three.timeout).toBe(3 * ALLOWANCE_MS.siteBuilds);
    expect(timeLimitForTheWork({ toolRuns: 2, everyFileReads: 1 }).timeout).toBe(
      2 * ALLOWANCE_MS.toolRuns + ALLOWANCE_MS.everyFileReads,
    );
    expect(() => timeLimitForTheWork({})).toThrow(/names the work/);
    // npm test's 2,000 runs keep Vitest's 5 s; KC_FULL's ten times the runs get ten times the time
    expect(timeLimitForPropertyRuns(2_000, 2.5).timeout).toBe(5_000);
    expect(timeLimitForPropertyRuns(20_000, 2.5).timeout).toBe(50_000);
    expect(Object.keys(timeLimitForPropertyRuns(100, 50))).toEqual(['timeout']);
    const typedIn = /\btimeout\s*:|\},\s*[\d_]+\s*\)/;
    for (const f of fs.readdirSync(path.join(ROOT, 'tests', 'static')))
      expect(read(`tests/static/${f}`), f).not.toMatch(typedIn);
    for (const f of ['tests/unit/combat-properties.test.ts', 'tests/unit/realm-reports.test.ts'])
      expect(read(f), f).toMatch(/timeLimitForPropertyRuns\(RUNS, [\d.]+\)/);
  });
});

describe('the browser specs', () => {
  test('no retries, no .only, the Node pin, a fixed time zone and locale, traces kept on failure', () => {
    expect(pwConfig.retries).toBe(0);
    expect(pwConfig.forbidOnly).toBe(true);
    expect(pwConfig.testDir).toBe('tests/browser');
    expect(pwConfig.globalSetup).toBe('./tests/setup/global.ts');
    expect(pwConfig.use).toMatchObject({ timezoneId: 'UTC', locale: 'en-US', trace: 'retain-on-failure' });
    expect(read('playwright.config.ts')).toContain('Object.assign(process.env, FIXED,');
    // Projects could set their own retries or options: there are none.
    expect(pwConfig.projects).toBeUndefined();
  });

  test('they open the site from site/ or $KC_SITE, never from a server that was already running', () => {
    const ws = pwConfig.webServer;
    expect(Array.isArray(ws)).toBe(false);
    expect(ws && !Array.isArray(ws) ? ws.reuseExistingServer : undefined).toBe(false);
    expect(ws && !Array.isArray(ws) ? ws.command : '').toContain('tests/browser/server.ts');
    expect(read('tests/browser/server.ts')).toContain('serve(SITE, ');
  });
});

describe('the Node pin', () => {
  test('.nvmrc names one exact Node 24 version, and npm and the test run hold to it', () => {
    const pinned = read('.nvmrc').trim();
    expect(pinned).toMatch(/^24\.\d+\.\d+$/);
    expect(pkg.engines?.node).toBe(pinned);
    expect(pkg.packageManager).toMatch(/^npm@\d+\.\d+\.\d+$/);
    expect(read('.npmrc')).toMatch(/^engine-strict=true$/m);
    const global = read('tests/setup/global.ts');
    expect(global).toContain("'.nvmrc'");
    expect(global).toContain('process.version !== pinned');
  });

  test("Node's types are for the pinned Node, so code can't use what that Node lacks", () => {
    const major = read('.nvmrc').trim().split('.')[0];
    expect(pkg.devDependencies?.['@types/node']).toMatch(new RegExp(`^${major ?? ''}\\.\\d+\\.\\d+$`));
  });

  test('every workflow that sets up Node takes the version from .nvmrc', () => {
    const dir = path.join(ROOT, '.github', 'workflows');
    let found = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.yml'))) {
      const blocks = fs.readFileSync(path.join(dir, f), 'utf8').split('actions/setup-node@').slice(1);
      for (const b of blocks) {
        found++;
        const step = b.split(/\n\s*- /)[0] ?? '';
        expect(step, f).toMatch(/node-version-file: \.nvmrc/);
        expect(step, f).not.toMatch(/node-version:/);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('the Claude Code hooks', () => {
  interface Hook {
    command: string;
  }
  interface Settings {
    disableAllHooks?: boolean;
    permissions?: { deny?: string[] };
    hooks?: Record<string, { matcher?: string; hooks: Hook[] }[]>;
  }
  const settings = JSON.parse(read('.claude/settings.json')) as Settings;
  const commands = (event: string, tool?: string) =>
    (settings.hooks?.[event] ?? [])
      .filter((h) => tool === undefined || new RegExp(`^(?:${h.matcher ?? '.*'})$`).test(tool))
      .flatMap((h) => h.hooks.map((x) => x.command));

  test('after every Edit and Write: the edit check; before stopping: npm run check', () => {
    expect(settings.disableAllHooks).not.toBe(true);
    for (const tool of ['Edit', 'Write']) {
      expect(commands('PostToolUse', tool).join('\n'), tool).toContain('tools/hooks/after-edit.ts');
    }
    expect(commands('Stop').join('\n')).toContain('tools/hooks/before-stop.ts');
    expect(read('tools/hooks/after-edit.ts')).toMatch(/typecheck\(\), lint\(\[rel\]\), format\(\[rel\]\)/);
    expect(read('tools/hooks/before-stop.ts')).toContain('await runCheck()');
  });

  test('agents may not edit the settings that hold the hooks', () => {
    expect(settings.permissions?.deny).toContain('Edit(/.claude/**)');
  });

  test('the stop hook blocks three times in a row, then lets the agent stop; a pass starts the count again', () => {
    expect(STOP_LIMIT).toBe(3);
    let blocked = 0;
    const blocks: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const d = decide(blocked, false);
      blocks.push(d.block);
      blocked = d.blocked;
    }
    expect(blocks).toEqual([true, true, true, false]);
    expect(decide(2, true)).toEqual({ block: false, blocked: 0 });
  });

  test('npm run check runs the type check, lint, format, the import rules, ratchet and every level but page', () => {
    expect(pkg.scripts['check']).toBe('tsx tools/check.ts');
    expect(read('tools/check.ts')).toMatch(/typecheck\(\), lint\(files\), format\(files\), lintArch\(\), ratchet\(\)/);
    expect(read('tools/check.ts')).toContain("await run('npm', ['run', '--silent', 'lint:arch'])");
    expect(read('tools/check.ts')).toContain('await tests(files)');
    expect(CHECK_LEVELS).toEqual(['static', 'unit', 'scenario', 'simulation']);
  });
});

describe('CI', () => {
  // The jobs in ci.yml, read from its text (it keeps one layout: each job's id two spaces in, under "jobs:").
  const ci = read('.github/workflows/ci.yml');
  const jobs = new Map<string, string>();
  for (const block of (ci.split(/^jobs:\n/m)[1] ?? '').split(/^(?= {2}[\w-]+:\n)/m)) {
    const id = /^ {2}([\w-]+):\n/.exec(block)?.[1];
    if (id) jobs.set(id, block);
  }
  const field = (id: string, key: string) => new RegExp(`^ {4}${key}: (.+)$`, 'm').exec(jobs.get(id) ?? '')?.[1];
  const runs = (id: string) => [...(jobs.get(id) ?? '').matchAll(/^ +(?:- )?run: (.+)$/gm)].map((m) => m[1] ?? '');
  const ids = [...jobs.keys()];

  test('the required checks keep their names, ci and db', () => {
    expect(field('ci', 'name')).toBe('ci');
    expect(field('db', 'name')).toBe('db');
  });

  test('the static checks have their own job: type check, lint, the import rules, format, ratchet and the static tests', () => {
    expect(runs('static')).toEqual([
      'npm ci',
      'npm run typecheck',
      'npm run lint',
      'npm run lint:arch',
      'npm run format:check',
      'npm run ratchet',
      'npm run build',
      'npm test -- --project static',
    ]);
  });

  // P1-05: each job that tests builds site/ from src/ before its tests, the balance matrix and the browser specs, so
  // CI never tests anything but this commit's pages.
  test('every job that tests builds the site first', () => {
    const testing = /^(npm test|npx playwright test|npm run balance)/;
    const jobsThatTest = ids.filter((id) => runs(id).some((r) => testing.test(r)));
    expect([...jobsThatTest].sort()).toEqual(['balance', 'browser', 'page', 'simulation', 'static', 'unit-scenario']);
    for (const id of jobsThatTest) {
      const r = runs(id);
      const build = r.indexOf('npm run build');
      expect(build, id).toBeGreaterThan(r.indexOf('npm ci'));
      expect(build, id).toBeLessThan(r.findIndex((x) => testing.test(x)));
    }
  });

  test('every test level runs in exactly one job, and the browser specs in theirs', () => {
    const tests = ids.flatMap((id) => runs(id).filter((r) => r.startsWith('npm test')));
    for (const r of tests) expect(r).toMatch(/^npm test -- --project \w+( --project \w+)*$/);
    const levels = tests.flatMap((r) => [...r.matchAll(/--project (\w+)/g)].map((m) => m[1]));
    expect([...levels].sort()).toEqual([...LEVELS].sort());
    expect(ids.filter((id) => runs(id).includes('npx playwright test'))).toEqual(['browser']);
  });

  test('ci needs every job but db, runs even when one failed, and passes only if all of them passed', () => {
    const needs = /^ {4}needs: \[(.*)\]$/m.exec(jobs.get('ci') ?? '')?.[1]?.split(', ') ?? [];
    expect([...needs].sort()).toEqual(ids.filter((id) => id !== 'ci' && id !== 'db').sort());
    expect(field('ci', 'if')).toBe('always()');
    expect(jobs.get('ci')).toContain(`length == ${String(needs.length)} and all(.[]; .result == "success")`);
  });

  test('pull requests run CI again when a label is added or removed (the refactor-only check)', () => {
    expect(ci).toMatch(/^on:\n {2}pull_request:\n {4}types: \[opened, synchronize, reopened, labeled, unlabeled\]\n/m);
  });

  // One run per pull request (#181 had two on one commit, from `opened` and `labeled`, and `gh pr checks` showed only
  // one): a new event on a pull request cancels its run still going. deploy.yml calls this workflow before it
  // publishes; that run has no pull request, so its group is its own run's id, which no other run shares: it is never
  // cancelled, never queued behind another run and never replaced while it waits. Deploy's own group ("pages") orders
  // the deploys. No job sets a group of its own, which would apply inside Deploy's run too.
  const ONE_RUN_PER_PULL_REQUEST =
    "${{ github.event_name == 'pull_request' && format('ci-pull-request-{0}', github.event.pull_request.number) || format('ci-run-{0}', github.run_id) }}";
  function concurrencyProblems(text: string): string[] {
    const [head = '', body = ''] = text.replace(/^\s*#.*$/gm, '').split(/^jobs:\n/m);
    const problems: string[] = [];
    const block = /^concurrency:\n((?: {2}.+\n)+)/m.exec(head)?.[1];
    if (block === undefined) problems.push('no concurrency group: each event on a pull request starts another run');
    const group = /^ {2}group: (.+)$/m.exec(block ?? '')?.[1];
    if (block !== undefined && group !== ONE_RUN_PER_PULL_REQUEST) {
      problems.push(`the group is not the pull request's number, or a run's own id: ${String(group)}`);
    }
    const cancel = /^ {2}cancel-in-progress: (.+)$/m.exec(block ?? '')?.[1];
    if (block !== undefined && cancel !== "${{ github.event_name == 'pull_request' }}") {
      problems.push(`cancel-in-progress is not for pull requests alone: ${String(cancel)}`);
    }
    if (/^ {4}concurrency:/m.test(body)) problems.push('a job sets a concurrency group of its own');
    return problems;
  }
  test("a pull request has one CI run at a time, and deploy.yml's run is never cancelled", () => {
    expect(concurrencyProblems(ci)).toEqual([]);
    // Planted copies: without the group; cancelling every run (Deploy's too); one group for every run on a branch (two
    // deploys in a row would share it, and the second would replace the first while it waits); a job's own group.
    const without = ci.replace(/^concurrency:\n(?: {2}.+\n)+/m, '');
    expect(without).not.toBe(ci);
    expect(concurrencyProblems(without)).toEqual([
      'no concurrency group: each event on a pull request starts another run',
    ]);
    const always = ci.replace(/^( {2}cancel-in-progress: ).+$/m, '$1true');
    expect(concurrencyProblems(always)).toEqual(['cancel-in-progress is not for pull requests alone: true']);
    const perBranch = ci.replace(/^( {2}group: ).+$/m, '$1ci-${{ github.ref }}');
    expect(concurrencyProblems(perBranch)).toEqual([
      "the group is not the pull request's number, or a run's own id: ci-${{ github.ref }}",
    ]);
    const perJob = ci.replace(/^( {2}static:\n)/m, '$1    concurrency: static\n');
    expect(concurrencyProblems(perJob)).toEqual(['a job sets a concurrency group of its own']);
  });

  test('the balance job decides first, in plain Node, and plays the matrix only when an engine path changed', () => {
    const job = jobs.get('balance') ?? '';
    expect(runs('balance')).toEqual([
      'node tools/balance/engine-paths.ts',
      'npm ci',
      'npm run build',
      'npm run balance -- --out balance-report/played.json',
      'npm run balance:report -- --base HEAD^1 --head balance-report/played.json',
    ]);
    // The two steps after the decision run only on its play=true. The report runs only on a pull request, and only
    // once the games were played (even if they differ from the baseline); the upload only after the report.
    expect(job.match(/^ {6}- (?:id: \w+\n {8})?if: (.+)$/gm)?.map((l) => l.replace(/^.*if: /s, ''))).toEqual([
      "steps.engine.outputs.play == 'true'",
      "steps.engine.outputs.play == 'true'",
      "steps.engine.outputs.play == 'true'",
      "${{ !cancelled() && github.event_name == 'pull_request' && (steps.play.outcome == 'success' || steps.play.outcome == 'failure') }}",
      "${{ !cancelled() && steps.report.outcome == 'success' }}",
    ]);
    expect(job).toMatch(/^ {6}- id: engine\n {8}run: node tools\/balance\/engine-paths\.ts\n/m);
    expect(job).toMatch(/^ {6}- id: play\n {8}if: .*\n {8}run: npm run balance -- /m);
    expect(job).toMatch(/^ {6}- id: report\n {8}if: .*\n {8}run: npm run balance:report /m);
    expect(job).toMatch(/uses: actions\/upload-artifact@v\d+\n {8}with:\n {10}name: balance-report\n/);
    // The commit to compare with: a pull request's base is HEAD^1 of its merge commit; a push's is the commit before.
    expect(job).toMatch(/^ {10}fetch-depth: 2$/m);
    expect(job).toContain('EVENT: ${{ github.event_name }}');
    expect(job).toContain('BEFORE: ${{ github.event.before }}');
    expect(job).toContain("REFACTOR_ONLY: ${{ contains(github.event.pull_request.labels.*.name, 'refactor-only') }}");
    // CI itself may only read: the comment is posted by balance-report.yml.
    expect(ci).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    expect(ci).toMatch(/^name: CI$/m);
  });

  // The report comes from the pull request's own code, so the workflow that may comment never runs that code.
  test("the balance report is posted by a workflow that never checks out or runs the pull request's code", () => {
    const wf = read('.github/workflows/balance-report.yml');
    expect(wf).toMatch(
      /^on:\n {2}workflow_run:\n {4}workflows: \[CI\]\n {4}types: \[completed\]\n {2}pull_request:\n {4}types: \[edited\]\n/m,
    );
    expect(wf).toMatch(/^permissions: \{\}$/m);
    // Checkouts: the default branch (no ref) or the pull request's base commit, only the script, its package.json (which
    // says it is a module) and the Node pin.
    expect([...wf.matchAll(/^ +ref: (.+)$/gm)].map((m) => m[1])).toEqual(['${{ github.event.pull_request.base.sha }}']);
    const sparse = [...wf.matchAll(/sparse-checkout: \|\n((?: {12}.+\n)+)/g)].map((m) =>
      (m[1] ?? '').trim().split(/\s+/),
    );
    expect(sparse).toEqual([
      ['.nvmrc', 'tools/github/balance-comment.ts', 'tools/github/package.json'],
      ['.nvmrc', 'tools/github/balance-comment.ts', 'tools/github/package.json'],
    ]);
    expect(wf.match(/uses: actions\/checkout@/g)).toHaveLength(2);
    // What it runs: the artifact lookup, the base check, and the script. Nothing installed, nothing built.
    const commands = [...wf.matchAll(/^ +(?:- )?run: (.+)$/gm)].map((m) => m[1]);
    expect(commands).toEqual([
      '|',
      'node tools/github/balance-comment.ts post',
      '|',
      'node tools/github/balance-comment.ts warn',
    ]);
    expect(wf).not.toMatch(/\b(npm|npx|tsx)\b/);
    // Values the pull request's author controls reach the script as environment only, never inside a run line.
    for (const block of wf.split(/\n {6}- /)) {
      const run = /run: (\|[\s\S]*?)(?=\n {8}\w|$)|run: (.+)/.exec(block)?.[0] ?? '';
      expect(run, block).not.toContain('${{');
    }
  });

  // The plan's list (P1-02, Decisions; P1-05; P1-09's Decision 17): the files the GM portal's page is built from (its
  // template, stylesheet and modules: tools/pages.ts), the other pages' templates (src/*.html), what is copied as it is
  // (public/), the build and its page list, the balance code and its baselines, the test helpers the balance code
  // imports, and those they import in turn (P1-12a1: the every-realm half loads the engine through tests/lib/), and the
  // tools it runs on (the locked packages, the Node pin).
  test(
    'the engine paths are the ones the plan lists, and the runner uses the same list',
    timeLimitForTheWork({ everyFileReads: 1 }),
    () => {
      const page = pageSources();
      expect(page).toContain('src/content/kingdoms-call-data.ts');
      expect(page).toContain('src/engine/run-turn.ts');
      // the save's check at the turn's start parses with the saved state's schema (P1-15d)
      expect(page).toContain('src/schemas/saved-game-state.ts');
      expect(page.filter((f) => !isEnginePath(f))).toEqual([]);
      // Under src/, the engine paths are exactly the page's sources, the pages' templates and the schemas (one folder,
      // every file: the page bundles the saved state's, and the orders' is types for its code): no other page's code
      // plays the matrix.
      const src = filesUnder(path.join(ROOT, 'src')).map((f) => 'src/' + f);
      const templates = pageNames().map((p) => 'src/' + p);
      const schemas = src.filter((f) => f.startsWith('src/schemas/'));
      expect(schemas).toContain('src/schemas/orders-a-realm-submits.ts');
      expect(src.filter(isEnginePath).sort()).toEqual(
        [...new Set([...page.filter((f) => f.startsWith('src/')), ...templates, ...schemas])].sort(),
      );
      const dir = path.join(ROOT, 'tools', 'balance');
      const direct = fs
        .readdirSync(dir)
        .flatMap((f) => [
          ...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/ from '\.\.\/\.\.\/(tests\/lib\/[^']+)'/g),
        ])
        .map((m) => m[1] ?? '');
      // and what those import from tests/lib/ in turn (`from './x.ts'`, `require('./x')`), to the end
      const helpers = new Set(direct);
      for (const helper of helpers)
        for (const m of read(helper).matchAll(/(?: from |require\()'\.\/([^']+)'/g)) {
          const name = path.posix.join('tests/lib', m[1] ?? '');
          const file = [name, name + '.js', name + '.ts'].find((f) => fs.existsSync(path.join(ROOT, f)));
          if (file) helpers.add(file);
        }
      expect(helpers).toContain('tests/lib/the-fields-resolve-turn-adds-to-the-turns-context.ts');
      expect(ENGINE_PATHS.filter((g) => !g.startsWith('src/') || g === 'src/*.html').sort()).toEqual(
        [
          ...new Set([
            'src/*.html',
            'public/**',
            'tools/build.ts',
            'tsconfig.json',
            'tools/pages.ts',
            'tools/balance/**',
            'tests/balance/**',
            ...helpers,
            'package-lock.json',
            '.nvmrc',
          ]),
        ].sort(),
      );
      const runner = read('tools/balance/run.ts');
      expect(runner).toMatch(/^import \{[^}]*\bisEnginePath\b[^}]*\} from '\.\/engine-paths\.ts';$/m);
      expect(runner).toContain('pageFiles(');
      expect(runner).toMatch(/^ {2}buildSite\(\);$/m);
    },
  );

  test('no job lets a failure through, retries or repeats', () => {
    for (const weak of ['continue-on-error', '|| true', '--retries', '--retry', '--repeat-each', '--bail', '--pass']) {
      expect(ci, weak).not.toContain(weak);
    }
  });

  test("the db job lints the database's functions and fails on any finding", () => {
    expect(runs('db')).toContain('supabase db lint --local --level warning --fail-on warning');
  });

  // The deploy (deploy.yml) and staging (staging.yml) since P1-06a: a build job installs (npm ci --ignore-scripts) and
  // builds site/ from this commit's src/ (P1-05; Vite since P1-09d), then hands it on as an artifact; the job that
  // publishes it only publishes. The build job can't publish: it reads only, outside any environment, with no secret.
  // The job that publishes, and every job that can write, runs in an environment or reads a secret, runs no npm, no
  // npx and no build (P1-06, Decision 2). Each workflow is read from its text, job by job (each job's id two spaces in,
  // under "jobs:"), with its comments left out.
  interface Workflow {
    head: string;
    jobs: Map<string, string>;
  }
  function readWorkflow(text: string): Workflow {
    const [head = '', body = ''] = text.replace(/^\s*#.*$/gm, '').split(/^jobs:\n/m);
    const jobs = new Map<string, string>();
    for (const block of body.split(/^(?= {2}[\w-]+:\n)/m)) {
      const id = /^ {2}([\w-]+):\n/.exec(block)?.[1];
      if (id) jobs.set(id, block);
    }
    return { head, jobs };
  }
  // The permissions set at one indent (0: the workflow's, 4: a job's), one "scope: level" each ("{}" is none);
  // undefined when there are none at that indent.
  function permissionsAt(text: string, indent: number): string[] | undefined {
    const pad = ' '.repeat(indent);
    const inline = new RegExp(`^${pad}permissions: *(\\S.*)$`, 'm').exec(text)?.[1];
    if (inline !== undefined) return inline === '{}' ? [] : [inline];
    const listed = new RegExp(`^${pad}permissions:\\n((?:${pad} {2}.+\\n?)*)`, 'm').exec(text)?.[1];
    return listed
      ?.split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const READS_A_SECRET = /\bsecrets(?:\.|\[| *: *inherit)/;
  // A job can publish or holds a secret when its token can write anything (its own permissions, else the workflow's;
  // with neither, the repository's default, which may write), it runs in an environment, or it reads a secret.
  function canPublishOrHoldsASecret({ head }: Workflow, block: string): boolean {
    const permissions = permissionsAt(block, 4) ?? permissionsAt(head, 0);
    if (!permissions || permissions.some((p) => p.includes('write'))) return true;
    return /^ {4}environment:/m.test(block) || READS_A_SECRET.test(block);
  }
  // npm, npx, another package manager, Vite or the build script, anywhere in the job (setup-node's npm cache too).
  const RUNS_NPM_OR_THE_BUILD = /\b(?:npm|npx|pnpm|yarn|bun|vite)\b|tools\/build/;
  function publishingJobsThatRunNpm(text: string): { checked: string[]; wrong: string[] } {
    const workflow = readWorkflow(text);
    const checked: string[] = [];
    const wrong: string[] = [];
    for (const [id, block] of workflow.jobs) {
      if (!canPublishOrHoldsASecret(workflow, block)) continue;
      checked.push(id);
      for (const line of block.split('\n')) if (RUNS_NPM_OR_THE_BUILD.test(line)) wrong.push(`${id}: ${line.trim()}`);
    }
    return { checked, wrong };
  }
  // A job's `if:`, its folded lines joined; then whether it holds only when `guard` does: the guard is one of the
  // expression's top-level `&&` terms, and no `||` stands at the top level beside them.
  function conditionOf(block: string): string {
    const m = /^ {4}if: *(.*)\n((?: {6,}.*\n?)*)/m.exec(block);
    if (!m) return '';
    const text = /^[>|]-?$/.test(m[1] ?? '') ? (m[2] ?? '') : (m[1] ?? '');
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\$\{\{(.*)\}\}$/, '$1')
      .trim();
  }
  function holdsOnlyWhen(condition: string, guard: string): boolean {
    const terms: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < condition.length; i++) {
      const c = condition[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && condition.startsWith('||', i)) return false;
      else if (depth === 0 && condition.startsWith('&&', i)) {
        terms.push(condition.slice(start, i).trim());
        start = i + 2;
      }
    }
    terms.push(condition.slice(start).trim());
    return terms.includes(guard);
  }
  const ON_MAIN = "github.ref == 'refs/heads/main'";
  const STATUS_FUNCTION = /\b(?:always|cancelled|failure)\(\)/;
  // Everything that must hold of the deploy's and staging's jobs, as a list of what doesn't (empty when all holds).
  function buildJobProblems(workflow: Workflow, id: string): string[] {
    const block = workflow.jobs.get(id);
    if (!block) return [`no ${id} job`];
    const problems: string[] = [];
    const permissions = permissionsAt(block, 4);
    if (!permissions) problems.push(`${id}: names no permissions of its own`);
    for (const p of permissions ?? []) if (!/^[a-z-]+: read$/.test(p)) problems.push(`${id}: ${p}`);
    if (/^ {4}environment:/m.test(block)) problems.push(`${id}: runs in an environment`);
    if (READS_A_SECRET.test(block)) problems.push(`${id}: reads a secret`);
    if (!/^ {6}- run: npm ci --ignore-scripts\n\n {6}- run: npm run build\n/m.test(block)) {
      problems.push(`${id}: doesn't install with npm ci --ignore-scripts, then build`);
    }
    return problems;
  }
  // The build jobs keep the files a page cached before this deploy still names (P1-06b,
  // tools/deploy/keep-the-previous-deploys-files.ts): a step right after the build and right before the upload, which
  // can't be skipped and stops the job at its first failure, so a site without them is never handed on.
  const KEEP = 'node tools/deploy/keep-the-previous-deploys-files.ts site/ --';
  const stepsOf = (block: string): string[] => block.split(/^(?= {6}- )/m).slice(1);
  function keepStepProblems(build: string, upload: RegExp): string[] {
    const steps = stepsOf(build);
    const keep = steps.findIndex((step) => step.includes(KEEP));
    const step = steps[keep];
    if (!step) return ["build: doesn't keep the previous deploy's files"];
    const problems: string[] = [];
    const built = steps.findIndex((s) => /^ {6}- run: npm run build\n/.test(s));
    if (built < 0 || built + 1 !== keep || !upload.test(steps[keep + 1] ?? '')) {
      problems.push("build: doesn't keep the previous deploy's files right after the build, then upload");
    }
    if (/^ {8}(?:if|continue-on-error):/m.test(step))
      problems.push('build: the keep step may be skipped or fail quietly');
    if (!/^ {8}run: \|\n {10}set -euo pipefail\n/m.test(step))
      problems.push("build: the keep step doesn't stop at a failure");
    if (step.includes('||')) problems.push('build: the keep step lets a failure through (||)');
    return problems;
  }
  function deployProblems(text: string): string[] {
    const workflow = readWorkflow(text);
    const problems = buildJobProblems(workflow, 'build');
    const build = workflow.jobs.get('build') ?? '';
    const pagesArtifact = /^ {6}- uses: actions\/upload-pages-artifact@v\d+\n/;
    problems.push(...keepStepProblems(build, pagesArtifact));
    const upload = stepsOf(build).find((step) => pagesArtifact.test(step)) ?? '';
    if (!/^ {8}with:\n {10}path: site\/\n {10}retention-days: 30\n/m.test(upload)) {
      problems.push("build: doesn't upload site/ as the Pages artifact, kept 30 days");
    }
    if (!holdsOnlyWhen(conditionOf(build), "needs.ci.result == 'success'"))
      problems.push('build: not only once CI passed');
    const deploy = workflow.jobs.get('deploy') ?? '';
    if (!/^ {4}needs: (?:build|\[(?:[\w-]+, )*build(?:, [\w-]+)*\])$/m.test(deploy))
      problems.push("deploy: doesn't need build");
    // The previous deploy is the newest run whose deploy job published: a run that succeeded with its deploy job
    // skipped (#184 to #186) published nothing.
    const keep = stepsOf(build).find((step) => step.includes(KEEP));
    if (keep && !keep.includes('select(.name == "deploy" and .conclusion == "success")'))
      problems.push('build: the keep step may take a run that published nothing as the previous deploy');
    const deployCondition = conditionOf(deploy);
    if (!holdsOnlyWhen(deployCondition, ON_MAIN)) problems.push('deploy: not only on main');
    if (!holdsOnlyWhen(deployCondition, "needs.build.result == 'success'"))
      problems.push('deploy: not only once the build succeeded');
    // Without a status function GitHub adds success(), which reads every job before deploy, not only build: deploy is
    // then skipped whenever migrate-production is (every merge without a migration; #184 to #186). always() would
    // publish on a cancelled run. So !cancelled(), and no other.
    if (
      !holdsOnlyWhen(deployCondition, '!cancelled()') ||
      STATUS_FUNCTION.test(deployCondition.replace('!cancelled()', ''))
    )
      problems.push('deploy: its status function is not !cancelled() alone');
    if (!/^ {4}environment:\n {6}name: github-pages$/m.test(deploy))
      problems.push('deploy: not in the github-pages environment');
    const steps = deploy.match(/^ {6}- /gm) ?? [];
    if (steps.length !== 1 || !/^ {8}uses: actions\/deploy-pages@v\d+$/m.test(deploy)) {
      problems.push(`deploy: ${String(steps.length)} steps, not only actions/deploy-pages`);
    }
    if (!holdsOnlyWhen(conditionOf(workflow.jobs.get('migrate-production') ?? ''), ON_MAIN)) {
      problems.push('migrate-production: not only on main');
    }
    return problems;
  }
  function stagingProblems(text: string): string[] {
    const workflow = readWorkflow(text);
    const problems = buildJobProblems(workflow, 'build');
    const build = workflow.jobs.get('build') ?? '';
    const handOff =
      /^ {6}- (?:name: .*\n {8})?uses: actions\/upload-artifact@v\d+\n {8}with:\n {10}name: site\n {10}path: site\/\n/m;
    if (!handOff.test(build)) problems.push("build: doesn't upload site/ as the artifact site");
    problems.push(...keepStepProblems(build, /^ {6}- (?:name: .*\n {8})?uses: actions\/upload-artifact@v\d+\n/));
    const staging = workflow.jobs.get('staging') ?? '';
    if (!/^ {4}needs: build$/m.test(staging)) problems.push("staging: doesn't need build");
    const download = staging.search(
      /^ {6}- (?:name: .*\n {8})?uses: actions\/download-artifact@v\d+\n {8}with:\n {10}name: site\n {10}path: site\/\n/m,
    );
    const config = staging.indexOf('> site/kc-config.js');
    const publish = staging.indexOf('cp -R site/. staging-repo/');
    if (!(download > 0 && download < config && config < publish)) {
      problems.push("staging: doesn't download site/, then write its kc-config.js, then publish it");
    }
    return problems;
  }
  // The same text with `from` replaced by `to` inside one job only: how a planted copy changes one job.
  function inJob(text: string, id: string, from: string | RegExp, to: string): string {
    const start = text.search(new RegExp(`^ {2}${id}:\\n`, 'm'));
    const rest = text.slice(start + 1).search(/^ {2}[\w-]+:\n/m);
    const end = rest < 0 ? text.length : start + 1 + rest;
    const changed = text.slice(start, end).replace(from, to);
    expect(changed, `${id}: the plant changed nothing`).not.toBe(text.slice(start, end));
    return text.slice(0, start) + changed + text.slice(end);
  }
  const workflows = fs
    .readdirSync(path.join(ROOT, '.github', 'workflows'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => ({ f, text: read(`.github/workflows/${f}`) }));
  const deployText = read('.github/workflows/deploy.yml');
  const stagingText = read('.github/workflows/staging.yml');

  test('deploy runs this workflow first', () => {
    expect(deployText).toMatch(/^ {2}ci:\n {4}uses: \.\/\.github\/workflows\/ci\.yml$/m);
  });

  test('deploy builds site/ in a job that can only read, and publishes it, on main only, in a job that only publishes', () => {
    expect(deployProblems(deployText)).toEqual([]);
  });

  test('staging builds site/ in a job that can only read, and publishes it in a job that runs no npm', () => {
    expect(stagingProblems(stagingText)).toEqual([]);
  });

  // Staging runs on pull_request, so its build job checks out GitHub's test merge of the pull request into its base
  // (github.sha), not the pull request's last commit: the footers' build line names the merge. The "On staging"
  // comment names both (#187's said only the head, while the build line said the merge).
  function stagingCommentProblems(text: string): string[] {
    const workflow = readWorkflow(text);
    const problems: string[] = [];
    if (/^ {10}ref:/m.test(workflow.jobs.get('build') ?? '')) problems.push('build: checks out another commit');
    const comment = stepsOf(workflow.jobs.get('staging') ?? '').find((s) => s.includes('staging.js comment')) ?? '';
    if (!comment) return [...problems, 'staging: no "On staging" comment'];
    if (!/^ {10}BUILT_SHA: \$\{\{ github\.sha \}\}$/m.test(comment))
      problems.push('staging: the comment is not told the commit the build job built');
    if (!/^ {10}PR_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}$/m.test(comment))
      problems.push("staging: the comment is not told the pull request's last commit");
    return problems;
  }
  test('the "On staging" comment is told the commit staging built and the pull request\'s last commit', () => {
    expect(stagingCommentProblems(stagingText)).toEqual([]);
    const comment = /^( {6}- name: Comment on the pull requests\n(?: {8}.*\n)+)/m;
    const withoutBuilt = inJob(stagingText, 'staging', /^ {10}BUILT_SHA: .*\n/m, '');
    expect(stagingCommentProblems(withoutBuilt)).toEqual([
      'staging: the comment is not told the commit the build job built',
    ]);
    const headAsBuilt = inJob(
      stagingText,
      'staging',
      /^( {10}BUILT_SHA: ).*$/m,
      '$1${{ github.event.pull_request.head.sha }}',
    );
    expect(stagingCommentProblems(headAsBuilt)).toEqual([
      'staging: the comment is not told the commit the build job built',
    ]);
    expect(stagingCommentProblems(inJob(stagingText, 'staging', comment, ''))).toEqual([
      'staging: no "On staging" comment',
    ]);
    const buildsHead = inJob(
      stagingText,
      'build',
      /^( {10}persist-credentials: false\n)/m,
      '$1          ref: ${{ github.event.pull_request.head.sha }}\n',
    );
    expect(stagingCommentProblems(buildsHead)).toEqual(['build: checks out another commit']);
  });

  // Each TypeScript script a workflow runs with Node says it is a module: its name ends .mts, or the package.json nearest
  // its folder says "type": "module". Otherwise Node parses it as CommonJS first, fails, parses it again as a module and
  // prints MODULE_TYPELESS_PACKAGE_JSON (the deploy's keep step did on every deploy, #187, #188). The repository's own
  // package.json has no type: its .js test scripts are CommonJS.
  function moduleTypeOf(dir: string, files: (f: string) => string | undefined): string | undefined {
    for (let d = dir; ; d = path.posix.dirname(d)) {
      const text = files(d === '.' ? 'package.json' : `${d}/package.json`);
      if (text !== undefined) return (JSON.parse(text) as { type?: string }).type;
      if (d === '.') return undefined;
    }
  }
  const repositoryFile = (f: string) => (fs.existsSync(path.join(ROOT, f)) ? read(f) : undefined);
  // A workflow that checks out only some files (sparse-checkout, balance-report.yml) sees only those.
  function typelessScripts(texts: { f: string; text: string }[], files = repositoryFile): string[] {
    return texts.flatMap(({ f, text }) => {
      const sparse = [...text.matchAll(/sparse-checkout: \|\n((?: {12}.+\n)+)/g)].map((m) =>
        (m[1] ?? '').trim().split(/\s+/),
      );
      const seen = (g: string) => (sparse.every((list) => list.includes(g)) ? files(g) : undefined);
      return [...new Set([...text.matchAll(/\bnode ((?:[\w.-]+\/)*[\w.-]+\.ts)\b/g)].map((m) => m[1] ?? ''))]
        .filter((script) => moduleTypeOf(path.posix.dirname(script), seen) !== 'module')
        .map((script) => `${f}: ${script}`);
    });
  }
  test('each TypeScript script a workflow runs with Node says it is a module', () => {
    const scripts = workflows.flatMap(({ text }) => [...text.matchAll(/\bnode ([\w./-]+\.m?ts)\b/g)].map((m) => m[1]));
    expect(scripts).toContain('tools/deploy/keep-the-previous-deploys-files.ts');
    expect(typelessScripts(workflows)).toEqual([]);
    // Planted: the keep step's script in a folder whose nearest package.json has no type (the repository's); the
    // folder's package.json gone; and renamed .mts, which needs none.
    const keepIn = (dir: string) => deployText.replace(/node tools\/deploy\//g, `node ${dir}`);
    expect(typelessScripts([{ f: 'deploy.yml', text: keepIn('tools/') }])).toEqual([
      'deploy.yml: tools/keep-the-previous-deploys-files.ts',
    ]);
    const withoutIt = (f: string) => (f === 'tools/deploy/package.json' ? undefined : repositoryFile(f));
    expect(typelessScripts([{ f: 'deploy.yml', text: deployText }], withoutIt)).toEqual([
      'deploy.yml: tools/deploy/keep-the-previous-deploys-files.ts',
    ]);
    const renamed = keepIn('tools/').replace(/keep-the-previous-deploys-files\.ts/g, 'keep.mts');
    expect(typelessScripts([{ f: 'deploy.yml', text: renamed }])).toEqual([]);
    // The balance report's sparse checkout without the script's package.json: Node never sees it.
    const report = read('.github/workflows/balance-report.yml');
    const notCheckedOut = report.replace(/^ {12}tools\/github\/package\.json\n/gm, '');
    expect(notCheckedOut).not.toBe(report);
    expect(typelessScripts([{ f: 'balance-report.yml', text: notCheckedOut }])).toEqual([
      'balance-report.yml: tools/github/balance-comment.ts',
    ]);
  });

  test('no job that can publish, runs in an environment or reads a secret runs npm, npx or the build, in any workflow', () => {
    const checked: string[] = [];
    for (const { f, text } of workflows) {
      const found = publishingJobsThatRunNpm(text);
      expect(found.wrong, f).toEqual([]);
      checked.push(...found.checked.map((id) => `${f} ${id}`));
    }
    expect(checked).toEqual(
      expect.arrayContaining(['deploy.yml migrate-production', 'deploy.yml deploy', 'staging.yml staging']),
    );
    expect(checked).not.toContain('deploy.yml build');
    expect(checked).not.toContain('staging.yml build');
  });

  test('planted copies are caught: npm or the build where it publishes, a build job that can write, a missing main guard', () => {
    const npmStep = '      - run: npm ci --ignore-scripts\n\n';
    // An npm step in the job that publishes.
    const deployWithNpm = inJob(deployText, 'deploy', /^( {6}- id: deployment\n)/m, `${npmStep}$1`);
    expect(publishingJobsThatRunNpm(deployWithNpm).wrong).toEqual(['deploy: - run: npm ci --ignore-scripts']);
    expect(deployProblems(deployWithNpm)).toEqual(['deploy: 2 steps, not only actions/deploy-pages']);
    const stagingWithNpm = inJob(stagingText, 'staging', /^( {6}- name: Write the staging config\n)/m, `${npmStep}$1`);
    expect(publishingJobsThatRunNpm(stagingWithNpm).wrong).toEqual(['staging: - run: npm ci --ignore-scripts']);
    // The build back in the staging job, in place of the download.
    const download = /^ {6}- name: Download the site the build job built\n(?: {8}.*\n)+\n/m;
    const rebuilt = inJob(stagingText, 'staging', download, `${npmStep}      - run: npm run build\n\n`);
    expect(publishingJobsThatRunNpm(rebuilt).wrong).toEqual([
      'staging: - run: npm ci --ignore-scripts',
      'staging: - run: npm run build',
    ]);
    expect(stagingProblems(rebuilt)).toEqual([
      "staging: doesn't download site/, then write its kc-config.js, then publish it",
    ]);
    // A build job that can write.
    const writes = (text: string, scope: string) =>
      inJob(text, 'build', /^( {4}permissions:\n {6}contents: read\n)/m, `$1      ${scope}: write\n`);
    const deployBuildWrites = writes(deployText, 'pages');
    expect(deployProblems(deployBuildWrites)).toEqual(['build: pages: write']);
    expect(publishingJobsThatRunNpm(deployBuildWrites).wrong).toEqual([
      'build: cache: npm',
      'build: - run: npm ci --ignore-scripts',
      'build: - run: npm run build',
    ]);
    expect(stagingProblems(writes(stagingText, 'pull-requests'))).toEqual(['build: pull-requests: write']);
    // A build job in an environment, or reading a secret.
    const inAnEnvironment = inJob(deployText, 'build', /^( {4}permissions:\n)/m, '    environment: github-pages\n$1');
    expect(deployProblems(inAnEnvironment)).toEqual(['build: runs in an environment']);
    const withASecret = inJob(
      stagingText,
      'build',
      /^( {6}- run: npm run build\n)/m,
      '$1        env:\n          KEY: ${{ secrets.STAGING_DEPLOY_KEY }}\n',
    );
    expect(stagingProblems(withASecret)).toEqual(['build: reads a secret']);
    // The publishing job's condition: its main guard dropped, or let through by an "or"; without the build's result;
    // with no status function (as #184 to #186 had: skipped on every merge without a migration), or always().
    const deployIf = /^ {4}if: .*\n/m;
    const deployWhen = (condition: string) => inJob(deployText, 'deploy', deployIf, `    if: \${{ ${condition} }}\n`);
    const BUILT = "needs.build.result == 'success'";
    expect(deployProblems(deployWhen(`!cancelled() && ${BUILT}`))).toEqual(['deploy: not only on main']);
    const orAnyRun = `!cancelled() && ${BUILT} && (${ON_MAIN} || github.event_name == 'workflow_dispatch')`;
    expect(deployProblems(deployWhen(orAnyRun))).toEqual(['deploy: not only on main']);
    expect(deployProblems(deployWhen(`!cancelled() && ${ON_MAIN}`))).toEqual([
      'deploy: not only once the build succeeded',
    ]);
    expect(deployProblems(deployWhen(`${BUILT} && ${ON_MAIN}`))).toEqual([
      'deploy: its status function is not !cancelled() alone',
    ]);
    expect(deployProblems(deployWhen(`always() && ${BUILT} && ${ON_MAIN}`))).toEqual([
      'deploy: its status function is not !cancelled() alone',
    ]);
    expect(deployProblems(inJob(deployText, 'deploy', deployIf, `    if: ${ON_MAIN}\n`))).toEqual([
      'deploy: not only once the build succeeded',
      'deploy: its status function is not !cancelled() alone',
    ]);
    expect(deployProblems(inJob(deployText, 'deploy', deployIf, ''))).toEqual([
      'deploy: not only on main',
      'deploy: not only once the build succeeded',
      'deploy: its status function is not !cancelled() alone',
    ]);
    expect(deployProblems(inJob(deployText, 'deploy', 'name: github-pages', 'name: production'))).toEqual([
      'deploy: not in the github-pages environment',
    ]);
    // migrate-production's main guard dropped.
    const migrate = inJob(deployText, 'migrate-production', ` && ${ON_MAIN}`, '');
    expect(deployProblems(migrate)).toEqual(['migrate-production: not only on main']);
  });

  test('planted copies are caught: the keep step left out, moved, skippable or let fail, the artifact kept a day', () => {
    const keepStep = /^ {6}- name: Keep the previous deploy's files\n(?: {8}.*\n)+\n/m;
    // Left out.
    expect(deployProblems(inJob(deployText, 'build', keepStep, ''))).toEqual([
      "build: doesn't keep the previous deploy's files",
    ]);
    expect(stagingProblems(inJob(stagingText, 'build', keepStep, ''))).toEqual([
      "build: doesn't keep the previous deploy's files",
    ]);
    // After the upload: the site handed on lacks the files.
    const step = keepStep.exec(deployText)?.[0] ?? '';
    const moved = inJob(inJob(deployText, 'build', keepStep, ''), 'build', /(retention-days: 30\n)/, `$1\n${step}`);
    expect(deployProblems(moved)).toEqual([
      "build: doesn't keep the previous deploy's files right after the build, then upload",
    ]);
    // Skippable, or allowed to fail.
    const runLine = /^( {8}run: \|\n)/m;
    expect(deployProblems(inJob(deployText, 'build', runLine, '        continue-on-error: true\n$1'))).toEqual([
      'build: the keep step may be skipped or fail quietly',
    ]);
    expect(
      stagingProblems(inJob(stagingText, 'build', runLine, "        if: github.event_name == 'push'\n$1")),
    ).toEqual(['build: the keep step may be skipped or fail quietly']);
    expect(stagingProblems(inJob(stagingText, 'build', / {10}set -euo pipefail\n/, ''))).toEqual([
      "build: the keep step doesn't stop at a failure",
    ]);
    const orTrue = (text: string) =>
      inJob(text, 'build', /(--previous "\$RUNNER_TEMP\/previous-site")\n/, '$1 || true\n');
    expect(deployProblems(orTrue(deployText))).toEqual(['build: the keep step lets a failure through (||)']);
    expect(stagingProblems(orTrue(stagingText))).toEqual(['build: the keep step lets a failure through (||)']);
    // The previous deploy taken as the newest successful run, as #185 had: a run whose deploy job was skipped counts.
    const lookup = /^ {10}ids=\$\(gh api [\s\S]*?^ {10}done\n/m;
    const newestSuccess = `          run=$(gh api "$runs" --jq "[.workflow_runs[] | select(.id != $GITHUB_RUN_ID)][0].id // empty")\n`;
    expect(deployProblems(inJob(deployText, 'build', lookup, newestSuccess))).toEqual([
      'build: the keep step may take a run that published nothing as the previous deploy',
    ]);
    // The Pages artifact kept for the default day: the next deploy, a day later, would find no previous files.
    expect(deployProblems(inJob(deployText, 'build', 'retention-days: 30', 'retention-days: 1'))).toEqual([
      "build: doesn't upload site/ as the Pages artifact, kept 30 days",
    ]);
  });

  // Every install in the deploy's and staging's jobs (what they build is published), and in every job of any workflow
  // that holds a secret or a token, is from the lock file without its packages' install scripts: npm ci
  // --ignore-scripts, nothing else (the build needs none). What a workflow sets above "jobs:" counts for every job in it.
  const HOLDS_A_SECRET = /secrets\.|github\.token|id-token: write|pages: write|environment:/;
  const AN_INSTALL = /\bnpm +(?:ci|install|i|add|update|rebuild)\b.*$/gm;
  function installsInJobsWithSecrets(text: string, everyJob = false): { checked: string[]; wrong: string[] } {
    const { head, jobs } = readWorkflow(text);
    const checked: string[] = [];
    const wrong: string[] = [];
    for (const [id, block] of jobs) {
      if (!everyJob && !HOLDS_A_SECRET.test(head + block)) continue;
      for (const [install] of block.matchAll(AN_INSTALL)) {
        checked.push(id);
        if (install.trim() !== 'npm ci --ignore-scripts') wrong.push(`${id}: ${install.trim()}`);
      }
    }
    return { checked, wrong };
  }
  const PUBLISHED = new Set(['deploy.yml', 'staging.yml']);

  test("every install in the deploy's and staging's jobs, and in every job that holds a secret or a token, is npm ci --ignore-scripts", () => {
    const checked: string[] = [];
    for (const { f, text } of workflows) {
      const found = installsInJobsWithSecrets(text, PUBLISHED.has(f));
      expect(found.wrong, f).toEqual([]);
      checked.push(...found.checked.map((id) => `${f} ${id}`));
    }
    expect(checked).toEqual(expect.arrayContaining(['deploy.yml build', 'staging.yml build']));
  });

  test('a planted install any other way is caught, in the build jobs and in a job that gains a secret', () => {
    expect(installsInJobsWithSecrets(deployText.replace('npm ci --ignore-scripts', 'npm ci'), true).wrong).toEqual([
      'build: npm ci',
    ]);
    expect(
      installsInJobsWithSecrets(stagingText.replace('npm ci --ignore-scripts', 'npm install'), true).wrong,
    ).toEqual(['build: npm install']);
    // ci.yml's jobs hold none today; one that gains a secret falls under the rule.
    expect(installsInJobsWithSecrets(ci).wrong).toEqual([]);
    const planted = ci.replace(/^( {2}unit-scenario:\n)/m, '$1    environment: production\n');
    expect(installsInJobsWithSecrets(planted).wrong).toEqual(['unit-scenario: npm ci']);
  });
});

// The nightly random-seed run (P1-04d): every night, npm run test:full with a random seed it prints first. It blocks
// nothing, and it may only read.
describe('the nightly run', () => {
  const wf = read('.github/workflows/nightly.yml');
  const runs = [...wf.matchAll(/^ +(?:- )?run: (.+)$/gm)].map((m) => m[1]);

  test('it runs every night, and by hand with a seed to repeat', () => {
    expect(wf).toMatch(/^on:\n {2}schedule:\n {4}- cron: '[\d *]+'\n {2}workflow_dispatch:\n {4}inputs:\n {6}seed:\n/m);
  });

  test('it may only read', () => {
    expect(wf).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    expect(wf.match(/permissions:/g)).toHaveLength(1);
    expect(wf).toContain('persist-credentials: false');
  });

  test('it runs npm run test:full with the random seed it printed first, and lets no failure through', () => {
    expect(runs).toEqual(['npm ci', '|', 'npm run test:full']);
    expect(wf).toMatch(
      /^ {6}- run: npm run test:full\n {8}env:\n {10}KC_SEED: \$\{\{ steps\.seed\.outputs\.seed \}\}\n/m,
    );
    expect(wf).toContain('/dev/urandom');
    expect(wf).toContain('echo "KC_SEED=$seed"');
    expect(wf).toContain('>> "$GITHUB_STEP_SUMMARY"');
    for (const weak of ['continue-on-error', '|| true', '--retries', '--retry', '--repeat-each', '--bail', '--pass']) {
      expect(wf, weak).not.toContain(weak);
    }
    // The seed given by hand reaches the script as environment only, never inside a run line.
    expect(wf).toContain('GIVEN: ${{ inputs.seed }}');
    for (const block of wf.split(/\n {6}- /)) {
      const run = /run: (\|[\s\S]*?)(?=\n {8}\w|$)|run: (.+)/.exec(block)?.[0] ?? '';
      expect(run, block).not.toContain('${{');
    }
  });
});

// The mutant scorer (tools/mutants/run.ts, P1-21a) measures the tests, so a change to it is talked through with Theo;
// and its run is local only: no workflow runs it (it stops when CI is set, too).
describe('the mutant scorer', () => {
  const scorerFiles = ['tools/mutants/run.ts', 'tools/mutants/a-helper-added-later.ts'];
  const undangerous = (listText: string) =>
    scorerFiles.filter((f) => !dangerous.isDangerous(f, dangerous.parsePaths(listText) as string[]));
  const workflowsThatScoreMutants = (texts: { f: string; text: string }[]) =>
    texts.filter(({ text }) => /\bnpm run(?:-script)? mutants\b|\btools\/mutants\b/.test(text)).map(({ f }) => f);

  test('it is a dangerous path (planted: its line gone from the list)', () => {
    const list = read('.github/dangerous-paths');
    expect(undangerous(list)).toEqual([]);
    const without = list.replace(/^tools\/mutants\/\*\*\n/m, '');
    expect(without).not.toBe(list);
    expect(undangerous(without)).toEqual(scorerFiles);
  });

  test('no workflow runs it (planted: a step running npm run mutants, one naming tools/mutants)', () => {
    const workflows = fs
      .readdirSync(path.join(ROOT, '.github', 'workflows'))
      .filter((f) => f.endsWith('.yml'))
      .map((f) => ({ f, text: read(`.github/workflows/${f}`) }));
    expect(workflows.map(({ f }) => f)).toContain('nightly.yml');
    expect(workflowsThatScoreMutants(workflows)).toEqual([]);
    const nightly = read('.github/workflows/nightly.yml');
    const step = (run: string) => nightly.replace(/^( +)- run: npm run test:full.*$/m, `$&\n$1- run: ${run}`);
    expect(step('npm run mutants -- /tmp/mutants')).not.toBe(nightly);
    for (const run of ['npm run mutants -- /tmp/mutants', 'npx tsx tools/mutants/run.ts /tmp/mutants'])
      expect(workflowsThatScoreMutants([{ f: 'nightly.yml', text: step(run) }]), run).toEqual(['nightly.yml']);
  });
});

describe('dangerous paths', () => {
  test('every harness file gets the warning', () => {
    const globs = dangerous.parsePaths(read('.github/dangerous-paths')) as string[];
    const harness = [
      '.claude/settings.json',
      'tsconfig.json',
      'vitest.config.mts',
      'playwright.config.ts',
      'eslint.config.js',
      '.dependency-cruiser.cjs',
      '.dependency-cruiser.mts',
      '.dependency-cruiser-known-violations.json',
      'eslint-suppressions.json',
      'tools/eslint-rules/html-is-built-only-through-kc-html.ts',
      'tools/eslint-rules/index.ts',
      'tools/eslint-rules/package.json',
      'tools/eslint-rules/no-random-or-argument-less-sort-comparator.ts',
      'tools/eslint-rules/big-tables-and-profiles-are-read-by-named-columns.ts',
      'knip.json',
      'knip.ts',
      '.nvmrc',
      '.npmrc',
      'package.json',
      'package-lock.json',
      'tests/setup/each.ts',
      'tests/setup/global.ts',
      'tests/setup/fixed.mts',
      'tests/legacy.test.ts',
      'tests/ratchet.json',
      'tests/static/harness.test.ts',
      'tests/balance/matrix.test.ts',
      'tools/balance/run.ts',
      'tools/balance/engine-paths.ts',
      'tools/balance/report.ts',
      'tools/balance/package.json',
      'tools/github/balance-comment.ts',
      'tools/github/package.json',
      'tools/hooks/after-edit.ts',
      'tools/hooks/before-stop.ts',
      'tools/check.ts',
      'tools/ratchet.ts',
      'tools/build.ts',
      'tools/pages.ts',
      'tools/dev.ts',
      'tools/deploy/keep-the-previous-deploys-files.ts',
      'tools/deploy/package.json',
      'tests/lib/engine.ts',
      '.github/workflows/ci.yml',
      '.github/workflows/balance-report.yml',
      '.github/workflows/nightly.yml',
      'tests/setup/fast-check.ts',
    ];
    expect(harness.filter((f) => !dangerous.isDangerous(f, globs))).toEqual([]);
  });

  test("the balance baselines are checked by CI's balance job, so a change to play isn't flagged for its data", () => {
    const globs = dangerous.parsePaths(read('.github/dangerous-paths')) as string[];
    for (const f of ['tests/balance/baseline/matrix.json', 'tests/balance/baseline/noise.json']) {
      expect(dangerous.isDangerous(f, globs), f).toBe(false);
    }
  });
});

describe('the ratchet', () => {
  test('npm run ratchet reads tests/ratchet.json', () => {
    expect(pkg.scripts['ratchet']).toBe('tsx tools/ratchet.ts');
    expect(path.relative(ROOT, BASELINE_FILE)).toBe('tests/ratchet.json');
  });

  // The ts-nocheck line is counted in two (plan P1-10, Decision 9; P1-10b's Decision 5): the engine's side, which P1-10b
  // takes to 0, and the UI's (P1-16), so neither may rise while the other falls. One planted line in each folder raises
  // its own count alone, and the ratchet fails on it.
  test(
    'the ts-nocheck line is counted on the engine side and in the UI, apart, and no longer as one',
    timeLimitForTheWork({ toolRuns: 1 }),
    () => {
      const baseline = readBaseline();
      const now = measure();
      for (const counts of [baseline, now]) {
        expect(counts).not.toHaveProperty('tsNocheck');
        expect(counts['tsNocheckEngineSide']).toBeGreaterThan(0);
        expect(counts['tsNocheckUi']).toBeGreaterThan(0);
      }
      expect([...ENGINE_SIDE_FOLDERS]).toEqual([
        'src/engine/',
        'src/views/',
        'src/db/',
        'src/ui/shared/',
        'src/content/',
        'src/schemas/',
        'src/shared/',
      ]);
    },
  );
  const NOCHECK_LINE = '// @ts-' + 'nocheck: planted, to show the ratchet counts it\n';
  test.for([
    ['src/engine/battle/x.ts', 'tsNocheckEngineSide'],
    ['src/views/x.ts', 'tsNocheckEngineSide'],
    ['src/db/x.ts', 'tsNocheckEngineSide'],
    ['src/ui/shared/x.ts', 'tsNocheckEngineSide'],
    ['src/content/x.ts', 'tsNocheckEngineSide'],
    ['src/schemas/x.ts', 'tsNocheckEngineSide'],
    ['src/shared/x.ts', 'tsNocheckEngineSide'],
    ['src/ui/gm/x.ts', 'tsNocheckUi'],
    ['src/ui/player/x.ts', 'tsNocheckUi'],
    ['src/rulebook/x.ts', 'tsNocheckUi'],
    ['tests/unit/x.test.ts', 'tsNocheckUi'],
    ['tools/x.ts', 'tsNocheckUi'],
  ] as const)('a ts-nocheck line planted in %s raises %s alone, and the ratchet fails', ([file, count]) => {
    const files = theCodeFiles();
    const asTheyAre = { ...readBaseline(), ...countsFromTheCodeFiles(files) };
    expect(compare(asTheyAre, asTheyAre).rose).toEqual([]);
    const planted = { ...asTheyAre, ...countsFromTheCodeFiles([...files, [file, NOCHECK_LINE + 'export {};\n']]) };
    const { rose } = compare(asTheyAre, planted);
    expect(rose).toEqual([expect.stringMatching(new RegExp(`^${count} rose from \\d+ to \\d+\\.`))]);
    expect(planted[count]).toBe((asTheyAre[count] ?? 0) + 1);
  });

  // The engine's checks of a unit by its type's name (plan P1-19, Decision 7): a comparison planted in a file of
  // src/engine/ raises unitNameChecksInEngine by one, and the ratchet fails on it; one planted in src/engine/rules/ (the
  // registry's effects, which ask their content rows) or in a page's code isn't counted.
  test.for([
    ['src/engine/battle/x.ts', 1],
    ['src/engine/rules/x.ts', 0],
    ['src/ui/gm/x.ts', 0],
  ] as const)('a unit-name comparison planted in %s raises unitNameChecksInEngine by %i', ([file, rise]) => {
    const files = theCodeFiles();
    const asTheyAre = { ...readBaseline(), unitNameChecksInEngine: unitNameChecksInEngine(files) };
    expect(asTheyAre.unitNameChecksInEngine).toBe(readBaseline()['unitNameChecksInEngine']);
    const planted = {
      ...asTheyAre,
      unitNameChecksInEngine: unitNameChecksInEngine([
        ...files,
        [file, "export const planted = (t: string): boolean => t === 'Goblin Horde';\n"],
      ]),
    };
    expect(planted.unitNameChecksInEngine).toBe(asTheyAre.unitNameChecksInEngine + rise);
    const { rose } = compare(asTheyAre, planted);
    expect(rose).toHaveLength(rise);
    expect(rose.filter((r) => /^unitNameChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
  });

  // measure() runs knip for unusedCode: a few seconds, more on a slow runner.
  test('no count is above its baseline', timeLimitForTheWork({ toolRuns: 1 }), () => {
    const { rose } = compare(readBaseline(), measure());
    expect(rose, 'Lower what rose, or, if the rise is right, talk it through with Theo.').toEqual([]);
  });

  // P1-09e: src/ has no JavaScript left but public/'s two classic scripts (copied as they are). P1-13b: ESLint's
  // suppressions are counted from their file (above), so they only fall; its warnings no longer, since no rule warns.
  test("it counts ESLint's suppressions and public/'s two scripts", timeLimitForTheWork({ toolRuns: 1 }), () => {
    const now = measure();
    expect(now['eslintSuppressions']).toBe(eslintSuppressions());
    expect(now['eslintSuppressions']).toBeGreaterThan(0);
    expect(now).not.toHaveProperty('eslintWarnings');
    expect(now['sourceJavascriptFiles']).toBe(2);
  });

  // P1-13a: the import rules' known violations and knip's findings are counted, so they only fall (plan P1-13,
  // Decision 4). The known violations are the entries of dependency-cruiser's own list, the one npm run lint:arch lets
  // through.
  test(
    "it counts the import rules' known violations and what knip finds unused",
    timeLimitForTheWork({ toolRuns: 1 }),
    () => {
      const now = measure();
      const known = JSON.parse(read(KNOWN_ARCHITECTURE_VIOLATIONS_FILE)) as unknown[];
      expect(now['knownArchitectureViolations']).toBe(known.length);
      expect(now['unusedCode']).toBeGreaterThan(0);
      for (const key of ['knownArchitectureViolations', 'unusedCode']) expect(readBaseline()[key], key).toBeDefined();
    },
  );
});

// The architecture rules (plan P1-13a, Decisions 2 to 4): dependency-cruiser's layers and no cycle, every rule an error,
// with only the findings of its known-violations list let through; knip from the pages' real entries, with nothing
// left out but the quarantine. tests/static/the-architecture-rules-refuse-planted-imports-cycles-and-unused-code.test.ts
// shows each rule refusing its planted case.
describe('the architecture rules', () => {
  test('npm run lint:arch runs dependency-cruiser over src/, letting through only the known violations', () => {
    expect(pkg.scripts['lint:arch']).toBe('depcruise src --ignore-known --output-type err');
    expect(pkg.scripts['knip']).toBe('knip');
    expect(KNOWN_ARCHITECTURE_VIOLATIONS_FILE).toBe('.dependency-cruiser-known-violations.json');
    // one config: dependency-cruiser would read another of these names first
    for (const f of ['.json', '.js', '.cjs', '.mjs', '.ts', '.cts'].map((x) => '.dependency-cruiser' + x)) {
      expect(fs.existsSync(path.join(ROOT, f)), f).toBe(false);
    }
  });

  test("every rule is an error, the layers are the plan's, and a cycle counts only through imports that bring code", () => {
    expect(archConfig.allowed).toBeUndefined();
    expect(archConfig.required).toBeUndefined();
    const rules = archConfig.forbidden ?? [];
    expect(rules.filter((r) => r.severity !== 'error').map((r) => r.name)).toEqual([]);
    expect(rules.map((r) => r.name)).toEqual([
      'no-cycle-through-imports-that-bring-code',
      'the-content-imports-nothing',
      'the-engine-imports-only-the-engine-and-the-content',
      'the-rules-on-plain-values-import-only-each-other-and-the-content',
      // plan P1-19, Decision 6 (P1-19a)
      'the-rule-registry-imports-only-itself-the-rules-on-plain-values-and-the-content',
      'the-views-import-only-the-views-the-engine-and-the-content',
      'shared-imports-only-the-views-the-rules-on-plain-values-and-the-content',
      'the-schemas-are-imported-for-code-by-the-saves-upgrade-alone',
      'the-database-code-imports-only-itself-and-the-schemas',
      'only-the-pages-import-the-database-code',
      'a-page-imports-no-other-pages-code-but-ui-shared',
      'ui-shared-imports-only-itself',
      'only-the-gm-page-imports-the-engine',
      'only-src-db-imports-supabase-js',
      'every-import-resolves',
    ]);
    const cycle = rules[0];
    expect(cycle?.from).toEqual({ path: '^src/' });
    expect(cycle && 'to' in cycle ? cycle.to : undefined).toEqual({
      circular: true,
      viaOnly: { dependencyTypesNot: ['type-only'] },
    });
    // Imports are read before TypeScript erases the type-only ones, so each is seen and labelled as the cycle rule and
    // the schemas' rule expect (and as the known violations were counted); every file of src/ is read: none left out.
    const options = archConfig.options ?? {};
    expect(options.tsPreCompilationDeps).toBe(true);
    expect(options.doNotFollow).toEqual({ path: 'node_modules' });
    for (const key of ['exclude', 'includeOnly', 'focus', 'reaches', 'collapse'])
      expect(options, key).not.toHaveProperty(key);
  });

  test("knip starts from every page's entries and leaves out only the quarantine", () => {
    expect(Object.keys(knipConfig).sort()).toEqual(['entry', 'ignore', 'ignoreExportsUsedInFile', 'project']);
    expect(knipConfig.ignore).toEqual(['tests/quarantine/**']);
    expect(knipConfig.ignoreExportsUsedInFile).toBe(true);
    const entry: string[] = knipConfig.entry;
    for (const page of ['src/ui/gm/page.ts', 'src/ui/player/page.ts', 'src/rulebook/toc.ts'])
      expect(entry).toContain(page);
    expect(entry).toContain('tests/balance/scenarios/*.ts');
  });
});
