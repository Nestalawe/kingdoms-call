// The GM page's start-up, sign-in and turn-mode files on the values handed them (plan P1-16p): the lines P1-16p changed in
// src/ui/gm/startup.ts, sign-in.ts and turn-mode.ts (and the readers it moved to src/ui/shared/) that the screen tours
// and the matrix don't reach, or reach only in part, each pinned to the value it gave before the files were typed.
// Level 1 (unit): the three files import in Node once the page's config, the `supabase` global and a Db handed in are
// stood in; each function is called on a jsdom document set as the page's own. A page test would boot the whole page
// and sign in to reach each of them.
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.js';

interface AnAnswer {
  data: unknown;
  error: { message: string } | null;
}
/** What each of the stood-in Db's functions answers, by its name (a function: it throws, or answers by its arguments). */
const answers: Record<string, AnAnswer | ((...args: unknown[]) => AnAnswer)> = {};
/** Each call the page made on the stood-in Db: its function's name and its arguments. */
const calls: [string, unknown[]][] = [];
const answering =
  (name: string) =>
  (...args: unknown[]): Promise<AnAnswer> => {
    calls.push([name, args]);
    const a = answers[name] ?? { data: null, error: null };
    return Promise.resolve(typeof a === 'function' ? a(...args) : a);
  };

let page: Document;
let W: Window & Record<string, unknown>;
let startup: typeof import('../../src/ui/gm/startup.ts');
let signIn: typeof import('../../src/ui/gm/sign-in.ts');
let turnMode: typeof import('../../src/ui/gm/turn-mode.ts');
/** The page's declared globals, as the GM page's files read them by their bare names. */
const G = globalThis as unknown as Record<string, unknown>;

beforeAll(async () => {
  const { window } = bootJsdom('<!doctype html><html><body></body></html>');
  W = window as unknown as Window & Record<string, unknown>;
  page = W.document;
  const theDb = {
    theDatabasesVersion: {},
    theGameMastersGames: {
      oneGamesMeta: answering('oneGamesMeta'),
      keepTheRealmsThatAreOutOfThisGameFromSendingDispatches: answering('keepOut'),
      changeThisGameWhileOnThisTurnAndAnswerItsId: answering('changeOnTurn'),
    },
    theStatistics: { oneTurnRecordsId: answering('turnRecords'), oneGameResultsId: answering('gameResults') },
    theDispatches: {
      oneDispatchsId: answering('dispatchs'),
      oneReadMarksGame: answering('readMarks'),
      deleteThisDispatch: answering('deleteDispatch'),
    },
    theReportedDispatches: { theDispatchesReportedToThisAccount: answering('reported') },
    theRoles: {
      isTheSignedInAccountAGameMaster: answering('isGm'),
      isTheSignedInAccountTheOverlord: answering('isOverlord'),
    },
    signingIn: { signOut: answering('signOut'), changeThePassword: answering('changePassword') },
  };
  Object.assign(globalThis, {
    window: W,
    document: page,
    HTMLElement: W['HTMLElement'],
    HTMLInputElement: W['HTMLInputElement'],
    HTMLSelectElement: W['HTMLSelectElement'],
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    kcTheDbATestHandsThePage: theDb,
    _autoWatcherTimer: null,
  });
  startup = await import('../../src/ui/gm/startup.ts');
  signIn = await import('../../src/ui/gm/sign-in.ts');
  turnMode = await import('../../src/ui/gm/turn-mode.ts');
});
beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(answers)) Reflect.deleteProperty(answers, k);
  page.body.innerHTML = '';
  G['currentGame'] = null;
  G['currentGamePlayers'] = [];
  G['currentUser'] = null;
  G['_autoWatcherTimer'] = null;
});
/** The text of the page's element with the id `id`. */
const textOf = (id: string): string => page.getElementById(id)?.textContent ?? '';
/** Runs `f` with the console's warnings quiet. */
async function quietly<T>(f: () => Promise<T>): Promise<T> {
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    return await f();
  } finally {
    console.warn = warn;
  }
}

describe('a game read from its row (startup.ts)', () => {
  test("parseGameState: the row's words parsed, an object as it is, and {} for none, a falsy one or bad words", () => {
    expect(startup.parseGameState({ game_state: '{"turnMode":{"mode":"auto"}}' })).toEqual({
      turnMode: { mode: 'auto' },
    });
    const held = { a: 1 };
    expect(startup.parseGameState({ game_state: held })).toBe(held);
    expect(startup.parseGameState({ game_state: '7' })).toBe(7);
    expect(startup.parseGameState({ game_state: '0' })).toEqual({});
    expect(startup.parseGameState({ game_state: '' })).toEqual({});
    expect(startup.parseGameState({ game_state: '{bad' })).toEqual({});
    expect(startup.parseGameState(null)).toEqual({});
  });
  test('normalizeTurnMode: each field kept or put back to its default', () => {
    expect(
      startup.normalizeTurnMode({
        mode: 'deadline',
        time: '07:30',
        everyDays: '3',
        nextDeadlineAt: 'n',
        turnRanAt: 'r',
      }),
    ).toEqual({ mode: 'deadline', time: '07:30', everyDays: 3, nextDeadlineAt: 'n', turnRanAt: 'r' });
    expect(startup.normalizeTurnMode({ mode: 'later', time: '7:30', everyDays: 0, nextDeadlineAt: '' })).toEqual({
      mode: 'manual',
      time: '20:00',
      everyDays: 1,
      nextDeadlineAt: null,
      turnRanAt: null,
    });
    expect(startup.normalizeTurnMode({ everyDays: 99 }).everyDays).toBe(30);
    expect(startup.normalizeTurnMode('auto')).toEqual(startup.normalizeTurnMode({}));
    const time = ['06:15'];
    expect(startup.normalizeTurnMode({ time }).time).toBe(time);
  });
  test('gameArchived and gameArchivedAt: the meta first, else the world, else none', () => {
    expect(startup.gameArchived({ meta: { v: 1, archived: false }, game_state: { archived: true } })).toBe(false);
    expect(startup.gameArchived({ meta: { v: 1 }, game_state: '{"archived":1}' })).toBe(true);
    expect(startup.gameArchivedAt({ meta: { v: 1, archivedAt: 'm' }, game_state: { archivedAt: 'w' } })).toBe('m');
    expect(startup.gameArchivedAt({ meta: { v: 1, archivedAt: '' }, game_state: { archivedAt: 'w' } })).toBe('w');
    expect(startup.gameArchivedAt({ game_state: { archivedAt: '' } })).toBe(null);
    expect(startup.gameArchivedAt(null)).toBe(null);
  });
});

describe("the database's probes (startup.ts)", () => {
  test('games.meta refused: the list says the Disk-IO fix is not active; answered: the message goes', async () => {
    page.body.innerHTML = '<div id="msg-games">stale</div>';
    answers['oneGamesMeta'] = { data: null, error: { message: 'no column' } };
    expect(await quietly(() => startup.probeGameMeta())).toBe(false);
    expect(textOf('msg-games')).toContain('Disk-IO fix not active');
    expect(page.getElementById('msg-games')?.innerHTML).toContain('<code>games.meta</code> column');
    expect(turnMode.metaPatch({})).toEqual({});
    answers['oneGamesMeta'] = { data: [], error: null };
    expect(await startup.probeGameMeta()).toBe(true);
    expect(textOf('msg-games')).toBe('');
    expect(turnMode.metaPatch({}).meta).toMatchObject({ v: 1 });
  });
  test('a probe that throws: each reads as missing', async () => {
    page.body.innerHTML = '<div id="msg-games"></div><div id="msg-telemetry"></div><div id="msg-messaging"></div>';
    for (const name of ['oneGamesMeta', 'turnRecords', 'dispatchs'])
      answers[name] = () => {
        throw new Error('offline');
      };
    expect(await startup.probeGameMeta()).toBe(false);
    expect(await startup.probeTelemetry()).toBe(false);
    expect(await startup.probeMessaging()).toBe(false);
    expect(textOf('msg-telemetry')).toContain('Game telemetry not active');
    expect(textOf('msg-messaging')).toContain('Player messaging not active');
  });
  test('the telemetry banner: a failed write shown in its words; messaging there: no banner', async () => {
    page.body.innerHTML = '<div id="msg-telemetry"></div><div id="msg-messaging">stale</div>';
    answers['turnRecords'] = { data: [], error: null };
    answers['gameResults'] = { data: [], error: null };
    await startup.probeTelemetry();
    G['_kcTelLastErr'] = 'a <b>bad</b> write';
    startup.renderTelemetryBanner();
    expect(textOf('msg-telemetry')).toContain('on the last turn run: a <b>bad</b> write. The turn itself was saved');
    G['_kcTelLastErr'] = null;
    answers['dispatchs'] = { data: [], error: null };
    answers['readMarks'] = { data: [], error: null };
    expect(await startup.probeMessaging()).toBe(true);
    expect(textOf('msg-messaging')).toBe('');
  });
});

describe("a realm's statistics (startup.ts)", () => {
  test('telRankOrder: by score, then the tax base, then the treasury', () => {
    const world = {
      players: [{ gold: 5 }, { gold: 9 }, { gold: 0 }],
      world: {
        provinces: [
          { owner: 0, tax: 2 },
          { owner: 1, tax: 2 },
          { owner: 2, tax: 3 },
        ],
      },
    } as unknown as Parameters<typeof startup.telRankOrder>[0];
    const { rank } = startup.telRankOrder(world);
    expect(rank).toEqual({ 2: 1, 1: 2, 0: 3 });
  });
  test('telBotDifficultyOf: the word the game carries, else hard', () => {
    expect(startup.telBotDifficultyOf({ botDifficulty: 'easy' })).toBe('easy');
    expect(startup.telBotDifficultyOf({ botDifficulty: '' })).toBe('hard');
    expect(startup.telBotDifficultyOf(null)).toBe('hard');
  });
  test("telOutcomesFor: the realm's records counted, the snapshots' differences, its rank and score", () => {
    const tel = {
      battles: [
        { atkPi: 1, defPi: 0, won: true, atkLost: 3, defLost: 7 },
        { atkPi: 2, defPi: 1, won: true, atkLost: 1, defLost: 4 },
        { atkPi: 2, defPi: 0, won: false, atkLost: 2, defLost: 2 },
      ],
      encounters: [{ pi: 1, won: true, fled: false, killed: false }],
      captures: [{ from: 0, to: 1 }],
      deaths: [{ pi: 1, killerPi: 2, king: true }],
      spells: [{ pi: 1, ok: false }],
    } as unknown as Parameters<typeof startup.telOutcomesFor>[2];
    const o = startup.telOutcomesFor(
      null,
      1,
      tel,
      { gold: 10, tax: null, units: '4' },
      { gold: 4, units: 9, _score: 0 },
      2,
    );
    expect(o.battles).toMatchObject({ fought: 2, asAttacker: 1, won: 1, unitsLost: 7, unitsKilled: 8 });
    expect(o.battles.list.map((b) => [b.side, b.win])).toEqual([
      ['atk', true],
      ['def', false],
    ]);
    expect(o.encounters).toMatchObject({ fought: 1, won: 1, fled: 0, heroKilled: 0 });
    expect(o.captures).toMatchObject({ gained: 1, lost: 0 });
    expect(o.deaths).toMatchObject({ own: 1, king: true, killed: 0 });
    expect(o.spells).toMatchObject({ cast: 1, ok: 0 });
    expect(o.delta).toMatchObject({ gold: -6, tax: null, units: 5, provinces: null });
    expect([o.rank, o.score]).toEqual([2, 0]);
    const none = startup.telOutcomesFor(null, 0, {}, null, undefined, 0);
    expect([none.battles.fought, none.spells.cast, none.delta.gold, none.rank, none.score]).toEqual([
      0,
      0,
      null,
      null,
      null,
    ]);
    expect(startup.telOutcomesFor(null, 0, {}, null, null, Number.NaN).rank).toBe(null);
  });
});

describe('the sign-in and the reported dispatches (sign-in.ts)', () => {
  test('not a Game Master, or the check refused: the page says so, the watcher stops, and it shows that page', async () => {
    page.body.innerHTML = '<section id="sec-not-gm"></section><div id="not-gm-msg"></div>';
    answers['isGm'] = { data: false, error: null };
    answers['isOverlord'] = { data: false, error: null };
    G['_autoWatcherTimer'] = setInterval(() => undefined, 100000);
    expect(await signIn.gmPortalAllowed()).toBe(false);
    expect(G['_autoWatcherTimer']).toBe(null);
    expect(page.getElementById('not-gm-msg')?.className).toBe('msg-info');
    expect(textOf('not-gm-msg')).toContain("You're not a Game Master");
    expect(page.getElementById('sec-not-gm')?.classList.contains('section-active')).toBe(true);
    answers['isOverlord'] = { data: null, error: { message: 'no answer' } };
    expect(await signIn.gmPortalAllowed()).toBe(false);
    expect(textOf('not-gm-msg')).toBe("Couldn't check whether you're a Game Master (no answer). Reload to try again.");
    expect(signIn._kcOverlord).toBe(false);
    answers['isOverlord'] = { data: true, error: null };
    expect(await signIn.gmPortalAllowed()).toBe(true);
    expect(signIn._kcOverlord).toBe(true);
    page.body.innerHTML = '';
    answers['isOverlord'] = { data: false, error: null };
    await expect(signIn.gmPortalAllowed()).rejects.toThrow(TypeError);
  });
  test('the reported dispatches: each with its turn, realms and reason, a realm unknown named by its place', async () => {
    page.body.innerHTML = '<div id="detail-reports-card"></div><div id="detail-reports"></div>';
    G['_kcHasMsg'] = true;
    const game = { id: 'G1', game_players: null };
    G['currentGame'] = game;
    G['currentGamePlayers'] = [
      { player_index: 0, display_name: 'Ashen Reach', user_id: 'u0' },
      { player_index: 1, display_name: '', user_id: 'u1' },
    ];
    answers['reported'] = {
      data: [
        {
          message_id: 0,
          turn: null,
          scope: 'private',
          to_indexes: [1, 4],
          from_index: 0,
          reporter_index: 1,
          reason: null,
          body: 'b1',
        },
        {
          message_id: 5,
          turn: 3,
          scope: 'public',
          to_indexes: [],
          from_index: 2,
          reporter_index: 0,
          reason: 'rude',
          body: 'b2',
        },
      ],
      error: null,
    };
    await signIn.loadReportedDispatches(game);
    const lines = [...page.querySelectorAll('#detail-reports .player-slot > div:first-child')].map(
      (d) => d.textContent,
    );
    expect(lines).toEqual([
      'from Ashen Reach to Realm 2, Realm 5 · reported by Realm 2',
      'Turn 3 · from Realm 3 to every realm · reported by Ashen Reach · “rude”',
    ]);
    const buttons = [...page.querySelectorAll('#detail-reports button')].map((b) => b.getAttribute('onclick'));
    expect(buttons).toEqual(['deleteReportedDispatch(0)', 'deleteReportedDispatch(5)']);
    expect(calls).toEqual([['reported', ['G1']]]);
  });
  test('the reported dispatches: a realm played here, another game opened meanwhile, an error, none', async () => {
    page.body.innerHTML = '<div id="detail-reports-card"></div><div id="detail-reports"></div>';
    G['_kcHasMsg'] = true;
    G['currentUser'] = { id: 'u1' };
    await signIn.loadReportedDispatches({ id: 'G1', game_players: [{ user_id: 'u1' }] as never });
    expect(textOf('detail-reports')).toContain('You play a realm in this game');
    G['currentGamePlayers'] = [{ user_id: 'u1' }];
    await signIn.loadReportedDispatches({ id: 'G1' });
    expect(textOf('detail-reports')).toContain('You play a realm in this game');
    G['currentUser'] = null;
    G['currentGame'] = { id: 'G2' };
    answers['reported'] = { data: [], error: null };
    await signIn.loadReportedDispatches({ id: 'G1' });
    expect(textOf('detail-reports')).toBe('Loading…');
    G['currentGame'] = { id: 'G1' };
    answers['reported'] = { data: null, error: { message: 'refused <here>' } };
    await signIn.loadReportedDispatches({ id: 'G1' });
    expect(textOf('detail-reports')).toBe('refused <here>');
    answers['reported'] = { data: { not: 'a list' }, error: null };
    await signIn.loadReportedDispatches({ id: 'G1' });
    expect(textOf('detail-reports')).toBe('No dispatches reported.');
  });
  test('deleting a reported dispatch: asked first; refused, the reason shown; done, the list read again', async () => {
    page.body.innerHTML = '<div id="detail-reports-card"></div><div id="detail-reports"></div>';
    G['_kcHasMsg'] = true;
    G['currentGame'] = { id: 'G1' };
    const said: string[] = [];
    let yes = false;
    Object.assign(globalThis, { confirm: () => yes, alert: (t: string) => said.push(t) });
    await signIn.deleteReportedDispatch(7);
    expect(calls).toEqual([]);
    yes = true;
    answers['deleteDispatch'] = { data: null, error: { message: 'not yours' } };
    await signIn.deleteReportedDispatch(7);
    expect(said).toEqual(['not yours']);
    answers['deleteDispatch'] = { data: null, error: null };
    await signIn.deleteReportedDispatch(8);
    expect(calls.map((c) => c[0])).toEqual(['deleteDispatch', 'deleteDispatch', 'reported']);
    expect(calls[1]?.[1]).toEqual([8]);
  });
  test("the password's change: a refusal thrown without words says 'Update failed.'; its words, as they are", async () => {
    page.body.innerHTML =
      '<input id="cp-new" value="secret1"><input id="cp-new2" value="secret1"><div id="cp-msg"></div>';
    answers['changePassword'] = () => {
      const thrown: unknown = { message: '' };
      throw thrown;
    };
    await signIn.submitChangePassword();
    expect(textOf('cp-msg')).toBe('Update failed.');
    answers['changePassword'] = () => {
      throw new Error('too weak');
    };
    await signIn.submitChangePassword();
    expect(textOf('cp-msg')).toBe('too weak');
    answers['changePassword'] = () => {
      const thrown: unknown = null;
      throw thrown;
    };
    await expect(signIn.submitChangePassword()).rejects.toThrow("Cannot read properties of null (reading 'message')");
  });
  test('the auto-turn status: shown with its words, hidden when there are none', () => {
    page.body.innerHTML = '<div id="auto-turn-status"></div>';
    signIn.setAutoTurnStatus('<b>due</b>');
    expect(page.getElementById('auto-turn-status')?.style.display).toBe('block');
    expect(page.getElementById('auto-turn-status')?.innerHTML).toBe('<b>due</b>');
    signIn.setAutoTurnStatus('');
    expect(page.getElementById('auto-turn-status')?.style.display).toBe('none');
    expect(page.getElementById('auto-turn-status')?.innerHTML).toBe('');
  });
});

describe('the turn modes (turn-mode.ts)', () => {
  test("computeNextDeadline: the first time strictly after the last run and the days' wait", () => {
    const from = new Date(2026, 10, 14, 9, 0);
    expect(turnMode.computeNextDeadline({ time: '07:30', everyDays: 2 }, from)).toBe(
      new Date(2026, 10, 16, 7, 30).toISOString(),
    );
    expect(turnMode.computeNextDeadline({ time: '10:00' }, from)).toBe(new Date(2026, 10, 14, 10, 0).toISOString());
    expect(turnMode.computeNextDeadline({ time: '09:00' }, from.getTime())).toBe(
      new Date(2026, 10, 15, 9, 0).toISOString(),
    );
    expect(() => turnMode.computeNextDeadline({ time: ['07:30'] }, from)).toThrow(TypeError);
  });
  test('fmtDeadline, fmtLastRun, asDate and fmtAgo: none, a bad value, and a time', () => {
    expect(turnMode.fmtDeadline('')).toBe('—');
    const sym = Symbol('x');
    expect(turnMode.fmtDeadline(sym)).toBe('Symbol(x)');
    const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } as const;
    expect(turnMode.fmtDeadline(0 + 1)).toBe(new Date(1).toLocaleString(undefined, opts));
    expect(turnMode.asDate('junk')).toBe(null);
    expect(turnMode.asDate({})).toBe(null);
    expect(turnMode.fmtLastRun(null)).toBe('');
    const ago = (ms: number) => turnMode.fmtAgo(new Date(Date.now() - ms).toISOString());
    expect([ago(5 * 60000 + 500), ago(3 * 3600000 + 500), ago(86400000 + 500), ago(2 * 86400000 + 500)]).toEqual([
      '5m ago',
      '3h ago',
      '1 day ago',
      '2 days ago',
    ]);
    expect([ago(31 * 86400000), ago(65 * 86400000), ago(-60000)]).toEqual(['1 month ago', '2 months ago', '']);
  });
  test('the realms the turn waits on: out, exempt by the meta or the world, conceded, a bot, in', () => {
    const world = {
      players: [{ provinces: [1] }, { conceded: true }, { provinces: [] }, null, { _eliminated: 1 }],
      characters: [null, { alive: true, player: 2 }],
    };
    expect([0, 1, 2, 3, 4, 5].map((i) => turnMode.realmExemptFromOrders(world, i))).toEqual([
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(turnMode.realmExemptFromOrders({ players: [{}] }, 0)).toBe(true);
    expect(turnMode.realmExemptFromOrders(null, 0)).toBe(false);
    expect(() => turnMode.realmExemptFromOrders({ players: [{}], characters: 'none' }, 0)).toThrow(TypeError);
    expect(turnMode.realmExemptIn({ meta: { v: 1, exempt: [2] }, game_state: world }, 2)).toBe(true);
    expect(turnMode.realmExemptIn({ meta: { v: 1, exempt: 'x' }, game_state: world }, 1)).toBe(true);
    expect(turnMode.realmConcededIn({ game_state: world }, 1)).toBe(true);
    expect(turnMode.realmConcededIn({ game_state: world }, 3)).toBe(false);
    const game = { status: 'active', meta: { v: 1, exempt: [1], turnMode: { mode: 'auto' } } };
    const rows = [
      { user_id: 'a', player_index: 0, orders_submitted: false },
      { user_id: 'b', player_index: 1, orders_submitted: false },
      { user_id: null, player_index: 2 },
    ];
    expect(turnMode.ordersWaitingOn(rows, game).map((p) => p.player_index)).toEqual([0]);
    expect(turnMode.ordersWaitingOn(null, game)).toEqual([]);
    expect(turnMode.autoTurnReady(game, rows, null)).toEqual({ ready: false, reason: 'waiting on 1' });
    expect(turnMode.autoTurnReady(null, rows, null).reason).toBe('not active');
    expect(turnMode.autoTurnReady(game, [], null).reason).toBe('no realms');
    expect(turnMode.autoTurnReady(game, rows, turnMode.turnModeOf({})).reason).toBe('manual');
    const passed = startup.normalizeTurnMode({ mode: 'deadline', nextDeadlineAt: '2000-01-01T00:00:00Z' });
    expect(turnMode.autoTurnReady(game, rows, passed).reason).toBe('deadline passed');
    const ahead = startup.normalizeTurnMode({ mode: 'deadline', nextDeadlineAt: '2999-01-01T00:00:00Z' });
    expect(turnMode.autoTurnReady(game, rows, ahead).reason).toBe('waiting on 1');
    expect(turnMode.autoTurnReady(game, [{ user_id: 'a', player_index: 0, orders_submitted: true }], null).reason).toBe(
      'all orders in',
    );
  });
  test('turnModeSummary, the sea share and the turn mode read from the meta or the world', () => {
    expect(turnMode.turnModeSummary({ mode: 'manual' })).toBe('🧑‍⚖️ Manual');
    expect(turnMode.turnModeSummary({ mode: 'deadline', time: '06:00', everyDays: 3 })).toBe(
      '⏱ Auto · deadline — (06:00 every 3 days)',
    );
    expect(turnMode.turnModeSummary({ mode: 'deadline', time: '06:00' })).toBe('⏱ Auto · deadline — (06:00 daily)');
    expect(turnMode.seaPctOf({ meta: { v: 1, seaPct: 30 } })).toBe(30);
    expect(turnMode.seaPctOf({ game_state: { seaPct: 25, world: { seaPct: 40 } } })).toBe(25);
    expect(turnMode.seaPctOf({ game_state: { world: { seaPct: 40 } } })).toBe(40);
    expect(turnMode.seaPctOf({ game_state: { world: null } })).toBe(turnMode.seaPctOf({}));
    expect(turnMode.turnModeOf({ game_state: { turnMode: { mode: 'auto' } } }).mode).toBe('auto');
  });
  test("the turn mode's form: read from its fields, its deadline fields shown only for a deadline", () => {
    page.body.innerHTML = String(turnMode.turnModeFormHtml('t', { mode: 'deadline', time: '05:45', everyDays: 4 }));
    expect(turnMode.readTurnModeForm('t')).toMatchObject({ mode: 'deadline', time: '05:45', everyDays: 4 });
    const sel = page.getElementById('t-turnmode') as HTMLSelectElement;
    sel.value = 'auto';
    turnMode.updateTurnModeFields('t');
    expect(page.getElementById('t-turnmode-fields')?.style.display).toBe('none');
    sel.value = 'deadline';
    turnMode.updateTurnModeFields('t');
    expect(page.getElementById('t-turnmode-fields')?.style.display).toBe('block');
    expect(turnMode.readTurnModeForm('none')).toEqual(startup.normalizeTurnMode({}));
  });
  test('the panels: bots, Safe Start and the switch for realms that are out', () => {
    G['currentGamePlayers'] = undefined;
    expect(turnMode._gameHasBots(null)).toBe(false);
    expect(turnMode._gameHasBots({ players: [null, { bot: 1 }] })).toBe(true);
    expect(turnMode._gameHasBots({ players: [{ isBot: true }] })).toBe(true);
    expect(turnMode._gameHasBots({ botCount: '2' })).toBe(true);
    expect(turnMode._gameHasBots({ botCount: 0, allBot: 1 })).toBe(true);
    expect(turnMode._gameHasBots({ players: [{}], botCount: 0 })).toBe(false);
    G['currentGamePlayers'] = [{ user_id: null }];
    expect(turnMode._gameHasBots({})).toBe(true);
    G['currentGamePlayers'] = [];
    expect(turnMode.safeStartNoteHtml({ game_state: { safeStart: true }, turn: 2 }).toString()).toContain(
      'until the orders for Turn 6',
    );
    expect(turnMode.safeStartNoteHtml({ game_state: { safeStart: true }, turn: 6 }).toString()).toContain(
      'Diplomacy is now open',
    );
    expect(turnMode.safeStartNoteHtml({ game_state: {} })).toBe('');
    expect(
      turnMode.botDiplomacyPanelHtml({ game_state: { botCount: 1, botDiplomacy: 'hostile' } }).toString(),
    ).toContain('<option value="hostile" selected>');
    expect(turnMode.blockEliminatedPanelHtml(null).toString()).not.toContain('id="detail-block-eliminated" checked');
    expect(turnMode.blockEliminatedPanelHtml({ block_eliminated_msgs: true }).toString()).toContain(
      'id="detail-block-eliminated" checked',
    );
  });
  test('the switch for realms that are out: saved, its words shown; refused, the box put back and the reason shown', async () => {
    page.body.innerHTML =
      '<input type="checkbox" id="detail-block-eliminated"><div id="detail-block-eliminated-msg"></div>';
    await turnMode.saveBlockEliminated(true);
    expect(calls).toEqual([]);
    const game = { id: 'G1', block_eliminated_msgs: false };
    G['currentGame'] = game;
    answers['keepOut'] = { data: { id: 'G1', block_eliminated_msgs: true }, error: null };
    await turnMode.saveBlockEliminated(1);
    expect(calls).toEqual([['keepOut', ['G1', true]]]);
    expect(game.block_eliminated_msgs).toBe(true);
    expect(textOf('detail-block-eliminated-msg')).toBe("Saved: realms that are out can't send dispatches.");
    answers['keepOut'] = { data: { id: 'G1', block_eliminated_msgs: false }, error: null };
    await turnMode.saveBlockEliminated(0);
    expect(textOf('detail-block-eliminated-msg')).toBe('Saved: realms that are out may write to All Realms.');
    answers['keepOut'] = { data: null, error: { message: 'not your game' } };
    await turnMode.saveBlockEliminated(true);
    expect((page.getElementById('detail-block-eliminated') as HTMLInputElement).checked).toBe(false);
    expect(textOf('detail-block-eliminated-msg')).toBe('Not saved: not your game');
    expect(page.getElementById('detail-block-eliminated-msg')?.style.color).toBe('rgb(238, 136, 136)');
    answers['keepOut'] = { data: null, error: null };
    await turnMode.saveBlockEliminated(false);
    expect((page.getElementById('detail-block-eliminated') as HTMLInputElement).checked).toBe(true);
    expect(textOf('detail-block-eliminated-msg')).toBe('Not saved: this game could not be changed.');
    page.body.innerHTML = '';
    await turnMode.saveBlockEliminated(true);
  });
  test("the bots' diplomacy saved: the world written with the choice; a world that isn't an object throws", async () => {
    page.body.innerHTML =
      '<select id="detail-botdiplomacy"><option value="normal">n</option><option value="hostile" selected>h</option></select><div id="detail-botdiplomacy-msg"></div>';
    const game: Record<string, unknown> = { id: 'G1', turn: 4, game_state: '{"botCount":1}' };
    G['currentGame'] = game;
    answers['changeOnTurn'] = { data: { id: 'G1' }, error: null };
    await turnMode.saveBotDiplomacy();
    expect(game['game_state']).toBe('{"botCount":1,"botDiplomacy":"hostile"}');
    expect(calls[0]?.[1]?.slice(0, 2)).toEqual(['G1', 4]);
    expect(textOf('detail-botdiplomacy-msg')).toBe('Saved — applies from the next turn resolved.');
    answers['changeOnTurn'] = { data: null, error: null };
    await turnMode.saveBotDiplomacy();
    expect(textOf('detail-botdiplomacy-msg')).toContain('The turn advanced while you were editing');
    answers['changeOnTurn'] = { data: null, error: { message: 'refused <x>' } };
    await turnMode.saveBotDiplomacy();
    expect(textOf('detail-botdiplomacy-msg')).toBe('refused <x>');
    game['game_state'] = '"words"';
    await expect(turnMode.saveBotDiplomacy()).rejects.toThrow(TypeError);
  });
  test("buildGameMeta: the settings, the archive's mark, the sea share and the realms out, in the meta's order", () => {
    const m = turnMode.buildGameMeta({
      botCount: 2,
      visibility: undefined,
      archived: 1,
      archivedAt: 'when',
      world: { seaPct: 0 },
      players: [{ provinces: [1] }, { conceded: true }],
    });
    expect(Object.keys(m)).toEqual([
      'v',
      'turnMode',
      'botCount',
      'archived',
      'archivedAt',
      'seaPct',
      'realms',
      'exempt',
    ]);
    expect(m).toMatchObject({ archived: true, archivedAt: 'when', seaPct: 0, realms: 2, exempt: [1] });
    expect(turnMode.buildGameMeta({ archived: true, archivedAt: '', seaPct: null, world: {} })).toEqual({
      v: 1,
      turnMode: startup.normalizeTurnMode(undefined),
      archived: true,
    });
    expect(turnMode.buildGameMeta('words')).toEqual(turnMode.buildGameMeta({}));
  });
});
