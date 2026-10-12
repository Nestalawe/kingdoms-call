// The player portal sees other realms only through get_game_slots (P0-20, Unit B). Page level (jsdom, the
// in-memory database of lib/stub-db.js with P0-21's read rule switched on: a player reads only their own slot,
// the GM every slot of their game). Everything that needs other realms still works:
//   - My Games: "N of M realms have sent orders" (and the poll that keeps it current);
//   - Open games: how many players have joined;
//   - the join form: Divine/Undead already taken; the next free slot number (never a number already held);
//   - Dispatches: which realms are human;
// and no read ever asks for another realm's row. A join refused because someone took the number at the same
// moment says so (it isn't "you have already joined").
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const report=JSON.stringify({playerSetup:{alignment:'Neutral'}});
const setup=a=>JSON.stringify({playerSetup:{alignment:a},status:'joined'});

async function boot(stage){
  const S=makeStub();
  S.RULES.ownSlotsOnly=true;
  S.DB.profiles.push({id:'p1',name:'Test Player One'});
  S.setUser('p1');
  // G1: running, three human realms (two have sent orders) and a bot. G2: open, two realms joined, one Divine.
  S.DB.games.push(
    {id:'G1',name:'Marchwood',gm_user_id:'gm1',status:'active',turn:3,max_players:4,max_turns:0,created_at:'2026-10-11T00:00:00Z',
     meta:null,game_state:JSON.stringify({world:'hidden'})},
    {id:'G2',name:'Open Vale',gm_user_id:'gm1',status:'setup',turn:0,max_players:4,max_turns:12,created_at:'2026-10-11T00:00:00Z',
     meta:null,game_state:JSON.stringify({mapSize:'p4',botCount:0})});
  S.DB.game_players.push(
    {id:'s0',game_id:'G1',user_id:'p1',player_index:0,display_name:'Thornmere',orders_submitted:true, turn_report:report},
    {id:'s1',game_id:'G1',user_id:'p2',player_index:1,display_name:'Veyholt',  orders_submitted:true, turn_report:report},
    {id:'s2',game_id:'G1',user_id:'p4',player_index:2,display_name:'Harrowdale',orders_submitted:false,turn_report:report},
    {id:'s3',game_id:'G1',user_id:null,player_index:3,display_name:'Grimfast',  orders_submitted:false,turn_report:JSON.stringify({isBot:true})},
    {id:'s4',game_id:'G2',user_id:'p2',player_index:0,display_name:'Brightholm',orders_submitted:false,turn_report:setup('Divine')},
    {id:'s5',game_id:'G2',user_id:'p3',player_index:1,display_name:'Morrowgate',orders_submitted:false,turn_report:setup('Neutral')});
  if(stage) stage(S);
  const errs=[];
  const dom=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:S.supabase,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  await wait(900);
  return {S,W:dom.window,doc:dom.window.document,errs};
}
const text=(doc,id)=>(doc.getElementById(id)||{}).textContent||'';

(async()=>{
  {
    const {S,W,doc,errs}=await boot();
    check(/2 of 3\s*realms? have sent orders/.test(text(doc,'my-games-list')),
      'My Games: "2 of 3 realms have sent orders" (the bot not counted)'+` [${(text(doc,'my-games-list').match(/\d+ of \d+[^—]*/)||['none'])[0]}]`);
    check(/2\/4 players joined/.test(text(doc,'open-games-list')),
      'Open games: "2/4 players joined"'+` [${(text(doc,'open-games-list').match(/\d+\/\d+ players joined/)||['none'])[0]}]`);

    await W.eval('pollForUpdates()');
    check(true,'the poll runs');

    await W.eval(`showJoinGame('G2','Open Vale',4,2,'Test GM','4 realms')`); await wait(50);
    const divine=[...doc.getElementById('join-alignment').options].find(o=>o.value==='Divine');
    check(!!divine&&divine.disabled,'the join form marks Divine as taken');

    doc.getElementById('join-king-name').value='Aldric';
    doc.getElementById('join-alignment').value='Neutral';
    await W.eval(`doJoinGame('G2')`); await wait(50);
    const mine=S.DB.game_players.find(x=>x.game_id==='G2'&&x.user_id==='p1');
    check(!!mine,'joining works'+(mine?'':` (${text(doc,'join-msg').slice(0,120)})`));
    check(!!mine&&mine.player_index===2,`and takes the next free number, 2 (got ${mine&&mine.player_index})`);

    const roster=await W.eval(`loadMessageRoster('G1',{diplomacy:{known:[{index:1,name:'Veyholt'},{index:2,name:'Harrowdale'},{index:3,name:'Grimfast'}]}})`);
    check(roster&&roster.humans===3&&roster.total===4,`Dispatches: 3 human realms of 4 (got ${JSON.stringify(roster)})`);
    check(W.eval('msgContacts().map(r=>r.index).join()')==='1,2','and the human rivals met are the ones to write to');

    const other=S.CALLS.filter(c=>c==='game_players.select:other').length;
    check(other===0,`no read asks for another realm's row (${other} did)`);
    check(!errs.length,'no page errors'+(errs.length?': '+errs[0].split('\n')[0]:''));
    W.close();
  }

  // Someone takes number 2 between the form reading the free numbers and the join being written.
  {
    const {S,W,doc,errs}=await boot();
    await W.eval(`showJoinGame('G2','Open Vale',4,2,'Test GM','4 realms')`); await wait(50);
    S.DB.game_players.push({id:'s6',game_id:'G2',user_id:'p4',player_index:2,display_name:'Lateholm',orders_submitted:false,turn_report:setup('Neutral')});
    doc.getElementById('join-king-name').value='Aldric';
    doc.getElementById('join-alignment').value='Neutral';
    // the form reads the free numbers just before writing: serve that read from before the other join
    W.eval(`(function(){ const real=sb.rpc.bind(sb); sb.rpc=(fn,a)=>fn==='get_game_slots'
      ? real(fn,a).then(r=>({...r,data:(r.data||[]).filter(x=>!(x.game_id==='G2'&&x.player_index===2))})) : real(fn,a); })()`);
    await W.eval(`doJoinGame('G2')`); await wait(50);
    const msg=text(doc,'join-msg');
    check(!S.DB.game_players.some(x=>x.game_id==='G2'&&x.user_id==='p1'),'a join on a number just taken is refused');
    check(/same moment/i.test(msg)&&!/already joined/i.test(msg),`and says another player joined at the same moment (got "${msg.slice(0,100)}")`);
    check(!errs.length,'no page errors'+(errs.length?': '+errs[0].split('\n')[0]:''));
    W.close();
  }

  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
