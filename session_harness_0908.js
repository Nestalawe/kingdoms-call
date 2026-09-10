// Session 2026-09-07 harness: phantom labels, equip gating (alt names), home-ground founder rule,
// race/alignment discovery eligibility + effect hooks, mastery-item removal, temper items, explore.
const fs=require('fs');const {JSDOM}=require('jsdom');
let ROWS={};const WRITES=[];
function sbStub(){const res=d=>Promise.resolve({data:d,error:null});
  const chain=t=>{const o={};['select','eq','neq','in','order','limit','gte','lte','is','not','or','filter'].forEach(m=>o[m]=()=>o);
    ['update','insert','upsert','delete'].forEach(m=>o[m]=v=>{WRITES.push({table:t,val:v});return o;});
    o.single=o.maybeSingle=()=>res(ROWS[t+'_one']!==undefined?ROWS[t+'_one']:null);
    o.then=f=>res(ROWS[t+'_list']!==undefined?ROWS[t+'_list']:[]).then(f);return o;};
  return{from:t=>chain(t),auth:{getSession:()=>res({session:null}),getUser:()=>res({user:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:()=>res({})},channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}};}
function load(file,label,errors){return new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',
  beforeParse(w){w.supabase={createClient:()=>sbStub()};w.confirm=()=>true;w.alert=()=>{};
    w.addEventListener('error',e=>errors.push(label+': '+(e.error&&e.error.stack||e.message)));
    w.onunhandledrejection=e=>errors.push(label+' rejection: '+(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errors.push(label+' console.error: '+a.map(String).join(' '));w.console.warn=()=>{};w.console.log=()=>{};}});}
(async()=>{
let fails=0;const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m);if(!c)fails++;};
const errors=[];const dom=load('kingdoms-call-gm-portal.html','GM',errors);
await new Promise(r=>setTimeout(r,300));const W=dom.window;
['ALL_MAGIC_ITEMS_P','MONSTERS_P','SAGE_DISCOVERIES_P','DISC_BY_ID','ENCOUNTER_CLEAR_GOLD_BANDS','MONSTER_CAT_ITEM_USE','_ITEM_ALT_BASE'].forEach(n=>{W[n]=W.eval(n);});
// ── module-level checks ──
const MON=W.MONSTERS_P, items=W.ALL_MAGIC_ITEMS_P;
ok(MON.length===110,'item 4: bestiary doubled to 110 (got '+MON.length+')');
ok(MON.every(m=>m.cat&&W.MONSTER_CAT_ITEM_USE[m.cat]!==undefined),'item 4: every guardian has a known category');
ok(MON.slice(55).filter(m=>m.cat==='undead').length===14,'item 4: 14 of the 55 new guardians are undead (25%)');
ok(new Set(MON.map(m=>m.name)).size===110,'item 4: guardian names unique');
const cu=items.filter(it=>it.effect&&it.effect.stat==='combatUse'); const bound=items.filter(it=>it.race||it.alignment);
ok(cu.length===98&&bound.length===82,`item 4: 98 combat-use (49×2, 7 of them race/alignment-bound) and 82 bound (41×2) items in the pool (got ${cu.length}/${bound.length})`);
ok(new Set(items.map(i=>i.name)).size===items.length,'item 4: item names unique ('+items.length+' total)');
ok(W.guardianCanUseItem({cat:'humanoid'},{name:'Blade of Fury'})&&!W.guardianCanUseItem({cat:'vermin'},{name:'Potion of Healing'})&&W.guardianCanUseItem({cat:'dragon'},{name:'Amulet of Fortitude'})&&!W.guardianCanUseItem({cat:'dragon'},{name:'Blade of Fury'}),'item 4: category item-use policy');
ok(W.monsterCat({name:'Skeleton Sentinel'})==='undead'&&W.monsterCat({name:'Giant Wasp'})==='vermin','item 4: legacy (uncategorised) monsters fall back on name');
const dw={race:'Dwarven',alignment:'Good',items:[{name:'Dwarf-Forged Warhammer',race:'Dwarf',effect:{stat:'melee',bonus:2},slot:'weapon'},{name:'Skull-Cleaver',race:'Orc',effect:{stat:'melee',bonus:2},slot:'weapon'}]};
ok(W.activeItems(dw).length===1&&W.activeItems(dw)[0].name==='Dwarf-Forged Warhammer'&&dw.items[1].equipped===false,'item 4: race-bound item inert (and never auto-equipped) in the wrong hands');
// item 9: bell-curve die
{ const win=r=>{ let w=0,n=100000; for(let i=0;i<n;i++){ const f=W.battleFortune(); if(r*f.atk>=1*f.def) w++; } return w/n; };
  const p15=win(1.5),p2=win(2),p3=win(3),p4=win(4),pu=win(0.5);
  ok(Math.abs(p2-0.80)<0.01&&Math.abs(p3-0.90)<0.01&&p4===1&&Math.abs(p15-0.675)<0.01&&Math.abs(pu-0.20)<0.01,`item 9: fortune curve — 1.5× ${(p15*100).toFixed(1)}%, 2× ${(p2*100).toFixed(1)}%, 3× ${(p3*100).toFixed(1)}%, 4× ${(p4*100).toFixed(1)}%, 0.5× ${(pu*100).toFixed(1)}%`);
  const f=W.battleFortune(); ok(Math.abs(f.atk*f.def-1)<1e-9&&f.atk<=2.0001&&f.atk>=0.4999,'item 9: luck multipliers are reciprocal and bounded by 4× ratio'); }
// ── world gen: hoards ──
const setup=[0,1,2].map(i=>({id:i,gamePlayerId:'gp'+i,name:'P'+i,kingName:'King'+i,kingdomName:'Realm'+i,race:['Human','Orc','Elf'][i],alignment:['Divine','Evil','Good'][i],temper:'Brave',skills:{}}));
let G=await W.generateNewGame(setup,{cols:10,rows:7},20);
ok(!!G,'world generated (3 players: Divine, Evil, Good)');
{ const lairs=[]; G.world.provinces.forEach(p=>(p.features||[]).forEach(f=>{ if(!f.ritualSite) lairs.push(f); }));
  ok(lairs.every(f=>f._hoardV2&&Array.isArray(f.hoardItems)),'item 4: every lair stocked at world gen');
  ok(lairs.every(f=>{const b=W.ENCOUNTER_CLEAR_GOLD_BANDS[f.monster.power]; return f.treasure>=b[0]&&f.treasure<=b[1];}),'item 4: lair gold in its tier band');
  const names=lairs.flatMap(f=>f.hoardItems.map(i=>i.name));
  ok(new Set(names).size===names.length&&names.every(n=>G._awardedItems.includes(n)),`item 4: ${names.length} lair items, all unique and reserved in _awardedItems`);
  const ids=lairs.flatMap(f=>f.hoardItems.map(i=>i.id)); ok(new Set(ids).size===ids.length&&G.nextItemId>=ids.length,'item 4: item ids unique');
  ok(lairs.filter(f=>f.monster.power==='Legendary').every(f=>f.hoardItems.length>=1),'item 4: every Legendary lair holds at least one item');
}
W.seedUsedArmyNames(G);W.seedUsedHeroNames(G);
// ── real turns: Evil surprise war, Divine king death → no heir → return; research category ──
const k0=G.characters.find(c=>c.player===0&&c.isKing),k1=G.characters.find(c=>c.player===1&&c.isKing),k2=G.characters.find(c=>c.player===2&&c.isKing);
G.players.forEach((p,pi)=>{p._encountered=[0,1,2].filter(j=>j!==pi);});
G.relations={};
k0.hp=1; k0.maxHp=15; k0.items=[]; k0.armies=[];
// a hostile monster-search will kill the 1-HP Divine king: give him a Legendary lair in his province
const hp0=G.world.provinces[k0.location]; hp0.features=hp0.features||[]; hp0.features.push({name:'Doom Pit',monster:{...MON.find(m=>m.name==='Elder Dragon')},discovered:true,discoveredBy:[0],cleared:false,treasure:30,_hoardV2:true,hoardItems:[]});
k2.skills.sage=5; G.players[2].discoveries=[];
const mkOrders=(k,arr)=>{const o={};o[k.id]=arr.map(a=>({action:a[0],target:a[1]||'',extra:''}));return o;};
const o0=mkOrders(k0,[['Search Lair',String(hp0.features.length-1)],['Defend'],['Defend'],['Defend'],['Defend']]);
const o1=mkOrders(k1,[['Defend'],['Defend'],['Defend'],['Defend'],['Defend']]);
const o2=mkOrders(k2,[['Research','Military'],['Research','Bogus Field'],['Defend'],['Defend'],['Defend']]);
async function turn(payloads,turnNo){
  const players=payloads.map((pl,i)=>({id:'gp'+i,user_id:'u'+i,player_index:i,display_name:'P'+i,orders:JSON.stringify(pl),orders_submitted:true,turn_report:'{}'}));
  ROWS={games_one:{id:'g1',name:'T',turn:turnNo,status:'active',game_state:JSON.stringify(G),max_turns:20},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'g1',turn:${turnNo},status:'active',name:'T'};`); WRITES.length=0;
  try{ await W.runTurn(); }catch(e){ ok(false,'runTurn threw '+e.stack); }
  await new Promise(r=>setTimeout(r,60));
  const gw=WRITES.filter(w=>w.table==='games'&&w.val&&w.val.game_state).pop(); G=JSON.parse(gw.val.game_state);
  let t='';WRITES.forEach(w=>{ if(w.val) t+=JSON.stringify(w.val); }); return t;
}
let all=await turn([{orders:o0,encounterPlans:{[k0.id]:{tactics:['ME','ME','ME']}},forTurn:1},{orders:o1,encounterPlans:{},diplomacy:{0:'enemy',2:'enemy'},forTurn:1},{orders:o2,encounterPlans:{},diplomacy:{1:'enemy'},forTurn:1}],1);
ok(errors.length===0,'turn 1: no runtime errors'+(errors.length?' — '+errors[0]:''));
ok(/marches without warning/.test(all)&&G.relations['0-1']==='enemy'&&G.relations['1-2']==='enemy','item 3: Evil declaration is in force from the start of the turn');
ok(/every Military discovery|Research \(Military\)|Research \(Bogus Field\)/.test(all),'item 6: research category honoured in the roll line');
ok(/every Bogus Field discovery has already been made/.test(all),'item 6: an empty/unknown category is refused with the exhausted line');
ok(/monarch of a Divine realm, has fallen/.test(all)&&!G.characters.some(c=>c._isHeir&&c.player===0),'item 5: Divine king slain — narrative given, NO heir crowned');
ok(!G.characters.some(c=>c.player===0&&c.isKing&&c.alive)&&G.characters.some(c=>c.id===k0.id&&c.isKing&&!c.alive&&c._divineReturn),'item 5: crown stands empty for the turn');
// ── personal-combat fuzz: guardians (armed) vs heroes with combat items; one action per round ──
{ let crashes=0,itemUses=0,dbl=0,fights=0,guardUse=0,lostRounds=0;
  const rng=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const stateSeed=JSON.stringify(G);
  for(let i=0;i<600;i++){
    const m=MON[Math.floor(Math.random()*MON.length)];
    const prov=G.world.provinces.find(p=>p.terrain!=='sea');
    const feat={name:'Test Lair',monster:{...m},discovered:true,cleared:false,treasure:5,_hoardV2:true,hoardItems:[]};
    // stock the lair with a random handful so armed guardians get tested
    for(let k=0;k<3;k++){ const it=items[Math.floor(Math.random()*items.length)]; feat.hoardItems.push({...it,effect:{...it.effect},id:1000+k}); }
    const c={...G.characters.find(x=>x.player===2&&x.isKing)}; c.id=null;
    c.hp=c.maxHp=30; c.skills={melee:rng(0,5),archery:rng(0,5),elemental:rng(0,3)};
    c.items=[]; for(let k=0;k<3;k++){ const it=cu[Math.floor(Math.random()*cu.length)]; c.items.push({...it,effect:{...it.effect},id:2000+k}); }
    try{
      const T=W._kcTest; const res=T.resolveEncounter(c,feat,prov,['ME','ME','ME','ME','ME','ME'],T.effStat,T.rng,G.players[2]);
      fights++;
      const txt=res.narrative.join('\n');
      if(/uses the /.test(txt)) itemUses++;
      if(/has turned the hoard/.test(txt)) guardUse++;
      if(/round is lost/.test(txt)) lostRounds++;
      // one action per round: the guardian must never strike in the line right after a lost round
      const lines=res.narrative; for(let j=0;j<lines.length-1;j++){ if(/round is lost/.test(lines[j])&&new RegExp('^  '+m.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' (strikes|hits|advances|swings)').test(lines[j+1])){ dbl++; if(dbl===1) console.log('   dbl: '+lines[j]+' / '+lines[j+1]); } }
      // each item used at most once
      const used=(txt.match(/🧪 [^\n]*uses the ([^!]+)!/g)||[]).map(x=>x.replace(/.*🧪 /,'')); if(new Set(used).size!==used.length){ dbl++; if(dbl===1) console.log('   twice: '+used.join(' | ')); }
    }catch(e){ crashes++; if(crashes===1) console.log('   crash: '+e.stack.split('\n').slice(0,3).join(' | ')); }
  }
  ok(crashes===0,`fuzz: ${fights} encounters, 0 crashes (got ${crashes})`);
  ok(dbl===0,'item 2/4: no double actions after a lost round, no item used twice');
  ok(itemUses>50&&guardUse>50&&lostRounds>20,`item 4: combat items fired in ${itemUses} fights, guardians armed in ${guardUse}, lost rounds ${lostRounds}`);
}
all=await turn([{orders:{},encounterPlans:{},forTurn:2},{orders:o1,encounterPlans:{},forTurn:2},{orders:{},encounterPlans:{},forTurn:2}],2);
const kk=G.characters.find(c=>c.id===k0.id);
ok(!G.characters.some(c=>c._isHeir&&c.player===0)&&kk&&kk.alive&&kk.isKing&&!kk._divineReturn&&/your monarch,.*returns to life/.test(all),'item 5: after one full turn dead, the Divine king rises (start of turn 3), still king, no heir ever crowned');
all=await turn([{orders:{},encounterPlans:{},forTurn:3},{orders:o1,encounterPlans:{},forTurn:3},{orders:{},encounterPlans:{},forTurn:3}],3);
ok(G.characters.filter(c=>c.player===0&&c.isKing).length===1,'item 5: exactly one monarch after the return');
ok(errors.length===0,'turns 2-3: no runtime errors'+(errors.length?' — '+errors[0]:''));
console.log(fails?`\n${fails} CHECK(S) FAILED`:'\nALL CHECKS PASSED'); process.exit(fails?1:0);
})();
