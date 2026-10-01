// claude_lb_chromium_0927.js — real-browser boot smoke for all three pages, served from ONE folder
// over HTTP exactly as they are deployed. The Supabase CDN is answered with a stub client, so no
// network call leaves the sandbox. Checks: the spinner is hidden, there are zero page errors, the
// footer carries the expected stamp, the new links are present and point at the right files, and
// the GM portal's new leaderboard functions exist and its boot order is intact.
const {chromium}=require('playwright');
const {serve,routeExternal}=require('./lib/boot'); const {browserSource}=require('./lib/stub-db');
const STAMP=process.argv[2];

const STUB=browserSource.null;

(async()=>{
  const srv=await serve();
  const browser=await chromium.launch();
  let fails=0;
  const say=(ok,m)=>{ if(!ok){fails++; console.log('FAIL: '+m);} };
  for(const page of ['kingdoms-call-gm-portal.html','kingdoms-call-player-portal.html','kingdoms-call-leaderboard.html']){
    const ctx=await browser.newContext();
    await ctx.addInitScript(STUB);
    await routeExternal(ctx,'');
    const p=await ctx.newPage();
    const errs=[];
    p.on('pageerror',e=>errs.push(String(e.message||e)));
    p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
    await p.goto(srv.url+'/'+page,{waitUntil:'load'});
    await p.waitForTimeout(1500);
    const spinner=await p.evaluate(()=>{ const s=document.getElementById('spinner'); return s?s.style.display:'none'; });
    const foot=await p.evaluate(()=>{ const m=document.body.innerText.match(/Kingdoms Call[^\n]*v[0-9.\-]+/); return m?m[0]:''; });
    say(spinner==='none',page+': spinner still visible — the page did not boot');
    say(errs.length===0,page+': '+errs.length+' page error(s): '+errs.slice(0,3).join(' | '));
    say(!STAMP||foot.indexOf(STAMP)>0,page+': footer stamp is "'+foot+'", expected '+STAMP);
    const links=await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')+'|'+a.textContent.trim()));
    if(page==='kingdoms-call-player-portal.html'){
      say(links.some(l=>l.startsWith('kingdoms-call-leaderboard.html|')&&/Leaderboard/.test(l)),'player portal: no Leaderboard link');
      say(links.some(l=>l.startsWith('kingdoms-call-rules.html|')),'player portal: Rules link lost');
      say(!links.some(l=>/kingdoms-call-leaderboard\.html\?gm=1/.test(l)),'player portal: link must NOT carry ?gm=1');
    }
    if(page==='kingdoms-call-gm-portal.html'){
      say(links.some(l=>l.startsWith('kingdoms-call-leaderboard.html?gm=1|')),'GM portal: no ?gm=1 Leaderboard link');
      const fns=await p.evaluate(()=>['buildGameRecords','writeGameRecord','backfillGameRecords','probeLeaderboard','renderLeaderboardBanner']
        .map(n=>{ try{ return typeof eval(n); }catch(e){ return 'missing'; } }));
      say(fns.every(t=>t==='function'),'GM portal: leaderboard functions not defined ('+fns.join(',')+')');
      const tbl=await p.evaluate(()=>({sql:typeof KC_LB_SQL, sea:(typeof _LB_SEA!=='undefined')&&_LB_SEA.size>0, banner:!!document.getElementById('msg-leaderboard')}));
      say(tbl.sql==='string'&&tbl.sea&&tbl.banner,'GM portal: leaderboard constants / banner slot missing');
    }
    if(page==='kingdoms-call-leaderboard.html'){
      const tabs=await p.evaluate(()=>[...document.querySelectorAll('.tab-bar button')].map(b=>b.id));
      say(tabs.length===4,'leaderboard: expected 4 tabs, got '+tabs.length);
      const msg=await p.evaluate(()=>document.getElementById('msg').innerText);
      say(/No finished games|could not be read/.test(msg),'leaderboard: empty-board message missing (got "'+msg.slice(0,60)+'")');
      const sel=await p.evaluate(()=>[...document.querySelectorAll('.filters select,.filters input')].length);
      say(sel>=12,'leaderboard: expected 12+ filter controls, got '+sel);
    }
    console.log(`${page}: booted, ${errs.length} page errors, footer "${foot}"`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(fails?`\nFAILURES: ${fails}`:'\n0 failures');
  process.exit(fails?1:0);
})();
