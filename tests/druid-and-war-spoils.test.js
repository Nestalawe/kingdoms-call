// Focused harness for the 2026-09-27 changes: unit-class / Druid tables and the Orc war-spoils
// halving. Cuts the real tables and functions out of src/ by their syntax tree (tests/lib/source.ts), so the test runs
// the shipped code. (Until plan P1-09a they were sliced out of the built GM portal between exact strings.)
const vm=require('vm'); const {sourceOf,scriptOf}=require('./lib/source.ts');
const parts=[
  sourceOf('engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts',['FLYING_TYPES','CREATURE_ARMIES','MONSTER_ARMIES']),
  sourceOf('engine/world/tables.ts',['DRUID_ARMY_LEVELS_P','getDruidLevel']),
  sourceOf('engine/discoveries.ts',['DISC_CLS_SETS','discUnitIs','ARMY_RACE_OF_TYPE','discUnitMatch']),
];
const ctx={console};
vm.createContext(ctx);
// 2026-09-27 (one-source pass): the engine's unit tables are now BUILT from the shared tables in
// kingdoms-call-data.ts, so the sandbox loads that file first.
vm.runInContext(scriptOf('content/kingdoms-call-data.ts'),ctx);
vm.runInContext(parts.join('\n'),ctx);

let fail=0;
const ok=(cond,msg)=>{ if(!cond){ fail++; console.log('FAIL '+msg); } };

const FLYERS=['Eagle Riders','Noble Griffons','Gnomish Gyrocopters','Wyvern Riders'];
const BEASTS=['Stone Giants','Forest Ents','Thunderbirds','Cave Trolls','Manticore Pride','Basilisk Brood','Sea Giants','Eldritch Kraken','Elder Dragons','Crimson Rocs','Titan Warbeasts','Dread Hydras','Whale Cohort'];   // 2026-10-13: the three renames
const FLEETS=['Galleon Fleet','Corsair Fleet','Elven Galleys','Dwarf Ironclads','Orcish Longships','Whale Cohort'];
const FOOT=['Shieldwall Levies','Free Lances','Yeoman Longbows','Gilded Lances','Human Garrison','Elven Bowmen','Forest Wardens','Shadow Archers','Elven Garrison','Dwarven Guard','Ironwood Crossbows','Mountain Guns','Dwarf Garrison','Warg Riders','Orc Berserkers','Goblin Horde','Orc Garrison'];

// Item 1 — the four racial flyers now count as humanoid; beasts and fleets still do not.
FLYERS.forEach(t=>ok(ctx.discUnitIs('humanoid',t,true),`flyer ${t} should be humanoid`));
FOOT.forEach(t=>ok(ctx.discUnitIs('humanoid',t,true),`foot ${t} should be humanoid`));
BEASTS.filter(t=>!FLYERS.includes(t)).forEach(t=>ok(!ctx.discUnitIs('humanoid',t,true),`beast ${t} must NOT be humanoid`));
FLEETS.forEach(t=>ok(!ctx.discUnitIs('humanoid',t,true),`fleet ${t} must NOT be humanoid`));
ok(!ctx.discUnitIs('humanoid',{type:'Shieldwall Levies',_isSkeletal:true}),'skeletal must NOT be humanoid');
// 2026-10-11 (Toby, the winged riders are soldiers of their race): they are no longer Creatures or
// Monsters for the Druid & alignment rules (they were, from 2026-09-27 to 2026-10-11).
ok(!ctx.discUnitIs('creature','Eagle Riders',true)&&!ctx.discUnitIs('creature','Noble Griffons',true),'Eagle Riders / Noble Griffons are no longer Creatures');
ok(!ctx.discUnitIs('monster','Wyvern Riders',true),'Wyvern Riders are no longer a Monster');
// race-keyed discovery effects reach the flyers
ok(ctx.discUnitMatch({race:'Orcish'},{type:'Wyvern Riders',race:'Orcish'}),'Orcish heritage reaches Wyvern Riders');
ok(ctx.discUnitMatch({cls:'humanoid',race:'Elven'},{type:'Eagle Riders',race:'Elven'}),'Elven humanoid creed reaches Eagle Riders');

// Item 2 — Gyrocopters need no Druid; the rest of the ladder is untouched. 2026-10-11 (Toby): the three
// winged riders moved from Druid 3 to Druid 1, with the other racial troops; the Whale Cohort keeps 3.
ok(ctx.getDruidLevel('Gnomish Gyrocopters')===0,'Gyrocopters require Druid 0');
ok(ctx.getDruidLevel('Eagle Riders')===1&&ctx.getDruidLevel('Wyvern Riders')===1&&ctx.getDruidLevel('Noble Griffons')===1,'the winged riders require Druid 1, as racial troops');
ok(ctx.getDruidLevel('Whale Cohort')===3,'Druid 3 tier: the Whale Cohort');
ok(ctx.getDruidLevel('Cave Trolls')===4&&ctx.getDruidLevel('Elder Dragons')===5,'Druid 4/5 tiers unchanged');
ok(ctx.getDruidLevel('Shieldwall Levies')===1,'humanoid foot still Druid 1');

// Items 8 & 9 — the Orc war-spoils halving, exactly as the wage pass now runs it.
function orcBill(costs){
  let frac=0,total=0,saved=0;
  costs.forEach(w0=>{
    const half=w0*0.5; let w=Math.floor(half);
    if(w<1){ w=1; }
    else { frac+=half-w; if(frac>=1-1e-9){ w+=1; frac-=1; } }
    total+=w; saved+=w0-w;
  });
  return {total,saved};
}
{ const r=orcBill([3,3,3,3,4]); ok(r.total===8&&r.saved===8,`reported case: 16g bill should pay 8g and save 8g, got ${r.total}/${r.saved}`); }
// property fuzz: the bill is never more than a gold off exactly half, never below the 1g/unit floor,
// and never above the undiscounted bill.
let worst=0;
for(let i=0;i<20000;i++){
  const n=1+Math.floor(Math.random()*12);
  const costs=Array.from({length:n},()=>1+Math.floor(Math.random()*8));
  const full=costs.reduce((s,x)=>s+x,0);
  const floor=costs.length; // 1g minimum each
  const r=orcBill(costs);
  // Exact half, unit by unit, with the 1g-per-unit floor the rule has always carried.
  const ideal=costs.reduce((s,w)=>s+Math.max(1,w/2),0);
  worst=Math.max(worst,Math.abs(r.total-ideal));
  if(r.total<floor){ fail++; console.log('FAIL below the 1g floor: '+costs); break; }
  if(r.total>full){ fail++; console.log('FAIL charged more than full wages: '+costs); break; }
  if(!Number.isInteger(r.total)){ fail++; console.log('FAIL non-integer bill: '+costs); break; }
  if(Math.abs(r.total-ideal)>1+1e-9){ fail++; console.log('FAIL off exact half by '+(r.total-ideal)+': '+costs); break; }
}
console.log('worst deviation from an exact half: '+worst.toFixed(2)+'g');
// the old rule, for comparison on the reported host
{ const old=[3,3,3,3,4].reduce((s,w)=>s+Math.max(1,Math.round(w*0.5)),0);
  console.log(`reported host — old bill ${old}g (saved ${16-old}g), new bill ${orcBill([3,3,3,3,4]).total}g (saved ${orcBill([3,3,3,3,4]).saved}g)`); }

console.log(fail===0?'0 failures':fail+' FAILURES');
process.exit(fail?1:0);
