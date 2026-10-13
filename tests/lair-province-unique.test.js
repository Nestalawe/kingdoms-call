// 2026-10-13 (item 4) — in a newly generated world no province holds two lairs with the same base
// name ("Wolf Den" and "Wolf Den of Karnholt" share one), and no province holds two of the same
// guardian. Checked over generated worlds from small to the largest size (where the name pools run
// out and the place-qualified names appear), plus a staged call of the name picker with every name
// of its element already given out.
// Simulation level: world generation is one long top-level function; the property is over whole worlds.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.generateNewGame!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const CONN=['of','beneath','under','below','beyond','within','on the marches of','in the shadow of','at the roots of','hard by'];
  const base=(name,prov)=>{ let b=String(name).replace(/ \(\d+\)$/,''); for(const c of CONN){ const s=` ${c} ${prov}`; if(b.endsWith(s)) return b.slice(0,-s.length); } return b; };

  const sizes=[[2,8,5],[4,12,8],[6,16,10],[10,20,12],[10,20,12]];
  let lairs=0, qualified=0, nameDup=[], guardDup=[];
  for(const [realms,cols,rows] of sizes){
    const setup=W.generateBotSetups([],realms,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols,rows},999,{seaPct:25});
    S.world.provinces.forEach(p=>{
      const L=(p.features||[]).filter(f=>f&&!f.ritualSite&&f.monster);
      lairs+=L.length;
      const bases=L.map(f=>base(f.name,p.name)), gs=L.map(f=>f.monster.name);
      qualified+=L.filter(f=>base(f.name,p.name)!==f.name).length;
      if(new Set(bases).size!==bases.length) nameDup.push(`${p.name}: ${L.map(f=>f.name).join(' / ')}`);
      if(new Set(gs).size!==gs.length) guardDup.push(`${p.name}: ${gs.join(' / ')}`);
    });
  }
  ok(lairs>500,`the worlds hold enough lairs to matter (${lairs})`);
  ok(qualified>0,`the largest worlds run the name pools dry, so place-qualified names appear (${qualified})`);
  ok(!nameDup.length,`no province holds two lairs with one base name (${nameDup.length}: ${nameDup.slice(0,3).join(' | ')})`);
  ok(!guardDup.length,`no province holds two of one guardian (${guardDup.length}: ${guardDup.slice(0,3).join(' | ')})`);

  // Staged: every land name already given out, and "Wolf Den" already a lair in this province.
  const pools=W.eval('LAIR_POOLS_CAT_P'); const all=new Set();
  Object.values(pools).forEach(pl=>(pl.land||[]).forEach(n=>all.add(n)));
  ok(all.has('Wolf Den'),'the land name stock was read');
  const wolf=W.eval('MONSTERS_P').find(m=>m.cat==='beast'&&!(W.eval('LAIR_POOLS_MONSTER_P')[m.name]||[]).length);
  const picks=[]; const here=new Set(['Wolf Den']);
  for(let i=0;i<4;i++){ const nm=W.pickLairNameP(wolf||{cat:'beast'},'forest',new Set(all),'Karnholt',null,here); picks.push(nm); here.add(base(nm,'Karnholt')); }
  ok(picks.every(n=>base(n,'Karnholt')!=='Wolf Den'),`with every name taken, the picker never qualifies a base this province holds (${picks.join(' / ')})`);
  ok(new Set(picks.map(n=>base(n,'Karnholt'))).size===picks.length,'…and four more lairs there get four different bases');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
