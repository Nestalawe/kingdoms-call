// 2026-10-14 (batch item 3) — "cannot be stunned" stops a stun the moment it lands, not at the start
// of the next round. Before, a Psychic Blast or a holding scroll from a fighter with the initiative
// still cost an "unstunnable" guardian (or a hero in a Helm of Iron Will) that round's action, and a
// stun riding on a blow (Thunder Stone, a dazing special) took hold after the round-start check and
// cost one more. Every stun source is checked: Psychic Blast, Control Undead, a stunning special,
// a stun item and a stun riding on an item's blow. The functions are nested inside runTurn
// (tests/lib/pc-hooks.js).
const {bootPersonalCombat, pinned}=require('./lib/pc-hooks');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const {W, PC, base, MON, errs}=await bootPersonalCombat(['pcAct','pcCharCombatant','pcMonsterCombatant','pcCastCombatSpell','pcUseCombatItem','pcMonsterSpecial','pcRoundStart']);
  const ITEMS=W.eval('ALL_MAGIC_ITEMS_P'); const item=n=>ITEMS.find(i=>i.name===n);
  ok(!!item('Scroll of Paralysis')&&!!item('Thunder Stone'),'the stun items were read');
  const st=()=>({fledBy:null,parley:false,stoleBy:null,range:'melee',mirror:null,feature:null});
  const hero=(sk)=>{ const h=PC.pcCharCombatant({...JSON.parse(JSON.stringify(base)),items:[],skills:{...base.skills,melee:3,psychic:5,necromancy:5,...(sk||{})},encounterPlan:{tactics:['ME'],duelStance:'accept'}}); h.hp=h.maxHp=40; return h; };
  const ward=c=>{ c.arm=W.pcArmourMerge(c.arm,{ward:'stunImmune'},'Helm of Iron Will'); return c; };
  const mk=(name)=>{ const m=MON.find(x=>x.name===name); const g=PC.pcMonsterCombatant({...JSON.parse(JSON.stringify(m)),_hpFull:m.hp}); g.tactics=['ME']; g.tacIdx=0; return g; };
  const plain=()=>{ const g=mk('Owlbear'); g.arm=null; return g; };
  const immune=()=>ward(plain());
  const round=c=>PC.pcRoundStart(c,[]);
  // Psychic Blast, cast with the initiative: the immune guardian still acts this round
  { const h=hero(), g=immune(), n=[]; pinned(W,0.01,()=>PC.pcCastCombatSpell(h,g,'Psychic Blast',n,st()));
    ok(g.status.stun===0,`Psychic Blast does not hold a stun-immune guardian (stun ${g.status.stun})`);
    const n2=[]; pinned(W,0.5,()=>PC.pcAct(g,h,n2,st())); ok(!/stunned and cannot act/.test(n2.join('\n')),'…which acts the same round');
    ok(/cannot be held/.test(n.join('\n')),'…and the report says the blast found no hold'); }
  { const h=hero(), g=plain(), n=[]; pinned(W,0.01,()=>PC.pcCastCombatSpell(h,g,'Psychic Blast',n,st()));
    ok(g.status.stun>0,'Psychic Blast still holds a guardian without the ward'); }
  // Control Undead on a stun-immune undead
  { const h=hero(), g=ward(mk('Zombie Shambler')), n=[]; pinned(W,0.01,()=>PC.pcCastCombatSpell(h,g,'Control Undead',n,st()));
    ok(g.status.stun===0,'Control Undead does not hold a stun-immune undead'); }
  // a pure stun item, and a stun riding on an item's blow
  { const h=hero(), g=immune(), n=[]; PC.pcUseCombatItem(h,g,item('Scroll of Paralysis'),n,st());
    ok(g.status.stun===0,'a Scroll of Paralysis does not hold a stun-immune guardian'); }
  { const h=hero(), g=immune(), n=[]; pinned(W,0.5,()=>PC.pcUseCombatItem(h,g,item('Thunder Stone'),n,st())); round(g);
    ok(g.status.stun===0,`a Thunder Stone's daze does not take hold next round either (stun ${g.status.stun})`); }
  { const h=hero(), g=plain(), n=[]; pinned(W,0.5,()=>PC.pcUseCombatItem(h,g,item('Thunder Stone'),n,st())); round(g);
    ok(g.status.stun===1,'a Thunder Stone still dazes a guardian without the ward, from the next round'); }
  // a guardian's dazing special on a hero in a Helm of Iron Will
  { const h=ward(hero()), g=plain(), n=[]; const sp={name:'Test Slam',dmgW:1,effect:'hero loses next attack',castChance:100};
    pinned(W,0.5,()=>PC.pcMonsterSpecial(g,h,sp,n,st())); round(h);
    ok(h.status.stun===0,`a dazing special does not hold a hero who cannot be stunned (stun ${h.status.stun})`); }
  { const h=ward(hero()), g=plain(), n=[]; const sp={name:'Test Stare',dmgW:0,effect:'hero loses 2 rounds',castChance:100};
    pinned(W,0.5,()=>PC.pcMonsterSpecial(g,h,sp,n,st()));
    ok(h.status.stun===0,'a pure stun special does not hold a hero who cannot be stunned'); }
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.log(e.stack||e); process.exit(1); });
