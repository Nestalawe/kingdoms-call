// The Overlord page's lines no tour reaches keep their values (plan P1-16k, the page freed of its ts-nocheck line): a
// game's turn mode of any kind, held as words, missing or unreadable; an account with no name or no email, in the list,
// the panels, the Hand over picker and the page's messages; a suspension's length by the picker's words; a report
// whose game is gone, whose realm has no name, with no turn and to every realm.
// Level 1 (unit): the page's file imports in Node once its config, the `supabase` global and a Db are handed in (as
// the-overlords-games-list-reads-every-page-of-games.test.ts does); each function is called directly on a staged list.
// A page test would boot the page and sign the Overlord in to reach each list.
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  ASignInAnswer,
  AGameAsTheOverlordListsIt,
  AnAccountAsTheOverlordSeesIt,
  AReportedDispatch,
  ARealmsName,
  Db,
  TheSignedInAccount,
} from '../../src/db/the-db-interface-and-its-areas.ts';
import { THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER } from '../../src/db/the-pages-database-client.ts';
import { bootJsdom } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

/** A made-up game: its id, GM and summary. */
const aGame = (id: string, gm: string | null, meta: AGameAsTheOverlordListsIt['meta']): AGameAsTheOverlordListsIt => ({
  id,
  name: 'Made-up game ' + id,
  gm_user_id: gm,
  status: 'active',
  turn: 2,
  max_turns: 20,
  created_at: '2026-01-01T00:00:00Z',
  meta,
});
/** A made-up account: its id, name, email and role. */
const anAccount = (
  user_id: string,
  name: string | null,
  email: string | null,
  gm_status = 'none',
  suspended_until: string | null = null,
): AnAccountAsTheOverlordSeesIt => ({
  user_id,
  name,
  email,
  joined: '2026-09-01T12:00:00Z',
  last_sign_in: null,
  gm_status,
  games_run: 0,
  games_played: 0,
  suspended_until,
});

let games: AGameAsTheOverlordListsIt[] = [];
let accounts: AnAccountAsTheOverlordSeesIt[] = [];
let reports: AReportedDispatch[] = [];
let realms: ARealmsName[] = [];
/** What signing in answers, and the session the browser keeps after it. */
let signedIn: ASignInAnswer = { data: { user: null, session: null }, error: null };
let keptSession: TheSignedInAccount | null = null;
/** The email and password each sign-in was asked with, and how often the page asked whether it is the Overlord's. */
const signIns: [string, string][] = [];
let overlordChecks = 0;
/** The suspensions asked for: the account and the end. */
const suspensions: [string, string | null][] = [];
type ThePage = typeof import('../../src/ui/overlord/main.ts');
let page: ThePage;
let doc: Document;

const answer = <T>(data: T) => Promise.resolve({ data, error: null, status: 200 });

beforeAll(async () => {
  const fake = makeAFakeDb(['20261015051826']);
  const done = () => answer(null);
  const db: Db = {
    ...fake.db,
    theDatabasesVersion: { askTheDatabaseItsVersion: () => new Promise(() => undefined) },
    signingIn: {
      ...fake.db.signingIn,
      signInWithEmailAndPassword: (email, password) => {
        signIns.push([email, password]);
        return Promise.resolve(signedIn);
      },
      theSessionKeptInThisBrowser: () =>
        Promise.resolve({ data: { session: keptSession ? { user: keptSession } : null }, error: null }),
    },
    theRoles: {
      ...fake.db.theRoles,
      isTheSignedInAccountTheOverlord: () => {
        overlordChecks++;
        return answer(false);
      },
    },
    theOverlordsGames: {
      ...fake.db.theOverlordsGames,
      everyGameNewestFirstFromRowToRow: (from) => answer(from === 0 ? games : []),
      theRealmsNamesOfTheseGames: () => answer(realms),
      handThisGameToThisGameMaster: done,
    },
    theOverlordsAccounts: {
      ...fake.db.theOverlordsAccounts,
      everyAccountAsTheOverlordSeesIt: () => answer(accounts),
      suspendThisAccountUntil: (user, until) => {
        suspensions.push([user, until]);
        return answer(null);
      },
      offerThisAccountGameMaster: done,
      withdrawTheGameMasterOfferToThisAccount: done,
      revokeThisAccountsGameMaster: done,
    },
    theReportedDispatches: {
      ...fake.db.theReportedDispatches,
      theDispatchesReportedToThisAccount: () => answer(reports),
    },
  };
  const { window } = bootJsdom(
    '<!doctype html><html><body><div id="sec-auth"></div><div id="sec-denied"></div><div id="sec-main"></div>' +
      '<div id="auth-msg"></div><input id="si-email"><input id="si-password"><div id="denied-msg"></div>' +
      '<span id="me-email"></span><div id="msg"></div><input id="acct-q"><div id="accounts"></div>' +
      '<div id="games"></div><div id="reports"></div></body></html>',
  );
  Object.assign(globalThis, {
    window,
    document: window['document'],
    Node: window['Node'],
    HTMLElement: window['HTMLElement'],
    HTMLInputElement: window['HTMLInputElement'],
    confirm: () => true,
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    [THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER]: db,
  });
  doc = document;
  page = await import('../../src/ui/overlord/main.ts');
});
beforeEach(() => {
  games = [];
  accounts = [];
  reports = [];
  realms = [];
  suspensions.length = 0;
  signIns.length = 0;
  overlordChecks = 0;
  keptSession = null;
  type('acct-q', '');
});
/** Types `words` into the field `id`. */
function type(id: string, words: string): void {
  const field = doc.getElementById(id);
  if (field && 'value' in field) field.value = words;
}

/** The cells of a row, as its words. */
const cells = (selector: string): string[] => [...doc.querySelectorAll(selector + ' > td')].map((td) => td.textContent);
const text = (id: string): string => doc.getElementById(id)?.textContent ?? '';

/** A summary, as the case names it, and the turn mode the list shows for it. */
const turnModes: [string, AGameAsTheOverlordListsIt['meta'], string][] = [
  ['a mode the table lacks', { turnMode: { mode: 'weekly' } }, 'weekly'],
  ['a list of words', { turnMode: { mode: ['by ', 'hand'] } }, 'by hand'],
  ['an object', { turnMode: { mode: { every: 2 } } }, '[object Object]'],
  ['a number', { turnMode: { mode: 7 } }, '7'],
  ['empty words', { turnMode: { mode: '' } }, 'By hand'],
  ['no mode', { turnMode: {} }, 'By hand'],
  ['a turn mode of words', { turnMode: 'auto' }, 'By hand'],
  ['no turn mode', {}, 'By hand'],
  ['no summary', null, 'By hand'],
  ['a summary held as words', '{"turnMode":{"mode":"auto"}}', 'When all orders are in'],
  ['words that are no summary', 'not a summary', 'By hand'],
  ['a summary of words held as words', '"deadline"', 'By hand'],
];
describe("the Overlord's games list", () => {
  test.for(turnModes)('a turn mode of %s reads %j', async ([, meta, shown]) => {
    games = [aGame('G1', null, meta)];
    await page.loadGames();
    page.renderGames();
    expect(cells('#games tr[data-game="G1"]')[4]).toBe(shown);
  });

  test('a summary held as words that says archived shows the Archived mark', async () => {
    games = [aGame('G1', null, '{"archived":true}'), aGame('G2', null, '{"archived":false}')];
    await page.loadGames();
    page.renderGames();
    expect(cells('#games tr[data-game="G1"]')[2]).toBe('activeArchived');
    expect(cells('#games tr[data-game="G2"]')[2]).toBe('active');
  });

  test("each game's GM by name, else email, else no name; one not listed, and none", async () => {
    accounts = [anAccount('a', null, 'a@example.test'), anAccount('b', '', null), anAccount('c', 'Warden Oake', null)];
    games = [
      aGame('G1', 'a', {}),
      aGame('G2', 'b', {}),
      aGame('G3', 'c', {}),
      aGame('G4', 'x', {}),
      aGame('G5', null, {}),
    ];
    await Promise.all([page.loadAccounts(), page.loadGames()]);
    page.renderGames();
    expect(['G1', 'G2', 'G3', 'G4', 'G5'].map((g) => cells(`#games tr[data-game="${g}"]`)[1])).toEqual([
      'a@example.test',
      '(no name)',
      'Warden Oake',
      '(unknown account)',
      '(no GM)',
    ]);
  });
});

describe("the Overlord's accounts", () => {
  test('an account with no name shows "(no name)", one with no email nothing; no sign-in a dash', async () => {
    accounts = [anAccount('a', null, 'a@example.test'), anAccount('b', 'Bram Vey', null), anAccount('e', '', null)];
    await page.loadAccounts();
    page.renderAccounts();
    expect(cells('#accounts tr[data-user="e"]')[0]).toBe('(no name)');
    expect(cells('#accounts tr[data-user="a"]').slice(0, 4)).toEqual([
      '(no name)',
      'a@example.test',
      '2026-09-01',
      '—',
    ]);
    expect(cells('#accounts tr[data-user="b"]').slice(0, 2)).toEqual(['Bram Vey', '']);
  });

  test.for([
    ['part of an email', 'EXAMPLE.TEST', ['a', 'c']],
    ['part of a name', 'bram', ['b']],
  ] as const)('the search finds %s', async ([, q, found]) => {
    accounts = [
      anAccount('a', null, 'a@example.test'),
      anAccount('b', 'Bram Vey', null),
      anAccount('c', 'Cy', 'c@example.test'),
    ];
    await page.loadAccounts();
    type('acct-q', q);
    page.renderAccounts();
    expect([...doc.querySelectorAll('#accounts tr[data-user]')].map((tr) => tr.getAttribute('data-user'))).toEqual(
      found,
    );
  });

  test("the Revoke panel names the account by its email when it has no name, and the picker's Game Masters by name, else email", async () => {
    accounts = [
      anAccount('a', null, 'a@example.test', 'game_master'),
      anAccount('z', 'Zed', null, 'game_master'),
      anAccount('m', '', 'm@example.test', 'game_master'),
      anAccount('b', 'Bram', null, 'game_master'),
      anAccount('n', null, 'n@example.test', 'game_master'),
    ];
    games = [aGame('G1', 'a', {})];
    await Promise.all([page.loadAccounts(), page.loadGames()]);
    const panel = page.revokePanel(page.account('a') ?? anAccount('?', null, null));
    expect(panel.querySelector('strong')?.textContent).toBe('a@example.test');
    expect([...panel.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Hand over to…',
      'm@example.test',
      'n@example.test',
      'Bram',
      'Zed',
    ]);
    expect(page.revokePanel(anAccount('n', '', null)).querySelector('strong')?.textContent).toBe('');
  });

  test('an account whose name is blank is labelled by its email, and one with a blank email too "(no name)"', () => {
    expect(page.label(anAccount('m', '', 'm@example.test'))).toBe('m@example.test');
    expect(page.label(anAccount('e', '', ''))).toBe('(no name)');
  });

  test('the Delete panel asks for the name of an account with no email, and its button waits for it', () => {
    const panel = page.deletePanel(anAccount('b', 'Bram Vey', null));
    expect(panel.querySelector('label')?.textContent).toBe('Type their name to confirm');
    expect(panel.querySelector('strong')?.textContent).toBe('Bram Vey');
    const typed = panel.querySelector('#delete-typed');
    const go = panel.querySelector('#delete-confirm');
    if (!typed || !('value' in typed) || !go || !('disabled' in go)) throw new Error('no field or button');
    expect(go.disabled).toBe(true);
    typed.value = ' bram vey ';
    typed.dispatchEvent(new window.Event('input'));
    expect(go.disabled).toBe(false);
    expect(page.deletePanel(anAccount('c', null, null)).querySelector('strong')?.textContent).toBe('(no name)');
  });

  test("the page's messages name an account with no name by its email", async () => {
    const a = anAccount('a', null, 'a@example.test');
    await page.offerGm(a);
    expect(text('msg')).toBe(
      "Offered Game Master to a@example.test. They'll see it at the top of their player portal.",
    );
    await page.withdrawOffer(a);
    expect(text('msg')).toBe('Withdrew the offer to a@example.test.');
    await page.revokeGm(a);
    expect(text('msg')).toBe('a@example.test is no longer a Game Master.');
    await page.offerGm(anAccount('b', '', null));
    expect(text('msg')).toBe("Offered Game Master to null. They'll see it at the top of their player portal.");
    await page.suspend(a, 'day');
    expect(text('msg')).toBe('a@example.test is suspended for a day.');
    await page.suspend(anAccount('c', null, null), 'day');
    expect(text('msg')).toBe('(no name) is suspended for a day.');
  });

  test.for([
    ['week', 7, 'for a week'],
    ['day', 1, 'for a day'],
    ['a fortnight', 1, 'for a day'],
  ] as const)('a suspension picked as %j lasts %i days', async ([how, days, words]) => {
    const before = Date.now();
    await page.suspend(anAccount('a', 'Ada', null), how);
    const until = suspensions[0]?.[1];
    expect(until).toBeTypeOf('string');
    const ms = new Date(String(until)).getTime() - before;
    expect(ms).toBeGreaterThanOrEqual(days * 864e5 - 1000);
    expect(ms).toBeLessThan(days * 864e5 + 60_000);
    expect(text('msg')).toBe(`Ada is suspended ${words}.`);
  });

  test('a suspension until lifted is asked for with no end', async () => {
    await page.suspend(anAccount('a', 'Ada', null), 'lifted');
    expect(suspensions).toEqual([['a', null]]);
  });

  test("a suspended account's mark gives its end, or reads until lifted", () => {
    expect(page.suspendedText(anAccount('a', 'Ada', null, 'none', '2026-11-20T08:30:00Z'))).toBe(
      'Suspended until 2026-11-20 08:30 UTC',
    );
    expect(page.suspendedText(anAccount('a', 'Ada', null, 'none', '2126-11-20T08:30:00Z'))).toBe(
      'Suspended until lifted',
    );
  });
});

describe("the Overlord's reported dispatches", () => {
  /** A made-up report of dispatch `id`. */
  const aReport = (id: number, over: Partial<AReportedDispatch>): AReportedDispatch => ({
    body: 'Yield the ford.',
    from_index: 0,
    game_id: 'G1',
    message_id: id,
    reason: '',
    report_id: id,
    reported_at: '2026-10-13T00:00:00Z',
    reporter_index: 1,
    scope: 'private',
    sent_at: '2026-10-13T00:00:00Z',
    to_indexes: [1],
    turn: 3,
    ...over,
  });

  test('a report names its game and realms; a game gone, a realm with no name, no turn, every realm and no list read so', async () => {
    games = [aGame('G1', null, {})];
    realms = [
      { game_id: 'G1', player_index: 0, display_name: 'Thornmere' },
      { game_id: 'G1', player_index: 1, display_name: '' },
    ];
    reports = [
      aReport(1, {}),
      aReport(2, { game_id: 'G9', turn: null as unknown as number, scope: 'public' }),
      aReport(3, { to_indexes: null as unknown as number[], reporter_index: 2 }),
    ];
    await page.loadGames();
    await page.loadReports();
    const heads = [...doc.querySelectorAll('#reports .report > .muted')].map((d) => d.textContent);
    expect(heads).toEqual([
      'Made-up game G1 · Turn 3 · from Thornmere to Realm 2 · reported by Realm 2',
      '(a deleted game) · from Realm 1 to every realm · reported by Realm 2',
      'Made-up game G1 · Turn 3 · from Thornmere to  · reported by Realm 3',
    ]);
  });
});

describe("the Overlord page's sign-in", () => {
  const ada: TheSignedInAccount = { id: 'ada', email: 'ada@example.test', user_metadata: {} };
  const kept: TheSignedInAccount = { id: 'kept', email: 'kept@example.test', user_metadata: {} };

  test.for([
    ['Invalid login credentials', 'Email or password incorrect.'],
    ['Email not confirmed', 'Email not confirmed'],
  ] as const)('a refusal that says %j reads %j', async ([message, shown]) => {
    signedIn = { data: { user: null, session: null }, error: { message } };
    type('si-email', ' ada@example.test ');
    type('si-password', 'a made-up password');
    await page.doSignIn();
    expect(signIns).toEqual([['ada@example.test', 'a made-up password']]);
    expect(text('auth-msg')).toBe(shown);
    expect(overlordChecks).toBe(0);
  });

  test.for([
    ['the account signing in answers', ada, kept, 'ada'],
    ['none answers, the session kept', null, kept, 'kept'],
    ['none answers and none is kept', null, null, null],
  ] as const)('%s: the page is signed in as it', async ([, user, session, id]) => {
    signedIn = { data: { user, session: null }, error: null };
    keptSession = session;
    type('si-email', 'ada@example.test');
    type('si-password', 'a made-up password');
    await page.doSignIn();
    expect(page.ME?.id ?? null).toBe(id);
    await vi.waitFor(() => {
      expect(overlordChecks).toBe(id === null ? 0 : 1);
    });
    expect(text('auth-msg')).toBe('');
  });
});
