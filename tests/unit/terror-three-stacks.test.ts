// 2026-10-12 (Toby's batch, item 21; ruling R-102): Evil's lingering Terror stacks at most three times (−30% at the
// base −10% a stack). A fourth decisive victory nearby adds nothing, and an older save holding five stacks demoralises
// by three.
// Level 1 (unit): spreadTerror and consumeTerror (src/engine/battle/evil-terror.ts, plan P1-08c) are called directly in
// the bare vm (tests/lib/engine.ts), on a world the engine makes. This was tests/terror-three-stacks.test.js, which ran
// one turn on the GM portal for the "  // 4. Run all 5 phases" hook to hand them back; the checks are the same.
import vm from 'node:vm';
import { afterAll, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext } from '../lib/engine.ts';

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const tc = turnContext(engine, botWorld(engine, 2, { cols: 10, rows: 6 }));
type Province = {
  terrain: string;
  owner: number | null;
  _terrorStacks?: number;
  _terrorTurn?: number;
  _terrorisedBy?: number;
  _terrorPct?: number;
};
type Defender = { type: string; quality: string; _terrorMult?: number };
const spreadTerror = engineFn(engine, 'spreadTerror') as (
  t: typeof tc,
  battleProv: Province,
  byPlayer: number,
  narrative: string[] | null,
) => void;
const consumeTerror = engineFn(engine, 'consumeTerror') as (
  prov: Province,
  defenders: Defender[],
  narrative: string[],
) => boolean;
const G = tc.G as { turn: number; world: { provinces: Province[] } };
const levies = (): Defender[] => [{ type: 'Shieldwall Levies', quality: 'Average' }];

test('Terror stacks at most three times', () => {
  const P = G.world.provinces.find((p) => p.terrain !== 'sea');
  if (!P) throw new Error('the world has no land province');
  const max = vm.runInContext('TERROR_MAX_STACKS', engine) as number;
  expect(max, `TERROR_MAX_STACKS is 3 (got ${String(max)})`).toBe(3);
  delete P._terrorStacks;
  for (let i = 0; i < 5; i++) spreadTerror(tc, P, 0, null);
  expect(P._terrorStacks, 'five decisive victories next door leave three stacks, no more').toBe(3);
  const owner = P.owner;
  P.owner = null;
  const defs = levies();
  const narr: string[] = [];
  consumeTerror(P, defs, narr);
  expect(Math.abs((defs[0]?._terrorMult ?? NaN) - 0.7), 'three stacks: the defenders fight at ×0.7, −30%').toBeLessThan(
    1e-9,
  );
  expect(
    narr.some((l) => /−30% strength \(3 terror stacks/.test(l)),
    `the report says −30% from 3 stacks (${narr.join(' | ')})`,
  ).toBe(true);
  // an older save still holding five
  P._terrorStacks = 5;
  P._terrorTurn = G.turn;
  P._terrorisedBy = 0;
  P._terrorPct = 0.1;
  const d2 = levies();
  consumeTerror(P, d2, []);
  expect(
    Math.abs((d2[0]?._terrorMult ?? NaN) - 0.7),
    'a save holding five stacks still demoralises by three, −30%',
  ).toBeLessThan(1e-9);
  P.owner = owner;
});
