// 2026-10-13 (Toby, Creatures and Monsters IV) — the four new Creatures: Great Bears, Unicorn Herd, Mammoth Host and
// Great Turtles, in the world and in a turn. Level 2 (scenario): the wild pools and the sea pass live inside
// generateNewGame, and Awaken the Wild and the recruit path inside runTurn.
//   • the two copies of the Creature pool (world generation's, and the alignment-neighbour pass's) agree, and deal
//     the new land beasts by terrain: bears in forest and mountain, unicorns on the plain and in the forest,
//     mammoths on the plain and in the desert; no land pool holds the turtles;
//   • three worlds: every Creature province's beast is in its terrain's pool; every prosperous sea holds Sea
//     Giants, Eldritch Kraken or Great Turtles (race Primal:Great Turtle), and the turtles do appear;
//   • the classes: the Great Turtles swim and carry nothing (primalSea, sea, no hull); the Unicorn Herd is cavalry;
//     Whale Lore lifts the Great Turtles with the Whale Cohort;
//   • a turn: a Druidic king at Druid 3 awakens Great Bears in his forest; his heir awakens a Mammoth Host in a
//     wild province; a Druid-1 hero is refused the Unicorn Herd ("answer only a caller of Druid 3+"); a call for
//     Great Turtles is refused (the wild offers only creatures of the land); a Neutral king at Druid 4 recruits
//     a Great Turtles company in his own prosperous sea and is not stranded.
const fs=require('fs'), vm=require('vm');
const {bootScenario, order, plan}=require('./lib/scenario');
const {sitePath}=require('./lib/boot');
const {ROSTER,AWAKEN_TIERS}=require('./lib/primal-decided');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

// A `const NAME={…};` of the GM portal as source text (as tests/primal-roster does).
function slice(src,name){
  const start=src.indexOf(`const ${name}=`); if(start<0) return null;
  let i=src.indexOf('{',start), depth=0, q=null;
  for(;i<src.length;i++){
    const ch=src[i];
    if(q){ if(ch==='\\') i++; else if(ch===q) q=null; continue; }
    if(ch==="'"||ch==='"') q=ch;
    else if(ch==='{') depth++;
    else if(ch==='}'&&--depth===0) return src.slice(start,i+1)+';';
  }
  return null;
}
const NEW_LAND={'Great Bears':['forest','mountain'],'Unicorn Herd':['plain','forest'],'Mammoth Host':['plain','desert']};
const RICH=new Set(['Sea Giants','Eldritch Kraken','Great Turtles']);

(async()=>{
  const sc=await bootScenario();
  const W=sc.W;
  const king=(S,pi)=>S.characters.find(c=>c.isKing&&c.player===pi);
  const nbrs=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);

  // ── The pools, as written ──
  const gm=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
  const pool=name=>{ const s=slice(gm,name); if(!s) return null; try{ return vm.runInNewContext(s+'\n;'+name,{}); }catch(e){ return null; } };
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
  ok(W.eval("KC_UNIT_CLASS.primalSea.includes('Great Turtles')&&KC_UNIT_CLASS.sea.includes('Great Turtles')&&!KC_UNIT_CLASS.carrier.includes('Great Turtles')"),'the Great Turtles are a primal sea beast and no hull (they swim, carry nothing, and are raised only at sea)');
  ok(W.eval("KC_UNIT_CLASS.cavalry.includes('Unicorn Herd')&&!KC_UNIT_CLASS.cavalry.includes('Great Bears')&&!KC_UNIT_CLASS.cavalry.includes('Mammoth Host')"),'the Unicorn Herd is cavalry; the bears and mammoths are not');
  ok(W.eval("KC_UNIT_CLASS.creature.includes('Great Turtles')&&!KC_UNIT_CLASS.monster.includes('Great Turtles')"),'the Great Turtles are a Creature among the sea-beasts');
  const lore=W.eval("((SAGE_DISCOVERIES_P.find(d=>d.id==='au20')||{}).effect||{}).types||[]");
  ok(Array.isArray(lore)&&lore.includes('Whale Cohort')&&lore.includes('Great Turtles'),`Whale Lore lifts the Whale Cohort and the Great Turtles (got ${JSON.stringify(lore)})`);
  ok(!('Great Turtles' in W.eval('KC_AWAKEN_TIERS'))&&!('Whale Cohort' in W.eval('KC_AWAKEN_TIERS')),'Awaken the Wild never offers the Great Turtles or the Whale Cohort');

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

  // ── A turn: Awaken the Wild and the turtles' waters ──
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
      [x.dk]:plan(order('awaken_wild','Great Turtles'),order('awaken_wild','Great Bears')),
      [x.heir]:plan(order('awaken_wild','Mammoth Host')),
      [x.hero]:plan(order('awaken_wild','Unicorn Herd')),
      [x.nk]:plan(order('recruit','Great Turtles|1')),
    })});
    const x=r.extra, t=r.text();
    const army=(id,type)=>(((r.S2&&r.S2.characters.find(c=>c.id===id))||{}).armies||[]).filter(a=>a.type===type);
    ok(/choose a creature of the land to awaken/.test(r.text(x.dk)),'a call for Great Turtles is refused: the wild offers only creatures of the land');
    ok(/Awaken the Wild — .* Great Bears rise/.test(t),'the king awakens Great Bears in his forest');
    ok(army(x.dk,'Great Bears').length===1&&army(x.dk,'Great Bears')[0].race==='Primal',`the king leads one company of Great Bears, of the Primal race (got ${army(x.dk,'Great Bears').length})`);
    ok(/Awaken the Wild — .* Mammoth Host rise/.test(t)&&army(x.heir,'Mammoth Host').length===1,`the heir awakens a Mammoth Host in a wild province (got ${army(x.heir,'Mammoth Host').length})`);
    ok(/Unicorn Herd answer only a caller of Druid 3\+/.test(r.text(x.hero))&&army(x.hero,'Unicorn Herd').length===0,'a Druid-1 hero is refused the Unicorn Herd ("answer only a caller of Druid 3+")');
    const offerings=(t.match(new RegExp(`\\((${x.bearCost+2}|${x.mamCost+2})g offering`,'g'))||[]).length;
    ok(offerings===2,`each awakening cost the beast's price + 2g (${x.bearCost+2}g and ${x.mamCost+2}g): ${offerings} such offerings in the log`);
    const turtles=army(x.nk,'Great Turtles');
    ok(turtles.length===1,`the Neutral king recruits one company of Great Turtles in his own waters (got ${turtles.length}): ${r.text(x.nk).split('\n').filter(l=>/Turtle|recruit/i.test(l)).slice(0,2).join(' | ')}`);
    ok(!/too few hulls|left holding/.test(r.text(x.nk)),`the turtles swim beside their king: nothing is stranded — ${(r.text(x.nk).split('\n').find(l=>/too few hulls|left holding/.test(l))||'').slice(0,160)}`);
    ok(turtles.length>0&&turtles.every(a=>typeof a.unitName==='string'&&/^the /.test(a.unitName)),`the turtles have a company name (${turtles.map(a=>a.unitName).join('; ')})`);
    ok(AWAKEN_TIERS['Great Bears']===2&&AWAKEN_TIERS['Mammoth Host']===3&&AWAKEN_TIERS['Unicorn Herd']===3,'the decided tiers: Great Bears at Druid 2, Unicorn Herd and Mammoth Host at Druid 3');
  }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
