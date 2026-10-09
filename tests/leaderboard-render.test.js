// claude_lb_render_0927.js — end-to-end render smoke test for kingdoms-call-leaderboard.html.
// Builds real Hall-of-Fame rows with the GM portal's own buildGameRecords, serves them to the
// leaderboard page through a stub Supabase client in JSDOM, then renders every tab and checks the
// output for exceptions, empty boards, and undefined/NaN leaking into the HTML. Also exercises GM
// mode (?gm=1) and the edit / hide / delete controls.
const fs=require('fs'), vm=require('vm'); const {sitePath,readPage,bootJsdom}=require('./lib/boot'); const {leaderboardStub}=require('./lib/stub-db');
const GM_FILE=process.argv[2]||sitePath('kingdoms-call-gm-portal.html');
const LB_FILE=process.argv[3]||sitePath('kingdoms-call-leaderboard.html');

// ── 1. real builder, stub engine tables ────────────────────────────────────────────────────────
const html=fs.readFileSync(GM_FILE,'utf8');
const src=html.slice(html.indexOf('const _LB_SEA=new Set('), html.indexOf("// Fetch this game's turn_events"));
const ctx={console, KC_LB_V:1, KC_BUILD_STAMP:'test', currentUser:{id:'gm-1'}, gameMetaOf:()=>null,
  KC_UNIT_CLASS:{sea:['Galleons','Whale Cohort'],aerial:['Rocs','Dragons'],creature:['Rocs'],monster:['Dragons'],
    missile:['Archers'],cavalry:['Heavy Horse'],flying:['Rocs'],carrier:['Galleons'],primalSea:['Whale Cohort'],
    garrison:[],lightFoot:[],tamedFlyer:[]},
  UNIT_BASE_STR:{Archers:6,'Heavy Horse':9,Galleons:12,Dragons:40,Rocs:18,'Whale Cohort':15,Levies:4},
  UNIT_Q_MULT:{Green:1.5,Average:2,Veteran:2.5,Elite:3},
  GUARDIAN_POWER_RANK:{'':0,Weak:1,Moderate:2,Powerful:3,Legendary:4},
  SKILL_LABELS:{melee:'Melee',archery:'Archery',tactical:'Tactical',white:'White Magic',necromancy:'Necromancy',thief:'Thief',naval:'Naval'},
  TITLE_DEFS:[{key:'throne',name:'The Throne'},{key:'sword',name:'Sword of the Realm'},{key:'vault',name:'Vaultkeeper'},{key:'beast',name:'Beastmaster'}],
  computeStandings:()=>({titles:{throne:{playerIndex:0,merit:44,charId:1},sword:{playerIndex:1,merit:31,charId:2},
    vault:{playerIndex:0,merit:820,charId:1},beast:{playerIndex:2,merit:12,charId:2}}}),
};
vm.createContext(ctx); vm.runInContext(src,ctx);

let seed=99; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff;};
const pick=a=>a[Math.floor(rnd()*a.length)];
const RACES=['Human','Elven','Dwarven','Orcish'], ALIGNS=['Divine','Good','Evil','Druidic'];
const TYPES=['Archers','Heavy Horse','Galleons','Dragons','Rocs','Whale Cohort','Levies'];
function snap(n){
  const chars=[];
  for(let i=0;i<n;i++){
    const units=[]; for(let u=0;u<Math.floor(rnd()*7);u++) units.push({t:pick(TYPES),q:pick(['Green','Average','Veteran','Elite']),...(rnd()<.2?{sk:1}:{})});
    const skills={}; Object.keys(ctx.SKILL_LABELS).forEach(k=>{ if(rnd()<.5) skills[k]=1+Math.floor(rnd()*9); });
    chars.push({id:i+1,name:'Hero '+(i+1),king:i===0,hp:20+Math.floor(rnd()*30),maxHp:40+Math.floor(rnd()*40),skills,units,items:['Ring of Mist','Blade of Dawn'].slice(0,Math.floor(rnd()*3))});
  }
  return {gold:Math.floor(rnd()*900),provinces:Math.floor(rnd()*20),land:Math.floor(rnd()*15),sea:Math.floor(rnd()*5),
    tax:Math.floor(rnd()*60),taxShare:Math.round(rnd()*800)/10,heroes:n-1,units:Math.floor(rnd()*40),str:Math.floor(rnd()*600),
    garStr:Math.floor(rnd()*200),items:Math.floor(rnd()*8),relics:Math.floor(rnd()*3),discoveries:Math.floor(rnd()*12),
    consecrated:Math.floor(rnd()*4),explored:Math.floor(rnd()*40),characters:chars};
}
function outc(pi,np){
  const bl=[]; for(let i=0;i<Math.floor(rnd()*4);i++){ const atk=rnd()<.5;
    bl.push({prov:i,terrain:pick(['plains','forest','hills','sea']),kind:pick(['pvp','neutral','garrison']),
      atkPi:atk?pi:(pi+1)%np,defPi:atk?(pi+1)%np:pi,atkStr:20+Math.floor(rnd()*400),defStr:20+Math.floor(rnd()*400),
      atkUnits:Math.floor(rnd()*12),defUnits:Math.floor(rnd()*12),won:rnd()<.5,atkLost:Math.floor(rnd()*6),defLost:Math.floor(rnd()*6),
      carry:Math.floor(rnd()*3),side:atk?'atk':'def',win:rnd()<.5}); }
  const en=[]; for(let i=0;i<Math.floor(rnd()*3);i++) en.push({pi,charId:1,prov:2,feature:'A ruined tower',
    guardian:pick(['Cave Wyrm','Frost Troll','Ancient Lich','Bone Drake']),power:pick(['Weak','Moderate','Powerful','Legendary']),
    won:rnd()<.65,fled:rnd()<.15,dmg:Math.floor(rnd()*35),hpAfter:1+Math.floor(rnd()*30),killed:rnd()<.08,tactics:['ME']});
  const cp=[]; for(let i=0;i<Math.floor(rnd()*3);i++) cp.push({prov:i,terrain:pick(['plains','forest','sea']),tax:1+Math.floor(rnd()*8),from:(pi+1)%np,to:pi});
  const de=[]; for(let i=0;i<Math.floor(rnd()*2);i++) de.push({charId:3,name:'Rival',pi:(pi+1)%np,king:rnd()<.25,killerPi:pi,killerId:1,how:'character'});
  const sp=[]; for(let i=0;i<Math.floor(rnd()*4);i++) sp.push({pi,charId:1,spell:pick(['Fireball','Curse','Resurrect','Lightning Bolt','Plague']),school:'Elemental',lvl:1+Math.floor(rnd()*5),chance:5+Math.floor(rnd()*90),ok:rnd()<.6});
  return {battles:{fought:bl.length,asAttacker:1,won:bl.filter(b=>b.win).length,unitsLost:Math.floor(rnd()*9),unitsKilled:Math.floor(rnd()*9),list:bl},
    encounters:{fought:en.length,won:en.filter(e=>e.won).length,fled:en.filter(e=>e.fled).length,heroKilled:0,list:en},
    captures:{gained:cp.length,lost:Math.floor(rnd()*3),list:cp},
    deaths:{own:Math.floor(rnd()*2),king:false,killed:de.length,list:de},
    spells:{cast:sp.length,ok:sp.filter(s=>s.ok).length,list:sp},
    delta:{gold:Math.floor(rnd()*300-100),provinces:1,tax:2,units:1,str:Math.floor(rnd()*90-20),heroes:0,items:0,discoveries:0,explored:1},
    rank:1,score:Math.floor(rnd()*300)};
}
const NAMES=['Alice','Bruno','Cara','Dev','Eli'];
const ROWS=[];
for(let i=0;i<14;i++){
  const np=2+Math.floor(rnd()*7), nb=Math.floor(rnd()*(np+1)), turns=4+Math.floor(rnd()*22);
  const dip=rnd()<.5?'hostile':'normal';
  const results=[],players=[],events=[];
  for(let pi=0;pi<np;pi++){
    const bot=pi>=np-nb;
    results.push({game_id:'g'+i,game_name:'The War of '+i,player_index:pi,is_bot:bot,bot_difficulty:bot?'hard':null,
      realm:'Realm '+String.fromCharCode(65+pi),race:pick(RACES),alignment:pick(ALIGNS),rank:pi+1,score:Math.floor(rnd()*500),
      winner:pi===0,victory:pick(['reckoning','elimination','concession']),turns,
      out_turn:rnd()<.3?1+Math.floor(rnd()*turns):null,out_how:rnd()<.3?pick(['eliminated','conceded']):null,
      setup:{mapSize:pick(['p4','p5','p6','p8']),cols:pick([9,12,15,17]),rows:pick([7,7,8]),seaPct:pick([20,35,50]),
        realms:np,bots:nb,humans:np-nb,difficulty:'hard',diplomacy:dip},
      final:snap(1+Math.floor(rnd()*3)),created_at:new Date(Date.UTC(2026,7+(i%2),1+i)).toISOString()});
    players.push({player_index:pi,user_id:bot?null:'u'+pi,display_name:bot?null:NAMES[pi%NAMES.length]});
    for(let t=1;t<=turns;t++) events.push({turn:t,player_index:pi,is_bot:bot,realm:'Realm '+String.fromCharCode(65+pi),
      race:results[pi].race,alignment:results[pi].alignment,post:snap(1+Math.floor(rnd()*3)),outcomes:outc(pi,np)});
  }
  const gameRow={id:'g'+i,name:'The War of '+i,gm_user_id:'gm-1',created_at:new Date(Date.UTC(2026,6,1+i)).toISOString(),max_turns:turns};
  const gs={players:new Array(np).fill(0).map(()=>({})),characters:[{id:1,name:'Aldric the Bold'},{id:2,name:'Bryn Stormcaller'}],
    botDiplomacy:dip,botDifficulty:'hard',world:{cols:12,rows:7}};
  const row=ctx.buildGameRecords('g'+i,gameRow,players,results,events,gs);
  row.hidden=(i===13);
  ROWS.push(row);
}

// ── 2. stub Supabase and render the page ───────────────────────────────────────────────────────
const CALLS=[];
const makeSb=(signedIn,isGm)=>leaderboardStub({rows:()=>ROWS,calls:CALLS,signedIn,isGm});

let fails=0;
function check(cond,msg){ if(!cond){ fails++; console.log('FAIL: '+msg); } }

async function run(gmMode){
  const errs=[];
  const dom=bootJsdom(readPage(LB_FILE),{
    pretendToBeVisual:false, url:'https://example.test/kingdoms-call-leaderboard.html'+(gmMode?'?gm=1':''),
    supabase:{createClient:()=>makeSb(gmMode,gmMode)},
    setup(w){
      w.addEventListener('error',e=>errs.push(e.message));
      w.confirm=()=>true; w.alert=m=>errs.push('alert: '+m);
      const oe=w.console.error; w.console.error=(...a)=>{ errs.push('console.error: '+a.join(' ')); oe.apply(w.console,a); };
    }});
  const w=dom.window, d=w.document;
  await new Promise(r=>setTimeout(r,400));
  const label=gmMode?'GM mode':'player mode';
  check(d.getElementById('spinner').style.display==='none',label+': spinner still showing');
  check(d.getElementById('main').style.display==='block',label+': main never shown');
  check(/GM editing on/.test(d.getElementById('gm-pill').innerHTML)===gmMode,label+': GM pill wrong');

  const seen={};
  for(const tab of ['champions','achievements','peoples','games']){
    w.setTab(tab);
    const h=d.getElementById('body').innerHTML;
    seen[tab]=h.length;
    check(h.length>500,`${label}/${tab}: body too short (${h.length})`);
    const m=h.match(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/);
    if(m) { fails++; console.log(`FAIL ${label}/${tab}: …${m[0]}…`); }
  }
  // the hidden game must not appear for a player, and must appear for a GM who asks for it
  w.setTab('games');
  let h=d.getElementById('body').innerHTML;
  check(!/The War of 13/.test(h),label+': a hidden game is on the public board');
  if(gmMode){
    d.getElementById('f-hidden').checked=true; w.render();
    h=d.getElementById('body').innerHTML;
    check(/The War of 13/.test(h),'GM mode: "show hidden" did not reveal the hidden game');
    check(/Remove from the board/.test(h),'GM mode: edit controls missing');
    d.getElementById('f-hidden').checked=false; w.render();
  } else {
    check(!/Remove from the board/.test(h),'player mode: GM edit controls are visible');
  }
  // filters
  const before=w.filtered().length;
  d.getElementById('f-kind').value='human'; w.render();
  const humanOnly=w.filtered();
  check(humanOnly.every(g=>(g.setup.bots||0)===0),label+': "all-human" filter let a bot game through');
  d.getElementById('f-kind').value='allbot'; w.render();
  check(w.filtered().every(g=>(g.setup.humans||0)===0),label+': "all-bot" filter let a human game through');
  d.getElementById('f-kind').value=''; d.getElementById('f-diplo').value='hostile'; w.render();
  check(w.filtered().every(g=>g.setup.diplomacy==='hostile'),label+': aggressive-bot filter wrong');
  d.getElementById('f-diplo').value=''; d.getElementById('f-realms').value='4'; w.render();
  check(w.filtered().every(g=>g.setup.realms===4),label+': realm-count filter wrong');
  w.resetFilters();
  check(w.filtered().length===before,label+': clearing the filters did not restore the board');
  d.getElementById('f-from').value='2026-09-01'; w.render();
  check(w.filtered().every(g=>new Date(g.finished_at)>=new Date('2026-09-01T00:00:00')),label+': date filter wrong');
  w.resetFilters();

  if(gmMode){
    // edit / hide / delete must issue the right writes
    CALLS.length=0;
    const id=ROWS[0].game_id;
    w.setTab('games'); w.toggleEdit(id);
    d.getElementById('e-name-'+id).value='Renamed War';
    d.getElementById('e-note-'+id).value='a note';
    d.getElementById('e-date-'+id).value='2026-05-04';
    await w.saveGame(id); await new Promise(r=>setTimeout(r,60));
    const upd=CALLS.find(c=>c.op==='update');
    check(!!upd&&upd.payload.game_name==='Renamed War'&&upd.payload.note==='a note'&&/2026-05-04/.test(upd.payload.finished_at),'GM mode: save did not send name, note and date');
    CALLS.length=0;
    await w.setHidden(id,true);
    check(CALLS.some(c=>c.op==='update'&&c.payload.hidden===true),'GM mode: hide did not send hidden=true');
    CALLS.length=0;
    const n0=w.GAMES?w.GAMES.length:ROWS.length;
    await w.deleteRecord(id,false);
    check(CALLS.filter(c=>c.op==='delete').length===1&&CALLS[0].table==='game_records','GM mode: plain delete touched the wrong tables');
    CALLS.length=0;
    await w.deleteRecord(ROWS[1].game_id,true);
    const tabs=CALLS.filter(c=>c.op==='delete').map(c=>c.table).sort().join(',');
    check(tabs==='game_records,game_results,turn_events','GM mode: purge did not delete all three tables (got '+tabs+')');
  }
  errs.forEach(e=>{ fails++; console.log('FAIL '+label+' page error: '+e); });
  console.log(`${label}: rendered champions ${seen.champions}b · achievements ${seen.achievements}b · races ${seen.peoples}b · games ${seen.games}b`);
  dom.window.close();
}

(async()=>{
  const keys=new Set(); ROWS.forEach(r=>Object.keys(r.records).forEach(k=>keys.add(k)));
  console.log(`built ${ROWS.length} Hall-of-Fame rows · ${keys.size} distinct record keys · row size ~${Math.round(JSON.stringify(ROWS[0]).length/1024*10)/10} KB`);
  // every key the builder emits must have a home in the page's catalogue (or land in "other")
  const page=fs.readFileSync(LB_FILE,'utf8');
  const unknown=[...keys].filter(k=>!(new RegExp('(^|[^A-Za-z_])'+k+':\\{').test(page))&&!/^sk_/.test(k)&&!/^title_/.test(k));
  if(unknown.length) console.log('NOTE: keys with no catalogue entry (they render under "Other records"): '+unknown.join(', '));
  await run(false);
  await run(true);
  console.log(fails?`\nFAILURES: ${fails}`:'\n0 failures');
  process.exit(fails?1:0);
})();
