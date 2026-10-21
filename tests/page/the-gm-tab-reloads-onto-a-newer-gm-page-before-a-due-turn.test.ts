// The GM tab reloads onto a newer GM page before a due turn (plan P1-06c, Decisions 8 to 10). A GM tab left open keeps
// the engine it loaded; when an automatic turn is due, the watcher asks refreshIfNewerBuild (src/ui/gm/auto-turn.ts)
// first, which reads version.json afresh (src/ui/shared/a-newer-version-of-this-page.ts). It reloads the tab only
// when version.json names another fingerprint for the GM page than the page's own (its kc-page-version meta), and only
// once this page has known of it for 10 minutes: GitHub's cache can hand out the old page for 10 minutes after a deploy.
// - the same fingerprint: no reload; another, first seen now or 9 minutes 59 seconds ago: no reload; 10 minutes: one;
// - never twice for one game and turn (the sessionStorage guard);
// - a failed fetch, an error answer or an answer that isn't version.json: no reload, and no console.error.
// Level 4 (page): it reads the booted page's metas, address and session storage, with fetch and the clock stood in.
// A lower level can't: the decision is the page's, from its own HTML. The page boots signed out, on a stand-in client
// that answers "no session" (the GM's games aren't needed: the test calls refreshIfNewerBuild as the watcher does).
import { expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';

const GM = 'kingdoms-call-gm-portal.html';
const START = Date.parse('2026-10-22T10:00:00Z');
const MINUTE = 60_000;

/** A Supabase client with nobody signed in: every read answers nothing. */
function signedOutClient(): unknown {
  const nothing = () => Promise.resolve({ data: null, error: null });
  const query: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'update', 'insert', 'upsert', 'delete'])
    query[m] = () => query;
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

interface Tab {
  W: PageWindow;
  /** This page's fingerprint, from its kc-page-version meta. */
  mine: string;
  /** What fetch answers next (version.json naming `fingerprint` for the GM page), and the page's clock. */
  answer: (fingerprint: string) => () => Promise<Answer>;
  set: (next: () => Promise<Answer>) => void;
  at: (ms: number) => void;
  /** Every fetch the page made, and every reload it scheduled. */
  fetched: string[];
  reloads: string[];
  errors: string[];
  /** The watcher's call before a due turn: true when the tab reloads. */
  refresh: (game: string, turn: number) => Promise<boolean>;
  status: () => string;
}

async function bootTab(): Promise<Tab> {
  const fetched: string[] = [];
  const reloads: string[] = [];
  const errors: string[] = [];
  let now = START;
  let next: () => Promise<Answer> = () => Promise.reject(new Error('no answer set'));
  const dom = bootJsdom(readPage(GM), {
    supabase: { createClient: signedOutClient },
    url: `https://example.org/kingdoms-call/${GM}`,
    setup(w) {
      const clock = w['Date'] as { now: () => number };
      clock.now = () => now;
      w['fetch'] = (url: unknown, init?: { cache?: string }) => {
        fetched.push(`${String(url)} ${init?.cache ?? ''}`);
        return next();
      };
      const setTimeoutOfThePage = w['setTimeout'] as (f: () => void, ms?: number) => number;
      // The reload is scheduled 400 ms on (jsdom can't navigate): recorded, not run.
      w['setTimeout'] = (f: () => void, ms?: number) => {
        if (ms === 400) {
          reloads.push(String(f));
          return 0;
        }
        return setTimeoutOfThePage(f, ms);
      };
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.onunhandledrejection = (e) => errors.push(String(e.reason));
      w.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  const W = dom.window;
  await new Promise((r) => setTimeout(r, 900));
  const mine = String(W.eval('document.querySelector(\'meta[name="kc-page-version"]\').content'));
  const answer = (fingerprint: string) => () =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          commit: 'c0ffee1234567890c0ffee1234567890c0ffee12',
          time: '2026-10-22T09:55:00+13:00',
          pages: { 'index.html': '000000000000', [GM]: fingerprint },
        }),
    });
  return {
    W,
    mine,
    answer,
    set: (n) => {
      next = n;
    },
    at: (ms) => {
      now = START + ms;
    },
    fetched,
    reloads,
    errors,
    refresh: async (game, turn) =>
      (await W.eval(`refreshIfNewerBuild({ id: '${game}', turn: ${String(turn)}, name: 'The Long Winter' })`)) === true,
    status: () => String(W.eval("document.getElementById('auto-turn-status').textContent")),
  };
}

test('the page knows its own fingerprint, the one version.json names for it', async () => {
  const t = await bootTab();
  expect(t.mine).toMatch(/^[0-9a-f]{12}$/);
  expect(t.W.eval('document.querySelector(\'meta[name="kc-build"]\').content')).toMatch(/^([0-9a-f]{40}|unknown)$/);
  expect(t.errors).toEqual([]);
  t.W.close();
});

test('the same GM page in version.json: no reload, however long it has been', async () => {
  const t = await bootTab();
  t.set(t.answer(t.mine));
  expect(await t.refresh('G1', 3)).toBe(false);
  t.at(60 * MINUTE);
  expect(await t.refresh('G1', 3)).toBe(false);
  expect(t.fetched).toEqual(['version.json no-store', 'version.json no-store']);
  expect(t.reloads).toEqual([]);
  expect(t.errors).toEqual([]);
  t.W.close();
});

test('another GM page: a reload once it has been known for 10 minutes, and only once for a game and turn', async () => {
  const t = await bootTab();
  t.set(t.answer('aaaaaaaaaaaa'));
  expect(await t.refresh('G1', 3), 'first seen now').toBe(false);
  t.at(10 * MINUTE - 1000);
  expect(await t.refresh('G1', 3), 'seen 9 minutes 59 seconds ago').toBe(false);
  expect(t.reloads).toEqual([]);
  t.at(10 * MINUTE);
  expect(await t.refresh('G1', 3), 'seen 10 minutes ago').toBe(true);
  expect(t.reloads).toHaveLength(1);
  expect(t.reloads[0]).toContain('location.reload()');
  expect(t.status()).toContain('a newer build of the GM portal is ready (build c0ffee1)');
  expect(t.status()).toContain('reloading this tab before running The Long Winter Turn 3');
  t.at(20 * MINUTE);
  expect(await t.refresh('G1', 3), 'the same game and turn again').toBe(false);
  expect(t.reloads).toHaveLength(1);
  expect(await t.refresh('G1', 4), 'the next turn').toBe(true);
  expect(t.reloads).toHaveLength(2);
  expect(t.errors).toEqual([]);
  t.W.close();
});

test('a third GM page, deployed after the second was seen: it waits its own 10 minutes', async () => {
  const t = await bootTab();
  t.set(t.answer('aaaaaaaaaaaa'));
  expect(await t.refresh('G1', 3)).toBe(false);
  t.at(8 * MINUTE);
  t.set(t.answer('bbbbbbbbbbbb'));
  expect(await t.refresh('G1', 3)).toBe(false);
  t.at(12 * MINUTE);
  expect(await t.refresh('G1', 3), 'the third first seen 4 minutes ago').toBe(false);
  t.at(18 * MINUTE);
  expect(await t.refresh('G1', 3), 'the third first seen 10 minutes ago').toBe(true);
  expect(t.errors).toEqual([]);
  t.W.close();
});

test('version.json unreadable: no reload, and nothing in the console', async () => {
  const t = await bootTab();
  t.set(t.answer('aaaaaaaaaaaa'));
  expect(await t.refresh('G1', 3)).toBe(false);
  t.at(30 * MINUTE);
  const unreadable: [string, () => Promise<Answer>][] = [
    ['the fetch fails', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['an error answer', () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })],
    ['not JSON', () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token')) })],
    ['not version.json', () => Promise.resolve({ ok: true, json: () => Promise.resolve({ pages: 'none' }) })],
  ];
  for (const [what, answer] of unreadable) {
    t.set(answer);
    expect(await t.refresh('G1', 3), what).toBe(false);
  }
  expect(t.fetched).toHaveLength(5);
  expect(t.reloads).toEqual([]);
  expect(t.errors).toEqual([]);
  t.W.close();
});
