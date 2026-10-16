// 2026-10-09 (Toby items 3 and 4) — the map panel shows the whole map and scrolls when zoomed in.
// An 8×7 map's bottom rows were cut off by the foot of the window, and a zoomed map could not be
// scrolled: the desktop panel switch cleared the map column's inline display:flex, so the column fell
// back to a block, the map grew past the panel (which hides overflow) and never became a scroller.
// Layout only exists in a real browser, so this is a Chromium page test. The report comes from a real
// turn on a made-up 8×7 world (jsdom GM portal, seeded); no database.
import { expect, test, type Page } from '@playwright/test';
import { routeExternal } from '../lib/boot.js';
import { bootScenario } from '../lib/scenario.js';
import { browserSource } from '../lib/stub-db.js';
import { playerPortalSignedIn } from './started.ts';

// The turn is played once per worker. Its page gets the seed the script's (its process's first page) got from
// KC_SEED, whatever else this worker has booted (tests/lib/boot.js).
let played: Promise<Record<string, unknown> | null> | undefined;
function report() {
  played ??= (async () => {
    const sc = await bootScenario({ seed: (Number(process.env['KC_SEED']) >>> 0) + 0x10000 });
    const res = await sc.turn({ realms: 2, cols: 8, rows: 7 });
    return sc.W.buildTurnReport(res.S2, 0);
  })();
  return played;
}

interface Seen {
  phone: boolean;
  hexes: number;
  mapH: number;
  panelH: number;
  fit: number;
  legendInside?: boolean;
  scrollX: boolean;
  scrollY: boolean;
  lastRowReached: boolean;
}

// Run in the page as the script had it: the player's game, with the report as its turn report.
const STAGE = `rep=>{ const D=window.__DB; D.reset();
  D.db.games.push({id:'G1',name:'Test',gm_user_id:'gm1',status:'active',turn:rep.turnNumber||1,max_players:2});
  D.db.game_players.push({id:'gp0',game_id:'G1',player_index:0,user_id:'u0',display_name:'Aldoria',
    orders_submitted:false,orders:null,turn_report:JSON.stringify(rep)}); }`;

// Run in the page as the script had it: shows the map the way a player would, then measures it.
const SHOW_AND_MEASURE = `(async()=>{
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const phone=window.innerWidth<821;
  if(phone) setMobileView('map');
  else { setDeskView('left','report'); await wait(100); setDeskView('left','map'); } // the switch that broke it
  await wait(300);
  const cont=document.getElementById('report-map-container');
  const panel=phone?cont:document.getElementById('desk-left');
  const hexes=[...document.querySelectorAll('#report-map-svg g[data-prov] polygon')];
  const inside=(a,b)=>a.top>=b.top-1&&a.bottom<=b.bottom+1&&a.left>=b.left-1&&a.right<=b.right+1;
  const visible=()=>{ const c=cont.getBoundingClientRect(), pn=panel.getBoundingClientRect();
    return hexes.filter(h=>{ const b=h.getBoundingClientRect(); return inside(b,c)&&inside(b,pn)&&b.bottom<=window.innerHeight+1; }).length; };
  const out={phone,hexes:hexes.length,mapH:cont.clientHeight,panelH:panel.getBoundingClientRect().height,fit:visible()};
  if(!phone){ const lg=(document.getElementById('map-legend')||document.querySelector('#rp-map-col > div:last-child')).getBoundingClientRect(), pn=panel.getBoundingClientRect();
    out.legendInside=lg.bottom<=pn.bottom+1; mapZoom(0.5); mapZoom(0.5); await wait(200); } // zoom to 2×
  out.scrollX=cont.scrollWidth>cont.clientWidth+4; out.scrollY=cont.scrollHeight>cont.clientHeight+4;
  // Scroll to the far corner: the last row must come into view.
  cont.scrollTop=cont.scrollHeight; cont.scrollLeft=cont.scrollWidth; await wait(100);
  const last=hexes.map(h=>h.getBoundingClientRect()).sort((a,b)=>b.bottom-a.bottom)[0];
  const c=cont.getBoundingClientRect(), pn=panel.getBoundingClientRect();
  out.lastRowReached=!!last&&last.bottom<=Math.min(c.bottom,pn.bottom,window.innerHeight)+1;
  return out;
})()`;

test('the staged report carries an 8×7 world', async () => {
  const rep = await report();
  expect(rep?.['worldMeta']).toMatchObject({ cols: 8, rows: 7 });
});

for (const [label, viewport] of [
  ['laptop', { width: 1280, height: 720 }],
  ['desktop', { width: 1400, height: 900 }],
  ['wide', { width: 1920, height: 1080 }],
] as const) {
  test.describe(label, () => {
    test.use({ viewport });

    test('the whole map fits the panel at 1×, and the zoomed map scrolls to its bottom row', async ({ page }) => {
      const r = await open(page);
      expect.soft(r.hexes, 'the map draws every province of the 8×7 world').toBeGreaterThanOrEqual(56);
      expect.soft(r.fit, 'at 1× the whole map is inside the panel and the window').toBe(r.hexes);
      expect.soft(r.mapH, 'the map gets a fair share of the panel').toBeGreaterThanOrEqual(r.panelH * 0.35);
      expect.soft(r.legendInside, 'the legend ends inside the panel').toBe(true);
      expect.soft({ x: r.scrollX, y: r.scrollY }, 'the zoomed map scrolls left/right and up/down').toEqual({
        x: true,
        y: true,
      });
      expect.soft(r.lastRowReached, 'scrolling to the foot of the map brings its bottom row into view').toBe(true);
    });
  });
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

  test('the map scrolls to its bottom row', async ({ page }) => {
    const r = await open(page);
    expect.soft(r.hexes, 'the map draws every province of the 8×7 world').toBeGreaterThanOrEqual(56);
    expect.soft({ x: r.scrollX, y: r.scrollY }, 'the phone map scrolls left/right and up/down').toEqual({
      x: true,
      y: true,
    });
    expect.soft(r.lastRowReached, 'scrolling to the foot of the map brings its bottom row into view').toBe(true);
  });
});

// Opens the player's report of the staged turn and measures the map. Fails on any page error.
async function open(page: Page): Promise<Seen> {
  const rep = await report();
  const errs: string[] = [];
  await routeExternal(page, browserSource.messaging);
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/kingdoms-call-player-portal.html');
  await playerPortalSignedIn(page);
  await page.evaluate(`(${STAGE})(${JSON.stringify(rep)})`);
  await page.evaluate('openReport("gp0")');
  // The report is open once its map is drawn.
  await page.waitForFunction(() => document.querySelector('#report-map-svg g[data-prov] polygon') !== null);
  const r = await page.evaluate<Seen>(SHOW_AND_MEASURE);
  expect(errs, 'page errors').toEqual([]);
  return r;
}
