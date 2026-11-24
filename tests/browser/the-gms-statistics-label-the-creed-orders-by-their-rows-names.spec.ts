// The GM's Statistics tab labels Harvest the Field and Perform Rite by their rows' names (R-189), and a label too long
// for its bar still gives its whole name as its hover text. The bars of "What players order" give each label a column
// 110 px wide that cuts a longer name with an ellipsis (statsBars in src/ui/gm/stats-tab.ts), so a longer name may show
// cut off: the hover text (the label's title) is where the GM reads it whole.
//
// Level: browser (Chromium). The unit case beside the tab's other cards (jsdom) holds the label's words and its title in
// the tab's HTML, handed the rows directly. This spec holds them as the real page renders them: the GM signed in, the
// tab opened, the turn records read from the fake database, the label shown with its words and its hover text, in a
// column the page's CSS lays out no wider than 110 px. jsdom lays nothing out, so it can't hold the column. Whether a
// name fits whole is not held: that depends on the fonts the machine has.
import { expect, test } from '@playwright/test';
import type { TheGameMastersWorldAsData } from '../lib/fake-db.ts';
import { gmPortalSignedIn } from './started.ts';
import { handThePageTheFakeDb } from './the-fake-db-handed-to-chromium.ts';

/** A made-up realm's turn record, of the alignment given: its hero gave each order named, one a phase. */
const aTurnRecordGiving = (playerIndex: number, alignment: string, ...orders: string[]) => ({
  game_id: 'G1',
  turn: 1,
  player_index: playerIndex,
  is_bot: false,
  bot_difficulty: null,
  realm: `Realm ${String(playerIndex)}`,
  race: 'Elf',
  alignment,
  orders: { chars: { c1: { ph: orders.map((a) => ({ a })) } } },
  pre: null,
  post: null,
  outcomes: null,
});

// u0, a Game Master named Test GM, signed in; one game's turn: an Undead realm harvested the field (the Undead's order)
// and a Pagan realm performed the rite (the Pagan's order).
const theGameMastersWorld = (): TheGameMastersWorldAsData => ({
  me: 'u0',
  tables: {
    profiles: [{ id: 'u0', name: 'Test GM' }],
    games: [{ id: 'G1', name: 'A Made-up Game', gm_user_id: 'u0', status: 'active', turn: 2 }],
    game_players: [],
    turn_logs: [],
    turn_events: [
      aTurnRecordGiving(0, 'Undead', 'harvest_field', 'move'),
      aTurnRecordGiving(1, 'Pagan', 'rite', 'move'),
    ],
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
    // the column the page's CSS lays the label out in
    const theColumn = await label.evaluate((el) => el.clientWidth);
    expect(theColumn, `${name}: the label's column`).toBeLessThanOrEqual(110);
  }
  expect(errs, 'page errors').toEqual([]);
});
