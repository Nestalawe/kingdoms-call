// 2026-10-11 (Toby, battle lines II: who faces whom) — the facing pass, read straight off the booted GM
// portal (module level, beside the grid). Level 1 (unit): what faces what is a pure function of the two
// placed grids and the terrain; a scenario would only add a battle's luck on top.
//   • a front unit against the enemy unit opposite: cavalry v ranged ×1.25, cavalry v infantry ×0.85,
//     infantry v cavalry ×1.15, infantry v a ranged unit in the front ×1.25, anything else ×1;
//   • a second-line ranged unit shooting over its fighter: infantry opposite ×1.25, cavalry ×0.75;
//   • a wider front wraps the enemy's ends (×1.2) and the end units it wraps are hit from the side (×0.9);
//   • flank riders duel; a spare one guards a threatened end (the wrapping unit is "met" instead); one
//     with nothing to do rides free (×1.3) and, on open ground, turns a line that infantry do not anchor
//     at both ends (its second-line ranged units ×0.75); rough ground has no riders to turn anything;
//   • an enemy with no front (all winged riders) faces nobody; at sea the same rules place the hulls;
//   • every row is stamped _faced; the ladder's stage groups the matchups that moved a figure.
// 2026-10-11 (Toby, the unit abilities): the units these scenarios use now bring their abilities to the same
// figures — Spear Hedge (cavalry facing Levies at most ×0.75), Shieldwall (Levies with an archer behind ×1.25),
// Bodkin Points (Longbows shoot cavalry at ×1), Harriers (Free Lances duel at ×1.15), Wolves Panic Horses
// (Wargs facing cavalry ×1.25) and Stoop on the Horses (an Eagle holds an open flank slot no rider fills).
// Each expectation below names the plain matchup and the ability on top; the plain figures are kept on units
// that carry no ability in that place (Goblins, Black Arrows).
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
  for(const f of ['battleFacing','battleEngage','battleFaceSide','battleFacingStage']) ok(ev(`typeof ${f}`)==='function',`${f}() is declared at module level`);
  ok(ev('typeof BATTLE_FACING')==='object','BATTLE_FACING is declared');
  if(fail){ console.log(`\n${pass} pass, ${fail} fail`); process.exit(1); }
  const G=ev('battleGrid'), F=ev('battleFacing'), stage=ev('battleFacingStage');
  const BASE={'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Warg Riders':10,'Eagle Riders':12,'Galleon Fleet':9};
  const row=type=>({a:{type,quality:'Average',unitName:type},base:BASE[type]||8,fly:type==='Eagle Riders'});
  const rows=spec=>[].concat(...spec.map(([t,n])=>Array.from({length:n},()=>row(t))));
  // Place both sides and face them: `me` is the attacker's grid, `them` the defender's.
  const fight=(mine,theirs,W,terrain,tacMe,tacThem)=>{
    const me=G(rows(mine),W,terrain,{tac:tacMe||0,enemy:rows(theirs),enemyTac:tacThem||0});
    const them=G(rows(theirs),W,terrain,{tac:tacThem||0,enemy:rows(mine),enemyTac:tacMe||0});
    F(me,them,terrain); return {me,them}; };
  const frontUnits=g=>g.face.units.filter(u=>u.place==='front');

  // the front: matchups by role (forest, so the cavalry stand in the line)
  let r=fight([['Shieldwall Levies',3]],[['Free Lances',3]],4,'forest');
  ok(near(r.me.face.total,27.6),`forest, no flanks: three Levies each face a Free Lance at ×1.15 → 27.6, got ${r.me.face.total}`);
  ok(near(r.them.face.total,22.5),`…and each Free Lance faces the Levies at ×0.75: cavalry v infantry ×0.85, capped by the Levies' Spear Hedge → 22.5, got ${r.them.face.total}`);
  { const g=fight([['Goblin Horde',3]],[['Free Lances',3]],4,'forest');
    ok(near(g.them.face.total,25.5),`…against foot with no Spear Hedge (Goblins) the Lances keep cavalry v infantry ×0.85 → 25.5, got ${g.them.face.total}`); }
  ok(frontUnits(r.me).every(u=>u.kind==='faces'&&u.vs&&u.vs.a.type==='Free Lances'),'each Levy is stamped as facing a Free Lance');
  ok(r.me.front.every((x,c)=>!x||(x.r._faced&&x.r._faced.vs===r.them.front[c].r)),'the stamp names the enemy row in the same column');
  r=fight([['Shieldwall Levies',2]],[['Yeoman Longbows',2]],2,'plain');
  ok(near(r.me.face.total,20)&&near(r.them.face.total,12),`Levies against Longbows caught in the front: ×1.25 for the Levies (20); the Longbows keep their ×0.75 place and face at ×1 (12); got ${r.me.face.total} / ${r.them.face.total}`);

  // the second line: shooting the unit opposite
  r=fight([['Shieldwall Levies',2],['Yeoman Longbows',2]],[['Shieldwall Levies',2]],2,'plain');
  ok(near(r.me.face.total,40),`Longbows behind Levies shoot the infantry opposite at ×1.25, and the Levies with an archer behind fight at ×1.25 (Shieldwall): 20 + 20 = 40, got ${r.me.face.total}`);
  ok(r.me.face.units.filter(u=>u.place==='second').every(u=>u.kind==='shoots'&&u.vs&&u.vs.a.type==='Shieldwall Levies'),'each Longbow is stamped as shooting the Levy opposite');
  r=fight([['Shieldwall Levies',2],['Yeoman Longbows',2]],[['Free Lances',2]],2,'forest');
  ok(near(r.me.face.total,39)&&near(r.them.face.total,15),`…against cavalry (in forest, so in the front) the Levies fight at ×1.15 and ×1.25 for the Shieldwall, and the Longbows shoot cavalry at ×1 (Bodkin Points): 23 + 16 = 39 v 15 (Spear Hedge); got ${r.me.face.total} / ${r.them.face.total}`);
  { const g=fight([['Goblin Horde',2],['Black Arrows',2]],[['Free Lances',2]],2,'forest');
    ok(near(g.me.face.total,30.4)&&near(g.them.face.total,17),`…the plain figures, on units with no ability here (Goblins, Black Arrows): foot v cavalry ×1.15, archers shoot cavalry at ×0.75, cavalry v foot ×0.85: 18.4 + 12 = 30.4 v 17; got ${g.me.face.total} / ${g.them.face.total}`); }

  // a wider front wraps the ends
  r=fight([['Shieldwall Levies',5]],[['Shieldwall Levies',3]],5,'plain');
  ok(near(r.me.face.total,43.2),`five against three: the two with nobody opposite wrap the ends at ×1.2 → 43.2, got ${r.me.face.total}`);
  ok(near(r.them.face.total,22.4),`…and the three's end units are hit from the side at ×0.9 → 22.4, got ${r.them.face.total}`);
  ok(r.me.front[0].r._faced.kind==='wraps'&&r.me.front[0].r._faced.vs===r.them.front[1].r&&r.me.front[4].r._faced.kind==='wraps'&&r.me.front[4].r._faced.vs===r.them.front[3].r,'the wrapping units are stamped with the end unit they wrap');
  ok(/hit from the side/.test(r.them.front[1].r._faced.why)&&/hit from the side/.test(r.them.front[3].r._faced.why)&&!/hit from the side/.test(r.them.front[2].r._faced.why),'only the end units are hit from the side');
  ok(/Levy wraps the end ×1\.2 \(2 units\)/.test(stage(r.me))&&/3 even/.test(stage(r.me)),`the stage groups the matchups that moved a figure and counts the even ones: "${stage(r.me)}"`);
  ok(/Levy v Levy, hit from the side ×0\.9 \(2 units\)/.test(stage(r.them)),`…for the defender: "${stage(r.them)}"`);
  ok(stage({})===''&&stage(null)==='','no facing, no stage');

  // a spare flank rider guards a threatened end
  r=fight([['Shieldwall Levies',5]],[['Shieldwall Levies',3],['Free Lances',1]],5,'plain');
  ok(r.them.flanks.length===1&&r.them.face.guarding===1&&r.them.face.free===0,'the three Levies\' one Free Lance has no duel, so it guards a threatened end');
  ok(near(r.me.face.total,42.8),`the wrapping Levy it meets fights it as infantry v cavalry ×1.15, the other still wraps ×1.2 → 42.8, got ${r.me.face.total}`);
  ok(near(r.them.face.total,30.7),`the guarded end is no longer hit from the side, the other still is, and the rider fights that Levy at ×0.75 (cavalry v infantry ×0.85, capped by the Spear Hedge) → 30.7, got ${r.them.face.total}`);
  ok(r.me.front[0].r._faced.kind==='met'&&r.me.front[0].r._faced.vs===r.them.flanks[0].r,'the met unit is stamped with the rider that met it');
  ok(r.them.flanks[0].r._faced.kind==='guards'&&r.them.flanks[0].r._faced.vs===r.me.front[0].r,'the rider is stamped as guarding the end against that unit');

  // duels, a free rider, an anchored line
  r=fight([['Shieldwall Levies',2],['Free Lances',1],['Yeoman Longbows',2]],[['Shieldwall Levies',3],['Warg Riders',2]],3,'plain',0,1);
  ok(r.me.face.duels===1&&r.them.face.duels===1&&r.them.face.free===1,'one flank duel; the second Warg rides free');
  ok(near(r.them.face.total,51.1),`the free rider fights at ×1.3, the duelling Warg faces cavalry at ×1.25 (Wolves Panic Horses) and the third Levy wraps the end: 8 + 8 + 9.6 + 12.5 + 13 = 51.1, got ${r.them.face.total}`);
  ok(near(r.me.face.total,50.5)&&r.me.face.anchored&&!r.me.face.turned,`Levies at both ends anchor the line, so the free rider does not turn it: the Longbows shoot at ×1.25 and lift the Levies (Shieldwall), the Free Lance duels at ×1.15 (Harriers): 9 + 10 + 20 + 11.5 = 50.5, got ${r.me.face.total}`);
  ok(r.me.flanks[0].r._faced.kind==='duel'&&r.me.flanks[0].r._faced.vs===r.them.flanks[0].r&&r.them.flanks[1].r._faced.kind==='free','the duellists are stamped with each other; the free rider as free');

  // a turned flank
  r=fight([['Shieldwall Levies',1],['Free Lances',2],['Yeoman Longbows',2]],[['Shieldwall Levies',3],['Warg Riders',2]],3,'plain',0,1);
  ok(!r.me.face.anchored&&r.me.face.turned,'with a Free Lance holding one end the line is not anchored, and the free rider turns it');
  ok(near(r.me.face.total,43.25),`a turned line's Longbows shoot at ×0.75 on top of their matchup: 10 (Levy, Shieldwall) + 6.75 (Free Lance in the front: Spear Hedge, hit from the side) + 7.5 + 7.5 + 11.5 (the duel, Harriers) = 43.25, got ${r.me.face.total}`);
  ok(r.me.second.filter(Boolean).every(x=>/flank turned/.test(x.r._faced.why)),'each Longbow is stamped "flank turned"');
  r=fight([['Shieldwall Levies',1],['Free Lances',2],['Yeoman Longbows',2]],[['Shieldwall Levies',3],['Warg Riders',2]],3,'forest',0,1);
  ok(r.them.flanks.length===0&&!r.me.face.turned&&r.them.face.free===0,'in forest there are no flank riders, so no line is ever turned');

  // no front to face; the sea
  r=fight([['Shieldwall Levies',3]],[['Eagle Riders',2]],3,'plain');
  ok(near(r.me.face.total,24)&&r.me.face.units.every(u=>u.kind==='even'),'against an enemy with no front (all winged riders) nobody faces anybody');
  ok(near(r.them.face.total,27.6),`one Eagle holds the open flank slot no rider fills (Stoop on the Horses) and, with nobody to duel or guard against, rides free at ×1.3; the other fights from the air at ×1: 15.6 + 12 = 27.6, got ${r.them.face.total}`);
  r=fight([['Galleon Fleet',2],['Shieldwall Levies',1]],[['Shieldwall Levies',2]],8,'sea');
  ok(near(r.me.face.total,27.6)&&near(r.them.face.total,15.2),`at sea the hulls hold the centre and the carried Levy wraps an end: 9 + 9 + 9.6 v 7.2 + 8; got ${r.me.face.total} / ${r.them.face.total}`);
  ok(r.me.units.every(u=>u.row.a._faced===undefined),'the army objects carry no stamp');
  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
