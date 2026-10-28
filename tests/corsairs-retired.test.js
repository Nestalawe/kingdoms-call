// 2026-10-15 (Toby, D3: the Corsair fleet is gone) — no new world offers the Corsair Fleet, and now no
// book or page a player reads names it either: the rulebooks' roster, move-rate table, ferry list and
// retreat rule, the player portal's unit blurb and Human description, and Admiralty's text. In a game
// already running, a province whose pool still offers Corsairs offers the Galleon Fleet instead
// (retireCorsairPools, in the save's upgrade at the top of every turn); a Corsair company already raised keeps fighting as it
// did. Letters of Marque, the Human discovery that only lifted Corsairs, now lifts the Galleon Fleet the same
// way (+30% when attacking) until a full review of the discoveries (Toby, 2026-10-15).
// Level 0 (static) for the words; level 1 (unit) for the migration: retireCorsairPools is a top-level function of
// the engine (src/engine/grand-design.ts), called on a hand-made world in its bare vm (tests/lib/engine.ts). The
// rulebooks are read as site/ text; the player portal as its files under src/ (tests/lib/source.ts), the data file's
// discoveries in the vm, and the call in the turn by its syntax tree. Until plan P1-09a the portals and the data file
// were read as site/ text, and the migration ran on the booted GM portal.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 3 (R-109): no rulebook or player-portal text names the Corsairs, Admiralty names the Galleons only, Letters of
// Marque lifts the Galleon Fleet +30% when attacking (item 12), and `retireCorsairPools` turns a running game's Corsair
// offer into the Galleon (once, idempotent) while keeping Corsair companies already raised (batch 2026-10-15); the turn
// passes the loaded world through the save's upgrade, which calls it (by syntax tree; since P1-15a)
const fs=require('fs'), path=require('path'), vm=require('vm');
const {sitePath}=require('./lib/boot'); const {loadEngine,engineFn}=require('./lib/engine.ts');
const {callsTo,pageScripts,pageSource}=require('./lib/source.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const PP='kingdoms-call-player-portal.html';
const read=f=>f===PP?pageSource(PP):fs.readFileSync(sitePath(f),'utf8');
const engine=loadEngine({seed:1});

// ── The words ──
for(const f of ['kingdoms-call-rules.html','kingdoms-call-rules-intro.html','kingdoms-call-player-portal.html']){
  const n=(read(f).match(/Corsair/g)||[]).length;
  ok(n===0,`${f} no longer names the Corsairs (${n} left)`);
}
// each discovery as the data file declares it (its JSON keeps the keys' order)
const discovery=id=>JSON.stringify(vm.runInContext(`SAGE_DISCOVERIES_P.find(d=>d.id===${JSON.stringify(id)})`,engine)||null);
const descOf=id=>((/"desc":"([^"]*)"/).exec(discovery(id))||['',''])[1];
ok(descOf('rh12').length>0&&!/Corsair/.test(descOf('rh12')),'Admiralty\'s text names the Galleons only');
const rh18=discovery('rh18');
ok(/"desc":"Galleon Fleets of your realm fight at \+30% strength when attacking\."/.test(rh18),`Letters of Marque's text names the Galleons: ${rh18.slice(0,160)}`);
ok(/"effect":\{"kind":"unitStr","pct":0\.3,"types":\["Galleon Fleet"\],"side":"atk"\}/.test(rh18),'…and its effect lifts the Galleon Fleet, +30% when attacking');

// ── The migration ──
{
  const fn=vm.runInContext('typeof retireCorsairPools==="function"?retireCorsairPools:null',engine);
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
  // the turn passes the loaded world through the save's upgrade (plan P1-15a), which calls the pass on it
  const calls=pageScripts('kingdoms-call-gm-portal.html').flatMap(f=>callsTo(f,'upgradeGameState'));
  ok(calls.some(c=>c.within==='resolveTurn'&&c.args.join()==='G'),'runTurn passes the loaded world through the save\'s upgrade');
  ok(callsTo('engine/saves/upgrade-a-saved-game-and-check-it.ts','retireCorsairPools').some(c=>c.within==='upgradeGameState'&&c.args.join()==='save'),'the save\'s upgrade calls retireCorsairPools on it');
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
}
