// claude_msg_gm_boot_0927.js — the GM portal's half of the messaging change. The GM portal gained
// only KC_MSG_SQL, probeMessaging(), renderMessagingBanner() and two deletes on the game-delete path,
// so this is a boot-and-banner check rather than an engine test: the page must start with 0 page
// errors, the SQL paste box must appear while the tables are missing and vanish once they exist, and
// deleteGame must clear a game's dispatches BEFORE it removes the games row (after which the delete
// policy would no longer let anyone touch them).
const {chromium}=require('playwright');
const {SITE,serve,routeExternal}=require('./lib/boot'); const {browserSource}=require('./lib/stub-db');
const DIR=process.argv[2]||SITE;
const EXPECT_STAMP=process.argv[3]||null;
let server;
let fails=0,checks=0;
const check=(c,m)=>{checks++; if(!c){fails++;console.log('FAIL: '+m);}};

(async()=>{
  server=await serve(DIR);
  const browser=await chromium.launch();
  const page=await (await browser.newContext({viewport:{width:1500,height:950}})).newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push('pageerror: '+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push('console.error: '+m.text()); });
  await routeExternal(page,browserSource.messaging);
  // the GM portal signs in as the GM
  await page.addInitScript(()=>{ window.__WANT_GM=true; });
  await page.goto(`${server.url}/kingdoms-call-gm-portal.html`,{waitUntil:'load'});
  await page.waitForTimeout(900);

  check(await page.evaluate(()=>{const s=document.getElementById('spinner'); return !s||s.style.display==='none'||s.offsetParent===null;}),'GM portal spinner still showing');
  const stamp=await page.evaluate(()=>{const d=[...document.querySelectorAll('div')].find(x=>/GM Portal v/.test(x.textContent)&&!x.children.length); return d?d.textContent.trim():null;});
  console.log('footer: '+stamp);
  if(EXPECT_STAMP) check(stamp&&stamp.includes(EXPECT_STAMP),'GM footer stamp is not '+EXPECT_STAMP+' (got '+stamp+')');
  for(const n of ['probeMessaging','renderMessagingBanner','deleteGame'])
    check(await page.evaluate(x=>typeof window[x]==='function',n),'missing function '+n);
  check(await page.evaluate(()=>typeof KC_MSG_SQL==='string'&&KC_MSG_SQL.length>800),'KC_MSG_SQL missing or too short');
  check(await page.evaluate(()=>document.getElementById('msg-messaging')!==null),'the #msg-messaging banner slot is missing');

  // tables present → no banner
  await page.evaluate(()=>{ window.__DB.reset(); });
  await page.evaluate(()=>probeMessaging());
  await page.waitForTimeout(150);
  check(await page.evaluate(()=>document.getElementById('msg-messaging').innerHTML===''),'the banner is shown even though the tables exist');
  check(await page.evaluate(()=>_kcHasMsg===true),'_kcHasMsg is not true with the tables present');

  // tables missing → the SQL paste box, containing the real statement
  await page.evaluate(()=>{ window.__DB.hide('game_messages'); });
  await page.evaluate(()=>probeMessaging());
  await page.waitForTimeout(150);
  const html=await page.evaluate(()=>document.getElementById('msg-messaging').innerHTML);
  check(/Player messaging not active/.test(html),'the missing-table banner did not appear');
  check(/create table if not exists public\.game_messages/.test(html),'the banner does not carry the CREATE TABLE statement');
  check(/create policy &quot;send game_messages&quot;|create policy "send game_messages"/.test(html),'the banner does not carry the insert policy');
  check(await page.evaluate(()=>_kcHasMsg===false),'_kcHasMsg is not false with a table missing');
  await page.evaluate(()=>{ window.__DB.show('game_messages'); return probeMessaging(); });

  // deleteGame must clear dispatches BEFORE the games row goes
  await page.evaluate(()=>{
    window.__DB.reset();
    window.__DB.db.games.push({id:'G1',name:'Doomed',gm_user_id:'u0',status:'active',turn:2});
    window.__DB.db.game_players.push({id:'gp0',game_id:'G1',player_index:0,user_id:'u0',display_name:'A'});
    window.__DB.inject({game_id:'G1',from_index:0,to_indexes:[],body:'to be swept away'});
    window.__DB.db.game_message_reads.push({game_id:'G1',player_index:0,user_id:'u0',reads:{public:1}});
    window.confirm=()=>true;
    if(!document.getElementById('detail-msg')){ const d=document.createElement('div'); d.id='detail-msg'; document.body.appendChild(d); }
  });
  await page.evaluate(()=>probeMessaging());
  await page.evaluate(()=>deleteGame('G1'));
  await page.waitForTimeout(500);
  const left=await page.evaluate(()=>({msgs:window.__DB.db.game_messages.length,reads:window.__DB.db.game_message_reads.length,games:window.__DB.db.games.length}));
  check(left.msgs===0,'deleteGame left '+left.msgs+' dispatch row(s) behind');
  check(left.reads===0,'deleteGame left '+left.reads+' read-mark row(s) behind');
  check(left.games===0,'deleteGame did not delete the game itself');

  errs.forEach(e=>{ fails++; console.log('FAIL '+e); });
  await browser.close(); server.close();
  console.log(`\n${checks} checks · ${errs.length} page errors · ${fails?'FAILURES: '+fails:'0 failures'}`);
  process.exit(fails?1:0);
})().catch(e=>{ console.error(e); server.close(); process.exit(2); });
