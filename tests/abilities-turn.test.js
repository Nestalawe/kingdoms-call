// 2026-10-11 (Toby, the unit abilities) — the three abilities that only a real turn can show, because
// their hooks live inside runTurn:
//   Prepared Ground   defending Yeoman Longbows loose two pre-battle volleys (the attacker's loose one);
//   Eyes of the Forest Eagle Riders flying with the shooters spoil a Forest Wardens' Ambush, and the report says so;
//   Raiders' Muster   an orcish province that saw an orc realm win there gains a Goblin Horde in its garrison at
//                     turn's end, for nothing, and the realm is told.
// Level 2 (scenario): each is staged against a neutral guard with overwhelming odds, so the outcome never
// depends on the dice; the lines counted are deterministic whatever the fortune roll does afterwards.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const nb=(S,p)=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const own=(S,p,pi)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(id=>id!==p.id); }); p.owner=pi; if(pi!=null) S.players[pi].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; p.features=[]; p.garrisonArmies=[]; };
  const army=(type,n,q)=>Array.from({length:n},(_,i)=>({type,quality:q||'Average',unitName:type+' '+(i+1)}));
  // A neutral province still held by its own guard (the engine fights for neutral land only when a guard
  // stands there) and a land province next door to attack from; the hero waits there with nobody else.
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
    own(S,P,0); if(terrain) N.terrain=terrain; guard.items=[];
    place(S,H,P); H.items=[]; H.skills={...(H.skills||{}),archery:0};
    return {H,N,P,guard};
  };
  const turn=(terrain,setup)=>sc.turn({cols:10,rows:6,seaPct:10,prepare(S){ const st=stage(S,terrain); setup(S,st); return st; },
    orders:(S,c)=>({[c.H.id]:plan(order('move',c.N.id))})});

  // Prepared Ground: an Elite Longbow company holding the province shoots the lone attacking Levies twice.
  let r=await turn('plain',(S,st)=>{ st.guard.armies=army('Yeoman Longbows',1,'Elite'); st.N.neutralDefenders=[...st.guard.armies]; st.N.npcArmies=1; st.H.armies=army('Shieldwall Levies',1,'Elite'); });
  let txt=r.text(r.extra.H.id);
  ok(/Defender Archery Phase\*\* — 1 ranged unit \(Prepared Ground: the Longbows loose twice\)/.test(txt),'the defenders\' archery names Prepared Ground');
  ok((txt.match(/Yeoman Longbows 1 fires at Shieldwall Levies 1/g)||[]).length===2,`the Longbow company fires twice (got ${(txt.match(/Yeoman Longbows 1 fires at/g)||[]).length})`);
  // …and attacking, Longbows loose once
  r=await turn('plain',(S,st)=>{ st.guard.armies=army('Shieldwall Levies',1,'Elite'); st.N.neutralDefenders=[...st.guard.armies]; st.N.npcArmies=1; st.H.armies=army('Yeoman Longbows',1,'Elite'); });
  txt=r.text(r.extra.H.id);
  // A pinned defender may rally and fight again next phase (a stalled battle), so the count is per battle: one volley each.
  { const battles=(txt.match(/⚔ \*\*Battle for /g)||[]).length, volleys=(txt.match(/Yeoman Longbows 1 fires at/g)||[]).length;
    ok(/Pre-battle Archery Phase\*\* — 1 ranged unit/.test(txt)&&!/Prepared Ground/.test(txt)&&battles>=1&&volleys===battles,`an attacking Longbow company fires once a battle, with no Prepared Ground (${volleys} volleys over ${battles} battle${battles===1?'':'s'})`); }

  // Eyes of the Forest: Forest Wardens in a forest would silence the attacker's archers, unless Eagle Riders fly with them.
  r=await turn('forest',(S,st)=>{ st.guard.armies=army('Forest Wardens',1,'Green'); st.N.neutralDefenders=[...st.guard.armies]; st.N.npcArmies=1; st.H.armies=army('Yeoman Longbows',2,'Elite').concat(army('Eagle Riders',1,'Elite')); });
  txt=r.text(r.extra.H.id);
  ok(/🦅 .*Eagle Riders mark the Forest Wardens in the thickets — the Ambush is spoiled and the volley flies/.test(txt),'the report says the Eagles spoil the Ambush');
  ok(/Pre-battle Archery Phase\*\* — 2 ranged units/.test(txt)&&!/can find no target/.test(txt),'…and the volley flies');
  r=await turn('forest',(S,st)=>{ st.guard.armies=army('Forest Wardens',1,'Green'); st.N.neutralDefenders=[...st.guard.armies]; st.N.npcArmies=1; st.H.armies=army('Yeoman Longbows',2,'Elite'); });
  txt=r.text(r.extra.H.id);
  ok(/archers can find no target — Forest Wardens hold the thickets/.test(txt)&&!/🦅/.test(txt),'without Eagles the Ambush holds as before');

  // Raiders' Muster: an orc realm takes an orcish province; at turn's end a Goblin Horde joins its garrison for nothing.
  r=await turn(null,(S,st)=>{ S.players[0].race='Orcish'; st.N.race='Orcish'; st.guard.armies=army('Goblin Horde',1,'Green'); st.N.neutralDefenders=[...st.guard.armies]; st.N.npcArmies=1; st.H.armies=army('Orc Berserkers',6,'Elite'); });
  { const N2=r.S2&&r.S2.world.provinces[r.extra.N.id]; const all=r.log.map(e=>e.text).join('\n');
    ok(N2&&N2.owner===0,`the orcs take the province (owner ${N2&&N2.owner})`);
    // The horde musters at Average; the end-of-turn garrison drill (a die roll, after the muster) may
    // then raise it one level, and says so. Either way exactly one named horde stands there, and a
    // level above Average is allowed only with the drill's own line for it. (2026-10-14: the check
    // used to assume the drill never fired, so it failed whenever the world's dice let it.)
    const gob=(N2&&N2.garrisonArmies||[]).filter(a=>a&&a.type==='Goblin Horde'&&/^the /.test(a.unitName||''));
    const drilled=g=>new RegExp('🎖 Garrison drills in [^\\n]*'+g.unitName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\(Goblin Horde\\) Average → \\*\\*'+g.quality+'\\*\\*').test(all);
    ok(gob.length===1&&(gob[0].quality==='Average'||drilled(gob[0])),`one named Goblin Horde, mustered at Average, stands in its garrison at turn's end (got ${gob.length}; garrison: ${(N2&&N2.garrisonArmies||[]).map(a=>a.unitName+' '+a.quality).join(', ')||'empty'})`);
    ok(/🥁 Raiders' Muster — word of the victory at .* draws the .* \(Goblin Horde, Average\) to its garrison for nothing\./.test(all),'the realm is told of the muster');
    ok(!N2||N2._raidersMuster==null,'the battle\'s flag is cleared'); }
  // …a human realm's win in the same province musters nothing
  r=await turn(null,(S,st)=>{ S.players[0].race='Human'; st.N.race='Orcish'; st.guard.armies=army('Goblin Horde',1,'Green'); st.N.neutralDefenders=[...st.guard.armies]; st.N.npcArmies=1; st.H.armies=army('Men-at-Arms',6,'Elite'); });
  { const N2=r.S2&&r.S2.world.provinces[r.extra.N.id]; const all=r.log.map(e=>e.text).join('\n');
    ok(N2&&N2.owner===0&&!(N2.garrisonArmies||[]).some(a=>a&&a.type==='Goblin Horde'&&a.quality==='Average')&&!/Raiders' Muster/.test(all),'no muster for a human victor'); }

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
