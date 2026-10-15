// A running or finished game, and its turn logs, are read only by its GM, its players and the Overlord; a game in
// setup by any account if public, or invited if private (P2-16, ruling D-10). Page level (jsdom, the in-memory
// database of lib/stub-db.js with that rule switched on: RULES.ownGamesOnly). Every page still works, and no read
// asks for a game or log outside the account's own:
//   - the player portal: My Games and its poll, open games (a private one only if invited), joining, a game's
//     report, and past turns in the Chronicle (from the realm's snapshot, or from the GM's log for older turns);
//   - the player portal for an account in no game: the open games;
//   - the GM portal: the game list, a game and its turn log, the Stats tab and "Forget deleted games";
//   - Master GM mode (the Overlord): every game, another GM's game, Stats;
//   - the Hall of Fame, with GM editing asked for; the Overlord page.
// The GM portal's start-up check that games has a meta column reads one game, any game, and looks only for an
// error; it's the one read allowed to ask beyond the account's own games.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const game=(id,name,gm,status,turn,gs,extra)=>({id,name,gm_user_id:gm,status,turn,max_players:4,max_turns:12,
  created_at:'2026-10-0'+id.slice(-1)+'T00:00:00Z',meta:null,game_state:JSON.stringify(gs||{}),...(extra||{})});
const report=JSON.stringify({playerSetup:{alignment:'Neutral'}});
function world(S){
  S.RULES.ownGamesOnly=true;
  S.DB.profiles.push({id:'gm2',name:'Warden Pell'},{id:'ov1',name:'Test Overlord'},{id:'p1',name:'Ada Thorn'},
    {id:'p2',name:'Bram Vey'},{id:'p3',name:'Cass Morrow'},{id:'p9',name:'Finn Ashby'});
  S.DB.site_admins.push({user_id:'ov1'});
  S.DB.game_masters.push({user_id:'gm2',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'});
  S.DB.games.push(
    game('G1','Marchwood','gm1','active',3,{world:'Marchwood world',characters:[]}),      // p1 and p2 play
    game('G2','Fenmoor','gm2','active',2,{world:'Fenmoor world'}),                          // p3 plays
    game('G3','Ashen Reach','gm2','complete',9,{world:'Ashen Reach world'}),                // p3 played
    game('G4','Open Vale','gm2','setup',0,{mapSize:'p4',botCount:0}),
    game('G5','Hidden Glen','gm2','setup',0,{mapSize:'p4',botCount:0,visibility:'private',invited:['p1']}),
    game('G6','Closed Glen','gm2','setup',0,{mapSize:'p4',botCount:0,visibility:'private',invited:['p3']}));
  S.DB.game_players.push(
    {id:'s10',game_id:'G1',user_id:'p1',player_index:0,display_name:'Thornmere',orders_submitted:true,turn_report:report},
    {id:'s11',game_id:'G1',user_id:'p2',player_index:1,display_name:'Veyholt',orders_submitted:false,turn_report:report},
    {id:'s20',game_id:'G2',user_id:'p3',player_index:0,display_name:'Morrowgate',orders_submitted:false,turn_report:report},
    {id:'s30',game_id:'G3',user_id:'p3',player_index:0,display_name:'Morrowgate',orders_submitted:false,turn_report:report});
  S.DB.turn_logs.push(
    {id:'l1',game_id:'G1',player_index:0,turn:2,entries:{turn:2,characters:[],log:[{text:'Thornmere holds the ford'}]}},
    {id:'l2',game_id:'G1',player_index:-1,turn:1,entries:[{text:'Thornmere founds a keep',actor:0}]},
    {id:'l3',game_id:'G1',player_index:-1,turn:2,entries:[{text:'Marchwood turn 2'}]},
    {id:'l4',game_id:'G2',player_index:-1,turn:1,entries:[{text:'Fenmoor turn 1'}]});
  for(const id of ['G1','G2','G-gone']){
    S.DB.turn_events.push({id:'te-'+id,game_id:id,turn:1,player_index:0,realm:'Realm of '+id,orders:'{}',pre:'{}',post:'{}',outcomes:'{}'});
    S.DB.game_results.push({id:'gr-'+id,game_id:id,player_index:0,realm:'Realm of '+id});
  }
  S.DB.game_records.push({id:'rec-G3',game_id:'G3',game_name:'Ashen Reach',gm_user_id:'gm2',winner_realm:'Morrowgate',
    finished_at:'2026-10-05T00:00:00Z',standings:[],records:{},totals:{},setup:{}});
}
async function boot(page,user,opts={}){
  const S=makeStub(); world(S); S.setUser(user);
  if(opts.stage) opts.stage(S);
  const errs=[];
  const dom=bootJsdom(readPage(page),{supabase:S.supabase,url:'https://example.org/'+page+(opts.query||''),setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
    w.alert=()=>{}; w.confirm=()=>true;
  }});
  await wait(opts.wait||900);
  return {S,W:dom.window,doc:dom.window.document,errs};
}
const text=(doc,id)=>(doc.getElementById(id)||{}).textContent||'';
const META_PROBE='games.select:other:id,meta';
function noOtherReads(S,errs,who){
  const other=S.CALLS.filter(c=>/^(games|turn_logs)\.select:other/.test(c)&&c!==META_PROBE);
  check(!other.length,`${who}: no read asks for another game or its logs`+(other.length?` (${[...new Set(other)].join('; ')})`:''));
  check(!errs.length,`${who}: no page errors`+(errs.length?': '+String(errs[0]).split('\n')[0]:''));
}

(async()=>{
  // ── the player portal, as a player in Marchwood (and invited to Hidden Glen) ──
  {
    const {S,W,doc,errs}=await boot('kingdoms-call-player-portal.html','p1');
    const mine=text(doc,'my-games-list'), open=text(doc,'open-games-list');
    check(/Marchwood/.test(mine)&&!/Fenmoor|Ashen Reach/.test(mine),'My Games lists Marchwood only');
    check(/1 of 2\s*realms? have sent orders/.test(mine),'and "1 of 2 realms have sent orders"');
    check(/Open Vale/.test(open)&&/Hidden Glen/.test(open)&&!/Closed Glen/.test(open),
      'open games: the public one and the private one p1 is invited to, not the other private one');
    await W.eval('pollForUpdates()');
    check(true,'the poll runs');

    await W.eval(`openReport('s10')`); await wait(150);
    check(/Marchwood/.test(text(doc,'report-title'))||W.eval('currentGamePlayer&&currentGamePlayer.games&&currentGamePlayer.games.name')==='Marchwood',
      'the report screen opens Marchwood'+` (title "${text(doc,'report-title').slice(0,60)}")`);
    await W.eval(`loadPastReport('G1',0,2)`); await wait(100);
    check(/Turn/.test(text(doc,'prev-report-banner')),'a past turn opens from the realm\'s snapshot');
    await W.eval(`loadPastReport('G1',0,1)`); await wait(100);
    check(/Thornmere founds a keep/.test(text(doc,'report-log')),'an older turn rebuilds its Chronicle from the GM\'s log');

    await W.eval(`showJoinGame('G4','Open Vale',4,0,'Warden Pell','4 realms')`); await wait(50);
    doc.getElementById('join-king-name').value='Aldric';
    doc.getElementById('join-alignment').value='Neutral';
    await W.eval(`doJoinGame('G4')`); await wait(100);
    check(S.DB.game_players.some(x=>x.game_id==='G4'&&x.user_id==='p1'),'joining an open game works'+` (${text(doc,'join-msg').slice(0,80)})`);
    noOtherReads(S,errs,'player portal');
    W.close();
  }
  // ── the player portal, as an account in no game ──
  {
    const {S,W,doc,errs}=await boot('kingdoms-call-player-portal.html','p9');
    const open=text(doc,'open-games-list');
    check(/Open Vale/.test(open)&&!/Hidden Glen|Closed Glen/.test(open),'an account in no game sees the public open game only');
    noOtherReads(S,errs,'player portal, no game');
    W.close();
  }
  // ── the GM portal, as the GM of Marchwood ──
  {
    const {S,W,doc,errs}=await boot('kingdoms-call-gm-portal.html','gm1',{wait:1500});
    const list=text(doc,'games-list');
    check(/Marchwood/.test(list)&&!/Fenmoor|Open Vale/.test(list),'the game list shows the GM\'s own game');
    await W.eval(`openGame('G1')`); await wait(200);
    check(text(doc,'detail-game-name')==='Marchwood','Marchwood opens');
    await W.eval(`loadTurnLog('G1',2)`); await wait(50);
    check(!!text(doc,'detail-log')&&!/No log entries/.test(text(doc,'detail-log')),'and its turn log');
    await W.eval('openStats(true)'); await wait(150);
    check(/Marchwood/.test(doc.getElementById('stats-game').textContent),'Stats names the GM\'s game');
    // the stand-in database serves every recorded turn as the Overlord's view does; a GM's own view has only theirs
    S.DB.turn_events=S.DB.turn_events.filter(r=>r.game_id!=='G2'); S.DB.game_results=S.DB.game_results.filter(r=>r.game_id!=='G2');
    await W.eval('openStats(true)'); await wait(100);
    await W.eval('forgetDeletedGames()'); await wait(100);
    check(S.DB.turn_events.map(r=>r.game_id).join()==='G1','"Forget deleted games" forgets only the deleted game');
    noOtherReads(S,errs,'GM portal');
    W.close();
  }
  // ── Master GM mode, as the Overlord ──
  {
    const {S,W,doc,errs}=await boot('kingdoms-call-gm-portal.html','ov1',{wait:1500});
    const n=doc.querySelectorAll('#games-list .game-card[data-game]').length;
    check(n===6,`the Overlord sees every game (${n})`);
    await W.eval(`openGame('G2')`); await wait(200);
    check(text(doc,'detail-game-name')==='Fenmoor','and opens another GM\'s game');
    await W.eval(`loadTurnLog('G2',1)`); await wait(50);
    check(!!text(doc,'detail-log')&&!/No log entries/.test(text(doc,'detail-log')),'and its turn log');
    await W.eval('openStats(true)'); await wait(150);
    check(/Fenmoor/.test(doc.getElementById('stats-game').textContent),'Stats names every game');
    noOtherReads(S,errs,'Master GM mode');
    W.close();
  }
  // ── the Hall of Fame, signed in, GM editing asked for ──
  for(const who of ['gm1','p1']){
    const {S,W,doc,errs}=await boot('kingdoms-call-leaderboard.html',who,{query:'?gm=1'});
    check(S.CALLS.includes('game_records.select'),`Hall of Fame as ${who}: it reads the Hall of Fame`);
    const editing=/GM editing on/.test(text(doc,'gm-pill'));
    check(who==='gm1'?editing:!editing,`Hall of Fame as ${who}: GM editing is ${who==='gm1'?'on (they run a game)':'off (they run none)'}`);
    noOtherReads(S,errs,'Hall of Fame as '+who);
    W.close();
  }
  // ── the Overlord page ──
  {
    const {S,W,doc,errs}=await boot('kingdoms-call-overlord.html','ov1');
    const body=doc.body.textContent;
    check(['Marchwood','Fenmoor','Ashen Reach','Open Vale','Hidden Glen','Closed Glen'].every(n=>body.includes(n)),'the Overlord page lists every game');
    noOtherReads(S,errs,'Overlord page');
    W.close();
  }

  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
