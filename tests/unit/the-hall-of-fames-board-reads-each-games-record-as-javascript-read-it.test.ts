// The Hall of Fame's board reads each game's record as JavaScript read it (plan P1-16j1): the view of a game's entry
// (src/ui/leaderboard/a-game-in-the-hall-of-fame-as-the-board-reads-it.ts) and the `+` it adds through
// (src/ui/shared/a-value-of-any-kind-read-as-javascript-reads-it.ts), each pinned to the value the page's untyped
// reads gave: `jp(x) || {}`, `x.field`, `(x || []).forEach`, `Object.entries(x || {})`, `a + b`, on the JSON a row may
// hold (numbers held as words, a list where an object was, an element that is nothing). Level 1 (unit): both files
// import in Node and take plain values; the page itself (src/ui/leaderboard/main.ts) reads them from P1-16j2.
import { describe, expect, test } from 'vitest';
import type { AHallOfFameEntry } from '../../src/db/the-db-interface-and-its-areas.ts';
import {
  theColumnParsed,
  theColumnParsedOrElse,
  theGameAsTheBoardHoldsIt,
  theRecordsAsTheBoardReadsThem,
  theSetUpAsTheBoardReadsIt,
  theStandingAsItsFieldsRead,
  theStandingsAsTheBoardHoldsThem,
  theStandingsOf,
  theTotalsAsTheBoardReadsThem,
} from '../../src/ui/leaderboard/a-game-in-the-hall-of-fame-as-the-board-reads-it.ts';
import { theSumAsJavaScriptMakesIt } from '../../src/ui/shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';

/** A made-up game's entry, its JSON columns as given. */
const anEntry = (columns: Partial<AHallOfFameEntry>): AHallOfFameEntry => ({
  build: 'lb3',
  created_at: '2026-01-02T00:00:00Z',
  finished_at: '2026-01-03T00:00:00Z',
  game_id: 'g-1',
  game_name: 'The Glass Coast',
  gm_user_id: 'u-gm',
  hidden: false,
  note: null,
  records: null,
  setup: null,
  standings: null,
  started_at: null,
  totals: null,
  turns: 12,
  victory: 'Reckoning',
  winner_is_bot: false,
  winner_player: null,
  winner_realm: 'Varnholt',
  ...columns,
});

describe('a + b, as JavaScript adds values of any kind', () => {
  test.each([
    [0, 5, 5],
    [0, '5', '05'],
    ['05', 3, '053'],
    [2, null, 2],
    [2, true, 3],
    [2, false, 2],
    [0, [1, 2], '01,2'],
    [0, [], '0'],
    [0, {}, '0[object Object]'],
    [{ a: 1 }, 1, '[object Object]1'],
    ['a', null, 'anull'],
    ['a', undefined, 'aundefined'],
    [null, null, 0],
  ])('%j + %j is %j', (a, b, sum) => {
    expect(theSumAsJavaScriptMakesIt(a, b)).toStrictEqual(sum);
  });
  test('a number and none (a field missing) add to NaN', () => {
    expect(theSumAsJavaScriptMakesIt(1, undefined)).toBeNaN();
    expect(theSumAsJavaScriptMakesIt(undefined, undefined)).toBeNaN();
  });
});

describe('a JSON column parsed, as jp parsed it', () => {
  test('none is null; words of JSON are parsed; other words are null; any other value is itself', () => {
    expect(theColumnParsed(null)).toBeNull();
    expect(theColumnParsed(undefined)).toBeNull();
    expect(theColumnParsed('{"bots":2}')).toStrictEqual({ bots: 2 });
    expect(theColumnParsed('0')).toBe(0);
    expect(theColumnParsed('""')).toBe('');
    expect(theColumnParsed('not JSON')).toBeNull();
    expect(theColumnParsed('')).toBeNull();
    const held = { realms: 4 };
    expect(theColumnParsed(held)).toBe(held);
    expect(theColumnParsed(0)).toBe(0);
  });
  test('else the value handed, where it parsed to nothing || passes over (jp(x) || {})', () => {
    const otherwise = {};
    for (const column of [null, undefined, 'not JSON', '0', 0, false, '""', 'false', 'null']) {
      expect(theColumnParsedOrElse(column, otherwise)).toBe(otherwise);
    }
    expect(theColumnParsedOrElse('[]', otherwise)).toStrictEqual([]);
    expect(theColumnParsedOrElse('"x"', otherwise)).toBe('x');
    expect(theColumnParsedOrElse(7, otherwise)).toBe(7);
  });
});

describe("a game's setup and totals, read field by field after || {}", () => {
  test('each field as held, numbers held as words kept as words', () => {
    expect(
      theSetUpAsTheBoardReadsIt({ bots: '2', realms: 4, cols: 9, rows: 7, seaPct: 30, diplomacy: 'hostile' }),
    ).toStrictEqual({
      bots: '2',
      realms: 4,
      humans: undefined,
      cols: 9,
      rows: 7,
      mapSize: undefined,
      diplomacy: 'hostile',
      seaPct: 30,
    });
    expect(theSetUpAsTheBoardReadsIt('{"humans":0,"mapSize":"small"}')).toMatchObject({ humans: 0, mapSize: 'small' });
  });
  test('none, words that are no JSON, a 0 or a list read every field as missing', () => {
    for (const column of [null, 'not JSON', '0', 0, '[1,2]', true]) {
      expect(Object.values(theSetUpAsTheBoardReadsIt(column))).toStrictEqual(Array(8).fill(undefined));
      expect(Object.values(theTotalsAsTheBoardReadsThem(column))).toStrictEqual(Array(6).fill(undefined));
    }
  });
  test('the totals as held', () => {
    expect(theTotalsAsTheBoardReadsThem({ battles: 3, casualties: '40', lairs: null, deaths: 0 })).toStrictEqual({
      battles: 3,
      casualties: '40',
      captures: undefined,
      lairs: null,
      spells: undefined,
      deaths: 0,
    });
  });
});

describe("a game's standings, as (g.standings || []) walked them", () => {
  test('a list: each standing read field by field, each nothing kept as it was', () => {
    const standings = theStandingsAsTheBoardHoldsThem([
      { pi: 0, realm: 'Varnholt', uid: 'u-1', score: '120', titles: ['crown'], winner: true },
      null,
      0,
      false,
      '',
      7,
    ]);
    const list = theStandingsOf({ standings });
    expect(list).toHaveLength(6);
    expect(list[0]).toMatchObject({ pi: 0, realm: 'Varnholt', uid: 'u-1', score: '120', titles: ['crown'] });
    expect(list[0]).toMatchObject({ winner: true, bot: undefined, rank: undefined, outHow: undefined });
    expect(list.slice(1, 5)).toStrictEqual([null, 0, false, '']);
    expect(Object.values(list[5] ?? {})).toStrictEqual(Array(16).fill(undefined));
  });
  test('none, or words that are no JSON, is no standing; words of a list are parsed', () => {
    expect(theStandingsOf({ standings: theStandingsAsTheBoardHoldsThem(null) })).toStrictEqual([]);
    expect(theStandingsOf({ standings: theStandingsAsTheBoardHoldsThem('oops') })).toStrictEqual([]);
    for (const nothing of [0, false, '0', 'false', '""']) {
      expect(theStandingsOf({ standings: theStandingsAsTheBoardHoldsThem(nothing) })).toStrictEqual([]);
    }
    expect(theStandingsOf({ standings: theStandingsAsTheBoardHoldsThem('[{"realm":"Osk"}]') })[0]).toMatchObject({
      realm: 'Osk',
    });
  });
  test('standings that are no list are kept, and walking them throws the TypeError .forEach threw', () => {
    for (const column of [{ realm: 'Osk' }, 5, '"words"', true]) {
      const standings = theStandingsAsTheBoardHoldsThem(column);
      expect(() => theStandingsOf({ standings })).toThrow(TypeError);
    }
  });
  test('a standing read without a test: none throws the TypeError its field threw; 0, false and words read as missing', () => {
    expect(() => theStandingAsItsFieldsRead(null)).toThrow(TypeError);
    expect(() => theStandingAsItsFieldsRead(undefined)).toThrow(TypeError);
    for (const nothing of [0, false, ''] as const) {
      expect(Object.values(theStandingAsItsFieldsRead(nothing))).toStrictEqual(Array(16).fill(undefined));
    }
    const list = theStandingsOf({ standings: theStandingsAsTheBoardHoldsThem([{ bot: true, score: 3 }]) });
    expect(theStandingAsItsFieldsRead(list[0] ?? null)).toMatchObject({ bot: true, score: 3 });
  });
});

describe("a game's records, as Object.entries(g.records || {}) and each entry's !e || e.v == null read them", () => {
  test('one entry or a list of them; nothing and an entry with no value passed over; a value of 0 kept', () => {
    const records = theRecordsAsTheBoardReadsThem({
      most_provinces: { v: 14, pi: 1, t: 9 },
      kills_game: [{ v: 0, pi: 0 }, null, { v: null, pi: 2 }, { pi: 3 }, 0, { v: '7', pi: 3, det: 'at sea' }],
      shortest_game: { v: 8, pi: null, d: 'min', lbl: 'A short one' },
    });
    expect(records.map((r) => r.key)).toStrictEqual(['most_provinces', 'kills_game', 'shortest_game']);
    expect(records[0]?.entries).toMatchObject([{ v: 14, pi: 1, t: 9, d: undefined }]);
    expect(records[1]?.entries).toMatchObject([
      { v: 0, pi: 0 },
      { v: '7', pi: 3, det: 'at sea' },
    ]);
    expect(records[2]?.entries).toMatchObject([{ v: 8, pi: null, d: 'min', lbl: 'A short one' }]);
  });
  test('an entry of the first build (lb1) names its realm', () => {
    const [record] = theRecordsAsTheBoardReadsThem([{ v: 3, realm: 'Osk', player: 'Ana', race: 'Elf', al: 'Good' }]);
    expect(record?.key).toBe('0');
    expect(record?.entries[0]).toMatchObject({ realm: 'Osk', player: 'Ana', race: 'Elf', al: 'Good', bot: undefined });
  });
  test('none, words that are no JSON, or a number hold no record; words hold one a letter, with no entry', () => {
    expect(theRecordsAsTheBoardReadsThem(null)).toStrictEqual([]);
    expect(theRecordsAsTheBoardReadsThem('not JSON')).toStrictEqual([]);
    expect(theRecordsAsTheBoardReadsThem(5)).toStrictEqual([]);
    expect(theRecordsAsTheBoardReadsThem('"ab"')).toStrictEqual([
      { key: '0', entries: [] },
      { key: '1', entries: [] },
    ]);
  });
});

describe("a game's entry held as the board holds it", () => {
  test('its columns kept, its four JSON columns read, words of JSON parsed', () => {
    const game = theGameAsTheBoardHoldsIt(
      anEntry({
        setup: '{"bots":1,"realms":3}',
        standings: [{ pi: 0, realm: 'Varnholt' }],
        records: { richest: { v: 900, pi: 0 } },
        totals: { battles: 2 },
      }),
    );
    expect(game).toMatchObject({ game_id: 'g-1', game_name: 'The Glass Coast', turns: 12, hidden: false });
    expect(game.setup).toMatchObject({ bots: 1, realms: 3, humans: undefined });
    expect(theStandingsOf(game)[0]).toMatchObject({ pi: 0, realm: 'Varnholt' });
    expect(game.records).toMatchObject([{ key: 'richest', entries: [{ v: 900, pi: 0 }] }]);
    expect(game.totals).toMatchObject({ battles: 2, spells: undefined });
  });
});
