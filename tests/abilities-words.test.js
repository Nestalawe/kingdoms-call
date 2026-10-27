// 2026-10-11 (Toby, the unit abilities) — the books say what the engine does. Level 0 (static): every
// humanoid land unit's two ability names appear in its player-portal blurb (UNIT_ABILITIES) and in its
// comprehensive-rulebook roster row; the four retired abilities (Massed Volley, Shock of the Charge, Skyward
// Retreat, the Wyverns' Dread) are named on no page; the rulebook explains the new conditions of Shieldwall,
// Shield Fort and Sheer Numbers. The abilities the rule registry holds (Sheer Numbers, plan P1-19a; the matchups
// of abilityFront and abilityBack, Halberds to Arrow Fodder, P1-19b; the whole line's, Hold the Gate to Flak Gunners,
// P1-19c; Knightly Example, P1-19d; the volley's, Prepared Ground to Raiders' Volley, P1-19g; the grid's, Through the Trees, Crag Charge and Brawling Archers, P1-19h; Flak Screen, P1-19i; the rout's, Ride Them Down, Shield Fort, Deep Halls and Run Them Down, P1-19j; Raiders' Muster, P1-19k) left the table, a unit with none left keeping the check of its blurb and its roster row: their names and numbers are checked from their content rows by
// tests/static/each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts.
// The player portal is read from src/ by its syntax tree (tests/lib/source.ts): its blurbs as entries of the object
// literal, its words as the strings it holds. (Until plan P1-09a they were matched in the built page's text.)
const fs=require('fs');
const {sitePath}=require('./lib/boot'); const {entriesOf,fileDeclaring,pageText}=require('./lib/source.ts');
const PP='kingdoms-call-player-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const rules=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8'), pp=pageText(PP);
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const ABILITIES={
  'Shieldwall Levies':[], 'Men-at-Arms':[], 'Yeoman Longbows':[],
  'Free Lances':[], 'Gilded Lances':[], 'Noble Griffons':['Screech Dive'],
  'Human Garrison':[],
  'Forest Wardens':[], 'Elven Bowmen':[], 'Shadow Archers':[],
  'Stag Riders':['Forest Runners'], 'Eagle Riders':[], 'Elven Garrison':[],
  'Dwarven Guard':[], 'Ironwood Crossbows':[], 'Mountain Guns':[],
  'Ironhoof Rams':[], 'Gnomish Gyrocopters':[], 'Dwarf Garrison':[],
  'Goblin Horde':[], 'Orc Berserkers':[], 'Black Arrows':[],
  'Warg Riders':[], 'Wyvern Riders':['Acid Spit'], 'Orc Garrison':[],
};
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
for(const [u,names] of Object.entries(ABILITIES)){
  ok(u in blurbs,`the player portal has a blurb for ${u}`); if(!(u in blurbs)) continue;
  const text=norm(blurbs[u]);
  for(const n of names) ok(text.includes(n),`${u}'s blurb names ${n} — "${text.slice(0,80)}…"`);
}
// the rulebook's roster rows
const ROW=/<tr><td><strong>([^<]+)<\/strong><\/td><td>(Human|Elven|Dwarven|Orcish)<\/td><td>([^<]*)<\/td>(?:<td[^>]*>[^<]*<\/td>){4}<td class="terr"[^>]*>[\s\S]*?<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows={}; let m; while((m=ROW.exec(rules))) rows[m[1].trim()]=norm(strip(m[4]));
for(const [u,names] of Object.entries(ABILITIES)){
  ok(u in rows,`the rulebook's roster has a row for ${u}`); if(!(u in rows)) continue;
  for(const n of names) ok(rows[u].includes(n),`${u}'s roster row names ${n} — "${rows[u].slice(0,90)}…"`);
}
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
