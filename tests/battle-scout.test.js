// 2026-10-11 (Toby, battle lines III: the scout's advantage and the line-up) — read straight off the
// booted GM portal (module level, beside the grid and the facing). Level 1 (unit): who scouts, which
// width it picks and how the lines shift are pure functions of the two finished sides, the terrain and
// the roll; a scenario would only add a battle's luck on top.
//   • battleScout: the higher exploration scouts; a tie goes to the defender.
//   • battleWidthChoices: the roll and one either side, clipped to the terrain's range.
//   • battleDeploy: the scout takes the width that suits it best; it lines up second (free improving
//     swaps); then the commanders take turns, the other side first, one swap per Tactical level, and no
//     swap is made that does not help. A swap keeps the front one block of the same kinds (battleLegal).
//   • the two report lines; determinism; the cost of a deploy stays small.
// 2026-10-11 (Toby, the unit abilities): the line-up scenario's units bring their abilities to its figures —
// Shieldwall (a Levy with the Longbow behind it ×1.25, wrapping or not), Bodkin Points (the Longbow shoots
// cavalry at ×1) and Spear Hedge (the Free Lance facing a Levy at ×0.75). The choices the deploy makes are the
// same; each expectation below shows the sum.
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
  for(const f of ['battleScout','battleWidthChoices','battleLegal','battleBestSwap','battleDeploy','battleRegrid','battleScoutLine','battleMovesLine']) ok(ev(`typeof ${f}`)==='function',`${f}() is declared at module level`);
  if(fail){ console.log(`\n${pass} pass, ${fail} fail`); process.exit(1); }
  const G=ev('battleGrid'), scout=ev('battleScout'), choices=ev('battleWidthChoices'), legal=ev('battleLegal'), deploy=ev('battleDeploy'), scoutLine=ev('battleScoutLine'), movesLine=ev('battleMovesLine');
  const BASE={'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Warg Riders':10,'Eagle Riders':12,'Dwarven Guard':12};
  const row=type=>({a:{type,quality:'Average',unitName:type},base:BASE[type]||8,fly:type==='Eagle Riders'});
  const rows=spec=>[].concat(...spec.map(([t,n])=>Array.from({length:n},()=>row(t))));
  const front=g=>g.front.map(x=>x?x.r.a.type.split(' ').pop():'·').join(' ');

  // who scouts, and which widths are on offer
  ok(scout(60,20)==='atk'&&scout(20,60)==='def'&&scout(50,50)==='def'&&scout(0,0)==='def','the higher exploration scouts; a tie goes to the defender');
  ok(choices('plain',6).join()==='6,7'&&choices('plain',7).join()==='6,7,8'&&choices('mountain',4).join()==='3,4'&&choices('sea',10).join()==='9,10'&&choices('forest',4).join()==='4,5','the roll and one either side, clipped to the terrain\'s range');

  // the width: eight Levies against four on the plains, roll 7
  let d=deploy(rows([['Shieldwall Levies',8]]),rows([['Shieldwall Levies',4]]),{terrain:'plain',roll:7,tacA:0,tacD:0,scout:'atk'});
  ok(d.W===8,`the wider attacker, scouting, widens the front to 8 (got ${d.W})`);
  ok(near(d.gA.face.total,70.4)&&near(d.gD.face.total,30.4),`…four Levies wrap the ends: 70.4 against 30.4 (got ${d.gA.face.total} / ${d.gD.face.total})`);
  ok(d.lineup===0&&d.moves.scout===0&&d.moves.other===0,'identical units have nothing to gain from a swap, so nobody shifts');
  d=deploy(rows([['Shieldwall Levies',8]]),rows([['Shieldwall Levies',4]]),{terrain:'plain',roll:7,tacA:0,tacD:0,scout:'def'});
  ok(d.W===6,`the narrower defender, scouting, narrows the front to 6 (got ${d.W})`);
  ok(near(d.gA.face.total,59.2),`…so only two Levies wrap and two more stand behind at ×0.5: 59.2 (got ${d.gA.face.total})`);

  // lining up second: the archer moves to shoot the infantry, not the horse (forest, roll 4, no flanks)
  const A=[['Shieldwall Levies',2],['Yeoman Longbows',1]], D=[['Free Lances',1],['Shieldwall Levies',1]];
  d=deploy(rows(A),rows(D),{terrain:'forest',roll:4,tacA:0,tacD:0,scout:'atk'});
  ok(d.W===4,`a front of 4 and 5 serve the attacker alike, so the roll stands (got ${d.W})`);
  ok(d.lineup>=1&&near(d.gA.face.total,29.2)&&near(d.gD.face.total,15.5),`the scouting attacker shifts its Longbow behind the Levy that faces the enemy Levy (that Levy's Shieldwall 10 + the ×1.25 shot 10 + the Levy facing the horse 9.2 = 29.2; behind the other it would be 11.5 + 8 + 8) against 15.5 (Spear Hedge 7.5 + 8); got ${d.gA.face.total} / ${d.gD.face.total}, ${d.lineup} adjustments`);
  { const bow=d.gA.units.find(u=>u.row.a.type==='Yeoman Longbows'); const opp=bow&&d.gD.front[bow.col];
    ok(bow&&bow.place==='second'&&opp&&opp.r.a.type==='Shieldwall Levies','the Longbow stands in the second line, in the column of the enemy Levy'); }
  ok(d.gA.units.find(u=>u.row.a.type==='Yeoman Longbows').row._faced.kind==='shoots','the stamps are those of the final layout');
  // the same armies with the defender scouting: lining up second, it slides its two units one place
  // along, so its Free Lance wraps the attacker's end and the Longbow shoots at an empty column
  // (27.2 against 19.2: the wrapping Levy with the bow behind it 12, the Levy hit from the side 7.2, the
  // bow 8); the attacker then spends its one Tactical move on the Longbow, first
  d=deploy(rows(A),rows(D),{terrain:'forest',roll:4,tacA:1,tacD:0,scout:'def'});
  ok(d.lineup===1&&near(d.gD.face.total,19.2),`the defender slides its line one place along (lineup ${d.lineup}, ${d.gD.face.total})`);
  ok(d.moves.other===1&&d.moves.scout===0&&near(d.gA.face.total,28.6),`the attacker answers with its Tactical move, the Longbow behind the Levy that now faces the enemy Levy: 27.2 → 28.6 (the wrapping Levy 9.6, the Levy hit from the side with its Shieldwall 9, the shot 10; moves ${d.moves.other}/${d.moves.scout}, ${d.gA.face.total})`);
  d=deploy(rows(A),rows(D),{terrain:'forest',roll:4,tacA:0,tacD:0,scout:'def'});
  ok(d.lineup===1&&d.moves.other===0&&near(d.gA.face.total,27.2)&&movesLine(d,'Aldric','Gorbash')===null,`without Tactical the attacker cannot answer (${d.gA.face.total}), and the report has no Tactics line`);
  ok(front(d.gA)===front(deploy(rows(A),rows(D),{terrain:'forest',roll:4,tacA:0,tacD:0,scout:'def'}).gA),'the same inputs give the same line-up');

  // what a legal swap is
  { const g=G(rows([['Shieldwall Levies',3],['Yeoman Longbows',1]]),4,'plain',{tac:0}); ok(legal(g),'a fresh grid is legal');
    const sw=(a,b,c,dd)=>{ const t=g[a][b]; g[a][b]=g[c][dd]; g[c][dd]=t; };
    sw('front',2,'front',3); ok(!legal(g),'a gap in the front is not'); sw('front',2,'front',3);
    sw('front',0,'front',3); ok(legal(g),'the whole block may shift along'); sw('front',0,'front',3);
    const bowCol=g.second.findIndex(Boolean); sw('front',0,'second',bowCol); ok(!legal(g),'an archer may not take a fighter\'s place in the front'); sw('front',0,'second',bowCol);
    ok(legal(g),'…and the grid is as it was'); }

  // the report's lines
  ok(scoutLine({scout:'atk',W:7,roll:6,lineup:2,moves:{scout:0,other:0}},'Aldric','Gorbash',60,20)==='📊 Scouting — Aldric knows the ground better (explored 60% against 20%): Aldric widens the front from 6 to 7 and lines up second (2 adjustments).','the scouting line: who, why, the width and the adjustments');
  ok(scoutLine({scout:'def',W:5,roll:5,lineup:0,moves:{scout:0,other:0}},'Aldric','Gorbash',50,50)==='📊 Scouting — Gorbash knows the ground as well as the enemy (50% explored by both), and the defender\'s claim stands: Gorbash takes the front of 5 the dice allow and lines up second.','a tie: the defender\'s claim stands');
  ok(/narrows the front from 4 to 3/.test(scoutLine({scout:'def',W:3,roll:4,lineup:1,moves:{scout:0,other:0}},'Aldric','Gorbash',10,100)),'…or narrows it');
  ok(movesLine({scout:'atk',moves:{scout:1,other:2}},'Aldric','Gorbash')==='📊 Tactics — Gorbash shifts the line twice; Aldric shifts the line once.','the Tactics line: the other side first');
  ok(movesLine({scout:'def',moves:{scout:3,other:0}},'Aldric','Gorbash')==='📊 Tactics — Aldric holds the line as it stands; Gorbash shifts the line 3 times.','…and a side that could not improve its line');

  // the cost: a deploy of two mixed hosts with Tactical 3 each stays cheap
  { const big=rows([['Shieldwall Levies',5],['Yeoman Longbows',3],['Free Lances',2],['Eagle Riders',2]]), foe=rows([['Dwarven Guard',4],['Warg Riders',3],['Yeoman Longbows',3],['Shieldwall Levies',2]]);
    const t0=Date.now(); let last=null; for(let i=0;i<20;i++) last=deploy(big,foe,{terrain:'plain',roll:7,tacA:3,tacD:3,scout:'atk'});
    const ms=Date.now()-t0; ok(ms<4000,`twenty deploys of 12 against 12 with Tactical 3 each take under 4 s (${ms} ms)`);
    ok(last.gA.face&&last.gD.face&&last.gA.units.every(u=>u.row._faced),'both grids come back faced'); }
  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
