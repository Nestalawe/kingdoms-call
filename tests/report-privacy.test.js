// 2026-09-27 (item 6) — does another realm's private business turn up in your report?
// Runs real all-bot games, captures EVERY per-realm turn_report the engine writes, and runs the
// report-leak check (lib/report-leaks.ts, P1-04c) on each turn: no realm reads
// another realm's private line, names a realm it hasn't met, or sees a hero under Invisibility.
// It also counts how many DIFFERENT realms were shown the same line.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const {checkLeaks,describeBreaches}=require('./lib/invariants.ts');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html', GAMES=+process.argv[3]||3, TURNS=+process.argv[4]||10, BOTS=+process.argv[5]||5;
let html=readPage(GMF);
// Reports are only built for HUMAN slots; an all-bot game therefore writes none. Build one for
// EVERY realm so the visibility filter can be measured on real bot activity.
if(html.split("const activePlayers=freshPlayers.filter(p=>p.user_id);").length!==2) throw new Error('activePlayers anchor');
html=html.replace("const activePlayers=freshPlayers.filter(p=>p.user_id);","const activePlayers=freshPlayers;");
let ROWS={}; const WRITES=[];
const sbStub=()=>cannedStub({rows:()=>ROWS,writes:WRITES});
const errors=[];
const dom=bootJsdom(html,{supabase:{createClient:()=>sbStub()},
  setup(w){
    w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message)));
    w.console.error=(...a)=>errors.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};}});
// Lines that are ONE realm's own business are the leak check's PRIVATE_LINES (lib/report-leaks.ts).
// Lines an onlooker standing in the province may legitimately see — counted, not failed.
const WATCHED=[
  ['Harvest the Field',       /💀 Harvest the Field/],
  ['Consecrate',              /consecrates /],
  ['Skeletal Armies',         /calls forth .* rises from the graves/],
];
(async()=>{
  await new Promise(r=>setTimeout(r,500)); const W=dom.window;
  if(typeof W.runTurn!=='function'){ console.log('engine did not boot'); errors.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const seenBy={};   // line text -> Set of player indices shown it
  let turns=0, reportsSeen=0, linesSeen=0; const leaks=[];
  for(let g=0;g<GAMES;g++){
    const setup=W.generateBotSetups([],BOTS,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    let S=await W.generateNewGame(setup,{cols:12,rows:7},999,{seaPct:35+5*g}); S.botDifficulty='hard'; S.botDiplomacy='normal';
    const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
    const byGp={}; players.forEach(p=>byGp[p.id]=p.player_index);
    for(let t=1;t<=TURNS;t++){
      ROWS={games_one:{id:'g'+g,name:'T',turn:t,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
      W.eval(`currentGame={id:'g${g}',turn:${t},status:'active',name:'T'};`); WRITES.length=0;
      try{ await W.runTurn(); }catch(e){ console.log('runTurn threw',e.message); break; }
      await new Promise(r=>setTimeout(r,10));
      // per-realm reports are written to turn_logs with the realm's player_index
      WRITES.filter(w=>w.table==='turn_logs'&&w.val&&w.val.player_index>=0&&w.val.entries).forEach(w=>{
        const pi=w.val.player_index; const rep=w.val.entries;
        reportsSeen++; (rep.lastTurnLog||[]).forEach(e=>{ linesSeen++; const k=`g${g}t${t}|${e.text}`; (seenBy[k]=seenBy[k]||new Set()).add(pi); });
      });
      if(g===0&&t===1){ const tally={}; WRITES.forEach(w=>{ const k=w.table+':'+Object.keys(w.val||{}).join(','); tally[k]=(tally[k]||0)+1; }); console.log('WRITES tally t1:', JSON.stringify(tally)); }
      const gsW=[...WRITES].reverse().find(w=>w.table==='games'&&w.val&&w.val.game_state);
      if(!gsW) break; const before=S; S=JSON.parse(gsW.val.game_state); turns++;
      const logs=WRITES.filter(w=>w.table==='turn_logs'&&w.val&&w.val.entries);
      const broke=checkLeaks({before,after:S,gmLog:logs.filter(w=>w.val.player_index===-1).flatMap(w=>w.val.entries),
        telemetry:[],players:[],reports:logs.filter(w=>w.val.player_index>=0).map(w=>({realm:w.val.player_index,report:w.val.entries}))});
      if(broke.length) leaks.push(describeBreaches(`game ${g} turn ${t}`,broke));
    }
  }
  let fail=0;
  console.log(`realm reports scanned: ${reportsSeen} reports, ${linesSeen} chronicle lines, over ${turns} resolved turns`);
  { const multi=Object.values(seenBy).filter(x=>x.size>1).length; console.log(`distinct lines: ${Object.keys(seenBy).length}; lines shown to MORE THAN ONE realm: ${multi}\n`); }
  WATCHED.forEach(([label,re])=>{
    const hits=Object.entries(seenBy).filter(([k])=>re.test(k));
    console.log(`[watched] ${label.padEnd(20)} events=${String(hits.length).padStart(4)}  shown to more than one realm=${hits.filter(([,s])=>s.size>1).length}`);
  });
  fail=leaks.length; leaks.slice(0,5).forEach(l=>console.log('  ✗ '+l.split('\n').join('\n    ')));
  console.log(fail===0?'\nOK — no report leaked':`\nFAIL — ${fail} turn(s) leaked`);
  errors.slice(0,3).forEach(e=>console.log('  !',e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errors.length?1:0);
})();
