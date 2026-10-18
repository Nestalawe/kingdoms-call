// 2026-10-12 (Toby, the battle reports: who beat whom) — the lines a real turn writes:
//   • a province battle's casualty lines name whom each company fought (the attacker's and the defenders');
//     the losses tally still counts each side's own losses;
//   • a beaten guard's survivors' lines name the host that beat them.
// A fallen commander's host told who slew them is tests/unit/fallen-commander-host.test.ts (plan P1-08f: handleHeroDeath
// and disperseDeadCharArmies are top-level now); each fate of a beaten guard's survivors, with fixed dice, is
// tests/unit/stalled-battles-unit-gain-and-war-fronts.test.ts (plan P1-08i3: erodeGuardSurvivors is top-level now).
// Level 2 (scenario): what a real turn's battle writes. The battle is staged with overwhelming odds, so the attacker
// always wins; which fate each company draws is the dice's, so the checks hold for every line that appears rather than
// for one line in particular.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const CLAUSE=/, (facing|shooting|in a flank duel with|guarding the end against|wrapping the line at|met at the end of the line by|riding free round the flank|fighting from the air|in the reserve|in the second line|shooting at an empty column|with nobody opposite)\b/;
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const named=(type,q,names)=>names.map(nm=>({type,quality:q,unitName:nm}));
  const stage=(S,terrain)=>{
    const H=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing); const land=p=>p.terrain!=='sea';
    let N,P,guard;
    for(const g of S.characters.filter(c=>c.player==null&&c.alive&&c._isNeutralGuard&&(c.armies||[]).length)){
      const q=S.world.provinces[g.location]; if(!q||!land(q)||q.owner!=null) continue;
      const pp=nb(S,q).filter(land).find(x=>x.id!==q.id); if(!pp) continue;
      guard=g; N=q; P=pp; break; }
    if(!H||!guard) throw new Error('could not stage: no hero or no neutral guard');
    S.characters=S.characters.filter(c=>c.player!=null||c.id===guard.id||c.location!==P.id);
    P.characters=(P.characters||[]).filter(id=>S.characters.some(c=>c.id===id));
    own(S,P,0); N.terrain=terrain; guard.items=[];
    place(S,H,P); H.items=[]; H.skills={...(H.skills||{}),archery:0,tactical:0};
    return {H,N,P,guard};
  };

  // ── a province battle: Elite companies against three Average defenders on the plain ──
  const DEF=['Shieldwall Levies 1','Shieldwall Levies 2','Goblin Horde 1'];
  const r=await sc.turn({cols:10,rows:6,seaPct:10,prepare(S){ const st=stage(S,'plain');
      st.guard.armies=named('Shieldwall Levies','Average',DEF.slice(0,2)).concat(named('Goblin Horde','Average',[DEF[2]]));
      st.N.neutralDefenders=[...st.guard.armies]; st.N.npcArmies=3;
      st.H.armies=named('Men-at-Arms','Elite',['the Red Hand','the Grey Company']).concat(named('Yeoman Longbows','Elite',['the Ashen Bows','the Oak Bows']),named('Free Lances','Elite',['the Wind Riders']));
      return st; },
    orders:(S,c)=>({[c.H.id]:plan(order('move',c.N.id))})});
  const H=r.extra.H, guardName=r.extra.guard.name.replace(' (wandering)',''), all=r.log.map(e=>e.text);
  const atkHead=all.findIndex(l=>l===`⚔ **${H.name}'s forces** (attacker):`), defHead=all.findIndex(l=>/^🛡 \*\*.+'s forces\*\* \(defender\):$/.test(l));
  ok(atkHead>=0&&defHead>atkHead,`the report has the attacker's and the defenders' casualty sections (${atkHead}, ${defHead})`);
  ok(new RegExp(`${H.name}'s forces (rout|break|scatter|overwhelm|destroy) `).test(all.join('\n')),'the attacker wins (overwhelming odds)');
  const section=(from,to)=>all.slice(from+1,to<0?undefined:to).filter(l=>l.startsWith('— ')&&!/forces survive the engagement|None left to fight/.test(l));
  const nextHead=(i)=>{ const j=all.slice(i+1).findIndex(l=>/^(⚔|🛡) \*\*/.test(l)); return j<0?-1:i+1+j; };
  const atkLines=section(atkHead,nextHead(atkHead));
  ok(atkLines.every(l=>CLAUSE.test(l)),`every fate line of the attacker's names whom the company fought (${atkLines.length} lines): ${atkLines.filter(l=>!CLAUSE.test(l)).map(l=>`"${l}"`).join(' | ')||'all do'}`);
  ok(atkLines.every(l=>/^— (Despite defeat, )?(the \w+ \w+ \(.+?'s (Men-at-Arms|Yeoman Longbows|Free Lances), Elite\))/.test(l)),`the attacker's companies keep their named form first: ${atkLines.map(l=>`"${l.slice(0,70)}…"`).join(' | ')||'no lines this turn'}`);
  // every defending company writes a line: destroyed (naming whom it faced), cut down in the trap, or eroded
  // afterwards (naming the victor's host)
  const defLines=all.filter(l=>l.startsWith('— ')&&DEF.some(nm=>l.includes(nm)));
  for(const nm of DEF){
    const mine=defLines.filter(l=>l.includes(nm));
    ok(mine.length>=1,`${nm} gets a line`);
    const good=mine.every(l=>(/were destroyed in the rout!$/.test(l)&&CLAUSE.test(l))||/are cut down with no escape!$/.test(l)||(new RegExp(`${H.name}'s host`).test(l)&&/break ranks and flee before|beaten by|hold their ground unbroken against/.test(l)));
    ok(good,`${nm}'s line${mine.length>1?'s':''} name${mine.length>1?'':'s'} whom they fought or who beat them: ${mine.map(l=>`"${l}"`).join(' | ')}`);
  }
  // the tally counts each side's own losses (the first battle's: survivors who hold the ground fight again
  // in a later phase, and that battle writes its own tally)
  const ti=all.findIndex(l=>l.startsWith('⚰ Losses — ')); const tl=ti>=0?all[ti]:null;
  const block=(()=>{ if(ti<0) return []; const j=all.slice(ti+1).findIndex(l=>l.startsWith('⚑FORCE⚑')); return all.slice(ti,j<0?undefined:ti+1+j); })();
  const defLost=block.filter(l=>DEF.some(nm=>l.includes(nm))&&/were destroyed in the rout!$|are cut down with no escape!$/.test(l)).length;
  const atkLost=block.filter(l=>l.startsWith('— ')&&/were destroyed in the fighting\./.test(l)).length;
  ok(!!tl,'the report carries a losses tally');
  if(tl){
    const side=nm=>{ const m=new RegExp(`\\*\\*${nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\*\\*: (no units lost|(\\d+) of (\\d+) units? lost)`).exec(tl); return m?(m[2]?+m[2]:0):null; };
    ok(side(H.name)===atkLost,`the tally's attacker losses match the lines (${side(H.name)} v ${atkLost}): "${tl}"`);
    ok(side(guardName)===defLost,`the tally's defender losses match the lines (${side(guardName)} v ${defLost})`);
  }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
