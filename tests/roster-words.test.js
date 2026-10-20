// 2026-10-11 (Toby, the army roster) — the books say what the tables say (tests/lib/roster-decided.js).
// Level 0 (static): the comprehensive rulebook's roster rows (race, type, cost, base strength, move,
// terrain), its home-roster and move-rate tables, its kinds-of-unit examples, the light-foot list, the
// March example and the recruit-cap sentences in both rulebooks; the player portal names the new units;
// and no page still carries a retired rule (the goblins' spears, the Berserkers' Outnumbered and Uncaring).
const fs=require('fs');
const {sitePath}=require('./lib/boot');
const R=require('./lib/roster-decided'); const {ROSTER,SEA_LAND_PENALTY,NEW_UNITS,isLand}=R;
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-9;
const read=f=>fs.readFileSync(sitePath(f),'utf8');
const rules=read('kingdoms-call-rules.html'), intro=read('kingdoms-call-rules-intro.html');
// the portals as their files under src/, as written (tests/lib/source.ts; until plan P1-09a, the built pages' text)
const {pageSource}=require('./lib/source.ts');
const gm=pageSource('kingdoms-call-gm-portal.html'), pp=pageSource('kingdoms-call-player-portal.html');
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const cap=s=>s[0].toUpperCase()+s.slice(1);

// ── The complete roster table: one row per unit ──
const ROW=/<tr><td><strong>([^<]+)<\/strong><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td class="terr"[^>]*>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows={}; let m; while((m=ROW.exec(rules))) rows[m[1].trim()]={race:m[2].trim(),type:m[3].trim(),cost:m[4].trim(),str:m[5].trim(),move:m[6].trim(),druid:m[7].trim(),terr:m[8],ability:strip(m[9])};
// "Plain ×1.1 · Forest ×0.9 · Sea ×0.75 <span>(+ notes)</span>" → {plain:1.1, forest:0.9, sea:0.75}; "None — …" → {}
const terrOf=cell=>{ const t=strip(cell.replace(/<span[\s\S]*?<\/span>/g,'')).trim(); if(/^None/.test(t)) return {}; const out={};
  t.split('·').forEach(part=>{ const mm=/^\s*([A-Za-z]+)\s*×\s*([\d.]+)\s*$/.exec(part); if(mm) out[mm[1].toLowerCase()]=parseFloat(mm[2]); else out['?'+part.trim()]=NaN; }); return out; };
for(const u of Object.keys(ROSTER)){
  const d=ROSTER[u], r=rows[u];
  if(d.retired){ ok(!r,`the rulebook's roster has no row for ${u} (retired)`); continue; }
  ok(!!r,`the rulebook's roster has a row for ${u}`); if(!r) continue;
  ok(r.race===d.race,`${u}: race ${d.race} (the row says ${r.race})`);
  const typeWord=d.garrison?'Infantry (garrison)':cap(d.type);
  ok(r.type===typeWord,`${u}: type "${typeWord}" (the row says "${r.type}")`);
  ok(r.cost===String(d.cost),`${u}: cost ${d.cost} (the row says ${r.cost})`);
  ok(r.str===String(d.str),`${u}: base strength ${d.str} (the row says ${r.str})`);
  ok(r.move===String(d.speed),`${u}: move ${d.speed} (the row says ${r.move})`);
  ok(r.druid==='—',`${u}: no Druid needed by a leader of its own race (the row says ${r.druid})`);
  const want={...d.terr}; if(isLand(d)) want.sea=SEA_LAND_PENALTY;
  const got=terrOf(r.terr);
  const keys=[...new Set([...Object.keys(want),...Object.keys(got)])];
  const bad=keys.filter(k=>!near(want[k]??1,got[k]??1)).map(k=>`${k}: book ×${got[k]??1}, table ×${want[k]??1}`);
  ok(bad.length===0,`${u}: the row's terrain cell matches the table — ${bad.join('; ')}`);
}
ok(!/spear|archery step/i.test((rows['Goblin Horde']||{}).ability||''),"the Goblin Horde row no longer promises thrown spears in the archery step");
ok(!/Outnumbered/.test((rows['Orc Berserkers']||{}).ability||''),"the Orc Berserkers row no longer describes Outnumbered and Uncaring");

// ── Home rosters: "Unit (base strength)" per race ──
const homeTable=(/<caption>Home rosters[\s\S]*?<\/table>/.exec(rules)||[''])[0];
ok(homeTable.length>0,'the rulebook has the home-rosters table');
for(const race of R.RACES){
  const row=(new RegExp(`<tr><td><strong>${race}</strong></td>([\\s\\S]*?)</tr>`).exec(homeTable)||['',''])[1];
  const found={}; const PAIR=/([A-Z][A-Za-z' -]+?) \((\d+)\)/g; let mm; while((mm=PAIR.exec(strip(row)))) found[mm[1].trim()]=+mm[2];
  for(const [name,str] of Object.entries(found)) ok(ROSTER[name]&&ROSTER[name].str===str,`home roster, ${race}: "${name} (${str})" matches the table (${ROSTER[name]?ROSTER[name].str:'no such unit'})`);
  const missing=R.unitsOf(race,d=>d.type!=='naval').filter(u=>!(u in found));
  ok(missing.length===0,`home roster, ${race}: names every land unit of the race — missing ${missing.join(', ')}`);
}

// ── Move-rate table: a unit named in a row has that move ──
const moveTable=(/<caption>Representative base land move rates[\s\S]*?<\/table>/.exec(rules)||[''])[0];
ok(moveTable.length>0,'the rulebook has the move-rate table');
const MROW=/<tr><td class="num">(\d)<\/td><td>([\s\S]*?)<\/td><\/tr>/g; const moveRows=[]; while((m=MROW.exec(moveTable))) moveRows.push({n:+m[1],text:strip(m[2])});
for(const u of Object.keys(ROSTER)){
  const d=ROSTER[u]; const inRows=moveRows.filter(r=>r.text.includes(u));
  for(const r of inRows) ok(r.n===d.speed,`move table: ${u} is listed under ${r.n} but moves ${d.speed}`);
  if(d.isNew) ok(inRows.length===1,`move table: ${u} appears in one row (${inRows.map(r=>r.n).join(', ')||'none'})`);
}

// ── Kinds of unit: each new unit is given as an example of its type ──
const kindRow=kind=>strip((new RegExp(`<tr><td><strong>${kind}</strong></td><td>([\\s\\S]*?)</td></tr>`).exec(rules)||['',''])[1]);
for(const u of NEW_UNITS){ const kind=cap(ROSTER[u].type); ok(kindRow(kind).includes(u),`the kinds-of-unit table's ${kind} row names ${u}`); }
ok(/Stag Riders/.test(strip((/<li><strong>Cavalry<\/strong>([\s\S]*?)<\/li>/.exec(intro)||['',''])[1]))&&/Ironhoof Rams/.test(strip((/<li><strong>Cavalry<\/strong>([\s\S]*?)<\/li>/.exec(intro)||['',''])[1])),
  "the intro's cavalry line names Stag Riders and Ironhoof Rams (the cavalry that keeps its footing on rough ground)");

// ── Light foot (half a hull): the new foot, not the new horse ──
const lightFoot=strip((/<li><strong>Light foot<\/strong>([\s\S]*?)<\/li>/.exec(rules)||['',''])[1]);
ok(/Men-at-Arms/.test(lightFoot)&&/Black Arrows/.test(lightFoot),'the light-foot list names Men-at-Arms and Black Arrows');
ok(!/Stag Riders|Ironhoof Rams/.test(lightFoot),'the light-foot list does not name the new cavalry');

// ── The March example uses the Levies' move ──
const march=/leading base-(\d) levies, at <strong>(\d)<\/strong>/.exec(rules);
ok(!!march&&+march[1]===ROSTER['Shieldwall Levies'].speed,`the March example calls levies base-${ROSTER['Shieldwall Levies'].speed} (it says base-${march&&march[1]})`);
ok(!!march&&+march[2]===ROSTER['Shieldwall Levies'].speed+3,'…and the March-5 figure follows the ladder (+3 at March 5, one rate for every unit since 2026-10-13)');

// ── Two a turn: garrisons, shipyard hulls and Goblin Hordes ──
const raisePara=strip((/<h3[^>]*>How many you may raise in a turn<\/h3>\s*<p>([\s\S]*?)<\/p>/.exec(rules)||['',''])[1]);
ok(/Goblin Horde/.test(raisePara)&&/two/.test(raisePara),'the rulebook\'s "How many you may raise" paragraph names the Goblin Horde among the two-a-turn exceptions');
ok(!/only two things/.test(rules),'the rulebook no longer says garrisons are "one of only two things" you can raise two of');
const recruitRow=strip((/<tr><td><strong>Recruit Armies<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/.exec(intro)||['',''])[1]);
ok(/Goblin Horde/.test(recruitRow),"the intro's Recruit Armies line names Goblin Hordes among what comes two a turn");

// ── Retired rules are gone from every page; the player portal knows the new units ──
ok(!/Goblin Hordes?\b[^.]*archery|archery[^.]*Goblin Hordes?\b/i.test(strip(rules).replace(/\s+/g,' ')),'the rulebook no longer counts Goblin Hordes among what shoots in the archery step');
for(const [name,src] of [['GM portal',gm],['player portal',pp],['rulebook',rules],['intro',intro]]) ok(!/Outnumbered and Uncaring/.test(src),`the ${name} no longer mentions Outnumbered and Uncaring`);
for(const u of NEW_UNITS) ok(pp.includes(u),`the player portal names ${u}`);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
