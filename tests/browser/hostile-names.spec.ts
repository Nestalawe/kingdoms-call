// Hostile names in Chromium (P0-19): the Chromium half of the hostile-name tests (tests/hostile-*.test.js are the
// jsdom half; until P1-01c each script ran both). Every mode and screen of each page's tour (lib/screens.js), staged
// with hostile names (lib/hostile.js), in a real browser where a broken image really fires its onerror: no screen may
// set window.__kcPwned or make an element from a name, and a mode runs with no page error (one staged as a page that
// can't start must fail to start). One test per page and mode, so they run side by side.
import { expect, test } from '@playwright/test';
import { names } from '../lib/hostile.js';
import { runChromium, TOURS } from '../lib/screens.js';

for (const tourName of ['overlord', 'leaderboard', 'gmPortal', 'playerPortal'] as const) {
  const tour = TOURS[tourName];
  const W = tour.world(names('hostile'));
  for (const [mode, m] of Object.entries(tour.modes)) {
    test(`${tour.page} (${mode}): names show as text on every screen`, async ({ browser, baseURL }) => {
      const problems: string[] = [];
      const errs = await runChromium(
        browser,
        tour,
        mode,
        W,
        async (label, p) => {
          // cleared after each screen, so a failure names the screen that set it
          const r = await p.evaluate(() => {
            const w = window as unknown as { __kcPwned?: unknown };
            const pwned = !!w.__kcPwned;
            w.__kcPwned = undefined;
            return { pwned, made: document.querySelectorAll('img[onerror],svg[onload],[data-kc-bold]').length };
          });
          if (r.pwned) problems.push(`${label}: window.__kcPwned was set`);
          if (r.made) problems.push(`${label}: ${String(r.made)} element(s) made from a name`);
        },
        { url: String(baseURL) },
      );
      expect.soft(problems, 'screens where a name became markup or code').toEqual([]);
      // A page that can't start (a mode with bootError) must say so; every other mode runs with no page error at all.
      expect(
        errs.length > 0,
        m.bootError ? 'the page fails to start, as staged' : `page errors: ${errs.join(' | ')}`,
      ).toBe(!!m.bootError);
    });
  }
}
