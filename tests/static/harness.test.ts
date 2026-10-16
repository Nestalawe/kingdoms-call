// The harness checks itself (P1-01b; plan "The harness, enforced, not remembered"). Fails if a setting that keeps the
// tests honest is missing or weakened: the compiler flags, the lint rules' severities, no retries and no .only, the
// test run's own checks, the Node pin, the Claude Code hooks and their stop limit, the dangerous paths, and the
// ratchet. Every later step that adds a guarantee adds its check here. Level 1 (static): it reads settings files
// and the counts, and runs nothing.
import fs from 'node:fs';
import path from 'node:path';
import { ESLint, type Linter } from 'eslint';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import config from '../../vitest.config.mts';
import dangerous from '../../.github/scripts/dangerous-paths.js';
import { CHECK_LEVELS } from '../../tools/check.ts';
import { decide, STOP_LIMIT } from '../../tools/hooks/before-stop.ts';
import { BASELINE_FILE, compare, measure, readBaseline } from '../../tools/ratchet.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>;
  engines?: { node?: string };
  packageManager?: string;
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

  test('it checks the tests and the tools', () => {
    const files = parsed.fileNames.map((f) => path.relative(ROOT, f));
    for (const f of [
      'tests/static/harness.test.ts',
      'tests/legacy.test.ts',
      'tools/check.ts',
      'tools/hooks/after-edit.ts',
    ]) {
      expect(files, f).toContain(f);
    }
  });
});

describe('the lint rules', () => {
  const eslint = new ESLint({ cwd: ROOT });
  const level = (v: Linter.RuleEntry | undefined): number => {
    const s = Array.isArray(v) ? v[0] : v;
    return s === 'error' || s === 2 ? 2 : s === 'warn' || s === 1 ? 1 : 0;
  };
  // What the shared configs ask for: ESLint's recommended rules, then typescript-eslint's strictest type-checked set.
  // Only eslint-config-prettier may switch one off (formatting is Prettier's).
  const expected: Partial<Linter.RulesRecord> = {};
  for (const c of [js.configs.recommended, ...tseslint.configs.strictTypeChecked]) Object.assign(expected, c.rules);
  const formatting = new Set(Object.keys(prettier.rules));

  test.for(['tests/static/harness.test.ts', 'tools/check.ts', 'vitest.config.mts'])(
    '%s gets the strict rules at full strength',
    async (file) => {
      expect(await eslint.isPathIgnored(path.join(ROOT, file))).toBe(false);
      const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config).rules ?? {};
      const weaker = Object.entries(expected)
        .filter(([rule, v]) => !formatting.has(rule) && level(rules[rule]) < level(v))
        .map(([rule]) => rule);
      expect(weaker).toEqual([]);
      expect(level(rules['@typescript-eslint/switch-exhaustiveness-check'])).toBe(2);
    },
  );

  test('a focused or skipped test is an error', async () => {
    const rules = ((await eslint.calculateConfigForFile(path.join(ROOT, 'tests/static/x.test.ts'))) as Linter.Config)
      .rules;
    expect(level(rules?.['vitest/no-focused-tests'])).toBe(2);
    expect(level(rules?.['vitest/no-disabled-tests'])).toBe(2);
  });
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

  test('npm run check runs the type check, lint, format, ratchet and every level but page', () => {
    expect(pkg.scripts['check']).toBe('tsx tools/check.ts');
    expect(read('tools/check.ts')).toMatch(/typecheck\(\), lint\(files\), format\(files\), ratchet\(\)/);
    expect(read('tools/check.ts')).toContain('await tests(files)');
    expect(CHECK_LEVELS).toEqual(['static', 'unit', 'scenario', 'simulation']);
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
      'knip.json',
      '.nvmrc',
      '.npmrc',
      'package.json',
      'package-lock.json',
      'tests/setup/each.ts',
      'tests/setup/global.ts',
      'tests/legacy.test.ts',
      'tests/ratchet.json',
      'tests/static/harness.test.ts',
      'tests/balance/matrix.test.ts',
      'tools/hooks/after-edit.ts',
      'tools/hooks/before-stop.ts',
      'tools/check.ts',
      'tools/ratchet.ts',
      '.github/workflows/ci.yml',
    ];
    expect(harness.filter((f) => !dangerous.isDangerous(f, globs))).toEqual([]);
  });
});

describe('the ratchet', () => {
  test('npm run ratchet reads tests/ratchet.json', () => {
    expect(pkg.scripts['ratchet']).toBe('tsx tools/ratchet.ts');
    expect(path.relative(ROOT, BASELINE_FILE)).toBe('tests/ratchet.json');
  });

  test('no count is above its baseline', () => {
    const { rose } = compare(readBaseline(), measure());
    expect(rose, 'Lower what rose, or, if the rise is right, talk it through with Theo.').toEqual([]);
  });
});
