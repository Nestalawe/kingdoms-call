// One of the every-realm half's worker processes (run.ts starts one per core, through sides.ts): it plays the games it is
// sent, one at a time, each in a fresh vm with the engine (every-realm.ts), and sends back each result or error. The
// engine's bundle is the one run.ts built for the run (KC_ENGINE_BUNDLE, tests/lib/engine.ts).
import { playEveryRealm } from './every-realm.ts';
import type { GameSpec } from './matrix.ts';
import type { EveryRealmReply } from './run.ts';

const reply = (r: EveryRealmReply) => process.send?.(r);
process.on('message', (spec: GameSpec) => {
  try {
    reply({ ok: true, result: playEveryRealm(spec) });
  } catch (e: unknown) {
    reply({ ok: false, id: spec.id, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
});
