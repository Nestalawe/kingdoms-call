// claude_npcparity_0927.js — proves the two 2026-09-27 PvP/NPC parity fixes actually fire inside
// combatVsNPC (battles against NEUTRAL province defenders), and that neither one leaks outside its
// conditions:
//   (A) ELF Ambush        — Forest Wardens in an ATTACKING force now silence a neutral garrison's
//                           answering volley in forest and jungle, as they already did against a
//                           player. Nothing changes outside forest and jungle.
//   (B) DWARF Shield Fort — a Guard-heavy force beaten by a neutral garrison takes no Ride Them Down
//                           losses and falls back in good order instead of demoting; and a Guard-heavy
//                           neutral GARRISON that loses gives no broken backs to ride down and takes
//                           no pinned-against-their-own-ground losses.
//
// HOW IT REACHES combatVsNPC (three traps, each of which bit once — do not "simplify" this):
//   * combatVsNPC is declared INSIDE runTurn and is NOT initialised merely by entering runTurn — a
//     hook placed early in the body reads the binding as undefined ("not a function"). Only a real
//     turn initialises it. So this harness boots the portal exactly as claude_fuzz_0926b.js does,
//     generates a real world and runs ONE real turn; the hook at "// 4. Run all 5 phases" then hands
//     back live references.
//   * `G` is runTurn-scoped, so the staged cases install their own world through setG.
//   * `_currentPhase` / `_logCtx` are runTurn-scoped too, hence setPhase.
//
// Usage: node tests/npc-parity.test.js [gm-portal.html]   (default: site/kingdoms-call-gm-portal.html)
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html';

let html=readPage(GMF);

const inj=(a,b)=>{ if(html.split(a).length!==2) throw new Error('anchor not unique: '+a.slice(0,60)); html=html.replace(a,b); };
inj("  // 4. Run all 5 phases\n",
  "  window.__NPC={combatVsNPC,setG:(g)=>{G=g;},getG:()=>G,setPhase:(p)=>{_currentPhase=p;_logCtx.phase=p;}};\n  // 4. Run all 5 phases\n");

let ROWS={}; const WRITES=[];
const sbStub=()=>cannedStub({rows:()=>ROWS,writes:WRITES});

const errors=[];
const dom=bootJsdom(html,{supabase:{createClient:()=>sbStub()},
  setup(w){
    w.addEventListener('error',e=>errors.push('GM: '+(e.error&&e.error.stack||e.message)));
    w.onunhandledrejection=e=>errors.push('GM rejection: '+(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errors.push('console.error: '+t); };
    w.console.warn=()=>{}; w.console.log=()=>{}; }});

let PASS=0, FAIL=0;
const ok=(cond,label,extra)=>{ if(cond){PASS++;console.log('  ✓ '+label);} else {FAIL++;console.log('  ✗ '+label+(extra?'  — '+extra:''));} };

let _n=0;
const U=(type,quality,race)=>({type,quality:quality||'Average',race:race||null,unitName:type+' #'+(++_n)});

function world(terrain){
  const provs=[];
  for(let i=0;i<9;i++) provs.push({id:i,name:'P'+i,terrain:terrain,owner:null,tax:4,characters:[],
    neutralDefenders:[],npcArmies:0,garrison:[],battleGraves:[],armyTypes:[],features:[]});
  provs[3].owner=0;   // friendly ground to fall back onto
  return {cols:3,rows:3,provinces:provs};
}

function stage(W,terrain,race){
  const G={turn:3,season:0,world:world(terrain),logs:[],heroGraveyard:[],characters:[],relations:{},
    players:[{name:'Player',race:race||'Dwarven',alignment:'Neutral',gold:50,homeProvince:3,diplomacy:{known:[]},discoveries:[]},
             {name:'Rival',race:'Human',alignment:'Neutral',gold:50,homeProvince:8,diplomacy:{known:[]},discoveries:[]}]};
  W.__NPC.setG(G); W.__NPC.setPhase(1);
  return G;
}

function mkChar(G,armies,race,tactical){
  const c={id:'c1',name:'Lord Test',player:0,isKing:true,alive:true,race:race||'Dwarven',alignment:'Neutral',
    temper:'Brave',hp:20,maxHp:20,items:[],location:4,armies:armies,_attackedFrom:3,
    skills:{melee:2,archery:0,tactical:tactical||0,march:1,naval:0,sage:0,spy:0,thief:0,druid:5,explorer:0,
            white:0,psychic:0,illusory:0,elemental:0,necromancy:0}};
  G.characters.push(c); G.world.provinces[4].characters.push(c.id);
  return c;
}

function run(W,c,prov){
  try{ return W.__NPC.combatVsNPC(c,prov,null)||{}; }
  catch(e){ console.log('    THREW: '+(e.stack||e.message).split('\n').slice(0,3).join(' | ')); FAIL++; return null; }
}

// ── CASE A: Ambush ────────────────────────────────────────────────────────────────────────────
function caseA(W,terrain,expectBlocked,runs){
  let volley=0, blockLine=0, done=0;
  for(let i=0;i<runs;i++){
    const G=stage(W,terrain,'Elven');
    const c=mkChar(G,[U('Forest Wardens','Elite','Elven'),U('Forest Wardens','Elite','Elven'),
                      U('Elven Bowmen','Elite','Elven')],'Elven');
    G.world.provinces[4].neutralDefenders=[U('Yeoman Longbows','Veteran','Human'),U('Yeoman Longbows','Veteran','Human')];
    G.world.provinces[4].npcArmies=2;
    const out=run(W,c,G.world.provinces[4]); if(!out) return;
    const narr=out.narrative||[]; done++;
    if(narr.some(l=>/Defender Archery Phase/.test(l))) volley++;
    if(narr.some(l=>/answering volley never comes/.test(l))) blockLine++;
  }
  if(expectBlocked){
    ok(volley===0,`${terrain}: the neutral garrison never gets a volley through Wardens (0/${done})`,`saw ${volley}`);
    ok(blockLine===done,`${terrain}: the Ambush line is printed every time (${blockLine}/${done})`);
  } else {
    ok(volley>0,`${terrain}: outside forest/jungle the garrison still shoots (${volley}/${done})`);
    ok(blockLine===0,`${terrain}: no Ambush line outside forest/jungle`,`saw ${blockLine}`);
  }
}

// ── CASE B1: Shield Fort, beaten PLAYER force ─────────────────────────────────────────────────
function caseB1(W,runs){
  let losses=0, ride=0, shield=0, demote=0, orderly=0;
  for(let i=0;i<runs;i++){
    const G=stage(W,'plain','Dwarven');
    const c=mkChar(G,[U('Dwarven Guard','Green','Dwarven'),U('Dwarven Guard','Green','Dwarven'),
                      U('Dwarven Guard','Green','Dwarven'),U('Dwarven Guard','Green','Dwarven')]);
    const d=[]; for(let k=0;k<10;k++) d.push(U('Free Lances','Elite','Human'));
    G.world.provinces[4].neutralDefenders=d; G.world.provinces[4].npcArmies=d.length;
    const out=run(W,c,G.world.provinces[4]); if(!out) return;
    if(out.won!==false) continue;
    const narr=out.narrative||[]; losses++;
    if(narr.some(l=>/Free Lances range across the open ground/.test(l))) ride++;
    if(narr.some(l=>/lock shields as they give ground/.test(l))) shield++;
    // Green units disband instead of dropping a tier, so both outcomes must be absent.
    if(narr.some(l=>/lost heart in defeat, reduced to|the unit disbands for good/.test(l))) demote++;
    if(narr.some(l=>/fall back behind the shield wall in good order/.test(l))) orderly++;
  }
  console.log(`    (beaten in ${losses}/${runs} runs)`);
  ok(losses>=20,`enough defeats to judge (${losses})`);
  ok(ride===0,`no Ride Them Down line against locked shields (${ride})`);
  ok(shield===losses,`the shield-wall line replaces it every time (${shield}/${losses})`);
  ok(demote===0,`a Guard-heavy beaten force never demotes OR disbands (${demote})`);
  ok(orderly>0,`orderly fall-back is reported instead (${orderly} runs)`);
}

// ── CASE B1b: control — a beaten force BELOW the half-the-force gate keeps the old treatment ──
function caseB1b(W,runs){
  let losses=0, ride=0, shield=0, demote=0, SAMPLE=[];
  for(let i=0;i<runs;i++){
    const G=stage(W,'plain','Dwarven');
    // Same total strength as CASE B1 (four base-6 units, all Green) so the only difference is the
    // half-the-force gate: Orc Berserkers are base 6 like the Guard, but only 1 unit in 4 is a Guard.
    // (An earlier version used Goblin Hordes at base 3; the force was then so outmatched that every
    // unit died on the death roll and none ever reached the demotion roll, so "units still demote"
    // failed for a reason that had nothing to do with Shield Fort.)
    const c=mkChar(G,[U('Dwarven Guard','Green','Dwarven'),U('Orc Berserkers','Green','Orcish'),
                      U('Orc Berserkers','Green','Orcish'),U('Orc Berserkers','Green','Orcish')]);
    const d=[]; for(let k=0;k<10;k++) d.push(U('Free Lances','Elite','Human'));
    G.world.provinces[4].neutralDefenders=d; G.world.provinces[4].npcArmies=d.length;
    const out=run(W,c,G.world.provinces[4]); if(!out) return;
    if(out.won!==false) continue;
    const narr=out.narrative||[]; losses++;
    if(narr.some(l=>/Free Lances range across the open ground/.test(l))) ride++;
    if(narr.some(l=>/lock shields as they give ground/.test(l))) shield++;
    // GREEN is the lowest quality tier, so a unit that fails the demotion roll DISBANDS rather than
    // dropping a tier. Both outcomes count as "the demotion branch fired".
    if(narr.some(l=>/lost heart in defeat, reduced to|the unit disbands for good/.test(l))) demote++;
    if(!SAMPLE.length) SAMPLE=narr.slice();
  }
  console.log(`    (beaten in ${losses}/${runs} runs, one Guard in four — below the half-the-force gate)`);
  if(process.env.KC_DUMP) console.log(SAMPLE.map(l=>'      | '+l).join('\n'));
  ok(losses>=20,`enough defeats to judge (${losses})`);
  ok(shield===0,`Shield Fort does NOT fire below half the force (${shield})`);
  ok(ride===losses,`Ride Them Down still bites (${ride}/${losses})`);
  ok(demote>0,`units still demote or disband without the gate (${demote} runs)`);
}

// ── CASE B2: Shield Fort, beaten NEUTRAL GARRISON ─────────────────────────────────────────────
function caseB2(W,runs){
  let wins=0, ride=0, shield=0, pinned=0, sf=0;
  for(let i=0;i<runs;i++){
    const G=stage(W,'plain','Human');
    const a=[]; for(let k=0;k<4;k++) a.push(U('Free Lances','Elite','Human'));
    for(let k=0;k<8;k++) a.push(U('Gilded Lances','Elite','Human'));
    const c=mkChar(G,a,'Human',5);
    G.world.provinces[4].neutralDefenders=[U('Dwarven Guard','Green','Dwarven'),U('Dwarven Guard','Green','Dwarven')];
    G.world.provinces[4].npcArmies=2;
    const out=run(W,c,G.world.provinces[4]); if(!out) return;
    if(out.won!==true) continue;
    const narr=out.narrative||[]; wins++;
    if(narr.some(l=>/Free Lances ride down the broken companies across open ground/.test(l))) ride++;
    if(narr.some(l=>/Dwarven Guard lock shields where they stand/.test(l))) shield++;
    if(narr.some(l=>/pinned against their own ground/.test(l))) pinned++;
    if(narr.some(l=>/Shield Fort — the defenders of/.test(l))) sf++;
  }
  console.log(`    (won in ${wins}/${runs} runs)`);
  ok(wins>=20,`enough wins to judge (${wins})`);
  ok(ride===0,`no Ride Them Down line against a Guard garrison (${ride})`);
  ok(shield===wins,`the locked-shields line replaces it every time (${shield}/${wins})`);
  ok(pinned===0,`the Guard garrison is never "pinned … further losses" (${pinned})`);
  ok(sf>0,`Shield Fort is announced for the trapped garrison (${sf} runs)`);
}

(async()=>{
  const t0=Date.now();
  await new Promise(r=>setTimeout(r,600));
  const W=dom.window;
  if(typeof W.runTurn!=='function'){ console.log('no init'); errors.slice(0,4).forEach(e=>console.log(e)); process.exit(1); }

  // One real turn, purely to initialise runTurn's inner scope and hand back combatVsNPC.
  const setup=W.generateBotSetups([],3,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:10,rows:6},999,{seaPct:35});
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,
    orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  ROWS={games_one:{id:'g0',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999},
        game_players_list:players,turn_logs_list:[]};
  W.eval("currentGame={id:'g0',turn:1,status:'active',name:'T'};");
  try{ await W.runTurn(); }catch(e){ console.log('bootstrap turn threw: '+e.message); }
  await new Promise(r=>setTimeout(r,20));
  if(!W.__NPC||typeof W.__NPC.combatVsNPC!=='function'){
    console.error('FAILED to capture combatVsNPC (typeof '+(W.__NPC&&typeof W.__NPC.combatVsNPC)+')');
    errors.slice(0,4).forEach(e=>console.log('  !',e.split('\n').slice(0,3).join(' | ')));
    process.exit(1);
  }
  const errBase=errors.length;
  console.log('captured combatVsNPC from a live turn\n');

  console.log('── CASE A: Ambush against a neutral garrison ──');
  caseA(W,'forest',true,50); caseA(W,'jungle',true,50); caseA(W,'plain',false,50);
  console.log('── CASE B1: Shield Fort — beaten player force vs neutrals ──');
  caseB1(W,120);
  console.log('── CASE B1b: control — one Guard in four, below the gate ──');
  caseB1b(W,120);
  console.log('── CASE B2: Shield Fort — beaten neutral garrison ──');
  caseB2(W,120);

  const hard=errors.slice(errBase).filter(e=>!/Could not load|turn_logs|stub/i.test(e));
  console.log(`\nwindow errors during the staged cases: ${hard.length}`);
  hard.slice(0,3).forEach(e=>console.log('  !',e.split('\n').slice(0,3).join(' | ')));
  console.log(`${PASS} passed, ${FAIL} failed  (${((Date.now()-t0)/1000).toFixed(1)}s)`);
  process.exit(FAIL?1:0);
})();
