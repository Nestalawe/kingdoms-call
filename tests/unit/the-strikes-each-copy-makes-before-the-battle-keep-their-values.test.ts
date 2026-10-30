// The strikes each copy makes before the battle keep their values (plan P1-19's spells family, row P1-19v). A unit's
// strike before an army battle is written in three copies (a hero's units' between two heroes' hosts, a hero's units'
// against a province's neutral guards, the guards' own units' against him); what it may do is the spells' registry's
// effect at "strength: a unit strikes before the battle", and what a commander's items add to its chance the items'
// registry's "strength: a commander's items add to a strike's chance" (the totems). This reads them through their
// runners: each unit's strikes from the content's tables (a winged rider's first, else a beast's that deal damage),
// whom each strikes and its damage range, the chance (a flying unit's one in two whatever the Druid; any other's 30%
// and 10% a Druid level, with what the items add, to 90%), the items asked only when the chance counts them, the line
// each copy writes, and a winged rider's quiet miss. And primalStrikeChance (which the battles asked until P1-19v, and
// the GM page and the tests still call) with each totem carried: no game of the matrix meets one (P1-19's scoping).
// Level 1 (unit): the effects and runners are plain functions, called directly. Not lower: the values are what the
// code computes, which a syntax tree can't evaluate. It reads the registry's runner of the strikes, which the code
// before P1-19v doesn't have; the totems' cases call primalStrikeChance alone, so they pass before P1-19v as after.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { primalStrikeChance } from '../../src/engine/chances-and-lair-grades.ts';
import { whatAUnitsStrikeMayDoBeforeTheBattle } from '../../src/engine/rules/the-registry-of-spell-effects.ts';
import type {
  ACopyOfThePreBattleStrikes,
  AUnitAboutToStrikeBeforeTheBattle,
} from '../../src/engine/rules/the-registry-of-content-effects.ts';
import type { Character } from '../../src/schemas/saved-game-state.ts';

const COPIES: readonly ACopyOfThePreBattleStrikes[] = [
  'between heroes',
  "a hero's units against the guards",
  "the guards' units against a hero",
];

/** A unit of the type given about to strike, in the copy given, its commander of Druid 2 whose items add 5, with a
 *  unit on the other side. */
const aUnit = (
  theCopy: ACopyOfThePreBattleStrikes,
  theUnitsType: string | undefined,
  more: Partial<AUnitAboutToStrikeBeforeTheBattle> = {},
): AUnitAboutToStrikeBeforeTheBattle => ({
  theCopy,
  theUnitsType,
  theEnemyHasAUnit: true,
  theDruidLevel: 2,
  whatTheCommandersItemsAdd: () => 5,
  ...more,
});

describe('a beast strikes with its own strikes, at 30% and 10% a Druid level with what the items add, to 90%', () => {
  test.for(COPIES)('%s: the Stone Giants strike one enemy unit drawn at random, 4 to 7', (copy) => {
    const may = whatAUnitsStrikeMayDoBeforeTheBattle(aUnit(copy, 'Stone Giants'));
    expect(may).toMatchObject({
      theStrikes: [
        {
          name: 'Boulder Barrage',
          flavour: 'Giants heave boulders that shatter a formation before contact!',
          theBlow: { reaches: 'one enemy unit drawn at random', theDamage: [4, 7] },
        },
      ],
      theChance: 55,
      theLineIfItMisses: "a unit's power gathers but never strikes",
    });
  });
  test.for(COPIES)('%s: the Forest Ents strike every enemy unit, 2 to 4', (copy) => {
    expect(whatAUnitsStrikeMayDoBeforeTheBattle(aUnit(copy, 'Forest Ents'))?.theStrikes).toMatchObject([
      { name: 'Choking Spores', theBlow: { reaches: 'every enemy unit', theDamage: [2, 4] } },
    ]);
  });
  test('the chance is capped at 90%, and a Druid of 0 with no items is 30%', () => {
    const chance = (theDruidLevel: number, added: number) =>
      whatAUnitsStrikeMayDoBeforeTheBattle(
        aUnit('between heroes', 'Stone Giants', { theDruidLevel, whatTheCommandersItemsAdd: () => added }),
      )?.theChance;
    expect(chance(0, 0)).toBe(30);
    expect(chance(5, 0)).toBe(80);
    expect(chance(5, 25)).toBe(90);
    expect(chance(9, 0)).toBe(90);
  });
});

describe('a winged rider strikes one time in two, whatever the Druid, and misses quietly', () => {
  test.for(COPIES)('%s: the Wyvern Riders’ Acid Spit Volley, one enemy unit, 2 to 5', (copy) => {
    const may = whatAUnitsStrikeMayDoBeforeTheBattle(
      aUnit(copy, 'Wyvern Riders', {
        theDruidLevel: 5,
        whatTheCommandersItemsAdd: () => {
          throw new Error('a flying unit’s chance counts no item');
        },
      }),
    );
    expect(may).toMatchObject({
      theStrikes: [
        { name: 'Acid Spit Volley', theBlow: { reaches: 'one enemy unit drawn at random', theDamage: [2, 5] } },
      ],
      theChance: 50,
      theLineIfItMisses: null,
    });
  });
  test('the Noble Griffons’ Screech Dive, 2 to 4', () => {
    expect(whatAUnitsStrikeMayDoBeforeTheBattle(aUnit('between heroes', 'Noble Griffons'))).toMatchObject({
      theStrikes: [{ name: 'Screech Dive', theBlow: { theDamage: [2, 4] } }],
      theChance: 50,
    });
  });
});

describe('the line each copy writes', () => {
  test.for([
    [
      'between heroes',
      'a unit uses its power in battle',
      "a unit's power hits all enemy units",
      "a unit's power hits one enemy unit",
    ],
    [
      "a hero's units against the guards",
      'a unit uses its power in battle',
      "a unit's power hits every defending unit",
      "a unit's power hits one unit of the other side",
    ],
    [
      "the guards' units against a hero",
      'a defending unit uses its power in battle',
      "a unit's power hits every attacking unit",
      "a unit's power hits one unit of the other side",
    ],
  ] as const)('%s: "%s", then "%s" or "%s"', ([copy, strikes, every, one]) => {
    expect(whatAUnitsStrikeMayDoBeforeTheBattle(aUnit(copy, 'Forest Ents'))).toMatchObject({
      theLineIfItStrikes: strikes,
      theStrikes: [{ theBlow: { theLine: every } }],
    });
    expect(whatAUnitsStrikeMayDoBeforeTheBattle(aUnit(copy, 'Stone Giants'))?.theStrikes).toMatchObject([
      { theBlow: { theLine: one } },
    ]);
  });
});

describe('no strike: a unit with none, of no type, or with no enemy unit to strike', () => {
  const asked = () => {
    throw new Error('no strike counts the items');
  };
  test.for(COPIES)('%s', (copy) => {
    expect(whatAUnitsStrikeMayDoBeforeTheBattle(aUnit(copy, 'Men-at-Arms', { whatTheCommandersItemsAdd: asked }))).toBe(
      null,
    );
    expect(whatAUnitsStrikeMayDoBeforeTheBattle(aUnit(copy, 'Great Bears', { whatTheCommandersItemsAdd: asked }))).toBe(
      null,
    );
    expect(whatAUnitsStrikeMayDoBeforeTheBattle(aUnit(copy, undefined, { whatTheCommandersItemsAdd: asked }))).toBe(
      null,
    );
    expect(
      whatAUnitsStrikeMayDoBeforeTheBattle(
        aUnit(copy, 'Stone Giants', { theEnemyHasAUnit: false, whatTheCommandersItemsAdd: asked }),
      ),
    ).toBe(null);
  });
});

/** A made-up hero of realm 0 carrying, worn, the content's items named. */
const aHeroCarrying = (...names: string[]) =>
  ({
    id: 41,
    name: 'Made-up Hero',
    player: 0,
    location: 3,
    alive: true,
    race: 'Human',
    alignment: 'Neutral',
    skills: {},
    items: names.map((name, i) => {
      const item = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
      if (!item) throw new Error(`no item named ${name} in play`);
      return { ...item, id: i + 1, equipped: true };
    }),
  }) as unknown as Character;

describe('the totems add to the chance of the strikes of the units their bearer leads (primalStrikeChance)', () => {
  test('the Totem of the Thunderhead adds 25, the Beastcaller’s Warhorn 15 (its Druid +1 aside), both 40, to 90%', () => {
    expect(primalStrikeChance(2, aHeroCarrying('Totem of the Thunderhead'), 'Stone Giants')).toBe(75);
    expect(primalStrikeChance(2, aHeroCarrying("Beastcaller's Warhorn"), 'Stone Giants')).toBe(65);
    expect(
      primalStrikeChance(1, aHeroCarrying('Totem of the Thunderhead', "Beastcaller's Warhorn"), 'Stone Giants'),
    ).toBe(80);
    expect(
      primalStrikeChance(3, aHeroCarrying('Totem of the Thunderhead', "Beastcaller's Warhorn"), 'Stone Giants'),
    ).toBe(90);
    expect(primalStrikeChance(2, aHeroCarrying(), 'Stone Giants')).toBe(50);
  });
  test('a winged rider’s strike is one in two whatever totem its commander carries', () => {
    expect(primalStrikeChance(2, aHeroCarrying('Totem of the Thunderhead'), 'Wyvern Riders')).toBe(50);
  });
});
