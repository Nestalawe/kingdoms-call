// 2026-10-13 (item 12) — in a newly generated world every Druidic king has at least one land Creature
// province within two provinces of home, and every Evil king a land Monster province, so each crown
// reaches its speciality early. The guarantees around homes still hold: no home's ring holds more
// than one wild (Creature or Monster) province, and each home's poor and prosperous neighbours stay
// humanoid. Checked over many worlds from 2 realms to the largest size, every realm Druidic or Evil:
//   natural — world generation as it is (the alignment pass usually puts the province right beside
//     the home, so these worlds already passed before item 12);
//   no free neighbour — the alignment pass is made to find no free neighbour (the case its comment
//     allows: "may be empty"), via the code-anchor hook on its `_freeNbrs` line. Before item 12 these
//     worlds left crowns with no wild country of their own near home.
// Simulation level: world generation is one long function and the property is over whole worlds.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const N=+(process.argv[2]||4);   // worlds per size
(async()=>{
  const ANCHOR="        const _freeNbrs=_allFreeNbrs.filter(n=>!_protectedIds.has(n.id)); // may be empty -> no alignment neighbour; the pair wins\n";
  for(const variant of ['natural','no free neighbour']){
  let html=readPage('kingdoms-call-gm-portal.html');
  if(variant!=='natural'){ if(html.split(ANCHOR).length!==2){ console.log('anchor not unique or missing: '+ANCHOR); process.exit(1); }
    html=html.replace(ANCHOR,"        const _freeNbrs=[];\n"); }
  const errs=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.generateNewGame!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
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
  if(errs.length){ fail++; console.log(`  ✗ ${variant}: page errors ${errs.length}`); errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | '))); }
  }
  // The books say so: both crowns' rulebook entries and their player-portal blurbs.
  const rules=readPage('kingdoms-call-rules.html'), pp=readPage('kingdoms-call-player-portal.html');
  ok((rules.match(/always at least one (Creature|Monster) province within two provinces of your home/g)||[]).length===2,'the rulebook promises both crowns their wild country within two provinces');
  ok(/Creature province within two provinces of your home/.test(pp)&&/Monster province you can lead from turn one, and there is always at least one within two provinces/.test(pp),'the player portal\'s Druidic and Evil blurbs say the same');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})();
