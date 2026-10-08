// 2026-10-08 (item 10) — a beaten force does not fall back onto ground that only magic has opened
// this turn (a Flooded province, or sea laid dry by Part Sea) while ordinary land is open to it.
// The retreat choosers are nested inside runTurn; the hook at "  // 4. Run all 5 phases" hands them
// back after one real turn, and each case is then staged on that world.
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario({inject:[["  // 4. Run all 5 phases\n",
    "  window.__RT={get G(){ return G; },retreatOptions,bestRetreat,navalSplitRetreat,getNeighborsP};\n  // 4. Run all 5 phases\n"]]});
  await sc.turn({cols:12,rows:7,seaPct:40});
  const H=sc.W.__RT; if(!H||typeof H.retreatOptions!=='function'){ console.log('hook missing: retreatOptions not exposed'); process.exit(1); }
  const G=H.G;
  const nb=p=>H.getNeighborsP(p,G.world.cols,G.world.rows,G.world.provinces).filter(Boolean);
  // A land province with at least two land neighbours: the battlefield, and two places to fall back to.
  const site=G.world.provinces.find(p=>p.terrain!=='sea'&&nb(p).filter(n=>n.terrain!=='sea').length>=2);
  const [P1,P2]=nb(site).filter(n=>n.terrain!=='sea');
  const unit=type=>({type,quality:'Average',race:'Human',unitName:type});
  const stage=(armies)=>{
    nb(site).concat([site]).forEach(p=>{ p.owner=null; p.characters=[]; p.garrisonArmies=[]; p.neutralDefenders=[]; delete p._flood; delete p._partSea; delete p._battleUnresolved; });
    [site,P1,P2].forEach(p=>{ p.owner=0; });
    P1.tax=1; P2.tax=6;   // the magic ground is the richer one, so the value rule alone would pick it
    const ch={id:9101,name:'Captain Test',player:0,alive:true,hp:20,maxHp:20,race:'Human',temper:'Brave',skills:{},items:[],armies,location:site.id,_attackedFrom:null};
    G.characters=G.characters.filter(c=>c.id!==9101); G.characters.push(ch); site.characters=[ch.id];
    return ch;
  };
  const pick=ch=>{ const o=H.retreatOptions(ch,site,ch.armies); return {o,best:H.bestRetreat(ch,o)}; };
  const flood=p=>{ p._flood={orig:p.terrain,turn:G.turn}; p.terrain='sea'; };
  const unflood=p=>{ if(p._flood){ p.terrain=p._flood.orig; delete p._flood; } };
  const part=p=>{ p._partSea={orig:'sea',turn:G.turn,blockFleetsFromPhase:0}; p.terrain='plains'; };

  // 1. A foot column: P2 is sea laid dry by Part Sea.
  { const ch=stage([unit('Shieldwall Levies'),unit('Shieldwall Levies')]); part(P2);
    const {o,best}=pick(ch);
    ok(o.some(p=>p.id===P1.id),'(1) ordinary land is a retreat option');
    ok(!o.some(p=>p.id===P2.id),'(1) parted sea is not, while ordinary land is open');
    ok(best&&best.id===P1.id,'(1) the column falls back to ordinary land'); }
  // 2. A flying host (it can cross water): P2 is Flooded.
  { const ch=stage([unit('Noble Griffons'),unit('Noble Griffons')]); P2.terrain=P2.terrain==='sea'?'plains':P2.terrain; flood(P2);
    const {o,best}=pick(ch);
    ok(!o.some(p=>p.id===P2.id),'(2) a flooded province is not an option while ordinary land is open');
    ok(best&&best.id===P1.id,'(2) the flyers fall back to ordinary land');
    unflood(P2); }
  // 3. With no ordinary land open, magic ground is still a way out.
  { const ch=stage([unit('Shieldwall Levies')]); P1.owner=null; part(P2);
    const {o}=pick(ch);
    ok(o.some(p=>p.id===P2.id),'(3) parted sea is still a retreat when nothing else is open'); }
  // 4. The naval split: ships with no friendly water march their troops inland — to ordinary land.
  { const ch=stage([unit('Galleon Fleet'),unit('Shieldwall Levies')]); part(P2);
    nb(site).filter(n=>n.terrain==='sea').forEach(n=>{ n.owner=null; });
    const lines=[]; H.navalSplitRetreat(ch,site,ch.armies,lines,ch.name);
    ok(ch.location===P1.id,`(4) the troops march inland to ordinary land (went to ${ch.location===P2.id?'the parted sea':ch.location})`); }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
