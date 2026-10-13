// 2026-10-14 (item 15) — an ordinary (humanoid, non-home) province offers 2 or 3 units of its own race
// that suit its terrain: two three times in four, three one time in four, chosen at random from that
// race-and-terrain list (PROVINCE_ARMIES_P), never from another terrain; plus its race's garrison, and
// its race's fleet on a coast. A list with only two land units always gives both.
// Checked over many generated worlds (well over a thousand provinces): the bounds on the share of
// three-unit provinces are many standard deviations wide, so the outcome does not depend on luck.
// Simulation level: world generation is one long function and the property is over whole worlds.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const N=+(process.argv[2]||4);
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.generateNewGame!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const CELLS=W.eval('PROVINCE_ARMIES_P'), SEA=new Set(W.eval('KC_UNIT_CLASS.sea')), HUM=new Set(['Human','Elven','Dwarven','Orcish']);
  const FLEET={Human:'Galleon Fleet',Elven:'Elven Galleys',Dwarven:'Dwarf Ironclads',Orcish:'Orcish Longships'};
  const land=(t,r)=>((CELLS[t]||{})[r]||[]).filter(u=>!/garrison/i.test(u)&&!SEA.has(u));
  const sizes=[[2,8,5],[4,9,7],[6,16,10],[10,20,12]];
  let n=0, three=0, roomy=0; const off=[], badCount=[], noGarrison=[], badFleet=[];
  for(const [realms,cols,rows] of sizes) for(let k=0;k<N;k++){
    const setup=W.generateBotSetups([],realms,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols,rows},999,{seaPct:25});
    const P=S.world.provinces;
    P.forEach(p=>{
      if(!p||p.terrain==='sea'||!HUM.has(p.race)||p.owner!=null) return;
      const types=(p.armyTypes||[]), own=types.filter(u=>!/garrison/i.test(u)&&!SEA.has(u)), cell=land(p.terrain,p.race);
      n++;
      if(own.some(u=>!cell.includes(u))) off.push(`${p.terrain} ${p.race}: ${own.join(', ')}`);
      const want=cell.length>=3?[2,3]:[cell.length];
      if(!want.includes(own.length)) badCount.push(`${p.terrain} ${p.race}: ${own.length} of ${cell.length}`);
      if(cell.length>=3){ roomy++; if(own.length===3) three++; }
      if(!types.some(u=>/garrison/i.test(u))) noGarrison.push(p.name);
      const coastal=W.getNeighborsP(p,cols,rows,P).some(q=>q&&q.terrain==='sea');
      if(coastal&&!types.includes(FLEET[p.race])) badFleet.push(p.name);
    });
  }
  ok(n>=1000,`enough provinces were checked (${n})`);
  ok(!off.length,`every unit offered suits the province's terrain and race (${off.length} do not: ${off.slice(0,3).join(' | ')})`);
  ok(!badCount.length,`every province offers 2 or 3 of its own units, or both of a two-unit list (${badCount.slice(0,3).join(' | ')})`);
  const share=roomy?three/roomy:0;
  ok(share>0.15&&share<0.35,`about one in four provinces that could offer three does (${(100*share).toFixed(1)}% of ${roomy})`);
  ok(!noGarrison.length,`every province offers its race's garrison (${noGarrison.slice(0,3).join(', ')})`);
  ok(!badFleet.length,`every coastal province offers its race's fleet (${badFleet.slice(0,3).join(', ')})`);
  const rules=readPage('kingdoms-call-rules.html');
  ok(/two units three times in four, three one time in four/.test(rules),'the rulebook gives the 2-or-3 rule');
  // The rulebook's table is the game's list, written out: every terrain and race, the same units.
  const tbl=(/<caption>Land units a province can offer, by terrain and race<\/caption>([\s\S]*?)<\/table>/.exec(rules)||['',''])[1];
  const TN={plain:'Plains',desert:'Desert',forest:'Forest',jungle:'Jungle',mountain:'Mountain'}, RS=['Human','Elven','Dwarven','Orcish'];
  const wrong=[];
  Object.entries(TN).forEach(([t,name])=>{ const row=new RegExp('<tr><td>'+name+'</td>((?:<td>[^<]*</td>){4})</tr>').exec(tbl);
    if(!row){ wrong.push(name+': no row'); return; }
    const cells=[...row[1].matchAll(/<td>([^<]*)<\/td>/g)].map(m=>m[1].split(', ').filter(Boolean));
    RS.forEach((r,i)=>{ if(JSON.stringify(cells[i])!==JSON.stringify(land(t,r))) wrong.push(`${name} ${r}: "${(cells[i]||[]).join(', ')}"`); }); });
  ok(tbl&&!wrong.length,`the rulebook's table of units by terrain and race matches the game's list (${wrong.slice(0,3).join(' | ')})`);
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
