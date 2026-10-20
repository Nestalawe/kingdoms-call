// One small finished game, built by hand, and its Hall of Fame entry checked value by value. Unit level: the record
// builder (buildGameRecords) is sliced out of the GM portal, as leaderboard-records does. The fuzz there checks that
// no input crashes the builder or yields a non-number; this checks that the right realm holds each record, with the
// right number and turn: every realm's own best (D-ruled 2026-10-09), best first, a realm whose best is 0 left out.
//
// Thornmere (realm 0) and Veyholt (realm 1), three turns; Thornmere wins.
//   gold       Thornmere 100, 250, 180    Veyholt 300, 120, 90
//   provinces  Thornmere   3,   5,   6    Veyholt   4,   4,  2
//   turn 2     Thornmere fights 2, wins 2, kills 5, loses 1; Veyholt fights 2, wins 0, kills 1, loses 5
const fs=require('fs'), vm=require('vm'); const {sourceFrom}=require('./lib/source.ts');
// The block is cut out of src/ui/gm/hall-of-fame.ts by its syntax tree (tests/lib/source.ts): its declarations from
// _LB_SEA through buildGameRecords. (Until plan P1-09a it was sliced out of the built GM portal between two lines.)
const src=sourceFrom('ui/gm/hall-of-fame.ts','_LB_SEA','buildGameRecords');

const ctx={console, KC_UNIT_CLASS:{sea:[],aerial:[],creature:[],monster:[],missile:[],cavalry:[],flying:[],carrier:[],primalSea:[],garrison:[],lightFoot:[],tamedFlyer:[]},
  UNIT_BASE_STR:{}, UNIT_Q_MULT:{}, GUARDIAN_POWER_RANK:{}, SKILL_LABELS:{}, TITLE_DEFS:[], KC_BUILD_STAMP:'test', KC_LB_V:1,
  kcClock:Object.assign(()=>Date.now(),{date:()=>new Date()}),   // the engine's clock (src/engine/clock.ts), not in the slice
  currentUser:{id:'gm-1'}, gameMetaOf:()=>null, computeStandings:()=>({titles:{}})};
vm.createContext(ctx); vm.runInContext(src,ctx);

const snap=(gold,provinces)=>({gold,provinces,chars:1,heroes:0,characters:[]});
const ev=(turn,pi,gold,prov,battles)=>({turn,player_index:pi,is_bot:false,realm:pi?'Veyholt':'Thornmere',
  post:snap(gold,prov),outcomes:battles?{battles:battles}:{}});
const events=[
  ev(1,0,100,3), ev(1,1,300,4),
  ev(2,0,250,5,{fought:2,won:2,unitsKilled:5,unitsLost:1,list:[]}), ev(2,1,120,4,{fought:2,won:0,unitsKilled:1,unitsLost:5,list:[]}),
  ev(3,0,180,6), ev(3,1,90,2)];
const results=[
  {game_id:'g1',game_name:'The Old War',player_index:0,is_bot:false,realm:'Thornmere',race:'Human',alignment:'Good',rank:1,score:140,winner:true,
   victory:'reckoning',turns:3,setup:{realms:2,humans:2,bots:0},final:snap(180,6)},
  {game_id:'g1',game_name:'The Old War',player_index:1,is_bot:false,realm:'Veyholt',race:'Dwarven',alignment:'Neutral',rank:2,score:60,winner:false,
   victory:'reckoning',turns:3,setup:{realms:2,humans:2,bots:0},final:snap(90,2)}];
const players=[{player_index:0,user_id:'u-ada',display_name:'Thornmere'},{player_index:1,user_id:'u-bram',display_name:'Veyholt'}];

const row=JSON.parse(JSON.stringify(ctx.buildGameRecords('g1',{id:'g1',name:'The Old War',gm_user_id:'gm-1',max_turns:12},players,results,events,null)));

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const list=k=>(row.records[k]||[]).map(e=>[e.pi,e.v,e.t===undefined?null:e.t].join(':')).join(' ');
const expect=(k,want,why)=>{ const got=list(k); check(got===want,`${k}: ${why} (want ${want||'none'}, got ${got||'none'})`); };

check(row.turns===3,'the game lasted three turns');
check(Array.isArray(row.standings)&&row.standings.length===2&&row.standings[0].realm==='Thornmere'&&row.standings[0].rank===1
  &&row.standings[0].winner===true&&row.standings[1].realm==='Veyholt'&&row.standings[1].rank===2,'standings: Thornmere first and the victor, Veyholt second');
check(row.standings[0].uid==='u-ada'&&row.standings[1].uid==='u-bram','each realm points at its player\'s account');
expect('richest','1:300:1 0:250:2','each realm\'s own best gold and when, best first');
expect('most_provinces','0:6:3 1:4:1','a tie later in the game keeps the turn it was first reached');
expect('battles_won_game','0:2:','a realm that won no battle holds no "battles won" entry');
expect('kills_game','0:5: 1:1:','units destroyed over the game, per realm');
expect('losses_game','1:5: 0:1:','units lost over the game, per realm');
expect('final_score','0:140:3 1:60:3','the final scores, at the last turn');
expect('final_gold','0:180:3 1:90:3','the gold each realm finished with');
check((row.records.shortest_game||[]).length===1&&row.records.shortest_game[0].v===3&&row.records.shortest_game[0].d==='min',
  'the game\'s length counts as a "shortest game" record (lower is better)');

process.exit(fails?1:0);
