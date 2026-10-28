// 2026-10-12 (Toby's batch, item 24) — a hero may lead only as many Creature and Monster units as his Druid level.
// Counted: every living beast in his column; not skeletons (the dead need no Druid), not a summoned grove or Wild Hunt
// beasts that leave at the turn's end. The rule bites where a beast would join a column:
//   • Recruit Armies: a beast recruited into a full column musters into the province's garrison instead, and the
//     realm reads why; a mercenary beast is not hired into a full column;
//   • Pick Up Army: a beast taken from the garrison into a full column stays in the garrison;
//   • Leave/Transfer Army: a beast handed to a hero whose column is full stays with the giver;
//   • Wild Calling: no more beasts answer than the caller has room for.
// A hero already over the cap keeps what he leads (nothing a realm owns is taken from it); he takes on no more.
// Level 2 (scenario): the three orders live inside runTurn. beastsLed / beastCommandCount are module-level and are
// checked at level 1 here too.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 24 (2026-10-12): a hero leads at most as many Creature and Monster units as his Druid level (skeletons, a
// summoned grove and Wild Hunt beasts aside). In a real turn a beast recruited into a full column musters into the
// garrison, a full column picks none up, a Druid-0 hero handed a column takes its goblins but not its basilisks, and a
// hero already over the cap keeps what he leads; the books and the hero card say so (it counts with
// `countsAgainstBeastCommand`). Level 2 because the three orders live inside `resolveTurn`.
const {bootScenario, order, plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nbrs=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const home=(S,pi)=>S.world.provinces[S.players[pi].homeProvinceId];
  const king=(S,pi)=>S.characters.find(c=>c.isKing&&c.player===pi);
  const beast=(type,extra)=>Object.assign({type,quality:'Average',race:'Primal',unitName:'the Test '+type.split(' ')[0]},extra||{});

  // ── Level 1: what counts ──
  { const count=W.eval('typeof beastsLed==="function"?beastsLed:null'), counts=W.eval('typeof beastCommandCount==="function"?beastCommandCount:null');
    ok(!!count&&!!counts,'beastsLed and beastCommandCount are declared at module level');
    if(count&&counts){
      ok(counts(beast('Cave Trolls'))&&counts(beast('Forest Ents')),'a Monster and a Creature count');
      ok(!counts(beast('Cave Trolls',{_isSkeletal:true,race:'Undead'})),'a skeletal troll does not (the dead need no Druid)');
      ok(!counts(beast('Forest Ents',{_temporary:true}))&&!counts(beast('Great Bears',{_wildHuntUntilTurn:9})),'nor a summoned grove or Wild Hunt beasts');
      ok(!counts({type:'Shieldwall Levies',quality:'Average'})&&!counts({type:'Eagle Riders',quality:'Average'}),'nor humanoid troops or winged riders');
      ok(count({armies:[beast('Cave Trolls'),beast('Forest Ents'),{type:'Shieldwall Levies'},beast('Cave Trolls',{_isSkeletal:true})]})===2,'a column of a troll, an ent, a levy and a skeletal troll leads two beasts');
    } }

  // ── Level 2: the three orders ──
  const r=await sc.turn({realms:2,alignments:['Evil','Neutral'],prepare(S){
    const ek=king(S,0); const H=home(S,0);
    ek.skills=Object.assign({},ek.skills,{druid:1});
    // The king, leading one troll already, stands in an owned Cave Troll province with a full purse and recruits another.
    const wild=nbrs(S,H).find(p=>p.terrain!=='sea');
    S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(x=>x!==wild.id); });
    wild.owner=0; S.players[0].provinces.push(wild.id); wild.race='Primal:Cave Troll'; wild.armyTypes=['Cave Trolls']; wild.neutralDefenders=[]; wild.npcArmies=0; wild.garrisonArmies=[];
    ek.location=wild.id; ek.armies=[beast('Cave Trolls',{unitName:'the King\'s Trolls'})]; S.players[0].gold=200;
    // A Druid-1 hero at home with one troll already: a troll in the garrison to pick up, and a Druid-0 hero beside him
    // to be handed it.
    const clone=(_tag,name,druid,armies)=>{ const c={...JSON.parse(JSON.stringify(ek)),id:S.characters.length,name,isKing:false,isHeir:false,armies,items:[],location:H.id,skills:{druid,melee:1}}; S.characters.push(c); return c; };
    const full=clone('bc-full','Morg the Drover',1,[beast('Cave Trolls')]);
    const giver=clone('bc-giver','Skarn Hollowhand',2,[beast('Basilisk Brood'),{type:'Goblin Horde',quality:'Average',race:'Orcish',unitName:'the Test Goblins'}]);
    const none=clone('bc-none','Vresh the Pale',0,[]);
    const over=clone('bc-over','Gul the Old',1,[beast('Cave Trolls'),beast('Cave Trolls',{unitName:'the Deep Trolls'})]);
    H.garrisonArmies=[beast('Cave Trolls',{unitName:'the Gate Trolls'})];
    return {ek:ek.id,full:full.id,giver:giver.id,none:none.id,over:over.id,wild:wild.id,home:H.id};
  },orders:(S,x)=>({
    [x.ek]:plan(order('recruit','Cave Trolls|1')),
    [x.full]:plan(order('pickup_army','all')),
    [x.giver]:plan(order('leave_army','all',x.none)),
  })});
  const x=r.extra, S2=r.S2, t=r.text();
  ok(sc.errs.length===0,'the turn runs'+(sc.errs.length?' — '+sc.errs[0].split('\n')[0]:''));
  const ch=id=>S2.characters.find(c=>c.id===id)||{}, beasts=id=>(ch(id).armies||[]).filter(a=>['Cave Trolls','Basilisk Brood'].includes(a.type));
  const wild2=S2.world.provinces[x.wild], home2=S2.world.provinces[x.home];
  ok(beasts(x.ek).length===1,`the Druid-1 king, leading a troll, recruits another and still leads one (got ${beasts(x.ek).length})`);
  ok((wild2.garrisonArmies||[]).filter(a=>a.type==='Cave Trolls').length===1,`…the new company musters into the garrison of the province (got ${(wild2.garrisonArmies||[]).filter(a=>a.type==='Cave Trolls').length})`);
  ok(/can lead only 1 Creature or Monster unit/.test(t),'…and the realm reads why ("can lead only 1 Creature or Monster unit")');
  ok(beasts(x.full).length===1,`a Druid-1 hero already leading a troll picks up none from the garrison (got ${beasts(x.full).length})`);
  ok((home2.garrisonArmies||[]).some(a=>a.unitName==='the Gate Trolls'),'…the Gate Trolls stay in the garrison');
  ok(beasts(x.none).length===0&&(ch(x.none).armies||[]).some(a=>a.type==='Goblin Horde'),`a Druid-0 hero handed a column takes the goblins but not the basilisks (beasts ${beasts(x.none).length})`);
  ok(beasts(x.giver).some(a=>a.type==='Basilisk Brood'),'…the basilisks stay with the giver');
  ok(beasts(x.over).length===2,`a hero already over the cap keeps what he leads (got ${beasts(x.over).length})`);

  // ── The words (level 0) ──
  { const fs=require('fs'), {sitePath}=require('./lib/boot');
    // the player portal: its files as written, and its code in one layout (tests/lib/source.ts; until plan P1-09a,
    // the built page's text)
    const {compactPage,pageSource}=require('./lib/source.ts'), ppCode=compactPage('kingdoms-call-player-portal.html');
    const rules=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8'), intro=fs.readFileSync(sitePath('kingdoms-call-rules-intro.html'),'utf8'), pp=pageSource('kingdoms-call-player-portal.html');
    ok(/A hero leads at most as many Creature and Monster units as his Druid level/.test(rules),"the rulebook's Druid skill says a hero leads at most as many beasts as his Druid level");
    ok((rules.match(/a hero leads at most as many Creature and Monster units as his Druid level/g)||[]).length>=2,'…and both crowns\' sections say so beside their waiver');
    ok((intro.match(/a hero leads as many beasts as his Druid level/g)||[]).length===2,"the intro's Druidic and Evil rows say so");
    ok(!/no Druid training at all/.test(pp),'the player portal no longer says a crown\'s heroes lead beasts with no Druid training at all');
    ok(/arr\.filter\(countsAgainstBeastCommand\)/.test(ppCode)&&/🐾 beasts \$\{_bLed\}\/\$\{druLevel\}/.test(ppCode),"the hero's card counts his beasts against his Druid"); }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
