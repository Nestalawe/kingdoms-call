// The player portal sees other realms only through get_game_slots (P0-20, Unit B; docs/traps.md, "Other realms' slots
// come only from `get_game_slots`"), on the player's world of the fake database (tests/lib/fake-db.ts), which notes
// each read of the realms that asks for another account's. Everything that needs other realms still works:
//   - My Games: "N of M realms have sent orders" (and the poll that keeps it current);
//   - Open games: how many players have joined;
//   - the join form: Divine already taken; the next free slot number (never a number already held);
//   - Dispatches: which realms are human;
// and no read ever asks for another realm's row. A join refused because someone took the number at the same moment
// says so (it isn't "you have already joined"). Each case boots the page once, in beforeAll, and keeps what it showed;
// each check is a test of its own. Until plan P1-14z the script other-realms-slots.
// Level 4 (page): what the page reads is its start-up, its game lists, its poll, its join form and its Dispatches
// across their files, after its sign-in; the read rule itself (a player reads only their own slot, P0-21) is the
// access layer's (tests/db/the-players-games-realms-and-logs-answer-each-role.test.ts). The join form's and the
// roster's single functions on a stand-in are tests/page/the-player-portals-join-form-and-chronicle-on-the-values-…
// and tests/page/the-player-portals-dispatches-desk-and-screens-on-the-values-handed-them.test.ts.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDbHoldingThePlayersWorld, type ThePlayersWorld } from '../lib/fake-db.ts';
import { itsStackOr } from '../lib/screens.ts';
import type { AGame, ARealm, Db } from '../../src/db/the-db-interface-and-its-areas.ts';

const PP = 'kingdoms-call-player-portal.html';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const report = JSON.stringify({ playerSetup: { alignment: 'Neutral' } });
const setup = (alignment: string): string => JSON.stringify({ playerSetup: { alignment }, status: 'joined' });

const aGame = (more: Pick<AGame, 'id' | 'name' | 'status' | 'turn' | 'max_turns' | 'game_state'>): AGame => ({
  gm_user_id: 'gm1',
  max_players: 4,
  created_at: '2026-10-11T00:00:00Z',
  updated_at: null,
  meta: null,
  block_eliminated_msgs: false,
  ...more,
});
const aRealm = (
  more: Pick<
    ARealm,
    'id' | 'game_id' | 'user_id' | 'player_index' | 'display_name' | 'orders_submitted' | 'turn_report'
  >,
): ARealm => ({ orders: null, created_at: null, invite_code: null, last_submitted_at: null, ...more });

/** The player p1's world. G1: running, three human realms (two have sent orders, p1's among them) and a bot. G2: open,
 *  two realms joined, one Divine. */
function theWorld(): ThePlayersWorld {
  return {
    me: 'p1',
    names: [{ id: 'p1', name: 'Test Player One' }],
    games: [
      aGame({
        id: 'G1',
        name: 'Marchwood',
        status: 'active',
        turn: 3,
        max_turns: 0,
        game_state: JSON.stringify({ world: 'hidden' }),
      }),
      aGame({
        id: 'G2',
        name: 'Open Vale',
        status: 'setup',
        turn: 0,
        max_turns: 12,
        game_state: JSON.stringify({ mapSize: 'p4', botCount: 0 }),
      }),
    ],
    realms: [
      aRealm({
        id: 's0',
        game_id: 'G1',
        user_id: 'p1',
        player_index: 0,
        display_name: 'Thornmere',
        orders_submitted: true,
        turn_report: report,
      }),
      aRealm({
        id: 's1',
        game_id: 'G1',
        user_id: 'p2',
        player_index: 1,
        display_name: 'Veyholt',
        orders_submitted: true,
        turn_report: report,
      }),
      aRealm({
        id: 's2',
        game_id: 'G1',
        user_id: 'p4',
        player_index: 2,
        display_name: 'Harrowdale',
        orders_submitted: false,
        turn_report: report,
      }),
      aRealm({
        id: 's3',
        game_id: 'G1',
        user_id: null,
        player_index: 3,
        display_name: 'Grimfast',
        orders_submitted: false,
        turn_report: JSON.stringify({ isBot: true }),
      }),
      aRealm({
        id: 's4',
        game_id: 'G2',
        user_id: 'p2',
        player_index: 0,
        display_name: 'Brightholm',
        orders_submitted: false,
        turn_report: setup('Divine'),
      }),
      aRealm({
        id: 's5',
        game_id: 'G2',
        user_id: 'p3',
        player_index: 1,
        display_name: 'Morrowgate',
        orders_submitted: false,
        turn_report: setup('Neutral'),
      }),
    ],
    dispatchRefused: null,
    readsOfAnotherAccountsRealms: [],
  };
}
/** The player portal booted on `db`, every error it raises kept (an uncaught error, a rejected promise no one handles,
 *  each console.error line), after 900 ms to start and sign in. The page is booted here, not through
 *  tests/lib/a-page-booted-in-jsdom-on-a-fake-database-with-its-errors-kept.ts, so static/page-globals sees this file
 *  open it and counts the page's functions it calls. */
async function bootThePlayersPortal(db: Db): Promise<{ W: PageWindow; doc: Document; errs: string[] }> {
  const errs: string[] = [];
  const { window: W } = bootJsdom(readPage(PP), {
    supabase: { createClient: () => ({}) },
    db,
    setup(w) {
      w.addEventListener('error', (e) => errs.push(itsStackOr(e.error, e.message)));
      w.onunhandledrejection = (e) => errs.push(itsStackOr(e.reason, e.reason));
      w.console.error = (...a) => errs.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  await wait(900);
  // `as`: the page's window has its document (PageWindow names only what most tests read)
  return { W, doc: W['document'] as Document, errs };
}
const textOf = (doc: Document, id: string): string => doc.getElementById(id)?.textContent ?? '';
/** The join form for G2 opened, Aldric of the Neutral alignment filled in. */
async function theJoinFormFilled(W: PageWindow, doc: Document): Promise<void> {
  await W.eval(`showJoinGame('G2','Open Vale',4,2,'Test GM','4 realms')`);
  await wait(50);
  const king = doc.querySelector<HTMLInputElement>('#join-king-name');
  const alignment = doc.querySelector<HTMLSelectElement>('#join-alignment');
  if (!king || !alignment) throw new Error('the join form has no king or alignment field');
  king.value = 'Aldric';
  alignment.value = 'Neutral';
}

describe('a player in a running game, with an open game to join', () => {
  const world = theWorld();
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const F = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, world);
    const booted = await bootThePlayersPortal(F.db);
    const { W, doc } = booted;
    errs = booted.errs;
    seen['myGames'] = textOf(doc, 'my-games-list');
    seen['openGames'] = textOf(doc, 'open-games-list');
    try {
      await W.eval('pollForUpdates()');
      seen['poll'] = 'ran';
    } catch (e) {
      seen['poll'] = String(e);
    }
    await theJoinFormFilled(W, doc);
    const divine = [...(doc.querySelector('#join-alignment')?.querySelectorAll('option') ?? [])].find(
      (o) => o.value === 'Divine',
    );
    seen['divineTaken'] = divine?.disabled;
    await W.eval(`doJoinGame('G2')`);
    await wait(50);
    seen['joinMsg'] = textOf(doc, 'join-msg').slice(0, 120);
    seen['mine'] = world.realms.find((x) => x.game_id === 'G2' && x.user_id === 'p1');
    seen['roster'] = await W.eval(
      `loadMessageRoster('G1',{diplomacy:{known:[{index:1,name:'Veyholt'},{index:2,name:'Harrowdale'},{index:3,name:'Grimfast'}]}})`,
    );
    seen['contacts'] = W.eval('msgContacts().map(r=>r.index).join()');
    W.close();
  });

  test('My Games: "2 of 3 realms have sent orders" (the bot not counted)', () => {
    expect(seen['myGames']).toMatch(/2 of 3\s*realms? have sent orders/);
  });
  test('Open games: "2/4 players joined"', () => {
    expect(seen['openGames']).toMatch(/2\/4 players joined/);
  });
  test('the poll runs', () => {
    expect(seen['poll']).toBe('ran');
  });
  test('the join form marks Divine as taken', () => {
    expect(seen['divineTaken']).toBe(true);
  });
  test('joining works', () => {
    expect(seen['mine'], String(seen['joinMsg'])).toBeDefined();
  });
  test('and takes the next free number, 2', () => {
    expect(seen['mine']).toMatchObject({ player_index: 2 });
  });
  test('Dispatches: 3 human realms of 4', () => {
    expect(seen['roster']).toMatchObject({ humans: 3, total: 4 });
  });
  test('and the human rivals met are the ones to write to', () => {
    expect(seen['contacts']).toBe('1,2');
  });
  test("no read asks for another realm's row", () => {
    expect(world.readsOfAnotherAccountsRealms).toEqual([]);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

// Someone takes number 2 between the form reading the free numbers and the join being written.
describe('a join on a number another player took a moment before', () => {
  const world = theWorld();
  const seen: Record<string, string> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const F = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, world);
    const booted = await bootThePlayersPortal(F.db);
    const { W, doc } = booted;
    errs = booted.errs;
    await theJoinFormFilled(W, doc);
    world.realms.push(
      aRealm({
        id: 's6',
        game_id: 'G2',
        user_id: 'p4',
        player_index: 2,
        display_name: 'Lateholm',
        orders_submitted: false,
        turn_report: setup('Neutral'),
      }),
    );
    // the form reads the free numbers just before writing: serve that read from before the other join
    const realms = F.db.thePlayersRealms;
    const theSlotsAsTheyAre = realms.theSlotsOfTheseGames.bind(realms);
    vi.spyOn(realms, 'theSlotsOfTheseGames').mockImplementation((games) =>
      theSlotsAsTheyAre(games).then((r) => ({
        ...r,
        data: (r.data ?? []).filter((x) => !(x.game_id === 'G2' && x.player_index === 2)),
      })),
    );
    await W.eval(`doJoinGame('G2')`);
    await wait(50);
    seen['msg'] = textOf(doc, 'join-msg');
    W.close();
  });

  test('a join on a number just taken is refused', () => {
    expect(world.realms.some((x) => x.game_id === 'G2' && x.user_id === 'p1')).toBe(false);
  });
  test('and says another player joined at the same moment', () => {
    expect(seen['msg']).toMatch(/same moment/i);
    expect(seen['msg']).not.toMatch(/already joined/i);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});
