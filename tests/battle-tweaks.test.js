// 2026-10-12 (Toby's batch) — small battle rulings, one block per item:
//   • Reign of Fear fires only when attacking: an Evil realm's Monsters fight ×1.5 on ground its own Terror grips
//     when they ATTACK there, and at ×1 when they defend it.
//   • Purity breaks a Spear Hedge or a Boulder Wall: the Unicorn Herd facing Shieldwall Levies or Stone Giants keeps
//     cavalry's matchup (×0.85 facing foot, ×1.25 more facing skeletons) instead of the ×0.75 cap other horse meets.
//   • Item 19: every flyer (the winged riders and the flying beasts) fights at ×0.75 in forest and jungle, and still
//     at ×1 on open ground, in the mountains and over the sea.
//   • Item 21: Evil's lingering Terror stacks at most three times (−30% at the base −10% a stack): a fourth
//     decisive victory nearby adds nothing, and an older save holding five stacks demoralises by three.
// Level 1 (unit): armStr (a unit's strength with every per-unit modifier) is nested inside runTurn, so the hook at
// "  // 4. Run all 5 phases" hands it back after one real turn (as tests/hp-wound-gain does). The grid and the facing
// are module-level functions of the booted GM portal (as in tests/abilities-beasts).
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const near=(a,b)=>Math.abs(a-b)<1e-6;

(async()=>{
  const sc=await bootScenario({inject:[["  // 4. Run all 5 phases\n","  window.__BT={armStr,terrainMod,spreadTerror,consumeTerror,get G(){ return G; },get MAX(){ return TERROR_MAX_STACKS; },get RF(){ return REIGN_OF_FEAR_MULT; }};\n  // 4. Run all 5 phases\n"]]});
  await sc.turn({});
  const w=sc.W, ev=e=>w.eval(e);
  ok(sc.errs.length===0,'the GM portal boots and runs a turn'+(sc.errs.length?' — '+sc.errs[0].split('\n')[0]:''));
  const B=w.__BT||{}; ok(typeof B.armStr==='function','hook: armStr exposed'); if(typeof B.armStr!=='function') process.exit(1);
  const unit=(type,extra)=>Object.assign({type,quality:'Average',race:'Primal',unitName:'the Test '+type},extra||{});
  const str=(type,align,terrain,ctx)=>B.armStr(unit(type),null,align,terrain,Object.assign({force:[],enemyForce:[]},ctx||{}));

  // ── Reign of Fear: only when attacking ──
  {
    const RF=B.RF;
    const base=str('Cave Trolls','Evil','plain',{isAttacker:true});
    const atk=str('Cave Trolls','Evil','plain',{isAttacker:true,reignOfFear:true});
    const def=str('Cave Trolls','Evil','plain',{isAttacker:false,reignOfFear:true});
    const defBase=str('Cave Trolls','Evil','plain',{isAttacker:false});
    ok(base>0&&near(atk,Math.round(base*RF)),`attacking on its own terrorised ground, an Evil host's Cave Trolls fight ×${RF} (got ${atk} from ${base})`);
    ok(near(def,defBase),`defending that ground, they fight with no Reign of Fear (got ${def}, without it ${defBase})`);
    const trace=[]; str('Cave Trolls','Evil','plain',{isAttacker:false,reignOfFear:true,trace});
    ok(!trace.some(t=>/Reign of Fear/.test(t.label)),'…and the defender\'s strength ladder does not name it');
  }

  // ── Purity breaks a Spear Hedge or a Boulder Wall ──
  {
    const G=ev('battleGrid'), F=ev('battleFacing');
    const BASE={'Shieldwall Levies':8,'Stone Giants':26,'Unicorn Herd':26,'Free Lances':10};
    const row=(type,extra)=>({a:Object.assign({type,quality:'Average',unitName:type},extra||{}),base:BASE[type]||8});
    const rows=spec=>[].concat(...spec.map(([t,n,x])=>Array.from({length:n},()=>row(t,x))));
    const fight=(mine,theirs,W,terrain)=>{ const me=G(rows(mine),W,terrain,{tac:0,enemy:rows(theirs),enemyTac:0}), them=G(rows(theirs),W,terrain,{tac:0,enemy:rows(mine),enemyTac:0}); F(me,them,terrain); return {me,them}; };
    const faced=(g,type)=>g.face.units.filter(u=>u.row.a.type===type);
    const whyOf=(g,type)=>faced(g,type).map(u=>u.why).join(' | ');
    let r=fight([['Unicorn Herd',2]],[['Shieldwall Levies',2]],2,'forest');
    ok(faced(r.me,'Unicorn Herd').length===2&&faced(r.me,'Unicorn Herd').every(u=>near(u.m,0.85)&&/Purity breaks the Spear Hedge/.test(u.why)),`unicorns facing Levies keep cavalry's ×0.85: Purity breaks the Spear Hedge — ${whyOf(r.me,'Unicorn Herd')}`);
    r=fight([['Unicorn Herd',2]],[['Stone Giants',2]],2,'forest');
    ok(faced(r.me,'Unicorn Herd').length===2&&faced(r.me,'Unicorn Herd').every(u=>near(u.m,0.85)&&/Purity breaks the Boulder Wall/.test(u.why)),`unicorns facing Stone Giants keep cavalry's ×0.85: Purity breaks the Boulder Wall — ${whyOf(r.me,'Unicorn Herd')}`);
    r=fight([['Unicorn Herd',2]],[['Shieldwall Levies',2,{_isSkeletal:true}]],2,'forest');
    ok(faced(r.me,'Unicorn Herd').every(u=>near(u.m,0.85*1.25)&&/Purity breaks the Spear Hedge/.test(u.why)),`facing skeletal Levies the pure charge is not capped: ×0.85 × ×1.25 — ${whyOf(r.me,'Unicorn Herd')}`);
    r=fight([['Free Lances',2]],[['Shieldwall Levies',2]],2,'forest');
    ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.75)&&/Spear Hedge/.test(u.why)&&!/Purity/.test(u.why)),`other horse still meets the Spear Hedge at ×0.75 — ${whyOf(r.me,'Free Lances')}`);
    r=fight([['Free Lances',2]],[['Stone Giants',2]],2,'forest');
    ok(faced(r.me,'Free Lances').every(u=>near(u.m,0.75)&&/Boulder Wall/.test(u.why)),`…and the Boulder Wall at ×0.75 — ${whyOf(r.me,'Free Lances')}`);
  }

  // ── Item 19: flyers fight ×0.75 in forest and jungle ──
  {
    const TM=B.terrainMod, AER=ev('KC_UNIT_CLASS.aerial');
    ok(typeof TM==='function'&&AER.length>=8,`hook: terrainMod exposed, and the flyers read (${AER.length})`);
    for(const t of AER){
      ok(near(TM(t,'forest'),0.75)&&near(TM(t,'jungle'),0.75),`${t} fight at ×0.75 in forest and jungle (got ×${TM(t,'forest')} / ×${TM(t,'jungle')})`);
      ok(['plain','desert','mountain','sea'].every(tr=>near(TM(t,tr),1)),`${t} still fight at ×1 on the plain, in the desert, in the mountains and at sea`);
    }
    const open=B.armStr(unit('Eagle Riders',{race:'Elven'}),null,'Neutral','plain',{force:[],enemyForce:[],isAttacker:true});
    const wood=B.armStr(unit('Eagle Riders',{race:'Elven'}),null,'Neutral','jungle',{force:[],enemyForce:[],isAttacker:true});
    ok(open>0&&wood===Math.floor(open*0.75),`an Eagle Riders company's strength in the jungle is three quarters of its strength on the plain (${wood} v ${open})`);
    const trace=[]; B.armStr(unit('Elder Dragons'),null,'Evil','forest',{force:[],enemyForce:[],isAttacker:true,trace});
    ok(trace.some(t=>/forest terrain ×0\.75/.test(t.label)),`the strength ladder names the forest's ×0.75 on a dragon (${trace.map(t=>t.label).join('; ')})`);
  }

  // ── Item 21: Terror stacks at most three times ──
  {
    const G=B.G, P=G.world.provinces.find(p=>p&&p.terrain!=='sea');
    ok(B.MAX===3,`TERROR_MAX_STACKS is 3 (got ${B.MAX})`);
    delete P._terrorStacks; for(let i=0;i<5;i++) B.spreadTerror(P,0,null);
    ok(P._terrorStacks===3,`five decisive victories next door leave three stacks, no more (got ${P._terrorStacks})`);
    const owner=P.owner; P.owner=null;
    const defs=[{type:'Shieldwall Levies',quality:'Average'}], narr=[];
    B.consumeTerror(P,defs,narr);
    ok(Math.abs(defs[0]._terrorMult-0.7)<1e-9,`three stacks: the defenders fight at ×0.7, −30% (got ×${defs[0]._terrorMult})`);
    ok(narr.some(l=>/−30% strength \(3 terror stacks/.test(l)),`the report says −30% from 3 stacks (${narr.join(' | ')})`);
    // an older save still holding five
    P._terrorStacks=5; P._terrorTurn=G.turn; P._terrorisedBy=0; P._terrorPct=0.10;
    const d2=[{type:'Shieldwall Levies',quality:'Average'}]; B.consumeTerror(P,d2,[]);
    ok(Math.abs(d2[0]._terrorMult-0.7)<1e-9,`a save holding five stacks still demoralises by three, −30% (got ×${d2[0]._terrorMult})`);
    P.owner=owner;
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
