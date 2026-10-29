// npm run proof:two-engines -- --cases <module> [--base <ref>] [--streams N]: the two-engine comparison (the proof's
// tier 2: tools/proof/README.md), for the lines and kinds no matrix game reaches. Two engines, the base's (a copy of
// where this branch left <ref>: git merge-base <ref> HEAD) and this working tree's, each in its own process
// (the-two-engines-side.ts), run the same staged cases: the row's own module (the-two-engines-cases.ts says its form),
// loaded on each side with that side's src/. Every case runs with its own dice and with each of N seeded dice streams
// (default 5). Each run's lines (one by one, as JSON), its world after (as a hash) and what it threw are compared. It
// exits 1 when any run differs.
//
// The frame is the same for every row; the cases are the row's: they stage what the games don't reach (a case
// library's cases, or a stage called on a world staged directly), and return the lines in words and the world.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../build.ts';
import { aFolderForACopy, copyACommit, linkNodeModules, removeTheCopy, theCommitOf } from './copies-of-the-tree.ts';
import type { ASidesRun, ASidesRuns } from './the-two-engines-side.ts';
import { whereTwoTextsPart } from './where-two-texts-part.ts';

const SIDE = path.join(import.meta.dirname, 'the-two-engines-side.ts');

/** A run that differs between the two sides. */
export interface ARunThatDiffers {
  name: string;
  dice: number | null;
  /** What differs: the lines (and the first that does), the world, what threw, or a run one side hasn't. */
  what: string;
}
/** The comparison's outcome. */
export interface TheTwoEngines {
  runs: number;
  lines: number;
  /** Runs that threw on both sides, alike. */
  threwAlike: number;
  differ: ARunThatDiffers[];
  pids: [number, number];
}

const keyOf = (r: ASidesRun) => `${r.name}\0${String(r.dice)}`;

/** Compares the two sides' runs, run by run (a case's name and dice pair them). */
export function compareTheSides(base: ASidesRuns, branch: ASidesRuns): TheTwoEngines {
  const b = new Map(branch.runs.map((r) => [keyOf(r), r]));
  const a = new Map(base.runs.map((r) => [keyOf(r), r]));
  const differ: ARunThatDiffers[] = [];
  let lines = 0;
  let threwAlike = 0;
  for (const x of base.runs) {
    const y = b.get(keyOf(x));
    const at = { name: x.name, dice: x.dice };
    if (!y) {
      differ.push({ ...at, what: 'not run on the branch' });
      continue;
    }
    lines += x.lines.length;
    if (x.threw || y.threw) {
      if (x.threw === y.threw) threwAlike++;
      else differ.push({ ...at, what: `threw: base "${x.threw}", branch "${y.threw}"` });
      continue;
    }
    const first = Array.from({ length: Math.max(x.lines.length, y.lines.length) }, (_, i) => i).find(
      (i) => x.lines[i] !== y.lines[i],
    );
    if (first !== undefined) {
      const part = whereTwoTextsPart(x.lines[first] ?? '(none)', y.lines[first] ?? '(none)');
      differ.push({
        ...at,
        what: `lines (${String(x.lines.length)} → ${String(y.lines.length)}), first at line ${String(first + 1)}: base ${part?.a ?? ''} | branch ${part?.b ?? ''}`,
      });
    } else if (x.world !== y.world) differ.push({ ...at, what: 'the world after' });
  }
  for (const y of branch.runs)
    if (!a.has(keyOf(y))) differ.push({ name: y.name, dice: y.dice, what: 'not run on the base' });
  return { runs: base.runs.length, lines, threwAlike, differ, pids: [base.pid, branch.pid] };
}

/** Runs one side in its own process and reads what it wrote. */
function runASide(src: string, cases: string, streams: number, out: string): Promise<ASidesRuns> {
  const env = { ...process.env };
  // Each side builds its own engine's bundle: the run's (KC_ENGINE_BUNDLE) is this checkout's.
  delete env['KC_ENGINE_BUNDLE'];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', SIDE, src, cases, String(streams), out], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code) reject(new Error(`the side for ${src} stopped (exit ${String(code)})`));
      else resolve(JSON.parse(fs.readFileSync(out, 'utf8')) as ASidesRuns);
    });
  });
}

/** Runs the cases module `cases` on the two src/ folders, side by side, each in its own process, and compares. */
export async function compareTwoEngines({
  base,
  branch,
  cases,
  streams,
}: {
  base: string;
  branch: string;
  cases: string;
  streams: number;
}): Promise<TheTwoEngines> {
  const dir = aFolderForACopy('two-engines');
  try {
    const [a, b] = await Promise.all([
      runASide(base, path.resolve(cases), streams, path.join(dir, 'base.json')),
      runASide(branch, path.resolve(cases), streams, path.join(dir, 'branch.json')),
    ]);
    return compareTheSides(a, b);
  } finally {
    removeTheCopy(dir);
  }
}

/** What the comparison prints. */
export function describeTheTwoEngines(r: TheTwoEngines, base: string): string[] {
  return [
    `Two engines, ${base} and this branch, each in its own process: ${String(r.runs)} runs, ${String(r.lines)} lines; ${String(r.differ.length)} differ; ${String(r.threwAlike)} threw alike on both sides.`,
    ...r.differ
      .slice(0, 20)
      .map((d) => `  ${d.name} (dice ${d.dice === null ? "the case's own" : String(d.dice)}): ${d.what}`),
    ...(r.differ.length > 20 ? [`  … and ${String(r.differ.length - 20)} more`] : []),
  ];
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'main' },
      cases: { type: 'string' },
      streams: { type: 'string', default: '5' },
    },
  });
  if (!values.cases) {
    console.log('Name the cases: npm run proof:two-engines -- --cases <module> [--base <ref>] [--streams N]');
    return 1;
  }
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const t0 = performance.now();
  const copy = aFolderForACopy('two-engines-base');
  try {
    copyACommit(ROOT, theCommitOf(ROOT, values.base, { mergeBase: true }), copy);
    linkNodeModules(ROOT, copy);
    const r = await compareTwoEngines({
      base: path.join(copy, 'src'),
      branch: path.join(ROOT, 'src'),
      cases: path.resolve(cwd, values.cases),
      streams: Number(values.streams),
    });
    console.log(
      [...describeTheTwoEngines(r, values.base), `(${((performance.now() - t0) / 1000).toFixed(0)} s)`].join('\n'),
    );
    return r.differ.length ? 1 : 0;
  } finally {
    removeTheCopy(copy);
  }
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  main().then(
    (code) => (process.exitCode = code),
    (e: unknown) => {
      console.error(e);
      process.exitCode = 1;
    },
  );
}
