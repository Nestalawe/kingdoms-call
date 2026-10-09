// 2026-10-08 (item 16) — maximum-HP rolls after a personal fight.
//   • Every hero who takes at least 1 HP of damage in a fight and lives rolls for a gain at its end,
//     not only the winner.
//   • The winner still rolls once (the win award), and a successful roll gains +1 for the victory.
//   • Nobody rolls twice for one fight, and forecasts (simulated fights) never roll.
// The fight engine is nested inside runTurn; the hook at "  // 4. Run all 5 phases" hands it back
// after one real turn, and the fights below are staged on that turn's world.
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario({inject:[["  // 4. Run all 5 phases\n",
    "  window.__HP={get G(){ return G; },resolvePersonalCombat,pcCharCombatant,awardWinHp};\n  // 4. Run all 5 phases\n"]]});
  await sc.turn({});
  const H=sc.W.__HP; if(!H||typeof H.resolvePersonalCombat!=='function'){ console.log('hook missing: resolvePersonalCombat not exposed'); process.exit(1); }
  const G=H.G; let nextId=9300;
  // A made-up hero with an earned pool of 0 (15 max HP): every roll in this band succeeds (100%).
  const hero=(name,melee,hp)=>{ const c={id:nextId++,name,player:0,alive:true,race:'Human',alignment:'Good',temper:'Brave',
    skills:{melee},items:[],armies:[],hpEarned:0,maxHp:15,hp:hp==null?15:hp,location:0}; G.characters.push(c); return c; };
  const fight=(a,b,rounds)=>{ const A=H.pcCharCombatant(a), B=H.pcCharCombatant(b); A.tactics=['ME']; B.tactics=['ME'];
    const res=H.resolvePersonalCombat(A,B,{maxRounds:rounds}); a.hp=Math.max(0,res.aHp); b.hp=Math.max(0,res.bHp); return res; };

  // 1. A short, even fight that nobody wins: both are wounded, both roll, both harden.
  { let both=0, tries=0;
    while(tries<20&&!both){ tries++;
      const a=hero('Aldric',2), b=hero('Brannoc',2);
      const res=fight(a,b,2);
      if(res.winner||res.fledBy||a.hp>=15||b.hp>=15) continue;   // need: no winner, both wounded
      both=1;
      ok(a.hpEarned>0&&a.maxHp>15,`a wounded hero who did not win hardens (Aldric: max ${a.maxHp}, earned ${a.hpEarned})`);
      ok(b.hpEarned>0&&b.maxHp>15,`…and so does the other (Brannoc: max ${b.maxHp}, earned ${b.hpEarned})`);
      ok(res.narrative.some(l=>/hardened by the wounds of the fight/.test(l)),'the fight report says so'); }
    ok(both,'staged an even fight with two wounded heroes and no winner'); }

  // 2. A fight to the finish: the winner is NOT rolled for inside the fight (the win award does
  //    that, once); a wounded winner therefore rolls exactly once for it.
  { let done=0, tries=0;
    while(tries<30&&!done){ tries++;
      const a=hero('Corvin',7), b=hero('Dunmore',0,4);
      const res=fight(a,b,20);
      if(res.winner&&res.winner.ref===a&&a.hp<15){ done=1;
        ok(a.hpEarned===0,`the winner gets no wound roll inside the fight (earned ${a.hpEarned}); the win award is his one roll`); } }
    ok(done,'staged a fight won by a wounded hero'); }

  // 3. The win award: +1 on a successful roll (1–3 in this band, so 2–4 with the win).
  { const seen=new Set(); let bad=0;
    for(let i=0;i<60;i++){ const w=hero('Elspeth',3); const r=H.awardWinHp(w,[], 'kill');
      if(!(r&&r.gain>=2&&r.gain<=4&&r.winBonus===1&&w.hpEarned===r.gain)) bad++; seen.add(r&&r.gain); }
    ok(!bad,`a winner's successful roll gains 1–3 +1 for the win (gains seen: ${[...seen].sort().join(', ')})`); }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
