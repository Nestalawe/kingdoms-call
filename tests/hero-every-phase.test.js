// 2026-10-09 (Toby item 1) — every hero has at least one line in every season of his realm's report.
// A hero who marched in Fall with a friendly hero and was pulled into that hero's assault on a
// neutral-guarded province (Contingent unify) had NO Fall line at all: the unify and the battle were
// filed under the hero who led the march, and the "order superseded" note fell into Realm Events.
// Scenario (level 2): the unify and the report filing are nested inside runTurn. Made-up names.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const SEASONS=['Spring','Early Summer','Late Summer','Fall','Early Winter'];
(async()=>{
  const sc=await bootScenario();
  let staged=null;
  const r=await sc.turn({realms:2,cols:10,rows:6,prepare(S,W){
    const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
    const home=S.world.provinces[king.location];
    const N=W.getNeighborsP(home,10,6,S.world.provinces).find(p=>p&&p.terrain!=='sea'&&p.owner==null);
    ok(!!N,'found a free land province beside the capital');
    ok((king.armies||[]).length>0,'the king leads an army');
    // N: no lair or ruin, and its own guard (if any) replaced by one made-up guard with a small band.
    N.features=[]; const gone=new Set(N.characters||[]);
    S.characters=S.characters.filter(c=>!gone.has(c.id)||c.player!=null); N.characters=[];
    N.neutralDefenders=[]; N.npcArmies=0;
    const nextId=Math.max(...S.characters.map(c=>c.id))+1;
    const guard={id:nextId,name:'Warden Testcairn',isKing:false,player:null,race:'Human',alignment:'Neutral',
      hp:10,maxHp:10,skills:{},aptitude:{},items:[],alive:true,merits:0,taxBonus:0,spellsUsedThisTurn:[],
      location:N.id,locationName:N.name,_isNeutralGuard:true,
      armies:[{type:'Militia',quality:'Green',unitName:'Testcairn Levy'}]};
    S.characters.push(guard); N.characters.push(guard.id);
    // A second hero of realm 0 stands with the king; both are sure to unify (March 5, same start).
    const ally=JSON.parse(JSON.stringify(king));
    Object.assign(ally,{id:nextId+1,name:'Sir Testwick',isKing:false,
      armies:king.armies.map((a,i)=>({...a,unitName:'Tester Company '+(i+1)}))});
    S.characters.push(ally); home.characters=[...(home.characters||[]),ally.id];
    king.skills={...(king.skills||{}),march:5}; ally.skills={...(ally.skills||{}),march:5};
    staged={king:king.id,ally:ally.id,N:N.id};
    return staged;
  },orders(S,x){
    const mv=order('move',x.N);
    return {[x.king]:plan(order('rest'),order('rest'),order('rest'),mv),
            [x.ally]:plan(order('rest'),order('rest'),order('rest'),mv)};
  }});
  ok(!!r.S2,'the turn resolved and saved');
  ok(/Contingent unify/.test(r.text()),'the two heroes unified for the Fall assault (staging check)');

  const rep=r.reports[0]||{}; const lines=rep.lastTurnLog||[];
  ok(lines.length>0,'realm 0 received a report');
  const heroes=(r.S2?r.S2.characters:[]).filter(c=>c.player===0&&c.alive);
  ok(heroes.length>=2,'both of realm 0\'s heroes are alive and in the report');
  heroes.forEach(h=>{
    for(let ph=0;ph<5;ph++){
      const n=lines.filter(e=>e.charId===h.id&&e.phase===ph).length;
      ok(n>0,`${h.name} has a line in ${SEASONS[ph]} (got ${n})`);
    }
  });
  const allyFall=lines.filter(e=>e.charId===staged.ally&&e.phase===3).map(e=>e.text).join('\n');
  ok(/host|joins|unif/i.test(allyFall),'the joining hero\'s Fall says he marched with the other hero\'s host:\n'+allyFall);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+String(e).split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
