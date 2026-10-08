// tests/lib/scenario.js: run one real turn on a small staged world, for scenario (level 2) tests.
//
//   const sc=await bootScenario({inject:[[anchor,replacement],…]});
//   const r=await sc.turn({realms:2, prepare(S,W){…}, orders:{[charId]:[o0,o1,o2,o3,o4]}});
//   r.S      the world as staged (before the turn)      r.S2   the world as saved after the turn
//   r.log    the GM's full log for the turn ({type,text,actor,targets,charId,phase,…} entries)
//   r.reports[playerIndex]   each human realm's turn report, as the player portal receives it
//   r.text(charId?)   every log line (or one character's lines) as one string, for matching
//
// Every realm is human-held (so no bot plans for it) unless listed in `bots`; every living
// character not given orders Rests all turn. `inject` adds lines at exact anchors in the GM portal
// (see tests/README.md, code-anchor hooks): each anchor must appear exactly once.
const {readPage,bootJsdom}=require('./boot'); const {cannedStub}=require('./stub-db');

async function bootScenario(opts={}){
  let html=readPage(opts.page||'kingdoms-call-gm-portal.html');
  for(const [a,b] of (opts.inject||[])){
    if(html.split(a).length!==2) throw new Error('anchor not unique or missing: '+a.slice(0,70));
    html=html.replace(a,()=>b);
  }
  let ROWS={}; const WRITES=[]; const errs=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.runTurn!=='function') throw new Error('GM portal did not boot: '+errs.slice(0,2).join(' | '));
  const rest=()=>[0,1,2,3,4].map(()=>({action:'rest',target:'',extra:'',desc:''}));

  // A fresh world: `realms` realms on a cols×rows map; safe start off; then prepare(S,W) edits it.
  async function world({realms=2,cols=10,rows=6,seaPct=20}={}){
    const setup=W.generateBotSetups([],realms,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols,rows},999,{seaPct});
    S.safeStart=false;
    return {S,setup};
  }
  async function turn({realms=2,cols=10,rows=6,seaPct=20,bots=[],prepare,orders={}}={}){
    const {S,setup}=await world({realms,cols,rows,seaPct});
    const extra=prepare?prepare(S,W):null;
    const ord=(typeof orders==='function')?orders(S,extra):orders;
    const all={};
    S.characters.filter(c=>c.alive&&c.player!=null).forEach(c=>{ all[c.id]=ord[c.id]||rest(); });
    const payload=pi=>{ const o={}; S.characters.filter(c=>c.alive&&c.player===pi).forEach(c=>{ o[c.id]=all[c.id]; });
      return JSON.stringify({orders:o,encounterPlans:{},kingSkills:{},diplomacy:{},discoveryChoices:{},callReckoning:false,concede:false,messages:[],heroOrder:[],forTurn:S.turn}); };
    const players=setup.map(sp=>{ const bot=bots.includes(sp.id);
      return {id:sp.gamePlayerId,user_id:bot?null:'u'+sp.id,player_index:sp.id,display_name:sp.name,
        orders:bot?null:payload(sp.id),orders_submitted:!bot,turn_report:JSON.stringify(bot?{isBot:true}:{})}; });
    ROWS={games_one:{id:'gs',name:'T',turn:S.turn,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
    W.eval(`currentGame={id:'gs',turn:${S.turn},status:'active',name:'T'};`); WRITES.length=0;
    const before=JSON.parse(JSON.stringify(S));
    await W.runTurn(); await new Promise(r=>setTimeout(r,10));
    const w=[...WRITES].reverse().find(x=>x.table==='games'&&x.val&&x.val.game_state);
    const lg=WRITES.find(x=>x.table==='turn_logs'&&x.val&&x.val.player_index===-1);
    const log=(lg&&lg.val.entries)||[];
    const reports={}; WRITES.filter(x=>x.table==='turn_logs'&&x.val&&x.val.player_index>=0).forEach(x=>{ reports[x.val.player_index]=x.val.entries; });
    return {S:before, S2:w?JSON.parse(w.val.game_state):null, log, reports, extra,
      text:(charId)=>log.filter(e=>charId==null||e.charId===charId||(e.charIds||[]).includes(charId)).map(e=>e.text).join('\n')};
  }
  return {W, errs, world, turn, rest};
}

// Helpers for staging.
const order=(action,target='',extra='')=>({action,target:String(target),extra:String(extra),desc:''});
const restOrder=()=>order('rest');
// Five orders: the given ones first, then Rest.
const plan=(...os)=>{ const out=os.slice(0,5); while(out.length<5) out.push(restOrder()); return out; };

module.exports={bootScenario, order, restOrder, plan};
