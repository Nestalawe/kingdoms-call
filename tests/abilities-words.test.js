// 2026-10-11 (Toby, the unit abilities) — the books say what the engine does. Level 0 (static): every
// humanoid land unit has a player-portal blurb (UNIT_ABILITIES) and a comprehensive-rulebook roster row; the four retired abilities (Massed Volley, Shock of the Charge, Skyward
// Retreat, the Wyverns' Dread) are named on no page; the rulebook explains the new conditions of Shieldwall,
// Shield Fort and Sheer Numbers. The abilities the rule registry holds (Sheer Numbers, plan P1-19a; the matchups
// of abilityFront and abilityBack, Halberds to Arrow Fodder, P1-19b; the whole line's, Hold the Gate to Flak Gunners,
// P1-19c; Knightly Example, P1-19d; the volley's, Prepared Ground to Raiders' Volley, P1-19g; the grid's, Through the Trees, Crag Charge and Brawling Archers, P1-19h; Flak Screen, P1-19i; the rout's, Ride Them Down, Shield Fort, Deep Halls and Run Them Down, P1-19j; Raiders' Muster, P1-19k) left the table, a unit with none left keeping the check of its blurb and its roster row: their names and numbers are checked from their content rows by
// tests/static/each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts. Since P1-19l it reads the last three
// from their tables too (Screech Dive and Acid Spit, the winged riders' strikes in BATTLE_ARMY_SPELLS; Forest Runners,
// the Stag Riders' cells of TERRAIN_MODS), so this test names no ability: it keeps each unit's blurb and roster row, and
// the checks below them.
// The player portal is read from src/ by its syntax tree (tests/lib/source.ts): its blurbs as entries of the object
// literal, its words as the strings it holds. (Until plan P1-09a they were matched in the built page's text.)
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The books say what the engine does: every humanoid land unit has its player-portal blurb and its rulebook roster row
// (until P1-19l, its two ability names in both: its matchup and its second ability; since P1-19a, not those the rule
// registry holds, which `each-unit-abilitys-name-and-numbers-are-in-both-books` checks from their content rows: Sheer
// Numbers, since P1-19b the matchups of the front line and the second line, Halberds to Arrow Fodder, since P1-19c the
// whole line's, Hold the Gate to Flak Gunners, since P1-19d Knightly Example, since P1-19g the volley's, Prepared
// Ground to Raiders' Volley, since P1-19h the grid's, Through the Trees, Crag Charge and Brawling Archers, since P1-19i
// Flak Screen, and since P1-19j the rout's, Ride Them Down, Shield Fort, Deep Halls and Run Them Down, since P1-19k
// Raiders' Muster, and since P1-19l the last three, Screech Dive, Acid Spit and Forest Runners, from their tables; so
// it names no ability now). The blurbs are `UNIT_ABILITIES` (each unit declared once; since P1-19e in the content file
// `src/content/unit-abilities-their-names-numbers-and-words.ts`, which the player page's entry lists); the Levies row
// says Shieldwall needs an archer behind them, both books say Shield Fort needs half the front line, the Goblins row
// counts other orc foot; the four retired abilities (Massed Volley, Shock of the Charge, Skyward Retreat, the Wyverns'
// Dread) are on no player page
const fs=require('fs');
const {sitePath}=require('./lib/boot'); const {entriesOf,fileDeclaring,pageText}=require('./lib/source.ts');
const PP='kingdoms-call-player-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const rules=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8'), pp=pageText(PP);
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const UNITS=[
  'Shieldwall Levies', 'Men-at-Arms', 'Yeoman Longbows',
  'Free Lances', 'Gilded Lances', 'Noble Griffons',
  'Human Garrison',
  'Forest Wardens', 'Elven Bowmen', 'Shadow Archers',
  'Stag Riders', 'Eagle Riders', 'Elven Garrison',
  'Dwarven Guard', 'Ironwood Crossbows', 'Mountain Guns',
  'Ironhoof Rams', 'Gnomish Gyrocopters', 'Dwarf Garrison',
  'Goblin Horde', 'Orc Berserkers', 'Black Arrows',
  'Warg Riders', 'Wyvern Riders', 'Orc Garrison',
];
const norm=s=>s.replace(/[’‘]/g,"'");
// the player portal's blurbs
// Every `'Unit':'blurb',` entry, in order, duplicates kept (no regex is built from a unit name).
const entries=entriesOf(fileDeclaring(PP,'UNIT_ABILITIES'),'UNIT_ABILITIES').map(e=>[e.key,e.value]);
const ppBlock=entries.map(e=>e[1]).join('\n');
ok(ppBlock.length>0,'the player portal declares UNIT_ABILITIES');
{ // one blurb per unit: in an object literal the last key wins, so a second entry silently replaces the first
  const keys=entries.map(e=>e[0]);
  const dup=keys.filter((k,i)=>keys.indexOf(k)!==i);
  ok(dup.length===0,`UNIT_ABILITIES declares each unit once (duplicates: ${dup.join(', ')||'none'})`); }
const blurbs=Object.fromEntries(entries); // the last entry wins, as it does in the object literal
for(const u of UNITS) ok(u in blurbs,`the player portal has a blurb for ${u}`);
// the rulebook's roster rows
const ROW=/<tr><td><strong>([^<]+)<\/strong><\/td><td>(Human|Elven|Dwarven|Orcish)<\/td><td>([^<]*)<\/td>(?:<td[^>]*>[^<]*<\/td>){4}<td class="terr"[^>]*>[\s\S]*?<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows={}; let m; while((m=ROW.exec(rules))) rows[m[1].trim()]=norm(strip(m[4]));
for(const u of UNITS) ok(u in rows,`the rulebook's roster has a row for ${u}`);
// what the conditions now are
ok(/Shieldwall:[\s\S]{0,40}archer[\s\S]{0,40}behind/i.test(rows['Shieldwall Levies']||''),'the Levies row says Shieldwall needs an archer behind them');
ok(/half the front line/i.test(rows['Dwarven Guard']||'')&&/half the front line/i.test(norm(ppBlock)),'Shield Fort reads "half the front line" in both books');
ok(/other orc foot/i.test(rows['Goblin Horde']||''),'Sheer Numbers counts other orc foot');
// the retired four are gone from the players' pages
for(const [page,src] of [['rulebook',rules],['player portal',pp]]){
  const t=norm(strip(src));
  ok(!/Massed Volley/.test(t),`${page}: no Massed Volley`);
  ok(!/Shock of the Charge/.test(t),`${page}: no Shock of the Charge`);
  ok(!/Skyward Retreat/.test(t),`${page}: no Skyward Retreat`);
  ok(!/fanaticism chance reduced|one eye on the sky|−15% fanaticism/.test(t),`${page}: no Dread (the Wyverns' fanaticism cut)`);
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
