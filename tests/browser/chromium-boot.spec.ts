// Real-browser boot of the three portal pages, served from one folder over HTTP exactly as they are deployed
// (claude_lb_chromium_0927.js; a test script until P1-01c). supabase-js is answered with a stand-in that has an empty
// database, so no network call leaves the machine. Checks: the spinner goes, there are no page errors, the links are
// present and point at the right files, the GM portal's leaderboard functions exist and its boot order is intact, and
// its dice seed themselves from the browser's crypto, as on the live site (P1-07).
import { expect, test, type Page } from '@playwright/test';
import { routeExternal } from '../lib/boot.js';
import { browserSource } from '../lib/stub-db.js';
import { signedOut, spinnerGone } from './started.ts';

async function open(page: Page, name: string, started: (page: Page) => Promise<void>): Promise<string[]> {
  const errs: string[] = [];
  await page.addInitScript(browserSource.null);
  await routeExternal(page, '');
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text());
  });
  await page.goto('/' + name);
  await started(page);
  const spinner = await page.evaluate(() => document.getElementById('spinner')?.style.display ?? 'none');
  expect.soft(spinner, 'spinner still visible — the page did not boot').toBe('none');
  return errs;
}

const links = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('a')].map((a) => `${String(a.getAttribute('href'))}|${a.textContent.trim()}`),
  );

test('the GM portal boots, links to the GM leaderboard and has its leaderboard functions', async ({ page }) => {
  const errs = await open(page, 'kingdoms-call-gm-portal.html', signedOut);
  const l = await links(page);
  expect
    .soft(
      l.some((x) => x.startsWith('kingdoms-call-leaderboard.html?gm=1|')),
      'no ?gm=1 Leaderboard link',
    )
    .toBe(true);
  // Each name as code, so tests/static/page-globals.test.ts reads it: the page must put it on window (P1-09d).
  const fns = await page.evaluate(`[typeof buildGameRecords, typeof writeGameRecord, typeof backfillGameRecords,
    typeof probeLeaderboard, typeof renderLeaderboardBanner]`);
  expect.soft(fns, 'leaderboard functions not defined').toEqual(Array<string>(5).fill('function'));
  const tbl = await page.evaluate(`({sql:typeof KC_LB_SQL, sea:(typeof _LB_SEA!=='undefined')&&_LB_SEA.size>0,
    banner:!!document.getElementById('msg-leaderboard')})`);
  expect.soft(tbl, 'leaderboard constants / banner slot missing, or KC_LB_SQL still defined').toEqual({
    sql: 'undefined',
    sea: true,
    banner: true,
  });
  // Served as deployed, the page is given no seed: its dice (kcRng, P1-07) seed themselves from the browser's crypto.
  const dice = await page.evaluate<{ seed: string; draws: number[] }>(
    `({seed:typeof KC_RNG_SEED, draws:[kcRng(),kcRng(),kcRng()]})`,
  );
  expect.soft(dice.seed, 'the deployed page was given a seed').toBe('undefined');
  expect
    .soft(dice.draws.every((x) => x >= 0 && x < 1) && new Set(dice.draws).size === 3, String(dice.draws))
    .toBe(true);
  expect(errs, 'page errors').toEqual([]);
});

test('the player portal boots and links to the leaderboard and the rules', async ({ page }) => {
  const errs = await open(page, 'kingdoms-call-player-portal.html', signedOut);
  const l = await links(page);
  expect
    .soft(
      l.some((x) => x.startsWith('kingdoms-call-leaderboard.html|') && /Leaderboard/.test(x)),
      'no Leaderboard link',
    )
    .toBe(true);
  expect
    .soft(
      l.some((x) => x.startsWith('kingdoms-call-rules.html|')),
      'Rules link lost',
    )
    .toBe(true);
  expect
    .soft(
      l.some((x) => /kingdoms-call-leaderboard\.html\?gm=1/.test(x)),
      'link must NOT carry ?gm=1',
    )
    .toBe(false);
  expect(errs, 'page errors').toEqual([]);
});

test('the leaderboard boots with its tabs, empty-board message and filters', async ({ page }) => {
  const errs = await open(page, 'kingdoms-call-leaderboard.html', spinnerGone);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.tab-bar button')].map((b) => b.id));
  expect.soft(tabs, 'expected 4 tabs').toHaveLength(4);
  const msg = await page.evaluate(() => document.getElementById('msg')?.innerText ?? '');
  expect.soft(msg, 'empty-board message missing').toMatch(/No finished games|could not be read/);
  const controls = await page.evaluate(() => document.querySelectorAll('.filters select,.filters input').length);
  expect.soft(controls, 'expected 12+ filter controls').toBeGreaterThanOrEqual(12);
  expect(errs, 'page errors').toEqual([]);
});
