// The GM page's game list, turn log and game screen on the values handed them (plan P1-16s): the lines P1-16s changed
// in src/ui/gm/game-list.ts, turn-log.ts and game-detail.ts that the screen tours and the matrix don't reach, or reach
// only in part, each pinned to the value it gave before the files were typed: the list's empty and archived halves, the
// New Game form's hints and its checks, a game made, archived and restored, the invite pickers (an account of empty
// name), the last turn's chronicle on odd lines (a force's rows, a line that is no object, a phase between the whole
// ones, the intelligence, a realm of empty name or none), a game deleted, and the game screen's counts, its refusals, a
// player removed and the turn mode and invites saved. Some cases came from the mutation session of 2026-11-17.
// Level 1 (unit): the three files import in Node once the page's config, the `supabase` global and a Db handed in are
// stood in (as the statistics tab's unit test does); a page test would boot the whole page and sign in to reach each.
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootJsdom } from '../lib/boot.ts';
import { THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE as THE_FORCE } from '../../src/views/the-kinds-of-line-the-spy-and-scrying-feeds-pass-over.ts';

interface AnAnswer {
  data: unknown;
  error: unknown;
}
/** What each of the stood-in Db's functions answers, by `area.function`: an answer, or a function that makes one. */
const answers: Record<string, AnAnswer | (() => AnAnswer)> = {};
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
            (...args: unknown[]): Promise<AnAnswer> => {
              const name = `${String(area)}.${String(fn)}`;
              calls.push([name, args]);
              const a = answers[name];
              if (a === undefined) return Promise.resolve({ data: [], error: null });
              try {
                return Promise.resolve(typeof a === 'function' ? a() : a);
              } catch (e) {
                return Promise.reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
        },
      ),
  },
);

let page: Document;
let gl: typeof import('../../src/ui/gm/game-list.ts');
let tl: typeof import('../../src/ui/gm/turn-log.ts');
let gd: typeof import('../../src/ui/gm/game-detail.ts');
let signIn: typeof import('../../src/ui/gm/sign-in.ts');
let startup: typeof import('../../src/ui/gm/startup.ts');
/** The page's declared globals, as the GM page's files read them by their bare names. */
const G = globalThis as unknown as Record<string, unknown>;
let confirmAnswer = true;
const confirms: string[] = [];
const alerts: string[] = [];

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
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    kcTheDbATestHandsThePage: theDb,
    alert: (words: string) => alerts.push(words),
    confirm: (words: string) => {
      confirms.push(words);
      return confirmAnswer;
    },
  });
  gl = await import('../../src/ui/gm/game-list.ts');
  tl = await import('../../src/ui/gm/turn-log.ts');
  gd = await import('../../src/ui/gm/game-detail.ts');
  signIn = await import('../../src/ui/gm/sign-in.ts');
  startup = await import('../../src/ui/gm/startup.ts');
});

const PAGE = `<section id="sec-games"></section><section id="sec-new-game"></section><section id="sec-game-detail"></section>
<div id="msg-games"></div><input id="overlord-filter" value=""><div id="games-list"></div>
<div id="new-game-msg"></div><input id="new-game-name" value="">
<select id="new-game-mapsize"><option value="p2">p2</option><option value="p5" selected>p5</option><option value="p9">p9</option><option value="px">px</option></select>
<select id="new-game-maxplayers"><option value="4">4</option></select>
<input id="new-game-seapct" value="35"><span id="new-game-seapct-label"></span><div id="new-game-sea-hint"></div>
<input id="new-game-botcount" value="0"><input type="checkbox" id="new-game-allbot"><div id="new-game-bot-hint"></div>
<select id="new-game-botdiplomacy"><option value="normal">n</option><option value="hostile">h</option></select>
<input type="checkbox" id="new-game-safestart">
<select id="new-game-turnmode"><option value="manual">m</option><option value="auto">a</option><option value="deadline">d</option></select>
<div id="new-game-turnmode-fields"></div>
<input type="radio" name="new-game-visibility" value="public" checked><input type="radio" name="new-game-visibility" value="private">
<div id="new-game-invite-wrap"></div><input id="new-game-invite-search" value=""><div id="new-game-invite-list"></div><div id="new-game-invite-count"></div>
<h2 id="detail-game-name"></h2><span id="detail-status-pill"></span><button id="detail-archive-btn"></button>
<div id="detail-msg"></div><span id="detail-player-count"></span><div id="detail-players-list"></div>
<div id="detail-visibility-wrap"></div><div id="detail-turnmode-wrap"></div><div id="detail-run-turn0-wrap"></div>
<div id="detail-orders-card"></div><div id="detail-orders-status"></div><div id="detail-run-turn-wrap"></div>
<div id="detail-run-now-note"></div><button id="detail-run-turn-btn"></button>
<div id="detail-log-card"></div><div id="detail-log"></div><div id="detail-reports-card"></div><div id="detail-reports"></div>
<div id="not-gm-msg"></div>`;

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
/** The New Game form's Private choice, ticked. */
const thePrivateChoiceTicked = () => {
  const priv = page.querySelector('input[value="private"]');
  if (!(priv instanceof HTMLInputElement)) throw new Error('no private choice');
  priv.checked = true;
};
/** An element's words, its runs of white space as one space. */
const words = (id: string): string => $(id).textContent.replace(/\s+/g, ' ').trim();
/** Lets the page's awaits run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** Signs the stood-in GM in, as the Overlord or not (the page's own check sets its flag). */
async function signedInAs(overlord: boolean) {
  answers['theRoles.isTheSignedInAccountAGameMaster'] = { data: true, error: null };
  answers['theRoles.isTheSignedInAccountTheOverlord'] = { data: overlord, error: null };
  await signIn.gmPortalAllowed();
}
/** Probes for the light meta column, there or not (the page's own probe sets its flag). */
async function withTheMetaColumn(there: boolean) {
  answers['theGameMastersGames.oneGamesMeta'] = { data: [], error: there ? null : { message: 'no meta' } };
  await startup.probeGameMeta();
}

beforeEach(async () => {
  calls.length = 0;
  confirms.length = 0;
  alerts.length = 0;
  confirmAnswer = true;
  for (const k of Object.keys(answers)) Reflect.deleteProperty(answers, k);
  page.body.innerHTML = PAGE;
  G['currentUser'] = { id: 'gm-1' };
  G['currentGame'] = null;
  G['currentGamePlayers'] = [];
  G['_invitablePlayers'] = null;
  G['_inviteSelected'] = new Set();
  G['_editInviteSelected'] = new Set();
  G['_kcHasMsg'] = false;
  G['_kcHasTel'] = false;
  G['_kcHasLb'] = false;
  G['_autoWatcherTimer'] = null;
  await signedInAs(false);
  await withTheMetaColumn(false);
  calls.length = 0;
});

/** A game of the GM's list, as its light read answers it. */
const aListedGame = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Game ${id}`,
  gm_user_id: 'gm-1',
  status: 'active',
  turn: 3,
  max_players: 4,
  max_turns: 0,
  created_at: '2026-10-01T10:00:00Z',
  meta: null,
  game_players: [],
  ...extra,
});
/** A realm's row as the game screen's read answers it. */
const aRealm = (id: string, pi: number, extra: Record<string, unknown> = {}) => ({
  id,
  game_id: 'g-1',
  user_id: `u-${String(pi)}`,
  player_index: pi,
  display_name: `Player ${String(pi)}`,
  orders_submitted: false,
  invite_code: null,
  turn_report: null,
  ...extra,
});
/** A game as the game screen's read answers it: every column, its realms'. */
const anOpenGame = (extra: Record<string, unknown> = {}) => ({
  ...aListedGame('g-1'),
  game_state: null,
  block_eliminated_msgs: false,
  updated_at: null,
  game_players: [aRealm('s-0', 0), aRealm('s-1', 1)],
  ...extra,
});

describe("the GM's list of games", () => {
  test('a list of archived games only: the active half says there are none, with the switch to the archive', async () => {
    answers['theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn'] = {
      data: [aListedGame('g-1', { game_state: JSON.stringify({ archived: true }) })],
      error: null,
    };
    await gl.loadGames();
    expect(words('games-list')).toBe('🗄 Archived games (1) No active games. Click "+ New Game" to start one.');
    expect(callsTo('theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn')).toEqual([['gm-1']]);
  });
  test('the meta column there: the light list is read; no rows reads as none; the archive switch reloads it', async () => {
    await withTheMetaColumn(true);
    answers['theGameMastersGames.theGamesThisGameMasterRunsNewestFirst'] = { data: null, error: null };
    await gl.loadGames();
    expect(words('games-list')).toBe('No games yet. Click "+ New Game" to create your first game.');
    answers['theGameMastersGames.theGamesThisGameMasterRunsNewestFirst'] = {
      data: [aListedGame('g-1', { meta: { v: 1, archived: true } })],
      error: null,
    };
    gl.toggleArchivedView();
    await settle();
    expect(words('games-list')).toContain('Archived games. Everything is kept');
    expect(words('games-list')).toContain('← Back to active games (0)');
    gl.toggleArchivedView();
    await settle();
  });
  test("a card's realms missing, and none signed in", async () => {
    answers['theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn'] = {
      data: [aListedGame('g-1', { status: 'setup', game_players: undefined, created_at: undefined })],
      error: null,
    };
    await gl.loadGames();
    expect(words('games-list')).toBe(
      'Game g-1Setup — 0/4 joined 🌍 Public 4 player slots · Sea 35% · Created Invalid Date ›',
    );
    G['currentUser'] = null;
    await expect(gl.loadGames()).rejects.toThrow(TypeError);
    G['currentUser'] = { id: 'gm-1' };
    page.getElementById('games-list')?.remove();
    await expect(gl.loadGames()).rejects.toThrow(TypeError);
    answers['theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn'] = {
      data: null,
      error: { message: 'no' },
    };
    await expect(gl.loadGames()).rejects.toThrow(TypeError);
  });
  test("the Overlord's list: every page read, grouped by the GMs' names, a GM with no name and none, the filter", async () => {
    await signedInAs(true);
    answers['theGameMastersGames.everyGameNewestFirstFromRowToRowEveryColumn'] = {
      data: [
        aListedGame('g-1', { gm_user_id: 'gm-a' }),
        aListedGame('g-2', { gm_user_id: 'gm-b' }),
        aListedGame('g-3', { gm_user_id: null }),
        aListedGame('g-4', { gm_user_id: 'gm-a', name: '' }),
      ],
      error: null,
    };
    answers['theAccountsNames.theNamesOfTheseAccounts'] = {
      data: [
        { id: 'gm-a', name: 'Aldric' },
        { id: 'gm-b', name: null },
      ],
      error: null,
    };
    await gl.loadGames();
    expect(callsTo('theAccountsNames.theNamesOfTheseAccounts')).toEqual([[['gm-a', 'gm-b']]]);
    expect([...$('games-list').querySelectorAll('.gm-group')].map((g) => g.getAttribute('data-gm'))).toEqual([
      '(no GM)',
      '(unknown GM)',
      'Aldric',
    ]);
    expect(words('games-list')).toContain('Aldric · 2 games');
    expect(words('games-list')).toContain('(no GM) · 1 game');
    $input('overlord-filter').value = 'nobody';
    gl.renderGameList();
    expect(words('games-list')).toBe('No game matches.');
    $input('overlord-filter').value = 'unknown';
    gl.renderGameList();
    expect([...$('games-list').querySelectorAll('.gm-group')].map((g) => g.getAttribute('data-gm'))).toEqual([
      '(unknown GM)',
    ]);
    answers['theGameMastersGames.everyGameNewestFirstFromRowToRowEveryColumn'] = { data: [], error: null };
    await gl.loadGames();
    expect(words('games-list')).toBe('No games yet.');
    answers['theGameMastersGames.everyGameNewestFirstFromRowToRowEveryColumn'] = { data: null, error: null };
    await gl.loadGames();
    expect(words('games-list')).toBe('No games yet.');
    answers['theGameMastersGames.everyGameNewestFirstFromRowToRowEveryColumn'] = {
      data: [aListedGame('g-1', { gm_user_id: 'gm-a', game_state: JSON.stringify({ archived: true }) })],
      error: null,
    };
    answers['theAccountsNames.theNamesOfTheseAccounts'] = { data: null, error: null };
    await gl.loadGames();
    expect(words('games-list')).toBe('🗄 Archived games (1) No active games.');
    expect(gl._gmNames).toEqual({});
    answers['theGameMastersGames.everyGameNewestFirstFromRowToRowEveryColumn'] = {
      data: null,
      error: { message: 'refused' },
    };
    await gl.loadGames();
    expect(words('games-list')).toBe('refused');
  });
  test('an active card: the orders in, a realm with no account and a bot, the turn mode, the last run', async () => {
    answers['theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn'] = {
      data: [
        aListedGame('g-1', {
          game_state: JSON.stringify({ turnMode: { mode: 'auto', turnRanAt: 'not a time' } }),
          game_players: [
            { user_id: 'u-0', player_index: 0, orders_submitted: true },
            { user_id: null, player_index: 1, orders_submitted: false },
          ],
        }),
      ],
      error: null,
    };
    await gl.loadGames();
    expect(words('games-list')).toBe(
      'Game g-1Turn 3 — 1/1 orders in ✓ ⚙️ Auto (all orders in) 4 player slots · Sea 35% · Created 10/1/2026 · Last turn run not recorded ›',
    );
    answers['theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn'] = {
      data: [aListedGame('g-2', { game_players: undefined })],
      error: null,
    };
    await gl.loadGames();
    expect(words('games-list')).toBe(
      'Game g-2Turn 3 — 0/0 orders in ✓ 4 player slots · Sea 35% · Created 10/1/2026 · Last turn run not recorded ›',
    );
  });
});

describe('the New Game form', () => {
  test('the hints: a size the table lacks, no player count, all bots, bots in every slot, one bot', () => {
    $('new-game-mapsize').innerHTML = '<option value="px" selected>px</option>';
    gl.updateMaxPlayersForMap();
    expect([...$('new-game-maxplayers').querySelectorAll('option')].map((o) => o.value)).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(words('new-game-sea-hint')).toBe(
      '29 sea · 55 land of 84 provinces — about 13.8 land provinces per realm. Coasts and channels — the classic map. Most realms touch the sea; a navy is useful but not essential.',
    );
    $('new-game-maxplayers').remove();
    $input('new-game-seapct').value = '80';
    gl.updateSeaHint();
    expect(words('new-game-seapct-label')).toBe('80%');
    expect(words('new-game-sea-hint')).toBe(
      '67 sea · 17 land of 84 provinces — about 8.5 land provinces per realm. A drowned world — scattered islands in open ocean. Every campaign is amphibious; expect far less land, tax and lairs per realm.',
    );
    $('new-game-mapsize').remove();
    $input('new-game-seapct').value = '20';
    gl.updateSeaHint();
    expect(words('new-game-sea-hint')).toBe(
      '17 sea · 67 land of 84 provinces — about 33.5 land provinces per realm. A continent — a few lakes and inland seas. Fleets and Naval matter little; wars are fought overland.',
    );
    $('new-game-seapct').remove();
    gl.updateSeaHint();
    gl.updateMaxPlayersForMap();
    page.body.innerHTML = PAGE;
    gl.updateMaxPlayersForMap();
    $input('new-game-allbot').checked = true;
    gl.updateBotHint();
    expect(words('new-game-bot-hint')).toBe(
      '🤖 All-bot game: all 4 realms will be GM-controlled bots. No humans can join. Needs at least 2.',
    );
    expect($input('new-game-botcount').disabled).toBe(true);
    $input('new-game-allbot').checked = false;
    $input('new-game-botcount').value = '9';
    gl.updateBotHint();
    expect($input('new-game-botcount').value).toBe('4');
    expect(words('new-game-bot-hint')).toBe(
      '🤖 4 bots, no room for human players (bots fill all 4 slots). Tick “All-bot game”, or lower the bot count to leave human slots.',
    );
    $input('new-game-botcount').value = '1';
    gl.updateBotHint();
    expect(words('new-game-bot-hint')).toBe(
      '🤖 1 bot + up to 3 humans = 4 realms. Bots are generated when you run Turn 0.',
    );
    $input('new-game-botcount').value = '3';
    gl.updateBotHint();
    expect(words('new-game-bot-hint')).toBe(
      '🤖 3 bots + up to 1 human = 4 realms. Bots are generated when you run Turn 0.',
    );
    $input('new-game-botcount').value = 'x';
    gl.updateBotHint();
    expect($('new-game-bot-hint').style.display).toBe('none');
    $('new-game-bot-hint').remove();
    gl.updateBotHint();
  });
  test('the form opened: the choices put back as they start', () => {
    $input('new-game-seapct').value = '60';
    gl.showNewGame();
    expect($input('new-game-seapct').value).toBe('35');
    expect($('new-game-invite-wrap').style.display).toBe('none');
    for (const id of ['new-game-invite-search', 'new-game-turnmode', 'new-game-seapct', 'new-game-invite-wrap'])
      $(id).remove();
    gl.showNewGame();
  });
  test('no name; bots in every slot, the GM saying no; a private game with nobody invited, the GM saying no', async () => {
    await gl.createGame();
    expect(words('new-game-msg')).toBe('Please enter a game name.');
    $input('new-game-name').value = '  Westmarch  ';
    $input('new-game-botcount').value = '7';
    confirmAnswer = false;
    await gl.createGame();
    expect(confirms).toEqual(["You've set 4 bots with no room for human players. Create this as an all-bot game?"]);
    $input('new-game-botcount').value = '0';
    thePrivateChoiceTicked();
    await gl.createGame();
    expect(confirms).toHaveLength(2);
    expect(callsTo('theGameMastersGames.makeThisGame')).toEqual([]);
  });
  test('a game made: its settings in order, the GM, the meta; a private one; the refusals by their words and code', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      await withTheMetaColumn(true);
      $input('new-game-name').value = 'Westmarch';
      $input('new-game-botcount').remove();
      $input('new-game-safestart').checked = true;
      ($('new-game-botdiplomacy') as HTMLSelectElement).value = 'hostile';
      await gl.createGame();
      const [[made]] = callsTo('theGameMastersGames.makeThisGame') as [[Record<string, unknown>]];
      expect(made['game_state']).toBe(
        '{"mapSize":"p5","maxTurns":0,"maxPlayers":4,"botCount":0,"allBot":false,"seaPct":35,"botDiplomacy":"hostile","safeStart":true,"botDifficulty":"hard","turnMode":{"mode":"manual","time":"20:00","everyDays":1,"nextDeadlineAt":null,"turnRanAt":null}}',
      );
      expect(made['gm_user_id']).toBe('gm-1');
      expect(made['meta']).toBeTypeOf('object');
      expect(words('new-game-msg')).toBe('Game created! Any registered player can now see and join it.');
      calls.length = 0;
      vi.advanceTimersByTime(1500);
      expect(callsTo('theGameMastersGames.theGamesThisGameMasterRunsNewestFirst')).toHaveLength(1);
      thePrivateChoiceTicked();
      G['_inviteSelected'] = new Set(['p-1']);
      await gl.createGame();
      expect(words('new-game-msg')).toBe('Game created! Only your 1 invited player will see it.');
      G['_inviteSelected'] = new Set(['p-1', 'p-2']);
      await gl.createGame();
      expect(words('new-game-msg')).toBe('Game created! Only your 2 invited players will see it.');
      const tip = 'Add an INSERT policy on the games table in your Supabase dashboard.';
      answers['theGameMastersGames.makeThisGame'] = {
        data: null,
        error: { message: 'new row violates row-level security' },
      };
      await gl.createGame();
      expect(words('new-game-msg')).toBe(`new row violates row-level security${tip}`);
      answers['theGameMastersGames.makeThisGame'] = { data: null, error: { message: 'denied', code: '42501' } };
      await gl.createGame();
      expect(words('new-game-msg')).toBe(`denied${tip}`);
      answers['theGameMastersGames.makeThisGame'] = { data: null, error: { code: '23505' } };
      await gl.createGame();
      expect(words('new-game-msg')).toBe('');
      answers['theGameMastersGames.makeThisGame'] = { data: null, error: { message: 'other' } };
      await gl.createGame();
      expect(words('new-game-msg')).toBe('other');
      G['currentUser'] = null;
      await expect(gl.createGame()).rejects.toThrow(TypeError);
      G['currentUser'] = { id: 'gm-1' };
      $('new-game-msg').remove();
      await expect(gl.createGame()).rejects.toThrow(TypeError);
    } finally {
      vi.useRealTimers();
    }
  });
});

test('a game made on a map size the table lacks: up to 10 realms', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  try {
    $input('new-game-name').value = 'Westmarch';
    const size = $('new-game-mapsize');
    if (!(size instanceof HTMLSelectElement)) throw new Error('no map size');
    size.value = 'px';
    $('new-game-maxplayers').innerHTML = '<option value="9" selected>9</option>';
    await gl.createGame();
    const [[made]] = callsTo('theGameMastersGames.makeThisGame') as [[Record<string, unknown>]];
    expect(made['max_players']).toBe(9);
  } finally {
    vi.useRealTimers();
  }
});

describe('archiving', () => {
  test('a game archived and restored: the conditional save on its turn, or the plain one with none', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T01:02:03Z'));
    try {
      answers['theGameMastersGames.thisGamesTurnAndWorld'] = {
        data: { id: 'g-1', turn: 4, game_state: '{"x":1}' },
        error: null,
      };
      answers['theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId'] = { data: { id: 'g-1' }, error: null };
      await gl.setGameArchived('g-1', true);
      const [[, turn, change]] = callsTo('theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId') as [
        [string, number, Record<string, unknown>],
      ];
      expect(turn).toBe(4);
      expect(change['game_state']).toBe('{"x":1,"archived":true,"archivedAt":"2026-11-17T01:02:03.000Z"}');
      answers['theGameMastersGames.thisGamesTurnAndWorld'] = {
        data: { id: 'g-1', turn: null, game_state: '{"x":1,"archived":true,"archivedAt":"t"}' },
        error: null,
      };
      answers['theGameMastersGames.changeThisGameAndAnswerItsId'] = { data: { id: 'g-1' }, error: null };
      await gl.setGameArchived('g-1', false);
      const [[, restored]] = callsTo('theGameMastersGames.changeThisGameAndAnswerItsId') as [
        [string, Record<string, unknown>],
      ];
      expect(restored['game_state']).toBe('{"x":1}');
      answers['theGameMastersGames.thisGamesTurnAndWorld'] = {
        data: { id: 'g-1', turn: 4, game_state: '"words"' },
        error: null,
      };
      calls.length = 0;
      await gl.setGameArchived('g-1', false);
      const [[, , kept]] = callsTo('theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId') as [
        [string, number, Record<string, unknown>],
      ];
      expect(kept['game_state']).toBe('"words"');
      await expect(gl.setGameArchived('g-1', true)).rejects.toThrow(TypeError);
    } finally {
      vi.useRealTimers();
    }
  });
  test('no game, a refusal with no words, the turn moved on, the save refused; the message in the list when no game is open', async () => {
    await gl.setGameArchived(undefined, true);
    expect(calls).toEqual([]);
    answers['theGameMastersGames.thisGamesTurnAndWorld'] = { data: null, error: { code: 'x' } };
    await gl.setGameArchived('g-1', true);
    expect(words('detail-msg')).toBe('Game not found.');
    answers['theGameMastersGames.thisGamesTurnAndWorld'] = {
      data: { id: 'g-1', turn: 4, game_state: '{}' },
      error: null,
    };
    answers['theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId'] = { data: null, error: null };
    await gl.setGameArchived('g-1', true);
    expect(words('detail-msg')).toBe('The turn advanced while you were archiving — reload and try again.');
    answers['theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId'] = {
      data: null,
      error: { message: 'no' },
    };
    $('detail-msg').remove();
    await gl.setGameArchived('g-1', false);
    expect(words('msg-games')).toBe('no');
    $('msg-games').remove();
    await gl.setGameArchived('g-1', false);
  });
  test('the meta backfill: none to do, one saved and one refused, the list reloaded only when it shows, a throw', async () => {
    expect(await gl.backfillGameMeta()).toBe(0);
    await withTheMetaColumn(true);
    expect(await gl.backfillGameMeta()).toBe(0);
    answers['theGameMastersGames.theGamesThisGameMasterRunsWithNoMeta'] = {
      data: [
        { id: 'g-1', game_state: '{}' },
        { id: 'g-2', game_state: '{}' },
      ],
      error: null,
    };
    let n = 0;
    answers['theGameMastersGames.changeThisGame'] = () => ({ data: null, error: n++ ? { message: 'no' } : null });
    $('sec-games').classList.add('section-active');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await gl.backfillGameMeta()).toBe(1);
    expect(log).toHaveBeenCalledWith('[meta] backfilled 1 game(s)');
    log.mockRestore();
    await settle();
    expect(callsTo('theGameMastersGames.theGamesThisGameMasterRunsNewestFirst')).toHaveLength(1);
    answers['theGameMastersGames.theGamesThisGameMasterRunsWithNoMeta'] = () => {
      throw new Error('down');
    };
    expect(await gl.backfillGameMeta()).toBe(0);
    G['currentUser'] = null;
    expect(await gl.backfillGameMeta()).toBe(0);
  });
});

describe('the invite pickers', () => {
  test('the players read once: the GM left out, a name missing or empty, a month unread; a refusal thrown as it came', async () => {
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = {
      data: [
        { id: 'gm-1', name: 'The GM', created_at: '2026-01-05T00:00:00Z' },
        { id: 'p-1', name: null, created_at: null },
        { id: 'p-2', name: 'Bryn', created_at: 'not a day' },
        { id: 'p-3', name: 'Cora', created_at: '2026-09-30T23:00:00Z' },
        { id: 'p-4', name: '', created_at: null },
      ],
      error: null,
    };
    expect(await gl.loadInvitablePlayers()).toEqual([
      { id: 'p-1', name: '(unnamed)', joined: '' },
      { id: 'p-2', name: 'Bryn', joined: '' },
      { id: 'p-3', name: 'Cora', joined: 'Sep 2026' },
      { id: 'p-4', name: '(unnamed)', joined: '' },
    ]);
    expect(gl._invitableRawCount).toBe(5);
    await gl.loadInvitablePlayers();
    expect(callsTo('theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder')).toHaveLength(1);
    expect(gl.invitedNames(['p-3', 'p-9', 3])).toEqual(['Cora', '(unknown player)', '(unknown player)']);
    expect(gl.invitedNames(null)).toEqual([]);
    const refusal = { message: 'refused', hint: 'a hint' };
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = { data: null, error: refusal };
    await expect(gl.loadInvitablePlayers(true)).rejects.toBe(refusal);
    expect(G['_invitablePlayers']).toBe(null);
    expect(gl._invitableRawCount).toBe(null);
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = { data: null, error: null };
    expect(await gl.loadInvitablePlayers(true)).toEqual([]);
    expect(gl._invitableRawCount).toBe(0);
    gl.renderInviteCheckboxes('new-game-invite-list', 'new-game-invite-search', new Set(), 'new-game-invite-count');
    expect(words('new-game-invite-list')).toContain('No profiles came back at all');
  });
  test('the picker: filtered, ticked, counted; a list with no ticks; ticks of another kind; no search box', async () => {
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = {
      data: [
        { id: 'p-1', name: 'Bryn', created_at: null },
        { id: 'p-2', name: 'Cora', created_at: '2026-09-02T00:00:00Z' },
      ],
      error: null,
    };
    await gl.loadInvitablePlayers(true);
    const ticked = new Set<unknown>(['p-2']);
    gl.renderInviteCheckboxes('new-game-invite-list', 'new-game-invite-search', ticked, 'new-game-invite-count');
    expect(words('new-game-invite-list')).toBe('Bryn Cora · joined Sep 2026');
    expect(words('new-game-invite-count')).toBe('1 player invited');
    gl.toggleInvite('new-game-invite-list', 'new-game-invite-search', 'new-game-invite-count', 'p-1', true);
    expect([...ticked]).toEqual(['p-2', 'p-1']);
    expect(words('new-game-invite-count')).toBe('2 players invited');
    gl.toggleInvite('new-game-invite-list', 'new-game-invite-search', 'new-game-invite-count', 'p-2', false);
    expect(words('new-game-invite-count')).toBe('1 player invited');
    $input('new-game-invite-search').value = 'zz';
    gl.renderInviteCheckboxes('new-game-invite-list', 'new-game-invite-search', ticked, 'new-game-invite-count');
    expect(words('new-game-invite-list')).toBe('No players match that filter.');
    $('new-game-invite-search').remove();
    gl.renderInviteCheckboxes('new-game-invite-list', 'new-game-invite-search', ticked, 'new-game-invite-count');
    expect(words('new-game-invite-list')).toBe('Bryn Cora · joined Sep 2026');
    gl.toggleInvite('detail-msg', 's', 'new-game-invite-count', 'p-1', false);
    gl.toggleInvite('no-such-list', 's', 'new-game-invite-count', 'p-1', false);
    expect(words('new-game-invite-count')).toBe('1 player invited');
    Reflect.set($('detail-msg'), '_selectedSet', ['p-1']);
    expect(() => {
      gl.toggleInvite('detail-msg', 's', 'c', 'p-1', true);
    }).toThrow(TypeError);
    G['_invitablePlayers'] = null;
    gl.renderInviteCheckboxes('new-game-invite-list', 'new-game-invite-search', ticked, 'no-count');
    expect(words('new-game-invite-list')).toBe('No other registered players yet.');
  });
  test('the New Game picker opened for a private game, and its load refused', async () => {
    thePrivateChoiceTicked();
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = {
      data: null,
      error: { message: 'no access' },
    };
    await gl.updateGameVisibility();
    expect(words('new-game-invite-list')).toBe(
      "Couldn't load players: no accessThe GM account needs SELECT access to the profiles table (RLS).",
    );
  });
  test('the Edit invites window: not in setup, opened once, its load refused, closed', async () => {
    G['currentGame'] = anOpenGame({ status: 'active' });
    await gl.openEditInvites();
    expect(alerts).toEqual(['Invites can only be edited while the game is still in setup.']);
    G['currentGame'] = anOpenGame({
      status: 'setup',
      game_state: JSON.stringify({ visibility: 'private', invited: ['p-1'] }),
    });
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = {
      data: null,
      error: { message: 'no access' },
    };
    await gl.openEditInvites();
    expect([...(G['_editInviteSelected'] as Set<unknown>)]).toEqual(['p-1']);
    expect(words('edit-invite-list')).toBe(
      "Couldn't load players: no accessThe GM account needs SELECT access to the profiles table (RLS).",
    );
    await gl.openEditInvites();
    expect(page.querySelectorAll('#edit-invite-overlay')).toHaveLength(1);
    gl.closeEditInvites();
    expect(page.getElementById('edit-invite-overlay')).toBe(null);
    gl.closeEditInvites();
  });
});

describe("the last turn's chronicle", () => {
  test('no log yet', async () => {
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = { data: null, error: null };
    await tl.loadTurnLog('g-1', 2);
    expect(words('detail-log')).toBe('No log entries yet.');
    expect(callsTo('theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn')).toEqual([['g-1', 2]]);
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = { data: [{ entries: [] }], error: null };
    await tl.loadTurnLog('g-1', 2);
    expect(words('detail-log')).toBe('No entries.');
  });
  test("each hero's lines by phase, a force's rows, the realms' names, the intelligence, a line that is no object", async () => {
    G['currentGame'] = anOpenGame({
      game_state: JSON.stringify({
        characters: [
          { id: 7, name: 'Edda', player: 0 },
          { id: 3, name: 'Osric', player: 0, isKing: true },
          { id: 9, name: 'Wanderer' },
          { id: 11, name: 'Quiet', player: 1 },
        ],
        players: [{ name: 'Northreach' }],
      }),
    });
    const force = (f: unknown) => ({ kind: THE_FORCE, text: '[force]' + JSON.stringify(f), charId: 3, phase: 1 });
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = {
      data: [
        {
          entries: [
            { text: 'Osric rides **north**', charId: 3, phase: 0, type: 'move' },
            { text: '📊 roll │ 4', charId: 3, phase: 0 },
            { text: '📊 roll 5', charId: 3, phase: 0 },
            { text: '⚔ A battle', charIds: [99, 7], phase: 2 },
            { text: '⚠ A warning', charId: 7 },
            { text: null, charId: 7, phase: 4 },
            force({
              name: 'Osric',
              verb: 'stands',
              color: '#a0b0c0',
              armies: [
                { unitName: 'Guard', quality: 'Elite', type: 'Spear' },
                { quality: 'Green', type: 'Bow' },
              ],
            }),
            force({ name: 'Wolves', neutral: true, armies: [] }),
            force({ name: 'Odd', color: 'red', armies: 'abc' }),
            force({ name: 'Red', color: 'red' }),
            { kind: THE_FORCE, text: '[force]not json', charId: 3, phase: 1 },
            { text: '[Intelligence] seen', phase: 2 },
            { text: '[Intel] heard' },
            'a line that is words',
            { text: 'nobody', charId: 42 },
          ],
        },
        { entries: { text: '[Intel] one line, not a list', phase: 3 } },
        { entries: 0 },
      ],
      error: null,
    };
    await tl.loadTurnLog('g-1', 2);
    expect($('detail-log').innerHTML).toMatch(/^<div style="margin-bottom:6px;font-family:Cinzel/);
    expect(words('detail-log')).toBe(EXPECTED_CHRONICLE);
    const log = $('detail-log');
    expect(
      [...log.querySelectorAll('.log-entry')].map((e) => `${e.className}|${e.getAttribute('style') ?? ''}`),
    ).toEqual(EXPECTED_ENTRIES);
    expect([...log.querySelectorAll('.log-entry span')].map((e) => e.getAttribute('style'))).toEqual([
      'color:#a0b0c0',
      'color:#555',
      'color:#555',
    ]);
    expect(log.querySelectorAll('strong')).toHaveLength(1);
  });
  test("a realm whose name is empty words, and one with no name, are headed Unknown in the turn's chronicle", async () => {
    G['currentGame'] = anOpenGame({
      game_state: JSON.stringify({
        characters: [
          { id: 1, name: 'Edda', player: 0 },
          { id: 2, name: 'Osric', player: 1 },
          { id: 3, name: 'Wynn', player: 2 },
        ],
        players: [{ name: '' }, { name: null }, {}],
      }),
    });
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = {
      data: [{ entries: [{ text: 'Edda rides', charId: 1, phase: 0 }] }],
      error: null,
    };
    await tl.loadTurnLog('g-1', 2);
    expect(words('detail-log')).toBe('👑 Unknown ⚔ Edda Spring Edda rides 👑 Unknown 👑 Unknown');
  });
  test("a line of none throws; a hero's line in a phase between the whole ones throws; a hero of none throws", async () => {
    G['currentGame'] = anOpenGame({
      game_state: JSON.stringify({ characters: [{ id: 3, name: 'Osric', player: 0 }] }),
    });
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = { data: [{ entries: [null] }], error: null };
    await expect(tl.loadTurnLog('g-1', 2)).rejects.toThrow(TypeError);
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = {
      data: [
        {
          entries: [
            { text: '[Intel] x', phase: 2.5 },
            { text: 'x', charId: 3, phase: 2.5 },
          ],
        },
      ],
      error: null,
    };
    await expect(tl.loadTurnLog('g-1', 2)).rejects.toThrow(TypeError);
    G['currentGame'] = anOpenGame({ game_state: JSON.stringify({ characters: [null] }) });
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = { data: [{ entries: [] }], error: null };
    await expect(tl.loadTurnLog('g-1', 2)).rejects.toThrow(TypeError);
    G['currentGame'] = anOpenGame({ game_state: JSON.stringify({ characters: 'abc' }) });
    await expect(tl.loadTurnLog('g-1', 2)).rejects.toThrow(TypeError);
    G['currentGame'] = anOpenGame({
      game_state: JSON.stringify({ characters: [{ id: 1, name: 'A' }], players: 'xy' }),
    });
    answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = {
      data: [
        {
          entries: [
            { text: '[Intel] y', phase: 2.5 },
            { text: 'z', charId: 1 },
          ],
        },
      ],
      error: null,
    };
    await tl.loadTurnLog('g-1', 2);
    expect(words('detail-log')).toBe('👑 Player unowned ⚔ A End of Turn z 👁 Intelligence');
  });
});

test("the chronicle: the king first among heroes of words' ids; a realm the state names no player of", async () => {
  G['currentGame'] = anOpenGame({
    game_state: JSON.stringify({
      characters: [
        { id: 'h-b', name: 'Bryn', player: 0 },
        { id: 'h-a', name: 'Aldo', player: 0, isKing: true },
      ],
    }),
  });
  answers['theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn'] = {
    data: [
      {
        entries: [
          { text: 'b', charId: 'h-b' },
          { text: 'a', charId: 'h-a' },
        ],
      },
    ],
    error: null,
  };
  await tl.loadTurnLog('g-1', 2);
  expect(words('detail-log')).toBe('👑 Player 0 👑 Aldo End of Turn a ⚔ Bryn End of Turn b');
});

describe('a game deleted', () => {
  test('the GM saying no; every table cleared, by the game id as given; a cleanup that throws; the refusal; the list reloaded', async () => {
    confirmAnswer = false;
    await tl.deleteGame('g-1');
    expect(calls).toEqual([]);
    confirmAnswer = true;
    G['_kcHasMsg'] = true;
    G['_kcHasTel'] = true;
    G['_kcHasLb'] = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    answers['theDeletionOfAGame.removeThisGamesReadMarks'] = () => {
      throw new Error('marks');
    };
    answers['theDeletionOfAGame.removeThisGamesResults'] = () => {
      throw new Error('results');
    };
    answers['theDeletionOfAGame.removeThisGamesHallOfFameEntry'] = () => {
      throw new Error('record');
    };
    await tl.deleteGame('g-1');
    expect(calls.map(([n, args]) => `${n}(${String(args)})`)).toEqual([
      'theDeletionOfAGame.removeThisGamesTurnLogs(g-1)',
      'theDeletionOfAGame.removeThisGamesDispatches(g-1)',
      'theDeletionOfAGame.removeThisGamesReadMarks(g-1)',
      'theDeletionOfAGame.removeThisGamesTurnEvents(g-1)',
      'theDeletionOfAGame.removeThisGamesResults(g-1)',
      'theDeletionOfAGame.removeThisGamesHallOfFameEntry(g-1)',
      'theDeletionOfAGame.removeThisGamesRealms(g-1)',
      'theDeletionOfAGame.removeThisGame(g-1)',
      'theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn(gm-1)',
    ]);
    expect(warn.mock.calls.map(([w]): unknown => w)).toEqual([
      'dispatch cleanup:',
      'telemetry cleanup:',
      'leaderboard cleanup:',
    ]);
    warn.mockRestore();
    answers['theDeletionOfAGame.removeThisGame'] = { data: null, error: { message: 'not yours' } };
    await tl.deleteGame('g-1');
    expect(words('detail-msg')).toBe('not yours');
    $('detail-msg').remove();
    await expect(tl.deleteGame('g-1')).rejects.toThrow(TypeError);
  });
});

describe('the game screen', () => {
  test('a refusal; a game of none; realms missing; the counts of a game in setup with bots planned', async () => {
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: null, error: { message: 'gone' } };
    await gd.openGame('g-1');
    expect(words('detail-msg')).toBe('gone');
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: null, error: null };
    await expect(gd.openGame('g-1')).rejects.toThrow(TypeError);
    expect(G['currentGame']).toBe(null);
    answers['theGameMastersGames.thisGameWithItsRealms'] = {
      data: anOpenGame({
        status: 'setup',
        turn: 0,
        game_players: undefined,
        game_state: JSON.stringify({ botCount: 1 }),
      }),
      error: null,
    };
    await gd.openGame('g-1');
    expect(G['currentGamePlayers']).toEqual([]);
    expect(words('detail-status-pill')).toBe('Setup');
    expect(words('detail-player-count')).toBe('0/3 humans · 1 bot · sea 35%');
    expect(words('detail-players-list')).toBe(
      '🤖 Bot realm Generated at Turn 0 (open slot) Waiting for player (open slot) Waiting for player (open slot) Waiting for player',
    );
    answers['theGameMastersGames.thisGameWithItsRealms'] = {
      data: anOpenGame({
        status: 'setup',
        turn: 0,
        max_players: 2,
        game_players: [aRealm('s-0', 0)],
        game_state: JSON.stringify({ botCount: 2, archived: true }),
      }),
      error: null,
    };
    await gd.openGame('g-1');
    expect(words('detail-player-count')).toBe('1/0 humans · 2 bots · sea 35%');
    expect(words('detail-status-pill')).toBe('Setup 🗄 Archived');
    expect(words('detail-archive-btn')).toBe('♻ Restore Game');
  });
  test('a game in play: the counts with bots, its turn, its log; a finished one; a removed realm’s seat', async () => {
    answers['theGameMastersGames.thisGameWithItsRealms'] = {
      data: anOpenGame({
        game_players: [
          aRealm('s-0', 0, { orders_submitted: true }),
          aRealm('s-1', 1, { user_id: null, display_name: '', turn_report: undefined }),
        ],
        game_state: JSON.stringify({ players: [{}, { conceded: true }] }),
      }),
      error: null,
    };
    await gd.openGame('g-1');
    await settle();
    expect(words('detail-status-pill')).toBe('Turn 3');
    expect(words('detail-player-count')).toBe('1 human · 1 bot / 4');
    expect(words('detail-players-list')).toBe(
      'Player 0 Joined Orders in ✖ Remove 🤖 (slot open) 🤖 Bot 🏳 Conceded ✖ Remove',
    );
    expect(callsTo('theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn')).toEqual([['g-1', 2]]);
    expect(words('detail-orders-status')).toBe('Player 0: ✓ Orders submitted 🤖 : auto');
    answers['theGameMastersGames.thisGameWithItsRealms'] = {
      data: anOpenGame({ status: 'complete', game_players: [aRealm('s-0', 0)] }),
      error: null,
    };
    await gd.openGame('g-1');
    expect(words('detail-status-pill')).toBe('Complete');
    expect(words('detail-player-count')).toBe('1 human / 4');
  });
  test("a private game's invited players, by name, none, and the names' load refused", async () => {
    const privateGame = (invited: unknown[]) =>
      anOpenGame({ status: 'setup', turn: 0, game_state: JSON.stringify({ visibility: 'private', invited }) });
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: privateGame(['p-1', 'p-9']), error: null };
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = {
      data: [{ id: 'p-1', name: 'Bryn', created_at: null }],
      error: null,
    };
    await gd.openGame('g-1');
    expect(words('detail-visibility-wrap')).toContain('Bryn(unknown player)');
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: privateGame([]), error: null };
    await gd.openGame('g-1');
    expect(words('detail-visibility-wrap')).toContain('nobody invited yet — no one can join');
    G['_invitablePlayers'] = null;
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: privateGame(['p-1', 'p-2']), error: null };
    answers['theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder'] = {
      data: null,
      error: { message: 'no access' },
    };
    await gd.openGame('g-1');
    expect(words('detail-visibility-wrap')).toContain("2 invited (couldn't load names: no access)");
  });
  test('the orders: none signed in to the realms throws; the Overlord may run the turn now', async () => {
    G['currentGamePlayers'] = null;
    expect(() => {
      gd.renderOrdersStatus(anOpenGame());
    }).toThrow(TypeError);
    G['currentGamePlayers'] = [aRealm('s-0', 0)];
    await signedInAs(true);
    gd.renderOrdersStatus(
      anOpenGame({ game_state: JSON.stringify({ turnMode: { mode: 'deadline', time: '18:00' } }) }),
    );
    expect(words('detail-run-turn-btn')).toBe('⚡ Run turn now');
    expect($('detail-run-now-note').style.display).toBe('block');
    expect($('detail-run-turn-wrap').style.display).toBe('block');
    expect(words('detail-orders-status')).toContain('the watcher runs the turn when every realm');
  });
  test('the invites saved: the setup as words, as an object, unreadable, none; refused; a setup of no object throws', async () => {
    await gd.saveEditInvites();
    G['_editInviteSelected'] = new Set(['p-1']);
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: null, error: { message: 'not read again' } };
    const saves = () =>
      callsTo('theGameMastersGames.changeThisGame').map(
        ([, change]) => (change as Record<string, unknown>)['game_state'],
      );
    for (const gameState of ['{"botCount":1}', { botCount: 2 }, 'not json', null]) {
      G['currentGame'] = anOpenGame({ status: 'setup', game_state: gameState });
      await gd.saveEditInvites();
    }
    expect(saves()).toEqual([
      '{"botCount":1,"visibility":"private","invited":["p-1"]}',
      '{"botCount":2,"visibility":"private","invited":["p-1"]}',
      '{"visibility":"private","invited":["p-1"]}',
      '{"visibility":"private","invited":["p-1"]}',
    ]);
    expect((G['currentGame'] as Record<string, unknown>)['game_state']).toBe(
      '{"visibility":"private","invited":["p-1"]}',
    );
    expect(callsTo('theGameMastersGames.thisGameWithItsRealms')).toHaveLength(4);
    page.body.insertAdjacentHTML('beforeend', '<div id="edit-invite-msg"></div>');
    answers['theGameMastersGames.changeThisGame'] = { data: null, error: { message: 'refused' } };
    await gd.saveEditInvites();
    expect(words('edit-invite-msg')).toBe('refused');
    G['currentGame'] = anOpenGame({ game_state: '7' });
    await expect(gd.saveEditInvites()).rejects.toThrow(TypeError);
    G['currentGame'] = anOpenGame({ game_state: 'null' });
    await expect(gd.saveEditInvites()).rejects.toThrow(TypeError);
  });
  test('a player removed in setup, and in play: the concession recorded once; refusals; the realm with no name', async () => {
    await gd.removePlayer('s-0');
    G['currentGame'] = anOpenGame({ status: 'setup' });
    G['currentGamePlayers'] = null;
    await gd.removePlayer('s-0');
    expect(confirms).toEqual([]);
    G['currentGamePlayers'] = [aRealm('s-0', 0, { display_name: '' })];
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: anOpenGame({ status: 'setup' }), error: null };
    const said: string[] = [];
    const watching = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) said.push(String(n.textContent));
    });
    watching.observe($('detail-msg'), { childList: true });
    await gd.removePlayer('s-0');
    await settle();
    watching.disconnect();
    expect(said).toEqual([
      'Removing player…',
      'Realm 1 has been removed and their slot is open again.',
      'Realm 1 has been removed and their slot is open again.',
    ]);
    expect(confirms[0]).toBe(
      'Remove Realm 1 from "Game g-1"?\n\nThe game has not started, so their slot simply reopens for another player. This cannot be undone.',
    );
    expect(words('detail-msg')).toBe('Realm 1 has been removed and their slot is open again.');
    G['currentGame'] = anOpenGame({
      game_state: JSON.stringify({ players: [{ name: 'A' }, {}], _gmRemovedRealms: 'x' }),
    });
    G['currentGamePlayers'] = [aRealm('s-0', 0)];
    answers['theGameMastersGames.thisGameWithItsRealms'] = { data: anOpenGame(), error: null };
    await gd.removePlayer('s-0');
    const [[, change]] = callsTo('theGameMastersGames.changeThisGame') as [[string, Record<string, unknown>]];
    expect(change['game_state']).toBe(
      '{"players":[{"name":"A","conceded":true,"concededTurn":3,"_gmRemoved":true},{}],"_gmRemovedRealms":[0]}',
    );
    expect(words('detail-msg')).toBe(
      'Player 0 has been removed — their realm has conceded and will only defend from here on.',
    );
    calls.length = 0;
    G['currentGame'] = anOpenGame({ game_state: JSON.stringify({ players: [{}], _gmRemovedRealms: [0, 2] }) });
    await gd.removePlayer('s-0');
    const [[, again]] = callsTo('theGameMastersGames.changeThisGame') as [[string, Record<string, unknown>]];
    expect(again['game_state']).toBe(
      '{"players":[{"conceded":true,"concededTurn":3,"_gmRemoved":true}],"_gmRemovedRealms":[0,2]}',
    );
    calls.length = 0;
    G['currentGame'] = anOpenGame({ game_state: JSON.stringify({ players: [{ conceded: true }] }) });
    await gd.removePlayer('s-0');
    expect(callsTo('theGameMastersGames.changeThisGame')).toEqual([]);
    G['currentGame'] = anOpenGame({ game_state: JSON.stringify({ players: [{}] }) });
    answers['theGameMastersGames.changeThisGame'] = { data: null, error: { message: 'locked' } };
    await gd.removePlayer('s-0');
    expect(words('detail-msg')).toBe('Could not record the concession: locked');
    G['currentGame'] = anOpenGame({ game_state: JSON.stringify({ players: [true] }) });
    await gd.removePlayer('s-0');
    expect(words('detail-msg')).toBe("Cannot create property 'conceded' on boolean 'true'");
    G['currentGame'] = anOpenGame({ status: 'setup' });
    answers['theGameMastersRealms.removeThisRealm'] = { data: null, error: { message: 'kept' } };
    await gd.removePlayer('s-0');
    expect(words('detail-msg')).toBe('kept');
    answers['theGameMastersRealms.removeThisRealm'] = () => {
      throw Object.assign(new Error(), { message: '' });
    };
    await gd.removePlayer('s-0');
    expect(words('detail-msg')).toBe('Could not remove the player.');
    confirmAnswer = false;
    calls.length = 0;
    await gd.removePlayer('s-0');
    expect(calls).toEqual([]);
  });
  test('the turn mode saved: a deadline set, kept, cleared; the turn moved on; refused; the game closed meanwhile; a state of no object', async () => {
    const tm = (gameState: Record<string, unknown>) => {
      G['currentGame'] = anOpenGame({ game_state: JSON.stringify(gameState) });
    };
    $('detail-turnmode-wrap').innerHTML =
      '<select id="detail-turnmode"><option value="manual">m</option><option value="deadline" selected>d</option></select><input id="detail-deadline-time" value="18:00"><input id="detail-deadline-days" value="2"><div id="detail-turnmode-msg"></div>';
    answers['theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId'] = { data: { id: 'g-1' }, error: null };
    tm({
      turnMode: {
        mode: 'deadline',
        time: '18:00',
        everyDays: 2,
        nextDeadlineAt: '2030-01-01T00:00:00.000Z',
        turnRanAt: 'r',
      },
    });
    G['currentGamePlayers'] = [aRealm('s-0', 0)];
    await gd.saveTurnMode();
    expect((G['currentGame'] as Record<string, unknown>)['game_state']).toBe(
      '{"turnMode":{"mode":"deadline","time":"18:00","everyDays":2,"nextDeadlineAt":"2030-01-01T00:00:00.000Z","turnRanAt":"r"}}',
    );
    const saved = () =>
      callsTo('theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId').map(
        ([, , c]) => JSON.parse(String((c as Record<string, unknown>)['game_state'])) as { turnMode: unknown },
      );
    expect(saved()[0]?.turnMode).toEqual({
      mode: 'deadline',
      time: '18:00',
      everyDays: 2,
      nextDeadlineAt: '2030-01-01T00:00:00.000Z',
      turnRanAt: 'r',
    });
    expect(words('detail-orders-status')).toContain('Player 0: ⏳ Awaiting orders');
    $('detail-turnmode-wrap').innerHTML =
      '<select id="detail-turnmode"><option value="manual" selected>m</option></select><div id="detail-turnmode-msg"></div>';
    tm({ turnMode: { mode: 'deadline' }, status: 'x' });
    await gd.saveTurnMode();
    expect(saved()[1]?.turnMode).toEqual({
      mode: 'manual',
      time: '20:00',
      everyDays: 1,
      nextDeadlineAt: null,
      turnRanAt: null,
    });
    G['currentGame'] = anOpenGame({ status: 'setup', game_state: '{}' });
    $('detail-orders-status').innerHTML = '';
    $('detail-turnmode-wrap').innerHTML = '<div id="detail-turnmode-msg"></div>';
    await gd.saveTurnMode();
    expect(words('detail-orders-status')).toBe('');
    answers['theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId'] = { data: null, error: null };
    await gd.saveTurnMode();
    expect(words('detail-turnmode-msg')).toBe(
      'The turn advanced while you were editing — reload the game and try again.',
    );
    answers['theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId'] = {
      data: null,
      error: { message: 'no' },
    };
    await gd.saveTurnMode();
    expect(words('detail-turnmode-msg')).toBe('no');
    answers['theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId'] = () => {
      G['currentGame'] = null;
      return { data: { id: 'g-1' }, error: null };
    };
    G['currentGame'] = anOpenGame({ game_state: '{}' });
    await expect(gd.saveTurnMode()).rejects.toThrow("Cannot set properties of null (setting 'game_state')");
    G['currentGame'] = anOpenGame({ game_state: '"words"' });
    await expect(gd.saveTurnMode()).rejects.toThrow(TypeError);
    G['currentGame'] = null;
    await gd.saveTurnMode();
  });
});

/** The chronicle's lines, each its classes and its style, as the GM page drew them before it was typed. */
const COMBAT = 'border-left:4px solid var(--crimson);background:#fdf0f0;padding:4px 8px;margin-top:4px';
const STAT = 'font-size:.78rem;color:#231e16;padding:2px 6px;background:#f5f0e8';
const EXPECTED_ENTRIES: string[] = [
  'log-entry move|padding:2px 6px',
  `log-entry stat|${STAT};font-family:monospace;white-space:pre;overflow-x:auto`,
  `log-entry stat|${STAT}`,
  `log-entry combat|${COMBAT}`,
  `log-entry combat|${COMBAT}`,
  'log-entry |padding:2px 6px',
  `log-entry combat|${COMBAT}`,
  'log-entry |padding:2px 6px',
  `log-entry combat|${COMBAT};font-weight:600`,
  'log-entry |padding:2px 6px',
  `log-entry combat|${COMBAT};font-weight:600`,
  'log-entry |padding:2px 6px',
  'log-entry |padding:2px 6px',
  'log-entry |padding:2px 6px',
];
/** The chronicle's words for the odd lines above, as the GM page drew them before it was typed. */
const EXPECTED_CHRONICLE =
  '👑 Northreach 👑 Osric Spring Osric rides north📊 roll │ 4📊 roll 5 Early Summer ⚔ Osric stands:• Guard — Elite Spear• Green Bow⚔ Wolves :— no armies —[force]{"name":"Odd","color":"red","armies":"abc"}⚔ Red :— no armies —[force]not json ⚔ Edda Late Summer ⚔ A battle Early Winter End of Turn ⚠ A warning 👑 Player 1 👑 Player unowned 👁 Intelligence Late Summer [Intelligence] seen Fall [Intel] one line, not a list[Intel] heard';
