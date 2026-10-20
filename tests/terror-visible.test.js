// 2026-10-12 (Toby's batch, item 23) — an Evil realm sees how much Terror grips each province: in the map popup and
// under each province in its turn report.
//   • buildTurnReport (GM portal, module level): for an Evil realm every province of the map (worldMeta) that Terror
//     grips carries {pct, stacks, byYou}, its own provinces in the report's list carry it too, and a province it has
//     visited but does not hold gets an intel line; a province with no Terror carries none. Another crown's report
//     carries no Terror at all. The figure is the stacks (at most three) times the stack's share: −10% a stack, or
//     more where Reign of Terror set it.
//   • the player portal: terrorNoteP(pd) writes the reading ("💀 Terror 20% — 2 stacks …"), nothing without one; the
//     map popup calls it in all three of its branches (own, seen, distant) and the Your Provinces entry calls it.
// Level 1 (unit): buildTurnReport and terrorNoteP are module-level functions of the booted portals, fed a staged
// world; the popup is built inside renderPlayerMap's hover handler, so that it calls the note is read from the source
// (level 0) rather than by driving the map's mouse events: by its syntax tree, in one layout whatever the file's
// (tests/lib/source.ts; until plan P1-09a the built page's text was matched).
const fs=require('fs');
const {bootScenario}=require('./lib/scenario'); const {readPage,bootJsdom,sitePath}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  ok(typeof W.buildTurnReport==='function','buildTurnReport is declared at module level');
  const {S}=await sc.world({realms:2,alignments:['Evil','Good']});
  const P=S.world.provinces;
  const mine=P[S.players[0].homeProvinceId];
  const nbrs=W.getNeighborsP(mine,S.world.cols,S.world.rows,P).filter(p=>p&&p.terrain!=='sea'&&p.owner==null);
  const near=nbrs[0], far=P.find(p=>p&&p.terrain!=='sea'&&p.owner!=null&&p.owner!==0)||P.find(p=>p&&p.id!==mine.id&&p.id!==near.id&&p.terrain!=='sea');
  const quiet=nbrs[1];
  // Two stacks of the Evil realm's own Terror next door (a province it has visited), three of it on its own home,
  // and one stack at Reign of Terror's −25% far away.
  const stamp=(p,n,by,pct)=>{ p._terrorStacks=n; p._terrorTurn=S.turn; p._terrorisedBy=by; if(pct!=null) p._terrorPct=pct; };
  stamp(near,2,0); stamp(mine,5,0); stamp(far,1,0,0.25);
  near.visitedBy=[...(near.visitedBy||[]),0];
  const rep=W.buildTurnReport(S,0), good=W.buildTurnReport(S,1);
  const wm=id=>((rep.worldMeta||{}).provinces||[]).find(r=>r&&r.id===id);
  ok(wm(near.id)&&wm(near.id).terror&&wm(near.id).terror.pct===20&&wm(near.id).terror.stacks===2,`the map's record of ${near.name} carries Terror 20%, 2 stacks (got ${JSON.stringify(wm(near.id)&&wm(near.id).terror)})`);
  ok(wm(mine.id)&&wm(mine.id).terror&&wm(mine.id).terror.pct===30&&wm(mine.id).terror.stacks===3,`a save holding five stacks reads as three, 30% (got ${JSON.stringify(wm(mine.id)&&wm(mine.id).terror)})`);
  ok(wm(far.id)&&wm(far.id).terror&&wm(far.id).terror.pct===25,`one stack at Reign of Terror's share reads 25% (got ${JSON.stringify(wm(far.id)&&wm(far.id).terror)})`);
  ok(!!(wm(near.id)&&wm(near.id).terror&&wm(near.id).terror.byYou===true),'…and says it is the realm\'s own Terror');
  ok(wm(quiet.id)&&!wm(quiet.id).terror,'a province with no Terror carries none');
  const own=(rep.ownedProvinces||[]).find(p=>p.id===mine.id);
  ok(own&&own.terror&&own.terror.pct===30,`the realm's own province in the report's list carries its Terror (got ${JSON.stringify(own&&own.terror)})`);
  ok((rep.intel||[]).some(l=>typeof l==='string'&&l.includes(near.name)&&/Terror 20%/.test(l)),`a visited province it does not hold gets an intel line (${(rep.intel||[]).filter(l=>/Terror/.test(l)).join(' | ')})`);
  const goodHas=((good.worldMeta||{}).provinces||[]).some(r=>r&&r.terror)||(good.ownedProvinces||[]).some(p=>p.terror)||(good.intel||[]).some(l=>/Terror \d+%/.test(l));
  ok(!goodHas,'a Good realm\'s report carries no Terror reading');

  // ── The player portal ──
  const errors=[];
  const dom=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/p',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  const pw=dom.window; ok(errors.length===0,'the player portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const note=pw.eval('typeof terrorNoteP==="function"?terrorNoteP:null'); ok(!!note,'terrorNoteP is declared at module level');
  if(note){
    // the note's words as a reader sees them: parsed by the page's own DOM (an inert <template>), not by a pattern
    const box=pw.document.createElement('template'); box.innerHTML=String(note({terror:{pct:20,stacks:2,byYou:true}}));
    const t=box.content.textContent;
    ok(/💀 Terror 20%/.test(t)&&/2 stacks/.test(t),`the note reads the Terror and its stacks: "${t}"`);
    ok(/your own/i.test(t),'…and says when it is the realm\'s own');
    ok(note({})===''&&note({terror:null})==='','no Terror, no note');
  }
  const pp=require('./lib/source.ts').compactPage('kingdoms-call-player-portal.html');
  const tip=(/const showTip=ev=>\{[\s\S]*?g\.addEventListener\('mousemove',showTip\)/.exec(pp)||[''])[0];
  const branches=(tip.match(/terrorNoteP\(pd\)/g)||[]).length;
  ok(tip.length>0&&branches===3,`the map popup writes the note in all three of its branches (found ${branches})`);
  const list=(/document\.getElementById\('report-provinces'\)\.innerHTML=[\s\S]*?No provinces owned yet/.exec(pp)||[''])[0];
  ok(/terrorNoteP\(p[,)]/.test(list),'the Your Provinces entry writes it too');

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
