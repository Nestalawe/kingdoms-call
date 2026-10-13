// 2026-10-14 (item 20) — an arrow does 1–3 damage plus ⌈Archery ÷ 2⌉ (the base was 2–5), for a hero
// and a guardian alike. The dice are pinned (lowest, then highest), so the test reads the exact range.
// pcArrowDamage is nested inside runTurn, so a real turn is run first and the hook at
// "  // 4. Run all 5 phases" hands it back. The rulebook (twice) and the Archery hover text say 1–3.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  let html=readPage('kingdoms-call-gm-portal.html');
  const a="  // 4. Run all 5 phases\n";
  if(html.split(a).length!==2){ console.log('anchor not unique or missing: '+a); process.exit(1); }
  html=html.replace(a,"  window.__PC={pcArrowDamage,pcCharCombatant,pcMonsterCombatant};\n"+a);
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
  const PC=W.__PC; if(!PC||typeof PC.pcArrowDamage!=='function'){ console.log('hook missing: pcArrowDamage not exposed'); process.exit(1); }
  const realRandom=W.Math.random;
  const pin=(r,f)=>{ W.Math.random=()=>r; try{ return f(); } finally{ W.Math.random=realRandom; } };
  const st=JSON.parse(WRITES.filter(w=>w.table==='games'&&w.val&&w.val.game_state).slice(-1)[0].val.game_state);
  const base=st.characters.find(c=>c.alive&&c.player!=null);
  for(const arch of [0,1,3,5,8]){
    const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,archery:arch}});
    const sk=Math.ceil(arch/2), lo=pin(0,()=>PC.pcArrowDamage(h)), hi=pin(0.999999,()=>PC.pcArrowDamage(h));
    ok(lo===1+sk&&hi===3+sk,`a hero with Archery ${arch}: an arrow does ${1+sk}–${3+sk} (it did ${lo}–${hi})`);
  }
  const MON=W.eval('MONSTERS_P'); const archers=MON.filter(m=>(m.archery||0)>0);
  ok(archers.length>0,`some guardians shoot (${archers.length})`);
  const bad=[]; archers.forEach(m=>{ const g=PC.pcMonsterCombatant({...m,_hpFull:m.hp}); const sk=Math.ceil((g.archeryRaw!=null?g.archeryRaw:(g.archery||0))/2);
    const lo=pin(0,()=>PC.pcArrowDamage(g)), hi=pin(0.999999,()=>PC.pcArrowDamage(g)); if(lo!==1+sk||hi!==3+sk) bad.push(`${m.name}: ${lo}–${hi}`); });
  ok(!bad.length,`a guardian's arrow is 1–3 + ⌈Archery÷2⌉ too (${bad.slice(0,3).join('; ')})`);
  const rules=readPage('kingdoms-call-rules.html'), pp=readPage('kingdoms-call-player-portal.html');
  ok(/Arrow damage: 1–3 plus ⌈your raw Archery ÷ 2⌉/.test(rules)&&/<strong>Arrows<\/strong> do 1–3 plus half the archer's Archery level/.test(rules),'the rulebook says 1–3 in both places');
  ok(/for 1–3 damage plus half your Archery/.test(pp)&&!/2–5 damage plus half your Archery/.test(pp),'the Archery hover text says 1–3');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
