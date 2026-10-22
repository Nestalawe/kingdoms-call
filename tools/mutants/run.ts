// npm run mutants -- <folder> [--only <patch>,…]: the mutant scorer (plan P1-21a). A script, so the score is the same
// whoever runs it: no agent judges. Each mutant is a small fault written as a patch, and the question is "would the
// checks notice it?".
//
// - The base is this checkout's HEAD commit, and the tree must be clean (no uncommitted change to a tracked file), so a
//   test committed for a mutant is in place when that mutant is scored again. The table names the commit.
// - The folder holds the patches (*.patch, scored in name order), and gets results.json and each stage's output
//   (logs/<patch>/<stage>.log). It must be one git would never commit (outside the repository, or ignored there:
//   plan/mutants/<date>-<area>/ by default): the patches say where the tests are weak, and this repository is public.
// - A patch is a `git diff` of files under src/, after a header with an `Area:` line and an `Imitates:` line (the real
//   bug it imitates). git apply skips the header. A patch is **broken** (the mutator's mistake, never "survived") when
//   it has no header, changes a file outside src/ (a test, a tool, a baseline or a config changed could let any fault
//   "survive"), git apply refuses it, or npm run build fails on it.
// - Each patch is scored in a throwaway git worktree of the base (in the system's temporary folder, kc-mutant-…), with
//   node_modules copied in copy-on-write without its caches; the worktree is removed afterwards, on Ctrl-C too, and a
//   run that was killed leaves one the next run removes. One patch at a time: each stage already uses every core, and a
//   test timed out by load would read as "caught".
// - The stages, every one on every patch: npm run build (red means broken), then the compiler (npm run typecheck),
//   lint (npm run lint and npm run lint:arch), the tests (npm test, with Vitest's JSON report) and the balance matrix
//   (npm run balance). **Caught**: any of the four red, or stopped at its time limit ("timed out"). **Survived**: all
//   four green. Prettier, the ratchet and knip judge how a change is written, not what it does: not stages.
// - The control run comes first: the same stages on the base with no patch. Any red, and it stops (on a red base every
//   mutant would read "caught"). Each stage's time limit is five times its time there, and at least a minute.
// - The environment is the caller's without KC_SITE, KC_FULL, KC_JOBS and KC_SEED, so the run repeats exactly. It stops
//   when CI is set: the scoring run is never in CI (tests/static/harness.test.ts checks no workflow names it).
//
// Exit 0 once every patch is scored, whatever the score; exit 1 when it stops before scoring.
// Its test: tests/unit/the-mutant-scorer-tells-caught-survived-and-broken-apart.test.ts, on a made-up repository.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';

export type StageName = 'build' | 'compiler' | 'lint' | 'tests' | 'balance';
/** The stages in the order they run. The build first: red there means the patch is broken. */
export const STAGES: readonly StageName[] = ['build', 'compiler', 'lint', 'tests', 'balance'];
/** A stage's time limit: this many times its time in the control run… */
export const LIMIT_TIMES_THE_CONTROL = 5;
/** …and never less than this, so a stage the control ran in a moment isn't read as hung on a busy machine. */
export const LEAST_LIMIT_MS = 60_000;
/** The variables a stage runs without, so its run is the default one: the seed and sizes vitest.config.mts sets. */
export const ENVIRONMENT_LEFT_OUT = ['KC_SITE', 'KC_FULL', 'KC_JOBS', 'KC_SEED'] as const;
/** The worktrees' names start with this, in the system's temporary folder. */
export const WORKTREE_PREFIX = 'kc-mutant-';

export type Outcome = 'green' | 'red' | 'timed out';
export interface StageResult {
  stage: StageName;
  outcome: Outcome;
  ms: number;
}
export type Verdict = 'caught' | 'survived' | 'broken';
export interface PatchResult {
  patch: string;
  area: string;
  imitates: string;
  result: Verdict;
  /** Why it is broken, or which stages caught it. */
  why: string;
  redStages: StageName[];
  failedTests: string[];
  stages: StageResult[];
}

/** Stops the run before anything is scored (exit 1), with a one-line reason. */
class Stop extends Error {}

/** The commands a stage runs, each an argument list (the program first). The tests' writes Vitest's JSON report. */
export function stageCommands(stage: StageName, logDir: string): string[][] {
  switch (stage) {
    case 'build':
      return [['npm', 'run', 'build']];
    case 'compiler':
      return [['npm', 'run', 'typecheck']];
    case 'lint':
      return [
        ['npm', 'run', 'lint'],
        ['npm', 'run', 'lint:arch'],
      ];
    case 'tests':
      return [
        [
          'npm',
          'test',
          '--',
          '--reporter=default',
          '--reporter=json',
          `--outputFile.json=${path.join(logDir, 'vitest.json')}`,
        ],
      ];
    case 'balance':
      return [['npm', 'run', 'balance']];
  }
}

/** Caught if any stage after the build is red or timed out; survived if all are green. */
export function verdictOf(stages: readonly StageResult[]): { result: 'caught' | 'survived'; redStages: StageName[] } {
  const redStages = stages.filter((s) => s.stage !== 'build' && s.outcome !== 'green').map((s) => s.stage);
  return { result: redStages.length ? 'caught' : 'survived', redStages };
}

/** Each stage's time limit: five times its time in the control run, and at least a minute. */
export function limitsFrom(control: readonly StageResult[]): Map<StageName, number> {
  return new Map(control.map((s) => [s.stage, Math.max(LEAST_LIMIT_MS, LIMIT_TIMES_THE_CONTROL * s.ms)]));
}

/** The header's `Area:` and `Imitates:` lines (before the first `diff --git`), or null when either is missing. */
export function headerOf(patchText: string): { area: string; imitates: string } | null {
  const start = patchText.search(/^diff --git /m);
  const header = start < 0 ? patchText : patchText.slice(0, start);
  const area = /^Area:[ \t]*(\S.*)$/m.exec(header)?.[1]?.trim();
  const imitates = /^Imitates:[ \t]*(\S.*)$/m.exec(header)?.[1]?.trim();
  return area && imitates ? { area, imitates } : null;
}

const vitestReport = z.object({
  testResults: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      message: z.string().optional(),
      assertionResults: z.array(z.object({ fullName: z.string(), status: z.string() })),
    }),
  ),
});

/** The failed tests in Vitest's JSON report: each failed test's full name, or a failed file's name and first line. */
export function failedTestsIn(reportText: string, root: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reportText);
  } catch {
    return [];
  }
  const report = vitestReport.safeParse(parsed);
  if (!report.success) return [];
  return report.data.testResults.flatMap((file) => {
    const failed = file.assertionResults.filter((t) => t.status === 'failed').map((t) => t.fullName);
    if (failed.length || file.status !== 'failed') return failed;
    const firstLine = (file.message ?? '').split('\n')[0] ?? '';
    return [`${path.relative(root, file.name)}: ${firstLine}`.trim()];
  });
}

// The stage running now, so Ctrl-C can stop it and remove its worktree.
let running: ChildProcess | undefined;
let currentWorktree: { root: string; dir: string } | undefined;

/** Stops a process and everything it started (it leads its own process group), even once the process itself has
 *  ended: what it started may still run. */
function stopGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    // Already gone.
  }
}

/** Runs a stage's commands one after another in `cwd`, their output into `logFile`. Red when any exits non-zero;
 *  "timed out" when they run past `limitMs` together, and then the running command's whole process group is stopped. */
export async function runStage(
  commands: readonly (readonly string[])[],
  o: { cwd: string; env: NodeJS.ProcessEnv; logFile: string; limitMs: number },
): Promise<{ outcome: Outcome; ms: number }> {
  const started = performance.now();
  fs.mkdirSync(path.dirname(o.logFile), { recursive: true });
  fs.writeFileSync(o.logFile, '');
  let outcome: Outcome = 'green';
  for (const [program, ...args] of commands) {
    if (program === undefined) continue;
    fs.appendFileSync(o.logFile, `$ ${[program, ...args].join(' ')}\n`);
    const left = o.limitMs - (performance.now() - started);
    const fd = fs.openSync(o.logFile, 'a');
    const result = await new Promise<'exited 0' | 'exited non-zero' | 'timed out'>((resolve) => {
      const child = spawn(program, args, { cwd: o.cwd, env: o.env, detached: true, stdio: ['ignore', fd, fd] });
      running = child;
      let timedOut = false;
      const timer = setTimeout(
        () => {
          timedOut = true;
          stopGroup(child, 'SIGTERM');
          setTimeout(() => {
            stopGroup(child, 'SIGKILL');
          }, 5_000).unref();
        },
        Math.max(0, left),
      );
      const done = (code: number | null) => {
        clearTimeout(timer);
        // What the command started and left behind dies with it.
        stopGroup(child, 'SIGKILL');
        running = undefined;
        resolve(timedOut ? 'timed out' : code === 0 ? 'exited 0' : 'exited non-zero');
      };
      child.on('error', (e) => {
        fs.appendFileSync(o.logFile, `${e.message}\n`);
        done(1);
      });
      child.on('exit', done);
    });
    fs.closeSync(fd);
    if (result === 'timed out') {
      fs.appendFileSync(o.logFile, `\nStopped: past the stage's limit of ${String(o.limitMs)} ms.\n`);
      return { outcome: 'timed out', ms: Math.round(performance.now() - started) };
    }
    if (result === 'exited non-zero') outcome = 'red';
  }
  return { outcome, ms: Math.round(performance.now() - started) };
}

function git(cwd: string, args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout, err: r.stderr };
}

/** The worktrees of kc-mutant-… a killed run left: removed. */
function removeLeftWorktrees(root: string, log: (line: string) => void): void {
  const list = git(root, ['worktree', 'list', '--porcelain']).out;
  for (const m of list.matchAll(/^worktree (.+)$/gm)) {
    const dir = m[1] ?? '';
    if (path.basename(dir).startsWith(WORKTREE_PREFIX)) {
      log(`Removing a worktree a killed run left: ${dir}`);
      removeWorktree(root, dir);
    }
  }
}

function removeWorktree(root: string, dir: string): void {
  if (!git(root, ['worktree', 'remove', '--force', dir]).ok) {
    fs.rmSync(dir, { recursive: true, force: true });
    git(root, ['worktree', 'remove', '--force', dir]);
  }
}

/** node_modules copied copy-on-write (a plain copy where the file system can't), without its caches: every entry at
 *  its top level whose name starts with "." but npm's own (.bin and .package-lock.json). */
export function copyNodeModules(from: string, to: string): void {
  const top = path.join(from, 'node_modules');
  fs.cpSync(top, path.join(to, 'node_modules'), {
    recursive: true,
    mode: fs.constants.COPYFILE_FICLONE,
    verbatimSymlinks: true,
    filter: (source) => {
      if (path.dirname(source) !== top) return true;
      const name = path.basename(source);
      return !name.startsWith('.') || name === '.bin' || name === '.package-lock.json';
    },
  });
}

function makeWorktree(root: string, commit: string, tmp: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(tmp, WORKTREE_PREFIX)));
  currentWorktree = { root, dir };
  const added = git(root, ['worktree', 'add', '--detach', dir, commit]);
  if (!added.ok) throw new Error(`git worktree add failed: ${added.err.trim()}`);
  copyNodeModules(root, dir);
  return dir;
}

/** Ctrl-C (or a kill) while a stage runs: the stage and its worktree go too. */
export function stopNow(): void {
  if (running) stopGroup(running, 'SIGKILL');
  if (currentWorktree) removeWorktree(currentWorktree.root, currentWorktree.dir);
  currentWorktree = undefined;
}

/** Runs every stage in a worktree of `commit` with `patchFile` applied (none: the control run). The worktree is removed
 *  afterwards. A patch git apply refuses returns its message instead. */
async function inWorktree(
  root: string,
  commit: string,
  tmp: string,
  patchFile: string | undefined,
  o: { env: NodeJS.ProcessEnv; logDir: string; limits?: Map<StageName, number> },
): Promise<{ refused: string } | { stages: StageResult[]; failedTests: string[] }> {
  const dir = makeWorktree(root, commit, tmp);
  try {
    if (patchFile) {
      const applied = git(dir, ['apply', patchFile]);
      if (!applied.ok) return { refused: applied.err.trim().split('\n')[0] ?? 'refused' };
    }
    fs.rmSync(o.logDir, { recursive: true, force: true });
    const stages: StageResult[] = [];
    for (const stage of STAGES) {
      const limitMs = o.limits?.get(stage) ?? 24 * 60 * 60 * 1000;
      const logFile = path.join(o.logDir, `${stage}.log`);
      const { outcome, ms } = await runStage(stageCommands(stage, o.logDir), {
        cwd: dir,
        env: o.env,
        logFile,
        limitMs,
      });
      stages.push({ stage, outcome, ms });
      // A patch the build refuses is broken: its other stages would say nothing about the tests.
      if (stage === 'build' && outcome !== 'green' && patchFile) break;
    }
    const report = path.join(o.logDir, 'vitest.json');
    const failedTests = fs.existsSync(report) ? failedTestsIn(fs.readFileSync(report, 'utf8'), dir) : [];
    return { stages, failedTests };
  } finally {
    removeWorktree(root, dir);
    currentWorktree = undefined;
  }
}

/** The files a patch changes (git apply --numstat names them without applying anything), or null if it isn't one. */
function filesOf(root: string, patchFile: string): string[] | null {
  const r = git(root, ['apply', '--numstat', '-z', patchFile]);
  if (!r.ok) return null;
  // Each entry: "added\tdeleted\tpath\0", or for a rename "added\tdeleted\t\0old\0new\0".
  const files: string[] = [];
  const parts = r.out.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const m = /^[\d-]+\t[\d-]+\t(.*)$/.exec(parts[i] ?? '');
    if (!m) continue;
    if (m[1]) files.push(m[1]);
    else files.push(parts[++i] ?? '', parts[++i] ?? '');
  }
  return files;
}

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** The table printed at the end, in Markdown. */
export function table(commit: string, results: readonly PatchResult[]): string {
  const rows = results.map((r) =>
    [
      r.patch,
      r.area,
      r.imitates,
      r.result,
      r.result === 'broken' ? r.why : r.redStages.join(', ') || '–',
      r.failedTests.slice(0, 3).join('; ') || '–',
    ]
      .map(cell)
      .join(' | '),
  );
  const count = (v: Verdict) => results.filter((r) => r.result === v).length;
  return [
    `Mutants scored on ${commit}: ${String(count('caught'))} caught, ${String(count('survived'))} survived, ${String(count('broken'))} broken.`,
    '',
    '| Patch | Area | Imitates | Result | Red stages (or why broken) | First failed tests |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r} |`),
  ].join('\n');
}

export interface ScorerOptions {
  /** Where it was run from: the repository is the one holding it, and a relative folder is read from here. */
  cwd: string;
  env: NodeJS.ProcessEnv;
  log: (line: string) => void;
  /** Where the worktrees go (default: the system's temporary folder). */
  tmp?: string;
}

/** The scorer: returns its exit code. */
export async function scoreMutants(argv: readonly string[], o: ScorerOptions): Promise<number> {
  try {
    return await score(argv, o);
  } catch (e) {
    if (e instanceof Stop) {
      o.log(`npm run mutants: ${e.message}`);
      return 1;
    }
    throw e;
  }
}

async function score(argv: readonly string[], o: ScorerOptions): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { only: { type: 'string' } },
    allowPositionals: true,
  });
  if (positionals.length !== 1) throw new Stop('usage: npm run mutants -- <folder> [--only <patch>,…]');
  if (o.env['CI']) throw new Stop('CI is set: the scoring run is never in CI (plan P1-21).');

  const top = git(o.cwd, ['rev-parse', '--show-toplevel']);
  if (!top.ok) throw new Stop(`${o.cwd} is not in a git repository.`);
  const root = fs.realpathSync(top.out.trim());
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=no']).out.trim();
  if (dirty)
    throw new Stop(
      `the tree has uncommitted changes (commit them, or stash them): the base is HEAD as committed.\n${dirty}`,
    );
  const commit = git(root, ['rev-parse', 'HEAD']).out.trim();

  const given = path.resolve(o.cwd, positionals[0] ?? '');
  if (!fs.existsSync(given) || !fs.statSync(given).isDirectory()) throw new Stop(`no folder ${given}.`);
  const folder = fs.realpathSync(given);
  const inside = path.relative(root, folder);
  if (!inside.startsWith('..') && !path.isAbsolute(inside)) {
    if (inside === '' || !git(root, ['check-ignore', '-q', '--', inside]).ok)
      throw new Stop(
        `${folder} is a folder git would commit: the patches say where the tests are weak, and this repository is public. Use a folder outside it, or one it ignores (plan/mutants/<date>-<area>/).`,
      );
  }

  let patches = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith('.patch'))
    .sort();
  if (values.only !== undefined) {
    const only = values.only.split(',').map((s) => (s.trim().endsWith('.patch') ? s.trim() : `${s.trim()}.patch`));
    const unknown = only.filter((p) => !patches.includes(p));
    if (unknown.length) throw new Stop(`--only names no patch in ${folder}: ${unknown.join(', ')}.`);
    patches = patches.filter((p) => only.includes(p));
  }
  if (!patches.length) throw new Stop(`no *.patch in ${folder}.`);
  if (!fs.existsSync(path.join(root, 'node_modules'))) throw new Stop('no node_modules: run npm ci first.');

  const leftOut = new Set<string>(ENVIRONMENT_LEFT_OUT);
  const env = Object.fromEntries(Object.entries(o.env).filter(([name]) => !leftOut.has(name)));
  const tmp = o.tmp ?? os.tmpdir();
  const logs = path.join(folder, 'logs');
  removeLeftWorktrees(root, o.log);

  o.log(`Base: ${commit}. The control run (no patch)…`);
  const control = await inWorktree(root, commit, tmp, undefined, { env, logDir: path.join(logs, 'control') });
  if ('refused' in control) throw new Stop('the control run applied a patch.');
  const times = control.stages.map((s) => `${s.stage} ${(s.ms / 1000).toFixed(1)} s`).join(', ');
  o.log(`Control: ${times}.`);
  const red = control.stages.filter((s) => s.outcome !== 'green');
  if (red.length)
    throw new Stop(
      `the base is red without any patch (${red.map((s) => `${s.stage} ${s.outcome}`).join(', ')}; logs/control/): every mutant would read "caught".`,
    );
  const limits = limitsFrom(control.stages);

  const results: PatchResult[] = [];
  for (const patch of patches) {
    const file = path.join(folder, patch);
    const logDir = path.join(logs, patch.replace(/\.patch$/, ''));
    const result = await scoreOne(root, commit, tmp, file, { env, logDir, limits });
    o.log(`${patch}: ${result.result}${result.why ? ` (${result.why})` : ''}`);
    results.push(result);
  }

  const written = {
    base: commit,
    control: control.stages,
    limits: Object.fromEntries(limits),
    patches: results,
  };
  fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(written, null, 2) + '\n');
  o.log('');
  o.log(table(commit, results));
  o.log('');
  o.log(`Written: ${path.join(folder, 'results.json')}, and each stage's output in ${logs}.`);
  return 0;
}

async function scoreOne(
  root: string,
  commit: string,
  tmp: string,
  file: string,
  o: { env: NodeJS.ProcessEnv; logDir: string; limits: Map<StageName, number> },
): Promise<PatchResult> {
  const patch = path.basename(file);
  const header = headerOf(fs.readFileSync(file, 'utf8'));
  const base = { patch, area: header?.area ?? '', imitates: header?.imitates ?? '', redStages: [], failedTests: [] };
  const broken = (why: string, stages: StageResult[] = []): PatchResult => ({
    ...base,
    result: 'broken',
    why,
    stages,
  });
  if (!header) return broken('no Area: or Imitates: line before the diff');
  const files = filesOf(root, file);
  if (files === null) return broken('git apply cannot read it');
  if (!files.length) return broken('it changes no file');
  const outside = files.filter((f) => !f.startsWith('src/'));
  if (outside.length) return broken(`it changes a file outside src/: ${outside.join(', ')}`);

  const ran = await inWorktree(root, commit, tmp, file, o);
  if ('refused' in ran) return broken(`git apply refused it: ${ran.refused}`);
  const build = ran.stages.find((s) => s.stage === 'build');
  if (build?.outcome !== 'green') return broken(`the build failed (${build?.outcome ?? 'not run'})`, ran.stages);
  const { result, redStages } = verdictOf(ran.stages);
  const why = redStages
    .map((s) => (ran.stages.find((r) => r.stage === s)?.outcome === 'timed out' ? `${s} timed out` : s))
    .join(', ');
  return { ...base, result, why, redStages, failedTests: ran.failedTests, stages: ran.stages };
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      stopNow();
      process.exit(130);
    });
  scoreMutants(process.argv.slice(2), {
    cwd: process.env['INIT_CWD'] ?? process.cwd(),
    env: process.env,
    log: (line) => {
      console.log(line);
    },
  }).then(
    (code) => (process.exitCode = code),
    (e: unknown) => {
      console.error(e);
      stopNow();
      process.exitCode = 1;
    },
  );
}
