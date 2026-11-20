// The way in for the tests (plan P1-17, Decision 8; src/db/the-pages-database-client.ts): a Db a test hands a page
// before its scripts run (bootJsdom's opts.db, the fake of tests/lib/fake-db.ts) is the page's own. On each of the four
// pages that read the database, the fake answers an older database while the stand-in client (tests/lib/boot.ts)
// would answer an up-to-date one: the page asks the fake, once, stops with "The game is being updated" and a Reload
// button, and sends its client nothing; the client is still made, once.
// The version guard on each page (P0-34; src/db/kc-db-guard.ts): the fake up to date (the newest migration in the
// repo), the page asks it its version before anything else, then starts. Until plan P1-14z, with the stop above, the
// script db-guard; the guard's other answers (no kc_db_version, no answer once or twice) are its unit test's,
// tests/unit/the-version-guard-asks-the-db-and-starts-the-page-only-on-a-new-enough-database.test.ts.
// Level 4 (page): the way in is read by the page's own bundle as it loads, before its first call, and the page starts
// or stops on the guard's answer, which only a booted page shows;
// tests/unit/the-pages-database-client-is-made-as-the-page-made-it-and-takes-a-db-a-test-hands-in.test.ts checks the
// function itself.
import { describe, expect, test, vi } from 'vitest';
import { bootJsdom, DB_VERSION, readPage } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const PAGES = [
  'kingdoms-call-gm-portal.html',
  'kingdoms-call-player-portal.html',
  'kingdoms-call-leaderboard.html',
  'kingdoms-call-overlord.html',
];
const OLDER = '20261010000000';
// Each test waits up to 5 s for the page to stop or start: its own limit is longer, so a page that never does fails on
// what it shows, not on the time.
const LONGER_THAN_THE_WAIT = timeLimitGivenAsANumber(10_000);

describe('each page that reads the database takes the Db a test hands it', () => {
  test.for(PAGES)(
    '%s: asks the fake, stops on its older database, and sends its client nothing',
    LONGER_THAN_THE_WAIT,
    async (page) => {
      const fake = makeAFakeDb([OLDER]);
      const clientCalls: string[] = [];
      let made = 0;
      const dom = bootJsdom(readPage(page), {
        supabase: {
          createClient: () => {
            made++;
            return {};
          },
        },
        db: fake.db,
        dbCalls: clientCalls,
        url: 'https://example.org/' + page,
        setup(w) {
          w.console.warn = () => undefined;
          w.console.log = () => undefined;
          w.console.error = () => undefined;
        },
      });
      try {
        const spinner = (): string => String(dom.window.eval("document.getElementById('spinner').textContent"));
        await vi.waitFor(
          () => {
            expect(spinner()).toMatch(/being updated/);
          },
          { timeout: 5000, interval: 20 },
        );
        expect(spinner()).toContain(`database ${OLDER}`);
        expect(dom.window.eval("document.getElementById('spinner').style.display"), 'the spinner still shown').not.toBe(
          'none',
        );
        expect(
          dom.window.eval(
            "[...document.getElementById('spinner').querySelectorAll('button')].some(b => /Reload/.test(b.textContent))",
          ),
        ).toBe(true);
        expect(fake.calls).toEqual(['rpc:kc_db_version']);
        expect(clientCalls).toEqual([]);
        expect(made).toBe(1);
      } finally {
        dom.window.close();
      }
    },
  );

  test.for(PAGES)(
    '%s: up to date, it asks its version before anything else, then starts',
    LONGER_THAN_THE_WAIT,
    async (page) => {
      const fake = makeAFakeDb([DB_VERSION]);
      const dom = bootJsdom(readPage(page), {
        supabase: { createClient: () => ({}) },
        db: fake.db,
        url: 'https://example.org/' + page,
        setup(w) {
          w.console.warn = () => undefined;
          w.console.log = () => undefined;
          w.console.error = () => undefined;
        },
      });
      try {
        const spinnerShown = (): string => String(dom.window.eval("document.getElementById('spinner').style.display"));
        await vi.waitFor(
          () => {
            expect(spinnerShown()).toBe('none');
          },
          { timeout: 5000, interval: 20 },
        );
        expect(fake.calls[0]).toBe('rpc:kc_db_version');
        expect(fake.calls.filter((call) => call === 'rpc:kc_db_version')).toEqual(['rpc:kc_db_version']);
      } finally {
        dom.window.close();
      }
    },
  );
});
