// The quality a commander's Druid 8 or Necromancy 6 lifts a unit to, and the minor titles' army perks, on plain values
// (plan P1-11e35 moved them out of armStr, so the army card can later ask the turn's own): Druid 8 lifts a Creature or
// a Monster one tier, Necromancy 6 a unit of the risen dead; a Naturalist or a Beastmaster lifts a Creature or a
// Monster +5%, a Cavalier a cavalry unit, an Ironclad a heavy unit or a fleet, each rounded as it goes.
//
// Level 1 (unit): the functions and sets of src/engine/rules-on-plain-values/the-quality-a-commanders-druid-8-or-
// necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts on made-up units and commanders, and armStr's call of
// them on a staged hero. A lower level can't run a function. A fault planted in a shared function moves every caller
// at once (the turn and, later, the card alike), so these cases pin its answers; no game of the balance matrix has a
// Druid 8 or Necromancy 6 hero leading the units they lift (P1-11's Decision 9), so armStr's cases stage one.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  MINOR_CAV,
  MINOR_HEAVY,
  theQualityACommandersDruid8AndNecromancy6LiftAUnitTo,
  theStrengthAUnitsCommandersMinorTitlesLiftItTo,
} from '../../src/engine/rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import type { AMinorTitleWithAnArmyPerk } from '../../src/engine/rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import { armStr } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import type { AModifierOfAUnitInTheLadder } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
import type { ArmyInABattle, HeroInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

/** The quality `quality` of `unitType` reaches under a commander of these mastery tiers (0 for none). */
const lifted = (unitType: string, quality: string, isSkeletal: boolean, druid: number, necromancy: number) =>
  theQualityACommandersDruid8AndNecromancy6LiftAUnitTo(
    { unitType, quality, isSkeletal },
    { hisDruidMasteryTier: druid, hisNecromancyMasteryTier: necromancy },
  );
/** A commander who holds `held` and no other minor title; the titles he is asked about go into `asked`. */
const holding = (held: readonly AMinorTitleWithAnArmyPerk[], asked: AMinorTitleWithAnArmyPerk[] = []) => {
  return (title: AMinorTitleWithAnArmyPerk) => {
    asked.push(title);
    return held.includes(title);
  };
};

describe("Druid 8's and Necromancy 6's lifts of a unit's quality", () => {
  test('Druid 8 (mastery tier 3) lifts a Creature and a Monster one tier, and only from tier 3', () => {
    expect(lifted('Thunderbirds', 'Average', false, 3, 0)).toEqual({
      quality: 'Veteran',
      liftedByDruid: true,
      liftedByNecromancy: false,
    });
    expect(lifted('Cave Trolls', 'Green', false, 3, 0).quality).toBe('Average');
    expect(lifted('Thunderbirds', 'Average', false, 4, 0).quality).toBe('Veteran');
    expect(lifted('Thunderbirds', 'Average', false, 2, 0)).toEqual({
      quality: 'Average',
      liftedByDruid: false,
      liftedByNecromancy: false,
    });
  });
  test('Druid 8 lifts no unit that is neither a Creature nor a Monster', () => {
    expect(lifted('Men-at-Arms', 'Average', false, 4, 0)).toEqual({
      quality: 'Average',
      liftedByDruid: false,
      liftedByNecromancy: false,
    });
    expect(lifted('Free Lances', 'Veteran', false, 4, 4).quality).toBe('Veteran');
  });
  test('Necromancy 6 (mastery tier 1) lifts a unit of the risen dead one tier, and only it', () => {
    expect(lifted('Men-at-Arms', 'Average', true, 0, 1)).toEqual({
      quality: 'Veteran',
      liftedByDruid: false,
      liftedByNecromancy: true,
    });
    expect(lifted('Men-at-Arms', 'Crack', true, 0, 4).quality).toBe('Elite');
    expect(lifted('Men-at-Arms', 'Average', true, 0, 0).liftedByNecromancy).toBe(false);
    expect(lifted('Men-at-Arms', 'Average', true, 3, 0).quality).toBe('Average');
    expect(lifted('Men-at-Arms', 'Average', false, 0, 4)).toEqual({
      quality: 'Average',
      liftedByDruid: false,
      liftedByNecromancy: false,
    });
  });
  test('both lift a risen Monster under a commander of both, two tiers in all, Druid first', () => {
    expect(lifted('Cave Trolls', 'Green', true, 3, 1)).toEqual({
      quality: 'Veteran',
      liftedByDruid: true,
      liftedByNecromancy: true,
    });
    expect(lifted('Cave Trolls', 'Veteran', true, 3, 1).quality).toBe('Elite');
  });
  test('Elite stays Elite; a quality the table does not hold stays as it is', () => {
    expect(lifted('Thunderbirds', 'Elite', true, 3, 1)).toEqual({
      quality: 'Elite',
      liftedByDruid: true,
      liftedByNecromancy: true,
    });
    expect(lifted('Thunderbirds', 'Legendary', false, 3, 0)).toEqual({
      quality: 'Legendary',
      liftedByDruid: true,
      liftedByNecromancy: false,
    });
  });
  test('no commander (both tiers 0) lifts nothing', () => {
    expect(lifted('Cave Trolls', 'Average', true, 0, 0)).toEqual({
      quality: 'Average',
      liftedByDruid: false,
      liftedByNecromancy: false,
    });
  });
});

describe("the minor titles' army perks", () => {
  test('the Cavalier lifts the cavalry, the Unicorn Herd among them; the Ironclad the heavy units and the fleets', () => {
    expect([...MINOR_CAV]).toEqual([
      'Free Lances',
      'Gilded Lances',
      'Warg Riders',
      'Stag Riders',
      'Ironhoof Rams',
      'Unicorn Herd',
    ]);
    expect([...MINOR_HEAVY]).toEqual([
      'Mountain Guns',
      'Dwarf Ironclads',
      'Galleon Fleet',
      'Corsair Fleet',
      'Elven Galleys',
      'Orcish Longships',
      'Whale Cohort',
      'Great Turtles',
      'Siege Towers',
    ]);
  });
  test('a Naturalist or a Beastmaster lifts a Creature or a Monster +5%, once however many of the two he holds', () => {
    expect(theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Thunderbirds', holding(['naturalist']))).toEqual({
      strength: 32,
      liftedBy: ['naturalist or beastmaster'],
    });
    expect(theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Cave Trolls', holding(['beastmaster']))).toEqual({
      strength: 32,
      liftedBy: ['naturalist or beastmaster'],
    });
    expect(
      theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Cave Trolls', holding(['naturalist', 'beastmaster'])),
    ).toEqual({ strength: 32, liftedBy: ['naturalist or beastmaster'] });
    expect(
      theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Men-at-Arms', holding(['naturalist', 'beastmaster'])),
    ).toEqual({ strength: 30, liftedBy: [] });
  });
  test('a Cavalier lifts a cavalry unit +5%, an Ironclad a heavy unit or a fleet, and neither another unit', () => {
    expect(theStrengthAUnitsCommandersMinorTitlesLiftItTo(41, 'Free Lances', holding(['cavalier']))).toEqual({
      strength: 43,
      liftedBy: ['cavalier'],
    });
    expect(theStrengthAUnitsCommandersMinorTitlesLiftItTo(50, 'Dwarf Ironclads', holding(['ironclad']))).toEqual({
      strength: 53,
      liftedBy: ['ironclad'],
    });
    expect(theStrengthAUnitsCommandersMinorTitlesLiftItTo(50, 'Siege Towers', holding(['ironclad'])).strength).toBe(53);
    expect(
      theStrengthAUnitsCommandersMinorTitlesLiftItTo(41, 'Men-at-Arms', holding(['cavalier', 'ironclad'])),
    ).toEqual({ strength: 41, liftedBy: [] });
    expect(theStrengthAUnitsCommandersMinorTitlesLiftItTo(41, 'Free Lances', holding(['ironclad'])).strength).toBe(41);
    expect(theStrengthAUnitsCommandersMinorTitlesLiftItTo(50, 'Galleon Fleet', holding(['cavalier'])).strength).toBe(
      50,
    );
  });
  test('two perks on one unit each round as they go, in their order', () => {
    // the Unicorn Herd is a Creature and cavalry: 10 → 10.5 → 11 → 11.55 → 12 (×1.1025 at once would give 11)
    expect(
      theStrengthAUnitsCommandersMinorTitlesLiftItTo(10, 'Unicorn Herd', holding(['naturalist', 'cavalier'])),
    ).toEqual({ strength: 12, liftedBy: ['naturalist or beastmaster', 'cavalier'] });
    // the Great Turtles are a Creature and a fleet: 9 → 9.45 → 9 → 9.45 → 9 (a floor would give 9, a ×1.06 10)
    expect(
      theStrengthAUnitsCommandersMinorTitlesLiftItTo(9, 'Great Turtles', holding(['beastmaster', 'ironclad'])),
    ).toEqual({ strength: 9, liftedBy: ['naturalist or beastmaster', 'ironclad'] });
    expect(
      theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Great Turtles', holding(['naturalist', 'ironclad'])),
    ).toEqual({ strength: 34, liftedBy: ['naturalist or beastmaster', 'ironclad'] });
  });
  test("the titles are asked in the turn's order, and only where the unit's kind leaves it a question", () => {
    const asked: AMinorTitleWithAnArmyPerk[] = [];
    theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Men-at-Arms', holding([], asked));
    expect(asked).toEqual(['cavalier', 'ironclad']);
    asked.length = 0;
    theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Thunderbirds', holding([], asked));
    expect(asked).toEqual(['naturalist', 'beastmaster', 'cavalier', 'ironclad']);
    asked.length = 0;
    theStrengthAUnitsCommandersMinorTitlesLiftItTo(30, 'Thunderbirds', holding(['naturalist'], asked));
    expect(asked).toEqual(['naturalist', 'cavalier', 'ironclad']);
  });
});

describe("armStr's call of them", () => {
  /** A unit of no race (so no kinship), of quality `quality`. */
  const unit = (type: string, quality = 'Average', extra: Partial<ArmyInABattle> = {}): ArmyInABattle => ({
    type,
    quality,
    race: '',
    unitName: `the Test ${type}`,
    ...extra,
  });
  /** A hero of no realm, an Elf (no unit here is of his race), with the skills given. */
  const hero = (skills: Record<string, number>, extra: Record<string, unknown> = {}): HeroInABattle =>
    ({
      id: 7,
      name: 'Testhero',
      player: null,
      race: 'Elven',
      alignment: 'Neutral',
      skills,
      items: [],
      ...extra,
    }) as unknown as HeroInABattle;
  /** The turn's context: realm 0, and the minor titles' holders given. */
  const turn = (minorHolders: Record<string, { charId: number }> = {}) =>
    ({
      G: {
        players: [{ alignment: 'Neutral', race: 'Human', discoveries: [] }],
        characters: [],
        _minorHolders: minorHolders,
      },
    }) as unknown as TurnContext;
  /** armStr's figure for `a` led by `h`, with no ground, and the trace it records. */
  const strength = (a: ArmyInABattle, h: HeroInABattle | null, t: TurnContext = turn()) => {
    const trace: AModifierOfAUnitInTheLadder[] = [];
    const s = armStr(t, a, h, 'Neutral', null, { enemyForce: [], trace });
    return { s, trace: trace.map((x) => x.reason) };
  };
  const base = (type: string, quality: string) => Number(UNIT_BASE_STR[type]) * Number(UNIT_Q_MULT[quality]);

  test('a Necromancy 6 commander lifts his risen dead a tier; a Necromancy 5 one, or none, does not', () => {
    const risen = unit('Men-at-Arms', 'Average', { _isSkeletal: true });
    expect(strength(risen, hero({ necromancy: 6 }))).toEqual({
      s: base('Men-at-Arms', 'Veteran'),
      trace: [{ kind: 'it fights at another quality', quality: 'Veteran', liftedBy: ['necromancy'] }],
    });
    expect(strength(risen, hero({ necromancy: 5 }))).toEqual({ s: base('Men-at-Arms', 'Average'), trace: [] });
    expect(strength(risen, null)).toEqual({ s: base('Men-at-Arms', 'Average'), trace: [] });
    expect(strength(unit('Men-at-Arms'), hero({ necromancy: 9, druid: 9 })).s).toBe(base('Men-at-Arms', 'Average'));
  });
  test('a Druid 8 commander lifts a Creature a tier, after his Oratory, and names both in their order', () => {
    const lift = (h: HeroInABattle) => strength(unit('Thunderbirds'), h).trace[0];
    expect(lift(hero({ druid: 8 }))).toEqual({
      kind: 'it fights at another quality',
      quality: 'Veteran',
      liftedBy: ['druid'],
    });
    expect(lift(hero({ druid: 8 }, { _oratoryBoost: true }))).toEqual({
      kind: 'it fights at another quality',
      quality: 'Crack',
      liftedBy: ['oratory', 'druid'],
    });
    expect(lift(hero({ druid: 7 }))?.kind).not.toBe('it fights at another quality');
    expect(lift(hero({ druid: 8, necromancy: 6 }, { _druidNegated: true }))?.kind).toBe('it fights at another quality');
  });
  // (Druid 4 leads every unit here with no shortfall, and the Great Turtles with no mastery over their need)
  test("a hero's minor titles lift the units they name, each on the ladder; another hero's do not", () => {
    const lances = unit('Free Lances');
    const t = turn({ cavalier: { charId: 7 }, ironclad: { charId: 7 } });
    expect(strength(lances, hero({ druid: 4 }), t)).toEqual({
      s: Math.round(base('Free Lances', 'Average') * 1.05),
      trace: [{ kind: "a cavalier's title" }],
    });
    expect(strength(lances, hero({ druid: 4 }, { id: 8 }), t)).toEqual({
      s: base('Free Lances', 'Average'),
      trace: [],
    });
    expect(
      strength(unit('Great Turtles'), hero({ druid: 4 }), turn({ naturalist: { charId: 7 }, ironclad: { charId: 7 } })),
    ).toEqual({
      s: Math.round(Math.round(base('Great Turtles', 'Average') * 1.05) * 1.05),
      trace: [{ kind: "a naturalist's or beastmaster's title" }, { kind: "an ironclad's title" }],
    });
    expect(strength(lances, null, t)).toEqual({ s: base('Free Lances', 'Average'), trace: [] });
  });
});
