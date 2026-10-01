// claude_leaderboard_0927.js — shape + fuzz harness for the Hall-of-Fame record builder.
// Slices buildGameRecords and its helpers out of the real GM portal, runs them in a sandbox with
// stub engine tables, and hammers them with malformed telemetry. The builder runs inside the turn
// path (writeTurnTelemetry → writeGameRecord), so it must never throw and must always produce a
// JSON-serialisable row.
const fs=require('fs'), vm=require('vm'); const {sitePath}=require('./lib/boot');
const html=fs.readFileSync(process.argv[2]||sitePath('kingdoms-call-gm-portal.html'),'utf8');
const from=html.indexOf('const _LB_SEA=new Set(');
const to=html.indexOf('// Fetch this game\'s turn_events');
if(from<0||to<0||to<from){ console.log('FAIL: could not slice the leaderboard block'); process.exit(1); }
const src=html.slice(from,to);

const ctx={
  console,
  KC_UNIT_CLASS:{sea:['Galleons','Whale Cohort'],aerial:['Rocs','Dragons','Eagle Riders'],creature:['Rocs','Wolves'],
    monster:['Dragons','Manticores'],missile:['Archers','Crossbowmen'],cavalry:['Heavy Horse','Light Horse'],
    flying:['Eagle Riders'],carrier:['Galleons'],primalSea:['Whale Cohort'],garrison:[],lightFoot:[],tamedFlyer:[]},
  UNIT_BASE_STR:{Archers:6,'Heavy Horse':9,Galleons:12,Dragons:40,Rocs:18,'Whale Cohort':15,Levies:4},
  UNIT_Q_MULT:{Green:1.5,Average:2,Veteran:2.5,Elite:3},
  GUARDIAN_POWER_RANK:{'':0,Weak:1,Moderate:2,Powerful:3,Legendary:4},
  SKILL_LABELS:{melee:'Melee',archery:'Archery',tactical:'Tactical',white:'White Magic',thief:'Thief'},
  TITLE_DEFS:[{key:'throne',name:'The Throne'},{key:'sword',name:'Sword of the Realm'},{key:'vault',name:'Vaultkeeper'}],
  KC_BUILD_STAMP:'test', KC_LB_V:1,
  currentUser:{id:'gm-1'},
  gameMetaOf:()=>null,
  computeStandings:(gs)=>({titles:{throne:{playerIndex:0,merit:42,charId:1},sword:{playerIndex:1,merit:17,charId:2}}}),
};
vm.createContext(ctx);
vm.runInContext(src,ctx);
const build=ctx.buildGameRecords;

// ── deterministic RNG so a failure can be reproduced ────────────────────────────────────────────
let seed=12345; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
const pick=a=>a[Math.floor(rnd()*a.length)];
const maybe=(v,p)=>rnd()<(p==null?0.15:p)?pick([null,undefined,NaN,'',{},[],'nonsense']):v;

const TYPES=['Archers','Heavy Horse','Galleons','Dragons','Rocs','Whale Cohort','Levies','Unknown Unit'];
const QUALS=['Green','Average','Veteran','Elite',null,'Bogus'];
const POWERS=['Weak','Moderate','Powerful','Legendary',null,''];
const RACES=['Human','Elven','Dwarven','Orcish',null];
const ALIGNS=['Divine','Good','Evil','Druidic',null];

function mkSnapshot(nChars){
  const chars=[];
  for(let i=0;i<nChars;i++){
    const units=[]; const n=Math.floor(rnd()*9);
    for(let u=0;u<n;u++) units.push({t:maybe(pick(TYPES)),q:maybe(pick(QUALS)),...(rnd()<0.2?{sk:1}:{})});
    const skills={}; ['melee','archery','tactical','white','thief'].forEach(k=>{ if(rnd()<0.6) skills[k]=Math.floor(rnd()*10); });
    chars.push({id:i,name:maybe('Hero '+i,0.1),king:i===0,hp:Math.floor(rnd()*40),maxHp:Math.floor(rnd()*60),
      skills:maybe(skills,0.1),units:maybe(units,0.08),items:maybe(['Ring','Blade'].slice(0,Math.floor(rnd()*3)),0.1)});
  }
  return {gold:Math.floor(rnd()*900),provinces:Math.floor(rnd()*20),land:Math.floor(rnd()*15),sea:Math.floor(rnd()*6),
    tax:Math.floor(rnd()*60),taxShare:Math.round(rnd()*1000)/10,chars:nChars,heroes:nChars-1,
    ledUnits:Math.floor(rnd()*30),ledStr:Math.floor(rnd()*400),garUnits:Math.floor(rnd()*20),garStr:Math.floor(rnd()*200),
    units:Math.floor(rnd()*50),str:Math.floor(rnd()*600),items:Math.floor(rnd()*9),relics:Math.floor(rnd()*3),
    discoveries:Math.floor(rnd()*12),consecrated:Math.floor(rnd()*4),explored:Math.floor(rnd()*40),
    characters:maybe(chars,0.06)};
}
function mkOutcomes(pi,nPlayers){
  const battles=[]; const nb=Math.floor(rnd()*4);
  for(let i=0;i<nb;i++){
    const atk=rnd()<0.5;
    battles.push({ph:Math.floor(rnd()*5),prov:Math.floor(rnd()*80),terrain:pick(['plains','forest','sea',null]),
      kind:pick(['pvp','neutral','garrison','guard']),atkPi:atk?pi:Math.floor(rnd()*nPlayers),defPi:atk?Math.floor(rnd()*nPlayers):pi,
      atkStr:maybe(Math.floor(rnd()*300),0.1),defStr:maybe(Math.floor(rnd()*300),0.1),S:rnd(),
      atkUnits:Math.floor(rnd()*12),defUnits:Math.floor(rnd()*12),won:rnd()<0.5,
      atkLost:Math.floor(rnd()*6),defLost:Math.floor(rnd()*6),carry:Math.floor(rnd()*3),
      side:atk?'atk':'def',win:rnd()<0.5});
  }
  const enc=[]; for(let i=0;i<Math.floor(rnd()*3);i++) enc.push({ph:0,pi,charId:Math.floor(rnd()*4),prov:1,
    feature:maybe('A lair'),guardian:maybe('Wyrm'),power:pick(POWERS),won:rnd()<0.6,fled:rnd()<0.2,
    dmg:Math.floor(rnd()*30),hpAfter:Math.floor(rnd()*30),killed:rnd()<0.1,tactics:['ME']});
  const caps=[]; for(let i=0;i<Math.floor(rnd()*3);i++) caps.push({prov:i,terrain:pick(['plains','sea',null]),tax:Math.floor(rnd()*9),from:Math.floor(rnd()*nPlayers),to:pi});
  const deaths=[]; for(let i=0;i<Math.floor(rnd()*3);i++) deaths.push({charId:i,name:'X',pi:Math.floor(rnd()*nPlayers),king:rnd()<0.2,killerPi:pi,killerId:Math.floor(rnd()*4),how:'character'});
  const spells=[]; for(let i=0;i<Math.floor(rnd()*4);i++) spells.push({pi,charId:1,spell:pick(['Fireball','Curse','Resurrect',null]),school:'Elemental',lvl:Math.floor(rnd()*6),chance:Math.floor(rnd()*100),ok:rnd()<0.6});
  return {battles:maybe({fought:nb,asAttacker:1,won:1,unitsLost:Math.floor(rnd()*9),unitsKilled:Math.floor(rnd()*9),list:battles},0.05),
    encounters:{fought:enc.length,won:enc.filter(e=>e.won).length,fled:0,heroKilled:0,list:maybe(enc,0.05)},
    captures:{gained:caps.length,lost:Math.floor(rnd()*3),list:caps},
    deaths:{own:Math.floor(rnd()*2),king:false,killed:deaths.length,list:deaths},
    spells:{cast:spells.length,ok:spells.filter(s=>s.ok).length,list:spells},
    delta:maybe({gold:Math.floor(rnd()*200-100),provinces:1,tax:2,units:1,str:Math.floor(rnd()*80-20),heroes:0,items:0,discoveries:0,explored:1},0.08),
    rank:1,score:Math.floor(rnd()*300)};
}
function mkGame(i){
  const n=2+Math.floor(rnd()*7), turns=1+Math.floor(rnd()*22);
  const results=[]; for(let pi=0;pi<n;pi++) results.push({game_id:'g'+i,game_name:'Game '+i,player_index:pi,
    is_bot:rnd()<0.5,bot_difficulty:'hard',realm:'Realm '+pi,race:pick(RACES),alignment:pick(ALIGNS),
    rank:pi+1,score:Math.floor(rnd()*400),winner:pi===0,victory:pick(['reckoning','elimination','concession']),
    turns,out_turn:rnd()<0.3?Math.floor(rnd()*turns)+1:null,out_how:rnd()<0.3?'eliminated':null,
    setup:maybe({mapSize:'p5',cols:12,rows:7,seaPct:35,realms:n,bots:2,humans:n-2,difficulty:'hard',diplomacy:pick(['normal','hostile'])},0.1),
    final:maybe(mkSnapshot(1+Math.floor(rnd()*3)),0.1),created_at:new Date(Date.now()-i*86400000).toISOString()});
  const events=[];
  for(let t=1;t<=turns;t++) for(let pi=0;pi<n;pi++){
    if(rnd()<0.03) continue;
    events.push({turn:t,player_index:pi,is_bot:rnd()<0.5,realm:'Realm '+pi,race:pick(RACES),alignment:pick(ALIGNS),
      post:maybe(mkSnapshot(1+Math.floor(rnd()*4)),0.07),outcomes:maybe(mkOutcomes(pi,n),0.07)});
  }
  const players=[]; for(let pi=0;pi<n;pi++) players.push({player_index:pi,user_id:rnd()<0.5?'u'+pi:null,display_name:rnd()<0.8?'Player '+pi:null});
  const gameRow=rnd()<0.85?{id:'g'+i,name:'Game '+i,gm_user_id:'gm-1',created_at:new Date().toISOString(),max_turns:20}:null;
  const gs=rnd()<0.7?{players:new Array(n).fill(0).map(()=>({})),characters:[{id:1,name:'Aldric'},{id:2,name:'Bryn'}],
    botDiplomacy:pick(['normal','hostile']),botDifficulty:'hard',world:{cols:12,rows:7}}:null;
  return {id:'g'+i,gameRow,players,results,events,gs};
}

let crashes=0, bad=0, rows=0, keySeen=new Set();
const N=Number(process.env.N||3000);
for(let i=0;i<N;i++){
  const g=mkGame(i);
  let row;
  try{ row=build(g.id,g.gameRow,g.players,g.results,g.events,g.gs); }
  catch(e){ crashes++; if(crashes<4) console.log('CRASH seed-step '+i+': '+e.message+'\n'+e.stack.split('\n')[1]); continue; }
  if(!row){ bad++; console.log('NULL ROW at '+i); continue; }
  rows++;
  let json;
  try{ json=JSON.stringify(row); }catch(e){ bad++; console.log('NOT SERIALISABLE at '+i); continue; }
  const m=json.match(/.{0,80}(NaN|Infinity|undefined).{0,80}/);
  if(m){ bad++; if(bad<6) console.log('BAD VALUE at '+i+': …'+m[0]+'…'); }
  if(!Array.isArray(row.standings)||!row.standings.length){ bad++; console.log('NO STANDINGS at '+i); }
  if(row.turns==null||!isFinite(row.turns)){ bad++; console.log('BAD TURNS at '+i); }
  Object.entries(row.records).forEach(([k,r])=>{
    keySeen.add(k);
    if(r.v==null||!isFinite(r.v)){ bad++; console.log('BAD RECORD '+k+' at '+i); }
    if(r.d!=='min'&&r.d!=='max'){ bad++; console.log('BAD DIR '+k+' at '+i); }
  });
}
// empty-input guards
const guards=[[null,null,[],[],[],null],['g',null,[],[],[],null],['g',{},[],[{game_id:'g',player_index:0,turns:1,setup:{},final:{}}],[],null]];
let guardFail=0;
guards.forEach((a,i)=>{ try{ build(...a); }catch(e){ guardFail++; console.log('GUARD '+i+' threw: '+e.message); } });

console.log(`\nrows built: ${rows} / ${N}   crashes: ${crashes}   shape failures: ${bad}   guard failures: ${guardFail}`);
console.log(`distinct record keys produced: ${keySeen.size}`);
console.log([...keySeen].sort().join(' '));
process.exit(crashes+bad+guardFail?1:0);
