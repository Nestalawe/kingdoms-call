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
//   types met by no unit, a gap among the attacker's units (none but gaps: nothing), a gap in a force asked for a class
//   of unit (no unit of it, a humanoid's neither), a unit's strength stacked past its ceiling (×1.30).
// - P1-19ab: Homeward Song (re10: +40 to an Elven unit's chance of slipping away home; met 4 times in 1 game of the
//   matrix, which no game's outcome shows), in recordBattleGraves called with its die fed: the fallen unit flees home
//   on a roll its song lifts it past, and leaves a grave without the song. And the lines' and the fates' effects on rows
//   the content doesn't write: a beaten unit's death cut stacked past its floor (a quarter), a side asked with none
//   given, a flight home or a surgery with no number (Battlefield Surgery's 20%: discParam's fallback, moved as it is),
//   and Flanking Tactics' weights when no discovery has the kind.
// - P1-19ac: a fighter's aim steadied against each kind of foe (Saints' Relics against the undead, a hero or a guardian:
//   no game meets it; Bestiaries, Champions' Tourney, Duelling Code), in pcHitChance and pcArrowHitChance, the foe's
//   kind asked only by an effect against the undead; Veteran Training's +1 in a hero's fighter (pcCharCombatant, his
//   Melee, Archery and their raw levels) and on his card (extraSkillBonuses), which games meet but no test saw; Mithril
//   Craft in his fighter; the Order of the Golden Shield in awardHpRoll (the king's gain and earned hit points doubled,
//   no other hero's), its die fed; and an aim, a Mithril and a rise on rows the content doesn't write.
// Level 1 (unit): the runner on a staged realm, and combatVsNPC, recordBattleGraves, the to-hit chances,
// pcCharCombatant, extraSkillBonuses and awardHpRoll called directly (on a world the engine makes from a fixed seed, or
// a staged realm), no turn played; whether the line is written is decided before any die is drawn (a seeded stream
// feeds the rest of the battle), and the graves' and the hardening's one die is fed. Not lower: the effects read the
// content's rows and the battle writes the line. Not higher: a whole turn adds dice and orders before the battle, and no
// bot researches these discoveries in the matrix.
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { homeProvinceIdFor } from '../../src/engine/grand-design.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import { recordBattleGraves } from '../../src/engine/graves.ts';
import { pcHitChance } from '../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts';
import { pcArrowHitChance } from '../../src/engine/personal-combat/melee-flight-and-archery.ts';
import {
  pcCharCombatant,
  pcMonsterCombatant,
  pcNewStatus,
} from '../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts';
import { extraSkillBonuses } from '../../src/engine/titles/reckoning.ts';
import { awardHpRoll } from '../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts';
import {
  DISC_BY_ID,
  doARealmsDiscoveriesWeightTheLinesBehindTheFront,
  theChanceARealmsDiscoveriesDragAHeroFromTheField,
  theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath,
  theWeightsADiscoveryGivesTheLinesBehindTheFront,
  whatARealmsDiscoveriesAddToAFallenUnitsFlightHome,
  theFactorARealmsDiscoveriesStrengthenAUnitBy,
  theShareARealmsDiscoveriesFortifyItsOwnGroundBy,
  whatARealmsDiscoveriesAddToACastersChance,
  whatARealmsDiscoveriesAddToASidesFanaticism,
  whatARealmsDiscoveriesAddToASiege,
  theFactorARealmsDiscoveriesHardenTheKingBy,
  theLevelsARealmsDiscoveriesAddToAFightersSkills,
  whatARealmsDiscoveriesAddToAFightersAim,
  whatARealmsDiscoveriesAddToAFightersMithril,
  whatARealmsDiscoveriesAddToASkillsRise,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
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

  test("a siege whose unit types only a gap among the attacker's units could hold: nothing", () => {
    const added = withPlantedRows({ guns: { kind: 'siege', delta: 0.2, withTypes: ['Mountain Guns'] } }, (realm) =>
      whatARealmsDiscoveriesAddToASiege(realm, { theAttackersUnits: [null, undefined] }),
    );
    expect(added).toBe(0);
  });

  test("fanaticism with a class of unit in the force: a gap in the force is no unit of it, a humanoid's neither", () => {
    const added = withPlantedRows({ kin: { kind: 'fanatic', pct: 0.1, withCls: 'humanoid' } }, (realm) => [
      whatARealmsDiscoveriesAddToASidesFanaticism(realm, { theSide: 'def', theGround: 'plain', theForce: [null] }),
      whatARealmsDiscoveriesAddToASidesFanaticism(realm, {
        theSide: 'def',
        theGround: 'plain',
        theForce: [null, { type: 'Men-at-Arms' }],
      }),
    ]);
    expect(added).toEqual([0, 0.1]);
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

/** Homeward Song (Elven Heritage: +40 to an Elven unit's chance of slipping away home), and Battlefield Surgery (15%). */
const HOMEWARD_SONG = { id: 're10' };
const BATTLEFIELD_SURGERY = { id: 'sd36' };

/** An Elven realm holding the discoveries given loses one Elven company on the ground given, its die fed: whether the
 *  company slipped away home (queued, no grave) or left a grave. */
function anElvenCompanyFalls(
  discoveries: readonly { readonly id: string }[],
  terrain: string,
  theDie: number,
): 'it slips away home' | 'it leaves a grave' {
  const queue: unknown[] = [];
  const tc = { G: { players: [{ race: 'Elven', discoveries }] }, _elvenEscapeQueue: queue };
  const field: { terrain: string; battleGraves?: unknown[] } = { terrain };
  const was = kcRng.use(() => theDie);
  try {
    recordBattleGraves(
      tc,
      field,
      [{ type: 'Elven Archers', quality: 'Average', race: 'Elven', unitName: 'Wardens' }],
      0,
    );
  } finally {
    kcRng.use(was);
  }
  if (queue.length === 1 && field.battleGraves?.length === 0) return 'it slips away home';
  if (queue.length === 0 && field.battleGraves?.length === 1) return 'it leaves a grave';
  throw new Error('the company both fled and left a grave, or neither');
}

describe('Homeward Song, as a fallen Elven company rolls to slip away home (recordBattleGraves)', () => {
  test.for([
    ['the song, on the plain: 80 is below 45 + 40', [HOMEWARD_SONG], 'plain', 0.8, 'it slips away home'],
    ['no song, on the plain: 80 is not below 45', [], 'plain', 0.8, 'it leaves a grave'],
    ['the song, on the plain: 86 is not below 45 + 40', [HOMEWARD_SONG], 'plain', 0.86, 'it leaves a grave'],
    ['the song, in the forest: 99 is below 60 + 40', [HOMEWARD_SONG], 'forest', 0.99, 'it slips away home'],
    ['no song, in the forest: 99 is not below 60', [], 'forest', 0.99, 'it leaves a grave'],
  ] as const)('%s', ([, discoveries, terrain, theDie, what]) => {
    expect(anElvenCompanyFalls(discoveries, terrain, theDie)).toBe(what);
  });

  test("the runner: the song's 40 points, none for a realm without it or no realm", () => {
    expect(whatARealmsDiscoveriesAddToAFallenUnitsFlightHome({ discoveries: [HOMEWARD_SONG] })).toBe(40);
    expect(whatARealmsDiscoveriesAddToAFallenUnitsFlightHome({ discoveries: [] })).toBe(0);
    expect(whatARealmsDiscoveriesAddToAFallenUnitsFlightHome(undefined)).toBe(0);
  });
});

describe("the lines' and the fates' effects, in their runners", () => {
  test("Battlefield Surgery's chance: its row's 15%, or nothing for a realm without it", () => {
    expect(theChanceARealmsDiscoveriesDragAHeroFromTheField({ discoveries: [BATTLEFIELD_SURGERY] })).toBe(0.15);
    expect(theChanceARealmsDiscoveriesDragAHeroFromTheField({ discoveries: [HOMEWARD_SONG] })).toBeNull();
    expect(theChanceARealmsDiscoveriesDragAHeroFromTheField(undefined)).toBeNull();
  });

  test("Flanking Tactics: a realm holding it has its lines weighted, by its row's four; one without, not", () => {
    expect(doARealmsDiscoveriesWeightTheLinesBehindTheFront({ discoveries: [{ id: 'sd09' }] })).toBe(true);
    expect(doARealmsDiscoveriesWeightTheLinesBehindTheFront({ discoveries: [BATTLEFIELD_SURGERY] })).toBe(false);
    expect(doARealmsDiscoveriesWeightTheLinesBehindTheFront(undefined)).toBe(false);
    expect(theWeightsADiscoveryGivesTheLinesBehindTheFront()).toEqual([1, 0.5625, 0.3125, 0.1563]);
  });
});

describe("the lines' and the fates' effects on rows the content doesn't write", () => {
  const unit = { type: 'Free Lances', quality: 'Average', race: 'Human' };

  test("a beaten unit's death cut stacked past the kind's floor: a quarter", () => {
    const left = withPlantedRows(
      { mail: { kind: 'deathRed', pct: 0.5 }, plate: { kind: 'deathRed', pct: 0.4 } },
      (realm) => theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath(realm, { theUnit: unit, theSide: 'atk' }),
    );
    expect(left).toBe(0.25);
  });

  test("a death cut for one side: the other side's unit, and a unit whose side isn't given, keep their chance", () => {
    const left = withPlantedRows({ charge: { kind: 'deathRed', pct: 0.4, side: 'atk' } }, (realm) =>
      (['atk', 'def', null, undefined] as const).map((theSide) =>
        theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath(realm, { theUnit: unit, theSide }),
      ),
    );
    expect(left).toEqual([0.6, 1, 1, 1]);
  });

  test("a flight home with no number, beside one with: the other's points; a surgery with no number, before one with: 20%", () => {
    const got = withPlantedRows(
      {
        hum: { kind: 'elvenEscape' },
        song: { kind: 'elvenEscape', pct: 10 },
        knife: { kind: 'nearDeathSurvival' },
        saw: { kind: 'nearDeathSurvival', pct: 0.3 },
      },
      (realm) => [
        whatARealmsDiscoveriesAddToAFallenUnitsFlightHome(realm),
        theChanceARealmsDiscoveriesDragAHeroFromTheField(realm),
      ],
    );
    expect(got).toEqual([10, 0.2]);
  });

  test("Flanking Tactics' weights when no discovery has the kind: none", () => {
    const sd09: unknown = Reflect.get(DISC_BY_ID, 'sd09');
    try {
      Reflect.deleteProperty(DISC_BY_ID, 'sd09');
      expect(theWeightsADiscoveryGivesTheLinesBehindTheFront()).toBeUndefined();
    } finally {
      Reflect.set(DISC_BY_ID, 'sd09', sd09);
    }
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

/** Realm 0's king attacks a free province held by twelve companies, led by a guard hero of realm 1 (or of no realm),
 *  realm 1 holding the discoveries given: the defenders' strength in their battle lines, as the GM's ladder gives it. */
function theDefendersLinesStrength(
  discoveries: readonly { readonly id: string }[],
  guard: 'of realm 1' | 'of no realm',
) {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const atk = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  const theGuard = G.characters.find((c) => c.alive && c.player === 1 && !c.isKing);
  const realm1 = G.players[1];
  const field = G.world.provinces.find((p) => p.terrain === 'plain' && p.owner === null);
  if (!atk || !theGuard || !realm1 || !field)
    throw new Error('the world has no king in realm 0, no hero in realm 1 or no field');
  realm1.discoveries = discoveries.map((d) => ({ ...d }));
  if (guard === 'of no realm') theGuard.player = null;
  Object.assign(field, { characters: [atk.id], features: [], garrisonArmies: [], npcArmies: 0 });
  field.neutralDefenders = companies(12, 'Average');
  theGuard.location = field.id;
  theGuard.armies = [];
  atk['_attackedFrom'] = atk.location;
  atk.location = field.id;
  atk.armies = companies(4, 'Average');
  atk.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  const was = kcRng.use(kcRngStream(7));
  let narrative: NarrativeLine[];
  try {
    narrative = (combatVsNPC(tc, atk, field, theGuard) as { narrative: NarrativeLine[] }).narrative;
  } finally {
    kcRng.use(was);
  }
  const theLines = narrative.flatMap((l) =>
    l.kind === "the strength ladder's battle lines" ? [l.battleLinesStrength] : [],
  );
  if (theLines.length !== 2)
    throw new Error(`the battle wrote ${String(theLines.length)} ladders of battle lines, not 2`);
  const [, theDefenders] = theLines;
  if (theDefenders === undefined) throw new Error('the battle wrote no ladder of battle lines for the defenders');
  return theDefenders;
}

describe("Flanking Tactics held by the realm of a guard hero who leads a free province's defenders (combatVsNPC)", () => {
  test('his realm holding it weights the lines behind the front: more strength than without; a guard of no realm, none', () => {
    const withIt = theDefendersLinesStrength([{ id: 'sd09' }], 'of realm 1');
    const without = theDefendersLinesStrength([], 'of realm 1');
    expect(withIt).toBeGreaterThan(without);
    expect(theDefendersLinesStrength([{ id: 'sd09' }], 'of no realm')).toBe(without);
  });
});

/** Saints' Relics (+20% to hit an undead foe), Bestiaries (+20% a monster), Champions' Tourney (+19% a character),
 *  Duelling Code (+14% any foe), Veteran Training (+1 Melee and Archery in a fight), the Order of the Golden Shield
 *  (the king's hardening doubled) and Mithril Craft (Mithril turns aside 4, not 2). */
const SAINTS_RELICS = { id: 'ad14' };
const BESTIARIES = { id: 'sd73' };
const CHAMPIONS_TOURNEY = { id: 'sd74' };
const DUELLING_CODE = { id: 'sd33' };
const VETERAN_TRAINING = { id: 'sd37' };
const GOLDEN_SHIELD = { id: 'sd35' };
const MITHRIL_CRAFT = { id: 'rd08' };

/** A plain fighter (a guardian of no perks, 20 HP, Melee and Archery 2, no wards, of the temper "None": no bonus), with
 *  the fields given. */
function aFighter(over: Record<string, unknown> = {}): AFighterInAPersonalCombat {
  return { ...pcMonsterCombatant({ name: 'Made-up Mole', hp: 20, melee: 2 }), archery: 2, ...over };
}

/** The foes an aim may be steadied against: a hero of the undead, a living hero, an undead guardian and a beast. */
const THE_FOES = {
  'an undead hero': { kind: 'character', isUndead: true, cat: undefined },
  'a living hero': { kind: 'character', isUndead: false, cat: undefined },
  'an undead guardian': { kind: 'monster', cat: 'undead' },
  'a beast': { kind: 'monster', cat: 'beast' },
} as const;

/** A fighter of realm 0, holding the discoveries given, swings at (or shoots) each foe: his chances to hit. */
function theChancesToHitEachFoe(
  discoveries: readonly { readonly id: string }[],
  how: 'a blow' | 'an arrow',
): Record<keyof typeof THE_FOES, number> {
  const tc = { G: { players: [{ discoveries }] } } as unknown as Parameters<typeof pcHitChance>[0];
  const out: Partial<Record<keyof typeof THE_FOES, number>> = {};
  for (const [name, foe] of Object.entries(THE_FOES) as [keyof typeof THE_FOES, object][]) {
    const actor = aFighter({ player: 0, status: pcNewStatus() });
    const target = aFighter({ ...foe, status: pcNewStatus() });
    out[name] = how === 'a blow' ? pcHitChance(tc, actor, target) : pcArrowHitChance(tc, actor, target);
  }
  return out as Record<keyof typeof THE_FOES, number>;
}

describe("a fighter's aim steadied by his realm's discoveries, against each kind of foe (pcHitChance, pcArrowHitChance)", () => {
  // 30 + 10 × Melee (or Archery) 2: 50 against any foe, before the discoveries
  test.for([
    ['none', [], [50, 50, 50, 50]],
    ["Saints' Relics: the undead only, a hero or a guardian", [SAINTS_RELICS], [70, 50, 70, 50]],
    ['Bestiaries: monsters only', [BESTIARIES], [50, 50, 70, 70]],
    ["Champions' Tourney: characters only", [CHAMPIONS_TOURNEY], [69, 69, 50, 50]],
    ['Duelling Code: every foe', [DUELLING_CODE], [64, 64, 64, 64]],
    ["Saints' Relics and Bestiaries: both against an undead guardian", [SAINTS_RELICS, BESTIARIES], [70, 50, 80, 70]],
  ] as const)('%s', ([, discoveries, chances]) => {
    for (const how of ['a blow', 'an arrow'] as const)
      expect(Object.values(theChancesToHitEachFoe(discoveries, how)), how).toEqual(chances);
  });

  test("the foe's kind is asked only by an effect against the undead", () => {
    const theFoesKind = vi.fn(() => 'undead');
    const facts = { whatTheFoeIs: 'character', theFoesKind };
    expect(whatARealmsDiscoveriesAddToAFightersAim({ discoveries: [DUELLING_CODE, BESTIARIES] }, facts)).toBe(14);
    expect(theFoesKind).not.toHaveBeenCalled();
    expect(whatARealmsDiscoveriesAddToAFightersAim({ discoveries: [SAINTS_RELICS] }, facts)).toBe(20);
    expect(theFoesKind).toHaveBeenCalledTimes(1);
  });
});

describe("Veteran Training and Mithril Craft in a hero's fighter (pcCharCombatant), and Veteran Training on his card", () => {
  /** Realm 1's first hero who isn't its king, of Melee and Archery given, no items, Cautious (no rage), his realm
   *  holding the discoveries given: his fighter's Melee, Archery, their raw levels, and what Mithril turns aside. */
  function hisFighter(discoveries: readonly { readonly id: string }[], melee: number, archery: number) {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const hero = G.characters.find((c) => c.alive && c.player === 1 && !c.isKing);
    const realm1 = G.players[1];
    if (!hero || !realm1) throw new Error('the world has no hero in realm 1');
    realm1.discoveries = discoveries.map((d) => ({ ...d }));
    Object.assign(hero, { skills: { ...(hero['skills'] as object), melee, archery }, items: [], temper: 'Cautious' });
    const was = kcRng.use(() => 0.5);
    try {
      const f = pcCharCombatant(tc as never, hero as never);
      return [f.melee, f.archery, f.meleeRaw, f.archeryRaw, f.mithrilDR];
    } finally {
      kcRng.use(was);
    }
  }

  test('Melee 3 and Archery 2: each a level higher with it, the raw levels too', () => {
    expect(hisFighter([], 3, 2)).toEqual([3, 2, 3, 2, 2]);
    expect(hisFighter([VETERAN_TRAINING], 3, 2)).toEqual([4, 3, 4, 3, 2]);
  });

  test("Mithril Craft: his Mithril turns aside its row's 2 more (4), whether he wears it or not", () => {
    expect(hisFighter([MITHRIL_CRAFT], 3, 2)).toEqual([3, 2, 3, 2, 4]);
  });

  test("his card: Veteran Training's +1 on Melee and Archery, in personal combat only; none without it", () => {
    const state = { players: [{ discoveries: [VETERAN_TRAINING] }, { discoveries: [DUELLING_CODE] }] };
    const theLine = {
      label: 'Veteran Training',
      delta: 1,
      kind: 'discovery',
      scope: 'combat',
      note: 'personal combat only',
    };
    expect(extraSkillBonuses({ id: 'a', player: 0 }, state, {})).toEqual({ melee: [theLine], archery: [theLine] });
    expect(extraSkillBonuses({ id: 'b', player: 1 }, state, {})).toEqual({});
    expect(extraSkillBonuses({ id: 'c', player: null }, state, {})).toEqual({});
  });

  test('the runner: its +1, once however often the realm holds it; none without it or a realm', () => {
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills({ discoveries: [VETERAN_TRAINING] })).toBe(1);
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills({ discoveries: [VETERAN_TRAINING, VETERAN_TRAINING] })).toBe(
      1,
    );
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills({ discoveries: [DUELLING_CODE] })).toBe(0);
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills(undefined)).toBe(0);
  });
});

describe('the Order of the Golden Shield: the king hardened twice as much (awardHpRoll)', () => {
  /** Realm 1's king (or its first other hero) rolls his hardening after a fight he won, the die fed at its middle, his
   *  realm holding the discoveries given: what he gained, and whether the line names the Order. */
  function hisHardening(discoveries: readonly { readonly id: string }[], who: 'the king' | 'another hero') {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const hero = G.characters.find((c) => c.alive && c.player === 1 && (who === 'the king') === !!c.isKing);
    const realm1 = G.players[1];
    if (!hero || !realm1) throw new Error('the world has no such hero in realm 1');
    realm1.discoveries = discoveries.map((d) => ({ ...d }));
    const before = Number(hero['hpEarned']) || 0;
    const was = kcRng.use(() => 0.5);
    try {
      const r = awardHpRoll(tc, hero, [], 'kill', true) as { gain: number; sd35?: boolean };
      return { gain: r.gain, earned: (Number(hero['hpEarned']) || 0) - before, theOrder: r.sd35 === true };
    } finally {
      kcRng.use(was);
    }
  }

  test('the king: twice the gain with it, the earned hit points too; another hero: as without', () => {
    const without = hisHardening([], 'the king');
    expect(without.theOrder).toBe(false);
    expect(without.gain).toBeGreaterThan(0);
    expect(hisHardening([GOLDEN_SHIELD], 'the king')).toEqual({
      gain: without.gain * 2,
      earned: without.earned + without.gain,
      theOrder: true,
    });
    expect(hisHardening([GOLDEN_SHIELD], 'another hero')).toEqual(hisHardening([], 'another hero'));
  });

  test("the runner: the kind's ×2, or nothing for a realm without it", () => {
    expect(theFactorARealmsDiscoveriesHardenTheKingBy({ discoveries: [GOLDEN_SHIELD] })).toBe(2);
    expect(theFactorARealmsDiscoveriesHardenTheKingBy({ discoveries: [DUELLING_CODE] })).toBeNull();
    expect(theFactorARealmsDiscoveriesHardenTheKingBy(undefined)).toBeNull();
  });
});

describe("the fighter's and his rise's effects on rows the content doesn't write", () => {
  test('an aim, a Mithril and a rise with no number; an aim against a foe no kind names; a rise for listed skills', () => {
    const got = withPlantedRows(
      {
        squint: { kind: 'duelHit' },
        stare: { kind: 'duelHit', pct: 3, vs: 'dragon' },
        steady: { kind: 'duelHit', pct: 5 },
        tin: { kind: 'mithril' },
        silver: { kind: 'mithril', extra: 1 },
        dull: { kind: 'skillGain' },
        drill: { kind: 'skillGain', pct: 0.1, skills: ['melee', 'archery'] },
      },
      (realm) => [
        whatARealmsDiscoveriesAddToAFightersAim(realm, { whatTheFoeIs: 'monster', theFoesKind: () => 'dragon' }),
        whatARealmsDiscoveriesAddToAFightersMithril(realm),
        whatARealmsDiscoveriesAddToASkillsRise(realm, { theSkill: 'melee' }),
        whatARealmsDiscoveriesAddToASkillsRise(realm, { theSkill: 'white' }),
      ],
    );
    expect(got).toEqual([5, 1, 0.1, 0]);
  });
});
