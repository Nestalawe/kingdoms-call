// 2026-10-08 (item 15) — a Defend order is done once it has brought its general to battle.
// A general on Defend (Spring only; Rest after) rides out and wins in Spring. In Early Summer a second
// enemy column marches into another province beside him: he must not ride out again, because no
// Defend order was given for any season after his battle. And the Spring Defend order, which
// resolves after the Spring battle, must not set the watch again.
// A second turn checks that a Defend order given for a LATER season does set a new watch.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const land=(S,p)=>nb(S,p).filter(n=>n.terrain!=='sea');
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id);
    p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const army=(type,n,q)=>Array.from({length:n},(_,i)=>({type,quality:q,unitName:type+' '+(i+1)}));
  // C: the general's start. L1: where the first enemy comes (beside C). L2: where the second comes
  // (beside L1, where the general stands after riding out). E1/E2: enemy start points.
  const stage=S=>{
    S.relations=S.relations||{}; S.relations['0-1']='enemy';
    let pick=null;
    for(const L1 of S.world.provinces.filter(p=>p.terrain!=='sea')){
      const n=land(S,L1); if(n.length<4) continue;
      for(const C of n){ for(const L2 of n){ if(L2.id===C.id) continue;
        const E1=n.find(x=>x.id!==C.id&&x.id!==L2.id&&!land(S,C).some(y=>y.id===x.id)&&!land(S,L2).some(y=>y.id===x.id));
        const E2=land(S,L2).find(x=>x.id!==L1.id&&x.id!==C.id&&(!E1||x.id!==E1.id)&&!land(S,L1).some(y=>y.id===x.id)&&!land(S,C).some(y=>y.id===x.id));
        if(E1&&E2){ pick={C,L1,L2,E1,E2}; break; } } if(pick) break; }
      if(pick) break; }
    const {C,L1,L2,E1,E2}=pick, ids=[C,L1,L2,E1,E2].map(p=>p.id);
    S.characters=S.characters.filter(c=>c.player!=null||!ids.includes(c.location));
    [C,L1,L2,E1,E2].forEach(p=>{ p.characters=(p.characters||[]).filter(id=>S.characters.some(c=>c.id===id)); });
    own(S,C,0); own(S,L1,0); own(S,L2,0); own(S,E1,1); own(S,E2,1);
    const D=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    place(S,D,C); D.armies=army('Heavy Infantry',6,'Elite');
    const K1=S.characters.find(c=>c.alive&&c.player===1&&c.isKing), K2=S.characters.find(c=>c.alive&&c.player===1&&!c.isKing);
    place(S,K1,E1); K1.armies=army('Shieldwall Levies',1,'Green');
    place(S,K2,E2); K2.armies=army('Shieldwall Levies',1,'Green');
    return {...pick,D,K1,K2};
  };
  const lines=(r,id,ph)=>r.log.filter(e=>e.phase===ph&&(e.charId===id||(e.charIds||[]).includes(id))).map(e=>e.text);

  // Turn 1: Defend in Spring only.
  let r=await sc.turn({cols:10,rows:7,seaPct:10,prepare:stage,
    orders:(S,c)=>({[c.D.id]:plan(order('defend'),order('rest'),order('rest'),order('rest'),order('rest')),
      [c.K1.id]:plan(order('move',c.L1.id)), [c.K2.id]:plan(order('rest'),order('move',c.L2.id))})});
  let {D,L1,L2}=r.extra;
  const p0=lines(r,D.id,0).join('\n'), p1=lines(r,D.id,1).join('\n');
  ok(/march to meet the threat/.test(p0)&&/Battle for /.test(r.log.filter(e=>e.phase===0).map(e=>e.text).join('\n')),`the general rides out to ${L1.name} and fights in Spring (staging)`);
  ok(/Defend order is fulfilled/.test(p0),'his report says the Defend order is fulfilled by the battle');
  ok(!/makes camp .* sets a watch|keeps the watch/.test(p0.split(/Defend order is fulfilled/)[1]||''),'the Spring Defend order does not set the watch again after the battle');
  ok(!/march to meet the threat|break camp/.test(p1),`in Early Summer he does not ride out again to ${L2.name}`);

  // Turn 2: Defend in Spring and again in Early Summer — the second order sets a new watch.
  r=await sc.turn({cols:10,rows:7,seaPct:10,prepare:stage,
    orders:(S,c)=>({[c.D.id]:plan(order('defend'),order('defend'),order('rest'),order('rest'),order('rest')),
      [c.K1.id]:plan(order('move',c.L1.id)), [c.K2.id]:plan(order('rest'),order('move',c.L2.id))})});
  ({D,L2}=r.extra);
  ok(/march to meet the threat|break camp/.test(lines(r,D.id,1).join('\n')),`with a fresh Defend order for Early Summer he rides out to ${L2.name}`);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
