// The GM page's statistics tab on the values handed it (plan P1-16r): the lines P1-16r changed in
// src/ui/gm/stats-tab.ts that the screen tours and the matrix don't reach, or reach only in part, each pinned to the
// value it gave before the file was typed: the four exports (the turns, the battles and the results as CSV, the turns as
// JSON for the bots' training), "Forget deleted games' data", the load's refusals and its empty answers, the filters, and
// the cards' counts and words on odd statistics (words where numbers were, a battle with no defender, a unit led but
// never recruited, an order only the bots give). Level 1 (unit): the file imports in Node once the page's config, the
// `supabase` global and a Db handed in are stood in (as the Hall of Fame's unit test does); a page test would boot the
// whole page and sign in to reach each of them, and the downloads need the browser's Blob and URL stood in anyway.
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.ts';

interface AnAnswer {
  data: unknown;
  error: { message: string } | null;
}
/** What each of the stood-in Db's functions answers, by its name. */
const answers: Record<string, AnAnswer> = {};
/** Each call the page made on the stood-in Db: its function's name and its arguments. */
const calls: [string, unknown[]][] = [];
const answering =
  (name: string) =>
  (...args: unknown[]): Promise<AnAnswer> => {
    calls.push([name, args]);
    return Promise.resolve(answers[name] ?? { data: [], error: null });
  };
const callsTo = (name: string): unknown[][] => calls.filter(([n]) => n === name).map(([, args]) => args);

let page: Document;
let st: typeof import('../../src/ui/gm/stats-tab.ts');
/** The page's declared globals, as the GM page's files read them by their bare names. */
const G = globalThis as unknown as Record<string, unknown>;
/** Each file the page handed the browser to download: its type and its words. */
const downloads: { type: string; text: string }[] = [];
/** What the page said in an alert, and what the GM answers each confirm. */
const alerts: string[] = [];
let confirmAnswer = true;

beforeAll(async () => {
  const { window } = bootJsdom('<!doctype html><html><body></body></html>');
  const W = window as unknown as Window & Record<string, unknown>;
  page = W.document;
  const theDb = {
    theDatabasesVersion: {},
    theStatistics: {
      everyTurnRecordFromRowToRow: answering('turns'),
      everyResultFromRowToRow: answering('results'),
      deleteTheseGamesTurnRecords: answering('deleteTurns'),
      deleteTheseGamesResults: answering('deleteResults'),
    },
    theHallOfFamesGames: {
      everyGamesNameStatusAndTurn: answering('everyGame'),
      theNameStatusAndTurnOfTheGamesThisGameMasterRuns: answering('myGames'),
      whichOfTheseGamesStillExist: answering('stillExist'),
    },
    theHallOfFame: { deleteTheseGamesEntries: answering('deleteEntries') },
  };
  /** A file to download, as the page makes one: its words joined, and its type. */
  class ABlobStoodIn {
    readonly text: string;
    readonly type: string;
    constructor(parts: string[], options: { type: string }) {
      this.text = parts.join('');
      this.type = options.type;
    }
  }
  Object.assign(globalThis, {
    window: W,
    document: page,
    HTMLElement: W['HTMLElement'],
    HTMLSelectElement: W['HTMLSelectElement'],
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    kcTheDbATestHandsThePage: theDb,
    Blob: ABlobStoodIn,
    alert: (words: string) => alerts.push(words),
    confirm: () => confirmAnswer,
  });
  Object.assign(URL, {
    createObjectURL: (b: ABlobStoodIn) => {
      downloads.push({ type: b.type, text: b.text });
      return 'blob:made-up';
    },
    revokeObjectURL: () => undefined,
  });
  // a click on the download's link would navigate, which jsdom doesn't do
  Object.assign((window as unknown as typeof globalThis).HTMLAnchorElement.prototype, { click: () => undefined });
  st = await import('../../src/ui/gm/stats-tab.ts');
});
const TAB = `<section id="sec-stats"></section><div id="stats-msg"></div>
<select id="stats-game"><option value="">All games</option></select>
<select id="stats-who"><option value="">Humans and bots</option><option value="human">Humans</option><option value="bot">Bots</option></select>
<select id="stats-diff"><option value="">Any</option><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select>
<select id="stats-fin"><option value="">All</option><option value="finished">Finished</option><option value="running">Running</option></select>
<div id="stats-body"></div>`;
beforeEach(() => {
  calls.length = 0;
  downloads.length = 0;
  alerts.length = 0;
  confirmAnswer = true;
  for (const k of Object.keys(answers)) Reflect.deleteProperty(answers, k);
  page.body.innerHTML = TAB;
  G['currentUser'] = { id: 'gm-1' };
  G['_kcHasTel'] = true;
  G['_kcHasLb'] = true;
  Object.assign(st._stats, { rows: null, results: null, games: null, loadedAt: 0 });
});

/** A realm's turn record as the database answers it, any of its fields of any shape. */
const aTurn = (game: string, turn: number, pi: number, extra: Record<string, unknown> = {}) => ({
  game_id: game,
  turn,
  player_index: pi,
  is_bot: false,
  bot_difficulty: null,
  realm: `Realm ${String(pi)}`,
  race: 'Elf',
  alignment: 'Good',
  orders: null,
  pre: null,
  post: null,
  outcomes: null,
  ...extra,
});
/** A realm's result in a finished game as the database answers it. */
const aResult = (game: string, pi: number, extra: Record<string, unknown> = {}) => ({
  game_id: game,
  game_name: null,
  player_index: pi,
  realm: `Realm ${String(pi)}`,
  is_bot: false,
  bot_difficulty: null,
  race: 'Elf',
  alignment: 'Good',
  rank: pi + 1,
  score: 10,
  winner: pi === 0,
  victory: 'turns',
  turns: 9,
  out_turn: null,
  out_how: null,
  setup: null,
  final: null,
  ...extra,
});
/** The tab's statistics held as a load leaves them, then read through the filters as they stand. */
function theTabHolding(rows: object[], results: object[] = [], games: object[] = []): void {
  Object.assign(st._stats, { rows, results, games, loadedAt: Date.now() });
}
const theBody = (): string => page.getElementById('stats-body')?.innerHTML ?? '';
const theMessage = (): string => page.getElementById('stats-msg')?.innerHTML ?? '';
/** The words of the page's statistics, its markup taken out. */
const theWordsOfTheBody = (): string =>
  theBody()
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
function theFilters(who: string, diff: string, fin: string): void {
  for (const [id, value] of [
    ['stats-who', who],
    ['stats-diff', diff],
    ['stats-fin', fin],
  ] as const) {
    const sel = page.getElementById(id);
    if (sel instanceof HTMLSelectElement) sel.value = value;
  }
}
/** The one file downloaded, or the test stops. */
function theDownload(): { type: string; text: string } {
  const [one, ...more] = downloads;
  if (!one || more.length) throw new Error(`${String(downloads.length)} downloads`);
  return one;
}

describe('the readers of the statistics', () => {
  test('a JSON column parsed: words read as JSON, bad words and none as null, any other value as it is', () => {
    expect(st._statsJ('{"gold":3}')).toEqual({ gold: 3 });
    expect(st._statsJ('{bad')).toBeNull();
    expect(st._statsJ(null)).toBeNull();
    expect(st._statsJ(undefined)).toBeNull();
    const held = { gold: 4 };
    expect(st._statsJ(held)).toBe(held);
    expect(st._statsJ(0)).toBe(0);
  });
  test("a field of a value or of nothing, a list or nothing walked, a value's values and its own fields", () => {
    expect(st.theFieldOfAValueOrOfNothing({ gold: 2 }, 'gold')).toBe(2);
    expect(st.theFieldOfAValueOrOfNothing(null, 'gold')).toBeUndefined();
    expect(st.theFieldOfAValueOrOfNothing(0, 'gold')).toBeUndefined();
    expect(st.theFieldOfAValueOrOfNothing('abc', 'length')).toBe(3);
    expect(st.theListOrNothingToWalk(null)).toEqual([]);
    expect(st.theListOrNothingToWalk('')).toEqual([]);
    const list = [1];
    expect(st.theListOrNothingToWalk(list)).toBe(list);
    expect(() => st.theListOrNothingToWalk({ a: 1 })).toThrow(TypeError);
    expect(() => st.theListOrNothingToWalk('ab')).toThrow(TypeError);
    expect(st.theValuesOf({ a: 1, b: 'x' })).toEqual([1, 'x']);
    expect(st.theValuesOf('ab')).toEqual(['a', 'b']);
    expect(() => st.theValuesOf(null)).toThrow(TypeError);
    expect(() => st.theValuesOf(undefined)).toThrow(TypeError);
    expect(st.theOwnFieldsOf(null)).toEqual({});
    expect(st.theOwnFieldsOf(undefined)).toEqual({});
    expect(st.theOwnFieldsOf('ab')).toEqual({ 0: 'a', 1: 'b' });
    expect(st.theOwnFieldsOf({ a: 1 })).toEqual({ a: 1 });
  });
  test('a share and a mean: none of none is 0; a mean adds as `+` does (a count held as words joins as words)', () => {
    expect(st._pct(1, 0)).toBe(0);
    expect(st._pct(1, 3)).toBe(33);
    expect(st._avg([])).toBe(0);
    expect(st._avg([1, 2])).toBe(1.5);
    // 0 + '3' + 4 is '034', read as 34, over 2
    expect(st._avg(['3', 4])).toBe(17);
    expect(st._avg([1, undefined])).toBeNaN();
    expect(st._avg([null, 4])).toBe(2);
  });
  test('the filters on no statistics loaded give no rows', () => {
    expect(st._statsFilter()).toEqual({ rows: [], results: [], allRows: [] });
    expect(st._statsFinished('g-1')).toBe(false);
  });
});

describe('the load', () => {
  test('with no telemetry tables the tab says so and empties the cards', async () => {
    G['_kcHasTel'] = false;
    const body = page.getElementById('stats-body');
    if (body) body.innerHTML = 'old cards';
    await st.openStats(true);
    expect(theMessage()).toContain('Telemetry is not active');
    expect(theBody()).toBe('');
    expect(calls).toEqual([]);
  });
  test("a refusal of the turns, or of the results, is the load's message", async () => {
    answers['turns'] = { data: null, error: { message: 'the turns were refused' } };
    await st.openStats(true);
    expect(theMessage()).toContain('Could not load statistics: the turns were refused');
    answers['turns'] = { data: [aTurn('g-1', 1, 0)], error: null };
    answers['results'] = { data: null, error: { message: 'the results were refused' } };
    await st.openStats(true);
    expect(theMessage()).toContain('Could not load statistics: the results were refused');
  });
  test('a refusal with no words is shown as the value thrown', async () => {
    answers['turns'] = { data: null, error: { message: '' } };
    await st.openStats(true);
    expect(theMessage()).toContain('Could not load statistics: [object Object]');
  });
  test('signed in as no one, the load stops with the read of the account', async () => {
    G['currentUser'] = null;
    await st.openStats(true);
    expect(theMessage()).toContain("Could not load statistics: Cannot read properties of null (reading 'id')");
  });
  test('an answer of no rows and no games is none; a game is named from the games, else its result, else its id', async () => {
    answers['turns'] = { data: null, error: null };
    answers['results'] = { data: null, error: null };
    answers['myGames'] = { data: null, error: null };
    await st.openStats(true);
    expect(st._stats.rows).toEqual([]);
    expect(st._stats.results).toEqual([]);
    expect(st._stats.games).toEqual([]);
    expect(theBody()).toContain('No recorded turns match these filters yet');
    answers['turns'] = {
      data: [aTurn('g-named-1', 1, 0), aTurn('g-result-2', 1, 0), aTurn('g-gone-33', 1, 0), aTurn('g-empty-4', 1, 0)],
      error: null,
    };
    answers['results'] = {
      data: [
        aResult('g-result-2', 0, { game_name: 'From Its Result' }),
        aResult('g-named-1', 0, { game_name: 'Not Me' }),
      ],
      error: null,
    };
    answers['myGames'] = {
      data: [
        { id: 'g-named-1', name: 'The Named Game', status: 'active', turn: 2 },
        { id: 'g-empty-4', name: '', status: 'active', turn: 2 },
      ],
      error: null,
    };
    await st.openStats(true);
    const options = [...page.querySelectorAll('#stats-game option')].map((o) => o.textContent);
    expect(options).toEqual([
      'All games',
      'The Named Game ✓',
      'From Its Result ✓',
      'deleted game g-gone-3',
      'deleted game g-empty-',
    ]);
    expect(callsTo('myGames')).toEqual([['gm-1'], ['gm-1']]);
  });
  test('the rows a load kept are read again unless they are old or the GM reloads: games or results none', async () => {
    theTabHolding([aTurn('g-1', 1, 0)]);
    Object.assign(st._stats, { results: null, games: null });
    await st.openStats();
    expect(calls).toEqual([]);
    const options = [...page.querySelectorAll('#stats-game option')].map((o) => o.textContent);
    expect(options).toEqual(['All games', 'deleted game g-1']);
    expect(theWordsOfTheBody()).toContain('1 realm-turns (1 human · 0 bot)');
  });
  test('the JSON columns arrive as words and are parsed', async () => {
    answers['turns'] = {
      data: [aTurn('g-1', 1, 0, { post: '{"gold":7}', outcomes: '{bad' })],
      error: null,
    };
    answers['results'] = { data: [aResult('g-1', 0, { setup: '{"realms":4}', final: 'null' })], error: null };
    await st.openStats(true);
    expect(st._stats.rows?.[0]?.post).toEqual({ gold: 7 });
    expect(st._stats.rows?.[0]?.outcomes).toBeNull();
    expect(st._stats.results?.[0]?.setup).toEqual({ realms: 4 });
    expect(st._stats.results?.[0]?.final).toBeNull();
  });
});

describe('the cards', () => {
  const twoGames = () => [
    aTurn('g-1', 1, 0, { is_bot: true, bot_difficulty: 'easy', post: { provinces: 2 } }),
    aTurn('g-1', 1, 1, { post: { provinces: 4 } }),
    aTurn('g-2', 1, 0, { is_bot: true, bot_difficulty: 'hard', post: { provinces: 6 } }),
    aTurn('g-2', 2, 1, { post: { provinces: 8 } }),
    aTurn('g-2', 3, 0, { is_bot: true, bot_difficulty: 'easy', post: { provinces: 1 } }),
  ];
  test('the filters: bots of one difficulty, humans, finished games, running games', () => {
    theTabHolding(twoGames(), [aResult('g-1', 0, { is_bot: true, bot_difficulty: 'easy' }), aResult('g-1', 1)]);
    theFilters('bot', 'easy', '');
    st.renderStats();
    expect(theWordsOfTheBody()).toContain('2 realm-turns (0 human · 2 bot)');
    theFilters('bot', '', '');
    st.renderStats();
    expect(theWordsOfTheBody()).toContain('3 realm-turns (0 human · 3 bot)');
    theFilters('human', 'hard', '');
    st.renderStats();
    expect(theWordsOfTheBody()).toContain('2 realm-turns (2 human · 0 bot)');
    theFilters('', '', 'finished');
    st.renderStats();
    expect(theWordsOfTheBody()).toContain('2 realm-turns (1 human · 1 bot)');
    expect(theWordsOfTheBody()).toContain('1 finished');
    theFilters('', '', 'running');
    st.renderStats();
    expect(theWordsOfTheBody()).toContain('3 realm-turns (1 human · 2 bot)');
    expect(theWordsOfTheBody()).toContain('0 finished');
  });
  test('who wins: a bot of no difficulty, one game, a lone point drawn at the left edge', () => {
    theTabHolding(
      [aTurn('g-1', 3, 0, { post: { provinces: 5 } }), aTurn('g-1', 3, 1, { post: { provinces: 3 } })],
      [aResult('g-1', 0), aResult('g-1', 1, { is_bot: true, bot_difficulty: '', out_how: 'conceded' })],
    );
    st.renderStats();
    const words = theWordsOfTheBody();
    expect(words).toContain('Bot (?)');
    expect(words).toContain('1 game ');
    expect(words).toContain('0% won · 1 realm · avg rank 2.0');
    expect(words).toContain('over 1 finished game.');
    expect(words).toContain('Realms that dropped out early: 1 (1 conceded, 0 eliminated)');
    // every point at one turn: drawn at the chart's left edge
    expect(theBody()).toContain('<circle cx="40"');
  });
  test('the overview counts a battle total as `s + x || 0` does: a turn with no count starts it again', () => {
    theTabHolding([
      aTurn('g-1', 1, 0, { outcomes: { battles: { asAttacker: 2 }, encounters: { fought: '1' } } }),
      aTurn('g-1', 1, 1, { outcomes: { battles: { asAttacker: 3 }, encounters: { fought: 2 } } }),
      aTurn('g-1', 2, 0, { outcomes: { battles: {}, deaths: { own: 1 } } }),
      aTurn('g-1', 2, 1, { outcomes: { battles: { asAttacker: 4 }, deaths: { own: 1 } } }),
    ]);
    st.renderStats();
    const words = theWordsOfTheBody();
    // 2, then 5, then NaN read as 0, then 4
    expect(words).toContain(' 4 battles ');
    // 0 + '1' is '01', then '012', then words and none join as words
    expect(words).toContain(' 012undefinedundefined lair fights ');
    // NaN read as 0 twice, then 1, then 2
    expect(words).toContain(' 2 characters killed ');
  });
  test('orders: one the bots alone give is ranked by their count; a unit led but never recruited', () => {
    const ph = (...a: string[]) => ({ chars: { c1: { ph: a.map((x) => ({ a: x, t: 'Men-at-Arms|3' })) } } });
    theTabHolding([
      aTurn('g-1', 1, 0, { orders: ph('recruit', 'move', 'move') }),
      aTurn('g-1', 1, 1, {
        is_bot: true,
        orders: ph('odd_order', 'odd_order', 'awaken_wild', 'awaken_wild', 'awaken_wild'),
        post: { characters: [{ units: [{ t: 'Elven Bowmen' }, { t: 'Elven Bowmen' }] }] },
      }),
    ]);
    st.renderStats();
    const words = theWordsOfTheBody();
    // by both sides' count, most first; a side that never gave an order counts it 0
    expect(words).toContain('Humans (3 character-phases) Awaken Wild 0% Move 67% odd order 0% Recruit 33%');
    expect(words).toContain('Bots (5) Awaken Wild 60% Move 0% odd order 40% Recruit 0%');
    expect(words).toContain('Elven Bowmen 0 ordered · 2 unit-turns led');
    expect(words).toContain('Men-at-Arms 3 ordered · 0 unit-turns led');
    // the bar of a unit never recruited is empty
    expect(theBody()).toMatch(/title="Elven Bowmen">Elven Bowmen<\/div>\s*<div[^>]*><div style="width:0%/);
    expect(words.indexOf('Men-at-Arms 3')).toBeLessThan(words.indexOf('Elven Bowmen 0'));
  });
  test("orders: Harvest the Field and Perform Rite are labelled by their rows' names, their hover text the same (R-189)", () => {
    expect(st.STATS_ACTION_LABEL.harvest_field).toBe('Harvest the Field');
    expect(st.STATS_ACTION_LABEL.rite).toBe('Perform Rite');
    const ph = (...a: string[]) => ({ chars: { c1: { ph: a.map((x) => ({ a: x })) } } });
    theTabHolding([aTurn('g-1', 1, 0, { orders: ph('harvest_field', 'rite') })]);
    st.renderStats();
    expect(theWordsOfTheBody()).toContain('Humans (2 character-phases) Harvest the Field 50% Perform Rite 50%');
    expect(theBody()).toContain('title="Harvest the Field">Harvest the Field</div>');
    expect(theBody()).toContain('title="Perform Rite">Perform Rite</div>');
  });
  test('battles: one battle once, a defender of no strength in no band of the ratio, words read as numbers', () => {
    const battle = (extra: Record<string, unknown>) => ({
      ph: 1,
      prov: 4,
      atkChar: 'c1',
      atkStr: 10,
      defStr: 0,
      won: true,
      terrain: 'hill',
      kind: 'pvp',
      atkLost: 1,
      defLost: '2',
      carry: 1,
      ...extra,
    });
    theTabHolding([
      aTurn('g-1', 1, 0, { outcomes: { battles: { list: [battle({})] } } }),
      aTurn('g-1', 1, 1, {
        outcomes: {
          battles: { list: [battle({}), battle({ ph: 2, defStr: '20', won: false }), battle({ defStr: 5 })] },
        },
      }),
    ]);
    st.renderStats();
    const words = theWordsOfTheBody();
    expect(words).toContain('3 battles · attackers won 67%');
    expect(words).toContain('average losses 1.00 units (attacker) / 74.00 (defender) · 3 carried on');
    // a ratio of 1e9 (no defender) is in no band: the last band ends there
    expect(words).not.toContain('≥ 4×');
    expect(words).toContain('0.5–0.8× 0% attacker wins · expected 20% · 1 battle ');
    expect(words).toContain('2–3× 100% attacker wins · expected 80% · 1 battle ');
    expect(words).toContain('vs an enemy commander');
    // the losses added as `+` adds them: 0 + '2' + '2' + '2' is '0222', over 3 battles
    expect(words).toContain('67% attacker wins · 3 · losses 1.0 / 74.0');
  });
  test('lair fights: fled and killed counted, one hero killed; deaths and their kings', () => {
    theTabHolding([
      aTurn('g-1', 1, 0, {
        outcomes: {
          encounters: { list: [{ power: 'Weak', won: false, fled: true, killed: true, dmg: 3 }, null] },
          deaths: {
            list: [{ charId: 'h1', how: 'character', pi: 0, king: true }, { charId: 'h2', pi: null }, { charId: 'h3' }],
          },
          captures: {
            list: [
              { ph: 1, prov: 2, to: 0, from: null },
              { ph: 1, prov: 3, to: 0, from: 1 },
            ],
          },
        },
      }),
    ]);
    st.renderStats();
    const words = theWordsOfTheBody();
    expect(words).toContain('0% cleared · 1 fight · 1 fled · 1 hero killed · avg 3.0 damage taken');
    expect(words).toContain('? 0% cleared · 1 fight · 0 fled · 0 heroes killed · avg 0.0 damage taken');
    expect(words).toContain('1 realm character killed (1 king) over 1 realm-turns');
    expect(words).toContain(
      'plus 2 neutral heroes / chieftains slain. 2 provinces changed hands: 1 taken from neutrals, 1 taken from rivals.',
    );
    expect(words).toContain('killed by an enemy character');
    expect(words).toContain('other (duel, spell, execution…)');
  });
  test('a list of the statistics that is not a list stops the cards, as walking it did', () => {
    theTabHolding([aTurn('g-1', 1, 0, { outcomes: { battles: { list: { not: 'a list' } } } })]);
    expect(() => {
      st.renderStats();
    }).toThrow(TypeError);
  });
});

describe('the exports', () => {
  const rows = () => [
    aTurn('g-1', 1, 0, {
      pre: { gold: 5, provinces: 2 },
      post: {
        gold: 7,
        provinces: 3,
        tax: 11,
        taxShare: 40,
        units: 12,
        str: 13,
        heroes: 14,
        kingAlive: true,
        items: ['a sword', 'a "cup"'],
        discoveries: 15,
      },
      outcomes: {
        battles: {
          fought: 1,
          won: 0,
          list: [
            {
              ph: 1,
              prov: 9,
              terrain: 'hill',
              kind: 'pvp',
              atkPi: 0,
              defPi: 2,
              atkStr: 30,
              defStr: 10,
              S: 31,
              won: true,
              atkUnits: 32,
              defUnits: 33,
              atkLost: 34,
              defLost: 35,
              carry: 36,
            },
          ],
        },
        encounters: { fought: 16, won: 17 },
        captures: { gained: 18, lost: 19 },
        deaths: { own: 20, killed: 21 },
        spells: { cast: 22 },
        rank: 1,
        score: '12,5',
      },
      orders: { chars: { c1: { ph: [{ a: 'move' }, { a: 'recruit' }] }, c2: { ph: [{ a: 'defend' }] } } },
    }),
    aTurn('g-1', 1, 1, {
      is_bot: true,
      bot_difficulty: 'hard',
      outcomes: {
        battles: {
          list: [
            { ph: 1, prov: 9, atkStr: 30, defStr: 10, won: true },
            { ph: 2, defStr: 0 },
            { ph: 1, prov: 9, atkStr: 30, defStr: 15 },
          ],
        },
      },
    }),
  ];
  test('the turns as CSV: their columns named, a value with a comma or a quote quoted, a list as JSON', () => {
    theTabHolding(rows());
    st.exportStats('turns');
    const { type, text } = theDownload();
    expect(type).toBe('text/csv');
    const [head, first, second, ...more] = text.split('\n');
    expect(more).toEqual([]);
    expect(head?.split(',').slice(0, 4)).toEqual(['game_id', 'turn', 'player_index', 'realm']);
    expect(head?.split(',').at(-1)).toBe('orders_by_character');
    expect(head?.split(',')).toHaveLength(32);
    expect(first).toBe(
      'g-1,1,0,Realm 0,false,,Elf,Good,5,7,2,3,11,40,12,13,14,true,"[""a sword"",""a \\""cup\\""""]",15,1,0,16,17,18,19,20,21,22,1,"12,5",move>recruit | defend',
    );
    expect(second).toBe('g-1,1,1,Realm 1,true,hard,Elf,Good,,,,,,,,,,,,,,,,,,,,,,,,');
  });
  test('the battles as CSV: each battle once, its ratio and its expected win, none for no defender', () => {
    theTabHolding(rows());
    st.exportStats('battles');
    const [head, first, second, third, ...more] = theDownload().text.split('\n');
    expect(more).toEqual([]);
    expect(head).toBe(
      'game_id,turn,phase,province,terrain,kind,attacker,defender,atk_strength,def_strength,ratio,fortune_swing,expected_atk_win_pct,attacker_won,atk_units,def_units,atk_lost,def_lost,carry_on_round',
    );
    expect(first).toBe('g-1,1,1,9,hill,pvp,0,2,30,10,3,31,90,true,32,33,34,35,36');
    expect(second).toBe('g-1,1,2,,,,,,,0,,,100,,,,,,');
    expect(third).toBe('g-1,1,1,9,,,,,30,15,2,,80,,,,,,');
  });
  test('no battles: the battles CSV is its one column', () => {
    theTabHolding([aTurn('g-1', 1, 0)]);
    st.exportStats('battles');
    expect(theDownload().text).toBe('game_id');
  });
  test('the results as CSV, with their setup and final state', () => {
    theTabHolding(
      [aTurn('g-1', 1, 0)],
      [
        aResult('g-1', 0, {
          game_name: 'A Made-up Game',
          setup: { realms: 4, humans: 2, seaPct: 30 },
          final: { provinces: 8, gold: 9, str: 7, heroes: 6 },
        }),
      ],
    );
    st.exportStats('results');
    const [head, first, ...more] = theDownload().text.split('\n');
    expect(more).toEqual([]);
    expect(head?.split(',').slice(-7)).toEqual([
      'realms',
      'humans',
      'sea_pct',
      'final_provinces',
      'final_gold',
      'final_strength',
      'final_heroes',
    ]);
    expect(first).toBe('g-1,A Made-up Game,0,Realm 0,false,,Elf,Good,1,10,true,turns,9,,,4,2,30,8,9,7,6');
  });
  test("the turns as JSON for the bots' training, each with its realm's final result or none", () => {
    theTabHolding(rows(), [aResult('g-1', 1, { rank: 2, winner: false })]);
    st.exportStats('json');
    const { type, text } = theDownload();
    expect(type).toBe('application/json');
    const parsed = JSON.parse(text) as { v: unknown; rows: Record<string, unknown>[] };
    expect(parsed).toMatchObject({ v: 1 });
    const out = parsed.rows;
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      game_id: 'g-1',
      player_index: 0,
      situation: { gold: 5, provinces: 2 },
      final: null,
    });
    expect(out[1]).toEqual({
      game_id: 'g-1',
      turn: 1,
      player_index: 1,
      is_bot: true,
      bot_difficulty: 'hard',
      realm: 'Realm 1',
      race: 'Elf',
      alignment: 'Good',
      situation: null,
      orders: null,
      result: null,
      outcomes: out[1]?.['outcomes'],
      final: { rank: 2, winner: false, victory: 'turns', turns: 9, out_how: null },
    });
  });
  test('an export of another kind, or before the load, downloads nothing', () => {
    st.exportStats('turns');
    theTabHolding(rows());
    st.exportStats('maps');
    expect(downloads).toEqual([]);
  });
});

describe("forgetting deleted games' data", () => {
  test('the games that no longer exist are forgotten, their Hall of Fame entries too; the tab loads again', async () => {
    theTabHolding([aTurn('g-kept', 1, 0), aTurn('g-gone', 1, 0)], [aResult('g-gone-too', 0)]);
    answers['stillExist'] = { data: [{ id: 'g-kept' }], error: null };
    await st.forgetDeletedGames();
    expect(callsTo('stillExist')).toEqual([[['g-kept', 'g-gone', 'g-gone-too']]]);
    expect(callsTo('deleteTurns')).toEqual([[['g-gone', 'g-gone-too']]]);
    expect(callsTo('deleteResults')).toEqual([[['g-gone', 'g-gone-too']]]);
    expect(callsTo('deleteEntries')).toEqual([[['g-gone', 'g-gone-too']]]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(callsTo('turns')).toHaveLength(1);
  });
  test('without the Hall of Fame its entries are left; the GM who says no forgets nothing', async () => {
    G['_kcHasLb'] = false;
    theTabHolding([aTurn('g-gone', 1, 0)], []);
    answers['stillExist'] = { data: null, error: null };
    await st.forgetDeletedGames();
    expect(callsTo('deleteTurns')).toEqual([[['g-gone']]]);
    expect(callsTo('deleteEntries')).toEqual([]);
    calls.length = 0;
    confirmAnswer = false;
    await st.forgetDeletedGames();
    expect(callsTo('deleteTurns')).toEqual([]);
  });
  test('every game still there, or the check refused: nothing is deleted, and the GM is told', async () => {
    theTabHolding([aTurn('g-kept', 1, 0)], [aResult('g-kept', 0)]);
    answers['stillExist'] = { data: [{ id: 'g-kept' }], error: null };
    await st.forgetDeletedGames();
    answers['stillExist'] = { data: null, error: { message: 'refused' } };
    await st.forgetDeletedGames();
    expect(alerts).toEqual([
      'Every recorded game still exists — nothing to forget.',
      'Could not check which games still exist: refused. Nothing was deleted.',
    ]);
    expect(callsTo('deleteTurns')).toEqual([]);
  });
  test('the games are checked a hundred at a time; before the load, nothing', async () => {
    await st.forgetDeletedGames();
    expect(calls).toEqual([]);
    const many = Array.from({ length: 150 }, (_, i) => aTurn(`g-${String(i)}`, 1, 0));
    theTabHolding(many, []);
    answers['stillExist'] = { data: many.map((r) => ({ id: r.game_id })), error: null };
    await st.forgetDeletedGames();
    expect(callsTo('stillExist').map(([games]) => (Array.isArray(games) ? games.length : -1))).toEqual([100, 50]);
  });
});
