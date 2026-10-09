// 2026-10-09 (Toby item 2) — the unread count on the left panel's ✉ Dispatches tab shows promptly.
// A dispatch that arrived while the player was on the Map or the Report waited for the slow poll
// (one tick in four, ≈32s) before the count appeared, so it looked as if the tab never showed one.
// Now switching view (Map → Report → …) or coming back to the browser tab asks at once.
// Layout and timers in a real browser, so a Chromium page test (level 4). Made-up realms; no database.
const {chromium}=require('playwright');
const {serve,routeExternal}=require('./lib/boot'); const {browserSource}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const srv=await serve(); const browser=await chromium.launch(); const errs=[];
  const ctx=await browser.newContext({viewport:{width:1400,height:900}});
  await routeExternal(ctx,browserSource.messaging);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(String(e.message||e)));
  await p.goto(srv.url+'/kingdoms-call-player-portal.html',{waitUntil:'load'}); await p.waitForTimeout(600);
  await p.evaluate(()=>{ const D=window.__DB; D.reset();
    const report={playerIndex:0,playerName:'Aldoria',turnNumber:2,kingdom:{color:'#b8433a',alignment:'Neutral',race:'Human',gold:20},
      diplomacy:{alliancesAllowed:true,known:[{index:1,name:'Bruneth',color:'#6fbf73',relation:'neutral'}]},characters:[],provinces:[]};
    D.db.games.push({id:'G1',name:'Test',gm_user_id:'gm1',status:'active',turn:2,max_players:2});
    [0,1].forEach(i=>D.db.game_players.push({id:'gp'+i,game_id:'G1',player_index:i,user_id:'u'+i,display_name:i?'Bruneth':'Aldoria',
      orders_submitted:false,orders:null,turn_report:JSON.stringify(i?{playerIndex:1}:report)}));
    D.db.game_message_reads.push({game_id:'G1',player_index:0,user_id:'u0',reads:{}}); });
  await p.evaluate(()=>openReport('gp0')); await p.waitForTimeout(1200);
  const badge=()=>p.evaluate(()=>{ const b=document.getElementById('desk-msg-badge'), t=document.getElementById('desk-msg-tab');
    const r=b&&b.getBoundingClientRect(); return {txt:(b&&b.textContent)||'', shown:!!t&&t.style.display!=='none'&&!!r&&r.width>0}; });
  ok((await badge()).txt==='','no count before any dispatch has arrived');

  // A dispatch arrives; the player moves the left panel from Map to Report.
  await p.evaluate(()=>window.__DB.inject({game_id:'G1',from_index:1,to_indexes:[],body:'Well met, neighbour.',turn:2}));
  await p.click('#desk-left .desk-tabs button[data-view="report"]'); await p.waitForTimeout(1000);
  let b=await badge();
  ok(b.txt==='1'&&b.shown,`switching to Report shows the count on the Dispatches tab at once (got "${b.txt}")`);

  // Opening Dispatches reads it; the count goes.
  await p.click('#desk-msg-tab'); await p.waitForTimeout(800);
  ok((await badge()).txt==='','opening Dispatches clears the count');

  // Back to the Map; a private dispatch arrives while the browser tab is in the background.
  await p.click('#desk-left .desk-tabs button[data-view="map"]'); await p.waitForTimeout(800);
  const n0=Number((await badge()).txt||0);
  await p.evaluate(()=>window.__DB.inject({game_id:'G1',from_index:1,to_indexes:[0],body:'A word in private.',turn:2}));
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1000);
  b=await badge();
  ok(Number(b.txt||0)===n0+1&&b.shown,`coming back to the browser tab adds the new dispatch to the count at once (${n0} → "${b.txt}")`);

  await browser.close(); if(srv.close) srv.close();
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
