// 2026-10-14 (item 9) — Lightning Bolt does 1–3 damage per level of Elemental Magic in personal
// combat (was 2–4), counted to level 5: 1–3 at level 1 … 5–15 at level 5 and above. The dice are
// pinned (every roll its lowest, then every roll its highest; the cast roll always succeeds), so the
// test reads the exact range. pcCastCombatSpell is nested inside runTurn, so a real turn is run first
// and the hook at "  // 4. Run all 5 phases" hands it back. The data file, the rulebook and the
// player portal's spell note say the same.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  let html=readPage('kingdoms-call-gm-portal.html');
  const a="  // 4. Run all 5 phases\n";
  if(html.split(a).length!==2){ console.log('anchor not unique or missing: '+a); process.exit(1); }
  html=html.replace(a,"  window.__PC={pcCastCombatSpell,pcCharCombatant};\n"+a);
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
  const PC=W.__PC; if(!PC||typeof PC.pcCastCombatSpell!=='function'){ console.log('hook missing: pcCastCombatSpell not exposed'); process.exit(1); }
  const st=JSON.parse(WRITES.filter(w=>w.table==='games'&&w.val&&w.val.game_state).slice(-1)[0].val.game_state);
  const base=st.characters.find(c=>c.alive&&c.player!=null);
  const mk=(skills)=>{ const c=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),id:'t'+Math.random(),player:null,items:[],skills:{...skills},temper:'Brave'}); c.hp=c.maxHp=999; return c; };
  const realD100=W.d100;
  const bolt=(lvl,r)=>{ W.d100=()=>1; const realRandom=W.kcRng.use(()=>r);
    try{ const caster=mk({elemental:lvl}), target=mk({}); const before=target.hp; PC.pcCastCombatSpell(caster,target,'Lightning Bolt',[],{}); return before-target.hp; }
    finally{ W.kcRng.use(realRandom); W.d100=realD100; } };
  for(const lvl of [1,2,3,4,5,7]){
    const n=Math.min(lvl,5), lo=bolt(lvl,0), hi=bolt(lvl,0.999999);
    ok(lo===n&&hi===3*n,`Elemental ${lvl}: the bolt does ${n}–${3*n} (it did ${lo}–${hi})`);
  }
  const data=readPage('kingdoms-call-data.js'), rules=readPage('kingdoms-call-rules.html'), pp=readPage('kingdoms-call-player-portal.html');
  ok(/deals 1–3 damage per caster level/.test(data),'the spell\'s description says 1–3 per level');
  ok(/Lightning Bolt<\/strong>[^\n]*Combat: <strong>1–3 damage per level<\/strong>/.test(rules),'the rulebook says 1–3 per level');
  ok(/'Lightning Bolt':'Combat: 1\\u20133 damage per caster level/.test(pp),'the player portal\'s spell note says 1–3 per level');
  ok(!/2–4 damage per (caster )?level|2\\u20134 damage per caster level/.test(data+rules+pp),'no page still says 2–4');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
