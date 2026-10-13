// 2026-10-12 (Toby's batch, item 18) — the two front lines always face each other. A unit in the front may stand
// with nobody opposite only when every unit of the enemy's front already has someone opposite it: the narrower
// front stands wholly inside the wider one's span (two fronts of the same size stand column for column). The
// line-up may still reorder a line, but never slide it sideways so that both ends hang free.
// Level 1 (unit): the deploy and the line-up (battleDeploy, battleBestSwap) are module-level pure functions of the
// two sides, the terrain and the roll, with no dice; a scenario would only add a battle's luck on top.
//   • 400 deploys of made-up sides (a fixed generator of their own, not Math.random): none leaves a front unit
//     unfaced while an enemy front unit is unfaced too (on the build before this item, 64 of these 400 did);
//   • one hand-built deploy that used to slide: five against five on the plains, both lines faced column for column.
const {readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };

(async()=>{
  const errors=[];
  const dom=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/gm',
    setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(r=>setTimeout(r,1200));
  const w=dom.window; const ev=expr=>w.eval(expr);
  ok(errors.length===0,'the GM portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
  const deploy=ev('battleDeploy'), RANGE=ev('BATTLE_FRONT_RANGE');
  const BASE={'Shieldwall Levies':8,'Men-at-Arms':12,'Free Lances':10,'Yeoman Longbows':8,'Orc Berserkers':12,'Goblin Horde':6,'Warg Riders':12,'Black Arrows':8,'Cave Trolls':22,'Stone Giants':26};
  const types=Object.keys(BASE);
  // The span of a front: first and last occupied column, and how many stand in it.
  const span=g=>{ const o=g.front.map(Boolean); return {f:o.indexOf(true),l:o.lastIndexOf(true),n:o.filter(Boolean).length}; };
  // The rule: the narrower front stands within the wider front's span (same size: the same columns).
  const meet=(gA,gD)=>{ const a=span(gA), d=span(gD); if(!a.n||!d.n) return true;
    return a.n<=d.n?(a.f>=d.f&&a.l<=d.l):(d.f>=a.f&&d.l<=a.l); };
  const show=g=>g.front.map(x=>x?x.r.a.type.split(' ')[0].slice(0,5):'·').join('|');

  // ── 400 deploys of made-up sides ──
  { let seed=7; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
    const row=t=>({a:{type:t,quality:'Average',unitName:t},base:BASE[t]*(0.6+rnd()*0.8)});
    let bad=0, ex=null, moved=0;
    for(let k=0;k<400;k++){
      const terr=['plain','forest','mountain','desert','jungle'][k%5];
      const nA=1+Math.floor(rnd()*9), nD=1+Math.floor(rnd()*9);
      const rA=Array.from({length:nA},()=>row(types[Math.floor(rnd()*types.length)])), rD=Array.from({length:nD},()=>row(types[Math.floor(rnd()*types.length)]));
      const r=RANGE[terr], roll=r[0]+Math.floor(rnd()*(r[1]-r[0]+1));
      const d=deploy(rA,rD,{terrain:terr,roll,tacA:Math.floor(rnd()*4),tacD:Math.floor(rnd()*4),flankA:false,flankD:false,scout:rnd()<0.5?'atk':'def'});
      if(d.lineup||d.moves.scout||d.moves.other) moved++;
      if(!meet(d.gA,d.gD)){ bad++; if(!ex) ex=`${terr}, front ${d.W}: attacker ${show(d.gA)} · defender ${show(d.gD)}`; }
    }
    ok(moved>100,`the line-ups still shift lines (${moved} of 400 deploys made at least one swap)`);
    ok(bad===0,`no deploy leaves a front unit with nobody opposite while an enemy front unit has nobody opposite too (${bad} of 400 did${ex?'; first: '+ex:''})`);
  }

  // ── The hand-built deploy: five against five on the plains ──
  { const row=(t,b)=>({a:{type:t,quality:'Average',unitName:t},base:b});
    const A=[row('Stone Giants',26),row('Goblin Horde',6),row('Cave Trolls',22),row('Stone Giants',24),row('Cave Trolls',20)];
    const D=[row('Stone Giants',20),row('Cave Trolls',22),row('Men-at-Arms',12),row('Shieldwall Levies',8),row('Shieldwall Levies',8)];
    for(const scout of ['atk','def']) for(const tac of [0,3]){
      const d=deploy(A,D,{terrain:'plain',roll:7,tacA:tac,tacD:tac,flankA:false,flankD:false,scout});
      const a=span(d.gA), b=span(d.gD);
      ok(a.f===b.f&&a.l===b.l,`five against five (${scout} scouts, Tactical ${tac}): both fronts hold the same columns — attacker ${show(d.gA)} · defender ${show(d.gD)}`);
      ok(d.gA.face.units.concat(d.gD.face.units).filter(u=>u.place==='front').every(u=>!/nobody opposite|wraps/.test(u.why||'')),'…so no front unit wraps an end or stands with nobody opposite');
    }
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
