// The two casting limits (plan P1-11a1: src/engine/rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts),
// called directly: the action spells of one school a hero may cast in a turn, and the combat spells of one school he
// may cast in one personal combat, by his level in the school. Every level the callers can hand them, from below 0 to
// past 9 (a bot's plan asks before it checks the hero has the school at all). And the one rule with the Warlock's
// extra cast (R-123, P1-23s): one more in his best school, the one his trained level is highest in (each tied school),
// and the Warlock title's measure. The file imports only the content, so the test imports it as it is, with no engine
// loaded. The whole-turn cases (lib/cast-spell-order-cases.ts, "the casting limits,
// at each level") show the Cast Spell order and personal combat read these limits.
// Level 1 (unit): two functions of a number.
import { expect, test } from 'vitest';
import {
  actionSpellsAHeroMayCastInASchoolEachTurn,
  actionSpellsAllowedPerSchoolEachTurn,
  combatSpellsAllowedPerSchoolEachFight,
  theHighestLevelAHeroHasTrainedInAMagicSchool,
} from '../../src/engine/rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';

const LEVELS = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const table = (limit: (level: number) => number) => Object.fromEntries(LEVELS.map((level) => [level, limit(level)]));

test('action spells a turn: 1 up to level 2, 2 at level 3, 3 from level 4', () => {
  expect(table(actionSpellsAllowedPerSchoolEachTurn)).toEqual({
    '-1': 1,
    0: 1,
    1: 1,
    2: 1,
    3: 2,
    4: 3,
    5: 3,
    6: 3,
    7: 3,
    8: 3,
    9: 3,
    10: 3,
  });
});

test('the Warlock casts one more spell of his best school a turn (R-123), and only he, and only there', () => {
  const mage = { skills: { elemental: 4, white: 2 } };
  expect(actionSpellsAHeroMayCastInASchoolEachTurn(mage, 'elemental', 4, true)).toBe(4);
  expect(actionSpellsAHeroMayCastInASchoolEachTurn(mage, 'elemental', 4, false)).toBe(3);
  expect(actionSpellsAHeroMayCastInASchoolEachTurn(mage, 'white', 2, true)).toBe(1);
  // the effective level sets the limit; the trained level picks his best school (an item's +1 White doesn't)
  expect(actionSpellsAHeroMayCastInASchoolEachTurn(mage, 'white', 4, true)).toBe(3);
  expect(actionSpellsAHeroMayCastInASchoolEachTurn(mage, 'elemental', 2, true)).toBe(2);
  // each school tied for his best counts; a school he hasn't trained is his best only when he has trained none
  const tied = { skills: { psychic: 3, necromancy: 3, illusory: 1 } };
  expect(
    ['psychic', 'necromancy', 'illusory'].map((s) => actionSpellsAHeroMayCastInASchoolEachTurn(tied, s, 3, true)),
  ).toEqual([3, 3, 2]);
  expect(actionSpellsAHeroMayCastInASchoolEachTurn({ skills: {} }, 'white', 1, true)).toBe(2);
  expect(actionSpellsAHeroMayCastInASchoolEachTurn(null, 'white', 0, true)).toBe(2);
  // trained levels are read as the engine's skillLevel reads them: 0 to 9, a missing or broken one as 0
  expect(theHighestLevelAHeroHasTrainedInAMagicSchool({ skills: { white: 12, psychic: -2 } })).toBe(9);
  expect(theHighestLevelAHeroHasTrainedInAMagicSchool({ skills: { melee: 7, sage: 6 } })).toBe(0);
  expect(theHighestLevelAHeroHasTrainedInAMagicSchool({ skills: { white: Number.NaN, elemental: 5 } })).toBe(5);
  expect(actionSpellsAHeroMayCastInASchoolEachTurn({ skills: { white: 12, psychic: 9 } }, 'psychic', 5, true)).toBe(4);
  expect(actionSpellsAHeroMayCastInASchoolEachTurn({ skills: { white: -2 } }, 'white', 1, true)).toBe(2);
});

test('combat spells a fight: 1 up to level 1, 2 from level 2', () => {
  expect(table(combatSpellsAllowedPerSchoolEachFight)).toEqual({
    '-1': 1,
    0: 1,
    1: 1,
    2: 2,
    3: 2,
    4: 2,
    5: 2,
    6: 2,
    7: 2,
    8: 2,
    9: 2,
    10: 2,
  });
});
