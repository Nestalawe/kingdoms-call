// Every page of the built site starts in jsdom (its bundle loaded, the database stood in by the fake of
// tests/lib/fake-db.ts, up to date and empty) with no uncaught error, no unhandled rejection and no console.error, in the
// second it is given. Until plan P1-14z the script boot-pages. The real-browser boot of the three portal pages is
// tests/browser/chromium-boot.spec.ts.
// Level 4 (page): a page's start is its built bundle run in a window, which only a booted page shows.
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, SITE } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import { itsStackOr } from '../lib/screens.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const PAGES = fs
  .readdirSync(SITE)
  .filter((f) => f.endsWith('.html'))
  .sort();

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('the site has pages to boot', () => {
  expect(PAGES.length).toBeGreaterThan(0);
});

// The page's start and the second it is given: about five times the longest a page took alone on a laptop.
test.for(PAGES)(
  '%s starts with no error, rejection or console.error',
  timeLimitGivenAsANumber(10_000),
  async (page) => {
    const errors: string[] = [];
    // jsdom never fires the page's unhandledrejection: a promise the page leaves rejected reaches Node instead.
    const rejected = (e: unknown): void => {
      errors.push('unhandled rejection: ' + itsStackOr(e, e));
    };
    process.on('unhandledRejection', rejected);
    try {
      const dom = bootJsdom(readPage(page), {
        supabase: { createClient: () => ({}) },
        db: makeAFakeDb([DB_VERSION]).db,
        url: 'https://example.org/' + page,
        setup(w) {
          w.addEventListener('error', (e) => errors.push(itsStackOr(e.error, e.message)));
          w.onunhandledrejection = (e) => errors.push('unhandled rejection: ' + itsStackOr(e.reason, e.reason));
          w.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));
          w.console.warn = () => undefined;
          w.console.log = () => undefined;
        },
      });
      await wait(1000);
      dom.window.close();
    } finally {
      process.off('unhandledRejection', rejected);
    }
    expect(errors).toEqual([]);
  },
);
