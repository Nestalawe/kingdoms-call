// 2026-10-12 (Toby's batch, item 22) — Evil's Call from the Pit and the Druids' Awaken the Wild are removed: they
// made Creatures and Monsters too easy to come by.
//   • A real turn: an Evil king standing in an owned wild province with a full purse, and a Druidic king in an owned
//     forest, each give the old order (as a save from before the change may still hold): nothing rises, no gold is
//     spent, and each realm reads a plain line that the order is no more.
//   • The player portal offers neither order (its order list, its alignment-order map and its display order), and no
//     page or table still describes them: the rulebook's orders table and alignment sections, the intro, the player
//     portal's realm texts, the data file (the two tier tables are gone, and so is Deep Roots' cheaper awakening),
//     and the GM portal's shared-table list.
// Level 2 (scenario): the order switch is nested inside runTurn; the words are level 0 and ride along here.
const fs=require('fs');
const {bootScenario, order, plan}=require('./lib/scenario'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario();
  const W=sc.W;
  const nbrs=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const home=(S,pi)=>S.world.provinces[S.players[pi].homeProvinceId];
  const king=(S,pi)=>S.characters.find(c=>c.isKing&&c.player===pi);

  // ── A real turn: the old orders do nothing ──
  { const r=await sc.turn({realms:2,alignments:['Evil','Druidic'],prepare(S){
      const ek=king(S,0), dk=king(S,1);
      ek.skills=Object.assign({},ek.skills,{druid:3}); dk.skills=Object.assign({},dk.skills,{druid:3});
      const wild=nbrs(S,home(S,0)).find(p=>p.terrain!=='sea');
      wild.owner=0; wild.race='Primal:Cave Troll'; wild.armyTypes=['Cave Trolls']; wild.neutralDefenders=[]; wild.npcArmies=0;
      if(!S.players[0].provinces.includes(wild.id)) S.players[0].provinces.push(wild.id);
      ek.location=wild.id; S.players[0].gold=60;
      const wood=nbrs(S,home(S,1)).find(p=>p.terrain!=='sea'&&p.id!==wild.id);
      wood.owner=1; wood.terrain='forest'; wood.neutralDefenders=[]; wood.npcArmies=0;
      if(!S.players[1].provinces.includes(wood.id)) S.players[1].provinces.push(wood.id);
      dk.location=wood.id; S.players[1].gold=60;
      return {ek:ek.id,dk:dk.id,eArmies:(ek.armies||[]).length,dArmies:(dk.armies||[]).length};
    },orders:(S,x)=>({
      [x.ek]:plan(order('call_pit','Cave Trolls')),
      [x.dk]:plan(order('awaken_wild','Forest Ents')),
    })});
    const x=r.extra, t=r.text();
    ok(sc.errs.length===0,'the turn runs'+(sc.errs.length?' — '+sc.errs[0].split('\n')[0]:''));
    const ek2=r.S2.characters.find(c=>c.id===x.ek), dk2=r.S2.characters.find(c=>c.id===x.dk);
    ok(!(ek2.armies||[]).some(a=>a.type==='Cave Trolls'),'no Cave Trolls crawl up from the pit');
    ok(!(dk2.armies||[]).some(a=>a.type==='Forest Ents'),'no Forest Ents rise from the wood');
    ok(!/💀 Call from the Pit —|🌿 Awaken the Wild —/.test(t),'no summoning line in the log');
    ok(!/tribute;|offering;/.test(t),'no tribute or offering is paid');
    const rep0=JSON.stringify(r.reports[0]||[]), rep1=JSON.stringify(r.reports[1]||[]);
    ok(/Call from the Pit is no more/.test(rep0),"the Evil realm reads that Call from the Pit is no more");
    ok(/Awaken the Wild is no more/.test(rep1),"the Druidic realm reads that Awaken the Wild is no more");
  }

  // ── The words ──
  // The rulebooks as site/ text; the portals' code in one layout and their files as written, and the data file as
  // written and in one layout, from src/ (tests/lib/source.ts). Until plan P1-09a all were read as site/ text.
  const {compactOf,compactPage,pageSource,SRC}=require('./lib/source.ts');
  const read=f=>fs.readFileSync(sitePath(f),'utf8');
  const ppCode=compactPage('kingdoms-call-player-portal.html'), pp=pageSource('kingdoms-call-player-portal.html'), gm=compactPage('kingdoms-call-gm-portal.html');
  const rules=read('kingdoms-call-rules.html'), intro=read('kingdoms-call-rules-intro.html');
  const data=fs.readFileSync(require('path').join(SRC,'content','kingdoms-call-data.js'),'utf8'), dataCode=compactOf('content/kingdoms-call-data.js');
  const listOf=(src,re)=>(re.exec(src)||['',''])[1];
  ok(!/Awaken the Wild|Call from the Pit/.test(listOf(ppCode,/const ACTIONS *= *\[([\s\S]*?)\];/)),"the player portal's order list offers neither order");
  ok(!/Awaken the Wild|Call from the Pit/.test(listOf(ppCode,/const ALIGN_ACTIONS=\{([^}]*)\}/)),"the player portal's alignment orders no longer name them");
  ok(!/Awaken the Wild|Call from the Pit/.test(listOf(ppCode,/const ACTION_DISPLAY_ORDER=\[([\s\S]*?)\];/)),'…nor its display order');
  ok(!/case 'Awaken the Wild'|case 'Call from the Pit'/.test(ppCode),'the player portal has no target picker for them');
  for(const [page,src] of [['rulebook',rules],['intro',intro],['player portal',pp],['data file',data]]){
    const hits=(src.match(/[^.<>]{0,60}(Awaken the Wild|Call from the Pit)[^.<>]{0,40}/g)||[]);
    ok(hits.length===0,`${page}: no text still offers Awaken the Wild or Call from the Pit${hits.length?' — '+hits.slice(0,2).join(' … '):''}`);
  }
  ok(!/KC_AWAKEN_TIERS|KC_PIT_TIERS/.test(data),'the data file no longer holds the two tier tables');
  ok(!/'KC_AWAKEN_TIERS'|'KC_PIT_TIERS'/.test(listOf(gm,/const KC_SHARED_TABLE_NAMES=\[([^\]]*)\]/)),"the GM portal's shared-table guard no longer asks for them");
  ok(!/'KC_AWAKEN_TIERS'|'KC_PIT_TIERS'/.test(listOf(ppCode,/const need=\[([^\]]*)\]/)),"…nor the player portal's");
  ok(/\{id:'au05'/.test(dataCode)&&!/awakenCost/.test(dataCode),'Deep Roots stays, without the cheaper awakening');

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
