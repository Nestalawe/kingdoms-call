// 2026-10-13 (item 6) — a hero who raises a skill in the single combat before a battle is told so in
// plain words, straight after that battle's report: "📈 …'s Melee rises to level 4 through hard-won
// experience in single combat with <the general> before the Battle for <province>." The duel itself is
// folded inside the battle's full report, so the short account alone never said why. The line stays
// the owner's own news.
// Level 2 (scenario): the duel, the skill-rise draw and the end-of-phase report all live inside
// runTurn. The rise is made certain (and every other one impossible) by a hook on the experience roll (the anchor below), and the
// chieftain is staged far too weak to win, so the outcome does not depend on the dice.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const ROLL="    if(kcRng()<Math.min(1,chance*_humanLearn*_diminish*mult)){";
(async()=>{
  const sc=await bootScenario({inject:[[ROLL,"    if(window.__riseRule?window.__riseRule(skill,real):kcRng()<Math.min(1,chance*_humanLearn*_diminish*mult)){"]]}); const W=sc.W;
  W.__riseRule=(sk,who)=>sk==='melee'&&!!who&&who.player===0;   // the hero's Melee rises for certain; nobody else's (a chieftain duel allows one advance)
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){
    const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
    let g,N,P;
    for(const x of S.characters.filter(c=>c.player==null&&c.alive&&c._isNeutralGuard&&(c.armies||[]).length)){
      const q=S.world.provinces[x.location]; if(!q||q.terrain==='sea'||q.owner!=null) continue;
      const pp=nb(S,q).find(y=>y.terrain!=='sea'&&y.id!==q.id); if(!pp) continue; g=x; N=q; P=pp; break; }
    if(!H||!g) throw new Error('could not stage: no hero or no chieftain');
    place(S,H,P); H.items=[]; H.skills={...H.skills,melee:3,archery:0}; H.encounterPlan={tactics:['ME','ME','ME','ME','ME'],duelStance:'challenge'};
    g.temper='Brave'; g.items=[]; g.skills={melee:0,archery:0}; g.hp=g.maxHp=2; g.hpEarned=0;
    H.armies=['the Red Hand','the Grey Company','the Oak Shields'].map(n=>({type:'Men-at-Arms',quality:'Elite',unitName:n}));
    return {H,N,g}; },
    orders:(S,c)=>({[c.H.id]:plan(order('move',c.N.id))})});
  const H=r.extra.H, N=r.S2.world.provinces[r.extra.N.id], foe=String(r.extra.g.name).replace(/\s*\(wandering\)/i,'');
  const L=r.log;
  ok(L.some(e=>/Personal duel:/.test(e.text)&&e.text.includes(H.name)),'the hero fights the chieftain in single combat before the battle');
  const i=L.findIndex(e=>/^📈 .+'s Melee rises to level 4/.test(e.text||'')&&e.charId===H.id);
  ok(i>=0,'the hero\'s Melee rises (the roll is made certain)');
  const line=i>=0?L[i]:{text:''};
  ok(line.text.includes(`in single combat with ${foe} before the Battle for ${N.name}`),`the line says why: "${line.text}"`);
  const lastBattle=L.reduce((a,e,j)=>(e.battleId!=null&&e.provinceId===N.id&&e.phase===0)?j:a,-1);
  ok(i>0&&lastBattle>=0&&i===lastBattle+1,`it comes straight after the battle's report (battle ends at ${lastBattle}, rise at ${i})`);
  ok(i>=0&&line.targets&&line.targets.length===1&&line.targets[0]===H.player&&!line.public,'it is the owner\'s news alone');
  const rep=((r.reports[H.player]||{}).lastTurnLog||[]).map(e=>e.text);
  ok(rep.some(t=>t===line.text),'the line reaches the owner\'s turn report');
  ok(!L.some(e=>/rises to level/.test(e.text||'')&&/undefined|NaN/.test(e.text)),'no undefined / NaN in the rise lines');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
