// 2026-10-14 (batch item 8) — clearing a lair and carrying off its hoard no longer trains Thief. The
// hero still earns what a won fight earns (Melee from the blows); only the Thief roll for the hoard
// is gone. Level 2 (scenario): the Search Lair order and its rewards live inside runTurn. Every
// experience roll is recorded by a wrapper around the top-level trySkillGain, and the guardian is staged at 1 HP
// against a strong hero, so the fight's outcome does not depend on the dice.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
// every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
const XP_RECORD="{ const tryOne=trySkillGain; trySkillGain=function(turnContext, char, skill, base, narr, mult){ if(window.__xp) window.__xp.push({id:char&&char.id,skill,base,mult}); return tryOne.apply(this, arguments); }; }";
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  W.eval(XP_RECORD);
  W.__xp=[];
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
    const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    let P=null, li=-1;
    for(const q of S.world.provinces){ const i=(q.features||[]).findIndex(f=>f&&f.monster&&!f.cleared&&f.monster.power==='Weak'); if(i>=0&&q.terrain!=='sea'){ P=q; li=i; break; } }
    if(!H||!P) throw new Error('could not stage: no hero or no Weak lair');
    S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==H.id); }); P.characters=[...(P.characters||[]),H.id]; H.location=P.id; H.locationName=P.name;
    const f=P.features[li]; f.discovered=true; f.monster.hp=1; f.monster._hpFull=1; f.monster.spells=[]; delete f.monster.passive; delete f.monster.passives;
    H.items=[]; H.hp=H.maxHp=40; H.skills={...H.skills,melee:5,thief:0}; H.encounterPlan={tactics:['ME','ME','ME','ME','ME'],duelStance:'refuse'};
    (S.discoveredLairs=S.discoveredLairs||{});
    return {H,P,li}; },
    orders:(S,c)=>({[c.H.id]:plan(order('search',c.li))})});
  const H=r.extra.H, f=r.S2.world.provinces[r.extra.P.id].features[r.extra.li];
  ok(f&&f.cleared,`the hero clears the lair (${(r.text(H.id).match(/[^\n]*(lair|guardian)[^\n]*/i)||[''])[0].slice(0,120)})`);
  const mine=W.__xp.filter(x=>x.id===H.id);
  ok(mine.some(x=>x.skill==='melee'),'the fight still rolls for Melee experience');
  ok(!mine.some(x=>x.skill==='thief'),`carrying off the hoard rolls no Thief experience (rolls: ${mine.map(x=>x.skill).join(', ')})`);
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
