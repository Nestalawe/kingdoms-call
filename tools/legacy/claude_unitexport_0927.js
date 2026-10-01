// claude_unitexport_0927.js — reads every ARMY UNIT table out of the REAL GM portal (Chromium,
// Supabase stubbed) and writes units_raw.json for the spreadsheet builder. Reads the engine's own
// tables, never a hand copy, so the export cannot drift from the build it was taken from.
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
  const ctx=await b.newContext(); const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>{ if(!/Proxy|stub/.test(String(e))) errs.push(String(e.message||e)); });
  await pg.route('**/*',r=>{ const u=r.request().url(); if(u.startsWith('file:')) r.continue(); else r.abort(); });
  await ctx.addInitScript(()=>{ const mk=()=>new Proxy(function(){},{get:(t,k)=>{ if(k==='then')return undefined;
    if(k===Symbol.toPrimitive)return ()=>''; if(k==='toString'||k==='valueOf')return ()=>''; return mk(); },
    apply:()=>mk(),construct:()=>mk()}); window.supabase=mk(); });
  await pg.goto('file://'+process.cwd()+'/kingdoms-call-gm-portal.html',{waitUntil:'load'});
  await pg.waitForTimeout(2500);

  const data=await pg.evaluate(()=>{
    const setArr=s=>{ try{ return Array.from(s||[]); }catch(e){ return []; } };
    const g=n=>{ try{ return eval(n); }catch(e){ return undefined; } };
    const out={};
    out.stamp=g('KC_BUILD_STAMP')||null;
    out.dataStamp=g('KC_DATA_STAMP')||null;
    out.cost=Object.assign({}, g('ARMY_COST_MASTER')||{});
    out.speed=Object.assign({}, g('ARMY_SPEED_MASTER')||{});
    out.baseStr=Object.assign({}, g('UNIT_BASE_STR')||{});
    out.qMult=Object.assign({}, g('UNIT_Q_MULT')||{});
    out.terrain={}; const TM=g('TERRAIN_MODS')||{};
    Object.keys(TM).forEach(t=>{ out.terrain[t]=Object.assign({}, TM[t]); });
    out.missile=setArr(g('MISSILE_ARMIES_MASTER'));
    out.seaTypes=setArr(g('GARRISON_SEA_TYPES_R'));
    out.aerialTypes=setArr(g('GARRISON_AIR_TYPES_R'));
    out.flyingTypes=setArr(g('GARRISON_FLY_TYPES_R'));
    out.primalSea=setArr(g('PRIMAL_SEA_NAMES'));
    out.raceOf=Object.assign({}, g('ARMY_RACE_OF_TYPE')||{});
    const DCS=g('DISC_CLS_SETS')||{}; out.classes={};
    Object.keys(DCS).forEach(k=>{ out.classes[k]=setArr(DCS[k]); });
    const DAL=g('DRUID_ARMY_LEVELS_P')||{}; out.druidLevels={};
    Object.keys(DAL).forEach(k=>{ out.druidLevels[k]=setArr(DAL[k]); });
    out.primalDefs={}; const PD=g('PRIMAL_ARMY_DEFS_P')||{};
    Object.keys(PD).forEach(k=>{ out.primalDefs[k]=JSON.parse(JSON.stringify(PD[k])); });
    out.provinceArmies=JSON.parse(JSON.stringify(g('PROVINCE_ARMIES_P')||{}));
    out.battleArmySpells=JSON.parse(JSON.stringify(g('BATTLE_ARMY_SPELLS')||{}));
    out.unitNames=JSON.parse(JSON.stringify(g('ARMY_UNIT_NAMES')||{}));
    out.seaLandPenalty=g('SEA_LAND_PENALTY');
    out.missileCapFrac=g('_MISSILE_CAP_FRAC');
    out.drillBase=Object.assign({}, g('UNIT_DRILL_BASE')||{});
    out.garrisonDrillLevel=g('GARRISON_DRILL_LEVEL');
    out.qualityTiers=setArr(g('QUALITY_TIERS'));
    out.frontWidth=Object.assign({}, g('BATTLE_FRONT_WIDTH')||{});
    out.homeFleet=Object.assign({}, g('HOME_FLEET_BY_RACE')||{});
    out.tamedFlyers=setArr(g('TAMED_FLYER_TYPES_D'));
    // the engine's own druid-level function, so the column cannot disagree with the table
    out.druidOf={}; const all=new Set([].concat(Object.keys(out.cost), Object.keys(out.baseStr)));
    all.forEach(t=>{ try{ out.druidOf[t]=getDruidLevel(t); }catch(e){ out.druidOf[t]=null; } });
    return out;
  });
  if(errs.length) console.error('page errors:', errs.slice(0,3));
  // TERRAIN_MODS, BATTLE_ARMY_SPELLS and SEA_LAND_PENALTY are declared at column 0 but INSIDE
  // runTurn, so they are function-scoped and invisible to the page. Read those three straight out
  // of the source text by brace-matching rather than duplicating them by hand.
  {
    const src=fs.readFileSync('kingdoms-call-gm-portal.html','utf8');
    const grab=(name)=>{ const i=src.indexOf('const '+name+'={'); if(i<0) throw new Error('not found: '+name);
      let j=src.indexOf('{',i), depth=0, k=j;
      for(;k<src.length;k++){ if(src[k]==='{')depth++; else if(src[k]==='}'){ depth--; if(depth===0){ k++; break; } } }
      return eval('('+src.slice(j,k)+')'); };
    data.terrain=grab('TERRAIN_MODS');
    data.battleArmySpells=grab('BATTLE_ARMY_SPELLS');
    const m=src.match(/const SEA_LAND_PENALTY=([0-9.]+)/); data.seaLandPenalty=m?Number(m[1]):null;
    console.log(`from source: terrains ${Object.keys(data.terrain).join(',')} | battle army spells ${Object.keys(data.battleArmySpells).length} | sea-land penalty ${data.seaLandPenalty}`);
  }
  fs.writeFileSync('/tmp/units_raw.json', JSON.stringify(data,null,1),'utf8');
  const n=new Set([].concat(Object.keys(data.cost),Object.keys(data.baseStr))).size;
  console.log(`build ${data.stamp} / data ${data.dataStamp}`);
  console.log(`unit types seen: ${n}  (cost ${Object.keys(data.cost).length}, baseStr ${Object.keys(data.baseStr).length})`);
  console.log(`terrains: ${Object.keys(data.terrain).join(', ')}`);
  console.log(`primal defs: ${Object.keys(data.primalDefs).length}  missile: ${data.missile.length}  flying: ${data.flyingTypes.length}`);
  await b.close();
})();
