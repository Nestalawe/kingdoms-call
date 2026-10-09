// 2026-10-09 (Toby item 5) — what a finished game puts on the Hall of Fame, and how a player finds it.
//   · every realm's own best for each record is kept, not only the game's single best;
//   · a hero who fell in a turn still counts for the peaks he reached that turn (post.fallen);
//   · an Imperial Title held for some turns and then lost is still recorded (post.titles);
//   · on the board, searching for a realm shows that realm's own entries in every list.
// Unit (level 1) on the real builder sliced out of the GM portal, then a page render (level 4, jsdom)
// of the real leaderboard from the rows it built. Made-up realms and heroes.
const fs=require('fs'), vm=require('vm'); const {sitePath,readPage,bootJsdom}=require('./lib/boot'); const {leaderboardStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const html=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
const src=html.slice(html.indexOf('const _LB_SEA=new Set('), html.indexOf("// Fetch this game's turn_events"));
const ctx={console, KC_LB_V:3, KC_BUILD_STAMP:'test', currentUser:{id:'gm-1'}, gameMetaOf:()=>null,
  KC_UNIT_CLASS:{sea:[],aerial:[],creature:[],monster:[],missile:[],cavalry:[],flying:[],carrier:[],primalSea:[],garrison:[],lightFoot:[],tamedFlyer:[]},
  UNIT_BASE_STR:{Levies:4}, UNIT_Q_MULT:{Average:2}, GUARDIAN_POWER_RANK:{'':0},
  SKILL_LABELS:{melee:'Melee'}, TITLE_DEFS:[{key:'throne',name:'The Throne'}],
  computeStandings:()=>({titles:{throne:{playerIndex:0,merit:42,charId:1}}})};
vm.createContext(ctx); vm.runInContext(src,ctx);

const realm=pi=>['Realm Ashvale','Realm Brindmoor'][pi];
const results=[0,1].map(pi=>({game_id:'g1',game_name:'The Test War',player_index:pi,is_bot:false,realm:realm(pi),race:'Human',alignment:'Good',
  rank:pi+1,score:100-pi*40,winner:pi===0,victory:'reckoning',turns:3,setup:{realms:2,humans:2,bots:0,cols:9,rows:7,seaPct:30},
  final:{provinces:5,characters:[]},created_at:'2026-10-01T00:00:00Z'}));
const battle=(atkPi,defPi,a,d)=>({prov:1,terrain:'plains',kind:'pvp',atkPi,defPi,atkStr:a,defStr:d,atkLost:1,defLost:1,carry:0,side:'atk',win:true});
const ev=(turn,pi,post,out)=>({turn,player_index:pi,is_bot:false,realm:realm(pi),post:{provinces:3,characters:[],...post},outcomes:out||{}});
const events=[
  ev(1,0,{},{battles:{fought:1,won:1,list:[battle(0,1,300,200)]}}),          // realm 0: a 500-strong battle
  ev(1,1,{},{battles:{fought:1,won:1,list:[battle(1,0,120,80)]}}),           // realm 1: a 200-strong one
  ev(2,1,{fallen:[{id:7,name:'Sir Fallowmere',fell:1,hp:0,maxHp:88,skills:{melee:9},units:[],items:[]}],
          titles:[{key:'throne',merit:30,who:'Lady Earlwick'}]}),
  ev(3,1,{characters:[{id:8,name:'Squire Low',maxHp:20,skills:{melee:2},units:[],items:[]}]}),
];
const players=[0,1].map(pi=>({player_index:pi,user_id:'u'+pi,display_name:realm(pi)}));
const row=ctx.buildGameRecords('g1',{id:'g1',name:'The Test War',gm_user_id:'gm-1',created_at:'2026-09-20T00:00:00Z'},players,results,events,
  {players:[{},{}],characters:[{id:1,name:'King Ash'}],world:{cols:9,rows:7}},{u0:'Player One',u1:'Player Two'});
const R=row.records||{};
const list=k=>Array.isArray(R[k])?R[k]:[];
const of=(k,pi)=>list(k).find(e=>e&&e.pi===pi);
ok(Array.isArray(R.biggest_battle),'a record holds a list of entries, one per realm');
ok(of('biggest_battle',0)&&of('biggest_battle',0).v===500,'realm 0 keeps its 500-strong battle');
ok(of('biggest_battle',1)&&of('biggest_battle',1).v===200,'realm 1 keeps its own 200-strong battle, though realm 0 had a bigger one');
ok(list('biggest_battle')[0]&&list('biggest_battle')[0].pi===0,'the list is best first');
ok(of('sk_melee',1)&&of('sk_melee',1).v===9&&of('sk_melee',1).who==='Sir Fallowmere','a hero who fell that turn still counts for his Melee 9');
ok(of('hardiest',1)&&of('hardiest',1).v===88,'…and for his 88 maximum HP');
ok(of('title_throne',1)&&of('title_throne',1).v===30,'a title held for a turn and lost is recorded for its holder');
ok(of('title_throne',0)&&of('title_throne',0).v===42,'…as is the holder at the end of the game');

(async()=>{
  const errs=[];
  const dom=bootJsdom(readPage('kingdoms-call-leaderboard.html'),{pretendToBeVisual:false,url:'https://example.test/kingdoms-call-leaderboard.html',
    supabase:{createClient:()=>leaderboardStub({rows:()=>[JSON.parse(JSON.stringify(row))],calls:[],signedIn:false,isGm:false})},
    setup(w){ w.addEventListener('error',e=>errs.push(e.message)); w.console.error=(...a)=>errs.push(a.join(' ')); }});
  await new Promise(r=>setTimeout(r,400));
  const w=dom.window, d=w.document;
  const lists=()=>{ w.setTab('achievements'); return [...d.querySelectorAll('#body .ach')].map(a=>({t:a.querySelector('.t').textContent,
    items:[...a.querySelectorAll('li')].map(li=>li.textContent)})); };
  let L=lists();
  const big=L.find(a=>/battle/i.test(a.t)&&a.items.some(t=>/500/.test(t)));
  ok(big&&big.items.some(t=>/Brindmoor/.test(t)),'the board lists both realms\' battles in the same game');
  d.getElementById('f-q').value='Brindmoor'; w.render();
  L=lists();
  const all=L.flatMap(a=>a.items);
  ok(all.length>0&&all.every(t=>/Brindmoor/.test(t)),`searching a realm shows only its own entries (${all.filter(t=>!/Brindmoor/.test(t)).length} others shown)`);
  ok(L.some(a=>a.items.some(t=>/Fallowmere/.test(t))),'…including the fallen hero\'s Melee');
  ok(/Showing only the realms and players matching your search/.test(d.getElementById('body').innerHTML),'the board says the lists are narrowed to the search');
  errs.forEach(e=>{ fail++; console.log('  ! page error: '+e); });
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
