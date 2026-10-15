// 2026-10-15 (Toby, batch item 3) — the dead turn limit is gone from the site. The lobby set maxTurns to 0 ("no turn
// limit"), Turn 0 read it back as `cfg.maxTurns||12`, the world carried `maxTurns`, and the save's status line tested
// it against a `maxTurnsHardStop` nothing ever set. None of it did anything; a game ends only at the Reckoning or by
// elimination. The games table keeps its max_turns column (a database change is its own PR); the site no longer
// writes, reads or names it.
// Level 0 (static) for the source, level 1 for the world generateNewGame builds (its signature lost the parameter).
const fs=require('fs'), path=require('path');
const SITE=process.env.KC_SITE||path.join(__dirname,'..','site');
const read=f=>fs.readFileSync(path.join(SITE,f),'utf8');
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const G=read('kingdoms-call-gm-portal.html'), O=read('kingdoms-call-overlord.html'), PP=read('kingdoms-call-player-portal.html'), LB=read('kingdoms-call-leaderboard.html');
  for(const [name,src] of [['the GM portal',G],['the Overlord page',O],['the player portal',PP],['the Hall of Fame',LB]]){
    const hits=(src.match(/maxTurns|max_turns|maxTurnsHardStop/g)||[]);
    ok(hits.length===0,`${name} no longer names a turn limit (${hits.length} mention(s))`);
  }
  ok(/status:G\.gameOver\?'complete':'active'/.test(G),'a game is complete only when it is over (the Reckoning or elimination)');
  ok(/function generateNewGame\(setupPlayers, sz, genOpts\)\{/.test(G),'generateNewGame takes the players, the size and the options');
  ok(/no turn limit/.test(G),'the engine still says in words that there is no turn limit');

  // The world a new game starts from carries no limit.
  const sc=await bootScenario();
  const {S}=await sc.world({realms:2});
  ok(S&&S.world&&S.turn===1,'a world was generated');
  ok(!('maxTurns' in S),'…and it carries no maxTurns');
  if(sc.errs.length) sc.errs.slice(0,3).forEach(x=>console.log('  page error: '+x));
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
