// 2026-10-15 (Toby) — the warnings about another realm's hero in your land follow the same spotting roll as the
// map: an enemy hero leading no troops, in a province of yours with none of your heroes there, is reported only
// if your people spot them (spotEnemyInOwnedProvince, the roll the report makes for the same hero, province and
// turn). A hero of a realm you are not at war with is always reported, as the map always shows them.
// Level 2 (scenario): the warnings are built inside the turn, played in the engine's bare vm
// (tests/lib/scenario-in-the-vm.ts). The roll is fixed by standing spotEnemyInOwnedProvince in there for the turn: a
// marked hero wins it, so no luck decides it. (Until plan P1-09a the turn was played on the GM portal and a code-anchor
// hook at the line `  const explored=100;` in spotEnemyInOwnedProvince did the same.)
const {scenarioInTheVm}=require('./lib/scenario-in-the-vm.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=scenarioInTheVm({seed:1});
  const spot=sc.W.spotEnemyInOwnedProvince;
  sc.W.spotEnemyInOwnedProvince=(gs,viewerPi,prov,enemyChar,turn)=>enemyChar&&enemyChar.__testUnspotted?false:spot(gs,viewerPi,prov,enemyChar,turn);
  let names={}, homeId=null;
  const r=await sc.turn({realms:3,
    prepare(S,W){
      const P=S.world.provinces, home=P[S.players[0].homeProvinceId]; homeId=home.id;
      S.relations={...(S.relations||{}),'0-1':'enemy'};   // at war with realm 1; realm 2 stays neutral
      const moveTo=(c,p)=>{ const old=P[c.location]; if(old&&Array.isArray(old.characters)) old.characters=old.characters.filter(id=>id!==c.id);
        if(!Array.isArray(p.characters)) p.characters=[]; if(!p.characters.includes(c.id)) p.characters.push(c.id); c.location=p.id; };
      // the home realm's own heroes leave for a neighbouring province, so none of them stands beside the intruders
      const away=W.getNeighborsP(home,S.world.cols,S.world.rows,P).find(p=>p&&p.terrain!=='sea');
      S.characters.filter(c=>c.alive&&c.player===0).forEach(c=>moveTo(c,away));
      const lurker=S.characters.filter(c=>c.alive&&c.player===1)[1], peaceful=S.characters.filter(c=>c.alive&&c.player===2)[1];
      moveTo(lurker,home); lurker.armies=[]; lurker.__testUnspotted=true;
      moveTo(peaceful,home); peaceful.armies=[]; peaceful.__testUnspotted=true;   // the roll is never asked for a realm at peace
      names={lurker:lurker.name,peaceful:peaceful.name};
    }});
  const alerts=r.log.filter(e=>(e.targets||[]).includes(0)&&/^\[Intelligence\]/.test(e.text||'')).map(e=>e.text);
  ok(alerts.some(t=>t.includes(names.peaceful)),`a hero of a realm at peace in your land is reported (${alerts.length} alert(s))`);
  ok(!alerts.some(t=>t.includes(names.lurker)),`a lone lurker who won the spotting roll is not (${alerts.filter(t=>t.includes(names.lurker)).join(' | ')||'none'})`);
  const rep=r.reports[0]||{};
  ok(!(rep.heroSightings||[]).some(s=>s.name===names.lurker),'…and the report agrees: the lurker is not among the sightings');
  ok((rep.heroSightings||[]).some(s=>s.name===names.peaceful),'…while the hero at peace is');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
