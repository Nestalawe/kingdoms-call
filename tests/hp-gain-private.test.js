// 2026-10-12 (Toby's batch, item 20) — in a fight report, a realm sees its own heroes' maximum-HP rises, never an
// enemy hero's.
//   • Two heroes of different realms fight and both are wounded: each "hardened by the wounds" line reaches its
//     own realm only (a private entry), never the other realm, though the rest of the fight is shared.
//   • A winner's "hardened by the victory" line, pushed into a shared battle narrative, is private to the winner's
//     realm.
//   • A neutral hero's rise is shown to no realm.
//   • With no narrative (a lair cleared alone) the line is still the hero's own realm's news.
// Level 1 (unit): the fight engine, the HP award and the narrative emitter are nested inside runTurn; the hook at
// "  // 4. Run all 5 phases" hands them back after one real turn (as tests/hp-wound-gain does), with the turn's
// own log, which is what each realm's report is cut from (an entry's targets and its public flag).
const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario({inject:[["  // 4. Run all 5 phases\n",
    "  window.__HPP={get G(){ return G; },get L(){ return turnLog; },resolvePersonalCombat,pcCharCombatant,awardWinHp:(...a)=>awardWinHp(turnContext,...a),emitNarrLine:(...a)=>emitNarrLine(turnContext,...a),emitBattle:(...a)=>emitBattle(turnContext,...a)};\n  // 4. Run all 5 phases\n"]]});
  await sc.turn({});
  const H=sc.W.__HPP; if(!H||typeof H.resolvePersonalCombat!=='function'||typeof H.emitNarrLine!=='function'){ console.log('hook missing'); process.exit(1); }
  const G=H.G, L=H.L; let nextId=9400;
  const hero=(name,player,melee,hp)=>{ const c={id:nextId++,name,player,alive:true,race:'Human',alignment:'Good',temper:'Brave',
    skills:{melee},items:[],armies:[],hpEarned:0,maxHp:hp,hp,location:0}; G.characters.push(c); return c; };
  // Who may read a log entry: the report shows a realm an entry that is public, or names it as actor or target.
  const sees=(e,pi)=>!!e&&(e.public||e.actor===pi||(e.targets||[]).includes(pi));
  const hardLines=from=>L.slice(from).filter(e=>/hardened by/.test(String(e.text)));

  // 1. Two master swordsmen of rival realms, far more HP than six rounds can take: both are wounded, both harden.
  { const a=hero('Aldmar the Grey',0,9,200), b=hero('Bresk Ironhand',1,9,200);
    const A=H.pcCharCombatant(a), B=H.pcCharCombatant(b); A.tactics=['ME']; B.tactics=['ME'];
    const res=H.resolvePersonalCombat(A,B,{maxRounds:6});
    ok(a.hpEarned>0&&b.hpEarned>0,`staged: both are wounded and both harden (earned ${a.hpEarned} / ${b.hpEarned})`);
    const from=L.length;
    res.narrative.forEach(line=>H.emitNarrLine('combat',line,{actor:0,targets:[0,1],provinceId:0,charIds:[a.id,b.id]}));
    const lines=hardLines(from), la=lines.find(e=>e.text.includes('Aldmar')), lb=lines.find(e=>e.text.includes('Bresk'));
    ok(la&&lb,`both hardening lines are in the log (${lines.length})`);
    ok(la&&sees(la,0)&&!sees(la,1),`Aldmar's realm reads his rise; Bresk's realm does not (${la&&JSON.stringify({p:la.public,a:la.actor,t:la.targets})})`);
    ok(lb&&sees(lb,1)&&!sees(lb,0),`Bresk's realm reads his rise; Aldmar's realm does not (${lb&&JSON.stringify({p:lb.public,a:lb.actor,t:lb.targets})})`);
    ok(L.slice(from).some(e=>!/hardened by/.test(String(e.text))&&sees(e,0)&&sees(e,1)),'the rest of the fight is still shared by both realms');
    ok(!L.slice(from).some(e=>/\[object Object\]/.test(String(e.text))),'no line reads [object Object]');
  }

  // 2. A battle's winner: the victory line goes into the shared narrative, then out through the battle emitter.
  { const w=hero('Corlis Vane',0,3,20), narr=['⚔ **Battle for Testmoor**'];
    const r=H.awardWinHp(w,narr,'duel');
    ok(r&&r.gain>=2,`staged: the winner hardens (+${r&&r.gain})`);
    const from=L.length;
    H.emitBattle({narrative:narr},G.world.provinces[0],1,[0,1]);
    const line=hardLines(from)[0];
    ok(line&&sees(line,0)&&!sees(line,1),`the winner's realm reads "hardened by the victory"; the beaten realm does not (${line&&JSON.stringify({p:line.public,t:line.targets})})`);
    ok(L.slice(from).some(e=>/Battle for Testmoor/.test(e.text)&&sees(e,1)),'the battle itself is still shown to both realms');
  }

  // 3. A neutral hero's rise is nobody's news.
  { const n=hero('Old Hask',null,3,20), narr=[];
    H.awardWinHp(n,narr,'kill');
    const from=L.length;
    H.emitBattle({narrative:narr},G.world.provinces[0],1,[0,1]);
    const line=hardLines(from)[0];
    ok(!line||(!sees(line,0)&&!sees(line,1)),`a neutral hero's rise is shown to no realm (${line?JSON.stringify({p:line.public,t:line.targets}):'not logged'})`);
  }

  // 4. No narrative: logged straight to the hero's own realm, as before.
  { const s=hero('Dun the Lone',1,3,20); const from=L.length;
    H.awardWinHp(s,null,'lair');
    const line=hardLines(from)[0];
    ok(line&&sees(line,1)&&!sees(line,0),'a lair cleared alone: the hero\'s own realm reads the rise, nobody else');
  }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
