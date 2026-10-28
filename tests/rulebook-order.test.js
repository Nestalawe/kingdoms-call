// 2026-10-15 (Toby) — both rulebooks follow the chapter order Toby chose: the World and the Economy come
// straight after How a Turn Works, the realm's races and alignments come before its people, Movement and
// Magic come before War, and Lairs, Sight, Mastery and Items come after it. The contents list matches the
// chapters, the "Part" labels count up one by one, and pointers that say "above" or "below" point the right way.
// Level 0 (static): reads both rulebooks.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Both rulebooks follow the chapter order Toby chose (2026-10-15); each contents list matches its chapters; the "Part"
// labels count up from One with no repeats; every link that says "above" or "below" points to a chapter on that side;
// Kings & Heroes points up to Divine; Mastery links back to The Fifteen Skills
const fs=require('fs'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const read=f=>fs.readFileSync(sitePath(f),'utf8');
const BOOKS=[
  ['kingdoms-call-rules.html','the rulebook',['overview','turn','world','economy','founding','races','alignments',
    'characters','skills','orders','movement','magic','spells','armies','battle','personal','lairs','sight',
    'mastery','items','diplomacy','victory','firstturns']],
  ['kingdoms-call-rules-intro.html','the intro',['overview','turn','world','founding','alignments','characters',
    'skills','orders','magic','armies','battle','lairs','victory','firstturns']],
];
const NUM=['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve'];
for(const [f,label,want] of BOOKS){
  const src=read(f);
  const main=(/<main>([\s\S]*?)<\/main>/.exec(src)||[])[1]||'';
  const chapters=[...main.matchAll(/<section id="([\w-]+)">/g)].map(m=>m[1]);
  ok(chapters.join()===want.join(),`${label}'s chapters are in Toby's order (found: ${chapters.join(', ')})`);
  const toc=(/<nav class="toc"[\s\S]*?<\/nav>/.exec(src)||[''])[0];
  const listed=[...toc.matchAll(/href="#([\w-]+)"/g)].map(m=>m[1]);
  ok(listed.join()===chapters.join(),`${label}'s contents list matches its chapters (listed: ${listed.join(', ')})`);
  const parts=[...main.matchAll(/class="eyebrow">Part (\w+) ·/g)].map(m=>m[1]);
  ok(parts.length>0&&parts.every((p,i)=>p===NUM[i]),`${label}'s Part labels count up from One (found: ${parts.join(', ')})`);
  ok(/<section id="overview">\s*<div class="eyebrow">Part One /.test(main),`${label} opens with Part One`);
  // a link that says "above" or "below" (in its text, or straight after it) points to a chapter on that side
  const pos=id=>{ const i=chapters.indexOf(id); return i; };
  const where=at=>{ let c=-1; for(const m of main.matchAll(/<section id="([\w-]+)">/g)){ if(m.index<=at) c=chapters.indexOf(m[1]); } return c; };
  for(const m of main.matchAll(/<a href="#([\w-]+)">([^<]*)<\/a>(,? (?:above|below)\b)?/g)){
    const word=(/\b(above|below)\b/.exec(m[2]+(m[3]||''))||[])[1]; if(!word) continue;
    const to=pos(m[1]); if(to<0) continue;   // a link to a heading inside a chapter, not to a chapter
    const from=where(m.index);
    ok(word==='below'?to>from:to<from,`${label}: the link to #${m[1]} from #${chapters[from]} says "${word}"`);
  }
}
const R=read('kingdoms-call-rules.html');
ok(!/see Divine, below/.test(R),'the Kings & Heroes chapter no longer says Divine is below');
ok(/see <a href="#alignments">Divine<\/a>, above/.test(R),'the Kings & Heroes chapter points up to Divine in The Seven Alignments');
const mastery=(/<section id="mastery">([\s\S]*?)<\/section>/.exec(R)||[])[1]||'';
ok(/href="#skills"/.test(mastery),'the Mastery chapter, now well after The Fifteen Skills, links back to it');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
