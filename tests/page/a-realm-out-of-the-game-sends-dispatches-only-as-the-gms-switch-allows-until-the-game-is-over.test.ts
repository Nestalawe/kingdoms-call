// Eliminated realms and dispatches, on screen (P0-25, ruling R-075), on the fake database of tests/lib/fake-db.ts: the
// player's world and the GM's, staged with the same rows. The player portal opens the game as it does for a player
// (openReport: the realm's turn report and the game's light row), and each dispatch is written through the composer:
//   - a realm still in the game sends privately and to All Realms, whatever the GM's switch says;
//   - a realm that has conceded, or whose dynasty is extinguished, can't send privately (the composer says why) but
//     can write to All Realms while the game's switch is off (where it is told too), and can't send at all once it is on;
//   - once the game is over, everyone sends privately again, both ways: to a realm that is out, and from it;
//   - the Dispatches note says so.
// The GM portal: the game's screen has the switch "Block eliminated realms from sending dispatches"; it saves
// games.block_eliminated_msgs and shows the saved state when the game is opened again, for the game's GM and for the
// Overlord in Master GM mode. Each case boots its page once, in beforeAll, and keeps what it showed; each check is a
// test of its own. Until plan P1-14z the script eliminated-dispatches.
// Level 4 (page): the rule is read across the page's start-up, its report screen and its Dispatches composer, from the
// game's row and the realm's report, so no lower level reaches it whole. The switch's panel and its save on a stand-in
// are tests/unit/the-gm-pages-start-up-sign-in-and-turn-mode-on-the-values-handed-them.test.ts; the composer's other
// cases are tests/page/the-player-portals-dispatches-desk-and-screens-on-the-values-handed-them.test.ts. The pages are
// booted in this file (not through the helper of tests/lib), so static/page-globals counts what it calls on them.
import { beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import {
  aGameMastersWorld,
  makeAFakeDbHoldingTheGameMastersWorld,
  makeAFakeDbHoldingThePlayersWorld,
  type ADispatchThePlayersWorldHolds,
  type TheGameMastersWorld,
  type ThePlayersWorld,
} from '../lib/fake-db.ts';
import { itsStackOr } from '../lib/screens.ts';
import type { AGame, ARealm } from '../../src/db/the-db-interface-and-its-areas.ts';

const PP = 'kingdoms-call-player-portal.html';
const GM = 'kingdoms-call-gm-portal.html';
/** The private channel of Thornmere (realm 0) and Veyholt (realm 1). */
const PRIVATELY = 'p:0-1';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A realm's own state in its report, or another's as the report shows it. */
interface OutOrIn {
  readonly conceded?: boolean;
  readonly eliminated?: boolean;
}
interface TheGamesState {
  readonly status?: string;
  readonly block?: boolean;
  /** Thornmere's own state in its report. */
  readonly me?: OutOrIn;
  /** Veyholt's, as Thornmere's report shows it. */
  readonly them?: OutOrIn;
}
/** Both worlds: the player's (its dispatches held, none yet) and the GM's, holding the same rows. */
interface TheWorlds {
  readonly players: Omit<ThePlayersWorld, 'me'> & {
    me: string | null;
    readonly dispatches: ADispatchThePlayersWorldHolds[];
  };
  readonly gm: TheGameMastersWorld;
}

const aGame = (id: string, name: string, gmUser: string, status: string, block: boolean): AGame => ({
  id,
  name,
  gm_user_id: gmUser,
  status,
  turn: 6,
  max_players: 3,
  max_turns: 0,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: null,
  meta: { v: 1, turnMode: { mode: 'manual' } },
  game_state: '{}',
  block_eliminated_msgs: block,
});
const aRealm = (more: Pick<ARealm, 'id' | 'user_id' | 'player_index' | 'display_name' | 'turn_report'>): ARealm => ({
  game_id: 'G1',
  orders_submitted: false,
  orders: null,
  created_at: null,
  invite_code: null,
  last_submitted_at: null,
  ...more,
});

/** Thornmere (p1, realm 0), Veyholt (p2, realm 1) and a computer realm, Grimfast (realm 2), in Marchwood (G1, gm1's);
 *  Fenmoor (G2) is gm2's. The Overlord is ov1. */
function theWorlds({ status = 'active', block = false, me = {}, them = {} }: TheGamesState = {}): TheWorlds {
  const gm = aGameMastersWorld();
  const T = gm.tables;
  T.profiles.push(
    { id: 'p1', name: 'Test Player One' },
    { id: 'p2', name: 'Test Player Two' },
    { id: 'ov1', name: 'Test Overlord' },
    { id: 'gm2', name: 'Test GM Two' },
  );
  T.site_admins.push({ user_id: 'ov1' });
  T.game_masters.push({
    user_id: 'gm2',
    offered_at: '2026-10-01T00:00:00Z',
    offered_by: 'ov1',
    accepted_at: '2026-10-01T00:00:00Z',
  });
  const games = [aGame('G1', 'Marchwood', 'gm1', status, block), aGame('G2', 'Fenmoor', 'gm2', status, block)];
  const report = {
    turn: 5,
    playerName: 'Thornmere',
    kingdom: { conceded: false, eliminated: false, color: '#a33', ...me },
    diplomacy: {
      known: [
        { index: 1, name: 'Veyholt', color: '#33a', relation: 'neutral', conceded: false, eliminated: false, ...them },
        { index: 2, name: 'Grimfast', color: '#3a3', relation: 'neutral' },
      ],
    },
  };
  const realms = [
    aRealm({
      id: 's0',
      user_id: 'p1',
      player_index: 0,
      display_name: 'Thornmere',
      turn_report: JSON.stringify(report),
    }),
    aRealm({ id: 's1', user_id: 'p2', player_index: 1, display_name: 'Veyholt', turn_report: '{}' }),
    aRealm({ id: 's2', user_id: null, player_index: 2, display_name: 'Grimfast', turn_report: '{"isBot":true}' }),
  ];
  // the same row objects in both worlds, as one database holds them
  T.games.push(...games);
  T.game_players.push(...realms);
  return {
    gm,
    players: {
      me: null,
      names: [
        { id: 'p1', name: 'Test Player One' },
        { id: 'p2', name: 'Test Player Two' },
      ],
      games,
      realms,
      dispatchRefused: null,
      readsOfAnotherAccountsRealms: [],
      dispatches: [],
      readMarks: [],
    },
  };
}

interface ABootedPage {
  readonly W: PageWindow;
  readonly doc: Document;
  readonly errs: string[];
}
/** The page on the fake holding its own world (the player portal the player's, the GM portal the GM's), signed in as
 *  `user`, every error it raises kept (an uncaught error, a rejected promise no one handles, each console.error line and
 *  each alert), after 900 ms to start and sign in. */
async function boot(worlds: TheWorlds, page: string, user: string): Promise<ABootedPage> {
  let db;
  if (page === PP) {
    worlds.players.me = user;
    db = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, worlds.players).db;
  } else {
    worlds.gm.me = user;
    db = makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, worlds.gm).db;
  }
  const errs: string[] = [];
  const { window: W } = bootJsdom(readPage(page), {
    supabase: { createClient: () => ({}) },
    db,
    setup(w) {
      w.addEventListener('error', (e) => errs.push(itsStackOr(e.error, e.message)));
      w.onunhandledrejection = (e) => errs.push(itsStackOr(e.reason, e.reason));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w.console.error = (...a) => errs.push(a.map(String).join(' '));
      w['alert'] = (m: unknown) => errs.push(`alert: ${String(m)}`);
    },
  });
  await wait(900);
  // `as`: the page's window has its document (PageWindow names only what most tests read)
  return { W, doc: W['document'] as Document, errs };
}

interface ThePlayersPage extends ABootedPage {
  readonly worlds: TheWorlds;
}
/** Thornmere's Dispatches, as the player opens the game. */
async function thePlayersDispatches(state?: TheGamesState): Promise<ThePlayersPage> {
  const worlds = theWorlds(state);
  const booted = await boot(worlds, PP, 'p1');
  await booted.W.eval(`openReport('s0')`);
  await wait(150);
  return { worlds, ...booted };
}

/** What the composer showed for a channel, and whether the dispatch went. */
interface WhatTheComposerShowed {
  readonly inputOff: boolean;
  readonly hint: string;
  readonly buttonOff: boolean;
  readonly sent: boolean;
}
/** A channel picked the way the player does (its chip clicked), `body` written and sent. */
async function trySend(P: ThePlayersPage, channel: string, body: string): Promise<WhatTheComposerShowed> {
  const { W, doc, worlds } = P;
  const chip = doc.querySelector<HTMLElement>(`#msg-channels .msg-chan[data-ch="${channel}"]`);
  if (chip) chip.click();
  else W.eval(`setMsgChannel(${JSON.stringify(channel)})`);
  const box = doc.querySelector<HTMLTextAreaElement>('#msg-input');
  const button = doc.querySelector<HTMLButtonElement>('#msg-send-btn');
  if (!box || !button) throw new Error('the composer has no box or no send button');
  const inputOff = box.disabled;
  const hint = doc.getElementById('msg-hint')?.textContent ?? '';
  box.value = body;
  W.eval('updateMsgComposer()');
  const buttonOff = button.disabled;
  await W.eval('sendMessage()');
  await wait(30);
  const sent = worlds.players.dispatches.some((m) => m.body === body && m.from_index === 0);
  return { inputOff, hint, buttonOff, sent };
}
/** Whether a dispatch went, and whether its box and its button were closed. */
const howItWent = (r: WhatTheComposerShowed | undefined): Omit<WhatTheComposerShowed, 'hint'> | undefined =>
  r && { sent: r.sent, inputOff: r.inputOff, buttonOff: r.buttonOff };
/** Sent, with the box and the button open. */
const SENT = { sent: true, inputOff: false, buttonOff: false };
/** Not sent, the box and the button closed. */
const REFUSED = { sent: false, inputOff: true, buttonOff: true };
/** The first line of the first error, for a failure's message. */
const theFirstErrorOf = (errs: readonly string[]): string => String(errs[0]).split('\n')[0] ?? '';

describe('a realm still in the game', () => {
  for (const block of [false, true]) {
    const sw = block ? 'switch on' : 'switch off';
    describe(`in the game, ${sw}`, () => {
      const seen: Record<string, WhatTheComposerShowed> = {};
      let errs: string[] = [];
      beforeAll(async () => {
        const P = await thePlayersDispatches({ block });
        seen['public'] = await trySend(P, 'public', 'Grain for iron');
        seen['private'] = await trySend(P, PRIVATELY, 'Meet at the ford');
        errs = P.errs;
        P.W.close();
      });
      test(`in the game, ${sw}: sends to All Realms`, () => {
        expect(howItWent(seen['public']), JSON.stringify(seen['public'])).toEqual(SENT);
      });
      test(`in the game, ${sw}: nothing said about private sending`, () => {
        expect(seen['public']?.hint).not.toMatch(/private/);
      });
      test(`in the game, ${sw}: sends privately`, () => {
        expect(howItWent(seen['private']), JSON.stringify(seen['private'])).toEqual(SENT);
      });
      test(`in the game, ${sw}: no page errors`, () => {
        expect(errs, theFirstErrorOf(errs)).toEqual([]);
      });
    });
  }
  describe('the Dispatches note', () => {
    let note = '';
    beforeAll(async () => {
      const P = await thePlayersDispatches();
      note = P.doc.querySelector('#msg-composer .mc-privacy')?.textContent ?? '';
      P.W.close();
    });
    test('gives the rule: conceded, extinguished, until the game is over, All Realms', () => {
      expect(note).toMatch(/conceded/);
      expect(note).toMatch(/extinguished/);
      expect(note).toMatch(/until the game is over/i);
      expect(note).toMatch(/All Realms/);
    });
  });
});

describe('a realm that is out, while the game goes on', () => {
  const ways: readonly (readonly [string, OutOrIn, RegExp])[] = [
    ['conceded', { conceded: true }, /conceded/],
    ['extinguished', { eliminated: true }, /extinguished/],
  ];
  for (const [how, me, word] of ways) {
    describe(`${how}, switch off`, () => {
      const seen: Record<string, WhatTheComposerShowed> = {};
      let errs: string[] = [];
      beforeAll(async () => {
        const P = await thePlayersDispatches({ me });
        seen['private'] = await trySend(P, PRIVATELY, 'Strike Veyholt now');
        seen['public'] = await trySend(P, 'public', 'Farewell, all');
        errs = P.errs;
        P.W.close();
      });
      test(`${how}, switch off: can't send privately, and says why`, () => {
        expect(howItWent(seen['private']), JSON.stringify(seen['private'])).toEqual(REFUSED);
        expect(seen['private']?.hint).toMatch(new RegExp(`${word.source}[^]*private[^]*until the game is over`));
      });
      test(`${how}, switch off: still writes to All Realms`, () => {
        expect(howItWent(seen['public']), JSON.stringify(seen['public'])).toEqual(SENT);
      });
      test(`${how}, switch off: and the public channel says private sending is off`, () => {
        expect(seen['public']?.hint).toMatch(/no private dispatches until the game is over/);
      });
      test(`${how}, switch off: no page errors`, () => {
        expect(errs, theFirstErrorOf(errs)).toEqual([]);
      });
    });
    describe(`${how}, switch on`, () => {
      const seen: Record<string, WhatTheComposerShowed> = {};
      beforeAll(async () => {
        const P = await thePlayersDispatches({ me, block: true });
        seen['public'] = await trySend(P, 'public', 'Farewell, all');
        seen['private'] = await trySend(P, PRIVATELY, 'Strike Veyholt now');
        P.W.close();
      });
      test(`${how}, switch on: can't write to All Realms, and says why`, () => {
        expect(howItWent(seen['public']), JSON.stringify(seen['public'])).toEqual(REFUSED);
        expect(seen['public']?.hint).toMatch(new RegExp(`${word.source}[^]*GM has blocked`));
      });
      test(`${how}, switch on: can't send privately, and says why`, () => {
        expect(howItWent(seen['private']), JSON.stringify(seen['private'])).toEqual(REFUSED);
        expect(seen['private']?.hint).toMatch(new RegExp(`${word.source}[^]*GM has blocked`));
      });
    });
  }
});

describe('the game is over', () => {
  for (const me of [{ conceded: true }, { eliminated: true }]) {
    const how = me.conceded ? 'has conceded' : 'is extinguished';
    describe(`a realm that ${how}`, () => {
      const seen: Record<string, WhatTheComposerShowed> = {};
      beforeAll(async () => {
        const P = await thePlayersDispatches({ me, block: true, status: 'complete' });
        seen['private'] = await trySend(P, PRIVATELY, 'Well played');
        seen['public'] = await trySend(P, 'public', 'Good game, all');
        P.W.close();
      });
      test(`game over: a realm that ${how} sends privately again`, () => {
        expect(howItWent(seen['private']), JSON.stringify(seen['private'])).toEqual(SENT);
      });
      test(`game over: a realm that ${how} sends to All Realms, switch on or not`, () => {
        expect(howItWent(seen['public']), JSON.stringify(seen['public'])).toEqual(SENT);
      });
    });
  }
  describe('a realm still standing, to one that conceded', () => {
    const seen: Record<string, WhatTheComposerShowed> = {};
    beforeAll(async () => {
      const P = await thePlayersDispatches({ them: { conceded: true } });
      seen['whileItGoesOn'] = await trySend(P, PRIVATELY, 'Are you there?');
      P.W.close();
      const Q = await thePlayersDispatches({ them: { conceded: true }, status: 'complete' });
      seen['gameOver'] = await trySend(Q, PRIVATELY, 'Well fought');
      Q.W.close();
    });
    test('while the game goes on, no one writes privately to a realm that has left (as before)', () => {
      expect(howItWent(seen['whileItGoesOn']), JSON.stringify(seen['whileItGoesOn'])).toEqual(REFUSED);
      expect(seen['whileItGoesOn']?.hint).toMatch(/left the game/);
    });
    test('game over: a realm still standing writes privately to one that conceded', () => {
      expect(howItWent(seen['gameOver']), JSON.stringify(seen['gameOver'])).toEqual(SENT);
    });
  });
});

describe("the GM's switch", () => {
  const theSwitch = (doc: Document): HTMLInputElement | null =>
    doc.querySelector<HTMLInputElement>('#detail-block-eliminated');
  /** The switch turned on or off as the GM does, and its save given time. */
  const flip = async (doc: Document, on: boolean): Promise<void> => {
    const box = theSwitch(doc);
    if (!box) return;
    box.checked = on;
    const view = doc.defaultView;
    if (!view) throw new Error('the page has no window');
    box.dispatchEvent(new view.Event('change', { bubbles: true }));
    await wait(100);
  };
  /** Each game's saved switch, in the GM's world. */
  const saved = (worlds: TheWorlds): unknown[] => worlds.gm.tables.games.map((g) => g['block_eliminated_msgs']);

  describe("the game's GM", () => {
    const seen: Record<string, unknown> = {};
    let errs: string[] = [];
    beforeAll(async () => {
      const worlds = theWorlds();
      const first = await boot(worlds, GM, 'gm1');
      await first.W.eval(`openGame('G1')`);
      await wait(200);
      const box = theSwitch(first.doc);
      seen['there'] = !!box;
      seen['offAtFirst'] = box ? !box.checked : null;
      seen['label'] = box?.closest('label')?.textContent ?? null;
      await flip(first.doc, true);
      seen['afterOn'] = saved(worlds);
      errs = first.errs;
      first.W.close();
      const again = await boot(worlds, GM, 'gm1');
      await again.W.eval(`openGame('G1')`);
      await wait(200);
      seen['shownOnAgain'] = theSwitch(again.doc)?.checked ?? null;
      await flip(again.doc, false);
      seen['afterOff'] = saved(worlds);
      again.W.close();
    });
    test('the game screen has the switch "Block eliminated realms from sending dispatches", off', () => {
      expect(seen['there']).toBe(true);
      expect(seen['offAtFirst']).toBe(true);
      expect(seen['label']).toMatch(/Block eliminated realms from sending dispatches/);
    });
    test("turning it on saves the game's setting", () => {
      expect(seen['afterOn']).toEqual([true, expect.anything()]);
    });
    test("and no other game's", () => {
      expect(seen['afterOn']).toEqual([expect.anything(), false]);
    });
    test('GM: no page errors', () => {
      expect(errs, theFirstErrorOf(errs)).toEqual([]);
    });
    test('opened again, the switch shows on', () => {
      expect(seen['shownOnAgain']).toBe(true);
    });
    test('turning it off saves that too', () => {
      expect(seen['afterOff']).toEqual([false, false]);
    });
  });

  describe('the Overlord, in Master GM mode', () => {
    let afterOn: unknown[] = [];
    let errs: string[] = [];
    beforeAll(async () => {
      const worlds = theWorlds();
      const { W, doc, errs: kept } = await boot(worlds, GM, 'ov1');
      await W.eval(`openGame('G2')`);
      await wait(200);
      await flip(doc, true);
      afterOn = saved(worlds);
      errs = kept;
      W.close();
    });
    test("the Overlord, in Master GM mode, sets it on another GM's game", () => {
      expect(afterOn[1]).toBe(true);
    });
    test('Overlord: no page errors', () => {
      expect(errs, theFirstErrorOf(errs)).toEqual([]);
    });
  });
});
