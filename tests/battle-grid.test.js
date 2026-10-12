// 2026-10-11 (Toby, battle lines I: rows and columns) — the battle grid, read straight off the booted GM
// portal (module level, beside the strength ladder). Level 1 (unit): the placement rules are pure
// functions of the rows, the width and the terrain; a scenario would only add a battle's luck on top.
//   • battleRole: the four winged riders are 'fly', cavalry 'cav' (but 'foot' at sea), ranged 'arc',
//     everything else 'foot' — infantry, garrisons, the walking beasts, fleets, and a type the tables have
//     never heard of; a row with no unit falls back on its own `fly` flag.
//   • battleGrid: ranged units behind a fighter shoot over it at ×1, in an empty front place ×0.75;
//     the second line otherwise ×0.5, the reserve ×0.25 then ×0.125 (sd09's lines when `flank`);
//     Tactical+1 cavalry ride the flanks on plains and desert only (Tactical counted to 5); winged
//     riders are capped at the enemy's units in line and in the air, never below 2, ×0.5 beyond; at
//     sea the hulls hold the front and no flank exists; every row is stamped `_g`, its army is not.
//   • rollBattleWidth stays inside the terrain's range; battleFrontWidth is the middle of it.
//   • battleGridLines / battleGridStage print the grid and the ladder's stage; battleLineTotal (the
//     bots' entry point) is the grid's total.
const {readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-6;

(async()=>{
  const errors=[];
  const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/gm',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  const w=dom.window; const ev=expr=>w.eval(expr);
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  for(const f of ['battleGrid','battleRole','rollBattleWidth','battleFrontWidth','battleGridLines','battleGridStage','battleLineTotal','battleWidthLine']){
    ok(ev(`typeof ${f}`)==='function',`${f}() is declared at module level`);
  }
  if(fail){ console.log(`\n${pass} pass, ${fail} fail`); process.exit(1); }
  const G=ev('battleGrid'), role=ev('battleRole'), roll=ev('rollBattleWidth'), mid=ev('battleFrontWidth'), lines=ev('battleGridLines'), stage=ev('battleGridStage'), total=ev('battleLineTotal');
  const row=(type,base)=>({a:{type,quality:'Average',unitName:type},base,fly:['Eagle Riders','Noble Griffons','Gnomish Gyrocopters','Wyvern Riders'].includes(type)});
  const rows=(spec,base)=>[].concat(...spec.map(([t,n,b])=>Array.from({length:n},()=>row(t,b||base||8))));

  // roles
  ok(role(row('Yeoman Longbows'),'plain')==='arc','Yeoman Longbows are ranged');
  ok(role(row('Free Lances'),'plain')==='cav'&&role(row('Free Lances'),'sea')==='foot','Free Lances are cavalry on land, foot at sea');
  ok(role(row('Eagle Riders'),'forest')==='fly','Eagle Riders fly');
  ok(role(row('Crimson Rocs'),'plain')==='fly','Crimson Rocs (a flying beast) fight from the air like the winged riders (2026-10-13, the beast abilities; they held a place like foot before)');
  ok(role(row('Forest Ents'),'plain')==='foot','Forest Ents (a walking beast) hold a place like foot');
  ok(role(row('Goblin Horde'),'plain')==='foot'&&role(row('Human Garrison'),'plain')==='foot'&&role(row('Galleon Fleet'),'sea')==='foot','Goblins, garrisons and fleets are foot');
  ok(role(row('Light Infantry'),'plain')==='foot','an unknown type is foot');
  ok(role({fly:true,base:5},'plain')==='fly'&&role({fly:false,base:5},'plain')==='foot','a row with no unit uses its fly flag');

  // ranged behind a fighter shoot over it at full; in an empty front place ×0.75
  let g=G(rows([['Shieldwall Levies',4],['Yeoman Longbows',2]]),6,'plain',{tac:0});
  ok(near(g.total,48),`4 Levies + 2 Longbows, front of 6: total 48 (every unit at ×1), got ${g.total}`);
  ok(g.units.filter(u=>u.row.a.type==='Yeoman Longbows').every(u=>u.place==='second'&&u.mult===1),'both Longbows stand in the second line at ×1');
  ok(g.second.every((x,c)=>!x||(g.front[c]&&g.front[c].role!=='arc')),'each second-line archer has a fighter in front of it');
  g=G(rows([['Shieldwall Levies',2],['Yeoman Longbows',4]]),6,'plain',{tac:0});
  ok(near(g.total,44),`2 Levies + 4 Longbows: two shoot over at ×1, two fill the front at ×0.75 → 44, got ${g.total}`);
  ok(g.units.filter(u=>u.place==='front'&&u.mult===0.75).length===2,'two ranged units are in the front at ×0.75');

  // spare units: second ×0.5, reserve ×0.25, deep reserve ×0.125; sd09 lifts those steps
  g=G(rows([['Shieldwall Levies',8]]),6,'plain',{tac:0});
  ok(near(g.total,56),`8 Levies, front of 6: 6 at ×1 + 2 at ×0.5 = 56, got ${g.total}`);
  g=G(rows([['Shieldwall Levies',8]]),6,'plain',{tac:0,flank:true});
  ok(g.total>56&&g.total<60,`with Flanking Tactics the two behind fight at more than ×0.5 (${g.total})`);
  g=G(rows([['Shieldwall Levies',20]]),6,'plain',{tac:0});
  ok(near(g.total,86),`20 Levies: 48 + 24 + 12 + 2 = 86, got ${g.total}`);
  ok(g.reserve.length===8&&g.units.filter(u=>u.place==='reserve'&&u.mult===0.125).length===2,'six in the reserve at ×0.25 and two deeper at ×0.125');

  // flanks: Tactical+1 cavalry on open ground only, Tactical counted to 5
  g=G(rows([['Free Lances',3,10],['Shieldwall Levies',4,8]]),6,'plain',{tac:1});
  ok(g.flanks.length===2&&near(g.total,62),`Tactical 1 on plains: two Free Lances on the flanks, one in the front → 62, got ${g.total} (${g.flanks.length} flanks)`);
  ok(g.front.filter(Boolean).length===5,'the two flank riders take no front place (5 in the front)');
  g=G(rows([['Free Lances',3,10],['Shieldwall Levies',4,8]]),6,'forest',{tac:5});
  ok(g.flanks.length===0&&near(g.total,58),`in forest no flank: 6 in the front, one Levy behind at ×0.5 → 58, got ${g.total}`);
  ok(G(rows([['Free Lances',8,10]]),6,'desert',{tac:9}).flanks.length===6,'Tactical is counted to 5: six flank places at most');
  ok(G(rows([['Free Lances',8,10]]),6,'plain',{tac:-3}).flanks.length===1,'a commander of Tactical 0 (or none) still has one flank place');

  // winged riders: capped at the enemy's units in line and in the air, never below 2
  const eagles=rows([['Eagle Riders',6,12]]);
  g=G(eagles,6,'plain',{enemy:rows([['Shieldwall Levies',2]])});
  // 2026-10-11 (Toby, the unit abilities — Stoop on the Horses): on open ground an Eagle holds a flank slot no
  // rider fills, at ×1 and outside the cap; the cap still counts the enemy's units in line and in the air.
  ok(g.cap===2&&g.flanks.length===1&&g.flanks[0].role==='fly'&&near(g.total,54),`6 Eagles against 2 Levies: one on the open flank at ×1, cap 2 for the five in the air (two at ×1, three at ×0.5) → 12 + 24 + 18 = 54, got ${g.total} (cap ${g.cap}, ${g.flanks.length} on the flank)`);
  ok(G(eagles,6,'forest',{enemy:rows([['Shieldwall Levies',2]])}).flanks.length===0&&near(G(eagles,6,'forest',{enemy:rows([['Shieldwall Levies',2]])}).total,48),'in forest no Eagle takes a flank: cap 2, two at ×1 and four at ×0.5 → 48');
  g=G(eagles,6,'plain',{enemy:rows([['Shieldwall Levies',1]])});
  ok(g.cap===2,'the cap is never below 2');
  g=G(eagles,6,'plain',{enemy:rows([['Eagle Riders',6,12]])});
  ok(g.cap===6&&near(g.total,72),`6 Eagles against 6 Eagles: all six fight at ×1 (${g.total})`);
  g=G(eagles,6,'plain',{enemy:rows([['Shieldwall Levies',3],['Free Lances',2,10]]),enemyTac:1});
  ok(g.cap===5,`the enemy's flank riders count toward the cap (3 in line + 2 on the flanks = ${g.cap})`);
  ok(near(G(eagles,6,'plain',{}).total,72),'with no enemy known (the bots) flyers are uncapped');
  ok(G(rows([['Eagle Riders',2,12],['Shieldwall Levies',6]]),6,'plain',{}).front.filter(Boolean).length===6,'flyers take no place in the front');

  // at sea: hulls first in the front, no flanks, cavalry fight as foot
  g=G(rows([['Shieldwall Levies',1,8],['Free Lances',1,10],['Galleon Fleet',1,9]]),8,'sea',{tac:5});
  ok(g.flanks.length===0&&g.front.filter(Boolean).length===3&&near(g.total,27),`at sea: three in the front, no flanks → 27, got ${g.total}`);
  const seaOrder=g.units.filter(u=>u.place==='front').sort((a,b)=>Math.abs(a.col-3.5)-Math.abs(b.col-3.5))[0];
  ok(seaOrder&&seaOrder.row.a.type==='Galleon Fleet','the hull holds the centre of a sea front');

  // stamps, unknown types, the alias
  g=G(rows([['Light Infantry',2,8]]),4,'mountain',{});
  ok(g.units.every(u=>u.place==='front'&&u.mult===1)&&g.units.every(u=>u.row._g&&u.row._g.place==='front'&&u.row.a._g===undefined),'an unknown type holds the front; the row carries _g, the army does not');
  ok(near(total(rows([['Shieldwall Levies',8]]),6,false,{terrain:'plain'}),56),'battleLineTotal is the grid\'s total');

  // the roll and the middle
  const R={plain:[6,8],desert:[6,8],sea:[8,10],forest:[4,6],jungle:[4,6],mountain:[2,4]};
  for(const t in R){ const seen=new Set(); for(let i=0;i<300;i++) seen.add(roll(t)); const vals=[...seen].sort((a,b)=>a-b);
    ok(vals.every(v=>v>=R[t][0]&&v<=R[t][1])&&vals.length===R[t][1]-R[t][0]+1,`${t}: 300 rolls stay within ${R[t][0]}–${R[t][1]} and reach every width (${vals.join(',')})`); }
  ok(mid('plain')===7&&mid('forest')===5&&mid('mountain')===3&&mid('sea')===9,'battleFrontWidth is the middle of each range (7 / 5 / 3 / 9)');

  // the print
  g=G(rows([['Shieldwall Levies',4],['Yeoman Longbows',2],['Free Lances',1,10],['Eagle Riders',1,12]]),6,'plain',{tac:0});
  const L=lines('Aldric the Bold',g,false), D=lines('Gorbash',g,true);
  ok(L.length===2&&L.every(l=>l.startsWith('📊')&&l.includes('│')),'two 📊 grid lines for a side with a second line');
  ok(/^📊 Aldric   1st │/.test(L[0])&&/^📊 Aldric   2nd │/.test(L[1]),'the attacker prints 1st then 2nd, labelled by the first word of the name');
  ok(/2nd/.test(D[0])&&/1st/.test(D[1]),'the defender prints 2nd then 1st, so the fronts meet');
  ok(/flanks: FreeL/.test(L[0])&&/air: Eagl/.test(L[0]),'flank riders and flyers are named on the front line');
  ok(/Bow/.test(L[1])&&!/Bow/.test(L[0]),'the Longbows appear in the second line, not the front');
  ok(/front ×1: /.test(stage(g))&&/second ×1: Bow, Bow/.test(stage(g))&&/flank ×1: FreeL/.test(stage(g)),'the ladder stage groups every unit by place and multiplier');
  ok(/the forest allows a front of 7/.test(ev("battleWidthLine('forest',7)"))&&/the open ground allows a front of 8/.test(ev("battleWidthLine('plain',8)")),'the width line names the ground and the front');
  ok(/the mountains allow a front of 3/.test(ev("battleWidthLine('mountain',3)"))&&/the open water allows a front of 9/.test(ev("battleWidthLine('sea',9)")),'mountains and open water have their own words');
  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
