// 2026-10-08 (item 7) — a chase (an Encounter order) obeys ONE BATTLE PER PHASE, and a chase battle
// the hunter wins takes the province like any other battle.
// (1) The story from play, as it can still happen with an Encounter: the hunter's quarry turns and
//     attacks him first (a quarry acts before its hunter), so the hunter fights as the DEFENDER — and
//     then, the same season, rode on after the quarry into a second battle. Staged with a high-Spy
//     hunter: whenever the chase is allowed to run that season he leaves the ground he has just held.
// (2) The chase battle itself: the report said the hunter "seized" the province, but its owner never
//     changed. Both cases are staged so their outcome is overwhelming, not a matter of luck.
// (The Warg Riders no longer chase at all — see warg-run-down.)
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  // The catch roll is staged directly for case (2): a hook makes the hunter's chance 100%, so the
  // chase battle is fought the season he reaches the quarry (a missed catch would leave the two armies
  // in a stand-off, fought as an ordinary resumed battle instead).
  const sc=await bootScenario({inject:[["    const chance=pursuitCatchChance(c,quarry);\n",
    "    const chance=(window.__KC_CATCH!=null)?window.__KC_CATCH:pursuitCatchChance(c,quarry);\n"]]}); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id);
    p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const army=(type,n,q)=>Array.from({length:n},(_,i)=>({type,quality:q,unitName:type+' '+(i+1)}));
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
    S.relations=S.relations||{}; S.relations['0-1']='enemy';
    const A=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);   // the hunter
    const B=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);   // the quarry
    let X,Y,Z;  // Z: the hunter's start; X: his ground on the way; Y: the quarry's province beyond it
    for(const p of S.world.provinces.filter(p=>p.terrain!=='sea')){ const n=nb(S,p).filter(q=>q.terrain!=='sea');
      if(n.length>=3){ X=p; Z=n[0]; Y=n.find(q=>q.id!==Z.id&&!nb(S,Z).some(z=>z.id===q.id))||n[1]; break; } }
    S.characters=S.characters.filter(c=>c.player!=null||![X.id,Y.id,Z.id].includes(c.location));
    [X,Y,Z].forEach(p=>{ p.characters=(p.characters||[]).filter(id=>S.characters.some(c=>c.id===id)); });
    own(S,X,0); own(S,Y,1); own(S,Z,0);
    place(S,A,Z); A.armies=army('Heavy Infantry',5,'Veteran'); A.skills={...(A.skills||{}),spy:9};
    place(S,B,Y); B.armies=army('Light Infantry',3,'Green'); B.skills={...(B.skills||{}),spy:0};
    return {A,B,X,Y,Z};
  },orders:(S,c)=>({
    [c.A.id]:plan(order('encounter',c.B.id)),                    // hunt the quarry down
    [c.B.id]:plan(order('rest'),order('move',c.X.id)),           // …who turns and attacks him in Early Summer
  })});
  const {A,B,X}=r.extra;
  ok(r.log.some(e=>e.phase===0&&/presses on into .*trail of/.test(e.text)&&e.text.includes(X.name)),`the hunter closes in to ${X.name} in Spring (staging)`);
  const p1=r.log.filter(e=>e.phase===1);
  const battles=p1.filter(e=>/^⚔ \*\*Battle for /.test(e.text)).map(e=>e.text);
  ok(p1.some(e=>/^⚔ \*\*Battle for /.test(e.text)&&e.text.includes(X.name)),`the quarry's attack on ${X.name} was fought (staging)`);
  ok(battles.length===1,`${A.name} fights one battle in Early Summer, not ${battles.length}: ${battles.join(' / ')}`);
  ok(p1.some(e=>/chase after .* must wait/.test(e.text)),'the chase waits for the next season');
  ok(!p1.some(e=>/(rides|presses on) into .*(finds|trail of)/.test(e.text)&&(e.charId===A.id||(e.text||'').startsWith(A.name))),`${A.name} stays in ${X.name} for the season`);

  // (2) Hunter and quarry start next door to each other: the hunter in his own province X, the quarry
  // in his own province Y, with ground of his own (V) to fall back to. The catch is certain (the hook
  // above), and six Elite Warg Riders against two Green levies win the battle.
  W.__KC_CATCH=100;
  { const r2=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
      S.relations=S.relations||{}; S.relations['0-1']='enemy';
      const A=S.characters.find(c=>c.alive&&c.player===0&&c.isKing), B=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);
      let X,Y,V;
      for(const p of S.world.provinces.filter(p=>p.terrain!=='sea')){ const n=nb(S,p).filter(q=>q.terrain!=='sea'); if(n.length>=2){ Y=p; X=n[0]; V=n.find(q=>q.id!==X.id&&!nb(S,X).some(z=>z.id===q.id))||n[1]; break; } }
      S.characters=S.characters.filter(c=>c.player!=null||![X.id,Y.id,V.id].includes(c.location));
      [X,Y,V].forEach(p=>{ p.characters=(p.characters||[]).filter(id=>S.characters.some(c=>c.id===id)); });
      own(S,X,0); own(S,Y,1); own(S,V,1);
      place(S,A,X); A.armies=army('Warg Riders',6,'Elite'); A.skills={...(A.skills||{}),spy:9};
      place(S,B,Y); B.armies=army('Light Infantry',2,'Green'); B.skills={...(B.skills||{}),spy:0};
      return {A,B,Y};
    },orders:(S,c)=>({[c.A.id]:plan(order('encounter',c.B.id))})});   // the chase, as an Encounter order sets it
    const {A,Y}=r2.extra;
    const ph=r2.log.find(e=>/runs .* to ground .* forces battle/.test(e.text));
    ok(!!ph,'(2) the hunter runs the quarry to ground and forces battle (staging)');
    ok(!!ph&&r2.log.some(e=>e.phase===ph.phase&&e.text.includes(A.name+"'s forces defeat")),'(2) …and wins it (staging)');
    ok(r2.S2.world.provinces[Y.id].owner===0,`(2) winning the chase battle takes ${Y.name} (owner now ${r2.S2.world.provinces[Y.id].owner})`);
    ok(r2.log.some(e=>/claims .* for /.test(e.text)&&e.text.includes(Y.name)),'(2) …and his report says he claims it'); }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
