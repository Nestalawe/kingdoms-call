// The turn report tells a realm that it is out (P0-25, ruling R-075). Scenario level (one real turn on a small world,
// lib/scenario.js): each realm's own report says whether its dynasty is extinguished (`kingdom.eliminated`), as it
// already says whether the realm has conceded (`kingdom.conceded`). The player portal reads both to decide what the
// realm may send in Dispatches; it never reads the world itself.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The turn report tells a realm it is out (P0-25, R-075): after a real turn, an extinguished realm's own report has
// `kingdom.eliminated`, a conceded one `kingdom.conceded` (and not `eliminated`), a realm still in the game neither
const {bootScenario}=require('./lib/scenario');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };

(async()=>{
  const sc=await bootScenario();
  // realm 1's dynasty was extinguished on an earlier turn; realm 2 has conceded; realm 0 plays on
  const r=await sc.turn({realms:3,prepare(S){
    S.players[1]._eliminated=true; S.players[1]._eliminatedTurn=S.turn-1;
    S.players[2].conceded=true; S.players[2].concededTurn=S.turn-1;
  }});
  const k=pi=>((r.reports[pi]||{}).kingdom)||{};
  check(k(0).eliminated===false&&k(0).conceded===false,`a realm still in the game: neither (${JSON.stringify({e:k(0).eliminated,c:k(0).conceded})})`);
  check(k(1).eliminated===true,`an extinguished realm's own report says so (${k(1).eliminated})`);
  check(k(2).conceded===true&&k(2).eliminated===false,`a conceded realm's report says it conceded, not that it is extinguished (${JSON.stringify({e:k(2).eliminated,c:k(2).conceded})})`);
  check(!sc.errs.length,'no page errors'+(sc.errs.length?': '+sc.errs[0].split('\n')[0]:''));
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
