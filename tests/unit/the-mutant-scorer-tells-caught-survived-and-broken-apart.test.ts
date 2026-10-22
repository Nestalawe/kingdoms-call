// The mutant scorer (tools/mutants/run.ts, plan P1-21a) tells caught, survived and broken apart. It runs on a made-up
// git repository in a temporary folder, whose package.json scripts are named like the real ones and are small Node
// scripts: "test" checks a function in src/, "balance" compares a hash with a committed one, "typecheck" and "build"
// look for a planted marker. Its node_modules holds a package and a .cache folder.
// - Scored: a mutant the tests catch, one only the balance catches, one only the compiler catches, one that survives;
//   broken: no header, a file outside src/, a patch that doesn't apply, a build that fails.
// - It stops, scoring nothing, on a red control run, on a folder git would commit, on a dirty tree, and with CI set.
// - --only scores the patches named; results.json and each stage's log are written; the worktrees are gone (a killed
//   run's too) and the repository's worktree list and status are as before; node_modules is copied without .cache, and
//   the stages run without KC_SEED.
// - The time limit, at function level: a stage that never ends is stopped, with what it started, and reads "timed
//   out", against a limit about forty times what an ordinary stage takes here (a Node process: about 50 ms); what a
//   command leaves running when it ends is stopped with it.
// Level 1 (unit): it runs the scorer and processes on a made-up repository; no game is played. Static can't: it runs
// code. Each scorer run is about 60 npm runs of small scripts.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  runStage,
  scoreMutants,
  STAGES,
  WORKTREE_PREFIX,
  type PatchResult,
  type StageResult,
} from '../../tools/mutants/run.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kc-scorer-test-')));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const SCRIPTS = {
  // Each says what it found in node_modules and the environment, so the test can read it in the stage's log.
  'scripts/build.js': `const fs = require('fs');
console.log('node_modules/.cache: ' + fs.existsSync('node_modules/.cache'));
console.log('node_modules/a-package: ' + fs.existsSync('node_modules/a-package/index.js'));
console.log('KC_SEED: ' + (process.env.KC_SEED ?? 'unset'));
const marked = fs.readdirSync('src').filter((f) => fs.readFileSync('src/' + f, 'utf8').includes('BUILD-BREAKS'));
if (marked.length) { console.log('The build failed: ' + marked.join(', ')); process.exit(1); }
`,
  'scripts/typecheck.js': `const fs = require('fs');
const marked = fs.readdirSync('src').filter((f) => fs.readFileSync('src/' + f, 'utf8').includes('TYPE-ERROR'));
if (marked.length) { console.log('Type error in ' + marked.join(', ')); process.exit(1); }
`,
  'scripts/ok.js': `console.log('ok');\n`,
  'scripts/test.js': `const fs = require('fs');
const { sum } = require('../src/sum.js');
const passed = sum(2, 3) === 5;
const out = process.argv.find((a) => a.startsWith('--outputFile.json='));
const status = passed ? 'passed' : 'failed';
const report = { testResults: [{ name: process.cwd() + '/tests/sum.test.js', status,
  assertionResults: [{ fullName: 'sum adds two numbers', status }] }] };
if (out) fs.writeFileSync(out.slice('--outputFile.json='.length), JSON.stringify(report));
process.exit(passed ? 0 : 1);
`,
  'scripts/balance.js': `const crypto = require('crypto');
const fs = require('fs');
const { play } = require('../src/play.js');
const hash = crypto.createHash('sha256').update(play()).digest('hex');
const same = hash === fs.readFileSync('baseline.txt', 'utf8').trim();
console.log(same ? '1 of 1 games identical' : '0 of 1 games identical');
process.exit(same ? 0 : 1);
`,
};
const SOURCES = {
  'src/sum.js': `exports.sum = (a, b) => a + b;\n`,
  'src/play.js': `exports.play = () => 'north wins';\n`,
  'src/unused.js': `exports.unused = () => 1;\n`,
  'tests/sum.test.js': `// sum adds two numbers (run by scripts/test.js)\n`,
};
const hashOf = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function run(cwd: string, program: string, args: string[]): string {
  const r = spawnSync(program, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${program} ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
const git = (cwd: string, ...args: string[]) =>
  run(cwd, 'git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args]);

/** The repository's worktrees, by path. */
const worktreesOf = (repo: string) =>
  [...git(repo, 'worktree', 'list', '--porcelain').matchAll(/^worktree (.+)$/gm)].map((m) => m[1] ?? '');

let repositories = 0;
/** A made-up repository, committed: `baseline` is the balance's committed hash (default: the one play() gives). */
function makeRepository(baseline = hashOf('north wins')): string {
  const dir = path.join(tmp, `repository-${String(++repositories)}`);
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'made-up',
      private: true,
      scripts: {
        build: 'node scripts/build.js',
        typecheck: 'node scripts/typecheck.js',
        lint: 'node scripts/ok.js',
        'lint:arch': 'node scripts/ok.js',
        test: 'node scripts/test.js',
        balance: 'node scripts/balance.js',
      },
    }),
    '.gitignore': 'node_modules/\nignored-mutants/\n',
    'baseline.txt': `${baseline}\n`,
    ...SCRIPTS,
    ...SOURCES,
  };
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  fs.mkdirSync(path.join(dir, 'node_modules', 'a-package'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', 'a-package', 'index.js'), 'module.exports = 1;\n');
  fs.mkdirSync(path.join(dir, 'node_modules', '.cache', 'kc'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', '.cache', 'kc', 'engine.js'), '// a cache\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'made up');
  return dir;
}

const header = (imitates: string) => `Area: made-up\nImitates: ${imitates}\n\n`;
/** A patch made as a mutator makes one: the change made in the repository, `git diff`, then undone. */
function patchOf(repo: string, changes: Record<string, string>, head = header('a slip')): string {
  for (const [name, text] of Object.entries(changes)) fs.writeFileSync(path.join(repo, name), text);
  const diff = git(repo, 'diff');
  git(repo, 'checkout', '--', '.');
  return head + diff;
}

function patchesFor(repo: string): Record<string, string> {
  return {
    '01-the-tests-catch.patch': patchOf(
      repo,
      { 'src/sum.js': `exports.sum = (a, b) => a - b;\n` },
      header('the sum takes away'),
    ),
    '02-only-the-balance-catches.patch': patchOf(repo, { 'src/play.js': `exports.play = () => 'south wins';\n` }),
    '03-only-the-compiler-catches.patch': patchOf(repo, {
      'src/unused.js': `exports.unused = () => 1; // TYPE-ERROR\n`,
    }),
    '04-survives.patch': patchOf(repo, { 'src/unused.js': `exports.unused = () => 2;\n` }),
    '05-no-header.patch': patchOf(repo, { 'src/sum.js': `exports.sum = (a, b) => b + a;\n` }, ''),
    '06-outside-src.patch': patchOf(repo, {
      'src/sum.js': `exports.sum = (a, b) => a - b;\n`,
      'tests/sum.test.js': `// skipped\n`,
    }),
    '07-does-not-apply.patch': patchOf(repo, { 'src/sum.js': `exports.sum = (a, b) => a * b;\n` }).replace(
      /^-exports\.sum = \(a, b\) => a \+ b;$/m,
      '-exports.sum = (x, y) => x + y;',
    ),
    '08-the-build-fails.patch': patchOf(repo, { 'src/sum.js': `exports.sum = (a, b) => a + b; // BUILD-BREAKS\n` }),
  };
}

// The environment a stage would inherit, without the CI the test may run under; KC_SEED set, to show it is left out.
const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'CI')),
  KC_SEED: '99',
  ...extra,
});

async function score(repo: string, args: string[], extraEnv: Record<string, string> = {}) {
  const lines: string[] = [];
  const worktrees = path.join(tmp, `worktrees-of-${path.basename(repo)}`);
  fs.mkdirSync(worktrees, { recursive: true });
  const code = await scoreMutants(args, {
    cwd: repo,
    env: env(extraEnv),
    log: (line) => lines.push(line),
    tmp: worktrees,
  });
  return { code, out: lines.join('\n'), worktrees };
}

function writePatches(folder: string, patches: Record<string, string>): void {
  fs.mkdirSync(folder, { recursive: true });
  for (const [name, text] of Object.entries(patches)) fs.writeFileSync(path.join(folder, name), text);
}

// About 60 npm runs of small scripts: about 6 s here.
const SCORER_RUN = timeLimitForTheWork({ toolRuns: 3 });

describe('a run over eight patches', () => {
  let repo = '';
  let folder = '';
  let ran: Awaited<ReturnType<typeof score>>;
  let results: { base: string; control: StageResult[]; patches: PatchResult[] };
  let before: { worktrees: string[]; status: string };
  let left = '';
  const of = (patch: string): PatchResult => {
    const found = results.patches.find((p) => p.patch === patch);
    if (!found) throw new Error(`${patch} not scored`);
    return found;
  };

  beforeAll(async () => {
    repo = makeRepository();
    folder = path.join(tmp, 'session');
    writePatches(folder, patchesFor(repo));
    // A worktree a killed run left behind.
    left = path.join(tmp, `${WORKTREE_PREFIX}left-by-a-killed-run`);
    git(repo, 'worktree', 'add', '--detach', left, 'HEAD');
    before = {
      worktrees: worktreesOf(repo),
      status: git(repo, 'status', '--porcelain', '--ignored'),
    };
    ran = await score(repo, [folder]);
    results = JSON.parse(fs.readFileSync(path.join(folder, 'results.json'), 'utf8')) as typeof results;
  }, SCORER_RUN.timeout);

  test('it scores every patch and exits 0', () => {
    expect(ran.code, ran.out).toBe(0);
    expect(results.patches.map((p) => p.patch)).toEqual(Object.keys(patchesFor(repo)).sort());
    expect(results.base).toBe(git(repo, 'rev-parse', 'HEAD').trim());
    expect(ran.out).toMatch(/3 caught, 1 survived, 4 broken\./);
  });

  test('a mutant the tests catch: caught by the tests, with the failed test named', () => {
    const r = of('01-the-tests-catch.patch');
    expect([r.result, r.redStages, r.failedTests]).toEqual(['caught', ['tests'], ['sum adds two numbers']]);
    expect([r.area, r.imitates]).toEqual(['made-up', 'the sum takes away']);
  });

  test('a mutant only the balance catches: caught by the balance alone', () => {
    const r = of('02-only-the-balance-catches.patch');
    expect([r.result, r.redStages, r.failedTests]).toEqual(['caught', ['balance'], []]);
  });

  test('a mutant only the compiler catches: caught by the compiler alone', () => {
    const r = of('03-only-the-compiler-catches.patch');
    expect([r.result, r.redStages]).toEqual(['caught', ['compiler']]);
  });

  test('a mutant every stage lets through: survived, every stage green', () => {
    const r = of('04-survives.patch');
    expect([r.result, r.redStages]).toEqual(['survived', []]);
    expect(r.stages.map((s) => [s.stage, s.outcome])).toEqual(STAGES.map((s) => [s, 'green']));
  });

  test('broken, never survived: no header, a file outside src/, a patch that does not apply, a build that fails', () => {
    const broken = (patch: string) => [of(patch).result, of(patch).why];
    expect(broken('05-no-header.patch')).toEqual(['broken', 'no Area: or Imitates: line before the diff']);
    expect(broken('06-outside-src.patch')).toEqual(['broken', 'it changes a file outside src/: tests/sum.test.js']);
    expect(broken('07-does-not-apply.patch')).toEqual([
      'broken',
      expect.stringMatching(/^git apply refused it: error: patch failed: src\/sum\.js/),
    ]);
    expect(broken('08-the-build-fails.patch')).toEqual(['broken', 'the build failed (red)']);
    // Neither the outside file's patch nor the refused one ran a stage; the build's stopped at the build.
    expect(of('06-outside-src.patch').stages).toEqual([]);
    expect(of('07-does-not-apply.patch').stages).toEqual([]);
    expect(of('08-the-build-fails.patch').stages.map((s) => s.stage)).toEqual(['build']);
  });

  test("results.json and each stage's log are written, the control run's first", () => {
    expect(results.control.map((s) => [s.stage, s.outcome])).toEqual(STAGES.map((s) => [s, 'green']));
    for (const dir of ['control', '01-the-tests-catch', '04-survives'])
      for (const stage of STAGES) expect(fs.existsSync(path.join(folder, 'logs', dir, `${stage}.log`))).toBe(true);
    expect(fs.readFileSync(path.join(folder, 'logs', '02-only-the-balance-catches', 'balance.log'), 'utf8')).toMatch(
      /^\$ npm run balance\n[\s\S]*0 of 1 games identical/,
    );
    expect(fs.readFileSync(path.join(folder, 'logs', '01-the-tests-catch', 'lint.log'), 'utf8')).toMatch(
      /\$ npm run lint\n[\s\S]*\$ npm run lint:arch\n/,
    );
  });

  test("the worktrees are gone, a killed run's too, and the repository's worktree list and status are unchanged", () => {
    expect(ran.out).toContain(`Removing a worktree a killed run left: ${path.join(tmp, WORKTREE_PREFIX)}`);
    expect(before.worktrees).toEqual([repo, left]);
    expect(git(repo, 'status', '--porcelain', '--ignored')).toBe(before.status);
    expect(worktreesOf(repo)).toEqual([repo]);
    expect(fs.readdirSync(ran.worktrees)).toEqual([]);
  });

  test('node_modules is copied in without its caches, and the stages run without KC_SEED', () => {
    const build = fs.readFileSync(path.join(folder, 'logs', 'control', 'build.log'), 'utf8');
    expect(build).toContain('node_modules/.cache: false\nnode_modules/a-package: true\nKC_SEED: unset\n');
  });
});

describe('it stops, scoring nothing', () => {
  test('on a red control run: every mutant would read "caught"', SCORER_RUN, async () => {
    const repo = makeRepository(hashOf('a game that was never played'));
    const folder = path.join(tmp, 'red-control');
    writePatches(folder, { '04-survives.patch': patchesFor(repo)['04-survives.patch'] ?? '' });
    const { code, out } = await score(repo, [folder]);
    expect(code).toBe(1);
    expect(out).toMatch(/the base is red without any patch \(balance red; logs\/control\/\)/);
    expect(fs.existsSync(path.join(folder, 'results.json'))).toBe(false);
    expect(fs.existsSync(path.join(folder, 'logs', '04-survives'))).toBe(false);
  });

  test('on a folder git would commit, on a dirty tree, and with CI set', SCORER_RUN, async () => {
    const repo = makeRepository();
    const patches = { '04-survives.patch': patchesFor(repo)['04-survives.patch'] ?? '' };
    const committable = path.join(repo, 'mutants');
    writePatches(committable, patches);
    const inside = await score(repo, ['mutants']);
    expect([inside.code, inside.out]).toEqual([1, expect.stringMatching(/mutants is a folder git would commit/)]);

    const outside = path.join(tmp, 'stops');
    writePatches(outside, patches);
    fs.appendFileSync(path.join(repo, 'src', 'sum.js'), '// an uncommitted change\n');
    const dirty = await score(repo, [outside]);
    expect([dirty.code, dirty.out]).toEqual([1, expect.stringMatching(/the tree has uncommitted changes/)]);
    git(repo, 'checkout', '--', '.');

    const ci = await score(repo, [outside], { CI: 'true' });
    expect([ci.code, ci.out]).toEqual([1, 'npm run mutants: CI is set: the scoring run is never in CI (plan P1-21).']);
    expect(fs.existsSync(path.join(outside, 'logs'))).toBe(false);
  });
});

test('--only scores the patches named, from a folder the repository ignores', SCORER_RUN, async () => {
  const repo = makeRepository();
  const folder = path.join(repo, 'ignored-mutants');
  const all = patchesFor(repo);
  writePatches(folder, {
    '01-the-tests-catch.patch': all['01-the-tests-catch.patch'] ?? '',
    '04-survives.patch': all['04-survives.patch'] ?? '',
  });
  const { code, out } = await score(repo, ['ignored-mutants', '--only', '04-survives.patch']);
  expect(code, out).toBe(0);
  const results = JSON.parse(fs.readFileSync(path.join(folder, 'results.json'), 'utf8')) as { patches: PatchResult[] };
  expect(results.patches.map((p) => [p.patch, p.result])).toEqual([['04-survives.patch', 'survived']]);
  expect(fs.readdirSync(path.join(folder, 'logs')).sort()).toEqual(['04-survives', 'control']);
});

describe("a stage's time limit", () => {
  const node = process.execPath;
  const stage = (commands: string[][], limitMs: number, name: string) =>
    runStage(commands, { cwd: tmp, env: env(), logFile: path.join(tmp, 'limits', `${name}.log`), limitMs });
  // An ordinary stage here is a Node process: about 50 ms. The limit is forty times that.
  const LIMIT_MS = 2_000;
  fs.mkdirSync(path.join(tmp, 'limits'), { recursive: true });

  test('an ordinary stage is green, and one whose command fails is red, every command run', async () => {
    expect((await stage([[node, '-e', '']], LIMIT_MS, 'ordinary')).outcome).toBe('green');
    const red = await stage(
      [
        [node, '-e', 'process.exit(3)'],
        [node, '-e', 'console.log("the second ran")'],
      ],
      LIMIT_MS,
      'red',
    );
    expect(red.outcome).toBe('red');
    expect(fs.readFileSync(path.join(tmp, 'limits', 'red.log'), 'utf8')).toContain('the second ran');
  });

  // A shell that starts a Node process that never ends, writes its id, then waits for it or exits at once.
  const startingForever = (pidFile: string, then: 'wait' | 'exit 0') => [
    'sh',
    '-c',
    `"${node}" -e "setInterval(() => {}, 1000)" & echo $! > "${pidFile}"; ${then}`,
  ];
  // The kill is sent at once; the process is gone once the system has reaped it (a second at most).
  async function goneSoon(pidFile: string): Promise<boolean> {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    const alive = () => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    const until = performance.now() + 1_000;
    while (alive() && performance.now() < until) await new Promise((resolve) => setTimeout(resolve, 20));
    return !alive();
  }

  test('a stage that never ends is stopped at its limit, with what it started, and reads "timed out"', async () => {
    const pidFile = path.join(tmp, 'limits', 'forever.pid');
    const r = await stage([startingForever(pidFile, 'wait')], LIMIT_MS, 'forever');
    expect(r.outcome).toBe('timed out');
    expect(r.ms).toBeGreaterThanOrEqual(LIMIT_MS);
    expect(await goneSoon(pidFile)).toBe(true);
    expect(fs.readFileSync(path.join(tmp, 'limits', 'forever.log'), 'utf8')).toContain(
      `Stopped: past the stage's limit of ${String(LIMIT_MS)} ms.`,
    );
  });

  test('what a command leaves running when it ends is stopped with it', async () => {
    const pidFile = path.join(tmp, 'limits', 'left-running.pid');
    const r = await stage([startingForever(pidFile, 'exit 0')], LIMIT_MS, 'left-running');
    expect(r.outcome).toBe('green');
    expect(await goneSoon(pidFile)).toBe(true);
  });
});
