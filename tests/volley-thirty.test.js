// 2026-10-11 (Toby, volleys at 30%) — a pre-battle shot does 30% of the shooting unit's base strength.
// Level 2 (scenario): missileShotDamage is nested inside runTurn, so only a real battle shows the figure.
// One Elite Yeoman Longbow company (base 4 × 5 = 20) under a hero with no Archery attacks a neutral
// guard holding one Elite Dwarven Guard (base 30, so the 40% cap of 12 is not reached): the report's
// shot takes 6 (it took 4 at 20%). The guard has no archers, so nothing fires back, and the one target
// makes the volley deterministic whatever the dice do afterwards.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const army=(type,n,q)=>Array.from({length:n},(_,i)=>({type,quality:q||'Average',unitName:type+' '+(i+1)}));
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
    const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    const land=p=>p.terrain!=='sea';
    // N: a neutral province still held by its own guard character (the engine fights for neutral land
    // only when a guard stands there); P: the land next door H attacks from.
    let N,P,guard;
    for(const g of S.characters.filter(c=>c.player==null&&c.alive&&c._isNeutralGuard&&(c.armies||[]).length)){
      const q=S.world.provinces[g.location]; if(!q||!land(q)||q.owner!=null) continue;
      const pp=nb(S,q).filter(land).find(x=>x.id!==q.id); if(!pp) continue;
      guard=g; N=q; P=pp; break; }
    if(!guard) throw new Error('no neutral guard to stage the battle against');
    S.characters=S.characters.filter(c=>c.player!=null||c.id===guard.id||c.location!==P.id);
    P.characters=(P.characters||[]).filter(id=>S.characters.some(c=>c.id===id));
    own(S,P,0);
    guard.armies=army('Dwarven Guard',1,'Elite'); N.neutralDefenders=[...guard.armies]; N.npcArmies=1; guard.items=[];
    place(S,H,P); H.armies=army('Yeoman Longbows',1,'Elite'); H.skills={...(H.skills||{}),archery:0}; H.items=[];
    return {H,N};
  },orders:(S,c)=>({[c.H.id]:plan(order('move',c.N.id))})});
  const txt=r.log.filter(e=>e.phase===0&&e.charId===r.extra.H.id).map(e=>e.text).join('\n');
  ok(/Pre-battle Archery Phase\*\* — 1 ranged unit/.test(txt),'the Longbow company fires in the archery phase');
  const shot=/Yeoman Longbows 1 fires at Dwarven Guard 1: −(\d+) strength/.exec(txt);
  ok(!!shot,'the report names the shot and its damage');
  ok(!!shot&&+shot[1]===6,`the shot takes 6 strength, 30% of the company's 20 (got ${shot&&shot[1]})`);
  ok(/Archery phase total: −6 strength/.test(txt),'the archery total is 6');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
