// The way in for the tests (plan P1-17, Decision 8; src/db/the-pages-database-client.ts): a Db a test hands a page
// before its scripts run (bootJsdom's opts.db, the fake of tests/lib/fake-db.ts) is the page's own. On each of the four
// pages that read the database, the fake answers an older database while the stand-in client (tests/lib/boot.js)
// would answer an up-to-date one: the page asks the fake, once, stops with "The game is being updated" and a Reload
// button, and sends its client nothing; the client is still made, once.
// Level 4 (page): the way in is read by the page's own bundle as it loads, before its first call, which only a booted
// page shows; tests/unit/the-pages-database-client-is-made-as-the-page-made-it-and-takes-a-db-a-test-hands-in.test.ts
// checks the function itself.
import { describe, expect, test, vi } from 'vitest';
import { bootJsdom, readPage } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

const PAGES = [
  'kingdoms-call-gm-portal.html',
  'kingdoms-call-player-portal.html',
  'kingdoms-call-leaderboard.html',
  'kingdoms-call-overlord.html',
];
const OLDER = '20261010000000';

describe('each page that reads the database takes the Db a test hands it', () => {
  test.for(PAGES)('%s: asks the fake, stops on its older database, and sends its client nothing', async (page) => {
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
  });
});
