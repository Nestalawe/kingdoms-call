// What a row gives the two-engine comparison (the-two-engines-compared.ts): its cases, in a module of its own whose
// default export makes them for one side's engine. The frame loads that module in each side's process, once with the
// base's src/ and once with the branch's, runs every case once with its own dice and once with each of N seeded dice
// streams, and compares what each run returns: its lines (each compared as JSON, in order) and its world (as a hash).
//
//   // /tmp/kc-<row>/cases.ts, a row's own (or committed beside its tests)
//   import { loadEngine } from '<repo>/tests/lib/engine.ts';
//   import { withADiceStream, type TwoEngineCases } from '<repo>/tools/proof/the-two-engines-cases.ts';
//   const cases: TwoEngineCases = ({ src }) => {
//     const engine = loadEngine({ seed: 1, src });
//     return [{ name: 'a claimant cut below his own floor', run: (dice) => withADiceStream(engine, dice, () => {
//       …stage the world, call the stage…
//       return { lines: theLinesInWords, world: theWorldAfter };
//     }) }];
//   };
//   export default cases;
import vm from 'node:vm';

/** What a case's run returns: the lines it filed (compared one by one, as JSON) and the world after (as a hash). */
export interface ACasesRun {
  lines: readonly unknown[];
  world?: unknown;
}

/** One staged case. `dice` is null for the case's own dice, or a stream's seed: the case gives it to withADiceStream
 *  (or uses it as it likes, the same way on both sides). */
export interface TwoEngineCase {
  name: string;
  run(dice: number | null): ACasesRun;
}

/** A row's cases, made for one side: `src` is that side's src/ folder. */
export type TwoEngineCases = (side: { src: string }) => TwoEngineCase[] | Promise<TwoEngineCase[]>;

/** Runs `body` with the engine's dice (kcRng, src/engine/rng.ts) drawn from the seeded stream `seed` (kcRngStream),
 *  and puts the dice back after; with `seed` null, just runs it. */
export function withADiceStream<T>(engine: vm.Context, seed: number | null, body: () => T): T {
  if (seed === null) return body();
  const kcRng = vm.runInContext('kcRng', engine) as { use(next: () => number): () => number };
  const stream = vm.runInContext('kcRngStream', engine) as (s: number) => () => number;
  const was = kcRng.use(stream(seed));
  try {
    return body();
  } finally {
    kcRng.use(was);
  }
}
