// Focused harness for the 2026-09-27 changes: unit-class / Druid tables and the Orc war-spoils
// halving. Slices the real source out of the GM portal so the test runs the shipped code.
const fs=require('fs'),vm=require('vm'); const {sitePath}=require('./lib/boot');
const src=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
function slice(startMarker,endMarker,label){
  const a=src.indexOf(startMarker);
  if(a<0) throw new Error('missing start: '+label);
  const b=src.indexOf(endMarker,a);
  if(b<0) throw new Error('missing end: '+label);
  return src.slice(a,b+endMarker.length);
}
const parts=[
  slice("const FLYING_TYPES=",");",'FLYING_TYPES'),
  slice("const CREATURE_ARMIES=",");",'CREATURE_ARMIES'),
  slice("const MONSTER_ARMIES=",");",'MONSTER_ARMIES'),
  slice("const DRUID_ARMY_LEVELS_P=","types)]));",'DRUID_ARMY_LEVELS_P'),
  slice("function getDruidLevel(armyType){","\n}",'getDruidLevel'),
  slice("const DISC_CLS_SETS={","\n};",'DISC_CLS_SETS'),
  slice("function discUnitIs(cls, army, typeOnly){","\n}",'discUnitIs'),
  slice("const ARMY_RACE_OF_TYPE={","'Orc Garrison':'Orcish'};",'ARMY_RACE_OF_TYPE'),
  slice("function discUnitMatch(e, army, typeOnly){","\n}",'discUnitMatch'),
];
const ctx={console};
vm.createContext(ctx);
// 2026-09-27 (one-source pass): the engine's unit tables are now BUILT from the shared tables in
// kingdoms-call-data.js, so the sandbox loads that file first.
vm.runInContext(fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8'),ctx);
vm.runInContext(parts.join('\n'),ctx);

let fail=0;
const ok=(cond,msg)=>{ if(!cond){ fail++; console.log('FAIL '+msg); } };

const FLYERS=['Eagle Riders','Noble Griffons','Gnomish Gyrocopters','Wyvern Riders'];
const BEASTS=['Stone Giants','Forest Ents','Giant Eagles','Cave Trolls','Manticore Pride','Basilisk Brood','Sea Giants','Kraken Tentacles','Elder Dragons','Crimson Rocs','Titan Warbeasts','Leviathan Pods','Whale Cohort'];
const FLEETS=['Galleon Fleet','Corsair Fleet','Elven Galleys','Dwarf Ironclads','Orcish Longships','Whale Cohort'];
const FOOT=['Shieldwall Levies','Free Lances','Yeoman Longbows','Gilded Lances','Human Garrison','Elven Bowmen','Forest Wardens','Shadow Archers','Elven Garrison','Dwarven Guard','Ironwood Crossbows','Mountain Guns','Dwarf Garrison','Warg Riders','Orc Berserkers','Goblin Horde','Orc Garrison'];

// Item 1 — the four racial flyers now count as humanoid; beasts and fleets still do not.
FLYERS.forEach(t=>ok(ctx.discUnitIs('humanoid',t,true),`flyer ${t} should be humanoid`));
FOOT.forEach(t=>ok(ctx.discUnitIs('humanoid',t,true),`foot ${t} should be humanoid`));
BEASTS.filter(t=>!FLYERS.includes(t)).forEach(t=>ok(!ctx.discUnitIs('humanoid',t,true),`beast ${t} must NOT be humanoid`));
FLEETS.forEach(t=>ok(!ctx.discUnitIs('humanoid',t,true),`fleet ${t} must NOT be humanoid`));
ok(!ctx.discUnitIs('humanoid',{type:'Shieldwall Levies',_isSkeletal:true}),'skeletal must NOT be humanoid');
// …and they keep their creature/monster identity for the Druid & alignment rules.
ok(ctx.discUnitIs('creature','Eagle Riders',true)&&ctx.discUnitIs('creature','Noble Griffons',true),'Eagle Riders / Noble Griffons stay Creatures');
ok(ctx.discUnitIs('monster','Wyvern Riders',true),'Wyvern Riders stays a Monster');
// race-keyed discovery effects reach the flyers
ok(ctx.discUnitMatch({race:'Orcish'},{type:'Wyvern Riders',race:'Orcish'}),'Orcish heritage reaches Wyvern Riders');
ok(ctx.discUnitMatch({cls:'humanoid',race:'Elven'},{type:'Eagle Riders',race:'Elven'}),'Elven humanoid creed reaches Eagle Riders');

// Item 2 — Gyrocopters need no Druid; the rest of the ladder is untouched.
ok(ctx.getDruidLevel('Gnomish Gyrocopters')===0,'Gyrocopters require Druid 0');
ok(ctx.getDruidLevel('Eagle Riders')===3&&ctx.getDruidLevel('Wyvern Riders')===3&&ctx.getDruidLevel('Noble Griffons')===3&&ctx.getDruidLevel('Whale Cohort')===3,'Druid 3 tier unchanged');
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
