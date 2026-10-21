// The GM portal's half of the messaging change (claude_msg_gm_boot_0927.js; a test script until P1-01c). The GM
// portal gained only probeMessaging(), renderMessagingBanner() and two deletes on the game-delete path, so this is a
// boot-and-banner check rather than an engine test: the page must start with 0 page errors, a plain "tables missing"
// message must appear while they are missing (since P0-17 it carries no SQL to paste: migrations are applied by the
// deploy) and vanish once they exist, and deleteGame must clear a game's dispatches BEFORE it removes the games row
// (after which the delete policy would no longer let anyone touch them).
import { expect, test } from '@playwright/test';
import { routeExternal } from '../lib/boot.js';
import { browserSource } from '../lib/stub-db.js';
import { gmPortalSignedIn } from './started.ts';

test.use({ viewport: { width: 1500, height: 950 } });

test('the GM portal starts, reports missing messaging tables plainly, and deletes dispatches before the game', async ({
  page,
}) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    // Every error counts (P1-06c took out the auto-turn watcher's request for the unpublished data file, and its 404).
    if (m.type() === 'error') errs.push('console.error: ' + m.text());
  });
  await routeExternal(page, browserSource.messaging);
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
  await page.evaluate('window.__DB.reset()');
  await page.evaluate('probeMessaging()');
  await expect.poll(banner, { message: 'the banner is shown even though the tables exist' }).toBe('');
  expect.soft(await page.evaluate('_kcHasMsg'), '_kcHasMsg is not true with the tables present').toBe(true);

  // tables missing → a plain error message naming them, with no SQL to paste
  await page.evaluate("window.__DB.hide('game_messages')");
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
  await page.evaluate("(window.__DB.show('game_messages'), probeMessaging())");

  // deleteGame must clear dispatches BEFORE the games row goes
  await page.evaluate(`(()=>{
    window.__DB.reset();
    window.__DB.db.games.push({id:'G1',name:'Doomed',gm_user_id:'u0',status:'active',turn:2});
    window.__DB.db.game_players.push({id:'gp0',game_id:'G1',player_index:0,user_id:'u0',display_name:'A'});
    window.__DB.inject({game_id:'G1',from_index:0,to_indexes:[],body:'to be swept away'});
    window.__DB.db.game_message_reads.push({game_id:'G1',player_index:0,user_id:'u0',reads:{public:1}});
    window.confirm=()=>true;
    if(!document.getElementById('detail-msg')){ const d=document.createElement('div'); d.id='detail-msg'; document.body.appendChild(d); }
  })()`);
  await page.evaluate('probeMessaging()');
  await page.evaluate("deleteGame('G1')");
  const left = () =>
    page.evaluate<{ msgs: number; reads: number; games: number }>(
      '({msgs:window.__DB.db.game_messages.length,reads:window.__DB.db.game_message_reads.length,games:window.__DB.db.games.length})',
    );
  await expect
    .poll(left, { message: 'deleteGame left dispatch rows, read-mark rows or the game itself behind' })
    .toEqual({ msgs: 0, reads: 0, games: 0 });

  expect(errs, 'page errors').toEqual([]);
});
