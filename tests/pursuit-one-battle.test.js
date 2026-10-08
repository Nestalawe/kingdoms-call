// 2026-10-08 (item 7) — a Warg Riders chase obeys ONE BATTLE PER PHASE, and says why a Move order
// was set aside.
// The story from play: an Orc general marches into an enemy province and wins; the beaten foe
// retreats next door, and the Warg Riders take up the chase unbidden. Next season the foe turns and
// attacks the province first (a quarry acts before its hunter), so the general fights as the
// DEFENDER — and then, the same season, rode on after the foe into a second battle.
// Staged with a high-Spy hunter: whenever the chase is allowed to run he leaves the province he has
// just held, and usually catches the foe and fights again.
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
    const A=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);   // the Orc general
    const B=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);   // the foe who is chased
    const H=S.characters.find(c=>c.alive&&c.player===1&&!c.isKing);  // the foe's second hero
    let X,Y,Z;  // X: the foe's province A takes; Y: the foe's ground beside it; Z: A's start
    for(const p of S.world.provinces.filter(p=>p.terrain!=='sea')){ const n=nb(S,p).filter(q=>q.terrain!=='sea');
      if(n.length>=3){ X=p; Z=n[0]; Y=n.find(q=>q.id!==Z.id&&!nb(S,Z).some(z=>z.id===q.id))||n[1]; break; } }
    S.characters=S.characters.filter(c=>c.player!=null||![X.id,Y.id,Z.id].includes(c.location));
    [X,Y,Z].forEach(p=>{ p.characters=(p.characters||[]).filter(id=>S.characters.some(c=>c.id===id)); });
    own(S,X,1); own(S,Y,1); own(S,Z,0);
    place(S,A,Z); A.armies=army('Warg Riders',5,'Veteran'); A.skills={...(A.skills||{}),spy:9};
    place(S,H,X); H.armies=army('Light Infantry',2,'Green');
    place(S,B,Y); B.armies=army('Light Infantry',3,'Green'); B.skills={...(B.skills||{}),spy:0};
    return {A,B,X,Y,Z};
  },orders:(S,c)=>({
    [c.A.id]:plan(order('move',c.X.id),order('move',c.Z.id)),   // take X, then march home
    [c.B.id]:plan(order('defend'),order('move',c.X.id)),         // watch, then counter-attack X
  })});
  const {A,B,X}=r.extra;
  const p0=r.log.filter(e=>e.phase===0).map(e=>e.text).join('\n');
  ok(/Warg Riders need no order/.test(p0),'the Warg Riders took up the chase after the first battle (staging)');
  const p1=r.log.filter(e=>e.phase===1);
  const battles=p1.filter(e=>/^⚔ \*\*Battle for /.test(e.text)).map(e=>e.text);
  ok(p1.some(e=>/^⚔ \*\*Battle for /.test(e.text)&&e.text.includes(X.name)),`the foe's counter-attack on ${X.name} was fought (staging)`);
  ok(battles.length===1,`${A.name} fights one battle in Early Summer, not ${battles.length}: ${battles.join(' / ')}`);
  ok(p1.some(e=>/chase after .* must wait/.test(e.text)),'the chase waits for the next season');
  // Whether the catch roll lands or not, the hunter must not ride off after the foe this season:
  // that left the province he had just held and put him on enemy ground with no battle fought.
  ok(!p1.some(e=>/(rides|presses on) into .*(finds|trail of)/.test(e.text)&&(e.charId===A.id||(e.text||'').startsWith(A.name))),`${A.name} stays in ${X.name} for the season`);
  ok(p1.some(e=>/Warg Riders are still on the trail/.test(e.text)&&e.charId===A.id),`${A.name}'s report says the Move order waits on the chase`);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
