// 2026-10-15 (Toby, D8) — Consecrate no longer counts toward the Hierophant. Only a Divine king can consecrate,
// so it was a creed-only route to a title. Bless Province, Holy Symbol and Resurrect still count. The title's
// description (data file) and the rulebook's Titles table say so, and the rulebook's "every creed competes on
// the same terms" note no longer claims more than the game does.
// Level 2 (scenario): the Consecrate order is nested inside runTurn, so a real turn runs: a Divine king
// consecrates his capital and his title merit is read from the saved world.
const fs=require('fs');
const {bootScenario,order,plan}=require('./lib/scenario'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario();
  let kingId=null, home=null;
  const r=await sc.turn({realms:2,alignments:['Divine','Good'],
    prepare(S,W){ const k=S.characters.find(c=>c.alive&&c.player===0&&c.isKing); k.skills={...(k.skills||{}),white:3}; kingId=k.id;
      // a province of his own beyond the home marches (not the capital, not beside it): the crown's own hearth is anointed already
      const P=S.world.provinces, hp=P[S.players[0].homeProvinceId];
      const near=new Set([hp.id,...W.getNeighborsP(hp,S.world.cols,S.world.rows,P).map(n=>n&&n.id)]);
      const far=P.find(p=>p&&p.terrain!=='sea'&&p.owner==null&&!near.has(p.id));
      S.characters.filter(c=>c.alive&&c.location===far.id).forEach(c=>{ c.alive=false; });   // its chieftain is gone: the province is the realm's
      far.characters=[]; far.neutralDefenders=[]; far.garrisonArmies=[]; far.owner=0; S.players[0].provinces.push(far.id);
      P[k.location].characters=(P[k.location].characters||[]).filter(id=>id!==k.id); far.characters.push(k.id); k.location=far.id;
      home=far.id; return {k:k.id}; },
    orders:(S,x)=>({[x.k]:plan(order('consecrate',''))}),
  });
  const P0=r.S2&&r.S2.players[0];
  const consecrated=JSON.stringify(P0||{}).includes('consecrat')&&/consecrates /.test(r.text(kingId));
  ok(consecrated,'the Divine king consecrated his capital this turn');
  const k=r.S2&&r.S2.characters.find(c=>c.id===kingId);
  ok(k&&((k.tm&&k.tm.holyCasts)||0)===0,`…and it earned no Hierophant merit (holyCasts ${k&&k.tm&&k.tm.holyCasts})`);
  // the words
  // the title as the data file declares it, in the engine's bare vm (tests/lib/engine.ts; until plan P1-09a its line
  // was matched in site/'s copy of the file)
  const R=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8');
  const hiero=JSON.stringify(require('vm').runInContext("TITLE_DEFS.find(t=>t.key==='hiero')",require('./lib/engine.ts').loadEngine({seed:1}))||'');
  ok(hiero.length>0&&!/Consecrate/.test(hiero)&&/Bless/.test(hiero)&&/Resurrect/.test(hiero),`the title's description drops Consecrate: ${hiero.slice(0,140)}`);
  ok(/<tr><td>The Hierophant<\/td><td>Highest White skill, plus Bless Province, Holy Symbol and Resurrect casts\.<\/td>/.test(R),'the rulebook\'s Titles table drops Consecrate');
  ok(!/Nothing here is weighted toward a creed's natural lane/.test(R),'the creed note no longer claims nothing leans toward a creed');
  ok(/no creed scores a title any differently/.test(R),'…it says no creed is scored differently');
  ok(/undead raised by Necromancy/.test(R),'the Deathpriest row says the undead counted are those raised by Necromancy');
  if(sc.errs.length) sc.errs.slice(0,3).forEach(e=>console.log('  page error: '+e));
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
