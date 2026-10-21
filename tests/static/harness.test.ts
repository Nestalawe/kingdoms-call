// The harness checks itself (P1-01b; plan "The harness, enforced, not remembered"). Fails if a setting that keeps the
// tests honest is missing or weakened: the compiler flags, the lint rules' severities, no retries and no .only (in
// Vitest and in Playwright), the test runs' own checks, the Node pin, the Claude Code hooks and their stop limit, the
// CI jobs and the required "ci" check, the build that every test job, the deploy and staging run first (P1-05), the
// balance job and its engine paths, the nightly random-seed run and fast-check's seed, the dangerous paths, and the
// ratchet, the architecture rules (dependency-cruiser and knip, P1-13a), and ESLint's bulk suppressions (P1-13b). It
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
  ESLINT_SUPPRESSIONS_FILE,
  eslintSuppressions,
  KNOWN_ARCHITECTURE_VIOLATIONS_FILE,
  measure,
  readBaseline,
} from '../../tools/ratchet.ts';
import { LEVELS } from '../suite.ts';

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
  // them (tsNocheck), so they only fall.
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
  // TypeScript checks, and isn't looked for in one it skips.
  test.for([
    ['src/engine/clock.ts', true],
    ['src/engine/turn/context.ts', false],
  ] as const)('%s: a planted type-aware finding is an error: %s', async ([file, isError]) => {
    expect(typeChecked(file)).toBe(isError);
    const code = read(file) + '\nexport const planted = (x: string | undefined) => x || "a";\n';
    const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
    const found = (result?.messages ?? []).filter((m) => m.ruleId === '@typescript-eslint/prefer-nullish-coalescing');
    expect(found.map((m) => m.severity)).toEqual(isError ? [2] : []);
  });
  test(
    "every file of src/ gets the site's rules, each an error, and the type-aware ones exactly when TypeScript checks it",
    { timeout: 60_000 },
    async () => {
      const wrong: string[] = [];
      for (const file of srcFiles) {
        expect(await eslint.isPathIgnored(path.join(ROOT, file)), file).toBe(false);
        const config = (await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config;
        const rules = config.rules ?? {};
        const checked = typeChecked(file);
        // globals.d.ts may write `declare var` (TypeScript's form for a global: eslint.config.js)
        const allowedOff = [...(file === 'src/globals.d.ts' ? ['no-var'] : []), ...(checked ? [DISAGREE] : [])];
        const off = notAtError({ ...siteExpected, ...(checked ? typedExpected : {}) }, rules).filter(
          (rule) => rule !== NO_ASSERTIONS,
        );
        if (off.join() !== allowedOff.join()) wrong.push(`${file}: not errors: ${off.join(', ')}`);
        if (level(rules['no-undef']) !== 2) wrong.push(`${file}: no-undef`);
        const ban = rules['@typescript-eslint/ban-ts-comment'];
        if (
          level(ban) !== 2 ||
          JSON.stringify(Array.isArray(ban) ? ban[1] : undefined) !== '{"ts-nocheck":"allow-with-description"}'
        )
          wrong.push(`${file}: ban-ts-comment`);
        if (level(rules[NO_NON_NULL]) !== 2) wrong.push(`${file}: ${NO_NON_NULL}`);
        // the type assertions kept are the test below's
        const assertions = rules[NO_ASSERTIONS];
        if (
          level(assertions) === 2 &&
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
  // const` is no claim (it narrows a literal), so it stays.
  test.for(['src/engine/turn/context.ts', 'src/ui/player/map.ts'])(
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

  // The type assertions src/ held when the rule came in (eslint.config.js's TYPE_ASSERTIONS_KEPT, written by P1-11a3):
  // only those files may hold one, one each, and the list only shrinks (P1-10b replaces each with a check).
  test('only the type assertions kept from before the rule are let through, one a file, and no more files', async () => {
    const KEPT = [
      'src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts',
      'src/engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts',
      'src/engine/rules-on-plain-values/unit-types-and-base-strength.ts',
    ];
    const assertionsIn = (file: string): number => {
      const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
      let n = 0;
      const visit = (node: ts.Node): void => {
        if (
          (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
          !(ts.isTypeReferenceNode(node.type) && node.type.getText(source) === 'const')
        )
          n++;
        ts.forEachChild(node, visit);
      };
      visit(source);
      return n;
    };
    const off: string[] = [];
    for (const f of filesUnder(path.join(ROOT, 'src')).filter((x) => x.endsWith('.ts'))) {
      const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, 'src', f))) as Linter.Config).rules ?? {};
      if (level(rules[NO_ASSERTIONS]) < 2) off.push('src/' + f);
    }
    expect(off.filter((f) => !KEPT.includes(f))).toEqual([]);
    for (const f of off) expect(assertionsIn(f), f).toBe(1);
  });

  test('a focused or skipped test is an error', async () => {
    const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, 'tests/static/x.test.ts'))) as Linter.Config)
      .rules;
    expect(level(rules?.['vitest/no-focused-tests'])).toBe(2);
    expect(level(rules?.['vitest/no-disabled-tests'])).toBe(2);
  });

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
  test('no rule is at warn, in any file ESLint lints', { timeout: 60_000 }, async () => {
    const linted = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT })
      .toString()
      .split('\0')
      .filter((f) => /\.(ts|mts)$/.test(f) && fs.existsSync(path.join(ROOT, f)));
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
    { timeout: 60_000 },
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
    // Checkouts: the default branch (no ref) or the pull request's base commit, only the script and the Node pin.
    expect([...wf.matchAll(/^ +ref: (.+)$/gm)].map((m) => m[1])).toEqual(['${{ github.event.pull_request.base.sha }}']);
    const sparse = [...wf.matchAll(/sparse-checkout: \|\n((?: {12}.+\n)+)/g)].map((m) =>
      (m[1] ?? '').trim().split(/\s+/),
    );
    expect(sparse).toEqual([
      ['.nvmrc', 'tools/github/balance-comment.ts'],
      ['.nvmrc', 'tools/github/balance-comment.ts'],
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
  // imports, and the tools it runs on (the locked packages, the Node pin).
  test('the engine paths are the ones the plan lists, and the runner uses the same list', () => {
    const page = pageSources();
    expect(page).toContain('src/content/kingdoms-call-data.ts');
    expect(page).toContain('src/engine/run-turn.ts');
    expect(page.filter((f) => !isEnginePath(f))).toEqual([]);
    // Under src/, the engine paths are exactly the page's sources and the pages' templates: no other page's code plays
    // the matrix.
    const src = filesUnder(path.join(ROOT, 'src')).map((f) => 'src/' + f);
    const templates = pageNames().map((p) => 'src/' + p);
    expect(src.filter(isEnginePath).sort()).toEqual(
      [...new Set([...page.filter((f) => f.startsWith('src/')), ...templates])].sort(),
    );
    const dir = path.join(ROOT, 'tools', 'balance');
    const helpers = fs
      .readdirSync(dir)
      .flatMap((f) => [
        ...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/ from '\.\.\/\.\.\/(tests\/lib\/[^']+)'/g),
      ])
      .map((m) => m[1] ?? '');
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
  });

  test('no job lets a failure through, retries or repeats', () => {
    for (const weak of ['continue-on-error', '|| true', '--retries', '--retry', '--repeat-each', '--bail', '--pass']) {
      expect(ci, weak).not.toContain(weak);
    }
  });

  test("the db job lints the database's functions and fails on any finding", () => {
    expect(runs('db')).toContain('supabase db lint --local --level warning --fail-on warning');
  });

  test('deploy runs this workflow and publishes only when all of it passed', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toMatch(/^ {2}ci:\n {4}uses: \.\/\.github\/workflows\/ci\.yml$/m);
    expect(deploy).toContain("needs.ci.result == 'success'");
  });

  // P1-05: what is published is built from this commit's src/, just before it is published; P1-09d: by Vite, installed
  // from the lock file first.
  test('deploy and staging install the build, then build site/ from src/ before they publish it', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toMatch(
      /^ {6}- run: npm ci --ignore-scripts\n\n {6}- run: npm run build\n\n {6}- uses: actions\/upload-pages-artifact@v\d+\n {8}with:\n {10}path: site\/$/m,
    );
    const staging = read('.github/workflows/staging.yml');
    const build = staging.indexOf('run: npm run build');
    expect(build).toBeGreaterThan(0);
    expect(staging.indexOf('run: npm ci')).toBeGreaterThan(0);
    expect(staging.indexOf('run: npm ci')).toBeLessThan(build);
    expect(build).toBeLessThan(staging.indexOf('> site/kc-config.js'));
    expect(staging.indexOf('> site/kc-config.js')).toBeLessThan(staging.indexOf('cp -R site/. staging-repo/'));
  });

  // Every job that holds a secret or a deploy token installs from the lock file without running its packages' install
  // scripts: npm ci --ignore-scripts, nothing else (the build needs none). Read from each workflow's text, job by job
  // (each job's id two spaces in, under "jobs:"), with its comments left out; what a workflow sets above "jobs:" counts
  // for every job in it.
  const HOLDS_A_SECRET = /secrets\.|github\.token|id-token: write|pages: write|environment:/;
  const AN_INSTALL = /\bnpm +(?:ci|install|i|add|update|rebuild)\b.*$/gm;
  function installsInJobsWithSecrets(workflow: string): { checked: string[]; wrong: string[] } {
    const text = workflow.replace(/^\s*#.*$/gm, '');
    const [head = '', body = ''] = text.split(/^jobs:\n/m);
    const checked: string[] = [];
    const wrong: string[] = [];
    for (const block of body.split(/^(?= {2}[\w-]+:\n)/m)) {
      const id = /^ {2}([\w-]+):\n/.exec(block)?.[1];
      if (!id || !HOLDS_A_SECRET.test(head + block)) continue;
      for (const [install] of block.matchAll(AN_INSTALL)) {
        checked.push(id);
        if (install.trim() !== 'npm ci --ignore-scripts') wrong.push(`${id}: ${install.trim()}`);
      }
    }
    return { checked, wrong };
  }
  const workflows = fs
    .readdirSync(path.join(ROOT, '.github', 'workflows'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => ({ f, text: read(`.github/workflows/${f}`) }));

  test('every job that holds a secret or a deploy token installs with npm ci --ignore-scripts', () => {
    const checked: string[] = [];
    for (const { f, text } of workflows) {
      const found = installsInJobsWithSecrets(text);
      expect(found.wrong, f).toEqual([]);
      checked.push(...found.checked.map((id) => `${f} ${id}`));
    }
    expect(checked).toEqual(expect.arrayContaining(['deploy.yml deploy', 'staging.yml staging']));
  });

  test('a planted job that holds a secret and installs any other way is caught', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const staging = read('.github/workflows/staging.yml');
    expect(installsInJobsWithSecrets(deploy.replace('npm ci --ignore-scripts', 'npm ci')).wrong).toEqual([
      'deploy: npm ci',
    ]);
    expect(installsInJobsWithSecrets(staging.replace('npm ci --ignore-scripts', 'npm install')).wrong).toEqual([
      'staging: npm install',
    ]);
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
      'tools/github/balance-comment.ts',
      'tools/hooks/after-edit.ts',
      'tools/hooks/before-stop.ts',
      'tools/check.ts',
      'tools/ratchet.ts',
      'tools/build.ts',
      'tools/pages.ts',
      'tools/dev.ts',
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

  // measure() runs knip for unusedCode: a few seconds, more on a slow runner.
  test('no count is above its baseline', { timeout: 60_000 }, () => {
    const { rose } = compare(readBaseline(), measure());
    expect(rose, 'Lower what rose, or, if the rise is right, talk it through with Theo.').toEqual([]);
  });

  // P1-09e: src/ has no JavaScript left but public/'s two classic scripts (copied as they are). P1-13b: ESLint's
  // suppressions are counted from their file (above), so they only fall; its warnings no longer, since no rule warns.
  test("it counts ESLint's suppressions and public/'s two scripts", { timeout: 60_000 }, () => {
    const now = measure();
    expect(now['eslintSuppressions']).toBe(eslintSuppressions());
    expect(now['eslintSuppressions']).toBeGreaterThan(0);
    expect(now).not.toHaveProperty('eslintWarnings');
    expect(now['sourceJavascriptFiles']).toBe(2);
  });

  // P1-13a: the import rules' known violations and knip's findings are counted, so they only fall (plan P1-13,
  // Decision 4). The known violations are the entries of dependency-cruiser's own list, the one npm run lint:arch lets
  // through.
  test("it counts the import rules' known violations and what knip finds unused", { timeout: 60_000 }, () => {
    const now = measure();
    const known = JSON.parse(read(KNOWN_ARCHITECTURE_VIOLATIONS_FILE)) as unknown[];
    expect(now['knownArchitectureViolations']).toBe(known.length);
    expect(now['unusedCode']).toBeGreaterThan(0);
    for (const key of ['knownArchitectureViolations', 'unusedCode']) expect(readBaseline()[key], key).toBeDefined();
  });
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
      'the-views-import-only-the-views-the-engine-and-the-content',
      'shared-imports-only-the-views-the-rules-on-plain-values-and-the-content',
      'schemas-are-imported-as-types-only',
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
