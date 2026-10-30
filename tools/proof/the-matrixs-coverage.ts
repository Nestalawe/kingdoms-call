// npm run proof:coverage: which lines of src/engine/ and src/views/ the balance matrix's games reach (plan P1-22, the
// proof's tier 1: tools/proof/README.md). The matrix's 60 games of each set (both sets: 120 games) are played as the
// balance runner's second half plays them (tools/balance/every-realm.ts, in the engine's vm, with every realm's report),
// in worker processes that Node's own V8 coverage watches (NODE_V8_COVERAGE). Their engine is this checkout's bundle
// (tests/lib/engine.ts's, through KC_ENGINE_BUNDLE), built here with its source map, so c8 (the standard tool) can turn
// the bundle's counts into counts on each source file's lines.
//
// It writes, in coverage/matrix/ (git ignores coverage/; --out DIR for another folder):
//   lines.json            each engine file's lines with code and how often the games ran each, which lines a block the
//                         games never ran starts or ends on ("partly reached"), and the tree it was measured on
//   report/index.html     c8's report, file by file, line by line (report/coverage-final.json: istanbul's form)
// and prints how many lines with code each folder has and how many the games reach.
//
// Options (after `--`): --set A or --set B (one set only), --jobs N (games side by side; default one per core),
// --out DIR. About 70 s on 14 cores.
//
// What it can't see: the page's half of the matrix (the same games on the GM portal in jsdom) runs the portal's shell
// as well, but its engine lines are the vm's: run.ts checks every turn's saved state is the page's. A line only the
// page reaches would read "not reached" here: the list errs towards asking for a unit case.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { Report } from 'c8';
import { KEEP_THE_CODE, packagesFromTheRepository, ROOT } from '../build.ts';
import { matrix, type SeedSet } from '../balance/matrix.ts';
import { engineEntryFiles } from '../pages.ts';
import type { EveryRealmReply } from '../balance/run.ts';
import { forkPool } from '../balance/sides.ts';

/** The folders whose lines are counted. */
export const COUNTED = ['src/engine/', 'src/views/'] as const;
/** The name tests/lib/engine.ts gives the engine's bundle as a script (`new vm.Script(code, { filename })`): the
 *  coverage of the script with this name is the engine's. */
export const THE_ENGINES_SCRIPT = 'engine.js';
/** Where the coverage goes unless --out says otherwise. */
export const DEFAULT_OUT = path.join(ROOT, 'coverage', 'matrix');
const EVERY_REALM_WORKER = path.join(ROOT, 'tools', 'balance', 'every-realm-worker.ts');

/** A source map, as Vite writes it. */
interface SourceMap {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

/** The engine's bundle of `src`, as tests/lib/engine.ts builds it (buildEngineBundle: the same Vite options, the same
 *  code), with its source map: each source named by its full path. Its test checks the code is buildEngineBundle's. */
export async function theEnginesBundleWithItsSourceMap(src = path.join(ROOT, 'src')): Promise<{
  code: string;
  map: SourceMap;
}> {
  const { build } = await import('vite');
  const ENTRY = '\0kc-engine-entry';
  const entry = engineEntryFiles(src)
    .map((f) => `export * from ${JSON.stringify(path.join(src, f))};`)
    .join('\n');
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    root: src,
    publicDir: false,
    plugins: [
      {
        name: 'kc-engine-entry',
        resolveId: (id) => (id === ENTRY ? ENTRY : null),
        load: (id) => (id === ENTRY ? entry : null),
      },
      packagesFromTheRepository(),
    ],
    build: {
      write: false,
      minify: false,
      target: 'esnext',
      modulePreload: false,
      sourcemap: 'hidden',
      rolldownOptions: {
        ...KEEP_THE_CODE,
        input: ENTRY,
        preserveEntrySignatures: 'strict',
        output: { format: 'es' },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ('output' in r ? r.output : []));
  const chunks = outputs.flatMap((o) => (o.type === 'chunk' ? [o] : []));
  const chunk = chunks[0];
  if (chunks.length !== 1 || !chunk?.map) throw new Error("the engine's bundle isn't one chunk with its source map");
  const tail = /\nexport \{[^}]*\};\s*$/.exec(chunk.code);
  if (!tail) throw new Error("the engine's bundle doesn't end with its exports");
  // The map's sources are named from the chunk's folder in Vite's output folder (dist/ under the root).
  const from = path.join(src, 'dist', path.dirname(chunk.fileName));
  const map: SourceMap = {
    ...(JSON.parse(chunk.map.toString()) as SourceMap),
    file: THE_ENGINES_SCRIPT,
  };
  map.sources = map.sources.map((s) => path.resolve(from, s));
  return { code: chunk.code.slice(0, tail.index + 1), map };
}

/** One script's coverage, as V8 writes it. */
interface ScriptCoverage {
  scriptId?: string;
  url: string;
  functions: unknown[];
}

/** A process's V8 coverage file (NODE_V8_COVERAGE's coverage-*.json) cut to the engine's script, named by the file
 *  `bundle` holds it in, so c8 finds its code and source map; null when the process never ran the engine. */
export function theEnginesCoverageIn(v8File: unknown, bundle: string): { result: ScriptCoverage[] } | null {
  const result =
    typeof v8File === 'object' && v8File !== null && 'result' in v8File && Array.isArray(v8File.result)
      ? (v8File.result as ScriptCoverage[])
      : [];
  const engine = result
    .filter((s) => s.url === THE_ENGINES_SCRIPT)
    .map((s) => ({ ...s, url: pathToFileURL(bundle).href }));
  return engine.length ? { result: engine } : null;
}

/** istanbul's coverage of one file (coverage-final.json), the parts read here. */
interface FileCoverage {
  statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
  s: Record<string, number>;
  branchMap: Record<string, { loc: { start: { line: number }; end: { line: number } } }>;
  b: Record<string, number[]>;
}

/** One file's lines with code, as the games ran them. */
export interface LinesOfAFile {
  /** Each line with code (by number, from 1) and how often the games ran it: 0 is never. */
  counts: Record<string, number>;
  /** The lines the games ran on which a block they never ran starts or ends (the right of a `??`, an `else`, a case),
   *  in order. */
  partly: number[];
}

/** A line with no code: blank, or only a comment (`//`, or a line of a block comment). */
export const NO_CODE = /^\s*(?:$|\/\/|\/\*|\*)/;

/** Each counted file's lines (by its path from `root`), from istanbul's coverage-final.json (c8's json report), and
 *  each file's text (`textOf`, by full path). c8 (v8-to-istanbul) makes each line of a file a statement, comments and
 *  blank lines too, so a line's count is its statement's, and the lines with no code (NO_CODE) are left out; each block
 *  the games never ran is a branch with a count of 0. */
export function linesOf(
  coverageFinal: Record<string, FileCoverage>,
  root: string,
  textOf: (file: string) => string = (file) => fs.readFileSync(file, 'utf8'),
): Record<string, LinesOfAFile> {
  const files: Record<string, LinesOfAFile> = {};
  for (const [file, fc] of Object.entries(coverageFinal).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const name = path.relative(root, file).split(path.sep).join('/');
    if (!COUNTED.some((dir) => name.startsWith(dir))) continue;
    const text = textOf(file).split('\n');
    const counts: Record<string, number> = {};
    for (const [id, st] of Object.entries(fc.statementMap))
      for (let l = st.start.line; l <= st.end.line; l++)
        if (!NO_CODE.test(text[l - 1] ?? '')) counts[l] = Math.max(counts[l] ?? 0, fc.s[id] ?? 0);
    const partly = new Set<number>();
    for (const [id, br] of Object.entries(fc.branchMap)) {
      if ((fc.b[id] ?? []).some((n) => n > 0)) continue;
      for (const l of [br.loc.start.line, br.loc.end.line]) if ((counts[l] ?? 0) > 0) partly.add(l);
    }
    files[name] = { counts, partly: [...partly].sort((a, b) => a - b) };
  }
  return files;
}

/** What lines.json holds. */
export interface TheMatrixsLines {
  about: string;
  /** The hash of what src/ held when the games were played (whatSrcHolds). */
  tree: string;
  sets: SeedSet[];
  games: number;
  files: Record<string, LinesOfAFile>;
}

/** One hash of every file under `src` (names and contents), to tell whether lines.json was measured on this tree. */
export function whatSrcHolds(src: string): string {
  const hash = crypto.createHash('sha256');
  const files = fs
    .readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(src, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
  for (const f of files)
    hash
      .update(f)
      .update('\0')
      .update(fs.readFileSync(path.join(src, f)))
      .update('\0');
  return hash.digest('hex');
}

/** Each folder's lines with code, and how many of them the games reach (and reach only in part). */
export function summaryOf(files: Record<string, LinesOfAFile>): string[] {
  return COUNTED.map((dir) => {
    let lines = 0;
    let reached = 0;
    let partly = 0;
    for (const [name, f] of Object.entries(files)) {
      if (!name.startsWith(dir)) continue;
      const counts = Object.values(f.counts);
      lines += counts.length;
      reached += counts.filter((n) => n > 0).length;
      partly += f.partly.length;
    }
    const pct = lines ? ((100 * reached) / lines).toFixed(1) : '0';
    return `${dir}: ${String(reached)} of ${String(lines)} lines reached (${pct}%), ${String(partly)} of them in part`;
  });
}

/** Turns NODE_V8_COVERAGE's folder `v8Dir` (the engine's script held in `bundle`) into c8's report in `out`/report and
 *  the counted files' lines. Throws when no process ran the engine. */
export async function linesFromV8Coverage(
  v8Dir: string,
  bundle: string,
  out: string,
  root = ROOT,
): Promise<Record<string, LinesOfAFile>> {
  const engineOnly = path.join(out, 'v8-engine');
  fs.rmSync(engineOnly, { recursive: true, force: true });
  fs.mkdirSync(engineOnly, { recursive: true });
  let kept = 0;
  for (const f of fs.readdirSync(v8Dir).sort()) {
    const cut = theEnginesCoverageIn(JSON.parse(fs.readFileSync(path.join(v8Dir, f), 'utf8')), bundle);
    if (!cut) continue;
    fs.writeFileSync(path.join(engineOnly, f), JSON.stringify(cut));
    kept++;
  }
  if (!kept) throw new Error(`no process ran the engine's bundle (no script named ${THE_ENGINES_SCRIPT} in ${v8Dir})`);
  const reports = path.join(out, 'report');
  fs.rmSync(reports, { recursive: true, force: true });
  // c8 names files from the working folder (its include list and the report's paths): this repository's.
  const cwd = process.cwd();
  process.chdir(root);
  try {
    await new Report({
      tempDirectory: engineOnly,
      reportsDirectory: reports,
      reporter: ['json', 'html'],
      include: COUNTED.map((dir) => `${dir}**`),
      excludeAfterRemap: true,
      src: [root],
    }).run();
  } finally {
    process.chdir(cwd);
  }
  const final = JSON.parse(fs.readFileSync(path.join(reports, 'coverage-final.json'), 'utf8')) as Record<
    string,
    FileCoverage
  >;
  return linesOf(final, root);
}

/** Plays the matrix's sets `sets` under V8's coverage, `jobs` games at a time, and writes lines.json and the report in
 *  `out`. Returns what it wrote, and the games that failed (none, or the coverage is short of them). */
export async function measureTheMatrixsCoverage({
  sets = ['A', 'B'],
  jobs = os.availableParallelism(),
  out = DEFAULT_OUT,
}: { sets?: SeedSet[]; jobs?: number; out?: string } = {}): Promise<{ lines: TheMatrixsLines; errors: string[] }> {
  const src = path.join(ROOT, 'src');
  const tree = whatSrcHolds(src);
  fs.rmSync(out, { recursive: true, force: true });
  const v8Dir = path.join(out, 'v8');
  fs.mkdirSync(v8Dir, { recursive: true });
  const { code, map } = await theEnginesBundleWithItsSourceMap(src);
  const bundle = path.join(out, THE_ENGINES_SCRIPT);
  fs.writeFileSync(bundle, `${code}//# sourceMappingURL=${THE_ENGINES_SCRIPT}.map\n`);
  fs.writeFileSync(`${bundle}.map`, JSON.stringify(map));
  const games = sets.flatMap((set) => matrix(set)).sort((a, b) => b.realms - a.realms);
  const was = { bundle: process.env['KC_ENGINE_BUNDLE'], coverage: process.env['NODE_V8_COVERAGE'] };
  process.env['KC_ENGINE_BUNDLE'] = bundle;
  process.env['NODE_V8_COVERAGE'] = v8Dir;
  let replies: EveryRealmReply[];
  try {
    replies = await forkPool<EveryRealmReply>(EVERY_REALM_WORKER, games, jobs);
  } finally {
    for (const [k, v] of [
      ['KC_ENGINE_BUNDLE', was.bundle],
      ['NODE_V8_COVERAGE', was.coverage],
    ] as const)
      if (v === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = v;
  }
  const errors = replies.flatMap((r) => (r.ok ? [] : [`${r.id}: ${r.error.split('\n')[0] ?? ''}`]));
  const files = await linesFromV8Coverage(v8Dir, bundle, out);
  fs.rmSync(v8Dir, { recursive: true, force: true });
  const lines: TheMatrixsLines = {
    about:
      "Which lines of src/engine/ and src/views/ the balance matrix's games reach (npm run proof:coverage, tools/proof/the-matrixs-coverage.ts).",
    tree,
    sets,
    games: replies.filter((r) => r.ok).length,
    files,
  };
  fs.writeFileSync(path.join(out, 'lines.json'), JSON.stringify(lines));
  return { lines, errors };
}

/** lines.json in `out`, if it was measured on what src/ holds now (else null). */
export function theMatrixsLinesIfCurrent(out = DEFAULT_OUT): TheMatrixsLines | null {
  const file = path.join(out, 'lines.json');
  if (!fs.existsSync(file)) return null;
  const lines = JSON.parse(fs.readFileSync(file, 'utf8')) as TheMatrixsLines;
  return lines.tree === whatSrcHolds(path.join(ROOT, 'src')) ? lines : null;
}

/** The sets an option names: both unless one is given. */
export const setsNamed = (set: string | undefined): SeedSet[] => (set === 'A' || set === 'B' ? [set] : ['A', 'B']);

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { set: { type: 'string' }, jobs: { type: 'string' }, out: { type: 'string' } },
  });
  const t0 = performance.now();
  const out = path.resolve(values.out ?? DEFAULT_OUT);
  const { lines, errors } = await measureTheMatrixsCoverage({
    sets: setsNamed(values.set),
    jobs: Number(values.jobs) || os.availableParallelism(),
    out,
  });
  console.log(
    `The matrix's coverage, set ${lines.sets.join(' and set ')}: ${String(lines.games)} games in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  );
  for (const line of summaryOf(lines.files)) console.log('  ' + line);
  console.log(`Written to ${path.relative(process.cwd(), out)}/ (lines.json; report/index.html, line by line)`);
  if (errors.length) {
    console.log(`\n${String(errors.length)} game(s) failed, so their lines aren't counted:\n  ${errors.join('\n  ')}`);
    return 1;
  }
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
