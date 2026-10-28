// 2026-10-11 (Toby, the unit abilities) — the Dwarven units' abilities, each a matchup and one more:
//   Dwarven Guard        Unbreakable (foot facing them ×0.85; never hit from the side) · Shield Fort (now when at least
//                        half the FRONT LINE is Guard, a Dwarf Garrison counting: shieldFortHolds)
//   Ironwood Crossbows   Armour-Piercing (×1.25 shooting a unit of base strength 6 or more) · Punch Through (unchanged)
//   Mountain Guns        Bombard (×1.15 from the second line, whatever they shoot) · Bombardment (unchanged)
//   Ironhoof Rams        Battering Horns (a Ram riding free turns the flank even of an anchored line) · Crag Charge
//                        (the one cavalry that takes a flank in the mountains)
//   Gnomish Gyrocopters  Flak Gunners (×1.25 when the enemy has flyers) · Flak Screen (unchanged)
//   Dwarf Garrison       Stone Halls (foot facing it in the mountains ×0.9) · Deep Halls (counts as Guard for Shield Fort)
// Level 1 (unit): the grid, the facing and the Shield Fort gate are module-level functions of the booted GM portal.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The six dwarven units': Unbreakable (foot facing Guard ×0.85, no side hit on Guard); Shield Fort's gate reads the
// front line, not the force (`shieldFortHolds`: half the occupied front cells Guard, a Dwarf Garrison counting; a Guard
// reserve behind a goblin front is no fort); Armour-Piercing ×1.25 shooting base strength 6+; Bombard ×1.15 from the
// second line; Crag Charge (Rams take the one mountain flank); Battering Horns (a free Ram turns an anchored line on
// open ground); Flak Gunners ×1.25 against flyers in the air or on a flank; Stone Halls ×0.9 for foot facing a Dwarf
// Garrison in the mountains
const {readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-6;

(async()=>{
  const errors=[];
  const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/gm',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  const w=dom.window; const ev=expr=>w.eval(expr);
  // A unit's facing holds values since plan P1-12d4: the prose writes its words.
  const facingWords=why=>ev('theWordsOfWhyAUnitFacesAsItDoes')(why);
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const G=ev('battleGrid'), F=ev('battleFacing'), SFH=ev('shieldFortHolds');
  ok(typeof SFH==='function','shieldFortHolds() is declared at module level');
  const BASE={'Dwarven Guard':12,'Ironwood Crossbows':8,'Mountain Guns':14,'Ironhoof Rams':12,'Gnomish Gyrocopters':10,'Dwarf Garrison':4,'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Warg Riders':10,'Orc Berserkers':12,'Goblin Horde':6,'Eagle Riders':12,'Men-at-Arms':12};
  const row=type=>({a:{type,quality:'Average',unitName:type},base:BASE[type]||8});
  const rows=spec=>[].concat(...spec.map(([t,n])=>Array.from({length:n},()=>row(t))));
  const fight=(mine,theirs,W,terrain,tacMe,tacThem)=>{
    const me=G(rows(mine),W,terrain,{tac:tacMe||0,enemy:rows(theirs),enemyTac:tacThem||0});
    const them=G(rows(theirs),W,terrain,{tac:tacThem||0,enemy:rows(mine),enemyTac:tacMe||0});
    F(me,them,terrain); return {me,them}; };
  const faced=(g,type)=>g.face.units.filter(u=>u.row.a.type===type);
  const whyOf=(g,type)=>faced(g,type).map(u=>facingWords(u.why)).join(' | ');

  // Unbreakable: foot facing Guard ×0.85; the Guard are never hit from the side
  let r=fight([['Shieldwall Levies',2]],[['Dwarven Guard',2]],2,'plain');
  ok(faced(r.me,'Shieldwall Levies').every(u=>near(u.m,0.85))&&/Unbreakable/.test(whyOf(r.me,'Shieldwall Levies')),`Unbreakable: Levies facing Guard ×0.85 — ${whyOf(r.me,'Shieldwall Levies')}`);
  r=fight([['Orc Berserkers',2]],[['Dwarven Guard',2]],2,'plain');
  ok(faced(r.me,'Orc Berserkers').every(u=>near(u.m,1.15*0.85)&&/Frenzy, Unbreakable/.test(facingWords(u.why))),`…Berserkers bring their Frenzy against it: ×0.9775 — ${whyOf(r.me,'Orc Berserkers')}`);
  r=fight([['Free Lances',2]],[['Dwarven Guard',2]],2,'forest');
  ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.85)&&!/Unbreakable/.test(facingWords(u.why))),'cavalry facing Guard keep cavalry\'s own ×0.85 only');
  r=fight([['Orc Berserkers',5]],[['Dwarven Guard',3]],5,'plain');
  ok(faced(r.them,'Dwarven Guard').every(u=>!/hit from the side/.test(facingWords(u.why)))&&/Unbreakable/.test(whyOf(r.them,'Dwarven Guard')),`a wrapped Guard line is not hit from the side — ${whyOf(r.them,'Dwarven Guard')}`);
  r=fight([['Dwarven Guard',3]],[['Orc Berserkers',5]],5,'plain');
  ok(faced(r.me,'Dwarven Guard').every(u=>!/hit from the side/.test(facingWords(u.why))),'…attacking or defending');

  // Shield Fort's gate: half the front line
  const cells=types=>({front:types.map(t=>t?{r:{a:{type:t}},role:'foot',s:1}:null)});
  ok(SFH([],cells(['Dwarven Guard','Dwarven Guard','Orc Berserkers','Goblin Horde']))===true,'two Guard in a front of four hold the fort');
  ok(SFH([],cells(['Dwarven Guard','Orc Berserkers','Goblin Horde','Goblin Horde']))===false,'one Guard in four does not');
  ok(SFH([],cells(['Dwarven Guard','Dwarf Garrison','Goblin Horde','Goblin Horde']))===true,'Deep Halls: a Dwarf Garrison counts as Guard');
  ok(SFH([],cells(['Dwarf Garrison','Goblin Horde']))===true&&SFH([],cells([null,'Goblin Horde','Dwarven Guard',null]))===true,'empty cells are not counted');
  ok(SFH([],cells(['Goblin Horde','Goblin Horde']))===false&&SFH([],cells([]))===false,'no Guard in the front, no fort');
  ok(SFH([{type:'Dwarven Guard'},{type:'Dwarven Guard'},{type:'Goblin Horde'}],null)===true&&SFH([{type:'Dwarven Guard'},{type:'Goblin Horde'},{type:'Goblin Horde'}],null)===false,'without a grid (an estimate) it reads half the force, as before');
  // …and a reserve of Guard behind a goblin front is no fort: the gate reads the front, not the force
  { const g=G(rows([['Goblin Horde',4],['Dwarven Guard',4]]),4,'plain',{tac:0}); // the stronger Guard take the front
    ok(SFH([],g)===true,'four Guard and four Goblins: the Guard, being stronger, hold the front → fort');
    const g2=G(rows([['Orc Berserkers',4],['Dwarven Guard',2]]),4,'plain',{tac:0});
    ok(SFH([],g2)===false,'two Guard behind four stronger Berserkers: no Guard in the front → no fort'); }

  // Armour-Piercing: Crossbows shooting a unit of base strength 6 or more ×1.25 (on top of the matchup)
  r=fight([['Dwarven Guard',2],['Ironwood Crossbows',2]],[['Orc Berserkers',2]],2,'plain');
  ok(faced(r.me,'Ironwood Crossbows').every(u=>near(u.m,1.25*1.25)&&/Armour-Piercing/.test(facingWords(u.why))),`Armour-Piercing against Berserkers (base 6): ×1.5625 — ${whyOf(r.me,'Ironwood Crossbows')}`);
  r=fight([['Dwarven Guard',2],['Ironwood Crossbows',2]],[['Goblin Horde',2]],2,'plain');
  ok(faced(r.me,'Ironwood Crossbows').every(u=>near(u.m,1.25*0.75)&&!/Armour-Piercing/.test(facingWords(u.why))),`…not against Goblins (base 3), who are Arrow Fodder instead: ×0.9375 — ${whyOf(r.me,'Ironwood Crossbows')}`);

  // Bombard: Guns ×1.15 from the second line whatever they shoot
  r=fight([['Dwarven Guard',2],['Mountain Guns',2]],[['Free Lances',2]],2,'forest');
  ok(faced(r.me,'Mountain Guns').every(u=>near(u.m,0.75*1.15)&&/Bombard/.test(facingWords(u.why))),`Bombard: ×1.15 on top of shooting cavalry ×0.75 — ${whyOf(r.me,'Mountain Guns')}`);

  // Crag Charge: Ironhoof Rams take the one flank slot in the mountains; Battering Horns: a free Ram turns an anchored line (open ground)
  r=fight([['Dwarven Guard',3],['Ironhoof Rams',1]],[['Orc Berserkers',3],['Warg Riders',1]],3,'mountain');
  ok(r.me.flanks.length===1&&r.me.flanks[0].r.a.type==='Ironhoof Rams'&&r.them.flanks.length===0,'in the mountains the Ram takes the flank and the Warg stands in the line');
  r=fight([['Dwarven Guard',3],['Ironhoof Rams',1]],[['Orc Berserkers',3]],3,'forest');
  ok(r.me.flanks.length===0,'in forest the Rams stand in the line (that ground is the Stags\')');
  r=fight([['Dwarven Guard',3],['Ironhoof Rams',1]],[['Shieldwall Levies',3],['Yeoman Longbows',3]],3,'plain');
  ok(r.them.face.anchored&&r.them.face.turned&&r.me.face.free===1,`Battering Horns: a Ram riding free turns a line that infantry anchor at both ends (anchored ${r.them.face.anchored}, turned ${r.them.face.turned}, free riders ${r.me.face.free})`);
  ok(faced(r.them,'Yeoman Longbows').every(u=>/flank turned \(Battering Horns\)/.test(facingWords(u.why))&&near(u.m,1.25*0.75)),`the Longbows behind it shoot at ×0.75 — ${whyOf(r.them,'Yeoman Longbows')}`);
  r=fight([['Dwarven Guard',3],['Free Lances',1]],[['Shieldwall Levies',3],['Yeoman Longbows',3]],3,'plain');
  ok(r.them.face.anchored&&!r.them.face.turned&&r.me.face.free===1,'…a free Free Lance does not');

  // Flak Gunners: Gyrocopters ×1.25 when the enemy has flyers (in the air or on a flank)
  r=fight([['Dwarven Guard',2],['Gnomish Gyrocopters',1]],[['Orc Berserkers',2],['Eagle Riders',1]],2,'forest');
  ok(faced(r.me,'Gnomish Gyrocopters').every(u=>near(u.m,1.25)&&/Flak Gunners/.test(facingWords(u.why))),`Flak Gunners against Eagles — ${whyOf(r.me,'Gnomish Gyrocopters')}`);
  r=fight([['Dwarven Guard',2],['Gnomish Gyrocopters',1]],[['Orc Berserkers',2]],2,'forest');
  ok(faced(r.me,'Gnomish Gyrocopters').every(u=>near(u.m,1)),'…and ×1 against an enemy with no flyers');

  // Stone Halls: foot facing a Dwarf Garrison in the mountains ×0.9
  r=fight([['Orc Berserkers',2]],[['Dwarf Garrison',2]],2,'mountain');
  ok(faced(r.me,'Orc Berserkers').every(u=>near(u.m,1.15*0.9))&&/Stone Halls/.test(whyOf(r.me,'Orc Berserkers')),`Stone Halls under the Berserkers' Frenzy: ×1.035 — ${whyOf(r.me,'Orc Berserkers')}`);
  r=fight([['Orc Berserkers',2]],[['Dwarf Garrison',2]],2,'plain');
  ok(faced(r.me,'Orc Berserkers').every(u=>near(u.m,1.15)),'…and nothing on the plain');

  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
