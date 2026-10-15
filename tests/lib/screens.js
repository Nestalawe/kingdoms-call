// Screen tours (P0-19). A tour boots one page with a staged world whose player-chosen strings all come from N(field, i)
// (lib/hostile.js: hostile or ordinary names), then visits each of its screens in turn and hands every one to visit().
// The same tour runs in jsdom and in Chromium, and against any copy of the site, so it serves both
//   - the hostile-name tests (hostile names: nothing may become markup or code), and
//   - tests/tools/same-dom.js (ordinary names, main's site against a branch's: nothing may look different).
//
// A tour: {page, modes: {name: {url, ...}}, world(N) → plain data, jsdomSupabase(world, mode), browserSupabase(world, mode)
// → script text, steps(world, mode) → [[label, code run in the page]], shown(world) → strings that must appear as text,
// bootWait (optional) → milliseconds the page is given to start}. A mode with bootError: true is a page that can't start:
// its error is expected, and its screen is the boot-failure message.
// A new page's slice of P0-19 adds its tour here.
const path=require('path');
const {readPage,bootJsdom,serve,routeExternal,SITE}=require('./boot');
const {makeStub,leaderboardStub}=require('./stub-db');

const wait=ms=>new Promise(r=>setTimeout(r,ms));
// A value as a JavaScript literal to put in code run in the page: JSON, with < > / and the two line separators written
// as \u escapes, so a staged name can't end the code it sits in, wherever that code ends up.
const lit=v=>JSON.stringify(v).replace(/[<>\/\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));

// ── Hall of Fame ─────────────────────────────────────────────────────────────────────────────────────────────────
// Three recorded games: one with humans and bots (the GM's own), one hidden, one an older row. Every value a player or a
// GM can store in a recorded game comes from N (with hostile names, numbers too), and so do the profile names.
const leaderboard={
  page:'kingdoms-call-leaderboard.html',
  modes:{
    public:{url:''},
    gm:{url:'?gm=1',signedIn:true,isGm:true},
    overlord:{url:'?gm=1',signedIn:true,isGm:true,isOverlord:true},
    failing:{url:'?gm=1',signedIn:true,isGm:true,isOverlord:true,error:true},
    unreadable:{url:'',readError:true},
  },
  world(N){
    const num=(field,v)=>N.hostile?N(field,v):v;
    const st=(g,pi,o)=>({pi,realm:N('realm',g*10+pi),player:N('player',g*10+pi),uid:o.bot?null:(g===1&&pi===1?num('uid','u11'):'u'+(g*10+pi)),
      race:N('race',pi),al:N('creed',pi),bot:!!o.bot,winner:!!o.winner,rank:num('rank',pi+1),score:num('score',300-pi*40),prov:num('prov',9-pi),gold:num('gold',120+pi),str:num('str',400-pi*30),titles:o.winner?['t']:[],
      outHow:o.out?N('fate',g*10+pi):null,outTurn:o.out?num('outTurn',7):null});
    const rec=(g,pi,v,extra)=>({v:num('value',v),pi,t:num('turn',3),who:N('hero',g*10+pi),det:N('detail',g*10+pi),...(extra||{})});
    const row=(g,o)=>({game_id:'g'+g,game_name:N('game',g),gm_user_id:o.gm||'gm-1',note:o.note?N('note',g):null,hidden:!!o.hidden,
      build:o.legacy?'lb1':'lb3 '+N('build',g),finished_at:`2026-09-1${g}T10:00:00Z`,started_at:`2026-08-1${g}T10:00:00Z`,
      victory:N('victory',g),turns:num('turns',12+g),winner_realm:N('realm',g*10),winner_player:N('player',g*10),winner_is_bot:!!o.botWin,
      setup:{mapSize:N('map',g),realms:num('realms',3),bots:num('bots',1),humans:num('humans',2),diplomacy:g===1?'hostile':'normal',seaPct:num('sea',30)},
      standings:[st(g,0,{winner:true}),st(g,1,{out:true}),st(g,2,{bot:true,out:true})],
      records:{most_provinces:[rec(g,0,9),rec(g,1,7)],greatest_upset:[rec(g,1,0.5)],[`title_${N('key',g)}`]:[rec(g,0,2,{lbl:N('label',g)})],
        biggest_world:{v:60,pi:null}},
      totals:{battles:num('battles',4),casualties:num('casualties',9),captures:num('captures',3),lairs:num('lairs',2),spells:num('spells',5),deaths:num('deaths',1)}});
    return {rows:[row(1,{note:true}),row(2,{hidden:true,note:true}),row(3,{legacy:true,gm:'gm-2',botWin:true})],
      profiles:[0,1].flatMap(pi=>[1,2,3].map(g=>({id:'u'+(g*10+pi),name:N('profile',g*10+pi)}))),
      renameTo:N('rename',0), search:N('realm',10), error:N('error',0)};
  },
  stubOptions:(W,m)=>({signedIn:!!m.signedIn,isGm:!!m.isGm,isOverlord:!!m.isOverlord,profiles:W.profiles,
    error:m.error?W.error:undefined,readError:m.readError?W.error:undefined}),
  jsdomSupabase(W,m){ const o=this.stubOptions(W,m); return {createClient:()=>leaderboardStub({...o,rows:()=>W.rows,calls:[]})}; },
  browserSupabase(W,m){
    return `(function(){var R=${lit(W.rows)},O=${lit(this.stubOptions(W,m))};`
      +`window.supabase={createClient:function(){return (${leaderboardStub.toString()})(Object.assign({},O,{rows:function(){return R;},calls:[]}));}};})();`;
  },
  steps(W,m){
    if(m.readError) return [['the board, unreadable','']];
    const s=[['champions',"setTab('champions')"],['achievements',"setTab('achievements')"],
      ['achievements, searched for a realm',`$('f-q').value=${lit(W.search)};render()`],
      ['races and creeds',"resetFilters();setTab('peoples')"],['games',"setTab('games')"],
      ['games, every one opened',"document.querySelectorAll('tr.gamerow').forEach(r=>r.click())"]];
    if(m.isGm) s.push(['games, hidden ones shown and opened',"$('f-hidden').checked=true;render();document.querySelectorAll('tr.gamerow').forEach(r=>r.click())"],
      ['games, editing every one',"document.querySelectorAll('tr.gamerow button').forEach(b=>b.click())"]);
    if(m.error) s.push(['games, a save that fails',"document.querySelector('.gmbox .btn-gold').click()"]);
    if(m.isOverlord) s.push(['champions, renaming a player',`setTab('champions');window.prompt=()=>${lit(W.renameTo)};document.querySelector('#champ-table button').click()`]);
    return s;
  },
  shown:W=>[W.rows[0].game_name,W.rows[0].note,W.rows[0].standings[0].race,W.rows[0].standings[1].al,W.rows[0].standings[1].outHow,
    W.rows[0].standings[0].realm,W.rows[0].records.most_provinces[0].who,W.rows[0].records.most_provinces[0].det,
    W.rows[0].setup.mapSize,W.rows[0].victory,W.profiles[0].name,W.renameTo,W.error,W.rows[0].standings[1].rank,W.rows[0].setup.realms].filter(s=>typeof s==='string'),
};

// ── The Overlord page ────────────────────────────────────────────────────────────────────────────────────────────
// Accounts (names, emails), games, the realms' names in a game, a reported dispatch and the report's reason.
const overlord={
  page:'kingdoms-call-overlord.html',
  modes:{overlord:{url:''}},
  world(N){
    return {
      profiles:[['ov1','Test Overlord'],['gm1',N('gm',1)],['gm2',N('gm',2)],['p1',N('player',1)],['p2',N('player',2)]].map(([id,name])=>({id,name})),
      emails:{ov1:'overlord@example.test',gm1:N('email',1),gm2:N('email',2),p1:N('email',3),p2:N('email',4)},
      games:[['G1',N('game',1),'gm1','active'],['G2',N('game',2),'gm1','setup'],['G3',N('game',3),'gm2','complete']],
      realms:[['G1',0,'p1',N('realm',0)],['G1',1,'p2',N('realm',1)]],
      body:N('dispatch',0), reason:N('reason',0), search:N('player',1),
    };
  },
  // Self-contained: it also runs inside Chromium, as text.
  stage:function(S,W){
    S.DB.profiles.length=0; W.profiles.forEach(p=>S.DB.profiles.push(p));
    S.DB.accounts={}; Object.keys(W.emails).forEach(id=>{ S.DB.accounts[id]={email:W.emails[id]}; });
    S.DB.site_admins.push({user_id:'ov1'});
    S.DB.game_masters.push({user_id:'gm1',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'},
      {user_id:'gm2',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'});
    W.games.forEach(([id,name,gm,status],i)=>S.DB.games.push({id,name,gm_user_id:gm,status,turn:i+1,max_turns:12,
      created_at:'2026-10-0'+(i+1)+'T00:00:00Z',meta:{v:1,turnMode:{mode:'manual'}},game_state:'{}'}));
    W.realms.forEach(([game_id,player_index,user_id,display_name],i)=>S.DB.game_players.push({id:'s'+i,game_id,user_id,player_index,display_name}));
    S.DB.game_messages.push({id:7,game_id:'G1',turn:3,from_index:1,to_indexes:[0],scope:'private',body:W.body});
    S.DB.message_reports.push({id:1,message_id:7,game_id:'G1',reporter_index:0,reason:W.reason,created_at:'2026-10-13T00:00:00Z'});
    S.setUser('ov1');
  },
  jsdomSupabase(W){ const S=makeStub(); this.stage(S,W); return S.supabase; },
  browserSupabase(W){
    return `(function(){var S=(${makeStub.toString()})();(${this.stage.toString()})(S,${lit(W)});window.supabase=S.supabase;})();`;
  },
  steps(W){
    return [['accounts, games and reported dispatches',''],
      ['accounts, searched',`$('acct-q').value=${lit(W.search)};renderAccounts()`],
      ['accounts, Revoke GM open',"$('acct-q').value='';renderAccounts();document.querySelector('[data-act=revoke]').click()"],
      ['accounts, Delete open',"document.querySelector('[data-act=delete]').click()"]];
  },
  shown:W=>[W.profiles[1].name,W.emails.gm1,W.games[0][1],W.realms[0][3],W.body,W.reason],
};

// ── The GM portal ────────────────────────────────────────────────────────────────────────────────────────────────
// Five games: G1 active (realms, heroes, a bot, a saved turn log, a reported dispatch, a deadline), G2 in setup
// (private, with invites, a player's chosen king and realm, an open slot and a bot to come), G3 finished and archived,
// G4 another GM's, G5 an all-bot game the watcher can run. Statistics from G1, G3 and a deleted game. Every string a
// player or a GM can store comes from N, and so do the turn numbers and slot counts that reach the screen. A GM, the
// Overlord (Master GM mode, opening G1 from the Overlord page's link), a signed-out visitor and a page that can't start
// each see their screens; every database error a screen shows comes from N too (stub ERRORS).
const gmPortal={
  page:'kingdoms-call-gm-portal.html',
  bootWait:900,
  modes:{
    gm:{url:'',user:'gm1'},
    overlord:{url:'?game=G1',user:'ov1'},
    signedOut:{url:'',user:null},
    bootFails:{url:'',bootError:true},
  },
  world(N){
    const num=(field,v)=>N.hostile?N(field,v):v;
    const at='2026-10-10T07:00:00Z';
    const json=o=>JSON.stringify(o);
    const realms=[0,1,2].map(i=>({name:N('realm',i),provinces:[i+1],isBot:i===2}));
    const g1={turnMode:{mode:'deadline',time:'20:00',everyDays:2,nextDeadlineAt:'2099-01-01T07:00:00Z',turnRanAt:at},
      players:realms, characters:[{id:'c0',name:N('hero',0),player:0,isKing:true,alive:true},{id:'c1',name:N('hero',1),player:1,alive:true},
        {id:'c2',name:N('hero',2),player:null,alive:true}],
      world:{provinces:[]}, safeStart:true, botDiplomacy:'hostile', seaPct:40};
    const setup=i=>json({playerSetup:{kingName:N('king',i),kingdomName:N('kingdom',i),race:N('race',i),alignment:N('creed',i),temper:N('temper',i),
      skills:{[N('skill',i)]:2,melee:1}}});
    const game=(id,name,gm,status,turn,gs,extra)=>({id,name,gm_user_id:gm,status,turn,max_players:4,max_turns:0,created_at:at,meta:null,
      game_state:typeof gs==='string'?gs:json(gs),block_eliminated_msgs:false,...(extra||{})});
    const slot=(id,game_id,player_index,user_id,display_name,extra)=>({id,game_id,player_index,user_id,display_name,orders_submitted:false,
      orders:null,turn_report:null,invite_code:null,...(extra||{})});
    // the names the saved turn log carries, besides realms and heroes
    const L={province:N('province',0),field:N('province',1),cry:N('cry',0),parting:N('parting',2),intel:N('dispatch',9),verb:N('verb',0),
      unit:N('unit',0),quality:N('quality',0),type:N('type',0)};
    const force=json({name:N('realm',0),color:N('colour',0),verb:L.verb,armies:[{unitName:L.unit,quality:L.quality,type:L.type}]});
    const event=(game_id,turn,pi,bot)=>({id:`te-${game_id}-${turn}-${pi}`,game_id,turn,player_index:pi,is_bot:bot,bot_difficulty:bot?N('difficulty',pi):null,
      realm:N('realm',pi),race:N('race',pi),alignment:N('creed',pi),
      orders:{chars:{c0:{ph:[{a:N('order',pi),t:N('detail',pi)+'|3'},{a:'recruit',t:'Free Lances|2'}]}}},
      pre:{gold:10,provinces:2},post:{provinces:3,gold:12,str:40,heroes:2,taxShare:30,characters:[{units:[{t:'Free Lances',q:'Average'}]}]},
      outcomes:{battles:{asAttacker:1,list:[{ph:1,prov:3,atkChar:'c0',atkPi:pi,defPi:null,atkStr:20,defStr:10,won:true,terrain:N('terrain',pi),kind:N('kind',pi),atkLost:1,defLost:2,carry:0}]},
        encounters:{fought:1,list:[{power:N('power',pi),won:true,dmg:2}]},spells:{list:[{spell:N('spell',pi),ok:true,chance:50}]},
        deaths:{own:1,list:[{charId:'c9'+pi,pi,king:false,how:N('how',pi)}]},captures:{list:[{ph:1,prov:3,to:pi,from:null}]}}});
    const result=(game_id,pi,bot,winner)=>({id:`gr-${game_id}-${pi}`,game_id,game_name:N('game',9),player_index:pi,realm:N('realm',pi),is_bot:bot,
      bot_difficulty:bot?N('difficulty',pi):null,race:N('race',pi),alignment:N('creed',pi),rank:winner?1:2,score:300,winner,victory:N('victory',9),turns:12,
      out_turn:winner?null:7,out_how:winner?null:N('fate',pi),setup:{realms:2,humans:1},final:{provinces:3,gold:12,str:40,heroes:2}});
    return {
      log:L, error:N('error',0), search:N('player',1), filter:N('gm',2), gameName:N('game',6), reason:N('reason',1), password:'kc-test-password',
      db:{
        profiles:[{id:'gm1',name:N('gm',1),created_at:at},{id:'gm2',name:N('gm',2),created_at:at},{id:'ov1',name:'Test Overlord',created_at:at},
          ...[1,2,3].map(i=>({id:'p'+i,name:N('player',i),created_at:`2026-0${i+6}-01T00:00:00Z`}))],
        game_masters:['gm1','gm2'].map(user_id=>({user_id,offered_at:at,offered_by:'ov1',accepted_at:at})),
        site_admins:[{user_id:'ov1'}],
        games:[
          game('G1',N('game',1),'gm1','active',3,g1),
          game('G2',N('game',2),'gm1','setup',0,{mapSize:'p4',maxPlayers:4,botCount:1,allBot:false,visibility:'private',invited:['p1','p2'],
            turnMode:{mode:'auto'},seaPct:40,botDiplomacy:'normal'}),
          game('G3',N('game',3),'gm1','complete',13,{archived:true,archivedAt:at,players:realms,characters:[],world:{provinces:[]}}),
          game('G4',N('game',4),'gm2','active',num('turn',5),{turnMode:{mode:'manual'}},{max_players:num('slots',6)}),
          game('G5',N('game',5),'gm1','active',2,'{"turnMode":',{max_players:1,meta:{v:1,turnMode:{mode:'auto'}}}),
        ],
        game_players:[
          slot('s10','G1',0,'p1',N('realm',0),{orders_submitted:true}), slot('s11','G1',1,'p2',N('realm',1)),
          slot('s12','G1',2,null,N('realm',2),{turn_report:json({isBot:true})}),
          slot('s20','G2',0,'p1',N('realm',20),{turn_report:setup(20)}), slot('s21','G2',1,'p2',N('realm',21),{turn_report:setup(21)}),
          slot('s22','G2',2,null,null,{turn_report:'{}',invite_code:N('invite',22)}),
          slot('s30','G3',0,'p1',N('realm',0)), slot('s31','G3',1,'p3',N('realm',1)),
          slot('s40','G4',0,'p3',N('realm',40)),
          slot('s50','G5',0,null,N('realm',50),{turn_report:json({isBot:true})}),
        ],
        turn_logs:[{id:'tl1',game_id:'G1',turn:2,player_index:-1,entries:[
          {phase:0,charId:'c0',text:`**${N('hero',0)}** marches on ${L.province}`},
          {phase:1,charId:'c0',text:'⚑FORCE⚑'+force},
          {phase:2,charId:'c1',text:`⚔ Battle at ${L.field}: **${N('hero',1)}** against ${N('realm',0)}`},
          {phase:3,charId:'c1',text:`📊 ${N('realm',1)} │ 12 │ 7`},
          {phase:4,charId:'c0',text:`⚠ ${L.cry}`},
          {phase:2,charIds:['c2'],text:L.parting,type:'event'},
          {phase:1,text:`[Intelligence] ${L.intel}`},
        ]}],
        game_messages:[{id:7,game_id:'G1',turn:num('turn',2),from_index:1,to_indexes:[0],scope:'private',body:N('dispatch',0),created_at:at}],
        message_reports:[{id:1,message_id:7,game_id:'G1',reporter_index:0,reason:N('reason',0),created_at:at}],
        game_message_reads:[], game_records:[],
        turn_events:[event('G1',1,0,false),event('G1',2,1,true),event('G9',5,0,false),event('G9',5,1,true),event('G3',4,0,false)],
        game_results:[result('G9',0,false,true),result('G9',1,true,false),result('G3',0,false,true),result('G3',1,false,false)],
      },
    };
  },
  // Self-contained: it also runs inside Chromium, as text. Steps reach the stand-in database as supabase.stub.
  stage:function(S,W,user){
    Object.keys(W.db).forEach(t=>{ S.DB[t]=JSON.parse(JSON.stringify(W.db[t])); });
    S.supabase.stub=S;
    S.setUser(user);
  },
  jsdomSupabase(W,m){
    if(m.bootError) return {createClient(){ throw new Error(W.error); }};
    const S=makeStub(); this.stage(S,W,m.user); return S.supabase;
  },
  browserSupabase(W,m){
    if(m.bootError) return `window.supabase={createClient:function(){throw new Error(${lit(W.error)});}};`;
    return `(function(){var S=(${makeStub.toString()})();(${this.stage.toString()})(S,${lit(W)},${lit(m.user)});window.supabase=S.supabase;})();`;
  },
  steps(W,m){
    if(m.bootError) return [['the page could not start','']];
    const E=lit({message:W.error});
    const fail=k=>`supabase.stub.ERRORS[${lit(k)}]=${E};`;
    const ok='Object.keys(supabase.stub.ERRORS).forEach(k=>{ delete supabase.stub.ERRORS[k]; });';
    const val=(id,v)=>`document.getElementById(${lit(id)}).value=${lit(v)};`;
    // the same answers on every run: dialogs say yes, random draws (the bots' names) and the clock's time of day repeat,
    // and the watcher runs only when a step says so
    const fixed="window.confirm=()=>true;window.alert=()=>{};Date.prototype.toLocaleTimeString=function(){return '12:00:00';};"
      +"Math.random=(()=>{let s=7;return ()=>(s=s*16807%2147483647)/2147483647;})();_autoRunBusy=true;";
    const tick='_autoRunBusy=false;autoTurnTick().then(()=>{ _autoRunBusy=true; });';
    // a failure staged on purpose, which the engine also logs to the console: only that log is muted, for that step
    const quiet=code=>`{ const ce=console.error; console.error=()=>{}; Promise.resolve(${code}).finally(()=>{ console.error=ce; }); }`;
    const turnFails=`window.migrateItemTiers=()=>{ throw new Error(${lit(W.error)}); };`+quiet('runTurn()');
    if(!m.user) return [['sign-in refused',fixed+`sb.auth.signInWithPassword=async()=>({data:{},error:{message:${lit(W.error)}}});`
      +val('si-email','gm@example.test')+val('si-password',W.password)+'doSignIn()']];
    if(m.user==='ov1') return [
      ['a game opened from the Overlord page',fixed],
      ['every game, grouped by GM',"show('sec-games');renderGameList()"],
      ['every game, filtered by a GM\'s name',val('overlord-filter',W.filter)+'renderGameList()'],
      ['run turn now: the turn fails',val('overlord-filter','')+"openGame('G1').then(()=>{ "+turnFails+" })"],
      ['statistics, every GM\'s games','openStats(true)'],
    ];
    return [
      ['game list',fixed],
      ['game list, archived','toggleArchivedView()'],
      ['game list, unreadable',fail('games.select')+'loadGames()'],
      ['new game, bots and sea',ok+"toggleArchivedView();showNewGame();"+val('new-game-botcount','2')+'updateBotHint();updateSeaHint()'],
      ['new game, private: the players to invite',"document.querySelector('input[name=\"new-game-visibility\"][value=\"private\"]').checked=true;updateGameVisibility()"],
      ['new game, a player invited and searched for',"document.querySelector('#new-game-invite-list input').click();"+val('new-game-invite-search',W.search)
        +"renderInviteCheckboxes('new-game-invite-list','new-game-invite-search',_inviteSelected,'new-game-invite-count')"],
      ['new game, players unreadable',fail('profiles.select')+'_invitablePlayers=null;updateGameVisibility()'],
      ['new game, not saved',ok+val('new-game-name',W.gameName)+fail('games.insert')+'createGame()'],
      ['a game in setup',ok+"openGame('G2')"],
      ['a game in setup, editing invites','openEditInvites()'],
      ['a game in setup, invites not saved',fail('games.update')+'saveEditInvites()'],
      ['turn 0: the starting roster',ok+'closeEditInvites();runTurn0()'],
      ['turn 0: players unreadable',fail('game_players.select')+'runTurn0()'],
      ['turn 0: a bot realm not saved',ok+'runTurn0().then(()=>{ '+fail('game_players.insert')+'commitTurn0(); })'],
      ['turn 0: the world not generated',ok+`runTurn0().then(()=>{ window.generateNewGame=async()=>{ throw new Error(${lit(W.error)}); };${quiet('commitTurn0()')} })`],
      ['an active game',ok+"openGame('G1')"],
      ['an active game, reports unreadable',fail('rpc.gm_reported_messages')+'loadReportedDispatches(currentGame)'],
      ['the watcher: games waiting, one run fails',ok+tick],
      ['the watcher: a failed game paused',tick],
      ['the watcher: a game that can\'t load',fail('game_players.select')+`runTurn({auto:true,game:{id:'G1',name:${lit(W.db.games[0].name)},turn:3},reason:${lit(W.reason)}})`],
      ['the watcher: reloading for a newer build',ok+"{ const st=window.setTimeout; window.setTimeout=(f,ms)=>ms===400?0:st(f,ms);"
        +"window._fetchBuildStamp=async()=>'2099.01.01-0000';"
        +`refreshIfNewerBuild({id:'G1',turn:3,name:${lit(W.db.games[0].name)}}).then(()=>{ window.setTimeout=st; }); }`],
      ['an active game, settings not saved',"openGame('G1').then(()=>{ "+fail('games.update')+'saveTurnMode();saveBotDiplomacy(); })'],
      ['an active game, archiving unreadable',ok+fail('games.select')+"setGameArchived('G1',true)"],
      ['an active game, archiving not saved',ok+fail('games.update')+"setGameArchived('G1',true)"],
      ['an active game, the turn fails',ok+"openGame('G1').then(()=>{ "+turnFails+' })'],
      ['an active game, the turn can\'t load',fail('game_players.select')+'runTurn()'],
      ['an active game, a removal fails',ok+"openGame('G1').then(()=>{ "+fail('game_players.delete')+"removePlayer('s11'); })"],
      ['an active game, a player removed',ok+"removePlayer('s11')"],
      ['statistics',ok+'openStats(true)'],
      ['statistics, unreadable',fail('turn_events.select')+'openStats(true)'],
      ['statistics, Hall of Fame rebuilt without names',ok+'openStats(true).then(()=>{ '+fail('profiles.select')+'backfillGameRecords(true); })'],
      ['banners: writes failed',ok+`_kcTelLastErr=${lit(W.error)};renderTelemetryBanner();_kcLbLastErr=${lit(W.error)};renderLeaderboardBanner();show('sec-games')`],
      ['banners: tables missing','_kcHasTel=false;_kcHasLb=false;_kcHasMsg=false;renderTelemetryBanner();renderLeaderboardBanner();renderMessagingBanner()'],
      ['deleting a game fails',ok+fail('games.delete')+"deleteGame('G3')"],
      ['change password, refused',`sb.auth.updateUser=async()=>({error:{message:${lit(W.error)}}});changePassword();`
        +val('cp-new',W.password)+val('cp-new2',W.password)+'submitChangePassword()'],
      ['change password, failed',`sb.auth.updateUser=async()=>{ throw new Error(${lit(W.error)}); };submitChangePassword()`],
    ];
  },
  shown:W=>{
    const D=W.db, setup=JSON.parse(D.game_players[3].turn_report).playerSetup, ev=D.turn_events[0], res=D.game_results[0];
    return [W.error,W.filter,W.search,W.reason,D.profiles[0].name,D.profiles[4].name,...D.games.map(g=>g.name),
      D.games[3].turn,D.games[3].max_players,D.game_messages[0].turn,
      D.game_players[0].display_name,D.game_players[1].display_name,D.game_players[2].display_name,D.game_players[3].display_name,
      D.game_players[5].invite_code,setup.kingName,setup.kingdomName,setup.race,setup.alignment,setup.temper,Object.keys(setup.skills)[0],
      ...JSON.parse(D.games[0].game_state).characters.map(c=>c.name),D.game_messages[0].body,D.message_reports[0].reason,...Object.values(W.log),
      // the Stats tab names an order it doesn't know by its key, with _ as spaces
      ev.race,ev.alignment,ev.orders.chars.c0.ph[0].a.replace(/_/g,' '),ev.outcomes.battles.list[0].terrain,ev.outcomes.battles.list[0].kind,
      ev.outcomes.encounters.list[0].power,ev.outcomes.spells.list[0].spell,ev.outcomes.deaths.list[0].how,res.victory,res.game_name,
      D.turn_events[1].bot_difficulty].filter(s=>typeof s==='string');
  },
};

const TOURS={leaderboard,overlord,gmPortal};

// Runs a tour's mode in jsdom against the site in `site` (a folder). visit(label, document, window) after each step.
async function runJsdom(tour,mode,W,visit,{site=SITE}={}){
  const m=tour.modes[mode], errs=[];
  const dom=bootJsdom(readPage(path.join(site,tour.page)),{supabase:tour.jsdomSupabase(W,m),url:'https://example.test/'+tour.page+m.url,
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
      w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
      w.console.warn=()=>{}; w.console.log=()=>{};
    }});
  const w=dom.window;
  await wait(tour.bootWait||400);
  for(const [label,code] of tour.steps(W,m)){
    try{ if(code) w.eval(code); }catch(e){ errs.push(`${label}: ${e.message}`); }
    await wait(80);
    await visit(label,w.document,w);
  }
  w.close();
  return errs;
}

// The same in Chromium (Playwright `browser`), with the site served from one folder as deployed. visit(label, page).
async function runChromium(browser,tour,mode,W,visit,{site=SITE}={}){
  const m=tour.modes[mode], errs=[];
  const srv=await serve(site);
  const ctx=await browser.newContext();
  await routeExternal(ctx,tour.browserSupabase(W,m));
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(String(e.message||e)));
  p.on('console',x=>{ if(x.type()==='error'&&!/Failed to load resource/.test(x.text())) errs.push('console: '+x.text()); });
  await p.goto(srv.url+'/'+tour.page+m.url,{waitUntil:'load'});
  await p.waitForTimeout(Math.max(600,tour.bootWait||0));
  for(const [label,code] of tour.steps(W,m)){
    try{ if(code) await p.evaluate(code); }catch(e){ errs.push(`${label}: ${e.message}`); }
    await p.waitForTimeout(300);   // long enough for a broken <img src=x> to fail and fire its onerror
    await visit(label,p);
  }
  await ctx.close(); srv.close();
  return errs;
}

module.exports={TOURS,runJsdom,runChromium};
