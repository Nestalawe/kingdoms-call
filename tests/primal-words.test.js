// 2026-10-13 (Toby, Creatures and Monsters I) — the books say what the tables say (tests/lib/primal-decided.js).
// Level 0 (static): the comprehensive rulebook's roster rows for every live Creature and Monster (family, type,
// cost, base strength, move, Druid, terrain), its move-rate table and Druid ladder; the two crowns' sections and
// the intro's table (Wild Ferocity gone; Evil leads Monsters free, its king at Druid 1, a Monster province beside
// its home, Reign of Fear, Call from the Pit); the orders table; the player portal's alignment texts and order
// list; and no page keeps a retired rule (Wild Ferocity, the terrain multipliers now written once, Wyvern Riders
// named as Monsters).
const fs=require('fs');
const {sitePath}=require('./lib/boot');
const P=require('./lib/primal-decided'); const {ROSTER,LIVE,PIT_TIERS,REIGN_OF_FEAR}=P;
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-9;
const read=f=>fs.readFileSync(sitePath(f),'utf8');
const rules=read('kingdoms-call-rules.html'), intro=read('kingdoms-call-rules-intro.html'), pp=read('kingdoms-call-player-portal.html');
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const cap=s=>s[0].toUpperCase()+s.slice(1);
const norm=s=>strip(s).replace(/[’‘]/g,"'").replace(/\s+/g,' ');

// ── The roster rows ──
const ROW=/<tr><td><strong>([^<]+)<\/strong><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td class="terr"[^>]*>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows={}; let m; while((m=ROW.exec(rules))) rows[m[1].trim()]={race:m[2].trim(),type:m[3].trim(),cost:m[4].trim(),str:m[5].trim(),move:m[6].trim(),druid:m[7].trim(),terr:m[8],ability:norm(m[9])};
const terrOf=cell=>{ const t=strip(cell.replace(/<span[\s\S]*?<\/span>/g,'')).trim(); if(/^None/.test(t)) return {}; const out={};
  t.split('·').forEach(part=>{ const mm=/^\s*([A-Za-z]+)\s*×\s*([\d.]+)\s*$/.exec(part); if(mm) out[mm[1].toLowerCase()]=parseFloat(mm[2]); else out['?'+part.trim()]=NaN; }); return out; };
for(const u of LIVE){
  const d=ROSTER[u], r=rows[u];
  ok(!!r,`the rulebook's roster has a row for ${u}`); if(!r) continue;
  ok(r.race===d.family,`${u}: ${d.family} (the row says ${r.race})`);
  ok(r.type===cap(d.type),`${u}: type "${cap(d.type)}" (the row says "${r.type}")`);
  ok(r.cost===String(d.cost),`${u}: cost ${d.cost} (the row says ${r.cost})`);
  ok(r.str===String(d.str),`${u}: base strength ${d.str} (the row says ${r.str})`);
  ok(r.move===String(d.speed),`${u}: move ${d.speed} (the row says ${r.move})`);
  ok(r.druid===String(d.druid),`${u}: Druid ${d.druid} (the row says ${r.druid})`);
  const want={...d.terr}; if(P.isLand(d)) want.sea=0.75;
  const got=terrOf(r.terr);
  const keys=[...new Set([...Object.keys(want),...Object.keys(got)])];
  const bad=keys.filter(k=>!near(want[k]??1,got[k]??1)).map(k=>`${k}: book ×${got[k]??1}, table ×${want[k]??1}`);
  ok(bad.length===0,`${u}: the row's terrain cell matches the table — ${bad.join('; ')}`);
}
// Terrain written once: the rows no longer promise a second multiplier on top of their terrain cell.
ok(!/Mountain Bulwark/.test((rows['Stone Giants']||{}).ability||'')&&!/Bulwark/.test(rows['Stone Giants']?rows['Stone Giants'].terr:''),'the Stone Giants row no longer promises Mountain Bulwark on top of the mountains');
ok(!/Rooted Grove/.test((rows['Forest Ents']||{}).ability||'')&&!/Rooted Grove/.test(rows['Forest Ents']?rows['Forest Ents'].terr:''),'the Forest Ents row no longer promises Rooted Grove on top of the woods');
ok(!/×1\.2|×1\.3|×1\.56/.test((rows['Cave Trolls']||{}).ability||''),'the Cave Trolls row no longer promises an always-on ×1.2 / ×1.3');
ok(!/×1\.3/.test((rows['Titan Warbeasts']||{}).ability||''),'the Titan Warbeasts row no longer promises an always-on ×1.3');

// ── The renamed units (Creatures and Monsters II): the old names on no page ──
for(const [page,text] of [['rulebook',rules],['intro',intro],['player portal',pp]]) for(const old of Object.keys(P.RENAMED)) ok(!text.includes(old),`${page}: no "${old}" (it is ${P.RENAMED[old]} now)`);
ok(/thunderbirds/i.test(norm(((/<tr><td><strong>Creatures<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/.exec(rules)||['',''])[1])))&&!/eagles/.test(norm(((/<tr><td><strong>Creatures<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/.exec(rules)||['',''])[1]))),'the kinds-of-unit Creatures row names thunderbirds, not eagles');
ok(!/leviathans?/i.test(norm(((/<tr><td><strong>Sea-beasts<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/.exec(rules)||['',''])[1]))),'the kinds-of-unit Sea-beasts row no longer names leviathans');

// ── The move-rate table ──
const moveTable=(/<caption>Representative base land move rates[\s\S]*?<\/table>/.exec(rules)||[''])[0];
const MROW=/<tr><td class="num">(\d)<\/td><td>([\s\S]*?)<\/td><\/tr>/g; const moveRows=[]; while((m=MROW.exec(moveTable))) moveRows.push({n:+m[1],text:strip(m[2])});
const MOVE_ALIASES={'Stone Giants':/Stone Giants/,'Forest Ents':/Forest Ents/,'Cave Trolls':/Cave Trolls/,'Basilisk Brood':/Basilisk/,'Titan Warbeasts':/Titan/,'Manticore Pride':/Manticore/,'Elder Dragons':/Elder Dragons/,'Crimson Rocs':/Crimson Rocs/,'Thunderbirds':/Thunderbirds/,'Dread Hydras':/Hydras/};
for(const [u,re] of Object.entries(MOVE_ALIASES)){
  const inRows=moveRows.filter(r=>re.test(r.text));
  ok(inRows.length>=1,`move table: ${u} is listed`);
  for(const r of inRows) ok(r.n===ROSTER[u].speed,`move table: ${u} is listed under ${r.n} but moves ${ROSTER[u].speed}`);
}

// ── The Druid ladder ──
const ladder=lvl=>norm((new RegExp(`<strong>Druid ${lvl}</strong> — ([^<]*)`).exec(rules)||['',''])[1]);
for(const u of LIVE) ok(ladder(ROSTER[u].druid).includes(u),`the Druid ladder names ${u} at Druid ${ROSTER[u].druid}`);
ok(/Evil realms? lead(s)? every Monster|Evil realm leads every Monster|Evil realms command Monsters/i.test(norm(rules))||/Evil realm(s)?[^.]{0,80}Monsters?[^.]{0,80}no Druid/i.test(norm(rules)),"the Druid skill text says an Evil realm leads Monsters with no Druid, beside the Druidic line");

// ── The two crowns ──
const section=(h)=>{ const i=rules.indexOf(h); if(i<0) return ''; const j=rules.indexOf('<h3',i+h.length); return norm(rules.slice(i,j<0?undefined:j)); };
const dru=section('Druidic <span'), evil=section('Evil <span');
ok(dru.length>0&&evil.length>0,'the rulebook has the Druidic and Evil alignment sections');
for(const [page,text] of [['rulebook',norm(rules)],['intro',norm(intro)],['player portal',pp.replace(/[’‘]/g,"'")]]){
  ok(!/wild ferocity/i.test(text),`${page}: Wild Ferocity is gone`);
  ok(!/host with (a|any) Creature( unit)? fights (at )?×1\.25|Creature hosts fight at ×1\.25/i.test(text),`${page}: no "a host with a Creature fights ×1.25"`);
}
ok(/Druid \+1/.test(evil),'the Evil section says the king starts with Druid +1');
ok(/no Druid/.test(evil)&&/Monster/.test(evil),'the Evil section says Monsters follow with no Druid requirement');
ok(/Reign of Fear/.test(evil)&&new RegExp(`×${REIGN_OF_FEAR}`).test(evil)&&/Terror/.test(evil),`the Evil section describes Reign of Fear (×${REIGN_OF_FEAR} in a province under Terror)`);
ok(/Call from the Pit/.test(evil)&&/\+2g/.test(evil)&&Object.keys(PIT_TIERS).every(t=>evil.includes(t)),'the Evil section describes Call from the Pit with its four Monsters');
ok(/Monster province/.test(evil)&&/beside/.test(evil),'the Evil section says the king opens beside a Monster province');
ok(/Call from the Pit/.test(norm((/<tr><td>💀 Evil<\/td>[\s\S]*?<\/tr>/.exec(rules)||[''])[0]))&&/Call from the Pit/.test(norm(((/<tr><td>😈 <strong>Evil<\/strong>[\s\S]*?<\/tr>/.exec(intro)||[''])[0]))),"the orders table and the intro's alignment table give Evil Call from the Pit as its signature action");
ok(/no Druid/.test(norm(((/<tr><td>😈 <strong>Evil<\/strong>[\s\S]*?<\/tr>/.exec(intro)||[''])[0]))),"the intro's Evil row says Monsters need no Druid");
// Wyvern Riders are orcish soldiers, not Monsters (2026-10-11): no Monster list may name them.
const monsterLists=[...norm(rules).matchAll(/Monster[^.]{0,40}\(([^)]*)\)/g),...pp.matchAll(/Monster[^.]{0,40}(?:—|:)([^.]*)/g)].map(x=>x[1]);
ok(!/Wyvern Riders/.test(norm(((/<tr><td><strong>Monsters<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/.exec(rules)||['',''])[1])))&&!/wyverns/.test(norm(((/<tr><td><strong>Monsters<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/.exec(rules)||['',''])[1]))),'the kinds-of-unit Monsters row no longer names wyverns');
ok(!/Wyvern Riders/.test(evil),'the Evil section no longer names Wyvern Riders among the Monsters');
ok(!/\[M\] Monsters:<\/span>[^<]*Wyvern Riders/.test(pp)&&!/Monster armies — Wyvern Riders/.test(pp)&&!/\(trolls, wyverns/.test(pp),'the player portal\'s Evil texts no longer name Wyvern Riders among the Monsters');
void monsterLists;
// The player portal's texts.
ok(/Call from the Pit/.test(pp)&&/'Call from the Pit':'Evil'/.test(pp),"the player portal lists Call from the Pit as Evil's order");
ok(/Reign of Fear/.test(pp),'the player portal\'s Evil realm text names Reign of Fear');
const ppEvilSummary=(/Evil:`[^`]*`/.exec(pp)||[''])[0], ppEvilDesc=(/Evil:'💀 <strong>Evil:<\/strong>(?:[^'\\]|\\.)*'/.exec(pp)||[''])[0];
ok(/Druid 1 from the outset|Druid \+1/.test(ppEvilSummary)&&/Druid \+1/.test(ppEvilDesc),"the player portal's Evil texts (the realm summary and the join-screen blurb) say the king starts with Druid +1");
// The blurbs: the retired multipliers are gone.
const blurb=u=>(new RegExp(`\\n\\s*'${u}':'((?:[^'\\\\]|\\\\.)*)'`).exec(pp)||['',''])[1].replace(/[’‘]/g,"'");
ok(!/Mountain Bulwark/.test(blurb('Stone Giants')),"the Stone Giants blurb no longer promises Mountain Bulwark");
ok(!/Rooted Grove/.test(blurb('Forest Ents')),"the Forest Ents blurb no longer promises Rooted Grove");
ok(!/×1\.2|×1\.3/.test(blurb('Cave Trolls')),"the Cave Trolls blurb no longer promises an always-on multiplier");
ok(!/×1\.3/.test(blurb('Titan Warbeasts')),"the Titan Warbeasts blurb no longer promises an always-on ×1.3");

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
