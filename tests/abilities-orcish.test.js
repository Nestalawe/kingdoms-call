// 2026-10-11 (Toby, the unit abilities) — the Orcish units' abilities, each a matchup and one more:
//   Goblin Horde     Arrow Fodder (second-line archers shooting them ×0.75) · Sheer Numbers (+10% per other orc foot unit
//                    in the force — Goblin Hordes, Berserkers, the Orc Garrison — to +30%; it counted Goblins only)
//   Orc Berserkers   Frenzy (×1.15 facing foot) · Driven Before Them (+10% per Goblin Horde beside them in the front)
//   Black Arrows     Brawling Archers (full strength in the front line, where other archers fight ×0.75) · Raiders' Volley
//                    (their pre-battle volley ×1.5 when attacking)
//   Warg Riders      Wolves Panic Horses (×1.25 facing cavalry) · Run Them Down (unchanged)
//   Wyvern Riders    Terror From Above (the enemy's strongest front-line unit fights ×0.85) · Acid Spit (unchanged) — Dread,
//                    the −15% to enemy fanaticism, is gone
//   Orc Garrison     Bloodthirsty (×1.15 facing foot when defending) · Raiders' Muster (tests/abilities-turn)
// Level 1 (unit): the grid and the facing are module-level functions of the booted GM portal, as are unitAbilityMult
// and missileDamageMult. Dread lived inside runTurn and is checked gone in the source.
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
  // A unit's facing and its place in the grid hold values since plan P1-12d4: the prose writes their words.
  const facingWords=why=>ev('theWordsOfWhyAUnitFacesAsItDoes')(why), placeWords=why=>ev('theWordsOfWhyAUnitStandsWhereItDoes')(why);
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const G=ev('battleGrid'), F=ev('battleFacing'), UAM=ev('unitAbilityMult'), MDM=ev('missileDamageMult');
  const BASE={'Goblin Horde':6,'Orc Berserkers':12,'Black Arrows':8,'Warg Riders':10,'Wyvern Riders':12,'Orc Garrison':4,'Shieldwall Levies':8,'Yeoman Longbows':8,'Free Lances':10,'Men-at-Arms':12,'Dwarven Guard':12};
  const row=type=>({a:{type,quality:'Average',unitName:type},base:BASE[type]||8});
  const rows=spec=>[].concat(...spec.map(([t,n])=>Array.from({length:n},()=>row(t))));
  const fight=(mine,theirs,W,terrain,tacMe,tacThem)=>{
    const me=G(rows(mine),W,terrain,{tac:tacMe||0,enemy:rows(theirs),enemyTac:tacThem||0});
    const them=G(rows(theirs),W,terrain,{tac:tacThem||0,enemy:rows(mine),enemyTac:tacMe||0});
    F(me,them,terrain); return {me,them}; };
  const faced=(g,type)=>g.face.units.filter(u=>u.row.a.type===type);
  const whyOf=(g,type)=>faced(g,type).map(u=>facingWords(u.why)).join(' | ');

  // Arrow Fodder: second-line archers shooting Goblins ×0.75
  let r=fight([['Shieldwall Levies',2],['Yeoman Longbows',2]],[['Goblin Horde',2]],2,'plain');
  ok(faced(r.me,'Yeoman Longbows').every(u=>near(u.m,1.25*0.75)&&/Arrow Fodder/.test(facingWords(u.why))),`Arrow Fodder: Longbows shooting Goblins ×0.9375 — ${whyOf(r.me,'Yeoman Longbows')}`);

  // Sheer Numbers counts every other orc foot unit
  const gob={type:'Goblin Horde'}, bers={type:'Orc Berserkers'}, garr={type:'Orc Garrison'}, warg={type:'Warg Riders'}, arrows={type:'Black Arrows'};
  ok(near(UAM(gob,{force:[gob],enemyForce:[]},'plain'),1),'a lone Goblin Horde fights at ×1');
  ok(near(UAM(gob,{force:[gob,gob],enemyForce:[]},'plain'),1.1),'two Hordes: ×1.1');
  ok(near(UAM(gob,{force:[gob,bers,garr],enemyForce:[]},'plain'),1.2),'a Horde with Berserkers and the Orc Garrison: ×1.2 (other orc foot count)');
  ok(near(UAM(gob,{force:[gob,warg,arrows],enemyForce:[]},'plain'),1),'…riders and archers do not count');
  ok(near(UAM(gob,{force:[gob,gob,gob,bers,bers],enemyForce:[]},'plain'),1.3),'…and it stops at +30%');

  // Frenzy: Berserkers facing foot ×1.15; Driven Before Them: +10% per Goblin Horde beside them in the front
  r=fight([['Orc Berserkers',2]],[['Shieldwall Levies',2]],2,'plain');
  ok(faced(r.me,'Orc Berserkers').every(u=>near(u.m,1.15)&&/Frenzy/.test(facingWords(u.why))),`Frenzy against Levies — ${whyOf(r.me,'Orc Berserkers')}`);
  r=fight([['Orc Berserkers',2]],[['Free Lances',2]],2,'forest');
  ok(faced(r.me,'Orc Berserkers').every(u=>near(u.m,1.15)&&!/Frenzy/.test(facingWords(u.why))),'facing cavalry they have infantry\'s ×1.15 and no Frenzy');
  r=fight([['Orc Berserkers',1],['Goblin Horde',2]],[['Shieldwall Levies',3]],3,'plain');
  { const b=faced(r.me,'Orc Berserkers')[0];
    ok(r.me.front[1]&&r.me.front[1].r.a.type==='Orc Berserkers','the Berserkers, strongest, hold the centre with a Horde on each side');
    ok(b&&near(b.m,1.15*1.2)&&/Driven Before Them ×1\.2/.test(facingWords(b.why)),`Driven Before Them: two Hordes beside them, +20%, on top of Frenzy — ${b&&facingWords(b.why)}`); }
  r=fight([['Orc Berserkers',1],['Goblin Horde',1],['Black Arrows',1]],[['Shieldwall Levies',3]],3,'plain');
  { const b=faced(r.me,'Orc Berserkers')[0]; ok(b&&/Driven Before Them ×1\.1/.test(facingWords(b.why)),`one Horde beside them: +10% — ${b&&facingWords(b.why)}`); }

  // Brawling Archers: Black Arrows forced into the front fight at ×1, other archers ×0.75
  r=fight([['Black Arrows',2]],[['Shieldwall Levies',2]],2,'plain');
  ok(r.me.units.filter(u=>u.place==='front').every(u=>near(u.mult,1)&&/Brawling Archers/.test(placeWords(u.why))),`Brawling Archers: Black Arrows hold the front at ×1 — ${r.me.units.map(u=>placeWords(u.why)).join(' | ')}`);
  r=fight([['Yeoman Longbows',2]],[['Shieldwall Levies',2]],2,'plain');
  ok(r.me.units.filter(u=>u.place==='front').every(u=>near(u.mult,0.75)),'Longbows in the front still fight at ×0.75');

  // Raiders' Volley: the Black Arrows' pre-battle volley ×1.5 attacking, ×1 defending
  ok(near(MDM(arrows,[arrows],'plain',{type:'Shieldwall Levies'},true),1.5),'Raiders\' Volley: ×1.5 on the attack');
  ok(near(MDM(arrows,[arrows],'plain',{type:'Shieldwall Levies'},false),1),'…and ×1 in defence');

  // Wolves Panic Horses: Wargs facing cavalry ×1.25
  r=fight([['Warg Riders',2]],[['Free Lances',2]],2,'forest');
  ok(faced(r.me,'Warg Riders').every(u=>near(u.m,1.25)&&/Wolves Panic Horses/.test(facingWords(u.why))),`Wolves Panic Horses — ${whyOf(r.me,'Warg Riders')}`);
  ok(faced(r.them,'Free Lances').every(u=>near(u.m,1)),'the Free Lances answer at ×1 (Harriers is for flank duels)');

  // Terror From Above: with Wyverns on the other side, the enemy's strongest front unit fights ×0.85
  r=fight([['Goblin Horde',2],['Wyvern Riders',1]],[['Shieldwall Levies',1],['Men-at-Arms',1]],2,'plain');
  { const t=r.them.face.units.filter(u=>/Terror From Above/.test(facingWords(u.why)));
    ok(t.length===1&&t[0].row.a.type==='Men-at-Arms'&&near(t[0].m,0.85),`one unit, the strongest in the front (the Men-at-Arms), fights ×0.85 — ${t.map(u=>facingWords(u.why)).join(' | ')}`); }
  r=fight([['Goblin Horde',2]],[['Shieldwall Levies',1],['Men-at-Arms',1]],2,'plain');
  ok(r.them.face.units.every(u=>!/Terror/.test(facingWords(u.why))),'no Wyverns, no terror');

  // Bloodthirsty: a defending Orc Garrison facing foot ×1.15; attacking, nothing
  r=fight([['Shieldwall Levies',2]],[['Orc Garrison',2]],2,'plain');
  ok(faced(r.them,'Orc Garrison').every(u=>near(u.m,1.15)&&/Bloodthirsty/.test(facingWords(u.why))),`Bloodthirsty in defence — ${whyOf(r.them,'Orc Garrison')}`);
  r=fight([['Orc Garrison',2]],[['Shieldwall Levies',2]],2,'plain');
  ok(faced(r.me,'Orc Garrison').every(u=>near(u.m,1)),'…and ×1 on the attack');
  r=fight([['Free Lances',2]],[['Orc Garrison',2]],2,'forest');
  ok(faced(r.them,'Orc Garrison').every(u=>near(u.m,1.15)&&!/Bloodthirsty/.test(facingWords(u.why))),'facing cavalry it has infantry\'s ×1.15 only');

  // Dread is gone: no fanaticism penalty, no defenders'-bonus cut, no "one eye on the sky" line
  const src=require('./lib/source.ts').compactPage('kingdoms-call-gm-portal.html');   // its code in one layout (plan P1-09a)
  ok(!/one eye on the sky/.test(src)&&!/_wyvAtk\?0\.15/.test(src)&&!/_wyvDef\?0\.15/.test(src),'the GM portal no longer cuts fanaticism for Wyverns overhead');

  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
