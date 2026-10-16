// One of the balance runner's worker processes (run.ts starts one per core): it plays the games it is sent, one at a
// time, each in its own fresh page, and sends back each result or error.
import { readPage } from '../../tests/lib/boot.js';
import type { GameSpec } from './matrix.ts';
import { playGame, type GameResult } from './play.ts';

export type Reply = { ok: true; result: GameResult } | { ok: false; id: string; error: string };

const html = readPage('kingdoms-call-gm-portal.html');
const reply = (r: Reply) => process.send?.(r);
process.on('message', (spec: GameSpec) => {
  playGame(spec, html).then(
    (result) => reply({ ok: true, result }),
    (e: unknown) => reply({ ok: false, id: spec.id, error: e instanceof Error ? (e.stack ?? e.message) : String(e) }),
  );
});
