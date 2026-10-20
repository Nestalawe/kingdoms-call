// 2026-10-11 (Toby, the army roster work) — The five type words are the ones players read: infantry,
// ranged, cavalry, flyer, naval. Level 0 (static): reads site/ text; nothing runs.
//   1. Rulebook roster table: every unit's Type cell is Infantry, Ranged, Cavalry, Flyer or Naval
//      (garrisons: "Infantry (garrison)"), and the table has a row for every unit in KC_UNIT_BASE_STR
//      except the five summoned elementals (not recruitable).
//   2. Four rulebook slips corrected the same day: Gilded Lances have no ride-down (only Free Lances
//      pursue); Gnomish Gyrocopters need no Druid; the Shieldwall Levies row names Shieldwall; Forest
//      Wardens are infantry (they never shoot).
//   3. The rulebook's roles table and the intro's kinds-of-unit list use the five words as headings.
//   4. The player portal's unit blurbs, the GM portal's archery-phase report lines and the Hall of Fame's
//      "Storm of arrows" label say ranged, not missile.
// The rulebooks are read as site/ text; the portals and the Hall of Fame from src/ by their syntax tree
// (tests/lib/source.ts), and the data file's table in the engine's bare vm (tests/lib/engine.ts). Until plan P1-09a
// they were read as site/ text too.
const fs=require('fs'), vm=require('vm');
const {sitePath}=require('./lib/boot'); const {loadEngine}=require('./lib/engine.ts');
const {compactPage,entriesOf,fileDeclaring,pageStrings,pageText}=require('./lib/source.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const read=n=>fs.readFileSync(sitePath(n),'utf8');
const rules=read('kingdoms-call-rules.html'), intro=read('kingdoms-call-rules-intro.html');
const LB='kingdoms-call-leaderboard.html', PP='kingdoms-call-player-portal.html';
const S=vm.runInContext('KC_UNIT_BASE_STR',loadEngine({seed:1}));
const TYPE_CELL=/^(Infantry|Ranged|Cavalry|Flyer|Naval)( \(garrison\))?$/;

// 1. The roster table.
const cap=rules.indexOf('<caption>Every army unit');
ok(cap>0,'the rulebook has the "Every army unit" roster table');
const table=cap>0?rules.slice(cap,rules.indexOf('</table>',cap)):'';
const rows={}; const rowRe=/<tr><td><strong>([^<]+)<\/strong><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td>((?:<td[^>]*>[^<]*<\/td>){4})([\s\S]*?)<\/tr>/g;
let m; while((m=rowRe.exec(table))){ const cells=[...m[4].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(x=>x[1].trim()); rows[m[1].trim()]={race:m[2].trim(),type:m[3].trim(),cost:cells[0],str:cells[1],move:cells[2],druid:cells[3],rest:m[5]}; }
ok(Object.keys(rows).length>=30,`the roster table parses (${Object.keys(rows).length} rows)`);
const badType=Object.entries(rows).filter(([,r])=>!TYPE_CELL.test(r.type)).map(([u,r])=>`${u}: "${r.type}"`);
ok(badType.length===0,'every Type cell is one of the five words'+(badType.length?' — not: '+badType.join('; '):''));
// R-109: the retired Corsairs keep their strength for companies already raised, but have no row.
const want=Object.keys(S||{}).filter(u=>!/ Elemental$/.test(u)&&u!=='Corsair Fleet'); const missingRow=want.filter(u=>!rows[u]);
ok(want.length>20&&missingRow.length===0,'the roster has a row for every recruitable unit'+(missingRow.length?' — missing: '+missingRow.join(', '):''));
const garrisons=Object.keys(rows).filter(u=>/Garrison$/.test(u)); const gBad=garrisons.filter(u=>rows[u].type!=='Infantry (garrison)');
ok(garrisons.length===4&&gBad.length===0,'the four garrisons are "Infantry (garrison)"'+(gBad.length?' — not: '+gBad.join(', '):''));

// 2. The four corrections.
const row=u=>rows[u]||{type:'',druid:'',rest:''};
ok(!/ride[- ]down|Ride Them Down/i.test(row('Gilded Lances').rest),"the Gilded Lances row no longer claims a ride-down pursuit (that is Free Lances' alone)");
ok(row('Gnomish Gyrocopters').druid==='—'&&!/Druid \d/.test(row('Gnomish Gyrocopters').rest),'Gnomish Gyrocopters need no Druid in the roster (Druid cell "—", no "Druid 2" in the text)');
ok(/Shieldwall:/.test(row('Shieldwall Levies').rest),'the Shieldwall Levies row names their Shieldwall ability');
ok(row('Forest Wardens').type==='Infantry','Forest Wardens are Infantry (they never loose in the archery step)');

// 3. Headings.
const roles=(()=>{ const i=rules.indexOf('<h3>The kinds of unit</h3>'); return i<0?'':rules.slice(i,rules.indexOf('</table>',i)); })();
for(const w of ['Infantry','Ranged','Cavalry','Flyers','Naval']) ok(roles.includes(`<strong>${w}</strong>`),`the rulebook roles table has a "${w}" row`);
ok(!/Archers &amp; missile|<strong>Foot<\/strong>|<strong>Fleets<\/strong>/.test(roles),'the roles table has dropped "Foot", "Archers &amp; missile" and "Fleets" as headings');
const kinds=(()=>{ const i=intro.indexOf('<h3>The kinds of unit</h3>'); return i<0?'':intro.slice(i,intro.indexOf('</ul>',i)); })();
for(const w of ['Infantry','Ranged','Cavalry','Flyers','Naval']) ok(kinds.includes(`<strong>${w}</strong>`),`the intro's kinds-of-unit list has "${w}"`);
ok(!/<strong>Foot<\/strong>|<strong>Archers<\/strong>|<strong>Fleets<\/strong>/.test(kinds),'the intro list has dropped "Foot", "Archers" and "Fleets"');

// 4. Portals and the Hall of Fame.
// Only the quoted blurbs are player-facing; a code comment beside one is not.
const blurbText=entriesOf(fileDeclaring(PP,'UNIT_ABILITIES'),'UNIT_ABILITIES').map(e=>e.value).join('\n');
ok(blurbText.length>500,'the player portal\'s UNIT_ABILITIES block was found');
ok(blurbText.length>500&&!/missile/i.test(blurbText),'no unit blurb in the player portal says "missile"');
const archeryLines=pageStrings('kingdoms-call-gm-portal.html').filter(l=>l.includes('Archery Phase**'));
ok(archeryLines.length===2&&archeryLines.every(l=>/ranged unit/.test(l)&&!/missile unit/.test(l)),'both archery-phase report lines count "ranged units", not "missile units"');
ok(/arrow_storm:\{[^}]*Strongest ranged host/.test(compactPage(LB))&&!/Strongest missile host/.test(pageText(LB)),'the Hall of Fame\'s "Storm of arrows" record says "ranged host"');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
