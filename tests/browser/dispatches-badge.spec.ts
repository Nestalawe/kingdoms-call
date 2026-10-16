// 2026-10-09 (Toby item 2) — the unread count on the left panel's ✉ Dispatches tab shows promptly.
// A dispatch that arrived while the player was on the Map or the Report waited for the slow poll
// (one tick in four, ≈32s) before the count appeared, so it looked as if the tab never showed one.
// Now switching view (Map → Report → …) or coming back to the browser tab asks at once.
// Layout and timers in a real browser, so a Chromium page test (level 4). Made-up realms; no database.
//
// "At once" is within the time the script gave it: each count must show within that, not at the slow poll.
import { expect, test } from '@playwright/test';
import { routeExternal } from '../lib/boot.js';
import { browserSource } from '../lib/stub-db.js';
import { playerPortalSignedIn } from './started.ts';

test.use({ viewport: { width: 1400, height: 900 } });

// Run in the page as the script had it: two realms in an active game, nobody has read anything.
const STAGE = `(()=>{ const D=window.__DB; D.reset();
  const report={playerIndex:0,playerName:'Aldoria',turnNumber:2,kingdom:{color:'#b8433a',alignment:'Neutral',race:'Human',gold:20},
    diplomacy:{alliancesAllowed:true,known:[{index:1,name:'Bruneth',color:'#6fbf73',relation:'neutral'}]},characters:[],provinces:[]};
  D.db.games.push({id:'G1',name:'Test',gm_user_id:'gm1',status:'active',turn:2,max_players:2});
  [0,1].forEach(i=>D.db.game_players.push({id:'gp'+i,game_id:'G1',player_index:i,user_id:'u'+i,display_name:i?'Bruneth':'Aldoria',
    orders_submitted:false,orders:null,turn_report:JSON.stringify(i?{playerIndex:1}:report)}));
  D.db.game_message_reads.push({game_id:'G1',player_index:0,user_id:'u0',reads:{}}); })()`;

const BADGE = `(()=>{ const b=document.getElementById('desk-msg-badge'), t=document.getElementById('desk-msg-tab');
  const r=b&&b.getBoundingClientRect(); return {txt:(b&&b.textContent)||'', shown:!!t&&t.style.display!=='none'&&!!r&&r.width>0}; })()`;

test('the Dispatches count shows at once on switching view, clears when read, and counts on return', async ({
  page,
}) => {
  const errs: string[] = [];
  await routeExternal(page, browserSource.messaging);
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/kingdoms-call-player-portal.html');
  await playerPortalSignedIn(page);
  await page.evaluate(STAGE);
  await page.evaluate('openReport("gp0")');
  // The report is open with its left panel's Dispatches tab.
  await expect(page.locator('#desk-msg-tab')).toBeVisible();
  const badge = () => page.evaluate<{ txt: string; shown: boolean }>(BADGE);
  expect((await badge()).txt, 'no count before any dispatch has arrived').toBe('');

  // A dispatch arrives; the player moves the left panel from Map to Report.
  await page.evaluate(
    `window.__DB.inject({game_id:'G1',from_index:1,to_indexes:[],body:'Well met, neighbour.',turn:2})`,
  );
  await page.locator('#desk-left .desk-tabs button[data-view="report"]').click();
  await expect
    .poll(badge, { message: 'switching to Report shows the count on the Dispatches tab at once', timeout: 1000 })
    .toEqual({ txt: '1', shown: true });

  // Opening Dispatches reads it; the count goes.
  await page.locator('#desk-msg-tab').click();
  await expect
    .poll(async () => (await badge()).txt, { message: 'opening Dispatches clears the count', timeout: 800 })
    .toBe('');

  // Back to the Map; a private dispatch arrives while the browser tab is in the background.
  await page.locator('#desk-left .desk-tabs button[data-view="map"]').click();
  await page.waitForFunction('_deskLeftView === "map"');
  const n0 = Number((await badge()).txt || 0);
  await page.evaluate(
    `window.__DB.inject({game_id:'G1',from_index:1,to_indexes:[0],body:'A word in private.',turn:2})`,
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect
    .poll(badge, {
      message: `coming back to the browser tab adds the new dispatch to the count at once (${String(n0)} before)`,
      timeout: 1000,
    })
    .toEqual({ txt: String(n0 + 1), shown: true });

  expect(errs, 'page errors').toEqual([]);
});
