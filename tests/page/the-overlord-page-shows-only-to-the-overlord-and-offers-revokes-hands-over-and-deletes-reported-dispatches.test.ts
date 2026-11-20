// The Overlord page (P0-32f, ruling R-097), on the fake database holding the Overlord's world (tests/lib/fake-db.ts),
// whose functions answer as the database defines them:
//   - signed out: the sign-in form, and nothing is read; signed in as anyone but the Overlord: "This page is for the
//     Overlord", and nothing is read but that check; a check that fails says so, and nothing else loads;
//   - the Overlord: every account, searchable by name or email; Offer GM calls gm_offer, Withdraw offer
//     gm_withdraw_offer;
//   - Revoke GM lists the account's unfinished games, each with Hand over to… (Game Masters only, not the account
//     itself); Revoke stays disabled until none is left; handing over calls reassign_game; then Revoke calls gm_revoke;
//   - every game, with its GM, status, turn mode, Hand over to… and a link to it in the GM portal;
//   - the reported dispatches of every game, with realm names; Delete removes the dispatch; a refused hand-over shows
//     the database's reason;
//   - what people wrote (names, game names, dispatches, reasons) is shown as text, never markup.
// Each part boots the page once, in beforeAll, does what the Overlord does and keeps what the page showed; each check is
// a test of its own. Until plan P1-14z the script overlord-page. The columns the lists read are the Overlord's Db's,
// checked as each role in tests/db/the-overlords-accounts-and-games-answer-each-role.test.ts.
// Level 4 (page): who may see the page, and what each button sends, are the page's own sign-in, rendering and clicks
// across its files on the database's answers; the unit tests of the page's functions
// (the-overlord-pages-lines-no-tour-reaches-keep-their-values.test.ts) call them one by one, with no sign-in.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { DB_VERSION } from '../lib/boot.ts';
import { makeAFakeDbHoldingTheOverlordsWorld, type AFakeGame, type TheOverlordsWorld } from '../lib/fake-db.ts';
import {
  bootThePageOnAFakeDatabaseKeepingItsErrors,
  type APageBootedWithItsErrorsKept,
} from '../lib/a-page-booted-in-jsdom-on-a-fake-database-with-its-errors-kept.ts';

const PAGE = 'kingdoms-call-overlord.html';
const HOSTILE = '<img id="kc-injected" src="x">';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A made-up game: its id, name, GM, status, turn and turn mode. */
function aGame(
  id: string,
  name: string,
  gm: string,
  status: string,
  turn: number,
  mode: string,
  archived?: boolean,
): AFakeGame {
  return {
    id,
    name,
    gm_user_id: gm,
    status,
    turn,
    max_turns: 12,
    created_at: '2026-10-0' + id.slice(-1) + 'T00:00:00Z',
    meta: { v: 1, turnMode: { mode }, ...(archived ? { archived } : {}) },
  };
}

/** The Overlord's world: the Overlord, two Game Masters (gm1 runs three games, one finished), three players (p2 with
 *  an open offer, p3 named with markup), five games, and one reported dispatch. */
function theOverlordsWorld(signedIn: string | null): TheOverlordsWorld {
  return {
    signedIn,
    overlord: 'ov1',
    failingChecks: new Set(),
    accounts: [
      { id: 'ov1', name: 'Test Overlord', email: 'overlord@example.test' },
      {
        id: 'gm1',
        name: 'Warden Oake',
        email: 'gm1@example.test',
        joined: '2026-09-01T00:00:00Z',
        last_sign_in: '2026-10-13T00:00:00Z',
      },
      { id: 'gm2', name: 'Warden Pell', email: 'gm2@example.test' },
      { id: 'p1', name: 'Ada Thorn', email: 'p1@example.test' },
      { id: 'p2', name: 'Bram Vey', email: 'p2@example.test' },
      { id: 'p3', name: HOSTILE, email: 'p3@example.test' },
    ],
    offers: [
      { user_id: 'gm1', offered_at: '2026-10-01T00:00:00Z', offered_by: null, accepted_at: '2026-10-01T00:00:00Z' },
      { user_id: 'gm2', offered_at: '2026-10-01T00:00:00Z', offered_by: 'ov1', accepted_at: '2026-10-01T00:00:00Z' },
      { user_id: 'p2', offered_at: '2026-10-12T00:00:00Z', offered_by: 'ov1', accepted_at: null },
    ],
    games: [
      aGame('G1', 'Marchwood', 'gm1', 'active', 3, 'auto'),
      aGame('G2', 'Open Vale', 'gm1', 'setup', 0, 'manual'),
      aGame('G3', 'Ashen Reach', 'gm1', 'complete', 9, 'manual'),
      aGame('G4', 'Fenmoor', 'gm2', 'active', 2, 'deadline', true),
      aGame('G5', HOSTILE, 'gm2', 'active', 1, 'manual'),
    ],
    realms: [
      { id: 's1', game_id: 'G1', user_id: 'p1', player_index: 0, display_name: 'Thornmere' },
      { id: 's2', game_id: 'G1', user_id: 'p3', player_index: 1, display_name: HOSTILE },
    ],
    dispatches: [
      {
        id: 7,
        game_id: 'G1',
        turn: 3,
        from_index: 1,
        to_indexes: [0],
        scope: 'private',
        body: 'Yield the ford. ' + HOSTILE,
      },
    ],
    reports: [
      {
        id: 1,
        message_id: 7,
        game_id: 'G1',
        reporter_index: 0,
        reason: 'Threats ' + HOSTILE,
        created_at: '2026-10-13T00:00:00Z',
      },
    ],
  };
}

interface TheOverlordPageBooted extends APageBootedWithItsErrorsKept {
  readonly S: TheOverlordsWorld;
  readonly fake: ReturnType<typeof makeAFakeDbHoldingTheOverlordsWorld>;
  /** The database's reads and functions the page called, by name (`from:` and `rpc:`, as the fake records them). */
  readonly dbCalls: () => string[];
}

async function bootTheOverlordPage(
  signedIn: string | null,
  stage?: (S: TheOverlordsWorld) => void,
): Promise<TheOverlordPageBooted> {
  const S = theOverlordsWorld(signedIn);
  if (stage) stage(S);
  const fake = makeAFakeDbHoldingTheOverlordsWorld(DB_VERSION, S);
  const page = await bootThePageOnAFakeDatabaseKeepingItsErrors(PAGE, fake.db, {
    url: 'https://example.org/' + PAGE,
    waitMs: 400,
  });
  return { ...page, S, fake, dbCalls: () => fake.calls.filter((c) => /^(rpc|from):/.test(c)) };
}

const on = (doc: Document, id: string): boolean => doc.getElementById(id)?.classList.contains('on') ?? false;
const textOf = (el: Element | null | undefined): string => el?.textContent ?? '';
const rowOf = (doc: Document, box: string, attr: string, key: string): HTMLTableRowElement | null =>
  doc.querySelector<HTMLTableRowElement>(`#${box} tr[${attr}="${key}"]`);
const accountRow = (doc: Document, id: string): HTMLTableRowElement | null => rowOf(doc, 'accounts', 'data-user', id);
const buttonIn = (scope: Element | null, act: string): HTMLElement | null =>
  scope?.querySelector<HTMLElement>(`[data-act="${act}"]`) ?? null;
const accountsListed = (doc: Document): number => doc.querySelectorAll('#accounts tbody tr[data-user]').length;
const injected = (doc: Document): boolean => doc.getElementById('kc-injected') !== null;
/** Types `value` into `input` as a person does: the value, then its input event. */
function typeInto(page: APageBootedWithItsErrorsKept, input: HTMLInputElement | null, value: string): void {
  if (!input) return;
  input.value = value;
  // `as`: the page's own Event, so the page's listeners take it
  input.dispatchEvent(new (page.W['Event'] as typeof Event)('input'));
}

describe('who may use the page', () => {
  const seen: Record<string, { denied: boolean; mainShown: boolean; calls: string[]; errs: string[] }> = {};
  let signedOut: { form: boolean; calls: string[]; errs: string[] };
  let failed: { deniedSaysWhy: boolean; calls: string[]; errs: string[] };

  beforeAll(async () => {
    {
      const { doc, W, errs, dbCalls } = await bootTheOverlordPage(null);
      signedOut = {
        form: on(doc, 'sec-auth') && !!doc.getElementById('si-email') && !!doc.getElementById('si-password'),
        calls: dbCalls(),
        errs,
      };
      W.close();
    }
    for (const user of ['p1', 'gm1']) {
      const { doc, W, errs, dbCalls } = await bootTheOverlordPage(user);
      seen[user] = {
        denied:
          on(doc, 'sec-denied') && textOf(doc.getElementById('sec-denied')).includes('This page is for the Overlord.'),
        mainShown: on(doc, 'sec-main'),
        calls: dbCalls(),
        errs,
      };
      W.close();
    }
    {
      const { doc, W, errs, dbCalls } = await bootTheOverlordPage('ov1', (S) => S.failingChecks.add('is_site_admin'));
      failed = {
        deniedSaysWhy: on(doc, 'sec-denied') && textOf(doc.getElementById('denied-msg')).includes("Couldn't check"),
        calls: dbCalls(),
        errs,
      };
      W.close();
    }
  });

  test('signed out: the sign-in form shows', () => {
    expect(signedOut.form).toBe(true);
  });
  test('signed out: nothing is read', () => {
    expect(signedOut.calls).toEqual(['rpc:kc_db_version']);
  });
  test('signed out: no page errors', () => {
    expect(signedOut.errs).toEqual([]);
  });
  describe.for([
    ['a player', 'p1'],
    ['a Game Master', 'gm1'],
  ] as const)('%s', ([, user]) => {
    test('"This page is for the Overlord"', () => {
      expect(seen[user]?.denied).toBe(true);
    });
    test('nothing else shows', () => {
      expect(seen[user]?.mainShown).toBe(false);
    });
    test('nothing is read but the check', () => {
      expect(seen[user]?.calls).toEqual(['rpc:kc_db_version', 'rpc:is_site_admin']);
    });
    test('no page errors', () => {
      expect(seen[user]?.errs).toEqual([]);
    });
  });
  test("a failed check: the page stops and says it couldn't check", () => {
    expect(failed.deniedSaysWhy).toBe(true);
  });
  test('a failed check: nothing else loads', () => {
    expect(failed.calls.filter((c) => c.startsWith('from:') || c === 'rpc:overlord_accounts')).toEqual([]);
  });
  test('a failed check: no page errors', () => {
    expect(failed.errs).toEqual([]);
  });
});

describe('the Overlord: the accounts', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage('ov1');
    const { S, fake, doc, W } = page;
    errs = page.errs;
    seen['main'] = on(doc, 'sec-main');
    seen['listed'] = accountsListed(doc);
    const gm1 = accountRow(doc, 'gm1');
    seen['gm1'] = textOf(gm1);
    seen['gm1Cells'] = [...(gm1?.cells ?? [])].slice(4, 7).map((c) => c.textContent.trim());
    const own = accountRow(doc, 'ov1');
    seen['ownActions'] = [buttonIn(own, 'offer'), buttonIn(own, 'revoke')].filter(Boolean).length;
    seen['p2'] = textOf(accountRow(doc, 'p2'));
    seen['p2Withdraw'] = !!buttonIn(accountRow(doc, 'p2'), 'withdraw');

    const q = doc.querySelector<HTMLInputElement>('#acct-q');
    typeInto(page, q, 'THORN');
    seen['byName'] = { listed: accountsListed(doc), p1: !!accountRow(doc, 'p1') };
    typeInto(page, q, 'gm2@');
    seen['byEmail'] = { listed: accountsListed(doc), gm2: !!accountRow(doc, 'gm2') };
    typeInto(page, q, '');

    buttonIn(accountRow(doc, 'p1'), 'offer')?.click();
    await wait(100);
    seen['offer'] = {
      called: fake.calls.includes('rpc:gm_offer'),
      open: S.offers.some((r) => r.user_id === 'p1' && r.accepted_at == null),
    };
    seen['p1'] = textOf(accountRow(doc, 'p1'));
    buttonIn(accountRow(doc, 'p2'), 'withdraw')?.click();
    await wait(100);
    seen['withdraw'] = {
      called: fake.calls.includes('rpc:gm_withdraw_offer'),
      gone: !S.offers.some((r) => r.user_id === 'p2'),
    };
    seen['p2OfferAgain'] = !!buttonIn(accountRow(doc, 'p2'), 'offer');
    seen['injected'] = injected(doc);
    W.close();
  });

  test('the page shows', () => {
    expect(seen['main']).toBe(true);
  });
  test('every account is listed', () => {
    expect(seen['listed']).toBe(6);
  });
  test('with name, email, joined and last sign-in', () => {
    expect(seen['gm1']).toMatch(/Warden Oake/);
    expect(seen['gm1']).toMatch(/gm1@example\.test/);
    expect(seen['gm1']).toMatch(/2026-09-01/);
    expect(seen['gm1']).toMatch(/2026-10-13/);
  });
  test('and GM status, games run and games played', () => {
    expect(seen['gm1Cells']).toEqual(['Game Master', '3', '0']);
  });
  test("the Overlord's own account has no actions", () => {
    expect(seen['ownActions']).toBe(0);
  });
  test('an open offer shows Withdraw offer', () => {
    expect(seen['p2']).toMatch(/Offered/);
    expect(seen['p2Withdraw']).toBe(true);
  });
  test('search by name narrows the list', () => {
    expect(seen['byName']).toEqual({ listed: 1, p1: true });
  });
  test('search by email too', () => {
    expect(seen['byEmail']).toEqual({ listed: 1, gm2: true });
  });
  test('Offer GM calls gm_offer', () => {
    expect(seen['offer']).toEqual({ called: true, open: true });
  });
  test('and the account now shows Offered', () => {
    expect(seen['p1']).toMatch(/Offered/);
  });
  test('Withdraw offer calls gm_withdraw_offer', () => {
    expect(seen['withdraw']).toEqual({ called: true, gone: true });
  });
  test('and the account can be offered again', () => {
    expect(seen['p2OfferAgain']).toBe(true);
  });
  test('what people wrote is shown as text, not markup', () => {
    expect(seen['injected']).toBe(false);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('revoking a GM: their unfinished games are handed over first', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage('ov1');
    const { S, fake, doc, W } = page;
    errs = page.errs;
    buttonIn(accountRow(doc, 'gm1'), 'revoke')?.click();
    await wait(50);
    const panel = (): HTMLElement | null => doc.getElementById('revoke-panel');
    const listed = (): string =>
      [...(panel()?.querySelectorAll('tr[data-game]') ?? [])]
        .map((r) => r.getAttribute('data-game'))
        .sort()
        .join();
    const confirm = (): HTMLButtonElement | null => doc.querySelector<HTMLButtonElement>('#revoke-confirm');
    const pickFor = (game: string): HTMLSelectElement | null =>
      panel()?.querySelector<HTMLSelectElement>(`tr[data-game="${game}"] [data-act="pick"]`) ?? null;
    seen['panel'] = !!panel();
    seen['listed'] = listed();
    seen['disabled'] = confirm()?.disabled;
    seen['choices'] = [...(pickFor('G1')?.options ?? [])].map((o) => o.value).filter(Boolean);
    confirm()?.click();
    await wait(50);
    seen['revokedTooSoon'] = fake.calls.includes('rpc:gm_revoke');
    for (const game of ['G1', 'G2']) {
      const pick = pickFor(game);
      if (pick) pick.value = 'gm2';
      panel()?.querySelector<HTMLElement>(`tr[data-game="${game}"] [data-act="handover"]`)?.click();
      await wait(100);
    }
    seen['handedOver'] = {
      calls: fake.calls.filter((c) => c === 'rpc:reassign_game').length,
      gm2Runs: S.games.filter((g) => g.gm_user_id === 'gm2').length,
    };
    seen['left'] = { panel: !!panel(), listed: listed(), says: textOf(panel()).includes('no unfinished game') };
    seen['enabled'] = confirm()?.disabled === false;
    confirm()?.click();
    await wait(100);
    seen['revoked'] = {
      called: fake.calls.includes('rpc:gm_revoke'),
      offerGone: !S.offers.some((r) => r.user_id === 'gm1'),
    };
    seen['gm1'] = textOf(accountRow(doc, 'gm1'));
    seen['finished'] = S.games.find((g) => g.id === 'G3')?.gm_user_id;
    W.close();
  });

  test("Revoke GM lists the account's unfinished games (not the finished one)", () => {
    expect(seen['panel']).toBe(true);
    expect(seen['listed']).toBe('G1,G2');
  });
  test('Revoke is disabled while any is left', () => {
    expect(seen['disabled']).toBe(true);
  });
  test('Hand over to… offers Game Masters only, not the account itself', () => {
    expect(seen['choices']).toEqual(['gm2']);
  });
  test('clicking the disabled Revoke does nothing', () => {
    expect(seen['revokedTooSoon']).toBe(false);
  });
  test('Hand over calls reassign_game for each', () => {
    expect(seen['handedOver']).toEqual({ calls: 2, gm2Runs: 4 });
  });
  test('then none is left', () => {
    expect(seen['left']).toEqual({ panel: true, listed: '', says: true });
  });
  test('and Revoke is enabled', () => {
    expect(seen['enabled']).toBe(true);
  });
  test('Revoke calls gm_revoke', () => {
    expect(seen['revoked']).toEqual({ called: true, offerGone: true });
  });
  test('and the account is no longer a Game Master', () => {
    expect(seen['gm1']).toMatch(/Player/);
  });
  test('the finished game stays theirs', () => {
    expect(seen['finished']).toBe('gm1');
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('every game', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage('ov1');
    const { S, doc, W } = page;
    errs = page.errs;
    seen['ids'] = [...doc.querySelectorAll('#games tr[data-game]')]
      .map((r) => r.getAttribute('data-game'))
      .sort()
      .join();
    const g4 = rowOf(doc, 'games', 'data-game', 'G4');
    seen['g4'] = textOf(g4);
    const open = g4?.querySelector('a');
    seen['link'] = { href: open?.getAttribute('href') };
    seen['linkText'] = textOf(open);
    const pick = g4?.querySelector<HTMLSelectElement>('[data-act="pick"]');
    seen['choices'] = [...(pick?.options ?? [])].map((o) => o.value).filter(Boolean);
    if (pick) pick.value = 'gm1';
    g4?.querySelector<HTMLElement>('[data-act="handover"]')?.click();
    await wait(100);
    seen['g4Gm'] = S.games.find((g) => g.id === 'G4')?.gm_user_id;
    seen['g4After'] = textOf(rowOf(doc, 'games', 'data-game', 'G4'));
    seen['injected'] = injected(doc);
    W.close();
  });

  test('every game is listed, whoever runs it', () => {
    expect(seen['ids']).toBe('G1,G2,G3,G4,G5');
  });
  test('with its GM, status (archived too) and turn mode', () => {
    expect(seen['g4']).toMatch(/Warden Pell/);
    expect(seen['g4']).toMatch(/active/);
    expect(seen['g4']).toMatch(/Archived/);
    expect(seen['g4']).toMatch(/deadline/i);
  });
  test('and a link to it in the GM portal', () => {
    expect(seen['link']).toMatchObject({ href: 'kingdoms-call-gm-portal.html?game=G4' });
    expect(seen['linkText']).toMatch(/Open in the GM portal/);
  });
  test('Hand over to… offers the other Game Masters', () => {
    expect(seen['choices']).toEqual(['gm1']);
  });
  test('Hand over gives the game to the chosen GM', () => {
    expect(seen['g4Gm']).toBe('gm1');
  });
  test('and the list shows its new GM', () => {
    expect(seen['g4After']).toMatch(/Warden Oake/);
  });
  test('what people wrote is shown as text, not markup', () => {
    expect(seen['injected']).toBe(false);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('the reported dispatches', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage('ov1');
    const { S, doc, W } = page;
    errs = page.errs;
    const report = doc.querySelector('#reports [data-message="7"]');
    seen['shown'] = !!report;
    seen['report'] = textOf(report);
    buttonIn(report, 'delete-dispatch')?.click();
    await wait(100);
    seen['deleted'] = !S.dispatches.some((m) => m.id === 7);
    seen['reports'] = textOf(doc.getElementById('reports'));
    seen['injected'] = injected(doc);
    W.close();
  });

  test('a reported dispatch shows with its game and turn', () => {
    expect(seen['shown']).toBe(true);
    expect(seen['report']).toMatch(/Marchwood/);
    expect(seen['report']).toMatch(/Turn 3/);
  });
  test('with sender, recipient and reporter by realm name', () => {
    expect(seen['report']).toMatch(/from .*<img id="kc-injected" src="x">.* to Thornmere/);
    expect(seen['report']).toMatch(/reported by Thornmere/);
  });
  test('with the reason and the text', () => {
    expect(seen['report']).toMatch(/Threats/);
    expect(seen['report']).toMatch(/Yield the ford\./);
  });
  test('Delete removes the dispatch', () => {
    expect(seen['deleted']).toBe(true);
  });
  test('and the list empties', () => {
    expect(seen['reports']).toMatch(/No dispatches reported/);
  });
  test('what people wrote is shown as text, not markup', () => {
    expect(seen['injected']).toBe(false);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe("a refusal shows the database's reason", () => {
  let msg = '';
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage('ov1');
    const { fake, doc, W } = page;
    errs = page.errs;
    // the database refuses the hand-over (the chosen GM was revoked in another tab since the list loaded)
    const pick = doc.querySelector<HTMLSelectElement>('#games tr[data-game="G5"] [data-act="pick"]');
    if (pick) pick.value = 'gm1';
    vi.spyOn(fake.db.theOverlordsGames, 'handThisGameToThisGameMaster').mockResolvedValue({
      data: null,
      error: { message: "That account isn't a Game Master." },
      status: 400,
    });
    doc.querySelector<HTMLElement>('#games tr[data-game="G5"] [data-act="handover"]')?.click();
    await wait(100);
    msg = textOf(doc.getElementById('msg'));
    W.close();
  });

  test('a refused hand-over shows why', () => {
    expect(msg).toMatch(/That account isn't a Game Master\./);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});
