// 2026-10-13 (item 19) — Battlefield Surgery's lines sit where they belong and say what happened.
// A hero who loses the single combat before a battle and is saved by the surgeons reads "falls in the
// duel — at death's door, but not slain", with the surgery line straight after it, both inside that
// battle's report (before, the surgery line came ahead of the whole battle report and the duel still
// said "is slain"). A hero the surgeons cannot save reads "is slain in the duel!", then "too late",
// to his own realm only.
// Level 2 (scenario): the duel and the death live inside the turn, played in the engine's bare vm
// (tests/lib/scenario-in-the-vm.ts). The hero is staged to lose for certain (1 HP against a strong chieftain) and the
// surgery roll is fixed by standing two functions in there: handleHeroDeath (top-level since plan P1-08f), on the way
// in, makes the next percentile roll (d100) the chosen one, and the surgery roll is the first it makes. (Until plan
// P1-09a the turn was played on the GM portal and a code-anchor hook on the roll's line fixed it.)
// Static (level 0): every other personal-combat death goes through reportHeroFall, which resolves the
// death before it writes "slain": read from the GM portal's source by its syntax tree (tests/lib/source.ts).
const {scenarioInTheVm,order,plan}=require('./lib/scenario-in-the-vm.ts');
const {callsTo,compactPage,pageScripts}=require('./lib/source.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=scenarioInTheVm({seed:1}); const W=sc.W;
  // The surgery roll: handleHeroDeath makes no other roll before it, and a roll it doesn't make is not kept.
  let SURG=null, next=null;
  const d100=W.d100, death=W.handleHeroDeath;
  W.d100=()=>{ if(next!=null){ const r=next; next=null; return r; } return d100(); };
  W.handleHeroDeath=(...a)=>{ next=SURG; try{ return death(...a); } finally{ next=null; } };
  const SD36=W.eval("SAGE_DISCOVERIES_P.find(d=>d.id==='sd36')");
  ok(!!SD36,'Battlefield Surgery is in the discovery table');
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  async function run(roll){
    SURG=roll;
    return sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
      const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
      let g,N,P;
      for(const x of S.characters.filter(c=>c.player==null&&c.alive&&c._isNeutralGuard&&(c.armies||[]).length)){
        const q=S.world.provinces[x.location]; if(!q||q.terrain==='sea'||q.owner!=null) continue;
        const pp=nb(S,q).find(y=>y.terrain!=='sea'&&y.id!==q.id); if(!pp) continue; g=x; N=q; P=pp; break; }
      if(!H||!g) throw new Error('could not stage: no hero or no chieftain');
      S.players[0].discoveries=[...(S.players[0].discoveries||[]),{id:SD36.id,name:SD36.name,category:SD36.category,desc:SD36.desc,turnDiscovered:0}];
      place(S,H,P); H.items=[]; H.temper='Brave'; H.skills={...H.skills,melee:0,archery:0}; H.hp=1; H.maxHp=20; H.encounterPlan={tactics:['ME','ME','ME','ME','ME'],duelStance:'challenge'};
      g.temper='Brave'; g.items=[]; g.skills={melee:5,archery:0}; g.hp=g.maxHp=60;
      H.armies=['the Red Hand','the Grey Company','the Oak Shields'].map(n=>({type:'Men-at-Arms',quality:'Elite',unitName:n}));
      return {H,N,g}; },
      orders:(S,c)=>({[c.H.id]:plan(order('move',c.N.id))})});
  }
  // ── Saved ──
  { const r=await run(1); const H=r.extra.H, N=r.extra.N, L=r.log;
    ok(L.some(e=>/Personal duel:/.test(e.text)&&e.text.includes(H.name)),'the hero fights the chieftain in single combat before the battle');
    const H2=r.S2.characters.find(c=>c.id===H.id);
    ok(H2&&H2.alive!==false,'Battlefield Surgery keeps the hero alive');
    const fall=L.findIndex(e=>(e.text||'').includes(`${H.name} falls in the duel — at death's door, but not slain.`));
    const surg=L.findIndex(e=>/Battlefield Surgery: .* is dragged from the field at death's door/.test(e.text||'')&&(e.text||'').includes(H.name));
    ok(fall>=0,'the duel says the hero fell at death\'s door, not slain');
    ok(!L.some(e=>(e.text||'').includes(`${H.name} is slain in the duel`)),'no line says the hero was slain');
    ok(surg===fall+1,`the surgery line comes straight after it (fall ${fall}, surgery ${surg})`);
    const bid=fall>=0?L[fall].battleId:null;
    ok(bid!=null&&surg>=0&&L[surg].battleId===bid,'both lines are part of that battle\'s report');
    const first=L.findIndex(e=>e.battleId!=null&&e.battleId===bid);
    ok(first>=0&&surg>first,`the surgery line no longer comes before the battle report (battle starts at ${first}, surgery at ${surg})`);
    ok(!L.some(e=>/borne from the field alive/.test(e.text||'')),'the old "borne from the field alive — barely" line is gone (the surgery line says it)'); }
  // ── Too late ──
  { const r=await run(100); const H=r.extra.H, L=r.log;
    const slain=L.findIndex(e=>(e.text||'').includes(`${H.name} is slain in the duel!`));
    const late=L.findIndex(e=>/Battlefield Surgery: the surgeons reach .* too late/.test(e.text||'')&&(e.text||'').includes(H.name));
    ok(slain>=0,'a hero the surgeons cannot save is slain in the duel');
    ok(late===slain+1,`"too late" comes straight after (slain ${slain}, too late ${late})`);
    ok(late>=0&&L[late].battleId!=null&&L[late].battleId===L[slain].battleId,'…inside the battle\'s report');
    ok(late>=0&&Array.isArray(L[late].targets)&&L[late].targets.length===1&&L[late].targets[0]===0&&!L[late].public,'…and only the hero\'s own realm reads it'); }

  // ── Static: the other deaths ──
  const src=compactPage('kingdoms-call-gm-portal.html');
  const calls=pageScripts('kingdoms-call-gm-portal.html').flatMap(f=>callsTo(f,'handleHeroDeath')).map(c=>c.within).sort();
  ok(calls.join()==='handleHeroDeath,preBattleDuel,reportHeroFall',`handleHeroDeath is called only by reportHeroFall, the pre-battle duel and its own copy guard (${calls.length} calls: ${calls.join(', ')})`);
  ok((src.match(/reportHeroFall\(/g)||[]).length>=13,'every other personal-combat death (thief, Charm backlash, lair, assassination, duel, shot, ambush, chase) goes through reportHeroFall');
  ok(!/log\('combat',`[^`]*(slain|cut down|felled|falls in the duel|struck down)[^`]*`[^;]*\);\s*handleHeroDeath\(/.test(src),'no "slain" line is written before the death is resolved');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
