// 2026-10-14 (batch item 11) — failing still teaches a little. At the small (frequent-action) rate:
//   * a failed Spy (on a province or a hero), a failed Steal and a fizzled Cast Spell roll for that
//     skill (Spy, Thief, the spell's school);
//   * a general who loses a battle and lives rolls for Tactical (Naval at sea);
//   * a hero who loses a personal fight and lives (beaten and spared, or fled) rolls for Melee.
// Level 2 (scenario) for the orders and the battle, which live inside runTurn: the spy, steal and
// casting rolls are fixed to fail by hooks on them, the battle is staged hopeless, and every
// experience roll is recorded by a wrapper around the top-level trySkillGain. Level 1 for the fight
// (resolvePersonalCombat, tests/lib/pc-hooks.js), with the flight made certain.
const {bootScenario,order,plan}=require('./lib/scenario');
const {bootPersonalCombat,pinned}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
// every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
const XP_RECORD="{ const tryOne=trySkillGain; trySkillGain=function(turnContext, char, skill, base, narr, mult){ if(window.__xp) window.__xp.push({id:char&&char.id,skill,base,mult}); return tryOne.apply(this, arguments); }; }";
const FIX=a=>[a,a.replace('d100()','(window.__fix?100:d100())')];
(async()=>{
  const sc=await bootScenario({inject:[FIX("        const _spyRoll=d100();"),FIX("        const stealRoll=d100();"),
    FIX("        const castRoll=d100();\n        try{ _tel.spells.push(")]}); const W=sc.W;
  W.eval(XP_RECORD);
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  // ── failed orders ──
  W.__xp=[]; W.__fix=true;
  const r=await sc.turn({realms:2,prepare(S){
    const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing), V=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);
    const P=S.world.provinces[H.location]; place(S,V,P);
    H.skills={...H.skills,spy:2,thief:2,white:2}; H.items=[]; V.items=[]; S.players[1].gold=50;
    return {H,V,P}; },
    orders:(S,x)=>({[x.H.id]:plan(order('spy',x.P.id),order('cast_spell','Bless Province',x.P.id),order('steal',x.V.id))})});
  W.__fix=false;
  const H=r.extra.H, mine=W.__xp.filter(x=>x.id===H.id);
  const small=sk=>mine.some(x=>x.skill===sk&&x.base===0.04);
  const t=r.text(H.id);
  ok(/yields little/.test(t),'the Spy fails (its roll fixed at 100)');
  ok(small('spy'),'…and is a small chance at Spy');
  ok(/fizzles/.test(t),'the Cast Spell fizzles (its roll fixed at 100)');
  ok(small('white'),'…and is a small chance at White Magic');
  ok(/Steal — [^\n]*\[roll 100 ✗\]/.test(t),'the Steal fails (its roll fixed at 100)');
  ok(small('thief'),'…and is a small chance at Thief');
  if(process.env.KC_DEBUG) console.log(t);
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
  // ── a lost personal fight ──
  const B=await bootPersonalCombat(['resolvePersonalCombat','pcCharCombatant']);
  B.W.eval(XP_RECORD);
  const two=B.state.characters.filter(c=>c.alive&&c.player!=null).slice(0,2);
  const mk=(c,t)=>{ const h=B.PC.pcCharCombatant({...c,encounterPlan:{tactics:t,duelStance:'accept'},temper:'Cowardly'}); h.hp=h.maxHp=40; return h; };
  B.W.__xp=[];
  const A=mk(two[0],['ME','ME','ME']), R=mk(two[1],['FL','FL','FL']);
  const res=pinned(B.W,0.01,()=>B.PC.resolvePersonalCombat(A,R,{maxRounds:3}));
  ok(res.fledBy===R,'the runner flees the fight');
  ok(B.W.__xp.some(x=>x.id===two[1].id&&x.skill==='melee'&&x.base===0.04),'…and has a small chance at Melee');
  ok(!B.W.__xp.some(x=>x.id===two[0].id&&x.skill==='melee'&&x.base===0.04),'the one left standing takes no small roll');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length+B.errs.length}`);
  [...sc.errs,...B.errs].slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length||B.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
