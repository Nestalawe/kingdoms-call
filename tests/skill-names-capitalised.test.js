// 2026-10-13 (item 7) — every skill a turn report names is written with a capital: "Skills: Melee 2",
// "(Necromancy 3)", "casts Charm (Psychic Magic)", "drills Naval theory", "no commanding Druid".
// Two halves:
//   • static (level 0): the engine never prints a raw skill key where a label belongs (the patterns that
//     did), and no item description names a school in lower case;
//   • simulation (level 3): whole all-bot games run through runTurn, and no line of any turn log writes
//     a skill in lower case before its level, in a skill list, or as a school in brackets.
// The static half guards lines a short game may never reach; the simulation catches new ones.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

const GAMES=parseInt(process.argv[2]||'4'), TURNS=parseInt(process.argv[3]||'8');
const fs=require('fs'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const ALL=[];
const DIRS=['NW','NE','W','E','SW','SE'];
const ACTIONS=['defend','defend','rest','practice','recruit','move','move','research','search','explore'];

// ── static ──
{ const gm=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8'), data=fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8');
  const RAW=[/\(\$\{school\} \$\{/, /no \$\{school\} skill/, /\$\{school\} spell limit/, /\(\[k,v\]\)=>k\+' '\+v/, /naval drills|naval theory|tactical theory|commanding druid'/];
  RAW.forEach(re=>{ const m=gm.match(re); ok(!m,`the engine never prints a raw skill key: ${re} ${m?'found "'+gm.slice(m.index-40,m.index+40).replace(/\n/g,' ')+'"':''}`); });
  const low=data.match(/desc:'[^']*\((white|psychic|illusory|elemental|necromancy)\)/g)||[];
  ok(!low.length,`no item description names a school in lower case (${low.length}: ${low.slice(0,2).join(' | ')})`);
}
(async()=>{
  const S=makeStub();
  let html=readPage('kingdoms-call-gm-portal.html');
  const errs=[];
  const dom=bootJsdom(html,{supabase:S.supabase,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  const W=dom.window;
  await new Promise(r=>setTimeout(r,900));
  if(errs.length){ console.log('BOOT ERRORS:',errs.slice(0,3).join(' | ')); process.exit(1); }
  W.currentUser={id:'gm1'};

  const RACES=['Human','Elven','Dwarven','Orcish'];
  const ALIGNS=['Divine','Good','Druidic','Neutral','Pagan','Evil','Undead'];
  const MAPS=[{k:'p4',cols:9,rows:7,n:4},{k:'p5',cols:12,rows:7,n:5},{k:'p6',cols:15,rows:7,n:6},{k:'p3',cols:8,rows:7,n:3}];
  const ri=n=>Math.floor(Math.random()*n);

  let totalTurns=0, failedRuns=0, leaks=0, crashes=[];
  const t0=Date.now();

  for(let gi=0; gi<GAMES; gi++){
    const M=MAPS[gi%MAPS.length];
    const seaPct=[20,35,50,65,80][gi%5];
    const nHumans=Math.max(1,Math.min(M.n-1, 1+ri(M.n-1)));
    S.DB.games.length=0; S.DB.game_players.length=0; S.DB.turn_logs.length=0; S.DB.turn_events.length=0; S.DB.game_results.length=0;
    W.__sp=Array.from({length:M.n},(_,i)=>({id:i,gamePlayerId:'gp'+i,isBot:i>=nHumans,
      name:'Realm'+i,kingName:'King'+i,kingdomName:'Realm'+i,race:RACES[ri(4)],alignment:ALIGNS[i%7],
      temper:'Brave',skills:{melee:1,tactical:1,march:1,white:1,naval:(i%3===0?1:0),sage:1,explorer:1}}));
    W.__opt={seaPct}; W.__sz={cols:M.cols,rows:M.rows};
    try{
      W.eval(`(function(){ const g=generateNewGame(__sp,__sz,0,__opt);
        g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:new Date().toISOString()};
        g.botDifficulty='hard'; g.botDiplomacy=${gi%2?"'hostile'":"'normal'"}; window.__G=g; })()`);
    }catch(e){ crashes.push('worldgen: '+e.message); continue; }

    S.DB.games.push({id:'G'+gi,name:'Fuzz '+gi,gm_user_id:'gm1',status:'active',turn:1,
      max_players:M.n,max_turns:0,created_at:new Date().toISOString(),
      game_state:W.eval('JSON.stringify(__G)'), meta:W.eval('JSON.parse(JSON.stringify(buildGameMeta(__G)))')});
    for(let i=0;i<M.n;i++) S.DB.game_players.push({id:'G'+gi+'gp'+i,game_id:'G'+gi,
      user_id:i<nHumans?('u'+i):null,player_index:i,display_name:'Realm'+i,
      orders_submitted:false,orders:null,
      turn_report:i<nHumans?JSON.stringify({}):JSON.stringify({isBot:true,playerSetup:{}})});

    for(let t=1;t<=TURNS;t++){
      const row=S.DB.games[0];
      if(row.status!=='active') break;
      // random orders for each human realm, from the live state
      const live=JSON.parse(row.game_state);
      for(let pi=0; pi<nHumans; pi++){
        const mine=(live.characters||[]).filter(c=>c&&c.alive&&c.player===pi);
        const orders={};
        mine.forEach(c=>{
          orders[c.id]=[0,1,2,3,4].map(()=>{
            const a=ACTIONS[ri(ACTIONS.length)];
            if(a==='move') return {action:'move',target:'dir:'+DIRS[ri(6)],extra:'',desc:''};
            if(a==='practice') return {action:'practice',target:['melee','archery','tactical','march','sage'][ri(5)],extra:'',desc:''};
            if(a==='recruit') return {action:'recruit',target:'',extra:'',desc:''};
            return {action:a,target:'',extra:'',desc:''};
          });
        });
        const r=S.DB.game_players.find(p=>p.player_index===pi);
        r.orders=JSON.stringify({orders,encounterPlans:{},kingSkills:{},diplomacy:{},discoveryChoices:{},
          callReckoning:false,concede:false,messages:[],heroOrder:[],forTurn:row.turn});
        r.orders_submitted=true;
      }
      errs.length=0;
      const before=row.turn;
      W.__game=JSON.parse(JSON.stringify(row));
      let res=null, thrown=null;
      try{ res=await W.eval('runTurn({auto:true,game:__game,reason:"fuzz"})'); }
      catch(e){ thrown=e&&e.message||String(e); }
      await new Promise(r=>setTimeout(r,60));
      totalTurns++;
      if(thrown) crashes.push(`G${gi} T${before} host-throw: ${thrown}`);
      if(res&&res.ok===false){ failedRuns++; crashes.push(`G${gi} T${before} run failed: ${res.error}`); }
      if(errs.length) crashes.push(`G${gi} T${before} page error: ${errs[0].split('\n').slice(0,2).join(' | ')}`);
      // the runaway guard: after any run, no human row may still be flagged submitted
      const stillIn=S.DB.game_players.filter(p=>p.user_id&&p.orders_submitted).length;
      if(stillIn){ leaks++; crashes.push(`G${gi} T${before} LEFT ${stillIn} realm(s) flagged submitted after the run`); }
    }
    S.DB.turn_logs.forEach(l=>{ let en=l.entries; if(typeof en==='string') try{en=JSON.parse(en);}catch(_){en=[];} (Array.isArray(en)?en:[]).forEach(e=>{ if(e&&e.text) ALL.push(e.text); }); });
    process.stdout.write(`\r  games ${gi+1}/${GAMES} · turns ${totalTurns} · issues ${crashes.length}   `);
  }
  const secs=((Date.now()-t0)/1000).toFixed(0);
  console.log(`\n\nfuzz: ${GAMES} games · ${totalTurns} turns resolved · ${secs}s`);
  console.log(`failed runs: ${failedRuns} · submitted-flag leaks: ${leaks} · total issues: ${crashes.length}`);
  [...new Set(crashes)].slice(0,15).forEach(c=>console.log('  '+c));
  ok(!crashes.length,'the games ran clean');
  ok(ALL.length>2000,`the games wrote enough report lines to read (${ALL.length})`);
  const SK='melee|archery|tactical|naval|sage|spy|thief|druid|explorer|necromancy|psychic|illusory|elemental|white|march';
  const BAD=[new RegExp(`\\b(${SK}) [0-9]`), /Skills: [a-z]/, /\((white|psychic|illusory|elemental|necromancy)( [0-9]+)?\)/, /(naval|tactical) (theory|drills)/, /commanding druid/];
  const bad=ALL.filter(t=>BAD.some(re=>re.test(t)));
  ok(!bad.length,`no report line writes a skill in lower case (${bad.length}: ${[...new Set(bad.map(t=>t.replace(/[0-9]+/g,'N')))].slice(0,4).join(' | ')})`);
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
