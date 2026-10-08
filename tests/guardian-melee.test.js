// 2026-10-08 (item 2) — guardian melee.
//   (A) A guardian's melee blow rolls a base that grows with its tier — Weak 1–3, Moderate 2–5,
//       Powerful 3–7, Legendary 4–9 — then adds ⌈Melee ÷ 2⌉ exactly as a hero's does. Heroes keep 1–3.
//   (B) "hero −1 melee for next round" (Grave Chill, Earthshake, Chilling Touch, Hex of Weakness,
//       Withering Touch) really lowers the hero's Melee — to-hit and damage — for the next round only.
// The combat functions are nested inside runTurn, so a real turn is run first and the hook at
// "  // 4. Run all 5 phases" hands them back (as npc-parity does).
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html';
let html=readPage(GMF);
const inj=(a,b)=>{ if(html.split(a).length!==2) throw new Error('anchor not unique or missing: '+a.slice(0,60)); html=html.replace(a,b); };
inj("  // 4. Run all 5 phases\n",
  "  window.__PC={pcMeleeDamage,pcMonsterCombatant,pcCharCombatant,pcHitSkill,pcMonsterSpecial,pcRoundStart};\n  // 4. Run all 5 phases\n");
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
  const setup=W.generateBotSetups([],3,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:10,rows:6},999,{seaPct:30});
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  ROWS={games_one:{id:'gm',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'gm',turn:1,status:'active',name:'T'};`);
  await W.runTurn(); await new Promise(r=>setTimeout(r,10));
  const PC=W.__PC;
  if(!PC||typeof PC.pcMeleeDamage!=='function'){ console.log('hook missing: combat functions not exposed'); process.exit(1); }

  // (A) Sample every guardian's blow and compare the observed range with the rule.
  const MON=W.eval('MONSTERS_P'); ok(MON.length>50,'the guardian table was read');
  const BASE={Weak:[1,3],Moderate:[2,5],Powerful:[3,7],Legendary:[4,9]};
  const dummy=()=>({kind:'character',name:'Dummy',hp:999,maxHp:999,status:{},temper:'None'});
  let checked=0; const bad=[];
  MON.forEach(m=>{
    const g=PC.pcMonsterCombatant({...m,_hpFull:m.hp});
    if(g.dmgBonus||g.gauntlets) return;                      // a flat bonus on top: checked by its own passive
    const [lo,hi]=BASE[m.power]; const sk=Math.ceil((m.melee||1)/2);
    let mn=1e9,mx=-1; for(let i=0;i<600;i++){ const v=PC.pcMeleeDamage(g,dummy()); mn=Math.min(mn,v); mx=Math.max(mx,v); }
    checked++;
    if(mn!==lo+sk||mx!==hi+sk) bad.push(`${m.name} (${m.power}, Melee ${m.melee}): ${mn}–${mx}, expected ${lo+sk}–${hi+sk}`);
  });
  ok(checked>40,`most guardians checked (${checked})`);
  ok(!bad.length,`every guardian's blow rolls its tier's base + ⌈Melee÷2⌉ (${bad.length} wrong)${bad.length?': '+bad.slice(0,4).join('; '):''}`);
  const tiers=new Set(MON.filter(m=>!PC.pcMonsterCombatant({...m}).dmgBonus).map(m=>m.power));
  ok(['Weak','Moderate','Powerful','Legendary'].every(t=>tiers.has(t)),'all four tiers were sampled');

  // A hero still rolls 1–3 + ⌈Melee÷2⌉.
  const st=JSON.parse(WRITES.filter(w=>w.table==='games'&&w.val&&w.val.game_state).slice(-1)[0].val.game_state);
  const ch=st.characters.find(c=>c.alive&&!c.isKing)||st.characters.find(c=>c.alive);
  const hero=PC.pcCharCombatant(ch); hero.temper='None'; hero.hp=hero.maxHp=999; hero.melee=4; hero.meleeRaw=4; // a known, lowerable Melee
  const hsk=Math.ceil((hero.meleeRaw!=null?hero.meleeRaw:hero.melee)/2);
  let hmn=1e9,hmx=-1; for(let i=0;i<600;i++){ const v=PC.pcMeleeDamage(hero,dummy()); hmn=Math.min(hmn,v); hmx=Math.max(hmx,v); }
  const gb=(ch.items||[]).some(it=>/Warbringer/.test(it.name||''))?2:0;
  ok(hmn===1+hsk+gb&&hmx===3+hsk+gb,`a hero's blow is still 1–3 + ⌈Melee÷2⌉ (${hmn}–${hmx}, expected ${1+hsk+gb}–${3+hsk+gb})`);

  // (B) Grave Chill: −1 Melee for the next round, and only that round.
  const wight=MON.find(m=>m.name==='Barrow Wight'); const chill=(wight.spells||[]).find(s=>/-1 melee/i.test(s.effect));
  ok(!!chill,'Barrow Wight has a "-1 melee" special');
  const g=PC.pcMonsterCombatant({...wight,_hpFull:wight.hp});
  const before=PC.pcHitSkill(hero,'melee');
  const maxDmg=()=>{ let mx=-1; for(let i=0;i<400;i++) mx=Math.max(mx,PC.pcMeleeDamage(hero,dummy())); return mx; };
  const dmgBefore=maxDmg();
  const narr=[];
  PC.pcMonsterSpecial(g,hero,chill,narr,{range:'melee'});
  PC.pcRoundStart(hero,narr);                                 // the next round: the chill bites
  const during=PC.pcHitSkill(hero,'melee'), dmgDuring=maxDmg();
  ok(before>0&&during===before-1,`the next round the hero fights at Melee ${before-1} for to-hit (got ${during})`);
  ok(dmgDuring<=dmgBefore&&(before%2===0?dmgDuring===dmgBefore:dmgDuring===dmgBefore-1),`and their blows are rolled from the lowered Melee (${dmgBefore} → ${dmgDuring})`);
  PC.pcRoundStart(hero,narr);                                 // the round after: gone
  ok(PC.pcHitSkill(hero,'melee')===before,`the round after, Melee is back to ${before} (got ${PC.pcHitSkill(hero,'melee')})`);
  ok(narr.some(l=>/Melee/.test(l)),'the battle report mentions the chill');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
