// Site code must cope while its database change is missing (supabase/README.md, "Database and site changes
// go separately"). The example: the games.meta column. With it hidden in the in-memory database, the GM
// portal must notice (probeGameMeta), and a turn must still resolve and save, because writing an unknown
// column fails the whole save (docs/traps.md, "A new column must be optional at the write site").
// Copy this shape for a new table or column: hide it (MISSING / MISSING_COLS), then use the feature.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };

(async()=>{
  const S=makeStub();
  S.MISSING_COLS.add('games.meta');
  const errs=[];
  const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:S.supabase,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  const W=dom.window;
  await new Promise(r=>setTimeout(r,900));
  W.currentUser={id:'gm1'};

  check(await W.eval('probeGameMeta()')===false,'the portal notices games.meta is missing');
  check(/Disk-IO fix not active/.test(W.document.getElementById('msg-games').innerHTML),'and says so on the game list');

  // A small all-bot game, staged directly. Any world will do: the check is that the save goes through.
  W.__sp=Array.from({length:3},(_,i)=>({id:i,gamePlayerId:'gp'+i,isBot:true,name:'Realm'+i,kingName:'King'+i,
    kingdomName:'Realm'+i,race:['Human','Elven','Dwarven'][i],alignment:['Good','Neutral','Druidic'][i],temper:'Brave',
    skills:{melee:1,tactical:1,march:1,white:1,naval:0,sage:1,explorer:1}}));
  W.eval(`(function(){ const g=generateNewGame(__sp,{cols:8,rows:7},0,{seaPct:20});
    g.turnMode={mode:'auto',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:new Date().toISOString()};
    window.__G=g; })()`);
  S.DB.games.push({id:'G1',name:'Missing meta',gm_user_id:'gm1',status:'active',turn:1,max_players:3,max_turns:0,
    created_at:new Date().toISOString(),game_state:W.eval('JSON.stringify(__G)')});       // no meta: the column isn't there
  for(let i=0;i<3;i++) S.DB.game_players.push({id:'gp'+i,game_id:'G1',user_id:null,player_index:i,display_name:'Realm'+i,
    orders_submitted:false,orders:null,turn_report:JSON.stringify({isBot:true,playerSetup:{}})});

  errs.length=0;
  W.__game=JSON.parse(JSON.stringify(S.DB.games[0]));
  let res=null, thrown=null;
  try{ res=await W.eval('runTurn({auto:true,game:__game,reason:"meta-missing"})'); }catch(e){ thrown=e&&e.message||String(e); }
  await new Promise(r=>setTimeout(r,60));
  check(!thrown&&res&&res.ok===true,'a turn resolves and reports success'+(thrown?': '+thrown:res&&res.error?': '+res.error:` (got ${JSON.stringify(res)})`));
  check(S.DB.games[0].turn===2,`and is saved (the game is on turn ${S.DB.games[0].turn}, expected 2)`);
  check(!('meta' in S.DB.games[0]),'nothing wrote the missing column');
  check(!errs.length,'no page errors'+(errs.length?': '+errs[0].split('\n')[0]:''));

  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
