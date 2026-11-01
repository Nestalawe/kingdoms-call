// Breach and Swamp sinks a hull below its chance and not at it (plan P1-19's second slice, row P1-19i), and Flak
// Screen takes 30% of a flyer's strength: the two abilities that act on the enemy before the battle, each drawing its
// own dice.
// - Breach and Swamp: in both battles (combatVsChar, between two heroes' hosts; combatVsNPC, against a province's
//   defenders) a Whale Cohort facing an enemy hull at sea sinks it when its first die falls just under 25%, the chance
//   the blurb gives, and not when it falls at 25%. Its second die picks the hull among those afloat. It draws no die
//   when no hull is afloat (a second cohort, once the one hull is sunk), and a unit without the ability draws none. The
//   battle's other dice come from a seeded stream; the dice of Breach and Swamp are fed in order (kcRng.use), from the
//   moment Flak Screen has run (applyFlakScreen, stood in by vi.spyOn, which calls the real one) to the next step of the
//   battle (terrainNoteList in combatVsChar, eyesOfTheForestLine in combatVsNPC), and counted. Since P1-12d35 each
//   sinking's fact holds the hull's type, and between two hosts the side whose hull sinks (the attacker's cohort sinks
//   the defender's hull, the defender's cohort the attacker's): the losses tally counts the hull there.
// - Flak Screen: a Gyrocopter harries one enemy winged rider, which loses 30% of its base strength (at least 1), as both
//   books write it; no two gyrocopters harry the same flyer, nor one harried already this battle, and one die is drawn
//   for each gyrocopter while a flyer is left (applyFlakScreen called directly; since P1-12d31 it is handed the side's
//   record, not its label).
// Why: the balance matrix never shows Breach and Swamp's chance (planted at 20%, no game of 60 changes; at 100%, 5), and
// no race or beast test checks either number (Flak Screen planted at −25%, every script green): the matrix sees Flak
// Screen only as hashes that changed. The battles and applyFlakScreen keep their names and signatures, so this passes
// on the code before the registry took them, as after.
// Level 1 (unit): the engine's modules called directly (plan P1-14a), on a world the engine makes from a fixed seed, with
// the two hosts staged on a sea province and the dice that decide fed in order; no turn is played. Not lower: the
// chance and the loss are values the code compares, which a syntax tree can't evaluate; not higher: a whole turn adds
// nothing but more dice before the battle.
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { combatVsChar } from '../../src/engine/battle/battles-between-heroes.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import * as strength from '../../src/engine/battle/strength.ts';
import * as reportLines from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import { unitBaseStrength } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

/** Breach and Swamp's chance, and the share of a flyer's base strength Flak Screen takes, as the books write them. */
const BREACH_AND_SWAMPS_CHANCE = 0.25;
const FLAK_SCREENS_SHARE = 0.3;

/** The largest number below x (x positive): the die just under the chance. */
function theNumberJustUnder(x: number): number {
  const bits = new BigInt64Array(new Float64Array([x]).buffer);
  bits[0] = (bits[0] ?? 0n) - 1n;
  return new Float64Array(bits.buffer)[0] ?? Number.NaN;
}
const JUST_UNDER = theNumberJustUnder(BREACH_AND_SWAMPS_CHANCE);

// The GM's log echoes each line on the console: quiet while the battles write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

interface Character {
  id: number | string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  armies: ArmyInABattle[];
  [key: string]: unknown;
}
interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  characters: (number | string)[];
  neutralDefenders?: ArmyInABattle[];
  [key: string]: unknown;
}
interface World {
  relations: Record<string, string>;
  characters: Character[];
  world: { provinces: Province[] };
}

// A world of two bot realms, made by the engine from a fixed seed, kept as JSON: each battle stages a fresh copy.
kcRng.seed(1);
const THE_WORLD = JSON.stringify(
  generateNewGame(
    (generateBotSetups([], 2, 0) as Record<string, unknown>[]).map((b) => ({
      ...b,
      gamePlayerId: 'gp' + String(b['id']),
      name: b['kingdomName'],
    })),
    { cols: 10, rows: 6 },
    999,
    { seaPct: 30 },
  ),
);

let companies = 0;
const aCompany = (type: string): ArmyInABattle => ({
  type,
  quality: 'Average',
  race: 'Primal',
  unitName: `${type} #${String(++companies)}`,
});

/** What a staged battle at sea shows of Breach and Swamp: the kinds of its lines, the units the sinking lines name, and
 *  the dice drawn between Flak Screen and the battle's next step (the dice given, then the seeded stream's). */
interface WhatTheBattleShows {
  readonly kinds: readonly string[];
  readonly sunk: readonly string[];
  readonly drawn: number;
  /** Each sinking line's side whose hull sinks (between two hosts; against the defenders the kind says the
   *  defender's) and the hull's type, as its fact holds them (plan P1-12d35: the losses tally counts them). */
  readonly sinkings: readonly { readonly theSideWhoseShipSinks?: string; readonly targetUnitType: string }[];
}

/** A battle at sea between `attackers` and `defenders`: two kings' hosts (combatVsChar), or a king's host against the
 *  sea province's defenders (combatVsNPC). Once Flak Screen has run for the side whose Breach and Swamp comes next, the
 *  next dice are `dice`, in order; every other die is the seeded stream's. */
function aBattleAtSea(
  battle: 'between two hosts' | 'against the defenders',
  attackers: readonly string[],
  defenders: readonly string[],
  dice: readonly number[],
): WhatTheBattleShows {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const [atk, def] = [0, 1].map((p) => G.characters.find((c) => c.alive && c.player === p && c.isKing));
  const sea = G.world.provinces.find((p) => p.terrain === 'sea' && p.characters.length === 0);
  if (!atk || !def || !sea) throw new Error('the world has no king in realm 0 or 1, or no empty sea');
  const moveToTheSea = (c: Character) => {
    const from = G.world.provinces[c.location];
    if (from) from.characters = from.characters.filter((id) => id !== c.id);
    c.location = sea.id;
    sea.characters.push(c.id);
  };
  atk['_attackedFrom'] = atk.location;
  moveToTheSea(atk);
  atk.armies = attackers.map(aCompany);

  // Flak Screen runs once for each side between two hosts (the attacker's, then the defender's), then each side's
  // volley, then Breach and Swamp; against the defenders, the attacker's Flak Screen, then Breach and Swamp.
  const theFlakScreensBefore = battle === 'between two hosts' ? 2 : 1;
  const stream = kcRngStream(7);
  let flakScreens = 0;
  /** The dice fed since Flak Screen ran (none before), and how many were drawn by the battle's next step. */
  const count: { fed: number | null; drawn: number | null } = { fed: null, drawn: null };
  const realFlakScreen = strength.applyFlakScreen;
  vi.spyOn(strength, 'applyFlakScreen').mockImplementation((...args) => {
    realFlakScreen(...args);
    if (++flakScreens === theFlakScreensBefore) count.fed = 0;
  });
  // The battle's next step after Breach and Swamp: the terrain's notes between two hosts (whose volley, before it,
  // asks eyesOfTheForestLine too); Eyes of the Forest's line against the defenders.
  const theNextStep = () => {
    if (count.fed !== null && count.drawn === null) count.drawn = count.fed;
  };
  const realTerrainNotes = reportLines.terrainNoteList;
  vi.spyOn(reportLines, 'terrainNoteList').mockImplementation((...args) => {
    if (battle === 'between two hosts') theNextStep();
    return realTerrainNotes(...args);
  });
  const realEyes = strength.eyesOfTheForestLine;
  vi.spyOn(strength, 'eyesOfTheForestLine').mockImplementation((...args) => {
    if (battle === 'against the defenders') theNextStep();
    return realEyes(...args);
  });
  const was = kcRng.use(() => {
    if (count.fed === null || count.drawn !== null) return stream();
    return dice[count.fed++] ?? stream();
  });
  let narrative: NarrativeLine[];
  try {
    if (battle === 'between two hosts') {
      moveToTheSea(def);
      def.armies = defenders.map(aCompany);
      narrative = (combatVsChar(tc, atk, def, sea) as { narrative: NarrativeLine[] }).narrative;
    } else {
      sea.owner = null;
      sea.neutralDefenders = defenders.map(aCompany);
      narrative = (combatVsNPC(tc, atk, sea, null) as { narrative: NarrativeLine[] }).narrative;
    }
  } finally {
    kcRng.use(was);
  }
  const lines = narrative.flatMap((l) => (typeof l === 'object' && 'kind' in l ? [l] : []));
  const SINKS = new Set([
    "a side's whale cohort sinks an enemy ship",
    'a whale cohort sinks a defending ship before a shot is fired',
  ]);
  return {
    kinds: lines.map((l) => l.kind),
    sunk: lines.flatMap((l) => (SINKS.has(l.kind) && 'targetUnitName' in l ? [String(l.targetUnitName)] : [])),
    drawn: count.drawn ?? Number.NaN,
    sinkings: lines.flatMap((l) => {
      if (l.kind === "a side's whale cohort sinks an enemy ship")
        return [{ theSideWhoseShipSinks: l.theSideWhoseShipSinks, targetUnitType: l.targetUnitType }];
      if (l.kind === 'a whale cohort sinks a defending ship before a shot is fired')
        return [{ targetUnitType: l.targetUnitType }];
      return [];
    }),
  };
}

describe.for(['between two hosts', 'against the defenders'] as const)('Breach and Swamp, in a battle %s', (battle) => {
  test('a first die just under 25% sinks the one hull: two dice, the chance and the hull', () => {
    expect(JUST_UNDER).toBeLessThan(BREACH_AND_SWAMPS_CHANCE);
    const shown = aBattleAtSea(battle, ['Whale Cohort'], ['Orcish Longships'], [JUST_UNDER, 0]);
    expect(shown.sunk).toEqual([expect.stringMatching(/^Orcish Longships #/)]);
    expect(shown.drawn).toBe(2);
  });

  test('a first die at 25% does not: one die, and no hull is sunk', () => {
    const shown = aBattleAtSea(battle, ['Whale Cohort'], ['Orcish Longships'], [BREACH_AND_SWAMPS_CHANCE, 0]);
    expect(shown.sunk).toEqual([]);
    expect(shown.drawn).toBe(1);
  });

  test('the second die picks the hull among those afloat: 0.75 of two sinks the second', () => {
    const shown = aBattleAtSea(battle, ['Whale Cohort'], ['Orcish Longships', 'Dwarf Ironclads'], [JUST_UNDER, 0.75]);
    expect(shown.sunk).toEqual([expect.stringMatching(/^Dwarf Ironclads #/)]);
    expect(shown.drawn).toBe(2);
  });

  test('a second cohort, with no hull left afloat, draws no die', () => {
    const shown = aBattleAtSea(battle, ['Whale Cohort', 'Whale Cohort'], ['Orcish Longships'], [JUST_UNDER, 0, 0, 0]);
    expect(shown.sunk).toHaveLength(1);
    expect(shown.drawn).toBe(2);
  });

  test("the sinking's fact holds the hull's type, and between two hosts the side whose hull sinks: the defender's", () => {
    const shown = aBattleAtSea(battle, ['Whale Cohort'], ['Orcish Longships'], [JUST_UNDER, 0]);
    expect(shown.sinkings).toEqual([
      battle === 'between two hosts'
        ? { theSideWhoseShipSinks: 'defender', targetUnitType: 'Orcish Longships' }
        : { targetUnitType: 'Orcish Longships' },
    ]);
  });

  test('a unit without the ability draws no die and sinks nothing', () => {
    const shown = aBattleAtSea(battle, ['Great Turtles'], ['Orcish Longships'], [0, 0]);
    expect(shown.sunk).toEqual([]);
    expect(shown.drawn).toBe(0);
  });
});

describe("Breach and Swamp, the defender's cohort in a battle between two hosts", () => {
  test("it sinks the attacker's hull: the fact names the attacker's side and the hull's type", () => {
    const shown = aBattleAtSea('between two hosts', ['Dwarf Ironclads'], ['Whale Cohort'], [JUST_UNDER, 0]);
    expect(shown.sunk).toEqual([expect.stringMatching(/^Dwarf Ironclads #/)]);
    expect(shown.sinkings).toEqual([{ theSideWhoseShipSinks: 'attacker', targetUnitType: 'Dwarf Ironclads' }]);
  });
});

/** Flak Screen by `gyros` Gyrocopters against `flyers` (each a type, and whether a gyrocopter has harried it this battle
 *  already), with the dice given: what each flyer lost, the lines' kinds, and the dice drawn. */
function aFlakScreen(gyros: number, flyers: readonly (readonly [type: string, harried: boolean])[], dice: number[]) {
  const mine = Array.from({ length: gyros }, () => aCompany('Gnomish Gyrocopters'));
  const theirs = flyers.map(([type, harried]) => ({ ...aCompany(type), ...(harried ? { _flakTargeted: true } : {}) }));
  let drawn = 0;
  const narr: NarrativeLine[] = [];
  const was = kcRng.use(() => dice[drawn++] ?? Number.NaN);
  try {
    strength.applyFlakScreen(mine, theirs, { heroName: 'Aldric', leaderless: false }, narr);
  } finally {
    kcRng.use(was);
  }
  return {
    lost: theirs.map((f) => f._tempStrReduction ?? 0),
    kinds: narr.flatMap((l) => (typeof l === 'object' && 'kind' in l ? [l.kind] : [])),
    drawn,
  };
}

describe('Flak Screen', () => {
  test('a Gyrocopter takes 30% of an Eagle Riders company’s base strength (12 at Average: 4)', () => {
    const base = unitBaseStrength({ type: 'Eagle Riders', quality: 'Average' });
    expect(base).toBe(12);
    expect(Math.round(base * FLAK_SCREENS_SHARE)).toBe(4);
    expect(aFlakScreen(1, [['Eagle Riders', false]], [0])).toEqual({
      lost: [4],
      kinds: [
        "a side's gyrocopters climb to meet the enemy's flyers",
        'the gyrocopters harry a flying unit off its line',
      ],
      drawn: 1,
    });
  });

  test('two Gyrocopters harry two flyers, each picked by its die among those left; the third is spared', () => {
    // 0.5 of three picks the second; then 0 of the two left picks the first.
    expect(
      aFlakScreen(
        2,
        [
          ['Eagle Riders', false],
          ['Wyvern Riders', false],
          ['Noble Griffons', false],
        ],
        [0.5, 0],
      ),
    ).toEqual({
      lost: [4, 4, 0],
      kinds: [
        "a side's gyrocopters climb to meet the enemy's flyers",
        'the gyrocopters harry a flying unit off its line',
        'the gyrocopters harry a flying unit off its line',
      ],
      drawn: 2,
    });
  });

  test('no two Gyrocopters harry the same flyer: with one flyer, two gyrocopters draw one die', () => {
    expect(aFlakScreen(2, [['Eagle Riders', false]], [0, 0])).toMatchObject({ lost: [4], drawn: 1 });
  });

  test('a flyer harried already this battle is not picked again, and no die is drawn for it', () => {
    expect(aFlakScreen(1, [['Eagle Riders', true]], [0])).toEqual({ lost: [0], kinds: [], drawn: 0 });
  });

  test('a unit that is no Gyrocopter draws no die', () => {
    let drawn = 0;
    const was = kcRng.use(() => (drawn++, 0));
    try {
      strength.applyFlakScreen(
        [aCompany('Mountain Guns')],
        [aCompany('Eagle Riders')],
        { heroName: 'Aldric', leaderless: false },
        [],
      );
    } finally {
      kcRng.use(was);
    }
    expect(drawn).toBe(0);
  });
});
