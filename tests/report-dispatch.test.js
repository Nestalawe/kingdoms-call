// Reporting a dispatch (P0-24, rulings D-01 and D-13g). Page level (jsdom, the in-memory database of lib/stub-db.js,
// which mirrors message_reports and gm_reported_messages):
//   - player portal: Dispatches says private dispatches are seen only by the realms in the conversation and the
//     Overlord; each dispatch received (not one's own) has ⚑ Report; reporting asks for an optional reason, writes
//     the report as the realm the player plays, and the dispatch then shows as reported (also after a reload);
//   - GM portal: a game's screen lists its reported dispatches (sender, recipients, reporter, reason, the text, all
//     escaped), and Delete removes the dispatch; a GM who plays in the game is told its reports go to the Overlord.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function world(){
  const S=makeStub();
  S.DB.profiles.push({id:'p1',name:'Test Player One'},{id:'p2',name:'Test Player Two'});
  S.DB.games.push({id:'G1',name:'Marchwood',gm_user_id:'gm1',status:'active',turn:3,max_players:3,max_turns:0,
    created_at:'2026-10-01T00:00:00Z',meta:null,game_state:'{}'});
  S.DB.game_players.push(
    {id:'s0',game_id:'G1',user_id:'p1',player_index:0,display_name:'Thornmere',orders_submitted:false,turn_report:'{}'},
    {id:'s1',game_id:'G1',user_id:'p2',player_index:1,display_name:'Veyholt',orders_submitted:false,turn_report:'{}'},
    {id:'s2',game_id:'G1',user_id:null,player_index:2,display_name:'Grimfast',orders_submitted:false,turn_report:'{"isBot":true}'});
  S.DB.game_messages.push(
    {id:11,game_id:'G1',turn:3,from_index:1,from_user_id:'p2',to_indexes:[0],scope:'private',body:'Yield the ford <img src=x onerror=alert(1)>',created_at:'2026-10-12T10:00:00Z'},
    {id:12,game_id:'G1',turn:3,from_index:0,from_user_id:'p1',to_indexes:[1],scope:'private',body:'Never.',created_at:'2026-10-12T10:05:00Z'});
  return S;
}
async function boot(S,page,user,setup){
  S.setUser(user);
  const errs=[];
  const dom=bootJsdom(readPage(page),{supabase:S.supabase,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=(...a)=>errs.push(a.join(' '));
    w.alert=m=>errs.push('alert: '+m);
    if(setup) setup(w);
  }});
  await wait(900);
  return {W:dom.window,doc:dom.window.document,errs};
}
// p1's Dispatches, open on the private channel with Veyholt (realm 1).
async function openThread(W){
  W.eval(`_msgEnabled=true; _msgTableOk=true; _msgGameId='G1'; _msgMyIndex=0; _msgRealms={0:{index:0,name:'Thornmere',human:true,met:true,mine:true},1:{index:1,name:'Veyholt',human:true,met:true}};`);
  await W.eval(`typeof loadMyReports==='function'?loadMyReports():null`);
  W.eval(`_msgRows=${JSON.stringify([])}.concat(window.__rows); _msgChannel=msgChannelKeyOf(_msgRows[0]); renderMessageThread();`);
}

(async()=>{
  // ── the player ──
  {
    const S=world();
    const {W,doc,errs}=await boot(S,'kingdoms-call-player-portal.html','p1',w=>{ w.prompt=()=>'  Threats  '; });
    W.__rows=S.DB.game_messages.slice();
    await openThread(W);
    check(/seen only by the realms in the conversation and the site.s Overlord/.test(doc.getElementById('rp-msg-col').textContent),
      'Dispatches says who sees private dispatches');
    const btns=[...doc.querySelectorAll('#msg-thread [onclick^="reportMessage("]')];
    check(btns.length===1&&/reportMessage\(11\)/.test(btns[0].getAttribute('onclick')),`a Report button on the dispatch received, none on one's own (${btns.length})`);
    await W.eval(`typeof reportMessage==='function'?reportMessage(11):null`); await wait(30);
    const r=S.DB.message_reports[0];
    check(!!r&&r.message_id===11&&r.game_id==='G1'&&r.reporter_index===0&&r.reason==='Threats',`the report is written as Thornmere, with the reason (${JSON.stringify(r)})`);
    check(!doc.querySelector('#msg-thread [onclick^="reportMessage("]')&&/Reported/.test(doc.getElementById('msg-thread').textContent),'then it shows as reported');
    check(!errs.length,'player: no page errors'+(errs.length?': '+errs[0].split('\n')[0]:''));
    W.close();
    // after a reload
    const b=await boot(S,'kingdoms-call-player-portal.html','p1');
    b.W.__rows=S.DB.game_messages.slice(); await openThread(b.W);
    check(/Reported/.test(b.doc.getElementById('msg-thread').textContent)&&!b.doc.querySelector('#msg-thread [onclick^="reportMessage("]'),'and still after a reload');
    b.W.close();
  }
  {
    const S=world();
    const {W,doc}=await boot(S,'kingdoms-call-player-portal.html','p1',w=>{ w.prompt=()=>null; });
    W.__rows=S.DB.game_messages.slice(); await openThread(W);
    await W.eval(`typeof reportMessage==='function'?reportMessage(11):null`); await wait(30);
    check(!S.DB.message_reports.length&&!!doc.querySelector('#msg-thread [onclick^="reportMessage("]'),'cancelling the reason sends no report');
    W.close();
  }
  // ── the GM ──
  {
    const S=world();
    S.DB.message_reports.push({id:1,message_id:11,game_id:'G1',reporter_index:0,reporter_user_id:'p1',reason:'Threats <b>now</b>',created_at:'2026-10-12T10:10:00Z'});
    const {W,doc,errs}=await boot(S,'kingdoms-call-gm-portal.html','gm1');
    await W.eval(`openGame('G1')`); await wait(200);
    const card=doc.getElementById('detail-reports-card'), t=card?card.textContent:'';
    check(!!card&&card.style.display!=='none','the game screen has a Reported dispatches card');
    check(/Veyholt/.test(t)&&/Thornmere/.test(t)&&/Threats <b>now<\/b>/.test(t)&&/Yield the ford <img/.test(t),
      'it shows the sender, the reporter, the reason and the text');
    check(!!card&&!card.querySelector('img,b'),'all as text, nothing from a player becomes markup');
    await W.eval(`typeof deleteReportedDispatch==='function'?deleteReportedDispatch(11):null`); await wait(100);
    check(!S.DB.game_messages.some(m=>m.id===11),'Delete removes the dispatch');
    check(/No dispatches reported/.test((doc.getElementById('detail-reports-card')||{}).textContent||''),'and the list empties');
    check(!errs.length,'GM: no page errors'+(errs.length?': '+errs[0].split('\n')[0]:''));
    W.close();
  }
  {
    const S=world();
    S.DB.game_players.push({id:'s3',game_id:'G1',user_id:'gm1',player_index:3,display_name:'Oakhold',orders_submitted:false,turn_report:'{}'});
    S.DB.message_reports.push({id:1,message_id:11,game_id:'G1',reporter_index:0,reporter_user_id:'p1',reason:'Threats',created_at:'2026-10-12T10:10:00Z'});
    const {W,doc}=await boot(S,'kingdoms-call-gm-portal.html','gm1');
    await W.eval(`openGame('G1')`); await wait(200);
    const t=(doc.getElementById('detail-reports-card')||{}).textContent||'';
    check(/go to the Overlord/.test(t)&&!/Yield the ford/.test(t),'a GM who plays in the game is told its reports go to the Overlord');
    W.close();
  }
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
