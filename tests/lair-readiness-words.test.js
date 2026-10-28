// 2026-10-14 (batch item 14, Toby: "option 1") — lairs stay as hard as items 1–7 made them, and the
// rulebooks' readiness advice says so. A hero of a grade's own measure no longer wins "about 19 fights
// in 20" above Weak; both books now say the table is the least to send, that the next grade's hero is
// the one who clears a lair reliably, and that Hunting Rumours' odds are the ones to trust. Level 0.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 14: both rulebooks drop the "19 fights in 20" promise above Weak; the comprehensive one calls the readiness
// table the least to send, names the next grade's hero as the one who clears a lair reliably and points to Hunting
// Rumours' odds; the intro says the same (batch 2026-10-14)
const fs=require('fs'), path=require('path');
const SITE=process.env.KC_SITE||path.join(__dirname,'..','site');
const stripTags=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } }; // until stable (as the other words tests do)
const strip=f=>stripTags(fs.readFileSync(path.join(SITE,f),'utf8'));
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const R=strip('kingdoms-call-rules.html'), I=strip('kingdoms-call-rules-intro.html');
ok(!/Send a hero of the grade's own measure and the hardest guardian of that grade falls to them about 19 fights in 20/.test(R),'the rulebook no longer promises 19 fights in 20 at every grade');
ok(!/A hero of the right measure wins about 19 fights in 20/.test(I),'nor does the intro');
ok(/the least you should send/i.test(R),'the rulebook calls the table the least to send');
ok(/next grade's measure/i.test(R),'…says the next grade\'s hero is the one who clears a lair reliably');
ok(/Hunting Rumours[^.]*trust them/i.test(R),'…and points to Hunting Rumours\' odds');
ok(/next grade's measure/i.test(I),'the intro says the same');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
