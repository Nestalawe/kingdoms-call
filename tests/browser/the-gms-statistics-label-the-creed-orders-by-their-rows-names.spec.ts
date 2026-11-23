// The GM's Statistics tab labels Harvest the Field and Perform Rite by their rows' names (R-189), and a label too long
// for its bar still gives its whole name as its hover text. The bars of "What players order" give each label a column
// 110 px wide that cuts a longer name with an ellipsis (statsBars in src/ui/gm/stats-tab.ts), so a longer name may show
// cut off: the hover text (the label's title) is where the GM reads it whole.
//
// Level: browser (Chromium). The unit case beside the tab's other cards (jsdom) holds the label's words and its title,
// but jsdom lays nothing out, so only a browser can measure whether the name fits its column. The spec doesn't pin
// whether it is cut (that depends on the fonts the machine has); it notes the measure, and holds that the label and its
// title both give the whole name, cut or not.
import { expect, test } from '@playwright/test';
import type { TheGameMastersWorldAsData } from '../lib/fake-db.ts';
import { gmPortalSignedIn } from './started.ts';
import { handThePageTheFakeDb } from './the-fake-db-handed-to-chromium.ts';

/** A made-up realm's turn record: its hero gave each order named, one a phase. */
const aTurnRecordGiving = (playerIndex: number, ...orders: string[]) => ({
  game_id: 'G1',
  turn: 1,
  player_index: playerIndex,
  is_bot: false,
  bot_difficulty: null,
  realm: `Realm ${String(playerIndex)}`,
  race: 'Elf',
  alignment: 'Pagan',
  orders: { chars: { c1: { ph: orders.map((a) => ({ a })) } } },
  pre: null,
  post: null,
  outcomes: null,
});

// u0, a Game Master named Test GM, signed in; one game's turn: one realm harvested the field and performed the rite.
const theGameMastersWorld = (): TheGameMastersWorldAsData => ({
  me: 'u0',
  tables: {
    profiles: [{ id: 'u0', name: 'Test GM' }],
    games: [{ id: 'G1', name: 'A Made-up Game', gm_user_id: 'u0', status: 'active', turn: 2 }],
    game_players: [],
    turn_logs: [],
    turn_events: [aTurnRecordGiving(0, 'harvest_field', 'rite', 'move')],
    game_results: [],
    game_records: [],
    game_messages: [],
    game_message_reads: [],
    message_reports: [],
    game_masters: [{ user_id: 'u0', accepted_at: '2026-10-01T00:00:00Z' }],
    site_admins: [],
  },
  missingColumns: [],
  missingTables: [],
  failing: {},
  calls: [],
});

test.use({ viewport: { width: 1500, height: 950 } });

test("the Statistics tab labels Harvest the Field and Perform Rite by their rows' names, whole in their hover text", async ({
  page,
}) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console.error: ' + m.text());
  });
  await handThePageTheFakeDb(page, theGameMastersWorld());
  await page.goto('/kingdoms-call-gm-portal.html');
  await gmPortalSignedIn(page);
  await page.getByRole('button', { name: '📈 Stats' }).click();
  await expect(page.locator('#stats-body')).toContainText('What players order');

  for (const name of ['Harvest the Field', 'Perform Rite']) {
    // the Humans' bar (the first of the card's columns)
    const label = page.locator('#stats-body').locator(`div[title="${name}"]`).first();
    await expect(label, `${name}: no label holds it as its hover text`).toBeVisible();
    await expect(label, `${name}: the label's words`).toHaveText(name);
    // the words' own width, laid out on one line (a range over them), against the column's
    const measure = await label.evaluate((el) => {
      const words = document.createRange();
      words.selectNodeContents(el);
      return { shown: el.clientWidth, whole: Math.ceil(words.getBoundingClientRect().width) };
    });
    expect(measure.shown, `${name}: the label's column`).toBeLessThanOrEqual(110);
    test.info().annotations.push({
      type: 'measure',
      description: `${name}: ${String(measure.whole)} px whole in a ${String(measure.shown)} px column: ${
        measure.whole > measure.shown ? 'cut, with an ellipsis' : 'shown whole'
      }`,
    });
  }
  expect(errs, 'page errors').toEqual([]);
});
