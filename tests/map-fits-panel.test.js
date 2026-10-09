// 2026-10-09 (Toby items 3 and 4) — the map panel shows the whole map and scrolls when zoomed in.
// An 8×7 map's bottom rows were cut off by the foot of the window, and a zoomed map could not be
// scrolled: the desktop panel switch cleared the map column's inline display:flex, so the column fell
// back to a block, the map grew past the panel (which hides overflow) and never became a scroller.
// Layout only exists in a real browser, so this is a Chromium page test. The report comes from a real
// turn on a made-up 8×7 world (jsdom GM portal, seeded); no database.
const {chromium}=require('playwright');
const {serve,routeExternal}=require('./lib/boot'); const {browserSource}=require('./lib/stub-db');
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario();
  const res=await sc.turn({realms:2,cols:8,rows:7});
  const report=sc.W.buildTurnReport(res.S2,0);
  ok(report&&report.worldMeta&&report.worldMeta.cols===8&&report.worldMeta.rows===7,'the staged report carries an 8×7 world');

  const srv=await serve(); const browser=await chromium.launch(); const errs=[];
  for(const [label,viewport] of [['laptop',{width:1280,height:720}],['desktop',{width:1400,height:900}],['wide',{width:1920,height:1080}],['phone',{width:390,height:800}]]){
    const ctx=await browser.newContext({viewport,hasTouch:viewport.width<821});
    await routeExternal(ctx,browserSource.messaging);
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(label+': '+String(e.message||e)));
    await p.goto(srv.url+'/kingdoms-call-player-portal.html',{waitUntil:'load'}); await p.waitForTimeout(600);
    await p.evaluate(rep=>{ const D=window.__DB; D.reset();
      D.db.games.push({id:'G1',name:'Test',gm_user_id:'gm1',status:'active',turn:rep.turnNumber||1,max_players:2});
      D.db.game_players.push({id:'gp0',game_id:'G1',player_index:0,user_id:'u0',display_name:'Aldoria',
        orders_submitted:false,orders:null,turn_report:JSON.stringify(rep)}); },report);
    await p.evaluate(()=>openReport('gp0')); await p.waitForTimeout(900);
    const r=await p.evaluate(async()=>{
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
    });
    ok(r.hexes>=56,`${label}: the map draws every province of the 8×7 world (got ${r.hexes})`);
    if(!r.phone){
      ok(r.fit===r.hexes,`${label}: at 1× the whole map is inside the panel and the window (${r.fit} of ${r.hexes} provinces visible)`);
      ok(r.mapH>=r.panelH*0.35,`${label}: the map gets a fair share of the panel (${r.mapH}px of ${Math.round(r.panelH)}px)`);
      ok(r.legendInside,`${label}: the legend ends inside the panel`);
    }
    ok(r.scrollX&&r.scrollY,`${label}: the ${r.phone?'phone':'zoomed'} map scrolls left/right (${r.scrollX}) and up/down (${r.scrollY})`);
    ok(r.lastRowReached,`${label}: scrolling to the foot of the map brings its bottom row into view`);
    await ctx.close();
  }
  await browser.close(); if(srv.close) srv.close();
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
