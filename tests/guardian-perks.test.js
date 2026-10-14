// 2026-10-14 (batch item 7) — every guardian has one perk per grade (Weak 1, Moderate 2, Powerful 3,
// Legendary 4), each perk stronger the higher the grade (the decided table below), and a good share of
// them are wards against magic: a ward against one school makes that school's spells less likely to
// take hold. Checked on the table (level 1: MONSTERS_P and the migration are module level) and in the
// engine (pcMonsterCombatant, pcCastCombatSpell, pcRoundStart and resolvePersonalCombat are nested in
// runTurn, tests/lib/pc-hooks.js).
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
// The decided table: a perk's value at Weak / Moderate / Powerful / Legendary (cap: a lower ceiling is stronger).
const DECIDED={dodge:[5,10,15,20],meleeDR:[1,2,3,4],arrowDR:[1,2,3,4],spellPct:[15,25,35,45],schoolWard:[20,30,40,50],
  stunWard:[40,60,80,100],dotWard:[40,60,80,100],thorns:[1,2,3,4],regen:[1,2,3,4],secondWind:[15,20,25,30],lowHp:[15,20,25,30],
  cap:[40,35,25,15],aura:[5,8,12,15],burn:[1,2,3,4],drain:[0.15,0.25,0.35,0.5],hitBonus:[5,10,15,20],dmgBonus:[1,2,3,4]};
const TIERS=['Weak','Moderate','Powerful','Legendary'];
const kindOf=fx=>fx.ward||Object.keys(fx)[0];
const valOf=fx=>fx.ward?(fx.pct!=null?fx.pct:fx.amt):fx[Object.keys(fx)[0]];
(async()=>{
  const {W, PC, base, MON, errs}=await bootPersonalCombat(['pcCharCombatant','pcMonsterCombatant','pcCastCombatSpell','pcRoundStart','resolvePersonalCombat']);
  ok(MON.length>100,`the guardian table was read (${MON.length})`);
  // ── the table ──
  const wrongCount=MON.filter(m=>!Array.isArray(m.passives)||m.passives.length!==TIERS.indexOf(m.power)+1).map(m=>`${m.name} (${m.power}, ${(m.passives||[]).length})`);
  ok(!wrongCount.length,`one perk per grade: Weak 1, Moderate 2, Powerful 3, Legendary 4 (wrong: ${wrongCount.slice(0,4).join(', ')})`);
  ok(!MON.some(m=>m.passive),'no guardian keeps the old single `passive`');
  const offTable=[]; MON.forEach(m=>(m.passives||[]).forEach(p=>{ const k=kindOf(p.fx), t=DECIDED[k];
    if(!t) offTable.push(`${m.name}: ${p.name} (${k}?)`); else if(valOf(p.fx)!==t[TIERS.indexOf(m.power)]) offTable.push(`${m.name}: ${p.name} ${k} ${valOf(p.fx)}`); }));
  ok(!offTable.length,`every perk carries its grade's value from the decided table (wrong: ${offTable.slice(0,4).join('; ')})`);
  const rising=Object.entries(DECIDED).every(([k,t])=>t.every((v,i)=>i===0||(k==='cap'?v<t[i-1]:v>=t[i-1])));
  ok(rising,'the decided table never weakens a perk at a higher grade');
  ok(MON.every(m=>new Set((m.passives||[]).map(p=>p.name)).size===(m.passives||[]).length&&(m.passives||[]).every(p=>p.name&&p.desc)),'every perk is named (no two alike on one guardian) and described');
  ok(!MON.some(m=>(m.passives||[]).some(p=>/\+0 damage|undefined|NaN/.test(p.desc))),'no perk reads "+0 damage", undefined or NaN');
  const all=MON.flatMap(m=>m.passives||[]); const magic=all.filter(p=>['schoolWard','spellPct'].includes(kindOf(p.fx)));
  ok(magic.length/all.length>=0.25,`a good share of perks are wards against magic (${magic.length} of ${all.length})`);
  const clash=MON.filter(m=>(m.passives||[]).some(p=>p.fx.ward==='schoolWard'&&m.weak&&m.weak.kind==='school'&&m.weak.key===p.fx.school)).map(m=>m.name);
  ok(!clash.length,`no guardian wards the school it is weak to (${clash.join(', ')})`);
  // ── the engine ──
  const g=name=>{ const m=MON.find(x=>x.name===name); return PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); };
  const missing=[]; MON.forEach(m=>{ const c=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp});
    (m.passives||[]).forEach(p=>{ const k=kindOf(p.fx);
      const has=p.fx.ward?(k==='schoolWard'?(c.arm&&c.arm.schoolWard&&c.arm.schoolWard[p.fx.school]>=p.fx.pct):(c.arm&&c.arm[k]!=null)):(k==='hitBonus'?c.status.hitBonus>0:c[k]>0);
      if(!has) missing.push(`${m.name}: ${p.name}`); }); });
  ok(!missing.length,`every perk of every guardian is felt in a fight (missing: ${missing.slice(0,4).join('; ')})`);
  const st=()=>({fledBy:null,parley:false,stoleBy:null,range:'melee',mirror:null,feature:null});
  const mage=sk=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,...sk},encounterPlan:{tactics:['ME'],duelStance:'accept'}}); h.hp=h.maxHp=40; return h; };
  { const t=g('Reef Siren'), n=[]; pinned(W,0.99,()=>PC.pcCastCombatSpell(mage({psychic:5}),t,'Psychic Blast',n,st()));
    ok(/\(50% to cast/.test(n.join('\n')),`a Psychic 5 hero's blast at the Reef Siren (Siren's Mind, a 30 ward) is cast at 80 − 30 = 50% ("${(n.join('\n').match(/[^\n]*to cast[^\n]*/)||[''])[0].trim().slice(0,110)}")`); }
  { const t=g('Elder Dragon'), n=[]; pinned(W,0.01,()=>PC.pcCastCombatSpell(mage({psychic:5}),t,'Psychic Blast',n,st()));
    ok(t.status.stun===0,'a Legendary guardian\'s stun ward (100) turns a Psychic Blast as it lands'); }
  { const t=g('Zombie Shambler'), n=[]; pinned(W,[0.01,0.5],()=>PC.pcCastCombatSpell(mage({white:5,psychic:5}),t,'Psychic Blast',n,st()));
    ok(t.status.stun>0,'a Weak guardian\'s stun ward (40) fails when its roll does (51 > 40)'); }
  { const t=g('Mummified Champion'); t.status.dot=[{dmg:10,rounds:3,label:'Fireball burns'}]; const hp=t.hp; PC.pcRoundStart(t,[]);
    ok(hp-t.hp===4,`a Moderate guardian's lingering-harm ward (60) cuts a 10 burn to 4 (took ${hp-t.hp})`); }
  { const t=g('Elder Titan'); ok(t.arm&&t.arm.cap===15,`the Elder Titan keeps its own 15% cap, not loosened to the grade's 20% (${t.arm&&t.arm.cap})`); }
  { const m=MON.find(x=>x.name==='Sphinx'); const t=g('Sphinx'); const n=[]; const h=mage({melee:3}); t.hp=0; const res=PC.resolvePersonalCombat(h,t,{maxRounds:1});
    const txt=res.narrative.join('\n'); ok(m.passives.every(p=>txt.includes(p.name)),'the fight opens by naming every perk of the guardian'); }
  // ── running games ──
  { const gs={_guardiansVer:19,world:{provinces:[{features:[{monster:{name:'Dire Rat',hp:13,passive:{name:'Filth-Hardened',fx:{ward:'dotImmune'},desc:'x'}}}]}]}};
    W.migrateLairGuardiansV2(gs); const mm=gs.world.provinces[0].features[0].monster;
    ok(Array.isArray(mm.passives)&&mm.passives.length===1&&!mm.passive,'a running game\'s guardian takes its new perks at its next turn (GUARDIAN_TABLE_VER)'); }
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
