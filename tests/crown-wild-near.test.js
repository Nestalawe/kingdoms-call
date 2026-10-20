// 2026-10-13 (item 12) — in a newly generated world every Druidic king has at least one land Creature
// province within two provinces of home, and every Evil king a land Monster province, so each crown
// reaches its speciality early. The guarantees around homes still hold: no home's ring holds more
// than one wild (Creature or Monster) province, and each home's poor and prosperous neighbours stay
// humanoid. Checked over many worlds from 2 realms to the largest size, every realm Druidic or Evil:
//   natural — world generation as it is (the alignment pass usually puts the province right beside
//     the home, so these worlds already passed before item 12);
//   no free neighbour — the alignment pass is made to find no free neighbour (the case its comment
//     allows: "may be empty"): the engine is loaded from a copy of src/ whose `_freeNbrs` is declared empty, found by
//     its syntax tree (tests/lib/source.ts). Before item 12 these worlds left crowns with no wild country of their own
//     near home.
// Simulation level: world generation is one long function and the property is over whole worlds. The worlds are made
// in the engine's bare vm (tests/lib/engine.ts). Until plan P1-09a they were made on the GM portal, and a code-anchor
// hook on the `_freeNbrs` line emptied it.
const vm=require('vm');
const {readPage}=require('./lib/boot'); const {loadEngine,engineFn}=require('./lib/engine.ts');
const {plantedSrc,replaceInitializer,pageStrings}=require('./lib/source.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const N=+(process.argv[2]||4);   // worlds per size
(async()=>{
  const empty=plantedSrc({'engine/world/generate.js':(code,file)=>replaceInitializer(code,file,'generateNewGame','_freeNbrs','[]')});
  for(const variant of ['natural','no free neighbour']){
  const engine=variant==='natural'?loadEngine({seed:1}):loadEngine({seed:1,src:empty.dir});
  const quiet=vm.runInContext('console',engine); const [log,warn]=[quiet.log,quiet.warn]; quiet.log=quiet.warn=()=>{};
  const W={eval:x=>vm.runInContext(x,engine),generateBotSetups:engineFn(engine,'generateBotSetups'),
    generateNewGame:engineFn(engine,'generateNewGame'),getNeighborsP:engineFn(engine,'getNeighborsP')};
  const CRE=new Set(W.eval('KC_UNIT_CLASS.creature')), MON=new Set(W.eval('KC_UNIT_CLASS.monster'));
  ok(CRE.size>5&&MON.size>5,'the Creature and Monster tables were read');
  const sizes=[[2,8,5],[3,8,7],[4,9,7],[6,16,10],[10,20,12]];
  let crowns=0, missing=[], capBroken=[], pairBroken=[];
  for(const [realms,cols,rows] of sizes) for(let k=0;k<N;k++){
    const setup=W.generateBotSetups([],realms,0).map((b,i)=>({...b,alignment:(i+k)%2?'Evil':'Druidic',gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols,rows},999,{seaPct:25});
    const P=S.world.provinces;
    const nb=p=>W.getNeighborsP(p,cols,rows,P).filter(Boolean);
    const wild=p=>p&&p.terrain!=='sea'&&String(p.race||'').startsWith('Primal');
    S.players.forEach(pl=>{
      const home=P[pl.homeProvinceId]; crowns++;
      const want=pl.alignment==='Druidic'?CRE:MON;
      const near=new Set(); nb(home).forEach(n=>{ near.add(n); nb(n).forEach(m=>{ if(m!==home) near.add(m); }); });
      if(![...near].some(q=>wild(q)&&want.has((q.armyTypes||[])[0]))) missing.push(`${realms} realms, world ${k}: ${pl.alignment} home ${home.name}`);
      const ringWild=nb(home).filter(n=>wild(n)&&n.owner==null);
      if(ringWild.length>1) capBroken.push(`${home.name}: ${ringWild.length}`);
    });
    // the poor and prosperous neighbours promised to each home: at least one humanoid own-race land neighbour
    S.players.forEach(pl=>{ const home=P[pl.homeProvinceId];
      if(!nb(home).some(n=>n.terrain!=='sea'&&n.race===pl.race)) pairBroken.push(home.name); });
  }
  ok(crowns>=40,`${variant}: enough crowns were checked (${crowns})`);
  ok(!missing.length,`${variant}: every Druidic home has a land Creature province within two provinces, and every Evil home a Monster one (${missing.length} missing: ${missing.slice(0,3).join(' | ')})`);
  ok(!capBroken.length,`${variant}: no home's ring holds more than one wild province (${capBroken.slice(0,3).join(' | ')})`);
  ok(!pairBroken.length,`${variant}: every home still borders a province of its own race (${pairBroken.slice(0,3).join(' | ')})`);
  quiet.log=log; quiet.warn=warn;
  }
  empty.remove();
  // The books say so: both crowns' rulebook entries and their player-portal blurbs.
  const rules=readPage('kingdoms-call-rules.html'), pp=pageStrings('kingdoms-call-player-portal.html').join('\n');
  ok((rules.match(/always at least one (Creature|Monster) province within two provinces of your home/g)||[]).length===2,'the rulebook promises both crowns their wild country within two provinces');
  ok(/Creature province within two provinces of your home/.test(pp)&&/Monster province you can lead from turn one, and there is always at least one within two provinces/.test(pp),'the player portal\'s Druidic and Evil blurbs say the same');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})();
