// The two casting limits (plan P1-11a1: src/engine/rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts),
// called directly: the action spells of one school a hero may cast in a turn, and the combat spells of one school he
// may cast in one personal combat, by his level in the school. Every level the callers can hand them, from below 0 to
// past 9 (a bot's plan asks before it checks the hero has the school at all). The file imports nothing, so the test
// imports it as it is, with no engine loaded. The whole-turn cases (lib/cast-spell-order-cases.ts, "the casting limits,
// at each level") show the Cast Spell order and personal combat read these limits.
// Level 1 (unit): two functions of a number.
import { expect, test } from 'vitest';
import {
  actionSpellsAllowedPerSchoolEachTurn,
  combatSpellsAllowedPerSchoolEachFight,
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
