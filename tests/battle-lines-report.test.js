// 2026-10-11 (Toby, battle lines I: rows and columns) — the report draws the lines. Level 2 (scenario):
// one real turn with a realm battle (a king attacks a rival's province) and a province battle (a hero
// attacks neutral defenders). Both reports must name the front the ground allows (within the
// terrain's range), draw a 📊 grid line for each side, put the attacker's Longbows in the second line
// behind the Levies, and give the ladder its Battle-lines stage. A unit test can't do this: the two
// battle paths each build their own rows and print their own report, and this checks both.
// Nothing here depends on who wins: the grid is drawn before the dice.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const RANGE={plain:[6,8],desert:[6,8],sea:[8,10],forest:[4,6],jungle:[4,6],mountain:[2,4]};
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const army=(type,n,q)=>Array.from({length:n},(_,i)=>({type,quality:q||'Average',unitName:type+' '+(i+1)}));
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
    S.relations=S.relations||{}; S.relations['0-1']='enemy';
    const A=S.characters.find(c=>c.alive&&c.player===0&&c.isKing), B=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);
    const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    // X: the rival's province A attacks from Z. N: a neutral province still held by its own guard
    // character (the engine fights for neutral land only when a guard stands there), which H attacks
    // from P next door. The guard is given the units the test looks for.
    let X,Z,N,P,guard;
    const land=p=>p.terrain!=='sea';
    for(const p of S.world.provinces.filter(land)){ const n=nb(S,p).filter(land); if(n.length>=2){ X=p; Z=n[0]; break; } }
    for(const g of S.characters.filter(c=>c.player==null&&c.alive&&c._isNeutralGuard&&(c.armies||[]).length)){
      const q=S.world.provinces[g.location]; if(!q||!land(q)||q.owner!=null||q.id===X.id||q.id===Z.id) continue;
      const pp=nb(S,q).filter(land).find(x=>x.id!==X.id&&x.id!==Z.id&&x.id!==q.id); if(!pp) continue;
      guard=g; N=q; P=pp; break; }
    if(!guard) throw new Error('no neutral guard to stage the province battle against');
    S.characters=S.characters.filter(c=>c.player!=null||c.id===guard.id||![X.id,Z.id,P.id].includes(c.location));
    [X,Z,P].forEach(p=>{ p.characters=(p.characters||[]).filter(id=>S.characters.some(c=>c.id===id)); });
    own(S,X,1); own(S,Z,0); own(S,P,0);
    guard.armies=army('Goblin Horde',2).concat(army('Orc Berserkers',1)); N.neutralDefenders=[...guard.armies]; N.npcArmies=3;
    place(S,A,Z); A.armies=army('Shieldwall Levies',6).concat(army('Yeoman Longbows',3),army('Free Lances',2));
    place(S,B,X); B.armies=army('Dwarven Guard',3).concat(army('Ironwood Crossbows',2));
    place(S,H,P); H.armies=army('Shieldwall Levies',4).concat(army('Yeoman Longbows',2),army('Gilded Lances',1));
    return {A,B,H,X,Z,N,P};
  },orders:(S,c)=>({[c.A.id]:plan(order('move',c.X.id)),[c.H.id]:plan(order('move',c.N.id))})});
  const {A,H,X,N}=r.extra;
  for(const [label,id,prov,open] of [['realm battle',A.id,X,'FreeL'],['province battle',H.id,N,'Gild']]){
    const lines=r.log.filter(e=>e.phase===0&&e.charId===id).map(e=>e.text); const txt=lines.join('\n');
    const m=/📊 Battle lines — the (.+?) allows? a front of (\d+)\./.exec(txt);
    ok(!!m,`${label}: the report names the front the ground allows`);
    if(!m) continue;
    const terr=prov.terrain, [lo,hi]=RANGE[terr]||[6,8], Wd=+m[2];
    ok(Wd>=lo&&Wd<=hi,`${label} (${terr}): a front of ${Wd} is within ${lo}–${hi}`);
    const grid=lines.filter(l=>l.startsWith('📊')&&l.includes('│'));
    ok(grid.length>=2,`${label}: at least one grid line per side (${grid.length} drawn)`);
    const atkFirst=grid.find(l=>/ 1st │/.test(l)&&l.includes('Levy')), atkSecond=grid.find(l=>/ 2nd │/.test(l)&&l.includes('Bow'));
    ok(!!atkFirst,`${label}: the attacker's Levies hold the front`);
    ok(!!atkSecond&&!/Bow/.test(atkFirst||''),`${label}: the attacker's Longbows stand in the second line, behind the front`);
    if(['plain','desert'].includes(terr)) ok(new RegExp('flanks: .*'+open).test(atkFirst||''),`${label} (${terr}): the attacker's cavalry ride the flank`);
    else ok(!/flanks:/.test(atkFirst||'')&&new RegExp(open).test(txt),`${label} (${terr}): no flank on rough ground; the cavalry stand in the line`);
    const widthCells=(atkFirst||'').split('│')[1]||''; ok(widthCells.trim().split(/\s+/).length===Wd,`${label}: the front line prints exactly ${Wd} cells`);
    ok(new RegExp('Battle lines \\(front of '+Wd+'\\): \\d+ → \\*\\*\\d+\\*\\* \\(').test(txt),`${label}: the ladder has its Battle-lines stage for a front of ${Wd}`);
    ok(!/undefined|NaN|\[object Object\]/.test(txt),`${label}: no undefined / NaN in the report`);
  }
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
