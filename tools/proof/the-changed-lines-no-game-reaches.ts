// npm run proof:unreached -- --base <ref>: the lines of src/engine/ and src/views/ this branch changed that no game of
// the balance matrix reaches (the proof's tier 1: tools/proof/README.md). Each needs a unit case, red on a planted fault
// in that line, or a reason by name why the code makes it so. A list, not a gate: it exits 0 whatever it finds.
//
// The branch is the working tree as it is now (uncommitted changes and new files too), compared with where it left the
// base (git merge-base <ref> HEAD). The lines the games reach are the matrix's coverage of this tree (npm run
// proof:coverage, the-matrixs-coverage.ts): measured now, unless coverage/matrix/lines.json (or --coverage DIR's) was
// measured on what src/ holds now. Options: --base REF (default main), --coverage DIR, --jobs N, --json.
//
// Each changed line with code is one of:
//   not reached     no game ran it
//   partly reached  the games ran it, but a block on it they never ran starts or ends there: the right of a `??` or
//                   `||`, a branch of `? :`, an `else`, a case
//   reached         the games ran it, every block of it
// and a part of the diff that only takes lines out is listed by where it was, for a reader to judge by the base's code.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../build.ts';
import {
  COUNTED,
  DEFAULT_OUT,
  measureTheMatrixsCoverage,
  theMatrixsLinesIfCurrent,
  type LinesOfAFile,
} from './the-matrixs-coverage.ts';

/** The lines a diff adds or rewrites, by file (the new side's numbers), and where it only takes lines out. */
export interface ChangedLines {
  lines: Record<string, number[]>;
  /** The lines after which a part of the diff only took lines out, by file (0: at the top). */
  takenOut: Record<string, number[]>;
}

/** The changed lines of `git diff -U0`'s output: for each file, the new side's lines each hunk adds or rewrites. */
export function changedLinesOf(diff: string): ChangedLines {
  const lines: Record<string, number[]> = {};
  const takenOut: Record<string, number[]> = {};
  let file: string | null = null;
  for (const line of diff.split('\n')) {
    const to = /^\+\+\+ (?:b\/(.*)|\/dev\/null)$/.exec(line);
    if (to) {
      file = to[1] ?? null;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || file == null) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] == null ? 1 : Number(hunk[2]);
    if (count === 0) (takenOut[file] ??= []).push(start);
    else for (let l = start; l < start + count; l++) (lines[file] ??= []).push(l);
  }
  return { lines, takenOut };
}

/** A changed line, as the games reached it. */
export interface ChangedLine {
  file: string;
  line: number;
  text: string;
}
/** The changed lines of the counted folders, sorted by how the games reached them. */
export interface Unreached {
  notReached: ChangedLine[];
  partlyReached: ChangedLine[];
  reached: number;
  /** The changed lines with no code (blank, a comment, or a type the bundle drops). */
  noCode: number;
  /** Changed files of the counted folders that the coverage has no line of. */
  notInTheCoverage: string[];
  takenOut: { file: string; after: number }[];
}

/** Sorts `changed`'s lines in the counted folders by the coverage `files` (lines.json's), each file's text read by
 *  `textOf` (its path from the repository's root). */
export function theChangedLinesNoGameReaches(
  changed: ChangedLines,
  files: Record<string, LinesOfAFile>,
  textOf: (file: string) => string,
): Unreached {
  const counted = (file: string) => COUNTED.some((dir) => file.startsWith(dir));
  const out: Unreached = {
    notReached: [],
    partlyReached: [],
    reached: 0,
    noCode: 0,
    notInTheCoverage: [],
    takenOut: [],
  };
  for (const file of Object.keys(changed.lines).filter(counted).sort()) {
    const coverage = files[file];
    if (!coverage) {
      out.notInTheCoverage.push(file);
      continue;
    }
    const text = textOf(file).split('\n');
    const partly = new Set(coverage.partly);
    for (const line of changed.lines[file] ?? []) {
      const count = coverage.counts[line];
      const at = { file, line, text: (text[line - 1] ?? '').trim() };
      if (count === undefined) out.noCode++;
      else if (count === 0) out.notReached.push(at);
      else if (partly.has(line)) out.partlyReached.push(at);
      else out.reached++;
    }
  }
  for (const file of Object.keys(changed.takenOut).filter(counted).sort())
    for (const after of changed.takenOut[file] ?? []) out.takenOut.push({ file, after });
  return out;
}

/** What the list prints. */
export function describeUnreached(u: Unreached, base: string): string[] {
  const each = (list: ChangedLine[]) => list.map((l) => `  ${l.file}:${String(l.line)}  ${l.text.slice(0, 140)}`);
  return [
    `The lines this branch changed in ${COUNTED.join(' and ')} since ${base}: ${String(u.notReached.length)} not reached, ${String(u.partlyReached.length)} partly reached, ${String(u.reached)} reached (and ${String(u.noCode)} with no code).`,
    ...(u.notReached.length ? ['', 'Not reached by any game (each needs a unit case):', ...each(u.notReached)] : []),
    ...(u.partlyReached.length
      ? ['', 'Partly reached (a block on the line no game ran: the case for that block):', ...each(u.partlyReached)]
      : []),
    ...(u.notInTheCoverage.length
      ? [
          '',
          'Changed files the coverage has no line of (not in the engine):',
          ...u.notInTheCoverage.map((f) => '  ' + f),
        ]
      : []),
    ...(u.takenOut.length
      ? [
          '',
          "Lines only taken out (judge each by the base's code):",
          ...u.takenOut.map((t) => `  ${t.file}: after line ${String(t.after)}`),
        ]
      : []),
  ];
}

const git = (args: string[]) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/** What the working tree changed in the counted folders since it left `base`: the diff, and each new file whole. */
export function whatTheBranchChanged(base: string): ChangedLines {
  const from = git(['merge-base', base, 'HEAD']).trim();
  const changed = changedLinesOf(git(['diff', '-U0', '--no-color', '--no-ext-diff', from, '--', ...COUNTED]));
  const fresh = git(['ls-files', '-z', '--others', '--exclude-standard', '--', ...COUNTED])
    .split('\0')
    .filter(Boolean);
  for (const file of fresh) {
    const n = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').length;
    changed.lines[file] = Array.from({ length: n }, (_, i) => i + 1);
  }
  return changed;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'main' },
      coverage: { type: 'string' },
      jobs: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  const out = path.resolve(values.coverage ?? DEFAULT_OUT);
  let lines = theMatrixsLinesIfCurrent(out);
  if (!lines) {
    console.log(`Measuring the matrix's coverage of this tree first (npm run proof:coverage, into ${out})…`);
    const measured = await measureTheMatrixsCoverage({ out, jobs: Number(values.jobs) || os.availableParallelism() });
    if (measured.errors.length) {
      console.log(`${String(measured.errors.length)} game(s) failed:\n  ${measured.errors.join('\n  ')}`);
      return 1;
    }
    lines = measured.lines;
  }
  const unreached = theChangedLinesNoGameReaches(whatTheBranchChanged(values.base), lines.files, (file) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8'),
  );
  console.log(
    values.json
      ? JSON.stringify(unreached, null, 2)
      : [
          `(the matrix's ${String(lines.games)} games, set ${lines.sets.join(' and ')})`,
          ...describeUnreached(unreached, values.base),
        ].join('\n'),
  );
  return 0;
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
