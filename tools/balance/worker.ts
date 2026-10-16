// One of the balance runner's worker processes (run.ts starts one per core): it plays the games it is sent, one at a
// time, each in its own fresh page, and sends back each result or error. A job with `untilTurn` is a replay: the game
// stops after that turn and keeps its GM log lines (report.ts, where two runs part).
import { readPage } from '../../tests/lib/boot.js';
import type { GameSpec } from './matrix.ts';
import { playGame, type GameResult, type PlayOptions } from './play.ts';

export interface Job extends PlayOptions {
  spec: GameSpec;
}
export type Reply = { ok: true; result: GameResult } | { ok: false; id: string; error: string };

const html = readPage('kingdoms-call-gm-portal.html');
const reply = (r: Reply) => process.send?.(r);
process.on('message', (job: Job) => {
  const options: PlayOptions = job.untilTurn == null ? {} : { untilTurn: job.untilTurn };
  playGame(job.spec, html, options).then(
    (result) => reply({ ok: true, result }),
    (e: unknown) =>
      reply({ ok: false, id: job.spec.id, error: e instanceof Error ? (e.stack ?? e.message) : String(e) }),
  );
});
