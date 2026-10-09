// 2026-10-09 (Toby item 5) — a spell worked in a battle reaches the turn's statistics (and so the Hall
// of Fame's spell records); a hero who fell this turn is in his realm's end-of-turn snapshot; the
// Imperial Titles each realm holds are in its snapshot every turn.
// Only the Cast order logged a cast, so pre-battle and duel magic never counted.
// Scenario (level 2): the casts are made inside runTurn's battle code; the hook below hands back the
// turn's statistics collector (tests/README.md, code-anchor hooks). Made-up names.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const A="  const _tel={pre:{}, orders:{}, battles:[], encounters:[], captures:[], deaths:[], spells:[], hires:[], recruits:[]};\n";
(async()=>{
  const sc=await bootScenario({inject:[[A,A+"  window.__TEL=_tel;\n"]]});
  const W=sc.W;
  const r=await sc.turn({realms:2,cols:10,rows:6,prepare(S){
    const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
    const home=S.world.provinces[king.location];
    const N=W.getNeighborsP(home,10,6,S.world.provinces).find(p=>p&&p.terrain!=='sea'&&p.owner==null);
    N.features=[]; const gone=new Set(N.characters||[]);
    S.characters=S.characters.filter(c=>!gone.has(c.id)||c.player!=null); N.characters=[];
    N.neutralDefenders=[]; N.npcArmies=0;
    const id=Math.max(...S.characters.map(c=>c.id))+1;
    S.characters.push({id,name:'Warden Testcairn',isKing:false,player:null,race:'Human',alignment:'Neutral',hp:10,maxHp:10,
      skills:{},aptitude:{},items:[],alive:true,merits:0,taxBonus:0,spellsUsedThisTurn:[],location:N.id,locationName:N.name,
      _isNeutralGuard:true,armies:[{type:'Militia',quality:'Green',unitName:'Testcairn Levy'},{type:'Militia',quality:'Green',unitName:'Testcairn Levy II'}]});
    N.characters.push(id);
    // An Elemental master with a battle plan that opens with Fireball.
    king.skills={...(king.skills||{}),elemental:5};
    king.encounterPlan={tactics:['CS:elemental','ME','ME','ME','ME']};
    // A hero of realm 1 who fell before the turn's end is staged by the snapshot check below.
    return {king:king.id,N:N.id};
  },orders(S,x){ return {[x.king]:plan(order('move',x.N))}; }});
  ok(!!r.S2,'the turn resolved and saved');
  ok(/Pre-battle Magic/.test(r.text()),'the king worked battle magic before the fight (staging check)');
  const T=W.__TEL||{};
  const bs=(T.spells||[]).filter(s=>s.ctx==='battle'&&s.pi===0);
  ok(bs.length>0,`the battle cast is in the turn's spell statistics (${bs.length})`);
  ok(bs.every(s=>typeof s.spell==='string'&&isFinite(s.chance)&&typeof s.ok==='boolean'),'…with its spell, chance and outcome');

  // The end-of-turn snapshot: a hero who fell this turn, and the titles held.
  const gs=JSON.parse(JSON.stringify(r.S2));
  const victim=gs.characters.find(c=>c.player===1&&c.alive&&!c.isKing)||gs.characters.find(c=>c.player===1&&c.alive);
  victim.alive=false; victim.killedThisTurn=true; victim.skills={...(victim.skills||{}),melee:7};
  const snap=W.telRealmSnapshot(gs,1);
  ok(Array.isArray(snap.fallen)&&snap.fallen.some(c=>c.id===victim.id&&c.skills.melee===7),'a hero who fell this turn is in his realm\'s snapshot, with his skills');
  ok(!snap.characters.some(c=>c.id===victim.id),'…and not among the living');
  const WR=[]; W.eval('_kcHasTel=true;');
  W.eval('sb').from=(t)=>{ const o={upsert(v){ WR.push({t,v}); return Promise.resolve({error:null}); }}; return o; };
  await W.writeTurnTelemetry(gs,{id:'gs'},[{player_index:0,user_id:'u0'},{player_index:1,user_id:'u1'}],{pre:{},orders:{}},1);
  const rows=(WR.find(x=>x.t==='turn_events')||{}).v||[];
  const st=W.computeStandings(gs);
  const held=Object.entries(st.titles||{}).filter(([k,h])=>h&&h.playerIndex!=null&&h.merit>0);
  ok(rows.length===2,'a statistics row for each realm');
  ok(held.length>0,'some title has a holder in the staged world (staging check)');
  held.forEach(([k,h])=>{ const row=rows.find(x=>x.player_index===h.playerIndex);
    ok(row&&(row.post.titles||[]).some(t=>t.key===k&&t.merit>0),`the ${k} title is in its holder's snapshot this turn`); });
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+String(e).split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
