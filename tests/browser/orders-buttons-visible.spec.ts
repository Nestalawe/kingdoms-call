// 2026-10-08 (item 11) — Save Draft and Submit Orders are on screen whenever the orders are open,
// scrolled to the top of a long orders form or half-way down, on a desktop window and on a phone.
// Layout only exists in a real browser, so this is a Chromium page test. Made-up heroes; no database.
import { expect, test } from '@playwright/test';
import { routeExternal } from '../lib/boot.js';
import { browserSource } from '../lib/stub-db.js';
import { signedOut } from './started.ts';

interface Seen {
  tall: boolean;
  top: { save: boolean; submit: boolean };
  mid: { save: boolean; submit: boolean };
}

// Run in the page as the script had it: it stages the orders and measures, with the page's own functions.
const STAGE_AND_MEASURE = `(async()=>{
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  // Eight heroes in one made-up province: a form far taller than any window.
  const hero=i=>({id:'h'+i,name:'Hero '+i,player:0,locationId:11,locationName:'Ashford',hp:20,maxHp:20,armies:[],items:[],skills:{},effectiveSpeed:3,effectiveSeaSpeed:3,isKing:i===0});
  currentGamePlayer={id:'gpx',orders:null};
  currentReport={turn:3,_liveTurn:3,characters:Array.from({length:8},(_,i)=>hero(i)),kingdom:{gold:100,alignment:'Good'},worldMeta:{provinces:[{id:11,name:'Ashford'}]}};
  show('sec-report'); buildOrdersForm(currentReport.characters,false,null,3);
  if(window.innerWidth<821) setMobileView('orders'); else setDeskView('right','orders');
  await wait(300);
  const col=document.getElementById('orders-column');
  // On screen = inside the window AND the topmost thing at its centre (not under the tab bar).
  const onScreen=id=>{ const el=document.getElementById(id), b=el.getBoundingClientRect();
    if(b.top<0||b.bottom>window.innerHeight||b.height===0) return false;
    const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); return !!hit&&(hit===el||el.contains(hit)); };
  const at=async y=>{ col.scrollTop=y; window.scrollTo(0,y); await wait(80); return {save:onScreen('orders-submit-wrap')&&onScreen('submit-btn'), submit:onScreen('submit-btn')}; };
  const tall=Math.max(col.scrollHeight,document.documentElement.scrollHeight);
  return {tall:tall>window.innerHeight*2, top:await at(0), mid:await at(Math.round(tall/3))};
})()`;

for (const [label, viewport] of [
  ['desktop', { width: 1400, height: 900 }],
  ['short desktop', { width: 1280, height: 640 }],
  ['phone', { width: 390, height: 800 }],
] as const) {
  test.describe(label, () => {
    test.use({ viewport });

    test('Save Draft and Submit are on screen at the top of the orders and part-way down', async ({ page }) => {
      const errs: string[] = [];
      await page.addInitScript(browserSource.null);
      await routeExternal(page, '');
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto('/kingdoms-call-player-portal.html');
      await signedOut(page);
      const r = await page.evaluate<Seen>(STAGE_AND_MEASURE);
      expect.soft(r.tall, 'the staged orders form is taller than the window').toBe(true);
      expect.soft(r.top, 'Save Draft and Submit are on screen at the top of the orders').toEqual({
        save: true,
        submit: true,
      });
      expect.soft(r.mid, '…and part-way down').toEqual({ save: true, submit: true });
      expect(errs, 'page errors').toEqual([]);
    });
  });
}
