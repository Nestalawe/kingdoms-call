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
// - battleFacedClauses on a grid with no units, or with holes and rows without a unit, and (since plan P1-12d28, which
//   hands the enemy's side as a record) an enemy company when no enemy side is handed: named alone;
// - battleScout on exploration figures that are missing or not numbers;
// - battleLineTotal told a ground that is ''.
// Level 1 (unit): pure functions called directly on the engine's modules (plan P1-14a), with no turn played. Since plan
// P1-12d4 the grid's lines and a unit's facing hold values, and the prose writes their words: each line's words are
// read through the words pass (theWordsOf), the same words as the fields held before.
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
  typeOfX,
} from '../../src/engine/battle/lines.ts';
import {
  shortUnit,
  theClauseOfWhomAUnitFaced,
  theWordsOfAnAbilityInTheLadder,
} from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
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
    expect(theWordsOf(battleWidthLine('swamp', 5))).toBe('📊 Battle lines — the swamp allows a front of 5.');
    expect(theWordsOf(battleWidthLine('', 5))).toBe('📊 Battle lines — the ground allows a front of 5.');
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
    expect(battleGridLines({ heroName: 'Aldric', leaderless: false }, g, false).map(theWordsOf)).toEqual([
      '📊 Aldric   1st │ ·     ·     unit  ·     ·     ·     │ air: WildH',
    ]);
  });
});

describe("the grid print's side label", () => {
  test('its first word, eight wide; none when there is no label', () => {
    const g = battleGrid([{ a: army('Men-at-Arms'), base: 4 }], 2, 'plain', {});
    /** The side's label in the words of its first grid line, "📊 <label> 1st │ …". */
    const label = (l: string | null | undefined) => {
      // the side a label names (plan P1-12d30: a record, whose label the prose writes), or none
      const line = battleGridLines(l == null ? l : { heroName: l, leaderless: false }, g, true)[0];
      return line ? /^📊 (.{8}) 1st │/u.exec(theWordsOf(line))?.[1] : undefined;
    };
    expect(label(null)).toBe('        ');
    expect(label(undefined)).toBe('        ');
    expect(label('')).toBe('        ');
    expect(label('Sir Aldric the Bold')).toBe('Sir     ');
    expect(label('  Gorbash')).toBe('        ');
    expect(label('Bartholomew-of-the-Marsh')).toBe('Bartholo');
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
    expect(abilityBack(bows, { r: {}, role: 'foot', s: 4 })).toEqual({ m: 1.25, abilities: [] });
    expect(abilityBack(bows, { r: { a: null }, role: 'cav', s: 4 })).toEqual({ m: 0.75, abilities: [] });
    const pierced = abilityBack(bows, cell('Stone Giants', 'foot'));
    expect(pierced.m).toBe(1.25 * 1.25);
    expect(pierced.abilities.map(theWordsOfAnAbilityInTheLadder)).toEqual(['Armour-Piercing']);
  });
});

describe('battleFacedClauses on a grid with no units, holes, or rows without a unit', () => {
  test('no grid, or no list of units, gives an empty map', () => {
    /** The enemy side, as the battle hands it (a side's record since plan P1-12d28). */
    const gorbash = { heroName: 'Gorbash', leaderless: false };
    expect(battleFacedClauses(null, gorbash).size).toBe(0);
    expect(battleFacedClauses({}, gorbash).size).toBe(0);
    expect(battleFacedClauses({ units: null }, gorbash).size).toBe(0);
  });
  test('a hole, a row with no unit and a facing with no enemy unit are read as they always were', () => {
    const a1 = army('Men-at-Arms'),
      a2 = army('Yeoman Longbows'),
      a3 = army('Free Lances');
    /** A unit's facing with nothing to it but its name. */
    const plainly = (type: string) => ({ theUnit: { a: { type } }, meets: null, itsOwnAbilities: [], marks: [] });
    const clauses = battleFacedClauses(
      {
        units: [
          null,
          undefined,
          { row: { base: 3 }, place: 'front', col: 0, mult: 1, why: { kind: 'a unit in the front line' } },
          {
            row: { a: a1, _faced: { m: 1, kind: 'faces', vs: { base: 2 }, why: plainly('Men-at-Arms') } },
            place: 'front',
            col: 1,
            mult: 1,
            why: { kind: 'a unit in the front line' },
          },
          {
            row: { a: a2, _faced: { m: 1, kind: 'even', vs: null, why: plainly('Yeoman Longbows') } },
            place: 'second',
            col: 1,
            mult: 1,
            why: { kind: 'a unit in the second line' },
          },
          { row: { a: a3 }, place: 'flank', col: 0, mult: 1, why: { kind: 'a rider on the flank' } },
        ],
      },
      null,
    );
    expect([...clauses.values()].map(theClauseOfWhomAUnitFaced)).toEqual([
      'with nobody opposite',
      'in the second line',
      'with nobody opposite',
    ]);
    expect([...clauses.keys()]).toEqual([a1, a2, a3]);
  });
  test('an enemy company faced when no enemy side is handed is named alone', () => {
    const mine = army('Men-at-Arms'),
      theirs = { ...army('Yeoman Longbows'), unitName: 'Bow B1' };
    const why = { theUnit: { a: { type: 'Men-at-Arms' } }, meets: null, itsOwnAbilities: [], marks: [] };
    /** The clauses of a grid of one company facing theirs, with no enemy side handed (`none`). */
    const theClauses = (none: null | undefined) =>
      battleFacedClauses(
        {
          units: [
            {
              row: { a: mine, _faced: { m: 1, kind: 'faces', vs: { a: theirs, base: 2 }, why } },
              place: 'front',
              col: 0,
              mult: 1,
              why: { kind: 'a unit in the front line' },
            },
          ],
        },
        none,
      );
    expect([null, undefined].map((none) => [...theClauses(none).values()].map(theClauseOfWhomAUnitFaced))).toEqual([
      ['facing Bow B1'],
      ['facing Bow B1'],
    ]);
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
