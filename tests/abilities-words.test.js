// 2026-10-11 (Toby, the unit abilities) — the books say what the engine does. Level 0 (static): every
// humanoid land unit's two ability names appear in its player-portal blurb (UNIT_ABILITIES) and in its
// comprehensive-rulebook roster row; the four retired abilities (Massed Volley, Shock of the Charge, Skyward
// Retreat, the Wyverns' Dread) are named on no page; the rulebook explains the new conditions of Shieldwall,
// Shield Fort and Sheer Numbers.
// The player portal is read from src/ by its syntax tree (tests/lib/source.ts): its blurbs as entries of the object
// literal, its words as the strings it holds. (Until plan P1-09a they were matched in the built page's text.)
const fs=require('fs');
const {sitePath}=require('./lib/boot'); const {entriesOf,fileDeclaring,pageText}=require('./lib/source.ts');
const PP='kingdoms-call-player-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const rules=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8'), pp=pageText(PP);
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const ABILITIES={
  'Shieldwall Levies':['Spear Hedge','Shieldwall'], 'Men-at-Arms':['Halberds','Sergeants'], 'Yeoman Longbows':['Bodkin Points','Prepared Ground'],
  'Free Lances':['Harriers','Ride Them Down'], 'Gilded Lances':['Lance Charge','Knightly Example'], 'Noble Griffons':['Dive on the Bowmen','Screech Dive'],
  'Human Garrison':['Hold the Gate','Town Watch'],
  'Forest Wardens':['Woodland Skirmish','Ambush'], 'Elven Bowmen':['Volley at the Charge','Woodland Volley'], 'Shadow Archers':['Marksmen','Loosed From Cover'],
  'Stag Riders':['Through the Trees','Forest Runners'], 'Eagle Riders':['Stoop on the Horses','Eyes of the Forest'], 'Elven Garrison':['Thorn Hedge','Tree Watch'],
  'Dwarven Guard':['Unbreakable','Shield Fort'], 'Ironwood Crossbows':['Armour-Piercing','Punch Through'], 'Mountain Guns':['Bombard','Bombardment'],
  'Ironhoof Rams':['Battering Horns','Crag Charge'], 'Gnomish Gyrocopters':['Flak Gunners','Flak Screen'], 'Dwarf Garrison':['Stone Halls','Deep Halls'],
  'Goblin Horde':['Arrow Fodder','Sheer Numbers'], 'Orc Berserkers':['Frenzy','Driven Before Them'], 'Black Arrows':['Brawling Archers',"Raiders' Volley"],
  'Warg Riders':['Wolves Panic Horses','Run Them Down'], 'Wyvern Riders':['Terror From Above','Acid Spit'], 'Orc Garrison':['Bloodthirsty',"Raiders' Muster"],
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
