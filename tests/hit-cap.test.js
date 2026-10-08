// 2026-10-08 (item 4a) — no single hit in personal combat takes more than HALF the target's
// maximum HP: a guardian's blow on a hero, a hero's blow on a guardian, and a hero's blow on another
// hero in a duel. (Before: only a guardian's blow on a hero was capped, at a third.) A tighter cap a
// combatant already carries (a Legendary's 20% body cap, a cap ward) still wins.
// pcTakeHit is nested inside runTurn, so a real turn is run first and the hook at
// "  // 4. Run all 5 phases" hands it back.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html';
let html=readPage(GMF);
const inj=(a,b)=>{ if(html.split(a).length!==2) throw new Error('anchor not unique or missing: '+a.slice(0,60)); html=html.replace(a,b); };
inj("  // 4. Run all 5 phases\n","  window.__HC={pcTakeHit,pcCharCombatant,pcMonsterCombatant};\n  // 4. Run all 5 phases\n");
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
  ROWS={games_one:{id:'gh',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'gh',turn:1,status:'active',name:'T'};`);
  await W.runTurn(); await new Promise(r=>setTimeout(r,10));
  const H=W.__HC; if(!H||typeof H.pcTakeHit!=='function'){ console.log('hook missing: pcTakeHit not exposed'); process.exit(1); }
  const st=JSON.parse(WRITES.filter(w=>w.table==='games'&&w.val&&w.val.game_state).slice(-1)[0].val.game_state);
  const ch=st.characters.find(c=>c.alive);

  // A bare hero: no armour, no temper, a known maximum.
  const bareHero=(maxHp,vsGuardian)=>{ const h=H.pcCharCombatant({...ch,items:[],armies:[]}); h.arm=null; h.temper='None'; h.hp=h.maxHp=maxHp; h._vsGuardian=!!vsGuardian; return h; };
  const hit=(t,dmg,src,kind)=>{ const before=t.hp; H.pcTakeHit(t,dmg,[],src||'Foe',kind||'blow'); return before-t.hp; };

  ok(hit(bareHero(30,true),40,'Cave Bear')===15,'a guardian\'s blow takes at most half a 30 HP hero\'s health (15)');
  ok(hit(bareHero(31,true),40,'Cave Bear')===15,'…rounded down for an odd maximum (31 HP → 15)');
  ok(hit(bareHero(30,true),9,'Cave Bear')===9,'a blow under the cap is untouched');
  ok(hit(bareHero(30,false),40,'Rival Hero')===15,'in a duel between heroes a blow takes at most half (15 of 30)');

  // A guardian with no cap of its own, struck by a hero.
  const MON=W.eval('MONSTERS_P');
  const plain=MON.find(m=>m.power==='Moderate'&&!(m.passive&&m.passive.fx&&(m.passive.fx.ward||'').match(/cap|DR|spellPct|absorb|parry|dodge/))&&!(m.passive&&m.passive.fx&&(m.passive.fx.cap||m.passive.fx.meleeDR)));
  ok(!!plain,'found a Moderate guardian with no ward of its own');
  const g=H.pcMonsterCombatant({...plain,_hpFull:plain.hp}); g.hp=g.maxHp=24;
  ok(hit(g,40,ch.name)===12,`a hero's blow takes at most half a guardian's health (${plain.name}: 12 of 24)`);
  // A Legendary's 20% body cap is tighter and still wins.
  const leg=MON.find(m=>m.power==='Legendary');
  const L=H.pcMonsterCombatant({...leg,_hpFull:leg.hp}); L.hp=L.maxHp=60;
  ok(hit(L,40,ch.name)<=12,`a Legendary's own 20% cap still wins (${leg.name}: took ${60-L.hp} of 60)`);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
