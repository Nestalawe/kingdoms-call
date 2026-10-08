// 2026-10-08 (item 4) — no guardian may resist and be weak to the same kind of attack.
//   * On its card: a passive that turns blows (meleeDR), arrows (arrowDR), spells (spellPct) or
//     lingering harm (dotImmune) must not sit beside a weakness to that same thing (arrows; a school
//     of magic; Elemental magic, whose fire lingers, for dotImmune).
//   * Behind the card: the hidden category multipliers (monsterTraits: undead, fiend, flyer, armoured,
//     beast) must never push the other way from a trait on the card — the card wins.
// monsterTraits is nested inside runTurn, so a real turn is run first and the hook at
// "  // 4. Run all 5 phases" hands it back.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html';
let html=readPage(GMF);
const inj=(a,b)=>{ if(html.split(a).length!==2) throw new Error('anchor not unique or missing: '+a.slice(0,60)); html=html.replace(a,b); };
inj("  // 4. Run all 5 phases\n","  window.__MT={monsterTraits};\n  // 4. Run all 5 phases\n");
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
let ROWS={}; const WRITES=[];
(async()=>{
  const errs=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{};w.console.log=()=>{};}});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.runTurn!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const MON=W.eval('MONSTERS_P'); ok(MON.length>50,`the guardian table was read (${MON.length})`);

  // ── on the card ──
  const resists=m=>{ const fx=(m.passive&&m.passive.fx)||{}; const r=new Set();
    if(fx.ward==='meleeDR'||fx.meleeDR) r.add('melee'); if(fx.ward==='arrowDR'||fx.arrowDR) r.add('archery');
    if(fx.ward==='spellPct'||fx.spellPct) r.add('spell'); if(fx.ward==='dotImmune'||fx.dotImmune) r.add('dot'); return r; };
  const weakTo=m=>{ const w=m.weak||{}; const r=new Set();
    if(w.kind==='archery') r.add('archery'); if(w.kind==='school'){ r.add('spell'); if(w.key==='elemental') r.add('dot'); } return r; };
  const cardClash=MON.filter(m=>[...resists(m)].some(k=>weakTo(m).has(k))).map(m=>`${m.name} (${m.passive.name} vs ${m.weak.name})`);
  ok(!cardClash.length,`no guardian's card resists and is weak to the same thing (${cardClash.length}): ${cardClash.join('; ')}`);

  // ── behind the card ──
  const setup=W.generateBotSetups([],3,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:10,rows:6},999,{seaPct:30});
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  ROWS={games_one:{id:'gt',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'gt',turn:1,status:'active',name:'T'};`);
  await W.runTurn(); await new Promise(r=>setTimeout(r,10));
  if(!W.__MT||typeof W.__MT.monsterTraits!=='function'){ console.log('hook missing: monsterTraits not exposed'); process.exit(1); }
  const hidden=[];
  MON.forEach(m=>{
    const mods=W.__MT.monsterTraits(m).mods, R=resists(m), K=weakTo(m);
    ['melee','archery','spell'].forEach(c=>{
      if(R.has(c)&&mods[c]>1) hidden.push(`${m.name}: resists ${c} on its card but hidden ×${mods[c].toFixed(2)}`);
      if(K.has(c)&&mods[c]<1) hidden.push(`${m.name}: weak to ${c} on its card but hidden ×${mods[c].toFixed(2)}`);
    });
  });
  ok(!hidden.length,`no hidden multiplier pushes against a trait on the card (${hidden.length}): ${hidden.slice(0,6).join('; ')}`);
  // and the hidden layer still works where nothing on the card speaks to it
  const drag=MON.find(m=>m.name==='Elder Dragon');
  ok(drag&&W.__MT.monsterTraits(drag).mods.archery>1,'a flyer with no arrow trait on its card is still easier to shoot down');
  ok(W.eval('GUARDIAN_TABLE_VER')>=18,'GUARDIAN_TABLE_VER bumped so running games re-read the guardians');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
