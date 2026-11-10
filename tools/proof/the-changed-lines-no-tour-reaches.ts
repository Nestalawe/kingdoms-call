// npm run proof:tours -- --base <ref>: the lines of src/ this branch changed that no screen tour reaches (plan P1-16,
// Decision 6: a page row's tier 1, tools/proof/README.md). The pages' code runs in jsdom: the four screen tours
// (tests/lib/screens.js, every mode, as tests/tools/same-dom.js runs them) and, when the branch changed a file the GM
// page's bundle holds, the balance matrix's page half (set A, played on that page through KC_SITE). Each listed line
// needs a case red on a planted fault in it, or a reason by name why the code makes it so. A list, not a gate: it exits
// 0 whatever it finds (1 only when it can't measure).
//
// The branch is the working tree as it is now (uncommitted changes and new files too), compared with where it left the
// base (git merge-base <ref> HEAD), as npm run proof:unreached does. The site is built from it with each bundle's source
// map, into <out>/site; the tours (and the matrix) run on that site under Node's own V8 coverage (NODE_V8_COVERAGE).
// Each bundle's coverage is matched to it by its length (as tests/lib/boot.js's readPage inlines it), each character
// read as the innermost range around it counts it, in any run, and mapped through the bundle's source map to the line
// of src/ it was built from.
//
// Options (after `--`): --base REF (default main), --out DIR (default coverage/tours), --matrix auto|always|never
// (default auto: when a changed file is in the GM page's bundle), --json. About 50 s; with the matrix, 2 minutes more.
//
// Each changed line with code is one of:
//   not reached     no run ran any of its code
//   partly reached  some of its code ran and some never did: the right of a `??` or `||`, a branch of `? :`, a
//                   callback never called (`.map((k) => …)` on an empty list), an `else`
//   reached         all of its code ran, in some run (top-level code runs as the page loads)
// and a part of the diff that only takes lines out is listed by where it was, for a reader to judge by the base's code.
//
// What it can't see: a line's code that ran is reached whatever values it ran with (a `||` made `??` where no tour meets
// the falsy value reads reached); the bundler gives some code no position of its own, so it counts on the line before
// it; the other browser specs and set B aren't run.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildSite, ROOT } from '../build.ts';
import { GM_PAGE } from '../pages.ts';
import { readPage } from '../../tests/lib/boot.js';
import { names } from '../../tests/lib/hostile.js';
import { runJsdom, TOURS } from '../../tests/lib/screens.js';
import {
  changedLinesOf,
  theChangedLinesNoGameReaches,
  type ChangedLine,
  type ChangedLines,
  type Unreached,
} from './the-changed-lines-no-game-reaches.ts';
import { NO_CODE, type LinesOfAFile } from './the-matrixs-coverage.ts';

/** The folder whose lines are counted: every source file a page's bundle holds is under it. */
export const THE_PAGES_SOURCES = ['src/'] as const;
/** Where the site, the coverage and lines.json go unless --out says otherwise. */
export const DEFAULT_TOURS_OUT = path.join(ROOT, 'coverage', 'tours');
/** What readPage puts before a page's bundle when it inlines it (tests/lib/boot.js). */
export const BEFORE_AN_INLINED_BUNDLE = '"use strict";\n';

/** A source map, the parts read here. */
export interface SourceMap {
  sources: string[];
  mappings: string;
}

/** A bundle as the page runs it: the script readPage inlines, and its source map. */
export interface InlinedBundle {
  /** The bundle's file name in assets/ (its map is this name and `.map`). */
  name: string;
  /** The script's text, as jsdom runs it. */
  text: string;
  map: SourceMap;
}

/** Each page's bundle in `site` as readPage inlines it, with its map. Throws when two bundles have one length: a
 *  script's coverage is matched to its text by its length. */
export function theInlinedBundlesOf(site: string): InlinedBundle[] {
  const found = new Map<number, InlinedBundle>();
  for (const page of fs.readdirSync(site).filter((f) => f.endsWith('.html'))) {
    for (const m of readPage(path.join(site, page)).matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      const text = m[1] ?? '';
      const name = /\/\/# sourceMappingURL=(\S+)\.map\s*$/.exec(text)?.[1];
      if (name === undefined || !text.startsWith(BEFORE_AN_INLINED_BUNDLE)) continue;
      const was = found.get(text.length);
      if (was?.name === name) continue;
      if (was) throw new Error(`two bundles of one length (${was.name}, ${name}): their coverage can't be told apart`);
      const map = JSON.parse(fs.readFileSync(path.join(site, 'assets', `${name}.map`), 'utf8')) as SourceMap;
      found.set(text.length, { name, text, map });
    }
  }
  return [...found.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** A source map's mappings (version 3), decoded: for each generated line (from 0), its segments in order, each
 *  [generated column, source's index, source's line from 0], or [generated column] for code from no source. */
export function decodedMappings(mappings: string): number[][][] {
  const lines: number[][][] = [];
  const state = [0, 0, 0, 0, 0];
  for (const line of mappings.split(';')) {
    const segments: number[][] = [];
    state[0] = 0;
    for (const segment of line.split(',')) {
      if (!segment) continue;
      const fields: number[] = [];
      let value = 0;
      let shift = 0;
      for (const ch of segment) {
        const digit = BASE64.indexOf(ch);
        if (digit < 0) throw new Error(`a source map's mappings hold ${ch}`);
        value += (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          const n = value & 1 ? -(value >>> 1) : value >>> 1;
          const i = fields.length;
          state[i] = (state[i] ?? 0) + n;
          fields.push(state[i] ?? 0);
          value = 0;
          shift = 0;
        }
      }
      segments.push(fields.length >= 4 ? [fields[0] ?? 0, fields[1] ?? 0, fields[2] ?? 0] : [fields[0] ?? 0]);
    }
    lines.push(segments);
  }
  return lines;
}

/** One script's coverage, as V8 writes it. */
export interface ScriptCoverage {
  url: string;
  functions: { ranges: { startOffset: number; endOffset: number; count: number }[] }[];
}

/** Marks in `ran` (one a character of the script, 1 when it ran) each character of `script` whose innermost range counts
 *  it run (V8's ranges nest: a function's, then its blocks that ran a different number of times). */
export function markWhatRan(script: ScriptCoverage, ran: Uint8Array): void {
  const ranges = script.functions
    .flatMap((f) => f.ranges)
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const count = new Int32Array(ran.length);
  for (const r of ranges) count.fill(r.count, r.startOffset, Math.min(r.endOffset, ran.length));
  for (let i = 0; i < ran.length; i++) if ((count[i] ?? 0) > 0) ran[i] = 1;
}

/** What ran of each source file's lines: the lines with code that ran, and those with code that never did. */
export type MarksOfEachFile = Record<string, { ran: Set<number>; notRun: Set<number> }>;

/** Adds to `into` each source file's lines under `root` (by its path from it) that `bundle`'s code was built from, as
 *  `ran` (a character each, 1 when it ran) says. A character the map gives no source, a blank, and a line of the
 *  bundle that is only a comment count for no line. */
export function markTheLinesOfABundle(
  bundle: InlinedBundle,
  ran: Uint8Array,
  root: string,
  into: MarksOfEachFile,
): void {
  const mappings = decodedMappings(bundle.map.mappings);
  const before = BEFORE_AN_INLINED_BUNDLE.split('\n').length - 1;
  const names = bundle.map.sources.map((s) => path.relative(root, s).split(path.sep).join('/'));
  let offset = 0;
  for (const [l, line] of bundle.text.split('\n').entries()) {
    const segments = l >= before ? (mappings[l - before] ?? []) : [];
    let at = -1;
    for (let col = 0; col < line.length && !NO_CODE.test(line); col++) {
      while (at + 1 < segments.length && (segments[at + 1]?.[0] ?? Infinity) <= col) at++;
      const seg = segments[at];
      const ch = line[col] ?? ' ';
      if (!seg || seg.length < 3 || ch === ' ' || ch === '\t') continue;
      const name = names[seg[1] ?? -1];
      if (name === undefined || name.startsWith('..')) continue;
      const lines = (into[name] ??= { ran: new Set(), notRun: new Set() });
      (ran[offset + col] ? lines.ran : lines.notRun).add((seg[2] ?? 0) + 1);
    }
    offset += line.length + 1;
  }
}

/** The marks in the LinesOfAFile form (the-matrixs-coverage.ts's): a line counts 1 when any of its code ran, else 0;
 *  partly reached when some ran and some never did. */
export function asLinesOfEachFile(marks: MarksOfEachFile): Record<string, LinesOfAFile> {
  const files: Record<string, LinesOfAFile> = {};
  for (const [name, { ran, notRun }] of Object.entries(marks).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const counts: Record<string, number> = {};
    for (const l of [...ran, ...notRun].sort((a, b) => a - b)) counts[l] = ran.has(l) ? 1 : 0;
    files[name] = { counts, partly: [...ran].filter((l) => notRun.has(l)).sort((a, b) => a - b) };
  }
  return files;
}

/** What the list prints. */
export function describeTheToursReach(u: Unreached, base: string, ranTheMatrix: boolean): string[] {
  const each = (list: ChangedLine[]) => list.map((l) => `  ${l.file}:${String(l.line)}  ${l.text.slice(0, 140)}`);
  const by = ranTheMatrix ? "the tours and the matrix's page half" : 'the tours';
  return [
    `The lines this branch changed in src/ since ${base}, as ${by} ran them: ${String(u.notReached.length)} not reached, ${String(u.partlyReached.length)} partly reached, ${String(u.reached)} reached (and ${String(u.noCode)} with no code in a bundle).`,
    ...(u.notReached.length ? ['', 'Not reached (each needs a case):', ...each(u.notReached)] : []),
    ...(u.partlyReached.length
      ? ['', 'Partly reached (some of the line never ran: the case for that part):', ...each(u.partlyReached)]
      : []),
    ...(u.notInTheCoverage.length
      ? ['', "Changed files no page's bundle holds code of:", ...u.notInTheCoverage.map((f) => '  ' + f)]
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
  spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).stdout;

/** What the working tree changed under src/ since it left `base`: the diff, and each new file whole. */
function whatTheBranchChangedInSrc(base: string): ChangedLines {
  const from = git(['merge-base', base, 'HEAD']).trim();
  if (!from) throw new Error(`no merge base with ${base}`);
  const changed = changedLinesOf(git(['diff', '-U0', '--no-color', '--no-ext-diff', from, '--', ...THE_PAGES_SOURCES]));
  const fresh = git(['ls-files', '-z', '--others', '--exclude-standard', '--', ...THE_PAGES_SOURCES])
    .split('\0')
    .filter(Boolean);
  for (const file of fresh) {
    const n = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').length;
    changed.lines[file] = Array.from({ length: n }, (_, i) => i + 1);
  }
  return changed;
}

/** Runs every mode of every tour in jsdom on `site`, as same-dom.js does (the screens not compared). This runs in its
 *  own process (`--run-the-tours`), which V8's coverage watches. */
async function runEveryTour(site: string): Promise<void> {
  for (const tour of Object.values(TOURS)) {
    const W = tour.world(names('ordinary'));
    for (const mode of Object.keys(tour.modes)) await runJsdom(tour, mode, W, () => undefined, { site });
  }
}

/** Runs `args` with V8's coverage written into `v8Dir` and what it prints (the matrix's verdict, the pages' own errors
 *  and warnings) into `log`; returns its exit status. */
function runWatched(args: string[], v8Dir: string, log: string, env: NodeJS.ProcessEnv = {}): number {
  const logFile = fs.openSync(log, 'w');
  const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env, NODE_V8_COVERAGE: v8Dir },
    stdio: ['ignore', logFile, logFile],
  });
  return run.status ?? 1;
}

/** Each source file's lines, from every coverage file in `v8Dirs` (a script of a bundle's length is that bundle). */
export function theBundlesLines(v8Dirs: string[], bundles: InlinedBundle[], root = ROOT): Record<string, LinesOfAFile> {
  const byLength = new Map(bundles.map((b) => [b.text.length, { bundle: b, ran: new Uint8Array(b.text.length) }]));
  let seen = 0;
  for (const dir of v8Dirs)
    for (const f of fs.readdirSync(dir)) {
      const v8 = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { result?: ScriptCoverage[] };
      for (const script of v8.result ?? []) {
        const at = byLength.get(script.functions[0]?.ranges[0]?.endOffset ?? -1);
        if (!at) continue;
        markWhatRan(script, at.ran);
        seen++;
      }
    }
  if (!seen) throw new Error(`no run ran a page's bundle (in ${v8Dirs.join(', ')})`);
  const marks: MarksOfEachFile = {};
  for (const { bundle, ran } of byLength.values()) markTheLinesOfABundle(bundle, ran, root, marks);
  return asLinesOfEachFile(marks);
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'main' },
      out: { type: 'string' },
      matrix: { type: 'string', default: 'auto' },
      json: { type: 'boolean', default: false },
      'run-the-tours': { type: 'string' },
    },
  });
  const tours = values['run-the-tours'];
  if (tours !== undefined) {
    await runEveryTour(tours);
    return 0;
  }
  if (!['auto', 'always', 'never'].includes(values.matrix)) throw new Error('--matrix is auto, always or never');
  const out = path.resolve(values.out ?? DEFAULT_TOURS_OUT);
  const changed = whatTheBranchChangedInSrc(values.base);

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const site = path.join(out, 'site');
  const built = await buildSite(site, undefined, undefined, { sourceMaps: true });
  const gmFiles = new Set((built.modules[GM_PAGE] ?? []).map((f) => `src/${f}`));
  const touched = [...Object.keys(changed.lines), ...Object.keys(changed.takenOut)];
  const ranTheMatrix = values.matrix === 'always' || (values.matrix === 'auto' && touched.some((f) => gmFiles.has(f)));

  const v8Tours = path.join(out, 'v8-tours');
  const v8Dirs = [v8Tours];
  console.error(`Running the tours on ${path.relative(process.cwd(), site)}/ under V8's coverage…`);
  const toursLog = path.join(out, 'tours.log');
  if (runWatched([import.meta.filename, '--run-the-tours', site], v8Tours, toursLog) !== 0) {
    console.error(`the tours failed to run (${toursLog})`);
    return 1;
  }
  if (ranTheMatrix) {
    const v8 = path.join(out, 'v8-matrix');
    v8Dirs.push(v8);
    console.error("Playing the matrix's set A on that site's GM page under V8's coverage…");
    const tsx = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const args = [tsx, 'tools/balance/run.ts', '--set', 'A', '--out', path.join(out, 'matrix-A.json')];
    const status = runWatched(args, v8, path.join(out, 'matrix.log'), { KC_SITE: site });
    // A branch that changes play differs from the baseline: its games still count for the reach.
    if (status !== 0)
      console.error(`(the matrix exited ${String(status)}, matrix.log: its games still count for the reach)`);
  }
  const files = theBundlesLines(v8Dirs, theInlinedBundlesOf(site));
  for (const dir of v8Dirs) fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(
    path.join(out, 'lines.json'),
    JSON.stringify({
      about: 'npm run proof:tours (tools/proof/the-changed-lines-no-tour-reaches.ts)',
      ranTheMatrix,
      files,
    }),
  );
  const u = theChangedLinesNoGameReaches(
    changed,
    files,
    (file) => fs.readFileSync(path.join(ROOT, file), 'utf8'),
    THE_PAGES_SOURCES,
  );
  console.log(
    values.json ? JSON.stringify(u, null, 2) : describeTheToursReach(u, values.base, ranTheMatrix).join('\n'),
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
