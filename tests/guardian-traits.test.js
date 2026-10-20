// 2026-10-08 (item 4) — no guardian may resist and be weak to the same kind of attack.
//   * On its card: a perk that turns blows (meleeDR), arrows (arrowDR), spells (spellPct), one school
//     (schoolWard) or lingering harm (dotImmune / dotWard) must not sit beside a weakness to that same
//     thing (arrows; a school of magic; Elemental magic, whose fire lingers, for lingering harm).
//   * Behind the card: the hidden category multipliers (monsterTraits: undead, fiend, flyer, armoured,
//     beast) must never push the other way from a trait on the card — the card wins.
// monsterTraits is top-level since plan P1-08f (it reads no turn state): it is called directly in the engine's bare vm
// (tests/lib/engine.ts), beside the guardian table it reads. Until plan P1-09a this test ran a real turn on the GM
// portal first and took monsterTraits from the hook at "  // 4. Run all 5 phases".
const vm=require('vm'); const {loadEngine,engineFn}=require('./lib/engine.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
{
  const engine=loadEngine({seed:1}); const ev=expr=>vm.runInContext(expr,engine);
  const monsterTraits=engineFn(engine,'monsterTraits');
  const MON=ev('MONSTERS_P'); ok(MON.length>50,`the guardian table was read (${MON.length})`);

  // ── on the card ──
  // every perk on the card (2026-10-14, batch item 7: `passives`, one per grade; an older table had one `passive`)
  const perks=m=>Array.isArray(m.passives)?m.passives:(m.passive?[m.passive]:[]);
  const resists=m=>{ const r=new Set(); perks(m).forEach(p=>{ const fx=p.fx||{};
    if(fx.ward==='meleeDR'||fx.meleeDR) r.add('melee'); if(fx.ward==='arrowDR'||fx.arrowDR) r.add('archery');
    if(fx.ward==='spellPct'||fx.spellPct) r.add('spell'); if(fx.ward==='dotImmune'||fx.dotImmune||fx.ward==='dotWard') r.add('dot');
    if(fx.ward==='schoolWard') r.add('school:'+fx.school); }); return r; };
  const weakTo=m=>{ const w=m.weak||{}; const r=new Set();
    if(w.kind==='archery') r.add('archery'); if(w.kind==='school'){ r.add('spell'); r.add('school:'+w.key); if(w.key==='elemental') r.add('dot'); } return r; };
  const cardClash=MON.filter(m=>[...resists(m)].some(k=>weakTo(m).has(k))).map(m=>`${m.name} (${[...resists(m)].join('/')} vs ${m.weak.name})`);
  ok(!cardClash.length,`no guardian's card resists and is weak to the same thing (${cardClash.length}): ${cardClash.join('; ')}`);

  // ── behind the card ──
  const hidden=[];
  MON.forEach(m=>{
    const mods=monsterTraits(m).mods, R=resists(m), K=weakTo(m);
    ['melee','archery','spell'].forEach(c=>{
      if(R.has(c)&&mods[c]>1) hidden.push(`${m.name}: resists ${c} on its card but hidden ×${mods[c].toFixed(2)}`);
      if(K.has(c)&&mods[c]<1) hidden.push(`${m.name}: weak to ${c} on its card but hidden ×${mods[c].toFixed(2)}`);
    });
  });
  ok(!hidden.length,`no hidden multiplier pushes against a trait on the card (${hidden.length}): ${hidden.slice(0,6).join('; ')}`);
  // and the hidden layer still works where nothing on the card speaks to it
  const drag=MON.find(m=>m.name==='Elder Dragon');
  ok(drag&&monsterTraits(drag).mods.archery>1,'a flyer with no arrow trait on its card is still easier to shoot down');
  ok(ev('GUARDIAN_TABLE_VER')>=18,'GUARDIAN_TABLE_VER bumped so running games re-read the guardians');

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
}
