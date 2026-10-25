// The lines of src/engine/battle/lines.ts that plan P1-10b4 changed to type them (statements that keep every value:
// P1-10b's Decision 2 and Choice 1) and that no game of the balance matrix reaches. The matrix proves the others (both
// sets, every realm's report identical); these are proved here, each on the value it had before (worked out by the
// file as it was, with its ts-nocheck line):
// - a ground the tables don't hold (the front's width, the width line's words): the matrix's provinces hold only the
//   six grounds the tables name;
// - Flanking Tactics' lines when the data file's row has no list of four;
// - a row with no unit on it (the grid's place, the grid print's short code), or one whose type no table names;
// - the grid print's side label when there is none;
// - a cell or a grid with a part missing (typeOfX, abilityHas), a facing table that is missing, and a shot at a unit
//   with no type (abilityBack);
// - battleFacedClauses on a grid with no units, or with holes and rows without a unit;
// - battleScout on exploration figures that are missing or not numbers;
// - battleLineTotal told a ground that is ''.
// Level 1 (unit): pure functions called directly on the engine's modules (plan P1-14a), with no turn played.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  BATTLE_FACING,
  BATTLE_LINE_MULTS_FLANK,
  abilityBack,
  abilityHas,
  backMult,
  battleFacedClauses,
  battleFrontWidth,
  battleGrid,
  battleGridLines,
  battleLineTotal,
  battleRole,
  battleScout,
  battleWidthChoices,
  battleWidthLine,
  faceMult,
  flankLineMults,
  rollBattleWidth,
  shortUnit,
  typeOfX,
} from '../../src/engine/battle/lines.ts';
import { DISC_BY_ID } from '../../src/engine/discoveries.ts';

/** A unit of a type, as the grid's rows hold it. */
const army = (type: string) => ({ type, quality: 'Average', race: 'Human', unitName: '' });
/** A placed cell, as battleGrid makes them. */
const cell = (type: string, role: 'fly' | 'cav' | 'arc' | 'foot', s = 4) => ({
  r: { a: army(type), base: s },
  role,
  s,
});

describe('a ground the tables do not hold reads the open plain', () => {
  test("the front's width: the plain's range, its middle and the scout's choices", () => {
    expect(battleFrontWidth('swamp')).toBe(7);
    expect(battleWidthChoices('swamp', 6)).toEqual([6, 7]);
    expect(battleWidthChoices('swamp', 8)).toEqual([7, 8]);
    for (let i = 0; i < 40; i++) expect([6, 7, 8]).toContain(rollBattleWidth('swamp'));
  });
  test("the width line names the ground as it is given, or 'ground' when it is ''", () => {
    expect(battleWidthLine('swamp', 5)).toEqual({
      kind: 'the ground allows a front of a width',
      groundWords: 'swamp',
      allowsWord: 'allows',
      frontWidth: 5,
    });
    expect(battleWidthLine('', 5)).toMatchObject({ groundWords: 'ground', allowsWord: 'allows' });
  });
});

describe("Flanking Tactics' lines", () => {
  test("the data file's four lines, or the fallback when its row has no list of four", () => {
    const sd09: unknown = Reflect.get(DISC_BY_ID, 'sd09');
    expect(flankLineMults()).toEqual([1, 0.5625, 0.3125, 0.1563]);
    try {
      Reflect.set(DISC_BY_ID, 'sd09', { effect: { lines: [1, 0.5, 0.25] } });
      expect(flankLineMults()).toBe(BATTLE_LINE_MULTS_FLANK);
      Reflect.set(DISC_BY_ID, 'sd09', { effect: {} });
      expect(flankLineMults()).toBe(BATTLE_LINE_MULTS_FLANK);
      Reflect.set(DISC_BY_ID, 'sd09', {});
      expect(flankLineMults()).toBe(BATTLE_LINE_MULTS_FLANK);
      Reflect.deleteProperty(DISC_BY_ID, 'sd09');
      expect(flankLineMults()).toBe(BATTLE_LINE_MULTS_FLANK);
    } finally {
      Reflect.set(DISC_BY_ID, 'sd09', sd09);
    }
  });
});

describe('a row with no unit on it, or a type no table names', () => {
  test("battleRole falls back on the row's own flag", () => {
    expect(battleRole({ fly: true, base: 3 }, 'plain')).toBe('fly');
    expect(battleRole({ fly: false, base: 3 }, 'plain')).toBe('foot');
    expect(battleRole({ a: null, fly: true }, 'plain')).toBe('fly');
    expect(battleRole(null, 'plain')).toBe('foot');
    expect(battleRole(undefined, 'sea')).toBe('foot');
  });
  test("shortUnit reads the row's name, then 'unit'; a type no table names gives its first five letters", () => {
    expect(shortUnit({ name: 'Wild Hunt' })).toBe('WildH');
    expect(shortUnit({ a: { ...army(''), type: '' }, name: 'Grey Company' })).toBe('GreyC');
    expect(shortUnit({ name: '' })).toBe('unit');
    expect(shortUnit({})).toBe('unit');
    expect(shortUnit(null)).toBe('unit');
    expect(shortUnit({ a: army('Bog-Wraith Host') })).toBe('BogWr');
    expect(shortUnit({ a: army('Gilded Lances'), name: 'Wild Hunt' })).toBe('Gild');
  });
  test('a grid of rows with no unit places them by their flag, and prints them by name', () => {
    const g = battleGrid([{ base: 5, name: 'Wild Hunt', fly: true }, { base: 3 }, null], 6, 'plain', {});
    expect(g.fly.map((x) => x.s)).toEqual([5]);
    expect(g.front.filter(Boolean).map((x) => x?.s)).toEqual([3]);
    expect(battleGridLines('Aldric', g, false)).toEqual([
      {
        kind: "a side's front line in the battle grid",
        sideLabel: 'Aldric  ',
        frontLineCells: '·     ·     unit  ·     ·     ·    ',
        wordsIfFlanksAirOrReserve: ' air: WildH',
      },
    ]);
  });
});

describe("the grid print's side label", () => {
  test('its first word, eight wide; none when there is no label', () => {
    const g = battleGrid([{ a: army('Men-at-Arms'), base: 4 }], 2, 'plain', {});
    const label = (l: string | null | undefined) => battleGridLines(l, g, true)[0];
    expect(label(null)).toMatchObject({ sideLabel: '        ' });
    expect(label(undefined)).toMatchObject({ sideLabel: '        ' });
    expect(label('')).toMatchObject({ sideLabel: '        ' });
    expect(label('Sir Aldric the Bold')).toMatchObject({ sideLabel: 'Sir     ' });
    expect(label('  Gorbash')).toMatchObject({ sideLabel: '        ' });
    expect(label('Bartholomew-of-the-Marsh')).toMatchObject({ sideLabel: 'Bartholo' });
  });
});

describe('a cell or a grid with a part missing, and a facing table that is missing', () => {
  test('typeOfX gives no type for an empty place, a cell with no row or a row with no unit', () => {
    expect(typeOfX(null)).toBeFalsy();
    expect(typeOfX(undefined)).toBeFalsy();
    expect(typeOfX({})).toBeFalsy();
    expect(typeOfX({ r: null })).toBeFalsy();
    expect(typeOfX({ r: { a: null } })).toBeFalsy();
    expect(typeOfX({ r: { a: {} } })).toBeFalsy();
    expect(typeOfX(cell('Stone Giants', 'foot'))).toBe('Stone Giants');
  });
  test('abilityHas reads the parts a grid holds', () => {
    expect(abilityHas(null, 'Wyvern Riders')).toBe(false);
    expect(abilityHas({}, 'Wyvern Riders')).toBe(false);
    expect(abilityHas({ fly: [cell('Wyvern Riders', 'fly')] }, 'Wyvern Riders')).toBe(true);
    expect(abilityHas({ front: [null, cell('Men-at-Arms', 'foot'), undefined] }, 'Men-at-Arms')).toBe(true);
    expect(abilityHas({ front: [null], second: [], reserve: [cell('Goblin Horde', 'foot')] }, 'Men-at-Arms')).toBe(
      false,
    );
  });
  test('faceMult and backMult read ×1 where the table names nothing', () => {
    expect(faceMult(null, 'cav', 'arc')).toBe(1);
    expect(faceMult(undefined, 'cav', 'arc')).toBe(1);
    expect(faceMult({}, 'cav', 'arc')).toBe(1);
    expect(faceMult(BATTLE_FACING.front, 'cav', 'arc')).toBe(1.25);
    expect(faceMult(BATTLE_FACING.front, 'fly', 'arc')).toBe(1);
    expect(backMult('fly')).toBe(1);
    expect(backMult('cav')).toBe(0.75);
  });
  test('a shot at a unit with no type takes no Armour-Piercing', () => {
    const bows = cell('Ironwood Crossbows', 'arc');
    expect(abilityBack(bows, { r: {}, role: 'foot', s: 4 })).toEqual({ m: 1.25, why: '' });
    expect(abilityBack(bows, { r: { a: null }, role: 'cav', s: 4 })).toEqual({ m: 0.75, why: '' });
    expect(abilityBack(bows, cell('Stone Giants', 'foot'))).toEqual({ m: 1.25 * 1.25, why: ', Armour-Piercing' });
  });
});

describe('battleFacedClauses on a grid with no units, holes, or rows without a unit', () => {
  test('no grid, or no list of units, gives an empty map', () => {
    expect(battleFacedClauses(null, 'Gorbash').size).toBe(0);
    expect(battleFacedClauses({}, 'Gorbash').size).toBe(0);
    expect(battleFacedClauses({ units: null }, 'Gorbash').size).toBe(0);
  });
  test('a hole, a row with no unit and a facing with no enemy unit are read as they always were', () => {
    const a1 = army('Men-at-Arms'),
      a2 = army('Yeoman Longbows'),
      a3 = army('Free Lances');
    const clauses = battleFacedClauses(
      {
        units: [
          null,
          undefined,
          { row: { base: 3 }, place: 'front', col: 0, mult: 1, why: '' },
          {
            row: { a: a1, _faced: { m: 1, kind: 'faces', vs: { base: 2 }, why: 'MaA v ·' } },
            place: 'front',
            col: 1,
            mult: 1,
            why: '',
          },
          {
            row: { a: a2, _faced: { m: 1, kind: 'even', vs: null, why: '' } },
            place: 'second',
            col: 1,
            mult: 1,
            why: '',
          },
          { row: { a: a3 }, place: 'flank', col: 0, mult: 1, why: '' },
        ],
      },
      null,
    );
    expect([...clauses.values()]).toEqual(['with nobody opposite', 'in the second line', 'with nobody opposite']);
    expect([...clauses.keys()]).toEqual([a1, a2, a3]);
  });
});

describe('battleScout on exploration figures that are missing or not numbers', () => {
  test('a missing or unreadable figure counts as none; ties go to the defender', () => {
    expect(battleScout(null, undefined)).toBe('def');
    expect(battleScout(Number.NaN, 0)).toBe('def');
    expect(battleScout(1, Number.NaN)).toBe('atk');
    expect(battleScout(undefined, null)).toBe('def');
    expect(battleScout(30, 30)).toBe('def');
  });
});

describe("battleLineTotal told a ground that is ''", () => {
  test('it scores as no ground at all, not as open ground', () => {
    const rows = [
      { a: army('Free Lances'), base: 5 },
      { a: army('Gilded Lances'), base: 6 },
      { a: army('Men-at-Arms'), base: 4 },
    ];
    expect(battleLineTotal(rows, 1, false, { terrain: '', tac: 2 })).toBe(battleLineTotal(rows, 1, false, { tac: 2 }));
    expect(battleLineTotal(rows, 1, false, { terrain: '', tac: 2 })).not.toBe(
      battleLineTotal(rows, 1, false, { terrain: 'plain', tac: 2 }),
    );
  });
});
