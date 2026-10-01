// 2026-09-27 (items 7 & 8) — a conceded realm in the Diplomacy card, and the Reckoning called
// the moment every rival but one has quit.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html', PPF=process.argv[3]||'kingdoms-call-player-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
let ROWS={}; const WRITES=[];
const sbStub=()=>cannedStub({rows:()=>ROWS,writes:WRITES});
function boot(file,extra){
  let html=readPage(file);
  if(extra) html=extra(html);
  const errs=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>sbStub()},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
      w.console.warn=()=>{};w.console.log=()=>{};}});
  return {d,errs};
}
(async()=>{
  // ── item 8 — every rival concedes ──
  const {d:gd,errs:gerr}=boot(GMF,h=>h.replace("const activePlayers=freshPlayers.filter(p=>p.user_id);","const activePlayers=freshPlayers;"));
  await new Promise(r=>setTimeout(r,500)); const W=gd.window;
  if(typeof W.runTurn!=='function'){ console.log('GM portal did not boot'); gerr.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const setup=W.generateBotSetups([],4,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  let S=await W.generateNewGame(setup,{cols:12,rows:7},999,{seaPct:35}); S.botDifficulty='hard';
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  const runOne=async(state,turn)=>{
    ROWS={games_one:{id:'gc',name:'T',turn,status:'active',game_state:JSON.stringify(state),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
    W.eval(`currentGame={id:'gc',turn:${turn},status:'active',name:'T'};`); WRITES.length=0;
    await W.runTurn(); await new Promise(r=>setTimeout(r,10));
    const w=[...WRITES].reverse().find(x=>x.table==='games'&&x.val&&x.val.game_state);
    return {state:w?JSON.parse(w.val.game_state):null, writes:[...WRITES]};
  };
  let r=await runOne(S,1); S=r.state;
  ok(!!S && !S.gameOver,'item 8: a normal turn does not end the game');
  // every realm but #1 concedes; make sure the survivor has met them all so the Diplomacy card has
  // rows to show (two bot turns are not enough for four realms to meet on a 12x7 map).
  S.players.forEach((p,i)=>{ if(i!==1){ p.conceded=true; p.concededTurn=S.turn; } });
  S.players[1]._encountered=S.players.map((_,i)=>i).filter(i=>i!==1);
  r=await runOne(S,S.turn); const S2=r.state;
  ok(!!S2 && !!S2.gameOver,'item 8: the game ends the turn the last rival concedes');
  if(S2&&S2.gameOver){
    ok(S2.gameOver.winner===1,`item 8: the realm still standing wins (winner=${S2.gameOver.winner})`);
    ok(S2.gameOver.byConcession===true,'item 8: recorded as won by concession');
    ok(S2.gameOver.byReckoning===true,'item 8: the Reckoning was called');
    const st=S2.gameOver.standings||[];
    ok(st.length===S2.players.length,`item 8: every realm is in the final standings (${st.length}/${S2.players.length})`);
    ok(st.some(x=>Array.isArray(x.titles)),'item 8: the standings carry each realm\'s titles');
    ok(st.every(x=>typeof x.score==='number'),'item 8: every realm has a Legacy score');
  }
  const gmLog=(r.writes.find(w=>w.table==='turn_logs'&&w.val&&w.val.player_index===-1)||{val:{}}).val.entries||[];
  const txt=gmLog.map(e=>e&&e.text||'').join('\n');
  ok(/THE RECKONING IS CALLED/.test(txt),'item 8: the world is told the Reckoning has been called');
  ok(/THE GAME IS DECIDED/.test(txt),'item 8: the result is announced');
  // the surviving realm's report must show the conceded rivals as such
  const rep=(r.writes.filter(w=>w.table==='turn_logs'&&w.val&&w.val.player_index===1).slice(-1)[0]||{val:{}}).val.entries;
  const known=(rep&&rep.diplomacy&&rep.diplomacy.known)||[];
  ok(known.length>0,'item 7: the survivor has encountered realms to list');
  ok(known.every(k=>k.conceded===true),`item 7: every rival is flagged conceded in the report payload (${known.filter(k=>k.conceded).length}/${known.length})`);

  // ── item 7 — what the Diplomacy card actually renders ──
  const {d:pd,errs:perr}=boot(PPF);
  await new Promise(r2=>setTimeout(r2,400)); const P=pd.window;
  if(typeof P._renderDiplomacyInto!=='function'){ console.log('player portal: _renderDiplomacyInto not found'); perr.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const el=pd.window.document.createElement('div');
  const report={kingdom:{alignment:'Good'},diplomacy:{alliancesAllowed:true,known:[
    {index:0,name:'Quit Realm',color:'#900',alignment:'Evil',relation:'enemy',conceded:true,concededTurn:7,eliminated:false},
    {index:2,name:'Live Realm',color:'#090',alignment:'Good',relation:'neutral',conceded:false,eliminated:false},
    {index:3,name:'Dead Dynasty',color:'#009',alignment:'Neutral',relation:'neutral',conceded:false,eliminated:true},
  ]}};
  P.eval("diploChoices={0:'treat'};");  // a declaration already pending against the realm that quit (top-level let — reach it through eval)
  P._renderDiplomacyInto(el,report,true);
  const html=el.innerHTML;
  const block=(name)=>{ const i=html.indexOf(name); const j=html.indexOf('</div></div>',i); return html.slice(i,j<0?html.length:j); };
  const quit=block('Quit Realm'), live=block('Live Realm'), dead=block('Dead Dynasty');
  ok(/Conceded/.test(quit),'item 7: the conceded realm is labelled Conceded');
  ok(/turn 7/.test(quit),'item 7: it says which turn they quit');
  ok(!/setDiploChoice/.test(quit),'item 7: no treat / declare buttons against a realm that has quit');
  ok(/withdrawn from the game/.test(quit),'item 7: the card explains why');
  ok(P.eval("diploChoices[0]===undefined"),'item 7: a pending declaration against them is dropped');
  ok(/setDiploChoice\(2,/.test(live),'item 7: a live realm keeps its diplomacy controls');
  ok(/Extinguished/.test(dead)&&!/setDiploChoice\(3,/.test(dead),'item 7: an extinguished dynasty is shown and cannot be treated with');
  console.log(`\n${pass} pass, ${fail} fail · GM page errors ${gerr.length}, player page errors ${perr.length}`);
  gerr.slice(0,2).forEach(e=>console.log('  ! GM',e.split('\n').slice(0,2).join(' | ')));
  perr.slice(0,2).forEach(e=>console.log('  ! PP',e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||gerr.length||perr.length?1:0);
})();
