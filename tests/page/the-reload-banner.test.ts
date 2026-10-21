// The reload banner (plan P1-06, Decision 11; src/ui/shared/the-reload-banner.ts): when the game has been updated
// while a page is open, a bar at the top says "A new version of Kingdoms Call is ready", with a Reload button. On each
// of the four pages that read the database (the GM portal, the player portal, the Hall of Fame, the Overlord page):
// - the page reads version.json as it loads, then every 5 minutes, never from the browser's cache;
// - no bar while version.json names this page's own fingerprint (its kc-page-version meta), however long it has been;
// - another fingerprint, first seen at a check: no bar then, none at the check 9 minutes after, the bar at the check
//   10 minutes after (GitHub's cache can hand out the old page for 10 minutes after a deploy); one bar, however many
//   checks follow; it never reloads by itself, and its button reloads the page;
// - a failed fetch, an error answer, an answer that isn't JSON or isn't version.json: no bar, and no console.error.
// The rulebooks and the landing page have no data to go stale: they never read version.json.
// Level 4 (page): the bar is DOM on a booted page, from the page's own metas and address, with fetch, the page's clock
// and its 5-minute timer stood in. The decision on plain values is tests/unit/a-newer-version-is-ready.test.ts. The
// pages boot signed out, on a stand-in client that answers "no session" (no stand-in database, lib/stub-db.js: the bar
// needs none).
import { describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';

const START = Date.parse('2026-10-22T10:00:00Z');
const MINUTE = 60_000;
const BANNER_TEXT = "A new version of Kingdoms Call is ready. Save what you're doing, then reload.";
const PAGES_WITH_THE_BANNER = [
  'kingdoms-call-gm-portal.html',
  'kingdoms-call-player-portal.html',
  'kingdoms-call-leaderboard.html',
  'kingdoms-call-overlord.html',
];
const PAGES_WITHOUT_IT = ['index.html', 'kingdoms-call-rules.html', 'kingdoms-call-rules-intro.html'];

/** A Supabase client with nobody signed in: every read answers nothing. */
function signedOutClient(): unknown {
  const nothing = () => Promise.resolve({ data: null, error: null });
  const query: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'gte', 'lte', 'order', 'limit', 'range'])
    query[m] = () => query;
  for (const m of ['update', 'insert', 'upsert', 'delete']) query[m] = () => query;
  query['single'] = nothing;
  query['maybeSingle'] = nothing;
  query['then'] = (resolve: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return {
    from: () => query,
    rpc: nothing,
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    channel: () => ({ on: () => ({ subscribe: () => undefined }) }),
    removeChannel: () => undefined,
  };
}

interface Answer {
  ok: boolean;
  json(): Promise<unknown>;
}

/** The fingerprint the build gave `page`, from its kc-page-version meta. */
function fingerprintOf(html: string, page: string): string {
  const found = /<meta name="kc-page-version" content="([0-9a-f]{12})">/.exec(html)?.[1];
  if (found === undefined) throw new Error(`${page}: no kc-page-version meta`);
  return found;
}

const settle = () => new Promise((r) => setTimeout(r, 50));

interface Tab {
  W: PageWindow;
  /** This page's fingerprint, from its kc-page-version meta. */
  mine: string;
  /** version.json naming `fingerprint` for this page. */
  naming: (fingerprint: string) => () => Promise<Answer>;
  /** What fetch answers from now on. */
  answer: (next: () => Promise<Answer>) => void;
  /** The page's clock moves to `ms` after the start, and its 5-minute check runs. */
  checkAt: (ms: number) => Promise<void>;
  /** The page's clock moves to `ms` after the start, and the tab is shown again. */
  shownAt: (ms: number) => Promise<void>;
  /** The bar's text and button, or null when there is none; how many bars there are. */
  banner: () => { text: string; button: string } | null;
  banners: () => number;
  /** Clicks the bar's button. */
  clickReload: () => void;
  fetched: string[];
  /** The page's timers of 5 minutes, its reloads (navigations jsdom can't make), its errors. */
  everyFiveMinutes: (() => void)[];
  reloads: string[];
  errors: string[];
}

async function bootTab(page: string, atLoad: (mine: string) => () => Promise<Answer>): Promise<Tab> {
  const html = readPage(page);
  const mine = fingerprintOf(html, page);
  const fetched: string[] = [];
  const everyFiveMinutes: (() => void)[] = [];
  const reloads: string[] = [];
  const errors: string[] = [];
  let now = START;
  let next = atLoad(mine);
  const dom = bootJsdom(html, {
    supabase: { createClient: signedOutClient },
    url: `https://example.org/kingdoms-call/${page}`,
    setup(w) {
      const clock = w['Date'] as { now: () => number };
      clock.now = () => now;
      w['fetch'] = (url: unknown, init?: { cache?: string }) => {
        fetched.push(`${String(url)} ${init?.cache ?? ''}`);
        return next();
      };
      const setIntervalOfThePage = w['setInterval'] as (f: () => void, ms?: number) => number;
      // The 5-minute check: recorded, and run when the test moves the clock on.
      w['setInterval'] = (f: () => void, ms?: number) => {
        if (ms === 5 * MINUTE) {
          everyFiveMinutes.push(f);
          return 0;
        }
        return setIntervalOfThePage(f, ms);
      };
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.onunhandledrejection = (e) => errors.push(String(e.reason));
      w.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  // jsdom can't navigate: location.reload() reports "Not implemented: navigation…" on its console, recorded here.
  dom.virtualConsole.removeAllListeners('jsdomError');
  dom.virtualConsole.on('jsdomError', (e) => {
    if (e.message.includes('navigation')) reloads.push(e.message);
    else errors.push('jsdom: ' + e.message);
  });
  const W = dom.window;
  await new Promise((r) => setTimeout(r, 300));
  const read = (code: string): unknown => W.eval(code);
  return {
    W,
    mine,
    naming: (fingerprint) => () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            commit: 'c0ffee1234567890c0ffee1234567890c0ffee12',
            time: '2026-10-22T09:55:00+13:00',
            pages: { 'index.html': '000000000000', [page]: fingerprint },
          }),
      }),
    answer: (n) => {
      next = n;
    },
    checkAt: async (ms) => {
      now = START + ms;
      for (const f of everyFiveMinutes) f();
      await settle();
    },
    shownAt: async (ms) => {
      now = START + ms;
      read("document.dispatchEvent(new Event('visibilitychange'))");
      await settle();
    },
    banner: () => {
      const found = read(
        "(() => { const b = document.getElementById('kc-reload-banner'); return b && { text: b.querySelector('span').textContent, button: b.querySelector('button').textContent, first: document.body.firstElementChild === b }; })()",
      ) as { text: string; button: string; first: boolean } | null;
      if (found === null) return null;
      expect(found.first, 'the bar is the first thing in the page').toBe(true);
      return { text: found.text, button: found.button };
    },
    banners: () => Number(read("document.querySelectorAll('#kc-reload-banner').length")),
    clickReload: () => {
      read("document.querySelector('#kc-reload-banner button').click()");
    },
    fetched,
    everyFiveMinutes,
    reloads,
    errors,
  };
}

describe.each(PAGES_WITH_THE_BANNER)('%s', (page) => {
  test('version.json names this page as it is: no bar, however long it has been', async () => {
    const t = await bootTab(page, (mine) => () => t.naming(mine)());
    expect(t.fetched, 'one read as the page loads').toEqual(['version.json no-store']);
    expect(t.everyFiveMinutes, 'one 5-minute check').toHaveLength(1);
    for (const minutes of [5, 10, 15, 60, 600]) await t.checkAt(minutes * MINUTE);
    expect(t.fetched).toHaveLength(6);
    expect(t.banner()).toBeNull();
    expect(t.errors).toEqual([]);
    t.W.close();
  });

  test('another version of this page: the bar 10 minutes after the page first saw it, and its button reloads', async () => {
    const t = await bootTab(page, (mine) => () => t.naming(mine)());
    t.answer(t.naming('aaaaaaaaaaaa'));
    await t.checkAt(5 * MINUTE);
    expect(t.banner(), 'first seen now').toBeNull();
    await t.checkAt(10 * MINUTE);
    expect(t.banner(), 'seen 5 minutes ago').toBeNull();
    await t.checkAt(14 * MINUTE + 59_000);
    expect(t.banner(), 'seen 9 minutes 59 seconds ago').toBeNull();
    await t.checkAt(15 * MINUTE);
    expect(t.banner(), 'seen 10 minutes ago').toEqual({ text: BANNER_TEXT, button: 'Reload' });
    await t.checkAt(20 * MINUTE);
    await t.shownAt(22 * MINUTE);
    expect(t.banners(), 'one bar, however many checks follow').toBe(1);
    expect(t.fetched).toHaveLength(7);
    expect(t.reloads, 'it never reloads by itself').toEqual([]);
    t.clickReload();
    expect(t.reloads).toHaveLength(1);
    expect(t.errors).toEqual([]);
    t.W.close();
  });

  test('version.json unreadable: no bar, and nothing in the console', async () => {
    const t = await bootTab(page, () => () => Promise.reject(new TypeError('Failed to fetch')));
    const unreadable: (() => Promise<Answer>)[] = [
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
      () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token')) }),
      () => Promise.resolve({ ok: true, json: () => Promise.resolve({ pages: 'none' }) }),
    ];
    let minutes = 0;
    for (const answer of unreadable)
      for (let i = 0; i < 3; i++) {
        t.answer(answer);
        minutes += 5;
        await t.checkAt(minutes * MINUTE);
      }
    expect(t.fetched).toHaveLength(13);
    expect(t.banner()).toBeNull();
    expect(t.errors).toEqual([]);
    t.W.close();
  });
});

test('a tab shown again reads version.json, at most once a minute', async () => {
  const t = await bootTab('kingdoms-call-player-portal.html', (mine) => () => t.naming(mine)());
  await t.shownAt(30_000);
  expect(t.fetched, 'shown 30 seconds after the last read').toHaveLength(1);
  await t.shownAt(MINUTE);
  expect(t.fetched, 'shown a minute after it').toHaveLength(2);
  expect(t.errors).toEqual([]);
  t.W.close();
});

test.each(PAGES_WITHOUT_IT)('%s has no bar and never reads version.json', async (page) => {
  const fetched: string[] = [];
  const errors: string[] = [];
  const dom = bootJsdom(readPage(page), {
    supabase: { createClient: signedOutClient },
    url: `https://example.org/kingdoms-call/${page}`,
    setup(w) {
      w['fetch'] = (url: unknown) => {
        fetched.push(String(url));
        return Promise.reject(new TypeError('Failed to fetch'));
      };
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  await new Promise((r) => setTimeout(r, 300));
  expect(fetched.filter((u) => u.includes('version.json'))).toEqual([]);
  expect(dom.window.eval("document.getElementById('kc-reload-banner')")).toBeNull();
  expect(errors).toEqual([]);
  dom.window.close();
});
