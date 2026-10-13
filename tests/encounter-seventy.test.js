// 2026-10-13 (item 11) — Encounter Character corners its quarry at 70% base (was 50%), +5% per level
// of the hunter's Spy, −5% per level of the quarry's, clamped 5–100%; a quarry of one's own realm is
// always met. pursuitCatchChance is nested inside runTurn, so a real turn is run first and the hook
// at "  // 4. Run all 5 phases" hands it back. The rulebook (twice) and the order form's hint say the
// same.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  let html=readPage('kingdoms-call-gm-portal.html');
  const a="  // 4. Run all 5 phases\n";
  if(html.split(a).length!==2){ console.log('anchor not unique or missing: '+a); process.exit(1); }
  html=html.replace(a,"  window.__PC={pursuitCatchChance};\n"+a);
  let ROWS={}; const WRITES=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},setup(w){
    w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
    w.console.error=(...x)=>{ const t=x.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
    w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.runTurn!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const setup=W.generateBotSetups([],2,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:10,rows:6},999,{seaPct:20});
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  ROWS={games_one:{id:'gd',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'gd',turn:1,status:'active',name:'T'};`);
  await W.runTurn(); await new Promise(r=>setTimeout(r,10));
  const PC=W.__PC; if(!PC||typeof PC.pursuitCatchChance!=='function'){ console.log('hook missing: pursuitCatchChance not exposed'); process.exit(1); }
  const ch=(player,spy)=>({id:'x'+player+spy,name:'X',player,skills:{spy},items:[]});
  const cc=(h,q)=>PC.pursuitCatchChance(ch(0,h),ch(1,q));
  ok(cc(0,0)===70,`Spy 0 against Spy 0: 70% (engine says ${cc(0,0)})`);
  ok(cc(2,0)===80,`Spy 2 against Spy 0: 80% (engine says ${cc(2,0)})`);
  ok(cc(0,3)===55,`Spy 0 against Spy 3: 55% (engine says ${cc(0,3)})`);
  ok(cc(5,0)===95,`Spy 5 against Spy 0: 95% (engine says ${cc(5,0)})`);
  ok(PC.pursuitCatchChance(ch(0,0),ch(0,5))===100,'a quarry of one\'s own realm is always met');

  const rules=readPage('kingdoms-call-rules.html'), pp=readPage('kingdoms-call-player-portal.html');
  const said=(rules.match(/<strong>(\d+)%, \+5% per level of your Spy, −5% per level of theirs<\/strong>/g)||[]);
  ok(said.length===2&&said.every(x=>/>70%/.test(x)),`the rulebook says 70% both times it states the chance (${said.map(x=>x.slice(8,11)).join(', ')})`);
  ok(/corner them each phase[^<]*70%, \+5% per level of your Spy, −5% per level of theirs/.test(pp),'the Encounter Character hint states the 70% chance');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
