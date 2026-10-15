// tests/lib/pc-hooks.js: hands back personal-combat functions that are nested inside runTurn.
//
//   const {W, PC, base, MON, errs}=await bootPersonalCombat(['pcAct','pcMonsterCombatant'], {inject})
//
// Boots the GM portal in jsdom, injects `window.__PC={...names}` at the "  // 4. Run all 5 phases"
// anchor, runs one real turn of a small bot world (so the nested functions exist) and returns them,
// with a living character from the saved world (`base`) to build heroes from and the guardian table.
// `inject` is an optional list of [anchor, replacement] pairs applied to the page source first (each
// anchor must appear exactly once).
const {readPage,bootJsdom}=require('./boot'); const {cannedStub}=require('./stub-db');

async function bootPersonalCombat(names, opts={}){
  let html=readPage(opts.page||'kingdoms-call-gm-portal.html');
  const inj=(a,b)=>{ if(html.split(a).length!==2) throw new Error('anchor not unique or missing: '+a.slice(0,70)); html=html.replace(a,b); };
  inj("  // 4. Run all 5 phases\n",`  window.__PC={${names.join(',')}};\n  // 4. Run all 5 phases\n`);
  (opts.inject||[]).forEach(([a,b])=>inj(a,b));
  let ROWS={}; const WRITES=[]; const errs=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.runTurn!=='function') throw new Error('GM portal did not boot: '+errs.slice(0,2).join(' | '));
  const setup=W.generateBotSetups([],2,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:10,rows:6},{seaPct:20});
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  ROWS={games_one:{id:'gpc',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'gpc',turn:1,status:'active',name:'T'};`);
  await W.runTurn(); await new Promise(r=>setTimeout(r,10));
  const PC=W.__PC;
  if(!PC||names.some(n=>typeof PC[n]!=='function')) throw new Error('hook missing: '+names.filter(n=>!PC||typeof PC[n]!=='function').join(', '));
  const st=JSON.parse(WRITES.filter(w=>w.table==='games'&&w.val&&w.val.game_state).slice(-1)[0].val.game_state);
  const base=st.characters.find(c=>c.alive&&c.player!=null);
  return {W, PC, base, MON:W.eval('MONSTERS_P'), errs, state:st};
}

// Run fn with Math.random pinned to a fixed value (or a list of values used in turn, the last repeating).
function pinned(W, r, fn){
  const real=W.Math.random; const seq=Array.isArray(r)?r.slice():[r];
  W.Math.random=()=>seq.length>1?seq.shift():seq[0];
  try{ return fn(); } finally{ W.Math.random=real; }
}

module.exports={bootPersonalCombat, pinned};
