// npm run proof:gm-logs -- --base <ref>: every matrix game's GM log, byte for byte, the base against this branch (the
// proof's tier 2: tools/proof/README.md). Both sets' 60 games are played twice in the engine's vm, as every realm's
// report plays them (the-gm-logs-worker.ts): once from a copy of the base (git archive of where this branch left it:
// git merge-base <ref> HEAD; node_modules linked), with the base's own harness, and once from this working tree, as it
// is now. Each game's GM log, as the shell saves it (every field of every line, its words among them), is compared
// whole; for a game that differs, the first line that does is shown. It exits 1 when any game differs or fails.
//
// Options: --base REF (default main), --set A|B (one set), --jobs N (games side by side; default one per core), --out
// DIR (keeps each side's logs there, one file a game; default: a temporary folder, removed). About 70 s on 14 cores.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { matrix, type SeedSet } from '../balance/matrix.ts';
import { forkPool } from '../balance/sides.ts';
import { ROOT } from '../build.ts';
import { aFolderForACopy, copyACommit, linkNodeModules, removeTheCopy, theCommitOf } from './copies-of-the-tree.ts';
import { setsNamed } from './the-matrixs-coverage.ts';
import { whereTwoTextsPart } from './where-two-texts-part.ts';
import type { GmLogJob, GmLogReply } from './the-gm-logs-worker.ts';

const WORKER = path.join(import.meta.dirname, 'the-gm-logs-worker.ts');

/** The first line where two logs part (1 is the first), with each side's line ('' past its end); null if the two are
 *  the same, byte for byte. */
export function theFirstLineThatDiffers(
  base: string,
  branch: string,
): { line: number; base: string; branch: string } | null {
  if (base === branch) return null;
  const a = base.split('\n');
  const b = branch.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return { line: i + 1, base: a[i] ?? '', branch: b[i] ?? '' };
  return { line: Math.max(a.length, b.length), base: '', branch: '' };
}

/** A game's GM log on one side: its hash (sha256), its lines, and the file it is kept in; or what stopped it. */
export type ASidesLog = { hash: string; lines: number; file: string } | { error: string };

/** One game that differs. */
export interface AGameThatDiffers {
  key: string;
  /** How many lines each side's log has. */
  lines: [number, number];
  /** The first line that differs, or what stopped a side. */
  first: { line: number; base: string; branch: string } | null;
  error?: string;
}

/** The two sides' logs, game by game (keyed `set/id`): the games that differ, and how many are the same. A game one
 *  side has and the other hasn't differs. `readLog` reads a kept log back, to find its first line that differs. */
export function compareTheGmLogs(
  base: Map<string, ASidesLog>,
  branch: Map<string, ASidesLog>,
  readLog: (file: string) => string,
): { same: number; differ: AGameThatDiffers[] } {
  const keys = [...new Set([...base.keys(), ...branch.keys()])].sort();
  const differ: AGameThatDiffers[] = [];
  let same = 0;
  for (const key of keys) {
    const a = base.get(key);
    const b = branch.get(key);
    if (a && b && 'hash' in a && 'hash' in b) {
      if (a.hash === b.hash) {
        same++;
        continue;
      }
      differ.push({ key, lines: [a.lines, b.lines], first: theFirstLineThatDiffers(readLog(a.file), readLog(b.file)) });
      continue;
    }
    const why = (s: ASidesLog | undefined, side: string) =>
      s === undefined ? `not played on the ${side}` : 'error' in s ? `the ${side} failed: ${s.error}` : '';
    differ.push({
      key,
      lines: [a && 'lines' in a ? a.lines : 0, b && 'lines' in b ? b.lines : 0],
      first: null,
      error: [why(a, 'base'), why(b, 'branch')].filter(Boolean).join('; '),
    });
  }
  return { same, differ };
}

/** Builds the side's engine bundle once (its own tests/lib/engine.ts) and returns where it is. */
function theSidesBundle(side: string): string {
  return execFileSync(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      path.join(side, 'tests', 'lib', 'engine.ts'),
      '--bundle-for-the-run',
    ],
    { cwd: side, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  ).trim();
}

/** Plays every game of `sets` from the copy `side`, `jobs` at a time, keeping each log in `dir`. */
export async function theGmLogsOfASide(
  side: string,
  sets: SeedSet[],
  jobs: number,
  dir: string,
): Promise<Map<string, ASidesLog>> {
  fs.mkdirSync(dir, { recursive: true });
  const queue: GmLogJob[] = sets
    .flatMap((set) => matrix(set).map((spec) => ({ side, set, spec })))
    .sort((a, b) => b.spec.realms - a.spec.realms);
  const was = process.env['KC_ENGINE_BUNDLE'];
  process.env['KC_ENGINE_BUNDLE'] = theSidesBundle(side);
  let replies: GmLogReply[];
  try {
    replies = await forkPool<GmLogReply>(WORKER, queue, jobs);
  } finally {
    if (was === undefined) Reflect.deleteProperty(process.env, 'KC_ENGINE_BUNDLE');
    else process.env['KC_ENGINE_BUNDLE'] = was;
  }
  const logs = new Map<string, ASidesLog>();
  for (const r of replies) {
    const key = `${r.set}/${r.id}`;
    if (!r.ok) {
      logs.set(key, { error: r.error.split('\n')[0] ?? '' });
      continue;
    }
    const file = path.join(dir, `${r.set}-${r.id}.log`);
    fs.writeFileSync(file, r.log);
    const hash = crypto.createHash('sha256').update(r.log).digest('hex');
    logs.set(key, { hash, lines: r.log ? r.log.split('\n').length : 0, file });
  }
  return logs;
}

/** What the comparison prints. */
export function describeTheComparison(result: { same: number; differ: AGameThatDiffers[] }, base: string): string[] {
  const out = [
    `The GM logs, ${base} against this branch: ${String(result.same)} of ${String(result.same + result.differ.length)} games byte-identical.`,
  ];
  for (const d of result.differ) {
    out.push(`  ${d.key}: ${d.error ?? `${String(d.lines[0])} lines → ${String(d.lines[1])}`}`);
    const part = d.first ? whereTwoTextsPart(d.first.base, d.first.branch) : null;
    if (d.first && part)
      out.push(
        `    first at line ${String(d.first.line)}, character ${String(part.at + 1)}:`,
        `      base:   ${part.a}`,
        `      branch: ${part.b}`,
      );
  }
  return out;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'main' },
      set: { type: 'string' },
      jobs: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const t0 = performance.now();
  const sets = setsNamed(values.set);
  const jobs = Number(values.jobs) || os.availableParallelism();
  const out = values.out ? path.resolve(values.out) : aFolderForACopy('gm-logs');
  const copy = aFolderForACopy('gm-logs-base');
  try {
    copyACommit(ROOT, theCommitOf(ROOT, values.base, { mergeBase: true }), copy);
    linkNodeModules(ROOT, copy);
    const base = await theGmLogsOfASide(copy, sets, jobs, path.join(out, 'base'));
    const branch = await theGmLogsOfASide(ROOT, sets, jobs, path.join(out, 'branch'));
    const result = compareTheGmLogs(base, branch, (file) => fs.readFileSync(file, 'utf8'));
    let lines = 0;
    for (const l of branch.values()) if ('lines' in l) lines += l.lines;
    console.log(describeTheComparison(result, values.base).join('\n'));
    console.log(
      `(${String(lines)} lines on the branch, set ${sets.join(' and ')}; ${((performance.now() - t0) / 1000).toFixed(0)} s${values.out ? `; the logs in ${out}` : ''})`,
    );
    return result.differ.length ? 1 : 0;
  } finally {
    removeTheCopy(copy);
    if (!values.out) removeTheCopy(out);
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
