// One page's hostile-name tests in jsdom (P0-19), as Vitest tests: every mode and screen of its tour (lib/screens.ts),
// staged with hostile names (lib/hostile.ts). Each page's test file (tests/page/the-*-hostile-names-show-as-text-…)
// calls it once. The tour runs once, in beforeAll, and each check is a test of its own, so the tests are the old
// script's "ok" lines, one for one:
//   - each screen of each mode: nothing became markup or code (lib/hostile.ts's inspect), and window.__kcPwned is unset;
//   - each mode: no page error, or, for a mode staged as a page that can't start (bootError), an error;
//   - the page: each staged name appears as text somewhere, exactly as typed.
// Its Chromium half (window.__kcPwned stays unset, with images really loading and failing) is
// tests/browser/hostile-names.spec.ts.
import { beforeAll, expect, test } from 'vitest';
import { inspect, names } from './hostile.ts';
import { runJsdom, TOURS, type TourName } from './screens.ts';
import { timeLimitGivenAsANumber } from './time-limits.ts';

/** What one screen showed: what it got wrong, and whether it set window.__kcPwned. */
interface WhatAScreenShowed {
  problems: string[];
  pwned: boolean;
}

/** The allowance for one mode's boot (the page's start, up to its tour's bootWait), and for one screen (its step, the
 *  80 ms after it, and the checks): about five times the longest each took alone on a laptop (the player portal's
 *  tour, 109 checks, takes about 19 s). */
const EACH_MODES_BOOT_MS = 3_000;
const EACH_SCREENS_MS = 1_000;

export function testThatEachScreenOfThePagesTourShowsHostileNamesAsText(tourName: TourName): void {
  const tour = TOURS[tourName];
  const W = tour.world(names('hostile'));
  const want = tour.shown(W).filter((s): s is string => Boolean(s));
  const modes = Object.keys(tour.modes);
  // The screens are known before the tour runs: each mode's steps are its labels and the code they run.
  const screens = modes.flatMap((mode) =>
    tour.steps(W, tour.modes[mode] ?? { url: '' }).map(([label], index) => ({ mode, index, label })),
  );
  const shown = new Map<string, WhatAScreenShowed[]>();
  const errors = new Map<string, string[]>();
  const seen = new Set<string>();

  beforeAll(
    async () => {
      for (const mode of modes) {
        const screensOfTheMode: WhatAScreenShowed[] = [];
        shown.set(mode, screensOfTheMode);
        const errs = await runJsdom(tour, mode, W, (_label, doc, w) => {
          const pwned = Boolean(w['__kcPwned']);
          w['__kcPwned'] = undefined; // cleared after each screen, so a failure names the screen that set it
          screensOfTheMode.push({ problems: inspect(doc), pwned });
          const text = doc.body.textContent;
          for (const s of want) if (text.includes(s)) seen.add(s);
        });
        errors.set(mode, errs);
      }
    },
    timeLimitGivenAsANumber(modes.length * EACH_MODES_BOOT_MS + screens.length * EACH_SCREENS_MS).timeout,
  );

  test.for(screens)(`${tour.page} ($mode) $label: names show as text`, ({ mode, index }) => {
    const screen = shown.get(mode)?.[index];
    expect(screen, 'the screen was visited').toBeDefined();
    expect(screen?.problems, 'what became markup or code').toEqual([]);
    expect(screen?.pwned, 'window.__kcPwned was set').toBe(false);
  });

  // A page that can't start (a mode with bootError) must say so; every other mode runs with no page error at all.
  const failsToStart = (mode: string): boolean => Boolean(tour.modes[mode]?.bootError);
  test.for(modes.filter((mode) => !failsToStart(mode)))(`${tour.page} (%s): no page errors`, (mode) => {
    expect(errors.get(mode), 'page errors').toEqual([]);
  });
  test.for(modes.filter(failsToStart))(`${tour.page} (%s): the page fails to start, as staged`, (mode) => {
    expect(errors.get(mode)?.length, 'page errors').toBeGreaterThan(0);
  });

  test(`${tour.page}: each staged name appears somewhere, exactly as typed`, () => {
    expect(want.length, 'the tour stages names').toBeGreaterThan(0);
    expect(
      want.filter((s) => !seen.has(s)).map((s) => s.split(' ')[0]),
      'the staged names not found (each by its field)',
    ).toEqual([]);
  });
}
