// 2026-10-15 (Toby, D2 and D9) — what a Spy order shows.
//   • Spying a province shows every character there and the army units each leads (type and quality), but no
//     hero's skills; it also shows the characters in every neighbouring province, as a hero standing there
//     would see them (name, realm, rough size).
//   • Spying a hero shows all their skills, the magic items they carry and the army units they lead, in the
//     turn report. That holds for a wandering hero or a local chieftain as for another realm's hero (D9).
// Level 2 (scenario): the Spy order and applySpySuccess are nested inside runTurn, so a real turn runs. Every
// spy has Spy 6 (Master Spy: the order cannot fail), so nothing rests on a roll; and the neighbouring hero stands on
// empty, unclaimed land, so nothing the map deals can take his army away before the report.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 5 (R-111): a province Spy shows another realm's hero's army units by type and quality but records and shows no
// skills, and puts a hero in a neighbouring province on the map and in the sightings with the rough size of their army;
// a Spy on a hero records and reports their skills, items and army; so does a Spy on a local chieftain; the rulebook
// says so. Spies have Spy 6, so no roll decides it (batch 2026-10-15)
const fs=require('fs');
const {bootScenario,order,plan}=require('./lib/scenario'); const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  let ids={};
  const r=await sc.turn({realms:2,
    prepare(S){
      const P=S.world.provinces;
      const moveTo=(c,p)=>{ const old=P[c.location]; if(old&&Array.isArray(old.characters)) old.characters=old.characters.filter(id=>id!==c.id);
        if(!Array.isArray(p.characters)) p.characters=[]; if(!p.characters.includes(c.id)) p.characters.push(c.id); c.location=p.id; };
      const mine=S.characters.filter(c=>c.alive&&c.player===0), theirs=S.characters.filter(c=>c.alive&&c.player===1);
      // X: unclaimed land with a local chieftain. Y: unclaimed land beside it where no realm's character stands. Y must be
      // land: a hero put at sea with no fleet leaves his units ashore as a garrison, so his band would read "no armies".
      // Every guarded province is tried, so the map the seed deals decides only which pair is used, never the outcome.
      const land=p=>!!p&&p.terrain!=='sea';
      const guarded=p=>land(p)&&p.owner==null&&(p.characters||[]).some(id=>S.characters[id]&&S.characters[id]._isNeutralGuard);
      const quietNeighbour=p=>W.getNeighborsP(p,S.world.cols,S.world.rows,P)
        .find(n=>land(n)&&n.owner==null&&!S.characters.some(c=>c.alive&&c.player!=null&&c.location===n.id));
      const X=P.find(p=>guarded(p)&&quietNeighbour(p));
      const Y=X&&quietNeighbour(X);
      const chief=S.characters.find(c=>c.alive&&c._isNeutralGuard&&c.location===X.id);
      const [A,D,F]=mine, [B,E,C]=theirs;
      [A,D,F].forEach(c=>{ moveTo(c,X); c.skills={...(c.skills||{}),spy:6}; });
      moveTo(B,X); moveTo(E,X); moveTo(C,Y);
      B.armies=[{type:'Shieldwall Levies',quality:'Veteran'},{type:'Free Lances',quality:'Average'}];
      E.armies=[{type:'Yeoman Longbows',quality:'Elite'}]; E.items=[{name:'Ring of Testing',slot:'ring',effect:{}}];
      E.skills={...(E.skills||{}),melee:3,tactical:2};
      C.armies=[{type:'Shieldwall Levies',quality:'Green'},{type:'Shieldwall Levies',quality:'Green'},{type:'Shieldwall Levies',quality:'Green'}];
      [B,E,C].forEach(c=>{ c.skills={...(c.skills||{}),spy:0}; });
      ids={A:A.id,D:D.id,F:F.id,B:B.id,E:E.id,C:C.id,chief:chief&&chief.id,X:X.id,Y:Y&&Y.id};
      return ids;
    },
    orders:(S,x)=>({[x.A]:plan(order('spy','')),[x.D]:plan(order('spy','char:'+x.E)),[x.F]:plan(order('spy','char:'+x.chief))}),
  });
  ok(ids.chief!=null&&ids.Y!=null,'the staged world has a guarded province with an unwatched neighbour');
  const rep=r.reports[0]||{}; const pl=(r.S2&&r.S2.players[0])||{};
  const rec=pl._spiedHeroSkills||{};

  // ── Spying the province ──
  const pci=(rep.provinceCharIntel||[]).find(p=>p.provId===ids.X&&p.spied);
  ok(!!pci,'the spied province has its entry in the report');
  const b=pci&&(pci.characters||[]).find(c=>c.name===r.S.characters[ids.B].name);
  ok(b&&Array.isArray(b.armies)&&b.armies.length===2&&b.armies.some(a=>a.type==='Free Lances'&&a.quality==='Average'),`…showing the army units another realm's hero leads, by type and quality (got ${JSON.stringify(b&&b.armies)})`);
  ok(!rec[ids.B],'…but a province spy records no hero\'s skills');
  ok(b&&!b.spiedSkills,'…and the report shows none for them');
  const nearC=(((rep.worldMeta||{}).provinces||[]).find(p=>p&&p.id===ids.Y)||{}).characters||[];
  const c=nearC.find(x=>x.id===ids.C);
  ok(!!c,'a hero in a neighbouring province is on the map, as if your hero stood there');
  ok(c&&c.armyBand==='a modest band'&&!('armyCount' in c),`…with the rough size of their army (got ${c&&c.armyBand})`);
  ok((rep.heroSightings||[]).some(s=>s.name===r.S.characters[ids.C].name&&s.armyBand==='leads a modest band'),'…and in the hero sightings');

  // ── Spying a hero of another realm ──
  const e=rec[ids.E];
  ok(!!e,'spying a hero records what was learned');
  if(e){
    ok(e.skills&&e.skills.melee===3&&e.skills.tactical===2,'…every skill level');
    ok(Array.isArray(e.items)&&e.items.includes('Ring of Testing'),`…the magic items they carry (got ${JSON.stringify(e.items)})`);
    ok(Array.isArray(e.armies)&&e.armies.length===1&&e.armies[0].type==='Yeoman Longbows'&&e.armies[0].quality==='Elite',`…and the army units they lead (got ${JSON.stringify(e.armies)})`);
  }
  const es=(rep.heroSightings||[]).find(s=>s.name===r.S.characters[ids.E].name);
  ok(es&&es.spiedSkills&&es.spiedSkills.melee===3&&(es.spiedItems||[]).includes('Ring of Testing')&&(es.spiedArmies||[]).length===1,`the report's hero sighting shows the skills, items and army (got ${JSON.stringify(es&&{s:es.spiedSkills,i:es.spiedItems,a:es.spiedArmies})})`);
  ok(/Ring of Testing/.test(r.text(ids.D))&&/Yeoman Longbows/.test(r.text(ids.D)),'the spy\'s own report line names the items and the army');

  // ── Spying a local chieftain (D9) ──
  const ch=rec[ids.chief];
  ok(!!ch&&ch.skills&&Array.isArray(ch.items)&&Array.isArray(ch.armies),`spying a local chieftain records their skills, items and army (got ${JSON.stringify(ch)})`);
  const chs=(rep.heroSightings||[]).find(s=>s.name===r.S.characters[ids.chief].name);
  ok(chs&&chs.spiedSkills,'…and the report shows their skills');

  // ── The rulebook says so ──
  const strip=t=>{ for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
  const R=strip(fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8')).replace(/\s+/g,' ');
  ok(/It does not reveal anyone's skills/.test(R),'the rulebook: a province spy reveals no skills');
  ok(/the characters in every province around it/.test(R),'…but shows the characters around it');
  ok(/Spy on a hero/.test(R)&&/every skill level, every magic item they carry and every army unit they lead/.test(R),'…and a hero spy reveals skills, items and army');
  ok(/wandering hero or a local chieftain/.test(R),'…for wanderers and chieftains too');
  if(sc.errs.length) sc.errs.slice(0,3).forEach(x=>console.log('  page error: '+x));
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
