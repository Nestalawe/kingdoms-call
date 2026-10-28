// 2026-10-12 (Toby, the battle reports: who beat whom) — every company's fate line says whom it fought.
// Level 1 (unit): battleFacedClauses, rollUnitFates, disbandLine and battleTallyLine are module-level
// functions of the booted GM portal, and a grid staged with battleGrid/battleFacing gives every kind of
// place; a scenario would only add a battle's luck on top.
//   • battleFacedClauses(grid, enemyOwner): army → "facing X" / "shooting X over the line" / "in a flank duel
//     with X" / "guarding the end against X" / "wrapping the line at X" / "met at the end of the line by X" /
//     "riding free round the flank" / "fighting from the air" / "in the reserve" / "in the second line" /
//     "shooting at an empty column" / "with nobody opposite" — X as ownedUnitName writes the enemy company;
//   • rollUnitFates(force, {faced}) puts the clause after the company's own reference in every line; without
//     `faced` the lines read exactly as before (tests/unit-fates holds that wording);
//   • disbandLine takes the clause the same way;
//   • battleTallyLine credits a line to the company named FIRST, whatever the clause names after it.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Who beat whom in the fate lines (module level, booted GM portal): `battleFacedClauses` turns a faced grid into one
// clause per company ("facing X", "shooting X over the line", "in a flank duel with X", "guarding the end against X",
// "wrapping the line at X", "met at the end of the line by X", "riding free round the flank", "fighting from the air",
// "in the second line", "in the reserve", "shooting at an empty column", "with nobody opposite"); `rollUnitFates` puts
// the clause after the company's own reference in every branch (death, promotion, demotion, disbanding, the Shield
// Fort's fall-back, the Knightly Example, a rise despite defeat) and reads as before without one; `disbandLine` (the
// prose's since P1-12d5) takes it too; `battleTallyLine` credits a line to the company named first, not to the enemy
// its clause names; it reads each fate line's words with the page's `theWordsOf` (facts since P1-12c6), and whom a
// company faced (a record since P1-12d4) through the page's `theClauseOfWhomAUnitFaced` (the prose's since P1-12d5)
const {readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const errors=[];
  const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/gm',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  const w=dom.window; const ev=expr=>w.eval(expr);
  const wordsOf=l=>l==null||typeof l==='string'?l:ev('theWordsOf')(l); // a line's words: its words, or a fact's (the views write them, P1-12c6)
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  for(const f of ['battleFacedClauses','rollUnitFates','disbandLine','battleTallyLine','battleGrid','battleFacing']) ok(ev(`typeof ${f}`)==='function',`${f}() is declared at module level`);
  if(fail){ console.log(`\n${pass} pass, ${fail} fail`); process.exit(1); }
  const G=ev('battleGrid'), F=ev('battleFacing'), clauses=ev('battleFacedClauses'), fates=ev('rollUnitFates'), disband=ev('disbandLine'), tally=ev('battleTallyLine');
  const BASE={'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Warg Riders':10,'Eagle Riders':12,'Men-at-Arms':12};
  const row=(type,name)=>({a:{type,quality:'Average',unitName:name},base:BASE[type]||8,fly:type==='Eagle Riders'});
  const rows=spec=>[].concat(...spec.map(([t,names])=>names.map(nm=>row(t,nm))));
  const fight=(mine,theirs,W,terrain,tacMe,tacThem)=>{
    const me=G(mine,W,terrain,{tac:tacMe||0,enemy:theirs,enemyTac:tacThem||0});
    const them=G(theirs,W,terrain,{tac:tacThem||0,enemy:mine,enemyTac:tacMe||0});
    F(me,them,terrain); return {me,them}; };
  const armyOf=(force,name)=>force.find(r=>r.a.unitName===name).a;
  // Whom a unit faced is a record since plan P1-12d4; the clause's words are theClauseOfWhomAUnitFaced's.
  const clauseWords=ev('theClauseOfWhomAUnitFaced'), words=c=>c&&clauseWords(c);
  const clauseOf=(map,force,name)=>words(map.get(armyOf(force,name)));

  // ── the clauses, one per kind of place ──
  // A plain, front of 3: Aldric's five Levies, two Longbows, a Free Lance and an Eagle company against Gorbash's
  // three Levies and two Wargs (Tactical 1: both ride the flanks — one duels the Free Lance, one rides free).
  const A=rows([['Shieldwall Levies',['Levy A1','Levy A2','Levy A3','Levy A4','Levy A5']],['Yeoman Longbows',['Bow A1','Bow A2']],['Free Lances',['the Red Hand']],['Eagle Riders',['the Sky Host']]]);
  const B=rows([['Shieldwall Levies',['Levy B1','Levy B2','Levy B3']],['Warg Riders',['Warg B1','Warg B2']]]);
  let r=fight(A,B,3,'plain',0,1);
  let ca=clauses(r.me,'Gorbash'), cb=clauses(r.them,'Aldric');
  ok(ca instanceof w.Map||typeof ca.get==='function','battleFacedClauses returns a map keyed by the army objects');
  const frontLevies=r.me.front.filter(Boolean).map(x=>x.r.a.unitName);
  ok(frontLevies.length===3&&frontLevies.every(nm=>/^facing Gorbash's Levy B\d$/.test(clauseOf(ca,A,nm))),`a front Levy faces the Levy opposite: ${frontLevies.map(nm=>`"${clauseOf(ca,A,nm)}"`).join(', ')}`);
  ok(/^shooting Gorbash's Levy B\d over the line$/.test(clauseOf(ca,A,'Bow A1'))&&/^shooting Gorbash's Levy B\d over the line$/.test(clauseOf(ca,A,'Bow A2')),`a second-line Longbow shoots the Levy opposite: "${clauseOf(ca,A,'Bow A1')}"`);
  { const spare=['Levy A1','Levy A2','Levy A3','Levy A4','Levy A5'].filter(nm=>!frontLevies.includes(nm)).map(nm=>clauseOf(ca,A,nm)).sort();
    ok(spare.join('|')==='in the reserve|in the second line',`the two spare Levies stand in the second line and the reserve: ${spare.map(s=>`"${s}"`).join(', ')}`); }
  ok(/^in a flank duel with Gorbash's Warg B\d$/.test(clauseOf(ca,A,'the Red Hand')),`the Free Lance duels a Warg: "${clauseOf(ca,A,'the Red Hand')}"`);
  ok(clauseOf(ca,A,'the Sky Host')==='fighting from the air',`the Eagles fight from the air: "${clauseOf(ca,A,'the Sky Host')}"`);
  ok(['Levy B1','Levy B2','Levy B3'].every(nm=>/^facing Aldric's Levy A\d$/.test(clauseOf(cb,B,nm))),`Gorbash's Levies face Aldric's: "${clauseOf(cb,B,'Levy B1')}"`);
  { const wargs=['Warg B1','Warg B2'].map(nm=>clauseOf(cb,B,nm)).sort();
    ok(wargs[0]==="in a flank duel with the Red Hand (Aldric's Free Lances)"&&wargs[1]==='riding free round the flank',`one Warg duels the named Free Lance, the other rides free: ${wargs.map(s=>`"${s}"`).join(', ')}`); }
  // B plain, front of 5: five Levies against three Levies and a Free Lance that guards a threatened end
  const C=rows([['Shieldwall Levies',['Levy C1','Levy C2','Levy C3','Levy C4','Levy C5']]]);
  const D=rows([['Shieldwall Levies',['Levy D1','Levy D2','Levy D3']],['Free Lances',['Lance D']]]);
  r=fight(C,D,5,'plain');
  ca=clauses(r.me,'Gorbash'); cb=clauses(r.them,'Aldric');
  { const kinds=['Levy C1','Levy C2','Levy C3','Levy C4','Levy C5'].map(nm=>clauseOf(ca,C,nm));
    ok(kinds.filter(s=>/^facing Gorbash's Levy D\d$/.test(s)).length===3,`three Levies face: ${kinds.map(s=>`"${s}"`).join(', ')}`);
    ok(kinds.some(s=>s==="met at the end of the line by Gorbash's Lance D"),'the wrapping Levy the rider meets is "met at the end of the line by" it');
    ok(kinds.some(s=>/^wrapping the line at Gorbash's Levy D\d$/.test(s)),'the other wrapping Levy "wraps the line at" the end unit'); }
  ok(/^guarding the end against Aldric's Levy C\d$/.test(clauseOf(cb,D,'Lance D')),`the Free Lance guards the end: "${clauseOf(cb,D,'Lance D')}"`);
  // C plain, front of 2: a Longbow behind a Levy with nobody opposite shoots at an empty column; against a side with
  // no front at all a Levy stands with nobody opposite
  const E=rows([['Shieldwall Levies',['Levy E1','Levy E2']],['Yeoman Longbows',['Bow E1','Bow E2']]]);
  r=fight(E,rows([['Shieldwall Levies',['Levy F1']]]),2,'plain');
  ca=clauses(r.me,'Gorbash');
  { const bows=['Bow E1','Bow E2'].map(nm=>clauseOf(ca,E,nm)).sort();
    ok(bows.join('|')===["shooting Gorbash's Levy F1 over the line",'shooting at an empty column'].sort().join('|'),`one Longbow shoots the Levy, the other an empty column: ${bows.map(s=>`"${s}"`).join(', ')}`); }
  r=fight(rows([['Shieldwall Levies',['Levy G1']]]),rows([['Eagle Riders',['the Talons']]]),2,'plain');
  ok(words(clauses(r.me,'Gorbash').get(r.me.front.filter(Boolean)[0].r.a))==='with nobody opposite','against a side with no front a Levy stands "with nobody opposite"');
  ok(clauses(null,'Gorbash').size===0&&clauses({units:[]},'Gorbash').size===0,'no grid, no clauses');

  // ── the fate lines carry the clause ──
  const dice=seq=>{ let i=0; return ()=>{ if(i>=seq.length) throw new Error('more dice than planned'); return seq[i++]; }; };
  const unit=(type,quality,name,extra)=>Object.assign({type,quality,unitName:name},extra||{});
  const run=(force,o,seq,faced)=>{ const lines=[]; fates(force,Object.assign({rng:dice(seq),say:l=>lines.push(wordsOf(l)),faced},o)); return lines; };
  let f=[unit('Shieldwall Levies','Average','Levy A1'),unit('Yeoman Longbows','Average','Bow A1'),unit('Eagle Riders','Veteran','the Sky Host')];
  const facing=(how,theEnemyUnit)=>({kind:'an enemy unit',how,theEnemyUnit});
  let faced=new w.Map([[f[0],facing('faces',"Gorbash's Levy B1")],[f[1],facing('shoots',"Gorbash's Levy B2")],[f[2],{kind:'it fought from the air'}]]);
  let lines=run(f,{owner:'Aldric',won:true,dieAt:()=>0.10,promoteTo:()=>0.40},[0.05,0.30,0.30],faced);
  ok(lines[0]==="— Aldric's Levy A1 (Shieldwall Levies, Average), facing Gorbash's Levy B1, were destroyed in the fighting.",`a winner's death names whom it faced: "${lines[0]}"`);
  ok(lines[1]==="— Aldric's Bow A1 (Yeoman Longbows, Average), shooting Gorbash's Levy B2 over the line, earn promotion to Veteran!",`a winner's promotion names whom it shot: "${lines[1]}"`);
  ok(lines[2]==="— the Sky Host (Aldric's Eagle Riders, Veteran), fighting from the air, earn promotion to Crack!",`a named company keeps its form, clause after it: "${lines[2]}"`);
  f=[unit('Orc Berserkers','Veteran','Zog'),unit('Goblin Horde','Average','Gob 1'),unit('Goblin Horde','Green','Gob 2'),unit('Warg Riders','Average','Fang'),unit('Dwarven Guard','Veteran','Durn'),unit('Shieldwall Levies','Average','Levy X')];
  faced=new w.Map(f.map((a,i)=>[a,facing('faces',`Aldric's Levy A${i+1}`)]));
  lines=run(f,{owner:'Gorbash',won:false,diedVerb:'were annihilated in the rout!',dieAt:()=>0.20,demoteAt:()=>0.30,promoteTo:()=>0.45},[0.10, 0.50,0.10, 0.50,0.20, 0.50,0.40, 0.50,0.10, 0.50,0.10],faced);
  ok(lines[0]==="— Gorbash's Zog (Orc Berserkers, Veteran), facing Aldric's Levy A1, were annihilated in the rout!",`a loser's death: "${lines[0]}"`);
  ok(lines[1]==="— Gorbash's Gob 1 (Goblin Horde, Average), facing Aldric's Levy A2, lost heart in defeat, reduced to Green.",`a demotion: "${lines[1]}"`);
  ok(lines[2]==="— Gorbash's Gob 2 (Goblin Horde), facing Aldric's Levy A3, have had enough — the survivors slip away to their villages and the unit disbands for good.",`a disbanding: "${lines[2]}"`);
  ok(lines[3]==="— Despite defeat, Gorbash's Fang (Warg Riders, Average), facing Aldric's Levy A4, improved to Veteran!",`a rise despite defeat: "${lines[3]}"`);
  ok(lines[4]==="— Gorbash's Durn (Dwarven Guard, Veteran), facing Aldric's Levy A5, lost heart in defeat, reduced to Average.",`the Guard, outside a Shield Fort: "${lines[4]}"`);
  lines=run([f[4]],{owner:'Gorbash',won:false,dieAt:()=>0,demoteAt:()=>0.5,promoteTo:()=>0.6,shieldFort:true},[0.9,0.1],faced);
  ok(lines[0]==="— Gorbash's Durn (Dwarven Guard, Average), facing Aldric's Levy A5, fall back behind the shield wall in good order.",`the Shield Fort's fall-back: "${lines[0]}"`);
  { const lk=unit('Shieldwall Levies','Average','Levy K'); faced.set(lk,facing('faces',"Aldric's Levy A6")); // a fresh company: Levy X was demoted above
    lines=run([lk],{owner:'Gorbash',won:false,dieAt:()=>0,demoteAt:()=>0.5,promoteTo:()=>0.6,knightly:true},[0.9,0.1],faced);
    ok(lines[0]==="— Gorbash's Levy K (Shieldwall Levies, Average), facing Aldric's Levy A6, keep their nerve under the Knightly Example of the Gilded Lances and lose nothing in defeat.",`the Knightly Example: "${lines[0]}"`); }
  // a company the map does not know, and no map at all, read as before
  lines=run([unit('Shieldwall Levies','Average','Levy Z')],{owner:'Aldric',won:true,dieAt:()=>1,promoteTo:()=>1},[0.5],faced);
  ok(lines[0]==="— Aldric's Levy Z (Shieldwall Levies, Average) were destroyed in the fighting.",`a company with no clause reads as before: "${lines[0]}"`);
  lines=run([unit('Shieldwall Levies','Average','Levy Z')],{owner:'Aldric',won:true,dieAt:()=>1,promoteTo:()=>1},[0.5]);
  ok(lines[0]==="— Aldric's Levy Z (Shieldwall Levies, Average) were destroyed in the fighting.",'with no faced map the wording is unchanged');
  lines=run([unit('Shieldwall Levies','Average','Levy Y')],{owner:'Aldric',won:true,dieAt:()=>1,promoteTo:()=>1},[0.5],a=>a.unitName==='Levy Y'?{kind:'nobody stood opposite'}:null);
  ok(lines[0]==="— Aldric's Levy Y (Shieldwall Levies, Average), with nobody opposite, were destroyed in the fighting.",'faced may be a function');
  ok(disband('Aldric',unit('Shieldwall Levies','Green','Levy Q'),"facing Gorbash's Gob 1")==="— Aldric's Levy Q (Shieldwall Levies), facing Gorbash's Gob 1, have had enough — the survivors slip away to their villages and the unit disbands for good.",'disbandLine takes the clause after the company');
  ok(disband('Aldric',unit('Shieldwall Levies','Green','Levy Q'))==="— Aldric's Levy Q (Shieldwall Levies) have had enough — the survivors slip away to their villages and the unit disbands for good.",'…and reads as before without one');

  // ── the losses tally reads the company named first ──
  const force=(name,role,armies)=>'⚑FORCE⚑'+JSON.stringify({name,color:null,neutral:false,guard:false,role,verb:'',armies:armies.map(([type,unitName])=>({type,quality:'Average',unitName,race:null,phantom:false,skeletal:false,wildHunt:false,wildHuntUntil:null}))});
  const texts=[
    force('Aldric Ironhand','attacker',[['Shieldwall Levies','Levy A1'],['Gnomish Gyrocopters','the Red Hand'],['Yeoman Longbows','Bow A1']]),
    force('Gorbash','defender',[['Shieldwall Levies','Levy B1'],['Goblin Horde','Gob B1'],['Gnomish Gyrocopters','Gyro B1']]),
    "After a decisive battle, Aldric Ironhand's forces rout Gorbash's army and seize Thornfield!",
    "⚔ **Aldric Ironhand's forces** (attacker):",
    "— Aldric Ironhand's Levy A1 (Shieldwall Levies, Average), facing Gorbash's Levy B1, were destroyed in the fighting.",
    "— the Red Hand (Aldric Ironhand's Gnomish Gyrocopters, Average), fighting from the air, earn promotion to Veteran!",
    "— All other forces survive the engagement.",
    "🛡 **Gorbash's forces** (defender):",
    "— Gorbash's Gob B1 (Goblin Horde, Average), facing the Red Hand (Aldric Ironhand's Gnomish Gyrocopters), were annihilated in the rout!",
    "— Gorbash's Levy B1 (Shieldwall Levies), facing Aldric Ironhand's Levy A1, have had enough — the survivors slip away to their villages and the unit disbands for good.",
    "— Despite defeat, Gorbash's Gyro B1 (Gnomish Gyrocopters, Average), fighting from the air, improved to Veteran!",
  ];
  const t=tally(texts);
  ok(t==='⚰ Losses — **Aldric Ironhand**: 1 of 3 units lost (Shieldwall Levies), 1 promoted · **Gorbash**: 1 of 3 units lost (Goblin Horde), 1 disbanded (Shieldwall Levies), 1 promoted.',`the tally credits each line to the company named first, not to the enemy its clause names: "${t}"`);
  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
