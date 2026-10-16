// npm run balance -- <scenario> [--base REF] [--runs N] [--jobs N]: a named scenario (scenario.ts) on the base
// branch's site and on this one, compared figure by figure. The base's side plays a copy of REF's site (default main;
// git archive, through KC_SITE), this side plays this site (or KC_SITE's). Each side plays all its runs with every
// core, one side after the other, so each side's time is its own. Not part of CI or npm test: 400 runs a side take
// about a minute on 14 cores.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compareScenario,
  renderScenario,
  scenarioFile,
  scenarioNames,
  type Scenario,
  type ScenarioJob,
  type ScenarioReply,
} from './scenario.ts';
import { forkPool, withSiteAt } from './sides.ts';
import type { Stats } from './stats.ts';

const WORKER = path.join(import.meta.dirname, 'scenario-worker.ts');

/** Plays runs 1 to `runs` of scenario `name`, `jobs` at a time: each run's statistics, in order, and the errors. */
export async function playRuns(
  name: string,
  runs: number,
  jobs: number,
  site?: string,
): Promise<{ stats: Stats[]; errors: string[]; secs: number }> {
  const t0 = performance.now();
  const list: ScenarioJob[] = Array.from({ length: runs }, (_, i) => ({ name, run: i + 1 }));
  const replies = await forkPool<ScenarioReply>(WORKER, list, jobs, site);
  const byRun = new Map<number, Stats>();
  const errors: string[] = [];
  for (const r of replies) {
    if (r.ok) byRun.set(r.run, r.stats);
    else errors.push(`run ${String(r.run)}: ${r.error}`);
  }
  return {
    stats: list.map((j) => byRun.get(j.run) ?? {}),
    errors,
    secs: (performance.now() - t0) / 1000,
  };
}

export async function playScenario(
  name: string,
  opts: { base: string; runs?: number; jobs?: number },
): Promise<number> {
  if (!fs.existsSync(scenarioFile(name))) {
    console.log(`No scenario "${name}". The scenarios: ${scenarioNames().join(', ')} (tests/balance/scenarios/).`);
    return 1;
  }
  const scenario = ((await import(pathToFileURL(scenarioFile(name)).href)) as { default: Scenario }).default;
  const runs = opts.runs ?? scenario.runs;
  const jobs = opts.jobs ?? os.availableParallelism();
  const commit = execFileSync('git', ['rev-parse', '--short', opts.base], { encoding: 'utf8' }).trim();
  const here = process.env['KC_SITE'] ?? 'this branch';

  const base = await withSiteAt(opts.base, (site) => playRuns(name, runs, jobs, site));
  console.log(`Scenario "${name}" on ${opts.base} (${commit}): ${String(runs)} runs in ${base.secs.toFixed(1)} s`);
  const head = await playRuns(name, runs, jobs);
  console.log(`Scenario "${name}" on ${here}: ${String(runs)} runs in ${head.secs.toFixed(1)} s`);
  const errors = [...base.errors.map((e) => `${opts.base}, ${e}`), ...head.errors.map((e) => `${here}, ${e}`)];
  if (errors.length) {
    console.log(`\n${String(errors.length)} run(s) failed:\n${errors.join('\n')}`);
    return 1;
  }
  const result = compareScenario(scenario.figures, base.stats, head.stats);
  console.log(
    '\n' +
      renderScenario({
        name,
        title: scenario.title,
        base: `${opts.base} (${commit})`,
        head: here,
        result,
      }),
  );
  return 0;
}
