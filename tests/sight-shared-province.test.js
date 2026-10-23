// 2026-10-15 (Toby, D1) — another realm's hero sharing a province with one of yours at the end of the turn is
// always seen: their Spy can no longer slip them past your hero. Only Invisibility still hides them (Toby kept
// it), and wandering heroes and local chieftains keep their small chance to slip by. Without a Spy you learn
// only the hero's name, the realm they serve and the rough size of their army, wherever they stand (your own
// land included): no race, alignment, renown or exact count. The map shows the same.
//   • buildTurnReport (GM portal, module level), fed a staged world: the map's characters (worldMeta) and the
//     hero sightings;
//   • popupKnownChars (player portal, module level): the map popup writes the rough size for another realm's
//     hero, the exact count for your own;
//   • source (level 0): the province character intel (built in buildReports from the realm's view, playerView, which
//     chooses its heroes: plan P1-12b4) and the intrusion alerts use the one sight rule and the rough size: read from
//     src/ by their syntax tree, in one layout whatever the files' (tests/lib/source.ts; until plan P1-09a the built
//     pages' text was matched).
// Level 1 (unit): both functions are module level and take a staged world or record, so no turn needs to run;
// the report-time Spy roll is staged by stamping its result (_unspottedTurn) on the characters.
const fs=require('fs');
const {bootScenario}=require('./lib/scenario'); const {readPage,bootJsdom,sitePath}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
const {compactDeclaration,compactPage}=require('./lib/source.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const {S}=await sc.world({realms:2});
  const P=S.world.provinces;
  const moveTo=(c,p)=>{ const old=P[c.location]; if(old&&Array.isArray(old.characters)) old.characters=old.characters.filter(id=>id!==c.id);
    if(!Array.isArray(p.characters)) p.characters=[]; if(!p.characters.includes(c.id)) p.characters.push(c.id); c.location=p.id; };
  const mine=S.characters.find(c=>c.alive&&c.player===0), theirs=S.characters.find(c=>c.alive&&c.player===1);
  const wild=P.find(p=>p&&p.terrain!=='sea'&&p.owner==null);   // its local chieftain stays: he is not the subject
  const home0=P[S.players[0].homeProvinceId];
  ok(!!(mine&&theirs&&wild&&home0),'the staged world has a hero for each realm, an unowned province and a capital');
  const army=n=>Array.from({length:n},()=>({type:'Shieldwall Levies',quality:'Average'}));
  const T=S.turn;

  // ── Another realm's hero beside yours, in land neither holds, having rolled to slip by unseen ──
  moveTo(mine,wild); moveTo(theirs,wild); theirs.armies=army(4); theirs._unspottedTurn=T;
  const wander={...JSON.parse(JSON.stringify(theirs)),id:S.characters.length,player:null,name:'Wanderer Test',armies:[],_unspottedTurn:T,isKing:false};
  S.characters.push(wander); wild.characters.push(wander.id);
  let rep=W.buildTurnReport(W.playerView(S,0));
  const chars=id=>(((rep.worldMeta||{}).provinces||[]).find(r=>r&&r.id===id)||{}).characters||[];
  const seen=chars(wild.id).find(c=>c.id===theirs.id);
  ok(!!seen,'another realm\'s hero sharing a province with yours is on your map, though their Spy rolled to hide');
  ok(seen&&seen.ownerName===S.players[1].name,'…with the realm they serve');
  ok(seen&&seen.armyBand==='a modest band',`…and the rough size of their army (got ${seen&&seen.armyBand})`);
  ok(seen&&!('armyCount' in seen),'…but not the exact count');
  const own=chars(wild.id).find(c=>c.id===mine.id);
  ok(own&&own.armyCount===(mine.armies||[]).length,'your own hero still shows the exact count');
  ok(!chars(wild.id).some(c=>c.id===wander.id),'a wandering hero who rolled to slip by is still unseen');
  const sight=(rep.heroSightings||[]).find(s=>s.name===theirs.name);
  ok(!!sight&&sight.type==='enemy','the hero sightings list them');
  if(sight){
    ok(sight.armyBand==='leads a modest band','…with the rough size');
    ok(!sight.race&&!sight.alignment&&!sight.topSkill,`…and no race, alignment or renown (got ${[sight.race,sight.alignment,JSON.stringify(sight.topSkill)].join(' / ')})`);
    ok(!new RegExp(`${theirs.race}|renowned|legendary|heroic`,'i').test(sight.text),`…in the text too: "${sight.text}"`);
  }

  // ── The heroes your orders can target (Spy, Charm, Encounter, spells) follow the same rule ──
  const vc=(rep.visibleChars||[]).find(x=>x.id===theirs.id);
  ok(!!vc,'another realm\'s hero beside yours is in the list your orders can target');
  if(vc){
    ok(vc.armyBand==='a modest band'&&vc.leadsArmies===true,`…with the rough size and whether they lead troops (got ${vc.armyBand} / ${vc.leadsArmies})`);
    const leak=['race','alignment','armies','skills','temper','hp','maxHp','pay'].filter(k=>k in vc);
    ok(leak.length===0,`…and nothing more (sent: ${leak.join(', ')||'nothing'})`);
  }
  ok(!(rep.visibleChars||[]).some(x=>x.id===wander.id),'a wandering hero who rolled to slip by is not in the target list');
  // a lone hero of another realm (no troops): still nothing but name and realm
  theirs.armies=[]; rep=W.buildTurnReport(W.playerView(S,0));
  const lone=(rep.visibleChars||[]).find(x=>x.id===theirs.id);
  ok(lone&&lone.leadsArmies===false&&!('hp' in lone)&&!('temper' in lone),`a lone hero of another realm is listed as leading no troops, with no hit points or temper (got ${JSON.stringify(lone)})`);
  theirs.armies=army(4);

  // ── Invisibility still hides them ──
  theirs._invisTurn=T; rep=W.buildTurnReport(W.playerView(S,0));
  ok(!chars(wild.id).some(c=>c.id===theirs.id)&&!(rep.heroSightings||[]).some(s=>s.name===theirs.name),'a hero under Invisibility is not seen, even beside your hero');
  ok(!(rep.visibleChars||[]).some(x=>x.id===theirs.id),'…nor in the target list');
  delete theirs._invisTurn;

  // ── In your own land, with none of your heroes there: the same limit ──
  // every hero of the realm stays out of its capital (in the wild province), so none of them stands beside the intruder
  S.characters.filter(c=>c.alive&&c.player===0).forEach(c=>moveTo(c,wild));
  const land=home0;
  moveTo(theirs,land); theirs._unspottedTurn=null; theirs.armies=army(1);
  rep=W.buildTurnReport(W.playerView(S,0));
  const intruder=(rep.heroSightings||[]).find(s=>s.name===theirs.name);
  ok(!!intruder,'an intruder leading troops in your land is seen');
  ok(intruder&&!intruder.race&&!intruder.alignment&&!intruder.topSkill&&intruder.armyBand==='leads a small escort (a few units)',`…described only by name, realm and rough size (got ${intruder&&intruder.text})`);

  // ── The player portal's map popup ──
  const errors=[];
  const dom=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/p',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  const pw=dom.window; ok(errors.length===0,'the player portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const pop=pw.eval('typeof popupKnownChars==="function"?popupKnownChars:null'); ok(!!pop,'popupKnownChars is declared at module level');
  if(pop){
    const box=pw.document.createElement('template');
    box.innerHTML=String(pop({id:1,characters:[{id:1,name:'Own Hero',isOwn:true,armyCount:3},{id:2,name:'Their Hero',isOwn:false,ownerName:'Red Realm',armyBand:'a modest band'}]},[]));
    const t=box.content.textContent;
    ok(/Own Hero \(3 units\)/.test(t),`the popup gives your own hero's exact count: "${t}"`);
    ok(/Their Hero of Red Realm \(a modest band\)/.test(t),`…and another realm's hero's rough size: "${t}"`);
  }

  // ── Source: the province character intel and the intrusion alerts ──
  const gm=compactPage('kingdoms-call-gm-portal.html');
  // since P1-12b4 the realm's view (playerView) chooses the heroes and their army's size, and the section copies them
  const view=compactDeclaration('views/what-each-realm-may-see-of-the-world.ts','playerView');
  const pci=compactDeclaration('views/turn-report.ts','provinceCharIntelOf'); // (P1-12b5: with the rest of the report)
  ok(/heroesInItsProvinceIntelligence=[^;]*\.filter\(c=>c\.player===realm\|\|enemyCharVisibleTo\(state,realm,c,provinceIntelligenceSight\)\)/.test(view)&&/const visible=p\.heroesInItsProvinceIntelligence;/.test(pci),'the province character intel uses the one sight rule (enemyCharVisibleTo)');
  ok((pci.match(/armyCount:/g)||[]).length===1&&/c\.player===pi\?\{armyCount:c\.armyCount\}:\{armyBand:c\.armyBand\}/.test(pci)&&/armyCount:own\|\|how==='everyHero'\?armies\.length:null,armyBand:own\|\|how==='everyHero'\?null:armySizeBand\(armies\.length\)/.test(view),'…and sends the exact army count for your own heroes only, the rough size for anyone else');
  ok(!/describeEnemyForce/.test(gm),'the intrusion alerts no longer read the force by the watcher\'s Spy');
  ok(/armySizeBand\(\(ac\.armies\|\|\[\]\)\.length\)/.test(gm),'…they give its rough size');

  // ── The rulebook says the same ──
  const strip=t=>{ for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
  const R=strip(fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8')).replace(/\s+/g,' ');
  ok(/every other realm's hero there is always seen, however good their Spy/.test(R),'the rulebook: another realm\'s hero beside yours is always seen');
  ok(/You see their name, the realm they serve and a rough sense of how large a force they lead/.test(R),'…and what you learn of them');
  ok(/Invisibility is the one exception to both/.test(R),'…Invisibility still hides');
  ok(/5% chance per Spy level \(up to 25%\)/.test(R)&&!/older concealment rule/.test(R),'…wanderers keep a stated chance to slip by');
  ok(!/Accuracy of what you learn scales separately/.test(R),'…and no Spy-level accuracy ladder remains');
  const ppSrc=compactPage('kingdoms-call-player-portal.html');
  ok(!/\(x\.armies\|\|0\)/.test(ppSrc)&&!/\(tgt\.armies\|\|0\)/.test(ppSrc),'the player portal reads whether a target leads troops, not their count');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
