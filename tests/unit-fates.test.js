// 2026-10-11 (refactor only) — rollUnitFates: the per-unit rolls after a battle, hoisted out of the four
// casualty loops. Level 1 (unit): driven with injected dice, read straight off the booted GM portal.
//   • the winner's rolls: below dieAt a unit dies ("destroyed in the fighting", bones to dust for a
//     skeleton); otherwise below promoteTo it rises a tier (an Elite company, or a skeleton, simply
//     survives); the verb can be the defender's "are hardened by victory to";
//   • the loser's rolls: below dieAt it dies with the site's verb; otherwise a second roll: below
//     demoteAt it falls back in good order under Shield Fort, else loses a tier or, from Green, disbands;
//     else below promoteTo it rises "despite defeat"; o.notable stamps _notable on a demoted or promoted unit;
//   • the dice are drawn exactly as the old loops drew them: one per unit, a second only for a beaten
//     unit that neither died nor is skeletal — so a seeded game plays out as it did before;
//   • unitRef and ownedUnitName, moved to module level with it, keep their wording.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `rollUnitFates` (module level, refactor of the four casualty loops), driven with injected dice: the winner's death
// and promotion rolls, the loser's death, demotion, disbanding, Shield Fort fall-back and despite-defeat promotion,
// skeletons that neither rise nor fall, the `_notable` stamp, the exact wording, and the dice drawn exactly as before
// (one per unit, a second only for a beaten survivor that is not skeletal); `unitRef` and `ownedUnitName` keep their
// wording; it reads each fate line's words with the page's `theWordsOf` (facts since P1-12c6)
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
  for(const f of ['rollUnitFates','unitRef','ownedUnitName','demoteOrDisband','disbandLine']) ok(ev(`typeof ${f}`)==='function',`${f}() is declared at module level`);
  if(fail){ console.log(`\n${pass} pass, ${fail} fail`); process.exit(1); }
  const fates=ev('rollUnitFates'), unitRef=ev('unitRef'), owned=ev('ownedUnitName');
  const dice=seq=>{ let i=0; const f=()=>{ if(i>=seq.length) throw new Error('more dice than planned'); return seq[i++]; }; f.used=()=>i; return f; };
  const unit=(type,quality,extra)=>Object.assign({type,quality,unitName:type+' 1'},extra||{});
  const run=(force,o,seq)=>{ const lines=[]; const rng=dice(seq); const r=fates(force,Object.assign({rng,say:l=>lines.push(wordsOf(l))},o)); return {r,lines,used:rng.used()}; };

  // the winner
  let f=[unit('Shieldwall Levies','Average'),unit('Yeoman Longbows','Veteran'),unit('Dwarven Guard','Elite'),unit('Shieldwall Levies','Average',{_isSkeletal:true})];
  let t=run(f,{owner:'Aldric',won:true,dieAt:()=>0.10,promoteTo:()=>0.40},[0.05,0.30,0.30,0.30]);
  ok(t.r.died===1&&f[0]._died===true&&t.lines[0]==="— Aldric's Shieldwall Levies 1 (Shieldwall Levies, Average) were destroyed in the fighting.",`a roll under dieAt kills: "${t.lines[0]}"`);
  ok(t.r.promoted===1&&f[1].quality==='Crack'&&t.lines[1]==="— Aldric's Yeoman Longbows 1 (Yeoman Longbows, Veteran) earn promotion to Crack!",`a roll under promoteTo promotes and names the old tier: "${t.lines[1]}"`);
  ok(t.r.survived===2&&f[2].quality==='Elite'&&f[3].quality==='Average'&&t.lines.length===2,'an Elite company and a skeleton in the same window simply survive, with no line');
  ok(t.used===4,'one die per unit for a winner');
  t=run([unit('Shieldwall Levies','Average',{_isSkeletal:true})],{owner:'Aldric',won:true,dieAt:()=>0.5,promoteTo:()=>1},[0.1]);
  ok(t.lines[0].endsWith('were destroyed in the fighting. Their bones crumble to dust — gone forever.'),'a dead skeleton crumbles to dust');
  t=run([unit('Free Lances','Green')],{owner:'Gorbash',won:true,promoteVerb:'are hardened by victory to',dieAt:()=>0,promoteTo:()=>1},[0.5]);
  ok(t.lines[0]==="— Gorbash's Free Lances 1 (Free Lances, Green) are hardened by victory to Average!",`the defender's verb: "${t.lines[0]}"`);
  ok(!f.some(a=>a._notable),'a winner is never stamped notable');

  // the loser
  f=[unit('Orc Berserkers','Veteran'),unit('Goblin Horde','Average'),unit('Goblin Horde','Green'),unit('Warg Riders','Average'),unit('Orc Berserkers','Crack'),unit('Goblin Horde','Average',{_isSkeletal:true})];
  t=run(f,{owner:'Gorbash',won:false,diedVerb:'were annihilated in the rout!',dieAt:()=>0.20,demoteAt:()=>0.30,promoteTo:()=>0.45,notable:true},
    [0.10,  0.50,0.10,  0.50,0.20,  0.50,0.40,  0.50,0.90,  0.50]);
  ok(t.r.died===1&&t.lines[0]==="— Gorbash's Orc Berserkers 1 (Orc Berserkers, Veteran) were annihilated in the rout!",`the site's death verb: "${t.lines[0]}"`);
  ok(t.r.demoted===1&&f[1].quality==='Green'&&f[1]._notable===true&&t.lines[1]==="— Gorbash's Goblin Horde 1 (Goblin Horde, Average) lost heart in defeat, reduced to Green.",`a second roll under demoteAt loses a tier: "${t.lines[1]}"`);
  ok(t.r.disbanded===1&&f[2]._disbanded===true&&/have had enough — the survivors slip away to their villages and the unit disbands for good\.$/.test(t.lines[2]),`a Green company that would fall further disbands: "${t.lines[2]}"`);
  ok(t.r.promoted===1&&f[3].quality==='Veteran'&&f[3]._notable===true&&t.lines[3]==="— Despite defeat, Gorbash's Warg Riders 1 (Warg Riders, Average) improved to Veteran!",`a second roll between demoteAt and promoteTo rises despite defeat: "${t.lines[3]}"`);
  ok(t.r.survived===2&&f[4].quality==='Crack'&&!f[4]._notable&&t.lines.length===4,'a unit above both thresholds, and a skeleton, survive with no line');
  ok(t.used===10,'a beaten unit that neither died nor is skeletal draws a second die; the dead and the skeletal draw one');
  t=run([unit('Dwarven Guard','Veteran')],{owner:'Thorin',won:false,dieAt:()=>0,demoteAt:()=>0.5,promoteTo:()=>0.6,shieldFort:true},[0.9,0.1]);
  ok(t.r.held===1&&t.lines[0]==="— Thorin's Dwarven Guard 1 (Dwarven Guard, Veteran) fall back behind the shield wall in good order."&&t.r.demoted===0,`under Shield Fort a demotion is an orderly fall-back: "${t.lines[0]}"`);
  t=run([unit('Shieldwall Levies','Green',{_isSkeletal:true})],{owner:'Mort',won:false,dieAt:()=>0.5,demoteAt:()=>1,promoteTo:()=>1},[0.9]);
  ok(t.r.survived===1&&t.lines.length===0&&!t.lines[0],'a surviving skeleton is never demoted, disbanded or promoted');
  t=run([unit('Shieldwall Levies','Average')],{owner:'Mort',won:false,dieAt:()=>0,demoteAt:()=>0,promoteTo:()=>0},[0.5,0.5]);
  ok(t.r.survived===1&&t.lines.length===0,'a beaten unit above every threshold survives with no line');
  ok(fates(null,{won:true,dieAt:()=>1,promoteTo:()=>1}).died===0,'an empty force rolls nothing');

  // the helpers that moved with it
  ok(unitRef('Aldric',{unitName:'the Red Hand',type:'Eagle Riders',quality:'Elite'})==="the Red Hand (Aldric's Eagle Riders, Elite)"&&unitRef('',{type:'Levies',quality:'Green'})==='Green Levies','unitRef keeps its wording');
  ok(owned('Aldric',{unitName:'the Red Hand',type:'Eagle Riders'})==="the Red Hand (Aldric's Eagle Riders)"&&owned('Aldric',{type:'Levies'})==="Aldric's Levies",'ownedUnitName keeps its wording');
  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
