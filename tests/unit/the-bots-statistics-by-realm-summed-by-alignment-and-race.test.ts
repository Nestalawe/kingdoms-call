// The bots' statistics (B-17d, BOT-S1 and S2: tools/balance/the-bots-statistics-by-realm-summed-by-alignment-and-race.ts):
// each bot realm's figures of a game summed by its alignment and by its race, each a [sum, count] statistic the noise
// rule judges as any slice; the vm half's ability uses joined to the page's games by id and seat (run.ts); and the
// balance report, which counts a statistic only one side has as no difference and leads its bots' section with its
// answer in game terms (BOT-X7).
// Level 1 (unit): the summing, the join and the report are pure functions of made-up records; the matrix plays them
// only as a whole, and a baseline can't say which sum went wrong. Every input a seed could change is pinned here.
import { describe, expect, test } from 'vitest';
import type { TheBotsRecordOfARealmsTurn } from '../../src/engine/bots/the-bots-record-of-their-choices-per-realm-per-turn-kept-outside-the-save.ts';
import { readBaseline, type KeptGame, type ReportsResult } from '../../tools/balance/baseline.ts';
import { labelOf } from '../../tools/balance/labels.ts';
import { matrix, type GameSpec } from '../../tools/balance/matrix.ts';
import { buildReport, compareGames, renderReport, theBotsStatisticsInBrief } from '../../tools/balance/report.ts';
import { theGamesWithTheBotsStatisticsJoined } from '../../tools/balance/run.ts';
import { baseOf, type TelemetryRow } from '../../tools/balance/stats.ts';
import {
  ORDERS_GIVEN,
  THE_KINDS_OF_ORDER,
  theBotRealmsOfAGame,
  theBotsStatisticsOfTheAbilities,
  theBotsStatisticsOfThePageHalf,
} from '../../tools/balance/the-bots-statistics-by-realm-summed-by-alignment-and-race.ts';
import type { GameResult } from '../../tools/balance/play.ts';

/** A made-up game of four realms: Divine Humans at seats 0 and 2, Neutral Elves at seats 1 and 3. */
const A_GAME: GameSpec = {
  id: 'bots-made-up',
  group: 'bots',
  seed: 1,
  realms: 4,
  seaPct: 20,
  diplomacy: 'normal',
  races: ['Human', 'Elven'],
  alignments: ['Divine', 'Neutral'],
};
const REALMS = theBotRealmsOfAGame(A_GAME);

const aRow = (realm: number, turn: number, gold: number, orders: string[]): TelemetryRow => ({
  turn,
  player_index: realm,
  orders: { chars: { '1': { ph: orders.map((a) => ({ a })) } } },
  pre: { gold: 0, provinces: 1, str: 0 },
  post: { gold, provinces: 1, str: 0 },
  outcomes: {
    battles: { list: [] },
    encounters: { list: [] },
    deaths: { list: [] },
    spells: { list: [] },
    delta: { items: 0 },
  },
});
const aRecord = (realm: number, over: Partial<TheBotsRecordOfARealmsTurn>): TheBotsRecordOfARealmsTurn => ({
  turn: 1,
  realm,
  hygiene: {},
  padding: {},
  phasesLeftEmpty: 0,
  idle: [],
  casts: [],
  ...over,
});

describe('the bot realms of a game', () => {
  test('each seat takes its alignment and race by index, and a scripted game leaves out its scripted realm', () => {
    expect(REALMS).toEqual([
      { realm: 0, alignment: 'Divine', race: 'Human' },
      { realm: 1, alignment: 'Neutral', race: 'Elven' },
      { realm: 2, alignment: 'Divine', race: 'Human' },
      { realm: 3, alignment: 'Neutral', race: 'Elven' },
    ]);
    expect(theBotRealmsOfAGame({ ...A_GAME, group: 'scripted' }).map((r) => r.realm)).toEqual([1, 2, 3]);
  });
});

describe("the page half's figures, by alignment and race", () => {
  const s = theBotsStatisticsOfThePageHalf(
    REALMS.filter((r) => r.realm !== 3),
    [
      aRow(0, 1, 10, ['move', 'move', 'defend']),
      aRow(0, 2, 20, ['move']),
      aRow(1, 1, 30, ['broker']),
      aRow(2, 1, 0, []),
      // seat 3 is no bot here: its row counts for nothing
      aRow(3, 1, 999, ['move', 'pursue']),
    ],
    [
      aRecord(0, {
        hygiene: { practiceCapped: 2, overLimit: 1, handoverTrimmed: 5 },
        padding: { hold: 2, 'hold-the-post': 1 },
        phasesLeftEmpty: 1,
        idle: [
          { hero: 1, phases: 1 },
          { hero: 2, phases: 3 },
        ],
        casts: [
          { hero: 1, school: 'Fire', limit: 2, limitTheHygieneApplies: 3, casts: 1 },
          { hero: 1, school: 'Air', limit: 1, limitTheHygieneApplies: 1, casts: 0 },
          { hero: 2, school: 'Fire', limit: 1, limitTheHygieneApplies: 1, casts: 0 },
        ],
      }),
      aRecord(1, { hygiene: { hireUnaffordable: 1 } }),
      aRecord(3, { hygiene: { practiceCapped: 50 }, padding: { 'lie-low': 4 } }),
    ],
  );
  test('the orders given, by kind: a realm of the slice without one counts 0', () => {
    expect(s['bots: orders given: move | by alignment: Divine'], 'the Divine realms (0 and 2)').toEqual([3, 2]);
    expect(s['bots: orders given: move | by alignment: Neutral'], 'the Neutral realm 1 (3 is no bot)').toEqual([0, 1]);
    expect(s['bots: orders given: broker | by race: Elven']).toEqual([1, 1]);
    expect(s['bots: orders given: defend | by race: Human']).toEqual([1, 2]);
  });
  test("the orders the hygiene dropped, by reason and in all: its changes aren't drops", () => {
    expect(s['bots: orders the hygiene dropped | by alignment: Divine']).toEqual([3, 2]);
    expect(s['bots: orders the hygiene dropped: practiceCapped | by alignment: Divine']).toEqual([2, 2]);
    expect(s['bots: orders the hygiene dropped: hireUnaffordable | by alignment: Neutral']).toEqual([1, 1]);
    expect(Object.keys(s).some((k) => k.includes('handoverTrimmed'))).toBe(false);
  });
  test('the phases with nothing else to do: every padding kind and the phases left empty', () => {
    expect(s['bots: phases with nothing else to do | by alignment: Divine']).toEqual([4, 2]);
    expect(s['bots: phases with nothing else to do: hold | by race: Human']).toEqual([2, 2]);
    expect(s['bots: phases with nothing else to do: left empty | by race: Human']).toEqual([1, 2]);
  });
  test('every kind of order and of padding is in every game: 0 where none was given, a seat that is no bot counting none', () => {
    expect(s['bots: orders given: blockade | by alignment: Divine'], 'a kind no bot gave').toEqual([0, 2]);
    expect(s['bots: orders given: pursue | by race: Elven'], "seat 3's only").toEqual([0, 1]);
    expect(s['bots: phases with nothing else to do: lie-low | by alignment: Neutral'], "seat 3's only").toEqual([0, 1]);
    expect(s['bots: phases with nothing else to do: hold-with-the-host | by alignment: Divine']).toEqual([0, 2]);
    expect(s['bots: orders the hygiene dropped: hireGone | by race: Human']).toEqual([0, 2]);
  });
  test("the casts left unused: a hero's room under his limits, no more than his phases with nothing else to do", () => {
    // hero 1: room 2 (Fire) + 1 (Air), 1 idle phase: 1; hero 2: room 1, 3 idle phases: 1
    expect(s['bots: casts left unused | by alignment: Divine']).toEqual([2, 2]);
    expect(s['bots: room under the cast limits | by alignment: Divine'], 'summed over his schools').toEqual([4, 2]);
  });
  test("the gold unspent at a turn's end: a mean per realm and turn", () => {
    expect(s["bots: gold unspent at a turn's end | by alignment: Divine"]).toEqual([30, 3]);
    expect(s["bots: gold unspent at a turn's end | by race: Elven"]).toEqual([30, 1]);
  });
  test('every figure has a label in game terms', () => {
    for (const key of Object.keys(s)) expect(labelOf(key), key).toBeDefined();
  });
});

test('every kind of order the committed baselines hold is on the fixed list, so none hangs on the run', () => {
  for (const set of ['A', 'B'] as const)
    for (const key of Object.keys(readBaseline(set)[0]?.stats ?? {}))
      if (key.startsWith(ORDERS_GIVEN))
        expect(THE_KINDS_OF_ORDER, `set ${set}: ${key}`).toContain(baseOf(key).slice(ORDERS_GIVEN.length));
});

describe("the abilities' figures, for the realms of each ability's alignment", () => {
  const s = theBotsStatisticsOfTheAbilities(REALMS, {
    consecrate: { 0: 2, 2: 1 },
    'the-neutral-mercenary-discount': {},
    // a use by a realm of another alignment counts for nothing
    broker: { 0: 7 },
  });
  test("a use counts under its own alignment's realms, by alignment and by race", () => {
    expect(s['bots: ability used: consecrate | by alignment: Divine']).toEqual([3, 2]);
    expect(s['bots: ability used: consecrate | by race: Human']).toEqual([3, 2]);
    expect(s['bots: ability used: consecrate | by alignment: Neutral'], 'not a Neutral ability').toBeUndefined();
    expect(s['bots: ability used: consecrate | by race: Elven'], 'no Divine Elves').toBeUndefined();
    expect(s['bots: ability used: the-neutral-mercenary-discount | by alignment: Neutral']).toEqual([0, 2]);
    expect(s['bots: ability used: broker | by alignment: Neutral']).toEqual([0, 2]);
  });
  test('a stand-in has a base of its own, and an ability not countable yet has none', () => {
    expect(Object.keys(s).filter((k) => k.includes('righteous-defence'))).toEqual([]);
    const undead = theBotsStatisticsOfTheAbilities([{ realm: 0, alignment: 'Undead', race: 'Human' }], {});
    expect(Object.keys(undead).filter((k) => k.startsWith("bots: an ability's stand-in: "))).not.toEqual([]);
    for (const key of Object.keys(undead)) expect(labelOf(key), key).toBeDefined();
  });
});

describe("run.ts's join of the two halves", () => {
  const [spec] = matrix('A');
  if (!spec) throw new Error('the matrix has no game');
  const aPageGame = (stats: GameResult['stats']): GameResult => ({ id: spec.id, turns: [], results: '', stats, ms: 0 });
  const aVmGame = (abilityUses: ReportsResult['abilityUses']): ReportsResult => ({
    id: spec.id,
    turns: [],
    sections: {},
    states: [],
    reports: 0,
    leaks: [],
    ...(abilityUses ? { abilityUses } : {}),
    ms: 0,
  });
  const realms = theBotRealmsOfAGame(spec);
  const first = realms[0];
  if (!first) throw new Error('the game has no bot realm');
  test("the vm half's uses join the page's game of the same id, by seat", () => {
    const [joined] = theGamesWithTheBotsStatisticsJoined(
      'A',
      [aPageGame({ 'battles: fought': [1, 1] })],
      [aVmGame({ consecrate: { [first.realm]: 4 } })],
    );
    const divine = realms.filter((r) => r.alignment === 'Divine').length;
    expect(joined?.stats['battles: fought'], "the page's own figures stay").toEqual([1, 1]);
    expect(joined?.stats['bots: ability used: consecrate | by alignment: Divine']).toEqual([
      first.alignment === 'Divine' ? 4 : 0,
      divine,
    ]);
  });
  test("without the vm half, no ability's figure", () => {
    const [joined] = theGamesWithTheBotsStatisticsJoined('A', [aPageGame({})], null);
    expect(Object.keys(joined?.stats ?? {}).some((k) => k.startsWith('bots: ability'))).toBe(false);
  });
});

describe('the balance report', () => {
  const aGame = (id: string, stats: KeptGame['stats']): KeptGame => ({ id, turns: ['a b'], results: '', stats });
  const BASE = [aGame('bots-00', { 'battles: fought': [2, 1] })];
  const DIVINE = 'bots: ability used: consecrate | by alignment: Divine';
  test('a statistic only the branch has is no difference: the class stays "no change", with its bots\' section', () => {
    const head = [aGame('bots-00', { 'battles: fought': [2, 1], [DIVINE]: [0, 1] })];
    expect(compareGames(BASE, head)).toEqual([]);
    const report = buildReport({ base: BASE, head });
    expect(report.class).toBe('no change');
    expect(report.statistics.added).toEqual(['bots: ability used: consecrate']);
    const text = renderReport(report);
    expect(text).toContain("### The bots' choices, by alignment and race");
    expect(text).toContain('1 statistics (1 figures with their slices) are new in this pull request');
  });
  test('within the group, a kind that goes from every game is judged and reported, never retired', () => {
    // 40 made-up bot games; the bots stop blockading in all of them (0, as the fixed list of kinds keeps it); 10 of
    // the games played out differently
    const BLOCKADE = 'bots: orders given: blockade | by alignment: Divine';
    const ids = Array.from({ length: 40 }, (_, i) => `bots-${String(i).padStart(2, '0')}`);
    const base = ids.map((id) => aGame(id, { [BLOCKADE]: [3, 1], [DIVINE]: [1, 1] }));
    const head = ids.map((id, i) => ({
      ...aGame(id, { [BLOCKADE]: [0, 1], [DIVINE]: [1, 1] }),
      ...(i < 10 ? { turns: ['c b'] } : {}),
    }));
    const report = buildReport({ base, head });
    expect(report.statistics.retired, 'the group is on both sides: nothing retired').toEqual([]);
    expect(
      compareGames(base, head).filter((c) => c.stats.includes(BLOCKADE)),
      'every game differs by it',
    ).toHaveLength(40);
    expect(report.class).toBe('rule change');
    expect(report.slices.map((l) => l.key)).toContain(BLOCKADE);
  });
  test('the whole group gone from the branch is retired, by base and in figures', () => {
    const base = [aGame('bots-00', { 'battles: fought': [2, 1], [DIVINE]: [0, 1] })];
    const head = [aGame('bots-00', { 'battles: fought': [2, 1] })];
    expect(compareGames(base, head)).toEqual([]);
    expect(buildReport({ base, head }).statistics).toEqual({
      added: [],
      retired: ['bots: ability used: consecrate'],
      figures: { added: 0, retired: 1 },
    });
  });
  test('a statistic both sides have still differs', () => {
    const base = [aGame('bots-00', { 'battles: fought': [2, 1], [DIVINE]: [0, 1] })];
    const head = [aGame('bots-00', { 'battles: fought': [2, 1], [DIVINE]: [1, 1] })];
    expect(compareGames(base, head).map((c) => c.stats)).toEqual([[DIVINE]]);
  });
  test("its bots' section leads with its answer: the abilities used, and those never used by name", () => {
    const games = [
      aGame('bots-00', {
        [DIVINE]: [2, 1],
        'bots: ability used: consecrated-ground-tax | by alignment: Divine': [1, 1],
        'bots: ability used: the-neutral-mercenary-discount | by alignment: Neutral': [0, 1],
      }),
      aGame('bots-01', {
        [DIVINE]: [0, 1],
        'bots: ability used: consecrated-ground-tax | by alignment: Divine': [3, 1],
      }),
      aGame('scripted-00', { 'bots: ability used: the-neutral-mercenary-discount | by alignment: Neutral': [9, 1] }),
    ];
    const [lead, least] = theBotsStatisticsInBrief(games);
    expect(lead).toBe(
      'In the 2 computer-played games, the bots used 2 of the 46 alignment abilities counted by their use; never ' +
        'used: the neutral mercenary discount (the Neutral realms, in none of the 1 games they played).',
    );
    expect(least).toBe("The least used of each alignment's: the Divine realms used consecrate in 1 of 2 games.");
    expect(theBotsStatisticsInBrief([aGame('bots-00', { 'battles: fought': [1, 1] })]), 'no bots statistics').toEqual(
      [],
    );
  });
});
