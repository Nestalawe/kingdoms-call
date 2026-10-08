// 2026-10-08 (item 11) — Save Draft and Submit Orders are on screen whenever the orders are open,
// scrolled to the top of a long orders form or half-way down, on a desktop window and on a phone.
// Layout only exists in a real browser, so this is a Chromium page test. Made-up heroes; no database.
const {chromium}=require('playwright');
const {serve,routeExternal}=require('./lib/boot'); const {browserSource}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const srv=await serve(); const browser=await chromium.launch(); const errs=[];
  for(const [label,viewport] of [['desktop',{width:1400,height:900}],['short desktop',{width:1280,height:640}],['phone',{width:390,height:800}]]){
    const ctx=await browser.newContext({viewport});
    await ctx.addInitScript(browserSource.null); await routeExternal(ctx,'');
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(label+': '+String(e.message||e)));
    await p.goto(srv.url+'/kingdoms-call-player-portal.html',{waitUntil:'load'}); await p.waitForTimeout(1200);
    const r=await p.evaluate(async()=>{
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
    });
    ok(r.tall,`${label}: the staged orders form is taller than the window`);
    ok(r.top.submit&&r.top.save,`${label}: Save Draft and Submit are on screen at the top of the orders`);
    ok(r.mid.submit&&r.mid.save,`${label}: …and part-way down`);
    await ctx.close();
  }
  await browser.close(); if(srv.close) srv.close();
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
