// 2026-10-13 (Toby, Creatures and Monsters V) — the books say what the beasts do. Level 0 (static): every live
// Creature's and Monster's ability names appear in its player-portal blurb (UNIT_ABILITIES) and in its
// comprehensive-rulebook roster row; the rulebook's battle-lines text says the flying beasts fight from the air
// like the winged riders; and no page still promises an ability "with the beast abilities" to come.
const fs=require('fs');
const {sitePath}=require('./lib/boot');
const {LIVE}=require('./lib/primal-decided');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const rules=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8'), pp=fs.readFileSync(sitePath('kingdoms-call-player-portal.html'),'utf8'), data=fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8');
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const norm=s=>s.replace(/[’‘]/g,"'");
const ABILITIES={
  'Whale Cohort':['Breach and Swamp'], 'Shark Shoals':['Shoal Swarm','Feeding Frenzy'],
  'Thunderbirds':['Storm Wings','Lightning Strike'], 'Forest Ents':['Rooted','Choking Spores'], 'Great Bears':['Maul','Thick Hide'],
  'Stone Giants':['Boulder Wall','Boulder Barrage'], 'Unicorn Herd':['Purity','Through the Glades'], 'Mammoth Host':['Trample','Stampede'],
  'Great Turtles':['Shell Wall','Island Back'], 'Crimson Rocs':['Air Superiority','Thunderous Stoop'],
  'Cave Trolls':['Regenerating Hide','Hurled Rubble'], 'Basilisk Brood':['Stone Deterrent','Petrifying Gaze'], 'Manticore Pride':['Relentless Hunt','Spine Volley'],
  'Sea Giants':['Tidal Might','Tidal Surge'], 'Eldritch Kraken':['Deepwater Grasp','Crushing Coils'], 'Titan Warbeasts':['Colossal Bulk','World-Shaking Charge'],
  'Elder Dragons':['Wyrmscale','Dragonfire Breath'], 'Dread Hydras':['Many Heads','Venom Breath'],
};
ok(LIVE.every(u=>u in ABILITIES),`every live beast has its abilities listed here (missing: ${LIVE.filter(u=>!(u in ABILITIES)).join(', ')||'none'})`);
// the player portal's blurbs
const ppBlock=(/const UNIT_ABILITIES=\{([\s\S]*?)\n\};/.exec(pp)||['',''])[1];
ok(ppBlock.length>0,'the player portal declares UNIT_ABILITIES');
const entries=[...ppBlock.matchAll(/\n\s*'((?:[^'\\]|\\.)*)':'((?:[^'\\]|\\.)*)'/g)].map(x=>[x[1],x[2]]);
const blurbs=Object.fromEntries(entries);
for(const [u,names] of Object.entries(ABILITIES)){
  ok(u in blurbs,`the player portal has a blurb for ${u}`); if(!(u in blurbs)) continue;
  const text=norm(blurbs[u]);
  for(const n of names) ok(text.includes(n),`${u}'s blurb names ${n} — "${text.slice(0,90)}…"`);
}
// the rulebook's roster rows
const ROW=/<tr><td><strong>([^<]+)<\/strong><\/td><td>(Creature|Monster)<\/td><td>([^<]*)<\/td>(?:<td[^>]*>[^<]*<\/td>){4}<td class="terr"[^>]*>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows={}; let m; while((m=ROW.exec(rules))) rows[m[1].trim()]=norm(strip(m[4]+' '+m[5]));
for(const [u,names] of Object.entries(ABILITIES)){
  ok(u in rows,`the rulebook's roster has a row for ${u}`); if(!(u in rows)) continue;
  for(const n of names) ok(rows[u].includes(n),`${u}'s row names ${n} — "${rows[u].slice(0,90)}…"`);
}
// the flying beasts in the air
const text=norm(strip(rules));
ok(/flying beasts?[^.]{0,120}(from the air|take no place|no place in the line)/i.test(text)||/(from the air|no place in the line)[^.]{0,160}flying beasts?/i.test(text),'the rulebook says the flying beasts fight from the air like the winged riders');
ok(!/Flying BEASTS hold a place|flying beasts hold a place/i.test(text),'…and no longer says they hold a place like infantry');
// no promise left to keep
for(const [page,src] of [['rulebook',rules],['player portal',pp],['data file',data]]) ok(!/comes? with the beasts?['’]? battle-line abilities|come with the beast abilities|comes with the beast abilities/i.test(norm(src)),`${page}: no ability is still promised "with the beast abilities"`);
// Purity breaks a Spear Hedge or a Boulder Wall (Toby, 2026-10-12): the unicorns' blurb, their rulebook row and their
// data-file description say so.
{ const brk=/breaks a Spear Hedge or a Boulder Wall/;
  const ppU=(/\n\s*'Unicorn Herd':'((?:[^'\\]|\\.)*)'/.exec(pp)||['',''])[1], rowU=(/<tr><td><strong>Unicorn Herd<\/strong>[\s\S]*?<\/tr>/.exec(rules)||[''])[0];
  ok(brk.test(ppU),"the player portal's Unicorn Herd blurb says Purity breaks a Spear Hedge or a Boulder Wall");
  ok(brk.test(rowU),"the rulebook's Unicorn Herd row says so");
  ok(brk.test(data),"the data file's Unicorn Herd description says so"); }
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
