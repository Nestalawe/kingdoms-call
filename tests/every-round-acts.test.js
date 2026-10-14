// 2026-10-14 (batch item 1) — in a personal fight neither side loses its round to a power that fails.
// A guardian whose special slips away, or a hero whose spell fizzles (or who has already spent that
// spell, or reached the school's limit), makes an ordinary attack instead; so does anyone bound by
// Spiritwrack who reaches for a special, a spell or a bow (at half strength, as Spiritwrack says).
// Stuns still cost the round. pcAct is nested inside runTurn, so a real turn is run first and the
// hook at "  // 4. Run all 5 phases" hands it back (tests/lib/pc-hooks.js).
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const {W, PC, base, MON, errs}=await bootPersonalCombat(['pcAct','pcCharCombatant','pcMonsterCombatant']);
  const st=()=>({fledBy:null,parley:false,stoleBy:null,range:'melee',mirror:null,feature:null});
  const hero=(tactics,skills)=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,melee:3,archery:3,psychic:3,...(skills||{})},encounterPlan:{tactics,duelStance:'accept'}});
    h.hp=h.maxHp=40; return h; };
  const caster=MON.find(m=>(m.spells||[]).length&&m.power==='Moderate');
  const guardian=()=>{ const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(caster)),_hpFull:caster.hp}); g.tactics=['MS:'+caster.spells[0].name]; g.tacIdx=0; return g; };
  const act=(a,f,r)=>{ const n=[]; pinned(W,r,()=>PC.pcAct(a,f,n,st())); return n.join('\n'); };
  const swung=(t,who)=>new RegExp(`${who.replace(/[()]/g,'.')} attacks \\(`).test(t);

  // a guardian's special that fails its roll
  { const g=guardian(), h=hero(['ME']); const t=act(g,h,0.99);
    ok(/slips away/.test(t),`${caster.name}'s special fails its roll (forced): ${t.split('\n')[1]||t}`);
    ok(swung(t,g.name),`…and ${caster.name} attacks instead of losing the round`);
    ok(!/round is lost/.test(t),'…the report no longer says the round is lost'); }
  // a guardian bound by Spiritwrack reaching for its special
  { const g=guardian(), h=hero(['ME']); g.status.silenceRounds=2; g.status.meleeHalvedRounds=2; const t=act(g,h,0.5);
    ok(swung(t,g.name),`a guardian bound by Spiritwrack swings instead of standing idle (${t.split('\n')[0]})`); }
  // a hero's spell that fizzles
  { const h=hero(['CA:Psychic Blast']), g=guardian(); const t=act(h,g,0.99);
    ok(/fizzles/.test(t),'the hero\'s Psychic Blast fizzles (forced)');
    ok(swung(t,h.name),'…and the hero attacks instead'); }
  // the same spell a second time in one fight
  { const h=hero(['CA:Psychic Blast','CA:Psychic Blast']), g=guardian(); h.castSpells.push('Psychic Blast'); const t=act(h,g,0.5);
    ok(/already cast/.test(t)&&swung(t,h.name),'a spell already cast this fight becomes an attack'); }
  // a hero with no skill in the school
  { const h=hero(['CA:Fireball'],{elemental:0}), g=guardian(); const t=act(h,g,0.5);
    ok(swung(t,h.name),'a spell the hero cannot cast becomes an attack'); }
  // a hero bound by Spiritwrack reaching for a spell, and for a bow
  { const h=hero(['CA:Psychic Blast']), g=guardian(); h.status.silenceRounds=2; const t=act(h,g,0.5);
    ok(/silenced/.test(t)&&swung(t,h.name),'a silenced hero who would cast attacks instead'); }
  { const h=hero(['FI']), g=guardian(); h.status.silenceRounds=2; const t=act(h,g,0.5);
    ok(swung(t,h.name),'a silenced hero who would shoot attacks instead'); }
  // a stun still costs the round
  { const g=guardian(), h=hero(['ME']); g.status.stun=1; const t=act(g,h,0.5);
    ok(/stunned and cannot act/.test(t)&&!swung(t,g.name),'a stunned guardian still loses its round'); }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
