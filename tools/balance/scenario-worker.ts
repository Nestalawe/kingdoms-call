// One of a named scenario's worker processes (scenario-run.ts starts them through sides.ts): it plays the runs it is
// sent, one at a time, each on its own fresh page (seed: the run's number; clock: the matrix's), and sends back each
// run's statistics or error. KC_SITE, set by the pool, picks the copy of the site.
import { pathToFileURL } from 'node:url';
import { bootScenario } from '../../tests/lib/scenario.js';
import { START } from './matrix.ts';
import { scenarioFile, type Scenario, type ScenarioJob, type ScenarioReply } from './scenario.ts';

const loaded = new Map<string, Promise<Scenario>>();
const load = (name: string) => {
  let s = loaded.get(name);
  if (!s) {
    s = import(pathToFileURL(scenarioFile(name)).href).then((m: { default: Scenario }) => m.default);
    loaded.set(name, s);
  }
  return s;
};

async function play(job: ScenarioJob): Promise<ScenarioReply> {
  const scenario = await load(job.name);
  const t0 = performance.now();
  const sc = await bootScenario({ seed: job.run, now: START, telemetry: true });
  try {
    const stats = await scenario.play(sc, job.run);
    if (sc.errs.length) throw new Error(`the page reported an error: ${String(sc.errs[0])}`);
    return { ok: true, run: job.run, stats, ms: Math.round(performance.now() - t0) };
  } finally {
    sc.W.close();
  }
}

const reply = (r: ScenarioReply) => process.send?.(r);
process.on('message', (job: ScenarioJob) => {
  play(job).then(reply, (e: unknown) =>
    reply({ ok: false, run: job.run, error: e instanceof Error ? (e.stack ?? e.message) : String(e) }),
  );
});
