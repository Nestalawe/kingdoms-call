// 2026-10-13 (item 13) — a neutral province's starting army is the most effective mix of the units it
// offers, with the same number of units as before (its wealth band: Poor 1–2, Prosperous 2–3,
// Rich 3–4). "Most effective" is the battle estimate the bots use for a neutral province
// (botBattleForce: base strength and quality on the battle grid of the province's terrain). The test
// works the best score out on its own, over every mix of the province's land units, and compares.
// Checked over generated worlds from 2 realms to the largest size; the neutral guard leads exactly
// those units.
// Simulation level: world generation is one long function and the property is over whole worlds.
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
  const SEA=new Set(W.eval('KC_UNIT_CLASS.sea'));
  const landTypes=p=>[...new Set((p.armyTypes||[]).filter(t=>!/garrison/i.test(t)&&!SEA.has(t)))];
  const force=(armies,terrain)=>W.botBattleForce({players:[],turn:-2},null,armies,terrain,{defending:true});
  const bestScore=(types,quals,terrain,race)=>{ let best=-1; const pick=[];
    const walk=from=>{ if(pick.length===quals.length){ best=Math.max(best,force(pick.map((t,i)=>({type:t,quality:quals[i],race})),terrain)); return; }
      for(let i=from;i<types.length;i++){ pick.push(types[i]); walk(i); pick.pop(); } };
    walk(0); return best; };
  const sizes=[[2,8,5],[3,8,7],[4,9,7],[6,16,10],[10,20,12]];
  let checked=0, mixed=0; const weak=[], band=[], foreign=[], guard=[];
  for(const [realms,cols,rows] of sizes){
    const setup=W.generateBotSetups([],realms,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols,rows},999,{seaPct:25});
    S.world.provinces.forEach(p=>{
      if(!p||p.owner!=null||p.terrain==='sea'||String(p.race||'').startsWith('Primal')) return;
      const defs=p.neutralDefenders||[]; const types=landTypes(p);
      const [lo,hi]=W.neutralDefBand(p.tax||0);
      if(defs.length<lo||defs.length>hi) band.push(`${p.name}: ${defs.length} at tax ${p.tax}`);
      if(defs.some(x=>!types.includes(x.type))) foreign.push(`${p.name}: ${defs.map(x=>x.type).join(', ')}`);
      const g=S.characters.find(c=>c&&c.player==null&&c.location===p.id&&(c.armies||[]).length);
      if(!g||JSON.stringify(g.armies.map(a=>a.type).sort())!==JSON.stringify(defs.map(x=>x.type).sort())) guard.push(p.name);
      if(types.length<2||!defs.length) return;
      checked++; if(new Set(defs.map(x=>x.type)).size>1) mixed++;
      const quals=defs.map(x=>x.quality||'Average');
      const have=force(defs.map(x=>({type:x.type,quality:x.quality,race:x.race})),p.terrain);
      const best=bestScore(types,quals,p.terrain,defs[0].race);
      if(have<best-1e-6) weak.push(`${p.name} (${p.terrain}): ${defs.map(x=>x.type).join(' + ')} scores ${have.toFixed(1)}, best ${best.toFixed(1)}`);
    });
  }
  ok(checked>=150,`enough neutral provinces with a choice were checked (${checked})`);
  ok(!weak.length,`every neutral province fields its most effective mix (${weak.length} do not: ${weak.slice(0,3).join(' | ')})`);
  ok(!band.length,`every neutral province keeps its wealth band's number of units (${band.slice(0,3).join(' | ')})`);
  ok(!foreign.length,`every unit is one the province itself offers, never a garrison or a ship (${foreign.slice(0,3).join(' | ')})`);
  ok(!guard.length,`each neutral guard leads exactly the province's units (${guard.slice(0,3).join(' | ')})`);
  console.log(`  (${mixed} of ${checked} provinces field more than one type)`);
  ok(mixed>0,`some provinces field a genuine mix of unit types (${mixed} of ${checked})`);
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
