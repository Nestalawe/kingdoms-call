// 2026-10-08 (item 3) — overtures of peace and alliance.
//   (a) A realm courted by a realm it has never met now counts as having met it, so it can answer.
//   (b) In a game of three realms or fewer no alliance can be forged, so an offer of one is not sent:
//       nobody is told to answer an offer that can't be accepted.
//   (c) The courted realm's Diplomacy card shows the offer it received last turn.
// The resolution is inline in runTurn, so this runs real turns with two human realms whose orders
// carry the declarations.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html', PPF=process.argv[3]||'kingdoms-call-player-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
let ROWS={}; const WRITES=[];
function boot(file,extra){
  let html=readPage(file); if(extra) html=extra(html);
  const errs=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{};w.console.log=()=>{};}});
  return {d,errs};
}
(async()=>{
  const {d:gd,errs:gerr}=boot(GMF,h=>h.replace("const activePlayers=freshPlayers.filter(p=>p.user_id);","const activePlayers=freshPlayers;"));
  await new Promise(r=>setTimeout(r,500)); const W=gd.window;
  if(typeof W.runTurn!=='function'){ console.log('GM portal did not boot'); gerr.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }

  // Realms 0 and 1 are human; realm 0 proposes an alliance (or peace) to realm 1.
  async function play(n,relation){
    const setup=W.generateBotSetups([],n,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols:16,rows:9},999,{seaPct:30});
    S.safeStart=false;
    S.players[0]._encountered=[1]; S.players[1]._encountered=[];   // realm 1 has never met realm 0
    S.relations=S.relations||{}; if(relation!=='neutral') S.relations['0-1']=relation;
    const orders=(pi)=>JSON.stringify({orders:{},encounterPlans:{},forTurn:S.turn,diplomacy:pi===0?{1:'treat'}:{}});
    const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:sp.id<2?'u'+sp.id:null,player_index:sp.id,display_name:sp.name,
      orders:sp.id<2?orders(sp.id):null,orders_submitted:sp.id<2,turn_report:JSON.stringify({isBot:sp.id>=2})}));
    ROWS={games_one:{id:'go',name:'T',turn:S.turn,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
    W.eval(`currentGame={id:'go',turn:${S.turn},status:'active',name:'T'};`); WRITES.length=0;
    await W.runTurn(); await new Promise(r=>setTimeout(r,10));
    const w=[...WRITES].reverse().find(x=>x.table==='games'&&x.val&&x.val.game_state);
    const S2=w?JSON.parse(w.val.game_state):null;
    const repOf=pi=>(WRITES.filter(x=>x.table==='turn_logs'&&x.val&&x.val.player_index===pi).slice(-1)[0]||{val:{}}).val.entries||{};
    return {S2,rep0:repOf(0),rep1:repOf(1),names:S.players.map(p=>p.name)};
  }
  const lines=rep=>(rep.lastTurnLog||[]).map(e=>typeof e==='string'?e:(e&&e.text)||'');

  // ── a 4-realm game, neutral: an offer of alliance from a stranger ──
  let r=await play(4,'neutral');
  ok(!!r.S2,'the 4-realm turn resolved');
  const told=lines(r.rep1).filter(t=>/overture/.test(t));
  ok(told.some(t=>t.includes(r.names[0])&&/alliance/.test(t)),`realm 1 is told of realm 0's offer of alliance (${told.length} line(s))`);
  ok(r.S2&&(r.S2.players[1]._encountered||[]).includes(0),'(a) being courted counts as meeting the realm that sent it');
  const k0=((r.rep1.diplomacy||{}).known||[]).find(k=>k.index===0);
  ok(!!k0,'(a) the sender is on realm 1\'s Diplomacy card, so it can answer');
  ok(k0&&k0.offeredUs==='alliance',`(c) the card entry says an alliance was offered (${k0&&k0.offeredUs})`);
  const k1=((r.rep0.diplomacy||{}).known||[]).find(k=>k.index===1);
  ok(k1&&!k1.offeredUs,'(c) the sender\'s own card shows no incoming offer from realm 1');

  // ── a 4-realm game at war: an offer of peace ──
  r=await play(4,'enemy');
  const k0p=((r.rep1.diplomacy||{}).known||[]).find(k=>k.index===0);
  ok(k0p&&k0p.offeredUs==='peace',`(c) an offer of peace is labelled peace (${k0p&&k0p.offeredUs})`);

  // ── a 3-realm game, neutral: alliances are impossible ──
  r=await play(3,'neutral');
  ok(!!r.S2,'the 3-realm turn resolved');
  ok(!lines(r.rep1).some(t=>/overture/.test(t)),'(b) in a 3-realm game nobody is invited to answer an impossible alliance');
  ok(!lines(r.rep0).some(t=>/overture/.test(t)&&/unanswered/.test(t)),'(b) and the sender is not told their impossible offer "went unanswered"');
  const k0s=((r.rep1.diplomacy||{}).known||[]).find(k=>k.index===0);
  ok(!k0s||!k0s.offeredUs,'(b) no offer badge for an alliance that cannot be made');
  // ...but peace can still be offered in a small game.
  r=await play(3,'enemy');
  ok(lines(r.rep1).some(t=>/overture of peace/.test(t)),'(b) an offer of peace in a 3-realm game is still reported');

  // ── (c) what the card shows ──
  const {d:pd,errs:perr}=boot(PPF);
  await new Promise(r2=>setTimeout(r2,400)); const P=pd.window;
  const el=P.document.createElement('div');
  P._renderDiplomacyInto(el,{kingdom:{alignment:'Good'},diplomacy:{alliancesAllowed:true,known:[
    {index:0,name:'Realm Offering',color:'#900',alignment:'Good',relation:'neutral',offeredUs:'alliance'},
    {index:2,name:'Realm At War',color:'#090',alignment:'Evil',relation:'enemy',offeredUs:'peace'},
    {index:3,name:'Realm Silent',color:'#009',alignment:'Neutral',relation:'neutral'}]}},true);
  const html=el.innerHTML; const block=n=>{ const i=html.indexOf(n); const j=html.indexOf('</div></div>',i); return html.slice(i,j<0?html.length:j); };
  ok(/offered an alliance/i.test(block('Realm Offering')),'(c) the card shows "offered an alliance"');
  ok(/offered peace/i.test(block('Realm At War')),'(c) the card shows "offered peace"');
  ok(!/offered/i.test(block('Realm Silent')),'(c) no badge where nothing was offered');

  console.log(`\n${pass} pass, ${fail} fail · GM page errors ${gerr.length}, player page errors ${perr.length}`);
  gerr.slice(0,2).forEach(e=>console.log('  ! GM',e.split('\n').slice(0,2).join(' | ')));
  perr.slice(0,2).forEach(e=>console.log('  ! PP',e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||gerr.length||perr.length?1:0);
})();
