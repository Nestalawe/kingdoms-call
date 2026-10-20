// 2026-10-11 (Toby, the winged riders are soldiers of their race) — the words: the rulebook's roster gives
// the three riders their race and no Druid, its Druid ladder and Druidic creed name no rider, the mastery
// example and the strike sentence follow, and the player portal's Druidic text and blurbs agree.
// Level 0 (static): reads site/ text; nothing runs.
// The player portal is read from src/ by its syntax tree (tests/lib/source.ts): its words as the strings it holds, its
// blurbs as entries of UNIT_ABILITIES. (Until plan P1-09a it was matched in the built page's text.)
const fs=require('fs'); const {sitePath}=require('./lib/boot');
const {entriesOf,fileDeclaring,pageText}=require('./lib/source.ts');
const PP='kingdoms-call-player-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const read=n=>fs.readFileSync(sitePath(n),'utf8');
const rules=read('kingdoms-call-rules.html'), pp=pageText(PP);
const blurb=u=>(entriesOf(fileDeclaring(PP,'UNIT_ABILITIES'),'UNIT_ABILITIES').find(e=>e.key===u)||{value:''}).value;
const row=u=>{ const m=new RegExp(`<tr><td><strong>${u}</strong></td><td>([^<]*)</td><td>([^<]*)</td>((?:<td[^>]*>[^<]*</td>){4})([\\s\\S]*?)</tr>`).exec(rules); if(!m) return null;
  const cells=[...m[3].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(x=>x[1].trim()); return {race:m[1].trim(),type:m[2].trim(),druid:cells[3],rest:m[4]}; };
for(const [u,race] of [['Noble Griffons','Human'],['Eagle Riders','Elven'],['Wyvern Riders','Orcish']]){
  const r=row(u); ok(!!r,`the roster has a ${u} row`); if(!r) continue;
  ok(r.race===race,`${u} are ${race} in the roster (got "${r.race}")`);
  ok(r.druid==='—',`${u} need no Druid in the roster (Druid cell "—", got "${r.druid}")`);
  ok(!/Druid 3|tamed creature/i.test(r.rest),`the ${u} row no longer says "needs Druid 3"`);
}
const a=rules.indexOf('<strong>Druid 1</strong> —'); const L=a<0?'':rules.slice(a,rules.indexOf('</li>',a));
// (2026-10-13, Creatures and Monsters III: the Shark Shoals share Druid 3 with the Whale Cohort; no winged rider does.)
ok(/Druid 1<\/strong> — [^<]*winged riders/.test(L)&&!/Druid 2<\/strong> — Gnomish/.test(L)&&/Druid 3<\/strong> — Whale Cohort/.test(L)&&!/Druid 3<\/strong> — [^<]*(Riders|Griffons|Gyrocopters)/.test(L),'the Druid ladder puts the winged riders at Druid 1, lists no Gyrocopters at 2 and leaves Druid 3 to the sea-beasts (the Whale Cohort first)');
ok(!/Eagle Riders \(Druid 3\)/.test(rules),'the mastery example no longer uses Eagle Riders');
ok(/land one time in two whatever your Druid/.test(rules),'the rulebook says the riders\' strikes land one time in two');
const c=rules.indexOf('ALL <strong>Creature</strong> armies'); const creed=c<0?'':rules.slice(c,c+300);
ok(creed.length>10&&!/Griffons|Eagle Riders/.test(creed),'the Druidic creed\'s Creature list names no rider');
ok(!/Eagle Riders at Druid 1|Noble Griffons at Druid 2/.test(rules)&&!/Eagle Riders at Druid 1|Noble Griffons at Druid 2/.test(pp),'Awaken the Wild no longer offers Eagle Riders or Noble Griffons, in either place');
ok(!/all Creature armies — [^—]*(Griffons|Eagle Riders)[^—]*—/.test(pp)&&!/\[C\] Creatures:<\/span>[^<]*(Griffons|Eagle Riders)/.test(pp),'the player portal\'s Druidic text and key name no rider among the Creatures');
ok(/[Oo]ne chance in two/.test(blurb('Noble Griffons'))&&/[Oo]ne chance in two/.test(blurb('Wyvern Riders')),'the Griffon and Wyvern blurbs say their strikes land one chance in two');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
