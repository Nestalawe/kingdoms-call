// The GM page's auto-turn watcher, turn shell and Turn 0 on the values handed them (plan P1-16t): the lines P1-16t
// changed in src/ui/gm/auto-turn.ts, turn-shell.ts and turn-zero.ts that the screen tours and the matrix don't reach,
// or reach only in part, each pinned to the value it gave before the files were typed: the watcher's lease, its tick
// (no games, a game with no realms, a deadline, a pause, another tab's lease, a run that fails, the open game kept up to
// date), its timer and the sign-in; the shell's refusals (no game, no realms, the load's words), the watcher's
// message, a whole turn whose reports or statistics fail; and Turn 0's settings, the players' setups, the roster, the
// map made larger, and a world made, saved and reported (or not).
// Level 1 (unit): the three files import in Node once the page's config, the `supabase` global and a Db handed in are
// stood in (as the game list's unit test does); a page test would boot the whole page and sign in to reach each.
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootJsdom } from '../lib/boot.js';

interface AnAnswer {
  data: unknown;
  error: unknown;
}
/** What each of the stood-in Db's functions answers, by `area.function`: an answer, or a function that makes one (or
 *  throws what the call rejects with). */
const answers: Record<string, AnAnswer | ((...args: unknown[]) => AnAnswer)> = {};
/** Each call the page made on the stood-in Db: `area.function` and its arguments. */
const calls: [string, unknown[]][] = [];
const callsTo = (name: string): unknown[][] => calls.filter(([n]) => n === name).map(([, args]) => args);
/** The stood-in Db: every area's every function answers from `answers`, else no rows and no error. */
const theDb = new Proxy(
  {},
  {
    has: () => true,
    get: (_, area) =>
      new Proxy(
        {},
        {
          get:
            (__, fn) =>
            async (...args: unknown[]): Promise<AnAnswer> => {
              await Promise.resolve();
              const name = `${String(area)}.${String(fn)}`;
              calls.push([name, args]);
              const a = answers[name];
              if (a === undefined) return { data: [], error: null };
              return typeof a === 'function' ? a(...args) : a; // a throw rejects the call with what was thrown
            },
        },
      ),
  },
);

/** A browser's storage, stood in: one that throws on every read and write when `broken`. */
class AStorage {
  held = new Map<string, string>();
  broken = false;
  getItem(key: string): string | null {
    if (this.broken) throw new Error('no storage');
    return this.held.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.broken) throw new Error('no storage');
    this.held.set(key, value);
  }
  removeItem(key: string) {
    if (this.broken) throw new Error('no storage');
    this.held.delete(key);
  }
}
const local = new AStorage();
const session = new AStorage();

let page: Document;
let at: typeof import('../../src/ui/gm/auto-turn.ts');
let tm: typeof import('../../src/ui/gm/turn-mode.ts');
let ts: typeof import('../../src/ui/gm/turn-shell.ts');
let tz: typeof import('../../src/ui/gm/turn-zero.ts');
let signIn: typeof import('../../src/ui/gm/sign-in.ts');
let startup: typeof import('../../src/ui/gm/startup.ts');
let world: typeof import('../../src/engine/world/generate.ts');
let rng: typeof import('../../src/engine/rng.ts');
/** The page's declared globals, as the GM page's files read them by their bare names. */
const G = globalThis as unknown as Record<string, unknown>;
const warned: string[] = [];
const logged: string[] = [];

beforeAll(async () => {
  const { window } = bootJsdom('<!doctype html><html><body></body></html>');
  const W = window as unknown as Window & Record<string, unknown>;
  page = W.document;
  Object.assign(globalThis, {
    window: W,
    document: page,
    Element: W['Element'],
    MutationObserver: W['MutationObserver'],
    HTMLElement: W['HTMLElement'],
    HTMLInputElement: W['HTMLInputElement'],
    HTMLSelectElement: W['HTMLSelectElement'],
    localStorage: local,
    sessionStorage: session,
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    kcTheDbATestHandsThePage: theDb,
    alert: () => undefined,
    confirm: () => true,
  });
  at = await import('../../src/ui/gm/auto-turn.ts');
  tm = await import('../../src/ui/gm/turn-mode.ts');
  ts = await import('../../src/ui/gm/turn-shell.ts');
  tz = await import('../../src/ui/gm/turn-zero.ts');
  signIn = await import('../../src/ui/gm/sign-in.ts');
  startup = await import('../../src/ui/gm/startup.ts');
  world = await import('../../src/engine/world/generate.ts');
  rng = await import('../../src/engine/rng.ts');
});

const PAGE = `<meta name="kc-build" content="0123456789abcdef0123456789abcdef01234567"><section id="sec-auth"></section><section id="sec-games"></section><section id="sec-game-detail"></section>
<section id="sec-not-gm"></section><div id="not-gm-msg"></div><div id="spinner"></div>
<input id="si-email" value=""><input id="si-password" value=""><div id="auth-msg"></div>
<span id="gm-email-display"></span><span id="gm-role-label"></span><button id="new-game-btn"></button>
<div id="overlord-filter-wrap"></div><input id="overlord-filter" value=""><div id="msg-games"></div><div id="games-list"></div>
<div id="auto-turn-status"></div>
<h2 id="detail-game-name"></h2><span id="detail-status-pill"></span><button id="detail-archive-btn"></button>
<div id="detail-msg"></div><span id="detail-player-count"></span><div id="detail-players-list"></div>
<div id="detail-visibility-wrap"></div><div id="detail-turnmode-wrap"></div><div id="detail-run-turn0-wrap"></div>
<div id="detail-orders-card"></div><div id="detail-orders-status"></div><div id="detail-run-turn-wrap"></div>
<div id="detail-run-now-note"></div><button id="detail-run-turn-btn"></button>
<div id="detail-log-card"></div><div id="detail-log"></div><div id="detail-reports-card"></div><div id="detail-reports"></div>`;

const $ = (id: string): HTMLElement => {
  const el = page.getElementById(id);
  if (el === null) throw new Error(`no #${id} in the test's page`);
  return el;
};
const $input = (id: string): HTMLInputElement => {
  const el = $(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`#${id} is no input`);
  return el;
};
/** An element's words, its runs of white space as one space. */
const words = (id: string): string => $(id).textContent.replace(/\s+/g, ' ').trim();
/** Lets the page's awaits run. */
const settle = () => new Promise((r) => setTimeout(r, 0));
/** What a promise rejected with, in words (none if it didn't). */
async function whatItThrew(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'nothing';
  } catch (e) {
    return e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
  }
}

/** Probes for the light meta column, there or not (the page's own probe sets its flag). */
async function withTheMetaColumn(there: boolean) {
  answers['theGameMastersGames.oneGamesMeta'] = { data: [], error: there ? null : { message: 'no meta' } };
  await startup.probeGameMeta();
}

let theDiceWere: () => number;
beforeEach(async () => {
  calls.length = 0;
  warned.length = 0;
  logged.length = 0;
  for (const k of Object.keys(answers)) Reflect.deleteProperty(answers, k);
  local.held.clear();
  local.broken = false;
  session.held.clear();
  session.broken = false;
  page.body.innerHTML = PAGE;
  G['currentUser'] = { id: 'gm-1', email: 'gm@example.test' };
  G['currentGame'] = null;
  G['currentGamePlayers'] = [];
  G['_kcHasMsg'] = false;
  G['_kcHasTel'] = false;
  G['_kcHasLb'] = false;
  G['_kcTelLastErr'] = null;
  G['_autoWatcherTimer'] = null;
  G['_autoRunBusy'] = false;
  G['_pendingTurn0'] = null;
  at._autoFailUntil.clear();
  theDiceWere = rng.kcRng.use(rng.kcRngStream(20261117));
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => {
    warned.push(a.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    logged.push(a.map(String).join(' '));
  });
  await withTheMetaColumn(true);
  calls.length = 0;
});
afterEach(() => {
  rng.kcRng.use(theDiceWere);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** A realm's row as the database holds it. */
const aRealm = (pi: number, extra: Record<string, unknown> = {}) => ({
  id: `G1gp${String(pi)}`,
  game_id: 'G1',
  user_id: `u${String(pi)}`,
  player_index: pi,
  display_name: `Realm ${String(pi)}`,
  orders_submitted: true,
  orders: JSON.stringify({ orders: {}, encounterPlans: {}, kingSkills: {}, forTurn: 1 }),
  invite_code: null,
  last_submitted_at: null,
  created_at: null,
  turn_report: JSON.stringify({}),
  ...extra,
});
/** A game of the GM's list, as the watcher's light read answers it. */
const aListedGame = (extra: Record<string, unknown> = {}) => ({
  id: 'G1',
  name: 'Ashfall',
  gm_user_id: 'gm-1',
  status: 'active',
  turn: 3,
  max_players: 2,
  max_turns: 0,
  created_at: '2026-10-01T10:00:00Z',
  meta: { v: 1, turnMode: { mode: 'auto' } },
  game_players: [aRealm(0), aRealm(1)],
  ...extra,
});
/** The setup a player joined with, as his realm's report holds it. */
const aJoin = (setup: unknown) => JSON.stringify({ playerSetup: setup });
/** A whole world on Turn 1, as the GM page makes it, for two realms. */
function aWorldOnTurnOne(): string {
  const setups = [0, 1].map((i) => ({
    id: i,
    gamePlayerId: `G1gp${String(i)}`,
    isBot: false,
    name: `Realm ${String(i)}`,
    kingName: `King ${String(i)}`,
    kingdomName: `Realm ${String(i)}`,
    race: ['Human', 'Elven'][i] ?? 'Human',
    alignment: ['Good', 'Neutral'][i] ?? 'Good',
    temper: 'Brave',
    skills: { melee: 1, tactical: 1, march: 1 },
  }));
  const made = Object.assign(world.generateNewGame(setups, { cols: 8, rows: 7 }, 0, { seaPct: 20 }), {
    turnMode: { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null },
    botDifficulty: 'hard',
    botDiplomacy: 'normal',
  });
  return JSON.stringify(made);
}
/** The shell's database, answering a whole turn of a game on Turn 1 that goes through. */
function aTurnThatGoesThrough(state: string) {
  answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = {
    data: { ...aListedGame({ turn: 1 }), game_state: state },
    error: null,
  };
  answers['theTurnAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0), aRealm(1)], error: null };
  answers['theTurnAsTheGameMasterRunsIt.clearTheOrdersOfEveryRealmOfThisGame'] = { data: null, error: null };
  answers['theTurnAsTheGameMasterRunsIt.saveThisGameWhileOnThisTurnAndAnswerItsId'] = {
    data: { id: 'G1' },
    error: null,
  };
  answers['theTurnAsTheGameMasterRunsIt.giveThisRealmItsTurnReport'] = { data: null, error: null };
  answers['theTurnAsTheGameMasterRunsIt.writeThisLog'] = { data: null, error: null };
}

describe("the watcher's lease on a game", () => {
  test('none held: taken, and written with this tab and the time', () => {
    expect(at._autoLease('G1', true)).toBe(true);
    const held: unknown = JSON.parse(local.held.get('kc_autorun_G1') ?? 'null');
    expect(held).toEqual({ tab: at._tabId, at: expect.any(Number) as unknown });
  });
  test("another tab's lease of less than 20 minutes: refused, and left as it was", () => {
    const theirs = JSON.stringify({ tab: 'another', at: Date.now() - 19 * 60000 });
    local.held.set('kc_autorun_G1', theirs);
    expect(at._autoLease('G1', true)).toBe(false);
    expect(local.held.get('kc_autorun_G1')).toBe(theirs);
  });
  test("another tab's lease of more than 20 minutes, or this tab's own: taken", () => {
    local.held.set('kc_autorun_G1', JSON.stringify({ tab: 'another', at: Date.now() - 21 * 60000 }));
    expect(at._autoLease('G1', true)).toBe(true);
    local.held.set('kc_autorun_G2', JSON.stringify({ tab: at._tabId, at: Date.now() }));
    expect(at._autoLease('G2', true)).toBe(true);
  });
  test('a lease held as no words, or as a number: taken and written', () => {
    local.held.set('kc_autorun_G1', '');
    expect(at._autoLease('G1', true)).toBe(true);
    expect(local.held.get('kc_autorun_G1')).toContain(at._tabId);
    local.held.set('kc_autorun_G2', '5');
    expect(at._autoLease('G2', true)).toBe(true);
    expect(local.held.get('kc_autorun_G2')).toContain(at._tabId);
  });
  test('a lease that is no JSON, or no storage at all: taken on trust, nothing written', () => {
    local.held.set('kc_autorun_G1', 'not json');
    expect(at._autoLease('G1', true)).toBe(true);
    expect(local.held.get('kc_autorun_G1')).toBe('not json');
    local.broken = true;
    expect(at._autoLease('G1', true)).toBe(true);
    expect(at._autoLease('G1', false)).toBe(true);
  });
  test('given back: the lease is gone', () => {
    at._autoLease('G1', true);
    expect(at._autoLease('G1', false)).toBe(true);
    expect(local.held.has('kc_autorun_G1')).toBe(false);
  });
});

describe('the reload before a due turn', () => {
  test('no session storage, or this turn already reloaded for: no reload, and no newer build asked for', async () => {
    session.broken = true;
    expect(await at.refreshIfNewerBuild({ id: 'G1', turn: 3, name: 'Ashfall' })).toBe(false);
    session.broken = false;
    session.held.set('kc_autorefresh', 'G1:3');
    expect(await at.refreshIfNewerBuild({ id: 'G1', turn: 3, name: 'Ashfall' })).toBe(false);
  });
});

describe("the watcher's tick", () => {
  test('the games unreadable, or none answered: the banner is left as it was', async () => {
    $('auto-turn-status').innerHTML = 'as before';
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = { data: null, error: { message: 'down' } };
    await at.autoTurnTick();
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = { data: null, error: null };
    await at.autoTurnTick();
    expect($('auto-turn-status').innerHTML).toBe('as before');
    expect(G['_autoRunBusy']).toBe(false);
    expect(logged).toEqual([]);
  });
  test('no meta column: every column is read; a tick while one runs, or signed out, reads nothing', async () => {
    await withTheMetaColumn(false);
    calls.length = 0;
    answers['theGameMastersGames.theActiveGamesThisGameMasterRunsEveryColumn'] = { data: [], error: null };
    await at.autoTurnTick();
    expect(calls.map(([n]) => n)).toEqual(['theGameMastersGames.theActiveGamesThisGameMasterRunsEveryColumn']);
    G['_autoRunBusy'] = true;
    await at.autoTurnTick();
    G['_autoRunBusy'] = false;
    G['currentUser'] = null;
    await at.autoTurnTick();
    expect(calls).toHaveLength(1);
  });
  test('a game with no realms, and a deadline game waiting: each its line, and no run', async () => {
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = {
      data: [
        aListedGame({ game_players: undefined }),
        aListedGame({
          id: 'G2',
          name: 'Brine',
          meta: { v: 1, turnMode: { mode: 'deadline', nextDeadlineAt: '2099-01-01T00:00:00Z' } },
          game_players: [aRealm(0, { orders_submitted: false })],
        }),
      ],
      error: null,
    };
    await at.autoTurnTick();
    expect(words('auto-turn-status')).toMatch(
      /^⚙️ Auto-turn watcher · checked .+ · keep this tab openAshfall: Turn 3 — no realmsBrine: Turn 3 — waiting on 1 · deadline .+$/,
    );
    expect(callsTo('theTurnAsTheGameMasterRunsIt.thisGameEveryColumn')).toEqual([]);
  });
  test('a game paused after a failed run, and one another tab holds: each its line, and no run', async () => {
    const until = Date.now() + 600000;
    at._autoFailUntil.set('G1', until);
    local.held.set('kc_autorun_G2', JSON.stringify({ tab: 'another', at: Date.now() }));
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = {
      data: [aListedGame(), aListedGame({ id: 'G2', name: 'Brine', turn: 7 })],
      error: null,
    };
    await at.autoTurnTick();
    expect(words('auto-turn-status')).toMatch(
      /Ashfall: Turn 3 — paused after a failed run, retrying .+Brine: another GM tab is running Turn 7$/,
    );
    expect(words('auto-turn-status')).toContain(
      `retrying ${tm.fmtDeadline(new Date(until).toISOString())}Brine`.replace(/\s+/g, ' '),
    );
    expect(callsTo('theTurnAsTheGameMasterRunsIt.thisGameEveryColumn')).toEqual([]);
  });
  test('a pause that has run out: the turn runs; its failure pauses the game again, its lease given back', async () => {
    at._autoFailUntil.set('G1', Date.now() - 1);
    G['currentGame'] = { id: 'G9', turn: 1 };
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = { data: [aListedGame()], error: null };
    answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = { data: null, error: { message: 'gone' } };
    await at.autoTurnTick();
    expect(words('auto-turn-status')).toMatch(/Ashfall: ⚠ Turn 3 failed \(could not load game\) — paused for 15 min$/);
    expect(Number(at._autoFailUntil.get('G1'))).toBeGreaterThan(Date.now() + 14 * 60000);
    expect(local.held.has('kc_autorun_G1')).toBe(false);
    expect(G['currentGame']).toEqual({ id: 'G9', turn: 1 });
  });
  test("a run that fails with no words: 'see console'; the open game takes the list's turn and meta first", async () => {
    G['currentGame'] = { id: 'G1', turn: 2, meta: { old: true }, game_state: 'the old world' };
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = {
      data: [aListedGame({ meta: { v: 1, turnMode: { mode: 'auto' }, fresh: true } })],
      error: null,
    };
    answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = {
      data: { ...aListedGame({ turn: 3 }), game_state: aWorldOnTurnOne().replace('"turn":1,', '"turn":3,') },
      error: null,
    };
    answers['theTurnAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0), aRealm(1)], error: null };
    answers['theTurnAsTheGameMasterRunsIt.clearTheOrdersOfEveryRealmOfThisGame'] = { data: null, error: null };
    answers['theTurnAsTheGameMasterRunsIt.putBackThisRealmsOrders'] = { data: null, error: null };
    const was = rng.kcRng.use(() => {
      throw new Error('');
    });
    try {
      await at.autoTurnTick();
    } finally {
      rng.kcRng.use(was);
    }
    expect(words('auto-turn-status')).toMatch(/Ashfall: ⚠ Turn 3 failed \(see console\) — paused for 15 min$/);
    expect(G['currentGame']).toEqual({
      id: 'G1',
      turn: 3,
      meta: { v: 1, turnMode: { mode: 'auto' }, fresh: true },
      game_state: 'the old world',
    });
  });
  test("every column read: the open game takes the list's world, and keeps its meta where the list has none", async () => {
    await withTheMetaColumn(false);
    G['currentGame'] = { id: 'G1', turn: 2, meta: { old: true }, game_state: 'the old world' };
    const listed: Record<string, unknown> = { ...aListedGame({ game_state: 'the new world' }) };
    Reflect.deleteProperty(listed, 'meta');
    listed['game_state'] = JSON.stringify({ turnMode: { mode: 'auto' } });
    answers['theGameMastersGames.theActiveGamesThisGameMasterRunsEveryColumn'] = { data: [listed], error: null };
    answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = { data: null, error: { message: 'gone' } };
    await at.autoTurnTick();
    expect(G['currentGame']).toEqual({
      id: 'G1',
      turn: 3,
      meta: { old: true },
      game_state: JSON.stringify({ turnMode: { mode: 'auto' } }),
    });
  });
  test('a game whose run throws before the turn (the open game is frozen): its words, paused, the lease given back', async () => {
    G['currentGame'] = Object.freeze({ id: 'G1', turn: 2 });
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = { data: [aListedGame()], error: null };
    await at.autoTurnTick();
    expect(words('auto-turn-status')).toMatch(
      /Ashfall: ⚠ Cannot assign to read only property 'turn' of object '#<Object>' — paused for 15 min$/,
    );
    expect(logged[0]).toMatch(/^auto-turn error TypeError/);
    expect(at._autoFailUntil.has('G1')).toBe(true);
    expect(local.held.has('kc_autorun_G1')).toBe(false);
  });
  test('the watcher started: its first tick after 3 s, then one a minute; started twice, one timer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'] });
    answers['theGameMastersGames.theActiveGamesThisGameMasterRuns'] = { data: [], error: null };
    at.startAutoTurnWatcher();
    at.startAutoTurnWatcher();
    const reads = () => callsTo('theGameMastersGames.theActiveGamesThisGameMasterRuns').length;
    await vi.advanceTimersByTimeAsync(2999);
    expect(reads()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(reads()).toBe(1);
    await vi.advanceTimersByTimeAsync(56999);
    expect(reads()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(reads()).toBe(2);
    const timer = G['_autoWatcherTimer'];
    if (timer !== null && typeof timer !== 'undefined') clearInterval(timer as ReturnType<typeof setInterval>);
  });
});

describe("the GM's sign-in", () => {
  test('no address or no password: asked for both, and nothing sent', async () => {
    $input('si-email').value = '  ';
    $input('si-password').value = 'a-made-up-password';
    await at.doSignIn();
    expect(words('auth-msg')).toBe('Please enter your email and password.');
    expect(callsTo('signingIn.signInWithEmailAndPassword')).toEqual([]);
  });
  test('refused: the refusal in its words, the two known ones made plain', async () => {
    $input('si-email').value = ' gm@example.test ';
    $input('si-password').value = 'a-made-up-password';
    answers['signingIn.signInWithEmailAndPassword'] = { data: {}, error: { message: 'Invalid login credentials' } };
    await at.doSignIn();
    expect(words('auth-msg')).toBe('Email or password incorrect.');
    expect(callsTo('signingIn.signInWithEmailAndPassword')).toEqual([['gm@example.test', 'a-made-up-password']]);
    answers['signingIn.signInWithEmailAndPassword'] = { data: {}, error: { message: 'Something <odd>' } };
    await at.doSignIn();
    expect($('auth-msg').innerHTML).toBe('<div class="msg-error">Something &lt;odd&gt;</div>');
  });
  test('signed in: the account kept, and the GM page opens on it', async () => {
    $input('si-email').value = 'gm@example.test';
    $input('si-password').value = 'a-made-up-password';
    answers['signingIn.signInWithEmailAndPassword'] = {
      data: { user: { id: 'gm-2', email: 'second@example.test' } },
      error: null,
    };
    answers['theRoles.isTheSignedInAccountAGameMaster'] = { data: true, error: null };
    answers['theRoles.isTheSignedInAccountTheOverlord'] = { data: false, error: null };
    // the watcher it starts keeps its timers on the test's clock, so none of them runs in a later test
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'] });
    await at.doSignIn();
    await vi.advanceTimersByTimeAsync(0);
    expect(G['currentUser']).toEqual({ id: 'gm-2', email: 'second@example.test' });
    expect(words('gm-email-display')).toBe('second@example.test');
    expect(words('gm-role-label')).toBe('Game Master');
    expect(G['_autoWatcherTimer']).not.toBe(null);
    vi.clearAllTimers();
    G['_autoWatcherTimer'] = null;
  });
  test('an account with no address shows none; none signed in throws as the read did', async () => {
    G['currentUser'] = { id: 'gm-3' };
    $('gm-email-display').textContent = 'as before';
    answers['theRoles.isTheSignedInAccountAGameMaster'] = { data: false, error: null };
    answers['theRoles.isTheSignedInAccountTheOverlord'] = { data: false, error: null };
    await at.onSignedIn();
    expect($('gm-email-display').textContent).toBe('');
    G['currentUser'] = null;
    expect(await whatItThrew(at.onSignedIn())).toBe("TypeError: Cannot read properties of null (reading 'email')");
  });
});

describe("the turn's shell", () => {
  test('no game handed and none open: it throws as reading its turn did', async () => {
    expect(await whatItThrew(ts.runTurn())).toBe("TypeError: Cannot read properties of null (reading 'turn')");
  });
  test("the game's load refused with no words: the realms' refusal is shown", async () => {
    answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = { data: null, error: { message: '' } };
    answers['theTurnAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: null, error: { message: 'no realms' } };
    const r = await ts.runTurn({ game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    expect(r).toEqual({ ok: false, committed: false, error: 'could not load game' });
    expect(words('detail-msg')).toBe('Could not load game: no realms');
  });
  test('the realms answered as none: the run stops as filtering them did, and nothing was changed', async () => {
    answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = {
      data: { ...aListedGame({ turn: 1 }), game_state: aWorldOnTurnOne() },
      error: null,
    };
    answers['theTurnAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: null, error: null };
    const r = await ts.runTurn({ game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    expect(r).toEqual({
      ok: false,
      committed: false,
      conflict: false,
      error: "Cannot read properties of null (reading 'filter')",
      seed: null,
    });
    expect(words('detail-msg')).toBe(
      "⚠ Resolution error: Cannot read properties of null (reading 'filter')Nothing was changed by this run.",
    );
    expect(callsTo('theTurnAsTheGameMasterRunsIt.clearTheOrdersOfEveryRealmOfThisGame')).toEqual([]);
  });
  test("the watcher's run: its message goes to the banner, with the game's name and why (none: 'auto')", async () => {
    answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = { data: null, error: { message: 'gone' } };
    await ts.runTurn({ auto: true, game: { id: 'G1', turn: 1, name: 'Ashfall' }, reason: 'all orders in' });
    expect(words('auto-turn-status')).toBe('⚙️ Auto-turn watcher · Ashfall (all orders in)Could not load game: gone');
    await ts.runTurn({ auto: true, game: { id: 'G1', turn: 1, name: '' }, reason: '' });
    expect(words('auto-turn-status')).toBe('⚙️ Auto-turn watcher · (auto)Could not load game: gone');
    expect(words('detail-msg')).toBe('');
    G['currentGame'] = { id: 'G9', turn: 1 };
    await ts.runTurn({ auto: true, game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    expect(words('detail-msg')).toBe('');
  });
  test("the watcher's run of the game open: the game screen's message says it too, in its words", async () => {
    G['currentGame'] = { id: 'G1', turn: 1 };
    answers['theTurnAsTheGameMasterRunsIt.thisGameEveryColumn'] = { data: null, error: { message: 'a <b>' } };
    await ts.runTurn({ auto: true, game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    expect($('detail-msg').innerHTML).toBe('<div class="msg-error">Could not load game: a &lt;b&gt;</div>');
  });
  test("a whole turn: each realm's report stamped and sent to its row; a report refused is named by its realm", async () => {
    aTurnThatGoesThrough(aWorldOnTurnOne());
    answers['theTurnAsTheGameMasterRunsIt.giveThisRealmItsTurnReport'] = (realm) =>
      realm === 'G1gp1' ? { data: null, error: { message: 'refused' } } : { data: null, error: null };
    // each realm's snapshot of its report is best-effort: one that throws stops nothing
    answers['theTurnAsTheGameMasterRunsIt.writeThisLog'] = (log) => {
      if (Reflect.get(Object(log), 'player_index') !== -1) throw new Error('no snapshot');
      return { data: null, error: null };
    };
    const r = await ts.runTurn({ game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    expect(r).toMatchObject({ ok: true, committed: true, turn: 2 });
    const sent = callsTo('theTurnAsTheGameMasterRunsIt.giveThisRealmItsTurnReport');
    expect(sent.map(([realm]) => realm)).toEqual(['G1gp0', 'G1gp1']);
    expect(sent.map(([, report]) => (JSON.parse(String(report)) as Record<string, unknown>)['engineStamp'])).toEqual([
      signIn.runningBuildStamp(),
      signIn.runningBuildStamp(),
    ]);
    expect(words('detail-msg')).toBe('Turn resolved but some reports failed: 1: refused');
  });
  test('the statistics throw: the turn stands, and the game list keeps what was thrown, in words', async () => {
    G['_kcHasTel'] = true;
    for (const [thrown, kept] of [
      [new Error('stats down'), 'stats down'],
      [{ code: 7 }, '[object Object]'],
      [0, '0'],
      [{ message: '' }, '[object Object]'],
    ] as const) {
      aTurnThatGoesThrough(aWorldOnTurnOne());
      answers['theStatistics.writeTheseTurnRecords'] = () => {
        const what: unknown = thrown;
        throw what;
      };
      const r = await ts.runTurn({ game: { id: 'G1', turn: 1, name: 'Ashfall' } });
      expect(r).toMatchObject({ ok: true, committed: true });
      expect(G['_kcTelLastErr']).toBe(kept);
    }
  });
  test("the watcher's whole turn of a game not open, with the list shown: the list is read again", async () => {
    aTurnThatGoesThrough(aWorldOnTurnOne());
    $('sec-games').classList.add('section-active');
    await ts.runTurn({ auto: true, game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    await settle();
    expect(callsTo('theGameMastersGames.theGamesThisGameMasterRunsNewestFirst')).toEqual([['gm-1']]);
  });
  test('the save errs and the game cannot be read again: nothing put back, and the GM told how to tell', async () => {
    aTurnThatGoesThrough(aWorldOnTurnOne());
    answers['theTurnAsTheGameMasterRunsIt.saveThisGameWhileOnThisTurnAndAnswerItsId'] = {
      data: null,
      error: { message: 'timed out' },
    };
    answers['theTurnAsTheGameMasterRunsIt.theTurnOfThisGameIfItIsThere'] = () => {
      throw new Error('offline');
    };
    const r = await ts.runTurn({ game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    expect(r).toMatchObject({ ok: false, committed: false, conflict: false, error: 'Error saving: timed out' });
    expect(callsTo('theTurnAsTheGameMasterRunsIt.theTurnOfThisGameIfItIsThere')).toEqual([['G1']]);
    expect(callsTo('theTurnAsTheGameMasterRunsIt.putBackThisRealmsOrders')).toEqual([]);
    expect(words('detail-msg')).toBe(
      "⚠ Resolution error: Error saving: timed outThe save may or may not have gone through, and the game could not be read again to tell. The orders have NOT been restored, so the turn can't run twice. Reload the page: if the game is on Turn 2, the turn was saved; if it is still on Turn 1, ask the players to send their orders again.",
    );
  });
  test('the save errs, the game still on its turn, and the orders not all put back: the GM told so', async () => {
    for (const putBack of [
      () => ({ data: null, error: { message: 'refused' } }),
      () => {
        throw new Error('offline');
      },
    ]) {
      aTurnThatGoesThrough(aWorldOnTurnOne());
      answers['theTurnAsTheGameMasterRunsIt.saveThisGameWhileOnThisTurnAndAnswerItsId'] = {
        data: null,
        error: { message: 'refused' },
      };
      answers['theTurnAsTheGameMasterRunsIt.theTurnOfThisGameIfItIsThere'] = { data: { turn: 1 }, error: null };
      answers['theTurnAsTheGameMasterRunsIt.putBackThisRealmsOrders'] = putBack;
      calls.length = 0;
      await ts.runTurn({ game: { id: 'G1', turn: 1, name: 'Ashfall' } });
      expect(callsTo('theTurnAsTheGameMasterRunsIt.putBackThisRealmsOrders')).toHaveLength(2);
      expect(words('detail-msg')).toBe(
        '⚠ Resolution error: Error saving: refusedCheck browser console (F12) for full details. The orders could NOT all be restored: ask the players to send theirs again.',
      );
    }
  });
  test('a whole turn of the game open: the open game moves on, still active', async () => {
    G['currentGame'] = { id: 'G1', turn: 1, status: 'active' };
    aTurnThatGoesThrough(aWorldOnTurnOne());
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await ts.runTurn({ game: { id: 'G1', turn: 1, name: 'Ashfall' } });
    expect(G['currentGame']).toEqual({ id: 'G1', turn: 2, status: 'active' });
  });
});

describe('Turn 0', () => {
  /** The game open, in setup: its settings (the New Game form's) as its world holds them. */
  const aGameInSetUp = (settings: unknown, extra: Record<string, unknown> = {}) => ({
    ...aListedGame({ status: 'setup', turn: 0, meta: null, max_players: 4 }),
    game_state: typeof settings === 'string' ? settings : JSON.stringify(settings),
    game_players: [],
    ...extra,
  });
  test('no game open: it throws as reading its id did; the realms refused: said so', async () => {
    expect(await whatItThrew(tz.runTurn0())).toBe("TypeError: Cannot read properties of null (reading 'id')");
    G['currentGame'] = aGameInSetUp({ mapSize: 'p5' });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: null, error: { message: 'refused' } };
    await tz.runTurn0();
    expect(words('detail-msg')).toBe('Could not load players: refused');
  });
  test('settings of none throw as reading the map size did; settings that are no JSON, or no object, read as none', async () => {
    G['currentGame'] = aGameInSetUp('null');
    expect(await whatItThrew(tz.runTurn0())).toBe("TypeError: Cannot read properties of null (reading 'mapSize')");
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0)], error: null };
    for (const held of ['{not json', 5, '"words"', null]) {
      G['currentGame'] = aGameInSetUp('', { game_state: held });
      await tz.runTurn0();
      expect(words('detail-msg')).toBe(
        'Need at least 2 realms to start (currently 1 human + 0 bots). Wait for another player to join, or add bots at game creation.',
      );
    }
  });
  test("settings read as none, or held empty: the defaults (the map p5, 12 turns, the sea's share)", async () => {
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0)], error: null };
    for (const held of [null, 5, '{not json', '"words"', JSON.stringify({ mapSize: '', maxTurns: 0 })]) {
      G['currentGame'] = aGameInSetUp('', { game_state: held, meta: { v: 1, botCount: 1 } });
      G['_pendingTurn0'] = null;
      await tz.runTurn0();
      expect(G['_pendingTurn0']).toMatchObject({
        maxTurns: 12,
        mapSize: 'p5',
        sz: { cols: 12, rows: 7 },
        seaPct: 35,
        botDifficulty: null,
        botDiplomacy: 'normal',
        safeStart: false,
      });
    }
  });
  test('all bots and no room: Raise Maximum Players', async () => {
    G['currentGame'] = aGameInSetUp({ mapSize: 'p5', allBot: true }, { max_players: 1 });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: null, error: null };
    await tz.runTurn0();
    expect(words('detail-msg')).toBe(
      'Need at least 2 realms to start (currently 0 humans + 1 bot). Raise Maximum Players.',
    );
  });
  test("each player's setup as he joined, a part left out or held oddly read as the default", async () => {
    G['currentGame'] = aGameInSetUp({
      mapSize: 'p5',
      botCount: 1,
      botDifficulty: 'easy',
      botDiplomacy: 'hostile',
      safeStart: 1,
    });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = {
      data: [
        aRealm(2, {
          display_name: 'Ivo',
          turn_report: aJoin({
            kingName: 'Ivo the Tall',
            kingdomName: 'Ivoria',
            race: 'Elven',
            alignment: 'Good',
            temper: 'Calm',
            skills: { melee: 2 },
          }),
        }),
        aRealm(0, { display_name: '', turn_report: aJoin({ kingName: '', race: '', skills: 0 }) }),
        aRealm(1, { display_name: 'Nell', turn_report: aJoin('a setup in words') }),
        aRealm(3, { display_name: 'Odo', turn_report: 'not json' }),
        aRealm(4, { display_name: 'Pim', turn_report: 'null' }),
        aRealm(5, { display_name: 'Quin', turn_report: { playerSetup: { race: 'Dwarf' } } }),
        aRealm(6, { display_name: 'Rue', turn_report: null }),
      ],
      error: null,
    };
    await tz.runTurn0();
    const plan = G['_pendingTurn0'] as Record<string, unknown>;
    const defaults = { isBot: false, race: 'Human', alignment: 'Neutral', temper: 'Brave', skills: {} };
    expect(plan['humanSetups']).toEqual([
      { ...defaults, id: 0, gamePlayerId: 'G1gp0', name: 'Player 1', kingName: 'King 1', kingdomName: 'Realm 1' },
      { ...defaults, id: 1, gamePlayerId: 'G1gp1', name: 'Nell', kingName: 'Nell', kingdomName: 'Nell' },
      {
        ...defaults,
        id: 2,
        gamePlayerId: 'G1gp2',
        name: 'Ivo',
        kingName: 'Ivo the Tall',
        kingdomName: 'Ivoria',
        race: 'Elven',
        alignment: 'Good',
        temper: 'Calm',
        skills: { melee: 2 },
      },
      { ...defaults, id: 3, gamePlayerId: 'G1gp3', name: 'Odo', kingName: 'Odo', kingdomName: 'Odo' },
      { ...defaults, id: 4, gamePlayerId: 'G1gp4', name: 'Pim', kingName: 'Pim', kingdomName: 'Pim' },
      { ...defaults, id: 5, gamePlayerId: 'G1gp5', name: 'Quin', kingName: 'Quin', kingdomName: 'Quin', race: 'Dwarf' },
      { ...defaults, id: 6, gamePlayerId: 'G1gp6', name: 'Rue', kingName: 'Rue', kingdomName: 'Rue' },
    ]);
    expect(plan).toMatchObject({
      maxTurns: 12,
      seaPct: 35,
      botDifficulty: 'easy',
      botDiplomacy: 'hostile',
      safeStart: true,
      mapSize: 'p8',
      sz: { cols: 17, rows: 8 },
    });
    expect(warned).toEqual([
      'Turn 0: 8 realms on a p5 map — using the p8 map (17x8) so capitals stay 3+ provinces apart.',
    ]);
  });
  test('the roster: each realm, its skills above 0 by their labels, none as a dash; none planned clears it', async () => {
    G['_pendingTurn0'] = {
      humanSetups: [
        {
          id: 0,
          gamePlayerId: 'G1gp0',
          isBot: false,
          name: 'Ivo',
          kingName: 'Ivo the Tall',
          kingdomName: 'Ivoria',
          race: 'Elven',
          alignment: 'Good',
          temper: 'Calm',
          skills: { melee: 2, archery: 0, mystery: 1, tactical: '3' },
        },
      ],
      botSetups: [
        {
          id: 1,
          isBot: true,
          kingName: 'Bot King',
          kingdomName: 'Botland',
          race: 'Orc',
          alignment: 'Evil',
          temper: 'Brave',
          skills: {},
        },
      ],
    };
    tz.renderTurn0Preview();
    expect(words('detail-msg')).toBe(
      'Confirm the starting roster Review the generated bot realms below. Generate the world to lock them in, or re-roll the bots. Human players (1) Ivoria Ivo the Tall · Good · Elven · Calm Skills: Melee 2, mystery 1, Tactical 3 🤖 Bot realms (1) 🤖 Botland Bot King · Evil · Orc · Brave Skills: — ⚡ Generate World & Start 🎲 Re-roll Bots Cancel',
    );
    G['_pendingTurn0'] = null;
    tz.renderTurn0Preview();
    expect($('detail-msg').innerHTML).toBe('');
    await tz.commitTurn0();
    expect(words('detail-msg')).toBe('No pending setup — press Run Turn 0 again.');
  });
  test('a map too small for the realms is made larger: two players on a p2 map with a bot use the p3 map', async () => {
    G['currentGame'] = aGameInSetUp({ mapSize: 'p2', botCount: 1, maxTurns: 20 });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0), aRealm(1)], error: null };
    await tz.runTurn0();
    expect(G['_pendingTurn0']).toMatchObject({ mapSize: 'p3', sz: { cols: 8, rows: 7 }, maxTurns: 20 });
    expect(warned).toEqual([
      'Turn 0: 3 realms on a p2 map — using the p3 map (8x7) so capitals stay 3+ provinces apart.',
    ]);
    G['currentGame'] = aGameInSetUp({ mapSize: 'px', botCount: 1 });
    warned.length = 0;
    await tz.runTurn0();
    expect(G['_pendingTurn0']).toMatchObject({ mapSize: 'px', sz: { cols: 12, rows: 7 } });
    expect(warned).toEqual([]);
  });
  test("a bot's realm made with no row answered: the generation stops, as reading its id did", async () => {
    G['currentGame'] = aGameInSetUp({ mapSize: 'p3', botCount: 1 });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0), aRealm(1)], error: null };
    await tz.runTurn0();
    answers['theTurnZeroAsTheGameMasterRunsIt.makeThisBotsRealm'] = { data: null, error: null };
    await tz.commitTurn0();
    expect(words('detail-msg')).toBe("Generation error: Cannot read properties of null (reading 'id')");
  });

  /** Turn 0 of a game with two players and a bot, as the GM confirms it. */
  async function aTurnZeroConfirmed(settings: Record<string, unknown>) {
    G['currentGame'] = aGameInSetUp({ mapSize: 'p3', botCount: 1, ...settings });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0), aRealm(1)], error: null };
    await tz.runTurn0();
    answers['theTurnZeroAsTheGameMasterRunsIt.makeThisBotsRealm'] = (realm) => ({
      data: { ...aRealm(2), ...(realm as object), id: 'G1gp2' },
      error: null,
    });
    await tz.commitTurn0();
  }
  test('the world saved: started, its settings and its turn mode stamped; refused: said so', async () => {
    answers['theTurnZeroAsTheGameMasterRunsIt.startThisGame'] = { data: null, error: { message: 'refused' } };
    await aTurnZeroConfirmed({
      safeStart: true,
      botDiplomacy: 'hostile',
      turnMode: { mode: 'deadline', time: '20:00', everyDays: 2 },
    });
    expect(words('detail-msg')).toBe('Error saving game: refused');
    const [[game, change]] = callsTo('theTurnZeroAsTheGameMasterRunsIt.startThisGame') as [
      [string, Record<string, unknown>],
    ];
    expect(game).toBe('G1');
    expect(change).toMatchObject({ status: 'active', turn: 1 });
    const saved = JSON.parse(String(change['game_state'])) as Record<string, unknown>;
    expect(saved).toMatchObject({ safeStart: true, botDiplomacy: 'hostile', botDifficulty: 'hard' });
    expect(saved['turnMode']).toMatchObject({
      mode: 'deadline',
      everyDays: 2,
      nextDeadlineAt: expect.any(String) as unknown,
    });
    expect(callsTo('theTurnZeroAsTheGameMasterRunsIt.giveThisRealmItsFirstReport')).toEqual([]);
  });
  test("each realm's first report sent to its row and kept for turn 0; those refused are listed", async () => {
    answers['theTurnZeroAsTheGameMasterRunsIt.giveThisRealmItsFirstReport'] = (realm) =>
      realm === 'G1gp0' ? { data: null, error: null } : { data: null, error: { message: `no ${String(realm)}` } };
    await aTurnZeroConfirmed({});
    expect(words('detail-msg')).toBe('Game created but some reports failed: no G1gp1, no G1gp2');
    expect(callsTo('theTurnZeroAsTheGameMasterRunsIt.removeEveryBotsRealmOfThisGame')).toEqual([['G1']]);
    const sent = callsTo('theTurnZeroAsTheGameMasterRunsIt.giveThisRealmItsFirstReport');
    expect(sent.map(([realm]) => realm)).toEqual(['G1gp0', 'G1gp1', 'G1gp2']);
    const bots = sent.map(([, words]) => JSON.parse(String(words)) as Record<string, unknown>);
    expect(bots.map((r) => r['isBot'] ?? false)).toEqual([false, false, true]);
    expect(bots[0]?.['engineStamp']).toBe(signIn.runningBuildStamp());
    expect(
      callsTo('theTurnZeroAsTheGameMasterRunsIt.writeThisLog').map(([log]) => {
        const { game_id, player_index, turn } = log as Record<string, unknown>;
        return [game_id, player_index, turn];
      }),
    ).toEqual([
      ['G1', 0, 0],
      ['G1', 1, 0],
      ['G1', 2, 0],
    ]);
  });
  test('all sent: the GM told, the game screen moved on to its orders, and the game read again', async () => {
    answers['theTurnZeroAsTheGameMasterRunsIt.thisGameWithItsRealms'] = {
      data: {
        ...aGameInSetUp({}),
        status: 'active',
        turn: 1,
        game_players: [aRealm(0), aRealm(1), aRealm(2, { user_id: null })],
      },
      error: null,
    };
    // each realm's log of turn 0 is best-effort: one that throws stops nothing
    answers['theTurnZeroAsTheGameMasterRunsIt.writeThisLog'] = () => {
      throw new Error('no log');
    };
    await aTurnZeroConfirmed({});
    expect(words('detail-msg')).toBe(
      '✅ Turn 0 complete! Map generated for 2 humans + 1 bot. Players can now log in and see their realms.',
    );
    expect(G['_pendingTurn0']).toBe(null);
    expect($('detail-run-turn0-wrap').style.display).toBe('none');
    expect($('detail-orders-card').style.display).toBe('block');
    expect($('detail-log-card').style.display).toBe('none');
    expect(G['currentGame']).toMatchObject({ status: 'active', turn: 1 });
    expect(G['currentGamePlayers']).toHaveLength(3);
    expect(Reflect.get(Object(G['currentGame']), 'game_players')).toHaveLength(3);
    expect(callsTo('theTurnZeroAsTheGameMasterRunsIt.thisGameWithItsRealms')).toEqual([['G1']]);
    expect(words('detail-orders-status')).toContain('Realm 0: ✓ Orders submitted');
  });
  test('no bots: the world is made at once, with no roster to confirm', async () => {
    G['currentGame'] = aGameInSetUp({ mapSize: 'p3' });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0), aRealm(1)], error: null };
    // the world is made by a call nobody awaits: the game's read again, its last step, says when it is done
    const readAgain = new Promise<void>((done) => {
      answers['theTurnZeroAsTheGameMasterRunsIt.thisGameWithItsRealms'] = () => {
        done();
        return { data: null, error: null };
      };
    });
    await tz.runTurn0();
    await readAgain;
    expect(callsTo('theTurnZeroAsTheGameMasterRunsIt.makeThisBotsRealm')).toEqual([]);
    expect(callsTo('theTurnZeroAsTheGameMasterRunsIt.startThisGame')).toHaveLength(1);
    expect(words('detail-msg')).toBe(
      '✅ Turn 0 complete! Map generated for 2 humans. Players can now log in and see their realms.',
    );
  });
  test('one player and a bot: the GM told of one human and one bot', async () => {
    G['currentGame'] = aGameInSetUp({ mapSize: 'p3', botCount: 1 });
    answers['theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame'] = { data: [aRealm(0)], error: null };
    await tz.runTurn0();
    answers['theTurnZeroAsTheGameMasterRunsIt.makeThisBotsRealm'] = (realm) => ({
      data: { ...aRealm(1), ...(realm as object), id: 'G1gp1' },
      error: null,
    });
    await tz.commitTurn0();
    expect(words('detail-msg')).toBe(
      '✅ Turn 0 complete! Map generated for 1 human + 1 bot. Players can now log in and see their realms.',
    );
  });
  test('the game read again with no realms: the open game holds none', async () => {
    answers['theTurnZeroAsTheGameMasterRunsIt.thisGameWithItsRealms'] = {
      data: { ...aGameInSetUp({}), game_players: undefined },
      error: null,
    };
    await aTurnZeroConfirmed({});
    expect(G['currentGamePlayers']).toEqual([]);
  });
  test('the game read again with none: the open game kept, moved on to turn 1 and active', async () => {
    answers['theTurnZeroAsTheGameMasterRunsIt.thisGameWithItsRealms'] = { data: null, error: { message: 'gone' } };
    await aTurnZeroConfirmed({});
    expect(G['currentGame']).toMatchObject({ id: 'G1', status: 'active', turn: 1, game_players: [] });
  });
});
