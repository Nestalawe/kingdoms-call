// 2026-10-13 (Toby, Creatures and Monsters IV) — the four new Creatures: Great Bears, Unicorn Herd, Mammoth Host and
// Great Turtles, in the world and in a turn. Level 2 (scenario): the wild pools and the sea pass live inside
// generateNewGame, and the recruit path inside runTurn.
//   • the two copies of the Creature pool (world generation's, and the alignment-neighbour pass's) agree, and deal
//     the new land beasts by terrain: bears in forest and mountain, unicorns on the plain and in the forest,
//     mammoths on the plain and in the desert; no land pool holds the turtles;
//   • three worlds: every Creature province's beast is in its terrain's pool; every prosperous sea holds Sea
//     Giants, Eldritch Kraken or Great Turtles (race Primal:Great Turtle), and the turtles do appear;
//   • the classes: the Great Turtles swim (primalSea, sea; a carrier too since Island Back); the Unicorn Herd is cavalry;
//     Whale Lore lifts the Great Turtles with the Whale Cohort;
//   • a turn: a Neutral king at Druid 4 recruits a Great Turtles company in his own prosperous sea and is not
//     stranded. (Awaken the Wild was removed on 2026-10-12, Toby item 22: tests/beast-calls-gone.)
const fs=require('fs'), vm=require('vm');
const {bootScenario, order, plan}=require('./lib/scenario');
const {sitePath}=require('./lib/boot');
const {ROSTER}=require('./lib/primal-decided');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

const NEW_LAND={'Great Bears':['forest','mountain'],'Unicorn Herd':['plain','forest'],'Mammoth Host':['plain','desert']};
const RICH=new Set(['Sea Giants','Eldritch Kraken','Great Turtles']);

(async()=>{
  const sc=await bootScenario();
  const W=sc.W;
  const king=(S,pi)=>S.characters.find(c=>c.isKing&&c.player===pi);
  const nbrs=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);

  // ── The pools, as written ──
  // each pool is the value it is declared with in the GM portal's code, read by its syntax tree (tests/lib/source.ts;
  // until plan P1-09a it was cut out of the built page's text)
  const {initializersOf,pageScripts}=require('./lib/source.ts');
  const pool=name=>{ const vs=pageScripts('kingdoms-call-gm-portal.html').flatMap(f=>initializersOf(f,name)); if(vs.length!==1) return null; try{ return vm.runInNewContext(vs[0],{}); }catch(e){ return null; } };
  const POOL=pool('CREATURE_BY_TERRAIN'), CBT=pool('CBT');
  ok(!!POOL&&!!CBT,'the GM portal declares CREATURE_BY_TERRAIN and its alignment-pass copy CBT');
  if(POOL&&CBT){
    ok(JSON.stringify(POOL)===JSON.stringify(CBT),'the two copies of the Creature pool agree');
    for(const [u,terrs] of Object.entries(NEW_LAND)){
      for(const t of terrs) ok((POOL[t]||[]).includes(u),`${u} are dealt to ${t} provinces`);
      for(const t of Object.keys(POOL).filter(t=>!terrs.includes(t))) ok(!(POOL[t]||[]).includes(u),`${u} are not dealt to ${t} provinces`);
    }
    ok(!Object.values(POOL).some(l=>l.includes('Great Turtles')),'no land pool holds the Great Turtles');
    ok(!Object.values(POOL).some(l=>l.includes('Whale Cohort')),'no land pool holds the Whale Cohort');
  }

  // ── The classes and Whale Lore ──
  // (2026-10-13, Creatures and Monsters VI: the turtles' Island Back makes them a carrier too; they stay a primal sea beast.)
  ok(W.eval("KC_UNIT_CLASS.primalSea.includes('Great Turtles')&&KC_UNIT_CLASS.sea.includes('Great Turtles')"),'the Great Turtles are a primal sea beast (they swim and are raised only at sea)');
  ok(W.eval("KC_UNIT_CLASS.cavalry.includes('Unicorn Herd')&&!KC_UNIT_CLASS.cavalry.includes('Great Bears')&&!KC_UNIT_CLASS.cavalry.includes('Mammoth Host')"),'the Unicorn Herd is cavalry; the bears and mammoths are not');
  ok(W.eval("KC_UNIT_CLASS.creature.includes('Great Turtles')&&!KC_UNIT_CLASS.monster.includes('Great Turtles')"),'the Great Turtles are a Creature among the sea-beasts');
  const lore=W.eval("((SAGE_DISCOVERIES_P.find(d=>d.id==='au20')||{}).effect||{}).types||[]");
  ok(Array.isArray(lore)&&lore.includes('Whale Cohort')&&lore.includes('Great Turtles'),`Whale Lore lifts the Whale Cohort and the Great Turtles (got ${JSON.stringify(lore)})`);

  // ── Three worlds ──
  let turtleSeas=0, creatureProvs=0;
  for(let k=0;k<3;k++){
    const {S}=await sc.world({realms:3,cols:14,rows:8,seaPct:30,alignments:['Druidic','Neutral','Neutral']});
    const wild=S.world.provinces.filter(p=>p&&String(p.race||'').startsWith('Primal:')&&(p.armyTypes||[]).length);
    const land=wild.filter(p=>p.terrain!=='sea'&&W.eval('KC_UNIT_CLASS.creature').includes(p.armyTypes[0]));
    creatureProvs+=land.length;
    ok(land.every(p=>((POOL||{})[p.terrain]||[]).includes(p.armyTypes[0])),`world ${k}: every Creature province's beast is in its terrain's pool (${land.length} provinces)`);
    const seas=wild.filter(p=>p.terrain==='sea'&&RICH.has(p.armyTypes[0]));
    ok(seas.every(p=>p.race==='Primal:'+W.eval(`PRIMAL_ARMY_DEFS_P[${JSON.stringify(p.armyTypes[0])}].race`)&&p.tax>=4&&p.tax<=6&&(p.neutralDefenders||[]).every(d=>d.type===p.armyTypes[0]&&d.race==='Primal')),`world ${k}: the prosperous seas carry their beast's race, tax 4–6 and its own defenders (${seas.length} seas)`);
    turtleSeas+=seas.filter(p=>p.armyTypes[0]==='Great Turtles').length;
    ok(!wild.some(p=>p.terrain==='sea'&&['Great Bears','Unicorn Herd','Mammoth Host'].includes(p.armyTypes[0])),`world ${k}: no sea holds a land Creature`);
  }
  // Around twenty prosperous seas over three worlds, a third of them turtles: the odds of none are below one in a thousand.
  ok(turtleSeas>=1,`the Great Turtles appear in the prosperous seas (${turtleSeas} turtle seas over three worlds)`);
  ok(creatureProvs>=10,`the three worlds dealt enough Creature provinces to mean something (${creatureProvs})`);

  // ── A turn: the turtles' waters ──
  {
    const r=await sc.turn({realms:2,alignments:['Druidic','Neutral'],prepare(S){
      const dk=king(S,0), nk=king(S,1);
      dk.skills=Object.assign({},dk.skills,{druid:3}); nk.skills=Object.assign({},nk.skills,{druid:4});
      const H=home(S,0);
      // The king in an owned forest beside home; the heir in an owned wild province; a Druid-1 hero in another.
      const take=(p,race,types)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(x=>x!==p.id); }); p.owner=0; S.players[0].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; if(race){ p.race=race; p.armyTypes=types; } return p; };
      const around=nbrs(S,H).filter(p=>p.terrain!=='sea');
      const forest=take(around[0],null,null); forest.terrain='forest'; delete forest._awakenTurn;
      const wild1=take(around[1],'Primal:Stone Giant',['Stone Giants']);
      const wild2=take(around[2],'Primal:Forest Ent',['Forest Ents']);
      const clone=(from,id,name,druid,loc)=>{ const c={...JSON.parse(JSON.stringify(from)),id,name,isKing:false,isHeir:false,armies:[],items:[],location:loc,skills:{druid,melee:1}}; S.characters.push(c); return c; };
      const heir=clone(dk,'iv-heir','Rowan of the Deep Wood',3,wild1.id);
      const hero=clone(dk,'iv-hero','Tamsin Greenhand',1,wild2.id);
      dk.location=forest.id; S.players[0].gold=60;
      // The Neutral king stands in his own prosperous sea, the turtles' waters, with no hull under him.
      const sea=S.world.provinces.find(p=>p&&p.terrain==='sea'&&nbrs(S,p).every(n=>n.owner!==0));
      S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(x=>x!==sea.id); });
      sea.owner=1; S.players[1].provinces.push(sea.id); sea.race='Primal:Great Turtle'; sea.armyTypes=['Great Turtles']; sea.neutralDefenders=[]; sea.npcArmies=0; sea.tax=5;
      nk.location=sea.id; nk.armies=[]; S.players[1].gold=40;
      return {dk:dk.id,heir:heir.id,hero:hero.id,nk:nk.id,forest:forest.id,wild1:wild1.id,sea:sea.id,
        bearCost:W.eval("ARMY_COST_MASTER['Great Bears']"),mamCost:W.eval("ARMY_COST_MASTER['Mammoth Host']")};
      function home(S,pi){ return S.world.provinces[S.players[pi].homeProvinceId]; }
    },orders:(S,x)=>({
      [x.nk]:plan(order('recruit','Great Turtles|1')),
    })});
    const x=r.extra, t=r.text();
    const army=(id,type)=>(((r.S2&&r.S2.characters.find(c=>c.id===id))||{}).armies||[]).filter(a=>a.type===type);
    const turtles=army(x.nk,'Great Turtles');
    ok(turtles.length===1,`the Neutral king recruits one company of Great Turtles in his own waters (got ${turtles.length}): ${r.text(x.nk).split('\n').filter(l=>/Turtle|recruit/i.test(l)).slice(0,2).join(' | ')}`);
    ok(!/too few hulls|left holding/.test(r.text(x.nk)),`the turtles swim beside their king: nothing is stranded — ${(r.text(x.nk).split('\n').find(l=>/too few hulls|left holding/.test(l))||'').slice(0,160)}`);
    ok(turtles.length>0&&turtles.every(a=>typeof a.unitName==='string'&&/^the /.test(a.unitName)),`the turtles have a company name (${turtles.map(a=>a.unitName).join('; ')})`);
  }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
