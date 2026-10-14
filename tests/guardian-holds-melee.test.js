// 2026-10-14 (batch item 2) — a guardian with a bow no longer tries to back out of a melee to shoot.
// Its plan still carries Fire actions; once the fight is at sword's length a Fire action is simply a
// blow (no break-away roll, so no round lost to a failed one). At bow range it still shoots, and a
// hero who chooses Fire in a melee still tries to break away, as before. pcAct is nested inside
// runTurn (tests/lib/pc-hooks.js).
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const {W, PC, base, MON, errs}=await bootPersonalCombat(['pcAct','pcCharCombatant','pcMonsterCombatant']);
  const st=range=>({fledBy:null,parley:false,stoleBy:null,range,mirror:null,feature:null});
  const hero=t=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,melee:3,archery:3},encounterPlan:{tactics:t,duelStance:'accept'}}); h.hp=h.maxHp=40; return h; };
  const archers=MON.filter(m=>(m.archery||0)>0);
  ok(archers.length>5,`guardians with a bow found (${archers.length})`);
  const act=(a,f,range,r)=>{ const n=[]; const s=st(range); pinned(W,r,()=>PC.pcAct(a,f,n,s)); return {t:n.join('\n'),s}; };
  let held=0, broke=[];
  archers.forEach(m=>{ const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); g.tactics=['FI']; g.tacIdx=0;
    const {t,s}=act(g,hero(['ME']),'melee',0.99);
    if(/attacks \(/.test(t)&&!/break away/.test(t)&&s.range==='melee') held++; else broke.push(m.name+': '+t.split('\n')[0]); });
  ok(!broke.length,`every guardian with a bow strikes in melee instead of breaking away (${held}/${archers.length}) ${broke.slice(0,2).join(' | ')}`);
  { const m=archers[0]; const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); g.tactics=['FI']; g.tacIdx=0;
    const {t}=act(g,hero(['ME']),'bow',0.5); ok(/shoots \(/.test(t),`at bow range ${m.name} still shoots`); }
  { const h=hero(['FI']); const m=MON.find(x=>!(x.archery>0)); const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp});
    const {t}=act(h,g,'melee',0.99); ok(/break away/.test(t),'a hero who chooses Fire in a melee still tries to break away'); }
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
