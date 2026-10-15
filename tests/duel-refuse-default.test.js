// 2026-10-13 (item 1) — a hero's Duel Stance defaults to Refuse, not Accept: the orders form opens
// on Refuse for every hero, hire and resurrection card, the submitted plan carries 'refuse' when the
// select is missing, and the engine treats a player's hero with no stance set as refusing. NPCs keep
// their Temper's stance, and a stance the player chose is kept.
// duelStanceOf is nested inside runTurn, so a real turn is run first and the hook at
// "  // 4. Run all 5 phases" hands it back.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const quiet=(errs)=>(w)=>{
  w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
  w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
  w.console.warn=()=>{}; w.console.log=()=>{}; };
(async()=>{
  const errs=[];
  // ── The engine ──
  let html=readPage('kingdoms-call-gm-portal.html');
  const a="  // 4. Run all 5 phases\n";
  if(html.split(a).length!==2){ console.log('anchor not unique or missing: '+a); process.exit(1); }
  html=html.replace(a,"  window.__DS={duelStanceOf};\n"+a);
  let ROWS={}; const WRITES=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},setup:quiet(errs)});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.runTurn!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const setup=W.generateBotSetups([],2,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:10,rows:6},999,{seaPct:20});
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  ROWS={games_one:{id:'gd',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'gd',turn:1,status:'active',name:'T'};`);
  await W.runTurn(); await new Promise(r=>setTimeout(r,10));
  const DS=W.__DS; if(!DS||typeof DS.duelStanceOf!=='function'){ console.log('hook missing: duelStanceOf not exposed'); process.exit(1); }
  ok(DS.duelStanceOf({player:0,name:'Aldric'})==='refuse','a player\'s hero with no plan refuses a duel');
  ok(DS.duelStanceOf({player:0,encounterPlan:{tactics:['ME']}})==='refuse','…and so does one whose plan names no stance');
  ok(DS.duelStanceOf({player:0,encounterPlan:{duelStance:'accept'}})==='accept','a stance the player chose (Accept) is kept');
  ok(DS.duelStanceOf({player:0,encounterPlan:{duelStance:'challenge'}})==='challenge','…and Challenge');
  ok(DS.duelStanceOf({player:null,temper:'Brave'})==='challenge','a Brave NPC still challenges (Temper decides for NPCs)');

  // ── The orders form ──
  const perr=[]; const PW=[];
  const p=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:PW})},setup:quiet(perr)});
  await new Promise(r=>setTimeout(r,400)); const P=p.window, doc=P.document;
  if(typeof P.buildOrdersForm!=='function'){ console.log('player portal: buildOrdersForm not found'); perr.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const hero=(id,name,extra={})=>({id,name,player:0,locationId:11,locationName:'Ashford',hp:20,maxHp:20,armies:[],items:[],skills:{},effectiveSpeed:3,effectiveSeaSpeed:3,...extra});
  P.eval(`currentGamePlayer={id:'gpx',orders:null};`);
  P.eval(`currentReport=${JSON.stringify({turn:3,_liveTurn:3,characters:[hero('h1','Aldric',{isKing:true}),hero('h2','Brannoc')],
    kingdom:{gold:100,alignment:'Good'},worldMeta:{provinces:[{id:11,name:'Ashford'}]}})};`);
  P.buildOrdersForm(P.eval('currentReport.characters'),false,null,3);
  const sels=[...doc.querySelectorAll('select[id^="ep-duel-"]')];
  ok(sels.length>=2,`every hero has a Duel stance select (${sels.length})`);
  ok(sels.length&&sels.every(s=>s.value==='refuse'),`each one opens on Refuse (${sels.map(s=>s.value).join(',')})`);

  // Every place the form writes a stance falls back to Refuse, and every fresh select opens on it.
  const src=readPage('kingdoms-call-player-portal.html');
  const fallbacks=src.match(/duelStance:document\.getElementById\(`ep-duel-[^`]+`\)\?\.value\|\|'(\w+)'/g)||[];
  ok(fallbacks.length>=5&&fallbacks.every(f=>/'refuse'$/.test(f)),`the submitted plan falls back to Refuse in all ${fallbacks.length} places`);
  const opens=src.match(/DUEL_STANCES\.map\(d=>kcHtml`<option value="\$\{d\.code\}"\$\{[^?]*\?' selected'/g)||[];
  ok(opens.length>=4&&opens.every(o=>/'refuse'/.test(o)&&!/'accept'/.test(o)),`every Duel stance select opens on Refuse (${opens.length})`);

  const allErrs=errs.concat(perr);
  console.log(`\n${pass} pass, ${fail} fail · page errors ${allErrs.length}`);
  allErrs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||allErrs.length?1:0);
})();
