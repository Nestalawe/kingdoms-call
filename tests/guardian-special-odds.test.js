// 2026-10-14 (batch item 4) — a guardian's special comes off half as often again: every special's
// chance is ×1.5 the old figure, rounded, and never above 95%. Pinned on a spread of the old table
// (35 → 53, 45 → 68, 50 → 75, 60 → 90, 65 and 70 → 95), so the whole table is checked too: no
// special below 53% or above 95%. Running games take the new odds at their next turn
// (GUARDIAN_TABLE_VER, migrateLairGuardiansV2). Level 1: the table and the migration are module level.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message))); w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=()=>{}; }});
  await new Promise(r=>setTimeout(r,400)); const W=d.window;
  const MON=W.eval('MONSTERS_P'); ok(MON.length>100,`the guardian table was read (${MON.length})`);
  const sp=(g,s)=>{ const m=MON.find(x=>x.name===g); const x=m&&(m.spells||[]).find(y=>y.name===s); return x?x.castChance:null; };
  [['Crag Harpy','Talon Rake',53],['Goblin Skirmisher','Dirty Trick',68],['Dire Wolf','Lunging Bite',75],['Dire Rat','Plague Bite',90],
   ['Elder Dragon','Fire Breath',95],['Bandit King','Battle Cry',95],['Rock Giant','Tremor Stomp',60],['Lich Sovereign','Paralyse',83]]
   .forEach(([g,s,want])=>ok(sp(g,s)===want,`${g}'s ${s} comes off ${want}% of the time (it is ${sp(g,s)})`));
  const all=MON.flatMap(m=>(m.spells||[]).map(s=>[m.name,s]));
  const out=all.filter(([,s])=>!(s.castChance>=53&&s.castChance<=95));
  ok(!out.length,`every special is 53–95% (${out.slice(0,3).map(([n,s])=>n+' '+s.name+' '+s.castChance).join('; ')})`);
  // a running game's guardian is re-read
  const gs={_guardiansVer:18,world:{provinces:[{features:[{monster:{name:'Dire Wolf',hp:16,spells:[{name:'Lunging Bite',castChance:50}]}}]}]}};
  W.migrateLairGuardiansV2(gs);
  ok(gs.world.provinces[0].features[0].monster.spells[0].castChance===75,'a running game\'s Dire Wolf takes the new odds at its next turn');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
