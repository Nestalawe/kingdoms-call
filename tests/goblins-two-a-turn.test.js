// 2026-10-11 (Toby, the army roster, decision 9) — Goblin Hordes come two a turn: wherever a province
// offers them, a realm may raise two in one turn, as garrisons and shipyard hulls already do, while every
// other land unit outside the founder's own capital stays at one. The cap is for the turn, not the order.
// Level 2 (scenario): getRecruitLimit and the recruit order live inside runTurn, so only a real turn shows
// the gate. The figure the player portal's order form shows (maxPerTurn) comes from buildTurnReport, the
// module-level builder of a player's turn data, read on the same world.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const count=(armies,type)=>(armies||[]).filter(a=>a&&a.type===type).length;
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
    const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    const home=W.homeProvinceIdFor(S,0);
    // A: a land province that is nobody's capital, made player 0's, Orcish, offering Goblins, Berserkers
    // and the Orc garrison. Any neutral guard standing there is removed so no battle gets in the way.
    const A=S.world.provinces.find(p=>p.terrain!=='sea'&&p.id!==home&&p.owner==null);
    if(!H||!A) throw new Error('could not stage: no hero or no free land province');
    S.characters=S.characters.filter(c=>c.player!=null||c.location!==A.id);
    A.characters=(A.characters||[]).filter(id=>S.characters.some(c=>c.id===id));
    own(S,A,0); A.race='Orcish'; A.armyTypes=['Goblin Horde','Orc Berserkers','Orc Garrison'];
    S.players[0].gold=200;
    place(S,H,A); H.armies=[]; H.items=[];
    return {H,A};
  },orders:(S,c)=>({[c.H.id]:plan(order('recruit','Goblin Horde|3,Orc Berserkers|2'),order('recruit','Goblin Horde|1'))})});
  const {H,A}=r.extra;
  const txt=r.text(H.id);
  const H2=r.S2&&r.S2.characters.find(c=>c.id===H.id);
  ok(!!H2,'the hero is still there after the turn');
  ok(/recruits 2× Goblin Horde, 1× Orc Berserkers in /.test(txt),'phase 1: of three Goblin Hordes and two Berserkers ordered, two Hordes and one Berserker company are raised — '+(txt.match(/recruits[^\n]*/)||['no recruit line'])[0].slice(0,160));
  ok(H2&&count(H2.armies,'Goblin Horde')===2,`the hero leads two Goblin Hordes (got ${H2&&count(H2.armies,'Goblin Horde')})`);
  ok(H2&&count(H2.armies,'Orc Berserkers')===1,`…and one Orc Berserkers company (got ${H2&&count(H2.armies,'Orc Berserkers')})`);
  ok(/entirely blocked: Goblin Horde \(already recruited this turn\)/.test(txt),'phase 2: a third Goblin Horde in the same province is refused — the cap is for the turn');
  // The order form's figure, as the player portal receives it.
  let od=null; try{ od=W.buildTurnReport(W.playerView(r.S2,0)).provinceOrderData[A.id]; }catch(e){ ok(false,'buildTurnReport runs on the saved world: '+e.message); }
  const maxOf=t=>{ const e=od&&(od.armyTypes||[]).find(x=>x.type===t); return e?e.maxPerTurn:null; };
  ok(maxOf('Goblin Horde')===2,`the order form offers two Goblin Hordes a turn there (maxPerTurn ${maxOf('Goblin Horde')})`);
  ok(maxOf('Orc Berserkers')===1,`…one Orc Berserkers company (maxPerTurn ${maxOf('Orc Berserkers')})`);
  ok(maxOf('Orc Garrison')===2,`…and two garrison units, as before (maxPerTurn ${maxOf('Orc Garrison')})`);
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
