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
      +"kcRng.use((()=>{let s=7;return ()=>(s=s*16807%2147483647)/2147483647;})());_autoRunBusy=true;";
    const tick='_autoRunBusy=false;autoTurnTick().then(()=>{ _autoRunBusy=true; });';
    // a failure staged on purpose, which the engine also logs to the console: only that log is muted, for that step
    const quiet=code=>`{ const ce=console.error; console.error=()=>{}; Promise.resolve(${code}).finally(()=>{ console.error=ce; }); }`;
    // the turn fails where the turn's own work begins: its first draw of the dice (the turn's seed, after the orders are
    // cleared) throws, then the dice go back. The throwing dice draw first, so every later draw is the one it was.
    const turnFails=`{ const was=kcRng.use(()=>{ was(); throw new Error(${lit(W.error)}); }); const ce=console.error; console.error=()=>{};`
      +' Promise.resolve(runTurn()).finally(()=>{ console.error=ce; kcRng.use(was); }); }';
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
      // generateNewGame's first step reads the map's size: here that read throws
      ['turn 0: the world not generated',ok+`runTurn0().then(()=>{ _pendingTurn0.sz={get cols(){ throw new Error(${lit(W.error)}); }};${quiet('commitTurn0()')} })`],
      ['an active game',ok+"openGame('G1')"],
      ['an active game, reports unreadable',fail('rpc.gm_reported_messages')+'loadReportedDispatches(currentGame)'],
      ['the watcher: games waiting, one run fails',ok+'_autoRunBusy=false;'+quiet('autoTurnTick().then(()=>{ _autoRunBusy=true; })')],
      ['the watcher: a failed game paused',tick],
      ['the watcher: a game that can\'t load',fail('game_players.select')+`runTurn({auto:true,game:{id:'G1',name:${lit(W.db.games[0].name)},turn:3},reason:${lit(W.reason)}})`],
      ['the watcher: reloading for a newer build',ok+"{ const st=window.setTimeout; window.setTimeout=(f,ms)=>ms===400?0:st(f,ms);"
        // version.json names another GM page (P1-06c): the first check sees it, the second 10 minutes later reloads
        +"const f=window.fetch, now=Date.now, page=location.pathname.split('/').pop()||'index.html';"
        +"window.fetch=async()=>({ok:true,json:async()=>({commit:'0123456789abcdef0123456789abcdef01234567',time:null,pages:{[page]:'000000000000'}})});"
        +`const g={id:'G1',turn:3,name:${lit(W.db.games[0].name)}};`
        +"refreshIfNewerBuild(g).then(()=>{ const t=now(); Date.now=()=>t+600000; return refreshIfNewerBuild(g); })"
        +".then(()=>{ window.setTimeout=st; Date.now=now; if(f) window.fetch=f; else delete window.fetch; }); }"],
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

// ── The player portal ────────────────────────────────────────────────────────────────────────────────────────────
// The lobby (P0-19 PR 3), the turn report and Chronicle (PR 4), the orders (PR 5), and the map and Dispatches (PR 6).
// The player p1 is in G1 (active: a deadline, a rival's orders in, an unread dispatch, and its turn report),
// G2 (in setup, waiting), G3 (archived) and a game whose row it can't read (G9). Open to join: G4 (public, another
// GM's, Divine taken) and G5 (private, p1 invited); G6 is private to others and never listed. p1 has an open offer to
// become a Game Master. Every string a player or a GM can store comes from N, and so does the turn number the cards
// show; every database error a screen shows does too (stub ERRORS). A player, a signed-out visitor and a page that
// can't start each see their screens; the reader (p1 again) opens G1's report, its past turns and its title and
// diplomacy states; in the orders mode, p1's saved draft is restored on that report and every order is given in turn;
// the map mode opens every kind of province's popup, and the Dispatches mode every conversation and composer state.
const playerPortal={
  page:'kingdoms-call-player-portal.html',
  bootWait:900,
  modes:{
    player:{url:'',user:'p1'},
    reader:{url:'',user:'p1',report:true},
    orders:{url:'',user:'p1',orders:true},
    map:{url:'',user:'p1',map:true},
    dispatches:{url:'',user:'p1',dispatches:true},
    signedOut:{url:'',user:null},
    bootFails:{url:'',bootError:true},
  },
  world(N){
    const num=(field,v)=>N.hostile?N(field,v):v;
    // an id the engine makes (a research choice's key and options): hostile with hostile names, the engine's shape otherwise
    const eid=(field,i,plain)=>N.hostile?N(field,i):plain;
    const at='2026-10-10T07:00:00Z';
    const json=o=>JSON.stringify(o);
    const game=(id,name,gm,status,turn,gs,extra)=>({id,name,gm_user_id:gm,status,turn,max_players:4,max_turns:0,created_at:at,meta:null,
      game_state:json(gs),...(extra||{})});
    const slot=(id,game_id,player_index,user_id,display_name,extra)=>({id,game_id,player_index,user_id,display_name,orders_submitted:false,
      orders:null,turn_report:null,...(extra||{})});
    const joined=a=>json({playerSetup:{kingName:N('king',9),kingdomName:N('kingdom',9),alignment:a},status:'joined',waitingForTurn0:true});
    // G1's turn report for p1 (realm 0), staged as the saved row: every section the report and Chronicle draw. The names
    // a player or a GM chose (heroes, realms, units, titles' holders, dispatches, battle cries and parting words) come
    // from N, and so do the engine's own strings that reach the screen (provinces, lairs, items, events, perks).
    const C={king:N('hero',0),hero:N('hero',1),enemy:N('hero',5),wander:N('hero',6),chief:N('hero',7),dead:N('hero',8)};
    const R={own:N('realm',0),rival:N('realm',1),third:N('realm',2)};
    const P={home:N('province',0),field:N('province',1),far:N('province',2)};
    const T={unit:N('unit',0),cry:N('cry',0),parting:N('parting',0),dispatch:N('dispatch',1),verb:N('verb',0),old:N('hero',9),gmLog:N('hero',13)};
    const force=(name,color,verb,armies,extra)=>'⚑FORCE⚑'+json({name,color,verb,armies,...(extra||{})});
    const battle=(tier,text,extra)=>({type:'combat',charId:'c0',phase:1,battleId:'b1',bTier:tier,text,...(extra||{})});
    const lastTurnLog=[
      {type:'move',charId:'c0',phase:0,text:`**${C.king}** marches from ${P.home} to ${P.field}, crying "${T.cry}"`},
      {type:'event',charId:'c0',phase:0,pinNotice:true,text:`${C.king} is still locked in the battle at ${P.field}`},
      battle('k',`⚔ **Battle for ${P.field}** — ${R.own} against ${R.rival}`),
      battle('d',force(`${C.king} (${R.own})`,'#a33',`${T.verb}, leading`,[{type:'Free Lances',quality:'Veteran',unitName:T.unit},{type:'Noble Griffons',quality:'Elite',phantom:true}])),
      battle('d',force(C.enemy,'#36c','defends — 2 defending units',[],{neutral:false})),
      battle('d',force(C.chief,null,'stands guard',[{type:'Shieldwall Levies',quality:'Green'}],{guard:true})),
      battle('d',`   ${C.enemy} strikes **${C.king}** for 3 — "${T.parting}"`),
      battle('d',`📊 Battle lines │ ${R.own} │ 12.75 │ 7`),
      battle('t',`⚰ Losses: ${T.unit} falls`),
      battle('s',`${R.rival} hears of the battle at ${P.field}`),
      {type:'combat',charId:'c1',phase:2,battleId:'b2',bTier:'s',text:`⚔ ${C.hero} watches the battle at ${P.field}`},
      {type:'event',charIds:['c1'],phase:2,text:`⚠ **${C.hero}** hears "${T.parting}"`},
      {type:'event',charId:'c1',phase:99,text:`${C.hero} sends a courier to ${P.home}`},
      {type:'event',charId:'c1',env:true,phase:3,text:`🌋 ${C.hero} shakes ${P.far}`},
      {type:'event',env:true,phase:3,text:`🌋 The earth shakes in ${P.far}`},
      {type:'message',text:`${R.rival} writes: ${T.dispatch}`},
      {type:'system',phase:3,text:`${R.own} conquers ${P.far} from **${R.third}**`},
      {type:'system',text:`💰 ${R.own} collects 12g in taxes`},
      {type:'system',phase:1,text:`[Intelligence] ${N('intel',0)} near ${P.field}`},
      {type:'system',text:`[Intelligence] ${N('intel',1)}`},
      {type:'system',text:`[The Throne] ${R.rival} holds 12g; ${C.enemy} leads them`},
      {type:'system',text:`[The Throne] and ${R.third} trails`},
    ];
    const king={id:'c0',name:C.king,isKing:true,alive:true,hp:20,maxHp:30,race:'Human',alignment:'Evil',temper:'Brave',temperEff:'Berserk',
      locationId:1,locationName:P.home,pay:0,skills:{melee:3,druid:1},
      skillEff:{melee:{base:3,bonus:2,sources:[{label:N('item',2),delta:2,kind:'item'}]},druid:{base:1,bonus:0}},
      skillExtra:{archery:[{label:N('title',0),delta:1,kind:'title',scope:'combat'}]},
      items:[{name:'Blade of Fury',tier:3,desc:N('item',1),acquiredThisTurn:true},{name:'Elven Longbow',tier:2,race:'Elven'},{name:'Ring of Wealth',tier:4,equipped:false}],
      titlesHeld:[{name:N('title',1),perk:N('perk',1)}],minorHeld:[{name:N('title',2),perk:N('perk',2)}],
      armies:[{type:'Free Lances',quality:'Veteran',unitName:T.unit,race:'Human',speed:3,cost:2,moveRate:2,moveKind:'land'},
        {type:'Forest Ents',quality:'Average',speed:2},{type:'Cave Trolls',quality:'Green',wildHunt:true,wildHuntUntil:3},
        {type:'Galleon Fleet',quality:'Average',speed:3}],
      effectiveSpeed:2,effectiveSeaSpeed:2,effectiveAirSpeed:0};
    const hero={id:'c1',name:C.hero,isKing:false,alive:true,hp:10,maxHp:10,race:'Elven',alignment:'Good',temper:'Cautious',
      locationId:2,locationName:P.field,pay:3,skills:{archery:6,sage:2},armies:[]};
    const titles={public:true,myShare:.3,threshold:.5,myOwnShare:.3,callerMin:.25,soloThreshold:.45,allyStep:.05,blocSize:1,reckoningMinTurn:10,
      callBlockedReason:'tooEarly',kingAlive:true,
      gains:[{scope:'major',name:N('title',3),charName:C.king,kingdomName:R.own,req:N('req',0),perk:N('perk',3),initial:true}],
      losses:[{scope:'minor',name:N('title',4),newCharName:C.enemy,newHolderName:R.rival},{scope:'major',name:N('title',5),vacant:true}],
      standings:[{index:0,name:R.own,color:'#a33',score:30,titleNames:[N('title',3)],relics:1},{index:1,name:R.rival,color:'#36c',score:20},
        {index:2,name:N('realm',3),unmet:true,score:5}],
      holders:{throne:{holderName:R.own,charName:C.king,kingdomLevel:true,mine:true,req:N('req',1),perk:N('perk',4),race:{mine:true,charName:C.king,leadPct:3}},
        vault:{holderName:R.rival,charName:C.enemy,req:N('req',2),perk:N('perk',5),race:{pct:40,charName:C.hero}},
        marshal:{holderName:N('realm',3),unmet:true,charName:N('hero',11)},sea:{race:{vacant:true}},monster:{}},
      minor:{mine:[{name:N('title',2),holderName:C.king,req:N('req',3),perk:N('perk',2)}]}};
    const report={playerIndex:0,engineStamp:N('stamp',0),lastTurnLog,characters:[king,hero],
      kingdom:{name:R.own,color:'#a33',alignment:'Evil',race:'Human',gold:12,taxIncome:20,armyWages:5,heroWages:3,rawTaxBase:15,consecG:2,sageDiscG:1,
        taxBonusCutG:1,taxBonusCapG:2,earthquakeReduction:1,enslaveReduction:1,hostLeaderG:1,orcSpoilsG:1,nextArmyWages:6,heroWageDisc:1,nextHeroWages:4},
      ownedProvinces:[{id:1,name:P.home,terrain:'forest',tax:5,race:'Human',explored:40,
        features:[{name:N('lair',0),discovered:true,monsterPower:'Powerful'},{name:N('lair',1),discovered:true,cleared:true}],
        armyTypes:['Free Lances','Forest Ents'],garrisonArmies:[{type:'Shieldwall Levies',quality:'Green',unitName:N('unit',1)}],
        neutralDefenders:[{type:'Free Lances',quality:'Average'}],grandDesign:{name:N('design',0),active:true,ownerName:R.own},terror:{pct:10,stacks:1,byYou:true}}],
      visibleDeadHeroes:[{name:C.dead,race:'Orcish',alignment:'Evil',player:1,locationName:P.far,killedOnTurn:2,topSkill:{skill:'melee',level:5},servedOther:true},
        {name:N('hero',10),player:null,locationName:P.far,killedOnTurn:1,inVisibleProv:true}],
      graveIntel:[{name:P.far,turn:2,detail:[{n:2,k:'Elite Free Lances'}],detailPartial:true,detailTurn:1}],
      mercIntel:[{unitName:N('unit',2),type:'Free Lances',quality:'Veteran',location:P.field}],
      heroSightings:[{type:'wandering',name:C.wander,race:'Human',alignment:'Neutral',locationName:P.field,topSkill:{skill:'melee',level:4},
          spiedSkills:{melee:4},spiedTurn:2,spiedItems:[N('item',3)],spiedArmies:[{type:'Free Lances',quality:'Green',unitName:N('unit',3)}],armyBand:N('band',0),pay:3,inOwnedProvince:true},
        {type:'neutral_guard',name:C.chief,race:'Dwarven',alignment:'Good',locationName:P.far,topSkill:{skill:'melee',level:7},armyBand:N('band',1)},
        {type:'enemy',name:C.enemy,kingdom:R.rival,kingdomColor:'#36c',race:'Elven',alignment:'Divine',locationName:P.field,topSkill:{skill:'archery',level:2},inOwnedProvince:true}],
      provinceEvents:[{provName:P.home,phase:1,text:N('event',0)},{provName:P.far,text:N('event',1)}],
      provinceCharIntel:[{spied:true,provName:P.field,characters:[{category:'enemy',name:C.enemy,color:'#36c',isKing:true,kingdom:R.rival,
          armies:[{type:'Free Lances',quality:'Average',unitName:N('unit',4)}],spiedSkills:{melee:2}},
        {category:'wandering',name:C.wander,armyBand:'no armies'},{category:'neutral',name:C.chief,isNeutralGuard:true,armyCount:2}]},
        {spied:true,provName:P.far,characters:[]}],
      spyActivity:[{provName:P.field,sincePhase:1,lines:[{phase:2,text:N('spy',0)},{text:N('spy',1)}]}],
      knownFeatures:[{name:N('lair',0),province:P.home,monster:N('monster',0),monsterPower:'Powerful',monsterCat:'Monster',isOwned:true,
          rumour:{turn:2,gold:7,items:[N('item',4)],wields:[N('item',5)]}},
        {name:N('lair',2),province:P.field,ritualSite:true},{name:N('lair',1),province:P.home,cleared:true},
        {name:N('lair',3),province:P.far,monster:N('monster',1),monsterPower:'Weak',rumour:{turn:1,gold:0,items:[],stolen:[N('item',6)]}}],
      knownGuardianWeaknesses:{[N('monster',0)]:{name:N('weakness',0),desc:N('weakness',1)}},
      discoveries:[{name:N('discovery',0),category:'Military',turnDiscovered:2,desc:N('discovery',1)}],
      diplomacy:{known:[{index:1,name:R.rival,color:'#36c',alignment:'Divine',relation:'neutral',offeredUs:'alliance'},
        {index:2,name:R.third,color:'#3a3',alignment:'Evil',relation:'enemy',conceded:true,concededTurn:2},
        {index:3,name:N('realm',3),color:'#999',relation:'allied'}],alliancesAllowed:true,safeStartUntil:0},
      titles,
      allKingdoms:[{name:R.own,color:'#a33'},{name:R.rival,color:'#36c'},{name:R.third,color:'#3a3'}],
      nameColors:[{name:N('hero',12),color:'#999'}],
      worldMeta:{cols:3,rows:1,provinces:[{id:1,col:0,row:0,name:P.home,terrain:'forest',owner:0,ownerColor:'#a33',characters:[{name:C.king,isOwn:true}]},
        {id:2,col:1,row:0,name:P.field,terrain:'plain',characters:[{name:C.enemy,ownerColor:'#36c'},{name:C.wander,isWanderer:true}]},
        {id:3,col:2,row:0,name:P.far,terrain:'mountain',characters:[{name:C.chief,isNeutralGuard:true}]}]}};
    // An older saved snapshot (turn 1, before battle folding, game-end flags and unit names): plain battle lines, a
    // force with no unit names, no rawTaxBase, skills without their sources.
    const oldReport={playerIndex:0,characters:[{id:'c0',name:C.king,isKing:true,alive:true,hp:30,maxHp:30,race:'Human',skills:{melee:2},armies:[]}],
      kingdom:{name:R.own,color:'#a33',alignment:'Neutral',gold:5,taxIncome:6},ownedProvinces:[{id:1,name:P.home,terrain:'forest',tax:5}],
      titles:{public:false,publicFromTurn:5},allKingdoms:[{name:R.own,color:'#a33'}],
      lastTurnLog:[{type:'move',charId:'c0',phase:0,text:`**${C.king}** rides to ${P.home}`},
        {type:'combat',charId:'c0',phase:1,text:`⚔ **Battle for ${P.home}** against ${T.old}`},
        {type:'combat',charId:'c0',phase:1,text:force(C.king,'#a33','attacks',[{type:'Free Lances',quality:'Green'}])},
        {type:'event',charId:'c0',phase:2,text:`${C.king} is wounded — "${T.parting}"`},
        {type:'system',text:`[Intelligence] ${N('intel',2)}`}]};
    // ── The orders (PR 5) ── The same turn report with what the order form reads: three heroes of p1 with numeric ids,
    // as the engine gives them (the king, crowned heir this turn, has every skill at 9, so every mastery order, spell
    // and picker is on offer; one hero stands on the northern edge of a 4×3 map), rivals, wanderers and bodies in the
    // king's province, a hero to hire, a band of mercenaries, lairs, a ritual site, items to equip, use and send, a
    // research choice to make, and the odds the engine quotes. Every name comes from N.
    const OP={home:N('province',20),rival:N('province',21),sea:N('province',22),wild:N('province',23),far:N('province',24),
      north:N('province',25),seen:N('province',26)};
    const sk9=Object.fromEntries(['melee','archery','tactical','march','naval','sage','spy','thief','druid','explorer',
      'white','psychic','illusory','elemental','necromancy'].map(s=>[s,9]));
    const at5={locationId:5,locationName:OP.home};
    const odds={spy:{chance:60,level:9},research:{rawLevel:9,level:9,chance:45},assassinate:{chance:50,level:9,kingPenalty:25},
      steal:{chance:70,level:9,escape:40},grandHeist:{chance:80,level:9,escape:50},blockade:{chance:50},
      practice:{byLevel:[25,20,15,10,5],astro:5,discovery:0,bySkill:{melee:5}}};
    const oKing={id:10,name:C.king,isKing:true,_isHeir:true,alive:true,hp:20,maxHp:30,race:'Human',alignment:'Evil',temper:'Brave',
      ...at5,pay:0,skills:sk9,effectiveSpeed:3,effectiveSeaSpeed:2,
      armies:[{type:'Free Lances',quality:'Veteran',unitName:N('unit',10)},{type:'Galleon Fleet',quality:'Average',unitName:N('unit',11)}],
      items:[{id:101,name:N('item',10),tier:3,slot:'weapon',desc:N('item',11)},{id:102,name:N('item',12),tier:2,slot:'ring'},
        {id:103,name:N('item',13),tier:4,slot:'ring',equipped:false},{id:104,name:N('item',14),tier:2,desc:N('item',15),effect:{stat:'castSpell',spell:'Charm'}},
        {id:105,name:N('item',16),tier:3,effect:{stat:'mithrilArmour'}}],
      castChance:{white:{level:9,chance:95,arcane:5,mastery:10,discovery:5},psychic:{level:9,chance:90}},orderChance:odds};
    const oHero={id:11,name:C.hero,isKing:false,alive:true,hp:10,maxHp:10,race:'Elven',alignment:'Good',temper:'Cautious',...at5,pay:3,
      skills:{thief:2,spy:1,sage:2,white:1,psychic:2,archery:4},armies:[],items:[],effectiveSpeed:3,
      orderChance:{spy:{auto:true,autoWhy:N('perk',9)},research:{rawLevel:2,level:2,chance:10},steal:{chance:70,level:2,escape:40},practice:{}}};
    const oEdge={id:12,name:N('hero',14),isKing:false,alive:true,hp:8,maxHp:8,race:'Orcish',alignment:'Evil',temper:'Brave',
      locationId:1,locationName:OP.north,pay:2,skills:{melee:2},armies:[{type:'Noble Griffons',quality:'Green',unitName:N('unit',15)},
        {type:'Cave Trolls',quality:'Average'}],items:[],effectiveSpeed:2};
    const prov=(id,name,terrain,extra)=>({id,col:id%4,row:Math.floor(id/4),name,terrain,...(extra||{})});
    const nb=id=>{ const r=Math.floor(id/4), c=id%4, offs=r%2?[[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]:[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
      return offs.map(([dr,dc])=>[r+dr,((c+dc)%4+4)%4]).filter(([rr])=>rr>=0&&rr<3).map(([rr,cc])=>rr*4+cc); };
    const provinces=[prov(0,N('province',27),'plain'),prov(1,OP.north,'mountain',{owner:null,explored:40}),prov(2,OP.sea,'sea'),
      prov(3,N('province',28),'forest'),prov(4,null,null),
      prov(5,OP.home,'forest',{owner:0,ownerName:R.own,tier:'owned',tax:10,explored:40,features:[{name:N('lair',10)}],characters:[{name:C.king,isOwn:true}]}),
      prov(6,OP.rival,'plain',{owner:1,ownerName:R.rival,wealth:'Rich',isHomeCapitalOfOwner:true,tax:8}),prov(7,OP.wild,'forest',{owner:null}),
      prov(8,N('province',29),'hills'),prov(9,OP.far,'plain',{owner:1,ownerName:R.rival}),prov(10,null,null),prov(11,OP.seen,'swamp',{owner:2,ownerName:R.third})]
      .map(p=>({...p,neighbors:nb(p.id)}));
    const vis=(id,name,player,extra)=>({id,name,player,...at5,race:'Human',alignment:'Neutral',armies:0,...(extra||{})});
    const ordersReport={...report,characters:[oKing,oHero,oEdge],turn:num('turn',3),
      kingdom:{...report.kingdom,alignment:'Evil',gold:20,taxIncome:12},
      allKingdoms:[{index:0,name:R.own,color:'#a33'},{index:1,name:R.rival,color:'#36c'},{index:2,name:R.third,color:'#3a3'}],
      diplomacy:{known:[{index:1,name:R.rival,color:'#36c',relation:'enemy'},{index:2,name:R.third,color:'#3a3',relation:'neutral'}],alliancesAllowed:true},
      worldMeta:{cols:4,rows:3,provinces},
      ownedProvinces:[{id:5,name:OP.home,terrain:'forest',race:'Human',armyTypes:['Free Lances'],tax:10}],
      visibleChars:[vis(20,C.enemy,1,{race:'Elven'}),vis(21,C.wander,null,{isWandering:true,pay:2,hp:10,maxHp:10}),
        vis(22,N('hero',15),1,{armies:3,armyBand:N('band',2)}),vis(23,N('hero',16),1,{isKing:true}),
        vis(24,N('hero',22),2,{locationId:6,locationName:OP.rival})],
      encounterTargets:[vis(20,C.enemy,1,{leadsArmy:false}),vis(21,C.wander,null),vis(23,N('hero',16),1,{isKing:true}),
        vis(25,N('hero',23),2,{untargetable:'faceless'})],
      everSeenChars:[{id:20,name:C.enemy,player:1,lastLocName:OP.rival,lastSeenTurn:num('turn',2)},{id:24,name:N('hero',22),player:2,locationName:OP.seen}],
      knownDeadHeroes:[{id:30,name:N('hero',17),...at5,raisable:true,player:null,killedOnTurn:num('turn',1),race:'Human',alignment:'Good'},
        {id:31,name:N('hero',18),...at5,raisable:false,whyNot:N('reason',0),isKing:true,player:1},
        {id:32,name:N('hero',19),...at5,isMonarch:true,raisable:true,wasOwnHero:true}],
      provinceOrderData:{
        5:{id:5,name:OP.home,owner:0,canRecruit:true,terrain:'forest',explored:40,
          armyTypes:[{type:'Free Lances',maxPerTurn:2,cost:3},{type:'Forest Ents',maxPerTurn:1,cost:4},{type:'Cave Trolls',maxPerTurn:1,cost:5}],
          features:[{idx:0,name:N('lair',10),monster:N('monster',10),monsterPower:'Weak',monsterCat:N('kind',0)},
            {idx:1,name:N('lair',11),monster:N('monster',11),monsterPower:'Legendary',monsterCat:'Undead'},{idx:2,name:N('lair',12),ritualSite:true}],
          availableHeroes:[{id:40,name:N('hero',20),race:'Human',alignment:'Neutral',temper:'Brave',...at5,topSkill:{skill:'melee',level:5},pay:3},
            {id:41,name:N('hero',21),race:'Orcish',alignment:'Divine',...at5,skills:{spy:3}}],
          garrisonArmies:[{type:'Shieldwall Levies',quality:'Green',unitName:N('unit',12)}],wildHuntType:N('unit',13),wildHuntCost:4},
        6:{id:6,name:OP.rival,owner:1,canRecruit:false,terrain:'plain',armyTypes:[{type:'Free Lances',maxPerTurn:1,cost:3}],
          garrisonArmies:[{type:'Free Lances',quality:'Average'}],features:[]}},
      mercIntel:[{id:50,unitName:N('unit',14),type:'Free Lances',quality:'Veteran',cost:4,...at5,location:OP.home}],
      researchCategories:[{name:N('field',0),known:1,total:3},{name:'Military',known:3,total:3}],
      discoveries:[],
      pendingDiscoveryChoices:[{key:eid('key',0,'t2-c11'),charName:C.hero,category:N('field',0),turn:num('turn',2),
        options:[{id:eid('choice',0,'sd12'),name:N('discovery',2),category:N('field',0),desc:N('discovery',3)},
          {id:eid('choice',1,'sd34'),name:N('discovery',4),category:'Military',desc:N('discovery',5)}]}],
      knownFeatures:[{name:N('lair',10),province:OP.home,monster:N('monster',10),monsterPower:'Weak'}],
      orderPrices:{brokerSpy:2,harvest:2}};
    // p1's saved draft: orders for every hero, the hire, raise and charm cards and their own orders, the encounter
    // plans (battle cries), the heir's name, a declaration and a research choice. Orders an older page wrote that this
    // one no longer lists (Scout) keep their "Details".
    const pre={hire:'hired_40_via_11_ph0',raise:'resurrect_30_via_10_ph0',charm:'charm_21_via_10_ph1'};
    const turnNow=num('turn',3);
    const ordersDraft={orders:{
        10:[{action:'Cast Spell',target:'Resurrect',extra:'30'},{action:'Cast Spell',target:'Charm',extra:'21'},
          {action:'Scout',target:N('details',0)},{action:'Equip Items',target:''},{action:'Move',target:'prov:6'}],
        11:[{action:'Hire Hero',target:'40'},{action:'Steal',target:'20'},{action:'Research',target:N('field',0)},
          {action:'Practice Skill',target:'thief'},{action:'Old Rite',target:N('details',1)}],
        12:[{action:'Move',target:'prov:2'},{},{action:'Defend'},{},{}],
        [pre.hire]:[{},{action:'Explore'},{action:'Spy',target:'char:20'},{},{action:'Scout',target:N('details',2)}],
        [pre.raise]:[{},{action:'Rest'},{action:'Recruit Armies',target:'Free Lances|1'},{},{}],
        [pre.charm]:[{},{},{action:'Defend'},{action:'Move',target:'prov:6'},{}]},
      encounterPlans:{10:{tactics:['ME','CA:Fireball','ST','CS:elemental'],notes:T.cry,duelStance:'accept',evilMode:'enslave'},
        11:{tactics:['FL'],notes:N('cry',1)},[pre.hire]:{tactics:['ME','CS:white'],notes:N('cry',2)},
        [pre.raise]:{tactics:['ME'],notes:N('cry',3),duelStance:'refuse'},[pre.charm]:{tactics:['ME'],notes:N('cry',4)}},
      kingSkills:{10:{skills:sk9,pending:4,name:N('heir',0),temper:'Cautious',base:sk9}},
      diplomacy:{1:'enemy'},discoveryChoices:{[eid('key',0,'t2-c11')]:eid('choice',1,'sd34')},forTurn:turnNow};
    const ordersShown=[...Object.values(OP),N('heir',0),N('details',0),N('details',1),N('hero',14),N('hero',15),N('hero',16),N('hero',17),
      N('hero',18),N('hero',19),N('hero',20),N('hero',22),N('unit',10),N('unit',11),N('unit',12),N('unit',14),N('unit',15),N('item',10),N('item',11),
      N('item',12),N('item',14),N('lair',10),N('lair',11),N('monster',10),N('field',0),N('discovery',2),N('discovery',3),N('reason',0)];
    // ── The map (PR 6) ── The same turn report with a map holding every kind of province its popup describes: three of
    // p1's own (one with lairs, local defenders and their leader, heroes of every kind, bodies, a garrison, a Grand
    // Design, Terror and graves; one cleared of lairs, with a ritual site; one fully mapped, with none), a rival's seen
    // now, one remembered, one on the border, one whose tier the popup doesn't name (its last branch) and one unknown.
    // Every name comes from N, and so do the engine's strings and the turns a reading was taken.
    const MP={cleared:N('province',30),mapped:N('province',31),live:N('province',32),remembered:N('province',33),border:N('province',34),
      other:N('province',35)};
    const mp=(id,extra)=>({id,col:id%4,row:Math.floor(id/4),...extra});
    const mapReport={...report,turnNumber:3,
      worldMeta:{cols:4,rows:2,provinces:[
        mp(0,{name:MP.cleared,terrain:'hills',tier:'owned',tax:4,race:'Dwarven',explored:100,armyTypes:[],
          features:[{name:N('lair',30),cleared:true},{name:N('lair',33),ritualSite:true}]}),
        // merged with the report's own province of this id (P.home): its lairs, garrison, defenders, Grand Design, Terror
        mp(1,{name:P.home,terrain:'forest',tier:'owned',consecrated:true,neutralGuard:{name:N('hero',30)},
          characters:[{id:'c0',name:C.king,isOwn:true,isKing:true,ownerColor:'#a33',armyCount:3},{id:'c1',name:C.hero,isOwn:true,armyBand:'no armies'},
            {id:'e1',name:C.enemy,isKing:true,ownerName:R.rival,ownerColor:'#36c',armyBand:N('band',30)},
            {id:'w1',name:C.wander,isWanderer:true,armyCount:1},{id:'w2',name:C.chief,isWanderer:true,isNeutralGuard:true,armyCount:2}]}),
        mp(2,{name:MP.mapped,terrain:'plain',tier:'owned',explored:100,features:[],armyTypes:[N('unitType',1)]}),
        mp(3,{name:MP.live,terrain:'plain',tier:'live',owner:1,ownerName:R.rival,ownerColor:'#36c',wealth:N('wealth',0),race:'Elven',explored:60,
          features:[{name:N('lair',31),monsterPower:'Legendary',monsterCat:N('kind',30)},{name:N('lair',32),ritualSite:true}],
          armyTypes:['Free Lances',N('unitType',2)],garrisonArmies:[{type:N('unitType',3)},{type:N('unitType',3)},{type:'Free Lances'}],
          grandDesign:{name:N('design',30),active:false},characters:[{id:'e2',name:N('hero',31),ownerName:R.rival,ownerColor:'#36c'}]}),
        mp(4,{name:MP.remembered,terrain:'swamp',tier:'remembered',owner:2,ownerName:R.third,wealth:'Poor',seenTurn:num('turn',1),armyTypes:[]}),
        mp(5,{name:MP.border,terrain:'mountain',tier:'border',owner:3,ownerName:N('realm',3),ownerColor:'#999',armyTypes:[N('unitType',4)],
          terror:{pct:20,stacks:2,byYou:false}}),
        mp(6,{name:N('province',36),terrain:'sea',tier:'unknown'}),
        mp(7,{name:MP.other,terrain:'forest',tier:'distant',ownerName:R.rival,wealth:N('wealth',1),grandDesign:{name:N('design',31),ownerName:R.rival,active:true}}),
      ]},
      graveIntel:[...report.graveIntel,{provinceId:1,turn:3,detail:[{n:2,k:N('unit',30)}],detailPartial:true},{provinceId:3,turn:num('turn',1)},
        {provinceId:7,turn:3,detail:[{n:1,k:'Free Lances'}]}],
      visibleDeadHeroes:[...report.visibleDeadHeroes,{id:'d1',name:N('hero',32),locationId:1,isKing:true,player:1},{id:'d2',name:N('hero',33),locationId:1,player:null}]};
    const mapShown=[...Object.values(MP),N('hero',30),N('hero',31),N('hero',32),N('hero',33),N('band',30),N('lair',31),N('lair',32),N('lair',33),
      N('wealth',0),N('wealth',1),N('design',30),N('design',31),N('unit',30),N('unitType',1),N('unitType',2),N('unitType',3),N('unitType',4),num('turn',1)];
    // ── Dispatches (PR 6) ── G1 with a third human realm (index 3, met in the report), and dispatches in every shape the
    // thread draws: to every realm, private, a conversation of three, p1's own, one already reported, one new since p1
    // last read, over three days. The turn a dispatch was sent in is stored by the sender's page, so it comes from N too.
    const msg=(id,from,to,day,body)=>({id,game_id:'G1',turn:num('turn',2),from_index:from,to_indexes:to,scope:to.length?'private':'public',body,
      created_at:`2026-10-${String(day).padStart(2,'0')}T07:00:00Z`});
    const dispatches={slot:slot('s13','G1',3,'p3',N('realm',3)),
      messages:[msg(7,1,[0],8,N('dispatch',0)),msg(8,0,[1],8,N('dispatch',2)),msg(9,1,[],9,N('dispatch',3)),msg(10,0,[],9,N('dispatch',4)),
        msg(11,3,[0,1],10,N('dispatch',5))],
      reports:[{id:1,message_id:9,game_id:'G1',reporter_index:0,reason:N('reason',2),created_at:at}],
      reads:{game_id:'G1',player_index:0,user_id:'p1',reads:{public:9}},
      draft:N('dispatch',6), reason:N('reason',3),
      shown:[N('dispatch',2),N('dispatch',3),N('dispatch',4),N('dispatch',5)]};
    // The game decided: the engine's end-of-game lines, flagged and (older reports) matched by shape.
    const gameEndLog=[{type:'system',gameEnd:true,text:`🏆 THE GAME IS DECIDED — ${R.own} is judged supreme`},
      {type:'system',gameEnd:true,text:`   1. ${R.own} — 30 Legacy`},
      {type:'system',text:`👑 THE RECKONING IS CALLED — by ${R.rival}`},{type:'system',text:`   2. ${R.rival} — 20 Legacy`}];
    return {
      hostile:!!N.hostile, report, C, R, P, T, gameEndLog, orders:{report:ordersReport,draft:ordersDraft,pre,turn:turnNow,
        shown:ordersShown,staleTurn:num('turn',9),turnLater:num('turn',4)}, map:{report:mapReport,shown:mapShown}, dispatches,
      error:N('error',0), password:'kc-test-password', newName:N('player',7), king:N('king',0), kingdom:N('kingdom',0),
      signUp:{name:N('player',8),email:'new@example.test'},
      db:{
        profiles:[{id:'p1',name:N('player',1),created_at:at},{id:'p2',name:N('player',2),created_at:at},
          {id:'gm1',name:N('gm',1),created_at:at},{id:'gm2',name:N('gm',2),created_at:at}],
        game_masters:[{user_id:'gm1',offered_at:at,offered_by:'ov1',accepted_at:at},{user_id:'gm2',offered_at:at,offered_by:'ov1',accepted_at:at},
          {user_id:'p1',offered_at:at,offered_by:'ov1',accepted_at:null}],
        site_admins:[{user_id:'ov1'}],
        games:[
          game('G1',N('game',1),'gm1','active',num('turn',3),{},{meta:{v:1,exempt:[],
            turnMode:{mode:'deadline',time:'20:00',everyDays:2,nextDeadlineAt:'2099-01-01T07:00:00Z'}}}),
          game('G2',N('game',2),'gm1','setup',0,{mapSize:'p4',botCount:0}),
          game('G3',N('game',3),'gm1','complete',13,{archived:true},{meta:{v:1,archived:true}}),
          game('G4',N('game',4),'gm2','setup',0,{mapSize:'p4',botCount:1,seaPct:40}),
          game('G5',N('game',5),'gm1','setup',0,{mapSize:'p3',visibility:'private',invited:['p1']}),
          game('G6',N('game',6),'gm1','setup',0,{mapSize:'p3',visibility:'private',invited:['p2']}),
        ],
        game_players:[
          slot('s10','G1',0,'p1',N('realm',0),{turn_report:json(report)}), slot('s11','G1',1,'p2',N('realm',1),{orders_submitted:true}),
          slot('s12','G1',2,null,N('realm',2),{turn_report:json({isBot:true})}),
          slot('s20','G2',0,'p1',N('realm',20),{turn_report:joined('Neutral')}),
          slot('s30','G3',0,'p1',N('realm',30)),
          slot('s90','G9',0,'p1',N('realm',90)),
          slot('s40','G4',0,'p2',N('realm',40),{turn_report:joined('Divine')}),
        ],
        game_messages:[{id:7,game_id:'G1',turn:2,from_index:1,to_indexes:[0],scope:'private',body:N('dispatch',0),created_at:at}],
        game_message_reads:[], message_reports:[], turn_events:[], game_results:[], game_records:[],
        // turn 1: p1's own saved snapshot (older shape); turn 0: none, so the page falls back to the GM's log
        turn_logs:[{id:'tl1',game_id:'G1',turn:1,player_index:0,entries:oldReport},
          {id:'tl0',game_id:'G1',turn:0,player_index:-1,entries:[{type:'event',actor:0,charId:'c0',phase:0,text:`**${C.king}** founds ${R.own}`},
            {type:'event',targets:[0],text:`${T.gmLog} is sighted near ${P.home}`},{type:'event',actor:1,text:'Another realm\'s line'}]}],
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
    // the same answers on every run: dialogs say yes, random draws repeat, and the page's delayed moves (back to My
    // Games after joining, closing a dialog after saving) and the polls (the Dispatches' and the games', timers of a
    // second or more) are held, so each screen stays as its step left it
    const fixed="window.confirm=()=>true;window.alert=()=>{};"
      +"Math.random=(()=>{let s=7;return ()=>(s=s*16807%2147483647)/2147483647;})();"
      +"{ const st=window.setTimeout; window.setTimeout=(f,ms,...a)=>ms>=1000?0:st(f,ms,...a); }"
      +"{ const si=window.setInterval; window.setInterval=(f,ms,...a)=>ms>=1000?0:si(f,ms,...a); }";
    if(!m.user) return [
      ['sign-in refused',fixed+`sb.auth.signInWithPassword=async()=>({data:{},error:{message:${lit(W.error)}}});`
        +val('si-email','player@example.test')+val('si-password',W.password)+'doSignIn()'],
      ['registering refused',"setAuthTab('signup');"+`sb.auth.signUp=async()=>({data:{},error:{message:${lit(W.error)}}});`
        +val('su-name',W.signUp.name)+val('su-email',W.signUp.email)+val('su-password',W.password)+val('su-password2',W.password)+'doSignUp()'],
    ];
    const row="supabase.stub.DB.game_players.find(r=>r.id==='s10')";
    if(m.map){
      // a click on a hex opens its popup, as a tap does
      const hex=(svg,id)=>`document.querySelector(${lit(`${svg} g[data-prov="${id}"]`)}).dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:40,clientY:40}));`;
      const map='#report-map-svg';
      return [
        ['the map, its legend and its icon buttons',fixed+`Object.assign(${row},{turn_report:${lit(JSON.stringify(W.map.report))}});`+"openReport('s10')"],
        ['the map, your province with lairs, heroes, bodies, a garrison and graves',hex(map,1)],
        ['the map, your province cleared of lairs',hex(map,0)],
        ['the map, your province fully mapped',hex(map,2)],
        ['the map, a rival\'s province seen now',hex(map,3)],
        ['the map, a province remembered',hex(map,4)],
        ['the map, a province on the border',hex(map,5)],
        ['the map, a province whose tier the popup doesn\'t name',hex(map,7)],
        ['the map in full screen, a province','showFullscreenMap();'+hex('#map-fullscreen-modal',1)],
      ];
    }
    if(m.dispatches){
      const D=W.dispatches;
      const stage=`supabase.stub.DB.game_players.push(${lit(D.slot)});supabase.stub.DB.game_messages=${lit(D.messages)};`
        +`supabase.stub.DB.message_reports=${lit(D.reports)};supabase.stub.DB.game_message_reads=${lit([D.reads])};`;
      return [
        ['Dispatches, to every realm',fixed+stage+"openReport('s10')"],
        ['Dispatches, a private conversation',"setMsgChannel('p:0-1')"],
        ['Dispatches, a conversation of three',"setMsgChannel('p:0-1-3')"],
        ['Dispatches, choosing realms for a new conversation','toggleMsgGroupPicker(true)'],
        ['Dispatches, a new conversation with nothing in it yet',"document.querySelector('#msg-group-list input[value=\"3\"]').checked=true;createMsgGroup()"],
        ['Dispatches, earlier dispatches to load',"_msgMoreOlder=true;setMsgChannel('public')"],
        ['Dispatches, earlier dispatches loading','_msgLoadingOlder=true;renderMessageThread()'],
        ['Dispatches, a report refused',"_msgMoreOlder=false;_msgLoadingOlder=false;setMsgChannel('p:0-1');"+`window.prompt=()=>${lit(D.reason)};`
          +fail('message_reports.insert')+'reportMessage(7)'],
        ['Dispatches, a dispatch refused',ok+val('msg-input',D.draft)+fail('game_messages.insert')+'sendMessage()'],
        ['Dispatches, your realm has conceded',ok+"_msgErr=null;_msgOut='conceded';updateMsgComposer()"],
        ['Dispatches, your realm has conceded, to every realm',"setMsgChannel('public')"],
        ['Dispatches, blocked by your GM',"_msgBlockOut=true;setMsgChannel('p:0-1')"],
        ['Dispatches, the dispatches table missing',"_msgOut=null;_msgBlockOut=false;_msgTableOk=null;"+fail('game_messages.select')+'refreshMessages(true)'],
        ['Dispatches, no one to write to',ok+fail('rpc.get_game_slots')
          +"_msgTableOk=true;initMessaging('G1',0,currentReport,null).then(()=>{ renderMessageThread();updateMsgComposer(); })"],
        ['Dispatches, no realm met yet',ok+'_msgRealms={};toggleMsgGroupPicker(true)'],
      ];
    }
    if(m.orders){
      // The page's short timers (a field rebuilt "once the DOM exists", the running account, the hire, raise and charm
      // cards) are queued and run in order at the end of each step, so no screen is caught halfway; longer ones are
      // dropped, as above. Each step runs to the end, timers included, before its screen is read.
      const timers="window.__kcQ=[];window.__kcN=0;"
        +"window.setTimeout=(f,ms,...a)=>{ if(ms>=1000) return 0; const id=++window.__kcN; window.__kcQ.push({f,a,ms:+ms||0,id}); return id; };"
        +"window.clearTimeout=id=>{ window.__kcQ=window.__kcQ.filter(t=>t.id!==id); };"
        +"window.__kcRun=()=>{ for(let r=0;r<20&&window.__kcQ.length;r++){ const q=window.__kcQ.splice(0).sort((x,y)=>x.ms-y.ms||x.id-y.id);"
        +" for(const t of q){ try{ if(typeof t.f==='function') t.f(...t.a); }catch(e){ console.error(String(e&&e.stack||e)); } } } };";
      const step=code=>`(async()=>{ ${code}; window.__kcRun(); })()`;
      const O=W.orders;
      const stage=(draft,extra)=>`Object.assign(${row},{turn_report:${lit(JSON.stringify(O.report))},orders:${lit(JSON.stringify(draft))},orders_submitted:false${extra||''}});`;
      // set one row's action as a player does: pick it, then the select's onchange
      const act=(cid,ph,a)=>`{ const s=document.getElementById(${lit(`po-action-${cid}-${ph}`)}); s.value=${lit(a)}; onActionChange(${lit(String(cid))},${ph},99); window.__kcRun(); }`;
      const val=(id,v)=>`document.getElementById(${lit(id)}).value=${lit(v)};`;
      const rebuild='buildOrdersForm(currentReport.characters,false,currentGamePlayer.orders,currentGamePlayer._liveTurn);window.__kcRun();';
      // Every order a hero can be given, a row at a time: in part k, a hero's j-th of R rows takes the (kR+j)th order its
      // own picker offers (its full list, which the page keeps while a once-a-turn order is out of the later rows). `only` picks the rows: the hire, raise and charm cards' (whose heroes' rows stay as they are,
      // so the cards stay), or the heroes' own.
      const every=(k,only)=>`{ const rows={}; document.querySelectorAll('#orders-form select[id^="po-action-"]').forEach(s=>{
          const m=s.id.match(/^po-action-(.+)-(\\d)$/); if(${only}.test(m[1])) (rows[m[1]]=rows[m[1]]||[]).push([s,m[1],Number(m[2])]); });
        Object.values(rows).forEach(list=>list.forEach(([s,cid,ph],j)=>{ const opts=JSON.parse(s.dataset.allOpts||'null')||[...s.options].map(o=>o.value).filter(Boolean);
          if(!opts.length) return; s.value=opts[(${k}*list.length+j)%opts.length]; onActionChange(cid,ph,99); window.__kcRun(); })); }`;
      const spells=list=>list.map((sp,ph)=>act(10,ph,'Cast Spell')+`onSpellChange('10',${ph},${lit(sp)});`).join('');
      const own={Pagan:'Perform Rite',Divine:'Consecrate',Good:'Call to Arms',Neutral:'Broker',Undead:'Harvest the Field'};
      return [
        ['the orders, a saved draft with hire, raise and charm cards',fixed+timers+step(stage(O.draft)+"await openReport('s10')")],
        ...Array.from({length:7},(_,k)=>[`every order on the hire, raise and charm cards, part ${k+1} of 7`,step(every(k,'/^(hired|resurrect|charm)_/'))]),
        ...Array.from({length:10},(_,k)=>[`every order, part ${k+1} of 10`,step(every(k,'/^\\d+$/'))]),
        ...Object.entries(own).map(([al,a])=>[`${/^[AEIOU]/.test(al)?'an':'a'} ${al} realm's own order`,
          step(`currentReport.kingdom.alignment=${lit(al)};${rebuild}${act(10,0,a)}`
            +(a==='Broker'?`${val('po-target-10-0','hire:40')}syncHiredHeroCard('10',0);`:''))]),
        ['spells and their targets, one',step(`currentReport.kingdom.alignment='Evil';${rebuild}`+spells(['Bless Province','Oratory','Phantasmal Armies','Clairvoyance','Control Undead']))],
        ['spells and their targets, two',step(spells(['Telekinetic Storm','Psychic Blast','Holy Symbol','Flood','Hide Lairs']))],
        ['a spell worked from an item, and lairs to ask about',step(act(10,0,'Use Item')+val('po-target-10-0','104')+"onSpellChange('10',0,'104');"
          +act(11,2,'Hunting Rumours')+"document.querySelectorAll('#po-rumour-wrap-11-2 input[type=checkbox]').forEach(b=>{ b.checked=true; });updateRumourTarget('11',2);")],
        ['a mastery order given twice, and a later move to re-check',step(act(10,1,'Sabotage')+act(10,0,'Sabotage')
          +act(10,2,'Move')+act(10,3,'Move')+val('po-target-10-2','prov:2')+"onMoveEdited('10',2);")],
        ['a body raised in Early Winter',step(act(10,2,'Rest')+act(10,3,'Rest')+act(10,4,'Cast Spell')+"onSpellChange('10',4,'Resurrect');"+val('po-extra-10-4','32')+"syncResurrectCard('10',4);")],
        ['the encounter plan\'s spell pickers',step("addEncounterTactic('10','CA');openPreSchoolPicker('10');"
          +`addEncounterTactic(${lit(O.pre.hire)},'CA');openPreSchoolPicker(${lit(O.pre.hire)});`)],
        ['a spell school chosen, and the heir\'s skills',step("confirmEPSchool('10','white');await allocateHeirSkill(10,'melee',1)")],
        ['submitting, with orders and a choice still to make',step("document.getElementById('po-action-12-1').value='';discoveryChoices={};await submitOrders()")],
        ['submitting, the turn has moved on',step(`supabase.stub.DB.games[0].turn=${lit(O.turnLater)};await doSubmitOrders()`)],
        ['submitting, refused by the database',step(`supabase.stub.DB.games[0].turn=${lit(O.turn)};${fail('game_players.update')}await doSubmitOrders()`)],
        ['submitted',step(ok+'await doSubmitOrders()')],
        // submitted from an older page: orders this one no longer lists show their Details
        ['the orders as submitted',step(stage(O.draft,',orders_submitted:true')+"await openReport('s10')")],
        ['revising the orders',step('await reviseOrders()')],
        ['a draft from an older turn set aside',step(stage({...O.draft,forTurn:O.staleTurn})+"await openReport('s10')")],
      ];
    }
    if(m.report){
      // the orders' running account redraws 120 ms after a change, so a screen could catch it before or after: its
      // timer runs at once instead
      const now="{ const st=window.setTimeout; window.setTimeout=(f,ms,...a)=>ms===120?(f(...a),0):st(f,ms,...a); }";
      // the Call the Reckoning control lives in the orders form; without it, a stand-in holds its place
      const wrap="if(!document.getElementById('reckoning-wrap')){ const d=document.createElement('div'); d.id='reckoning-wrap'; document.getElementById('report-titles').after(d); }";
      const titles=o=>`Object.assign(currentReport.titles,${lit(o)});renderTitles(currentReport);${wrap}renderReckoningOrders();`;
      const dip=`_renderDiplomacyInto(document.getElementById('report-diplomacy'),currentReport,true);`;
      return [
        ['the turn report and Chronicle',fixed+now+"openReport('s10')"],
        ['the Chronicle, every battle in full',"document.querySelectorAll('.bf-toggle').forEach(b=>b.click())"],
        ['diplomacy with its controls',"diploChoices={};"+dip],
        ['diplomacy, a declaration pending',"diploChoices={1:'enemy'};"+dip+"renderDiplomacy(currentReport)"],
        ['a past turn, an older saved report','loadPastReport(\'G1\',0,1)'],
        ['a past turn with no saved report of its own','loadPastReport(\'G1\',0,0)'],
        ['back to the current turn','diploChoices={};returnToCurrentReport()'],
        ['the Reckoning can be called',titles({canCallReckoning:true,callBlockedReason:null,myShare:.6})],
        ['the Reckoning, to be called with these orders','setReckoningCall(true)'],
        ['the Reckoning, your own realm too small',"setReckoningCall(false);"+titles({canCallReckoning:false,callBlockedReason:'callerShort',myOwnShare:.1,blocSize:2})],
        ['the Reckoning, the bloc short of the bar',titles({callBlockedReason:null,myShare:.3,blocSize:3})],
        ['the Reckoning called by a rival',titles({reckoning:{byName:W.R.rival,resolveAtTurn:12,mine:false}})+'renderReportView(currentReport)'],
        ['the game decided',`currentReport.titles.gameOver={winnerName:${lit(W.R.own)},winner:0,standings:currentReport.titles.standings};`
          +titles({reckoning:null})+`currentReport.lastTurnLog=currentReport.lastTurnLog.concat(${lit(W.gameEndLog)});renderReportView(currentReport)`],
        ['the report, its game unreadable',fail('games.select')+"openReport('s10')"],
        ['the report, its slot unreadable',ok+fail('game_players.select')+"openReport('s10')"],
      ];
    }
    const card="document.querySelector('#open-games-list .game-card').click()";
    const join=val('join-king-name',W.king)+val('join-kingdom-name',W.kingdom);
    return [
      ['my games, open games and the Game Master offer',fixed],
      ['archived games minimised','toggleArchivedGamesCard()'],
      ['the Game Master offer, accepting fails',fail('rpc.gm_accept_offer')+'acceptGmOffer()'],
      ['the Game Master offer, accepted',ok+'acceptGmOffer()'],
      ['my games, unreadable',fail('game_players.select')+'loadMyGames()'],
      ['my games, the games unreadable',ok+fail('games.select')+'loadMyGames()'],
      ['open games, unreadable','loadOpenGames()'],
      ['open games, read again',ok+'loadAllGames()'],
      ['the join form, from an open game\'s card',card],
      ['the join form, a skill chosen and described',"adjustSkill('archery',1);showSkillTip({clientX:20,clientY:20},'archery')"],
      ['joining with points unspent',"hideSkillTip();"+join+'joinGame()'],
      ['joining, the alignment taken',val('join-alignment','Divine')+'doJoinGame(joiningGame.id)'],
      ['joining, your slots unreadable',val('join-alignment','Neutral')+fail('game_players.select')+'doJoinGame(joiningGame.id)'],
      ['joining, the game\'s slots unreadable',ok+fail('rpc.get_game_slots')+'doJoinGame(joiningGame.id)'],
      ['joining refused by the database',ok+fail('game_players.insert')+'doJoinGame(joiningGame.id)'],
      ['joined',ok+'doJoinGame(joiningGame.id)'],
      ['joining a second time','doJoinGame(joiningGame.id)'],
      ['display name, the dialog',"show('sec-games');loadAllGames();changeDisplayName()"],
      ['display name, not saved',val('dn-name',W.newName)+fail('profiles.upsert')+'submitDisplayName()'],
      ['display name, failing',ok+`{ const f=sb.from; sb.from=function(t){ if(t==='profiles') throw new Error(${lit(W.error)}); return f.apply(this,arguments); };`
        +'submitDisplayName().finally(()=>{ sb.from=f; }); }'],
      ['display name, saved','submitDisplayName()'],
      ['change password, refused',`closeDisplayName();sb.auth.updateUser=async()=>({error:{message:${lit(W.error)}}});changePassword();`
        +val('cp-new',W.password)+val('cp-new2',W.password)+'submitChangePassword()'],
      ['change password, failed',`sb.auth.updateUser=async()=>{ throw new Error(${lit(W.error)}); };submitChangePassword()`],
    ];
  },
  shown:W=>{
    const D=W.db;
    return [W.error,W.newName,D.profiles[0].name,D.profiles[3].name,D.profiles[2].name,...D.games.slice(0,5).map(g=>g.name),D.games[0].turn,
      D.game_players[0].display_name,D.game_players[3].display_name,D.game_players[4].display_name,
      // the report and Chronicle: names, narrative, and the engine's strings, in the current and past turns
      ...Object.values(W.C),...Object.values(W.R),...Object.values(W.P),...Object.values(W.T),
      W.report.knownFeatures[0].name,W.report.knownFeatures[0].monster,W.report.discoveries[0].name,W.report.titles.gains[0].name,
      W.report.provinceEvents[0].text,W.report.spyActivity[0].lines[0].text,W.report.characters[0].items[0].desc,
      // the orders: provinces, rivals, wanderers, bodies, the hero for hire, units, items, lairs, research and Details
      ...W.orders.shown,
      // the map's popups and Dispatches
      ...W.map.shown,...W.dispatches.shown].filter(s=>typeof s==='string');
  },
};

const TOURS={leaderboard,overlord,gmPortal,playerPortal};

// Runs a tour's mode in jsdom against the site in `site` (a folder). visit(label, document, window) after each step.
async function runJsdom(tour,mode,W,visit,{site=SITE}={}){
  const m=tour.modes[mode], errs=[];
  // jsdom never fires the page's unhandledrejection: a promise the page leaves rejected reaches Node instead, which
  // would end the whole test. It's recorded as a page error, like any other.
  const rejected=e=>errs.push(String(e&&e.stack||e));
  process.on('unhandledRejection',rejected);
  try{
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
  }finally{ process.off('unhandledRejection',rejected); }
  return errs;
}

// The same in Chromium (Playwright `browser`), with the site served from one folder as deployed: `url`, a server that
// is already serving it (the browser specs' own), or else a server of `site` started here. visit(label, page).
async function runChromium(browser,tour,mode,W,visit,{site=SITE,url}={}){
  const m=tour.modes[mode], errs=[];
  const srv=url?null:await serve(site);
  const ctx=await browser.newContext();
  await routeExternal(ctx,tour.browserSupabase(W,m));
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(String(e.message||e)));
  p.on('console',x=>{ if(x.type()==='error'&&!/Failed to load resource/.test(x.text())) errs.push('console: '+x.text()); });
  await p.goto((url||srv.url)+'/'+tour.page+m.url,{waitUntil:'load'});
  await p.waitForTimeout(Math.max(600,tour.bootWait||0));
  for(const [label,code] of tour.steps(W,m)){
    try{ if(code) await p.evaluate(code); }catch(e){ errs.push(`${label}: ${e.message}`); }
    await p.waitForTimeout(300);   // long enough for a broken <img src=x> to fail and fire its onerror
    await visit(label,p);
  }
  await ctx.close(); if(srv) srv.close();
  return errs;
}

module.exports={TOURS,runJsdom,runChromium};
