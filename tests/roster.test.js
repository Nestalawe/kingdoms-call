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
const fs=require('fs'), vm=require('vm');
const {sitePath,readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
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

// A `const NAME={…};` of the GM portal as source text: from its declaration to the brace that closes the
// literal (braces inside quoted keys and values are skipped).
function slice(src,name){
  const start=src.indexOf(`const ${name}=`); if(start<0) return null;
  let i=src.indexOf('{',start), depth=0, q=null;
  for(;i<src.length;i++){
    const ch=src[i];
    if(q){ if(ch==='\\') i++; else if(ch===q) q=null; continue; }
    if(ch==="'"||ch==='"') q=ch;
    else if(ch==='{') depth++;
    else if(ch==='}'&&--depth===0) return src.slice(start,i+1)+';';
  }
  return null;
}

(async()=>{
  // ── The shared data file ──
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8'),ctx);
  const D=vm.runInContext('({S:KC_UNIT_BASE_STR,C:KC_UNIT_CLASS,T:KC_UNIT_TYPE,L:KC_DRUID_LEVELS,P:PROVINCE_ARMIES_P,N:ARMY_UNIT_NAMES})',ctx);
  for(const u of UNITS){
    const d=ROSTER[u];
    ok(D.T[u]===d.type,`${u}: KC_UNIT_TYPE is '${d.type}' (got ${D.T[u]})`);
    ok(D.S[u]===d.str,`${u}: KC_UNIT_BASE_STR is ${d.str} (got ${D.S[u]})`);
    if(u!=='Gnomish Gyrocopters') ok(D.L[1].includes(u),`${u}: Druid 1 to lead (a racial troop)`);
  }
  ok(!D.L[1].includes('Gnomish Gyrocopters'),'Gnomish Gyrocopters (a machine) still need nobody');
  const typed=t=>UNITS.filter(u=>ROSTER[u].type===t);
  ok(same(D.C.cavalry,typed('cavalry')),`KC_UNIT_CLASS.cavalry is exactly the cavalry: ${typed('cavalry').join(', ')} (got ${D.C.cavalry.join(', ')})`);
  ok(same(D.C.missile,typed('ranged')),`KC_UNIT_CLASS.missile is exactly the ranged units (the goblins' spears are retired): got ${D.C.missile.join(', ')}`);
  ok(!D.C.missile.includes('Goblin Horde'),'Goblin Horde no longer looses anything in the archery step');
  ok(same(D.C.flying,typed('flyer'))&&same(D.C.aerial,typed('flyer')),'KC_UNIT_CLASS.flying and .aerial are exactly the winged riders');
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
  const gm=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
  const G={};
  for(const name of ['ARMY_COST_MASTER','ARMY_SPEED_MASTER','TERRAIN_MODS','UNIT_SHORT','ARMY_RACE_OF_TYPE','DISC_CLS_SETS']){
    const s=slice(gm,name); ok(!!s,`the GM portal declares ${name}`);
    try{ G[name]=s?vm.runInContext(s+`\n;${name}`,ctx):{}; }catch(e){ G[name]={}; ok(false,`${name} evaluates on its own: ${e.message}`); }
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
      const got=((G.TERRAIN_MODS[t]||{})[u])??1;
      ok(near(got,1),`${u} in ${t}: a flyer or fleet fights at ×1 (got ×${got})`);
    }
  }
  for(const u of NEW_UNITS){
    const code=G.UNIT_SHORT[u];
    ok(typeof code==='string'&&/^[A-Za-z]{3,5}$/.test(code),`${u}: a UNIT_SHORT code of 3–5 letters for the grid print (got ${JSON.stringify(code)})`);
  }
  const cls=G.DISC_CLS_SETS||{};
  ok(cls.cavalry instanceof Set&&typed('cavalry').every(u=>cls.cavalry.has(u)),'DISC_CLS_SETS.cavalry (discovery effects) reaches every cavalry unit, Stag Riders and Ironhoof Rams included');
  ok(cls.infantry instanceof Set&&['Shieldwall Levies','Men-at-Arms','Dwarven Guard','Orc Berserkers'].every(u=>cls.infantry.has(u)),'DISC_CLS_SETS.infantry reaches Men-at-Arms beside Levies, Guard and Berserkers');
  ok(cls.missile instanceof Set&&typed('ranged').every(u=>cls.missile.has(u))&&!cls.missile.has('Goblin Horde'),'DISC_CLS_SETS.missile is the ranged units, Black Arrows in and Goblin Horde out');
  // The magic items' class sets inside runTurn (Golden Spur, Legionnaire's Mark, Eagle-Eye Pendant).
  const itemSet=name=>{ const m=new RegExp(`const ${name}=new Set\\(\\[[^\\]]*\\]\\);`).exec(gm); if(!m) return null; try{ return vm.runInContext(m[0]+`;${name}`,ctx); }catch(e){ return null; } };
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
  g.dom.window.close();
  const p=await boot('kingdoms-call-player-portal.html');
  ok(p.errors.length===0,'the player portal boots'+(p.errors.length?' — '+p.errors[0].split('\n')[0]:''));
  for(const u of NEW_UNITS){
    ok(p.ev(`unitTypeOfP(${JSON.stringify(u)})`)===ROSTER[u].type,`player portal unitTypeOfP('${u}') is '${ROSTER[u].type}'`);
    ok(p.ev(`DRUID_LEVEL_OF_P[${JSON.stringify(u)}]`)===1,`the player portal's Druid table says 1 for ${u}`);
  }
  p.dom.window.close();

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
