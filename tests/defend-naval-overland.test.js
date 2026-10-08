// 2026-10-08 (item 14) — a general on Defend who leads ships never rides OVERLAND to a neighbour.
// From play: a hero on Defend in a coastal province, leading both naval and land units, marched to
// help defend an adjacent land province. A Move order refuses that (ships cannot cross land); the
// Defend ride-outs checked only the ground he would stand on.
// Two turns: (A) an enemy army marches into the neighbouring land province; (B) an enemy army is
// already standing in it (the end-of-phase "host in the watch" pass).
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id);
    p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const army=(type,n)=>Array.from({length:n},(_,i)=>({type,quality:'Regular',unitName:type+' '+(i+1)}));
  // A coastal land province C (realm 0's), a land neighbour L (realm 0's), and land E beside L for the enemy.
  const stage=(S,enemyIn)=>{
    S.relations=S.relations||{}; S.relations['0-1']='enemy';
    let C,L,E;
    for(const p of S.world.provinces.filter(p=>p.terrain!=='sea'&&nb(S,p).some(n=>n.terrain==='sea'))){
      const l=nb(S,p).find(n=>n.terrain!=='sea'&&nb(S,n).some(m=>m.terrain!=='sea'&&m.id!==p.id&&!nb(S,p).some(x=>x.id===m.id)));
      if(l){ C=p; L=l; E=nb(S,l).find(m=>m.terrain!=='sea'&&m.id!==p.id&&!nb(S,p).some(x=>x.id===m.id)); break; } }
    S.characters=S.characters.filter(c=>c.player!=null||![C.id,L.id,E.id].includes(c.location));
    [C,L,E].forEach(p=>{ p.characters=(p.characters||[]).filter(id=>S.characters.some(c=>c.id===id)); });
    own(S,C,0); own(S,L,0); own(S,E,1);
    const D=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    place(S,D,C); D.armies=[...army('Galleon Fleet',2),...army('Heavy Infantry',2)];
    const K=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);
    place(S,K,enemyIn?L:E); K.armies=army('Light Infantry',2);
    return {C,L,E,D,K};
  };
  const report=(r,label)=>{
    const {C,L,D}=r.extra; const d2=r.S2.characters.find(c=>c.id===D.id);
    ok(!r.log.some(e=>e.charId===D.id&&/break camp|march to meet|falls upon/.test(e.text)),`(${label}) the admiral does not ride out overland to ${L.name}`);
    ok(d2&&d2.location===C.id,`(${label}) the admiral is still in ${C.name} at the end of the turn`);
  };
  // (A) the enemy marches in.
  let r=await sc.turn({cols:10,rows:6,seaPct:35,prepare:S=>stage(S,false),
    orders:(S,c)=>({[c.D.id]:plan(order('defend'),order('defend')), [c.K.id]:plan(order('move',c.L.id))})});
  ok(r.log.some(e=>/moves into|moves to/.test(e.text)&&e.text.includes(r.extra.K.name)&&e.text.includes(r.extra.L.name))||r.S2.world.provinces[r.extra.L.id].owner===1,'(A) the enemy marched into the neighbouring land province (staging)');
  report(r,'A');
  // (B) the enemy is already standing there.
  r=await sc.turn({cols:10,rows:6,seaPct:35,prepare:S=>stage(S,true),
    orders:(S,c)=>({[c.D.id]:plan(order('defend'),order('defend'))})});
  report(r,'B');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
