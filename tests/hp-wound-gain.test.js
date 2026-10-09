// 2026-10-08 (item 16) — maximum-HP rolls after a personal fight.
//   • Every hero who takes at least 1 HP of damage in a fight and lives rolls for a gain at its end,
//     not only the winner.
//   • The winner still rolls once (the win award) and gains the roll +1.
//   • Every roll gains (Toby, 2026-10-09): the roll only sets the amount — even a battle-hardened
//     hero past 50 maximum HP gains 1 (2 for a win).
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

  // Each fight is staged so its shape is overwhelming, not lucky: two master swordsmen (Melee 9) with
  // far more HP than a few rounds can take, so both land blows and neither falls.
  // 1. A short, even fight that nobody wins: both are wounded, both roll, both harden.
  { const a=hero('Aldric',9,200), b=hero('Brannoc',9,200); a.maxHp=b.maxHp=200;
    const res=fight(a,b,6);
    ok(!res.winner&&!res.fledBy&&a.hp<200&&b.hp<200,`staged: six rounds, no winner, both wounded (Aldric ${a.hp}, Brannoc ${b.hp})`);
    ok(a.hpEarned>0,`a wounded hero who did not win hardens (Aldric: earned ${a.hpEarned})`);
    ok(b.hpEarned>0,`…and so does the other (Brannoc: earned ${b.hpEarned})`);
    ok(res.narrative.some(l=>/hardened by the wounds of the fight/.test(l)),'the fight report says so'); }

  // 2. A fight to the finish between two master swordsmen, one with ten times the other's HP: the
  //    winner is wounded on the way, but is NOT rolled for inside the fight (the win award does that,
  //    once).
  { const a=hero('Corvin',9,300), b=hero('Dunmore',9,30); a.maxHp=300; b.maxHp=30;
    const res=fight(a,b,40);
    ok(res.winner&&res.winner.ref===a&&a.hp<300,`staged: Corvin wins, wounded (HP ${a.hp})`);
    ok(a.hpEarned===0,`the winner gets no wound roll inside the fight (earned ${a.hpEarned}); the win award is his one roll`); }

  // 3. The win award: +1 on a successful roll (1–3 in this band, so 2–4 with the win).
  { const seen=new Set(); let bad=0;
    for(let i=0;i<60;i++){ const w=hero('Elspeth',3); const r=H.awardWinHp(w,[], 'kill');
      if(!(r&&r.gain>=2&&r.gain<=4&&r.winBonus===1&&w.hpEarned===r.gain)) bad++; seen.add(r&&r.gain); }
    ok(!bad,`a winner's successful roll gains 1–3 +1 for the win (gains seen: ${[...seen].sort().join(', ')})`); }

  // 4. No chance of nothing: a hero already at 65 earned base still gains 1 per roll, 2 for a win.
  { let bad=0;
    for(let i=0;i<40;i++){ const w=hero('Fenwick',3); w.hpEarned=50; w.maxHp=65; const r=H.awardWinHp(w,[],'kill'); if(!(r&&r.gain===2&&w.hpEarned===52)) bad++; }
    ok(!bad,`a winner at 65 maximum HP gains exactly 1 +1 every time (${40-bad}/40)`); }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
