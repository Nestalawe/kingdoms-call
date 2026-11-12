// The player portal's game lists, its join form's descriptions, and Save and Submit on the values handed them (plan
// P1-16m): the lines P1-16m changed in game-lists.ts and briefing-and-submit.ts that the screen tours don't reach, or
// reach only in part (npm run proof:tours), each run here on the value that reaches it, so a fault planted in one is red:
// the My Games cards (their tally, deadline, archive and unread marks), the Open Games cards (their capacity, world and
// GM), the live poll, the Game Master offer, the three descriptions, and the orders saved and sent.
// Level 4 (page): the two files load the page's start-up (its database client), so no lower level reaches them; the
// portal is booted in jsdom (tests/lib/boot.js) on a fake Db at an older database, so it stops at its notice with every
// module loaded, and each case stages the screen's state as the tours do.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';
import type { ADatabaseAnswer, Db } from '../../src/db/the-db-interface-and-its-areas.ts';

const errs: string[] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);
const theElement = (id: string): HTMLElement => {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`no element ${id}`);
  return el;
};
const textOf = (id: string): string => theElement(id).textContent.replace(/\s+/g, ' ').trim();

type AnAnswer = ADatabaseAnswer<unknown>;
const ok = (data: unknown): AnAnswer => ({ data, error: null, status: 200 });
const refused = (message: string): AnAnswer => ({ data: null, error: { message }, status: 400 });

/** What the fake answers this case. */
const answers: Record<string, () => AnAnswer> = {
  myRealms: () => ok([]),
  myFlags: () => ok([]),
  myGames: () => ok([]),
  cards: () => ok([]),
  everyColumn: () => ok([]),
  turnAndState: () => ok([]),
  setup: () => ok([]),
  slots: () => ok([]),
  names: () => ok([]),
  offer: () => ok(null),
  dispatches: () => ok([]),
  readMarks: () => ok([]),
  draft: () => ok(null),
  submit: () => ok(null),
  turn: () => ok({ turn: 3 }),
};
const fresh = { ...answers };
const asked: { readonly what: string; readonly args: unknown[] }[] = [];
const theAsked = (what: string): unknown[][] => asked.filter((a) => a.what === what).map((a) => a.args);
const answering =
  (what: string) =>
  (...args: unknown[]): Promise<never> => {
    asked.push({ what, args });
    const answer = answers[what];
    if (!answer) throw new Error(`no answer for ${what}`);
    return Promise.resolve(answer() as never);
  };

function theFakeDb(): Db {
  const bare = makeAFakeDb(['20261010000000']).db;
  return {
    ...bare,
    thePlayersRealms: {
      ...bare.thePlayersRealms,
      everyRealmOfThisAccount: answering('myRealms'),
      thisAccountsRealmsAndTheirOrdersFlags: answering('myFlags'),
      theGamesOfThisAccountsRealms: answering('myGames'),
      theSlotsOfTheseGames: answering('slots'),
    },
    thePlayersGames: {
      ...bare.thePlayersGames,
      theseGamesForTheirCards: answering('cards'),
      theseGamesEveryColumn: answering('everyColumn'),
      theTurnAndStateOfTheseGames: answering('turnAndState'),
      theGamesInSetup: answering('setup'),
    },
    theAccountsNames: { ...bare.theAccountsNames, theNamesOfTheseAccounts: answering('names') },
    theRoles: { ...bare.theRoles, theGameMasterOfferMadeToThisAccount: answering('offer') },
    theDispatches: {
      ...bare.theDispatches,
      theNewestDispatchesOfTheseGamesGamesAndRealms: answering('dispatches'),
      thisAccountsReadMarksInTheseGames: answering('readMarks'),
    },
    theOrders: {
      ...bare.theOrders,
      saveThisRealmsDraft: answering('draft'),
      submitThisRealmsOrders: answering('submit'),
      theTurnOfThisGame: answering('turn'),
    },
  };
}

beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: theFakeDb(),
    url: 'https://example.org/p',
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w['scrollTo'] = () => undefined;
      w['ResizeObserver'] = class {
        observe() {
          return undefined;
        }
      };
    },
  }).window;
  doc = P['document'] as Document;
  await new Promise((resolve) => setTimeout(resolve, 600));
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
beforeEach(() => {
  Object.assign(answers, fresh);
  asked.length = 0;
  stage('currentUser = { id: "U1" }; currentGamePlayer = null; currentReport = null;');
});
afterAll(() => {
  P.close();
});

/** A realm of the signed-in account, as the database answers it. */
const aRealm = (id: string, game: string, more: Record<string, unknown> = {}) => ({
  id,
  game_id: game,
  player_index: 0,
  display_name: 'Thornmere',
  orders_submitted: false,
  ...more,
});
/** A game's card row. */
const aGame = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  name: `Game ${id}`,
  status: 'active',
  turn: 3,
  meta: null,
  ...more,
});
/** A slot of a game (get_game_slots). */
const aSlot = (game: string, i: number, more: Record<string, unknown> = {}) => ({
  game_id: game,
  player_index: i,
  is_bot: false,
  orders_submitted: false,
  ...more,
});

describe('My Games', () => {
  test("a refused read of the realms, or of their games, says so in the database's words", async () => {
    answers['myRealms'] = () => refused('the realms are not there');
    await call('loadMyGames');
    expect(textOf('my-games-list')).toBe('the realms are not there');
    expect(theAsked('myRealms')).toEqual([['U1']]);
    answers['myRealms'] = () => ok([aRealm('R1', 'G1')]);
    answers['cards'] = () => refused('the games are not there');
    await call('loadMyGames');
    expect(textOf('my-games-list')).toBe('the games are not there');
  });
  test('no realm says so; a database without the meta column is read again, every column', async () => {
    answers['myRealms'] = () => ok([]);
    await call('loadMyGames');
    expect(textOf('my-games-list')).toContain('You are not enrolled in any games yet.');
    answers['myRealms'] = () => ok([aRealm('R1', 'G1')]);
    answers['cards'] = () => refused('column games.meta does not exist');
    answers['everyColumn'] = () => ok([aGame('G1', { game_state: '{}' })]);
    await call('loadMyGames');
    expect(theAsked('everyColumn')).toEqual([[['G1']]]);
    expect(textOf('my-games-list')).toContain('Game G1');
  });
  test('the tally leaves out bots and the exempt (from the meta, else the world), and the joining realm has no name yet', async () => {
    answers['myRealms'] = () => ok([aRealm('R1', 'G1', { display_name: '' }), aRealm('R2', 'G2')]);
    const world = {
      players: [{ provinces: [1] }, { conceded: true }, { provinces: [] }, {}, { _eliminated: true }],
      characters: [null, { alive: true, player: 3 }, { alive: false, player: 2 }],
    };
    answers['cards'] = () =>
      ok([aGame('G1', { meta: { v: 1, exempt: [1] } }), aGame('G2', { turn: 0, game_state: JSON.stringify(world) })]);
    answers['everyColumn'] = () => ok([]);
    answers['slots'] = () =>
      ok([
        aSlot('G1', 0, { orders_submitted: true }),
        aSlot('G1', 1),
        aSlot('G1', 2, { is_bot: true }),
        aSlot('G1', 3),
        aSlot('G2', 0, { orders_submitted: true }),
        aSlot('G2', 1),
        aSlot('G2', 2),
        aSlot('G2', 3, { orders_submitted: true }),
        aSlot('G2', 4),
      ]);
    await call('loadMyGames');
    const cards = [...theElement('my-games-list').querySelectorAll('.game-card')].map((c) =>
      c.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(cards[0]).toContain('Your realm: (joining…)');
    expect(cards[0]).toContain('1 of 2 realms have sent orders — still waiting on 1 more.');
    expect(cards[1]).toContain('Your realm: Thornmere · Turn 0');
    expect(cards[1]).toContain('2 of 2 realms have sent orders — every realm is in');
  });
  test("a world that isn't JSON exempts no one; one whose heroes aren't a list stops the list", async () => {
    answers['myRealms'] = () => ok([aRealm('R1', 'G1')]);
    answers['cards'] = () => ok([aGame('G1', { game_state: 'not json' })]);
    answers['slots'] = () => ok([aSlot('G1', 0), aSlot('G1', 1)]);
    await call('loadMyGames');
    expect(textOf('my-games-list')).toContain('0 of 2 realms have sent orders');
    answers['cards'] = () =>
      ok([aGame('G1', { game_state: { players: [{}, { provinces: [2] }], characters: { 0: { alive: true } } } })]);
    await expect(call('loadMyGames')).rejects.toHaveProperty('name', 'TypeError');
  });
  test('a game archived by its meta, or by its world, moves to the archived card', async () => {
    answers['myRealms'] = () => ok([aRealm('R1', 'G1'), aRealm('R2', 'G2'), aRealm('R3', 'G3')]);
    answers['cards'] = () =>
      ok([
        aGame('G1', { meta: { v: 1, archived: true } }),
        aGame('G2', { meta: { v: 1, archived: false }, game_state: { archived: true } }),
        aGame('G3', { game_state: { archived: true } }),
      ]);
    await call('loadMyGames');
    expect(textOf('my-games-list')).toContain('Game G2');
    expect(textOf('archived-games-count')).toBe('(2)');
    expect(textOf('archived-games-list')).toContain('Game G1');
    expect(textOf('archived-games-list')).toContain('Game G3');
    answers['cards'] = () => ok([aGame('G1', { meta: { v: 1, archived: true } })]);
    answers['myRealms'] = () => ok([aRealm('R1', 'G1')]);
    await call('loadMyGames');
    expect(textOf('my-games-list')).toContain('No active games — your archived games are listed further down.');
  });
  test('the turn mode: automatic, a deadline to come or passed (in the meta, else the world), else nothing', async () => {
    answers['myRealms'] = () => ok(['G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map((g, i) => aRealm(`R${String(i)}`, g)));
    answers['cards'] = () =>
      ok([
        aGame('G1', { meta: { v: 1, turnMode: { mode: 'auto' } } }),
        aGame('G2', { meta: { v: 1, turnMode: { mode: 'deadline', nextDeadlineAt: '2999-01-01T00:00:00Z' } } }),
        aGame('G3', { game_state: JSON.stringify({ turnMode: { mode: 'deadline', nextDeadlineAt: 1000 } }) }),
        aGame('G4', { meta: { v: 1, turnMode: { mode: 'sometimes' } } }),
        aGame('G5', { meta: { v: 1, turnMode: 'auto' } }),
        aGame('G6', { game_state: 'not json' }),
      ]);
    await call('loadMyGames');
    const cards = [...theElement('my-games-list').querySelectorAll('.game-card')].map((c) =>
      c.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(cards[0]).toContain('Turn 3 resolves automatically');
    expect(cards[1]).toContain('Turn 3 deadline:');
    expect(cards[1]).not.toContain('passed');
    expect(cards[2]).toContain('— passed; the turn is being resolved');
    for (const card of cards.slice(3)) expect(card).not.toContain('Turn 3 ');
  });
  test('the unread dispatches on a card: above the read mark, not its own, in a game of two human realms', async () => {
    answers['myRealms'] = () =>
      ok([aRealm('R1', 'G1'), aRealm('R2', 'G2', { player_index: 1 }), aRealm('R3', 'G3', { player_index: null })]);
    answers['cards'] = () => ok([aGame('G1'), aGame('G2'), aGame('G3')]);
    answers['slots'] = () =>
      ok([
        aSlot('G1', 0),
        aSlot('G1', 1),
        aSlot('G2', 0),
        aSlot('G2', 1),
        aSlot('G2', 2, { is_bot: true }),
        aSlot('G3', 0),
        aSlot('G3', 1, { is_bot: true }),
      ]);
    const row = (game: string, id: number, from: number) => ({
      game_id: game,
      id,
      from_index: from,
      scope: 'public',
      to_indexes: [],
    });
    answers['dispatches'] = () =>
      ok([row('G1', 5, 1), row('G1', 4, 1), row('G1', 3, 0), row('G2', 9, 0), row('X', 1, 0)]);
    answers['readMarks'] = () =>
      ok([
        { game_id: 'G1', player_index: 0, reads: { public: 4 } },
        { game_id: 'G2', player_index: 0, reads: { public: 99 } },
      ]);
    await call('loadMyGames');
    expect(theAsked('readMarks')).toEqual([[['G1', 'G2'], 'U1']]);
    const cards = [...theElement('my-games-list').querySelectorAll('.game-card')].map((c) =>
      c.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(cards[0]).toContain('✉ 1 new');
    expect(cards[1]).toContain('✉ 1 new');
    expect(cards[2]).not.toContain('new');
  });
  test('the read marks refused, every dispatch is unread; a hundred show as 99+', async () => {
    answers['myRealms'] = () => ok([aRealm('R1', 'G1')]);
    answers['cards'] = () => ok([aGame('G1')]);
    answers['slots'] = () => ok([aSlot('G1', 0), aSlot('G1', 1)]);
    answers['dispatches'] = () =>
      ok(
        Array.from({ length: 100 }, (_, i) => ({
          game_id: 'G1',
          id: i + 1,
          from_index: 1,
          scope: 'public',
          to_indexes: [],
        })),
      );
    answers['readMarks'] = () => refused('no read marks');
    await call('loadMyGames');
    expect(textOf('my-games-list')).toContain('✉ 99+ new');
    answers['readMarks'] = () => {
      throw new Error('the network is down');
    };
    answers['dispatches'] = () => ok([{ game_id: 'G1', id: 1, from_index: 1, scope: 'public', to_indexes: [] }]);
    await call('loadMyGames');
    expect(textOf('my-games-list')).toContain('✉ 1 new');
  });
  test('the dispatches refused, or the read throwing, shows no badge', async () => {
    answers['myRealms'] = () => ok([aRealm('R1', 'G1')]);
    answers['cards'] = () => ok([aGame('G1')]);
    answers['slots'] = () => ok([aSlot('G1', 0), aSlot('G1', 1)]);
    answers['dispatches'] = () => refused('no dispatches');
    await call('loadMyGames');
    expect(textOf('my-games-list')).not.toContain('new');
    answers['dispatches'] = () => {
      throw new Error('the network is down');
    };
    await call('loadMyGames');
    expect(textOf('my-games-list')).toContain('Game G1');
    expect(textOf('my-games-list')).not.toContain('new');
  });
  test('before sign-in the list stops on the account it reads', async () => {
    stage('currentUser = null;');
    await expect(call('loadMyGames')).rejects.toHaveProperty('name', 'TypeError');
    expect(theAsked('myRealms')).toEqual([]);
  });
});

describe('Open Games', () => {
  test("a refused read says so in the database's words; none, or none to join, says so", async () => {
    answers['setup'] = () => refused('the open games are not there');
    await call('loadOpenGames');
    expect(textOf('open-games-list')).toBe('the open games are not there');
    expect(theAsked('myGames')).toEqual([['U1']]);
    answers['setup'] = () => ok([]);
    await call('loadOpenGames');
    expect(textOf('open-games-list')).toContain('No open games at the moment.');
    answers['myGames'] = () => ok([{ game_id: 'G1' }]);
    answers['setup'] = () => ok([aGame('G1', { status: 'setup', game_state: '{}', max_players: 4 })]);
    await call('loadOpenGames');
    expect(textOf('open-games-list')).toContain('No open games at the moment.');
  });
  test('each card: its GM by name, its world, its human places, private games only for the invited', async () => {
    answers['myGames'] = () => ok(null);
    const game = (id: string, state: unknown, more: Record<string, unknown> = {}) =>
      aGame(id, { status: 'setup', game_state: state, max_players: 4, gm_user_id: 'GM1', ...more });
    answers['setup'] = () =>
      ok([
        game('G1', JSON.stringify({ mapSize: 'p3', seaPct: '90', botCount: '1' })),
        game('G2', { mapSize: 'p99', seaPct: 10 }, { gm_user_id: 'GM2', max_players: 0 }),
        game('G3', 'not json', { gm_user_id: null }),
        game('G4', { allBot: true }),
        game('G5', { visibility: 'private', invited: ['U2'] }),
        game('G6', { visibility: 'private', invited: ['U1'] }),
        game('G7', { visibility: 'private', invited: 'U1' }),
        game('G8', { botCount: 'x' }),
      ]);
    answers['slots'] = () => ok([aSlot('G1', 0), aSlot('G1', 1, { is_bot: true }), aSlot('G2', 0)]);
    answers['names'] = () =>
      ok([
        { id: 'GM1', name: 'Old Maud' },
        { id: 'GM2', name: '' },
      ]);
    await call('loadOpenGames');
    expect(theAsked('names')).toEqual([[['GM1', 'GM2']]]);
    const cards = [...theElement('open-games-list').querySelectorAll('.game-card')].map((c) =>
      c.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(cards).toHaveLength(5);
    expect(cards[0]).toContain('GM: Old Maud · World: 3 realms (8×7), 80% sea · 1/3 players joined');
    expect(cards[1]).toContain('GM: the Game Master · World: —, 20% sea · 1/4 players joined');
    expect(cards[2]).toContain('GM: the Game Master · World: —, 35% sea · 0/4 players joined');
    expect(cards[3]).toContain('Game G6 Open 🔒 Invited');
    expect(cards[4]).toContain('Game G8');
    expect(cards[4]).toContain('0/4 players joined');
  });
  test('with no GM named, no names are asked', async () => {
    answers['setup'] = () => ok([aGame('G1', { status: 'setup', game_state: {}, max_players: 2, gm_user_id: null })]);
    await call('loadOpenGames');
    expect(theAsked('names')).toEqual([]);
    expect(textOf('open-games-list')).toContain('0/2 players joined');
  });
});

describe('the live poll and the Game Master offer', () => {
  const onScreen = (id: string): void => {
    for (const s of doc.querySelectorAll('section')) s.classList.toggle('section-active', s.id === id);
  };
  test('before sign-in, or with no realm, it asks no more', async () => {
    stage('currentUser = null;');
    await call('pollForUpdates');
    expect(asked).toEqual([]);
    stage('currentUser = { id: "U1" };');
    answers['myFlags'] = () => ok([]);
    await call('pollForUpdates');
    expect(asked.map((a) => a.what)).toEqual(['myFlags']);
  });
  test('on the list it repaints when what the cards show changes, and not when it stays', async () => {
    onScreen('sec-games');
    stage('_lastMyGamesSig = null;');
    answers['myFlags'] = () => ok([aRealm('R1', 'G1')]);
    answers['turnAndState'] = () => ok([{ id: 'G1', turn: 3, status: 'active' }]);
    answers['slots'] = () =>
      ok([aSlot('G1', 0, { orders_submitted: true }), aSlot('G1', 1), aSlot('G1', 2, { is_bot: true })]);
    answers['myRealms'] = () => ok([aRealm('R1', 'G1')]);
    answers['cards'] = () => ok([aGame('G1')]);
    await call('pollForUpdates');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(theAsked('myRealms')).toHaveLength(1);
    expect(stage('_lastMyGamesSig')).toBe('R1:3:active:0:1/2:u0');
    await call('pollForUpdates');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(theAsked('myRealms')).toHaveLength(1);
    answers['turnAndState'] = () => ok([]);
    await call('pollForUpdates');
    expect(stage('_lastMyGamesSig')).toBe('R1:0::0:1/2:u0');
  });
  test("on an open report it only shows the banner when the realm's game has moved past the turn it opened at", async () => {
    onScreen('sec-report');
    const banner = theElement('new-turn-banner');
    banner.style.display = 'none';
    answers['myFlags'] = () => ok([aRealm('R1', 'G1')]);
    answers['turnAndState'] = () => ok([{ id: 'G1', turn: 4, status: 'active' }]);
    stage('currentGamePlayer = { id: "R1", game_id: "G1", _liveTurn: 4 };');
    await call('pollForUpdates');
    expect(banner.style.display).toBe('none');
    stage('currentGamePlayer = { id: "R1", game_id: "G1", _liveTurn: 3 };');
    await call('pollForUpdates');
    expect(banner.style.display).toBe('flex');
    banner.style.display = 'none';
    stage('currentGamePlayer = { id: "R1", game_id: "G9" };');
    await call('pollForUpdates');
    expect(banner.style.display).toBe('none');
    stage('currentGamePlayer = { id: "R1", game_id: "G1" };');
    await call('pollForUpdates');
    expect(banner.style.display).toBe('flex');
    onScreen('sec-games');
  });
  test('a read that throws is let go until the next tick', async () => {
    answers['myFlags'] = () => {
      throw new Error('the network is down');
    };
    await expect(call('pollForUpdates')).resolves.toBeUndefined();
  });
  test('the offer: open shows its question, accepted or refused hides the banner', async () => {
    const banner = theElement('gm-offer-banner');
    answers['offer'] = () => ok({ accepted_at: null });
    await call('loadAllGames');
    expect(theAsked('offer')).toEqual([['U1']]);
    expect(banner.style.display).toBe('block');
    expect(theElement('gm-offer-ask').style.display).toBe('block');
    expect(theElement('gm-offer-done').style.display).toBe('none');
    answers['offer'] = () => ok({ accepted_at: '2026-11-01T00:00:00Z' });
    await call('loadAllGames');
    expect(banner.style.display).toBe('none');
    answers['offer'] = () => refused('no offer');
    banner.style.display = 'block';
    await call('loadAllGames');
    expect(banner.style.display).toBe('none');
  });
});

describe("the join form's descriptions", () => {
  test('each select shows its choice in words; one with no words shows none; with no select or no box, nothing', () => {
    const cases = [
      ['join-alignment', 'updateAlignmentDesc', 'Neutral', 'The merchant crown'],
      ['join-race', 'updateRaceDesc', 'Dwarven', 'The anvil.'],
      ['join-temper', 'updateTemperDesc', 'Brave', 'The soldier.'],
    ] as const;
    for (const [id, fn, choice, words] of cases) {
      const sel = theElement(id);
      const desc = theElement(`${id}-desc`);
      sel.insertAdjacentHTML('beforeend', '<option value="Nobody">Nobody</option>');
      Reflect.set(sel, 'value', choice);
      call(fn);
      expect(desc.textContent).toContain(words);
      Reflect.set(sel, 'value', 'Nobody');
      call(fn);
      expect(desc.innerHTML).toBe('');
      Reflect.set(sel, 'value', choice);
      const holder = doc.createElement('div');
      desc.replaceWith(holder);
      call(fn);
      expect(desc.innerHTML).toBe('');
      holder.replaceWith(desc);
      sel.remove();
      call(fn);
      expect(desc.innerHTML).toBe('');
      holder.append(sel);
      doc.body.append(holder);
    }
  });
});

describe('Save and Submit', () => {
  const form = (html: string): void => {
    doc.getElementById('kc-test-form')?.remove();
    doc.body.insertAdjacentHTML('beforeend', `<div id="kc-test-form">${html}</div>`);
  };
  const theSaved = (what: 'draft' | 'submit'): Record<string, unknown> => {
    const last = theAsked(what).at(-1);
    if (!last) throw new Error(`nothing sent to ${what}`);
    return JSON.parse(String(last[1])) as Record<string, unknown>;
  };
  const hero = { id: 'h1', name: 'Arlen', locationId: 7 };
  beforeEach(() => {
    theElement('prev-report-banner').style.display = 'none';
    stage('reckoningCall = false; concedeGame = false;');
  });

  test('a draft with no seat, or of a past turn, is not saved', async () => {
    stage(`currentReport = ${JSON.stringify({ characters: [hero] })};`);
    form('');
    await call('doSaveOrders');
    stage('currentGamePlayer = { id: "R1", game_id: "G1" };');
    theElement('prev-report-banner').style.display = 'block';
    await call('doSaveOrders');
    expect(theAsked('draft')).toEqual([]);
  });
  test("a draft: each phase's order and its words, the encounter plan's defaults, the heir's points, and its turn", async () => {
    const heir = { id: 'h2', _isHeir: true, skills: { Melee: 2 }, _heirBase: { Melee: 1 } };
    const bare = { id: 'h3', _isHeir: true };
    stage(`currentReport = ${JSON.stringify({ turn: 4, characters: [hero, heir, bare] })};`);
    stage('currentGamePlayer = { id: "R1", game_id: "G1" };');
    form(`<select id="po-action-h1-0"><option value="Move">Move</option></select>
      <input id="po-target-h1-0" value="12">
      <input type="hidden" id="ep-tactics-h1" value="">
      <input id="ep-notes-h1" value="">
      <input type="hidden" id="ep-preschool-h1" value="FIRE">
      <select id="ep-duel-h1"><option value="">none</option></select>
      <select id="ep-evilmode-h1"><option value="">none</option></select>
      <input type="hidden" id="ep-tactics-h2" value="AR,ME">
      <input id="ep-notes-h2" value="hold the ford">`);
    await call('doSaveOrders');
    const saved = theSaved('draft');
    expect(theAsked('draft')[0]?.[0]).toBe('R1');
    expect(saved['forTurn']).toBe(4);
    const orders = saved['orders'] as Record<string, Record<string, unknown>[]>;
    expect(orders['h1']?.[0]).toEqual({ action: 'Move', target: '12', extra: '', desc: 'Move — 12' });
    expect(orders['h1']?.[1]).toEqual({ action: '', target: '', extra: '', desc: '' });
    expect(saved['encounterPlans']).toEqual({
      h1: { tactics: ['ME', 'CS:fire'], notes: '', duelStance: 'refuse' },
      h2: { tactics: ['AR', 'ME'], notes: 'hold the ford', duelStance: 'refuse' },
    });
    expect(saved['kingSkills']).toEqual({
      h2: { skills: { Melee: 2 }, pending: 0, name: '', temper: '', base: { Melee: 1 } },
      h3: { skills: {}, pending: 0, name: '', temper: '', base: {} },
    });
    expect(stage('currentGamePlayer.orders')).toBe(JSON.stringify(saved));
    expect(textOf('report-status-pill')).toBe('⏳ Orders needed');
    expect(theElement('save-msg').style.display).toBe('block');
  });
  test("a draft's turn: the live turn, else the report's, else 1; a refused save keeps the old draft", async () => {
    stage('currentGamePlayer = { id: "R1", game_id: "G1", orders: "old" };');
    form('');
    for (const [report, turn] of [
      [{ _liveTurn: 6, turn: 4 }, 6],
      [{ _liveTurn: 0, turn: 4 }, 4],
      [{}, 1],
    ] as const) {
      stage(`currentReport = ${JSON.stringify(report)};`);
      await call('doSaveOrders');
      expect(theSaved('draft')['forTurn']).toBe(turn);
    }
    stage('currentGamePlayer.orders = "old"; currentReport = null;');
    answers['draft'] = () => refused('not saved');
    await call('doSaveOrders');
    expect(stage('currentGamePlayer.orders')).toBe('old');
  });
  test('Submit stops when the turn has moved on, or with no seat, and rebuilds the button', async () => {
    stage(`currentReport = ${JSON.stringify({ _liveTurn: 3, characters: [] })};`);
    stage('currentGamePlayer = { id: "R1", game_id: "G1" };');
    answers['turn'] = () => ok({ turn: 4 });
    await call('doSubmitOrders');
    expect(theAsked('turn')).toEqual([['G1']]);
    expect(textOf('orders-msg')).toContain('The GM has already resolved this turn.');
    expect(textOf('orders-submit-wrap')).toContain('Submit Orders for Turn 3');
    expect(theAsked('submit')).toEqual([]);
    answers['turn'] = () => ok({ turn: 3 });
    stage('currentGamePlayer = { game_id: "G1" };');
    await call('doSubmitOrders');
    expect(textOf('orders-msg')).toBe('Session error — please reload the page.');
    stage('currentGamePlayer = null;');
    answers['turn'] = () => ok(null);
    await call('doSubmitOrders');
    expect(theAsked('turn').at(-1)).toEqual([undefined]);
    expect(theAsked('submit')).toEqual([]);
  });
  test("Submit sends each hero's orders, the Spy's target by name, a lair's province, and the cards' orders", async () => {
    const spied = { id: 'v9', name: 'Mara' };
    stage(`currentReport = ${JSON.stringify({ turn: 3, characters: [hero], visibleChars: [spied, { id: 'v8' }] })};`);
    stage('currentGamePlayer = { id: "R1", game_id: "G1" };');
    form(`<select id="po-action-h1-0"><option value="Spy">Spy</option></select>
      <input id="po-target-h1-0" value="char:v9">
      <select id="po-action-h1-1"><option value="Spy">Spy</option></select>
      <input id="po-target-h1-1" value="char:v8">
      <select id="po-action-h1-2"><option value="Search Lair">Search Lair</option></select>
      <input id="po-target-h1-2" value="0">
      <select id="po-action-h1-3"><option value="Attack">Attack</option></select>
      <input id="po-target-h1-3" value="9">
      <div id="hired-hero-orders-a"><select id="po-action-hired_5-0"><option value="Rest">Rest</option></select></div>
      <input type="hidden" id="ep-tactics-hired_5" value="">
      <input type="hidden" id="ep-preschool-hired_5" value="Ice">
      <select id="ep-evilmode-hired_5"><option value="loot">loot</option></select>
      <div id="hired-hero-orders-b"></div>
      <div id="resurrect-orders-a"><select id="po-action-resurrect_6-0"><option value="">none</option></select></div>
      <input type="hidden" id="ep-tactics-resurrect_6" value="AR">
      <input id="ep-notes-resurrect_6" value="rise">
      <div id="resurrect-orders-b"></div>
      <div id="charm-orders-a"><select id="po-action-charm_7-0"><option value="Explore">Explore</option></select></div>
      <input type="hidden" id="ep-tactics-charm_7" value="">
      <select id="ep-duel-charm_7"><option value="accept">accept</option></select>
      <div id="charm-orders-b"></div>`);
    await call('doSubmitOrders');
    const sent = theSaved('submit');
    const orders = sent['orders'] as Record<string, Record<string, unknown>[]>;
    expect(orders['h1']?.map((o) => o['desc'])).toEqual([
      'Spy — on Mara',
      'Spy',
      'Search Lair — 0',
      'Attack — 9',
      'Defend',
    ]);
    expect(orders['h1']?.[2]?.['prov']).toBe(7);
    expect(orders['hired_5']?.map((o) => o['action'])).toEqual(['Rest', 'Defend', 'Defend', 'Defend', 'Defend']);
    expect(orders['resurrect_6']?.[0]).toEqual({ action: 'Defend', target: '', extra: '', desc: '' });
    expect(orders['charm_7']?.[0]?.['action']).toBe('Explore');
    expect(sent['encounterPlans']).toEqual({
      hired_5: { tactics: ['ME', 'CS:ice'], notes: '', duelStance: 'refuse', evilMode: 'loot' },
      resurrect_6: { tactics: ['AR'], notes: 'rise', duelStance: 'refuse' },
      charm_7: { tactics: ['ME'], notes: '', duelStance: 'accept' },
    });
    expect(sent['forTurn']).toBe(3);
    expect(textOf('orders-msg')).toBe('');
    expect(textOf('orders-submit-wrap')).toContain('Orders submitted successfully!');
    expect(stage('currentGamePlayer.orders')).toBe(JSON.stringify(sent));
    expect(stage('currentGamePlayer.orders_submitted')).toBe(true);
  });
  test("a refused Submit says so in the database's words; Cancel empties the message and rebuilds the button", async () => {
    stage(`currentReport = ${JSON.stringify({ turn: 3, characters: [] })};`);
    stage('currentGamePlayer = { id: "R1", game_id: "G1" };');
    form('');
    answers['submit'] = () => refused('the orders were refused');
    await call('doSubmitOrders');
    expect(textOf('orders-msg')).toBe('Error: the orders were refused');
    expect(textOf('orders-submit-wrap')).toContain('Submit Orders for Turn 3');
    call('cancelSubmit');
    expect(textOf('orders-msg')).toBe('');
  });
});
