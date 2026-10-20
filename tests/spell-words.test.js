// 2026-10-14 (batch item 13) — the spell texts say what the engine does. The player portal's spell
// list and the data file's spell descriptions had drifted from personal combat as it is: Hand of Death
// (40% of max HP on 10% a level, at most 60%), Telekinetic Storm (12% + 3% a level), Invisibility
// (−10% −4% a level), Psychic Blast (no free attacks; 1 round + 1 per two levels), Spiritwrack (1 round
// + 1 per two levels, not three phases) and Control Undead (a round per level counted to 5). The
// rulebook said field experience stops at level 5; it carries a skill to 9. Level 0: the words. The player portal's
// spell hints are read from src/ by their syntax tree (tests/lib/source.ts), the data file's descriptions in the
// engine's bare vm (tests/lib/engine.ts); until plan P1-09a both were matched in site/ text.
const fs=require('fs'), path=require('path'), vm=require('vm');
const {loadEngine}=require('./lib/engine.ts'); const {entriesOf,fileDeclaring}=require('./lib/source.ts');
const SITE=process.env.KC_SITE||path.join(__dirname,'..','site');
const stripTags=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } }; // until stable (as the other words tests do)
const read=f=>fs.readFileSync(path.join(SITE,f),'utf8');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const R=stripTags(read('kingdoms-call-rules.html'));
const HINTS=entriesOf(fileDeclaring('kingdoms-call-player-portal.html','SPELL_HINTS'),'SPELL_HINTS');
const SPELLS=vm.runInContext('SPELL_DEFS_P',loadEngine({seed:1}));
const pp=n=>(HINTS.find(e=>e.key===n)||{value:''}).value;
const dd=n=>(SPELLS[n]&&SPELLS[n].desc)||'';
const both=(n,good,bad,what)=>{ [['player portal',pp(n)],['data file',dd(n)]].forEach(([w,t])=>{
  ok(t.length>20,`${w}: ${n}'s text was read`);
  good.forEach(g=>ok(g.test(t),`${w}: ${n} says ${what} (${g})`)); bad.forEach(b=>ok(!b.test(t),`${w}: ${n} no longer says ${b}`)); }); };
both('Hand of Death',[/40%/,/60%/],[/50%/],'a 40% bite, at most a 60% chance');
both('Telekinetic Storm',[/12%/,/3%/],[/quarter of the target/,/25% of/],'12% + 3% a level');
both('Invisibility',[/\\u221210%|−10%/,/4%/],[/25%/],'−10% and −4% a level');
both('Psychic Blast',[/two Psychic levels|every two levels/],[/free attack/],'1 round + 1 per two levels, and no free attacks');
both('Spiritwrack',[/two White levels|every two levels/],[/three combat phases/],'1 round + 1 per two levels');
both('Control Undead',[/counted to 5/],[],'a round per level counted to 5');
ok(!/field experience up to level 5/.test(R),'the rulebook no longer says field experience stops at level 5');
ok(/an undead foe is stunned for one round per level \(counted to 5\)/.test(R),'the rulebook\'s Control Undead counts levels to 5');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
