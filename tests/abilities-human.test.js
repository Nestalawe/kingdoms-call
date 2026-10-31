// 2026-10-11 (Toby, the unit abilities) — the Human units' abilities, each a matchup and one more:
//   Shieldwall Levies   Spear Hedge (cavalry facing them fights at most ×0.75) · Shieldwall (×1.25 with an
//                       archer in the second line behind them; the old "two Levies in the force" is gone)
//   Men-at-Arms         Halberds (×1.25 facing cavalry) · Sergeants (Levies beside them in the front ×1.1)
//   Yeoman Longbows     Bodkin Points (no ×0.75 shooting cavalry from the second line) · Prepared Ground
//                       (defending, they loose two pre-battle volleys: tests/abilities-volleys) — Massed Volley is gone
//   Free Lances         Harriers (×1.15 in a flank duel) · Ride Them Down (unchanged)
//   Gilded Lances       Lance Charge (×1.15 facing foot, where cavalry was ×0.85) · Knightly Example (Levies and
//                       Men-at-Arms never lose a tier in defeat while a Gilded unit is in the army) — Shock of the
//                       Charge (+40% attacking) is gone
//   Noble Griffons      Dive on the Bowmen (one enemy second-line archer, the strongest, ×0.75) · Screech Dive (unchanged)
//   Human Garrison      Hold the Gate (defending, never hit from the side) · Town Watch (counts as Levies for
//                       Shieldwall and anchoring)
// Level 1 (unit): the grid, the facing and the fate rolls are module-level functions of the booted GM portal;
// unitAbilityMult and missileDamageMult are module level too. Nothing here needs a battle's dice.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The seven human units' abilities on the battle grid (booted GM portal: `battleGrid`, `battleFacing`,
// `unitAbilityMult`, `missileDamageMult`, `abilityVolleys`, `rollUnitFates`): Spear Hedge caps cavalry facing Levies at
// ×0.75 (a Lance Charge too); Shieldwall ×1.25 only with an archer behind in the column; Town Watch counts a Human
// Garrison as Levies; Halberds ×1.25 v cavalry; Sergeants ×1.1 for Levies beside Men-at-Arms; Bodkin Points shoot
// cavalry at ×1; Harriers ×1.15 in a flank duel; Lance Charge ×1.15 v foot; Dive on the Bowmen ×0.75 on the strongest
// second-line archer; Hold the Gate spares a defending garrison the side hit; Knightly Example keeps Levies and
// Men-at-Arms from losing a tier; Shock of the Charge gone; it reads the fate lines' words with the page's `theWordsOf`
// (facts since P1-12c6)
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
  const wordsOf=l=>l==null||typeof l==='string'?l:ev('theWordsOf')(l); // a line's words: its words, or a fact's (the views write them, P1-12c6)
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const G=ev('battleGrid'), F=ev('battleFacing'), UAM=ev('unitAbilityMult'), MDM=ev('missileDamageMult'), FATES=ev('rollUnitFates');
  const BASE={'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Gilded Lances':12,'Men-at-Arms':12,'Human Garrison':4,'Noble Griffons':12,'Warg Riders':10,'Orc Berserkers':12,'Elven Bowmen':10};
  const row=type=>({a:{type,quality:'Average',unitName:type},base:BASE[type]||8});
  const rows=spec=>[].concat(...spec.map(([t,n])=>Array.from({length:n},()=>row(t))));
  // Place both sides and face them: `me` attacks, `them` defends.
  const fight=(mine,theirs,W,terrain,tacMe,tacThem)=>{
    const me=G(rows(mine),W,terrain,{tac:tacMe||0,enemy:rows(theirs),enemyTac:tacThem||0});
    const them=G(rows(theirs),W,terrain,{tac:tacThem||0,enemy:rows(mine),enemyTac:tacMe||0});
    F(me,them,terrain); return {me,them}; };
  const faced=(g,type)=>g.face.units.filter(u=>u.row.a.type===type);
  const whyOf=(g,type)=>faced(g,type).map(u=>facingWords(u.why)).join(' | ');

  // Spear Hedge: cavalry facing Levies fights at most ×0.75 (it was ×0.85 as cavalry v infantry); Levies still ×1.15 v cavalry
  let r=fight([['Free Lances',2]],[['Shieldwall Levies',2]],2,'forest');
  ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.75))&&/Spear Hedge/.test(whyOf(r.me,'Free Lances')),`Spear Hedge: Free Lances facing Levies ×0.75 — ${whyOf(r.me,'Free Lances')}`);
  ok(faced(r.them,'Shieldwall Levies').every(u=>near(u.m,1.15)),'the Levies still fight cavalry at ×1.15');
  // …and it caps a Lance Charge too
  r=fight([['Gilded Lances',2]],[['Shieldwall Levies',2]],2,'forest');
  ok(faced(r.me,'Gilded Lances').every(u=>near(u.m,0.75))&&/Spear Hedge/.test(whyOf(r.me,'Gilded Lances')),`Spear Hedge caps the Gilded Lances' charge at ×0.75 — ${whyOf(r.me,'Gilded Lances')}`);
  // Lance Charge: Gilded Lances facing other foot ×1.15 (cavalry v infantry was ×0.85)
  r=fight([['Gilded Lances',2]],[['Orc Berserkers',2]],2,'forest');
  ok(faced(r.me,'Gilded Lances').every(u=>near(u.m,1.15))&&/Lance Charge/.test(whyOf(r.me,'Gilded Lances')),`Lance Charge: Gilded Lances facing Berserkers ×1.15 — ${whyOf(r.me,'Gilded Lances')}`);
  r=fight([['Free Lances',2]],[['Orc Berserkers',2]],2,'forest');
  ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.85)),'Free Lances facing Berserkers keep cavalry\'s ×0.85 (no charge of their own)');

  // Shieldwall: ×1.25 only with an archer in the second line of the same column
  r=fight([['Shieldwall Levies',2],['Yeoman Longbows',2]],[['Orc Berserkers',2]],2,'plain');
  ok(faced(r.me,'Shieldwall Levies').every(u=>near(u.m,1.25))&&/Shieldwall/.test(whyOf(r.me,'Shieldwall Levies')),`Shieldwall: Levies with Longbows behind them ×1.25 — ${whyOf(r.me,'Shieldwall Levies')}`);
  r=fight([['Shieldwall Levies',4]],[['Orc Berserkers',2]],4,'plain');
  ok(faced(r.me,'Shieldwall Levies').every(u=>!/Shieldwall/.test(facingWords(u.why))),'four Levies with nobody behind them get no Shieldwall');
  r=fight([['Shieldwall Levies',2],['Yeoman Longbows',1]],[['Orc Berserkers',2]],2,'plain');
  ok(faced(r.me,'Shieldwall Levies').filter(u=>/Shieldwall/.test(facingWords(u.why))).length===1,'one Longbow company behind two Levies shields the one it stands behind');
  ok(near(UAM({type:'Shieldwall Levies'},{force:[{type:'Shieldwall Levies'},{type:'Shieldwall Levies'},{type:'Shieldwall Levies'}],enemyForce:[]},'plain'),1),'unitAbilityMult no longer lifts Levies for standing together (Shieldwall moved to the grid)');

  // Town Watch: a Human Garrison counts as Levies for Shieldwall (and anchors a line, as foot always did)
  r=fight([['Human Garrison',2],['Yeoman Longbows',2]],[['Orc Berserkers',2]],2,'plain');
  ok(faced(r.me,'Human Garrison').every(u=>near(u.m,1.25)&&/Shieldwall/.test(facingWords(u.why))),`Town Watch: a garrison with Longbows behind it locks shields ×1.25 — ${whyOf(r.me,'Human Garrison')}`);

  // Halberds: Men-at-Arms facing cavalry ×1.25 (infantry v cavalry is ×1.15)
  r=fight([['Men-at-Arms',2]],[['Warg Riders',2]],2,'forest');
  ok(faced(r.me,'Men-at-Arms').every(u=>near(u.m,1.25))&&/Halberds/.test(whyOf(r.me,'Men-at-Arms')),`Halberds: Men-at-Arms facing Wargs ×1.25 — ${whyOf(r.me,'Men-at-Arms')}`);
  r=fight([['Men-at-Arms',2]],[['Orc Berserkers',2]],2,'forest');
  ok(faced(r.me,'Men-at-Arms').every(u=>near(u.m,1)),'Men-at-Arms facing foot fight even');

  // Sergeants: Levies with a Men-at-Arms beside them in the front ×1.1 (stacks with Shieldwall)
  r=fight([['Men-at-Arms',1],['Shieldwall Levies',2]],[['Orc Berserkers',3]],3,'plain');
  { const maaCol=r.me.front.findIndex(x=>x&&x.r.a.type==='Men-at-Arms'); const lev=faced(r.me,'Shieldwall Levies');
    ok(maaCol===1,'the strongest unit, the Men-at-Arms, holds the centre column');
    ok(lev.length===2&&lev.every(u=>near(u.m,1.1)&&/Sergeants/.test(facingWords(u.why))),`Sergeants: both Levies beside the Men-at-Arms fight ×1.1 — ${whyOf(r.me,'Shieldwall Levies')}`); }
  r=fight([['Men-at-Arms',1],['Shieldwall Levies',2],['Yeoman Longbows',3]],[['Orc Berserkers',3]],3,'plain');
  ok(faced(r.me,'Shieldwall Levies').every(u=>near(u.m,1.375)),`Shieldwall and Sergeants stack (an archer behind every column): ×1.25 × ×1.1 = ×1.375 — ${whyOf(r.me,'Shieldwall Levies')}`);

  // Bodkin Points: Longbows shooting cavalry from the second line at ×1 (other archers ×0.75)
  r=fight([['Shieldwall Levies',2],['Yeoman Longbows',2]],[['Warg Riders',2]],2,'forest');
  ok(faced(r.me,'Yeoman Longbows').every(u=>u.place==='second'&&near(u.m,1)&&/Bodkin/.test(facingWords(u.why))),`Bodkin Points: Longbows shoot the Wargs opposite at ×1 — ${whyOf(r.me,'Yeoman Longbows')}`);
  r=fight([['Shieldwall Levies',2],['Elven Bowmen',2]],[['Warg Riders',2]],2,'forest');
  ok(faced(r.me,'Elven Bowmen').every(u=>u.place==='second'&&!/Bodkin/.test(facingWords(u.why))),'…Bowmen have no Bodkin Points (their own ability is Volley at the Charge)');
  ok(near(MDM({type:'Yeoman Longbows'},[{type:'Yeoman Longbows'},{type:'Yeoman Longbows'},{type:'Yeoman Longbows'}],'plain',{type:'Orc Berserkers'},true),1),'Massed Volley is gone: three Longbow companies together volley at ×1');

  // Harriers: Free Lances in a flank duel ×1.15
  r=fight([['Shieldwall Levies',2],['Free Lances',1]],[['Shieldwall Levies',2],['Warg Riders',1]],2,'plain');
  ok(r.me.face.duels===1,'one flank duel');
  ok(faced(r.me,'Free Lances').every(u=>u.kind==='duel'&&/Harriers/.test(facingWords(u.why))),`Harriers: the Free Lance duels at ×1.15 — ${whyOf(r.me,'Free Lances')}`);
  { const fl=faced(r.me,'Free Lances')[0], wg=faced(r.them,'Warg Riders')[0];
    ok(fl&&near(fl.m,1.15)&&wg&&near(wg.m,1.25),`…the Warg answers with Wolves Panic Horses ×1.25 (got ${fl&&fl.m} v ${wg&&wg.m})`); }
  r=fight([['Shieldwall Levies',2],['Free Lances',1]],[['Shieldwall Levies',3]],3,'plain');
  ok(faced(r.me,'Free Lances').every(u=>u.kind!=='duel'&&!/Harriers/.test(facingWords(u.why))),'a Free Lance with no duel (it guards an end or rides free) gets no Harriers');

  // Shock of the Charge is gone
  ok(near(UAM({type:'Gilded Lances'},{force:[{type:'Gilded Lances'}],enemyForce:[{type:'Orc Berserkers'}],isAttacker:true},'plain'),1),'unitAbilityMult no longer gives Gilded Lances +40% attacking');

  // Dive on the Bowmen: with Noble Griffons overhead, the enemy's strongest second-line archer fights ×0.75
  r=fight([['Shieldwall Levies',2],['Noble Griffons',1]],[['Orc Berserkers',2],['Yeoman Longbows',1],['Elven Bowmen',1]],2,'plain');
  { const dived=r.them.face.units.filter(u=>/Griffon/.test(facingWords(u.why)));
    ok(dived.length===1&&dived[0].row.a.type==='Elven Bowmen'&&near(dived[0].m,0.75*1.25),`Dive on the Bowmen: one archer, the strongest (Bowmen 10 over Longbows 8), at ×0.75 on top of its matchup — ${dived.map(u=>facingWords(u.why)).join(' | ')}`); }
  r=fight([['Shieldwall Levies',2]],[['Orc Berserkers',2],['Yeoman Longbows',2]],2,'plain');
  ok(r.them.face.units.every(u=>!/Griffon/.test(facingWords(u.why))),'no Griffons, no dive');

  // Hold the Gate: a defending Human Garrison at a wrapped end is not hit from the side; attacking it would be
  r=fight([['Orc Berserkers',5]],[['Human Garrison',3]],5,'plain');
  ok(faced(r.them,'Human Garrison').every(u=>!/hit from the side/.test(facingWords(u.why)))&&/Hold the Gate/.test(whyOf(r.them,'Human Garrison')),`Hold the Gate: the garrison's end units are not hit from the side — ${whyOf(r.them,'Human Garrison')}`);
  r=fight([['Human Garrison',3]],[['Orc Berserkers',5]],5,'plain');
  ok(faced(r.me,'Human Garrison').filter(u=>/hit from the side/.test(facingWords(u.why))).length===2,'…but a garrison that attacks is hit from the side like anyone');
  r=fight([['Orc Berserkers',5]],[['Shieldwall Levies',3]],5,'plain');
  ok(faced(r.them,'Shieldwall Levies').filter(u=>/hit from the side/.test(facingWords(u.why))).length===2,'defending Levies are still hit from the side');

  // Knightly Example: Levies and Men-at-Arms never lose a tier in defeat while a Gilded Lances unit is in the army
  { const mk=(type,q)=>({type,quality:q||'Veteran',unitName:type}); const said=[];
    const force=[mk('Shieldwall Levies'),mk('Men-at-Arms'),mk('Yeoman Longbows'),mk('Gilded Lances')];
    const res=FATES(force,{owner:{heroName:'Test',leaderless:false},won:false,dieAt:()=>0,demoteAt:()=>1,promoteTo:()=>0,rng:()=>0.5,say:s=>said.push(wordsOf(s))});
    ok(force[0].quality==='Veteran'&&force[1].quality==='Veteran','the Levies and the Men-at-Arms keep Veteran though the roll said demote');
    ok(force[2].quality==='Average'&&force[3].quality==='Average','the Longbows and the Gilded Lances themselves still lose a tier');
    ok(res.held===2&&res.demoted===2,`two held, two demoted (got held ${res.held}, demoted ${res.demoted})`);
    ok(said.filter(s=>/Knightly Example/.test(s)).length===2,`two lines name the Knightly Example — ${said.join(' / ')}`);
    const force2=[mk('Shieldwall Levies'),mk('Men-at-Arms')];
    FATES(force2,{owner:{heroName:'Test',leaderless:false},won:false,dieAt:()=>0,demoteAt:()=>1,promoteTo:()=>0,rng:()=>0.5});
    ok(force2.every(a=>a.quality==='Average'),'without a Gilded unit they lose a tier as before'); }

  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
