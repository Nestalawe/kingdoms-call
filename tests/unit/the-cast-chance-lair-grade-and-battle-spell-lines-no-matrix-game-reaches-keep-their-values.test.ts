// The cast chance, lair grade and battle spell lines no game of the balance matrix reaches keep their values (plan
// P1-10b15). The lines P1-10b15 changed to free chances-and-lair-grades.ts and magic/pre-battle-spell-choice.ts of the
// ts-nocheck line that no game reaches, or reaches only in part, give the value each gave before (worked out by the
// rules as the files had them, with their ts-nocheck line):
// - the primal strike's bonus: an item's `primalStrike` of its own (an older item's) and an effect naming the stat
//   both add; an item of neither, or an effect of no bonus, adds nothing; no Druid level counts as 0;
// - the cast chance: no options read as none; a spell worked from an item is at least level 3, at 95%; a guard given no
//   list of heroes casts at his own level (his own crown's aura comes only through the list);
// - the lairs' grades: a province of no features, a gap and a ritual site hold no lair; with no homes every lair is in
//   the home band (60 / 30 / 10 by lot); a lair of no clean distance falls to the end of the far country; a home whose
//   only lair is Legendary takes Weak from no donor; a home with no Weak lair takes it from the nearest Weak lair
//   beyond the home band; of two sea lairs Legendary by count in one province, the second (the seas' one Legendary
//   beast keeping the first) is kept by a sea beast of the nearest standing below;
// - the guardians' healing: no provinces, a gap, a province of no features, a gap among them and a guardian of no full
//   HP are passed over;
// - the battle spell's use and choice: no enemy units, a unit of no undead mark or of no type, no tactics, a gap among
//   them, and a school with no battle spells.
// Level 1 (unit): each is a function called directly on the engine's modules with a staged hero, world or force, the
// dice pinned with kcRng.use where a line draws them. A static check can't run them, and no game reaches these lines.
import '../lib/the-whole-engine.ts';
import { afterEach, describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { MONSTERS_P } from '../../src/content/kingdoms-call-data.ts';
import { SEA_GUARDIAN_NAMES } from '../../src/engine/names.ts';
import {
  assignLairGrades,
  castChanceFor,
  guardCastChance,
  healFeatureMonsters,
  primalStrikeChance,
} from '../../src/engine/chances-and-lair-grades.ts';
import { battleSpellUseful, pickBattleSpell } from '../../src/engine/magic/pre-battle-spell-choice.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character } from '../../src/schemas/saved-game-state.ts';

let restore: (() => number) | null = null;
/** The dice pinned at `value` for the rest of the test. */
const pinTheDice = (value: number) => {
  restore = kcRng.use(() => value);
};
afterEach(() => {
  if (restore) kcRng.use(restore);
  restore = null;
});

/** A made-up hero of realm 0 standing in province 3, of the skills and items given. */
const aHero = (skills: Record<string, number>, items: Record<string, unknown>[] = []) =>
  ({
    id: 41,
    name: 'Made-up Hero',
    player: 0,
    location: 3,
    alive: true,
    race: 'Human',
    alignment: 'Neutral',
    skills,
    items,
  }) as unknown as Character;
/** A made-up item, worn, of the fields given. */
const anItem = (fields: Record<string, unknown>) => ({ name: 'Made-up Charm', equipped: true, ...fields });

describe('the primal strike’s bonus', () => {
  test('an item’s own primalStrike and an effect naming the stat both add; neither, or no bonus, adds nothing', () => {
    const chance = (items: Record<string, unknown>[], druid: number | null = 2) =>
      primalStrikeChance(druid, aHero({}, items), 'Swordsmen');
    expect(chance([anItem({ effect: { stat: 'primalStrike', bonus: 10 } })])).toBe(60);
    expect(chance([anItem({ primalStrike: 5, effect: { stat: 'melee', bonus: 1 } })])).toBe(55);
    expect(chance([anItem({ effect: { stat: 'melee', bonus: 1 } })])).toBe(50);
    expect(chance([anItem({ effect: { stat: 'primalStrike' } })])).toBe(50);
    expect(chance([], null)).toBe(30);
  });
});

describe('the cast chance', () => {
  test('no options read as none: the school’s level, 30% and 10% a level', () => {
    expect(castChanceFor(aHero({ white: 2 }), 'white', null)).toEqual({
      level: 2,
      chance: 50,
      arcane: 0,
      l8: 0,
      disc: 0,
    });
  });
  test('a spell worked from an item is at least level 3, at 95%', () => {
    expect(castChanceFor(aHero({ white: 1 }), 'white', null, { itemCast: true })).toEqual({
      level: 3,
      chance: 95,
      reason: 'item',
    });
    expect(castChanceFor(aHero({ white: 5 }), 'white', null, { itemCast: true }).level).toBe(5);
  });
  test('a guard given no list of heroes casts at his own level; his crown’s aura comes only through the list', () => {
    const guard = aHero({ white: 2 }, [anItem({ name: 'Crown of Command', effect: { stat: 'aura', bonus: 1 } })]);
    expect(guardCastChance(guard, 'white', undefined)).toBe(50);
    expect(guardCastChance(guard, 'white', [guard])).toBe(60);
  });
});

/** A made-up lair, kept by a made-up guardian. */
const aLairsFeature = () => ({ name: 'Made-up Den', tier: 'Weak', monster: { name: 'Made-up Rat', power: 'Weak' } });
/** A made-up province on row 0 at column `col`, of the features given. */
const aProvince = (id: number, col: number, features: unknown[] | undefined, terrain = 'plains') => ({
  id,
  col,
  row: 0,
  terrain,
  ...(features === undefined ? {} : { features }),
});
type TheProvinces = Parameters<typeof assignLairGrades>[0];
/** The provinces given, graded (the map does not wrap), and each lair's grade, province by province. */
const graded = (provinces: ReturnType<typeof aProvince>[], homeIds: number[] | null, relics: number) => {
  assignLairGrades(provinces as unknown as TheProvinces, homeIds, 0, 1, relics);
  return provinces.map((p) => (p.features ?? []).map((f) => (f && typeof f === 'object' && 'tier' in f ? f.tier : f)));
};
const count = (grades: unknown[][], grade: string) => grades.flat().filter((g) => g === grade).length;

describe('the lairs’ grades', () => {
  test('a province of no features, a gap and a ritual site hold no lair; with no homes every lair is in the home band', () => {
    pinTheDice(0);
    const provinces = [
      aProvince(0, 0, undefined),
      aProvince(1, 1, [null, { name: 'Made-up Circle', ritualSite: true }]),
      ...Array.from({ length: 10 }, (_, i) => aProvince(i + 2, i + 2, [aLairsFeature()])),
    ];
    const grades = graded(provinces, null, 0);
    expect(grades.slice(0, 2)).toEqual([[], [null, { name: 'Made-up Circle', ritualSite: true }]]);
    // ten lairs: 5 Weak, 4 Moderate and 1 Powerful in all, the home band taking 60 / 30 / 10 of them (6, 3, 1),
    // never more of a grade than the world has: 5 Weak, 3 Moderate, 2 Powerful
    expect([count(grades, 'Weak'), count(grades, 'Moderate'), count(grades, 'Powerful')]).toEqual([5, 3, 2]);
  });
  test('a lair of no clean distance from home falls to the end of the far country', () => {
    pinTheDice(0);
    const provinces = [aProvince(0, 0, []), aProvince(1, 5, [aLairsFeature()]), aProvince(2, NaN, [aLairsFeature()])];
    expect(graded(provinces, [0], 0)).toEqual([[], ['Weak'], ['Moderate']]);
  });
  test('a home whose only lair is Legendary by count takes Weak, with no donor', () => {
    pinTheDice(0);
    expect(graded([aProvince(0, 0, [aLairsFeature()])], [0], 1)).toEqual([['Weak']]);
  });
  test('a home with no Weak lair takes it from the nearest Weak lair beyond the home band', () => {
    pinTheDice(0);
    const provinces = [
      aProvince(0, 0, [aLairsFeature()]),
      aProvince(1, 1, [aLairsFeature()]),
      ...[5, 6, 7, 8].map((col, i) => aProvince(i + 2, col, [aLairsFeature()])),
    ];
    // the home band (both homes' lairs) by lot: one Weak, one Moderate; the far country: Weak, Weak, Moderate,
    // Powerful by distance; the home of the Moderate lair takes Weak from the nearest, at column 5
    expect(graded(provinces, [0, 1], 0)).toEqual([
      ['Weak'],
      ['Weak'],
      ['Moderate'],
      ['Weak'],
      ['Moderate'],
      ['Powerful'],
    ]);
  });
  test('of two sea lairs Legendary by count in one province, the second is kept by a Powerful sea beast', () => {
    pinTheDice(0);
    const theSeasLegendaryBeasts = MONSTERS_P.filter((m) => SEA_GUARDIAN_NAMES.has(m.name) && m.power === 'Legendary');
    const [first, second]: { tier: string; monster: { name: string; power: string } }[] = [
      aLairsFeature(),
      aLairsFeature(),
    ];
    if (!first || !second) throw new Error('two lairs');
    graded([aProvince(0, 0, [first, second], 'sea')], [], 2);
    const ownStanding = (name: string) => MONSTERS_P.find((m) => m.name === name)?.power;
    expect(theSeasLegendaryBeasts.map((m) => m.name)).toEqual([first.monster.name]);
    expect([SEA_GUARDIAN_NAMES.has(second.monster.name), ownStanding(second.monster.name)]).toEqual([true, 'Powerful']);
    expect([second.tier, second.monster.power]).toEqual(['Legendary', 'Legendary']);
  });
});

describe('the guardians’ healing', () => {
  test('no provinces, a gap, a province of no features, a gap among them and a guardian of no full HP are passed over', () => {
    expect(() => {
      healFeatureMonsters({ G: { world: {} } });
    }).not.toThrow();
    const healed = { hp: 3, _hpFull: 10 };
    const unknown = { hp: 3 };
    healFeatureMonsters({
      G: { world: { provinces: [null, {}, { features: [null, {}, { monster: healed }, { monster: unknown }] }] } },
    });
    expect([healed.hp, unknown.hp]).toEqual([10, 3]);
  });
});

/** The turn's context as the battle spell's choice reads it: the heroes, for an aura (none). */
const tc = { G: { characters: [] } } as unknown as TurnContext;

describe('the battle spell’s use and choice', () => {
  test('no enemy units: no spell that needs them is of use', () => {
    expect(battleSpellUseful(tc, 'Fireball', null, null)).toBe(false);
  });
  test('a unit of no undead mark, or of no type, is not undead; one marked risen is', () => {
    const undeadHere = (unit: { type: string; _isSkeletal?: boolean }) =>
      battleSpellUseful(tc, 'Control Undead', null, [unit]);
    expect([
      undeadHere({ type: 'Swordsmen' }),
      undeadHere({ type: '' }),
      undeadHere({ type: 'Swordsmen', _isSkeletal: true }),
    ]).toEqual([false, false, true]);
  });
  test('no tactics, a gap among them, or a school with no battle spells: no spell', () => {
    const caster = aHero({ elemental: 3, druid: 3 });
    const foes = [{ type: 'Swordsmen' }];
    expect(pickBattleSpell(tc, null, caster, null, foes)).toBe(null);
    expect(pickBattleSpell(tc, [null, undefined], caster, null, foes)).toBe(null);
    expect(pickBattleSpell(tc, ['CS:druid'], caster, null, foes)).toBe(null);
    expect(pickBattleSpell(tc, ['CA:Fireball'], caster, null, foes)).toEqual({
      spellName: 'Fireball',
      school: 'elemental',
    });
  });
});
