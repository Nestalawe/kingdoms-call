// 2026-10-15 (Toby) — the warnings about another realm's hero in your land (or beside your heroes) no longer
// give away a hero under Invisibility. A visible intruder is still reported.
// Level 2 (scenario): the warnings are built inside runTurn (generateIntrusionNotifications), so a real turn
// runs. The Invisibility is staged on the hero (as if cast), so no roll decides it.
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario();
  let names={};
  const r=await sc.turn({realms:2,
    prepare(S){
      const P=S.world.provinces, home=P[S.players[0].homeProvinceId];
      const moveTo=(c,p)=>{ const old=P[c.location]; if(old&&Array.isArray(old.characters)) old.characters=old.characters.filter(id=>id!==c.id);
        if(!Array.isArray(p.characters)) p.characters=[]; if(!p.characters.includes(c.id)) p.characters.push(c.id); c.location=p.id; };
      const [, hid, seen]=S.characters.filter(c=>c.alive&&c.player===1);
      [hid,seen].forEach(c=>{ moveTo(c,home); c.armies=[]; });
      hid._invisTurn=S.turn;
      names={hid:hid.name,seen:seen.name};
    }});
  const alerts=r.log.filter(e=>(e.targets||[]).includes(0)&&/^\[Intelligence\]/.test(e.text||'')).map(e=>e.text);
  ok(alerts.some(t=>t.includes(names.seen)),`a visible intruder is still reported (${alerts.length} alert(s))`);
  ok(!alerts.some(t=>t.includes(names.hid)),`a hero under Invisibility is not (${alerts.filter(t=>t.includes(names.hid)).join(' | ')})`);
  if(sc.errs.length) sc.errs.slice(0,3).forEach(e=>console.log('  page error: '+e));
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
