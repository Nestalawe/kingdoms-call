// 2026-10-15 (Toby, batch item 2) — the player portal's Divine blurb said heroes "heal twice as fast resting". The
// game gives a Divine Rest ×1.5 the usual 30% of maximum HP, so 45%. The blurb now says 45%, as the rulebook ("half
// as much again") and the intro ("×1.5") already did.
// Level 0 (static): the blurb is a literal; the heal itself is nested inside runTurn (REST_HEAL_PCT and the ×1.5 are
// read from the source here, so the 45 is checked against the engine's own numbers).
const fs=require('fs'), path=require('path');
const SITE=process.env.KC_SITE||path.join(__dirname,'..','site');
const read=f=>fs.readFileSync(path.join(SITE,f),'utf8');
const strip=t=>{ for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const G=read('kingdoms-call-gm-portal.html'), PP=read('kingdoms-call-player-portal.html');
const R=strip(read('kingdoms-call-rules.html')).replace(/\s+/g,' '), I=strip(read('kingdoms-call-rules-intro.html')).replace(/\s+/g,' ');

// The engine: 30% × 1.5.
const pct=(G.match(/const REST_HEAL_PCT=([0-9.]+);/)||[])[1];
ok(pct==='0.30',`Rest heals 30% of maximum HP in the engine (got ${pct})`);
ok(/isDivineKingdom\?Math\.ceil\(baseHeal\*1\.5\)/.test(G),'a Divine Rest heals ×1.5 in the engine');
const divinePct=Math.round(parseFloat(pct||'0')*1.5*100);
ok(divinePct===45,`so a Divine Rest heals ${divinePct}%`);

// The player portal's Divine blurb.
const blurb=(PP.match(/Divine:'✨ <strong>Divine:<\/strong>[^\n]*',/)||[''])[0];
ok(blurb.length>0,'the Divine blurb was found');
ok(!/twice as fast/.test(blurb),'the blurb no longer says heroes heal twice as fast');
ok(/Rest heals 45% of maximum HP/.test(blurb),'the blurb says a Rest heals 45% of maximum HP');

// The books already agree.
ok(/recover 30% of maximum hit points, rounded up \(at least 1\); Divine realms recover half as much again/.test(R),'the rulebook: 30%, Divine half as much again');
ok(/Rest heals ×1\.5/.test(I),'the intro: Rest heals ×1.5');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
