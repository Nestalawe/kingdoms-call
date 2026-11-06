// The level a hero's skill counts at, and his items each name once, on plain values (plan P1-11e32 moved them out of
// skillBonusBreakdown, so the order form's effMagicLvl can later ask the turn's own): his trained level counts to 5
// (to 9 for Druid); his items' bonus (each name once), a Crown of Command's aura and a Curse's cut add to it, from 0 to
// 5, or to 9 for melee, archery, the five schools and Druid.
//
// Level 1 (unit): the functions and numbers of src/engine/rules-on-plain-values/the-level-a-heros-skill-counts-at-and-
// his-items-each-name-once.ts on made-up levels and items. A lower level can't run a function. A fault planted in a
// shared function moves every caller at once (the turn and the report alike), so these cases pin its answers;
// skillBonusBreakdown's own cases check the engine's call.
import { describe, expect, test } from 'vitest';
import {
  FULL_RANGE_SKILLS,
  ITEM_UNCAPPED_SKILLS,
  SKILL_BENEFIT_CAP,
  SKILL_MAX,
  dedupeItemsByName,
  theLevelAHerosSkillCountsAt,
  theTrainedLevelOfAHerosSkillThatCounts,
} from '../../src/engine/rules-on-plain-values/the-level-a-heros-skill-counts-at-and-his-items-each-name-once.ts';
import * as theArmyTables from '../../src/engine/army-tables.ts';

describe("the numbers a skill's level is counted by", () => {
  test('training counts to 5; a skill reaches 9 at most', () => {
    expect([SKILL_BENEFIT_CAP, SKILL_MAX]).toEqual([5, 9]);
  });
  test('the bonuses of melee, archery and the five schools stack past 5; the trained levels of Druid count to 9', () => {
    expect([...ITEM_UNCAPPED_SKILLS]).toEqual([
      'melee',
      'archery',
      'white',
      'psychic',
      'illusory',
      'elemental',
      'necromancy',
    ]);
    expect([...FULL_RANGE_SKILLS]).toEqual(['druid']);
  });
  test("the army tables re-export the same numbers (their callers' import is unchanged)", () => {
    expect(theArmyTables.SKILL_BENEFIT_CAP).toBe(SKILL_BENEFIT_CAP);
    expect(theArmyTables.SKILL_MAX).toBe(SKILL_MAX);
    expect(theArmyTables.ITEM_UNCAPPED_SKILLS).toBe(ITEM_UNCAPPED_SKILLS);
  });
});

describe("the share of a hero's trained level that counts", () => {
  test('from 0 to 5 for most skills, the five schools, melee and archery among them', () => {
    expect([-2, 0, 3, 5, 6, 9].map((l) => theTrainedLevelOfAHerosSkillThatCounts('tactical', l))).toEqual([
      0, 0, 3, 5, 5, 5,
    ]);
    expect([4, 5, 7, 9].map((l) => theTrainedLevelOfAHerosSkillThatCounts('melee', l))).toEqual([4, 5, 5, 5]);
    expect([4, 6, 9].map((l) => theTrainedLevelOfAHerosSkillThatCounts('white', l))).toEqual([4, 5, 5]);
  });
  test('from 0 to 9 for Druid', () => {
    expect([-1, 0, 5, 6, 9, 11].map((l) => theTrainedLevelOfAHerosSkillThatCounts('druid', l))).toEqual([
      0, 0, 5, 6, 9, 9,
    ]);
  });
});

describe("the level a hero's skill counts at", () => {
  test('a skill whose bonuses stop at 5: a +2 Tome on Tactical 5 is still 5; on Tactical 2 it is 4', () => {
    expect(theLevelAHerosSkillCountsAt('tactical', 5, 2, 0, 0)).toBe(5);
    expect(theLevelAHerosSkillCountsAt('tactical', 9, 0, 0, 0)).toBe(5);
    expect(theLevelAHerosSkillCountsAt('tactical', 2, 2, 0, 0)).toBe(4);
    expect(theLevelAHerosSkillCountsAt('spy', 3, 1, 1, 0)).toBe(5);
  });
  test('melee, archery and the five schools: the bonuses stack on a trained 5, to 9', () => {
    expect(theLevelAHerosSkillCountsAt('melee', 5, 4, 0, 0)).toBe(9);
    expect(theLevelAHerosSkillCountsAt('melee', 9, 2, 0, 0)).toBe(7); // trained 9 counts as 5
    expect(theLevelAHerosSkillCountsAt('archery', 4, 3, 1, 0)).toBe(8);
    expect(theLevelAHerosSkillCountsAt('psychic', 2, 1, 0, 0)).toBe(3);
    expect(theLevelAHerosSkillCountsAt('necromancy', 5, 2, 1, 0)).toBe(8);
  });
  test('capped at 9, however many bonuses', () => {
    expect(theLevelAHerosSkillCountsAt('melee', 5, 3, 1, 0)).toBe(9);
    expect(theLevelAHerosSkillCountsAt('melee', 5, 6, 1, 0)).toBe(9);
    expect(theLevelAHerosSkillCountsAt('elemental', 8, 4, 2, 0)).toBe(9);
    expect(theLevelAHerosSkillCountsAt('druid', 9, 1, 1, 0)).toBe(9);
  });
  test('Druid: his trained levels past 5 count, and his bonuses stack on them, to 9', () => {
    expect(theLevelAHerosSkillCountsAt('druid', 7, 0, 0, 0)).toBe(7);
    expect(theLevelAHerosSkillCountsAt('druid', 7, 1, 0, 0)).toBe(8);
    expect(theLevelAHerosSkillCountsAt('druid', 6, 0, 1, -1)).toBe(6);
  });
  test("a Curse's cut takes from the level, never below 0; the aura and the items each add", () => {
    expect(theLevelAHerosSkillCountsAt('tactical', 3, 0, 0, -2)).toBe(1);
    expect(theLevelAHerosSkillCountsAt('tactical', 1, 0, 0, -3)).toBe(0);
    expect(theLevelAHerosSkillCountsAt('melee', 5, 2, 1, -1)).toBe(7);
    expect(theLevelAHerosSkillCountsAt('melee', 7, 0, 1, -2)).toBe(4); // trained 7 counts as 5, then +1 −2
    expect(theLevelAHerosSkillCountsAt('march', 0, 0, 1, 0)).toBe(1);
    expect(theLevelAHerosSkillCountsAt('march', 0, 2, 0, 0)).toBe(2);
    expect(theLevelAHerosSkillCountsAt('march', -1, 0, 0, 0)).toBe(0);
  });
});

describe("a hero's items, each name once", () => {
  test('two Dreamstones add once; the first of each name is kept, in order, gaps dropped', () => {
    const one = { name: 'Dreamstone', effect: { stat: 'psychic', bonus: 1 } };
    const two = { name: 'Dreamstone', effect: { stat: 'psychic', bonus: 2 } };
    const ring = { name: 'A Ring', effect: { stat: 'necromancy', bonus: 1 } };
    expect(dedupeItemsByName([one, null, ring, two, undefined])).toEqual([one, ring]);
    expect(dedupeItemsByName([two, one])).toEqual([two]);
    expect(dedupeItemsByName(undefined)).toEqual([]);
  });
  test('an item of no name is told by its effect; one of no effect by an empty one', () => {
    const a = { name: '', effect: { stat: 'spy', bonus: 1 } };
    const b = { effect: { stat: 'spy', bonus: 1 } };
    const c = { name: '', effect: { stat: 'spy', bonus: 2 } };
    expect(dedupeItemsByName([a, b, c])).toEqual([a, c]);
    expect(dedupeItemsByName([{ name: '' }, { effect: null }, { name: 'fx:{}' }])).toEqual([{ name: '' }]);
  });
});
