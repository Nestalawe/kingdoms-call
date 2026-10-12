// 2026-10-13 (Toby, Creatures and Monsters III) — Shark Shoals, the weak sea Monster, and the half-and-half seas.
// Level 2 (scenario): the sea pass lives inside generateNewGame and the recruit path inside runTurn.
//   • three worlds: every poor sea is whale waters or shark waters, and the two are dealt in equal shares (they
//     differ by at most one in a world); shark waters carry the pool ['Shark Shoals'], the race 'Primal:Shark',
//     Shark Shoals defenders of the Primal race and the poor tax (2–3); whale waters are as they were; the
//     prosperous primal seas still hold Sea Giants or Eldritch Kraken at tax 4–6; shark waters are named from
//     their own pool (the GM portal's source holds it);
//   • a turn: an Evil king standing in his own shark waters recruits two Shark Shoals companies, of the Primal
//     race whatever his realm's race; the one function that applies the Druid shortfall waives it for him and
//     charges a Neutral commander at Druid 0 three levels (×0.4).
const fs=require('fs');
const {bootScenario, order, plan}=require('./lib/scenario');
const {sitePath}=require('./lib/boot');
const {ROSTER}=require('./lib/primal-decided');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario();
  const W=sc.W;
  const RICH=new Set(W.eval('KC_UNIT_CLASS.primalSea').filter(t=>t!=='Shark Shoals'));   // the prosperous seas' beasts (Sea Giants, Eldritch Kraken and, from Creatures and Monsters IV, Great Turtles); a poor sea holds whales or sharks
  const king=(S,pi)=>S.characters.find(c=>c.isKing&&c.player===pi);

  // ── The seas of three worlds ──
  let whalesAll=0, sharksAll=0;
  for(let k=0;k<3;k++){
    // One realm: the sea pass deals the poor seas turn about (exactly half each), and afterwards the home coastal
    // guarantee may open ONE guarded sea beside each home into open water, whale or shark, so the counts differ by
    // at most one, plus one per realm.
    const {S}=await sc.world({realms:1,cols:14,rows:8,seaPct:40});
    const seas=S.world.provinces.filter(p=>p&&p.terrain==='sea');
    const poor=seas.filter(p=>(p.armyTypes||[]).length&&!RICH.has(p.armyTypes[0]));
    const whales=poor.filter(p=>p.armyTypes[0]==='Whale Cohort'), sharks=poor.filter(p=>p.armyTypes[0]==='Shark Shoals');
    whalesAll+=whales.length; sharksAll+=sharks.length;
    ok(poor.length===whales.length+sharks.length,`world ${k}: every poor sea is whale waters or shark waters (${poor.length} poor: ${whales.length} whale, ${sharks.length} shark)`);
    ok(Math.abs(whales.length-sharks.length)<=2,`world ${k}: the poor seas are dealt half and half, less the one sea the home coastal guarantee may open (${whales.length} whale, ${sharks.length} shark)`);
    ok(sharks.every(p=>p.race==='Primal:Shark'&&p.armyTypes.length===1),`world ${k}: shark waters carry the race Primal:Shark and the pool [Shark Shoals] only`);
    ok(sharks.every(p=>p.tax>=2&&p.tax<=3),`world ${k}: shark waters are poor (tax 2–3; got ${[...new Set(sharks.map(p=>p.tax))].join(',')})`);
    ok(sharks.every(p=>(p.neutralDefenders||[]).length>=1&&p.neutralDefenders.every(d=>d.type==='Shark Shoals'&&d.race==='Primal')),`world ${k}: shark waters are guarded by Shark Shoals of the Primal race`);
    ok(whales.every(p=>p.race==='Primal:Whale'&&p.tax>=2&&p.tax<=3&&(p.neutralDefenders||[]).every(d=>d.type==='Whale Cohort')),`world ${k}: whale waters are as they were`);
    const primal=seas.filter(p=>(p.armyTypes||[]).length&&RICH.has(p.armyTypes[0]));
    ok(primal.every(p=>p.tax>=4&&p.tax<=6&&!/Shark|Whale/.test(p.race)),`world ${k}: the prosperous primal seas are untouched (${primal.length})`);
    ok(sharks.every(p=>typeof p.name==='string'&&p.name.length>0),`world ${k}: every shark sea has a name`);
  }
  ok(whalesAll+sharksAll>=6,`the three worlds dealt enough poor seas to mean something (${whalesAll} whale, ${sharksAll} shark)`);
  const gm=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
  ok(W.eval("KC_UNIT_CLASS.primalSea.includes('Shark Shoals')&&KC_UNIT_CLASS.sea.includes('Shark Shoals')&&!KC_UNIT_CLASS.carrier.includes('Shark Shoals')"),'the Shark Shoals are a primal sea beast (they swim, carry nothing, and are raised only at sea) and no hull');
  ok(/NAME_SEA_BY_TYPE=\{[\s\S]{0,900}?\bshark:\s*\{pre:\[/.test(gm)&&/race==='Primal:Shark'\)\s*kind='shark'/.test(gm),'shark waters are named from their own pool (NAME_SEA_BY_TYPE.shark, chosen for the race Primal:Shark)');

  // ── The Druid shortfall, in the one function that applies it ──
  const pen=(align,druid)=>W.eval(`druIdPenaltyMult({race:'Orcish',alignment:'Neutral',skills:{druid:${druid}},items:[]},{type:'Shark Shoals',race:'Primal'},${JSON.stringify(align)},false)`);
  ok(pen('Evil',0)===1,`an Evil realm leads Shark Shoals with no Druid (got ×${pen('Evil',0)})`);
  ok(Math.abs(pen('Neutral',0)-0.4)<1e-9,`a Neutral commander at Druid 0 is ${ROSTER['Shark Shoals'].druid} levels short: ×0.4 (got ×${pen('Neutral',0)})`);
  ok(pen('Neutral',3)===1,'…and at Druid 3 leads them in full');

  // ── Recruiting in one's own shark waters ──
  {
    const r=await sc.turn({realms:2,alignments:['Evil','Neutral'],prepare(S){
      const ek=king(S,0);
      // Stage the waters directly: the realm's own shark waters, the king standing in them with a full purse.
      const sea=S.world.provinces.find(p=>p&&p.terrain==='sea');
      S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(x=>x!==sea.id); });
      sea.owner=0; sea.race='Primal:Shark'; sea.armyTypes=['Shark Shoals']; sea.neutralDefenders=[]; sea.npcArmies=0; sea.tax=2;
      S.players[0].provinces.push(sea.id); ek.location=sea.id; S.players[0].gold=40;
      ek.armies=[];   // he puts out alone: his starting foot would need hulls, and the point is that the shoal needs none
      return {ek:ek.id,sea:sea.id,cost:W.eval("ARMY_COST_MASTER['Shark Shoals']")};
    },orders:(S,x)=>({ [x.ek]:plan(order('recruit','Shark Shoals|1')) })});
    const x=r.extra, ek2=r.S2&&r.S2.characters.find(c=>c.id===x.ek);
    const shoals=((ek2&&ek2.armies)||[]).filter(a=>a.type==='Shark Shoals');
    ok(shoals.length===1,`the king leads one Shark Shoals company after the turn (got ${shoals.length}): ${r.text(x.ek).split('\n').filter(l=>/Shark|recruit/i.test(l)).slice(0,2).join(' | ')}`);
    ok(!/too few hulls|left holding/.test(r.text(x.ek)),`the shoal swims beside its king: nothing is stranded or left as a garrison — ${(r.text(x.ek).split('\n').find(l=>/too few hulls|left holding/.test(l))||'').slice(0,160)}`);
    ok(shoals.length>0&&shoals.every(a=>a.race==='Primal'),`the shoal is of the Primal race, whoever raises it (got ${[...new Set(shoals.map(a=>a.race))].join(',')})`);
    ok(shoals.length>0&&shoals.every(a=>typeof a.unitName==='string'&&/^the /.test(a.unitName)),`the shoal has a company name (${shoals.map(a=>a.unitName).join('; ')})`);
    ok(x.cost===ROSTER['Shark Shoals'].cost,`a Shark Shoals company costs ${ROSTER['Shark Shoals'].cost}g (the master table says ${x.cost})`);
  }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
