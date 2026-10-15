// 2026-10-15 (Toby, batch item 1; R-117) — the Spy 8 perk did nothing (Spy 6 already makes spying certain, and the
// engine only ever asked whether the tier was above 0). Now a Spy 8 hero learns, at the end of every turn, what a
// Spy on the province they stand in would show: the characters there and the army units each leads, in the report's
// province intel and on the map, without giving the order. The information only: no Spymaster merit, no experience
// roll, no discovery theft from a capital and no counter-intelligence alert to the province's owner.
// Level 2 (scenario): the end-of-turn pass and the report builder are nested inside runTurn, so a real turn runs.
// Nothing rests on a roll: the perk is certain, and every hero here Rests.
const fs=require('fs'), vm=require('vm');
const {bootScenario}=require('./lib/scenario'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  let ids={};
  const r=await sc.turn({realms:2,
    prepare(S){
      const P=S.world.provinces;
      const moveTo=(c,p)=>{ const old=P[c.location]; if(old&&Array.isArray(old.characters)) old.characters=old.characters.filter(id=>id!==c.id);
        if(!Array.isArray(p.characters)) p.characters=[]; if(!p.characters.includes(c.id)) p.characters.push(c.id); c.location=p.id; };
      const mine=S.characters.filter(c=>c.alive&&c.player===0), theirs=S.characters.filter(c=>c.alive&&c.player===1);
      const [A,D]=mine, [B,C]=theirs;
      // X: realm 1's capital, so a counter-intelligence alert would have an owner to reach and a discovery theft a
      // capital to try. Y: an unowned land province (its guard may stand there) for the Spy 7 pair.
      const X=P[S.players[1].homeProvinceId];
      const Y=P.find(p=>p&&p.terrain!=='sea'&&p.owner==null&&!S.characters.some(c=>c.alive&&c.player!=null&&c.location===p.id));
      moveTo(A,X); moveTo(B,X); A.skills={...(A.skills||{}),spy:8}; A.armies=[]; B.skills={...(B.skills||{}),spy:0};
      B.armies=[{type:'Shieldwall Levies',quality:'Veteran'},{type:'Free Lances',quality:'Average'}];
      moveTo(D,Y); moveTo(C,Y); D.skills={...(D.skills||{}),spy:7}; D.armies=[]; C.skills={...(C.skills||{}),spy:0};
      C.armies=[{type:'Yeoman Longbows',quality:'Elite'}];
      A.tm={...(A.tm||{}),spyActions:0};
      ids={A:A.id,B:B.id,C:C.id,D:D.id,X:X&&X.id,Y:Y&&Y.id};
      return ids;
    },
    // nobody gives an order: every hero Rests
  });
  ok(ids.X!=null&&ids.Y!=null,'the staged world has an enemy-owned province and an empty neutral one');
  const rep=r.reports[0]||{}; const rep1=r.reports[1]||{};
  const S2=r.S2||{};

  // ── Spy 8: the province is read as if spied ──
  const px=(rep.provinceCharIntel||[]).find(p=>p.provId===ids.X);
  ok(px&&px.spied===true,`the Spy 8 hero's province is marked spied in the report (got ${JSON.stringify(px&&px.spied)})`);
  const b=px&&(px.characters||[]).find(c=>c.name===r.S.characters[ids.B].name);
  ok(b&&Array.isArray(b.armies)&&b.armies.length===2&&b.armies.some(a=>a.type==='Free Lances'&&a.quality==='Average'),`…showing the enemy hero's army units by type and quality (got ${JSON.stringify(b&&b.armies)})`);
  ok(((S2.players||[])[0]||{})._spiedProvincesThisTurn?.includes(ids.X)===true,'…and the saved world counts the province as spied this turn (the map\'s rule)');
  ok(/Ever Watchful/.test(r.text(ids.A)),'the hero\'s own report line names the perk');

  // ── Information only ──
  const A2=(S2.characters||[])[ids.A]||{};
  ok(((A2.tm||{}).spyActions||0)===0,`no Spymaster merit is earned (got ${(A2.tm||{}).spyActions})`);
  const alerts=(r.log||[]).filter(e=>(e.targets||[]).includes(1)&&/Counter-intelligence/.test(e.text||''));
  ok(alerts.length===0,`the province's owner gets no counter-intelligence alert (${alerts.length})`);
  ok(!/Discovery theft|rifling/.test(r.text(ids.A)),'no discovery theft is attempted');

  // ── Spy 7 is not enough ──
  const py=(rep.provinceCharIntel||[]).find(p=>p.provId===ids.Y);
  ok(!!py,'the Spy 7 hero\'s province is in the intel (a hero stands there)');
  ok(py&&py.spied===false,`…but not as spied (got ${JSON.stringify(py&&py.spied)})`);
  const c=py&&(py.characters||[]).find(x=>x.name===r.S.characters[ids.C].name);
  ok(c&&c.armies==null,`…so the enemy hero's units stay unknown (got ${JSON.stringify(c&&c.armies)})`);
  ok(!/Ever Watchful/.test(r.text(ids.D)),'and the Spy 7 hero gets no perk line');

  // ── The perk's text says so ──
  const ctx={}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8')+';this.M=MASTERY_UNLOCKS;',ctx);
  const t=(ctx.M&&ctx.M.spy&&ctx.M.spy[8])||'';
  ok(/^Ever Watchful — /.test(t)&&/end of every turn/.test(t)&&/Spy on the province/.test(t),`the Spy 8 perk text describes it (got "${t}")`);
  ok(!/infiltration grows surer/.test(t),'…and the old empty promise is gone');
  if(sc.errs.length) sc.errs.slice(0,3).forEach(x=>console.log('  page error: '+x));
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
