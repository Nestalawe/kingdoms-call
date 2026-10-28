// 2026-10-09 (Toby item 5) — a game's Hall-of-Fame record is built from EVERY turn_events row it has.
// writeGameRecord reads the rows 500 at a time ordered by turn alone, but there is one row per realm
// per turn, so the order of rows within a turn is the database's choice and may differ between page
// queries: rows at a page edge were skipped or read twice. A failed page was skipped silently and the
// record saved from whatever had arrived. Unit (level 1): writeGameRecord against a stub that serves
// the pages as a database may. writeGameRecord and what it calls in its own file are cut out of
// src/ui/gm/hall-of-fame.ts by their syntax tree (tests/lib/source.ts) and run on their own, beside a probe in
// buildGameRecords' place that keeps what it was given. (Until plan P1-09a they ran on the booted GM portal, with its
// buildGameRecords stood in from outside, which a page of modules doesn't allow.)
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// A game's Hall-of-Fame record is built from every one of its turn rows, read in pages in a fixed order (none skipped
// or read twice); a page that fails stops the build, saves nothing and shows the error. `writeGameRecord` is cut out of
// `src/` by its syntax tree and run on its own (P1-09a: on the booted GM portal, `buildGameRecords` stood in from
// outside)
const vm=require('vm');
const {pagedEventsStub}=require('./lib/stub-db'); const {sourceOf}=require('./lib/source.ts');
const HOF='ui/gm/hall-of-fame.ts';
const CUT=sourceOf(HOF,['_kcHasLb','_kcLbLastErr','writeGameRecord','_lbProfCache','_lbProfErr','lbProfileNames','_lbTally','lbCountRow']);
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  // 8 realms × 90 turns = 720 rows: two pages, with the page edge in the middle of a turn.
  const events=[]; for(let t=1;t<=90;t++) for(let pi=0;pi<8;pi++) events.push({turn:t,player_index:pi,is_bot:false,realm:'Realm '+pi,outcomes:{}});
  const results=[{game_id:'g1',player_index:0}];
  async function run(errorFrom){
    const calls=[]; const errs=[];
    let got=null;
    const ctx=vm.createContext({console:{warn(){},log(){},error(){}},
      sb:pagedEventsStub({events,results,errorFrom,calls}),
      buildGameRecords:(gid,gameRow,players,res,ev)=>{ got=ev.slice(); return {game_id:gid,standings:[],records:{}}; },
      renderLeaderboardBanner(){}, parseGameState:()=>null});
    vm.runInContext(CUT+'\n_kcHasLb=true;',ctx);
    const saved=await vm.runInContext('writeGameRecord',ctx)('g1',{gameRow:{id:'g1'},players:[],gs:{players:[]}});
    return {saved,got,calls,errs,lastErr:vm.runInContext('_kcLbLastErr',ctx)};
  }
  const a=await run(null);
  ok(a.got&&a.got.length===events.length,`every turn_events row reaches the record builder (got ${a.got&&a.got.length} of ${events.length})`);
  const keys=new Set((a.got||[]).map(e=>e.turn+'/'+e.player_index));
  ok(keys.size===events.length,`no row is read twice and none is skipped (${keys.size} distinct of ${events.length})`);
  ok(a.saved===true&&a.calls.some(c=>c.table==='game_records'&&c.op==='upsert'),'the record is saved');

  const b=await run(500); // the second page fails
  ok(b.saved===false,'a failed page stops the build (writeGameRecord returns false)');
  ok(!b.calls.some(c=>c.table==='game_records'&&c.op==='upsert'),'…and no partial record is saved over the old one');
  ok(!!b.lastErr,'…and the failure is shown on the Hall-of-Fame banner (_kcLbLastErr is set)');
  const errs=[...a.errs,...b.errs];
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
