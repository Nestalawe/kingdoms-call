// Flak Screen engages every flyer, winged riders and flying beasts alike (R-146, row P1-23n): each Gnomish
// Gyrocopter engages one enemy flying unit before the battle, which loses 30% of its base strength for the battle (at
// least 1). The flyers are the content's one list of the units that fly (KC_UNIT_CLASS.aerial): the winged riders and
// the four flying beasts (Thunderbirds, Manticore Pride, Crimson Rocs, Elder Dragons).
// - In both kinds of battle, on one staged field: realm 0's king attacks a free plain with one company of Gnomish
//   Gyrocopters, against one company of a flying beast (or, beside them, Eagle Riders), held either by a guard made by
//   the test (combatVsNPC) or by realm 1's king's own host (combatVsChar). Both sides fight in melee and refuse every
//   duel, and neither commander casts. With one flyer on the field, the gyrocopters' pick is certain whatever its die;
//   every other die is a fixed stream's (kcRng.use), so the battle plays the same under any KC_SEED.
// - Flak Screen called directly (applyFlakScreen), its die fixed: between Wyvern Riders and Crimson Rocs (the ruling's
//   example), the die picks either; two gyrocopters engage both.
// Level 1 (unit): the battles and applyFlakScreen called directly, no turn played. Not lower: the flyer engaged and its
// loss are values the battle code computes, which a syntax tree can't evaluate. Not higher: a turn adds dice before
// the battle and nothing the rule reads.
import '../lib/the-whole-engine.ts';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import * as strength from '../../src/engine/battle/strength.ts';
import { unitBaseStrength } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import {
  aBattleAgainstTheProvince,
  aBattleBetweenHeroes,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  companies,
  MELEE_AND_NO_DUEL,
  place,
  theTurnsContext,
  type Character,
  type World,
} from '../lib/a-battle-called-directly.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

/** The share of a flyer's base strength Flak Screen takes, as both books write it. */
const FLAK_SCREENS_SHARE = 0.3;
/** What a flyer of the type given loses to one gyrocopter: 30% of its base strength at Average, at least 1. */
const theLossOf = (type: string) =>
  Math.max(1, Math.round(unitBaseStrength({ type, quality: 'Average' }) * FLAK_SCREENS_SHARE));

const THE_FLYING_BEASTS = ['Crimson Rocs', 'Thunderbirds', 'Elder Dragons', 'Manticore Pride'] as const;
const BATTLES = ['against the guards', 'between two hosts'] as const;

const theKingOf = (G: World, realm: number): Character => {
  const king = G.characters.find((c) => c.alive && c.player === realm && c.isKing);
  if (!king) throw new Error(`the world has no king in realm ${String(realm)}`);
  return king;
};

/** The flyers the gyrocopters harried in a battle: each line's flyer and the strength it lost. */
const theFlyersHarried = (narrative: readonly NarrativeLine[]) =>
  narrative.flatMap((l) =>
    typeof l === 'object' && l.kind === 'the gyrocopters harry a flying unit off its line'
      ? [{ flyer: l.targetUnitName, lost: l.strengthLost }]
      : [],
  );

/** Realm 0's king attacks a free plain with one company of Gnomish Gyrocopters; one company of `flyer` holds it, a
 *  guard's or realm 1's king's. Every die is a fixed stream's. */
function aBattle(battle: (typeof BATTLES)[number], flyer: string) {
  const G = aWorld(1);
  const tc = theTurnsContext(G, 1);
  G.relations['0-1'] = 'enemy';
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  const atk = theKingOf(G, 0);
  Object.assign(atk, {
    armies: companies('Gnomish Gyrocopters', 1, 'Average', 'Dwarven'),
    items: [],
    encounterPlan: MELEE_AND_NO_DUEL(),
  });
  attackFrom(G, atk, from, field);
  const theFlyer = companies(flyer, 1, 'Average');
  const was = kcRng.use(kcRngStream(7));
  try {
    if (battle === 'between two hosts') {
      const def = theKingOf(G, 1);
      Object.assign(def, { armies: theFlyer, items: [], encounterPlan: MELEE_AND_NO_DUEL() });
      place(G, def, field);
      return aBattleBetweenHeroes(tc, atk, def, field);
    }
    const guard = aGuardMadeByTheTest(G, field, theFlyer, { encounterPlan: MELEE_AND_NO_DUEL() });
    return aBattleAgainstTheProvince(tc, atk, field, guard);
  } finally {
    kcRng.use(was);
  }
}

describe.for(BATTLES)('Flak Screen engages every flyer, %s', (battle) => {
  test.for(THE_FLYING_BEASTS)('a flying beast: the gyrocopters engage the %s, −30% of its strength', (beast) => {
    expect(theFlyersHarried(aBattle(battle, beast).narrative)).toEqual([
      { flyer: `${beast} 1`, lost: theLossOf(beast) },
    ]);
  });

  test('a winged rider: the gyrocopters engage the Eagle Riders, as before', () => {
    expect(theFlyersHarried(aBattle(battle, 'Eagle Riders').narrative)).toEqual([
      { flyer: 'Eagle Riders 1', lost: theLossOf('Eagle Riders') },
    ]);
  });
});

/** Flak Screen by `gyros` Gyrocopters against one company of each type in `flyers`, with the dice given: what each
 *  flyer lost, and the dice drawn. */
function aFlakScreen(gyros: number, flyers: readonly string[], dice: readonly number[]) {
  const mine: ArmyInABattle[] = Array.from({ length: gyros }, (_, i) => ({
    type: 'Gnomish Gyrocopters',
    quality: 'Average',
    race: 'Dwarven',
    unitName: `Gnomish Gyrocopters ${String(i + 1)}`,
  }));
  const theirs: ArmyInABattle[] = flyers.map((type) => ({ type, quality: 'Average', race: 'Primal', unitName: type }));
  let drawn = 0;
  const was = kcRng.use(() => dice[drawn++] ?? Number.NaN);
  try {
    strength.applyFlakScreen(mine, theirs, { heroName: 'Aldric', leaderless: false }, []);
  } finally {
    kcRng.use(was);
  }
  return { lost: theirs.map((f) => f._tempStrReduction ?? 0), drawn };
}

describe('Flak Screen between Wyvern Riders and Crimson Rocs (the ruling’s example)', () => {
  test('either may be engaged: the die picks the Wyvern Riders below a half, the Crimson Rocs from a half', () => {
    expect(aFlakScreen(1, ['Wyvern Riders', 'Crimson Rocs'], [0])).toEqual({
      lost: [theLossOf('Wyvern Riders'), 0],
      drawn: 1,
    });
    expect(aFlakScreen(1, ['Wyvern Riders', 'Crimson Rocs'], [0.5])).toEqual({
      lost: [0, theLossOf('Crimson Rocs')],
      drawn: 1,
    });
  });

  test('two gyrocopters engage both, one each', () => {
    expect(aFlakScreen(2, ['Wyvern Riders', 'Crimson Rocs'], [0.5, 0])).toEqual({
      lost: [theLossOf('Wyvern Riders'), theLossOf('Crimson Rocs')],
      drawn: 2,
    });
  });
});
