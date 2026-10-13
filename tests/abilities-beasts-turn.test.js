// 2026-10-13 (Toby, Creatures and Monsters V) — the two beast abilities only a real battle can show, because their
// hooks live in the rout code inside runTurn:
//   Manticore Pride's pursuit   when at least half the winning force are Manticores, every beaten company's chance of
//                               destruction in the rout rises by 15% (as the Wargs' Run Them Down), on any ground;
//   Shark Shoals' Feeding Frenzy the same at sea when at least half the winning force are Shark Shoals.
// Level 2 (scenario). Each fight is staged overwhelming (Elite beasts against one Green company, four times the
// strength and more: the fortune curve gives the stronger side the win), so the lines are a matter of the rule, not
// the dice.
const {bootScenario, order, plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario();
  const W=sc.W;
  const king=(S,pi)=>S.characters.find(c=>c.isKing&&c.player===pi);
  const nbrs=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const land=p=>p&&p.terrain!=='sea';
  const army=(type,n,q)=>Array.from({length:n},(_,i)=>({type,quality:q||'Elite',race:'Primal',unitName:`${type} ${i+1}`}));
  // Two realms at war: realm 0's king marches on realm 1's king, who stands with one Green company in a province
  // of his own beside realm 0's home.
  // On land the attacker marches from realm 0's home into a neighbour; at sea he puts out from an owned coast (the
  // beasts swim) into the sea beside it. The two realms are at war (G.relations, keyed "0-1").
  const stage=(S,atkArmies,defArmies,terrain)=>{
    const A=king(S,0), D=king(S,1);
    const own=(p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(x=>x!==p.id); }); p.owner=pi; S.players[pi].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; p.garrisonArmies=[]; };
    let from, target;
    if(terrain==='sea'){ from=S.world.provinces.find(p=>land(p)&&nbrs(S,p).some(n=>n.terrain==='sea')); target=nbrs(S,from).find(n=>n.terrain==='sea'); own(from,0); }
    else { from=S.world.provinces[S.players[0].homeProvinceId]; target=nbrs(S,from).find(land); if(target) target.terrain=terrain; }
    if(!target) throw new Error('could not stage: no neighbour of the right kind');
    own(target,1);
    S.characters=S.characters.filter(c=>c.player!=null||(c.location!==target.id&&c.location!==from.id));   // no wandering hero in the way
    D.location=target.id; D.armies=defArmies; D.skills=Object.assign({},D.skills,{tactical:0,druid:5,naval:0});
    A.location=from.id; A.armies=atkArmies; A.skills=Object.assign({},A.skills,{tactical:0,druid:5,naval:0});
    S.relations=Object.assign({},S.relations,{'0-1':'enemy'});
    return {A:A.id,D:D.id,target:target.id};
  };
  const war=()=>{};

  // ── The Manticores' pursuit, on the plain ──
  {
    const r=await sc.turn({realms:2,alignments:['Evil','Neutral'],prepare(S){ const x=stage(S,army('Manticore Pride',3),army('Shieldwall Levies',1,'Green').map(a=>({...a,race:'Human'})),'plain'); war(S); return x; },
      orders:(S,x)=>({ [x.A]:plan(order('move',x.target)) })});
    const t=r.text(r.extra.A);
    ok(/Battle for|battle is initiated/.test(t),'the Manticores fight the Levies');
    ok(/forces defeat|wins\*\*|\*\*wins/.test(t)&&!/repelled/.test(t),'…and win (three Elite Manticores against one Green Levy company)');
    ok(/Manticore Pride .*(run|hunt|pursue).*broken|pursue the broken companies|Manticores .*broken companies/.test(t)&&/\+15% losses/.test(t),`the pursuit line: the Manticores hunt the broken companies down (+15% losses) — ${(t.split('\n').find(l=>/\+15% losses/.test(l))||'no such line').slice(0,160)}`);
  }
  // ── …but not when they are fewer than half the winning force ──
  {
    const r=await sc.turn({realms:2,alignments:['Evil','Neutral'],prepare(S){ const x=stage(S,army('Manticore Pride',1).concat(army('Cave Trolls',2)),army('Shieldwall Levies',1,'Green').map(a=>({...a,race:'Human'})),'plain'); war(S); return x; },
      orders:(S,x)=>({ [x.A]:plan(order('move',x.target)) })});
    const t=r.text(r.extra.A);
    ok(/Battle for|battle is initiated/.test(t)&&!/\+15% losses/.test(t),'one Manticore among two Trolls hunts nobody down');
  }
  // ── Feeding Frenzy, at sea ──
  {
    const r=await sc.turn({realms:2,alignments:['Evil','Neutral'],seaPct:35,prepare(S){ const x=stage(S,army('Shark Shoals',6),army('Galleon Fleet',1,'Green').map(a=>({...a,race:'Human'})),'sea'); war(S); return x; },
      orders:(S,x)=>({ [x.A]:plan(order('move',x.target)) })});
    const t=r.text(r.extra.A);
    ok(/Battle for|battle is initiated/.test(t),'the shoals fight the galleon at sea');
    ok(/Feeding Frenzy/.test(t)&&/\+15% losses/.test(t),`Feeding Frenzy: the sharks tear into the beaten crews (+15% losses) — ${(t.split('\n').find(l=>/Feeding Frenzy/.test(l))||'no such line').slice(0,160)}`);
  }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
