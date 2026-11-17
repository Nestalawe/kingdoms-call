// npm run proof:plants -- <plants.json> [--jobs N] [--limit S] [--keep]: a row's planted faults (tier 1 of a row's
// proof: docs/ways-of-working/a-row-of-a-stack-from-its-branch-to-its-report-and-the-proof-it-gives.md), several at a
// time, each on the tests that guard its line and nothing else (tools/proof/README.md).
//
// A plant is a text replaced in one file: its name, the file, the old text, the new text, which occurrence of the old
// text (0, the first, unless named), and the test files that guard the line. The plants file is a JSON list of plants,
// or `{ "tests": [...], "plants": [...] }` when most plants share their tests (a plant's own `tests` wins).
//
// It makes `--jobs` copies of this working tree (copies-of-the-tree.ts: node_modules linked, committed once), and each
// copy takes the next plant: the file planted, `vitest run <its tests>` in the copy (no site build, no balance
// matrix), the file put back. Each plant's verdict:
// - red: a test failed on it (the line is guarded);
// - GREEN: every test passed (the line isn't: a unit case is missing, or a reason by name);
// - missing: the old text isn't in the file (that occurrence of it), so nothing ran;
// - broken: the planted file no longer compiles, or the tests didn't run (see its log);
// - timed out: only time limits failed, or the run passed `--limit` seconds and was stopped. Never counted as caught:
//   run that plant again with `--jobs 1`. The runner never runs a plant twice by itself.
// The result is printed, a line a plant as each ends, and kept in result.json with each plant's log in a folder named
// at the end. It is a list, not a gate: it exits 0 once every plant has a verdict, 1 when the plants file is wrong.
//
// A test that reads the built site (site/ is git-ignored, so not in a copy) or plays the matrix isn't for this runner:
// npm run proof:plant builds and plays.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { ROOT } from '../build.ts';
import {
  aFolderForACopy,
  commitTheCopy,
  copyTheWorkingTree,
  linkNodeModules,
  removeTheCopy,
} from './copies-of-the-tree.ts';

/** How many copies work at once, unless `--jobs` says otherwise: a quarter of the cores, at least 1. */
export const DEFAULT_JOBS = Math.max(1, Math.floor(os.availableParallelism() / 4));
/** How long one plant's tests may run, in seconds, before they are stopped (a plant can make a loop endless). */
export const DEFAULT_LIMIT_S = 300;

const aPlantInTheFile = z.object({
  name: z.string().min(1),
  file: z.string().min(1),
  old: z.string().min(1),
  new: z.string(),
  occurrence: z.number().int().min(0).optional(),
  tests: z.array(z.string().min(1)).min(1).optional(),
});
const thePlantsFile = z.union([
  z.array(aPlantInTheFile),
  z.object({ tests: z.array(z.string().min(1)).min(1), plants: z.array(aPlantInTheFile) }),
]);

/** One plant, as the runner takes it. */
export interface APlant {
  name: string;
  /** The file, from the repository's root. */
  file: string;
  old: string;
  new: string;
  /** Which occurrence of `old` is replaced: 0 is the first. */
  occurrence: number;
  /** The test files that guard the line, as `vitest run` takes them. */
  tests: string[];
}

export type APlantsVerdict = 'red' | 'GREEN' | 'missing' | 'broken' | 'timed out';

/** One plant's verdict, the tests it turned red, and a line on what else happened. */
export interface APlantsResult {
  name: string;
  file: string;
  verdict: APlantsVerdict;
  red: string[];
  note: string;
  seconds: number;
}

/** The plants of a plants file's text, checked: every plant has tests, names are unique, the files are inside the
 *  repository, and each plant changes its text. Throws, naming every fault, when any is wrong. */
export function thePlantsIn(text: string): APlant[] {
  const parsed = thePlantsFile.parse(JSON.parse(text));
  const shared = Array.isArray(parsed) ? undefined : parsed.tests;
  const listed = Array.isArray(parsed) ? parsed : parsed.plants;
  const faults: string[] = [];
  const seen = new Set<string>();
  const plants = listed.map((p): APlant => {
    const tests = p.tests ?? shared ?? [];
    if (!tests.length) faults.push(`${p.name}: no tests named`);
    if (seen.has(p.name)) faults.push(`${p.name}: named twice`);
    seen.add(p.name);
    if (path.isAbsolute(p.file) || path.normalize(p.file).startsWith('..'))
      faults.push(`${p.name}: ${p.file} isn't inside the repository`);
    if (p.old === p.new) faults.push(`${p.name}: its new text is its old text`);
    return { name: p.name, file: p.file, old: p.old, new: p.new, occurrence: p.occurrence ?? 0, tests };
  });
  if (!plants.length) faults.push('no plants');
  if (faults.length) throw new Error(`The plants file is wrong:\n${faults.map((f) => `  ${f}`).join('\n')}`);
  return plants;
}

/** `text` with the `occurrence`-th `old` replaced by `replacement`, or null when `old` isn't there that many times. */
export function planted(text: string, old: string, replacement: string, occurrence: number): string | null {
  let at = -1;
  for (let i = 0; i <= occurrence; i++) {
    at = text.indexOf(old, at + 1);
    if (at < 0) return null;
  }
  return text.slice(0, at) + replacement + text.slice(at + old.length);
}

const vitestReport = z.object({
  testResults: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      message: z.string().optional(),
      assertionResults: z.array(
        z.object({
          fullName: z.string(),
          status: z.string(),
          failureMessages: z.array(z.string()).optional(),
        }),
      ),
    }),
  ),
});

const TIMED_OUT = /^(?:Error: )?(?:Test|Hook) timed out in \d+ms/;
const DOES_NOT_COMPILE = /Transform failed|SyntaxError|Failed to parse|Unexpected token|Expected .* but found/;

/** The JSON in `text`, or null when there is no text or it isn't JSON. */
function parsedOrNull(text: string | null): unknown {
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A plant's verdict from its run: Vitest's JSON report (null when it wrote none), the run's exit code, and whether
 *  the runner stopped it at its limit. `root` is the copy, to name a failed file from it. */
export function verdictOf(
  reportText: string | null,
  exit: number,
  stopped: boolean,
  root: string,
): { verdict: APlantsVerdict; red: string[]; note: string } {
  if (stopped) return { verdict: 'timed out', red: [], note: 'stopped at the limit' };
  const report = vitestReport.safeParse(parsedOrNull(reportText));
  if (!report.success) return { verdict: 'broken', red: [], note: `no report from Vitest (exit ${String(exit)})` };
  const files = report.data.testResults;
  if (!files.length) return { verdict: 'broken', red: [], note: 'no test ran: are the test files named right?' };
  const red: string[] = [];
  const timedOut: string[] = [];
  const broken: string[] = [];
  for (const file of files) {
    const failed = file.assertionResults.filter((t) => t.status === 'failed');
    for (const t of failed) {
      const messages = t.failureMessages ?? [];
      if (messages.length && messages.every((m) => TIMED_OUT.test(m))) timedOut.push(t.fullName);
      else red.push(t.fullName);
    }
    if (failed.length || file.status !== 'failed') continue;
    const message = file.message ?? '';
    const named = `${path.relative(root, file.name)}: ${message.split('\n')[0] ?? ''}`.trim();
    if (DOES_NOT_COMPILE.test(message)) broken.push(named);
    else if (TIMED_OUT.test(message)) timedOut.push(named);
    else red.push(named);
  }
  if (red.length)
    return { verdict: 'red', red, note: timedOut.length ? `${String(timedOut.length)} timed out too` : '' };
  if (broken.length) return { verdict: 'broken', red: [], note: broken.join('; ') };
  if (timedOut.length) return { verdict: 'timed out', red: [], note: timedOut.join('; ') };
  if (exit) return { verdict: 'broken', red: [], note: `exit ${String(exit)} with every test passing: see its log` };
  return { verdict: 'GREEN', red: [], note: '' };
}

/** Runs `vitest run <tests>` in `copy`, its output in `log` and its JSON report in `json`, stopping it (and what it
 *  started) after `limitS` seconds. */
function runTheTests(
  copy: string,
  tests: string[],
  { log, json, limitS, workers }: { log: string; json: string; limitS: number; workers: number },
): Promise<{ exit: number; stopped: boolean }> {
  return new Promise((resolve) => {
    const out = fs.openSync(log, 'w');
    const child = spawn(
      path.join(copy, 'node_modules', '.bin', 'vitest'),
      ['run', ...tests, `--maxWorkers=${String(workers)}`, '--reporter=json', `--outputFile.json=${json}`],
      { cwd: copy, stdio: ['ignore', out, out], detached: true, env: process.env },
    );
    let stopped = false;
    const timer = setTimeout(() => {
      stopped = true;
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          // it has ended
        }
      }
    }, limitS * 1000);
    const done = (exit: number) => {
      clearTimeout(timer);
      fs.closeSync(out);
      resolve({ exit, stopped });
    };
    child.on('error', () => {
      done(1);
    });
    child.on('exit', (code) => {
      done(code ?? 1);
    });
  });
}

/** A plant's name as a file name. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** Plants each of `plants` in one of `jobs` copies of `repo`'s working tree, several at once, and gives each its
 *  verdict, in the plants' order; each plant's log and report go into `here`. `onResult` hears each as it ends. The
 *  copies are removed after, unless `keep`. */
export async function runThePlants({
  repo,
  plants,
  here,
  jobs = DEFAULT_JOBS,
  limitS = DEFAULT_LIMIT_S,
  keep = false,
  onResult = () => undefined,
}: {
  repo: string;
  plants: APlant[];
  here: string;
  jobs?: number;
  limitS?: number;
  keep?: boolean;
  onResult?: (r: APlantsResult) => void;
}): Promise<{ results: APlantsResult[]; copies: string[] }> {
  fs.mkdirSync(here, { recursive: true });
  const copies = Array.from({ length: Math.max(1, Math.min(jobs, plants.length)) }, () => aFolderForACopy('plants'));
  const workers = Math.max(1, Math.floor(os.availableParallelism() / copies.length));
  const results: APlantsResult[] = new Array<APlantsResult>(plants.length);
  let next = 0;
  const work = async (copy: string) => {
    for (let i = next++; i < plants.length; i = next++) {
      const plant = plants[i];
      if (!plant) continue;
      const t0 = performance.now();
      const file = path.join(copy, plant.file);
      const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      const text = original == null ? null : planted(original, plant.old, plant.new, plant.occurrence);
      let result: Omit<APlantsResult, 'name' | 'file' | 'seconds'>;
      if (original == null) result = { verdict: 'missing', red: [], note: `no file ${plant.file}` };
      else if (text == null)
        result = {
          verdict: 'missing',
          red: [],
          note: `its old text isn't there (occurrence ${String(plant.occurrence)})`,
        };
      else {
        const base = path.join(here, `${String(i + 1).padStart(3, '0')}-${slug(plant.name)}`);
        fs.writeFileSync(file, text);
        try {
          const { exit, stopped } = await runTheTests(copy, plant.tests, {
            log: `${base}.log`,
            json: `${base}.json`,
            limitS,
            workers,
          });
          const report = fs.existsSync(`${base}.json`) ? fs.readFileSync(`${base}.json`, 'utf8') : null;
          result = verdictOf(report, exit, stopped, copy);
        } finally {
          fs.writeFileSync(file, original);
        }
      }
      const r = { name: plant.name, file: plant.file, ...result, seconds: (performance.now() - t0) / 1000 };
      results[i] = r;
      onResult(r);
    }
  };
  try {
    for (const copy of copies) {
      copyTheWorkingTree(repo, copy);
      linkNodeModules(repo, copy);
      commitTheCopy(copy);
    }
    await Promise.all(copies.map(work));
  } finally {
    if (!keep) for (const copy of copies) removeTheCopy(copy);
  }
  return { results, copies };
}

/** A plant's line as the runner prints it. */
export function describeResult(r: APlantsResult): string {
  const red = r.red.length ? ` (${String(r.red.length)} red: ${r.red[0] ?? ''}${r.red.length > 1 ? ', …' : ''})` : '';
  return `${r.verdict.padEnd(9)} ${r.name}${red}${r.note ? ` — ${r.note}` : ''} [${r.seconds.toFixed(1)} s]`;
}

/** The count of each verdict, and the names of every plant that isn't red. */
export function summaryOf(results: readonly APlantsResult[]): string {
  const of = (v: APlantsVerdict) => results.filter((r) => r.verdict === v);
  const lines = [`red ${String(of('red').length)} of ${String(results.length)}`];
  for (const v of ['GREEN', 'missing', 'broken', 'timed out'] as const)
    if (of(v).length)
      lines.push(
        `${v} ${String(of(v).length)}: ${of(v)
          .map((r) => r.name)
          .join('; ')}`,
      );
  return lines.join('\n');
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      jobs: { type: 'string' },
      limit: { type: 'string' },
      keep: { type: 'boolean', default: false },
    },
  });
  const [file] = positionals;
  if (!file || positionals.length > 1) {
    console.log('Name one plants file: npm run proof:plants -- <plants.json> [--jobs N] [--limit S] [--keep]');
    return 1;
  }
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const plants = thePlantsIn(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  const jobs = values.jobs == null ? DEFAULT_JOBS : Number(values.jobs);
  const limitS = values.limit == null ? DEFAULT_LIMIT_S : Number(values.limit);
  if (!(Number.isInteger(jobs) && jobs > 0) || !(limitS > 0)) {
    console.log('--jobs is a whole number above 0, and --limit a number of seconds above 0');
    return 1;
  }
  const here = aFolderForACopy('plants-results');
  const t0 = performance.now();
  console.log(`${String(plants.length)} plants, ${String(Math.min(jobs, plants.length))} at a time`);
  const { results, copies } = await runThePlants({
    repo: ROOT,
    plants,
    here,
    jobs,
    limitS,
    keep: values.keep,
    onResult: (r) => {
      console.log(describeResult(r));
    },
  });
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(results, null, 2));
  console.log(`\n${summaryOf(results)}`);
  console.log(`(${((performance.now() - t0) / 1000).toFixed(0)} s; the result and each plant's log: ${here})`);
  if (values.keep) console.log(`The copies kept: ${copies.join(' ')}`);
  return 0;
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    },
  );
}
