// npm run check: the quick check an agent runs before it finishes (the Stop hook runs it too: tools/hooks/).
// It looks at what this branch changes (against main, plus anything not yet committed) and runs, side by side:
// the type check (incremental), ESLint (cached) and Prettier on the changed files, the import rules over all of src/
// (npm run lint:arch, under a second) and the ratchet (tools/ratchet.ts); then the tests. The full suite, page level
// included, runs in CI.
//
// Which tests: `vitest related` finds the Vitest tests that import a changed TypeScript file. It can't see what the
// test scripts (tests/*.test.js) read: each runs in its own process and loads site/ (built from src/) by file name. So
// when anything else changes (src/, docs, a test script, tests/setup/, a config), it runs every level but page instead (Theo,
// 2026-10-16): about 17 s.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { compare, measure, readBaseline } from './ratchet.ts';

export const ROOT = path.resolve(import.meta.dirname, '..');
// Git-ignored (inside node_modules/): the type check's and ESLint's caches, the Stop hook's counts.
export const CACHE = path.join(ROOT, 'node_modules', '.cache', 'kc');
const BIN = path.join(ROOT, 'node_modules', '.bin');
// The levels npm run check runs; page is left to CI (it takes about a minute on its own).
export const CHECK_LEVELS = ['static', 'unit', 'scenario', 'simulation'];

export interface Step {
  name: string;
  ok: boolean;
  ms: number;
  // What the step printed, when it failed (or a one-line note when it was skipped).
  out: string;
}

interface Ran {
  code: number | null;
  out: string;
}

function run(cmd: string, args: string[]): Promise<Ran> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(cmd, args, { cwd: ROOT, env: process.env });
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.on('error', (e) => {
      resolve({ code: null, out: out + e.message });
    });
    child.on('close', (code) => {
      resolve({ code, out });
    });
  });
}

async function step(name: string, body: () => Promise<{ ok: boolean; out: string }>): Promise<Step> {
  const start = Date.now();
  const { ok, out } = await body();
  return { name, ok, ms: Date.now() - start, out };
}

const git = async (...args: string[]) => (await run('git', args)).out.split('\n').filter(Boolean);

// The files this branch changes against main, and any not yet committed (new files too), that still exist.
export async function changedFiles(): Promise<string[]> {
  let base = '';
  for (const ref of ['origin/main', 'main']) {
    const r = await run('git', ['merge-base', 'HEAD', ref]);
    if (r.code === 0) {
      base = r.out.trim();
      break;
    }
  }
  const lists = await Promise.all([
    base ? git('diff', '--name-only', base, 'HEAD') : Promise.resolve([]),
    git('diff', '--name-only', 'HEAD'),
    git('ls-files', '--others', '--exclude-standard'),
  ]);
  return [...new Set(lists.flat())].filter((f) => fs.existsSync(path.join(ROOT, f))).sort();
}

const isTs = (f: string) => /\.(ts|mts)$/.test(f);
// A change vitest related can follow: TypeScript that tests import (not the setup files, which no test imports).
const traceable = (f: string) => isTs(f) && /^(tests|tools)\//.test(f) && !f.startsWith('tests/setup/');

export const typecheck = () =>
  step('type check', async () => {
    const r = await run(path.join(BIN, 'tsc'), [
      '--noEmit',
      '--incremental',
      '--tsBuildInfoFile',
      path.join(CACHE, 'tsbuildinfo'),
    ]);
    return { ok: r.code === 0, out: r.out };
  });

// ESLint lints the TypeScript: src/ (the site's tier: eslint.config.js) and the tests' and tools'.
const linted = (f: string) => isTs(f);

export const lint = (files: string[]) =>
  step('lint', async () => {
    const ts = files.filter(linted);
    if (!ts.length) return { ok: true, out: 'nothing ESLint lints changed' };
    const r = await run(path.join(BIN, 'eslint'), [
      '--cache',
      '--cache-location',
      path.join(CACHE, 'eslint'),
      '--no-warn-ignored',
      ...ts,
    ]);
    return { ok: r.code === 0, out: r.out };
  });

// Prettier skips the files .prettierignore leaves out (it lists the formatted files: the new ones, src/'s .js and
// .css, public/'s two scripts).
export const format = (files: string[]) =>
  step('format', async () => {
    if (!files.length) return { ok: true, out: 'nothing changed' };
    const r = await run(path.join(BIN, 'prettier'), ['--check', '--ignore-unknown', ...files]);
    return {
      ok: r.code === 0,
      out: r.code === 0 ? '' : `${r.out}\nFix with:  npx prettier --write ${files.join(' ')}`,
    };
  });

// The layers and cycles (plan P1-13, .dependency-cruiser.mts): every file of src/, since an import anywhere can make a
// cycle; the known violations are let through.
export const lintArch = () =>
  step('import rules', async () => {
    const r = await run('npm', ['run', '--silent', 'lint:arch']);
    return { ok: r.code === 0, out: r.code === 0 ? '' : r.out };
  });

export const ratchet = () =>
  step('ratchet', () => {
    const { rose } = compare(readBaseline(), measure());
    return Promise.resolve({ ok: !rose.length, out: rose.join('\n') });
  });

export const tests = (files: string[]) =>
  step('tests', async () => {
    if (!files.length) return { ok: true, out: 'nothing changed' };
    const projects = CHECK_LEVELS.flatMap((l) => ['--project', l]);
    const all = files.some((f) => !traceable(f));
    const args = all ? ['run', ...projects] : ['related', '--run', '--passWithNoTests', ...projects, ...files];
    const r = await run(path.join(BIN, 'vitest'), args);
    const what = all ? `levels ${CHECK_LEVELS.join(', ')}` : 'the tests that import the changed files';
    const tail = r.out.trimEnd().split('\n').slice(-80).join('\n');
    return { ok: r.code === 0, out: r.code === 0 ? what : `${what}\n${tail}` };
  });

// Everything npm run check runs, in order of the report.
export async function runCheck(): Promise<Step[]> {
  fs.mkdirSync(CACHE, { recursive: true });
  const files = await changedFiles();
  const quick = await Promise.all([typecheck(), lint(files), format(files), lintArch(), ratchet()]);
  return [...quick, await tests(files)];
}

const seconds = (ms: number) => (ms / 1000).toFixed(1) + ' s';

export function report(steps: Step[]): string {
  const lines = steps.map(
    (s) => `${s.ok ? '✓' : '✗'} ${s.name} (${seconds(s.ms)})${s.ok && s.out.trim() ? ': ' + s.out.trim() : ''}`,
  );
  for (const s of steps.filter((x) => !x.ok)) lines.push('', `--- ${s.name} failed:`, s.out.trimEnd());
  return lines.join('\n');
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  const start = Date.now();
  void runCheck().then((steps) => {
    const ok = steps.every((s) => s.ok);
    console.log(report(steps));
    console.log(`\nnpm run check ${ok ? 'passed' : 'failed'} in ${seconds(Date.now() - start)}.`);
    process.exitCode = ok ? 0 : 1;
  });
}
