// Suspending and deleting accounts on the Overlord page (P0-32h, ruling R-097, D-13 follow-up 2), on the fake database
// holding the Overlord's world (tests/lib/fake-db.ts), with account_suspend, account_unsuspend and account_delete as
// the database defines them:
//   - the page says a session already open lasts until it expires, up to an hour;
//   - each account but the Overlord's own has Suspend (for a day, a week, until lifted) and Delete…; a suspended one
//     says until when, and has Lift suspension instead of Suspend;
//   - Suspend calls account_suspend with the end chosen (none for "until lifted"); Lift calls account_unsuspend;
//   - Delete… says what goes and what stays, and deletes only once the account's email is typed; then the account
//     leaves the list and its finished game keeps its realm with no account;
//   - a deletion the database refuses (the account plays in a running game) shows why, and the account stays; one who
//     runs an unfinished game is told to hand it over first;
//   - what people wrote is shown as text.
// Each part boots the page once, in beforeAll, does what the Overlord does and keeps what the page showed; each check is
// a test of its own. Until plan P1-14z the script overlord-suspend-delete.
// Level 4 (page): the buttons, the panel and its typed email are the page's own rendering and clicks on the database's
// answers; the unit test of the page's functions (the-overlord-pages-lines-no-tour-reaches-keep-their-values.test.ts)
// calls them one by one, with no sign-in.
import { beforeAll, describe, expect, test } from 'vitest';
import { DB_VERSION } from '../lib/boot.ts';
import { makeAFakeDbHoldingTheOverlordsWorld, type TheOverlordsWorld } from '../lib/fake-db.ts';
import {
  bootThePageOnAFakeDatabaseKeepingItsErrors,
  type APageBootedWithItsErrorsKept,
} from '../lib/a-page-booted-in-jsdom-on-a-fake-database-with-its-errors-kept.ts';

const PAGE = 'kingdoms-call-overlord.html';
const HOSTILE = '<img id="kc-injected" src="x">';
const DAY = 864e5;
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** The Overlord's world: the Overlord signed in, a Game Master running a game and a finished one, a player in the
 *  running game, one suspended for three more days, and one named with markup who played the finished game. */
function theOverlordsWorld(): TheOverlordsWorld {
  return {
    signedIn: 'ov1',
    overlord: 'ov1',
    failingChecks: new Set(),
    accounts: [
      { id: 'ov1', name: 'Test Overlord', email: 'overlord@example.test' },
      { id: 'gm1', name: 'Warden Oake', email: 'gm1@example.test' },
      { id: 'p1', name: 'Ada Thorn', email: 'p1@example.test' },
      {
        id: 'p2',
        name: 'Bram Vey',
        email: 'p2@example.test',
        banned_until: new Date(Date.now() + 3 * DAY).toISOString(),
      },
      { id: 'p5', name: HOSTILE, email: 'p5@example.test' },
    ],
    offers: [
      { user_id: 'gm1', offered_at: '2026-10-01T00:00:00Z', offered_by: null, accepted_at: '2026-10-01T00:00:00Z' },
    ],
    games: [
      {
        id: 'G1',
        name: 'Marchwood',
        gm_user_id: 'gm1',
        status: 'active',
        turn: 3,
        max_turns: 12,
        created_at: '2026-10-01T00:00:00Z',
        meta: { v: 1, turnMode: { mode: 'manual' } },
      },
      {
        id: 'G2',
        name: 'Ashen Reach',
        gm_user_id: 'gm1',
        status: 'complete',
        turn: 9,
        max_turns: 12,
        created_at: '2026-09-01T00:00:00Z',
        meta: { v: 1 },
      },
    ],
    realms: [
      { id: 's1', game_id: 'G1', user_id: 'p1', player_index: 0, display_name: 'Thornmere' },
      { id: 's2', game_id: 'G2', user_id: 'p5', player_index: 0, display_name: 'Wrenholt' },
    ],
    dispatches: [],
    reports: [],
  };
}

interface TheOverlordPageBooted extends APageBootedWithItsErrorsKept {
  readonly S: TheOverlordsWorld;
  readonly calls: string[];
}

async function bootTheOverlordPage(): Promise<TheOverlordPageBooted> {
  const S = theOverlordsWorld();
  const fake = makeAFakeDbHoldingTheOverlordsWorld(DB_VERSION, S);
  const page = await bootThePageOnAFakeDatabaseKeepingItsErrors(PAGE, fake.db, {
    url: 'https://example.org/' + PAGE,
    waitMs: 400,
  });
  return { ...page, S, calls: fake.calls };
}

const textOf = (el: Element | null | undefined): string => el?.textContent ?? '';
const accountRow = (doc: Document, id: string): HTMLTableRowElement | null =>
  doc.querySelector<HTMLTableRowElement>(`#accounts tr[data-user="${id}"]`);
const buttonIn = (scope: Element | null, act: string): HTMLElement | null =>
  scope?.querySelector<HTMLElement>(`[data-act="${act}"]`) ?? null;
const pickerIn = (scope: Element | null): HTMLSelectElement | null =>
  scope?.querySelector<HTMLSelectElement>('[data-act="suspend-for"]') ?? null;
/** Whether `iso` is within five minutes of `ms` from now. */
const near = (iso: string | null | undefined, ms: number): boolean =>
  !!iso && Math.abs(new Date(iso).getTime() - (Date.now() + ms)) < 5 * 60e3;
const suspendedUntil = (S: TheOverlordsWorld, id: string): string | null | undefined =>
  S.accounts.find((a) => a.id === id)?.banned_until;
/** Types `value` into `input` as a person does: the value, then its input event. */
function typeInto(page: APageBootedWithItsErrorsKept, input: HTMLInputElement, value: string): void {
  input.value = value;
  // `as`: the page's own Event, so the page's listeners take it
  input.dispatchEvent(new (page.W['Event'] as typeof Event)('input'));
}

describe('what each account offers', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage();
    const { doc, W } = page;
    errs = page.errs;
    seen['main'] = textOf(doc.getElementById('sec-main'));
    const p1 = accountRow(doc, 'p1');
    const p2 = accountRow(doc, 'p2');
    const own = accountRow(doc, 'ov1');
    seen['p1Buttons'] = ['suspend', 'suspend-for', 'delete'].filter((act) => buttonIn(p1, act));
    seen['p1Picker'] = [...(pickerIn(p1)?.options ?? [])].map((o) => o.textContent).join('|');
    seen['p2'] = { text: textOf(p2), lift: !!buttonIn(p2, 'unsuspend'), suspend: !!buttonIn(p2, 'suspend') };
    seen['ownButtons'] = ['suspend', 'unsuspend', 'delete'].filter((act) => buttonIn(own, act));
    W.close();
  });

  test('the page says an open session lasts up to an hour', () => {
    expect(seen['main']).toMatch(/session lasts until it expires, up to an hour/);
  });
  test('an account has Suspend and Delete…', () => {
    expect(seen['p1Buttons']).toEqual(['suspend', 'suspend-for', 'delete']);
  });
  test('Suspend: for a day, a week, or until lifted', () => {
    expect(seen['p1Picker']).toBe('For a day|For a week|Until lifted');
  });
  test('a suspended account says until when, and has Lift suspension', () => {
    expect(seen['p2']).toMatchObject({ lift: true, suspend: false });
    expect(seen['p2']).toHaveProperty('text', expect.stringMatching(/Suspended until \d{4}-\d{2}-\d{2}/) as unknown);
  });
  test("the Overlord's own account has neither", () => {
    expect(seen['ownButtons']).toEqual([]);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('suspending and lifting', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage();
    const { S, calls, doc, W } = page;
    errs = page.errs;
    const p1 = (): HTMLTableRowElement | null => accountRow(doc, 'p1');
    buttonIn(p1(), 'suspend')?.click();
    await wait(100);
    seen['day'] = { called: calls.includes('rpc:account_suspend'), aDayOn: near(suspendedUntil(S, 'p1'), DAY) };
    seen['dayShown'] = { text: textOf(p1()), lift: !!buttonIn(p1(), 'unsuspend') };
    buttonIn(p1(), 'unsuspend')?.click();
    await wait(100);
    seen['lifted'] = { called: calls.includes('rpc:account_unsuspend'), until: suspendedUntil(S, 'p1') ?? null };
    seen['liftedShown'] = { text: textOf(p1()), suspend: !!buttonIn(p1(), 'suspend') };
    const pickWeek = pickerIn(p1());
    if (pickWeek) pickWeek.value = 'week';
    buttonIn(p1(), 'suspend')?.click();
    await wait(100);
    seen['week'] = near(suspendedUntil(S, 'p1'), 7 * DAY);
    buttonIn(p1(), 'unsuspend')?.click();
    await wait(100);
    const pickLifted = pickerIn(p1());
    if (pickLifted) pickLifted.value = 'lifted';
    buttonIn(p1(), 'suspend')?.click();
    await wait(100);
    seen['untilLifted'] = new Date(suspendedUntil(S, 'p1') ?? 0).getTime() > Date.now() + 90 * 365 * DAY;
    seen['untilLiftedShown'] = textOf(p1());
    W.close();
  });

  test('Suspend for a day calls account_suspend, ending a day from now', () => {
    expect(seen['day']).toEqual({ called: true, aDayOn: true });
  });
  test('and the account shows Suspended', () => {
    expect(seen['dayShown']).toMatchObject({ lift: true });
    expect(seen['dayShown']).toHaveProperty('text', expect.stringMatching(/Suspended until/) as unknown);
  });
  test('Lift suspension calls account_unsuspend', () => {
    expect(seen['lifted']).toEqual({ called: true, until: null });
  });
  test('and the account can be suspended again', () => {
    expect(seen['liftedShown']).toMatchObject({ suspend: true });
    expect(seen['liftedShown']).not.toHaveProperty('text', expect.stringMatching(/Suspended/) as unknown);
  });
  test('for a week ends a week from now', () => {
    expect(seen['week']).toBe(true);
  });
  test('until lifted passes no end (the database stores a hundred years)', () => {
    expect(seen['untilLifted']).toBe(true);
  });
  test('and shows as Suspended until lifted', () => {
    expect(seen['untilLiftedShown']).toMatch(/Suspended until lifted/);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('deleting an account', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage();
    const { S, calls, doc, W } = page;
    errs = page.errs;
    buttonIn(accountRow(doc, 'p5'), 'delete')?.click();
    await wait(50);
    const panel = doc.getElementById('delete-panel');
    seen['panel'] = !!panel;
    seen['panelText'] = textOf(panel);
    const typed = doc.querySelector<HTMLInputElement>('#delete-typed') ?? doc.createElement('input');
    const confirm = doc.querySelector<HTMLButtonElement>('#delete-confirm');
    const go = confirm ?? doc.createElement('button');
    seen['disabledAtFirst'] = !!confirm && go.disabled;
    typeInto(page, typed, 'p1@example.test');
    seen['disabledByAnotherEmail'] = go.disabled;
    go.click();
    await wait(50);
    seen['deletedTooSoon'] = calls.includes('rpc:account_delete');
    typeInto(page, typed, '  P5@Example.test ');
    seen['enabledByItsOwnEmail'] = !go.disabled;
    go.click();
    await wait(100);
    seen['deleted'] = { called: calls.includes('rpc:account_delete'), gone: !S.accounts.some((a) => a.id === 'p5') };
    seen['listed'] = !!accountRow(doc, 'p5');
    seen['msg'] = textOf(doc.getElementById('msg'));
    seen['realm'] = S.realms.find((r) => r.id === 's2')?.user_id ?? null;
    seen['injected'] = doc.getElementById('kc-injected') !== null;
    W.close();
  });

  test("Delete… opens a panel that says it can't be undone", () => {
    expect(seen['panel']).toBe(true);
    expect(seen['panelText']).toMatch(/can't be undone/);
  });
  test('and says what goes and what stays', () => {
    expect(seen['panelText']).toMatch(/Goes: their sign-in, their profile/);
    expect(seen['panelText']).toMatch(/Stays: their finished games/);
  });
  test('Delete is disabled until the email is typed', () => {
    expect(seen['disabledAtFirst']).toBe(true);
  });
  test("another email doesn't enable it", () => {
    expect(seen['disabledByAnotherEmail']).toBe(true);
  });
  test('and clicking it does nothing', () => {
    expect(seen['deletedTooSoon']).toBe(false);
  });
  test("the account's own email enables it", () => {
    expect(seen['enabledByItsOwnEmail']).toBe(true);
  });
  test('Delete calls account_delete', () => {
    expect(seen['deleted']).toEqual({ called: true, gone: true });
  });
  test('the account leaves the list, and the page says so', () => {
    expect(seen['listed']).toBe(false);
    expect(seen['msg']).toMatch(/account is deleted/);
  });
  test('its finished game keeps its realm, with no account', () => {
    expect(seen['realm']).toBeNull();
  });
  test('what people wrote is shown as text', () => {
    expect(seen['injected']).toBe(false);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('a deletion refused', () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheOverlordPage();
    const { S, doc, W } = page;
    errs = page.errs;
    buttonIn(accountRow(doc, 'p1'), 'delete')?.click();
    await wait(50);
    const typed = doc.querySelector<HTMLInputElement>('#delete-typed') ?? doc.createElement('input');
    typeInto(page, typed, 'p1@example.test');
    doc.querySelector<HTMLElement>('#delete-confirm')?.click();
    await wait(100);
    seen['msg'] = textOf(doc.getElementById('msg'));
    seen['stays'] = S.accounts.some((a) => a.id === 'p1') && !!accountRow(doc, 'p1');
    buttonIn(accountRow(doc, 'gm1'), 'delete')?.click();
    await wait(50);
    seen['gmPanel'] = textOf(doc.getElementById('delete-panel'));
    seen['revokePanel'] = !!doc.getElementById('revoke-panel');
    W.close();
  });

  test('a refused deletion shows why (playing in a running game)', () => {
    expect(seen['msg']).toMatch(/plays in an unfinished game: suspend it instead/);
  });
  test('and the account stays', () => {
    expect(seen['stays']).toBe(true);
  });
  test('a GM with an unfinished game is told to hand it over first', () => {
    expect(seen['gmPanel']).toMatch(/run 1 unfinished game: hand it over first/);
  });
  test('one panel at a time', () => {
    expect(seen['revokePanel']).toBe(false);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});
