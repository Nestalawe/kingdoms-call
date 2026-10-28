// 2026-10-11 (Toby, the army roster) — the roster as decided (tests/lib/roster-decided.js): every humanoid
// unit's type, cost, base strength, move rate and terrain multipliers; the four new units (Men-at-Arms,
// Stag Riders, Ironhoof Rams, Black Arrows) in every table that is keyed by unit; the goblins' thrown
// spears and the Berserkers' Outnumbered and Uncaring retired.
// Level 1 (unit). The figures are data: the shared file's tables, and the GM portal's own
// (ARMY_COST_MASTER and ARMY_SPEED_MASTER at module level; TERRAIN_MODS and the magic-item class sets
// inside runTurn, so they are read by slicing the source — pure literals, evaluated beside the data file).
// The one rule retired here is a module-level function, unitAbilityMult, which the booted portal answers
// directly. A lower level can't do it: the agreement between a dozen tables is a property of the data, not
// of one line of text.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The army roster as decided (`tests/lib/roster-decided.js`): every humanoid unit's type, cost, base strength, move
// rate and terrain multipliers, read from the data file and from the GM portal's own tables (`ARMY_COST_MASTER`,
// `ARMY_SPEED_MASTER`, `TERRAIN_MODS` and the item class sets, sliced from the source); the four new units
// (Men-at-Arms, Stag Riders, Ironhoof Rams, Black Arrows) in every table keyed by unit, with their company names and
// province cells appended after the old ones; the goblins' spears gone from the missile list and the Berserkers'
// Outnumbered and Uncaring gone from `unitAbilityMult` (booted portal); both portals type and Druid-rate the new units
const fs=require('fs'), vm=require('vm');
const {sitePath,readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
const {compactCode,pageInitializer,scriptOf}=require('./lib/source.ts');
const R=require('./lib/roster-decided'); const {ROSTER,LAND_TERRAINS,NEW_UNITS,NEW_UNIT_PROVINCES,isLand}=R;
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-9;
const UNITS=Object.keys(ROSTER);
const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));

// The province rosters before this work (PROVINCE_ARMIES_P, 2026-10-11): order is data, so a new unit
// joins a cell AFTER these, and a king's two starting companies (the first two non-garrison types of his
// home's cell) are the same as before.
const CELLS_BEFORE={
  plain:   {Human:['Shieldwall Levies','Free Lances','Yeoman Longbows','Gilded Lances','Noble Griffons','Human Garrison'],Elven:['Elven Bowmen','Eagle Riders','Elven Garrison'],Dwarven:['Dwarven Guard','Gnomish Gyrocopters','Dwarf Garrison'],Orcish:['Warg Riders','Orc Berserkers','Orc Garrison']},
  desert:  {Human:['Shieldwall Levies','Free Lances','Gilded Lances','Noble Griffons','Human Garrison'],Elven:['Elven Bowmen','Eagle Riders','Elven Garrison'],Dwarven:['Dwarven Guard','Gnomish Gyrocopters','Dwarf Garrison'],Orcish:['Orc Berserkers','Warg Riders','Wyvern Riders','Orc Garrison']},
  forest:  {Human:['Yeoman Longbows','Shieldwall Levies','Human Garrison'],Elven:['Forest Wardens','Elven Bowmen','Shadow Archers','Eagle Riders','Elven Garrison'],Dwarven:['Ironwood Crossbows','Gnomish Gyrocopters','Dwarf Garrison'],Orcish:['Warg Riders','Goblin Horde','Wyvern Riders','Orc Garrison']},
  jungle:  {Human:['Shieldwall Levies','Yeoman Longbows','Free Lances','Human Garrison'],Elven:['Forest Wardens','Shadow Archers','Eagle Riders','Elven Garrison'],Dwarven:['Ironwood Crossbows','Dwarven Guard','Gnomish Gyrocopters','Dwarf Garrison'],Orcish:['Goblin Horde','Orc Berserkers','Wyvern Riders','Orc Garrison']},
  mountain:{Human:['Human Garrison','Shieldwall Levies','Noble Griffons'],Elven:['Eagle Riders','Elven Bowmen','Elven Garrison'],Dwarven:['Dwarven Guard','Ironwood Crossbows','Mountain Guns','Gnomish Gyrocopters','Dwarf Garrison'],Orcish:['Orc Berserkers','Wyvern Riders','Orc Garrison']},
};

(async()=>{
  // ── The shared data file ──
  const ctx=vm.createContext({});
  vm.runInContext(scriptOf('content/kingdoms-call-data.ts'),ctx);
  const D=vm.runInContext('({S:KC_UNIT_BASE_STR,C:KC_UNIT_CLASS,T:KC_UNIT_TYPE,L:KC_DRUID_LEVELS,P:PROVINCE_ARMIES_P,N:ARMY_UNIT_NAMES})',ctx);
  for(const u of UNITS){
    const d=ROSTER[u];
    ok(D.T[u]===d.type,`${u}: KC_UNIT_TYPE is '${d.type}' (got ${D.T[u]})`);
    ok(D.S[u]===d.str,`${u}: KC_UNIT_BASE_STR is ${d.str} (got ${D.S[u]})`);
    if(u!=='Gnomish Gyrocopters') ok(D.L[1].includes(u),`${u}: Druid 1 to lead (a racial troop)`);
  }
  ok(!D.L[1].includes('Gnomish Gyrocopters'),'Gnomish Gyrocopters (a machine) still need nobody');
  const typed=t=>UNITS.filter(u=>ROSTER[u].type===t);
  // (2026-10-13, Creatures and Monsters IV: the Unicorn Herd, a Creature, joins the cavalry; the class must still hold every
  // humanoid horse and nothing that is not typed cavalry.)
  ok(typed('cavalry').every(u=>D.C.cavalry.includes(u))&&D.C.cavalry.every(u=>D.T[u]==='cavalry'),`KC_UNIT_CLASS.cavalry holds every humanoid horse (${typed('cavalry').join(', ')}) and only units typed cavalry (got ${D.C.cavalry.join(', ')})`);
  ok(same(D.C.missile,typed('ranged')),`KC_UNIT_CLASS.missile is exactly the ranged units (the goblins' spears are retired): got ${D.C.missile.join(', ')}`);
  ok(!D.C.missile.includes('Goblin Horde'),'Goblin Horde no longer looses anything in the archery step');
  ok(same(D.C.flying,typed('flyer'))&&typed('flyer').every(u=>D.C.aerial.includes(u)),'KC_UNIT_CLASS.flying is exactly the winged riders, and .aerial (riders and flying beasts) holds them all');
  ok(typed('naval').every(u=>D.C.sea.includes(u)&&D.C.carrier.includes(u)),'every humanoid fleet is in KC_UNIT_CLASS.sea and .carrier');
  const foot=UNITS.filter(u=>ROSTER[u].type==='infantry'||ROSTER[u].type==='ranged');
  ok(same(D.C.lightFoot,foot),`KC_UNIT_CLASS.lightFoot (half a hull) is exactly the infantry and ranged units: missing ${foot.filter(u=>!D.C.lightFoot.includes(u)).join(', ')||'none'}; extra ${D.C.lightFoot.filter(u=>!foot.includes(u)).join(', ')||'none'}`);
  ok(same(D.C.garrison,UNITS.filter(u=>ROSTER[u].garrison)),'KC_UNIT_CLASS.garrison is the four garrisons');
  // Province rosters: the old cells in their old order, the new unit after them.
  for(const t of LAND_TERRAINS) for(const race of R.RACES){
    const cell=(D.P[t]||{})[race]||[], before=CELLS_BEFORE[t][race];
    ok(before.every((u,i)=>cell[i]===u),`PROVINCE_ARMIES_P.${t}.${race} keeps its old units in their old order (${before.join(', ')}) — got ${cell.join(', ')}`);
    const extra=cell.slice(before.length), want=NEW_UNITS.filter(u=>ROSTER[u].race===race&&NEW_UNIT_PROVINCES[u].includes(t));
    ok(same(extra,want),`PROVINCE_ARMIES_P.${t}.${race} adds ${want.join(', ')||'nothing'} (got ${extra.join(', ')||'nothing'})`);
  }
  // Company names for the new units, as the old ones have them.
  for(const u of NEW_UNITS){
    const names=D.N[u]||[];
    ok(names.length>=30,`${u}: at least 30 company names in ARMY_UNIT_NAMES (got ${names.length})`);
    ok(new Set(names).size===names.length&&names.every(n=>/^the /.test(n)),`${u}: the names are distinct and read "the …"`);
  }

  // ── The GM portal's own tables ──
  // each table is the value the GM portal's code first declares it with, read by its syntax tree (tests/lib/source.ts;
  // until plan P1-09a it was cut out of the built page's text)
  const G={};
  for(const name of ['ARMY_COST_MASTER','ARMY_SPEED_MASTER','TERRAIN_MODS','UNIT_SHORT','ARMY_RACE_OF_TYPE','DISC_CLS_SETS']){
    const s=pageInitializer('kingdoms-call-gm-portal.html',name); ok(!!s,`the GM portal declares ${name}`);
    try{ G[name]=s?vm.runInContext(s,ctx):{}; }catch(e){ G[name]={}; ok(false,`${name} evaluates on its own: ${e.message}`); }
  }
  for(const u of UNITS){
    const d=ROSTER[u];
    ok(G.ARMY_COST_MASTER[u]===d.cost,`${u}: ARMY_COST_MASTER is ${d.cost} (got ${G.ARMY_COST_MASTER[u]})`);
    ok(G.ARMY_SPEED_MASTER[u]===d.speed,`${u}: ARMY_SPEED_MASTER is ${d.speed} (got ${G.ARMY_SPEED_MASTER[u]})`);
    if(d.type!=='naval') ok(G.ARMY_RACE_OF_TYPE[u]===d.race||(!d.isNew&&d.type==='flyer'),`${u}: ARMY_RACE_OF_TYPE is ${d.race} (got ${G.ARMY_RACE_OF_TYPE[u]})`);
    if(isLand(d)) for(const t of LAND_TERRAINS){
      const got=((G.TERRAIN_MODS[t]||{})[u])??1, want=(d.terr[t])??1;
      ok(near(got,want),`${u} in ${t}: TERRAIN_MODS ×${want} (got ×${got})`);
    } else for(const t of LAND_TERRAINS){
      const got=((G.TERRAIN_MODS[t]||{})[u])??1, want=(d.terr[t])??1;
      ok(near(got,want),`${u} in ${t}: a ${d.type} fights at ×${want} (got ×${got})`);   // a fleet ×1 everywhere; a flyer ×0.75 in the woods (item 19)
    }
  }
  for(const u of NEW_UNITS){
    const code=G.UNIT_SHORT[u];
    ok(typeof code==='string'&&/^[A-Za-z]{3,5}$/.test(code),`${u}: a UNIT_SHORT code of 3–5 letters for the grid print (got ${JSON.stringify(code)})`);
  }
  // (The sets were built in the vm's realm, so `instanceof Set` would be false here: ask for .has instead.)
  const cls=G.DISC_CLS_SETS||{}; const isSet=s=>!!s&&typeof s.has==='function';
  ok(isSet(cls.cavalry)&&typed('cavalry').every(u=>cls.cavalry.has(u)),'DISC_CLS_SETS.cavalry (discovery effects) reaches every cavalry unit, Stag Riders and Ironhoof Rams included');
  ok(isSet(cls.infantry)&&['Shieldwall Levies','Men-at-Arms','Dwarven Guard','Orc Berserkers'].every(u=>cls.infantry.has(u)),'DISC_CLS_SETS.infantry reaches Men-at-Arms beside Levies, Guard and Berserkers');
  ok(isSet(cls.missile)&&typed('ranged').every(u=>cls.missile.has(u))&&!cls.missile.has('Goblin Horde'),'DISC_CLS_SETS.missile is the ranged units, Black Arrows in and Goblin Horde out');
  // The magic items' class sets inside runTurn (Golden Spur, Legionnaire's Mark, Eagle-Eye Pendant).
  const itemSet=name=>{ const s=pageInitializer('kingdoms-call-gm-portal.html',name); if(!s||!/^new Set\(\[[^\]]*\]\);?$/.test(compactCode(s))) return null; try{ return vm.runInContext(s,ctx); }catch(e){ return null; } };
  const CAV_I=itemSet('CAV_I'), INF_I=itemSet('INF_I'), ARCH_I=itemSet('ARCH_I');
  ok(CAV_I&&typed('cavalry').every(u=>CAV_I.has(u)),"the Golden Spur's cavalry set (CAV_I) has every cavalry unit");
  ok(INF_I&&INF_I.has('Men-at-Arms'),"the Legionnaire's Mark's infantry set (INF_I) has Men-at-Arms");
  ok(ARCH_I&&ARCH_I.has('Black Arrows')&&!ARCH_I.has('Goblin Horde'),"the Eagle-Eye Pendant's archer set (ARCH_I) has Black Arrows");

  // ── The booted portals ──
  const boot=async(page)=>{ const errors=[]; const dom=bootJsdom(readPage(page),{supabase:{createClient:()=>nullStub()},url:'https://example.org/'+page,
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
    await new Promise(r=>setTimeout(r,1200)); return {dom,errors,ev:x=>{ try{ return dom.window.eval(x); }catch(e){ return 'THREW: '+e.message; } }}; };
  const g=await boot('kingdoms-call-gm-portal.html');
  ok(g.errors.length===0,'the GM portal boots'+(g.errors.length?' — '+g.errors[0].split('\n')[0]:''));
  for(const u of NEW_UNITS) ok(g.ev(`unitTypeOf(${JSON.stringify(u)})`)===ROSTER[u].type,`GM unitTypeOf('${u}') is '${ROSTER[u].type}'`);
  // Outnumbered and Uncaring is gone: three Berserkers against twelve enemy companies fight at ×1 (it was ×1.3).
  const bers=g.ev(`(()=>{ const b={type:'Orc Berserkers',quality:'Average'}; const e=Array.from({length:12},()=>({type:'Shieldwall Levies',quality:'Average'}));
    return unitAbilityMult(b,{force:[b,{type:'Orc Berserkers'},{type:'Orc Berserkers'}],enemyForce:e,isAttacker:true},'plain'); })()`);
  ok(bers===1,`outnumbered Berserkers get no multiplier any more (got ${bers})`);
  const gob=g.ev(`(()=>{ const f=[{type:'Goblin Horde'},{type:'Goblin Horde'},{type:'Goblin Horde'}]; return unitAbilityMult(f[0],{force:f,enemyForce:[{type:'Shieldwall Levies'}]},'plain'); })()`);
  ok(near(gob,1.2),`Sheer Numbers still stands: three Goblin Hordes together fight at ×1.2 (got ${gob})`);
  // Ruling (Toby, 2026-10-11, "Option 1 is fine, leave it capitals only"): in a running game the new
  // units reach a realm's capital on its next turn (backfillHomeRosters, which runs at the top of every
  // runTurn, appends every missing land type of the race); every other province keeps the pool it was
  // generated with.
  // The staged game is handed to the page as data (a window property), never written into code.
  for(const race of R.RACES){
    const home=CELLS_BEFORE.plain[race], other=CELLS_BEFORE.forest[race];
    g.dom.window.__rosterFixture={race,home,other};
    const out=g.ev(`(()=>{ const f=window.__rosterFixture; const gs={players:[{race:f.race,homeProvinceId:0,provinces:[0,1]}],characters:[],
      world:{cols:2,rows:1,provinces:[{id:0,race:f.race,terrain:'plain',row:0,col:0,armyTypes:f.home.slice()},
                                      {id:1,race:f.race,terrain:'forest',row:0,col:1,armyTypes:f.other.slice()}]}};
      try{ backfillHomeRosters(gs); }catch(e){ return {threw:e.message}; } return {home:gs.world.provinces[0].armyTypes,other:gs.world.provinces[1].armyTypes}; })()`);
    const land=R.unitsOf(race,d=>d.type!=='naval');
    ok(out&&!out.threw&&Array.isArray(out.home)&&land.every(u=>out.home.includes(u)),`${race}: a running game's capital gains every land unit of the race, the new one included (got ${out&&(out.threw||(out.home||[]).join(', '))})`);
    ok(out&&!out.threw&&Array.isArray(out.other)&&out.other.join()===other.join(),`${race}: a province that is not the capital keeps the pool it was generated with (got ${out&&(out.threw||(out.other||[]).join(', '))})`);
  }
  g.dom.window.close();
  const p=await boot('kingdoms-call-player-portal.html');
  ok(p.errors.length===0,'the player portal boots'+(p.errors.length?' — '+p.errors[0].split('\n')[0]:''));
  for(const u of NEW_UNITS){
    ok(p.ev(`unitTypeOf(${JSON.stringify(u)})`)===ROSTER[u].type,`player portal unitTypeOf('${u}') is '${ROSTER[u].type}'`);
    ok(p.ev(`getDruidLevel(${JSON.stringify(u)})`)===1,`the player portal's Druid table says 1 for ${u}`);
  }
  p.dom.window.close();

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
