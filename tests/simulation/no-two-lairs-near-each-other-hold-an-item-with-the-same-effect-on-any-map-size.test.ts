// 2026-10-13 (item 5, the ruling R-052): heroes kept opening two lairs in one turn and finding the same effect twice
// under two names (an amulet and a trinket that both give Mountain Guns +4, say). Now no two lairs in the same or
// neighbouring provinces hold an item with the same effect, on every map size, and on maps of up to 4 realms not
// within 3 provinces either; each lair still holds exactly one item, of its own guardian's tier (but on the largest
// map, which runs some tiers dry and falls back to another, as it always has). The "same effect" is the effect alone,
// whatever the slot or tier. That the engine's own key (itemEffectKey) counts the Carved Bead and the Engineer's
// Blueprint as one effect is the GM page's test
// (tests/page/the-gm-pages-own-lair-names-item-effects-province-units-and-neutral-armies-keep-their-rules.test.ts),
// which also runs these checks on one world the page made.
//
// Level 3 (simulation): the stocking is a pass over a whole world made by generateNewGame
// (src/engine/world/generate.ts); the worlds are made on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts's world) from KC_SEED, and read with the modules' lairItemTier and
// hexDistP (tests/lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts). The checks hold on any world, by
// the stocking's construction, but one guard that counts what the dice deal, which world generation doesn't
// guarantee (KD-413): each world holds more than 50 lairs.
//
// Until plan P1-14z this was tests/lair-effects-spread.test.js, on the booted GM page; each world check is kept as it
// was, a test a world.
import { beforeAll, describe, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { theLairsItems, type ANewWorld } from '../lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** Realms, columns, rows, and the spread no two lairs' effects may share: a world each. */
const SIZES: readonly (readonly [realms: number, cols: number, rows: number, spread: number])[] = [
  [2, 8, 5, 3],
  [4, 12, 8, 3],
  [6, 16, 10, 1],
  [10, 20, 12, 1],
  [10, 20, 12, 1],
];

const found: ReturnType<typeof theLairsItems>[] = [];

// The five worlds of 2 to 10 realms took about 1.5 s on a laptop; 30 s leaves room for a slow runner.
beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { lairItemTier } = await import('../../src/engine/items/tiers-and-hoards.ts');
  const { hexDistP } = await import('../../src/engine/world/map-helpers.ts');
  for (const [realms, cols, rows, spread] of SIZES) {
    // `as`: the engine's world, as the checks read it
    const S = sc.world({ realms, cols, rows, seaPct: 25 }).S as unknown as ANewWorld;
    found.push(theLairsItems(S, cols, spread, { lairItemTier, hexDistP }));
  }
}, timeLimitGivenAsANumber(30_000).timeout);

describe.each(SIZES.map(([realms, cols, rows, spread], i) => ({ realms, cols, rows, spread, i })))(
  '$cols×$rows, $realms realms (world $i)',
  ({ realms, spread, i }) => {
    const theWorld = () => {
      const w = found[i];
      if (!w) throw new Error('the world was not made');
      return w;
    };
    test('every lair holds exactly one item', () => {
      expect(theWorld().lairs).toBeGreaterThan(50);
      expect(theWorld().notOne).toBe(0);
    });
    // (not on the largest map, which runs some tiers dry and falls back to another tier, as it always has)
    if (realms < 10)
      test("…of its guardian's own tier", () => {
        expect(theWorld().wrongTier).toBe(0);
      });
    test(`no two lairs within ${String(spread)} province${spread > 1 ? 's' : ''} hold the same effect`, () => {
      expect(theWorld().close).toEqual([]);
    });
  },
);
