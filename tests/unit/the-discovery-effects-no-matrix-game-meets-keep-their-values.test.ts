// The discoveries' effects no matrix game meets keep their values (plan P1-19's discoveries family, the tests of its
// rows: each effect the scoping counted 0 meetings of in the 60 games of set A, where "identical" proves nothing). The
// later rows of the family add their own cases here.
// - P1-19aa: a realm's own-ground discoveries (`defOwn`: Sanctified Walls, +15% anywhere it holds; Bulwark of the
//   Realm, +30% at its home only), in the registry's runner and in a battle against a province's defenders that a
//   realm holds (combatVsNPC): each share where it holds, none away from home for Bulwark, the two together capped at
//   the kind's ceiling (+30%), none when the attacker holds the province, and the realm's home asked only by an effect
//   that needs it (asking may fix a realm's home). Between two heroes' hosts the line is
//   tests/unit/the-sides-and-the-defenders-of-a-battle-against-a-province-in-the-lines-no-matrix-game-reaches.test.ts's.
//   And the army's other effects on rows the content doesn't write (planted in the table of the discoveries by id for
//   their case, and taken out after): a siege, own-ground, fanaticism or casting effect with no number, a siege's unit
//   types met by no unit, a gap among the attacker's units, a unit's strength stacked past its ceiling (×1.30).
// Level 1 (unit): the runner on a staged realm, and combatVsNPC called directly on a world the engine makes from a
// fixed seed, no turn played; whether the line is written is decided before any die is drawn (a seeded stream feeds
// the rest of the battle). Not lower: the effects read the content's rows and the battle writes the line. Not higher: a
// whole turn adds dice and orders before the battle, and no bot researches these discoveries in the matrix.
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { homeProvinceIdFor } from '../../src/engine/grand-design.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import {
  DISC_BY_ID,
  theFactorARealmsDiscoveriesStrengthenAUnitBy,
  theShareARealmsDiscoveriesFortifyItsOwnGroundBy,
  whatARealmsDiscoveriesAddToACastersChance,
  whatARealmsDiscoveriesAddToASidesFanaticism,
  whatARealmsDiscoveriesAddToASiege,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

// The GM's log echoes each line on the console: quiet while the battles write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Sanctified Walls (Divine: +15% on any ground the realm holds) and Bulwark of the Realm (Good: +30% at its home). */
const SANCTIFIED_WALLS = { id: 'ad08' };
const BULWARK_OF_THE_REALM = { id: 'ag10' };

describe("a realm's own-ground discoveries, in the registry's runner", () => {
  test.for([
    ['Sanctified Walls, away from home', [SANCTIFIED_WALLS], false, 0.15],
    ['Sanctified Walls, at home', [SANCTIFIED_WALLS], true, 0.15],
    ['Bulwark of the Realm, away from home', [BULWARK_OF_THE_REALM], false, 0],
    ['Bulwark of the Realm, at home', [BULWARK_OF_THE_REALM], true, 0.3],
    ['the two, away from home', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], false, 0.15],
    ['the two, at home: capped at the ceiling', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], true, 0.3],
    ['none', [], true, 0],
  ] as const)('%s', ([, discoveries, atHome, share]) => {
    expect(
      theShareARealmsDiscoveriesFortifyItsOwnGroundBy({ discoveries }, { isItTheRealmsHome: () => atHome }),
    ).toBeCloseTo(share, 12);
  });

  test('the realm with no discoveries, or none: no share', () => {
    expect(theShareARealmsDiscoveriesFortifyItsOwnGroundBy(undefined, { isItTheRealmsHome: () => true })).toBe(0);
    expect(theShareARealmsDiscoveriesFortifyItsOwnGroundBy({}, { isItTheRealmsHome: () => true })).toBe(0);
  });

  test('its home is asked only by an effect that needs it, once each', () => {
    const isItTheRealmsHome = vi.fn(() => true);
    theShareARealmsDiscoveriesFortifyItsOwnGroundBy({ discoveries: [SANCTIFIED_WALLS] }, { isItTheRealmsHome });
    expect(isItTheRealmsHome).not.toHaveBeenCalled();
    theShareARealmsDiscoveriesFortifyItsOwnGroundBy(
      { discoveries: [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM] },
      { isItTheRealmsHome },
    );
    expect(isItTheRealmsHome).toHaveBeenCalledTimes(1);
  });
});

/** Runs `fn` with rows planted in the discoveries' table (each id `test-<key>`, its effect as given), and a realm that
 *  holds them; the rows are taken out after. */
function withPlantedRows<T>(effects: Record<string, object>, fn: (realm: { discoveries: { id: string }[] }) => T): T {
  const ids = Object.keys(effects).map((k) => `test-${k}`);
  Object.entries(effects).forEach(([k, effect]) => {
    Reflect.set(DISC_BY_ID, `test-${k}`, { id: `test-${k}`, name: k, category: 'Test', desc: '', effect });
  });
  try {
    return fn({ discoveries: ids.map((id) => ({ id })) });
  } finally {
    ids.forEach((id) => Reflect.deleteProperty(DISC_BY_ID, id));
  }
}

describe("the army's effects on rows the content doesn't write", () => {
  test("a siege: no delta, unit types no unit has, a gap among the attacker's units", () => {
    const added = withPlantedRows(
      {
        bare: { kind: 'siege' },
        rams: { kind: 'siege', delta: 0.1, withTypes: ['Ironhoof Rams'] },
        guns: { kind: 'siege', delta: 0.2, withTypes: ['Mountain Guns'] },
      },
      (realm) =>
        whatARealmsDiscoveriesAddToASiege(realm, { theAttackersUnits: [null, undefined, { type: 'Mountain Guns' }] }),
    );
    expect(added).toBeCloseTo(0.2, 12);
  });

  test('own ground, fanaticism and casting: no pct', () => {
    const got = withPlantedRows(
      {
        ground: { kind: 'defOwn' },
        walls: { kind: 'defOwn', pct: 0.1 },
        zeal: { kind: 'fanatic' },
        fury: { kind: 'fanatic', pct: 0.1 },
        cast: { kind: 'cast' },
        lore: { kind: 'cast', pct: 4 },
      },
      (realm) => [
        theShareARealmsDiscoveriesFortifyItsOwnGroundBy(realm, { isItTheRealmsHome: () => true }),
        whatARealmsDiscoveriesAddToASidesFanaticism(realm, { theSide: 'atk', theGround: 'plain', theForce: [] }),
        whatARealmsDiscoveriesAddToACastersChance(realm, { theSchool: 'white', whereHeCasts: 'battle' }),
      ],
    );
    expect(got).toEqual([0.1, 0.1, 4]);
  });

  test("a unit's strength stacked past the kind's ceiling: ×1.30", () => {
    const factor = withPlantedRows(
      { drums: { kind: 'unitStr', pct: 0.2 }, horns: { kind: 'unitStr', pct: 0.2 } },
      (realm) =>
        theFactorARealmsDiscoveriesStrengthenAUnitBy(realm, {
          theUnit: { type: 'Free Lances' },
          theGround: 'plain',
          isItsSideTheAttacker: true,
          isItLedByTheKing: false,
          hasItACommander: true,
        }),
    );
    expect(factor).toBe(1.3);
  });

  test("casting: a school or a place that isn't his", () => {
    const got = withPlantedRows(
      {
        fire: { kind: 'cast', pct: 3, school: 'elemental' },
        duel: { kind: 'cast', pct: 5, ctx: 'duel' },
        any: { kind: 'cast', pct: 7, school: 'white', ctx: 'battle' },
      },
      (realm) => [
        whatARealmsDiscoveriesAddToACastersChance(realm, { theSchool: 'white', whereHeCasts: 'battle' }),
        whatARealmsDiscoveriesAddToACastersChance(realm, { theSchool: 'elemental', whereHeCasts: 'duel' }),
      ],
    );
    expect(got).toEqual([7, 8]);
  });
});

interface Character {
  id: number | string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  armies: ArmyInABattle[];
  encounterPlan?: { tactics: string[]; duelStance: string };
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
  turn: number;
  relations: Record<string, string>;
  characters: Character[];
  players: { name: string; discoveries: { id: string }[] }[];
  world: { cols: number; rows: number; provinces: Province[] };
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
    { seaPct: 10 },
  ),
);

/** `n` companies of the type and quality given. */
const companies = (n: number, quality: string): ArmyInABattle[] =>
  Array.from({ length: n }, (_, i) => ({
    type: 'Men-at-Arms',
    quality,
    race: 'Human',
    unitName: `Company ${String(i)}`,
  }));

/** Realm 0's king attacks a province of realm 1 (its home, or another it holds), held by its garrison with no guard to
 *  lead it, realm 1 holding the discoveries given (or realm 0 holding the province, `the attackers`). The lines the
 *  battle writes, in words, and realm 1's name. */
function aBattleAgainstAGarrison(
  discoveries: readonly { readonly id: string }[],
  where: 'its home' | 'away from home' | 'the attackers',
): { readonly words: readonly string[]; readonly realm1: string } {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const atk = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  const realm1 = G.players[1];
  const home = homeProvinceIdFor(G as never, 1);
  const field =
    where === 'its home'
      ? G.world.provinces.find((p) => p.id === home)
      : G.world.provinces.find((p) => p.terrain === 'plain' && p.owner === null && p.id !== home);
  if (!atk || !realm1 || !field) throw new Error('the world has no king in realm 0, no realm 1 or no field');
  field.owner = where === 'the attackers' ? 0 : 1;
  realm1.discoveries = discoveries.map((d) => ({ ...d }));
  Object.assign(field, { characters: [atk.id], features: [], garrisonArmies: [], npcArmies: 0 });
  field.neutralDefenders = companies(2, 'Green');
  atk['_attackedFrom'] = atk.location;
  atk.location = field.id;
  atk.armies = companies(4, 'Average');
  atk.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  const was = kcRng.use(kcRngStream(7));
  let narrative: NarrativeLine[];
  try {
    narrative = (combatVsNPC(tc, atk, field, null) as { narrative: NarrativeLine[] }).narrative;
  } finally {
    kcRng.use(was);
  }
  return { words: narrative.map((l) => theWordsOf(l)), realm1: realm1.name };
}

describe("a realm's own-ground discoveries, in a battle against a province's defenders it holds", () => {
  test.for([
    ['Sanctified Walls, away from home', [SANCTIFIED_WALLS], 'away from home', 15],
    ['Bulwark of the Realm, at home', [BULWARK_OF_THE_REALM], 'its home', 30],
    ['the two, at home: capped at the ceiling', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], 'its home', 30],
    ['the two, away from home', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], 'away from home', 15],
  ] as const)('%s', ([, discoveries, where, pct]) => {
    const shown = aBattleAgainstAGarrison(discoveries, where);
    expect(shown.words).toContain(
      `  🛡 ${shown.realm1}'s realm holds its own ground the harder (+${String(pct)}% defence).`,
    );
  });

  test.for([
    ['Bulwark of the Realm, away from home', [BULWARK_OF_THE_REALM], 'away from home'],
    ['none', [], 'its home'],
    ['the attacker holds the province', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], 'the attackers'],
  ] as const)('%s: no line', ([, discoveries, where]) => {
    const shown = aBattleAgainstAGarrison(discoveries, where);
    expect(shown.words.filter((w) => w.includes('holds its own ground the harder'))).toEqual([]);
  });
});
