// 2026-10-14 (batch item 9) — a hero learns Naval at sea only when leading ships or sea beasts. A
// passenger (a hero carried in another's hulls, or riding out by sea with no fleet of his own) learns
// nothing from the voyage. Level 1: every voyage roll (a sea move, a Defend ride-out by sea, a
// reinforcement or a pursuit step at sea) goes through rollNavalVoyage, nested inside runTurn
// (tests/lib/pc-hooks.js; every experience roll is recorded by a hook at the top of trySkillGain).
// Level 0: no voyage path calls trySkillGain for Naval directly any more (only battles, won or lost,
// and the Naval 7/9 orders, which need a fleet, do).
const fs=require('fs'), path=require('path');
const {bootPersonalCombat}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const TSG="  function trySkillGain(char, skill, base, narr, mult){\n";
(async()=>{
  const src=fs.readFileSync(path.join(process.env.KC_SITE||path.join(__dirname,'..','site'),'kingdoms-call-gm-portal.html'),'utf8');
  const direct=src.split('\n').filter(l=>/trySkillGain\([^)]*['"]naval['"]/.test(l)||/trySkillGain\([^)]*\?\s*'naval'/.test(l));
  const allowed=l=>/_rollNavalGain|neutralGuardHero|won\?atk:def|won\?def:atk|if\(!won\)/.test(l)||/^\s*trySkillGain\(c,'naval',(SKILLGAIN_STD|base)\);\s*$/.test(l);
  const stray=direct.filter(l=>!allowed(l));
  ok(!stray.length,`no voyage rolls Naval outside rollNavalVoyage (${stray.length}): ${stray.map(l=>l.trim().slice(0,90)).join(' | ')}`);
  let B;
  try{ B=await bootPersonalCombat(['rollNavalVoyage'],{inject:[[TSG,TSG+"    if(window.__xp) window.__xp.push({id:char&&char.id,skill,base,mult});\n"]]}); }
  catch(e){ ok(false,'rollNavalVoyage exists inside runTurn ('+String(e.message).slice(0,80)+')'); }
  if(B){ const {W,PC,state}=B; const fleet=W.eval('[...SEA_TYPES]');
    const hero=state.characters.find(c=>c.alive&&c.player!=null);
    W.__xp=[];
    PC.rollNavalVoyage({...hero,armies:[]},0.10);
    ok(!W.__xp.some(x=>x.skill==='naval'),'a hero with no ships learns no Naval from a voyage');
    W.__xp=[];
    PC.rollNavalVoyage({...hero,armies:[{type:fleet[0],quality:'Average'}]},0.10);
    ok(W.__xp.some(x=>x.skill==='naval'),`a hero leading ships (${fleet[0]}) rolls Naval`);
    W.__xp=[];
    const beast=W.eval('[...PRIMAL_SEA_TYPES]')[0];
    PC.rollNavalVoyage({...hero,armies:[{type:beast,quality:'Average'}]},0.10);
    ok(W.__xp.some(x=>x.skill==='naval'),`a hero leading a sea beast (${beast}) rolls Naval`);
    if(B.errs.length) ok(false,'page errors: '+B.errs.slice(0,2).join(' | ')); }
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
