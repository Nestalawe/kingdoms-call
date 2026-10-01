// QUARANTINED 2026-10-01: needs the pre-refactor build (27 Sept) in tests/quarantine/before/, which is not kept; it was a one-off proof for the one-source refactor.
// Kingdoms Call — ONE-SOURCE EQUIVALENCE HARNESS (2026-09-27, "collapse to one source").
//
// Boots the BEFORE and AFTER builds of both portals under JSDOM and proves the refactor changed no
// value except the drifts it was meant to fix:
//   1. every manifest entry (each hand-typed literal that was replaced) — the old literal vs the
//      value the new expression produces IN THE BOOTED AFTER PAGE, compared value-for-value and in
//      ORDER (arrays, Set iteration order, object key order);
//   2. every named table, BEFORE page vs AFTER page, same comparison — plus getDruidLevel and
//      druIdPenaltyMult across every unit type, race and alignment;
//   3. the player portal's new druidNeedP agrees with the ENGINE's druIdPenaltyMult on random
//      commander / unit / realm combinations (the proof the player now sees what battle applies);
//   4. each intended FIX changed exactly what it should (FI kept in duels, Mountain Guns light,
//      the ten mastery texts, the Druid level-1 rule), and nothing else.
//
//   node tests/quarantine/one-source.test.js   (expects the pre-refactor build in tests/quarantine/before/,
//                                              or in the folder named by KC_BEFORE_DIR)
const fs=require('fs'); const vm=require('vm'); const path=require('path');
const {sitePath,readPage,bootJsdom}=require('../lib/boot'); const {nullStub}=require('../lib/stub-db');
const BEFORE=process.env.KC_BEFORE_DIR||path.join(__dirname,'before');
const MAN=JSON.parse(fs.readFileSync(path.join(__dirname,'one-source-manifest.json'),'utf8'));
let fails=0, checks=0;
const ok=(c,msg)=>{ checks++; if(!c){ fails++; console.log('FAIL '+msg); } };

const stub=nullStub;
// The data file is the one beside each page (before/ for the old build, site/ for today's).
async function boot(htmlPath, dataPath, label){
  let html=readPage(htmlPath);
  const errors=[];
  const dom=bootJsdom(html,{supabase:{createClient:()=>stub()},setup(w){
    w.addEventListener('error',e=>errors.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errors.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errors.push('console.error: '+t); };
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  await new Promise(r=>setTimeout(r,700));
  ok(errors.length===0, `${label} booted with ${errors.length} error(s): ${errors.slice(0,2).join(' | ')}`);
  return dom.window;
}
// Normalise any table to a comparable, ORDER-PRESERVING JSON string.
const NORM_SRC=`(function norm(v){
  if(v instanceof Set) return {__set:[...v].map(norm)};
  if(v instanceof Map) return {__map:[...v].map(([k,x])=>[k,norm(x)])};
  if(Array.isArray(v)) return v.map(norm);
  if(v&&typeof v==='object') return {__obj:Object.keys(v).map(k=>[k,norm(v[k])])};
  return v;
})`;
const normIn=(W,expr)=>JSON.stringify(W.eval(`(${NORM_SRC})(${expr})`));
const normLit=(lit)=>{ const c={}; vm.createContext(c); return JSON.stringify(vm.runInContext(`(${NORM_SRC})(${lit.replace(/;\s*$/,'')})`,c)); };

(async()=>{
  const GMb=await boot(path.join(BEFORE,'kingdoms-call-gm-portal.html'),path.join(BEFORE,'kingdoms-call-data.js'),'GM before');
  const GMa=await boot(sitePath('kingdoms-call-gm-portal.html'),sitePath('kingdoms-call-data.js'),'GM after');
  const PPb=await boot(path.join(BEFORE,'kingdoms-call-player-portal.html'),path.join(BEFORE,'kingdoms-call-data.js'),'PP before');
  const PPa=await boot(sitePath('kingdoms-call-player-portal.html'),sitePath('kingdoms-call-data.js'),'PP after');
  const pageFor=f=>/player/.test(f)?PPa:GMa;

  // ── 1. manifest: old literal == new expression, value AND order ──
  const FIX=new Set(['COMBAT_ONLY [FIX]','COMBAT_ONLY (bot duel sim) [+ARROW]','LIGHT_MSG [FIX: +Mountain Guns]','MASTERY_EFFECTS [FIX: engine text]','DRUID_REQ x2 + TAMED_FLYERS_UI [FIX: -> druidNeedP]']);
  let same=0, fixed=0, cantEval=[];
  for(const e of MAN){
    if(FIX.has(e.label)){ fixed++; continue; }
    let a,b;
    try{ a=normLit(e.old); }catch(err){ cantEval.push(e.label+' (old: '+err.message+')'); continue; }
    try{ b=normIn(pageFor(e.file),e.new); }catch(err){ cantEval.push(e.label+' (new: '+err.message+')'); continue; }
    // A replaced Set literal → a Set; an array literal whose replacement was a Set spread etc. is
    // compared on the members in order.
    // Tables that are only ever READ BY KEY, where key order cannot matter (checked by grep when
    // this was written): compare as unordered maps.
    const KEY_ONLY=new Set(['const _RACE_RIVAL=']); // world gen: RACES_P.filter(r=>r!==_RACE_RIVAL[sp.race])
    if(a!==b&&KEY_ONLY.has(e.label)){
      const srt=x=>JSON.stringify((JSON.parse(x).__obj||[]).slice().sort());
      ok(srt(a)===srt(b), `manifest "${e.label}" differs as a map`); same++; continue;
    }
    if(a!==b){
      const ua=JSON.parse(a), ub=JSON.parse(b);
      const flat=x=>x&&x.__set?x.__set:x;
      if(JSON.stringify(flat(ua))===JSON.stringify(flat(ub))) { same++; continue; }
    }
    ok(a===b, `manifest "${e.label}" (${e.file}) differs:\n    old ${a.slice(0,160)}\n    new ${b.slice(0,160)}`);
    if(a===b) same++;
  }
  ok(cantEval.length===0, 'could not evaluate: '+cantEval.join('; '));
  console.log(`1. manifest: ${MAN.length} replaced literals — ${same} proven identical (value+order), ${fixed} intended fixes checked in §4`);

  // ── 2. named tables before vs after ──
  const GM_NAMES=['UNIT_BASE_STR','UNIT_Q_MULT','ARMY_COST_MASTER','ARMY_SPEED_MASTER','QUALITY_TIERS','SEASONS','ALL_SKILLS','ABILITIES_P','ITEM_UNCAPPED_SKILLS','SKILL_LABELS','TERRAIN_COLORS_P','RACES_P','ALIGNMENTS_P','TEMPERS_P','_ITEM_RACE_ALIAS','ITEM_SLOT_CAP','RUMOUR_COST_BY_POWER','BOT_HEX_DIRS','PRIMAL_SEA_NAMES','MISSILE_ARMIES_MASTER','GARRISON_SEA_TYPES_R','GARRISON_AIR_TYPES_R','GARRISON_FLY_TYPES_R','FLYING_TYPES','AERIAL_TYPES','CREATURE_ARMIES','MONSTER_ARMIES','CARRIER_TYPES','PRIMAL_SEA_TYPES','SEA_TYPES','CAVALRY_TYPES','GEN_FLYER_TYPES','SEA_TYPES_GEN','TAMED_FLYER_TYPES_D','BOT_CARRIER_TYPES','BOT_PRIMAL_SEA_TYPES','BOT_AERIAL_TYPES','BOT_LIGHT_ARMIES','BOT_FLYING_TYPES','BOT_CREATURE_ARMIES','BOT_MONSTER_ARMIES','BOT_CAVALRY_TYPES','BOT_NAVAL_TYPES','TITLE_CREATURE_ARMIES','TITLE_MONSTER_ARMIES','DISC_CLS_SETS','_FLEET_TYPES_DISC','HOME_FLEET_BY_RACE','DRUID_ARMY_LEVELS_P','MINOR_CAV','_MAGIC_SCHOOLS','MAGIC_L8_SCHOOLS'];
  const PP_NAMES=['ITEM_SLOT_CAP_P','_ITEM_RACE_ALIAS_P','RUMOUR_COST_BY_POWER_P','SEASONS','GD_BY_ALIGNMENT','PO_SEA_TYPES','PO_CARRIER_TYPES','PO_AERIAL_TYPES','PO_FLYING_TYPES','PO_CAVALRY_TYPES','PO_CREATURE_TYPES','PO_MONSTER_TYPES','PO_LIGHT_TYPES','CREATURE_ARMIES_UI','MONSTER_ARMIES_UI','HUMANOID_RACES_UI','GARRISON_UNIT_TYPES_P','ALIGN_SPECTRUM_PP','HEIR_TEMPERS_LIST','ITEM_UNCAPPED_SKILLS_P','UNIT_BASE_STR_P','UNIT_Q_MULT_P','ALL_SKILLS','SKILL_LABELS','TERRAIN_COLORS_MAP'];
  let nSame=0;
  const cmpNames=(Wb,Wa,names,tag)=>names.forEach(n=>{
    let a,b; try{ a=normIn(Wb,n); }catch(e){ ok(false,`${tag} ${n}: not readable BEFORE (${e.message})`); return; }
    try{ b=normIn(Wa,n); }catch(e){ ok(false,`${tag} ${n}: not readable AFTER (${e.message})`); return; }
    ok(a===b, `${tag} ${n} changed:\n    before ${a.slice(0,200)}\n    after  ${b.slice(0,200)}`); if(a===b) nSame++;
  });
  // DRUID_ARMY_LEVELS_P lost Gyrocopters' level 2 in the PREVIOUS session, not this one — both builds carry that already.
  cmpNames(GMb,GMa,GM_NAMES,'GM'); cmpNames(PPb,PPa,PP_NAMES,'PP');
  // functional: getDruidLevel / druIdPenaltyMult over every unit, race and alignment
  const TYPES=JSON.parse(GMa.eval('JSON.stringify(Object.keys(UNIT_BASE_STR))'));
  let fn=0;
  TYPES.forEach(t=>{ ok(GMb.eval(`getDruidLevel(${JSON.stringify(t)})`)===GMa.eval(`getDruidLevel(${JSON.stringify(t)})`),`getDruidLevel(${t}) differs`); fn++; });
  const RACES=['Human','Elven','Dwarven','Orcish','Primal'], ALIGNS=['Divine','Good','Druidic','Neutral','Pagan','Evil','Undead'];
  for(const t of TYPES) for(const ur of RACES) for(const cr of RACES.slice(0,4)) for(const al of ALIGNS) for(const dru of [0,1,3,5]) for(const tamed of [false,true]){
    const hero=JSON.stringify({race:cr,alignment:al==='Druidic'&&dru===3?'Druidic':'Neutral',skills:{druid:dru},items:[]});
    const army=JSON.stringify({type:t,race:ur});
    const x=`druIdPenaltyMult(${hero},${army},${JSON.stringify(al)},${tamed})`;
    ok(GMb.eval(x)===GMa.eval(x),`druIdPenaltyMult differs for ${x}`); fn++;
  }
  console.log(`2. named tables: ${nSame}/${GM_NAMES.length+PP_NAMES.length} identical before vs after; ${fn} getDruidLevel / druIdPenaltyMult calls identical`);

  // ── 3. the player portal's Druid helper agrees with the ENGINE ──
  let agree=0, disagreeBefore=0;
  const oldPanel=(a,c,rep)=>{ // the BEFORE panel logic, reproduced verbatim, to measure the old drift
    const DRUID_REQ={'Stone Giants':4,'Forest Ents':4,'Giant Eagles':4,'Cave Trolls':4,'Manticore Pride':4,'Basilisk Brood':4,'Sea Giants':4,'Kraken Tentacles':4,'Elder Dragons':5,'Crimson Rocs':5,'Titan Warbeasts':5,'Leviathan Pods':5,'Eagle Riders':3,'Wyvern Riders':3,'Whale Cohort':3,'Noble Griffons':3,'Skeletal Legion':2};
    const CRE=new Set(['Noble Griffons','Giant Eagles','Forest Ents','Stone Giants','Crimson Rocs','Whale Cohort','Eagle Riders']);
    const TAM=new Set(['Eagle Riders','Noble Griffons','Wyvern Riders','Giant Eagles','Manticore Pride','Crimson Rocs','Elder Dragons']);
    let req=DRUID_REQ[a.type]||0; if(a.skeletal) req=0; if(rep.kingdom.alignment==='Druidic'&&CRE.has(a.type)) req=0;
    if((rep.discoveries||[]).some(d=>d.id==='sd40')&&TAM.has(a.type)) req=0;
    const d=(c.skills.druid||0); const eff=(a.race&&a.race===c.race)?Math.max(1,d):d; return Math.max(0,req-eff); };
  for(let i=0;i<6000;i++){
    const t=TYPES[i%TYPES.length];
    const al=ALIGNS[(i*7)%ALIGNS.length], cr=RACES[(i*3)%4], ur=RACES[(i*5)%5];
    const sd40=(i%3===0), personal=(i%11===0)?'Druidic':al, dru=(i*13)%7, skel=(i%17===0);
    const c={race:cr,alignment:personal,skills:{druid:dru},items:[]};
    const a={type:t,race:ur,skeletal:skel,_isSkeletal:skel};
    const rep={kingdom:{alignment:al},discoveries:sd40?[{id:'sd40'}]:[]};
    const tamedEng=sd40&&GMa.eval(`TAMED_FLYER_TYPES_D.has(${JSON.stringify(t)})`);
    const eng=GMa.eval(`druIdPenaltyMult(${JSON.stringify(c)},${JSON.stringify(a)},${JSON.stringify(al)},${tamedEng})`);
    const pp=JSON.parse(PPa.eval(`JSON.stringify(druidNeedP(${JSON.stringify(a)},${JSON.stringify(c)},${JSON.stringify(rep)}))`));
    const ppMult=pp.shortfall>0?Math.max(0.1,1-pp.shortfall*0.2):1;
    ok(Math.abs(ppMult-eng)<1e-9, `druidNeedP disagrees with the engine: ${t} (${ur}) under a ${cr} ${personal} commander, Druid ${dru}, realm ${al}${sd40?', sd40':''}${skel?', skeletal':''} — portal ×${ppMult}, engine ×${eng}`);
    if(Math.abs(ppMult-eng)<1e-9) agree++;
    const old=oldPanel(a,c,rep); const oldMult=old>0?Math.max(0.1,1-old*0.2):1;
    if(Math.abs(oldMult-eng)>1e-9) disagreeBefore++;
  }
  console.log(`3. Druid: the player portal now agrees with the engine on ${agree}/6000 random cases (the old panel logic disagreed on ${disagreeBefore})`);

  // ── 4. the intended fixes changed exactly what they should ──
  const CO=JSON.parse(GMa.eval('JSON.stringify([...COMBAT_ONLY_TACTICS])'));
  ['FI','FIRE','ARROW','ME','MELEE','CA','SPELL','FL','FLEE','AR','ARCHERY'].forEach(k=>ok(CO.includes(k),`COMBAT_ONLY_TACTICS lacks ${k}`));
  ['ST','STEAL','TA','TALK','SC','SCOUT','MS'].forEach(k=>ok(!CO.includes(k),`COMBAT_ONLY_TACTICS should not keep ${k}`));
  const oldCO=['ME','MELEE','AR','ARCHERY','CA','SPELL','FL','FLEE'];
  ok(JSON.stringify(CO.filter(x=>!oldCO.includes(x)))===JSON.stringify(['FI','FIRE','ARROW']),'COMBAT_ONLY: the only additions must be FI, FIRE, ARROW');
  const LF=JSON.parse(GMa.eval('JSON.stringify(KC_UNIT_CLASS.lightFoot)'));
  const oldMsg=['Shieldwall Levies','Yeoman Longbows','Ironwood Crossbows','Elven Bowmen','Shadow Archers','Human Garrison','Elven Garrison','Dwarf Garrison','Orc Garrison','Goblin Horde','Forest Wardens','Dwarven Guard','Orc Berserkers'];
  ok(JSON.stringify(LF.filter(x=>!oldMsg.includes(x)))===JSON.stringify(['Mountain Guns'])&&oldMsg.every(x=>LF.includes(x)),'LIGHT_MSG: the only change must be +Mountain Guns');
  const mEng=JSON.parse(GMa.eval('JSON.stringify(MASTERY_UNLOCKS)')), mPP=JSON.parse(PPa.eval('JSON.stringify(MASTERY_EFFECTS)'));
  ok(JSON.stringify(mEng)===JSON.stringify(mPP),'MASTERY_EFFECTS must now BE the engine table');
  const mOld=JSON.parse(PPb.eval('JSON.stringify(MASTERY_EFFECTS)'));
  let changed=[]; Object.keys(mOld).forEach(k=>Object.keys(mOld[k]).forEach(L=>{ if(mOld[k][L]!==mPP[k][L]) changed.push(k+' L'+L); }));
  // Nine player-visible changes: the engine text wins. The tenth drift (Druid L9) went the other way —
  // the player portal's newer wording ("wild (Creature or Monster)") was moved INTO the data file,
  // so players see no change there and the GM-side text changed instead.
  const expect9=['melee L6','melee L8','archery L6','archery L8','psychic L6','illusory L6','illusory L9','elemental L6','necromancy L6'];
  ok(JSON.stringify(changed)===JSON.stringify(expect9),`player-visible mastery changes should be exactly ${expect9.join(', ')}; got ${changed.join(', ')}`);
  const mEngBefore=JSON.parse(GMb.eval('JSON.stringify(MASTERY_UNLOCKS)'));
  ok(mEng.druid[9]===mOld.druid[9]&&mEngBefore.druid[9]!==mEng.druid[9],'Druid L9: data file should now carry the player portal\'s wording');
  console.log(`4. fixes: duels keep FI/FIRE/ARROW; the sea-lift message counts Mountain Guns as light; players now read the engine's mastery text (${changed.length} entries changed: ${changed.join(', ')})`);
  // spy report categories: every army type falls in exactly one of the three groups now
  const cls=JSON.parse(GMa.eval('JSON.stringify(KC_UNIT_CLASS)'));
  const cav=t=>cls.cavalry.includes(t)||cls.flying.includes(t), nav=t=>cls.carrier.includes(t);
  let multi=TYPES.filter(t=>[cav(t),nav(t),!cav(t)&&!nav(t)].filter(Boolean).length!==1);
  ok(multi.length===0,'spy categories overlap: '+multi.join(', '));
  const oldCav=['Free Lances','Gilded Lances','Warg Riders','Eagle Riders','Noble Griffons','Wyvern Riders','Gnomish Gyrocopters'];
  ok(TYPES.filter(cav).sort().join()===oldCav.slice().sort().join(),'spy "cavalry-type" membership must be unchanged');
  const oldInfExcl=['Free Lances','Gilded Lances','Warg Riders','Eagle Riders','Galleon Fleet','Corsair Fleet','Elven Galleys','Dwarf Ironclads','Orcish Longships','Whale Cohort'];
  const dbl=TYPES.filter(t=>oldCav.includes(t)&&!oldInfExcl.includes(t));
  console.log(`   spy report: the old lists counted ${dbl.length} types as BOTH cavalry and infantry (${dbl.join(', ')}); now every type is in exactly one group`);

  console.log(`\n${checks} checks, ${fails} failure${fails!==1?'s':''}`);
  process.exit(fails?1:0);
})();
