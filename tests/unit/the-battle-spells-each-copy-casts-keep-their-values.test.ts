// The battle spells each copy casts keep their values (plan P1-19's spells family, row P1-19u). Battle magic is written
// in three copies (a hero's between two heroes' hosts, a hero's against a province's neutral guards, the guards'
// commander's against him), and each keeps its own rule (Parked "Battle magic's three copies disagree on two rules").
// What each of the eight spells does is the spells' registry's effect at "strength: a battle spell is cast before the
// battle", and whether it has something to strike its effect at "strength: a battle spell has something to strike";
// the Ember Rune's second Fireball is the items' registry's "strength: a hero's items change his battle spell". This
// reads the effects through their runners, on staged fields: each spell's numbers (half, 20%, a quarter rounded up,
// half rounded up, Tactical ×0.5), its rounding and its floor of 1, the strongest units it strikes, the level it counts
// to (5, but by a guards' commander), the undead and the missile units each reads, and the line each copy writes. The
// battles' lines that apply them, where no matrix game reaches, are
// tests/unit/the-battle-magic-lines-no-matrix-game-reaches-keep-their-values.test.ts.
// Level 1 (unit): the effects and runners are plain functions, called directly. Not lower: the values are what the
// code computes, which a syntax tree can't evaluate. It reads the registries' runners, which the code before P1-19u
// doesn't have.
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  aBattleSpellHasSomethingToStrike,
  whatABattleSpellDoesBeforeTheBattle,
} from '../../src/engine/rules/the-registry-of-spell-effects.ts';
import { theStrongestUnitsAHerosItemsLetHisFireballStrike } from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';
import type {
  ABattleSpellCastBeforeTheBattle,
  ACopyOfBattleMagic,
  AnEnemyUnitAsABattleSpellReadsIt,
} from '../../src/engine/rules/the-registry-of-content-effects.ts';

const COPIES: readonly ACopyOfBattleMagic[] = ['between heroes', 'a hero against the guards', "the guards' commander"];

/** An enemy unit of the base strength given, and nothing else. */
const aUnit = (baseStrength: number, more: Partial<AnEnemyUnitAsABattleSpellReadsIt> = {}) => ({
  type: 'Men-at-Arms',
  isSkeletal: false,
  baseStrength,
  isAMissileUnit: false,
  ...more,
});

/** A cast by the copy given, on the field given (no enemy commander, a level of 3, on land, no item). */
function aCast(theCopy: ACopyOfBattleMagic, more: Partial<ABattleSpellCastBeforeTheBattle> = {}) {
  return {
    theCopy,
    theCastersLevel: 3,
    theEnemysUnits: [],
    theEnemyCommander: null,
    atSea: false,
    theStrongestUnitsTheCastersItemsLetAFireballStrike: null,
    ...more,
  };
}
const aCommander = (tactical: number) => ({ tactical, theSkillACurseWithers: 'druid' });

describe('Fireball: the strongest enemy unit loses half its base strength, rounded', () => {
  const units = [aUnit(8), aUnit(12), aUnit(12), aUnit(5)];
  test.for(['between heroes', 'a hero against the guards'] as const)(
    '%s: the first of the strongest, or two with an Ember Rune',
    (copy) => {
      expect(whatABattleSpellDoesBeforeTheBattle('Fireball', aCast(copy, { theEnemysUnits: units }))).toMatchObject({
        kind: 'the strongest units lose strength',
        theUnitsStruck: [{ theUnit: 1, theStrengthItLoses: 6 }],
      });
      const two = aCast(copy, { theEnemysUnits: units, theStrongestUnitsTheCastersItemsLetAFireballStrike: 2 });
      expect(whatABattleSpellDoesBeforeTheBattle('Fireball', two)).toMatchObject({
        theUnitsStruck: [
          { theUnit: 1, theStrengthItLoses: 6 },
          { theUnit: 2, theStrengthItLoses: 6 },
        ],
      });
    },
  );
  test("the guards' commander: the first of the strongest, never two", () => {
    const cast = aCast("the guards' commander", {
      theEnemysUnits: units,
      theStrongestUnitsTheCastersItemsLetAFireballStrike: 2,
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Fireball', cast)).toEqual({
      kind: 'the strongest units lose strength',
      theUnitsStruck: [{ theUnit: 1, theStrengthItLoses: 6 }],
      theLine: "a fireball halves the attackers' strongest unit",
    });
  });
  test('half of 5 rounds to 3; no unit, nothing and no line', () => {
    expect(
      whatABattleSpellDoesBeforeTheBattle('Fireball', aCast('between heroes', { theEnemysUnits: [aUnit(5)] })),
    ).toEqual({
      kind: 'the strongest units lose strength',
      theUnitsStruck: [{ theUnit: 0, theStrengthItLoses: 3 }],
      theLine: "a fireball halves the enemy's strongest units",
    });
    for (const copy of COPIES)
      expect(whatABattleSpellDoesBeforeTheBattle('Fireball', aCast(copy))).toEqual({
        kind: 'nothing to strike',
        theLine: null,
      });
  });
});

describe('Lightning Bolt: as many units as the level, each loses 20% of its base strength, at least 1', () => {
  const eight = Array.from({ length: 8 }, (_, i) => aUnit([10, 2, 13, 6, 6, 6, 6, 6][i] ?? 6));
  test.for([
    ['between heroes', 5, 'a lightning bolt weakens enemy units'],
    ['a hero against the guards', 5, 'a lightning bolt sears the defending units'],
    ["the guards' commander", 7, 'a lightning bolt sears the attacking units'],
  ] as const)('%s: level 7 strikes %i', ([copy, howMany, theLine]) => {
    expect(
      whatABattleSpellDoesBeforeTheBattle('Lightning Bolt', aCast(copy, { theEnemysUnits: eight, theCastersLevel: 7 })),
    ).toEqual({
      kind: 'units drawn at random lose strength',
      howMany,
      theStrengthEachWouldLose: [2, 1, 3, 1, 1, 1, 1, 1],
      theLine,
    });
  });
  test('level 0 strikes one; never more than the units', () => {
    const one = aCast('between heroes', { theEnemysUnits: eight, theCastersLevel: 0 });
    expect(whatABattleSpellDoesBeforeTheBattle('Lightning Bolt', one)).toMatchObject({ howMany: 1 });
    const two = aCast("the guards' commander", { theEnemysUnits: [aUnit(6), aUnit(6)], theCastersLevel: 9 });
    expect(whatABattleSpellDoesBeforeTheBattle('Lightning Bolt', two)).toMatchObject({ howMany: 2 });
  });
});

describe("Telekinetic Storm: the enemy commander's Tactical ×0.5", () => {
  const SCATTERS = "a telekinetic storm scatters the enemy commander's formations";
  const cut = { kind: "the enemy commander's Tactical is cut", theMultiplier: 0.5, theLine: SCATTERS };
  test('between heroes: cut if he has Tactical and not at sea, else only marked; no commander, no line', () => {
    const storm = (more: Partial<ABattleSpellCastBeforeTheBattle>) =>
      whatABattleSpellDoesBeforeTheBattle('Telekinetic Storm', aCast('between heroes', more));
    const marked = {
      kind: "the enemy commander's Tactical is marked, with none to cut",
      theLine: 'a telekinetic storm finds no tactical command to disrupt',
    };
    expect(storm({ theEnemyCommander: aCommander(2) })).toEqual(cut);
    expect(storm({ theEnemyCommander: aCommander(0) })).toEqual(marked);
    expect(storm({ theEnemyCommander: aCommander(2), atSea: true })).toEqual(marked);
    expect(storm({})).toEqual({ kind: 'nothing to strike', theLine: null });
  });
  test('against guards, and by their commander: cut whatever his Tactical, at sea too', () => {
    for (const copy of ['a hero against the guards', "the guards' commander"] as const)
      expect(
        whatABattleSpellDoesBeforeTheBattle(
          'Telekinetic Storm',
          aCast(copy, { theEnemyCommander: aCommander(0), atSea: true }),
        ),
      ).toEqual(cut);
    expect(whatABattleSpellDoesBeforeTheBattle('Telekinetic Storm', aCast('a hero against the guards'))).toEqual({
      kind: 'nothing to strike',
      theLine: 'a telekinetic storm finds no command among leaderless defenders',
    });
  });
});

describe('Psychic Blast and Curse: a mark on the enemy commander', () => {
  test.for([
    ['between heroes', null, null],
    [
      'a hero against the guards',
      'a psychic blast finds no commander among the defenders',
      'a curse finds no commander among leaderless defenders',
    ],
    ["the guards' commander", null, null],
  ] as const)('%s', ([copy, noBlast, noCurse]) => {
    const withHim = aCast(copy, { theEnemyCommander: aCommander(3) });
    expect(whatABattleSpellDoesBeforeTheBattle('Psychic Blast', withHim)).toEqual({
      kind: "the enemy commander's Druid is negated",
      theLine: "a psychic blast severs the enemy commander's bond with his beasts",
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Curse', withHim)).toEqual({
      kind: "the enemy commander's skill is withered",
      theSkill: 'druid',
      theLine: "a curse withers the enemy commander's skill",
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Psychic Blast', aCast(copy))).toEqual({
      kind: 'nothing to strike',
      theLine: noBlast,
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Curse', aCast(copy))).toEqual({
      kind: 'nothing to strike',
      theLine: noCurse,
    });
  });
});

describe('Control Undead and Holy Symbol: the undead each reads; Spiritwrack: the missile units', () => {
  // living; risen; of the Undead race; of a type naming the dead (Control Undead's list); "Undead" in its type alone
  const field = [
    aUnit(12),
    aUnit(10, { isSkeletal: true }),
    aUnit(6, { race: 'Undead' }),
    aUnit(18, { type: 'Wraith Riders' }),
    aUnit(5, { type: 'Undead Host' }),
    aUnit(5, { isAMissileUnit: true }),
  ];
  test.for([
    [
      'between heroes',
      "control undead turns an enemy undead unit to the caster's side",
      'a holy symbol weakens enemy undead units',
      'spiritwrack halves enemy missile units',
    ],
    [
      'a hero against the guards',
      "control undead turns a defending undead unit to the attacker's side",
      'a holy symbol sears the defending undead',
      "spiritwrack halves the defenders' missile units",
    ],
    [
      "the guards' commander",
      "control undead turns an enemy undead unit to the caster's side",
      'a holy symbol sears the attacking undead',
      "spiritwrack halves the attackers' missile units",
    ],
  ] as const)('%s', ([copy, turns, sears, halves]) => {
    const cast = aCast(copy, { theEnemysUnits: field });
    expect(whatABattleSpellDoesBeforeTheBattle('Control Undead', cast)).toEqual({
      kind: 'an undead unit drawn at random defects',
      theUndead: [1, 2, 3],
      theLine: turns,
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Holy Symbol', cast)).toEqual({
      kind: 'the undead lose strength',
      theUnitsStruck: [
        { theUnit: 1, theStrengthItLoses: 3 },
        { theUnit: 3, theStrengthItLoses: 5 },
        { theUnit: 4, theStrengthItLoses: 2 },
      ],
      theLine: sears,
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Spiritwrack', cast)).toEqual({
      kind: 'the missile units lose strength',
      theUnitsStruck: [{ theUnit: 5, theStrengthItLoses: 3 }],
      theLine: halves,
    });
  });
  test.for([
    [
      'between heroes',
      'control undead finds no enemy undead to turn',
      'a holy symbol finds no enemy undead to smite',
      'spiritwrack finds no enemy missile troops',
    ],
    [
      'a hero against the guards',
      'control undead finds no undead among the defenders',
      'a holy symbol finds no undead among the defenders',
      'spiritwrack finds no missile troops among the defenders',
    ],
    [
      "the guards' commander",
      'control undead finds no undead among the attackers',
      'a holy symbol finds no undead among the attackers',
      'spiritwrack finds no missile troops among the attackers',
    ],
  ] as const)('%s, with none to strike', ([copy, noUndead, noHoly, noMissile]) => {
    const cast = aCast(copy, { theEnemysUnits: [aUnit(12)] });
    expect(whatABattleSpellDoesBeforeTheBattle('Control Undead', cast)).toEqual({
      kind: 'nothing to strike',
      theLine: noUndead,
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Holy Symbol', cast)).toEqual({
      kind: 'nothing to strike',
      theLine: noHoly,
    });
    expect(whatABattleSpellDoesBeforeTheBattle('Spiritwrack', cast)).toEqual({
      kind: 'nothing to strike',
      theLine: noMissile,
    });
  });
  test('a spell the registry holds no battle magic for does nothing', () => {
    expect(
      whatABattleSpellDoesBeforeTheBattle('Bless Province', aCast('between heroes', { theEnemysUnits: field })),
    ).toBeNull();
  });
});

describe('a battle spell has something to strike', () => {
  const commander = (
    more: Partial<{
      hisTacticalIsHalved: boolean;
      hisDruidIsNegated: boolean;
      tactical: number;
      druid: number;
      naval: number;
    }>,
  ) => ({
    hisTacticalIsHalved: false,
    hisDruidIsNegated: false,
    tactical: 0,
    druid: 0,
    naval: 0,
    ...more,
  });
  const living = { type: 'Men-at-Arms', isSkeletal: false, isAMissileUnit: false };
  const strikes = (spell: string, field: Parameters<typeof aBattleSpellHasSomethingToStrike>[1]) =>
    aBattleSpellHasSomethingToStrike(spell, field);
  test('Fireball, Lightning Bolt and a spell with no entry: any enemy unit', () => {
    for (const spell of ['Fireball', 'Lightning Bolt', 'Bless Province']) {
      expect(strikes(spell, { theEnemyCommander: null, theEnemysUnits: [living] }), spell).toBe(true);
      expect(strikes(spell, { theEnemyCommander: null, theEnemysUnits: [] }), spell).toBe(false);
    }
  });
  test('Telekinetic Storm and Psychic Blast: his skill, not cut already; Curse: any of three', () => {
    const on = (spell: string, more: Parameters<typeof commander>[0]) =>
      strikes(spell, { theEnemyCommander: commander(more), theEnemysUnits: [] });
    expect([
      on('Telekinetic Storm', { tactical: 1 }),
      on('Telekinetic Storm', { tactical: 1, hisTacticalIsHalved: true }),
      on('Telekinetic Storm', { druid: 3 }),
    ]).toEqual([true, false, false]);
    expect([
      on('Psychic Blast', { druid: 1 }),
      on('Psychic Blast', { druid: 1, hisDruidIsNegated: true }),
      on('Psychic Blast', { tactical: 3 }),
    ]).toEqual([true, false, false]);
    expect([
      on('Curse', { naval: 1 }),
      on('Curse', { druid: 1 }),
      on('Curse', { tactical: 1 }),
      on('Curse', {}),
    ]).toEqual([true, true, true, false]);
    expect(strikes('Curse', { theEnemyCommander: null, theEnemysUnits: [living] })).toBe(false);
  });
  test('Control Undead and Holy Symbol: risen dead, or "Undead" in a type; Spiritwrack: a missile unit', () => {
    for (const spell of ['Control Undead', 'Holy Symbol']) {
      expect(
        strikes(spell, { theEnemyCommander: null, theEnemysUnits: [{ ...living, isSkeletal: true }] }),
        spell,
      ).toBe(true);
      expect(
        strikes(spell, { theEnemyCommander: null, theEnemysUnits: [{ ...living, type: 'Undead Host' }] }),
        spell,
      ).toBe(true);
      expect(strikes(spell, { theEnemyCommander: null, theEnemysUnits: [living] }), spell).toBe(false);
    }
    expect(
      strikes('Spiritwrack', { theEnemyCommander: null, theEnemysUnits: [{ ...living, isAMissileUnit: true }] }),
    ).toBe(true);
    expect(strikes('Spiritwrack', { theEnemyCommander: null, theEnemysUnits: [living] })).toBe(false);
  });
});

test("the Ember Rune lets its bearer's Fireball strike two; no item, or another, none", () => {
  const theItem = (name: string) => {
    const item = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
    if (!item) throw new Error(`the content holds the ${name}`);
    return item;
  };
  expect(theStrongestUnitsAHerosItemsLetHisFireballStrike([theItem('Ember Rune')])).toBe(2);
  expect(theStrongestUnitsAHerosItemsLetHisFireballStrike([theItem('Orb of the Storm')])).toBeNull();
  expect(theStrongestUnitsAHerosItemsLetHisFireballStrike([])).toBeNull();
});
