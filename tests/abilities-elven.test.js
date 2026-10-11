// 2026-10-11 (Toby, the unit abilities) — the Elven units' abilities, each a matchup and one more:
//   Forest Wardens   Woodland Skirmish (×1.15 in forest and jungle, facing anyone) · Ambush (unchanged, but see Eyes of the Forest)
//   Elven Bowmen     Volley at the Charge (×1.25 shooting cavalry from the second line) · Woodland Volley (unchanged)
//   Shadow Archers   Marksmen (×1.25 shooting archers, and they pick the best target along the enemy front) · Loosed From Cover (unchanged)
//   Stag Riders      Through the Trees (the one cavalry that takes a flank in forest and jungle) · Forest Runners (the terrain table, tests/roster)
//   Eagle Riders     Stoop on the Horses (may hold a flank slot on open ground; ×1.25 facing cavalry) · Eyes of the Forest
//                    (while they fly with the shooters, an enemy Ambush is spoiled and Shadow Archers can be shot at) — Skyward Retreat is gone
//   Elven Garrison   Thorn Hedge (cavalry facing it in the woods ×0.85) · Tree Watch (in forest or jungle it shoots like an archer)
// Level 1 (unit): the grid and the facing are module-level functions of the booted GM portal, as are the volley
// helpers (abilityMissileUnits, archeryBlockedBy, missileTargetPool). The Skyward Retreat lines lived inside
// runTurn and are checked gone in the source.
const fs=require('fs');
const {readPage,bootJsdom,sitePath}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-6;

(async()=>{
  const errors=[];
  const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/gm',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  const w=dom.window; const ev=expr=>w.eval(expr);
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const G=ev('battleGrid'), F=ev('battleFacing'), AMU=ev('abilityMissileUnits'), ABB=ev('archeryBlockedBy'), MTP=ev('missileTargetPool');
  const BASE={'Forest Wardens':8,'Elven Bowmen':10,'Shadow Archers':14,'Stag Riders':12,'Eagle Riders':12,'Elven Garrison':4,'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Warg Riders':10,'Orc Berserkers':12,'Goblin Horde':6};
  const row=type=>({a:{type,quality:'Average',unitName:type},base:BASE[type]||8});
  const rows=spec=>[].concat(...spec.map(([t,n])=>Array.from({length:n},()=>row(t))));
  const fight=(mine,theirs,W,terrain,tacMe,tacThem)=>{
    const me=G(rows(mine),W,terrain,{tac:tacMe||0,enemy:rows(theirs),enemyTac:tacThem||0});
    const them=G(rows(theirs),W,terrain,{tac:tacThem||0,enemy:rows(mine),enemyTac:tacMe||0});
    F(me,them,terrain); return {me,them}; };
  const faced=(g,type)=>g.face.units.filter(u=>u.row.a.type===type);
  const whyOf=(g,type)=>faced(g,type).map(u=>u.why).join(' | ');

  // Woodland Skirmish: Wardens ×1.15 in forest and jungle, facing anyone; nothing on the plain
  let r=fight([['Forest Wardens',2]],[['Orc Berserkers',2]],2,'forest');
  ok(faced(r.me,'Forest Wardens').every(u=>near(u.m,1.15))&&/Woodland Skirmish/.test(whyOf(r.me,'Forest Wardens')),`Woodland Skirmish in forest — ${whyOf(r.me,'Forest Wardens')}`);
  r=fight([['Forest Wardens',2]],[['Free Lances',2]],2,'jungle');
  ok(faced(r.me,'Forest Wardens').every(u=>near(u.m,1.15*1.15)),`…in jungle it stacks with infantry v cavalry: ×1.3225 — ${whyOf(r.me,'Forest Wardens')}`);
  r=fight([['Forest Wardens',2]],[['Orc Berserkers',2]],2,'plain');
  ok(faced(r.me,'Forest Wardens').every(u=>near(u.m,1)),'…and nothing on the plain');

  // Volley at the Charge: Bowmen shooting cavalry from the second line ×1.25 (×0.75 for other archers)
  r=fight([['Forest Wardens',2],['Elven Bowmen',2]],[['Warg Riders',2]],2,'forest');
  ok(faced(r.me,'Elven Bowmen').every(u=>u.place==='second'&&near(u.m,1.25)&&/Volley at the Charge/.test(u.why)),`Volley at the Charge — ${whyOf(r.me,'Elven Bowmen')}`);
  r=fight([['Forest Wardens',2],['Elven Bowmen',2]],[['Orc Berserkers',2]],2,'forest');
  ok(faced(r.me,'Elven Bowmen').every(u=>near(u.m,1.25)&&!/Volley at the Charge/.test(u.why)),'shooting infantry they keep the ordinary ×1.25');

  // Marksmen: Shadow Archers shooting archers ×1.25, and they pick the best target along the enemy front
  r=fight([['Forest Wardens',2],['Shadow Archers',2]],[['Yeoman Longbows',2]],2,'plain');
  ok(faced(r.me,'Shadow Archers').every(u=>near(u.m,1.25)&&/Marksmen/.test(u.why)),`Marksmen against Longbows caught in the front — ${whyOf(r.me,'Shadow Archers')}`);
  r=fight([['Forest Wardens',3],['Shadow Archers',1]],[['Goblin Horde',1],['Orc Berserkers',1],['Free Lances',1]],3,'forest');
  { const sa=faced(r.me,'Shadow Archers')[0];
    // the three enemy front units: Berserkers 12 (foot ×1.25 = 15), Free Lances 10 (cav ×0.75 = 7.5), Goblins 6 (foot ×1.25 × Arrow Fodder ×0.75 = 5.6): the Berserkers are the best shot
    ok(sa&&sa.vs&&sa.vs.a.type==='Orc Berserkers'&&near(sa.m,1.25),`the Shadow Archers pick the Berserkers (the best target along the line), not whoever stands opposite — ${sa&&sa.why}`); }
  r=fight([['Forest Wardens',3],['Elven Bowmen',1]],[['Goblin Horde',1],['Orc Berserkers',1],['Free Lances',1]],3,'forest');
  { const eb=faced(r.me,'Elven Bowmen')[0]; const c=r.me.second.findIndex(x=>x&&x.r.a.type==='Elven Bowmen');
    ok(eb&&eb.vs===(r.them.front[c]&&r.them.front[c].r),'…while Bowmen still shoot whoever stands opposite'); }

  // Through the Trees: Stag Riders take the one flank slot rough ground allows (forest, jungle); Wargs cannot
  r=fight([['Forest Wardens',3],['Stag Riders',2]],[['Orc Berserkers',3],['Warg Riders',2]],3,'forest');
  ok(r.me.flanks.length===1&&r.me.flanks[0].r.a.type==='Stag Riders'&&r.them.flanks.length===0,`in forest one Stag unit takes the flank and the Wargs stand in the line (got ${r.me.flanks.length} / ${r.them.flanks.length})`);
  ok(r.me.face.free===1&&faced(r.me,'Stag Riders').some(u=>u.kind==='free'&&near(u.m,1.3)),'the Stag rider rides free at ×1.3 (no enemy rider to duel)');
  ok(!r.them.face.turned,'…but on rough ground it turns no line');
  r=fight([['Forest Wardens',3],['Stag Riders',2]],[['Orc Berserkers',3]],3,'mountain');
  ok(r.me.flanks.length===0,'in the mountains the Stag Riders stand in the line (that ground is the Rams\')');
  r=fight([['Forest Wardens',3],['Stag Riders',2]],[['Orc Berserkers',3]],3,'plain',1);
  ok(r.me.flanks.length===2,'on the plain they flank like any cavalry (Tactical 1: two slots)');

  // Stoop on the Horses: on open ground Eagle Riders hold a flank slot no rider fills, and fight cavalry at ×1.25
  r=fight([['Forest Wardens',3],['Eagle Riders',1]],[['Orc Berserkers',3],['Warg Riders',1]],3,'plain');
  ok(r.me.flanks.length===1&&r.me.flanks[0].r.a.type==='Eagle Riders'&&r.me.fly.length===0,'with no rider of its own, the Eagle unit leaves the air for the flank');
  ok(r.me.face.duels===1&&faced(r.me,'Eagle Riders').every(u=>u.kind==='duel'&&near(u.m,1.25)&&/Stoop on the Horses/.test(u.why)),`it duels the Warg at ×1.25 — ${whyOf(r.me,'Eagle Riders')}`);
  r=fight([['Forest Wardens',3],['Stag Riders',1],['Eagle Riders',1]],[['Orc Berserkers',3]],3,'plain');
  ok(r.me.flanks.length===1&&r.me.flanks[0].r.a.type==='Stag Riders'&&r.me.fly.length===1,'a rider fills the slot first; the Eagles stay in the air');
  r=fight([['Forest Wardens',3],['Eagle Riders',1]],[['Orc Berserkers',3]],3,'forest');
  ok(r.me.flanks.length===0&&r.me.fly.length===1,'in forest the Eagles stay in the air (no open flank to hold)');

  // Thorn Hedge: cavalry facing an Elven Garrison in the woods ×0.85
  r=fight([['Free Lances',2]],[['Elven Garrison',2]],2,'forest');
  ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.85*0.85))&&/Thorn Hedge/.test(whyOf(r.me,'Free Lances')),`Thorn Hedge on top of cavalry v infantry: ×0.7225 — ${whyOf(r.me,'Free Lances')}`);
  r=fight([['Free Lances',2]],[['Elven Garrison',2]],2,'plain');
  ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.85)),'…and nothing on the plain');

  // Tree Watch: in forest or jungle the Elven Garrison shoots in the archery step
  const eg={type:'Elven Garrison'}, ward={type:'Forest Wardens'};
  ok(AMU([eg,ward],'forest').includes(eg)&&AMU([eg,ward],'jungle').includes(eg),'Tree Watch: the Elven Garrison looses in forest and jungle');
  ok(!AMU([eg,ward],'plain').includes(eg)&&!AMU([eg,ward],'mountain').includes(eg),'…and not elsewhere');

  // Eyes of the Forest: Eagle Riders with the shooters spoil an Ambush and reveal Shadow Archers
  const wardens=[{type:'Forest Wardens'}], eagles=[{type:'Eagle Riders'},{type:'Yeoman Longbows'}], bows=[{type:'Yeoman Longbows'}];
  ok(ABB(wardens,'forest',bows)===true,'Wardens in forest still ambush archers who fly no Eagles');
  ok(ABB(wardens,'forest',eagles)===false,'…but not archers whose force has Eagle Riders');
  ok(ABB(wardens,'forest')===true,'(the two-argument call still reads as before)');
  { const enemy=[{type:'Shadow Archers',quality:'Average'},{type:'Forest Wardens',quality:'Average'}];
    ok(!MTP(enemy,0,bows[0],bows).some(a=>a.type==='Shadow Archers'),'Shadow Archers are not in the target pool while something else is visible');
    ok(MTP(enemy,0,eagles[1],eagles).some(a=>a.type==='Shadow Archers'),'…unless Eagle Riders fly with the shooters'); }

  // Skyward Retreat is gone: no Eagle unit climbs out of a trap untouched
  const src=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
  ok(!/climb away over the encircling lines/.test(src)&&!/a\.type==='Eagle Riders'\)\{\s*narr(ative)?\.push/.test(src),'the GM portal no longer lets Eagle Riders climb out of a trap');

  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
