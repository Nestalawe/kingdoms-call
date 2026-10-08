// 2026-10-08 (item 6) — what movement points a march costs.
//   (A) Marching into an UNDEFENDED enemy province costs 1 point, like any other step (was 2).
//   (B) A battle against neutral defenders that carries on into the next phase costs 1 point a
//       phase if the attacker has one left — the same as a carry-on battle against another realm
//       (was free). It is fought anyway when none are left.
// The point pools live inside runTurn; the hook placed just after their declaration hands them back.
// Each case runs one real turn with two human realms whose every other order is Rest.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html';
let html=readPage(GMF);
const inj=(a,b)=>{ if(html.split(a).length!==2) throw new Error('anchor not unique or missing: '+a.slice(0,60)); html=html.replace(a,b); };
inj("  const seaMovePoints={};     // separate sea move point pool (REMAINING this turn)\n",
  "  const seaMovePoints={};     // separate sea move point pool (REMAINING this turn)\n  window.__MV={get mp(){ return movePoints; }, get max(){ return moveMax; }};\n");
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
let ROWS={}; const WRITES=[];
(async()=>{
  const errs=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
      w.console.warn=()=>{};w.console.log=()=>{};}});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.runTurn!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }

  // A two-realm world; realm 0's king (with his army) stands at home, beside a land province N.
  async function stage(prepare){
    const setup=W.generateBotSetups([],2,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    const S=await W.generateNewGame(setup,{cols:10,rows:6},999,{seaPct:20});
    S.safeStart=false;
    const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
    const home=S.world.provinces[king.location];
    const N=W.getNeighborsP(home,10,6,S.world.provinces).find(p=>p&&p.terrain!=='sea'&&p.owner==null);
    if(N){ // an empty province: no lair or ruin to stumble into, and its neutral guard sent away
      N.features=[]; const gone=new Set(N.characters||[]);
      S.characters=S.characters.filter(c=>!gone.has(c.id)||c.player!=null); N.characters=[];
      N.neutralDefenders=[]; N.npcArmies=0; }
    prepare(S,king,home,N);
    const orders={};
    S.characters.filter(c=>c.alive).forEach(c=>{ orders[c.id]=[0,1,2,3,4].map(()=>({action:'rest',target:'',extra:'',desc:''})); });
    if(S._kingOrders) orders[king.id]=S._kingOrders; delete S._kingOrders;
    const payload=pi=>{ const o={}; S.characters.filter(c=>c.alive&&c.player===pi).forEach(c=>{ o[c.id]=orders[c.id]; });
      return JSON.stringify({orders:o,encounterPlans:{},kingSkills:{},diplomacy:{},discoveryChoices:{},callReckoning:false,concede:false,messages:[],heroOrder:[],forTurn:S.turn}); };
    const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:'u'+sp.id,player_index:sp.id,display_name:sp.name,orders:payload(sp.id),orders_submitted:true,turn_report:JSON.stringify({})}));
    ROWS={games_one:{id:'gm',name:'T',turn:S.turn,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
    W.eval(`currentGame={id:'gm',turn:${S.turn},status:'active',name:'T'};`); WRITES.length=0;
    await W.runTurn(); await new Promise(r=>setTimeout(r,10));
    const w=[...WRITES].reverse().find(x=>x.table==='games'&&x.val&&x.val.game_state);
    return {S2:w?JSON.parse(w.val.game_state):null, king, N, used:W.__MV.max[king.id]-W.__MV.mp[king.id], max:W.__MV.max[king.id]};
  }

  // (A) an undefended enemy province
  let r=await stage((S,king,home,N)=>{
    ok(!!N,'found a free land province beside the capital');
    ok((king.armies||[]).length>0,'the king leads an army');
    N.owner=1; S.players[1].provinces=[...(S.players[1].provinces||[]),N.id];
    N.neutralDefenders=[]; N.npcArmies=0; N.garrisonArmies=[]; N.garrison=[]; delete N._leaderlessDefenders;
    S.relations=S.relations||{}; S.relations['0-1']='enemy';
    S._kingOrders=[{action:'move',target:String(N.id),extra:'',desc:''},...[1,2,3,4].map(()=>({action:'rest',target:'',extra:'',desc:''}))];
  });
  ok(r.S2&&r.S2.world.provinces[r.N.id].owner===0,'(A) the king took the undefended enemy province');
  ok(r.used===1,`(A) it cost 1 movement point (used ${r.used} of ${r.max})`);

  // (B) a battle against a leaderless neutral garrison, already joined and carrying on
  r=await stage((S,king,home,N)=>{
    N.owner=null; N._battleUnresolved=true; N._leaderlessDefenders=true;
    N.neutralDefenders=[{type:'Heavy Infantry',quality:'Elite',unitName:'Old Guard I'},{type:'Heavy Infantry',quality:'Elite',unitName:'Old Guard II'}];
    N.npcArmies=2;
    home.characters=(home.characters||[]).filter(id=>id!==king.id); N.characters=[...(N.characters||[]),king.id]; king.location=N.id;
  });
  ok(r.used>=1,`(B) pressing on against neutral defenders costs a movement point (used ${r.used} of ${r.max})`);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
