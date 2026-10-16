// npm run balance: play the balance matrix (plan P1-02) and compare it with the committed baseline, game by game. It
// fails if any game differs, if a game fails, or if a scripted case never happens.
// npm run balance:update: play set A and set B and rewrite both baselines (tests/balance/baseline/), in the PR that
// changes play.
//
// Options (after `--`): --set B (play the noise set and compare its statistics), --jobs N (games side by side; default
// one per core), --only id,id (some games; no baseline check of the scripted cases), --out FILE (also write this run
// in the baseline's form, e.g. to compare two runs). KC_SITE plays another copy of the site.
// Not part of npm test or npm run check: it takes about 20 s on 14 cores, too slow for every edit. CI's balance job runs
// it when an engine path changed (engine-paths.ts); it stops first if its page loads a file that isn't on that list,
// because CI wouldn't play the matrix when that file changed.
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pageFiles, SITE } from '../../tests/lib/boot.js';
import {
  BASELINE_FILE,
  diffGame,
  formatBaseline,
  readBaseline,
  totalCases,
  writeBaseline,
  type KeptGame,
} from './baseline.ts';
import { isEnginePath } from './engine-paths.ts';
import { matrix, type GameSpec, type SeedSet } from './matrix.ts';
import { compareRuns, meaningfulChanges, type Change } from './paired.ts';
import { CASE_NAMES, type GameResult } from './play.ts';
import { show, showDiff, showRange } from './report.ts';
import type { Job, Reply } from './worker.ts';

const WORKER = path.join(import.meta.dirname, 'worker.ts');

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
  const n = Math.max(1, Math.min(jobs, all.length));
  const env = site ? { ...process.env, KC_SITE: site } : process.env;
  await Promise.all(
    Array.from(
      { length: n },
      () =>
        new Promise<void>((resolve, reject) => {
          const child = fork(WORKER, {
            execArgv: ['--import', 'tsx'],
            env,
            stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          });
          const next = () => {
            const job = queue.shift();
            if (job) child.send(job);
            else child.disconnect();
          };
          child.on('message', (r: Reply) => {
            if (r.ok) done.set(r.result.id, r.result);
            else errors.push(`${r.id}: ${r.error}`);
            next();
          });
          child.on('exit', (code) => {
            if (code) reject(new Error(`a balance worker stopped (exit ${String(code)})`));
            else resolve();
          });
          next();
        }),
    ),
  );
  return { results: all.flatMap((g) => done.get(g.spec.id) ?? []), errors };
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

/** The files the matrix's page loads (the GM portal and its scripts) that aren't engine paths, as git names them. */
export const unlistedPageFiles = (): string[] =>
  pageFiles('kingdoms-call-gm-portal.html')
    .map((f) => 'site/' + path.relative(SITE, f).split(path.sep).join('/'))
    .filter((f) => !isEnginePath(f));

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      update: { type: 'boolean', default: false },
      set: { type: 'string', default: 'A' },
      jobs: { type: 'string' },
      only: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const jobs = Number(values.jobs) || os.availableParallelism();
  const sets: SeedSet[] = values.update ? ['A', 'B'] : [values.set === 'B' ? 'B' : 'A'];
  const only = values.only?.split(',');
  let failed = false;
  const unlisted = unlistedPageFiles();
  if (unlisted.length) {
    console.log(
      `The matrix's page loads files that aren't engine paths, so CI wouldn't play it when they change: ${unlisted.join(', ')}. Add them to tools/balance/engine-paths.ts.`,
    );
    return 1;
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
    if (values.out) fs.writeFileSync(values.out, formatBaseline('A', kept));
    if (values.update) {
      writeBaseline(set, kept);
      console.log(`Rewrote ${path.relative(process.cwd(), BASELINE_FILE[set])}: commit it with the change.\n`);
      continue;
    }

    // Game by game against the baseline.
    const base = new Map(readBaseline(set).map((g) => [g.id, g]));
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
  }
  return failed ? 1 : 0;
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
