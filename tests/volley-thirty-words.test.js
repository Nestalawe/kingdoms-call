// 2026-10-11 (Toby, volleys at 30%) — the volley's size is written three times: MISSILE_SHOT_PCT in the
// GM portal, the rulebook's Archery text and the player portal's archery blurb. Level 0 (static): reads
// site/ text; nothing runs. (The constant sits inside runTurn, so no unit test can read it; the shot
// itself is checked by volley-thirty, a scenario.) A rule written twice must change twice (docs/traps.md).
const fs=require('fs'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const read=n=>fs.readFileSync(sitePath(n),'utf8');
const gm=read('kingdoms-call-gm-portal.html'), rules=read('kingdoms-call-rules.html'), pp=read('kingdoms-call-player-portal.html');
const m=/const MISSILE_SHOT_PCT=(0\.\d+)/.exec(gm);
ok(!!m,'the GM portal declares MISSILE_SHOT_PCT');
const pct=m?+m[1]:NaN;
ok(pct===0.30,`MISSILE_SHOT_PCT is 0.30 (got ${pct})`);
ok(/SHOOTER, not the target: 30% of the firing unit/.test(gm),'the engine comment beside the constant says 30%');
const word=`${Math.round(pct*100)}% of the shooting unit`;
ok(rules.includes(word)&&!rules.includes('20% of the shooting unit'),`the rulebook's Archery text says "${word}" and no longer 20%`);
ok(pp.includes(word)&&!pp.includes('20% of the shooting unit'),`the player portal's archery blurb says "${word}" and no longer 20%`);
// 2026-10-12 (the wrap-up batch): the rulebook's worked example follows the constants — a shot is
// round(strength × MISSILE_SHOT_PCT × (1 + MISSILE_ARCH_PER_LVL × Archery)), minimum 1 (missileShotDamage): Average
// Longbows (8) do 2, Elite (20) do 6, or 9 at Archery 5 — and the engine comment beside the cap gives the cap's own
// figure (MISSILE_CAP_FRACTION, doubled for a winged rider), not the figure it had before the cap was raised.
const lvl=/MISSILE_ARCH_PER_LVL=(0\.\d+)/.exec(gm), per=lvl?+lvl[1]:NaN;
const cap=/MISSILE_CAP_FRACTION=(0\.\d+)/.exec(gm), capPct=cap?Math.round(+cap[1]*100):NaN;
ok(!!lvl&&!!cap,'the GM portal declares MISSILE_ARCH_PER_LVL and MISSILE_CAP_FRACTION');
const shot=(s,arch)=>Math.max(1,Math.round(s*pct*(1+per*arch)));
const example=`Average Yeoman Longbows (strength 8) do ${shot(8,0)}; Elite Longbows (20) do ${shot(20,0)}, or ${shot(20,5)} at Archery 5.`;
ok(rules.includes(example),`the rulebook's worked example follows the constants: "${example}"`);
ok(new RegExp(`What a TARGET can lose is capped: ${capPct}% of its own[\\s/]+base strength \\(${capPct*2}% for a winged rider`).test(gm),`the engine comment beside the cap says ${capPct}% (${capPct*2}% for a winged rider)`);   // the comment wraps between "own" and "base"
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
