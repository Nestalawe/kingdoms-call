// 2026-10-12 (Toby's batch) — small battle rulings, one block per item:
//   • Reign of Fear fires only when attacking: an Evil realm's Monsters fight ×1.5 on ground its own Terror grips
//     when they ATTACK there, and at ×1 when they defend it.
// Level 1 (unit): armStr (a unit's strength with every per-unit modifier) is nested inside runTurn, so the hook at
// "  // 4. Run all 5 phases" hands it back after one real turn (as tests/hp-wound-gain does).
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-6;

(async()=>{
  const sc=await bootScenario({inject:[["  // 4. Run all 5 phases\n","  window.__BT={armStr,get RF(){ return REIGN_OF_FEAR_MULT; }};\n  // 4. Run all 5 phases\n"]]});
  await sc.turn({});
  const w=sc.W, ev=e=>w.eval(e);
  ok(sc.errs.length===0,'the GM portal boots and runs a turn'+(sc.errs.length?' — '+sc.errs[0].split('\n')[0]:''));
  const B=w.__BT||{}; ok(typeof B.armStr==='function','hook: armStr exposed'); if(typeof B.armStr!=='function') process.exit(1);
  const unit=(type,extra)=>Object.assign({type,quality:'Average',race:'Primal',unitName:'the Test '+type},extra||{});
  const str=(type,align,terrain,ctx)=>B.armStr(unit(type),null,align,terrain,Object.assign({force:[],enemyForce:[]},ctx||{}));

  // ── Reign of Fear: only when attacking ──
  {
    const RF=B.RF;
    const base=str('Cave Trolls','Evil','plain',{isAttacker:true});
    const atk=str('Cave Trolls','Evil','plain',{isAttacker:true,reignOfFear:true});
    const def=str('Cave Trolls','Evil','plain',{isAttacker:false,reignOfFear:true});
    const defBase=str('Cave Trolls','Evil','plain',{isAttacker:false});
    ok(base>0&&near(atk,Math.round(base*RF)),`attacking on its own terrorised ground, an Evil host's Cave Trolls fight ×${RF} (got ${atk} from ${base})`);
    ok(near(def,defBase),`defending that ground, they fight with no Reign of Fear (got ${def}, without it ${defBase})`);
    const trace=[]; str('Cave Trolls','Evil','plain',{isAttacker:false,reignOfFear:true,trace});
    ok(!trace.some(t=>/Reign of Fear/.test(t.label)),'…and the defender\'s strength ladder does not name it');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
