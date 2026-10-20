// 2026-10-13 (Toby, Creatures and Monsters I) — the wild roster as decided (tests/lib/primal-decided.js): every
// live Creature and Monster's family, type, cost, base strength, move rate, Druid level and terrain multipliers,
// read from the data file and from the GM portal's own tables; terrain written ONCE (the always-on terrain
// multipliers of Stone Giants, Forest Ents, Cave Trolls and the Titans' Colossal Bulk are gone from
// unitAbilityMult, the others stay); the two crowns' waivers in the one function that applies the Druid
// shortfall (Evil leads Monsters free, as Druidic leads Creatures); the player portal's mirror of it, its
// speeds built from the one primal table. (The summoning tier tables went with Awaken the Wild and Call from the
// Pit on 2026-10-12, Toby item 22: tests/beast-calls-gone checks they are gone.)
// Level 1 (unit): the figures are data in the shared file and in the GM portal's tables (ARMY_COST_MASTER and
// ARMY_SPEED_MASTER at module level, TERRAIN_MODS inside runTurn and so read by slicing the source); the rules
// retired or widened here are module-level functions the booted portals answer directly.
const fs=require('fs'), vm=require('vm');
const {sitePath,readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
const {pageInitializer,scriptOf}=require('./lib/source.ts');
const P=require('./lib/primal-decided'); const {ROSTER,RENAMED,LAND_TERRAINS,LIVE,COMING}=P;
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-9;

(async()=>{
  // ── The shared data file ──
  const ctx=vm.createContext({});
  vm.runInContext(scriptOf('content/kingdoms-call-data.ts'),ctx);
  const D=vm.runInContext('({S:KC_UNIT_BASE_STR,C:KC_UNIT_CLASS,T:KC_UNIT_TYPE,L:KC_DRUID_LEVELS,PR:PRIMAL_ARMY_DEFS_P})',ctx);
  const druidOf=u=>{ for(const [l,list] of Object.entries(D.L)) if(list.includes(u)) return +l; return 0; };
  for(const u of LIVE){
    const d=ROSTER[u];
    ok(D.T[u]===d.type,`${u}: KC_UNIT_TYPE is '${d.type}' (got ${D.T[u]})`);
    ok(D.S[u]===d.str,`${u}: base strength ${d.str} (got ${D.S[u]})`);
    // (The Whale Cohort's price and pace live in the GM portal's master tables, checked below; every other
    // beast's are written once in PRIMAL_ARMY_DEFS_P.)
    if(u!=='Whale Cohort'){
      ok(!!D.PR[u]&&D.PR[u].cost===d.cost,`${u}: cost ${d.cost} (got ${D.PR[u]&&D.PR[u].cost})`);
      ok(!!D.PR[u]&&D.PR[u].speed===d.speed,`${u}: move ${d.speed} (got ${D.PR[u]&&D.PR[u].speed})`);
    }
    ok(druidOf(u)===d.druid,`${u}: Druid ${d.druid} to lead (got ${druidOf(u)})`);
    const fam=D.C.creature.includes(u)?'Creature':D.C.monster.includes(u)?'Monster':'neither';
    ok(fam===d.family,`${u}: a ${d.family} in KC_UNIT_CLASS (got ${fam})`);
  }
  for(const u of COMING) ok(!(u in D.S)&&!(u in D.T),`${u} is not in the tables yet (it arrives in its own PR)`);
  for(const u of Object.keys(RENAMED)) ok(!(u in D.S)&&!(u in D.T),`${u} is out of the tables (it is ${RENAMED[u]} now)`);

  // ── The GM portal's own tables ──
  // the table is the value the GM portal's code first declares it with, read by its syntax tree (tests/lib/source.ts;
  // until plan P1-09a it was cut out of the built page's text)
  const tm=pageInitializer('kingdoms-call-gm-portal.html','TERRAIN_MODS'); ok(!!tm,'the GM portal declares TERRAIN_MODS');
  let TM={}; try{ TM=tm?vm.runInContext(tm,ctx):{}; }catch(e){ ok(false,'TERRAIN_MODS evaluates on its own: '+e.message); }
  for(const u of LIVE){
    const d=ROSTER[u];
    for(const t of LAND_TERRAINS){
      const got=((TM[t]||{})[u])??1, want=(P.isLand(d)||d.type==='flyer')?((d.terr[t])??1):1;   // a flyer: ×0.75 in the woods (item 19)
      ok(near(got,want),`${u} in ${t}: TERRAIN_MODS ×${want} (got ×${got})`);
    }
  }

  // ── The booted GM portal ──
  const boot=async(page)=>{ const errors=[]; const dom=bootJsdom(readPage(page),{supabase:{createClient:()=>nullStub()},url:'https://example.org/'+page,
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
    await new Promise(r=>setTimeout(r,1200)); return {dom,errors,ev:x=>{ try{ return dom.window.eval(x); }catch(e){ return 'THREW: '+e.message; } }}; };
  const g=await boot('kingdoms-call-gm-portal.html');
  ok(g.errors.length===0,'the GM portal boots'+(g.errors.length?' — '+g.errors[0].split('\n')[0]:''));
  for(const u of LIVE){
    ok(g.ev(`ARMY_COST_MASTER[${JSON.stringify(u)}]`)===ROSTER[u].cost,`${u}: ARMY_COST_MASTER is ${ROSTER[u].cost}`);
    ok(g.ev(`ARMY_SPEED_MASTER[${JSON.stringify(u)}]`)===ROSTER[u].speed,`${u}: ARMY_SPEED_MASTER is ${ROSTER[u].speed}`);
  }
  // Terrain written once: the always-on multipliers that doubled a terrain row are gone; the posture and
  // enemy-composition ones stay.
  const mult=(t,terrain,extra)=>g.ev(`unitAbilityMult({type:${JSON.stringify(t)},quality:'Average'},Object.assign({force:[{type:${JSON.stringify(t)}}],enemyForce:[{type:'Shieldwall Levies'}]},${JSON.stringify(extra||{})}),${JSON.stringify(terrain)})`);
  ok(mult('Stone Giants','mountain')===1,`Stone Giants in the mountains: no Mountain Bulwark on top of the terrain row (got ×${mult('Stone Giants','mountain')})`);
  ok(mult('Forest Ents','forest')===1&&mult('Forest Ents','jungle')===1,`Forest Ents in the woods: no Rooted Grove on top of the terrain row (got ×${mult('Forest Ents','forest')})`);
  ok(mult('Cave Trolls','plain')===1&&mult('Cave Trolls','mountain')===1,`Cave Trolls: no always-on Regenerating Hide multiplier (got ×${mult('Cave Trolls','plain')} / ×${mult('Cave Trolls','mountain')})`);
  ok(mult('Titan Warbeasts','plain')===1,`Titan Warbeasts: no always-on ×1.3 (got ×${mult('Titan Warbeasts','plain')})`);
  ok(near(mult('Basilisk Brood','plain',{isAttacker:false}),1.25)&&mult('Basilisk Brood','plain',{isAttacker:true})===1,'Stone Deterrent still ×1.25 defending only');
  ok(near(mult('Manticore Pride','plain',{isAttacker:true}),1.25)&&mult('Manticore Pride','plain',{isAttacker:false})===1,'Relentless Hunt still ×1.25 attacking only');
  ok(near(mult('Elder Dragons','plain'),1.25),'Wyrmscale still ×1.25');
  ok(near(mult('Sea Giants','plain',{coastal:true}),1.2)&&mult('Sea Giants','sea',{coastal:true})===1,'Tidal Might still ×1.2 on a coast and not at sea');
  const rocs=g.ev(`unitAbilityMult({type:'Crimson Rocs'},{force:[],enemyForce:[{type:'Yeoman Longbows'}]},'plain')`);
  ok(near(rocs,1.3),`Air Superiority still ×1.3 against ranged (got ×${rocs})`);
  // The two crowns, in the one function that applies the Druid shortfall.
  const pen=(align,druid,unit,heroAlign)=>g.ev(`druIdPenaltyMult({race:'Orcish',alignment:${JSON.stringify(heroAlign||'Neutral')},skills:{druid:${druid}},items:[]},{type:${JSON.stringify(unit)},race:'Primal'},${JSON.stringify(align)},false)`);
  ok(pen('Evil',0,'Cave Trolls')===1,`an Evil realm leads Cave Trolls with no Druid (got ×${pen('Evil',0,'Cave Trolls')})`);
  ok(pen('Evil',0,'Elder Dragons')===1,`…and Elder Dragons (Druid 5) too (got ×${pen('Evil',0,'Elder Dragons')})`);
  ok(pen('Druidic',0,'Forest Ents')===1,'a Druidic realm still leads Creatures free');
  ok(near(pen('Evil',0,'Forest Ents'),0.2),`an Evil realm gets no waiver for a Creature: Ents at Druid 0 fight ×0.2 (got ×${pen('Evil',0,'Forest Ents')})`);
  ok(near(pen('Druidic',0,'Cave Trolls'),0.2),`a Druidic realm gets no waiver for a Monster (got ×${pen('Druidic',0,'Cave Trolls')})`);
  ok(near(pen('Neutral',1,'Cave Trolls'),0.4),`a Neutral Druid 1 hero leads Cave Trolls at ×0.4 (got ×${pen('Neutral',1,'Cave Trolls')})`);
  ok(pen(null,0,'Cave Trolls','Evil')===1,'a personally Evil wandering hero (no realm) leads Monsters free, as a personally Druidic one leads Creatures');
  g.dom.window.close();

  // ── The booted player portal ──
  const p=await boot('kingdoms-call-player-portal.html');
  ok(p.errors.length===0,'the player portal boots'+(p.errors.length?' — '+p.errors[0].split('\n')[0]:''));
  for(const u of LIVE.filter(u=>u in D.PR)) ok(p.ev(`PRIMAL_ARMY_SPEEDS[${JSON.stringify(u)}]`)===ROSTER[u].speed,`the player portal's speed for ${u} is ${ROSTER[u].speed} (got ${p.ev(`PRIMAL_ARMY_SPEEDS[${JSON.stringify(u)}]`)})`);
  const need=(align,unit,druid)=>p.ev(`druidNeedP({type:${JSON.stringify(unit)},race:'Primal'},{race:'Orcish',alignment:'Neutral',skills:{druid:${druid}}},{kingdom:{alignment:${JSON.stringify(align)}},discoveries:[]})`);
  const e=need('Evil','Cave Trolls',0), dr=need('Druidic','Forest Ents',0), n=need('Neutral','Cave Trolls',1);
  ok(e&&e.req===0&&e.shortfall===0,`the player portal: an Evil realm needs no Druid for Cave Trolls (got ${JSON.stringify(e)})`);
  ok(dr&&dr.req===0,'…and a Druidic realm none for Forest Ents');
  ok(n&&n.req===4&&n.shortfall===3,`…and a Neutral Druid 1 hero is 3 short for Cave Trolls (got ${JSON.stringify(n)})`);
  p.dom.window.close();

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
