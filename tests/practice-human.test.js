// 2026-10-14 (batch item 10) — a Human hero of a Human realm learns half as fast again on the
// Practice ground too (the Quick Learners gift says "by every means"; until now it reached only field
// experience). Practising alone at level 3 (base 10%): a Human of a Human realm 15%, an Elf 10%. The
// practice roll is fixed to fail through the hook on it, so the line shows the chance and nothing
// rises. Level 2 (scenario): the Practice order lives inside runTurn.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const ROLL="            const _prRoll=d100();\n";
(async()=>{
  const sc=await bootScenario({inject:[[ROLL,"            const _prRoll=(window.__PR&&window.__PR.length)?window.__PR.shift():d100();\n"]]});
  const W=sc.W; W.__PR=[100,100];
  let A,B;
  const r=await sc.turn({realms:2,races:['Human','Elven'],
    prepare(S){ A=S.characters.find(c=>c.alive&&c.player===0&&c.isKing); B=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);
      S.players[0].race='Human'; S.players[1].race='Elven'; A.race='Human'; B.race='Elven';
      [A,B].forEach(c=>{ c.skills.spy=3; c.items=[]; }); return {A,B}; },
    orders:(S,x)=>({[x.A.id]:plan(order('practice','spy')),[x.B.id]:plan(order('practice','spy'))})});
  const line=id=>(r.text(id).match(/[^\n]*practises Spy[^\n]*/)||[''])[0];
  ok(/15% \[roll 100/.test(line(A.id)),`a Human of a Human realm practises Spy 3 at 15% ("${line(A.id).slice(0,120)}")`);
  ok(/Human/.test(line(A.id)),'…and the line says why');
  ok(/10% \[roll 100/.test(line(B.id)),`an Elf practises Spy 3 at 10% ("${line(B.id).slice(0,120)}")`);
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
