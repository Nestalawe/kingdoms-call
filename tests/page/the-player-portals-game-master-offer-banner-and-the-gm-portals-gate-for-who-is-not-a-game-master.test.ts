// Game Masters by offer, on the pages (P0-32c, ruling R-097), on the fake database (tests/lib/fake-db.ts): the player
// portal on the player's world, holding the offers, and the GM portal on the GM's, staged with the same offers; both
// answer the P0-32b functions as the database does:
//   - player portal: the "offered to make you a Game Master" banner shows only with an open offer; Accept calls
//     gm_accept_offer and then links to the GM portal; No thanks calls gm_decline_offer and the banner goes;
//   - GM portal: after sign-in, an account that is neither a Game Master nor the Overlord sees only "You're not a
//     Game Master", and nothing else loads (no game list, no watcher, no probes); so does one whose offer is still
//     open, and one whose check fails (which says it couldn't check); a Game Master, and the Overlord, see their games
//     (the Overlord runs none of their own, P0-32d, and in Master GM mode, P0-32g, the turn watcher never runs for them).
// Each case boots its page once, in beforeAll, does what the player does and keeps what the page showed; each check is
// a test of its own. Until plan P1-14z the script gm-offer-and-gate. No thanks on a stood-in Db's answers is also
// checked in the-player-portals-sign-in-on-the-values-handed-them.test.ts.
// Level 4 (page): the banner and the gate are each page's own sign-in, reading of the role and rendering, on the
// database's answers; no lower level signs in.
import { beforeAll, describe, expect, test } from 'vitest';
import { DB_VERSION } from '../lib/boot.ts';
import {
  aGameMastersWorld,
  makeAFakeDbHoldingTheGameMastersWorld,
  makeAFakeDbHoldingThePlayersWorld,
  type AFakeGameMasterOffer,
  type TheGameMastersWorld,
} from '../lib/fake-db.ts';
import {
  bootThePageOnAFakeDatabaseKeepingItsErrors,
  type APageBootedWithItsErrorsKept,
} from '../lib/a-page-booted-in-jsdom-on-a-fake-database-with-its-errors-kept.ts';

const PP = 'kingdoms-call-player-portal.html';
const GM = 'kingdoms-call-gm-portal.html';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const OFFERED = { offered_at: '2026-10-11T00:00:00Z', offered_by: 'ov1', accepted_at: null };
const ACCEPTED = { offered_at: '2026-10-11T00:00:00Z', offered_by: 'ov1', accepted_at: '2026-10-11T01:00:00Z' };

interface APageOnItsWorld extends APageBootedWithItsErrorsKept {
  /** The Game Master offers the page's world holds (gm1's accepted one, and any a case stages). */
  readonly offers: AFakeGameMasterOffer[];
  /** Every call the page made, by name, as the fake recorded them. */
  readonly calls: string[];
  /** The database's reads and functions among them (not the sign-in's calls). */
  readonly dbCalls: string[];
}

/** The page on the fake holding its own world, signed in as `me`: the player portal on the player's world, holding
 *  the offers; the GM portal on the GM's, its game_masters table holding the same offers. `stage` adds offers, or
 *  changes the GM's world. */
async function bootThePage(
  page: string,
  me: string,
  stage?: (offers: AFakeGameMasterOffer[], gm: TheGameMastersWorld) => void,
): Promise<APageOnItsWorld> {
  const gm = aGameMastersWorld();
  gm.me = me;
  const T = gm.tables;
  T.profiles.push(
    { id: 'p1', name: 'Test Player One' },
    { id: 'p3', name: 'Test Player Three' },
    { id: 'ov1', name: 'Test Overlord' },
  );
  T.site_admins.push({ user_id: 'ov1' });
  const offers: AFakeGameMasterOffer[] = [
    { user_id: 'gm1', offered_at: '2026-10-01T00:00:00Z', offered_by: null, accepted_at: '2026-10-01T00:00:00Z' },
  ];
  if (stage) stage(offers, gm);
  T.game_masters.length = 0;
  T.game_masters.push(...offers.map((o) => ({ ...o })));
  const fake =
    page === PP
      ? makeAFakeDbHoldingThePlayersWorld(DB_VERSION, {
          me,
          names: T.profiles.map((p) => ({ id: String(p['id']), name: String(p['name']) })),
          games: [],
          realms: [],
          dispatchRefused: null,
          readsOfAnotherAccountsRealms: [],
          offers,
        })
      : makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, gm);
  const booted = await bootThePageOnAFakeDatabaseKeepingItsErrors(page, fake.db, { waitMs: 900 });
  return { ...booted, offers, calls: fake.calls, dbCalls: fake.calls.filter((c) => /^(from|rpc):/.test(c)) };
}

/** Whether `el` is there and neither it nor any element around it is hidden. */
function shown(el: HTMLElement | null): boolean {
  if (!el) return false;
  for (let e: HTMLElement | null = el; e; e = e.parentElement) if (e.style.display === 'none' || e.hidden) return false;
  return true;
}
const active = (doc: Document, id: string): boolean =>
  doc.getElementById(id)?.classList.contains('section-active') ?? false;
const offerTo = (offers: readonly AFakeGameMasterOffer[], user: string): AFakeGameMasterOffer | undefined =>
  offers.find((r) => r.user_id === user);
/** A made-up game `user` runs. */
const aGameOf = (user: string): Record<string, unknown> => ({
  id: 'G-' + user,
  name: 'Vale of ' + user,
  gm_user_id: user,
  status: 'active',
  turn: 3,
  max_players: 3,
  max_turns: 0,
  created_at: '2026-10-11T00:00:00Z',
  meta: null,
  game_state: '{}',
});

describe('the player portal: an open offer, accepted', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootThePage(PP, 'p3', (offers) => offers.push({ user_id: 'p3', ...OFFERED }));
    const { offers, calls, doc, W } = page;
    errs = page.errs;
    const banner = doc.getElementById('gm-offer-banner');
    seen['banner'] = { shown: shown(banner), text: banner?.textContent ?? '' };
    seen['inMyGames'] = !!banner?.closest('#sec-games');
    const accept = doc.getElementById('gm-offer-accept');
    seen['accept'] = !!accept;
    if (accept) {
      accept.click();
      await wait(100);
      seen['called'] = calls.includes('rpc:gm_accept_offer');
      seen['accepted'] = offerTo(offers, 'p3')?.accepted_at != null;
      seen['linked'] = shown(banner) && !!banner?.querySelector('a[href="kingdoms-call-gm-portal.html"]');
      seen['acceptGone'] = !shown(doc.getElementById('gm-offer-accept'));
    }
    W.close();
  });

  test('the banner shows on My Games', () => {
    expect(seen['banner']).toMatchObject({ shown: true });
    expect(seen['banner']).toHaveProperty(
      'text',
      expect.stringMatching(/The Overlord has offered to make you a Game Master/) as unknown,
    );
  });
  test('and it sits in My Games', () => {
    expect(seen['inMyGames']).toBe(true);
  });
  test('it has an Accept button', () => {
    expect(seen['accept']).toBe(true);
  });
  test('Accept calls gm_accept_offer', () => {
    expect(seen['called']).toBe(true);
  });
  test('and the offer is accepted', () => {
    expect(seen['accepted']).toBe(true);
  });
  test('then the banner links to the GM portal', () => {
    expect(seen['linked']).toBe(true);
  });
  test('and Accept is gone', () => {
    expect(seen['acceptGone']).toBe(true);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('the player portal: an open offer, turned down', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootThePage(PP, 'p3', (offers) => offers.push({ user_id: 'p3', ...OFFERED }));
    const { offers, calls, doc, W } = page;
    errs = page.errs;
    const decline = doc.getElementById('gm-offer-decline');
    seen['decline'] = decline?.textContent ?? null;
    if (decline) {
      decline.click();
      await wait(100);
      seen['called'] = calls.includes('rpc:gm_decline_offer');
      seen['offerGone'] = !offerTo(offers, 'p3');
      seen['bannerGone'] = !shown(doc.getElementById('gm-offer-banner'));
      seen['accepted'] = calls.includes('rpc:gm_accept_offer');
    }
    W.close();
  });

  test('the banner has a No thanks button', () => {
    expect(seen['decline']).toMatch(/No thanks/);
  });
  test('No thanks calls gm_decline_offer', () => {
    expect(seen['called']).toBe(true);
  });
  test('and the offer is gone', () => {
    expect(seen['offerGone']).toBe(true);
  });
  test('and so is the banner', () => {
    expect(seen['bannerGone']).toBe(true);
  });
  test('and nothing was accepted', () => {
    expect(seen['accepted']).toBe(false);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('the player portal: no open offer', () => {
  const seen: Record<string, unknown> = {};
  const errs: Record<string, string[]> = {};

  beforeAll(async () => {
    {
      const page = await bootThePage(PP, 'p1');
      errs['none'] = page.errs;
      seen['asked'] = page.calls.includes('from:game_masters');
      seen['noneBanner'] = shown(page.doc.getElementById('gm-offer-banner'));
      page.W.close();
    }
    {
      const page = await bootThePage(PP, 'p1', (offers) => offers.push({ user_id: 'p1', ...ACCEPTED }));
      errs['accepted'] = page.errs;
      seen['acceptedBanner'] = shown(page.doc.getElementById('gm-offer-banner'));
      page.W.close();
    }
  });

  test('no offer: the portal asks', () => {
    expect(seen['asked']).toBe(true);
  });
  test('no offer: and shows no banner', () => {
    expect(seen['noneBanner']).toBe(false);
  });
  test('no offer: no page errors', () => {
    expect(errs['none']).toEqual([]);
  });
  test('already a Game Master: no banner', () => {
    expect(seen['acceptedBanner']).toBe(false);
  });
  test('already a Game Master: no page errors', () => {
    expect(errs['accepted']).toEqual([]);
  });
});

describe.for([
  ['a player', 'p1', false],
  ['an open offer', 'p3', true],
] as const)("the GM portal's gate: %s", ([, user, offered]) => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootThePage(GM, user, (offers, gm) => {
      gm.tables.games.push(aGameOf(user));
      if (offered) offers.push({ user_id: user, ...OFFERED });
    });
    const { doc, W, dbCalls } = page;
    errs = page.errs;
    const gate = doc.getElementById('sec-not-gm');
    seen['gate'] = active(doc, 'sec-not-gm');
    seen['text'] = gate?.textContent ?? '';
    seen['link'] = !!gate?.querySelector('a[href="kingdoms-call-player-portal.html"]');
    seen['games'] = active(doc, 'sec-games');
    seen['other'] = dbCalls.filter(
      (c) => !['rpc:kc_db_version', 'rpc:is_game_master', 'rpc:is_site_admin'].includes(c),
    );
    seen['watcher'] = W.eval('_autoWatcherTimer');
    W.close();
  });

  test('the "not a Game Master" page shows', () => {
    expect(seen['gate']).toBe(true);
  });
  test('it says why', () => {
    expect(seen['text']).toMatch(/You're not a Game Master\. Game Masters are chosen by the Overlord\./);
  });
  test('it links to the player portal', () => {
    expect(seen['link']).toBe(true);
  });
  test('the game list stays hidden', () => {
    expect(seen['games']).toBe(false);
  });
  test('nothing else is read', () => {
    expect(seen['other']).toEqual([]);
  });
  test('no turn watcher', () => {
    expect(seen['watcher'] == null).toBe(true);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe("the GM portal's gate: a failed check stops the page too, but says so", () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootThePage(GM, 'gm1', (_offers, gm) => {
      gm.tables.games.push(aGameOf('gm1'));
      gm.failing['rpc.is_game_master'] = { message: 'TypeError: Failed to fetch' };
    });
    const { doc, W, dbCalls } = page;
    errs = page.errs;
    seen['gate'] = active(doc, 'sec-not-gm');
    seen['text'] = doc.getElementById('sec-not-gm')?.textContent ?? '';
    seen['games'] = active(doc, 'sec-games');
    seen['reads'] = dbCalls.filter((c) => c.startsWith('from:'));
    W.close();
  });

  test("a failed check: the page stops and says it couldn't check", () => {
    expect(seen['gate']).toBe(true);
    expect(seen['text']).toMatch(/Couldn't check/);
  });
  test('and nothing else loads', () => {
    expect(seen['games']).toBe(false);
    expect(seen['reads']).toEqual([]);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe.for([
  ['a Game Master', 'gm1', /Vale of gm1/, true],
  ['the Overlord', 'ov1', /No games yet/, false],
] as const)('the GM portal: %s', ([, user, listed, watcher]) => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootThePage(GM, user, (_offers, gm) => {
      if (user === 'gm1') gm.tables.games.push(aGameOf(user));
    });
    const { doc, W } = page;
    errs = page.errs;
    seen['games'] = active(doc, 'sec-games');
    seen['gate'] = active(doc, 'sec-not-gm');
    seen['list'] = doc.getElementById('games-list')?.textContent ?? '';
    seen['watcher'] = W.eval('_autoWatcherTimer') != null;
    W.close();
  });

  test('the game list shows', () => {
    expect(seen['games']).toBe(true);
  });
  test('no "not a Game Master" page', () => {
    expect(seen['gate']).toBe(false);
  });
  test(`the list is loaded (${listed.source})`, () => {
    expect(seen['list']).toMatch(listed);
  });
  test(`the turn watcher ${watcher ? 'runs' : "doesn't run"}`, () => {
    expect(seen['watcher']).toBe(watcher);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});
