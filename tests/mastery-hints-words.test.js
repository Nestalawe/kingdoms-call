// 2026-10-15 (Toby, D6) — the rulebooks may hint that mastery holds more (R-005 keeps the perks secret), but
// they never name a level 6–9 perk, order or spell outright. A player's review found a few named: the Explorer's
// lair-spotting, Shimmer, a Trueshot wound, Grand Stratagem and Grand Heist. The two vague hints (Explorer finds
// that raise a province's tax; deep Druid mastery cutting the cost of beasts) stay.
// Level 0 (static): reads both rulebooks and the names in MASTERY_UNLOCKS.
const fs=require('fs'), vm=require('vm'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const read=f=>fs.readFileSync(sitePath(f),'utf8');
const ctx={}; vm.createContext(ctx); vm.runInContext(read('kingdoms-call-data.js')+';this.M=MASTERY_UNLOCKS;',ctx);
// a perk's name: "New order — Forced March: …", "New spell — Sanctuary: …" or "Shimmer — enemy players …"
const names=new Set();
for(const v of Object.values(ctx.M||{})) for(const t of Object.values(v)){
  const m=/New (?:order|spell)[^—]*— ([^:(]+)/.exec(t)||/^([A-Z][A-Za-z' ]+) — /.exec(t); if(m) names.add(m[1].trim()); }
ok(names.size>30,`the mastery perks' names were read (${names.size})`);
const COMMON=new Set(['Veil']);   // an ordinary verb in the books ("Veil every lair…"), not the perk
const strip=t=>{ for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
for(const [f,label] of [['kingdoms-call-rules.html','the rulebook'],['kingdoms-call-rules-intro.html','the intro']]){
  const T=strip(read(f)).replace(/\s+/g,' ');
  const named=[...names].filter(n=>!COMMON.has(n)&&new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(T));
  ok(named.length===0,`${label} names no mastery perk (named: ${named.join(', ')||'none'})`);
  ok(!/auto-spotting lairs/.test(T),`${label} does not give away the Explorer's lair-spotting`);
}
const R=strip(read('kingdoms-call-rules.html')).replace(/\s+/g,' ');
ok(/Explorer finds can permanently raise a province's tax base/.test(R),'the vague hint at Explorer finds stays');
ok(/deep Druid mastery can bring the cost of Creature and Monster units down sharply/.test(R),'the vague hint at Druid mastery stays');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
