// 2026-10-15 (Toby, D5) — Spiritwrack counts White Magic only to level 5, like every other spell's effect:
// silenced for 1 round + 1 per two levels, so 3 rounds at most (White 4 and up), and one round longer against a
// guardian weak to White (4 at most). Before, it read the caster's full level, so White 6+ reached 4 (5 against a
// weak guardian). Supersedes R-053's "at most 4 (5)".
// Level 1 (unit): pcCastCombatSpell is nested inside runTurn (tests/lib/pc-hooks.js hands it back); the cast is
// pinned to succeed.
const fs=require('fs');
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const {W, PC, base, MON}=await bootPersonalCombat(['pcCharCombatant','pcMonsterCombatant','pcCastCombatSpell']);
  const st=()=>({fledBy:null,parley:false,stoleBy:null,range:'melee',mirror:null,feature:null});
  const hero=(white)=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,white},encounterPlan:{tactics:['ME'],duelStance:'accept'}}); h.hp=h.maxHp=40; return h; };
  const guard=(weak)=>{ const m=MON.find(x=>x.name==='Owlbear'); const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); g.arm=null; g.weak=weak?{kind:'school',key:'white'}:null; g.hp=g.maxHp=500; return g; };
  const rounds=(white,weak)=>{ const h=hero(white), g=guard(weak), n=[]; pinned(W,0.01,()=>PC.pcCastCombatSpell(h,g,'Spiritwrack',n,st())); return g.status.silenceRounds; };
  [[1,1],[3,2],[5,3],[9,3]].forEach(([w,want])=>ok(rounds(w,false)===want,`White ${w}: silenced ${want} round${want>1?'s':''} (got ${rounds(w,false)})`));
  ok(rounds(5,true)===4,`White 5 against a guardian weak to White: 4 rounds (got ${rounds(5,true)})`);
  ok(rounds(9,true)===4,`White 9 against a weak guardian: still 4 (got ${rounds(9,true)})`);
  // the books
  const strip=t=>{ for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
  const R=strip(fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8')).replace(/\s+/g,' ');
  const P=fs.readFileSync(sitePath('kingdoms-call-player-portal.html'),'utf8'), D=fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8');
  ok(/3 at 4–5; levels past 5 add nothing/.test(R)&&/lasts one round longer \(up to 4\)/.test(R),'the rulebook\'s Spiritwrack row says at most 3, or 4 against a weak guardian');
  const pp=(P.match(/\n  'Spiritwrack':'([^\n]*)',\n/)||['',''])[1];
  ok(/\(max 3\)/.test(pp)&&/\(max 4\)/.test(pp),`the player portal's text says max 3 and max 4: "${pp.slice(0,120)}"`);
  ok(/plus 1 per two White levels \(at most 3\)/.test(D),'the data file\'s description says at most 3');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
