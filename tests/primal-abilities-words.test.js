// 2026-10-13 (Toby, Creatures and Monsters V) — the books say what the beasts do. Level 0 (static): every live
// Creature and Monster has a player-portal blurb (UNIT_ABILITIES) and a comprehensive-rulebook roster row; the rulebook's battle-lines text says the flying beasts fight from the air
// like the winged riders; and no page still promises an ability "with the beast abilities" to come.
// The abilities the rule registry holds (plan P1-19a: Shoal Swarm, Relentless Hunt, Stone Deterrent, Tidal Might,
// Deepwater Grasp, Wyrmscale, Air Superiority; P1-19b: Maul, Boulder Wall, Purity, Trample, Many Heads; P1-19c: Storm
// Wings, Rooted; P1-19d: Regenerating Hide; P1-19g: Thick Hide, Shell Wall; P1-19h: Through the Glades, Colossal Bulk; P1-19i: Breach and Swamp; P1-19j: Feeding Frenzy) left the table: their names and numbers are checked from their content
// rows by tests/static/each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts. Since P1-19l it reads the rest
// from their tables too (the pre-battle strikes, each beast's spells in PRIMAL_ARMY_DEFS_P; Island Back, the Great
// Turtles' berths in KC_CARRIER_BERTHS), so this test names no ability: it keeps each live beast's blurb and roster row,
// and the checks below them.
// The player portal and the data file are read from src/ by their syntax tree (tests/lib/source.ts): the blurbs as
// entries of the object literal, the words as the strings each holds. (Until plan P1-09a they were matched in the built
// files' text.)
const fs=require('fs');
const {sitePath}=require('./lib/boot'); const {entriesOf,fileDeclaring,pageText,stringsOf}=require('./lib/source.ts');
const PP='kingdoms-call-player-portal.html';
const {LIVE}=require('./lib/primal-decided');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const rules=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8'), pp=pageText(PP), data=stringsOf('content/kingdoms-call-data.ts').join('\n');
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const norm=s=>s.replace(/[’‘]/g,"'");
const UNITS=[
  'Whale Cohort', 'Shark Shoals',
  'Thunderbirds', 'Forest Ents', 'Great Bears',
  'Stone Giants', 'Unicorn Herd', 'Mammoth Host',
  'Great Turtles', 'Crimson Rocs',
  'Cave Trolls', 'Basilisk Brood', 'Manticore Pride',
  'Sea Giants', 'Eldritch Kraken', 'Titan Warbeasts',
  'Elder Dragons', 'Dread Hydras',
];
ok(LIVE.every(u=>UNITS.includes(u)),`every live beast is listed here (missing: ${LIVE.filter(u=>!UNITS.includes(u)).join(', ')||'none'})`);
// the player portal's blurbs
const entries=entriesOf(fileDeclaring(PP,'UNIT_ABILITIES'),'UNIT_ABILITIES').map(e=>[e.key,e.value]);
ok(entries.length>0,'the player portal declares UNIT_ABILITIES');
const blurbs=Object.fromEntries(entries);
for(const u of UNITS) ok(u in blurbs,`the player portal has a blurb for ${u}`);
// the rulebook's roster rows
const ROW=/<tr><td><strong>([^<]+)<\/strong><\/td><td>(Creature|Monster)<\/td><td>([^<]*)<\/td>(?:<td[^>]*>[^<]*<\/td>){4}<td class="terr"[^>]*>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows={}; let m; while((m=ROW.exec(rules))) rows[m[1].trim()]=norm(strip(m[4]+' '+m[5]));
for(const u of UNITS) ok(u in rows,`the rulebook's roster has a row for ${u}`);
// the flying beasts in the air
const text=norm(strip(rules));
ok(/flying beasts?[^.]{0,120}(from the air|take no place|no place in the line)/i.test(text)||/(from the air|no place in the line)[^.]{0,160}flying beasts?/i.test(text),'the rulebook says the flying beasts fight from the air like the winged riders');
ok(!/Flying BEASTS hold a place|flying beasts hold a place/i.test(text),'…and no longer says they hold a place like infantry');
// no promise left to keep
for(const [page,src] of [['rulebook',rules],['player portal',pp],['data file',data]]) ok(!/comes? with the beasts?['’]? battle-line abilities|come with the beast abilities|comes with the beast abilities/i.test(norm(src)),`${page}: no ability is still promised "with the beast abilities"`);
// Purity breaks a Spear Hedge or a Boulder Wall (Toby, 2026-10-12): the unicorns' blurb, their rulebook row and their
// data-file description say so.
{ const brk=/breaks a Spear Hedge or a Boulder Wall/;
  const ppU=blurbs['Unicorn Herd']||'', rowU=(/<tr><td><strong>Unicorn Herd<\/strong>[\s\S]*?<\/tr>/.exec(rules)||[''])[0];
  ok(brk.test(ppU),"the player portal's Unicorn Herd blurb says Purity breaks a Spear Hedge or a Boulder Wall");
  ok(brk.test(rowU),"the rulebook's Unicorn Herd row says so");
  ok(brk.test(data),"the data file's Unicorn Herd description says so"); }
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
