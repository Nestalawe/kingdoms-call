// npm run balance: play the balance matrix (plan P1-02) and compare it with the committed baseline, game by game. It
// fails if any game differs, if a game fails, or if a scripted case never happens.
// npm run balance:update: play set A and set B and rewrite both baselines (tests/balance/baseline/), in the PR that
// changes play.
//
// Options (after `--`): --set B (play the noise set and compare its statistics), --jobs N (games side by side; default
// one per core), --only id,id (some games; no baseline check of the scripted cases), --out FILE (also write this run
// in the baseline's form, e.g. to compare two runs). It builds site/ from src/ first (tools/build.ts); KC_SITE plays
// another copy of the site instead, as it is.
// npm run balance -- <scenario> plays a named scenario on the base branch's site and on this one instead (scenario-run.ts;
// options --base REF, --runs N, --jobs N).
// Then its second half, every realm's report (every-realm.ts, P1-12a1): the same games in the engine's vm, with a report
// for every realm every turn, against tests/balance/baseline/reports.json, the leak checks run on every report; it
// fails if a report differs, if a leak check breaks, or if a game's saved states aren't the page's. It reads src/, not
// KC_SITE, so with KC_SITE it isn't played (its fail-first proof is a planted copy of the branch). With --out FILE, it
// writes its run beside FILE, as every-realm.json.
// Not part of npm test or npm run check: it takes about 50 s on 14 cores, too slow for every edit. CI's balance job runs
// it when an engine path changed (engine-paths.ts); it stops first if its page loads a file that isn't on that list,
// because CI wouldn't play the matrix when that file changed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pageFiles, SITE } from '../../tests/lib/boot.js';
import { GM_PAGE, pageFiles as pageSourceFiles } from '../pages.ts';
import {
  BASELINE_FILE,
  columnsNotKept,
  compareReports,
  describeReportsDiff,
  diffGame,
  formatReports,
  readBaseline,
  readReports,
  REPORTS_FILE,
  reportsIn,
  totalCases,
  writeBaseline,
  writeReports,
  writeRun,
  type KeptGame,
  type ReportsResult,
} from './baseline.ts';
import { isEnginePath } from './engine-paths.ts';
import { matrix, SEED_SETS, type BaselineSet, type GameSpec, type SeedSet } from './matrix.ts';
import { compareRuns, meaningfulChanges, type Change } from './paired.ts';
import { CASE_NAMES, type GameResult } from './play.ts';
import { show, showDiff, showRange } from './report.ts';
import { playScenario } from './scenario-run.ts';
import { buildSite, forkPool } from './sides.ts';
import type { Job, Reply } from './worker.ts';

const WORKER = path.join(import.meta.dirname, 'worker.ts');
const EVERY_REALM_WORKER = path.join(import.meta.dirname, 'every-realm-worker.ts');

/** Plays `games`, `jobs` at a time, each worker process one game at a time. Results in the order given. A game with
 *  `untilTurn` is a replay (worker.ts). `site` plays another copy of the site (as KC_SITE does). */
export async function playAll(
  games: (GameSpec | Job)[],
  jobs: number,
  site?: string,
): Promise<{ results: GameResult[]; errors: string[] }> {
  const all = games.map((g): Job => ('spec' in g ? g : { spec: g }));
  const queue = [...all].sort((a, b) => b.spec.realms - a.spec.realms); // the longest first, so none starts last
  const done = new Map<string, GameResult>();
  const errors: string[] = [];
  for (const r of await forkPool<Reply>(WORKER, queue, jobs, site)) {
    if (r.ok) done.set(r.result.id, r.result);
    else errors.push(`${r.id}: ${r.error}`);
  }
  return { results: all.flatMap((g) => done.get(g.spec.id) ?? []), errors };
}

/** What an every-realm worker sends back for a game (every-realm-worker.ts). */
export type EveryRealmReply = { ok: true; result: ReportsResult } | { ok: false; id: string; error: string };

/** Plays `games` with every realm's report (every-realm.ts), `jobs` at a time, in this checkout's src/: its engine
 *  bundle is built once, for every worker (KC_ENGINE_BUNDLE), in its own process, as tests/setup/global.ts builds it
 *  (this file doesn't load the engine: the workers do). Results in the order given. */
export async function playAllEveryRealm(
  games: GameSpec[],
  jobs: number,
): Promise<{ results: ReportsResult[]; errors: string[] }> {
  process.env['KC_ENGINE_BUNDLE'] = execFileSync(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      path.join(import.meta.dirname, '..', '..', 'tests', 'lib', 'engine.ts'),
      '--bundle-for-the-run',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const queue = [...games].sort((a, b) => b.realms - a.realms);
  const done = new Map<string, ReportsResult>();
  const errors: string[] = [];
  for (const r of await forkPool<EveryRealmReply>(EVERY_REALM_WORKER, queue, jobs)) {
    if (r.ok) done.set(r.result.id, r.result);
    else errors.push(`${r.id}: ${r.error}`);
  }
  return { results: games.flatMap((g) => done.get(g.id) ?? []), errors };
}

/** The games whose every-realm run saved a different state from the page's, turn by turn: the vm plays the matrix's
 *  game, and building every realm's report leaves the turns untouched. */
export function statesNotThePages(page: GameResult[], vm: ReportsResult[]): string[] {
  const byId = new Map(page.map((g) => [g.id, g]));
  return vm.flatMap((g) => {
    const states = (byId.get(g.id)?.turns ?? []).map((line) => line.split(' ')[0] ?? '');
    if (states.join() === g.states.join()) return [];
    const t = g.states.findIndex((x, i) => x !== states[i]);
    return [
      `${g.id}: from turn ${String((t < 0 ? Math.min(g.states.length, states.length) : t) + 1)} (${String(states.length)} turns on the page, ${String(g.states.length)} in the vm)`,
    ];
  });
}

const keep = (r: GameResult): KeptGame => {
  const kept: KeptGame = { id: r.id, turns: r.turns, results: r.results, stats: r.stats };
  if (r.report) kept.report = r.report;
  if (r.cases) kept.cases = r.cases;
  return kept;
};
// Set B's baseline keeps only the statistics.
const statsOnly = (g: KeptGame): KeptGame => ({ id: g.id, turns: [], results: '', stats: g.stats });

/** The statistics that moved beyond the noise, by group, biggest first (clear, then possible). */
export function describeChanges(group: string, changes: Change[]): string[] {
  const moved = changes.filter((c) => c.verdict === 'clear change' || c.verdict === 'possible change');
  const scale = (c: Change) => Math.abs(c.diff) / Math.max(1e-9, c.range95[1] - c.range95[0]);
  moved.sort((a, b) => (a.verdict === b.verdict ? scale(b) - scale(a) : a.verdict === 'clear change' ? -1 : 1));
  return moved.map(
    (c) =>
      `  ${group}: ${c.key}: ${show(c.key, c.base)} → ${show(c.key, c.head)} (${showDiff(c.key, c.diff)}; 95% range ${showRange(c.key, c.range95)}; 99% ${showRange(c.key, c.range99)}): ${c.verdict}`,
  );
}

/** The files the matrix's page is built from, as git names them: the GM portal's template, stylesheet and every module
 *  its entry imports (tools/pages.ts), the files beside it that tests/lib/boot.js's readPage inlines but its bundle
 *  (public/kc-config.js, the staging footer), and the build itself. */
export const pageSources = (): string[] => [
  ...pageSourceFiles(GM_PAGE).map((f) => 'src/' + f),
  ...pageFiles(GM_PAGE)
    .map((f) => path.relative(SITE, f).split(path.sep).join('/'))
    .filter((name) => !name.startsWith('assets/') && name !== GM_PAGE)
    .map((name) => 'public/' + name),
  'tools/build.ts',
];

/** The files the matrix's page is built from that aren't engine paths. */
export const unlistedPageFiles = (): string[] => pageSources().filter((f) => !isEnginePath(f));

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: 'string', default: 'main' },
      runs: { type: 'string' },
      update: { type: 'boolean', default: false },
      set: { type: 'string', default: 'A' },
      jobs: { type: 'string' },
      only: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const jobs = Number(values.jobs) || os.availableParallelism();
  const chosen = SEED_SETS.find((s) => s === values.set) ?? 'A';
  const sets: SeedSet[] = values.update ? ['A', 'B'] : [chosen];
  const only = values.only?.split(',');
  let failed = false;
  buildSite();
  const unlisted = unlistedPageFiles();
  if (unlisted.length) {
    console.log(
      `The matrix's page loads files that aren't engine paths, so CI wouldn't play it when they change: ${unlisted.join(', ')}. Add them to tools/balance/engine-paths.ts.`,
    );
    return 1;
  }
  const [scenario] = positionals;
  if (scenario != null) {
    const runs = Number(values.runs) || undefined;
    return playScenario(scenario, { base: values.base, jobs, ...(runs ? { runs } : {}) });
  }

  for (const set of sets) {
    const games = matrix(set).filter((g) => !only || only.includes(g.id));
    const t0 = performance.now();
    const { results, errors } = await playAll(games, jobs);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const slowest = Math.max(...results.map((r) => r.ms));
    console.log(
      `Balance matrix, set ${set}${process.env['KC_SITE'] ? ' on ' + process.env['KC_SITE'] : ''}: ${String(results.length)} games in ${secs} s, ${String(Math.min(jobs, games.length))} at a time (slowest game ${(slowest / 1000).toFixed(1)} s)`,
    );
    if (errors.length) {
      console.log(`\n${String(errors.length)} game(s) failed:\n${errors.join('\n')}`);
      return 1;
    }
    const cases = totalCases(results);
    console.log(
      'Scripted cases: ' +
        Object.entries(CASE_NAMES)
          .map(([k, name]) => `${name} ${String(cases[k as keyof typeof cases])}`)
          .join(', '),
    );
    if (!only) {
      const never = Object.entries(CASE_NAMES).filter(([k]) => !cases[k as keyof typeof cases]);
      if (never.length) {
        console.log(`A scripted case never happened: ${never.map(([, n]) => n).join(', ')}.`);
        failed = true;
      }
    }
    const kept = results.map(keep);
    if (values.out) writeRun(values.out, kept);
    if (set !== 'A' && set !== 'B') {
      console.log(`Set ${set} has no baseline: the run is written, nothing is compared.\n`);
      continue;
    }
    if (values.update) {
      writeBaseline(set, kept);
      console.log(`Rewrote ${path.relative(process.cwd(), BASELINE_FILE[set])}: commit it with the change.\n`);
      failed = (await everyRealm(set, games, results, jobs, values)) || failed;
      continue;
    }

    // Game by game against the baseline.
    const baseline = readBaseline(set);
    const notKept = columnsNotKept(baseline);
    if (notKept.length) {
      console.log(
        `\n${path.relative(process.cwd(), BASELINE_FILE[set])} has no ${notKept.join(', ')} column, so this run can't be compared with it in full: npm run balance:update, and commit the baseline.`,
      );
      failed = true;
    }
    const base = new Map(baseline.map((g) => [g.id, g]));
    const diffs = kept.flatMap((g) => {
      const b = base.get(g.id);
      if (!b) return [{ id: g.id, line: 'not in the baseline' }];
      const d = set === 'A' ? diffGame(b, g) : diffGame(statsOnly(b), statsOnly(g));
      if (!d) return [];
      const parts = [
        d.firstTurn != null ? `from turn ${String(d.firstTurn)}` : '',
        d.columns.length ? d.columns.join(', ') : '',
        d.turns ? `${String(d.turns[0])} turns → ${String(d.turns[1])}` : '',
        d.results ? 'results' : '',
        d.sections.length > 4
          ? `${String(d.sections.length)} report sections`
          : d.sections.length
            ? `report sections: ${d.sections.join(', ')}`
            : '',
        d.stats.length ? `${String(d.stats.length)} statistics` : '',
      ].filter(Boolean);
      return [{ id: g.id, line: parts.join('; ') }];
    });
    console.log(
      `\nCompared with ${path.relative(process.cwd(), BASELINE_FILE[set])}: ${String(kept.length - diffs.length)} of ${String(kept.length)} games identical.`,
    );
    for (const d of diffs) console.log(`  ${d.id}: ${d.line}`);
    if (diffs.length) {
      failed = true;
      console.log('\nStatistics beyond the noise (paired by seed):');
      let headline: Change[] = [];
      for (const group of ['bots', 'scripted']) {
        const ids = kept.filter((g) => g.id.startsWith(group)).map((g) => g.id);
        const changes = compareRuns(
          ids.map((id) => base.get(id)?.stats ?? {}),
          ids.map((id) => kept.find((g) => g.id === id)?.stats ?? {}),
        );
        if (group === 'bots') headline = meaningfulChanges(changes);
        const lines = describeChanges(group, changes);
        console.log(lines.length ? lines.join('\n') : `  ${group}: none`);
      }
      console.log(
        headline.length
          ? `Overall: a meaningful change in ${headline.map((c) => c.key).join('; ')}.`
          : "Overall: no meaningful change in the bot games' headline statistics.",
      );
      console.log('\nIf this change is meant to change play: npm run balance:update, and commit the baseline.');
    }
    failed = (await everyRealm(set, games, results, jobs, values)) || failed;
  }
  return failed ? 1 : 0;
}

/** The second half: `games` with every realm's report, against reports.json's set `set` (or rewriting it), and their
 *  saved states against the page's `page`. True if it fails. */
async function everyRealm(
  set: BaselineSet,
  games: GameSpec[],
  page: GameResult[],
  jobs: number,
  values: { update: boolean; out?: string | undefined },
): Promise<boolean> {
  if (process.env['KC_SITE']) {
    console.log(
      "\nEvery realm's report: not played, because KC_SITE names another copy of the site and this half reads src/ (prove it on a planted copy of the branch).",
    );
    return false;
  }
  const t0 = performance.now();
  const { results, errors } = await playAllEveryRealm(games, jobs);
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(
    `\nEvery realm's report, set ${set}: ${String(reportsIn(results))} reports in ${String(results.length)} games, in the engine's vm, in ${secs} s`,
  );
  let failed = false;
  if (errors.length) {
    // The games that played are still compared, so a fault shows in every game it reaches.
    console.log(`${String(errors.length)} game(s) failed:\n${errors.join('\n')}\n`);
    failed = true;
  }
  const leaking = results.filter((g) => g.leaks.length);
  if (leaking.length) {
    console.log(
      `A leak check broke in ${String(leaking.length)} game(s), first in:\n` +
        leaking.map((g) => `${g.id}: ${g.leaks[0] ?? ''}`).join('\n') +
        '\n',
    );
    failed = true;
  }
  const notThePages = statesNotThePages(page, results);
  if (notThePages.length) {
    console.log(
      `The vm's games saved other states than the page's, so they aren't the matrix's games:\n  ${notThePages.join('\n  ')}`,
    );
    failed = true;
  }
  if (values.out)
    fs.writeFileSync(path.join(path.dirname(values.out), 'every-realm.json'), formatReports({ [set]: results }));
  const file = path.relative(process.cwd(), REPORTS_FILE);
  if (values.update) {
    if (failed) return true;
    writeReports(set, results);
    console.log(`Rewrote set ${set} of ${file}: commit it with the change.\n`);
    return failed;
  }
  const baseline = readReports(set);
  if (!baseline.length) {
    console.log(`${file} has no set ${set}: npm run balance:update, and commit it.`);
    return true;
  }
  const diffs = compareReports(baseline, results);
  console.log(
    `Compared with ${file}: ${String(results.length - diffs.length)} of ${String(results.length)} games identical.`,
  );
  for (const d of diffs) console.log(`  ${d.id}: ${describeReportsDiff(d)}`);
  if (diffs.length) {
    console.log(
      "\nIf this change is meant to change a realm's report: npm run balance:update, and commit the baseline.",
    );
    failed = true;
  }
  return failed;
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
