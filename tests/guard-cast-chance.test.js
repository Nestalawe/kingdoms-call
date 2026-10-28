// 2026-10-15 (Toby, D7) — a hero guarding a neutral province casts battle magic at the same odds as a
// player's hero: 30% + 10% a level, the school counted as for anyone (training to 5, items on top), at most 95%.
// Before, a guard cast at 30% + 15% a level, at most 90% (45/60/75/90% at levels 1–4, against 40/50/60/70%).
// The rulebook's cast-chance lines say what the game does (Toby: the books follow the game): trained levels past
// 5 do not raise it, a magic item's levels do.
// Level 1 (unit): guardCastChance is module level, fed a hand-made guard; that the defender's battle magic calls
// it (inside runTurn) is read from the source (level 0).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 9 (R-115): a neutral guard casts at 40/50/60/70/80% at levels 1–5 and 80% at a trained 7, exactly as a player's
// hero does, and 95% when an item lifts the school to 7; the defender's battle magic uses `guardCastChance`; the
// rulebook says training stops cast chance at 80% and items carry it on (batch 2026-10-15)
const fs=require('fs');
const {bootScenario}=require('./lib/scenario'); const {sitePath}=require('./lib/boot'); const {compactPage}=require('./lib/source.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W; const {S}=await sc.world({realms:2});
  const fn=W.eval('typeof guardCastChance==="function"?guardCastChance:null');
  ok(!!fn,'the GM portal declares guardCastChance');
  const guard=S.characters.find(c=>c.alive&&c._isNeutralGuard);
  if(fn&&guard){
    const g=lvl=>{ const c=JSON.parse(JSON.stringify(guard)); c.items=[]; c.skills={...(c.skills||{}),elemental:lvl}; return c; };
    const mine=lvl=>{ const c=JSON.parse(JSON.stringify(S.characters.find(x=>x.player===0))); c.items=[]; c.skills={...(c.skills||{}),elemental:lvl}; return c; };
    for(const [lvl,want] of [[1,40],[2,50],[3,60],[4,70],[5,80],[7,80]]){
      const got=fn(g(lvl),'elemental',S.characters);
      ok(got===want,`a guard at Elemental ${lvl} casts at ${want}% (got ${got})`);
      const pc=W.castChanceFor(mine(lvl),'elemental',S.players[0],{chars:S.characters}).chance;
      ok(got===pc,`…the same as a player's hero (${pc}%)`);
    }
    const withItem=g(5); withItem.items=[{name:'Test Focus',equipped:true,effect:{stat:'elemental',bonus:2}}];
    ok(fn(withItem,'elemental',S.characters)===95,`a guard whose item lifts Elemental to 7 casts at 95% (got ${fn(withItem,'elemental',S.characters)})`);
  } else ok(false,'a guard was found');
  const gm=compactPage('kingdoms-call-gm-portal.html');   // its code in one layout (tests/lib/source.ts; plan P1-09a)
  ok(/const castChance=guardCastChance\(defHero,school,G\.characters\)/.test(gm)&&!/Math\.min\(90,30\+defSpellLvl\*15\)/.test(gm),'the defender\'s battle magic uses it');
  // the books
  const strip=t=>{ for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
  const R=strip(fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8')).replace(/\s+/g,' ');
  ok(/80% at 5\. Trained levels past 5 do not raise it/.test(R),'the rulebook: training raises cast chance only to 80% at level 5');
  ok(/a magic item that adds levels in the school does, \+10% a level to 95%/.test(R),'…a magic item carries it on to 95%');
  ok(!/keeps climbing \+10% a level to the 95% ceiling/.test(R),'…and no line says trained levels keep climbing');
  ok(/the same roll for a hero guarding a neutral province/.test(R),'…and it is the same roll for a neutral guard');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
