// 2026-10-15 (Toby, D3: the Corsair fleet is gone) — no new world offers the Corsair Fleet, and now no
// book or page a player reads names it either: the rulebooks' roster, move-rate table, ferry list and
// retreat rule, the player portal's unit blurb and Human description, and Admiralty's text. In a game
// already running, a province whose pool still offers Corsairs offers the Galleon Fleet instead
// (retireCorsairPools, at the top of every turn); a Corsair company already raised keeps fighting as it
// did. Letters of Marque, the Human discovery that only lifted Corsairs, now lifts the Galleon Fleet the same
// way (+30% when attacking) until a full review of the discoveries (Toby, 2026-10-15).
// Level 0 (static) for the words; level 1 (unit) for the migration: retireCorsairPools is a module-level
// function of the GM portal, called on a hand-made world, so nothing lower can run it.
const fs=require('fs'), path=require('path');
const {readPage,bootJsdom,sitePath}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const read=f=>fs.readFileSync(sitePath(f),'utf8');

// ── The words ──
for(const f of ['kingdoms-call-rules.html','kingdoms-call-rules-intro.html','kingdoms-call-player-portal.html']){
  const n=(read(f).match(/Corsair/g)||[]).length;
  ok(n===0,`${f} no longer names the Corsairs (${n} left)`);
}
const D=read('kingdoms-call-data.js');
const descOf=id=>((new RegExp(`\\{"id":"${id}"[^\\n]*?"desc":"([^"]*)"`)).exec(D)||['',''])[1];
ok(descOf('rh12').length>0&&!/Corsair/.test(descOf('rh12')),'Admiralty\'s text names the Galleons only');
const rh18=(/\{"id":"rh18"[^\n]*/.exec(D)||[''])[0];
ok(/"desc":"Galleon Fleets of your realm fight at \+30% strength when attacking\."/.test(rh18),`Letters of Marque's text names the Galleons: ${rh18.slice(0,160)}`);
ok(/"effect":\{"kind":"unitStr","pct":0\.3,"types":\["Galleon Fleet"\],"side":"atk"\}/.test(rh18),'…and its effect lifts the Galleon Fleet, +30% when attacking');

// ── The migration ──
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage('kingdoms-call-gm-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message))); w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=()=>{}; }});
  await new Promise(r=>setTimeout(r,300)); const W=d.window;
  const fn=W.eval('typeof retireCorsairPools==="function"?retireCorsairPools:null');
  ok(!!fn,'the GM portal declares retireCorsairPools');
  if(fn){
    const gs={world:{provinces:[
      {id:0,terrain:'plain',race:'Human',armyTypes:['Shieldwall Levies','Corsair Fleet','Human Garrison']},
      {id:1,terrain:'plain',race:'Human',armyTypes:['Galleon Fleet','Corsair Fleet']},
      {id:2,terrain:'forest',race:'Elven',armyTypes:['Elven Bowmen','Elven Galleys']},
      {id:3,terrain:'sea',armyTypes:[]},
    ]},characters:[{id:'h1',armies:[{type:'Corsair Fleet',quality:'Veteran'}]}]};
    fn(gs);
    const P=gs.world.provinces;
    ok(JSON.stringify(P[0].armyTypes)===JSON.stringify(['Shieldwall Levies','Galleon Fleet','Human Garrison']),`a pool offering Corsairs offers the Galleon in its place (got ${P[0].armyTypes.join(', ')})`);
    ok(JSON.stringify(P[1].armyTypes)===JSON.stringify(['Galleon Fleet']),`a pool that already offers the Galleon simply loses the Corsairs (got ${P[1].armyTypes.join(', ')})`);
    ok(JSON.stringify(P[2].armyTypes)===JSON.stringify(['Elven Bowmen','Elven Galleys']),'a pool without Corsairs is untouched');
    ok(gs.characters[0].armies[0].type==='Corsair Fleet','a Corsair company already raised is kept');
    const before=JSON.stringify(gs); fn(gs); ok(JSON.stringify(gs)===before,'a second run changes nothing (it runs every turn)');
  }
  const gm=read('kingdoms-call-gm-portal.html');
  ok(/\n\s*retireCorsairPools\(G\);/.test(gm),'runTurn calls retireCorsairPools on the loaded world');
  if(errs.length) errs.slice(0,3).forEach(e=>console.log('  page error: '+e));
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})();
