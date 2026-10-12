// 2026-10-13 (Toby, Creatures and Monsters I) — the two crowns in a real world and a real turn. Level 2
// (scenario): world generation and the order and battle paths live inside generateNewGame and runTurn.
//   • world generation: an Evil king starts at Druid 1 and beside a land Monster province, as a Druidic king
//     starts at Druid 1 beside a Creature province (three worlds);
//   • Call from the Pit: an Evil character in an owned wild province calls Cave Trolls for their price + 2g,
//     a second call there the same turn is refused, a Monster above the caller's Druid is refused, a Druidic
//     king's call is refused; the pit also opens on ground still gripped by the realm's own Terror;
//   • Reign of Fear: an Evil host's Monsters fight ×1.5 in a province under its Terror (the ladder says so), and
//     its Druid-1 king leads Cave Trolls with no shortfall warning;
//   • Wild Ferocity is gone: a Druidic host with Forest Ents gets no ×1.25 line; Evil's savage fury stays.
const {bootScenario, order, plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario();
  const W=sc.W;
  const MON=new Set(W.eval('KC_UNIT_CLASS.monster')), CRE=new Set(W.eval('KC_UNIT_CLASS.creature'));
  const nbrs=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const home=(S,pi)=>S.world.provinces[S.players[pi].homeProvinceId];
  const king=(S,pi)=>S.characters.find(c=>c.isKing&&c.player===pi);
  const wildOf=p=>String(p.race||'').startsWith('Primal:')?(p.armyTypes||[])[0]:null;

  // ── World generation, three worlds ──
  // A king's Druid is his crown's +1 on top of whatever his chosen skills hold (a bot king's build, here).
  const build=a=>W.eval(`((typeof BOT_SKILL_BUILD!=="undefined"&&BOT_SKILL_BUILD[${JSON.stringify(a)}])||{}).druid||0`);
  for(let k=0;k<3;k++){
    const {S}=await sc.world({realms:3,alignments:['Evil','Druidic','Neutral']});
    const ek=king(S,0), dk=king(S,1), nk=king(S,2);
    ok(ek&&((ek.skills||{}).druid||0)===1+build('Evil'),`world ${k}: the Evil king starts with Druid +1 (got ${ek&&(ek.skills||{}).druid}, build ${build('Evil')})`);
    ok(dk&&((dk.skills||{}).druid||0)===1+build('Druidic'),`world ${k}: the Druidic king starts with Druid +1 (got ${dk&&(dk.skills||{}).druid}, build ${build('Druidic')})`);
    ok(nk&&((nk.skills||{}).druid||0)===build('Neutral'),`world ${k}: a Neutral king gets no Druid from his crown`);
    const eWild=nbrs(S,home(S,0)).filter(p=>p.terrain!=='sea'&&wildOf(p));
    ok(eWild.length>=1&&eWild.every(p=>MON.has(wildOf(p))),`world ${k}: the Evil king opens beside a land Monster province (wild neighbours: ${eWild.map(p=>wildOf(p)).join(', ')||'none'})`);
    const dWild=nbrs(S,home(S,1)).filter(p=>p.terrain!=='sea'&&wildOf(p));
    ok(dWild.length>=1&&dWild.every(p=>CRE.has(wildOf(p))),`world ${k}: the Druidic king opens beside a land Creature province (wild neighbours: ${dWild.map(p=>wildOf(p)).join(', ')||'none'})`);
  }

  // ── Call from the Pit ──
  {
    const r=await sc.turn({realms:2,alignments:['Evil','Druidic'],prepare(S){
      const ek=king(S,0), dk=king(S,1);
      ek.skills=Object.assign({},ek.skills,{druid:1});
      // An owned wild province beside the Evil home: the king stands in it with a full purse.
      const H=home(S,0); const wild=nbrs(S,H).find(p=>p.terrain!=='sea'&&p.owner==null)||nbrs(S,H).find(p=>p.terrain!=='sea');
      wild.owner=0; wild.race='Primal:Cave Troll'; wild.armyTypes=['Cave Trolls']; wild.neutralDefenders=[]; wild.npcArmies=0;
      if(!S.players[0].provinces.includes(wild.id)) S.players[0].provinces.push(wild.id);
      ek.location=wild.id; S.players[0].gold=40;
      // A second Evil character, in a humanoid province of nobody's that the realm's Terror still grips.
      const far=S.world.provinces.find(p=>p&&p.terrain!=='sea'&&p.owner==null&&!String(p.race||'').startsWith('Primal')&&p.id!==wild.id&&nbrs(S,p).every(n=>n.owner==null));
      far.neutralDefenders=[]; far.npcArmies=0; far._terrorStacks=1; far._terrorTurn=S.turn-1; far._terrorisedBy=0;
      const hero={...JSON.parse(JSON.stringify(ek)),id:'pit-hero',name:'Grishnak the Whip',isKing:false,armies:[],items:[],location:far.id,skills:{druid:1,melee:1}};
      S.characters.push(hero);
      // The Druidic king stands in its own home and is refused.
      return {ek:ek.id,dk:dk.id,hero:hero.id,wild:wild.id,far:far.id,gold:40,trollCost:W.eval("ARMY_COST_MASTER['Cave Trolls']")};
    },orders:(S,x)=>({
      [x.ek]:plan(order('call_pit','Basilisk Brood'),order('call_pit','Cave Trolls'),order('call_pit','Cave Trolls')),
      [x.hero]:plan(order('call_pit','Cave Trolls')),
      [x.dk]:plan(order('call_pit','Cave Trolls')),
    })});
    const t=r.text(), x=r.extra;
    ok(/Basilisk Brood answer only a caller of Druid 2\+/.test(t),'a Monster above the caller\'s Druid is refused ("answer only a caller of Druid 2+")');
    ok(/Call from the Pit — .* Cave Trolls .*(crawl|rise|answer)/.test(t),'the king\'s second call brings Cave Trolls up from the pit');
    ok(/already answered here this season/.test(t),'a second call in the same province the same turn is refused');
    ok(/answers only Evil crowns/.test(t),"the Druidic king's call is refused: the dark answers only Evil crowns");
    const ek2=r.S2&&r.S2.characters.find(c=>c.id===x.ek), hero2=r.S2&&r.S2.characters.find(c=>c.id===x.hero);
    const trolls=c=>((c&&c.armies)||[]).filter(a=>a.type==='Cave Trolls');
    ok(trolls(ek2).length===1&&trolls(ek2)[0].race==='Primal',`the king leads one company of Cave Trolls, of the Primal race (got ${trolls(ek2).length})`);
    ok(trolls(hero2).length===1,`the pit also opens beneath ground gripped by the realm's Terror: the hero leads one company (got ${trolls(hero2).length})`);
    const tributes=(t.match(new RegExp(`\\(${x.trollCost+2}g tribute`,'g'))||[]).length;
    ok(tributes===2,`each call cost the trolls' price + 2g (${x.trollCost+2}g): ${tributes} such tributes in the log`);
  }

  // ── Reign of Fear, the waiver in a battle, and Wild Ferocity gone ──
  {
    const r=await sc.turn({realms:2,alignments:['Evil','Druidic'],prepare(S){
      const ek=king(S,0), dk=king(S,1);
      ek.skills=Object.assign({},ek.skills,{druid:1}); dk.skills=Object.assign({},dk.skills,{druid:1});
      const pickTarget=(pi)=>nbrs(S,home(S,pi)).find(p=>p.terrain!=='sea'&&p.owner==null&&(p.neutralDefenders||[]).length>0)||nbrs(S,home(S,pi)).find(p=>p.terrain!=='sea'&&p.owner==null);
      const eT=pickTarget(0), dT=pickTarget(1);
      if(!(eT.neutralDefenders||[]).length){ eT.neutralDefenders=[{type:'Shieldwall Levies',quality:'Average',race:'Human',unitName:'the Test Levies'}]; eT.npcArmies=1; }
      if(!(dT.neutralDefenders||[]).length){ dT.neutralDefenders=[{type:'Shieldwall Levies',quality:'Average',race:'Human',unitName:'the Test Levies'}]; dT.npcArmies=1; }
      eT._terrorStacks=1; eT._terrorTurn=S.turn-1; eT._terrorisedBy=0;     // ground the Evil realm terrorised last turn
      ek.armies=[...(ek.armies||[]),{type:'Cave Trolls',quality:'Average',race:'Primal',unitName:'the Test Trolls'},{type:'Cave Trolls',quality:'Average',race:'Primal',unitName:'the Deep Trolls'}];
      dk.armies=[...(dk.armies||[]),{type:'Forest Ents',quality:'Average',race:'Primal',unitName:'the Test Ents'}];
      return {ek:ek.id,dk:dk.id,eT:eT.id,dT:dT.id};
    },orders:(S,x)=>({ [x.ek]:plan(order('move',x.eT)), [x.dk]:plan(order('move',x.dT)) })});
    const te=r.text(r.extra.ek), td=r.text(r.extra.dk);
    ok(/Battle for|battle is initiated/.test(te),'the Evil king fights in the terrorised province');
    ok(/Reign of Fear ×1\.5/.test(te),'the ladder names Reign of Fear ×1.5 on the trolls');
    ok(/Terror lingers/.test(te),'the defenders there still fight demoralised by the Terror');
    ok(/savage fury|fanatical zeal/.test(te),"Evil's savage fury (×1.25 with a Monster in the host) stays — or the zeal roll fired, which outranks it and is the one line the report prints then");
    ok(!/Druid shortfall/.test(te),'the Druid-1 Evil king leads his trolls with no shortfall warning');
    ok(/Battle for|battle is initiated/.test(td),'the Druidic king fights too');
    ok(!/wild ferocity/i.test(td)&&!/wild ferocity/i.test(r.text()),'Wild Ferocity is gone: no ×1.25 line for a Druidic host with a Creature');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
