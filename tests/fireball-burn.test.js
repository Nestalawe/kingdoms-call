// 2026-10-14 (batch item 6) — Fireball burns 10% of the target's maximum HP a round plus 2% a level of
// Elemental (counted to 5: 12% at Elemental 1, 20% at 5), for three rounds; it was 3% + 1% a level.
// A guardian's spell resistance now cuts the burn as it cuts any spell's harm (a 40% ward: 20% → 12%);
// a weakness to Elemental doubles it, as before. The spell is nested inside runTurn
// (tests/lib/pc-hooks.js).
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const {W, PC, base, MON, errs}=await bootPersonalCombat(['pcCharCombatant','pcMonsterCombatant','pcCastCombatSpell']);
  const st=()=>({fledBy:null,parley:false,stoleBy:null,range:'melee',mirror:null,feature:null});
  const plainM=MON.find(m=>m.name==='Owlbear');
  const burn=(lvl,setup)=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,elemental:lvl},encounterPlan:{tactics:['ME'],duelStance:'accept'}});
    const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(plainM)),_hpFull:plainM.hp}); g.arm=null; g.weak=null; g.hp=g.maxHp=100; if(setup) setup(g);
    pinned(W,0.01,()=>PC.pcCastCombatSpell(h,g,'Fireball',[],st())); const d=(g.status.dot||[]).find(x=>/Fireball/.test(x.label||'')); return d?[d.dmg,d.rounds]:[0,0]; };
  [[1,12],[3,16],[5,20],[7,20]].forEach(([lvl,pct])=>{ const [d,r]=burn(lvl); ok(d===pct&&r===3,`Elemental ${lvl}: a 100 HP guardian burns ${pct} a round for 3 rounds (got ${d} for ${r})`); });
  { const [d]=burn(5,g=>{ g.arm=W.pcArmourMerge(null,{ward:'spellPct',pct:40},'Nightmare Veil'); }); ok(d===12,`a 40% spell ward cuts the Elemental 5 burn from 20 to 12 (got ${d})`); }
  { const [d]=burn(5,g=>{ g.weak={kind:'school',key:'elemental',name:'Test',desc:'test'}; }); ok(d===40,`a guardian weak to Elemental burns twice as hard (got ${d})`); }
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
