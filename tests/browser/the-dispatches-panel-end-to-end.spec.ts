// The player portal's Dispatches panel from end to end, in Chromium (claude_msg_e2e_0927.js; a test script until
// P1-01c, quarantined from 2026-10-01 until P1-17 brought it back). The real page, served as deployed, on the typed fake (plan P1-17,
// Decision 8: the player's world, tests/lib/fake-db.ts, handed to the page by an init script); fonts and the other
// sites answered with nothing. Made-up realms. Level 4 (Chromium): the desk's two panels, the phone's tab bar, the
// poll's timer and the read marks' debounce are layout and timers in a real browser.
//
// The page's state is read as it holds it: the declared globals (_msgEnabled, _msgRows, …: src/globals.d.ts) by
// name, and the functions its markup calls (src/ui/player/globals.ts) on the window. The dispatch poll's timer is a
// module's own, so an init script watches the page's intervals of the poll's length (MSG_POLL_MS) instead.
//
// What it proves (each a step below):
//   1. the page boots with 0 page errors, and every messaging function its markup calls is defined
//   2. the left desktop panel's tabs are Map, Report and Dispatches; the report column lives in the right panel until
//      Report is chosen on the left
//   3. the channel list is public + every MET HUMAN realm: a bot and an unmet realm are both absent
//   4. a dispatch sent from the panel reaches the table with the right scope and recipients and comes straight back
//      into the thread, with no turn run, and does not leak into another channel
//   5. a dispatch sent by another realm arrives on a refresh and raises both unread badges; opening its channel clears
//      them and writes a read mark row
//   6. a private dispatch between two OTHER realms is never shown: the database's read rule, not the page's; on the
//      fake, which answers every read as its query asks, the access layer's test holds it
//      (tests/db/the-dispatches-and-their-reports-answer-each-role.test.ts, "each role reads what the rules let it")
//   7. a conference (multi-realm) thread keys identically for sender and recipient
//   8. the correspondence survives a turn advancing and the report being re-opened, with no loss and no duplication;
//      a long correspondence pages backwards
//   9. a one-human game hides Dispatches entirely, on the desktop panel and the phone bar
//  10. a missing game_messages table degrades to an explanatory panel and a dead Send, never a crash
// and then: the phone's tab bar shows and hides the column, nothing rendered reads undefined or NaN, and leaving the
// report stops the poll.
import { expect, test, type Page } from '@playwright/test';
import type { ThePlayersWorld } from '../lib/fake-db.ts';
import { playerPortalSignedIn } from './started.ts';
import { handThePageTheFakeDb } from './the-fake-db-handed-to-chromium.ts';

test.use({ viewport: { width: 1400, height: 900 } });

// The player's world the fake holds, signed in as u0: no game yet. A step stages its game (stageAGame).
const WORLD: ThePlayersWorld = {
  me: 'u0',
  names: [{ id: 'u0', name: 'Test Player' }],
  games: [],
  realms: [],
  dispatchRefused: null,
  readsOfAnotherAccountsRealms: [],
  dispatches: [],
  readMarks: [],
};

/** The world as a step stages it in the page: its rows, loosely typed (the page's own reads check them). */
interface TheWorldAsAStepStagesIt {
  games: Record<string, unknown>[];
  realms: Record<string, unknown>[];
  dispatches: Record<string, unknown>[];
  readMarks: { game_id: string; player_index: number; user_id: string; reads: Record<string, unknown> }[];
  dispatchesTableMissing?: boolean;
}

/** A game the step stages: who is human, who is a bot, which realms realm 0 has met, and the turn. */
interface AGameStaged {
  readonly humans: readonly number[];
  readonly bots: readonly number[];
  readonly met: readonly number[];
  readonly turn: number;
}
// Realm 0 = us, realms 1 and 2 = human rivals we have MET, realm 3 = a BOT we have met, realm 4 = a human we have NOT
// met.
const FOUR_HUMANS_AND_A_BOT: AGameStaged = { humans: [0, 1, 2, 4], bots: [3], met: [1, 2, 3], turn: 0 };

/** Run in the page: the world emptied, then the game G1 and its realms; realm 0's report is the one opened. */
const stageAGame = ({ humans, bots, met, turn }: AGameStaged) => {
  const world = (window as unknown as { kcTheFakesWorld: TheWorldAsAStepStagesIt }).kcTheFakesWorld;
  world.games.length = 0;
  world.realms.length = 0;
  world.dispatches.length = 0;
  world.readMarks.length = 0;
  world.games.push({
    id: 'G1',
    name: 'The Contested Marches',
    gm_user_id: 'gm1',
    status: turn ? 'active' : 'setup',
    turn,
    max_players: 5,
  });
  const NAMES = ['Aldoria', 'Bruneth', 'Caldermoor', 'Ironhold Bots', 'Everdusk'];
  const COLOURS = ['#b8433a', '#6fbf73', '#9fa8b8', '#c9a961', '#7d4fb5'];
  const known = met.map((i) => ({
    index: i,
    name: NAMES[i],
    color: COLOURS[i],
    alignment: 'Neutral',
    conceded: false,
    eliminated: false,
    relation: 'neutral',
  }));
  const report = {
    playerIndex: 0,
    playerName: NAMES[0],
    turnNumber: turn,
    kingdom: { color: COLOURS[0], alignment: 'Neutral', race: 'Human', gold: 20 },
    diplomacy: { alliancesAllowed: true, known },
    characters: [],
    provinces: [],
    waitingForTurn0: turn === 0,
  };
  Reflect.set(window, 'kcTheReportStaged', report);
  [...humans, ...bots]
    .sort((a, b) => a - b)
    .forEach((i) => {
      world.realms.push({
        id: 'gp' + String(i),
        game_id: 'G1',
        player_index: i,
        user_id: bots.includes(i) ? null : 'u' + String(i),
        display_name: NAMES[i],
        orders_submitted: false,
        orders: null,
        turn_report: JSON.stringify(
          i === 0 ? report : { playerIndex: i, playerName: NAMES[i], waitingForTurn0: turn === 0 },
        ),
      });
    });
};

/** A dispatch another realm's browser sends. */
interface ADispatchArriving {
  readonly from: number;
  readonly to: readonly number[];
  readonly body: string;
  readonly turn: number;
}
/** Run in the page: the dispatches written straight into the world, as other realms' browsers would (the next ids,
 *  private when they name their addressees). */
const dispatchesArrive = (arriving: readonly ADispatchArriving[]) => {
  const world = (window as unknown as { kcTheFakesWorld: TheWorldAsAStepStagesIt }).kcTheFakesWorld;
  for (const m of arriving)
    world.dispatches.push({
      id: world.dispatches.reduce((most, d) => Math.max(most, Number(d['id'])), 0) + 1,
      game_id: 'G1',
      turn: m.turn,
      from_index: m.from,
      to_indexes: [...m.to],
      scope: m.to.length ? 'private' : 'public',
      body: m.body,
      created_at: new Date().toISOString(),
    });
};

/** Run in the page: the dispatches the world holds, as a step compares them. */
const theDispatchesHeld = () =>
  (window as unknown as { kcTheFakesWorld: TheWorldAsAStepStagesIt }).kcTheFakesWorld.dispatches.map((m) => ({
    from: m['from_index'],
    to: m['to_indexes'],
    scope: m['scope'],
    body: m['body'],
    user: m['from_user_id'],
    turn: m['turn'],
  }));

/** Run in the page before its scripts: the intervals of the dispatch poll's length (MSG_POLL_MS, 8 s) still running,
 *  on the window, for the last step (the poll's timer is its module's own). */
const watchThePollsIntervals = () => {
  const running = new Set<unknown>();
  Reflect.set(window, 'kcTheDispatchPollsRunning', running);
  const setEvery = window.setInterval.bind(window);
  const clearEvery = window.clearInterval.bind(window);
  window.setInterval = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
    const id = setEvery(handler, ms, ...rest);
    if (ms === 8000) running.add(id);
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = ((id?: number) => {
    running.delete(id);
    clearEvery(id);
  }) as typeof window.clearInterval;
};

const channels = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#msg-channels .msg-chan')].map(
      (b) =>
        (b.querySelector('.mc-label')?.textContent ?? '') + ':' + (b.querySelector('.mc-unread')?.textContent ?? ''),
    ),
  );
const thread = (page: Page) => page.evaluate(() => document.getElementById('msg-thread')?.innerHTML ?? '');
const badges = (page: Page) =>
  page.evaluate(() => [
    document.getElementById('desk-msg-badge')?.textContent ?? '',
    document.getElementById('mt-msg-badge')?.textContent ?? '',
  ]);
/** Writes `words` in the composer, as a player types them. */
const write = (page: Page, words: string) =>
  page.evaluate((w) => {
    const box = document.getElementById('msg-input');
    if (box instanceof HTMLTextAreaElement || box instanceof HTMLInputElement) box.value = w;
    Reflect.apply(Reflect.get(window, 'onMsgInput') as () => void, window, []);
  }, words);
/** Sends what the composer holds: sendMessage's promise ends once the dispatch is read back out of the table. */
const send = (page: Page) => page.evaluate('sendMessage()');

test('the Dispatches panel: channels, sending, unread badges, conferences, paging, one human and no table', async ({
  page,
}) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console.error: ' + m.text());
  });
  await page.addInitScript(watchThePollsIntervals);
  await handThePageTheFakeDb(page, WORLD);
  await page.goto('/kingdoms-call-player-portal.html');
  await playerPortalSignedIn(page);

  await test.step('1. the page boots, and every messaging function its markup calls is defined', async () => {
    expect.soft(await page.evaluate<boolean>('document.getElementById("spinner").style.display === "none"')).toBe(true);
    for (const fn of [
      'openReport',
      'initMessaging',
      'refreshMessages',
      'sendMessage',
      'onMsgInput',
      'setMsgChannel',
      'msgChannelKeyOf',
      'renderMessageThread',
      'createMsgGroup',
      'toggleMsgGroupPicker',
      'loadOlderMessages',
      'setDeskView',
      'setMobileView',
      'show',
    ])
      expect.soft(await page.evaluate<string>(`typeof window.${fn}`), 'missing function ' + fn).toBe('function');
    expect
      .soft(await page.evaluate<string | null>('currentUser && currentUser.id'), 'the player is signed in')
      .toBe('u0');
  });

  await test.step("2. the real openReport path starts messaging; the desk's tabs and columns", async () => {
    await page.evaluate(stageAGame, FOUR_HUMANS_AND_A_BOT);
    await page.evaluate('openReport("gp0")');
    // openReport starts messaging without waiting for it; the poll's start is the last thing it does
    await page.waitForFunction('kcTheDispatchPollsRunning.size === 1');
    expect.soft(await page.evaluate<boolean>('_msgEnabled'), 'messaging is on with four human realms').toBe(true);
    expect
      .soft(await page.evaluate<boolean>('document.getElementById("sec-report").classList.contains("section-active")'))
      .toBe(true);
    const leftTabs = await page.evaluate<{ v: string; shown: boolean }[]>(
      '[...document.querySelectorAll("#desk-left .desk-tabs button")].map(b => ({v: b.dataset.view, shown: b.style.display !== "none"}))',
    );
    expect
      .soft(
        leftTabs.map((t) => t.v),
        "the left panel's tabs are Map, Report and Dispatches",
      )
      .toEqual(['map', 'report', 'messages']);
    expect
      .soft(
        await page.evaluate<string[]>(
          '[...document.querySelectorAll("#desk-right .desk-tabs button")].map(b => b.dataset.view)',
        ),
      )
      .toEqual(['report', 'orders']);
    expect
      .soft(await page.evaluate<string>('document.getElementById("rp-report-col").parentNode.id'), 'the report column')
      .toBe('desk-right-body');
    expect
      .soft(await page.evaluate<string>('document.getElementById("rp-msg-col").parentNode.id'), 'the messages column')
      .toBe('desk-left-body');
    expect.soft(leftTabs[2]?.shown, 'the Dispatches tab is shown in a game with four human realms').toBe(true);
    expect
      .soft(await page.evaluate<string>('document.getElementById("mt-messages").style.display'), 'the phone tab')
      .not.toBe('none');
    // Report chosen on the left moves the one report column there, and back again when the right asks for it.
    await page.evaluate('setDeskView("left","report")');
    expect
      .soft(await page.evaluate<string>('document.getElementById("rp-report-col").parentNode.id'))
      .toBe('desk-left-body');
    await page.evaluate('setDeskView("right","report")');
    expect
      .soft(await page.evaluate<string>('document.getElementById("rp-report-col").parentNode.id'))
      .toBe('desk-right-body');
    expect.soft(await page.evaluate<string>('_deskLeftView'), 'the left panel went back to the map').toBe('map');
  });

  await test.step('3. the channel list: public + the met human realms (a bot and an unmet realm left out)', async () => {
    await page.evaluate('setDeskView("left","messages")');
    expect.soft(await page.evaluate<string>('document.getElementById("rp-msg-col").style.display')).toBe('flex');
    expect.soft(await page.evaluate<string>('document.getElementById("rp-map-col").style.display')).toBe('none');
    expect.soft(await channels(page)).toEqual(['📣 All Realms:', 'Bruneth:', 'Caldermoor:']);
  });

  await test.step('4. sending: the table gets it, the thread shows it, no other channel does', async () => {
    await write(page, 'Peace on the river, then. Your ships pass freely.');
    expect
      .soft(await page.evaluate<boolean>('document.getElementById("msg-send-btn").disabled'), 'Send is disabled')
      .toBe(false);
    await send(page);
    // turn 1 = the turn being PLANNED (the portal stamps g.turn || 1)
    expect.soft(await page.evaluate(theDispatchesHeld)).toEqual([
      {
        from: 0,
        to: [],
        scope: 'public',
        body: 'Peace on the river, then. Your ships pass freely.',
        user: 'u0',
        turn: 1,
      },
    ]);
    expect.soft(await thread(page)).toMatch(/Peace on the river/);
    expect
      .soft(await page.evaluate<string>('document.getElementById("msg-input").value'), 'the composer is cleared')
      .toBe('');

    await page.evaluate('setMsgChannel("p:0-1")');
    await write(page, 'Caldermoor masses on your border, not mine.');
    await send(page);
    expect
      .soft((await page.evaluate(theDispatchesHeld)).slice(-1).map((m) => [m.from, m.to, m.scope]))
      .toEqual([[0, [1], 'private']]);
    expect.soft(await thread(page), 'the private dispatch is in its own thread').toMatch(/Caldermoor masses/);
    await page.evaluate('setMsgChannel("public")');
    expect
      .soft(await thread(page), 'a private dispatch leaked into the public thread')
      .not.toMatch(/Caldermoor masses/);
  });

  await test.step('5. dispatches arrive: both unread badges count them; reading clears them and writes a mark', async () => {
    await page.evaluate('setDeskView("left","map")'); // look away
    await page.evaluate(dispatchesArrive, [
      { from: 2, to: [0], body: 'Bruneth lies. Treat with me instead.', turn: 1 },
      { from: 1, to: [], body: 'Let all realms hear: the Marches are mine.', turn: 1 },
    ]);
    await page.evaluate('refreshMessages(true)');
    expect.soft(await badges(page), 'both unread badges read 2').toEqual(['2', '2']);
    expect.soft(await channels(page)).toEqual(['📣 All Realms:1', 'Bruneth:', 'Caldermoor:1']);
    // Opening the panel marks whatever channel is showing as read, so park on Bruneth (nothing unread there) first.
    await page.evaluate('setMsgChannel("p:0-1"); setDeskView("left","messages")');
    expect.soft((await badges(page))[0], 'opening Dispatches on an already-read channel keeps the badge').toBe('2');
    await page.evaluate('setMsgChannel("p:0-2")');
    expect.soft((await badges(page))[0], 'reading Caldermoor leaves one unread (the public dispatch)').toBe('1');
    // the read marks are saved 1.2 s after the last read
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            (window as unknown as { kcTheFakesWorld: TheWorldAsAStepStagesIt }).kcTheFakesWorld.readMarks.map((r) => ({
              g: r.game_id,
              i: r.player_index,
              u: r.user_id,
              caldermoor: 'p:0-2' in r.reads,
            })),
          ),
        { message: 'the read mark row', timeout: 4000 },
      )
      .toEqual([{ g: 'G1', i: 0, u: 'u0', caldermoor: true }]);
    await page.evaluate('setMsgChannel("public")');
    expect.soft((await badges(page))[0], 'reading the public channel clears the badge').toBe('');
  });

  // 6. someone else's private traffic: the database's read rule (the header says where it is held).

  await test.step('7. a conference thread keys the same for sender and recipient', async () => {
    await page.evaluate(() => {
      Reflect.apply(Reflect.get(window, 'toggleMsgGroupPicker') as (open: boolean) => void, window, [true]);
      document.querySelectorAll<HTMLInputElement>('#msg-group-list input[type=checkbox]').forEach((c) => {
        if (c.value === '1' || c.value === '2') c.checked = true;
      });
      Reflect.apply(Reflect.get(window, 'createMsgGroup') as () => void, window, []);
    });
    expect.soft(await page.evaluate<string>('_msgChannel'), 'the conference channel key').toBe('p:0-1-2');
    await write(page, 'A three-way truce, or none at all.');
    await send(page);
    expect
      .soft(
        (await page.evaluate(theDispatchesHeld))
          .slice(-1)
          .map((m) => [m.from, Array.isArray(m.to) ? [...(m.to as number[])].sort() : m.to, m.scope]),
      )
      .toEqual([[0, [1, 2], 'private']]);
    await page.evaluate(dispatchesArrive, [{ from: 2, to: [0, 1], body: 'Agreed, for one season.', turn: 1 }]);
    await page.evaluate('refreshMessages(true)');
    const t7 = await thread(page);
    expect
      .soft(t7.includes('A three-way truce') && t7.includes('Agreed, for one season'), 'the reply joins the thread')
      .toBe(true);
    expect
      .soft(await page.evaluate<string>('msgChannelKeyOf({scope:"private",from_index:2,to_indexes:[0,1]})'))
      .toBe('p:0-1-2');
  });

  await test.step('8. a turn runs: the correspondence is still there, once each; a long one pages backwards', async () => {
    await page.evaluate(() => {
      const game = (window as unknown as { kcTheFakesWorld: TheWorldAsAStepStagesIt }).kcTheFakesWorld.games[0];
      if (game) Object.assign(game, { turn: 3, status: 'active' });
    });
    await page.evaluate('initMessaging("G1", 0, kcTheReportStaged)');
    await page.evaluate('setMsgChannel("p:0-1-2")');
    expect.soft(await thread(page), 'the conference thread is kept').toMatch(/A three-way truce/);
    expect.soft(await page.evaluate(theDispatchesHeld), 'no dispatch lost or doubled in the table').toHaveLength(6);
    const ids = await page.evaluate<number[]>('_msgRows.map(r => r.id)');
    expect.soft([ids.length, new Set(ids).size], 'no row doubled in memory after a re-init').toEqual([6, 6]);
    // A poll and a refresh at once both read the same new dispatch: it is held once.
    await page.evaluate(dispatchesArrive, [{ from: 1, to: [], body: 'Heard twice, held once.', turn: 3 }]);
    await page.evaluate('Promise.all([refreshMessages(true), refreshMessages(true)])');
    const after = await page.evaluate<number[]>('_msgRows.map(r => r.id)');
    expect.soft([after.length, new Set(after).size], 'no row doubled by two reads at once').toEqual([7, 7]);

    // 450 public dispatches: the first load takes the newest 400 and offers the rest.
    await page.evaluate(stageAGame, { ...FOUR_HUMANS_AND_A_BOT, turn: 4 });
    // initMessaging keeps its cache when the game and realm are the same (a report refresh is cheap), so the
    // watermark is cleared here, as when this game is opened for the first time.
    await page.evaluate('_msgGameId = null');
    await page.evaluate(
      dispatchesArrive,
      Array.from({ length: 450 }, (_, n) => ({
        from: (n + 1) % 3 === 0 ? 1 : 2,
        to: [],
        body: 'proclamation ' + String(n + 1),
        turn: 1 + Math.floor((n + 1) / 40),
      })),
    );
    await page.evaluate('initMessaging("G1", 0, kcTheReportStaged)');
    await page.evaluate('setDeskView("left","messages")');
    expect
      .soft(await page.evaluate<unknown[]>('[_msgRows.length, _msgMoreOlder]'), 'the newest 400, and more')
      .toEqual([400, true]);
    expect.soft(await thread(page), 'the "Earlier dispatches" button').toMatch(/Earlier dispatches/);
    const first = await thread(page);
    expect
      .soft(first.includes('proclamation 450') && !first.includes('proclamation 1<'), 'the first page is the newest')
      .toBe(true);
    await page.evaluate('loadOlderMessages()');
    expect
      .soft(await page.evaluate<unknown[]>('[_msgRows.length, _msgMoreOlder]'), 'the other 50 paged back')
      .toEqual([450, false]);
    expect.soft(await thread(page), 'the oldest dispatch is reached').toMatch(/>proclamation 1</);
    expect.soft(await thread(page), 'no "Earlier dispatches" with nothing left').not.toMatch(/Earlier dispatches/);
    const paged = await page.evaluate<number[]>('_msgRows.map(r => r.id)');
    expect
      .soft(
        [paged.length, new Set(paged).size, (paged[0] ?? 0) < (paged[paged.length - 1] ?? 0)],
        'in order, once each',
      )
      .toEqual([450, 450, true]);
  });

  await test.step('9. one human realm: no messaging at all', async () => {
    await page.evaluate(stageAGame, { humans: [0], bots: [1, 2, 3], met: [1, 2], turn: 2 });
    await page.evaluate('initMessaging("G1", 0, kcTheReportStaged)');
    expect.soft(await page.evaluate<boolean>('_msgEnabled'), 'messaging is off in a game against bots').toBe(false);
    expect.soft(await page.evaluate<string>('document.getElementById("desk-msg-tab").style.display')).toBe('none');
    expect.soft(await page.evaluate<string>('document.getElementById("mt-messages").style.display')).toBe('none');
    expect.soft(await page.evaluate<string>('document.getElementById("rp-msg-col").style.display')).toBe('none');
    expect.soft(await page.evaluate<string>('_deskLeftView'), 'the left panel falls back to the map').toBe('map');
    await page.evaluate('setDeskView("left","messages")');
    expect
      .soft(await page.evaluate<string>('_deskLeftView'), "Dispatches can't be chosen with messaging off")
      .toBe('map');
  });

  await test.step('10. no game_messages table: the panel explains, Send is dead, and it recovers', async () => {
    await page.evaluate(stageAGame, { ...FOUR_HUMANS_AND_A_BOT, turn: 2 });
    await page.evaluate(() => {
      (window as unknown as { kcTheFakesWorld: TheWorldAsAStepStagesIt }).kcTheFakesWorld.dispatchesTableMissing = true;
    });
    await page.evaluate('_msgTableOk = null');
    await page.evaluate('initMessaging("G1", 0, kcTheReportStaged)');
    await page.evaluate('setDeskView("left","messages")');
    expect.soft(await thread(page), 'a missing table explains itself').toMatch(/table is missing|not switched on/i);
    // words in the composer, so Send is dead for the missing table, not for an empty box
    await write(page, 'Is anyone there?');
    expect
      .soft(await page.evaluate<boolean>('document.getElementById("msg-send-btn").disabled'), 'Send is dead')
      .toBe(true);
    await page.evaluate(() => {
      (window as unknown as { kcTheFakesWorld: TheWorldAsAStepStagesIt }).kcTheFakesWorld.dispatchesTableMissing =
        false;
    });
    await page.evaluate('_msgTableOk = null');
    await page.evaluate('initMessaging("G1", 0, kcTheReportStaged)');
    expect.soft(await thread(page), 'the panel recovers once the table is back').not.toMatch(/table is missing/i);
  });

  await test.step("the phone's tab bar shows the column on Dispatches only", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction('!document.getElementById("desk-left")'); // the desk is torn down on a phone
    await page.evaluate('setMobileView("messages")');
    expect
      .soft(await page.evaluate<boolean>('document.getElementById("rp-layout").classList.contains("mv-messages")'))
      .toBe(true);
    const shown = (id: string) =>
      page.evaluate((column) => {
        const el = document.getElementById(column);
        return el ? getComputedStyle(el).display : 'no such column';
      }, id);
    expect.soft(await shown('rp-msg-col'), "the messages column on the phone's Dispatches tab").not.toBe('none');
    expect.soft(await shown('rp-map-col'), "the map on the phone's Dispatches tab").toBe('none');
    await page.evaluate('setMobileView("report")');
    expect.soft(await shown('rp-msg-col'), "the messages column on the phone's Report tab").toBe('none');
    await page.evaluate('setMobileView("orders")');
    expect.soft(await shown('rp-msg-col'), "the messages column on the phone's Orders tab").toBe('none');
  });

  await test.step('nothing the panel rendered reads undefined, NaN or [object Object]', async () => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForFunction('!!document.getElementById("desk-left")'); // the desk is set up again
    await page.evaluate('setDeskView("left","messages")');
    const panel = await page.evaluate<string>('document.getElementById("rp-msg-col").innerHTML');
    expect.soft(/.{0,50}(undefined|NaN|\[object Object\]).{0,50}/.exec(panel)?.[0]).toBeUndefined();
  });

  await test.step('leaving the report stops the dispatch poll', async () => {
    expect.soft(await page.evaluate<number>('kcTheDispatchPollsRunning.size'), 'the poll runs on the report').toBe(1);
    await page.evaluate('show("sec-games")');
    expect
      .soft(await page.evaluate<number>('kcTheDispatchPollsRunning.size'), 'the poll after leaving the report')
      .toBe(0);
  });

  expect(errs, 'page errors').toEqual([]);
});
