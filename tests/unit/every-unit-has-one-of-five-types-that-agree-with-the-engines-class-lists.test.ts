// 2026-10-11 (the maintainer, the army roster work): unit types. Every army unit has one of five types (infantry,
// ranged, cavalry, flyer, naval) in the shared table KC_UNIT_TYPE (src/content/kingdoms-call-data.ts). The engine's
// rules still run on the KC_UNIT_CLASS lists (their order is data); this table is the words the portals, rulebooks
// and reports use, and the battle line builds on it.
//   1. KC_UNIT_TYPE is not empty, and every value is one of the five types.
//   2. Every unit with a base strength (KC_UNIT_BASE_STR: humanoid, fleet, primal, elemental) has a type.
//   3. The table agrees with the class lists: cavalry and 'cavalry', sea and 'naval', aerial and 'flyer', missile and
//      'ranged' both ways; garrison is 'infantry'. (Until the army roster of 2026-10-11 the Goblin Horde was the one
//      exception: infantry that threw spears in the archery step. The spears are retired.)
//   4. On both booted pages, unitTypeOf answers 'infantry' for a type it has never heard of (the page test below).
//
// Level 1 (unit): the data file's tables, imported (tests/lib/the-whole-engine.ts first, as every test on the engine's
// modules). Not lower: the agreement between the type table and the class lists is a property of the data, not of any
// one line of text.
//
// Until plan P1-14z this was tests/unit-types.test.js, which read the data file in a vm and called unitTypeOf on the
// booted GM and player pages. Its table checks are here, as they were ("KC_UNIT_TYPE is declared" is the import); its
// checks on the booted pages (4 above, and each page booting) stay page checks, in
// tests/page/the-gm-and-player-pages-type-druid-strike-and-home-roster-rules-answer-as-the-rosters-decide.test.ts,
// which says why.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { KC_UNIT_BASE_STR, KC_UNIT_CLASS, KC_UNIT_TYPE } from '../../src/content/kingdoms-call-data.ts';

const THE_FIVE_TYPES = ['infantry', 'ranged', 'cavalry', 'flyer', 'naval'];
const THE_TYPE_OF: Readonly<Record<string, string | undefined>> = KC_UNIT_TYPE;
const theUnitsOfType = (type: string) => Object.keys(THE_TYPE_OF).filter((unit) => THE_TYPE_OF[unit] === type);

describe('the data file', () => {
  test('KC_UNIT_TYPE is not empty', () => {
    expect(Object.keys(THE_TYPE_OF).length).toBeGreaterThan(0);
  });

  test('KC_UNIT_BASE_STR and KC_UNIT_CLASS were read (not empty)', () => {
    expect(Object.keys(KC_UNIT_BASE_STR).length).toBeGreaterThan(20);
    expect(KC_UNIT_CLASS.cavalry.length).toBeGreaterThan(0);
  });

  test('every type is one of the five', () => {
    const notOneOfTheFive = Object.entries(THE_TYPE_OF)
      .filter(([, type]) => type === undefined || !THE_FIVE_TYPES.includes(type))
      .map(([unit, type]) => `${unit}: ${String(type)}`);
    expect(notOneOfTheFive).toEqual([]);
  });

  test('every unit in KC_UNIT_BASE_STR has a type', () => {
    expect(Object.keys(KC_UNIT_BASE_STR).filter((unit) => !THE_TYPE_OF[unit])).toEqual([]);
  });
});

describe.each([
  { list: 'cavalry', units: KC_UNIT_CLASS.cavalry, type: 'cavalry' },
  { list: 'sea', units: KC_UNIT_CLASS.sea, type: 'naval' },
  { list: 'aerial', units: KC_UNIT_CLASS.aerial, type: 'flyer' },
  { list: 'missile', units: KC_UNIT_CLASS.missile, type: 'ranged' },
])('KC_UNIT_CLASS.$list and the type $type', ({ units, type }) => {
  test(`the list's units are all '${type}'`, () => {
    expect(units.filter((unit) => THE_TYPE_OF[unit] !== type)).toEqual([]);
  });

  test(`every '${type}' unit is in the list`, () => {
    const inTheList = new Set<string>(units);
    expect(theUnitsOfType(type).filter((unit) => !inTheList.has(unit))).toEqual([]);
  });
});

test("KC_UNIT_CLASS.garrison's units are all 'infantry'", () => {
  expect(KC_UNIT_CLASS.garrison.filter((unit) => THE_TYPE_OF[unit] !== 'infantry')).toEqual([]);
});

test('Goblin Horde is plain infantry (its thrown spears were retired with the army roster, 2026-10-11)', () => {
  expect(THE_TYPE_OF['Goblin Horde']).toBe('infantry');
  expect(KC_UNIT_CLASS.missile).not.toContain('Goblin Horde');
});
