// 2026-10-14 (batch item 5) — Holy Symbol bites the unclean half as hard again (×1.5, was ×2), and the
// unclean are told by their KIND, not by their name: every undead and every fiend, and nothing else.
// Before, the Dust Devil (an elemental) was doubled because its name holds "Devil", and the Chaos
// Knight (a fiend) was not. Checked on the to-hit penalty at White 5 (−40% plain, −60% unclean) for
// every guardian not weak to White Magic (a weakness doubles the effect on top). The spell is nested
// inside runTurn (tests/lib/pc-hooks.js).
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const {W, PC, base, MON, errs}=await bootPersonalCombat(['pcCharCombatant','pcMonsterCombatant','pcCastCombatSpell']);
  const st=()=>({fledBy:null,parley:false,stoleBy:null,range:'melee',mirror:null,feature:null});
  const pen=m=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,white:5},encounterPlan:{tactics:['ME'],duelStance:'accept'}});
    const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); g.status.hitPenalty=0;
    pinned(W,0.01,()=>PC.pcCastCombatSpell(h,g,'Holy Symbol',[],st())); return g.status.hitPenalty; };
  const notWeak=MON.filter(m=>!(m.weak&&m.weak.kind==='school'&&m.weak.key==='white'));
  const bad=[];
  notWeak.forEach(m=>{ const want=(m.cat==='undead'||m.cat==='fiend')?60:40, got=pen(m); if(got!==want) bad.push(`${m.name} (${m.cat}) −${got}%`); });
  ok(!bad.length,`Holy Symbol at White 5: −60% to hit against undead and fiends, −40% against the rest (${notWeak.length} guardians; wrong: ${bad.slice(0,4).join(', ')})`);
  ok(pen(MON.find(m=>m.name==='Dust Devil'))===40,'the Dust Devil (an elemental) is not unclean');
  ok(pen(MON.find(m=>m.name==='Chaos Knight'))===60,'the Chaos Knight (a fiend) is');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
