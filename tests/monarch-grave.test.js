// 2026-10-08 (item 1) — a fallen king's body is borne home at death and then STAYS there, even when
// the home province is captured later. The map, the Resurrect list and the bots' raise planner must
// all name that one province. (Before: the map showed the home, while the Resurrect list and the
// engine looked in the realm's wealthiest remaining province, so the body could never be raised.)
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage(GMF),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
      w.console.warn=()=>{};w.console.log=()=>{};}});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.buildTurnReport!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const setup=W.generateBotSetups([],3,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:12,rows:7},999,{seaPct:30});

  // Realm 0's king fell at home; realm 0 still holds a second, RICHER province; realm 1 then took the home.
  const home=W.homeProvinceIdFor(S,0);
  const king=S.characters.find(c=>c.player===0&&c.isKing);
  const other=S.world.provinces.find(p=>p.owner==null&&p.terrain!=='sea'&&p.id!==home);
  ok(home!=null&&king&&other,'staged world has a home, a king and a spare province');
  other.owner=0; other.tax=99; S.players[0].provinces=[home,other.id];
  king.alive=false; king.location=home;
  S.heroGraveyard=[{id:king.id,name:king.name,player:0,isKing:true,_monarch:true,killedOnTurn:S.turn,location:home,skills:{...(king.skills||{})}}];
  S.players[0]._resurrectableMonarchId=king.id; S.players[0].knownDeadHeroIds=[king.id];
  // ...and later the same turn the enemy captures the home.
  S.world.provinces[home].owner=1;
  S.players[0].provinces=[other.id]; S.players[1].provinces=[...(S.players[1].provinces||[]),home];

  const rep=W.buildTurnReport(S,0);
  const onMap=(rep.visibleDeadHeroes||rep.deadHeroesVisible||[]).find(g=>g.id===king.id)
           ||(Object.values(rep).find(v=>Array.isArray(v)&&v.some(x=>x&&x.id===king.id&&'inVisibleProv' in x))||[]).find(x=>x.id===king.id);
  const listed=(rep.knownDeadHeroes||[]).find(g=>g.id===king.id);
  const legacy=(rep.deadHeroes||[]).find(g=>g.id===king.id);
  ok(!!listed,'the fallen king is on the Resurrect list');
  ok(listed&&listed.locationId===home,`the Resurrect list puts the body in the captured home (${listed&&listed.locationId} vs home ${home})`);
  ok(listed&&listed.raisable===true,'and it is still raisable by its own realm');
  ok(!legacy||legacy.locationId===home,`the older deadHeroes list agrees (${legacy&&legacy.locationId})`);
  if(onMap) ok(onMap.locationId===home,'the map shows the body in the same place');

  const bot=W.botRaiseTargets(S,0).find(t=>t.g.id===king.id);
  ok(bot&&bot.loc===home,`a bot realm would march to the captured home to raise him (${bot&&bot.loc})`);
  ok(S.heroGraveyard[0].location===home,'nothing above moved the stored body');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
