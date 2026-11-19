// The Hall of Fame's builder and its writes on the values handed them (plan P1-16q): the lines P1-16q changed in
// src/ui/gm/hall-of-fame.ts that the screen tours and the matrix don't reach, or reach only in part, each pinned to the
// value it gave before the file was typed: a game's record built from odd statistics (words where numbers were, empty
// words, gaps, lists of the wrong kind) and its deadliest champion (the hero with the most kills: the matrix reaches
// it, no other test did), its write and its refusals, the names read for it, the rebuild button, and a finished game's
// results and turn records. Level 1 (unit): the file imports in Node once the page's config, the `supabase`
// global and a Db handed in are stood in (as the GM page's start-up tests do); a page test would boot the whole page,
// sign in and finish a game to reach each of them.
//
// Three more checks of the builder and its write, at the end (until plan P1-14z the scripts leaderboard-golden,
// leaderboard-events-paging and leaderboard-records, which cut the code out of the file and ran it in a vm of their
// own): one hand-made finished game, value by value; a game's turn rows read in pages on the fake Db (tests/lib/
// fake-db.ts), every row once, and a failed page saving nothing; and made-up games of malformed statistics, built
// without a throw into a storable row (100 games, or 3,000 under KC_FULL=1 in npm run test:full). The made-up games
// come from a fixed seed (12345) of the test's own: every run builds the same games, so the outcome is no luck.
// computeStandings is stood in for those games only (as the script's sandbox did), so each of them holds two titles.
// And the builder's half of the script leaderboard-realm-bests (until plan P1-14z): each realm's own best for each
// record (ruling R-087), a fallen hero's peaks and a title held then lost, on the game of tests/lib/a-finished-game-of-
// two-realms-each-holding-its-own-best.ts; its board is a page test's.
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootJsdom, DB_VERSION } from '../lib/boot.ts';
import { aGameMastersWorld, makeAFakeDbHoldingTheGameMastersWorld } from '../lib/fake-db.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';
import {
  theGameOfTwoRealmsEachHoldingItsOwnBest,
  theThroneHeldByAshvale,
} from '../lib/a-finished-game-of-two-realms-each-holding-its-own-best.ts';
import { computeStandings } from '../../src/engine/titles/reckoning.ts';
import type {
  ARealmsResultAsItsRecordReadsIt,
  ARealmsTurnAsItsRecordReadsIt,
  TheStateAsTheHallOfFameReadsIt,
} from '../../src/ui/gm/hall-of-fame.ts';

vi.mock('../../src/engine/titles/reckoning.ts', { spy: true });

interface AnAnswer {
  data: unknown;
  error: { message: string } | null;
}
/** What each of the stood-in Db's functions answers, by its name (a function: it throws, or answers by its arguments). */
const answers: Record<string, AnAnswer | ((...args: unknown[]) => AnAnswer | Promise<AnAnswer>)> = {};
/** Each call the page made on the stood-in Db: its function's name and its arguments. */
const calls: [string, unknown[]][] = [];
const answering =
  (name: string) =>
  async (...args: unknown[]): Promise<AnAnswer> => {
    calls.push([name, args]);
    const a = answers[name] ?? { data: null, error: null };
    return typeof a === 'function' ? a(...args) : a;
  };
/** The arguments of each call made on the Db's function `name`. */
const callsTo = (name: string): unknown[][] => calls.filter(([n]) => n === name).map(([, args]) => args);

let page: Document;
let hof: typeof import('../../src/ui/gm/hall-of-fame.ts');
/** The page's declared globals, as the GM page's files read them by their bare names. */
const G = globalThis as unknown as Record<string, unknown>;

beforeAll(async () => {
  const { window } = bootJsdom('<!doctype html><html><body></body></html>');
  const W = window as unknown as Window & Record<string, unknown>;
  page = W.document;
  const theDb = {
    theDatabasesVersion: {},
    theHallOfFame: {
      oneEntrysGame: answering('oneEntrysGame'),
      theGameOfEveryEntry: answering('theGameOfEveryEntry'),
      theGameMastersNotesOnThisGamesEntry: answering('notes'),
      writeTheseEntries: answering('writeEntries'),
    },
    theStatistics: {
      theResultsOfThisGame: answering('results'),
      thisGamesTurnRecordsForItsEntryFromRowToRow: answering('turns'),
      theGameOfEveryResultFromRowToRow: answering('resultsGames'),
      writeTheseResults: answering('writeResults'),
      writeTheseTurnRecords: answering('writeTurns'),
      theGamesOfTheseGamesResults: answering('gamesWithResults'),
    },
    theHallOfFamesGames: {
      thisGameWithItsWorldAndRealms: answering('game'),
      theFinishedGamesThisGameMasterRuns: answering('finishedGames'),
      theIdNameAndStateOfTheFinishedGamesThisGameMasterRuns: answering('finishedGamesStates'),
      thisGamesIdNameAndWorldWithEveryColumnOfItsRealms: answering('gameWithRealms'),
    },
    theAccountsNames: { theNameOfEveryAccount: answering('names') },
  };
  Object.assign(globalThis, {
    window: W,
    document: page,
    HTMLElement: W['HTMLElement'],
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    kcTheDbATestHandsThePage: theDb,
  });
  hof = await import('../../src/ui/gm/hall-of-fame.ts');
});
beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(answers)) Reflect.deleteProperty(answers, k);
  page.body.innerHTML = '<div id="msg-leaderboard"></div><div id="msg-telemetry"></div>';
  G['currentUser'] = { id: 'gm-1' };
  G['_kcHasLb'] = true;
  G['_kcLbLastErr'] = null;
  G['_kcHasTel'] = true;
  G['_kcTelLastErr'] = null;
});
/** Runs `f` with the console quiet. */
async function quietly<T>(f: () => Promise<T>): Promise<T> {
  const { warn, log } = console;
  console.warn = () => undefined;
  console.log = () => undefined;
  try {
    return await f();
  } finally {
    console.warn = warn;
    console.log = log;
  }
}
/** The names kept between builds emptied: a rebuild that finds one game to build, whose results are none. */
async function theNamesForgotten(): Promise<void> {
  answers['finishedGames'] = { data: [], error: null };
  answers['resultsGames'] = { data: [{ game_id: 'g-none' }], error: null };
  answers['theGameOfEveryEntry'] = { data: [], error: null };
  answers['results'] = { data: [], error: null };
  await hof.backfillGameRecords(true);
  calls.length = 0;
}
/** A world of any shape, as a save of any age may hold one (the builder's type claims more of it). */
const aStateOfAnyShape = (state: object): TheStateAsTheHallOfFameReadsIt => state;
/** A turn's statistics of any shape (the snapshots and orders as a turn of any age held them). */
const statisticsOfAnyShape = (statistics: object): Parameters<typeof hof.writeTurnTelemetry>[3] => statistics;
/** A value of any kind, as a page's code may throw one. */
const aValueOfAnyKind = (value: unknown): unknown => value;
/** A record built, or the test stops. */
function theRecord(row: ARecordBuilt | null): ARecordBuilt {
  if (!row) throw new Error('no record');
  return row;
}
/** A record's entries, each as `pi:v:t`. */
type ARecordBuilt = NonNullable<ReturnType<typeof hof.buildGameRecords>>;
const entriesOf = (row: ARecordBuilt, key: string): string[] =>
  (row.records[key] ?? []).map((e) => `${String(e.pi)}:${String(e.v)}:${String(e.t)}`);
const detailOf = (row: ARecordBuilt, key: string, field: string): unknown[] =>
  (row.records[key] ?? []).map((e) => e[field]);

describe("a game's record built from odd statistics", () => {
  const result = (pi: number, extra: Record<string, unknown> = {}) => ({
    player_index: pi,
    realm: `Realm ${String(pi)}`,
    ...extra,
  });
  test("the standings: a missing rank last, a missing score 0, a realm's name from its slot, a bot's flags", () => {
    const row = hof.buildGameRecords(
      'g1',
      null,
      [{ player_index: 1, user_id: 'u-1', display_name: 'Kingdom of Ash' }, null, { player_index: null }],
      [
        result(0, { rank: null, score: null, is_bot: 1, out_turn: 0, out_how: '', winner: 'yes' }),
        null,
        result(1, { realm: '', rank: 2, score: 5, out_turn: 4, out_how: 'conceded', final: { provinces: '7' } }),
      ],
      [],
      null,
      { 'u-1': 'Ada' },
    );
    if (!row) throw new Error('no record');
    expect(row.standings.map((s) => [s.pi, s.realm, s.uid, s.player, s.bot, s.rank, s.score, s.winner])).toEqual([
      [1, 'Kingdom of Ash', 'u-1', 'Ada', false, 2, 5, false],
      [0, 'Realm 0', null, null, true, null, 0, true],
    ]);
    expect(row.standings.map((s) => [s.outTurn, s.outHow, s.prov, s.land])).toEqual([
      [4, 'conceded', '7', 0],
      [null, null, 0, 0],
    ]);
    expect(row.winner_realm).toBe('Realm 0');
    expect(row.winner_player).toBe(null);
    expect(row.winner_is_bot).toBe(true);
    expect(entriesOf(row, 'earliest_out')).toEqual(['1:4:0']);
    expect(detailOf(row, 'earliest_out', 'det')).toEqual(['conceded']);
    expect(row.game_name).toBe('Game g1');
    expect(row.gm_user_id).toBe('gm-1');
    expect(row.started_at).toBe(null);
    expect(row.victory).toBe(null);
  });
  test('results of none, or a gap first; slots of none; no names handed', () => {
    expect(hof.buildGameRecords('g20', null, [], null, [], null, null)).toBe(null);
    const row = hof.buildGameRecords('g21', null, null, [undefined, result(0, { realm: '' })], [], null, null);
    expect(row?.standings.map((s) => [s.realm, s.uid, s.player])).toEqual([[null, null, null]]);
    const named = hof.buildGameRecords('g22', null, [{ player_index: 0, user_id: 'u-1' }], [result(0)], [], null, null);
    expect(named?.standings.map((s) => [s.uid, s.player])).toEqual([['u-1', null]]);
  });
  test("a record's name, its Game Master and its end, each from the first that holds one", () => {
    const at = '2026-01-02T03:04:05.000Z';
    const row = hof.buildGameRecords(
      'g2',
      { name: '', gm_user_id: '', created_at: '' },
      [],
      [
        result(0, { game_name: 'The Long War', victory: '', created_at: null, turns: 0 }),
        result(1, { created_at: at }),
      ],
      [{ turn: 3, player_index: 0 }, null, { turn: 0, player_index: 1 }],
      null,
      null,
    );
    expect(row?.game_name).toBe('The Long War');
    expect(row?.victory).toBe(null);
    expect(row?.gm_user_id).toBe('gm-1');
    expect(row?.started_at).toBe(null);
    expect(row?.finished_at).toBe(at);
    expect(row?.turns).toBe(3);
    G['currentUser'] = null;
    const none = hof.buildGameRecords('g3', null, null, [result(0, { out_turn: 2 })], null, null, null);
    expect(none?.gm_user_id).toBe(null);
    expect(none?.turns).toBe(0);
    expect(detailOf(theRecord(none), 'earliest_out', 'det')).toEqual(['out']);
    expect(hof.buildGameRecords('g4', null, [], [null, undefined], [], null, null)).toBe(null);
  });
  test("the setup: each from the results' own, else the world, else the game's settings, else its default", () => {
    const meta = { v: 1, botDiplomacy: 'hostile', botDifficulty: 'hard', mapSize: 'p7', seaPct: 0 };
    const row = hof.buildGameRecords(
      'g5',
      { max_turns: 0, meta },
      [],
      [result(0, { setup: { realms: 0, humans: null, bots: 0, diplomacy: '', cols: 0 }, is_bot: true }), result(1)],
      [],
      { botDiplomacy: '', botDifficulty: 0, maxTurns: 30, world: { cols: 11, rows: 0 } },
      null,
    );
    expect(row?.setup).toEqual({
      realms: 2,
      humans: 1,
      bots: 0,
      diplomacy: 'hostile',
      difficulty: 'hard',
      mapSize: 'p7',
      cols: 11,
      rows: null,
      seaPct: 0,
      maxTurns: 30,
    });
    const bare = hof.buildGameRecords('g6', null, [], [result(0, { setup: 'words' })], [], { world: null }, null);
    expect(bare?.setup).toEqual({
      realms: 1,
      humans: 1,
      bots: 0,
      diplomacy: 'normal',
      difficulty: null,
      mapSize: null,
      cols: null,
      rows: null,
      seaPct: null,
      maxTurns: null,
    });
    const world = hof.buildGameRecords(
      'g7',
      { max_turns: 12 },
      [],
      [result(0, { setup: { seaPct: 5 } })],
      [],
      null,
      null,
    );
    expect([world?.setup.seaPct, world?.setup.maxTurns]).toEqual([5, 12]);
    expect(entriesOf(theRecord(world), 'biggest_world')).toEqual([]);
  });
  test("the realm's totals: words a turn's outcomes held added as `+` adds them, empty words as 0, numbers otherwise", () => {
    const outcomes = (fought: unknown, won: unknown) => ({
      battles: { fought, won, unitsLost: 1, unitsKilled: '2' },
      encounters: { fought: '1', won: 0, fled: 1 },
      captures: { gained: 2, lost: '1' },
      deaths: { own: 1, killed: '1' },
      spells: { cast: '3', ok: 1 },
    });
    const row = hof.buildGameRecords(
      'g8',
      null,
      [],
      [result(0)],
      [
        { turn: 1, player_index: 0, outcomes: outcomes('2', '1') },
        { turn: 2, player_index: 0, outcomes: outcomes('2', 2) },
        { turn: 3, player_index: 0, outcomes: outcomes(null, '1') },
      ],
      null,
      null,
    );
    if (!row) throw new Error('no record');
    expect(entriesOf(row, 'battles_game')).toEqual(['0:220:null']);
    expect(entriesOf(row, 'battles_won_game')).toEqual(['0:121:null']);
    expect(entriesOf(row, 'best_win_rate')).toEqual(['0:55:null']);
    expect(detailOf(row, 'best_win_rate', 'det')).toEqual(['0121 of 0220 battles']);
    expect(entriesOf(row, 'kills_game')).toEqual(['0:222:null']);
    expect(entriesOf(row, 'losses_game')).toEqual(['0:3:null']);
    expect(entriesOf(row, 'flights_game')).toEqual(['0:3:null']);
    expect(entriesOf(row, 'lairs_game')).toEqual([]);
    expect(entriesOf(row, 'captures_game')).toEqual(['0:6:null']);
    expect(entriesOf(row, 'lost_game')).toEqual(['0:111:null']);
    expect(entriesOf(row, 'champions_lost')).toEqual(['0:3:null']);
    expect(entriesOf(row, 'champions_slain')).toEqual(['0:111:null']);
    expect(entriesOf(row, 'spells_game')).toEqual(['0:333:null']);
    expect(entriesOf(row, 'failed_spells_game')).toEqual(['0:330:null']);
    expect(row.totals).toEqual({
      battles: 0,
      casualties: 0,
      spells: '0333',
      captures: 6,
      deaths: 3,
      lairs: '0111',
      events: 3,
    });
    const emptyWords = hof.buildGameRecords(
      'g8b',
      null,
      [],
      [result(0)],
      [
        { turn: 1, player_index: 0, outcomes: { battles: { fought: '' }, captures: { gained: '' } } },
        { turn: 2, player_index: 0, outcomes: { battles: { fought: 3 }, captures: { gained: 2 } } },
      ],
      null,
      null,
    );
    expect(entriesOf(theRecord(emptyWords), 'battles_game')).toEqual(['0:3:null']);
    expect(entriesOf(theRecord(emptyWords), 'captures_game')).toEqual(['0:2:null']);
    expect(theRecord(emptyWords).totals.captures).toBe(2);
  });
  test("the deadliest champion: the hero who slew the most heroes, with his count, named from the turn's heroes", () => {
    const row = hof.buildGameRecords(
      'g8c',
      null,
      [],
      [result(0)],
      [
        {
          turn: 1,
          player_index: 0,
          post: {
            characters: [
              { id: 4, name: 'Harrow Vane' },
              { id: 5, name: 'Odile Marsh' },
            ],
          },
          outcomes: {
            deaths: {
              list: [
                { killerPi: 0, pi: 1, killerId: 5 },
                { killerPi: 0, pi: 1, killerId: 4 },
                { killerPi: 0, pi: 1, killerId: 4 },
                { killerPi: 0, pi: 2, killerId: 4 },
              ],
            },
          },
        },
      ],
      null,
      null,
    );
    expect(entriesOf(theRecord(row), 'deadliest_champion')).toEqual(['0:3:null']);
    expect(detailOf(theRecord(row), 'deadliest_champion', 'who')).toEqual(['Harrow Vane']);
  });
  test("a turn's heroes, titles, battles, lairs, captures, deaths and spells, each read as the statistics held it", () => {
    const post = {
      provinces: '10',
      characters: [
        null,
        'a word',
        {
          id: 4,
          name: '',
          units: [{ t: 'Nothing Known' }, { t: 'Levies', q: '' }],
          items: [3, 'Ring'],
          skills: { melee: '4', odd: 2, bad: 'x' },
        },
      ],
      fallen: [{ id: '7', name: 'Bran', units: 'none', skills: null }],
      titles: [
        null,
        { key: 3, merit: 4 },
        { key: 'no_such_title', merit: 5, who: 9 },
        { key: 'throne', merit: 2, who: 'Ada' },
      ],
    };
    const outcomes = {
      battles: {
        list: [
          null,
          7,
          { side: 'def', atkStr: 30, defStr: 10, atkLost: 0, defLost: 0, win: true, terrain: 5, kind: 9 },
          { side: 'atk', atkStr: '12', defStr: 4, atkLost: 0, defLost: 2, win: 1, terrain: 'hills', kind: 'pvp' },
        ],
      },
      encounters: {
        list: [
          null,
          { power: 5, guardian: 7, feature: '', won: true, hpAfter: 3, dmg: 2 },
          { power: 'Legendary', feature: 'the Pit', won: 1, hpAfter: '2', killed: 1 },
          { won: true, killed: true, hpAfter: 0 },
        ],
      },
      captures: { list: [null, { to: 1, tax: 9 }, { to: 0, tax: '4' }, { to: 0, tax: 1, terrain: 'marsh' }] },
      deaths: {
        list: [
          null,
          { killerPi: 0, pi: 1, killerId: null, king: true },
          { killerPi: 0, pi: 1, killerId: null },
          { killerPi: 0, pi: 1, killerId: null },
          { killerPi: 0, pi: 1, killerId: '4' },
          { killerPi: 0, pi: 1, killerId: 4 },
          { killerPi: 0, pi: 0, killerId: 4 },
        ],
      },
      spells: {
        list: [
          null,
          { spell: 5, ok: 1, chance: 0, lvl: 2 },
          { spell: 'Fireball', ok: true, chance: '40', lvl: 3 },
          { spell: 'Fireball', ok: false, chance: 10 },
        ],
      },
    };
    const row = hof.buildGameRecords(
      'g9',
      null,
      [],
      [result(0)],
      [{ turn: 2, player_index: 0, post, outcomes }],
      null,
      null,
    );
    if (!row) throw new Error('no record');
    expect(entriesOf(row, 'fastest_ten')).toEqual(['0:2:2']);
    expect(entriesOf(row, 'biggest_field_army')).toEqual(['0:16:2']);
    expect(detailOf(row, 'biggest_field_army', 'who')).toEqual([null]);
    expect(detailOf(row, 'most_items_one_char', 'det')).toEqual(['Ring']);
    expect(entriesOf(row, 'greatest_hero')).toEqual(['0:6:2']);
    expect(detailOf(row, 'greatest_hero', 'det')).toEqual(['3 skills']);
    expect(row.records['sk_bad']).toBeUndefined();
    expect([...detailOf(row, 'sk_melee', 'lbl'), ...detailOf(row, 'sk_melee', 'det')]).toEqual([
      'Highest Melee',
      'Melee 4',
    ]);
    expect([...detailOf(row, 'sk_odd', 'lbl'), ...detailOf(row, 'sk_odd', 'det')]).toEqual(['Highest odd', 'odd 2']);
    expect(entriesOf(row, 'title_no_such_title')).toEqual(['0:5:2']);
    expect(row.records['title_3']).toBeUndefined();
    expect(detailOf(row, 'title_no_such_title', 'lbl')).toEqual(['no_such_title — highest rating']);
    expect(detailOf(row, 'title_no_such_title', 'who')).toEqual([null]);
    expect(detailOf(row, 'title_throne', 'det')).toEqual(['The Throne']);
    expect(detailOf(row, 'title_throne', 'who')).toEqual(['Ada']);
    expect(entriesOf(row, 'battles_game')).toEqual([]);
    expect(entriesOf(row, 'biggest_battle')).toEqual(['0:40:2']);
    expect(detailOf(row, 'biggest_battle', 'det')).toEqual(['30 vs 10']);
    expect(detailOf(row, 'biggest_battle', 'kind')).toEqual([null]);
    expect(detailOf(row, 'biggest_pvp', 'det')).toEqual(['12 vs 4 · hills']);
    expect(entriesOf(row, 'stubbornest_defence')).toEqual(['0:0.33:2']);
    expect(detailOf(row, 'stubbornest_defence', 'det')).toEqual(['10 held off 30']);
    expect(entriesOf(row, 'flawless_victory')).toEqual(['0:30:2']);
    expect(detailOf(row, 'flawless_victory', 'det')).toEqual(['30 destroyed, nothing lost']);
    expect(row.totals.battles).toBe(2);
    expect(row.totals.casualties).toBe(2);
    expect(detailOf(row, 'guardian_slain', 'det')).toEqual(['the Pit (Legendary)']);
    expect(entriesOf(row, 'guardian_slain')).toEqual(['0:4:2']);
    expect(entriesOf(row, 'narrowest_escape')).toEqual(['0:0:2']);
    expect(detailOf(row, 'narrowest_escape', 'det')).toEqual(['a guardian']);
    expect(detailOf(row, 'luckiest_kill', 'det')).toEqual(['the Pit (Legendary) — 2 hp left']);
    expect(detailOf(row, 'hardest_fight', 'det')).toEqual(['a guardian (5)']);
    expect(detailOf(row, 'deadliest_guardian', 'det')).toEqual(['the Pit (Legendary) slew a champion']);
    expect(entriesOf(row, 'richest_capture')).toEqual(['0:4:2']);
    expect(detailOf(row, 'richest_capture', 'det')).toEqual(['a province worth 4 tax']);
    expect(entriesOf(row, 'kingslayer')).toEqual(['0:1:null']);
    expect(entriesOf(row, 'deadliest_champion')).toEqual(['0:2:null']);
    expect(detailOf(row, 'deadliest_champion', 'who')).toEqual(['']);
    expect(entriesOf(row, 'favourite_spell')).toEqual(['0:2:null']);
    expect(detailOf(row, 'favourite_spell', 'det')).toEqual(['Fireball']);
    expect(detailOf(row, 'longest_shot', 'det')).toEqual(['Fireball at 40%']);
    expect(detailOf(row, 'grandest_casting', 'det')).toEqual(['Fireball']);
    expect(entriesOf(row, 'grandest_casting')).toEqual(['0:3:2']);
  });
  test("a spell with no name, a hero's units of no list, and a unit of no kind, as the builder met them", () => {
    const row = hof.buildGameRecords(
      'g10',
      null,
      [],
      [result(0)],
      [
        {
          turn: 1,
          player_index: 0,
          post: { characters: [{ name: 'Wren', units: [{ t: 'Levies' }, 5] }] },
          outcomes: { spells: { list: [{ spell: '', ok: 1, lvl: 4 }] } },
        },
      ],
      null,
      null,
    );
    expect(detailOf(theRecord(row), 'grandest_casting', 'det')).toEqual(['an unnamed spell']);
    expect(entriesOf(theRecord(row), 'biggest_field_army')).toEqual(['0:8:1']);
    expect(() =>
      hof.buildGameRecords(
        'g11',
        null,
        [],
        [result(0)],
        [{ turn: 1, player_index: 0, post: { characters: [{ units: [null] }] } }],
        null,
        null,
      ),
    ).toThrow("Cannot read properties of null (reading 't')");
  });
  test("the Imperial Titles at the end: each holder's best, its hero named from the world's heroes", () => {
    const gs = {
      players: [
        { name: 'Ash', color: '#111', alignment: 'Good', gold: 900 },
        { name: 'Elm', color: '#222', alignment: 'Evil', gold: 10 },
      ],
      characters: [null, { id: 7, name: 'Wren', player: 0, location: 0, skills: {}, items: [], armies: [] }],
      world: { provinces: [{ owner: 0, tax: 5 }] },
    };
    const row = hof.buildGameRecords('g12', null, [], [result(0), result(1)], [], aStateOfAnyShape(gs), null);
    expect(entriesOf(theRecord(row), 'title_throne')).toEqual(['0:5:0']);
    expect(entriesOf(theRecord(row), 'title_vault')).toEqual(['0:900:0']);
    expect(detailOf(theRecord(row), 'title_vault', 'lbl')).toEqual(['The Vaultkeeper — highest rating']);
    expect(row?.standings.map((s) => s.titles)).toEqual([['throne', 'vault'], []]);
    const broken = hof.buildGameRecords('g13', null, [], [result(0)], [], aStateOfAnyShape({ players: 'none' }), null);
    expect(broken?.standings.map((s) => s.titles)).toEqual([[]]);
  });
});

describe("the record accumulator and a record's context", () => {
  test('put: none and a value that is no number left out, a tie keeps the first, each realm its own best', () => {
    const rk = hof.lbRecorder();
    rk.put('a', null, { pi: 0 });
    rk.put('a', 'x', { pi: 0 });
    rk.put('a', '5', { pi: 0, t: 1 });
    rk.put('a', 5, { pi: 0, t: 2 });
    rk.put('a', 7, null);
    rk.put('a', 2, { pi: 1 });
    rk.put('b', 3, undefined, 'min');
    rk.put('b', 1, { pi: null, t: 4 }, 'min');
    rk.put('b', 0, { pi: 2 }, 'min');
    rk.put('c', 5, { pi: 1 });
    rk.put('c', 5, null);
    const R = rk.finish();
    expect(R['c']?.map((e) => e.pi)).toEqual([undefined, 1]);
    expect(R['a']?.map((e) => [e.pi, e.v, e.t, e.d])).toEqual([
      [undefined, 7, undefined, 'max'],
      [0, 5, 1, 'max'],
      [1, 2, undefined, 'max'],
    ]);
    expect(R['b']?.map((e) => [e.pi, e.v, e.t])).toEqual([
      [2, 0, undefined],
      [null, 1, 4],
      [undefined, 3, undefined],
    ]);
  });
  test('lbCtx: none as null, the details kept; lbUnitStr and lbSumStr on units of no kind', () => {
    expect(hof.lbCtx(undefined, undefined)).toEqual({ pi: null, t: null });
    expect(hof.lbCtx(2, 0, { det: 'x', pi: 5 })).toEqual({ pi: 5, t: 0, det: 'x' });
    expect(hof.lbUnitStr(null)).toBe(0);
    expect(hof.lbUnitStr({ t: 'Nothing Known', q: 'Nothing Known' })).toBe(8);
    expect(hof.lbUnitStr({ t: 'Levies' })).toBe(hof.lbUnitStr({ t: 'Levies', q: 'Average' }));
    expect(hof.lbSumStr('none')).toBe(0);
    expect(hof.lbSumStr([{ t: 'x' }, { t: 'y' }], (u) => (u as { t: string }).t === 'x')).toBe(8);
  });
});

describe("a game's record written", () => {
  const theResults = { data: [{ player_index: 0, realm: 'Ash', created_at: '2026-01-01T00:00:00.000Z' }], error: null };
  test('none while the table is missing, or the results are refused or none', async () => {
    G['_kcHasLb'] = false;
    expect(await hof.writeGameRecord('g1')).toBe(false);
    G['_kcHasLb'] = true;
    answers['results'] = { data: null, error: { message: 'refused' } };
    expect(await hof.writeGameRecord('g1', null)).toBe(false);
    answers['results'] = { data: [], error: null };
    expect(await hof.writeGameRecord(5)).toBe(false);
    expect(callsTo('results')).toEqual([['g1'], ['5']]);
  });
  test('a refused page of turns stops it, its words on the banner; the game read for its realms and its world', async () => {
    answers['results'] = theResults;
    answers['turns'] = { data: null, error: { message: 'too slow' } };
    expect(await hof.writeGameRecord('g1', {})).toBe(false);
    expect(G['_kcLbLastErr']).toBe('Could not read the turn history of game g1: too slow');
    expect(page.getElementById('msg-leaderboard')?.textContent).toContain('too slow');
    answers['turns'] = { data: null, error: null };
    answers['game'] = { data: { id: 'g1', name: 'The Old War', game_state: '{"players":[]}' }, error: null };
    answers['notes'] = { data: { note: 'kept', hidden: true, game_name: 'Renamed' }, error: null };
    answers['names'] = { data: [], error: null };
    answers['writeEntries'] = { data: null, error: null };
    await theNamesForgotten();
    answers['results'] = theResults;
    answers['turns'] = { data: null, error: null };
    expect(await hof.writeGameRecord('g1', { players: [] })).toBe(true);
    const [[entries]] = callsTo('writeEntries') as [[{ note: unknown; hidden: unknown; game_name: unknown }[]]];
    expect(entries.map((e) => [e.note, e.hidden, e.game_name])).toEqual([['kept', true, 'Renamed']]);
    expect(G['_kcLbLastErr']).toBe(null);
    answers['notes'] = { data: { note: '', hidden: false, game_name: '' }, error: null };
    answers['game'] = { data: { id: 'g1', name: 'The Old War', game_state: '{"players":0}' }, error: null };
    answers['writeEntries'] = { data: null, error: { message: 'no room' } };
    expect(await hof.writeGameRecord('g1')).toBe(false);
    const [, [later]] = callsTo('writeEntries') as [unknown, [{ note?: unknown; game_name: unknown }[]]];
    expect(later.map((e) => [e.note, e.game_name])).toEqual([[undefined, 'The Old War']]);
    expect(G['_kcLbLastErr']).toBe('no room');
  });
  test("a page of turns: 500 a page, until one holds fewer; the game's realms none where its read held none", async () => {
    answers['results'] = theResults;
    const turn = { turn: 1, player_index: 0 };
    answers['turns'] = (...args: unknown[]) => ({
      data: args[1] === 0 ? Array.from({ length: 500 }, () => turn) : [turn],
      error: null,
    });
    answers['game'] = { data: { id: 'g1', name: '' }, error: null };
    answers['writeEntries'] = { data: null, error: null };
    expect(await hof.writeGameRecord('g1', { gs: { players: [] } })).toBe(true);
    expect(callsTo('turns')).toEqual([
      ['g1', 0, 499],
      ['g1', 500, 999],
    ]);
    const [[entries]] = callsTo('writeEntries') as [[{ totals: { events: number }; game_name: string }[]]];
    expect(entries.map((e) => [e.totals.events, e.game_name])).toEqual([[501, 'Game g1']]);
  });
  test("a throw on the way: its message on the banner's words, or the value thrown", async () => {
    answers['results'] = () => {
      throw new Error('the line went down');
    };
    expect(await hof.writeGameRecord('g1')).toBe(false);
    expect(G['_kcLbLastErr']).toBe('the line went down');
    answers['results'] = () => {
      throw aValueOfAnyKind('a word');
    };
    expect(await hof.writeGameRecord('g1')).toBe(false);
    expect(G['_kcLbLastErr']).toBe('a word');
    answers['results'] = () => {
      throw aValueOfAnyKind({ message: '' });
    };
    expect(await hof.writeGameRecord('g1')).toBe(false);
    expect(G['_kcLbLastErr']).toBe('[object Object]');
  });
});

describe("the players' names read for a record", () => {
  test("the names once a rebuild began: each one kept, the table's words on a refusal or on none at all", async () => {
    await theNamesForgotten();
    answers['names'] = {
      data: [
        { id: 'u-1', name: 'Ada' },
        { id: 'u-2', name: '' },
        { id: '', name: 'Nobody' },
      ],
      error: { message: 'partly refused' },
    };
    expect(await hof.lbProfileNames([{ user_id: 'u-1' }, null, { user_id: 'u-2' }, { user_id: 'u-1' }, {}])).toEqual({
      'u-1': 'Ada',
    });
    expect(hof._lbProfErr).toBe('partly refused');
    expect(await hof.lbProfileNames(null)).toEqual({});
    expect(callsTo('names')).toHaveLength(1);
    await theNamesForgotten();
    answers['names'] = { data: null, error: null };
    expect(await hof.lbProfileNames([{ user_id: 'u-1' }])).toEqual({});
    expect(hof._lbProfErr).toBe('the profiles table returned no names at all');
    await theNamesForgotten();
    answers['names'] = () => {
      throw aValueOfAnyKind(7);
    };
    expect(await hof.lbProfileNames([])).toEqual({});
    expect(hof._lbProfErr).toBe('7');
  });
  test('a rebuild that begins while the names are read: the TypeError each read of the names threw', async () => {
    await theNamesForgotten();
    answers['names'] = async () => {
      answers['names'] = { data: [], error: null };
      await theNamesForgotten();
      return { data: [{ id: 'u-1', name: 'Ada' }], error: null };
    };
    await expect(hof.lbProfileNames([{ user_id: 'u-1' }])).rejects.toThrow(
      "Cannot read properties of null (reading 'u-1')",
    );
    expect(hof._lbProfErr).toBe("Cannot set properties of null (setting 'u-1')");
    await theNamesForgotten();
    answers['names'] = async () => {
      await theNamesForgotten();
      return { data: [], error: null };
    };
    expect(await hof.lbProfileNames([])).toEqual({});
    expect(hof._lbProfErr).toBe('Cannot convert undefined or null to object');
  });
  test("lbCountRow: a record's standings counted, none when it holds none", () => {
    const before = { ...hof._lbTally };
    hof.lbCountRow({ standings: null });
    hof.lbCountRow({ standings: [null, { bot: true }, { uid: 'u-1', player: 'Ada' }, { uid: 'u-2' }, {}] });
    expect(hof._lbTally).toEqual({
      games: before.games + 2,
      humans: before.humans + 3,
      uids: before.uids + 2,
      named: before.named + 1,
    });
  });
});

describe('the rebuild button (backfillGameRecords)', () => {
  beforeEach(() => {
    page.body.innerHTML += '<button id="lb-build-btn"></button><span id="lb-build-msg"></span>';
  });
  const msg = () => page.getElementById('lb-build-msg')?.textContent ?? '';
  test('nothing while the table is missing or no one is signed in; a refused page of results, in words', async () => {
    G['_kcHasLb'] = false;
    expect(await hof.backfillGameRecords(false)).toBe(0);
    G['_kcHasLb'] = true;
    G['currentUser'] = null;
    expect(await hof.backfillGameRecords(false)).toBe(0);
    expect(calls).toEqual([]);
    G['currentUser'] = { id: 'gm-1' };
    answers['resultsGames'] = { data: null, error: { message: 'refused' } };
    expect(await hof.backfillGameRecords(false)).toBe(0);
    expect(msg()).toBe('Could not read the finished games: refused');
    answers['resultsGames'] = { data: null, error: null };
    expect(await hof.backfillGameRecords(true)).toBe(0);
    expect(msg()).toBe('Every finished game already has a Hall-of-Fame record.');
  });
  test('each game with results built once, its row found by its id in words, the tally said, the button freed', async () => {
    answers['finishedGames'] = { data: [{ id: 7, name: 'Seven' }], error: null };
    answers['resultsGames'] = (...args: unknown[]) => ({
      data: args[0] === 0 ? Array.from({ length: 1000 }, (_, i) => ({ game_id: i < 999 ? '7' : 'g2' })) : null,
      error: null,
    });
    answers['theGameOfEveryEntry'] = { data: [{ game_id: 'g2' }], error: null };
    answers['results'] = { data: [{ player_index: 0, realm: 'Ash', is_bot: false }], error: null };
    answers['turns'] = { data: [], error: null };
    answers['game'] = { data: null, error: null };
    answers['names'] = { data: [], error: { message: 'not allowed' } };
    answers['writeEntries'] = { data: null, error: null };
    const button = page.getElementById('lb-build-btn');
    let disabledWhileBuilding: unknown = null;
    answers['notes'] = () => {
      disabledWhileBuilding = Reflect.get(button ?? {}, 'disabled');
      return { data: null, error: null };
    };
    expect(await hof.backfillGameRecords(false)).toBe(1);
    expect(callsTo('resultsGames')).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(callsTo('results')).toEqual([['7']]);
    const [[entries]] = callsTo('writeEntries') as [[{ game_name: string }[]]];
    expect(entries.map((e) => e.game_name)).toEqual(['Seven']);
    expect(disabledWhileBuilding).toBe(true);
    expect(Reflect.get(button ?? {}, 'disabled')).toBe(false);
    expect(msg()).toContain('Recorded 1 game · 1 human realm · 0 with a player account · 0 with a name');
    expect(msg()).toContain('No player names were resolved.');
    expect(msg()).toContain('The table said: not allowed.');
  });
  test("a tally of accounts with no name, and a failure's words, the button freed", async () => {
    answers['finishedGames'] = { data: null, error: null };
    answers['resultsGames'] = { data: [{ game_id: 'g1' }, { game_id: 'g2' }], error: null };
    answers['theGameOfEveryEntry'] = { data: null, error: null };
    answers['results'] = (...args: unknown[]) => ({
      data: [
        { player_index: 0, realm: 'Ash', is_bot: false },
        { player_index: 1, realm: 'Elm', is_bot: false },
      ],
      error: args[0] === 'g2' ? { message: 'gone' } : null,
    });
    answers['turns'] = { data: [], error: null };
    answers['game'] = {
      data: {
        id: 'g1',
        game_players: [
          { player_index: 0, user_id: 'u-1' },
          { player_index: 1, user_id: 'u-2' },
        ],
      },
      error: null,
    };
    answers['names'] = { data: [{ id: 'u-1', name: 'Ada' }], error: null };
    answers['writeEntries'] = { data: null, error: null };
    expect(await hof.backfillGameRecords(true)).toBe(1);
    expect(callsTo('results')).toEqual([['g1'], ['g2']]);
    expect(msg()).toContain('Recorded 1 game · 2 human realms · 2 with a player account · 1 with a name');
    expect(msg()).toContain('(1 account has no name saved yet)');
    answers['finishedGames'] = () => {
      throw aValueOfAnyKind({ message: 'down' });
    };
    expect(await hof.backfillGameRecords(true)).toBe(0);
    expect(msg()).toBe('Failed: down');
    answers['finishedGames'] = () => {
      throw aValueOfAnyKind(0);
    };
    expect(await hof.backfillGameRecords(true)).toBe(0);
    expect(msg()).toBe('Failed: 0');
    page.getElementById('lb-build-msg')?.remove();
    answers['finishedGames'] = { data: [], error: null };
    expect(await hof.backfillGameRecords(true)).toBe(1);
    expect(Reflect.get(page.getElementById('lb-build-btn') ?? {}, 'disabled')).toBe(false);
  });
});

describe("a finished game's results and turn records", () => {
  /** A small finished world: two realms, a hero, a province. */
  const aWorldsFields = (over: Record<string, unknown> = {}) => ({
    players: [
      { name: 'Ash', color: '#111', alignment: 'Good', gold: 900, race: 'Human', conceded: true, concededTurn: 0 },
      { name: 'Elm', color: '#222', alignment: '', gold: 10, race: '', _eliminated: true, _eliminatedTurn: 3 },
    ],
    characters: [{ id: 7, name: 'Wren', player: 0, location: 0, skills: {}, items: [], armies: [], hp: 5, maxHp: 5 }],
    world: { provinces: [{ owner: 0, tax: 5, terrain: 'plains' }], cols: 4, rows: 3, seaPct: 20 },
    turn: 6,
    ...over,
  });
  const aWorld = (over: Record<string, unknown> = {}) => aStateOfAnyShape(aWorldsFields(over));
  test('buildGameResultRows: none for no world; each realm its rank, score, fate and setup', () => {
    expect(hof.buildGameResultRows(null, { id: 'g1' }, [])).toEqual([]);
    expect(hof.buildGameResultRows({ players: null }, { id: 'g1' }, [])).toEqual([]);
    const rows = hof.buildGameResultRows(
      aWorld({
        players: [...aWorldsFields().players, null],
        mapSize: '',
        seaPct: null,
        gameOver: { byConcession: true, winner: 1, turn: 0, standings: [null, { index: 1, score: '4.6' }] },
      }),
      { id: 9, name: '', meta: { v: 1, mapSize: 'p3' } },
      [
        { player_index: 0, user_id: 'u-1' },
        { player_index: 1, user_id: null },
      ],
    );
    expect(
      rows.map((r) => [r.game_id, r.game_name, r.is_bot, r.bot_difficulty, r.realm, r.race, r.alignment, r.winner]),
    ).toEqual([
      ['9', null, false, null, 'Ash', 'Human', 'Good', false],
      ['9', null, true, 'hard', 'Elm', null, null, true],
    ]);
    expect(rows.map((r) => [r.score, r.victory, r.turns, r.out_turn, r.out_how])).toEqual([
      [0, 'concession', 6, null, 'conceded'],
      [5, 'concession', 6, 3, 'eliminated'],
    ]);
    expect(rows[0]?.setup).toEqual({
      mapSize: 'p3',
      cols: 4,
      rows: 3,
      seaPct: 20,
      realms: 3,
      bots: 1,
      humans: 2,
      difficulty: 'hard',
      diplomacy: 'normal',
    });
    const [plain] = hof.buildGameResultRows(
      aWorld({ world: null, mapSize: 'p9', seaPct: 0, botDiplomacy: 'hostile', turn: 0 }),
      { id: 'g1', name: 'Named' },
      null,
    );
    expect(plain?.setup).toEqual({
      mapSize: 'p9',
      cols: null,
      rows: null,
      seaPct: 0,
      realms: 2,
      bots: 0,
      humans: 2,
      difficulty: 'hard',
      diplomacy: 'hostile',
    });
    expect([plain?.victory, plain?.turns, plain?.game_name, plain?.rank]).toEqual(['unfinished', 0, 'Named', 1]);
    const kinds = [{ byReckoning: 1 }, { byElimination: 1 }, { turn: 4 }].map(
      (gameOver) => hof.buildGameResultRows(aWorld({ gameOver, world: undefined }), { id: 'g1' }, [])[0],
    );
    expect(kinds.map((r) => [r?.victory, r?.turns, r?.setup])).toEqual([
      ['reckoning', 6, expect.objectContaining({ cols: undefined, seaPct: undefined })],
      ['elimination', 6, expect.objectContaining({ cols: undefined })],
      ['other', 4, expect.objectContaining({ rows: undefined })],
    ]);
  });
  test("buildGameResultRows: an id in words as it is, no world's sea, no end's score, a fall at turn 0", () => {
    const [ash, elm] = hof.buildGameResultRows(
      aWorld({
        world: null,
        players: [aWorldsFields().players[0], { ...aWorldsFields().players[1], _eliminatedTurn: 0 }],
      }),
      { id: ' g1 ' },
      [],
    );
    expect([ash?.game_id, ash?.score, elm?.out_turn, elm?.out_how]).toEqual([' g1 ', 0, null, 'eliminated']);
    expect(ash?.setup).toMatchObject({ seaPct: null, cols: null });
  });
  test('backfillGameResults with no results read as none; writeTurnTelemetry with no slots, and its record kept off the game read', async () => {
    answers['finishedGamesStates'] = { data: [{ id: 'g5' }], error: null };
    answers['gamesWithResults'] = { data: null, error: null };
    answers['gameWithRealms'] = { data: { id: 'g5', name: 'Five', game_state: aWorld() }, error: null };
    answers['writeResults'] = { data: null, error: null };
    expect(await quietly(() => hof.backfillGameResults())).toBe(1);
    answers['writeTurns'] = { data: null, error: null };
    expect(await hof.writeTurnTelemetry(aWorld(), { id: 'g1' }, null, statisticsOfAnyShape({}), 6)).toBe(true);
    const [[rows]] = callsTo('writeTurns') as [[{ is_bot: boolean }[]]];
    expect(rows.map((r) => r.is_bot)).toEqual([false, false]);
    answers['results'] = { data: [{ player_index: 0, realm: 'Ash' }], error: null };
    answers['turns'] = { data: [], error: null };
    answers['writeEntries'] = { data: null, error: null };
    const slots = [{ player_index: 0, user_id: 'u-1' }];
    const ended = aWorld({ gameOver: { winner: 0, turn: 6 } });
    expect(await hof.writeTurnTelemetry(ended, { id: 'g1' }, slots, statisticsOfAnyShape({}), 6)).toBe(true);
    expect(callsTo('game')).toEqual([]);
    expect(callsTo('writeEntries')).toHaveLength(1);
  });
  test('writeGameResults and backfillGameResults: none while the table is missing, each game once, its refusals', async () => {
    G['_kcHasTel'] = false;
    expect(await hof.writeGameResults(aWorld(), { id: 'g1' }, [])).toBe(false);
    expect(await hof.backfillGameResults()).toBe(0);
    G['_kcHasTel'] = true;
    expect(await hof.writeGameResults(null, { id: 'g1' }, [])).toBe(false);
    answers['writeResults'] = { data: null, error: { message: 'full' } };
    expect(await hof.writeGameResults(aWorld(), { id: 'g1' }, [])).toBe(false);
    expect(G['_kcTelLastErr']).toBe('full');
    G['currentUser'] = null;
    expect(await hof.backfillGameResults()).toBe(0);
    G['currentUser'] = { id: 'gm-1' };
    answers['finishedGamesStates'] = { data: [], error: null };
    expect(await hof.backfillGameResults()).toBe(0);
    answers['finishedGamesStates'] = { data: [{ id: 'g1' }], error: { message: 'no' } };
    expect(await hof.backfillGameResults()).toBe(0);
    answers['finishedGamesStates'] = {
      data: [{ id: 1 }, { id: 'g2' }, { id: 'g3' }, { id: 'g4' }, { id: 'g5' }],
      error: null,
    };
    answers['gamesWithResults'] = { data: [{ game_id: '1' }], error: null };
    answers['writeResults'] = { data: null, error: null };
    answers['gameWithRealms'] = (...args: unknown[]) => ({
      data:
        args[0] === 'g2'
          ? null
          : {
              id: args[0],
              name: 'A game',
              game_state: args[0] === 'g3' ? '7' : args[0] === 'g4' ? { players: 0 } : aWorld(),
              ...(args[0] === 'g5' ? {} : { game_players: [{ player_index: 0, user_id: 'u-1' }] }),
            },
      error: null,
    });
    expect(await quietly(() => hof.backfillGameResults())).toBe(1);
    expect(callsTo('gamesWithResults')).toEqual([[['1', 'g2', 'g3', 'g4', 'g5']]]);
    expect(callsTo('gameWithRealms').map(([id]) => id)).toEqual(['g2', 'g3', 'g4', 'g5']);
    const [, [written]] = callsTo('writeResults') as [unknown, [{ game_id: string; is_bot: boolean }[]]];
    expect(written.map((r) => [r.game_id, r.is_bot])).toEqual([
      ['g5', false],
      ['g5', false],
    ]);
    answers['gamesWithResults'] = () => {
      throw new Error('x');
    };
    expect(await hof.backfillGameResults()).toBe(0);
  });
  test("writeTurnTelemetry: each realm's turn record, its score and titles, the end's results and record", async () => {
    G['_kcHasTel'] = false;
    expect(await hof.writeTurnTelemetry(aWorld(), { id: 'g1' }, [], {}, 6)).toBe(false);
    G['_kcHasTel'] = true;
    expect(await hof.writeTurnTelemetry({ players: null }, { id: 'g1' }, [], {}, 6)).toBe(false);
    answers['writeTurns'] = { data: null, error: { message: 'no space' } };
    expect(await hof.writeTurnTelemetry(aWorld(), { id: 'g1' }, [], {}, 6)).toBe(false);
    expect(G['_kcTelLastErr']).toBe('no space');
    answers['writeTurns'] = { data: null, error: null };
    const world = aWorld({ players: [...aWorldsFields().players, null], gameOver: { winner: 0, turn: 6 } });
    answers['writeResults'] = { data: null, error: null };
    answers['results'] = () => {
      throw new Error('after');
    };
    const pre = { 1: { gold: 4 } };
    const orders = { 1: [{ action: 'Rest' }] };
    expect(
      await hof.writeTurnTelemetry(
        world,
        { id: 3 },
        [{ player_index: 1, user_id: null }],
        statisticsOfAnyShape({ pre, orders }),
        6,
      ),
    ).toBe(true);
    const all = callsTo('writeTurns');
    const last = all[all.length - 1]?.[0] as Record<string, unknown>[];
    expect(
      last.map((r) => [r['game_id'], r['player_index'], r['is_bot'], r['bot_difficulty'], r['alignment']]),
    ).toEqual([
      ['3', 0, false, null, 'Good'],
      ['3', 1, true, 'hard', null],
    ]);
    expect(last.map((r) => [r['pre'], r['orders']])).toEqual([
      [null, null],
      [{ gold: 4 }, [{ action: 'Rest' }]],
    ]);
    const posts = last.map((r) => r['post'] as Record<string, unknown>);
    expect(posts.map((p) => [p['_score'], p['titles']])).toEqual([
      [
        30,
        [
          { key: 'throne', merit: 5, who: null },
          { key: 'vault', merit: 900, who: null },
        ],
      ],
      [0, undefined],
    ]);
    expect(callsTo('writeResults')).toHaveLength(1);
    expect(G['_kcLbLastErr']).toBe('after');
  });
});

describe('the probe and the banner', () => {
  test("probeLeaderboard: the table there, refused, or the probe thrown; the banner's three states", async () => {
    answers['oneEntrysGame'] = { data: [], error: null };
    expect(await hof.probeLeaderboard()).toBe(true);
    expect(page.getElementById('msg-leaderboard')?.innerHTML).toBe('');
    answers['oneEntrysGame'] = { data: null, error: { message: 'no table' } };
    expect(await quietly(() => hof.probeLeaderboard())).toBe(false);
    expect(page.getElementById('msg-leaderboard')?.textContent).toContain('Leaderboard not active');
    answers['oneEntrysGame'] = () => {
      throw new Error('down');
    };
    expect(await hof.probeLeaderboard()).toBe(false);
    G['_kcHasLb'] = true;
    G['_kcLbLastErr'] = 'a <b>bad</b> write';
    hof.renderLeaderboardBanner();
    expect(page.getElementById('msg-leaderboard')?.textContent).toContain(
      'Leaderboard write failed: a <b>bad</b> write.',
    );
    page.body.innerHTML = '';
    hof.renderLeaderboardBanner();
  });
});

describe('the edges the plants found', () => {
  const ok = { data: null, error: null };
  test("a rank of 0, a score that is no number, a fate in no words; a lair's power in no words", () => {
    const row = hof.buildGameRecords(
      'g30',
      null,
      [],
      [{ player_index: 0, realm: 'Ash', rank: 0, score: NaN, out_turn: 3, out_how: '' }],
      [{ turn: 1, player_index: 0, outcomes: { encounters: { list: [{ power: 5, won: true }] } } }],
      null,
      null,
    );
    expect(row?.standings.map((s) => [s.rank, s.score])).toEqual([[null, 0]]);
    expect(detailOf(theRecord(row), 'earliest_out', 'det')).toEqual(['out']);
    expect(entriesOf(theRecord(row), 'guardian_slain')).toEqual([]);
  });
  test("a record written with nothing handed: the game's state, name and slots read, a given game row kept", async () => {
    answers['results'] = { data: [{ player_index: 0, realm: '' }], error: null };
    answers['turns'] = ok;
    answers['game'] = {
      data: { id: 'g1', name: 'Read', game_state: '{"players":[{}],"botDiplomacy":"hostile"}' },
      error: null,
    };
    answers['writeEntries'] = ok;
    expect(await hof.writeGameRecord('g1')).toBe(true);
    expect(await hof.writeGameRecord('g1', { gameRow: { name: 'Given' } })).toBe(true);
    const written = callsTo('writeEntries').map(
      ([entries]) => (entries as { game_name: string; setup: unknown; standings: unknown; totals: unknown }[])[0],
    );
    expect(written.map((e) => [e?.game_name, e?.setup, e?.standings, e?.totals])).toEqual([
      [
        'Read',
        expect.objectContaining({ diplomacy: 'hostile' }),
        [expect.objectContaining({ realm: null })],
        expect.objectContaining({ events: 0 }),
      ],
      ['Given', expect.objectContaining({ diplomacy: 'hostile' }), expect.anything(), expect.anything()],
    ]);
  });
  test('the rebuild button: no entries read as none; a list of games of the wrong kind, its failure, the button freed', async () => {
    page.body.innerHTML += '<button id="lb-build-btn"></button><span id="lb-build-msg"></span>';
    answers['finishedGames'] = { data: [], error: null };
    answers['resultsGames'] = { data: [{ game_id: 'g1' }], error: null };
    answers['theGameOfEveryEntry'] = ok;
    answers['results'] = { data: [], error: null };
    expect(await hof.backfillGameRecords(false)).toBe(0);
    expect(callsTo('results')).toEqual([['g1']]);
    answers['finishedGames'] = { data: {}, error: null };
    expect(await hof.backfillGameRecords(false)).toBe(0);
    expect(page.getElementById('lb-build-msg')?.textContent).toMatch(/^Failed: .*find is not a function$/);
    expect(Reflect.get(page.getElementById('lb-build-btn') ?? {}, 'disabled')).toBe(false);
  });
});

describe('one hand-made finished game: its entry, value by value', () => {
  // Thornmere (realm 0) and Veyholt (realm 1), three turns; Thornmere wins.
  //   gold       Thornmere 100, 250, 180    Veyholt 300, 120, 90
  //   provinces  Thornmere   3,   5,   6    Veyholt   4,   4,  2
  //   turn 2     Thornmere fights 2, wins 2, kills 5, loses 1; Veyholt fights 2, wins 0, kills 1, loses 5
  // The fuzz below checks that no input crashes the builder or gives a value that is no number; this checks that the
  // right realm holds each record, with the right number and turn: every realm's own best (ruled 2026-10-09), best
  // first, a realm whose best is 0 left out.
  const snap = (gold: number, provinces: number) => ({ gold, provinces, chars: 1, heroes: 0, characters: [] });
  const ev = (turn: number, pi: number, gold: number, prov: number, battles?: object) => ({
    turn,
    player_index: pi,
    is_bot: false,
    realm: pi ? 'Veyholt' : 'Thornmere',
    post: snap(gold, prov),
    outcomes: battles ? { battles: battles } : {},
  });
  const events = [
    ev(1, 0, 100, 3),
    ev(1, 1, 300, 4),
    ev(2, 0, 250, 5, { fought: 2, won: 2, unitsKilled: 5, unitsLost: 1, list: [] }),
    ev(2, 1, 120, 4, { fought: 2, won: 0, unitsKilled: 1, unitsLost: 5, list: [] }),
    ev(3, 0, 180, 6),
    ev(3, 1, 90, 2),
  ];
  const results = [
    {
      game_id: 'g1',
      game_name: 'The Old War',
      player_index: 0,
      is_bot: false,
      realm: 'Thornmere',
      race: 'Human',
      alignment: 'Good',
      rank: 1,
      score: 140,
      winner: true,
      victory: 'reckoning',
      turns: 3,
      setup: { realms: 2, humans: 2, bots: 0 },
      final: snap(180, 6),
    },
    {
      game_id: 'g1',
      game_name: 'The Old War',
      player_index: 1,
      is_bot: false,
      realm: 'Veyholt',
      race: 'Dwarven',
      alignment: 'Neutral',
      rank: 2,
      score: 60,
      winner: false,
      victory: 'reckoning',
      turns: 3,
      setup: { realms: 2, humans: 2, bots: 0 },
      final: snap(90, 2),
    },
  ];
  const players = [
    { player_index: 0, user_id: 'u-ada', display_name: 'Thornmere' },
    { player_index: 1, user_id: 'u-bram', display_name: 'Veyholt' },
  ];
  let row: ARecordBuilt;
  beforeAll(() => {
    const built = theRecord(
      hof.buildGameRecords(
        'g1',
        { id: 'g1', name: 'The Old War', gm_user_id: 'gm-1', max_turns: 12 },
        players,
        results,
        events,
        null,
      ),
    );
    // as the database keeps it: through JSON
    row = JSON.parse(JSON.stringify(built)) as ARecordBuilt;
  });
  /** A record's entries as `pi:v:t`, a missing turn as nothing, joined by spaces. */
  const list = (k: string): string =>
    (row.records[k] ?? []).map((e) => [e.pi, e.v, e.t === undefined ? null : e.t].join(':')).join(' ');

  test('the game lasted three turns', () => {
    expect(row.turns).toBe(3);
  });
  test('standings: Thornmere first and the victor, Veyholt second; each realm points at its player’s account', () => {
    expect(row.standings.map((s) => [s.realm, s.rank, s.winner, s.uid])).toEqual([
      ['Thornmere', 1, true, 'u-ada'],
      ['Veyholt', 2, false, 'u-bram'],
    ]);
  });
  test.each([
    ['richest', '1:300:1 0:250:2', "each realm's own best gold and when, best first"],
    ['most_provinces', '0:6:3 1:4:1', 'a tie later in the game keeps the turn it was first reached'],
    ['battles_won_game', '0:2:', 'a realm that won no battle holds no "battles won" entry'],
    ['kills_game', '0:5: 1:1:', 'units destroyed over the game, per realm'],
    ['losses_game', '1:5: 0:1:', 'units lost over the game, per realm'],
    ['final_score', '0:140:3 1:60:3', 'the final scores, at the last turn'],
    ['final_gold', '0:180:3 1:90:3', 'the gold each realm finished with'],
  ])('%s: %s (%s)', (key, want) => {
    expect(list(key)).toBe(want);
  });
  test('the game’s length counts as a "shortest game" record (lower is better)', () => {
    expect(row.records['shortest_game']?.map((e) => [e.v, e.d])).toEqual([[3, 'min']]);
  });
});

describe("a game's turn rows read in pages on the fake Db: every row once, and a failed page saves nothing", () => {
  // 8 realms × 90 turns = 720 rows: two pages, with the page edge in the middle of a turn. The fake Db (tests/lib/
  // fake-db.ts) serves the pages in the order the Db's function asks; the access layer's test proves that order
  // against the local database.
  const events: { turn: number; player_index: number; is_bot: boolean; realm: string; outcomes: object }[] = [];
  for (let t = 1; t <= 90; t++)
    for (let pi = 0; pi < 8; pi++)
      events.push({ turn: t, player_index: pi, is_bot: false, realm: `Realm ${String(pi)}`, outcomes: {} });
  const results = [{ game_id: 'g1', player_index: 0 }];
  /** The game's record written on the fake Db holding the GM's world (its turn rows and its result). errorFrom: the
   *  first row of the page that fails, as a statement that times out (each page from it on answers the database's
   *  error). Each row served is a copy that, when the builder reads its outcomes, is kept as read. */
  async function writtenOnTheFakeDb(errorFrom: number | null) {
    const world = aGameMastersWorld();
    world.tables.profiles.length = 0;
    events.forEach((e) => world.tables.turn_events.push({ game_id: 'g1', ...e }));
    results.forEach((r) => world.tables.game_results.push({ ...r }));
    const { db } = makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, world);
    const rowsRead = new Set<{ turn?: unknown; player_index?: unknown }>();
    const watched = (served: {
      readonly turn?: unknown;
      readonly player_index?: unknown;
      readonly outcomes?: unknown;
    }) => {
      const copy = { ...served };
      Object.defineProperty(copy, 'outcomes', {
        enumerable: true,
        get: () => {
          rowsRead.add(copy);
          return served.outcomes;
        },
      });
      return copy;
    };
    answers['results'] = async (...args: unknown[]) => await db.theStatistics.theResultsOfThisGame(String(args[0]));
    answers['turns'] = async (...args: unknown[]) => {
      const [game, from, to] = args.map(String);
      if (errorFrom != null && Number(from) >= errorFrom)
        return { data: null, error: { message: 'canceling statement due to statement timeout' }, status: 500 };
      const served = await db.theStatistics.thisGamesTurnRecordsForItsEntryFromRowToRow(
        String(game),
        Number(from),
        Number(to),
      );
      return { ...served, data: served.data ? served.data.map(watched) : served.data };
    };
    answers['notes'] = async (...args: unknown[]) =>
      await db.theHallOfFame.theGameMastersNotesOnThisGamesEntry(String(args[0]));
    answers['writeEntries'] = async (...args: unknown[]) =>
      await db.theHallOfFame.writeTheseEntries(args[0] as Parameters<typeof db.theHallOfFame.writeTheseEntries>[0]);
    answers['names'] = async () => await db.theAccountsNames.theNameOfEveryAccount();
    const saved = await hof.writeGameRecord('g1', {
      gameRow: { id: 'g1' },
      players: [],
      gs: aStateOfAnyShape({ players: [] }),
    });
    const written = callsTo('writeEntries').map(([entries]) => (entries as { totals: { events: number } }[])[0]);
    return { saved, written, rowsRead, calls: world.calls, lastErr: G['_kcLbLastErr'] };
  }

  test('every turn row reaches the record builder, none read twice and none skipped, and the record is saved', async () => {
    const a = await writtenOnTheFakeDb(null);
    expect(a.written.map((e) => e?.totals.events)).toEqual([events.length]);
    expect(a.rowsRead.size).toBe(events.length);
    expect(new Set([...a.rowsRead].map((e) => `${String(e.turn)}/${String(e.player_index)}`)).size).toBe(events.length);
    expect(a.saved).toBe(true);
    expect(a.calls).toContain('game_records.upsert');
  });
  test('a failed page stops the build: no partial record saved over the old one, the failure on the banner', async () => {
    const b = await writtenOnTheFakeDb(500); // the second page fails
    expect(b.saved).toBe(false);
    expect(b.calls).not.toContain('game_records.upsert');
    expect(b.lastErr).toBeTruthy();
  });
});

describe('made-up games of malformed statistics: the builder never throws and gives a storable row', () => {
  // 100 games in the standard run, 3,000 in the full one (npm run test:full): what the fuzz catches, it catches within
  // the first 50 (a mutation check, 2026-10-13); the full run keeps the long tail. Each record key holds a list, every
  // realm's best (ruled 2026-10-09), not one entry.
  const N = process.env['KC_FULL'] === '1' ? 3000 : 100;
  // a fixed seed, so a failure can be reproduced and every run builds the same games
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = <T>(a: readonly T[]): T | undefined => a[Math.floor(rnd() * a.length)];
  const maybe = (v: unknown, p?: number): unknown =>
    rnd() < (p ?? 0.15) ? pick([null, undefined, NaN, '', {}, [], 'nonsense']) : v;

  const TYPES = ['Archers', 'Heavy Horse', 'Galleons', 'Dragons', 'Rocs', 'Whale Cohort', 'Levies', 'Unknown Unit'];
  const QUALS = ['Green', 'Average', 'Veteran', 'Elite', null, 'Bogus'];
  const POWERS = ['Weak', 'Moderate', 'Powerful', 'Legendary', null, ''];
  const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish', null];
  const ALIGNS = ['Divine', 'Good', 'Evil', 'Druidic', null];

  function mkSnapshot(nChars: number) {
    const chars: unknown[] = [];
    for (let i = 0; i < nChars; i++) {
      const units: unknown[] = [];
      const n = Math.floor(rnd() * 9);
      for (let u = 0; u < n; u++)
        units.push({ t: maybe(pick(TYPES)), q: maybe(pick(QUALS)), ...(rnd() < 0.2 ? { sk: 1 } : {}) });
      const skills: Record<string, number> = {};
      ['melee', 'archery', 'tactical', 'white', 'thief'].forEach((k) => {
        if (rnd() < 0.6) skills[k] = Math.floor(rnd() * 10);
      });
      chars.push({
        id: i,
        name: maybe(`Hero ${String(i)}`, 0.1),
        king: i === 0,
        hp: Math.floor(rnd() * 40),
        maxHp: Math.floor(rnd() * 60),
        skills: maybe(skills, 0.1),
        units: maybe(units, 0.08),
        items: maybe(['Ring', 'Blade'].slice(0, Math.floor(rnd() * 3)), 0.1),
      });
    }
    return {
      gold: Math.floor(rnd() * 900),
      provinces: Math.floor(rnd() * 20),
      land: Math.floor(rnd() * 15),
      sea: Math.floor(rnd() * 6),
      tax: Math.floor(rnd() * 60),
      taxShare: Math.round(rnd() * 1000) / 10,
      chars: nChars,
      heroes: nChars - 1,
      ledUnits: Math.floor(rnd() * 30),
      ledStr: Math.floor(rnd() * 400),
      garUnits: Math.floor(rnd() * 20),
      garStr: Math.floor(rnd() * 200),
      units: Math.floor(rnd() * 50),
      str: Math.floor(rnd() * 600),
      items: Math.floor(rnd() * 9),
      relics: Math.floor(rnd() * 3),
      discoveries: Math.floor(rnd() * 12),
      consecrated: Math.floor(rnd() * 4),
      explored: Math.floor(rnd() * 40),
      characters: maybe(chars, 0.06),
    };
  }
  function mkOutcomes(pi: number, nPlayers: number) {
    const battles: unknown[] = [];
    const nb = Math.floor(rnd() * 4);
    for (let i = 0; i < nb; i++) {
      const atk = rnd() < 0.5;
      battles.push({
        ph: Math.floor(rnd() * 5),
        prov: Math.floor(rnd() * 80),
        terrain: pick(['plains', 'forest', 'sea', null]),
        kind: pick(['pvp', 'neutral', 'garrison', 'guard']),
        atkPi: atk ? pi : Math.floor(rnd() * nPlayers),
        defPi: atk ? Math.floor(rnd() * nPlayers) : pi,
        atkStr: maybe(Math.floor(rnd() * 300), 0.1),
        defStr: maybe(Math.floor(rnd() * 300), 0.1),
        S: rnd(),
        atkUnits: Math.floor(rnd() * 12),
        defUnits: Math.floor(rnd() * 12),
        won: rnd() < 0.5,
        atkLost: Math.floor(rnd() * 6),
        defLost: Math.floor(rnd() * 6),
        carry: Math.floor(rnd() * 3),
        side: atk ? 'atk' : 'def',
        win: rnd() < 0.5,
      });
    }
    // (each loop below draws its length again at every step, as the script's did)
    const enc: (Record<string, unknown> & { won: boolean })[] = [];
    for (let i = 0; i < Math.floor(rnd() * 3); i++)
      enc.push({
        ph: 0,
        pi,
        charId: Math.floor(rnd() * 4),
        prov: 1,
        feature: maybe('A lair'),
        guardian: maybe('Wyrm'),
        power: pick(POWERS),
        won: rnd() < 0.6,
        fled: rnd() < 0.2,
        dmg: Math.floor(rnd() * 30),
        hpAfter: Math.floor(rnd() * 30),
        killed: rnd() < 0.1,
        tactics: ['ME'],
      });
    const caps: unknown[] = [];
    for (let i = 0; i < Math.floor(rnd() * 3); i++)
      caps.push({
        prov: i,
        terrain: pick(['plains', 'sea', null]),
        tax: Math.floor(rnd() * 9),
        from: Math.floor(rnd() * nPlayers),
        to: pi,
      });
    const deaths: unknown[] = [];
    for (let i = 0; i < Math.floor(rnd() * 3); i++)
      deaths.push({
        charId: i,
        name: 'X',
        pi: Math.floor(rnd() * nPlayers),
        king: rnd() < 0.2,
        killerPi: pi,
        killerId: Math.floor(rnd() * 4),
        how: 'character',
      });
    const spells: (Record<string, unknown> & { ok: boolean })[] = [];
    for (let i = 0; i < Math.floor(rnd() * 4); i++)
      spells.push({
        pi,
        charId: 1,
        spell: pick(['Fireball', 'Curse', 'Resurrect', null]),
        school: 'Elemental',
        lvl: Math.floor(rnd() * 6),
        chance: Math.floor(rnd() * 100),
        ok: rnd() < 0.6,
      });
    return {
      battles: maybe(
        {
          fought: nb,
          asAttacker: 1,
          won: 1,
          unitsLost: Math.floor(rnd() * 9),
          unitsKilled: Math.floor(rnd() * 9),
          list: battles,
        },
        0.05,
      ),
      encounters: {
        fought: enc.length,
        won: enc.filter((e) => e.won).length,
        fled: 0,
        heroKilled: 0,
        list: maybe(enc, 0.05),
      },
      captures: { gained: caps.length, lost: Math.floor(rnd() * 3), list: caps },
      deaths: { own: Math.floor(rnd() * 2), king: false, killed: deaths.length, list: deaths },
      spells: { cast: spells.length, ok: spells.filter((s) => s.ok).length, list: spells },
      delta: maybe(
        {
          gold: Math.floor(rnd() * 200 - 100),
          provinces: 1,
          tax: 2,
          units: 1,
          str: Math.floor(rnd() * 80 - 20),
          heroes: 0,
          items: 0,
          discoveries: 0,
          explored: 1,
        },
        0.08,
      ),
      rank: 1,
      score: Math.floor(rnd() * 300),
    };
  }
  function mkGame(i: number) {
    const n = 2 + Math.floor(rnd() * 7),
      turns = 1 + Math.floor(rnd() * 22);
    const results: (ARealmsResultAsItsRecordReadsIt | null | undefined)[] = [];
    for (let pi = 0; pi < n; pi++) {
      const result = {
        game_id: `g${String(i)}`,
        game_name: `Game ${String(i)}`,
        player_index: pi,
        is_bot: rnd() < 0.5,
        bot_difficulty: 'hard',
        realm: `Realm ${String(pi)}`,
        race: pick(RACES),
        alignment: pick(ALIGNS),
        rank: pi + 1,
        score: Math.floor(rnd() * 400),
        winner: pi === 0,
        victory: pick(['reckoning', 'elimination', 'concession']),
        turns,
        out_turn: rnd() < 0.3 ? Math.floor(rnd() * turns) + 1 : null,
        out_how: rnd() < 0.3 ? 'eliminated' : null,
        setup: maybe(
          {
            mapSize: 'p5',
            cols: 12,
            rows: 7,
            seaPct: 35,
            realms: n,
            bots: 2,
            humans: n - 2,
            difficulty: 'hard',
            diplomacy: pick(['normal', 'hostile']),
          },
          0.1,
        ),
        final: maybe(mkSnapshot(1 + Math.floor(rnd() * 3)), 0.1),
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      };
      results.push(result);
    }
    const events: (ARealmsTurnAsItsRecordReadsIt | null | undefined)[] = [];
    for (let t = 1; t <= turns; t++)
      for (let pi = 0; pi < n; pi++) {
        if (rnd() < 0.03) continue;
        const event = {
          turn: t,
          player_index: pi,
          is_bot: rnd() < 0.5,
          realm: `Realm ${String(pi)}`,
          race: pick(RACES),
          alignment: pick(ALIGNS),
          post: maybe(mkSnapshot(1 + Math.floor(rnd() * 4)), 0.07),
          outcomes: maybe(mkOutcomes(pi, n), 0.07),
        };
        events.push(event);
      }
    // now and then an empty row among the turns and results, as a failed or partial write could leave
    if (rnd() < 0.1) events.splice(Math.floor(rnd() * (events.length + 1)), 0, pick([null, undefined]));
    if (rnd() < 0.1) results.splice(Math.floor(rnd() * (results.length + 1)), 0, pick([null, undefined]));
    const players: { player_index: number; user_id: string | null; display_name: string | null }[] = [];
    for (let pi = 0; pi < n; pi++)
      players.push({
        player_index: pi,
        user_id: rnd() < 0.5 ? `u${String(pi)}` : null,
        display_name: rnd() < 0.8 ? `Player ${String(pi)}` : null,
      });
    const gameRow =
      rnd() < 0.85
        ? {
            id: `g${String(i)}`,
            name: `Game ${String(i)}`,
            gm_user_id: 'gm-1',
            created_at: new Date().toISOString(),
            max_turns: 20,
          }
        : null;
    const gs =
      rnd() < 0.7
        ? aStateOfAnyShape({
            players: new Array(n).fill(0).map(() => ({})),
            characters: [
              { id: 1, name: 'Aldric' },
              { id: 2, name: 'Bryn' },
            ],
            botDiplomacy: pick(['normal', 'hostile']),
            botDifficulty: 'hard',
            world: { cols: 12, rows: 7 },
          })
        : null;
    return { id: `g${String(i)}`, gameRow, players, results, events, gs };
  }
  /** The standings stood in, as the script's sandbox did: two titles, held by realms 0 and 1 (heroes 1 and 2). */
  const twoTitlesHeld = (): ReturnType<typeof computeStandings> => ({
    titles: {
      throne: { playerIndex: 0, merit: 42, charId: 1, prize: 0, name: 'The Throne' },
      vault: { playerIndex: 1, merit: 17, charId: 2, prize: 0, name: 'The Vaultkeeper' },
    },
    relics: [],
    standings: [],
    taxByPlayer: [],
    worldTax: 0,
    goldByPlayer: [],
    threshold: 0,
    perChar: {},
  });

  test(
    `${String(N)} made-up games: each built without a throw into a row JSON keeps, each record a list of finite values, one a realm`,
    timeLimitForPropertyRuns(N, 50),
    () => {
      vi.mocked(computeStandings).mockImplementation(twoTitlesHeld);
      seed = 12345;
      const problems: string[] = [];
      const keySeen = new Set<string>();
      try {
        for (let i = 0; i < N; i++) {
          const g = mkGame(i);
          let row: ARecordBuilt | null;
          try {
            row = hof.buildGameRecords(g.id, g.gameRow, g.players, g.results, g.events, g.gs);
          } catch (e) {
            problems.push(`CRASH at ${String(i)}: ${String(e)}`);
            continue;
          }
          if (!row) {
            problems.push(`NULL ROW at ${String(i)}`);
            continue;
          }
          let json: string;
          try {
            json = JSON.stringify(row);
          } catch {
            problems.push(`NOT SERIALISABLE at ${String(i)}`);
            continue;
          }
          const m = /.{0,80}(NaN|Infinity|undefined).{0,80}/.exec(json);
          if (m) problems.push(`BAD VALUE at ${String(i)}: …${m[0]}…`);
          if (!row.standings.length) problems.push(`NO STANDINGS at ${String(i)}`);
          if (!isFinite(row.turns)) problems.push(`BAD TURNS at ${String(i)}`);
          for (const [k, entries] of Object.entries(row.records)) {
            keySeen.add(k);
            if (!Array.isArray(entries) || !entries.length) {
              problems.push(`BAD RECORD LIST ${k} at ${String(i)}`);
              continue;
            }
            const pis = entries.map((r) => r.pi);
            if (new Set(pis).size !== pis.length) problems.push(`TWO ENTRIES FOR ONE REALM ${k} at ${String(i)}`);
            for (const r of entries) {
              if (!isFinite(r.v)) {
                problems.push(`BAD RECORD ${k} at ${String(i)}`);
                continue;
              }
              if (!['min', 'max'].includes(r.d)) problems.push(`BAD DIR ${k} at ${String(i)}`);
            }
          }
        }
      } finally {
        vi.mocked(computeStandings).mockRestore();
      }
      expect(problems).toEqual([]);
      // the stood-in standings were reached: its two titles are records (a stand-in reaches only calls from other files)
      expect([...keySeen]).toEqual(expect.arrayContaining(['title_throne', 'title_vault']));
    },
  );
  test('no game, no results or one bare result: no throw', () => {
    const anIdOfAnyKind = (id: unknown) => id as string;
    const aResultOfAnyShape = (r: object) => r as ARealmsResultAsItsRecordReadsIt;
    const aBareResult = { game_id: 'g', player_index: 0, turns: 1, setup: {}, final: {} };
    expect(() => hof.buildGameRecords(anIdOfAnyKind(null), null, [], [], [], null)).not.toThrow();
    expect(() => hof.buildGameRecords('g', null, [], [], [], null)).not.toThrow();
    expect(() => hof.buildGameRecords('g', {}, [], [aResultOfAnyShape(aBareResult)], [], null)).not.toThrow();
  });
});

describe("every realm's own best for each record, a fallen hero's peaks and a title held then lost (ruling R-087)", () => {
  // Until plan P1-14z the unit half of the script leaderboard-realm-bests: its made-up game is tests/lib/a-finished-
  // game-of-two-realms-each-holding-its-own-best.ts, which says what happens in it; computeStandings is stood in for it
  // (as the script's sandbox did), so Ashvale holds The Throne at the end.
  let row: ARecordBuilt;
  beforeAll(() => {
    const g = theGameOfTwoRealmsEachHoldingItsOwnBest;
    vi.mocked(computeStandings).mockImplementation(theThroneHeldByAshvale);
    try {
      row = theRecord(
        hof.buildGameRecords('g1', g.gameRow, g.players, g.results, g.events, aStateOfAnyShape(g.gs), g.names),
      );
    } finally {
      vi.mocked(computeStandings).mockRestore();
    }
  });
  /** Realm `pi`'s entry in record `key`, or none. */
  const entryOf = (key: string, pi: number) => (row.records[key] ?? []).find((e) => e.pi === pi);

  test('a record holds a list of entries, one per realm, best first', () => {
    expect(Array.isArray(row.records['biggest_battle'])).toBe(true);
    expect(row.records['biggest_battle']?.[0]?.pi).toBe(0);
  });
  test("each realm keeps its own biggest battle: Ashvale's 500, and Brindmoor's 200 though Ashvale's was bigger", () => {
    expect(entryOf('biggest_battle', 0)?.v).toBe(500);
    expect(entryOf('biggest_battle', 1)?.v).toBe(200);
  });
  test('a hero who fell that turn still counts for his Melee 9 and his 88 maximum HP', () => {
    expect([entryOf('sk_melee', 1)?.v, entryOf('sk_melee', 1)?.['who']]).toEqual([9, 'Sir Fallowmere']);
    expect(entryOf('hardiest', 1)?.v).toBe(88);
  });
  test('a title held for a turn and lost is recorded for its holder, as is the holder at the end of the game', () => {
    expect(entryOf('title_throne', 1)?.v).toBe(30);
    expect(entryOf('title_throne', 0)?.v).toBe(42);
  });
});
