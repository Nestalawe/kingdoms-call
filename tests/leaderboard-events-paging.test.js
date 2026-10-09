// 2026-10-09 (Toby item 5) — a game's Hall-of-Fame record is built from EVERY turn_events row it has.
// writeGameRecord reads the rows 500 at a time ordered by turn alone, but there is one row per realm
// per turn, so the order of rows within a turn is the database's choice and may differ between page
// queries: rows at a page edge were skipped or read twice. A failed page was skipped silently and the
// record saved from whatever had arrived. Unit (level 1): writeGameRecord against a stub that serves
// the pages as a database may; buildGameRecords is swapped for a probe that keeps what it was given.
const {readPage,bootJsdom}=require('./lib/boot'); const {pagedEventsStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  // 8 realms × 90 turns = 720 rows: two pages, with the page edge in the middle of a turn.
  const events=[]; for(let t=1;t<=90;t++) for(let pi=0;pi<8;pi++) events.push({turn:t,player_index:pi,is_bot:false,realm:'Realm '+pi,outcomes:{}});
  const results=[{game_id:'g1',player_index:0}];
  async function run(errorFrom){
    const calls=[]; const errs=[];
    const d=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>pagedEventsStub({events,results,errorFrom,calls})},
      setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
        w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=()=>{}; }});
    await new Promise(r=>setTimeout(r,400)); const W=d.window;
    W.eval('_kcHasLb=true;');
    let got=null;
    W.buildGameRecords=(gid,gameRow,players,res,ev)=>{ got=ev.slice(); return {game_id:gid,standings:[],records:{}}; };
    const saved=await W.writeGameRecord('g1',{gameRow:{id:'g1'},players:[],gs:{players:[]}});
    return {saved,got,calls,errs,lastErr:W.eval('_kcLbLastErr')};
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
