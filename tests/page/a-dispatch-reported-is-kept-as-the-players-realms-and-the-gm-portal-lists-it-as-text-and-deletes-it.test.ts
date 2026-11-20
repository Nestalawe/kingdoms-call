// Reporting a dispatch (P0-24, rulings R-073 and D-13g), on the fake database (tests/lib/fake-db.ts): the player's
// world, holding the reports, and the GM's, which answers gm_reported_messages; both staged with the same rows.
//   - player portal: Dispatches says private dispatches are seen only by the realms in the conversation and the
//     Overlord; each dispatch received (not one's own) has ⚑ Report; reporting asks for an optional reason, writes
//     the report as the realm the player plays, and the dispatch then shows as reported (also after a reload);
//   - GM portal: a game's screen lists its reported dispatches (sender, reporter, reason, the text, all as text), and
//     Delete removes the dispatch; a GM who plays in the game is told its reports go to the Overlord.
// Each case boots its page once, in beforeAll, and keeps what it showed; each check is a test of its own. Until plan
// P1-14z the script report-dispatch.
// Level 4 (page): the report is the player portal's Dispatches written to its world and read back after a reload, and
// the card is the GM portal's game screen after its sign-in, across each page's files. The single functions on a
// stand-in: tests/page/the-player-portals-dispatches-desk-and-screens-on-the-values-handed-them.test.ts ("a dispatch
// reported") and tests/unit/the-gm-pages-start-up-sign-in-and-turn-mode-on-the-values-handed-them.test.ts.
import { beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import {
  aGameMastersWorld,
  makeAFakeDbHoldingTheGameMastersWorld,
  makeAFakeDbHoldingThePlayersWorld,
  type ADispatchThePlayersWorldHolds,
  type AReportThePlayersWorldHolds,
  type ReadMarksThePlayersWorldHolds,
  type TheGameMastersTables,
} from '../lib/fake-db.ts';
import { itsStackOr } from '../lib/screens.ts';
import type { AGame, AnAccountsName, ARealm, Db } from '../../src/db/the-db-interface-and-its-areas.ts';

const PP = 'kingdoms-call-player-portal.html';
const GM = 'kingdoms-call-gm-portal.html';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** The rows both pages read: G1, running, Thornmere (p1) and Veyholt (p2), and the bot Grimfast; Veyholt's dispatch to
 *  Thornmere (11, with markup in it) and Thornmere's answer (12). */
interface TheRows {
  readonly profiles: AnAccountsName[];
  readonly games: AGame[];
  readonly realms: ARealm[];
  readonly dispatches: ADispatchThePlayersWorldHolds[];
  readonly readMarks: ReadMarksThePlayersWorldHolds[];
  readonly reports: AReportThePlayersWorldHolds[];
}
const aRealm = (more: Pick<ARealm, 'id' | 'user_id' | 'player_index' | 'display_name' | 'turn_report'>): ARealm => ({
  game_id: 'G1',
  orders_submitted: false,
  orders: null,
  created_at: null,
  invite_code: null,
  last_submitted_at: null,
  ...more,
});
function theRows(): TheRows {
  return {
    profiles: [
      { id: 'gm1', name: 'Test GM' },
      { id: 'p1', name: 'Test Player One' },
      { id: 'p2', name: 'Test Player Two' },
    ],
    games: [
      {
        id: 'G1',
        name: 'Marchwood',
        gm_user_id: 'gm1',
        status: 'active',
        turn: 3,
        max_players: 3,
        max_turns: 0,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: null,
        meta: null,
        game_state: '{}',
        block_eliminated_msgs: false,
      },
    ],
    realms: [
      aRealm({ id: 's0', user_id: 'p1', player_index: 0, display_name: 'Thornmere', turn_report: '{}' }),
      aRealm({ id: 's1', user_id: 'p2', player_index: 1, display_name: 'Veyholt', turn_report: '{}' }),
      aRealm({ id: 's2', user_id: null, player_index: 2, display_name: 'Grimfast', turn_report: '{"isBot":true}' }),
    ],
    dispatches: [
      {
        id: 11,
        game_id: 'G1',
        turn: 3,
        from_index: 1,
        from_user_id: 'p2',
        to_indexes: [0],
        scope: 'private',
        body: 'Yield the ford <img src=x onerror=alert(1)>',
        created_at: '2026-10-12T10:00:00Z',
      },
      {
        id: 12,
        game_id: 'G1',
        turn: 3,
        from_index: 0,
        from_user_id: 'p1',
        to_indexes: [1],
        scope: 'private',
        body: 'Never.',
        created_at: '2026-10-12T10:05:00Z',
      },
    ],
    readMarks: [],
    reports: [],
  };
}

/** A booted page: its window, its document, and the errors it raised so far. */
interface APageBootedWithItsErrorsKept {
  readonly W: PageWindow;
  readonly doc: Document;
  readonly errs: string[];
}
/** `page` booted on `db`, every error it raises kept (an uncaught error, a rejected promise no one handles, each
 *  console.error line and each alert), after 900 ms to start and sign in; `setup` runs on its window before its
 *  scripts. The page is booted here, not through
 *  tests/lib/a-page-booted-in-jsdom-on-a-fake-database-with-its-errors-kept.ts, so static/page-globals sees this file
 *  open it and counts the page's functions it calls. */
async function bootThePage(
  page: string,
  db: Db,
  setup?: (w: PageWindow) => void,
): Promise<APageBootedWithItsErrorsKept> {
  const errs: string[] = [];
  const { window: W } = bootJsdom(readPage(page), {
    supabase: { createClient: () => ({}) },
    db,
    setup(w) {
      w.addEventListener('error', (e) => errs.push(itsStackOr(e.error, e.message)));
      w.onunhandledrejection = (e) => errs.push(itsStackOr(e.reason, e.reason));
      w.console.error = (...a) => errs.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w['alert'] = (m: unknown) => errs.push(`alert: ${String(m)}`);
      setup?.(w);
    },
  });
  await wait(900);
  // `as`: the page's window has its document (PageWindow names only what most tests read)
  return { W, doc: W['document'] as Document, errs };
}
/** The player portal on the player's world holding `rows`, signed in as p1. */
function bootThePlayersPortal(rows: TheRows, setup?: (w: PageWindow) => void): Promise<APageBootedWithItsErrorsKept> {
  const fake = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, {
    me: 'p1',
    names: rows.profiles,
    games: rows.games,
    realms: rows.realms,
    dispatchRefused: null,
    readsOfAnotherAccountsRealms: [],
    dispatches: rows.dispatches,
    readMarks: rows.readMarks,
    reports: rows.reports,
  });
  return bootThePage(PP, fake.db, setup);
}
/** The GM portal on the GM's world holding `rows`, signed in as gm1; with the world's tables, to read back. */
async function bootTheGmPortal(
  rows: TheRows,
): Promise<APageBootedWithItsErrorsKept & { readonly tables: TheGameMastersTables }> {
  const gm = aGameMastersWorld();
  gm.tables.profiles.splice(0, Infinity, ...rows.profiles.map((p) => ({ ...p })));
  gm.tables.games.push(...rows.games);
  gm.tables.game_players.push(...rows.realms);
  gm.tables.game_messages.push(...rows.dispatches);
  gm.tables.message_reports.push(...rows.reports.map((r) => ({ ...r })));
  const booted = await bootThePage(GM, makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, gm).db);
  return { ...booted, tables: gm.tables };
}
/** p1's Dispatches, open on the private channel with Veyholt (realm 1), its reports read, `rows` its thread. */
async function openTheThreadWithVeyholt(W: PageWindow, rows: TheRows): Promise<void> {
  W.eval(
    `_msgEnabled=true; _msgTableOk=true; _msgGameId='G1'; _msgMyIndex=0; _msgRealms={0:{index:0,name:'Thornmere',human:true,met:true,mine:true},1:{index:1,name:'Veyholt',human:true,met:true}};`,
  );
  await W.eval('loadMyReports()');
  W.eval(
    `_msgRows=${JSON.stringify(rows.dispatches)}; _msgChannel=msgChannelKeyOf(_msgRows[0]); renderMessageThread();`,
  );
}
const REPORT_BUTTONS = '#msg-thread [onclick^="reportMessage("]';
const textOf = (doc: Document, id: string): string => doc.getElementById(id)?.textContent ?? '';

describe('the player reports a dispatch received', () => {
  const rows = theRows();
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    {
      const booted = await bootThePlayersPortal(rows, (w) => {
        w['prompt'] = () => '  Threats  ';
      });
      const { W, doc } = booted;
      errs = booted.errs;
      await openTheThreadWithVeyholt(W, rows);
      seen['column'] = textOf(doc, 'rp-msg-col');
      seen['buttons'] = [...doc.querySelectorAll(REPORT_BUTTONS)].map((b) => b.getAttribute('onclick'));
      await W.eval('reportMessage(11)');
      await wait(30);
      seen['buttonsAfter'] = doc.querySelectorAll(REPORT_BUTTONS).length;
      seen['thread'] = textOf(doc, 'msg-thread');
      W.close();
    }
    {
      const { W, doc } = await bootThePlayersPortal(rows);
      await openTheThreadWithVeyholt(W, rows);
      seen['threadAfterReload'] = textOf(doc, 'msg-thread');
      seen['buttonsAfterReload'] = doc.querySelectorAll(REPORT_BUTTONS).length;
      W.close();
    }
  });

  test('Dispatches says who sees private dispatches', () => {
    expect(seen['column']).toMatch(/seen only by the realms in the conversation and the site.s Overlord/);
  });
  test("a Report button on the dispatch received, none on one's own", () => {
    expect(seen['buttons']).toHaveLength(1);
    expect(seen['buttons']).toEqual([expect.stringMatching(/reportMessage\(11\)/)]);
  });
  test('the report is written as Thornmere, with the reason', () => {
    expect(rows.reports).toEqual([
      expect.objectContaining({ message_id: 11, game_id: 'G1', reporter_index: 0, reason: 'Threats' }),
    ]);
  });
  test('then it shows as reported', () => {
    expect(seen['buttonsAfter']).toBe(0);
    expect(seen['thread']).toMatch(/Reported/);
  });
  test('player: no page errors', () => {
    expect(errs).toEqual([]);
  });
  test('and still after a reload', () => {
    expect(seen['threadAfterReload']).toMatch(/Reported/);
    expect(seen['buttonsAfterReload']).toBe(0);
  });
});

describe('the player cancels the reason', () => {
  const rows = theRows();
  let buttonsAfter = -1;

  beforeAll(async () => {
    const { W, doc } = await bootThePlayersPortal(rows, (w) => {
      w['prompt'] = () => null;
    });
    await openTheThreadWithVeyholt(W, rows);
    await W.eval('reportMessage(11)');
    await wait(30);
    buttonsAfter = doc.querySelectorAll(REPORT_BUTTONS).length;
    W.close();
  });

  test('cancelling the reason sends no report', () => {
    expect(rows.reports).toEqual([]);
    expect(buttonsAfter).toBeGreaterThan(0);
  });
});

describe("the GM opens a game's screen with a dispatch reported", () => {
  const rows = theRows();
  rows.reports.push({
    id: 1,
    message_id: 11,
    game_id: 'G1',
    reporter_index: 0,
    reporter_user_id: 'p1',
    reason: 'Threats <b>now</b>',
    created_at: '2026-10-12T10:10:00Z',
  });
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];
  let tables: TheGameMastersTables | undefined;

  beforeAll(async () => {
    const booted = await bootTheGmPortal(rows);
    const { W, doc } = booted;
    errs = booted.errs;
    tables = booted.tables;
    await W.eval(`openGame('G1')`);
    await wait(200);
    const card = doc.getElementById('detail-reports-card');
    seen['shown'] = card !== null && card.style.display !== 'none';
    seen['card'] = card?.textContent ?? '';
    seen['markup'] = card?.querySelectorAll('img,b').length;
    await W.eval('deleteReportedDispatch(11)');
    await wait(100);
    seen['cardAfter'] = textOf(doc, 'detail-reports-card');
    W.close();
  });

  test('the game screen has a Reported dispatches card', () => {
    expect(seen['shown']).toBe(true);
  });
  test('it shows the sender, the reporter, the reason and the text', () => {
    expect(seen['card']).toMatch(/Veyholt/);
    expect(seen['card']).toMatch(/Thornmere/);
    expect(seen['card']).toMatch(/Threats <b>now<\/b>/);
    expect(seen['card']).toMatch(/Yield the ford <img/);
  });
  test('all as text, nothing from a player becomes markup', () => {
    expect(seen['markup']).toBe(0);
  });
  test('Delete removes the dispatch', () => {
    expect(tables?.game_messages.map((m) => m['id'])).toEqual([12]);
  });
  test('and the list empties', () => {
    expect(seen['cardAfter']).toMatch(/No dispatches reported/);
  });
  test('GM: no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('a GM who plays in the game', () => {
  const rows = theRows();
  rows.realms.push(aRealm({ id: 's3', user_id: 'gm1', player_index: 3, display_name: 'Oakhold', turn_report: '{}' }));
  rows.reports.push({
    id: 1,
    message_id: 11,
    game_id: 'G1',
    reporter_index: 0,
    reporter_user_id: 'p1',
    reason: 'Threats',
    created_at: '2026-10-12T10:10:00Z',
  });
  let card = '';

  beforeAll(async () => {
    const { W, doc } = await bootTheGmPortal(rows);
    await W.eval(`openGame('G1')`);
    await wait(200);
    card = textOf(doc, 'detail-reports-card');
    W.close();
  });

  test('a GM who plays in the game is told its reports go to the Overlord', () => {
    expect(card).toMatch(/go to the Overlord/);
    expect(card).not.toMatch(/Yield the ford/);
  });
});
