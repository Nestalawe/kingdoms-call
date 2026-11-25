// A host's strength, the best commander, the Wonders, the ground's note and the sea lift read their rows' figures where
// no game of the matrix reaches, or where one reaches them but no case would tell a figure changed by a little (B-06bm:
// the numbers of the battles' smaller files moved to content's rows, src/content/kingdoms-call-data.ts, each named for
// its rule). Each case is worked out by hand from the rule, and the figures are written here as literals, so a row's
// figure changed fails a case:
// - a unit of a type and of a quality the tables don't hold is of base strength 4 and of quality factor 2
//   (KC_THE_STRENGTH_OF_A_UNIT_THE_TABLES_DONT_HOLD): 8 in a host's strength (armStr), in the strength ladder's base and
//   in unitBaseStrength;
// - a commander of March 8 doubles the ground's bonus on the units he leads, and one of Naval 8 waives the sea's
//   penalty on his land units (KC_A_COMMANDERS_MARCH_AND_NAVAL_MASTERY_ON_THE_GROUND_AND_AT_SEA);
// - the Standing Stones lift a Pagan realm's defenders in the woods ×1.25, and the Iron Throne raises a slain unit at a
//   die below 0.2, not at 0.2 (KC_THE_WONDERS_FIGURES_IN_A_BATTLE);
// - a Cursed commander's Druid counts halved in the Druid mastery, and the best commander's score halves a Cursed
//   commander's Tactical and Naval and lifts by Tactical's +20% a level to ×2.0 and by Naval's +20% a level (B-06be's
//   shared rows);
// - a hero who escapes a pre-battle duel's killing blow is left with half his most HP, rounded
//   (KC_A_PRE_BATTLE_DUELS_FIGURES);
// - the ground's note names a unit below ×0.85 or above ×1.05, and not one at either
//   (KC_THE_GROUNDS_FACTORS_A_BATTLES_NOTE_NAMES_A_UNIT_FOR);
// - the stranding's shortfall counts in half-berths, a berth short as 1000, and doubles a leader of Naval 8's berths
//   (KC_A_SEA_LIFTS_HALF_BERTHS_AS_THE_STRANDING_COUNTS_THEM);
// - a beaten host's worth of a province: 1000 a gold of its tax, 400 its realm's own ground, 200 its home, 100 a
//   garrison there (KC_THE_WORTH_A_BEATEN_HOST_SETS_ON_THE_GROUND_IT_FALLS_BACK_TO).
//
// Level 1 (unit): the engine's functions called directly on hand-made units, heroes and provinces (a hero staged with
// the fields these read, his type given by assertion, as the other unit cases on these files give it), and the best
// commander's score on a world the engine makes from KC_SEED; no turn is played. Not lower: each figure is read inside
// a computed value. The Iron Throne's die and the duel's dice are stood in (kcRng.use) and put back; nothing else draws
// one.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { armStr, druidMasteryGain } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { ladderLines } from '../../src/engine/battle/ladder.ts';
import { commandScore } from '../../src/engine/battle/best-commander.ts';
import { ironThroneRaise } from '../../src/engine/battle/blood-harvest-and-iron-throne.ts';
import { preBattleDuel } from '../../src/engine/battle/pre-battle-duels.ts';
import { terrainNoteList } from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import { unitBaseStrength } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import { retreatValue, seaLiftShortfall } from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import type { ArmyInABattle, HeroInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Army } from '../../src/schemas/saved-game-state.ts';
import { aWorld, companies, theTurnsContext, type World } from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** A unit of no race (so no kinship), of quality `quality`. */
const unit = (type: string, quality = 'Average'): ArmyInABattle => ({
  type,
  quality,
  race: '',
  unitName: `the Test ${type}`,
});
/** A hero with the fields armStr reads: of no realm, an Elf (no unit here is of his race), his skills as given. */
const hero = (skills: Record<string, number> = {}): HeroInABattle =>
  ({
    id: 1,
    name: 'Testhero',
    player: null,
    race: 'Elven',
    alignment: 'Neutral',
    skills,
    items: [],
  }) as unknown as HeroInABattle;
/** A state of one realm, of the alignment given, its Grand Design raised before the Wonders were sited (always on). */
const aRealmWithItsWonder = (alignment: string) => ({
  G: { players: [{ alignment, race: 'Human', discoveries: [{ id: 'gd' }] }], characters: [] },
});
const NEUTRAL = aRealmWithItsWonder('Neutral') as unknown as TurnContext;

describe("a unit the tables don't hold", () => {
  test('a unit of a type and a quality no table holds is 4 × 2 = 8: in unitBaseStrength, a host and the ladder', () => {
    const stranger = unit('A Unit No Table Holds', 'A Quality No Table Holds');
    expect(unitBaseStrength(stranger)).toBe(8);
    expect(armStr(NEUTRAL, stranger, null, 'Neutral', null, null)).toBe(8);
    const lines = ladderLines(
      'attacker',
      { kind: "a province's guards with no guard to name them" },
      [{ a: stranger, base: 8 }],
      3,
      false,
      [],
      8,
    );
    const units = lines.find((l) => l.kind === "the strength ladder's units");
    expect(units && 'baseStrength' in units ? units.baseStrength : null, "the ladder's base").toBe(8);
  });
  test('a Men-at-Arms (base 6) of a quality no table holds fights at 6 × 2 = 12', () => {
    expect(unitBaseStrength(unit('Men-at-Arms', 'A Quality No Table Holds'))).toBe(12);
    expect(armStr(NEUTRAL, unit('Men-at-Arms', 'A Quality No Table Holds'), null, 'Neutral', null, null)).toBe(12);
  });
});

describe("a commander's March 8 and Naval 8", () => {
  test("March 8 doubles a plain's ×1.1 for Men-at-Arms to ×1.2; March 7 leaves it", () => {
    // Veteran Men-at-Arms: 6 × 3 = 18 (his Druid 1 leads them with no shortfall); ×1.1 is 19 (rounded down), ×1.2 21.
    const at = (march: number) =>
      armStr(NEUTRAL, unit('Men-at-Arms', 'Veteran'), hero({ march, druid: 1 }), 'Neutral', 'plain', {
        enemyForce: [],
      });
    expect(at(7)).toBe(19);
    expect(at(8)).toBe(21);
  });
  test("Naval 8 waives the sea's ×0.75 on the land units he leads beside a hull; Naval 7 doesn't", () => {
    // Veteran Men-at-Arms: 18 (as above); at sea ×0.75 is 13 (rounded down).
    const atSea = (naval: number) =>
      armStr(NEUTRAL, unit('Men-at-Arms', 'Veteran'), hero({ naval, druid: 1 }), 'Neutral', 'sea', {
        force: [unit('Galleon Fleet'), unit('Men-at-Arms', 'Veteran')],
        enemyForce: [],
      });
    expect(atSea(7)).toBe(13);
    expect(atSea(8)).toBe(18);
  });
});

describe("a Cursed commander's Druid", () => {
  test("the Druid mastery counts a Cursed commander's Druid halved, rounded down", () => {
    const druid = (curse: string | null) =>
      druidMasteryGain(
        NEUTRAL,
        Object.assign(hero({ druid: 7 }), { _curseHalveStat: curse }),
        unit('Great Bears'),
        'Neutral',
      ).lvl;
    expect(druid(null)).toBeGreaterThan(1);
    expect(druid('druid')).toBe(Math.floor(druid(null) / 2));
  });
});

describe('the Wonders', () => {
  test("the Standing Stones lift a Pagan realm's unled Men-at-Arms defending a forest or a jungle ×1.25", () => {
    // Veteran Men-at-Arms: 18, ×0.9 in the forest is 16 (rounded down); ×1.25 is 20. Elite: 30, ×0.85 in the jungle is
    // 25; ×1.25 is 31.25, so 31 (where ×1.26 would make 32).
    const PAGAN = aRealmWithItsWonder('Pagan') as unknown as TurnContext;
    const defending = (turn: TurnContext, quality: string, terrain: string) =>
      armStr(turn, unit('Men-at-Arms', quality), null, 'Pagan', terrain, {
        enemyForce: [],
        isAttacker: false,
        ownerPi: 0,
      });
    expect(defending(NEUTRAL, 'Veteran', 'forest')).toBe(16);
    expect(defending(PAGAN, 'Veteran', 'forest')).toBe(20);
    expect(defending(NEUTRAL, 'Elite', 'jungle')).toBe(25);
    expect(defending(PAGAN, 'Elite', 'jungle')).toBe(31);
  });
  test('the Iron Throne raises a slain unit at a die of 0.1999, not at one of 0.2', () => {
    const G: Record<string, unknown> = aRealmWithItsWonder('Evil').G;
    const dice = [0.1999, 0.2];
    const was = kcRng.use(() => dice.shift() ?? 1);
    try {
      ironThroneRaise(
        { G } as unknown as TurnContext,
        { player: 0, id: 7 },
        [unit('Shieldwall Levies'), unit('Men-at-Arms')],
        [],
      );
    } finally {
      kcRng.use(was);
    }
    expect(dice, 'a die for each slain unit').toEqual([]);
    const rises = (G['_pendingRises'] ?? []) as { unit: { type: string } }[];
    expect(rises.map((r) => r.unit.type)).toEqual(['Shieldwall Levies']);
  });
});

describe('a pre-battle duel', () => {
  test('a hero who escapes the killing blow is left with half his most HP, rounded: 11 of 21', () => {
    // Every die stood in at 0: each blow lands, and the challenger (1 HP, Melee 0) falls to the first; he is one who
    // escapes the end (`_unkillable`), so he lives, his host shaken.
    const G: World = aWorld(SEED);
    const tc = theTurnsContext(G) as unknown as TurnContext;
    const [challenger, challenged] = G.characters.filter((c) => c.isKing);
    if (!challenger || !challenged) throw new Error('the world has two kings');
    const plan = (duelStance: string) => ({ tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance });
    Object.assign(challenger, {
      items: [],
      _unkillable: true,
      hp: 1,
      maxHp: 21,
      // his temper pinned as his skills are: a Cowardly king's fight ends by another way (the world's seed picks it)
      temper: 'Brave',
      skills: { ...challenger.skills, melee: 0 },
      encounterPlan: plan('challenge'),
    });
    Object.assign(challenged, {
      items: [],
      hp: 200,
      maxHp: 200,
      temper: 'Brave',
      skills: { ...challenged.skills, melee: 9 },
      encounterPlan: plan('accept'),
    });
    const was = kcRng.use(() => 0);
    let morale: { atkMorale: number; defMorale: number };
    try {
      morale = preBattleDuel(tc, challenger as never, challenged as never, []);
    } finally {
      kcRng.use(was);
    }
    expect([challenger.alive, challenger['hp'], morale.atkMorale, morale.defMorale]).toEqual([true, 11, 0.8, 1]);
  });
});

describe("the best commander's score", () => {
  /** Realm 0's king, of the skills given and no item, on a province of the ground given, scored for the host given. */
  function theScoreOf(
    skills: Record<string, number>,
    curse: string | null,
    terrain: string,
    host: ArmyInABattle[],
  ): number {
    const G: World = aWorld(SEED);
    const tc = theTurnsContext(G) as unknown as TurnContext;
    const king = G.characters.find((c) => c.isKing && c.player === 0);
    if (!king) throw new Error('realm 0 has no king');
    Object.assign(king, { items: [], skills: { ...king.skills, ...skills }, _curseHalveStat: curse });
    const prov = G.world.provinces.find((p) => p.terrain === terrain);
    if (!prov) throw new Error(`no ${terrain} province`);
    return commandScore(tc, king as unknown as HeroInABattle, host, prov as never, true);
  }
  test("on a plain, Tactical 5 lifts a host ×2.0; Cursed, his Tactical is 2 and the lift ×1.4: the score's 0.7 of it", () => {
    const host = companies('Men-at-Arms', 4, 'Veteran') as unknown as ArmyInABattle[];
    const whole = theScoreOf({ tactical: 5 }, null, 'plain', host);
    const cursed = theScoreOf({ tactical: 5 }, 'tactical', 'plain', host);
    expect(cursed / whole).toBeCloseTo(0.7, 6);
  });
  test("at sea, Naval 4 lifts a fleet ×1.8; Cursed, his Naval is 2 and the lift ×1.4: the score's 1.4 / 1.8 of it", () => {
    const host = companies('Galleon Fleet', 2, 'Veteran') as unknown as ArmyInABattle[];
    const whole = theScoreOf({ naval: 4 }, null, 'sea', host);
    const cursed = theScoreOf({ naval: 4 }, 'naval', 'sea', host);
    expect(cursed / whole).toBeCloseTo(1.4 / 1.8, 6);
  });
});

describe("the ground's note", () => {
  test('on a plain it names the Men-at-Arms (×1.1) and the Free Lances (×1.15), not the Mountain Guns at ×0.85', () => {
    const force = ['Mountain Guns', 'Shadow Archers', 'Men-at-Arms', 'Free Lances'].map((t) => unit(t));
    expect(terrainNoteList(force as unknown as Army[], 'plain')).toEqual([
      { unitType: 'Men-at-Arms', multiplier: 1.1 },
      { unitType: 'Free Lances', multiplier: 1.15 },
    ]);
  });
  test('in the desert it names the Elven Bowmen (×0.8) and the Free Lances, not the Orc Berserkers at ×1.05', () => {
    const force = ['Orc Berserkers', 'Elven Bowmen', 'Free Lances'].map((t) => unit(t));
    expect(terrainNoteList(force as unknown as Army[], 'desert')).toEqual([
      { unitType: 'Elven Bowmen', multiplier: 0.8 },
      { unitType: 'Free Lances', multiplier: 1.15 },
    ]);
  });
});

describe('the sea lift and a retreat', () => {
  test('a galleon (2 half-berths) under three Free Lances (2 each) falls 4 half-berths short: 4000; 2000 under Naval 8', () => {
    const column = [unit('Galleon Fleet'), unit('Free Lances'), unit('Free Lances'), unit('Free Lances')];
    expect(seaLiftShortfall(column, null)).toBe(4000);
    expect(seaLiftShortfall(column, { skills: { naval: 7 } })).toBe(4000);
    expect(seaLiftShortfall(column, { skills: { naval: 8 } })).toBe(2000);
  });
  test('two galleons carry a Free Lances and two of three Shieldwall Levies (1 half-berth each): one levy short', () => {
    const column = [
      unit('Galleon Fleet'),
      unit('Galleon Fleet'),
      unit('Free Lances'),
      unit('Shieldwall Levies'),
      unit('Shieldwall Levies'),
      unit('Shieldwall Levies'),
    ];
    expect(seaLiftShortfall(column, null)).toBe(1);
    expect(seaLiftShortfall(column.slice(0, 5), null)).toBe(0);
  });
  test("a beaten host's worth of a province: 1000 a gold of tax, 400 its own ground, 200 its home, 100 a garrison", () => {
    const turn = { G: { players: [{ homeProvinceId: 5 }] } } as unknown as TurnContext;
    const p = (more: Record<string, unknown>) => ({ id: 5, tax: 3, owner: 1, garrisonArmies: [], ...more }) as never;
    const ch = { player: 0 };
    expect(retreatValue(turn, ch, p({ id: 6 }))).toBeCloseTo(3000 + 1 - 6e-6, 9);
    expect(retreatValue(turn, ch, p({ id: 6, owner: 0 }))).toBeCloseTo(3400 + 1 - 6e-6, 9);
    expect(retreatValue(turn, ch, p({}))).toBeCloseTo(3200 + 1 - 5e-6, 9);
    expect(retreatValue(turn, ch, p({ id: 6, garrisonArmies: [unit('Men-at-Arms')] }))).toBeCloseTo(3100 + 1 - 6e-6, 9);
  });
});
