// 2026-10-12 (Toby's batch, item 21; ruling R-102) — Evil's lingering Terror stacks at most three times (−30% at the
// base −10% a stack): a fourth decisive victory nearby adds nothing, and an older save holding five stacks
// demoralises by three.
// Level 1 (unit): spreadTerror and consumeTerror are nested inside runTurn, so the hook at "  // 4. Run all 5 phases"
// hands them back after one real turn (as tests/hp-wound-gain does). This was the fourth block of battle-tweaks; its
// other three moved to tests/unit/battle-tweaks.test.ts when armStr left runTurn (plan P1-08b), and this one follows
// when spreadTerror does (plan P1-08c).
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario({inject:[["  // 4. Run all 5 phases\n","  window.__BT={spreadTerror,consumeTerror,get G(){ return G; },get MAX(){ return TERROR_MAX_STACKS; }};\n  // 4. Run all 5 phases\n"]]});
  await sc.turn({});
  const w=sc.W;
  ok(sc.errs.length===0,'the GM portal boots and runs a turn'+(sc.errs.length?' — '+sc.errs[0].split('\n')[0]:''));
  const B=w.__BT||{}; ok(typeof B.spreadTerror==='function','hook: spreadTerror exposed'); if(typeof B.spreadTerror!=='function') process.exit(1);

  // ── Item 21: Terror stacks at most three times ──
  {
    const G=B.G, P=G.world.provinces.find(p=>p&&p.terrain!=='sea');
    ok(B.MAX===3,`TERROR_MAX_STACKS is 3 (got ${B.MAX})`);
    delete P._terrorStacks; for(let i=0;i<5;i++) B.spreadTerror(P,0,null);
    ok(P._terrorStacks===3,`five decisive victories next door leave three stacks, no more (got ${P._terrorStacks})`);
    const owner=P.owner; P.owner=null;
    const defs=[{type:'Shieldwall Levies',quality:'Average'}], narr=[];
    B.consumeTerror(P,defs,narr);
    ok(Math.abs(defs[0]._terrorMult-0.7)<1e-9,`three stacks: the defenders fight at ×0.7, −30% (got ×${defs[0]._terrorMult})`);
    ok(narr.some(l=>/−30% strength \(3 terror stacks/.test(l)),`the report says −30% from 3 stacks (${narr.join(' | ')})`);
    // an older save still holding five
    P._terrorStacks=5; P._terrorTurn=G.turn; P._terrorisedBy=0; P._terrorPct=0.10;
    const d2=[{type:'Shieldwall Levies',quality:'Average'}]; B.consumeTerror(P,d2,[]);
    ok(Math.abs(d2[0]._terrorMult-0.7)<1e-9,`a save holding five stacks still demoralises by three, −30% (got ×${d2[0]._terrorMult})`);
    P.owner=owner;
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
