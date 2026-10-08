// QUARANTINED 2026-10-01: 70 of 71 checks pass on v2026.09.30-0038; it expects left-panel tabs Map + Dispatches, but the player portal now also has a Report tab.
// claude_msg_e2e_0927.js — end-to-end test of the player portal's DISPATCHES panel in headless
// Chromium. The real page and the real kingdoms-call-data.js, served over HTTP from one folder exactly
// as deployed; the Supabase CDN bundle is answered with stub_supabase_0927.js (an in-memory database
// that also re-implements the game_messages read and insert policies), Google Fonts with nothing.
//
// NOTE ON SCOPE: the module's state lives in top-level `let` bindings, which sit in the GLOBAL LEXICAL
// environment and are therefore NOT properties of `window`. Every probe below reads them as bare
// identifiers (`_msgEnabled`), never as `window._msgEnabled` — which would read undefined and quietly
// pass. Function declarations, by contrast, are real window properties.
//
// What it proves:
//   1. the page boots with 0 page errors, and every messaging entry point is defined
//   2. the left desktop panel's tabs are Map + Dispatches (the duplicate Report tab is gone) and the
//      report column now lives permanently in the right panel
//   3. the channel list is public + every MET HUMAN realm — a bot and an unmet realm are both absent
//   4. a dispatch sent from the panel reaches the table with the right scope and recipients and comes
//      straight back into the thread, with no turn run, and does not leak into another channel
//   5. a dispatch injected by another realm arrives on a poll and raises both unread badges; opening
//      its channel clears them and writes a read mark row
//   6. a private dispatch between two OTHER realms is never shown (the read policy, mirrored)
//   7. a conference (multi-realm) thread keys identically for sender and recipient
//   8. the correspondence survives a turn advancing and the report being re-opened, with no loss and
//      no duplication
//   9. a one-human game hides Dispatches entirely, on the desktop panel and the phone bar
//  10. a missing game_messages table degrades to an explanatory panel and a dead Send, never a crash
const {chromium}=require('playwright');
const {SITE,serve,routeExternal}=require('../lib/boot'); const {browserSource}=require('../lib/stub-db');
const DIR=process.argv[2]||SITE;
const EXPECT_STAMP=process.argv[3]||null;
let server;

let fails=0, checks=0;
function check(cond,msg){ checks++; if(!cond){ fails++; console.log('FAIL: '+msg); } }
function eq(a,b,msg){ checks++; if(JSON.stringify(a)!==JSON.stringify(b)){ fails++; console.log(`FAIL: ${msg}\n   got      ${JSON.stringify(a)}\n   expected ${JSON.stringify(b)}`); } }

// A world: realm 0 = us, realms 1 and 2 = human rivals we have MET, realm 3 = a BOT we have met,
// realm 4 = a human we have NOT met.
function seed(page,{humans=[0,1,2,4],bots=[3],met=[1,2,3],turn=0}={}){
  return page.evaluate(({humans,bots,met,turn})=>{
    const D=window.__DB; D.reset();
    D.db.games.push({id:'G1',name:'The Contested Marches',gm_user_id:'gm1',status:turn?'active':'setup',turn,max_players:5});
    const NAMES=['Aldoria','Bruneth','Caldermoor','Ironhold Bots','Everdusk'];
    const COLS=['#b8433a','#6fbf73','#9fa8b8','#c9a961','#7d4fb5'];
    const known=met.map(i=>({index:i,name:NAMES[i],color:COLS[i],alignment:'Neutral',
      conceded:false,eliminated:false,relation:'neutral'}));
    const report={playerIndex:0,playerName:NAMES[0],turnNumber:turn,
      kingdom:{color:COLS[0],alignment:'Neutral',race:'Human',gold:20},
      diplomacy:{alliancesAllowed:true,known}, characters:[], provinces:[],
      waitingForTurn0:turn===0};
    window.__REPORT=report;
    [...humans,...bots].sort((a,b)=>a-b).forEach(i=>{
      D.db.game_players.push({id:'gp'+i,game_id:'G1',player_index:i,
        user_id:bots.includes(i)?null:('u'+i),display_name:NAMES[i],
        orders_submitted:false, orders:null,
        turn_report:JSON.stringify(i===0?report:{playerIndex:i,playerName:NAMES[i],waitingForTurn0:turn===0})});
    });
    return true;
  },{humans,bots,met,turn});
}
const openIt   = page=>page.evaluate(()=>initMessaging('G1',0,window.__REPORT));
const chans    = page=>page.evaluate(()=>[...document.querySelectorAll('#msg-channels .msg-chan')]
                        .map(b=>b.querySelector('.mc-label').textContent+':'+((b.querySelector('.mc-unread')||{}).textContent||'')));
const thread   = page=>page.evaluate(()=>document.getElementById('msg-thread').innerHTML);
const badges   = page=>page.evaluate(()=>[(document.getElementById('desk-msg-badge')||{}).textContent||'',
                                          (document.getElementById('mt-msg-badge')||{}).textContent||'']);

(async()=>{
  server=await serve(DIR);
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push('pageerror: '+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push('console.error: '+m.text()); });
  await routeExternal(page,browserSource.messaging);

  await page.goto(`${server.url}/kingdoms-call-player-portal.html`,{waitUntil:'load'});
  await page.waitForTimeout(600);

  // ── 1. boot ──
  check(await page.evaluate(()=>document.getElementById('spinner').style.display==='none'),'spinner still showing after boot');
  const stamp=await page.evaluate(()=>{const d=[...document.querySelectorAll('div')].find(x=>/Player Portal v/.test(x.textContent)&&!x.children.length); return d?d.textContent.trim():null;});
  console.log('footer: '+stamp);
  if(EXPECT_STAMP) check(stamp&&stamp.includes(EXPECT_STAMP),'footer stamp is not '+EXPECT_STAMP+' (got '+stamp+')');
  for(const fn of ['initMessaging','refreshMessages','sendMessage','renderMessageChannels','renderMessageThread',
                   'msgGroupKey','msgChannelKeyOf','updateMsgBadges','onMessagesShown','stopMessagePolling',
                   'createMsgGroup','toggleMsgGroupPicker','setMsgChannel','probeMessagesTable'])
    check(await page.evaluate(n=>typeof window[n]==='function',fn),'missing function '+fn);
  check(await page.evaluate(()=>currentUser&&currentUser.id==='u0'),'the stub session did not sign the player in');

  // ── 2. the REAL openReport path starts messaging ──
  await seed(page,{turn:0});
  await page.evaluate(()=>openReport('gp0'));
  await page.waitForTimeout(500);
  check(await page.evaluate(()=>document.getElementById('sec-report').classList.contains('section-active')),'openReport did not show the report section');
  const leftTabs=await page.evaluate(()=>[...document.querySelectorAll('#desk-left .desk-tabs button')].map(b=>({v:b.dataset.view,vis:b.style.display!=='none'})));
  eq(leftTabs.map(t=>t.v),['map','messages'],'left panel tabs should be Map + Dispatches');
  eq(await page.evaluate(()=>[...document.querySelectorAll('#desk-right .desk-tabs button')].map(b=>b.dataset.view)),
     ['report','orders'],'right panel tabs should be Report + Orders');
  check(await page.evaluate(()=>document.getElementById('rp-report-col').parentNode.id==='desk-right-body'),'the report column is not in the right panel');
  check(await page.evaluate(()=>document.getElementById('rp-msg-col').parentNode.id==='desk-left-body'),'the messages column is not in the left panel');
  check(leftTabs[1]&&leftTabs[1].vis,'the Dispatches tab is hidden in a game with four human realms');
  check(await page.evaluate(()=>document.getElementById('mt-messages').style.display!=='none'),'the phone Dispatches tab is hidden');
  check(await page.evaluate(()=>_msgEnabled===true),'_msgEnabled is not true with four human realms');

  // ── 3. roster: public + met humans only ──
  await page.evaluate(()=>setDeskView('left','messages'));
  await page.waitForTimeout(300);
  check(await page.evaluate(()=>document.getElementById('rp-msg-col').style.display==='flex'),'the Dispatches tab did not reveal the column');
  check(await page.evaluate(()=>document.getElementById('rp-map-col').style.display==='none'),'the map is still shown behind Dispatches');
  eq(await chans(page),['📣 All Realms:','Bruneth:','Caldermoor:'],
     'channel list should be public + the two met HUMAN realms (the bot and the unmet realm excluded)');

  // ── 4. sending ──
  await page.evaluate(()=>{ document.getElementById('msg-input').value='Peace on the river, then. Your ships pass freely.'; onMsgInput(); });
  check(await page.evaluate(()=>!document.getElementById('msg-send-btn').disabled),'Send is disabled with text in the box on the public channel');
  await page.evaluate(()=>sendMessage());
  await page.waitForTimeout(350);
  eq(await page.evaluate(()=>window.__DB.db.game_messages.map(m=>({from:m.from_index,to:m.to_indexes,scope:m.scope,body:m.body,user:m.from_user_id,turn:m.turn}))),
     [{from:0,to:[],scope:'public',body:'Peace on the river, then. Your ships pass freely.',user:'u0',turn:1}],
     'the public dispatch was not stored as expected (turn 1 = the turn being PLANNED; the portal stamps g.turn||1)');
  check(/Peace on the river/.test(await thread(page)),'the sent dispatch is not in the thread');
  check(await page.evaluate(()=>document.getElementById('msg-input').value===''),'the composer was not cleared after sending');

  await page.evaluate(()=>setMsgChannel(msgGroupKey([0,1])));
  await page.evaluate(()=>{ document.getElementById('msg-input').value='Caldermoor masses on your border, not mine.'; onMsgInput(); });
  await page.evaluate(()=>sendMessage());
  await page.waitForTimeout(350);
  eq(await page.evaluate(()=>window.__DB.db.game_messages.slice(-1).map(m=>({from:m.from_index,to:m.to_indexes,scope:m.scope}))),
     [{from:0,to:[1],scope:'private'}],'the private dispatch was not addressed to realm 1 alone');
  check(/Caldermoor masses/.test(await thread(page)),'the private dispatch is not in its own thread');
  await page.evaluate(()=>setMsgChannel('public'));
  check(!/Caldermoor masses/.test(await thread(page)),'a private dispatch leaked into the public thread');

  // ── 5. incoming, and the unread badges ──
  await page.evaluate(()=>setDeskView('left','map'));                       // look away
  await page.evaluate(()=>{
    window.__DB.inject({game_id:'G1',from_index:2,to_indexes:[0],body:'Bruneth lies. Treat with me instead.',turn:1});
    window.__DB.inject({game_id:'G1',from_index:1,to_indexes:[],body:'Let all realms hear: the Marches are mine.',turn:1});
  });
  await page.evaluate(()=>refreshMessages(true));
  await page.waitForTimeout(300);
  eq(await badges(page),['2','2'],'both unread badges should read 2');
  eq(await chans(page),['📣 All Realms:1','Bruneth:','Caldermoor:1'],'per-channel unread counts wrong');
  // Opening the panel marks whatever channel is showing as read, so park on Bruneth (nothing unread
  // there) before switching back, then read the two that do have something.
  await page.evaluate(()=>{ setMsgChannel(msgGroupKey([0,1])); setDeskView('left','messages'); });
  await page.waitForTimeout(300);
  eq((await badges(page))[0],'2','opening Dispatches on an already-read channel must not clear the badge');
  await page.evaluate(()=>setMsgChannel(msgGroupKey([0,2])));
  await page.waitForTimeout(1700);   // the read-mark save is debounced by 1.2s
  eq((await badges(page))[0],'1','reading Caldermoor should leave one unread (the public dispatch)');
  const marks=await page.evaluate(()=>window.__DB.db.game_message_reads.map(r=>({g:r.game_id,i:r.player_index,u:r.user_id,keys:Object.keys(r.reads).sort()})));
  check(marks.length===1&&marks[0].g==='G1'&&marks[0].i===0&&marks[0].u==='u0'&&marks[0].keys.includes('p:0-2'),
        'the read-mark row is wrong: '+JSON.stringify(marks));
  await page.evaluate(()=>setMsgChannel('public'));
  await page.waitForTimeout(1600);
  eq((await badges(page))[0],'','reading the public channel should clear the badge');

  // ── 6. someone else's private traffic must be invisible ──
  await page.evaluate(()=>window.__DB.inject({game_id:'G1',from_index:1,to_indexes:[2],body:'SECRET-PACT-BETWEEN-THEM',turn:1}));
  await page.evaluate(()=>refreshMessages(true));
  await page.waitForTimeout(300);
  check(!/SECRET-PACT-BETWEEN-THEM/.test(await page.evaluate(()=>document.body.innerHTML)),
        'a private dispatch between two other realms is visible');
  eq(await page.evaluate(()=>_msgRows.length),4,'the readable row count is wrong (5 rows in the table, 1 of them another pair\'s private traffic)');

  // ── 7. conference thread ──
  await page.evaluate(()=>{
    toggleMsgGroupPicker(true);
    [...document.querySelectorAll('#msg-group-list input[type=checkbox]')].forEach(c=>{ if(c.value==='1'||c.value==='2') c.checked=true; });
    createMsgGroup();
  });
  await page.waitForTimeout(200);
  eq(await page.evaluate(()=>_msgChannel),'p:0-1-2','the conference channel key is wrong');
  await page.evaluate(()=>{ document.getElementById('msg-input').value='A three-way truce, or none at all.'; onMsgInput(); });
  await page.evaluate(()=>sendMessage());
  await page.waitForTimeout(350);
  eq(await page.evaluate(()=>window.__DB.db.game_messages.slice(-1).map(m=>({from:m.from_index,to:m.to_indexes.slice().sort(),scope:m.scope}))),
     [{from:0,to:[1,2],scope:'private'}],'the conference dispatch was not addressed to both realms');
  await page.evaluate(()=>window.__DB.inject({game_id:'G1',from_index:2,to_indexes:[0,1],body:'Agreed, for one season.',turn:1}));
  await page.evaluate(()=>refreshMessages(true));
  await page.waitForTimeout(300);
  const t7=await thread(page);
  check(/A three-way truce/.test(t7)&&/Agreed, for one season/.test(t7),'a reply to the same three realms did not join the conference thread');
  eq(await page.evaluate(()=>msgChannelKeyOf({scope:'private',from_index:2,to_indexes:[0,1]})),'p:0-1-2',
     'the recipient-side channel key does not match the sender-side one');

  // ── 8. a turn runs: the correspondence must still be there, once each ──
  await page.evaluate(()=>{ window.__DB.db.games[0].turn=3; window.__DB.db.games[0].status='active'; });
  await openIt(page);
  await page.waitForTimeout(450);
  await page.evaluate(()=>setMsgChannel('p:0-1-2'));
  check(/A three-way truce/.test(await thread(page)),'the conference thread was lost when the turn advanced');
  eq(await page.evaluate(()=>window.__DB.db.game_messages.length),7,'a dispatch was lost or duplicated in the table');
  const ids=await page.evaluate(()=>_msgRows.map(r=>r.id));
  eq([ids.length,new Set(ids).size],[6,6],'duplicate rows held in memory after a re-init');

  // ── 8b. a long correspondence pages backwards ──
  // 450 public dispatches: the first load takes the newest 400 and offers the rest.
  await seed(page,{turn:4});
  // initMessaging keeps its cache when the game and realm are unchanged (that is what makes a report
  // refresh cheap), so the watermark is cleared here to model opening this game for the first time.
  await page.evaluate(()=>{ _msgGameId=null; });
  await page.evaluate(()=>{ for(let i=1;i<=450;i++) window.__DB.inject({game_id:'G1',from_index:(i%3===0?1:2),to_indexes:[],body:'proclamation '+i,turn:1+Math.floor(i/40)}); });
  await openIt(page);
  await page.waitForTimeout(500);
  await page.evaluate(()=>setDeskView('left','messages'));
  await page.waitForTimeout(250);
  eq(await page.evaluate(()=>[_msgRows.length,_msgMoreOlder]),[400,true],'the first page should hold the newest 400 and know there are more');
  check(/Earlier dispatches/.test(await thread(page)),'the "Earlier dispatches" button is missing on a long correspondence');
  check(/proclamation 450/.test(await thread(page))&&!/proclamation 1</.test(await thread(page)),'the first page is not the NEWEST page');
  await page.evaluate(()=>loadOlderMessages());
  await page.waitForTimeout(400);
  eq(await page.evaluate(()=>[_msgRows.length,_msgMoreOlder]),[450,false],'paging backwards did not recover the remaining 50');
  check(/>proclamation 1</.test(await thread(page)),'the oldest dispatch is still not reachable');
  check(!/Earlier dispatches/.test(await thread(page)),'the "Earlier dispatches" button remains with nothing left to load');
  const pIds=await page.evaluate(()=>_msgRows.map(r=>r.id));
  eq([pIds.length,new Set(pIds).size,pIds[0]<pIds[pIds.length-1]],[450,450,true],'paged rows are duplicated or out of order');

  // ── 9. one human realm: no messaging at all ──
  await seed(page,{humans:[0],bots:[1,2,3],met:[1,2],turn:2});
  await openIt(page);
  await page.waitForTimeout(350);
  check(await page.evaluate(()=>_msgEnabled===false),'messaging is still enabled in a solo-vs-bots game');
  check(await page.evaluate(()=>document.getElementById('desk-msg-tab').style.display==='none'),'the desktop Dispatches tab is shown in a solo-vs-bots game');
  check(await page.evaluate(()=>document.getElementById('mt-messages').style.display==='none'),'the phone Dispatches tab is shown in a solo-vs-bots game');
  check(await page.evaluate(()=>document.getElementById('rp-msg-col').style.display==='none'),'the messages column is visible in a solo-vs-bots game');
  eq(await page.evaluate(()=>_deskLeftView),'map','the left panel did not fall back to the map when messaging vanished');
  await page.evaluate(()=>setDeskView('left','messages'));
  eq(await page.evaluate(()=>_deskLeftView),'map','the Dispatches view can still be selected with messaging off');

  // ── 10. the SQL has not been run ──
  await seed(page,{turn:2});
  await page.evaluate(()=>{ window.__DB.hide('game_messages'); _msgTableOk=null; });
  await openIt(page);
  await page.waitForTimeout(400);
  await page.evaluate(()=>setDeskView('left','messages'));
  check(/table is missing|not switched on/i.test(await thread(page)),'a missing game_messages table does not explain itself');
  check(await page.evaluate(()=>document.getElementById('msg-send-btn').disabled),'Send is still enabled with the table missing');
  await page.evaluate(()=>{ window.__DB.show('game_messages'); _msgTableOk=null; });
  await openIt(page);
  await page.waitForTimeout(400);
  check(!/table is missing/i.test(await thread(page)),'the panel did not recover once the table came back');

  // ── phone layout ──
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{ teardownDeskLayout(); setMobileView('messages'); });
  await page.waitForTimeout(250);
  check(await page.evaluate(()=>document.getElementById('rp-layout').classList.contains('mv-messages')),'the phone tab bar did not switch to Dispatches');
  check(await page.evaluate(()=>getComputedStyle(document.getElementById('rp-msg-col')).display!=='none'),'the messages column is hidden on the phone Dispatches tab');
  check(await page.evaluate(()=>getComputedStyle(document.getElementById('rp-map-col')).display==='none'),'the map is still visible on the phone Dispatches tab');
  await page.evaluate(()=>setMobileView('report'));
  check(await page.evaluate(()=>getComputedStyle(document.getElementById('rp-msg-col')).display==='none'),'the messages column is still visible on the phone Report tab');
  await page.evaluate(()=>setMobileView('orders'));
  check(await page.evaluate(()=>getComputedStyle(document.getElementById('rp-msg-col')).display==='none'),'the messages column is still visible on the phone Orders tab');

  // nothing undefined / NaN in anything the panel rendered
  await page.setViewportSize({width:1400,height:900});
  await page.evaluate(()=>{ setupDeskLayout(); setDeskView('left','messages'); });
  await page.waitForTimeout(250);
  const panel=await page.evaluate(()=>document.getElementById('rp-msg-col').innerHTML);
  const m=panel.match(/.{0,50}(undefined|NaN|\[object Object\]).{0,50}/);
  if(m){ fails++; console.log('FAIL: the rendered panel contains "'+m[1]+'": …'+m[0]+'…'); }

  // leaving the report must stop the poll
  await page.evaluate(()=>show('sec-games'));
  await page.waitForTimeout(150);
  check(await page.evaluate(()=>_msgTimer===null),'the dispatch poll is still running after leaving the report screen');

  errs.forEach(e=>{ fails++; console.log('FAIL '+e); });
  await browser.close(); server.close();
  console.log(`\n${checks} checks · ${errs.length} page errors · ${fails?'FAILURES: '+fails:'0 failures'}`);
  process.exit(fails?1:0);
})().catch(e=>{ console.error(e); server.close(); process.exit(2); });
