// B-17m: the bots' copies of the Defend zone, the default hit points and the season's five orders, which agreed with
// their rules, ask the rule or one named number. The Defend zone (`botZoneOf`) is the set the rule `inDefendZone` gives
// a hero holding the post in a province: the old copy's six steps (`botNeighbourProv`) are the oracle. The two numbers
// are pinned where the engine's own code writes them. (The infiltration's reach and a neutral province's defence by tax
// are in the tests of their own: the reach stays, a copy that differs; the tax guess is in the battle estimate's.)
//
// Level 1 (unit): `botZoneOf` called on a synthetic map of two widths, each input pinned (the map's columns, rows and
// provinces; no dice, no world generation): it holds under any KC_SEED.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { botNeighbourProv } from '../../src/engine/bots/intel.ts';
import { botZoneOf } from '../../src/engine/bots/specialists.ts';
import {
  THE_ORDERS_A_HERO_GIVES_IN_A_SEASON,
  THE_HIT_POINTS_A_HERO_HAS_WHEN_HIS_MAXIMUM_IS_NOT_WRITTEN,
} from '../../src/engine/rules-on-plain-values/the-orders-a-hero-gives-in-a-season-and-the-hit-points-he-has-when-his-maximum-is-not-written.ts';
import type { GameState, Province } from '../../src/schemas/saved-game-state.ts';

const aMap = (cols: number, rows: number) => {
  const provinces = Array.from({ length: cols * rows }, (_, id) => ({
    id,
    col: id % cols,
    row: Math.floor(id / cols),
    owner: null,
    terrain: 'plain',
  }));
  const G = { world: { cols, rows, provinces } } as unknown as GameState;
  return { G, provinces: provinces as unknown as Province[] };
};

describe('the Defend zone the bots plan on is the rule’s: the province and the six next to it', () => {
  for (const [cols, rows] of [
    [7, 6],
    [6, 5],
  ] as const) {
    test(`on a map ${String(cols)} wide and ${String(rows)} high, every province gives the old copy's zone, the east-west wrap and both edges included`, () => {
      const { G, provinces } = aMap(cols, rows);
      for (const X of provinces) {
        const oracle = [X.id];
        for (let i = 0; i < 6; i++) {
          const N = botNeighbourProv(G, X, i);
          if (N) oracle.push(N.id);
        }
        const zone = botZoneOf(G, X).map((q) => q.id);
        expect(
          [...zone].sort((a, b) => a - b),
          `the zone about province ${String(X.id)}`,
        ).toEqual([...oracle].sort((a, b) => a - b));
        expect(
          botZoneOf(G, X).map((q) => q.id),
          `the zone about ${String(X.id)}, asked again`,
        ).toEqual(zone);
      }
    });
  }
  test('a zone hands back the map’s own provinces as they are now', () => {
    const { G, provinces } = aMap(7, 6);
    const X = provinces[17];
    if (!X) throw new Error('no province 17');
    botZoneOf(G, X);
    const moved = { ...X, owner: 1 } as unknown as Province;
    provinces[17] = moved;
    expect(botZoneOf(G, moved).find((q) => q.id === 17)).toBe(moved);
  });
});

describe('the two numbers the bots wrote as bare literals have one name each', () => {
  test('a season holds five orders and a hero without a written maximum has twenty hit points', () => {
    expect(THE_ORDERS_A_HERO_GIVES_IN_A_SEASON).toBe(5);
    expect(THE_HIT_POINTS_A_HERO_HAS_WHEN_HIS_MAXIMUM_IS_NOT_WRITTEN).toBe(20);
  });
});
