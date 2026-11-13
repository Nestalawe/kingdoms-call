// The GM portal's half of the messaging change (claude_msg_gm_boot_0927.js; a test script until P1-01c). The GM
// portal gained only probeMessaging(), renderMessagingBanner() and two deletes on the game-delete path, so this is a
// boot-and-banner check rather than an engine test: the page must start with 0 page errors, a plain "tables missing"
// message must appear while they are missing (since P0-17 it carries no SQL to paste: migrations are applied by the
// deploy) and vanish once they exist, and deleteGame must clear a game's dispatches BEFORE it removes the games row
// (after which the delete policy would no longer let anyone touch them).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// GM portal boots; while the dispatches tables are missing, a plain error message (no SQL to paste, since P0-17)
// appears, and it goes once they exist; deleting a game clears its dispatches first; any console error fails it (P1-06c
// took out the one it let through, the data file's 404). (The script's optional folder and footer-stamp arguments,
// never given in `npm test`, weren't brought over.)
import { expect, test } from '@playwright/test';
import type { TheGameMastersWorld, TheGameMastersWorldAsData } from '../lib/fake-db.ts';
import { gmPortalSignedIn } from './started.ts';
import { handThePageTheFakeDb } from './the-fake-db-handed-to-chromium.ts';

// The GM's world the page is handed (tests/lib/fake-db.ts, as the stand-in held it): u0, a Game Master named Test GM,
// signed in; no game.
const theGameMastersWorld = (): TheGameMastersWorldAsData => ({
  me: 'u0',
  tables: {
    profiles: [{ id: 'u0', name: 'Test GM' }],
    games: [],
    game_players: [],
    turn_logs: [],
    turn_events: [],
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

// The world as the page was handed it, afresh (the stand-in's reset): every table emptied but Test GM and the offer
// accepted, and no table missing.
const theWorldAfresh = () => {
  const world = (window as unknown as { kcTheFakesWorld: TheGameMastersWorld }).kcTheFakesWorld;
  for (const rows of Object.values(world.tables)) rows.length = 0;
  world.tables.profiles.push({ id: 'u0', name: 'Test GM' });
  world.tables.game_masters.push({ user_id: 'u0', accepted_at: '2026-10-01T00:00:00Z' });
  world.missingTables.clear();
};

test('the GM portal starts, reports missing messaging tables plainly, and deletes dispatches before the game', async ({
  page,
}) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    // Every error counts (P1-06c took out the auto-turn watcher's request for the unpublished data file, and its 404).
    if (m.type() === 'error') errs.push('console.error: ' + m.text());
  });
  await handThePageTheFakeDb(page, theGameMastersWorld());
  await page.goto('/kingdoms-call-gm-portal.html');
  await gmPortalSignedIn(page);

  expect
    .soft(
      await page.evaluate(() => {
        const s = document.getElementById('spinner');
        return !s || s.style.display === 'none' || s.offsetParent === null;
      }),
      'GM portal spinner still showing',
    )
    .toBe(true);
  for (const n of ['probeMessaging', 'renderMessagingBanner', 'deleteGame'])
    expect
      .soft(
        await page.evaluate((x) => typeof (window as unknown as Record<string, unknown>)[x] === 'function', n),
        'missing function ' + n,
      )
      .toBe(true);
  expect
    .soft(await page.evaluate('typeof KC_MSG_SQL'), 'KC_MSG_SQL is still defined (P0-17 retired the SQL banners)')
    .toBe('undefined');
  expect
    .soft(
      await page.evaluate(() => document.getElementById('msg-messaging') !== null),
      'the #msg-messaging banner slot is missing',
    )
    .toBe(true);

  const banner = () => page.evaluate(() => document.getElementById('msg-messaging')?.innerHTML ?? '');

  // tables present → no banner
  await page.evaluate(theWorldAfresh);
  await page.evaluate('probeMessaging()');
  await expect.poll(banner, { message: 'the banner is shown even though the tables exist' }).toBe('');
  expect.soft(await page.evaluate('_kcHasMsg'), '_kcHasMsg is not true with the tables present').toBe(true);

  // tables missing → a plain error message naming them, with no SQL to paste
  await page.evaluate(() => {
    (window as unknown as { kcTheFakesWorld: TheGameMastersWorld }).kcTheFakesWorld.missingTables.add('game_messages');
  });
  await page.evaluate('probeMessaging()');
  await expect
    .poll(banner, { message: 'the missing-table message did not appear' })
    .toMatch(/Player messaging not active/);
  const html = await banner();
  expect.soft(html, 'the message is not a plain error naming the missing table').toContain('msg-error');
  expect.soft(html, 'the message is not a plain error naming the missing table').toContain('game_messages');
  expect
    .soft(html, 'the message still carries SQL to paste')
    .not.toMatch(/create table|create policy|SQL Editor|<textarea/i);
  expect.soft(await page.evaluate('_kcHasMsg'), '_kcHasMsg is not false with a table missing').toBe(false);
  await page.evaluate(() => {
    (window as unknown as { kcTheFakesWorld: TheGameMastersWorld }).kcTheFakesWorld.missingTables.delete(
      'game_messages',
    );
  });
  await page.evaluate('probeMessaging()');

  // deleteGame must clear dispatches BEFORE the games row goes
  await page.evaluate(theWorldAfresh);
  await page.evaluate(() => {
    const { tables } = (window as unknown as { kcTheFakesWorld: TheGameMastersWorld }).kcTheFakesWorld;
    tables.games.push({ id: 'G1', name: 'Doomed', gm_user_id: 'u0', status: 'active', turn: 2 });
    tables.game_players.push({ id: 'gp0', game_id: 'G1', player_index: 0, user_id: 'u0', display_name: 'A' });
    // a dispatch written by somebody else, straight into the table, as their browser would
    tables.game_messages.push({
      id: 1,
      created_at: new Date().toISOString(),
      scope: 'public',
      turn: null,
      game_id: 'G1',
      from_index: 0,
      to_indexes: [],
      body: 'to be swept away',
    });
    tables.game_message_reads.push({ game_id: 'G1', player_index: 0, user_id: 'u0', reads: { public: 1 } });
  });
  await page.evaluate(`(()=>{
    window.confirm=()=>true;
    if(!document.getElementById('detail-msg')){ const d=document.createElement('div'); d.id='detail-msg'; document.body.appendChild(d); }
  })()`);
  await page.evaluate('probeMessaging()');
  await page.evaluate("deleteGame('G1')");
  const left = () =>
    page.evaluate<{ msgs: number; reads: number; games: number }>(
      '({msgs:kcTheFakesWorld.tables.game_messages.length,reads:kcTheFakesWorld.tables.game_message_reads.length,games:kcTheFakesWorld.tables.games.length})',
    );
  await expect
    .poll(left, { message: 'deleteGame left dispatch rows, read-mark rows or the game itself behind' })
    .toEqual({ msgs: 0, reads: 0, games: 0 });

  expect(errs, 'page errors').toEqual([]);
});
