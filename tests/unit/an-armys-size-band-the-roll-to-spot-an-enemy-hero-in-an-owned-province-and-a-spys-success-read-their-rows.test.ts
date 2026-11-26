// An army's size band, the roll to spot an enemy hero in an owned province and a spy's success read their rows'
// figures (B-06bv: the numbers of armySizeBand, spotEnemyInOwnedProvince and applySpySuccess moved to content's rows,
// src/content/the-sight-rules-numbers-an-armys-size-band-spotting-an-enemy-in-an-owned-province-and-a-spys-success.ts,
// each named for its rule). Each case is worked out by hand from the function's arithmetic as it was, and its figures
// are written here as literals, so a row's figure changed by a little fails a case:
// - armySizeBand: each band's name on each side of its most (THE_MOST_UNITS_EACH_BAND_OF_AN_ARMYS_SIZE_NAMES);
// - spotEnemyInOwnedProvince: each chance worked out from its Spy levels and the illusory perk's tier, the roll taken
//   just under it (the call gives true) and just over it (false), so a chance moved by one point either way fails;
//   the least under the illusory perk never binds (the halving leaves at least 12.5), so its plant goes past that
//   (THE_FIGURES_OF_THE_ROLL_TO_SPOT_AN_ENEMY_HERO_IN_AN_OWNED_PROVINCE);
// - applySpySuccess: the chance a spy on a king's home copies a discovery at three Spy levels (a Spy counts to 5 at
//   most, so the chance's least and most never bind: their plants go past the chances the levels give), what a copy
//   adds to his title merit's count of discoveries, his merits after a success, and a feature's draw at a die just
//   under and at its chance (THE_FIGURES_OF_A_SPYS_SUCCESS).
//
// Level 1 (unit): the engine's functions called directly on staged worlds, on the engine's modules (the whole engine
// loaded first), with every input the functions read written here (no seed: the spotting roll is detRoll, a hash of
// the turn, the realm, the hero and the province, and each turn is written here, where its roll falls asserted; the
// spy's dice are fixed with kcRng.use). Not lower: each figure is read inside a computed value.
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { armySizeBand } from '../../src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { detRoll, spotEnemyInOwnedProvince } from '../../src/engine/heroes/fame-and-consecration.ts';
import { applySpySuccess } from '../../src/engine/espionage/what-a-spy-learns.ts';
import { DISC_BY_ID } from '../../src/engine/discoveries.ts';

type Obj = Record<string, unknown>;

// The GM's log echoes each line on the console: quiet while the test writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

describe("an army's size band", () => {
  test('armySizeBand names each band on each side of its most, as before', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 15, 16].map((n) => [n, armySizeBand(n)])).toEqual([
      [0, 'no armies'],
      [1, 'a small escort (a few units)'],
      [2, 'a small escort (a few units)'],
      [3, 'a modest band'],
      [5, 'a modest band'],
      [6, 'a sizeable host'],
      [9, 'a sizeable host'],
      [10, 'a large host'],
      [15, 'a large host'],
      [16, 'a vast host'],
    ]);
  });
});

describe('the roll to spot an enemy hero in an owned province', () => {
  // Realm 0 holds Wendmeadow (province 0, plain, not its home: its home is province 9, and no discovery of its own);
  // the enemy hero is Thorn (hero 5, of realm 1); a friendly hero there is Elsa (hero 1, of realm 0).
  const theEnemysId = 5;
  /** The roll for realm 0, Thorn and Wendmeadow on turn `t`, in percent. */
  const theRollOn = (t: number): number => detRoll(t, 0, theEnemysId, 0) * 100;
  /** For each chance, a turn whose roll falls in [chance − 0.5, chance) and one whose roll falls in
   *  [chance, chance + 0.5) (each asserted where the case reads it). */
  const THE_TURNS_JUST_UNDER_AND_JUST_OVER_EACH_CHANCE: Readonly<Record<number, readonly [number, number]>> = {
    70: [464, 353],
    50: [61, 165],
    25: [8, 53],
    95: [380, 264],
    30: [31, 168],
    12.5: [231, 171],
  };
  /** Whether realm 0 spots Thorn (his skills as given) on turn `t`, with Elsa there of the Spy given (none: no one). */
  function spot(thorn: Obj, elsasSpy: number | null, t: number): boolean {
    const elsa = { id: 1, player: 0, alive: true, isKing: false, location: 0, skills: { spy: elsasSpy ?? 0 } };
    const thornAsHeIs = { id: theEnemysId, player: 1, alive: true, isKing: false, location: 0, ...thorn };
    const characters = [{ id: 0, player: 1, alive: true, isKing: false, location: 3 }, elsa, {}, {}, {}, thornAsHeIs];
    const world = { cols: 8, rows: 8, provinces: [{ id: 0, row: 0, col: 0, terrain: 'plain', tax: 2 }] };
    return spotEnemyInOwnedProvince(
      { players: [{ homeProvinceId: 9 }, { homeProvinceId: 8 }], characters, turn: 1, world, relations: {} } as never,
      0,
      { id: 0, row: 0, col: 0, terrain: 'plain', tax: 2, characters: elsasSpy === null ? [5] : [1, 5] },
      { id: theEnemysId, skills: thorn['skills'] } as never,
      t,
    );
  }
  /** What the call gives on a roll just under the chance, and on one just over it. */
  function underAndOver(chance: number, thorn: Obj, elsasSpy: number | null): boolean[] {
    const turns = THE_TURNS_JUST_UNDER_AND_JUST_OVER_EACH_CHANCE[chance];
    if (!turns) throw new Error(`no turns written for the chance ${String(chance)}`);
    const [under, over] = turns;
    expect(theRollOn(under), `turn ${String(under)}'s roll, at least ${String(chance - 0.5)}`).toBeGreaterThanOrEqual(
      chance - 0.5,
    );
    expect(theRollOn(under), `turn ${String(under)}'s roll, under ${String(chance)}`).toBeLessThan(chance);
    expect(theRollOn(over), `turn ${String(over)}'s roll, at least ${String(chance)}`).toBeGreaterThanOrEqual(chance);
    expect(theRollOn(over), `turn ${String(over)}'s roll, under ${String(chance + 0.5)}`).toBeLessThan(chance + 0.5);
    return [spot(thorn, elsasSpy, under), spot(thorn, elsasSpy, over)];
  }
  test('Spy 2 against a friendly Spy 1: 100 − 2 × 20 + 1 × 10 = 70, as before', () => {
    expect(underAndOver(70, { skills: { spy: 2 } }, 1), 'spotted just under the chance, not just over it').toEqual([
      true,
      false,
    ]);
  });
  test('Spy 7 against a friendly Spy 7, each counted as 5: 100 − 100 + 50 = 50, as before', () => {
    expect(underAndOver(50, { skills: { spy: 7 } }, 7), 'spotted just under the chance, not just over it').toEqual([
      true,
      false,
    ]);
  });
  test('Spy 5 and no one there: 0, held to at least 25, as before', () => {
    expect(underAndOver(25, { skills: { spy: 5 } }, null), 'spotted just under the chance, not just over it').toEqual([
      true,
      false,
    ]);
  });
  test('Spy 0 against a friendly Spy 2: 120, held to at most 95, as before', () => {
    expect(underAndOver(95, { skills: { spy: 0 } }, 2), 'spotted just under the chance, not just over it').toEqual([
      true,
      false,
    ]);
  });
  test('Spy 2 of the illusory perk (Illusory 6, its tier 1) and no one there: 60, halved to 30, as before', () => {
    expect(
      underAndOver(30, { skills: { spy: 2, illusory: 6 } }, null),
      'spotted just under the chance, not just over it',
    ).toEqual([true, false]);
  });
  test('Spy 5 of the illusory perk and no one there: 25, halved to 12.5, as before', () => {
    expect(
      underAndOver(12.5, { skills: { spy: 5, illusory: 6 } }, null),
      'spotted just under the chance, not just over it',
    ).toEqual([true, false]);
  });
});

describe("a spy's success", () => {
  /** A turn's context on a staged state, with what emit reads. */
  function aTurn(G: Obj): TurnContext {
    const tc = createTurnContext(G, [], 3) as unknown as TurnContext;
    Object.assign(tc, {
      _logCtx: { charId: null, phase: null },
      _currentPhase: 1,
      _afterPhases: false,
      _tel: { pre: {}, orders: {}, factsInTheTurnsOrder: [] },
    });
    return tc;
  }
  /** Runs `fn` with the dice fixed at `value`. */
  function withDice<T>(value: number, fn: () => T): T {
    const was = kcRng.use(() => value);
    try {
      return fn();
    } finally {
      kcRng.use(was);
    }
  }
  const secret = Object.values(DISC_BY_ID).find((d) => !d.race && !d.alignment);
  if (!secret) throw new Error('could not stage: a discovery of no race and no alignment');
  /** Thorn (of Varn, realm 1, of the Spy given, no items, no merits yet) spies on Wendmeadow (province 2): Esterhold's
   *  home, which holds one discovery Varn lacks, when `onAHome`; with the features given; the dice fixed at `dice`. */
  function spyOn(spy: number, dice: number, onAHome = true, features: Obj[] = []) {
    const players = [
      {
        name: 'Esterhold',
        homeProvinceId: onAHome ? 2 : 7,
        discoveries: [{ id: secret?.id, name: secret?.name, category: secret?.category, desc: '', turnDiscovered: 1 }],
      },
      { name: 'Varn', homeProvinceId: 5, discoveries: [] },
    ];
    const G = { turn: 4, players, characters: [], world: { provinces: [] } };
    const tc = aTurn(G);
    const thorn: Obj = { id: 7, name: 'Thorn', player: 1, alive: true, skills: { spy }, items: [] };
    withDice(dice, () => {
      applySpySuccess(tc, thorn as never, { id: 2, name: 'Wendmeadow', owner: 0, tax: 3, features } as never);
    });
    const facts = tc.turnLog.map((l) => (l as { fact?: Obj }).fact ?? {});
    const rifled = facts.find((f) => f['kind'] === "a spy rifles a king's archives for a discovery");
    return { thorn, varn: players[1], rifled };
  }
  test('the chance to copy a discovery at Spy 0, 3 and 9 (counted as 5): 10, 40 and 60, as before', () => {
    expect([0, 3, 9].map((spy) => spyOn(spy, 0.99).rifled?.['chance'])).toEqual([10, 40, 60]);
  });
  test("a copied discovery adds 1 to the title merit's count of discoveries, as before", () => {
    const { thorn, varn } = spyOn(3, 0);
    expect(varn?.discoveries.map((d: { id?: unknown }) => d.id)).toEqual([secret.id]);
    expect((thorn['tm'] as Obj | undefined)?.['discoveries']).toBe(1);
  });
  test('a success earns 1 merit, as before', () => {
    expect(spyOn(3, 0.99, false).thorn['merits']).toBe(1);
  });
  test("a feature's draw at a die of 0.49 finds it, at 0.5 it doesn't, as before", () => {
    const aFeature = (): Obj => ({ type: 'ruins', name: 'Made-up Ruins' });
    const under = aFeature();
    spyOn(3, 0.49, false, [under]);
    expect(under['discoveredBy']).toEqual([1]);
    const at = aFeature();
    spyOn(3, 0.5, false, [at]);
    expect(at['discoveredBy']).toBeUndefined();
  });
});
