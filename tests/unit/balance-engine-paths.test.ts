// The balance job's first step (tools/balance/engine-paths.ts, P1-02b): which files are engine paths, whether a pull
// request or a merge changed one (then CI plays the matrix), and the refactor-only check (a PR labelled refactor-only
// may not change the balance baseline). The step runs before npm ci, so the file must run in plain Node: erasable
// TypeScript, no npm imports. Level 1 (unit): pure functions, and the step itself run by plain Node on a throwaway git
// repository made here (nothing is played, nothing reads the network).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The balance job's first step (P1-02b): which files are engine paths (the files under `src/` the GM portal and every
// script its page loads are built from, and the build (P1-05), the balance code, baselines and named scenarios, the
// helpers they import, `package-lock.json` and `.nvmrc`; not the other pages or tests); the decision (no engine path:
// nothing played; refactor-only with a changed baseline: fails at once; nothing to compare with: played); and the step
// itself in plain Node (no npm imports) on a throwaway git repository: a pull request's merge commit, a renamed file, a
// push of several commits. TypeScript, in `unit/`
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { decide, enginePathsIn, isEnginePath } from '../../tools/balance/engine-paths.ts';
import { pageSources } from '../../tools/balance/run.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'tools', 'balance', 'engine-paths.ts');

describe('the engine paths', () => {
  test.for([
    'src/kingdoms-call-gm-portal.html',
    'src/kingdoms-call-player-portal.html',
    'src/engine/run-turn.ts',
    'src/views/turn-report.ts',
    'src/content/kingdoms-call-data.ts',
    'src/ui/shared/kc-safe.ts',
    'src/db/kc-db-guard.ts',
    'public/kc-config.js',
    'public/kc-staging-footer.js',
    'public/vendor/supabase-js-2.117.3.min.js',
    'tools/build.ts',
    'tsconfig.json',
    'tools/pages.ts',
    'tools/balance/run.ts',
    'tools/balance/engine-paths.ts',
    'tests/balance/baseline/matrix.json',
    'tests/balance/scenarios/battle.ts',
    'tests/lib/boot.js',
    'tests/lib/scenario.js',
    'package-lock.json',
    '.nvmrc',
  ])('%s is one', (f) => {
    expect(isEnginePath(f)).toBe(true);
  });

  test.for([
    'src/ui/player/map.ts',
    'src/ui/player/style.css',
    'src/ui/landing/style.css',
    'src/rulebook/rulebook.css',
    'src/rulebook/toc.ts',
    'src/globals.d.ts',
    'src/engine.bak/run-turn.js',
    'site/kingdoms-call-gm-portal.html',
    'docs/ARCHITECTURE.md',
    'tests/lib/personal-combat.ts',
    'tests/unit/balance-hash.test.ts',
    'tools/check.ts',
    '.github/workflows/ci.yml',
    'package.json',
  ])('%s is not', (f) => {
    expect(isEnginePath(f)).toBe(false);
  });

  test('every file the matrix loads into its page is built from engine paths only', () => {
    const files = pageSources();
    expect(files).toContain('src/content/kingdoms-call-data.ts');
    expect(files).toContain('src/engine/run-turn.ts');
    expect(files.filter((f) => !isEnginePath(f))).toEqual([]);
  });

  test('every module the balance code and the named scenarios import from outside their folder is one', () => {
    const outside = ['tools/balance', 'tests/balance/scenarios'].flatMap((d) => {
      const dir = path.join(ROOT, d);
      return fs
        .readdirSync(dir)
        .flatMap((f) => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/ from '(\.\.\/[^']+)'/g)])
        .map((m) => path.relative(ROOT, path.resolve(dir, m[1] ?? '')));
    });
    expect(outside).toContain('tests/lib/boot.js');
    expect(outside).toContain('tests/lib/scenario.js');
    expect(outside.filter((f) => !isEnginePath(f))).toEqual([]);
  });

  test('enginePathsIn keeps the engine paths, in order', () => {
    expect(
      enginePathsIn(['docs/a.md', 'tests/lib/boot.js', 'src/ui/landing/style.css', 'tools/balance/play.ts']),
    ).toEqual(['tests/lib/boot.js', 'tools/balance/play.ts']);
  });
});

describe('the decision', () => {
  const engine = ['src/engine/run-turn.ts'];
  const baseline = ['tests/balance/baseline/matrix.json'];

  test('no engine path changed: nothing is played, in seconds', () => {
    const d = decide({ base: 'HEAD^1', changed: ['docs/traps.md', 'src/ui/landing/style.css'], refactorOnly: false });
    expect(d).toMatchObject({ play: false, fail: false });
    expect(d.lines.join('\n')).toContain('No engine path changed');
  });

  test('an engine path changed: the matrix is played', () => {
    const d = decide({ base: 'HEAD^1', changed: ['docs/traps.md', ...engine], refactorOnly: false });
    expect(d).toMatchObject({ play: true, fail: false });
    expect(d.lines.join('\n')).toContain('src/engine/run-turn.ts');
  });

  test('refactor-only, the baseline unchanged: played, so the games must come out identical', () => {
    expect(decide({ base: 'HEAD^1', changed: engine, refactorOnly: true })).toMatchObject({ play: true, fail: false });
  });

  test('refactor-only, and the baseline changed: fails at once, before anything is installed or played', () => {
    const d = decide({ base: 'HEAD^1', changed: [...engine, ...baseline], refactorOnly: true });
    expect(d).toMatchObject({ play: false, fail: true });
    expect(d.lines.join('\n')).toMatch(/refactor-only.*tests\/balance\/baseline\/matrix\.json/s);
  });

  test('a changed baseline without the label is a change to play, not a failure', () => {
    expect(decide({ base: 'HEAD^1', changed: baseline, refactorOnly: false })).toMatchObject({
      play: true,
      fail: false,
    });
  });

  test('nothing to compare with (a run by hand): always played', () => {
    expect(decide({ base: null, changed: [], refactorOnly: false })).toMatchObject({ play: true, fail: false });
    expect(decide({ base: null, changed: [], refactorOnly: true })).toMatchObject({ play: true, fail: false });
  });
});

describe('the step, in plain Node', () => {
  test('it imports nothing but Node itself', () => {
    // import … from 'x', import 'x', import('x'), require('x')
    const text = fs.readFileSync(SCRIPT, 'utf8');
    const from = [...text.matchAll(/\b(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(from.length).toBeGreaterThan(0);
    expect(from.filter((m) => !m?.startsWith('node:'))).toEqual([]);
  });

  // A throwaway repository: a base commit, then a branch merged into it the way GitHub builds a pull request's merge
  // commit (HEAD^1 is the base).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-engine-paths-'));
  const dir = path.join(tmp, 'repo');
  fs.mkdirSync(dir);
  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
  const write = (f: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  };
  const commit = (files: Record<string, string>) => {
    for (const [f, text] of Object.entries(files)) write(f, text);
    git('add', '-A');
    git('commit', '-q', '-m', 'c');
    return git('rev-parse', 'HEAD');
  };
  // The pull request's merge commit, from `main` and a branch with `files`.
  const pullRequest = (files: Record<string, string>) => {
    git('checkout', '-q', 'main');
    git('checkout', '-q', '-B', 'pr');
    commit(files);
    git('checkout', '-q', '--detach', 'main');
    git('merge', '-q', '--no-ff', '-m', 'merge', 'pr');
  };
  const run = (env: Record<string, string>) => {
    const out = path.join(tmp, 'output');
    fs.writeFileSync(out, '');
    // Plain Node: no tsx, nothing from NODE_OPTIONS.
    const r = spawnSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: 'utf8',
      env: { PATH: process.env['PATH'] ?? '', GITHUB_OUTPUT: out, ...env },
    });
    return { status: r.status, log: r.stdout + r.stderr, output: fs.readFileSync(out, 'utf8') };
  };

  git('init', '-q', '-b', 'main');
  const first = commit({
    'src/engine/run-turn.ts': 'v1',
    'tests/balance/baseline/matrix.json': '{}',
    'docs/a.md': 'a',
  });

  test('a pull request that changes no engine path: play=false', () => {
    pullRequest({ 'docs/a.md': 'b' });
    const r = run({ EVENT: 'pull_request', REFACTOR_ONLY: 'false' });
    expect(r.log).not.toContain('ExperimentalWarning');
    expect(r).toMatchObject({ status: 0, output: 'play=false\n' });
  });

  test('a pull request that changes the engine: play=true', () => {
    pullRequest({ 'src/engine/run-turn.ts': 'v2' });
    expect(run({ EVENT: 'pull_request', REFACTOR_ONLY: 'false' })).toMatchObject({ status: 0, output: 'play=true\n' });
  });

  test('a file renamed away from an engine path counts by its old name too', () => {
    git('checkout', '-q', 'main');
    git('checkout', '-q', '-B', 'pr');
    git('mv', 'src/engine/run-turn.ts', 'docs/old-run-turn.js');
    git('commit', '-q', '-m', 'mv');
    git('checkout', '-q', '--detach', 'main');
    git('merge', '-q', '--no-ff', '-m', 'merge', 'pr');
    expect(run({ EVENT: 'pull_request', REFACTOR_ONLY: 'false' })).toMatchObject({ status: 0, output: 'play=true\n' });
  });

  test('refactor-only with a changed baseline: exit 1, and the log says why', () => {
    pullRequest({ 'src/engine/run-turn.ts': 'v2', 'tests/balance/baseline/matrix.json': '{"x":1}' });
    const r = run({ EVENT: 'pull_request', REFACTOR_ONLY: 'true' });
    expect(r.status).toBe(1);
    expect(r.log).toContain('refactor-only');
    expect(r.output).toBe('play=false\n');
  });

  test('a merge into main is compared with the commit before the push, not just the last commit (deploy.yml)', () => {
    git('checkout', '-q', 'main');
    const before = git('rev-parse', 'HEAD');
    commit({ 'docs/a.md': 'c' });
    expect(run({ EVENT: 'push', BEFORE: before })).toMatchObject({ status: 0, output: 'play=false\n' });
    // A push of two commits: the engine change is in the first.
    commit({ 'src/engine/run-turn.ts': 'v3' });
    commit({ 'docs/a.md': 'd' });
    expect(run({ EVENT: 'push', BEFORE: before })).toMatchObject({ status: 0, output: 'play=true\n' });
    expect(run({ EVENT: 'push', BEFORE: first })).toMatchObject({ status: 0, output: 'play=true\n' });
  });

  test('no commit to compare with (a run by hand, or a new branch): play=true', () => {
    expect(run({ EVENT: 'workflow_dispatch' })).toMatchObject({ status: 0, output: 'play=true\n' });
    expect(run({ EVENT: 'push', BEFORE: '0'.repeat(40) })).toMatchObject({ status: 0, output: 'play=true\n' });
  });
});
