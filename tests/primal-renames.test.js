// 2026-10-13 (Toby, Creatures and Monsters II) — three of the wild units are renamed or replaced: Giant Eagles →
// Thunderbirds (a different flying Creature: the elves already ride eagles), Kraken Tentacles → Eldritch Kraken,
// Leviathan Pods → Dread Hydras (a land Monster of the same power). Level 1 (unit): the data file's tables carry
// the new names and not the old; the discoveries that named them are reworded and re-keyed; the GM portal's
// own tables and world-generation pools follow (read from src/ by their syntax tree); and the start-of-turn migration
// (`migrateLegacyUnitNames`, booted GM portal) turns a running game's companies, recruit pools, defenders,
// graves and province races over — Leviathan companies and waters become Eldritch Kraken, a land beast being
// unable to swim.
const fs=require('fs'), vm=require('vm');
const {sitePath,readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
const {compactPage,pageInitializer,scriptOf}=require('./lib/source.ts');
const P=require('./lib/primal-decided'); const {ROSTER,RENAMED,MIGRATED,RACE_RENAMED}=P;
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const OLD=Object.keys(RENAMED), NEW=[...new Set(Object.values(RENAMED))];

(async()=>{
  // ── The data file ──
  const ctx=vm.createContext({});
  vm.runInContext(scriptOf('content/kingdoms-call-data.js'),ctx);
  const D=vm.runInContext('({S:KC_UNIT_BASE_STR,C:KC_UNIT_CLASS,T:KC_UNIT_TYPE,L:KC_DRUID_LEVELS,PR:PRIMAL_ARMY_DEFS_P,N:PRIMAL_UNIT_NAMES,DISC:SAGE_DISCOVERIES_P})',ctx);
  const druidOf=u=>{ for(const [l,list] of Object.entries(D.L)) if(list.includes(u)) return +l; return 0; };
  for(const u of NEW){
    const d=ROSTER[u];
    ok(u in D.PR&&D.PR[u].str===d.str&&D.PR[u].cost===d.cost&&D.PR[u].speed===d.speed,`${u}: in PRIMAL_ARMY_DEFS_P at ${d.cost}g, strength ${d.str}, move ${d.speed} (got ${JSON.stringify(D.PR[u]&&{str:D.PR[u].str,cost:D.PR[u].cost,speed:D.PR[u].speed})})`);
    ok(D.T[u]===d.type,`${u}: KC_UNIT_TYPE '${d.type}' (got ${D.T[u]})`);
    ok(druidOf(u)===d.druid,`${u}: Druid ${d.druid} (got ${druidOf(u)})`);
    ok((d.family==='Creature'?D.C.creature:D.C.monster).includes(u),`${u}: a ${d.family} in KC_UNIT_CLASS`);
    ok(Array.isArray(D.N[u])&&D.N[u].length>=28&&new Set(D.N[u]).size===D.N[u].length&&D.N[u].every(n=>/^the /.test(n)),`${u}: at least 28 distinct company names reading "the …" (got ${(D.N[u]||[]).length})`);
    ok(!!D.PR[u]&&Array.isArray(D.PR[u].spells)&&D.PR[u].spells.length===1&&D.PR[u].spells[0].dmg[1]>0,`${u}: carries one pre-battle strike`);
  }
  ok(D.C.aerial.includes('Thunderbirds')&&D.C.tamedFlyer.includes('Thunderbirds')&&!D.C.aerial.includes('Giant Eagles')&&!D.C.tamedFlyer.includes('Giant Eagles'),'Thunderbirds cross the sea on the wing and can be tamed; Giant Eagles no longer');
  ok(D.C.primalSea.slice(0,2).join()==='Sea Giants,Eldritch Kraken'&&D.C.sea.includes('Eldritch Kraken')&&!D.C.sea.includes('Leviathan Pods'),`the primal seas are Sea Giants and Eldritch Kraken (got ${D.C.primalSea.join(', ')})`);
  ok(!D.C.sea.includes('Dread Hydras')&&!D.C.primalSea.includes('Dread Hydras')&&!D.C.aerial.includes('Dread Hydras'),'Dread Hydras walk: neither a sea unit nor a flyer');
  for(const u of OLD){
    const lists=Object.entries(D.C).filter(([k,l])=>l.includes(u)).map(([k])=>k);
    ok(lists.length===0&&!(u in D.T)&&!(u in D.S)&&!(u in D.PR)&&!(u in D.N)&&druidOf(u)===0,`${u} is in no table (still in: ${[...lists,...(u in D.T?['KC_UNIT_TYPE']:[]),...(u in D.PR?['PRIMAL_ARMY_DEFS_P']:[]),...(u in D.N?['PRIMAL_UNIT_NAMES']:[])].join(', ')||'none'})`);
  }
  // The discoveries that named them.
  const disc=id=>D.DISC.find(d=>d.id===id)||{};
  const types=d=>((d.effect||{}).types||[]);
  ok(types(disc('ad13')).join()==='Noble Griffons,Thunderbirds'&&/Thunderbirds/.test(disc('ad13').desc)&&!/Giant Eagles/.test(disc('ad13').desc),'Angelic Hosts lifts Noble Griffons and Thunderbirds');
  ok(types(disc('au13')).join()==='Thunderbirds,Crimson Rocs'&&/Thunderbirds/.test(disc('au13').desc),'Sky Kin lifts Thunderbirds and Crimson Rocs');
  ok(types(disc('au20')).includes('Whale Cohort')&&!types(disc('au20')).includes('Leviathan Pods')&&!/Leviathan/.test(disc('au20').desc),'Whale Lore lifts the Whale Cohort and no Leviathan (the Great Turtles join it in Creatures and Monsters IV)');
  ok(/Thunderbirds/.test(disc('sd40').desc)&&!/Giant Eagles/.test(disc('sd40').desc),'Dragon Taming names the Thunderbirds among the winged beasts');
  for(const d of D.DISC) for(const u of OLD) ok(!types(d).includes(u)&&!(d.desc||'').includes(u),`discovery ${d.id} no longer names ${u}`);

  // ── The GM portal's tables and world-generation pools ──
  // each table and pool is the value the GM portal's code first declares it with, and its code is read in one layout,
  // by its syntax tree (tests/lib/source.ts; until plan P1-09a both were cut out of the built page's text)
  const gm=compactPage('kingdoms-call-gm-portal.html');
  const ev=name=>{ const s=pageInitializer('kingdoms-call-gm-portal.html',name); if(!s) return null; try{ return {v:vm.runInContext(s,ctx)}; }catch(e){ return null; } };
  const US=ev('UNIT_SHORT'); ok(!!US&&NEW.every(u=>typeof US.v[u]==='string'&&/^[A-Za-z]{3,5}$/.test(US.v[u]))&&OLD.every(u=>!(u in US.v)),'UNIT_SHORT has a grid code for each new name and none for the old');
  const TM=ev('TERRAIN_MODS'); ok(!!TM,'TERRAIN_MODS evaluates');
  if(TM){ for(const u of NEW){ const d=ROSTER[u]; for(const t of P.LAND_TERRAINS){ const got=((TM.v[t]||{})[u])??1, want=(P.isLand(d)||d.type==='flyer')?((d.terr[t])??1):1; ok(Math.abs(got-want)<1e-9,`${u} in ${t}: TERRAIN_MODS ×${want} (got ×${got})`); } }
    for(const u of OLD) ok(P.LAND_TERRAINS.every(t=>!((TM.v[t]||{}).hasOwnProperty(u))),`TERRAIN_MODS has no row for ${u}`); }
  // Both copies of the land pools (world generation and the alignment neighbour pass).
  const CB=ev('CREATURE_BY_TERRAIN'), MB=ev('MONSTER_BY_TERRAIN'), CBT=ev('CBT'), MBT=ev('MBT');
  for(const [name,pool] of [['CREATURE_BY_TERRAIN',CB],['CBT',CBT]]){
    ok(!!pool,`${name} evaluates`); if(!pool) continue;
    const all=Object.values(pool.v).flat();
    ok(!all.includes('Giant Eagles')&&['plain','desert','forest','mountain'].every(t=>(pool.v[t]||[]).includes('Thunderbirds')),`${name}: Thunderbirds where the Giant Eagles were (plain, desert, forest, mountain), Giant Eagles nowhere`);
  }
  for(const [name,pool] of [['MONSTER_BY_TERRAIN',MB],['MBT',MBT]]){
    ok(!!pool,`${name} evaluates`); if(!pool) continue;
    ok((pool.v.jungle||[]).includes('Dread Hydras')&&(pool.v.forest||[]).includes('Dread Hydras')&&!Object.values(pool.v).flat().includes('Leviathan Pods'),`${name}: Dread Hydras in jungle and forest`);
  }
  ok(!/isTier5=chosen==='Leviathan Pods'/.test(gm),'the sea pass no longer keys its Veteran guard on Leviathan Pods');
  ok(/replace\('Eldritch Kraken','Kraken'\)/.test(gm)||/'Primal:Kraken'/.test(gm.slice(gm.indexOf('PRIMAL_SEA_TYPES.slice()'))),'a Kraken sea is still the race "Primal:Kraken"');

  // ── The booted GM portal: the migration, the abilities ──
  const errors=[]; const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/gm',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const g=x=>{ try{ return dom.window.eval(x); }catch(e){ return 'THREW: '+e.message; } };
  const mult=(t,terrain,extra)=>g(`unitAbilityMult({type:${JSON.stringify(t)},quality:'Average'},Object.assign({force:[],enemyForce:[{type:'Yeoman Longbows'}]},${JSON.stringify(extra||{})}),${JSON.stringify(terrain)})`);
  ok(mult('Thunderbirds','plain')===1,`Thunderbirds carry no Stoop on the Archers multiplier against ranged (got ×${mult('Thunderbirds','plain')}; Storm Wings comes with the beast abilities)`);
  ok(Math.abs(mult('Eldritch Kraken','sea')-1.35)<1e-9&&mult('Eldritch Kraken','plain')===1,'Eldritch Kraken keep Deepwater Grasp ×1.35 at sea');
  ok(mult('Dread Hydras','jungle')===1&&mult('Dread Hydras','sea')===1,'Dread Hydras carry no always-on multiplier (Many Heads comes with the beast abilities)');
  for(const u of NEW){ ok(g(`ARMY_COST_MASTER[${JSON.stringify(u)}]`)===ROSTER[u].cost&&g(`ARMY_SPEED_MASTER[${JSON.stringify(u)}]`)===ROSTER[u].speed,`${u}: cost and speed in the master tables`); }
  // The migration on a staged running game, as runTurn runs it at the top of every turn.
  dom.window.__renameFixture={
    characters:[{id:1,armies:[{type:'Giant Eagles',quality:'Veteran',race:'Primal',unitName:'the Stormcrest Wing'},{type:'Kraken Tentacles',quality:'Average',race:'Primal'},{type:'Leviathan Pods',quality:'Elite',race:'Primal'},{type:'Shieldwall Levies',quality:'Average',race:'Human'}]}],
    world:{provinces:[
      {id:0,terrain:'mountain',race:'Primal:Giant Eagle',armyTypes:['Giant Eagles'],neutralDefenders:[{type:'Giant Eagles',quality:'Average',race:'Primal:Giant Eagle'}],garrisonArmies:[],battleGraves:[{type:'Giant Eagles',quality:'Average'}]},
      {id:1,terrain:'sea',race:'Primal:Leviathan',armyTypes:['Leviathan Pods'],neutralDefenders:[{type:'Leviathan Pods',quality:'Veteran',race:'Primal'}],garrisonArmies:[{type:'Leviathan Pods',quality:'Average',race:'Primal'}],battleGraves:[]},
      {id:2,terrain:'sea',race:'Primal:Kraken',armyTypes:['Kraken Tentacles'],neutralDefenders:[],garrisonArmies:[],battleGraves:[]},
      {id:3,terrain:'forest',race:'Elven',armyTypes:['Forest Wardens','Elven Garrison'],neutralDefenders:[],garrisonArmies:[],battleGraves:[]}]},
    heroGraveyard:[{armies:[{type:'Giant Eagles',quality:'Green'}]}]};
  const out=g(`(()=>{ const s=window.__renameFixture; try{ migrateLegacyUnitNames(s); }catch(e){ return {threw:e.message}; } return s; })()`);
  ok(out&&!out.threw,`migrateLegacyUnitNames runs on the staged game (${out&&out.threw||'ok'})`);
  if(out&&!out.threw){
    const c=out.characters[0].armies.map(a=>a.type);
    ok(c.join()==='Thunderbirds,Eldritch Kraken,Eldritch Kraken,Shieldwall Levies',`a hero's companies: Giant Eagles → Thunderbirds, Kraken Tentacles and Leviathan Pods → Eldritch Kraken, humanoids untouched (got ${c.join(', ')})`);
    ok(out.characters[0].armies[0].unitName==='the Stormcrest Wing'&&out.characters[0].armies[0].quality==='Veteran','a renamed company keeps its name and quality');
    const p0=out.world.provinces[0], p1=out.world.provinces[1], p2=out.world.provinces[2], p3=out.world.provinces[3];
    ok(p0.race==='Primal:Thunderbird'&&p0.armyTypes.join()==='Thunderbirds'&&p0.neutralDefenders[0].type==='Thunderbirds'&&p0.neutralDefenders[0].race==='Primal:Thunderbird'&&p0.battleGraves[0].type==='Thunderbirds',`an eagle eyrie becomes a Thunderbird province: race, recruit pool, defenders, graves (got ${p0.race}, ${p0.armyTypes.join()}, ${p0.neutralDefenders[0].type}, ${p0.neutralDefenders[0].race}, ${p0.battleGraves[0].type})`);
    ok(p1.race==='Primal:Kraken'&&p1.armyTypes.join()==='Eldritch Kraken'&&p1.neutralDefenders[0].type==='Eldritch Kraken'&&p1.garrisonArmies[0].type==='Eldritch Kraken',`Leviathan waters become Kraken waters, their pods Eldritch Kraken (got ${p1.race}, ${p1.armyTypes.join()}, ${p1.neutralDefenders[0].type}, ${p1.garrisonArmies[0].type})`);
    ok(p2.race==='Primal:Kraken'&&p2.armyTypes.join()==='Eldritch Kraken',`Kraken waters keep their race and recruit Eldritch Kraken (got ${p2.race}, ${p2.armyTypes.join()})`);
    ok(p3.race==='Elven'&&p3.armyTypes.join()==='Forest Wardens,Elven Garrison','a humanoid province is untouched');
    ok(out.heroGraveyard[0].armies[0].type==='Thunderbirds','a fallen hero\'s remembered companies are renamed too');
    const again=g(`(()=>{ const s=window.__renameFixture; migrateLegacyUnitNames(s); return s.characters[0].armies.map(a=>a.type).join(); })()`);
    ok(again==='Thunderbirds,Eldritch Kraken,Eldritch Kraken,Shieldwall Levies','running the migration again changes nothing (it runs every turn)');
  }
  for(const [o,n] of Object.entries(MIGRATED)) ok(g(`LEGACY_UNIT_RENAMES[${JSON.stringify(o)}]`)===n,`LEGACY_UNIT_RENAMES maps ${o} → ${n}`);
  dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
