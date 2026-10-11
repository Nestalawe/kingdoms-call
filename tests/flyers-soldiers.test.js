// 2026-10-11 (Toby, the winged riders are soldiers of their race) — Eagle Riders, Noble Griffons and
// Wyvern Riders are no longer Creatures or Monsters: Druid 1 to lead like every racial troop (waived for
// their own race), no place in Awaken the Wild or Dragon Taming, and their own strikes land one time in
// two whatever the commander's Druid. Level 1 (unit): the data file's tables, the booted GM portal's
// getDruidLevel and primalStrikeChance, and the player portal's Druid table.
const fs=require('fs'), vm=require('vm');
const {readPage,bootJsdom,sitePath}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const RIDERS=['Eagle Riders','Noble Griffons','Wyvern Riders'];

(async()=>{
  const D=vm.runInNewContext(fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8')+'\n;({KC_UNIT_CLASS,KC_DRUID_LEVELS,KC_AWAKEN_TIERS})',{});
  for(const r of RIDERS){
    ok(!D.KC_UNIT_CLASS.creature.includes(r)&&!D.KC_UNIT_CLASS.monster.includes(r),`${r} are neither Creature nor Monster`);
    ok(!D.KC_UNIT_CLASS.tamedFlyer.includes(r),`${r} are not a flyer to be tamed`);
    ok(D.KC_UNIT_CLASS.flying.includes(r)&&D.KC_UNIT_CLASS.aerial.includes(r),`${r} still fly`);
    ok(D.KC_DRUID_LEVELS[1].includes(r)&&![2,3,4,5].some(l=>(D.KC_DRUID_LEVELS[l]||[]).includes(r)),`${r} sit at Druid 1 with the other racial troops`);
    ok(!(r in D.KC_AWAKEN_TIERS),`${r} cannot be called up by Awaken the Wild`);
  }
  ok(D.KC_DRUID_LEVELS[3].join()==='Whale Cohort','Druid 3 is left to the Whale Cohort');
  ok(Object.keys(D.KC_AWAKEN_TIERS).join()==='Giant Eagles,Forest Ents,Stone Giants,Crimson Rocs','Awaken the Wild offers Giant Eagles, Forest Ents, Stone Giants and Crimson Rocs');
  ok(!Object.values(D.KC_DRUID_LEVELS).some(l=>l.includes('Gnomish Gyrocopters')),'Gnomish Gyrocopters still need nobody');

  const boot=async(page)=>{ const errors=[]; const dom=bootJsdom(readPage(page),{supabase:{createClient:()=>nullStub()},url:'https://example.org/x',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
    await new Promise(r=>setTimeout(r,1200)); return {dom,errors,ev:x=>dom.window.eval(x)}; };
  const gm=await boot('kingdoms-call-gm-portal.html');
  ok(gm.errors.length===0,'the GM portal boots'+(gm.errors.length?' — '+gm.errors[0].split('\n')[0]:''));
  for(const r of RIDERS) ok(gm.ev(`getDruidLevel(${JSON.stringify(r)})`)===1,`the engine asks Druid 1 of ${r}, as of Levies`);
  ok(gm.ev("getDruidLevel('Giant Eagles')")===4&&gm.ev("getDruidLevel('Shieldwall Levies')")===1&&gm.ev("getDruidLevel('Gnomish Gyrocopters')")===0,'Giant Eagles still need Druid 4, Levies Druid 1, Gyrocopters none');
  const chance=gm.ev('primalStrikeChance');
  ok(typeof chance==='function','primalStrikeChance() is declared at module level');
  ok(chance(0,null,'Noble Griffons')===50&&chance(5,null,'Noble Griffons')===50&&chance(0,null,'Wyvern Riders')===50,'a winged rider\'s strike lands one time in two whatever the Druid');
  ok(chance(0,null,'Giant Eagles')===30&&chance(2,null,'Elder Dragons')===50&&chance(9,null,'Elder Dragons')===90,'a beast\'s strike still runs 30% + 10% a level, capped at 90');
  ok(chance(0,null)===30,'…and with no unit named, the beasts\' figure');
  gm.dom.window.close();
  const pp=await boot('kingdoms-call-player-portal.html');
  ok(pp.errors.length===0,'the player portal boots'+(pp.errors.length?' — '+pp.errors[0].split('\n')[0]:''));
  for(const r of RIDERS) ok(pp.ev(`DRUID_LEVEL_OF_P[${JSON.stringify(r)}]`)===1,`the player portal's Druid table says 1 for ${r}`);
  pp.dom.window.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
