// The player portal's Dispatches panel, its two-column desk and its screens on the values handed them (plan P1-16l): the
// lines P1-16l changed in dispatches.ts, layout.ts and init.ts that the screen tours don't reach, or reach only in part
// (npm run proof:tours), each run here on the value that reaches it, so a fault planted in one is red: the roster's and
// the thread's fallbacks, the database's refusals in their words, the unread marks, a channel clicked, a dispatch
// reported and sent, the group picker, the desk's panels and its watcher, a province located, the turn buttons and a
// section jumped to.
// Level 4 (page): the three files load the page's start-up (its database client), so no lower level reaches them; the
// portal is booted in jsdom (tests/lib/boot.js) on a fake Db at an older database, so it stops at its notice with every
// module loaded, and each case stages the panel's state as the tours do.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';
import type { ADatabaseAnswer, ADispatch, Db } from '../../src/db/the-db-interface-and-its-areas.ts';

const errs: string[] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);
const settle = (ms = 50): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const theElement = (id: string): HTMLElement => {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`no element ${id}`);
  return el;
};
const textOf = (id: string): string => theElement(id).textContent;

/** What the fake answers this case, and what the page sent it. */
const answers = {
  probe: (): ADatabaseAnswer<Pick<ADispatch, 'id'>[]> => ({ data: [], error: null, status: 200 }),
  newest: (): ADatabaseAnswer<ADispatch[]> => ({ data: [], error: null, status: 200 }),
  after: (): ADatabaseAnswer<ADispatch[]> => ({ data: [], error: null, status: 200 }),
  before: (): ADatabaseAnswer<ADispatch[]> => ({ data: [], error: null, status: 200 }),
  reads: (): ADatabaseAnswer<{ reads: Record<string, number> }> => ({
    data: null,
    error: null,
    status: 200,
  }),
  send: (): ADatabaseAnswer<null> => ({ data: null, error: null, status: 201 }),
  report: (): ADatabaseAnswer<null> => ({ data: null, error: null, status: 201 }),
  slots: (): ADatabaseAnswer<
    { game_id: string; player_index: number; is_bot: boolean; orders_submitted: boolean; alignment: string }[]
  > => ({
    data: [0, 1, 2, 3].map((i) => ({
      game_id: 'G1',
      player_index: i,
      is_bot: false,
      orders_submitted: false,
      alignment: '',
    })),
    error: null,
    status: 200,
  }),
};
const sent: { readonly what: string; readonly row: unknown }[] = [];
const theSent = (what: string): unknown[] => sent.filter((s) => s.what === what).map((s) => s.row);

function theFakeDb(): Db {
  const bare = makeAFakeDb(['20261010000000']).db;
  return {
    ...bare,
    theDispatches: {
      ...bare.theDispatches,
      oneDispatchsId: () => Promise.resolve(answers.probe()),
      theNewestDispatchesOfThisGame: () => Promise.resolve(answers.newest()),
      theDispatchesOfThisGameAfterThisOne: () => Promise.resolve(answers.after()),
      theDispatchesOfThisGameBeforeThisOne: () => Promise.resolve(answers.before()),
      thisRealmsReadMarksInThisGame: () => Promise.resolve(answers.reads()),
      sendThisDispatch: (row) => {
        sent.push({ what: 'send', row });
        return Promise.resolve(answers.send());
      },
      writeTheseReadMarks: (row) => {
        sent.push({ what: 'reads', row });
        return Promise.resolve({ data: null, error: null, status: 201 });
      },
    },
    theReportedDispatches: {
      ...bare.theReportedDispatches,
      reportThisDispatch: (row) => {
        sent.push({ what: 'report', row });
        return Promise.resolve(answers.report());
      },
    },
    thePlayersRealms: {
      ...bare.thePlayersRealms,
      theSlotsOfTheseGames: (games) => {
        sent.push({ what: 'slots', row: games });
        return Promise.resolve(answers.slots());
      },
    },
  };
}
const fresh = { ...answers };

/** A dispatch, as the database answers it. */
const aDispatch = (id: number, from: number, more: Partial<ADispatch> = {}): ADispatch => ({
  id,
  turn: 2,
  from_index: from,
  to_indexes: [],
  scope: 'public',
  body: `dispatch ${String(id)}`,
  created_at: '2026-11-10T10:00:00Z',
  ...more,
});
const observed: string[] = [];

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
      // jsdom has no ResizeObserver and no scrollIntoView: the desk's watcher and a section's jump are recorded
      w['ResizeObserver'] = class {
        readonly seen: (() => void)[] = [];
        constructor(callback: () => void) {
          w['kcTheResizeWatcher'] = callback;
        }
        observe(el: Element) {
          observed.push(el.id || el.className);
        }
      };
    },
  }).window;
  doc = P['document'] as Document;
  stage('Element.prototype.scrollIntoView = function () { this.dataset.jumped = "yes"; };');
  await settle(600);
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
beforeEach(() => {
  Object.assign(answers, fresh);
  sent.length = 0;
});
afterAll(() => {
  P.close();
});

let gameNumber = 0;
/** The panel opened on a new game (so its held dispatches and read marks start again), four human realms, three met. */
async function openTheDispatches(
  report: unknown = {
    playerName: 'Thornmere',
    diplomacy: {
      known: [
        { index: 1, name: 'Veyholt' },
        { index: 2, name: 'Harrowdale', conceded: true },
      ],
    },
  },
): Promise<string> {
  gameNumber++;
  const game = `G${String(gameNumber)}`;
  stage('_msgTableOk = true;');
  await call('initMessaging', game, 0, report, null);
  call('stopMessagePolling');
  return game;
}

describe('the roster and the names and colours it gives', () => {
  test('a met realm with no name, colour or relation is "Realm N", no colour, neutral; a named one keeps its own', async () => {
    await call('loadMessageRoster', 'G1', {
      diplomacy: {
        known: [
          { index: 1 },
          { index: 2, name: '', color: '', relation: '', alignment: '' },
          { index: 3, name: 'Veyholt', color: '#123456', relation: 'allied', alignment: 'Good' },
        ],
      },
    });
    const realms = JSON.parse(String(stage('JSON.stringify(_msgRealms)'))) as Record<string, Record<string, unknown>>;
    expect(realms['1']).toMatchObject({
      name: 'Realm 2',
      color: null,
      alignment: null,
      relation: 'neutral',
      human: true,
    });
    expect(realms['2']).toMatchObject({ name: 'Realm 3', color: null, alignment: null, relation: 'neutral' });
    expect(realms['3']).toMatchObject({ name: 'Veyholt', color: '#123456', alignment: 'Good', relation: 'allied' });
  });
  test('a roster read with no game asks the database nothing; one refused says so in its words', async () => {
    await call('loadMessageRoster', null, {});
    expect(theSent('slots')).toEqual([]);
    answers.slots = () => ({ data: null, error: { message: 'the slots are not there' }, status: 404 });
    await call('loadMessageRoster', 'G1', {});
    expect(stage('_msgErr')).toBe('Could not read the realm roster: the slots are not there');
  });
  test("this realm, with no name or colour in the report, is 'Realm 1' with none; no kingdom, it isn't out", async () => {
    await call('initMessaging', undefined, 0, { playerName: '', kingdom: { color: '' } }, null);
    call('stopMessagePolling');
    expect(stage('_msgGameId')).toBeNull();
    expect(stage('JSON.stringify(_msgRealms[0])')).toBe(
      JSON.stringify({
        index: 0,
        name: 'Realm 1',
        color: null,
        human: true,
        met: true,
        conceded: false,
        eliminated: false,
        mine: true,
      }),
    );
    await call('initMessaging', 'G0', 0, {}, null);
    call('stopMessagePolling');
    expect(stage('_msgOut')).toBeNull();
    await call('initMessaging', 'G0', 0, { kingdom: { eliminated: true } }, null);
    call('stopMessagePolling');
    expect(stage('_msgOut')).toBe('eliminated');
  });
});

describe('the thread', () => {
  test('a sender not met is "Realm N" in the plain colour; a turn not known, a time not read and a report button by id', async () => {
    answers.newest = () => ({
      data: [aDispatch(12, 3, { turn: null, created_at: 'not a time' }), aDispatch(11, 1)],
      error: null,
      status: 200,
    });
    await openTheDispatches();
    const thread = theElement('msg-thread');
    const from = [...thread.querySelectorAll('.msg-from')].map((s) => [s.textContent, s.getAttribute('style')]);
    expect(from[1]).toEqual(['Realm 4', 'color:#c9b189']);
    const when = [...thread.querySelectorAll('.msg-when')].map((s) => s.textContent);
    expect(when[0]).toMatch(/^T2 · \S/);
    expect(when[1]).toBe('');
    expect(thread.querySelectorAll('.msg-day').length).toBe(1);
    expect(thread.querySelectorAll('.mc-unread').length).toBe(2);
    expect([...thread.querySelectorAll('.msg-report')].map((b) => b.getAttribute('onclick'))).toEqual([
      'reportMessage(11)',
      'reportMessage(12)',
    ]);
  });
  test('a hundred unread dispatches show as 99+ on their channel', async () => {
    answers.newest = () => ({
      data: Array.from({ length: 100 }, (_, i) => aDispatch(200 - i, 1)),
      error: null,
      status: 200,
    });
    await openTheDispatches();
    expect(theElement('msg-channels').querySelector('.mc-unread')?.textContent).toBe('99+');
  });
  test('read marks refused read as none: every dispatch is new again', async () => {
    answers.newest = () => ({ data: [aDispatch(5, 1)], error: null, status: 200 });
    answers.reads = () => ({ data: { reads: { public: 5 } }, error: null, status: 200 });
    await openTheDispatches();
    expect(theElement('msg-thread').querySelectorAll('.mc-unread').length).toBe(0);
    answers.reads = () => ({ data: { reads: { public: 5 } }, error: { message: 'refused' }, status: 401 });
    await openTheDispatches();
    expect(theElement('msg-thread').querySelectorAll('.mc-unread').length).toBe(1);
  });
  test('a table that cannot be probed says so with what was thrown', async () => {
    answers.probe = () => {
      throw new Error('the network is down');
    };
    stage('_msgTableOk = null;');
    gameNumber++;
    await call('initMessaging', `G${String(gameNumber)}`, 0, {}, null);
    call('stopMessagePolling');
    expect(stage('_msgTableOk')).toBe(false);
    expect(textOf('msg-thread')).toContain('the network is down');
  });
  test("a refresh refused, or one that throws, shows the database's words in the note", async () => {
    await openTheDispatches();
    answers.newest = () => ({ data: null, error: { message: 'the read was refused' }, status: 401 });
    stage('_msgMaxId = 0;');
    await call('refreshMessages', true);
    expect(stage('_msgErr')).toBe('the read was refused');
    expect(textOf('msg-note')).toBe('the read was refused');
  });
  test('older dispatches: refused in their words, or taken in before the held ones', async () => {
    answers.newest = () => ({ data: [aDispatch(30, 1)], error: null, status: 200 });
    await openTheDispatches();
    stage('_msgMoreOlder = true;');
    answers.before = () => ({ data: null, error: { message: 'older refused' }, status: 401 });
    await call('loadOlderMessages');
    expect(stage('_msgErr')).toBe('older refused');
    stage('_msgMoreOlder = true;');
    answers.before = () => ({ data: [aDispatch(29, 1), aDispatch(28, 2)], error: null, status: 200 });
    await call('loadOlderMessages');
    expect(stage('_msgRows.map((r) => r.id).join()')).toBe('28,29,30');
  });
});

describe('the unread marks and the channels', () => {
  test('opening Dispatches marks its channel read up to its newest, and saves that', async () => {
    answers.newest = () => ({ data: [aDispatch(41, 1), aDispatch(40, 2)], error: null, status: 200 });
    await openTheDispatches();
    stage('currentUser = { id: "u-0" };');
    call('show', 'sec-report');
    call('setDeskView', 'left', 'messages');
    call('stopMessagePolling');
    expect(stage('_deskLeftView')).toBe('messages');
    expect(textOf('desk-msg-badge')).toBe('');
    await settle(1400);
    expect(theSent('reads').at(-1)).toMatchObject({ player_index: 0, reads: { public: 41 } });
    call('setDeskView', 'left', 'map');
  });
  test('with no one to write to, Dispatches on the desk falls back to the map', () => {
    stage('_msgEnabled = false;');
    call('setDeskView', 'left', 'messages');
    expect(stage('_deskLeftView')).toBe('map');
    stage('_msgEnabled = true;');
  });
  test('a channel clicked is opened; a click beside the channels opens none', async () => {
    await openTheDispatches();
    const channels = theElement('msg-channels');
    const theirs = channels.querySelector<HTMLElement>('[data-ch="p:0-1"]');
    if (!theirs) throw new Error('no channel with Veyholt');
    theirs.click();
    expect(stage('_msgChannel')).toBe('p:0-1');
    channels.click();
    expect(stage('_msgChannel')).toBe('p:0-1');
    theElement('msg-channels').querySelector<HTMLElement>('[data-ch="public"]')?.click();
    expect(stage('_msgChannel')).toBe('public');
  });
});

describe('a dispatch reported', () => {
  test('with no reason it is sent with none; one already reported reads as reported; another refusal in its words', async () => {
    answers.newest = () => ({ data: [aDispatch(51, 1), aDispatch(50, 0)], error: null, status: 200 });
    await openTheDispatches();
    P['prompt'] = () => '   ';
    await call('reportMessage', 50);
    expect(theSent('report')).toEqual([]);
    await call('reportMessage', 51);
    expect(theSent('report')).toEqual([
      { message_id: 51, game_id: stage('_msgGameId'), reporter_index: 0, reason: null },
    ]);
    expect(textOf('msg-thread')).toContain('Reported');
    answers.newest = () => ({ data: [aDispatch(53, 1), aDispatch(52, 1)], error: null, status: 200 });
    await openTheDispatches();
    answers.report = () => ({
      data: null,
      error: { message: 'duplicate key', code: '23505' } as { message: string },
      status: 409,
    });
    await call('reportMessage', 52);
    expect(stage('_msgErr')).toBeNull();
    answers.report = () => ({ data: null, error: { message: 'the report was refused' }, status: 401 });
    await call('reportMessage', 53);
    expect(stage('_msgErr')).toBe('Report not sent: the report was refused');
  });
});

describe('a dispatch sent', () => {
  const sendIt = async (words: string): Promise<void> => {
    Reflect.set(theElement('msg-input'), 'value', words);
    await call('sendMessage');
  };
  test("the turn: the seat's, else the report's; neither, 0; the sender's account, or null with none", async () => {
    await openTheDispatches();
    stage('currentUser = { id: "u-1" }; currentGamePlayer = { _liveTurn: 4 }; currentReport = { _liveTurn: 7 };');
    await sendIt('one');
    stage('currentGamePlayer = { _liveTurn: 0 };');
    await sendIt('two');
    stage('currentGamePlayer = null; currentReport = null; currentUser = null;');
    await sendIt('three');
    stage('currentGamePlayer = undefined; currentReport = undefined;');
    await sendIt('four');
    expect(
      theSent('send').map((r): unknown[] => [Reflect.get(Object(r), 'turn'), Reflect.get(Object(r), 'from_user_id')]),
    ).toEqual([
      [4, 'u-1'],
      [7, 'u-1'],
      [0, null],
      [null, null],
    ]);
  });
  test("refused for its rate in the database's words, for its length reworded, else said not sent", async () => {
    await openTheDispatches();
    answers.send = () => ({
      data: null,
      error: { message: 'Ten a minute at most.', hint: 'kc_dispatch_rate' } as { message: string },
      status: 400,
    });
    await sendIt('slow');
    expect(stage('_msgErr')).toBe('Ten a minute at most.');
    answers.send = () => ({
      data: null,
      error: { message: 'violates check constraint "game_messages_body_len"' },
      status: 400,
    });
    await sendIt('long');
    expect(stage('_msgErr')).toBe('A dispatch can be at most 500 characters. Shorten it and send again.');
    answers.send = () => ({ data: null, error: { message: 'no' }, status: 401 });
    await sendIt('refused');
    expect(stage('_msgErr')).toBe('Dispatch not sent: no');
  });
  test('with no dispatch box on the page nothing is sent', async () => {
    await openTheDispatches();
    const box = theElement('msg-input');
    const parent = box.parentNode;
    box.remove();
    await call('sendMessage');
    call('updateMsgComposer');
    parent?.appendChild(box);
    expect(theSent('send')).toEqual([]);
  });
});

describe('the group picker', () => {
  test('a realm out of the game is marked; the realms ticked make one conference channel', async () => {
    await openTheDispatches();
    call('toggleMsgGroupPicker', true);
    const list = theElement('msg-group-list');
    expect([...list.querySelectorAll('label')].map((l) => l.textContent)).toEqual(['Veyholt', 'Harrowdale (out)']);
    list.querySelectorAll('input').forEach((box) => {
      box.checked = true;
    });
    call('createMsgGroup');
    expect(stage('_msgChannel')).toBe('p:0-1-2');
    expect(theElement('msg-group-pick').style.display).toBe('none');
  });
});

describe('the desk and the screens', () => {
  test("the desk's panels end at the window's foot, re-measured by a watcher on what sits above them", () => {
    call('show', 'sec-report');
    expect(observed.length).toBeGreaterThan(0);
    const left = theElement('desk-left');
    left.style.height = '';
    const watcher: unknown = P['kcTheResizeWatcher'];
    if (typeof watcher !== 'function') throw new Error('no watcher');
    const watched = observed.length;
    Reflect.apply(watcher, undefined, []);
    expect(observed.length).toBe(watched);
    expect(left.style.height).toBe(`${String(Math.max(360, Math.floor(Number(stage('innerHeight')) - 8)))}px`);
  });
  test("a province named in the report becomes a map link, but not inside a link, a box marked so or the map's SVG", async () => {
    // a past turn's report on screen names its own provinces, not the current one's
    stage(
      'viewingReport = { worldMeta: { provinces: [{ id: 3, name: "Ashford" }] } }; currentReport = { worldMeta: { provinces: [{ id: 4, name: "Brindle" }] } };',
    );
    try {
      call('renderReportView', P.eval('viewingReport'));
    } catch {
      // the report's own cards need more of a report than this; the links are made at its end all the same
    }
    const col = theElement('rp-report-col');
    col.insertAdjacentHTML(
      'beforeend',
      '<p id="pl-a">The road to Ashford, not Brindle.</p><p id="pl-b" class="no-prov-link">Ashford</p><svg id="pl-c"><text>Ashford</text></svg>',
    );
    await settle(200);
    const linked = (id: string): number => theElement(id).querySelectorAll('[data-prov-link="3"]').length;
    expect([linked('pl-a'), linked('pl-b'), doc.querySelectorAll('#pl-c [data-prov-link]').length]).toEqual([1, 0, 0]);
    expect(doc.querySelectorAll('#pl-a [data-prov-link]').length).toBe(1);
    expect(textOf('pl-a')).toBe('The road to Ashford, not Brindle.');
    for (const id of ['pl-a', 'pl-b', 'pl-c']) doc.getElementById(id)?.remove();
    stage('viewingReport = null;');
  });
  test('a province located on the desk brings the map back to the left panel', () => {
    call('show', 'sec-report');
    call('setDeskView', 'left', 'report');
    call('locateOnMap', 7);
    expect(stage('_deskLeftView')).toBe('map');
  });
  test('the turn buttons: with no turn resolved marked, the one numbered -1 is the current', () => {
    const nav = theElement('turn-nav-btns');
    nav.removeAttribute('data-resolved');
    nav.innerHTML = '<button data-turn="-1"></button><button data-turn="0"></button>';
    call('refreshTurnNavHighlight');
    expect([...nav.querySelectorAll('button')].map((b) => b.getAttribute('style')?.includes('var(--crimson)'))).toEqual(
      [true, false],
    );
  });
  test('a section jumped to on a page that scrolls keeps clear of the jump bar', () => {
    const section = theElement('sec-report');
    call('show', 'sec-report');
    const target = doc.createElement('div');
    target.id = 'jump-target';
    section.appendChild(target);
    call('jumpToReportSection', 'jump-target');
    expect(target.style.scrollMarginTop).toBe('0px');
    expect(target.dataset['jumped']).toBe('yes');
    target.remove();
  });
});
