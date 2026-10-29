// npm run proof:plant -- <patch>… [--tests <file>,…] [--name <regex>] [--all-tests] [--set A|B] [--keep]: what the
// checks see of a planted fault (tools/proof/README.md). For each patch (a `git diff`, of any file): a copy of this
// working tree (copies-of-the-tree.ts: node_modules linked, committed in a git repository of its own), the patch applied
// and committed; then, in the copy, the balance matrix of both sets with every realm's report (npm run balance -- --set
// S --out …), each compared with the copy's committed baselines game by game; then the tests named (npm test -- <file
// filters> [-t <regex>], or every test with --all-tests), and which are red. The copy is removed after (--keep keeps
// it). The result, printed and in result.json in its folder (named at the end): the games and the reports that differ,
// and the tests red.
//
// A plant in reached code shows as games or reports that differ; a plant in a line no game reaches shows only as a
// test red: that line's unit case. About 2 min a patch for the two sets, and the tests' own time on top.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  compareReports,
  describeReportsDiff,
  diffGame,
  parseBaseline,
  parseReports,
  type GameDiff,
  type KeptGame,
  type ReportsGame,
} from '../balance/baseline.ts';
import type { SeedSet } from '../balance/matrix.ts';
import { ROOT } from '../build.ts';
import { failedTestsIn } from '../mutants/run.ts';
import {
  aFolderForACopy,
  commitTheCopy,
  copyTheWorkingTree,
  linkNodeModules,
  plantAPatch,
  removeTheCopy,
} from './copies-of-the-tree.ts';
import { setsNamed } from './the-matrixs-coverage.ts';

/** A game that differs, and how, in a line. */
export interface ADifference {
  id: string;
  how: string;
}

/** One set's outcome in the planted copy. */
export interface ASetsOutcome {
  /** npm run balance's exit code: 0 when everything matched its baseline. */
  exit: number;
  /** The games whose matrix hashes or statistics differ from the baseline (set B's baseline keeps only statistics). */
  games: ADifference[];
  /** The games where a realm's report differs from reports.json. */
  reports: ADifference[];
  /** What else the run said went wrong: games that failed, a leak check broken, a scripted case never met. */
  notes: string[];
}

/** One patch's outcome. */
export interface APlantsOutcome {
  patch: string;
  /** The files the patch changed. */
  files: string[];
  sets: Partial<Record<SeedSet, ASetsOutcome>>;
  /** The tests run, if any were named: their exit code, and the tests red. */
  tests: { exit: number; red: string[] } | null;
}

/** A game's matrix difference in a line, as npm run balance prints it. */
export function describeGameDiff(d: GameDiff): string {
  return [
    d.firstTurn != null ? `from turn ${String(d.firstTurn)}` : '',
    d.columns.join(', '),
    d.turns ? `${String(d.turns[0])} turns → ${String(d.turns[1])}` : '',
    d.results ? 'results' : '',
    d.sections.length ? `report sections: ${d.sections.join(', ')}` : '',
    d.stats.length ? `${String(d.stats.length)} statistics` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** Set B's baseline keeps only a game's statistics, so its games are compared on those alone. */
const statsOnly = (g: KeptGame): KeptGame => ({ id: g.id, turns: [], results: '', stats: g.stats });

/** The games of `set` whose run differs from its baselines: the matrix's (`baseline`, `run`) and every realm's report
 *  (`reportsBaseline`, `reportsRun`). A game missing from a baseline differs. */
export function whatTheSetChanged(
  set: SeedSet,
  baseline: KeptGame[],
  run: KeptGame[],
  reportsBaseline: ReportsGame[],
  reportsRun: ReportsGame[],
): { games: ADifference[]; reports: ADifference[] } {
  const base = new Map(baseline.map((g) => [g.id, g]));
  const games = run.flatMap((g): ADifference[] => {
    const b = base.get(g.id);
    if (!b) return [{ id: g.id, how: 'not in the baseline' }];
    const d = set === 'A' ? diffGame(b, g) : diffGame(statsOnly(b), statsOnly(g));
    return d ? [{ id: g.id, how: describeGameDiff(d) }] : [];
  });
  const reports = compareReports(reportsBaseline, reportsRun).map((d) => ({ id: d.id, how: describeReportsDiff(d) }));
  return { games, reports };
}

/** The lines of npm run balance's output that say something went wrong beyond a difference. */
export function notesIn(log: string): string[] {
  return log
    .split('\n')
    .filter((l) =>
      /game\(s\) failed|A leak check broke|A scripted case never happened|MISSED|saved other states|isn't there or requires nothing/.test(
        l,
      ),
    )
    .map((l) => l.trim());
}

const run = (cwd: string, args: string[], log: string): number => {
  const r = spawnSync('npm', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, env: process.env });
  fs.writeFileSync(log, `${r.stdout}\n${r.stderr}`);
  return r.status ?? 1;
};

/** Plays set `set` in the copy `copy` (its own build, its own every-realm half), writing its run and log in `results`. */
export function playASet(copy: string, set: SeedSet, results: string): ASetsOutcome {
  const dir = path.join(results, `set-${set}`);
  fs.mkdirSync(dir, { recursive: true });
  const log = path.join(dir, 'balance.log');
  const exit = run(copy, ['run', 'balance', '--', '--set', set, '--out', path.join(dir, 'matrix.json')], log);
  const notes = notesIn(fs.readFileSync(log, 'utf8'));
  const runFile = path.join(dir, 'matrix.json');
  const reportsFile = path.join(dir, 'every-realm.json');
  if (!fs.existsSync(runFile))
    return { exit, games: [], reports: [], notes: [...notes, `the set's run wrote no games (its log: ${log})`] };
  const baselines = path.join(copy, 'tests', 'balance', 'baseline');
  const read = (f: string) => fs.readFileSync(f, 'utf8');
  const changed = whatTheSetChanged(
    set,
    parseBaseline(read(path.join(baselines, set === 'A' ? 'matrix.json' : 'noise.json'))).games,
    parseBaseline(read(runFile)).games,
    parseReports(read(path.join(baselines, 'reports.json')))[set] ?? [],
    fs.existsSync(reportsFile) ? (parseReports(read(reportsFile))[set] ?? []) : [],
  );
  if (!fs.existsSync(reportsFile)) notes.push("every realm's report wasn't played");
  return { exit, ...changed, notes };
}

/** Runs the tests named in the copy, with Vitest's JSON report, and lists the red ones. */
export function runTheTests(
  copy: string,
  { files, name, all }: TheTestsNamed,
  results: string,
): { exit: number; red: string[] } {
  const json = path.join(results, 'vitest.json');
  const filters = all ? [] : files;
  const exit = run(
    copy,
    [
      'test',
      '--',
      ...filters,
      ...(name ? ['-t', name] : []),
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${json}`,
    ],
    path.join(results, 'tests.log'),
  );
  const red = fs.existsSync(json) ? failedTestsIn(fs.readFileSync(json, 'utf8'), copy) : [];
  return { exit, red: exit && !red.length ? [`the tests stopped (exit ${String(exit)}): see tests.log`] : red };
}

/** How many games of each list a plant's outcome prints (result.json has them all). */
export const SHOWN = 8;

/** What a plant's outcome prints. */
export function describeOutcome(o: APlantsOutcome): string[] {
  const out = [`${o.patch} (${o.files.join(', ')}):`];
  for (const [set, s] of Object.entries(o.sets)) {
    out.push(
      `  set ${set}: ${String(s.games.length)} game(s) differ, ${String(s.reports.length)} game(s) with a report that differs${s.exit ? '' : ' (npm run balance green)'}`,
    );
    for (const d of s.games.slice(0, SHOWN)) out.push(`    matrix  ${d.id}: ${d.how}`);
    if (s.games.length > SHOWN) out.push(`    matrix  … and ${String(s.games.length - SHOWN)} more`);
    for (const d of s.reports.slice(0, SHOWN)) out.push(`    reports ${d.id}: ${d.how}`);
    if (s.reports.length > SHOWN) out.push(`    reports … and ${String(s.reports.length - SHOWN)} more`);
    for (const n of s.notes) out.push(`    ${n}`);
  }
  if (o.tests)
    out.push(
      o.tests.red.length
        ? `  tests: ${String(o.tests.red.length)} red\n${o.tests.red.map((t) => `    ${t}`).join('\n')}`
        : '  tests: all green',
    );
  return out;
}

/** Which tests to run in a planted copy: Vitest's file filters, a test-name pattern, or every test. */
export interface TheTestsNamed {
  files: string[];
  name?: string | undefined;
  all: boolean;
}

/** Plants `patch` in a copy of `repo`'s working tree and plays `sets` there (then the tests named, if any), keeping
 *  the runs and logs in `here`; the copy is removed after unless `keep`. */
export function whatAPlantChanges({
  repo,
  patch,
  sets,
  tests,
  here,
  keep = false,
}: {
  repo: string;
  patch: string;
  sets: SeedSet[];
  tests: TheTestsNamed | null;
  here: string;
  keep?: boolean;
}): APlantsOutcome & { copy: string } {
  const copy = aFolderForACopy('plant');
  fs.mkdirSync(here, { recursive: true });
  try {
    copyTheWorkingTree(repo, copy);
    linkNodeModules(repo, copy);
    commitTheCopy(copy);
    const outcome: APlantsOutcome = { patch, files: plantAPatch(copy, patch), sets: {}, tests: null };
    for (const set of sets) outcome.sets[set] = playASet(copy, set, here);
    if (tests) outcome.tests = runTheTests(copy, tests, here);
    return { ...outcome, copy };
  } finally {
    if (!keep) removeTheCopy(copy);
  }
}

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      tests: { type: 'string' },
      name: { type: 'string' },
      'all-tests': { type: 'boolean', default: false },
      set: { type: 'string' },
      keep: { type: 'boolean', default: false },
    },
  });
  if (!positionals.length) {
    console.log('Name a patch: npm run proof:plant -- <patch>… [--tests <file>,…] [--name <regex>] [--all-tests]');
    return 1;
  }
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const results = aFolderForACopy('plant-results');
  const files = values.tests?.split(',').filter(Boolean) ?? [];
  const tests =
    values['all-tests'] || files.length > 0 || values.name != null
      ? { files, name: values.name, all: values['all-tests'] }
      : null;
  const outcomes: APlantsOutcome[] = [];
  for (const patch of positionals.map((p) => path.resolve(cwd, p))) {
    const t0 = performance.now();
    const here = path.join(results, path.basename(patch));
    const { copy, ...outcome } = whatAPlantChanges({
      repo: ROOT,
      patch,
      sets: setsNamed(values.set),
      tests,
      here,
      keep: values.keep,
    });
    outcomes.push(outcome);
    console.log(
      [
        ...describeOutcome(outcome),
        `  (${((performance.now() - t0) / 1000).toFixed(0)} s; logs in ${here}${values.keep ? `; the copy kept: ${copy}` : ''})`,
      ].join('\n'),
    );
  }
  fs.writeFileSync(path.join(results, 'result.json'), JSON.stringify(outcomes, null, 2));
  console.log(`\nThe result: ${path.join(results, 'result.json')}`);
  return 0;
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  try {
    process.exitCode = main();
  } catch (e: unknown) {
    console.error(e);
    process.exitCode = 1;
  }
}
