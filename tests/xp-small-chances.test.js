// 2026-10-14 (batch item 11) — failing still teaches a little. At the small (frequent-action) rate:
//   * a fizzled Cast Spell rolls for the spell's school;
//   * a general who loses a battle and lives rolls for Tactical (Naval at sea);
//   * a hero who loses a personal fight and lives (beaten and spared, or fled) rolls for Melee.
// Level 2 (scenario) for the battle, which lives inside runTurn: the battle is staged hopeless, and every experience
// roll is recorded by a wrapper around the top-level trySkillGain. The fight is tests/unit/xp-fled-fight.test.ts
// (level 1: resolvePersonalCombat is top-level since plan P1-08e). A failed Spy (on a province or a hero) and a failed
// Steal are cases of tests/lib/espionage-order-cases.ts (plan P1-08j6), and a fizzled Cast Spell one of
// tests/lib/cast-spell-order-cases.ts (plan P1-08j7): their rolls fixed for a whole turn, no hook.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
// every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
const XP_RECORD="{ const tryOne=trySkillGain; trySkillGain=function(turnContext, char, skill, base, narr, mult){ if(window.__xp) window.__xp.push({id:char&&char.id,skill,base,mult}); return tryOne.apply(this, arguments); }; }";
(async()=>{
  const sc=await bootScenario({}); const W=sc.W;
  W.eval(XP_RECORD);
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  // ── a lost battle ──
  W.__xp=[];
  const r2=await sc.turn({realms:2,seaPct:10,prepare(S){
    const G2=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    let N=null,P=null;
    for(const q of S.world.provinces){ if(q.terrain==='sea'||q.owner!=null||!(q.neutralDefenders||[]).length) continue;
      const pp=nb(S,q).find(y=>y.terrain!=='sea'&&y.owner===0); if(pp){ N=q; P=pp; break; } }
    if(!N){ for(const q of S.world.provinces){ if(q.terrain==='sea'||q.owner!=null||!(q.neutralDefenders||[]).length) continue;
      const pp=nb(S,q).find(y=>y.terrain!=='sea'); if(pp){ N=q; P=pp; break; } } }
    if(!G2||!N) throw new Error('could not stage a battle');
    place(S,G2,P); G2.items=[]; G2.hp=G2.maxHp=40; G2.encounterPlan={tactics:['ME'],duelStance:'refuse'};
    G2.armies=[{type:'Levies',quality:'Green',unitName:'the Last Hope'}];
    N.neutralDefenders=Array.from({length:8},(_,i)=>({type:'Men-at-Arms',quality:'Elite',unitName:'Wall '+i}));
    S.characters.filter(c=>c.player==null&&c.location===N.id).forEach(c=>{ c.encounterPlan={tactics:['ME'],duelStance:'refuse'}; });
    return {G2,N}; },
    orders:(S,x)=>({[x.G2.id]:plan(order('move',x.N.id))})});
  const G2=r2.extra.G2, after=r2.S2.characters.find(c=>c.id===G2.id);
  const t2=r2.text(G2.id);
  ok(/repelled|hold against|retreat/i.test(t2),'the general loses the battle');
  ok(after&&after.alive,'…and lives');
  ok(W.__xp.some(x=>x.id===G2.id&&x.skill==='tactical'&&x.base===0.04),`…and has a small chance at Tactical (${W.__xp.filter(x=>x.id===G2.id).map(x=>x.skill+'@'+x.base).join(', ')})`);
  if(process.env.KC_DEBUG) console.log(t2);
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
