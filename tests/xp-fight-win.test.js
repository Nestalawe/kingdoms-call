// 2026-10-14 (batch item 12) — any hero who wins a personal fight rolls for Melee experience at the
// standard rate, on top of the rolls for each blow, arrow or spell that landed. Staged with the foe
// already at 0 HP, so the hero wins without landing anything: the only Melee roll is the win's. The
// loser rolls no win roll.
// resolvePersonalCombat is nested inside runTurn (tests/lib/pc-hooks.js); every experience roll is
// recorded by a hook at the top of trySkillGain.
const {bootPersonalCombat}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const TSG="  function trySkillGain(char, skill, base, narr, mult){\n";
(async()=>{
  const {W, PC, base, MON, errs, state}=await bootPersonalCombat(['resolvePersonalCombat','pcCharCombatant','pcMonsterCombatant'],{inject:[[TSG,TSG+"    if(window.__xp) window.__xp.push({id:char&&char.id,skill,base,mult});\n"]]});
  const real=state.characters.filter(c=>c.alive&&c.player!=null);
  const hero=c=>{ const h=PC.pcCharCombatant(c); h.hp=h.maxHp=40; return h; };
  const g=()=>{ const m=MON.find(x=>x.name==='Owlbear'); return PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); };
  const live=real;
  ok(live.length>=2,'two living heroes in the world');
  { W.__xp=[]; const A=hero(live[0]), B=g(); B.hp=0; const res=PC.resolvePersonalCombat(A,B,{maxRounds:20});
    ok(res.winner===A,'the hero wins (the guardian was staged at 0 HP)');
    const mine=W.__xp.filter(x=>x.id===live[0].id&&x.skill==='melee');
    ok(mine.length===1&&mine[0].base===0.10,`…and rolls once for Melee at the standard rate (${JSON.stringify(mine)})`); }
  { W.__xp=[]; const A=hero(live[0]), B=hero(live[1]); A.hp=0; const res=PC.resolvePersonalCombat(A,B,{maxRounds:20});
    ok(res.winner===B,'in a duel the second hero wins');
    ok(W.__xp.some(x=>x.id===live[1].id&&x.skill==='melee'&&x.base===0.10),'the winner rolls for Melee');
    ok(!W.__xp.some(x=>x.id===live[0].id&&x.skill==='melee'&&x.base===0.10),'the fallen loser takes no win roll'); }
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
