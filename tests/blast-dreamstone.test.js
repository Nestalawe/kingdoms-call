// 2026-10-15 (Toby, D4) — Psychic Blast's stun in personal combat is 1 round + 1 per two Psychic levels, doubled
// against a guardian weak to Psychic magic, and the Dreamstone's extra round is added AFTER the doubling (before,
// it was doubled too: 8 rounds at Psychic 5 against a weak guardian, where the books implied 7).
// Level 1 (unit): pcCastCombatSpell is nested inside runTurn (tests/lib/pc-hooks.js hands it back); the cast is
// pinned to succeed.
const fs=require('fs');
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const {W, PC, base, MON}=await bootPersonalCombat(['pcCharCombatant','pcMonsterCombatant','pcCastCombatSpell']);
  const ITEMS=W.eval('ALL_MAGIC_ITEMS_P'); const stone=ITEMS.find(i=>i.name==='Dreamstone');
  ok(!!stone,'the Dreamstone was read');
  const st=()=>({fledBy:null,parley:false,stoleBy:null,range:'melee',mirror:null,feature:null});
  const hero=(withStone)=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:withStone?[{...stone,equipped:true}]:[],skills:{...base.skills,psychic:withStone?4:5},encounterPlan:{tactics:['ME'],duelStance:'accept'}}); h.hp=h.maxHp=40; return h; };
  const guard=(weak)=>{ const m=MON.find(x=>x.name==='Owlbear'); const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); g.arm=null; g.weak=weak?{kind:'school',key:'psychic'}:null; g.hp=g.maxHp=500; return g; };
  const stun=(withStone,weak)=>{ const h=hero(withStone), g=guard(weak), n=[]; pinned(W,0.01,()=>PC.pcCastCombatSpell(h,g,'Psychic Blast',n,st())); return g.status.stun; };
  // Psychic 5 (or 4 + the Dreamstone's +1 = 5): 1 + floor(5/2) = 3 rounds
  ok(stun(false,false)===3,`Psychic 5, no stone: 3 rounds (got ${stun(false,false)})`);
  ok(stun(false,true)===6,`Psychic 5 against a weak guardian: doubled to 6 (got ${stun(false,true)})`);
  ok(stun(true,false)===4,`Psychic 5 with the Dreamstone: 3 + 1 = 4 (got ${stun(true,false)})`);
  ok(stun(true,true)===7,`with the Dreamstone against a weak guardian: 3 doubled, then + 1 = 7 (got ${stun(true,true)})`);
  // the books
  const strip=t=>{ for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
  const R=strip(fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8')).replace(/\s+/g,' ');
  const P=fs.readFileSync(sitePath('kingdoms-call-player-portal.html'),'utf8');
  ok(/The Dreamstone adds one further round, after any doubling/.test(R),'the rulebook says the Dreamstone\'s round comes after the doubling');
  ok(/Dreamstone \+1, after any doubling/.test(P),'the player portal\'s Psychic Blast text says so');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
