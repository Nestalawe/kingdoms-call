// 2026-10-09 (item 7, Toby's ruling) — Warg Riders' Run Them Down: a warg-heavy victor runs the beaten
// army down ON THE FIELD (each beaten unit +15% to be destroyed in the rout) and never sets off after
// the beaten commander. Before, the wargs took up a chase that replaced the commander's own orders in
// later phases. Here an Orc general takes an enemy province in Spring and is ordered home in Early
// Summer: he must go home, and no chase must start.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id);
    p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const army=(type,n,q)=>Array.from({length:n},(_,i)=>({type,quality:q,unitName:type+' '+(i+1)}));
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
    S.relations=S.relations||{}; S.relations['0-1']='enemy';
    const A=S.characters.find(c=>c.alive&&c.player===0&&c.isKing), B=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);
    let X,Y,Z;  // Z: the Orc's start; X: the enemy province he takes; Y: the enemy's ground beyond, where the beaten foe falls back
    for(const p of S.world.provinces.filter(p=>p.terrain!=='sea')){ const n=nb(S,p).filter(q=>q.terrain!=='sea');
      if(n.length>=3){ X=p; Z=n[0]; Y=n.find(q=>q.id!==Z.id&&!nb(S,Z).some(z=>z.id===q.id))||n[1]; break; } }
    S.characters=S.characters.filter(c=>c.player!=null||![X.id,Y.id,Z.id].includes(c.location));
    [X,Y,Z].forEach(p=>{ p.characters=(p.characters||[]).filter(id=>S.characters.some(c=>c.id===id)); });
    own(S,X,1); own(S,Y,1); own(S,Z,0);
    place(S,A,Z); A.armies=army('Warg Riders',6,'Elite');   // overwhelming, so the win is not luck
    place(S,B,X); B.armies=army('Light Infantry',2,'Green');
    return {A,B,X,Y,Z};
  },orders:(S,c)=>({[c.A.id]:plan(order('move',c.X.id),order('move',c.Z.id))})});
  const {A,B,X,Z}=r.extra;
  const t=r.text(), p0=r.log.filter(e=>e.phase===0).map(e=>e.text).join('\n');
  ok(/Battle for /.test(p0)&&p0.includes(`${A.name}'s forces defeat`),`${A.name}'s wargs win the battle for ${X.name} (staging)`);
  ok(/Warg Riders run down the broken companies .*\(\+15% losses/.test(p0),'the battle report shows the wargs running the beaten army down (+15% losses)');
  ok(!/need no order|already away after|on the trail of/.test(t),'no chase is taken up after the battle');
  ok(!r.log.some(e=>/(rides|presses on) into|runs .* to ground|closing on/.test(e.text)&&(e.text||'').includes(A.name)),'no pursuit move or chase battle later in the turn');
  const a2=r.S2.characters.find(c=>c.id===A.id);
  ok(a2&&a2.location===Z.id,`${A.name} obeys his own order and marches home to ${Z.name} in Early Summer`);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
