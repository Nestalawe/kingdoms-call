// 2026-10-13 (Toby, Creatures and Monsters V) — the beasts' battle-line abilities, as the decided table gave them
// (the humanoid units got theirs on 2026-10-11):
//   the flying beasts  (Thunderbirds, Manticore Pride, Crimson Rocs, Elder Dragons) fight from the air like the winged
//                      riders: no place in the line, full strength up to the enemy's line plus its flyers, half beyond
//   Thunderbirds       Storm Wings (every enemy unit in the air fights ×0.85) · Lightning Strike (unchanged)
//   Forest Ents        Rooted (never hit from the side when the enemy wraps their end) · Choking Spores (unchanged)
//   Great Bears        Maul (×1.15 facing foot) · Thick Hide (pre-battle volleys against them do half)
//   Stone Giants       Boulder Wall (cavalry facing them fights at no better than ×0.75) · Boulder Barrage (unchanged)
//   Unicorn Herd       Purity (×1.25 facing Monsters and skeletons; breaks a Spear Hedge or Boulder Wall, 2026-10-12) · Through the Glades (the one cavalry, with the
//                      Stag Riders, that takes the flank in forest and jungle)
//   Mammoth Host       Trample (×1.15 facing foot) · Stampede (unchanged)
//   Great Turtles      Shell Wall (immune to pre-battle volleys, as the Ironclads)
//   Cave Trolls        Regenerating Hide (a 30% chance to shrug off a death roll after a lost battle) · Hurled Rubble
//   Titan Warbeasts    Colossal Bulk (fights from the second line at full strength) · World-Shaking Charge
//   Dread Hydras       Many Heads (×1.25 facing foot) · Venom Breath (unchanged)
//   Shark Shoals       Shoal Swarm (+10% per other Shark Shoals in the force, to +30%) · Feeding Frenzy (tests/abilities-beasts-turn)
//   Manticore Pride    Relentless Hunt (unchanged) · the pursuit of a broken foe (tests/abilities-beasts-turn)
// Level 1 (unit): the grid, the facing, the fate rolls, unitAbilityMult and applyMissileHit are top-level functions of
// the engine, called directly in its bare vm (tests/lib/engine.ts). Until plan P1-09a this test booted the GM portal
// and ran a real turn so the hook at "  // 4. Run all 5 phases" could hand applyMissileHit back (it was nested inside
// runTurn then). Nothing here needs a battle's dice (the two rolls are fed).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The beasts' battle-line abilities (2026-10-13, Creatures and Monsters V): the flying beasts fight from the air; Storm
// Wings, Rooted, Boulder Wall, Maul, Trample, Many Heads, Purity, Through the Glades and Colossal Bulk on the faced
// grid; Shoal Swarm in `unitAbilityMult`; Shell Wall and Thick Hide in `applyMissileHit`; Regenerating Hide in
// `rollUnitFates` (fed rolls); it reads the fate lines' words with `theWordsOf` (facts since P1-12c6)
const vm=require('vm'); const {loadEngine,engineFn}=require('./lib/engine.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-6;

{
  const engine=loadEngine({seed:1}); const ev=expr=>vm.runInContext(expr,engine);
  // A unit's facing and its place in the grid hold values since plan P1-12d4: the prose writes their words.
  const facingWords=why=>ev('theWordsOfWhyAUnitFacesAsItDoes')(why), placeWords=why=>ev('theWordsOfWhyAUnitStandsWhereItDoes')(why);
  const wordsOf=l=>l==null||typeof l==='string'?l:ev('theWordsOf')(l); // a line's words: its words, or a fact's (the views write them, P1-12c6)
  const HIT=engineFn(engine,'applyMissileHit');
  const G=ev('battleGrid'), F=ev('battleFacing'), UAM=ev('unitAbilityMult'), FATES=ev('rollUnitFates');
  const BASE={'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Gilded Lances':12,'Orc Berserkers':12,'Noble Griffons':12,'Eagle Riders':12,
    'Thunderbirds':22,'Forest Ents':22,'Great Bears':22,'Stone Giants':26,'Unicorn Herd':26,'Mammoth Host':26,'Crimson Rocs':30,'Cave Trolls':22,'Manticore Pride':26,
    'Titan Warbeasts':36,'Elder Dragons':38,'Dread Hydras':38,'Shark Shoals':10,'Great Turtles':26};
  const row=(type,extra)=>({a:Object.assign({type,quality:'Average',unitName:type},extra||{}),base:BASE[type]||8});
  const rows=spec=>[].concat(...spec.map(([t,n,x])=>Array.from({length:n},()=>row(t,x))));
  // Place both sides and face them: `me` attacks, `them` defends.
  const fight=(mine,theirs,W,terrain,tacMe,tacThem)=>{
    const me=G(rows(mine),W,terrain,{tac:tacMe||0,enemy:rows(theirs),enemyTac:tacThem||0});
    const them=G(rows(theirs),W,terrain,{tac:tacThem||0,enemy:rows(mine),enemyTac:tacMe||0});
    F(me,them,terrain); return {me,them}; };
  const faced=(g,type)=>g.face.units.filter(u=>u.row.a.type===type);
  const whyOf=(g,type)=>faced(g,type).map(u=>facingWords(u.why)).join(' | ');
  const placed=(g,type)=>g.units.filter(u=>u.row.a.type===type);

  // ── The flying beasts fight from the air ──
  let r=fight([['Thunderbirds',1],['Manticore Pride',1],['Crimson Rocs',1],['Elder Dragons',1],['Forest Ents',2]],[['Shieldwall Levies',4],['Eagle Riders',1]],4,'plain');
  for(const t of ['Thunderbirds','Manticore Pride','Crimson Rocs','Elder Dragons']) ok(placed(r.me,t).every(u=>u.place==='air'&&near(u.mult,1)),`${t} fight from the air at full strength (got ${placed(r.me,t).map(u=>u.place+' ×'+u.mult).join(', ')})`);
  ok(placed(r.me,'Forest Ents').every(u=>u.place==='front'),'the walking beasts still hold the front');
  ok(r.me.front.filter(Boolean).length===2,'four flying beasts take no place in a front of four: the two Ents hold it alone');
  r=fight([['Elder Dragons',4]],[['Shieldwall Levies',1]],1,'plain');
  ok(placed(r.me,'Elder Dragons').filter(u=>near(u.mult,1)).length===2&&placed(r.me,'Elder Dragons').filter(u=>near(u.mult,0.5)).length===2,`four Dragons over one Levy company: two at full strength (the cap never falls below two), two at half beyond the line (got ${placed(r.me,'Elder Dragons').map(u=>u.mult).join(', ')})`);

  // ── Storm Wings: with Thunderbirds on the other side, every enemy unit in the air fights ×0.85 ──
  // (Noble Griffons, not Eagle Riders: on open ground an Eagle leaves the air for an empty flank slot — Stoop on the Horses.)
  r=fight([['Shieldwall Levies',2],['Thunderbirds',1]],[['Shieldwall Levies',2],['Noble Griffons',1],['Crimson Rocs',1]],2,'plain');
  ok(faced(r.them,'Noble Griffons').every(u=>near(u.m,0.85)&&/Storm Wings/.test(facingWords(u.why)))&&faced(r.them,'Crimson Rocs').every(u=>near(u.m,0.85)&&/Storm Wings/.test(facingWords(u.why))),`Storm Wings: the Griffons and the Rocs in the air fight ×0.85 — ${whyOf(r.them,'Noble Griffons')} | ${whyOf(r.them,'Crimson Rocs')}`);
  ok(faced(r.them,'Shieldwall Levies').every(u=>!/Storm Wings/.test(facingWords(u.why))),'…the Levies on the ground are not touched');
  ok(faced(r.me,'Thunderbirds').every(u=>near(u.m,1)),'the Thunderbirds themselves fight even in the air');
  r=fight([['Shieldwall Levies',2],['Crimson Rocs',1]],[['Shieldwall Levies',2],['Noble Griffons',1]],2,'plain');
  ok(faced(r.them,'Noble Griffons').every(u=>near(u.m,1)&&!/Storm Wings/.test(facingWords(u.why))),'no Thunderbirds, no Storm Wings');
  // Storm Wings and Flak Gunners both tell: a Gyrocopter facing enemy flyers under Thunderbirds fights ×1.25 × ×0.85
  r=fight([['Shieldwall Levies',2],['Thunderbirds',1]],[['Shieldwall Levies',2],['Gnomish Gyrocopters',1]],2,'plain');
  ok(faced(r.them,'Gnomish Gyrocopters').every(u=>near(u.m,1.25*0.85)&&/Flak Gunners/.test(facingWords(u.why))&&/Storm Wings/.test(facingWords(u.why))),`Flak Gunners and Storm Wings stack on a Gyrocopter — ${whyOf(r.them,'Gnomish Gyrocopters')}`);

  // ── Rooted: a Forest Ents company at a wrapped end is never hit from the side ──
  r=fight([['Orc Berserkers',5]],[['Forest Ents',3]],5,'plain');
  ok(faced(r.them,'Forest Ents').every(u=>!/hit from the side/.test(facingWords(u.why)))&&faced(r.them,'Forest Ents').filter(u=>/Rooted/.test(facingWords(u.why))).length===2,`Rooted: both end Ents stand unshaken by the wrap — ${whyOf(r.them,'Forest Ents')}`);
  r=fight([['Forest Ents',3]],[['Orc Berserkers',5]],5,'plain');
  ok(faced(r.me,'Forest Ents').filter(u=>/Rooted/.test(facingWords(u.why))).length===2,'…attacking too: roots hold either way');
  r=fight([['Orc Berserkers',5]],[['Stone Giants',3]],5,'plain');
  ok(faced(r.them,'Stone Giants').filter(u=>/hit from the side/.test(facingWords(u.why))).length===2,'Stone Giants at the ends are hit from the side like anyone');

  // ── Boulder Wall: cavalry facing Stone Giants fights at no better than ×0.75 ──
  r=fight([['Free Lances',2]],[['Stone Giants',2]],2,'forest');
  ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.75)&&/Boulder Wall/.test(facingWords(u.why))),`Boulder Wall: Free Lances facing Giants ×0.75 — ${whyOf(r.me,'Free Lances')}`);
  r=fight([['Gilded Lances',2]],[['Stone Giants',2]],2,'forest');
  ok(faced(r.me,'Gilded Lances').every(u=>near(u.m,0.75)&&/Boulder Wall/.test(facingWords(u.why))),`…and it caps a Lance Charge — ${whyOf(r.me,'Gilded Lances')}`);
  r=fight([['Free Lances',2]],[['Forest Ents',2]],2,'forest');
  ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.85)&&!/Boulder Wall/.test(facingWords(u.why))),'cavalry facing Ents keep cavalry\'s ×0.85 (no wall of boulders)');
  ok(faced(r.them,'Forest Ents').every(u=>near(u.m,1.15)),'the Ents fight the horse at ×1.15 as infantry does');

  // ── Maul, Trample, Many Heads: ×1.15, ×1.15 and ×1.25 facing foot; nothing facing horse ──
  r=fight([['Great Bears',1],['Mammoth Host',1],['Dread Hydras',1]],[['Orc Berserkers',3]],3,'forest');
  ok(faced(r.me,'Great Bears').every(u=>near(u.m,1.15)&&/Maul/.test(facingWords(u.why))),`Maul: Great Bears facing Berserkers ×1.15 — ${whyOf(r.me,'Great Bears')}`);
  ok(faced(r.me,'Mammoth Host').every(u=>near(u.m,1.15)&&/Trample/.test(facingWords(u.why))),`Trample: the Mammoth Host facing Berserkers ×1.15 — ${whyOf(r.me,'Mammoth Host')}`);
  ok(faced(r.me,'Dread Hydras').every(u=>near(u.m,1.25)&&/Many Heads/.test(facingWords(u.why))),`Many Heads: the Dread Hydras facing Berserkers ×1.25 — ${whyOf(r.me,'Dread Hydras')}`);
  r=fight([['Great Bears',1],['Mammoth Host',1],['Dread Hydras',1]],[['Free Lances',3]],3,'forest');
  ok(['Great Bears','Mammoth Host','Dread Hydras'].every(t=>faced(r.me,t).every(u=>near(u.m,1.15)&&!/Maul|Trample|Many Heads/.test(facingWords(u.why)))),'facing horse the three fight at infantry\'s ×1.15 with no ability of their own');
  r=fight([['Great Bears',1],['Mammoth Host',1],['Dread Hydras',1]],[['Yeoman Longbows',3]],3,'forest');
  ok(['Great Bears','Mammoth Host','Dread Hydras'].every(t=>faced(r.me,t).every(u=>near(u.m,1.25)&&!/Maul|Trample|Many Heads/.test(facingWords(u.why)))),'facing archers caught in the front they fight at infantry\'s ×1.25, no more');

  // ── Purity: the Unicorn Herd facing a Monster or skeletons ×1.25 on top of the matchup ──
  r=fight([['Unicorn Herd',2]],[['Cave Trolls',2]],2,'forest');
  ok(faced(r.me,'Unicorn Herd').every(u=>near(u.m,0.85*1.25)&&/Purity/.test(facingWords(u.why))),`Purity: unicorns facing Cave Trolls ×0.85 × ×1.25 — ${whyOf(r.me,'Unicorn Herd')}`);
  r=fight([['Unicorn Herd',2]],[['Shieldwall Levies',2,{_isSkeletal:true}]],2,'forest');
  ok(faced(r.me,'Unicorn Herd').every(u=>near(u.m,0.85*1.25)&&/Purity breaks the Spear Hedge/.test(facingWords(u.why))),`…and facing skeletal Levies Purity breaks the Spear Hedge (Toby, 2026-10-12): ×0.85 × ×1.25 — ${whyOf(r.me,'Unicorn Herd')}`);
  r=fight([['Unicorn Herd',2]],[['Orc Berserkers',2]],2,'forest');
  ok(faced(r.me,'Unicorn Herd').every(u=>near(u.m,0.85)&&!/Purity/.test(facingWords(u.why))),'facing living orcs the herd is plain cavalry');

  // ── Through the Glades: in forest and jungle the Unicorn Herd takes the one flank slot, as the Stag Riders do ──
  r=fight([['Shieldwall Levies',2],['Unicorn Herd',1]],[['Shieldwall Levies',3]],3,'forest');
  ok(r.me.flanks.length===1&&r.me.flanks[0].r.a.type==='Unicorn Herd',`Through the Glades: the herd takes the forest flank (flanks: ${r.me.flanks.map(x=>x.r.a.type).join(', ')||'none'})`);
  r=fight([['Shieldwall Levies',2],['Free Lances',1]],[['Shieldwall Levies',3]],3,'forest');
  ok(r.me.flanks.length===0,'Free Lances find no flank in the forest');
  r=fight([['Shieldwall Levies',2],['Unicorn Herd',1]],[['Shieldwall Levies',3]],3,'mountain');
  ok(r.me.flanks.length===0,'…and the herd none in the mountains (that is the Rams\' Crag Charge)');

  // ── Colossal Bulk: a Titan Warbeasts company in the second line fights at full strength ──
  r=fight([['Titan Warbeasts',2]],[['Shieldwall Levies',1]],1,'plain');
  { const t=placed(r.me,'Titan Warbeasts'); ok(t.length===2&&t.some(u=>u.place==='front')&&t.some(u=>u.place==='second'&&near(u.mult,1)&&/Colossal Bulk/.test(placeWords(u.why))),`Colossal Bulk: the second Titan fights from the second line at ×1 (got ${t.map(u=>u.place+' ×'+u.mult).join(', ')})`); }
  r=fight([['Stone Giants',2]],[['Shieldwall Levies',1]],1,'plain');
  ok(placed(r.me,'Stone Giants').some(u=>u.place==='second'&&near(u.mult,0.5)),'a second Giant behind the first fights at ×0.5, as foot in the second line does');

  // ── Shoal Swarm: +10% per other Shark Shoals in the force, to +30% ──
  const swarm=n=>UAM({type:'Shark Shoals'},{force:Array.from({length:n},()=>({type:'Shark Shoals'})),enemyForce:[{type:'Galleon Fleet'}]},'sea');
  ok(near(swarm(1),1)&&near(swarm(2),1.1)&&near(swarm(3),1.2)&&near(swarm(4),1.3)&&near(swarm(6),1.3),`Shoal Swarm: one shoal ×1, two ×1.1, three ×1.2, four ×1.3, six still ×1.3 (got ${[1,2,3,4,6].map(swarm).join(', ')})`);
  ok(near(UAM({type:'Shark Shoals'},{force:[{type:'Shark Shoals'},{type:'Whale Cohort'},{type:'Galleon Fleet'}],enemyForce:[]},'sea'),1),'whales and hulls do not swell the shoal');

  // ── Shell Wall and Thick Hide: the pre-battle volley ──
  { const shot=(type)=>{ const t={type,quality:'Average',unitName:type}; const h=HIT(t,2,{type:'Yeoman Longbows',quality:'Average'},{}); return {h,t}; };
    const turtle=shot('Great Turtles');
    ok(turtle.h.immune===true&&turtle.h.dmg===0&&!turtle.t._tempStrReduction,'Shell Wall: a volley at the Great Turtles does nothing (immune, as the Ironclads)');
    ok(ev("missileCapReached({type:'Great Turtles'},{type:'Yeoman Longbows'})")===true,'…and archers never waste a shot on them (the target pool skips them)');
    // Thick Hide: the same roll, half the damage (the roll is pinned so the two shots are the same shot)
    ev('kcRng.use(()=>0.5)');
    const levy=shot('Shieldwall Levies'), bear=shot('Great Bears');
    ok(levy.h.dmg>=2&&bear.h.dmg===Math.ceil(levy.h.dmg/2)&&bear.h.thickHide===true,`Thick Hide: the shot that takes ${levy.h.dmg} from Levies takes ${bear.h.dmg} from Great Bears (half, rounded up)`); }

  // ── Regenerating Hide: a troll that fails its death roll after a lost battle shrugs it off three times in ten ──
  { const mk=()=>({type:'Cave Trolls',quality:'Veteran',unitName:'Cave Trolls'}); const said=[];
    const feed=vals=>{ let i=0; return ()=>vals[Math.min(i++,vals.length-1)]; };
    const force=[mk(),mk()];
    // troll 1: dies on the first roll (0 < dieAt 1), regenerates on 0.1 (< 0.30); troll 2: dies, fails to regenerate on 0.5
    const res=FATES(force,{owner:{heroName:'Test',leaderless:false},won:false,dieAt:()=>1,demoteAt:()=>0,promoteTo:()=>0,rng:feed([0,0.1,0,0.5]),say:s=>said.push(wordsOf(s))});
    ok(!force[0]._died&&force[1]._died===true&&res.died===1&&res.survived===1,`one troll regenerates and one is destroyed (died ${res.died}, survived ${res.survived})`);
    ok(said.filter(s=>/Regenerating Hide/.test(s)).length===1,`one line names the Regenerating Hide — ${said.join(' / ')}`);
    const won=[mk()]; FATES(won,{owner:{heroName:'Test',leaderless:false},won:true,dieAt:()=>1,promoteTo:()=>0,rng:feed([0,0.1])});
    ok(won[0]._died===true,'a troll destroyed in a victory gets no regeneration roll (the hide knits in flight, not in the press of the win)');
    const other=[{type:'Stone Giants',quality:'Veteran',unitName:'Stone Giants'}]; FATES(other,{owner:{heroName:'Test',leaderless:false},won:false,dieAt:()=>1,demoteAt:()=>0,promoteTo:()=>0,rng:feed([0,0.1])});
    ok(other[0]._died===true,'a Giant gets no such roll'); }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
}
