// 2026-10-12 (the maintainer's batch, item 21; ruling R-102): Evil's lingering Terror stacks at most three times (−30% at the
// base −10% a stack). A fourth decisive victory nearby adds nothing, and an older save holding five stacks demoralises
// by three.
// Level 1 (unit): spreadTerror and consumeTerror (src/engine/battle/evil-terror.ts, plan P1-08c) are called directly in
// a world the engine makes on its modules (since P1-14m; the bare vm before). This was tests/terror-three-stacks.test.js,
// which ran one turn on the GM portal for the "  // 4. Run all 5 phases" hook to hand them back; the checks are the
// same.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 21 (2026-10-12), once `battle-tweaks`' fourth block: Terror stacks at most three times (five victories leave
// three stacks, three demoralise by −30%, a save holding five reads as three). `unit/terror-three-stacks.test.ts`:
// `spreadTerror` and `consumeTerror` called directly on the engine's modules (P1-14m; the bare `vm` from P1-08c; before,
// a code-anchor test that ran a turn first); it reads the Terror line's words (`theWordsOf` on a fact, since P1-12c6)
import '../lib/the-whole-engine.ts';
import { afterAll, expect, test } from 'vitest';
import {
  aFreshTurnsContextOnTheWorld,
  botWorld,
  loadTheEngineOnItsModules,
  quietEngineLog,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';

const engine = await loadTheEngineOnItsModules({ seed: 1 });
const restoreLog = quietEngineLog(engine);
// (the engine's own modules, fresh with it)
const { theWordsOf: theWordsOfAsItsModuleExportsIt } = await import('../../src/views/prose/the-words-of-each-line.ts');
const theTerror = await import('../../src/engine/battle/evil-terror.ts');
const { TERROR_MAX_STACKS } =
  await import('../../src/engine/rules-on-plain-values/the-terror-an-evil-victory-leaves-its-share-a-stack-and-its-most-stacks.ts');
/** A line's words: its words, or a fact's, which the views write (theWordsOf, src/views/prose/, P1-12c6). */
const theWordsOf = theWordsOfAsItsModuleExportsIt as unknown as (fact: unknown) => string;
const wordsOf = (line: unknown): string => (typeof line === 'string' ? line : theWordsOf(line));
afterAll(restoreLog);
const tc = aFreshTurnsContextOnTheWorld(engine, botWorld(engine, 2, { cols: 10, rows: 6 }));
interface Province {
  terrain: string;
  owner: number | null;
  _terrorStacks?: number;
  _terrorTurn?: number;
  _terrorisedBy?: number;
  _terrorPct?: number;
}
interface Defender {
  type: string;
  quality: string;
  _terrorMult?: number;
}
const spreadTerror = theTerror.spreadTerror as unknown as (
  t: typeof tc,
  battleProv: Province,
  byPlayer: number,
  narrative: unknown[] | null,
) => void;
const consumeTerror = theTerror.consumeTerror as unknown as (
  prov: Province,
  defenders: Defender[],
  narrative: unknown[],
) => boolean;
const G = tc.G as { turn: number; world: { provinces: Province[] } };
const levies = (): Defender[] => [{ type: 'Shieldwall Levies', quality: 'Average' }];

test('Terror stacks at most three times', () => {
  const P = G.world.provinces.find((p) => p.terrain !== 'sea');
  if (!P) throw new Error('the world has no land province');
  const max: number = TERROR_MAX_STACKS;
  expect(max, `TERROR_MAX_STACKS is 3 (got ${String(max)})`).toBe(3);
  delete P._terrorStacks;
  for (let i = 0; i < 5; i++) spreadTerror(tc, P, 0, null);
  expect(P._terrorStacks, 'five decisive victories next door leave three stacks, no more').toBe(3);
  const owner = P.owner;
  P.owner = null;
  const defs = levies();
  const narr: unknown[] = [];
  consumeTerror(P, defs, narr);
  expect(Math.abs((defs[0]?._terrorMult ?? NaN) - 0.7), 'three stacks: the defenders fight at ×0.7, −30%').toBeLessThan(
    1e-9,
  );
  expect(
    narr.map(wordsOf).some((l) => l.includes('−30% strength (3 terror stacks')),
    `the report says −30% from 3 stacks (${narr.map(wordsOf).join(' | ')})`,
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
