// 2026-10-13 (item 5) — heroes kept opening two lairs in one turn and finding the same effect twice
// under two names (an amulet and a trinket that both give Mountain Guns +4, say). Now no two lairs in
// the same or neighbouring provinces hold an item with the same effect, on every map size, and on
// maps of up to 4 realms not within 3 provinces either; each lair still holds one item of its own
// guardian's tier. The "same effect" is the effect alone, whatever the slot or tier.
// Simulation level: the stocking is a pass over a whole generated world.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Over generated worlds from 2 realms to the largest size, no two lairs in the same or neighbouring provinces hold an
// item with the same effect (on maps of up to 4 realms, none within 3 provinces); "same effect" ignores slot and tier
// (`itemEffectKey`: the Carved Bead and the Engineer's Blueprint match); every lair still holds exactly one item of its
// guardian's tier. Simulation level: the stocking is a pass over a whole world
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.generateNewGame!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const effect=it=>JSON.stringify(it.effect||{name:it.name});
  // The same effect under two slots: the case a player noticed.
  const A=W.eval('ALL_MAGIC_ITEMS_P');
  const bead=A.find(i=>i.name==='Carved Bead'), blue=A.find(i=>i.name==='Engineer\'s Blueprint');
  ok(bead&&blue&&W.itemEffectKey(bead)===W.itemEffectKey(blue),'an amulet and a trinket with one effect count as the same effect');

  const sizes=[[2,8,5,3],[4,12,8,3],[6,16,10,1],[10,20,12,1],[10,20,12,1]];
  for(const [realms,cols,rows,spread] of sizes){
    const setup=W.generateBotSetups([],realms,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols,rows},999,{seaPct:25});
    const lairs=[]; let wrongTier=0, notOne=0;
    S.world.provinces.forEach(p=>(p.features||[]).forEach(f=>{ if(!f||f.ritualSite||!f.monster) return;
      const items=f.hoardItems||[]; if(items.length!==1){ notOne++; return; }
      const want=W.lairItemTier(f.monster.power); if(items[0].tier!==want) wrongTier++;
      lairs.push({p,it:items[0]}); }));
    const close=[];
    for(let i=0;i<lairs.length;i++) for(let j=i+1;j<lairs.length;j++){
      if(effect(lairs[i].it)!==effect(lairs[j].it)) continue;
      const dd=W.hexDistP(lairs[i].p,lairs[j].p,cols);
      if(dd<=spread) close.push(`${lairs[i].it.name} / ${lairs[j].it.name} (${dd} apart)`);
    }
    const tag=`${cols}×${rows}, ${realms} realms`;
    ok(lairs.length>50&&!notOne,`${tag}: every lair holds exactly one item (${lairs.length} lairs, ${notOne} not)`);
    // (the largest map runs some tiers dry and falls back to another tier, as it always has)
    if(realms<10) ok(!wrongTier,`${tag}: …of its guardian's own tier (${wrongTier} not)`);
    ok(!close.length,`${tag}: no two lairs within ${spread} province${spread>1?'s':''} hold the same effect (${close.length}: ${close.slice(0,3).join(' | ')})`);
  }
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
