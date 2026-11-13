// "Forget deleted games' data" forgets only games that no longer exist (P0-22). Page level (jsdom, the GM portal
// on the fake holding the GM's world (lib/fake-db.ts), which answers every statistics row as the Overlord's view does
// since P0-22). Two games still exist (the test GM's and another GM's) and one was deleted: signed in as the
// Overlord, who runs no game, or as the test GM, the button removes the deleted game's statistics and record,
// and nothing of the games that still exist.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The GM portal's "Forget deleted games' data" forgets only games with no `games` row, whoever runs them: signed in as
// the Overlord (who sees every game's statistics since P0-22) or a GM, the other games' statistics and Hall of Fame
// entries stay
const {readPage,bootJsdom,DB_VERSION}=require('./lib/boot'); const {aGameMastersWorld,makeAFakeDbHoldingTheGameMastersWorld}=require('./lib/fake-db.ts');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function run(who){
  const S=aGameMastersWorld();
  S.tables.site_admins.push({user_id:'ov1'});
  S.tables.profiles.push({id:'ov1',name:'Test Overlord'},{id:'gm2',name:'Other GM'});
  for(const [id,gm] of [['G-mine','gm1'],['G-other','gm2']])
    S.tables.games.push({id,name:'Game '+id,gm_user_id:gm,status:'active',turn:3,max_players:2,max_turns:0,created_at:'2026-10-01T00:00:00Z',meta:null,game_state:'{}'});
  for(const id of ['G-mine','G-other','G-gone']){
    S.tables.turn_events.push({id:'te-'+id,game_id:id,turn:1,player_index:0,realm:'Realm of '+id});
    S.tables.game_results.push({id:'gr-'+id,game_id:id,player_index:0,realm:'Realm of '+id});
    S.tables.game_records.push({id:'rec-'+id,game_id:id,game_name:'Game '+id,gm_user_id:'gm1'});
  }
  S.me=who;
  const errs=[];
  const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>({})},db:makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION,S).db,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=()=>{};
  }});
  const W=dom.window;
  await wait(900);
  await W.eval('openStats(true)'); await wait(100);
  await W.eval('forgetDeletedGames()'); await wait(100);
  const left=t=>S.tables[t].map(r=>r.game_id).sort().join(',');
  const label=who==='ov1'?'the Overlord':'a GM';
  check(left('turn_events')==='G-mine,G-other',`${label}: the deleted game's recorded turns go, the others stay (left: ${left('turn_events')})`);
  check(left('game_results')==='G-mine,G-other',`${label}: the same for results (left: ${left('game_results')})`);
  check(!S.tables.game_records.some(r=>r.game_id==='G-gone')&&S.tables.game_records.length===2,`${label}: and for the Hall of Fame (left: ${left('game_records')})`);
  W.close();
}

(async()=>{
  await run('ov1');
  await run('gm1');
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
