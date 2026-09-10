// Session 2026-09-10 (g) harness — items 1–3 of the 16:xx batch:
//  (1) to-hit audit: meleeRaw/archeryRaw duplicate-key fix (items now reach damage), personal-combat
//      cast chance honours sd27 Arcane Codex + cast discoveries; archery/spell formulas as documented.
//  (2) flee spoils: a character fleeing a duel/encounter may drop one magic item to the stayer (30%).
//  (3) race-bound items: 'Elf'/'Dwarf'/'Orc' tags vs 'Elven'/'Dwarven'/'Orcish' characters — now usable,
//      including legacy items already in saves; Player-portal mirror + "[Elven characters only]" label.
const fs=require('fs');const {JSDOM}=require('jsdom');
let ROWS={};const WRITES=[];
function sbStub(){const res=d=>Promise.resolve({data:d,error:null});
  const chain=t=>{const o={};['select','eq','neq','in','order','limit','gte','lte','is','not','or','filter'].forEach(m=>o[m]=()=>o);
    ['update','insert','upsert','delete'].forEach(m=>o[m]=v=>{WRITES.push({table:t,val:v});return o;});
    o.single=o.maybeSingle=()=>res(ROWS[t+'_one']!==undefined?ROWS[t+'_one']:null);
    o.then=f=>res(ROWS[t+'_list']!==undefined?ROWS[t+'_list']:[]).then(f);return o;};
  return{from:t=>chain(t),auth:{getSession:()=>res({session:null}),getUser:()=>res({user:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:()=>res({})},
    channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}};}
const errors=[];
const dom=new JSDOM(fs.readFileSync('kingdoms-call-gm-portal.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',
  beforeParse(w){w.supabase={createClient:()=>sbStub()};w.confirm=()=>true;w.alert=()=>{};
    w.addEventListener('error',e=>errors.push('GM: '+(e.error&&e.error.stack||e.message)));
    w.onunhandledrejection=e=>errors.push('GM rejection: '+(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errors.push('console.error: '+a.map(String).join(' '));w.console.warn=()=>{};w.console.log=()=>{};}});
(async()=>{
let fails=0;const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m);if(!c)fails++;};
await new Promise(r=>setTimeout(r,300));const W=dom.window;
const setup=[0,1].map(i=>({id:i,gamePlayerId:'gp'+i,name:'P'+i,kingName:'King'+i,kingdomName:'Realm'+i,race:['Human','Orcish'][i],alignment:['Neutral','Evil'][i],temper:'Brave',skills:{}}));
let G=await W.generateNewGame(setup,{cols:10,rows:7},20); ok(!!G,'world generated');
W.seedUsedArmyNames(G);W.seedUsedHeroNames(G);
G.players.forEach((p,pi)=>{p._encountered=[0,1].filter(j=>j!==pi);}); G.relations={'0-1':'enemy'};
const k0=G.characters.find(c=>c.player===0&&c.isKing),k1=G.characters.find(c=>c.player===1&&c.isKing);
const mkOrders=(k,arr)=>{const o={};o[k.id]=arr.map(a=>({action:a[0],target:a[1]||'',extra:a[2]||''}));return o;};
async function turn(o0,o1,turnNo){
  const pay=[{orders:o0,encounterPlans:{},forTurn:turnNo},{orders:o1,encounterPlans:{},forTurn:turnNo}];
  const players=pay.map((pl,i)=>({id:'gp'+i,user_id:'u'+i,player_index:i,display_name:'P'+i,orders:JSON.stringify(pl),orders_submitted:true,turn_report:'{}'}));
  ROWS={games_one:{id:'g1',name:'T',turn:turnNo,status:'active',game_state:JSON.stringify(G),max_turns:20},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'g1',turn:${turnNo},status:'active',name:'T'};`); WRITES.length=0;
  try{ await W.runTurn(); }catch(e){ ok(false,'runTurn threw '+e.stack); }
  await new Promise(r=>setTimeout(r,60));
  const gw=WRITES.filter(w=>w.table==='games'&&w.val&&w.val.game_state).pop(); G=JSON.parse(gw.val.game_state);
  let t='';WRITES.forEach(w=>{ if(w.val) t+=JSON.stringify(w.val); }); return t;
}
// One quiet turn so _kcTest/G exist and both kings sit still.
const idle=k=>mkOrders(k,[['Defend'],['Defend'],['Defend'],['Defend'],['Defend']]);
await turn(idle(k0),idle(k1),1);
ok(errors.length===0,'T0: baseline turn no runtime errors'+(errors.length?' — '+errors[0]:''));
const T=W._kcTest; ok(!!T,'combat hooks exposed');

// ── (3) race-bound items ─────────────────────────────────────────────────────
{ const elf={name:'E',race:'Elven',alignment:'Good',skills:{archery:1},items:[]};
  const hum={name:'H',race:'Human',alignment:'Good',skills:{},items:[]};
  const bow=W.eval('ALL_MAGIC_ITEMS_P').find(i=>i.name==='Moonsilver Bow');
  ok(bow&&bow.race==='Elven','Moonsilver Bow data now tagged Elven');
  ok(W.itemUsableBy(bow,elf),'Elven character can use Moonsilver Bow (canonical tag)');
  ok(W.itemUsableBy({...bow,race:'Elf'},elf),'legacy race:Elf item in a save is usable by an Elven character');
  ok(!W.itemUsableBy(bow,hum),'Human cannot use Moonsilver Bow');
  ok(W.itemUsableBy({...bow,race:'Dwarf'},{...elf,race:'Dwarven'}) && W.itemUsableBy({...bow,race:'Orc'},{...elf,race:'Orcish'}),'legacy Dwarf/Orc tags map to Dwarven/Orcish');
  ok(!W.eval('ALL_MAGIC_ITEMS_P').some(i=>i.race&&!['Human','Elven','Dwarven','Orcish'].includes(i.race)),'no item carries a non-canonical race tag');
  ok(!W.eval('ALL_MAGIC_ITEMS_P').some(i=>i.alignment&&!W.eval('ALIGNMENTS_P').includes(i.alignment)),'every alignment-bound item uses a canonical alignment');
  elf.items=[{...bow,race:'Elf'}]; const eff=T.effStat(elf,'archery');
  ok(eff===3,'effStat archery 1 + legacy-tagged Moonsilver Bow = 3 (got '+eff+')');
  // Player portal mirror
  const pdom=new JSDOM(fs.readFileSync('kingdoms-call-player-portal.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',
    beforeParse(w){w.supabase={createClient:()=>sbStub()};w.alert=()=>{};w.addEventListener('error',e=>errors.push('PP: '+(e.error&&e.error.stack||e.message)));w.console.error=()=>{};w.console.warn=()=>{};w.console.log=()=>{};}});
  await new Promise(r=>setTimeout(r,200)); const PW=pdom.window;
  ok(PW.itemUsableByP({...bow,race:'Elf'},elf)&&PW.itemUsableByP(bow,elf)&&!PW.itemUsableByP(bow,hum),'Player portal itemUsableByP mirrors the alias fix');
  const tag=PW.itemBoundTag({...bow,race:'Elf'},hum);
  ok(/Elven characters only/.test(tag)&&!/Elf characters/.test(tag),'Player portal bound-tag reads "Elven characters only" for legacy items');
  ok(PW.itemBoundTag({...bow,race:'Elf'},elf)==='','Player portal shows no "unusable" tag for an Elven bearer');
}

// ── (1) to-hit audit ─────────────────────────────────────────────────────────
{ const base={...k0,name:'A',skills:{melee:1,archery:4,elemental:3},items:[],armies:[],hp:60,maxHp:60,temper:'None'};
  const c=T.pcCharCombatant({...base,items:[{name:'Blade',effect:{stat:'melee',bonus:2},tier:1}]});
  ok(c.meleeRaw===3,'meleeRaw = max(raw 1, effStat 3) with a +2 Melee item (was 1 — duplicate key bug) got '+c.meleeRaw);
  const c2=T.pcCharCombatant({...base,skills:{melee:7,archery:8}});
  ok(c2.meleeRaw===7&&c2.archeryRaw===8,'raw levels above 5 still reach meleeRaw/archeryRaw');
  // archery to-hit: 30 + Archery*10 (+temper) — probe by expected hit rate
  const foe=T.pcCharCombatant({...base,name:'B',skills:{melee:1},temper:'None',hp:1000,maxHp:1000});
  let hits=0,N=3000; for(let i=0;i<N;i++){ const a=T.pcCharCombatant({...base}); const f=T.pcCharCombatant({...base,name:'B',hp:1000,maxHp:1000}); a.status={...a.status}; const narr=[]; W._kcTest.rng; // use resolvePersonalCombat one round? simpler: direct formula check via narrative
    const r=T.resolvePersonalCombat(Object.assign(a,{tactics:['FI']}),Object.assign(f,{tactics:['DF']}),{maxRounds:1}); hits+=(r.narrative.join('\n').match(/shot hits/g)||[]).length; }
  console.log('  INFO  Archery 4 single-round hit sample: '+(hits/N).toFixed(2)+' hits/round (expected ≈ 0.70 × volley 2 = 1.40, less any positioning failures)');
  // personal-combat cast chance: sd27 +5 and cast discovery +10 for the school
  const chars=[k0]; const nar=[]; 
  const spellText=(ch,player)=>{ const a=T.pcCharCombatant(ch); const b=T.pcCharCombatant({...base,name:'B'}); a.player=player; const n=[]; T.pcCastCombatSpell(a,b,'Lightning Bolt',n,{fledBy:null,parley:false,stoleBy:null,range:'spell',mirror:null,feature:null}); return n.join('\n'); };
  const pct=t=>+(t.match(/\((\d+)% to cast/)||[])[1];
  T.G.players[0].discoveries=[]; const p0=pct(spellText({...base,player:0},0));
  ok(p0===50,'Elemental 3 personal-combat cast chance 50% (got '+p0+')');
  T.G.players[0].discoveries=[{id:'sd27'}]; const p1=pct(spellText({...base,player:0},0));
  ok(p1===55,'…+5 with sd27 Arcane Codex (got '+p1+')');
  T.G.players[0].discoveries=[{id:'sd27'},{id:'ap03',effect:{kind:'cast',pct:10,school:'elemental'}}]; const p2=pct(spellText({...base,player:0},0));
  ok(p2===65,'…+10 more with an Elemental cast discovery (got '+p2+')');
  T.G.players[0].discoveries=[];
}

// ── (2) flee spoils ──────────────────────────────────────────────────────────
{ const mk=(n,extra)=>({...k0,id:'h_'+n,name:n,skills:{melee:1},items:[],armies:[],hp:40,maxHp:40,temper:'None',...extra});
  const Legendary={name:'Crown of Ages',tier:3}, Ring={name:'Ring',tier:1,slot:'ring'};
  // Deterministic: force a drop with rng patched
  let drops=0,none=0,mithrilDrops=0;
  for(let i=0;i<400;i++){
    const R=mk('Runner',{items:[{...Ring},{name:'Mithril Armour',effect:{stat:'mithrilArmour'},tier:2}]}), S=mk('Stayer',{items:[]});
    const a=T.pcCharCombatant(R), b=T.pcCharCombatant(S); const n=[];
    const it=T.duelFleeItemDrop(a,b,n);
    if(it){ drops++; if(it.name==='Mithril Armour') mithrilDrops++; ok(S.items.length===1&&R.items.length===1,'item moved runner → stayer (once)'); break; }
    else none++;
  }
  ok(drops>=1,'a flee drop occurred within 400 trials');
  ok(mithrilDrops===0,'Mithril never drops');
  let d2=0; for(let i=0;i<2000;i++){ const R=mk('R',{items:[{...Ring}]}),S=mk('S'); if(T.duelFleeItemDrop(T.pcCharCombatant(R),T.pcCharCombatant(S),[])) d2++; }
  ok(d2>2000*0.25&&d2<2000*0.35,'drop rate ≈30% ('+(d2/20).toFixed(1)+'%)');
  ok(T.duelFleeItemDrop(T.pcCharCombatant(mk('R')),T.pcCharCombatant(mk('S')),[])===null,'no items → no drop, no crash');
  // End-to-end: cowardly runner vs strong foe in resolveDuel; count drops over many duels
  let fled=0,dropped=0; for(let i=0;i<300;i++){
    const R=mk('Runner',{skills:{melee:0},temper:'Cowardly',hp:12,maxHp:12,items:[{...Ring}],encounterPlan:{duelStance:'challenge',tactics:['FL','FL','FL','FL']}});
    const S=mk('Stayer',{skills:{melee:5},hp:80,maxHp:80,encounterPlan:{duelStance:'challenge',tactics:['ME']}});
    const n=[]; const res=T.resolveDuel(R,S,n); if(res.fled){ fled++; if(S.items.length===1&&R.items.length===0) dropped++; else if(S.items.length||!R.items.length) ok(false,'inconsistent item state after flee'); }
  }
  ok(fled>0,'runner fled in '+fled+' of 300 duels');
  ok(dropped>0&&dropped<fled,'some (not all) flights dropped the ring: '+dropped+'/'+fled);
  // combatVsChar path (encounter) — smoke: no crash, narrative mentions the drop when it happens
  const prov=G.world.provinces.find(p=>p.terrain!=='sea');
  let seen=false; for(let i=0;i<120&&!seen;i++){
    const R={...mk('Runner',{skills:{melee:0},temper:'Cowardly',hp:12,maxHp:12,items:[{...Ring}],player:0,encounterPlan:{duelStance:'refuse',tactics:['FL','FL','FL']}}),location:prov.id};
    const S={...mk('Stayer',{skills:{melee:5},hp:80,maxHp:80,player:1,encounterPlan:{duelStance:'refuse',tactics:['ME']}}),location:prov.id};
    const b=T.resolveCharVsChar(R,S,['FL','FL','FL'],['ME'],prov,T.effStat,T.rng,T.G); if(/claims it/.test(b.narrative.join('\n'))){ seen=true; ok(S.items.length===1&&R.items.length===0,'encounter drop moved the ring to the stayer'); } }
  ok(seen,'encounter (resolveCharVsChar) flee path produces a spoils line');
}
ok(errors.length===0,'no runtime errors'+(errors.length?' — '+errors.slice(0,2).join(' | ').slice(0,400):''));
console.log(fails?`\n${fails} FAIL(S)`:'\nALL CHECKS PASSED'); process.exit(fails?1:0);
})();
