// npm run balance:report -- --base REF --head FILE: the balance report (report.ts) of this branch's games against the
// base branch's. Run by CI's balance job on a pull request, after npm run balance (which wrote FILE with --out); the
// job uploads the report and a separate workflow posts it as the pull request's comment (balance-report.yml).
// - The base's games are its committed baseline (git show REF:tests/balance/baseline/matrix.json): never played.
// - Where the changed games first differ: up to 12 of them are replayed on both sides, each only up to the first turn
//   that differs, keeping that turn's GM log. The base's side plays a copy of the base's site (git archive REF site,
//   through KC_SITE); this side plays this site (or KC_SITE's). A replay that doesn't match its own baseline is left
//   out, with a note (a pull request that changes the runner can do that).
// Options: --out DIR (default balance-report/: report.md and report.json), --jobs N (default one per core).
// With GITHUB_STEP_SUMMARY set, it adds the report to the job's summary too.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { BASELINE_FILE, diffGame, parseBaseline, type KeptGame } from './baseline.ts';
import { matrix } from './matrix.ts';
import type { GameResult } from './play.ts';
import {
  buildReport,
  classify,
  compareGames,
  firstDifference,
  gamesToReplay,
  renderReport,
  type FirstDiff,
} from './report.ts';
import { playAll } from './run.ts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });

/** The report file the posting workflow reads: `markdown` is the comment's text. */
export interface ReportFile {
  version: 1;
  class: string;
  verdict: string;
  markdown: string;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      out: { type: 'string', default: 'balance-report' },
      jobs: { type: 'string' },
    },
  });
  if (!values.base || !values.head) {
    console.log('Usage: npm run balance:report -- --base REF --head FILE (FILE from npm run balance -- --out FILE)');
    return 1;
  }
  if (!fs.existsSync(values.head)) {
    console.log(`No games to report: ${values.head} is missing (the games failed before they were written).`);
    return 1;
  }
  const jobs = Number(values.jobs) || os.availableParallelism();
  const base = parseBaseline(git('show', `${values.base}:tests/balance/baseline/matrix.json`)).games;
  const head = parseBaseline(fs.readFileSync(values.head, 'utf8')).games;
  const committed = fs.existsSync(BASELINE_FILE.A) ? parseBaseline(fs.readFileSync(BASELINE_FILE.A, 'utf8')).games : [];
  const byId = (list: KeptGame[]) => new Map(list.map((g) => [g.id, g]));
  const committedById = byId(committed);
  const baselineStale =
    committed.length !== head.length ||
    head.some((g) => {
      const c = committedById.get(g.id);
      return !c || diffGame(c, g) != null;
    });

  const changes = compareGames(base, head);
  const cls = classify(changes, head.length);
  const replays = gamesToReplay(changes, cls);
  const firstDiffs: FirstDiff[] = [];
  const replayNotes: string[] = [];
  if (replays.length) {
    const t0 = performance.now();
    const specs = new Map(matrix('A').map((s) => [s.id, s]));
    const jobsFor = replays.flatMap((r) => {
      const spec = specs.get(r.id);
      return spec ? [{ spec, untilTurn: r.turn }] : [];
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-balance-base-'));
    try {
      const tar = path.join(dir, 'site.tar');
      git('archive', '--format=tar', '-o', tar, values.base, 'site');
      execFileSync('tar', ['-xf', tar, '-C', dir]);
      const [onBase, onHead] = await Promise.all([
        playAll(jobsFor, Math.max(1, Math.floor(jobs / 2)), path.join(dir, 'site')),
        playAll(jobsFor, Math.max(1, Math.ceil(jobs / 2))),
      ]);
      const baseById = byId(base);
      const headById = byId(head);
      const results = (r: { results: GameResult[] }) => new Map(r.results.map((g) => [g.id, g]));
      const [rb, rh] = [results(onBase), results(onHead)];
      for (const e of [...onBase.errors, ...onHead.errors])
        replayNotes.push(`A replay failed: ${e.split('\n')[0] ?? e}`);
      for (const { id, turn } of replays) {
        const b = rb.get(id);
        const h = rh.get(id);
        if (!b || !h) continue;
        // Each replay must match its own side's games up to that turn, or its log isn't the one that was hashed.
        const same = (r: GameResult, g: KeptGame | undefined) =>
          g != null && r.turns.join() === g.turns.slice(0, r.turns.length).join();
        if (!same(b, baseById.get(id)) || !same(h, headById.get(id))) {
          replayNotes.push(
            `${id}: its replay didn't match its baseline, so its first difference isn't shown (does this pull request change the balance runner?).`,
          );
          continue;
        }
        // A side whose game was over before that turn has no log for it.
        const log = (r: GameResult) => (r.turns.length === turn ? (r.log ?? []) : []);
        firstDiffs.push(firstDifference(id, turn, log(b), log(h)));
      }
      console.log(
        `Replayed ${String(replays.length)} changed game(s) on both sides in ${((performance.now() - t0) / 1000).toFixed(1)} s.`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  const report = buildReport({ base, head, firstDiffs, replayNotes, baselineStale });
  const markdown = renderReport(report);
  fs.mkdirSync(values.out, { recursive: true });
  fs.writeFileSync(path.join(values.out, 'report.md'), markdown);
  const file: ReportFile = { version: 1, class: report.class, verdict: report.verdict, markdown };
  fs.writeFileSync(path.join(values.out, 'report.json'), JSON.stringify(file, null, 2) + '\n');
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) fs.appendFileSync(summary, markdown);
  console.log(`\n${markdown}\nWrote ${path.join(values.out, 'report.md')} and report.json (${report.class}).`);
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
